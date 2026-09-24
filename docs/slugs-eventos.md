# Slugs de eventos en la URL — contrato con el backend

La web pública ya no usa `/eventos/1084`. Ahora la URL del detalle es **solo el slug**:

```
https://<dominio>/eventos/tuff-riders                       # evento de fecha única
https://<dominio>/eventos/sky-fest-laguna-7-matutino        # una función de un multifecha
https://<dominio>/eventos/informacion/tuff-riders           # landing informativa
```

Esto es lo que se comparte por WhatsApp y lo que debe apuntar el QR que genera el back.

Archivos del front: `src/utils/eventoSlug.ts` (construcción y resolución del slug),
`src/hooks/useEventosStore.tsx` (`resolverSlugEvento`), `src/router/router.tsx` (rutas).

---

## 1. Cómo se arma el slug

```
slug = slugify(nombreEvento)                                    # fecha única
slug = slugify(nombreEvento) + "-" + dia + "-" + slugify(nombreFuncion)   # multifecha
```

- `nombreEvento` — el nombre del evento. **No** entra recinto, ni ciudad, ni la fecha del
  evento, ni el id: alargan la URL y se lee mal al compartirla.
- `dia` — día del mes de la función, sin ceros a la izquierda (`7`, `28`), calculado en la
  zona `America/Mexico_City` (`VITE_TIMEZONE` en el front). Ojo con esto: una función a las
  `2026-03-08T02:00:00Z` es **7** de marzo en México, no 8.
- `nombreFuncion` — se omite si la función no tiene nombre; entonces queda `…-7`.

Ejemplos:

| Evento | Función | Slug |
|---|---|---|
| Tuff Riders | — | `tuff-riders` |
| Sky Fest Laguna | 7 de marzo, "Matutino" | `sky-fest-laguna-7-matutino` |
| Sky Fest Laguna | 7 de marzo, "Vespertino" | `sky-fest-laguna-7-vespertino` |
| Sky Fest Laguna | 8 de marzo, sin nombre | `sky-fest-laguna-8` |

### `slugify` exacto

El front usa esta función (`src/utils/slugify.ts`). El back debe producir **el mismo
resultado** o los enlaces del QR no coincidirán con los que genera la web:

```ts
const slugify = (text: string): string =>
    text
        .normalize("NFD")                 // separa las tildes de la letra
        .replace(/[\u0300-\u036f]/g, "")  // quita los diacríticos
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")      // todo lo demás pasa a guion
        .replace(/^-+|-+$/g, "");         // sin guiones al inicio/final
```

`"Sky Fest Laguna — Ñandú 2026"` → `sky-fest-laguna-nandu-2026`.

---

## 2. Lo que necesitamos del backend

### 2.1 Endpoint resolver (bloqueante)

```
GET /api/v1/eventos/slug/:slug
```

Traduce el slug de la URL a los ids que ya usan los endpoints actuales. Headers normales
(`x-api-key`, `Authorization` si hay sesión). Público.

Respuesta 200:

```json
{ "eventoId": 1084, "funcionId": 5512 }
```

- `funcionId` es `null` cuando el evento es de fecha única o cuando el slug no trae función.
- 404 cuando ningún evento coincide.
- Debe resolver eventos **ya publicados** aunque no salgan en el listado del home
  (filtrados por categoría, agotados, etc.). Es justo lo que el front no puede hacer solo.

Con eso el front sigue pidiendo `/eventos/:id/detalle` y `/eventos/:id/detalle_seccion/...`
igual que hoy: no hay que duplicar payloads.

> Mientras ese endpoint no exista, `resolverSlugEvento` cae a resolver el slug contra
> `/eventos/get_all_select?tipoDispositivo=web`. Funciona para lo que está en el home, pero
> falla con cualquier evento que no aparezca ahí. El `TODO(slug)` en
> `src/hooks/useEventosStore.tsx` marca el fallback para borrarlo.

### 2.2 Campo `slug` en los payloads (recomendado)

Agregar `slug` al evento en `/eventos/get_all_select`, `/eventos/:id/detalle` y en
`/eventos/mis_eventos/:id`. Si viene, el front lo usa tal cual como base del slug en vez de
volver a derivarlo del nombre (`slugBaseEvento` en `eventoSlug.ts` le da prioridad). Así una
sola fuente decide el slug y no hay forma de que back y front discrepen.

### 2.3 Unicidad

El slug tiene que ser único por evento. Al crear/renombrar un evento:

1. `base = slugify(nombre)`.
2. Si ya existe otro evento con ese slug, sufijo incremental: `tuff-riders-2`, `tuff-riders-3`.
3. Guardarlo en columna `slug` con índice único y **no volver a cambiarlo** si ya se
   imprimieron QR o se compartieron enlaces (si cambia, conviene guardar los slugs viejos y
   redirigir).

Cuidado con dos casos:

- **Nombre que es prefijo de otro.** "Sky Fest" y "Sky Fest Laguna" → `sky-fest-laguna`
  podría leerse como "función `laguna` de Sky Fest". El resolver debe probar primero la
  coincidencia exacta contra la columna `slug` (base más larga) y solo después intentar
  separar el sufijo de función.
- **Nombre de función que choca con el patrón.** Una función llamada "7" en un evento
  `tuff-riders` produce `tuff-riders-7`, igual que un evento llamado "Tuff Riders 7". Se
  resuelve con la regla de arriba: primero la tabla de eventos, después las funciones.

---

## 3. El QR

El QR que genera el back debe apuntar a la URL final, sin id:

```
https://<dominio>/eventos/{evento.slug}                        # evento de fecha única
https://<dominio>/eventos/{evento.slug}-{dia}-{slugFuncion}    # función concreta
```

- `dia` = `format(funcion.fecha, 'd')` en `America/Mexico_City`.
- `slugFuncion` = `slugify(funcion.nombre)`, y se omite (junto con su guion) si la función
  no tiene nombre.
- El dominio sale de la configuración de marca (`/configuraciones/detail/1` → `dominio`),
  no hardcodeado.

Pseudocódigo:

```ts
const urlEvento = (dominio: string, evento: Evento, funcion?: Funcion) => {
    const partes = [evento.slug ?? slugify(evento.nombre)];
    if (funcion) {
        partes.push(formatInTimeZone(funcion.fecha, 'America/Mexico_City', 'd'));
        if (funcion.nombre) partes.push(slugify(funcion.nombre));
    }
    return `${dominio}/eventos/${partes.join('-')}`;
};
```

### Compatibilidad con los QR ya impresos

`/eventos/1084` sigue funcionando: si el segmento es solo dígitos, el front lo trata como id
y luego reescribe la URL al slug con `navigate(..., { replace: true })`: sin recarga y sin
dejar una entrada extra en el historial. Está marcado con `TODO(slug)` en `idNumericoDeSlug` (`src/utils/eventoSlug.ts`) y en
`src/router/router.tsx` para quitarlo cuando esos QR dejen de circular.

**No** se pueden tener dos rutas dinámicas al mismo nivel en React Router (`/eventos/:id` y
`/eventos/:slug` serían el mismo patrón), así que el id viejo entra por la misma ruta del
slug; no hay una ruta separada que borrar, solo el fallback numérico.

---

## 4. Alcance en el resto de las rutas

Las rutas de selección de asientos también llevan el slug del evento; lo que sigue por id es
la **sección**, que es interna y no se comparte:

```
/eventos/tuff-riders/45/General                    # selección de asientos
/eventos/sky-fest-laguna-7-matutino/45/General     # de una función concreta
/abonos/tuff-riders/45/General                     # abonos
```

Esas páginas usan el mismo `GET /eventos/slug/:slug`, así que sin el endpoint también dependen
del fallback contra el listado del home.

Lo que **no** cambió:

- `/terminar_compra/...` y las demás rutas de pago: por id de reserva, no de evento.
- Los microsites de conferencia (`/cosmotech/:eventoId`): por id.
- Todos los endpoints existentes siguen recibiendo ids. El slug solo vive en la URL del navegador.
