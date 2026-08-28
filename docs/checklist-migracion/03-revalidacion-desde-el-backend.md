# 03 — Revalidación: el backend avisa cuando algo cambia

El [doc 02](./02-cache-de-datos.md) deja los datos cacheados con TTL largo. Este documento resuelve la
otra mitad: **que el cambio se vea al instante en vez de esperar el TTL.**

El flujo completo:

```
Alguien guarda la config en el dashboard
        ↓
Backend termina la transacción
        ↓
Backend hace POST a  https://front/api/revalidate   { tags: ["config:sitio"] }
        ↓
Next invalida las entradas con ese tag
        ↓
La siguiente visita ve los datos nuevos
```

## Parte 1 — El endpoint en el front

Un único Route Handler para todo. `revalidateTag` sólo funciona en el servidor: se puede llamar desde
Route Handlers y Server Actions, nunca desde el navegador.

```ts
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';

/**
 * Invalidación de caché disparada por el backend.
 *
 * El backend llama aquí después de cada mutación en el dashboard que afecte
 * a datos públicos cacheados. Ver la tabla de "qué tag para qué acción" abajo.
 *
 * Autenticación: secreto compartido en el header x-revalidate-secret.
 * NO reutilices la API key del backend: esta ruta la puede alcanzar cualquiera
 * desde internet, y el único daño posible es forzar renders innecesarios —
 * pero eso es un vector de denegación de servicio suficientemente barato.
 */

// Tags exactos que el backend puede invalidar.
const TAGS_EXACTOS = new Set([
  'config:sitio',
  'ciudades',
  'eventos:lista',
  'legales',
]);

// Tags con parámetro: 'evento:tuff-riders', 'citypass:torreon'.
const PREFIJOS = ['evento:', 'citypass:'];

// Allowlist a propósito: sin ella, quien tenga el secreto puede invalidar
// cualquier cadena y provocar renders en masa. También atrapa typos del
// backend, que si no fallarían en silencio.
const tagPermitido = (tag: string) =>
  TAGS_EXACTOS.has(tag) ||
  PREFIJOS.some((p) => tag.startsWith(p) && tag.length > p.length);

const secretoValido = (recibido: string | null): boolean => {
  const esperado = process.env.REVALIDATE_SECRET;
  if (!esperado || !recibido) return false;

  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  // timingSafeEqual lanza si los largos difieren; comparar antes evita
  // que la longitud del secreto se filtre por el tipo de respuesta.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export async function POST(request: Request) {
  if (!secretoValido(request.headers.get('x-revalidate-secret'))) {
    // 401 sin detalle: no le digas a quien sondea si el secreto existe.
    return Response.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const tags = (body as { tags?: unknown })?.tags;
  if (!Array.isArray(tags) || tags.length === 0) {
    return Response.json(
      { ok: false, error: 'Se espera { tags: string[] } con al menos un tag' },
      { status: 400 },
    );
  }

  const invalidados: string[] = [];
  const rechazados: string[] = [];

  for (const tag of tags) {
    if (typeof tag !== 'string' || !tagPermitido(tag)) {
      rechazados.push(String(tag));
      continue;
    }
    // { expire: 0 } = expiración inmediata. Es el modo documentado para
    // sistemas externos (webhooks) que necesitan que el dato caduque ya.
    // Con 'max' en su lugar, se serviría contenido viejo mientras se
    // revalida en segundo plano — bien para un blog, no para un precio.
    revalidateTag(tag, { expire: 0 });
    invalidados.push(tag);
  }

  if (rechazados.length) {
    console.warn('[revalidate] tags rechazados:', rechazados.join(', '));
  }

  // 200 aunque haya rechazados: el backend no debe reintentar por un typo.
  // Los rechazados van en el cuerpo para que se vean en sus logs.
  return Response.json({
    ok: true,
    invalidados,
    rechazados,
    ts: new Date().toISOString(),
  });
}
```

Variable de entorno nueva:

```bash
# .env — sin prefijo NEXT_PUBLIC_: esto no puede llegar al navegador
REVALIDATE_SECRET=<32+ bytes aleatorios, distinto por entorno>
```

Genérala con `openssl rand -hex 32`. **Distinta en staging y en producción**, o un aviso de staging
invalida el caché de producción.

### Por qué `{ expire: 0 }` y no `revalidateTag(tag)`

`revalidateTag` tiene tres comportamientos según el segundo argumento, y elegir mal es la diferencia
entre que el cambio se vea o no:

| Llamada | Comportamiento | Cuándo |
|---|---|---|
| `revalidateTag(tag, { expire: 0 })` | Expira ya. La siguiente petición espera datos frescos. | **Webhooks del backend. Lo nuestro.** |
| `revalidateTag(tag, 'max')` | Marca como viejo; sirve lo viejo y refresca por detrás. | Contenido donde un poco de retraso da igual. |
| `revalidateTag(tag)` | **Deprecado.** | Nunca en código nuevo. |

> La forma de un solo argumento está deprecada en Next 16. Hoy todavía funciona si silencias el error
> de TypeScript, pero puede desaparecer. Usa siempre la de dos argumentos.

`updateTag()` es un tercer primo que **no aplica aquí**: sólo se puede llamar desde Server Actions, no
desde Route Handlers.

## Parte 2 — El contrato para el equipo de backend

Esto es lo que se le pasa a backend. Copiable tal cual.

### Petición

```http
POST /api/revalidate
Host: <dominio del front>
Content-Type: application/json
x-revalidate-secret: <REVALIDATE_SECRET>

{ "tags": ["config:sitio"] }
```

### Respuestas

| Código | Significado | ¿Reintentar? |
|--------|-------------|--------------|
| `200` | Procesado. Revisa `rechazados` en el cuerpo. | No |
| `400` | JSON malformado o `tags` ausente/vacío. | No — es un bug del emisor |
| `401` | Secreto inválido o ausente. | No — revisa la configuración |
| `5xx` / timeout | El front no respondió. | Sí, con backoff, máximo 3 intentos |

### Reglas

- **Es idempotente.** Mandar el mismo tag diez veces equivale a mandarlo una.
- **Se pueden agrupar tags** en una sola llamada: `{"tags": ["eventos:lista", "evento:tuff-riders"]}`.
  Preferible a varias llamadas.
- **Llamar después del commit**, nunca dentro de la transacción. Si se invalida antes de que el dato
  esté escrito, el front cachea el valor viejo otra vez y queda peor que si no se hubiera llamado.
- **No debe romper la mutación.** Si el front está caído, la operación del dashboard tiene que
  terminar bien igual. El TTL del front es la red de seguridad.
- **Timeout de 3 segundos.** No hagas esperar al usuario del dashboard por esto.

### Qué tag para qué acción

| Acción en el dashboard | Tags a invalidar |
|---|---|
| Guardar configuración de marca (logo, colores, título, pixels) | `config:sitio` |
| Crear un evento | `eventos:lista` |
| Editar un evento (nombre, fecha, imagen, descripción) | `eventos:lista`, `evento:<slug>` |
| Cambiar precios o secciones de un evento | `evento:<slug>` |
| Despublicar o cancelar un evento | `eventos:lista`, `evento:<slug>` |
| Alta, baja o cambio de nombre de una ciudad | `ciudades` |
| Editar un paquete de CityPass | `citypass:<slug-ciudad>` |
| Subir un `.docx` nuevo de legales | `legales` |

> El `<slug>` es el mismo que el backend guarda para las URLs y los QR. Si un evento cambia de nombre
> y por tanto de slug, hay que invalidar **los dos**: el viejo y el nuevo.

### Implementación sugerida (NestJS)

```ts
// src/revalidacion/revalidacion.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RevalidacionService {
  private readonly logger = new Logger(RevalidacionService.name);
  private readonly url = process.env.FRONT_REVALIDATE_URL;
  private readonly secreto = process.env.FRONT_REVALIDATE_SECRET;

  /**
   * Avisa al front de que unos datos cacheados cambiaron.
   *
   * Deliberadamente no lanza: la mutación del dashboard ya está confirmada
   * y no se puede deshacer porque el front no contestó. Si esto falla, el
   * TTL del front absorbe el desfase.
   *
   * Llamar SIEMPRE después del commit.
   */
  async invalidar(tags: string[]): Promise<void> {
    if (!this.url || !this.secreto || tags.length === 0) return;

    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': this.secreto,
        },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        this.logger.warn(
          `revalidación rechazada (${res.status}): ${tags.join(', ')}`,
        );
        return;
      }

      const { rechazados } = (await res.json()) as { rechazados?: string[] };
      if (rechazados?.length) {
        // Casi siempre un typo en el tag, o un tag nuevo que falta
        // agregar a la allowlist del front.
        this.logger.warn(`tags rechazados por el front: ${rechazados.join(', ')}`);
      }
    } catch (err) {
      this.logger.warn(`no se pudo avisar al front: ${(err as Error).message}`);
    }
  }
}
```

Uso en el servicio que muta:

```ts
async actualizarEvento(id: number, dto: ActualizarEventoDto) {
  const evento = await this.repo.save({ id, ...dto });   // commit primero

  // Fire-and-forget: no bloquea la respuesta al dashboard.
  void this.revalidacion.invalidar(['eventos:lista', `evento:${evento.slug}`]);

  return evento;
}
```

## ⚠️ El detalle que rompe esto en producción: varias réplicas

**`revalidateTag` es local a la instancia que recibe la llamada.**

Si el front corre con N réplicas detrás de un balanceador, el POST del backend llega a **una** y las
otras N-1 siguen sirviendo el dato viejo hasta que se les cumpla el TTL.

Es la razón número uno por la que un equipo concluye que «la revalidación no funciona»: funciona, y
al recargar sale bien o mal según a qué réplica te tocó ir.

Cuatro salidas, de menos a más trabajo:

**1. Una sola réplica.** Si el tráfico lo permite, es la respuesta correcta por simplicidad. Muchos
sitios de boletos caben de sobra en una instancia bien dimensionada.

**2. Fan-out a todas las réplicas.** El backend (o un sidecar) llama a cada réplica por su IP interna
en vez de pasar por el balanceador. Funciona, pero hay que descubrir las réplicas, y en autoescalado
eso se complica.

**3. `cacheHandlers` compartido con Redis.** La solución correcta a escala: las réplicas comparten el
estado de invalidación mediante los hooks `updateTags()` y `refreshTags()`. Es la que recomienda la
documentación de Next para multi-instancia.
Ver `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheHandlers.md`.

**4. Aceptar el TTL como techo del desfase.** Si el TTL es de 5 minutos y el negocio tolera 5 minutos
de desfase en las réplicas que no recibieron el aviso, no hay nada que arreglar. **Decidirlo
explícitamente**, no por omisión.

> ⚠️ **Requiere infra**: antes de escribir el endpoint hay que saber con cuántas réplicas se despliega
> el front. Si es más de una y no se toma la opción 3, la revalidación es *best-effort* y el TTL sigue
> siendo el mecanismo real. Que quede escrito en el ticket.

## `revalidatePath`: la alternativa más burda

Cuando no sabes qué tag toca pero sí qué URL:

```ts
import { revalidatePath } from 'next/cache';

revalidatePath('/eventos');              // una ruta
revalidatePath('/eventos/[slug]', 'page'); // todas las instancias de la dinámica
```

Funciona por debajo con el mismo sistema de tags (Next genera «soft tags» a partir de la ruta).

**Prefiere los tags.** Un tag describe *el dato*; una ruta describe *dónde se muestra hoy*. Cuando
mañana el nombre del evento aparezca también en `/explorar` y en el home, el tag ya lo cubre y la
lista de rutas hay que ir a actualizarla. `revalidatePath` sirve para casos puntuales tipo «cambió el
layout entero».

## Probarlo

**1. Que el endpoint responde**

```bash
curl -i -X POST http://localhost:3000/api/revalidate \
  -H 'content-type: application/json' \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"tags":["config:sitio"]}'
```

Esperado: `200` con `{"ok":true,"invalidados":["config:sitio"],"rechazados":[],...}`.

**2. Que el secreto protege**

```bash
curl -i -X POST http://localhost:3000/api/revalidate \
  -H 'content-type: application/json' \
  -H 'x-revalidate-secret: incorrecto' \
  -d '{"tags":["config:sitio"]}'
```

Esperado: `401`.

**3. Que la allowlist filtra**

```bash
curl -s -X POST http://localhost:3000/api/revalidate \
  -H 'content-type: application/json' \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"tags":["evento:","borrame-todo"]}' | jq
```

Esperado: los dos en `rechazados` — `evento:` sin sufijo no pasa el largo mínimo.

**4. Que de verdad invalida** — la prueba que cuenta:

```bash
# 1. Carga la página; el backend recibe la petición de config
curl -s http://localhost:3000/eventos > /dev/null

# 2. Cárgala otra vez; el backend NO debería recibir nada (viene del caché)
curl -s http://localhost:3000/eventos > /dev/null

# 3. Invalida
curl -s -X POST http://localhost:3000/api/revalidate \
  -H 'content-type: application/json' \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"tags":["config:sitio"]}' > /dev/null

# 4. Cárgala una tercera vez; el backend SÍ debería recibirla
curl -s http://localhost:3000/eventos > /dev/null
```

Mirando los logs del backend: petición en el paso 1, silencio en el 2, petición en el 4. Si el paso 2
también llega al backend, el caché no está activo — revisa que el `fetch` lleve `cache: 'force-cache'`
(ver [doc 02](./02-cache-de-datos.md)).

## Cuando no funcione

| Síntoma | Causa probable |
|---|---|
| `200` pero el dato sigue viejo | El `fetch` no lleva `tags`, o el tag no coincide exactamente (distingue mayúsculas). |
| Funciona en local, no en producción | Varias réplicas. Ver la sección de arriba. |
| Funciona a veces al recargar | Varias réplicas, confirmado: te está tocando una réplica distinta cada vez. |
| `401` desde el backend y bien con curl | Secreto distinto entre entornos, o espacios de más al copiarlo. |
| Sale en `rechazados` | Falta el tag en la allowlist, o typo. Está en los logs del front. |
| El dato viejo vuelve solo | El backend invalidó **antes** del commit. Mover la llamada después. |
| Nada se cachea nunca | Falta `cache: 'force-cache'`. En Next 16 el caché es opt-in. |

## Resumen de variables de entorno

**Front** (`.env`):
```bash
URL_BACKEND=https://api.ejemplo.com     # server-only, para los fetch de servidor
API_KEY=...                             # server-only (hoy es NEXT_PUBLIC_API_KEY, y eso
                                        #   la publica en el bundle del navegador)
REVALIDATE_SECRET=...                   # server-only
```

**Backend**:
```bash
FRONT_REVALIDATE_URL=https://taquillavip.com/api/revalidate
FRONT_REVALIDATE_SECRET=...             # el mismo valor que REVALIDATE_SECRET del front
```

Ninguna de estas lleva `NEXT_PUBLIC_`. Ese prefijo significa literalmente «publica esto en el
JavaScript que descarga cualquier visitante».
