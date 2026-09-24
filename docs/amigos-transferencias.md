# Amigos y Transferencia de Boletos — Frontend

Implementación del flujo de **Amigos** (solicitudes, lista, búsqueda) y **Transferencia de Boletos entre amigos**, integrado contra los endpoints documentados en `taquillavipbackend-v2/docs/frontend-integracion-amigos-transferencias.md`.

Toda comunicación pasa por `src/api/apiApplication.ts`, así que los headers `Authorization: Bearer …` y `x-api-key` se inyectan automáticamente.

---

## 1. Tipos

| Archivo | Exporta |
|---|---|
| `src/types/Amigos.ts` | `EstadoSolicitudAmistad`, `AccionSolicitud`, `UserMini`, `FriendRequest`, `Amigo`, `BuscarUsuariosResponse`, `AceptarSolicitudResponse` |
| `src/types/Transferencias.ts` | `TipoBoletoTransfer`, `TicketTransfer`, `MiBoletoAsiento`, `MiBoletoPase`, `MisBoletosResponse`, `TransferirBoletoPayload` |

Todos mapean 1:1 con los DTOs documentados (sección 7 del doc del backend). No reflejan campos que el backend no envíe.

---

## 2. Hooks (capa de servicio)

Siguiendo el patrón `use*Store` del proyecto (los componentes no llaman axios directamente).

### `src/hooks/useAmigosStore.tsx`

| Método | Endpoint | Notas |
|---|---|---|
| `buscarUsuarios(q?, page=1, limit=20)` | `GET /amigos/buscar` | `q` admite email/fullName/teléfono parcial (mín. 2 chars en UI) |
| `enviarSolicitud(destinatarioId)` | `POST /amigos/solicitudes` | |
| `getSolicitudesRecibidas()` | `GET /amigos/solicitudes/recibidas` | Trae `solicitante` poblado |
| `getSolicitudesEnviadas()` | `GET /amigos/solicitudes/enviadas` | Trae `destinatario` poblado |
| `responderSolicitud(id, accion)` | `PATCH /amigos/solicitudes/:id` | `accion`: `aceptar` / `rechazar` / `cancelar` |
| `getAmigos()` | `GET /amigos` | El backend ya devuelve el "otro" usuario en `amigo` |
| `eliminarAmistad(friendshipId)` | `DELETE /amigos/:friendshipId` | Soft delete |

Los errores del backend (`error.response.data.message`) se propagan como `Error` con el `message` tal cual, para que la UI lo muestre sin transformar (cumple sección 8 del doc).

### `src/hooks/useTransferenciasStore.tsx`

| Método | Endpoint |
|---|---|
| `transferirBoleto({ tipo, boletoId, destinatarioId })` | `POST /transferencias` |
| `getTransferenciasEnviadas(page=1, limit=50)` | `GET /transferencias/enviadas` |
| `getTransferenciasRecibidas(page=1, limit=50)` | `GET /transferencias/recibidas` |
| `getHistorialBoleto(tipo, boletoId)` | `GET /transferencias/boleto/:tipo/:id` |
| `getMisBoletos()` | `GET /boletos/mis` |

`tipo` es `'asiento'` (boletoId = `EventoAsiento.id`) o `'pase'` (boletoId = `PaseGeneral.id`).
**Nunca** se envía `fromUserId` en el body — el backend lo resuelve por JWT.

---

## 3. Componentes nuevos

### `src/eventos/pages/perfil/MisAmigosPage.tsx`

Página completa de Amigos, montada en `/perfil/mis_amigos` y protegida por `ProtectedRoute`. Replica la referencia visual entregada por el usuario adaptándola al sistema de diseño (Tailwind + tokens de marca `accentBase` / `emphasis` / `neutral`).

Estructura:

1. **Input de teléfono + botón "Agregar"**. Búsqueda con debounce (350 ms, mínimo 2 caracteres). Muestra un dropdown de resultados que incluye nombre, teléfono e imagen. Click sobre un resultado → `POST /amigos/solicitudes`. Click en "Agregar" sin resultado destacado: si la búsqueda actual tiene exactamente 1 match envía la solicitud, en caso contrario abre el dropdown para que el usuario escoja.
2. **Solicitudes pendientes** (recibidas) con badge de conteo y botones Rechazar / Aceptar.
3. **Lista "Aquí puedes ver tus amigos."** que incluye:
   - Solicitudes **enviadas** pendientes (badge "Pendiente de aceptar" + botón "Cancelar solicitud").
   - Amistades activas (botón "Quitar" con confirmación SweetAlert).

**Polling**: cada 30 s refresca `/amigos/solicitudes/recibidas` mientras el componente está montado (sección 1 del doc). No hace polling de `enviadas` ni de `amigos` (se recargan tras cada acción).

**Estados de duplicado**: el dropdown deshabilita usuarios que ya son amigos o tienen una solicitud activa en cualquier dirección, mostrando "Ya existe".

### `src/components/UserAvatar.tsx`

Avatar de usuario reutilizable (compartido). Si `image` es válida pinta `<img>`; si no, dibuja un círculo con iniciales sobre un color elegido por hash determinístico del nombre (paleta de 8 colores Tailwind). Props: `nombre`, `image`, `size`, `className`. Usado en `MisAmigosPage`, `MisTransferenciasPage`, `MiPerfil`, y los modales de transferencia (eventos y CityPass).

### `src/components/TransferirModal.tsx`

Modal **reutilizable** de transferencia compartido por eventos y CityPass. Concentra toda la UI del diseño (búsqueda de amigo con selección tipo radio + "Resumen de selección" colapsable + checkbox de confirmación + pantalla de éxito). El consumidor sólo aporta los datos y la lógica de envío; no duplica maquetación. Props:

```ts
{
  isOpen: boolean;
  onClose: () => void;
  items: ItemTransferible[];        // { id, titulo, detalle?, precio?, tipo? }
  titulo?: string;                  // default "Transferir boletos"
  permitirSeleccion?: boolean;      // muestra un primer paso "Seleccionar todos" (flujo multi)
  confirmacionTexto?: string;
  overlayZIndexClass?: string;      // CityPass usa "z-[70]"
  onConfirmar: (destinatario: Amigo, seleccionados: ItemTransferible[]) => Promise<string>; // devuelve el mensaje de éxito o lanza Error
  onSuccess?: () => void;
}
```

Flujo: (paso opcional de selección de boletos) → destinatario (carga amigos con `getAmigos()`; CTA "Agregar amigo" a `/perfil/mis_amigos` si no hay) → `onConfirmar` ejecuta la transferencia → pantalla de éxito con el mensaje devuelto. Los errores lanzados por `onConfirmar` se muestran en SweetAlert y el modal permanece en el paso de destinatario.

### `src/eventos/components/TransferirBoletoModal.tsx`

Transferencia 1-a-1 de un boleto de evento. Envoltorio delgado de `TransferirModal`: pasa un único `item` y un `onConfirmar` que llama `POST /transferencias` (`transferirBoleto({ tipo, boletoId, destinatarioId })`). Props: `{ isOpen, onClose, tipo, boletoId, descripcionBoleto?, onSuccess? }`.

### `src/public/components/citypass/TransferirCityPassModal.tsx`

Equivalente para CityPass. Envoltorio de `TransferirModal` (con `overlayZIndexClass="z-[70]"`) cuyo `onConfirmar` llama `POST /citypass/transferencias` (`transferirBoleto(boletoId, destinatarioId)`). Props: `{ isOpen, onClose, boletoId, descripcion?, onSuccess? }`.

---

## 3.bis Rediseño "Mis compras" (Mayo 2026)

La vista de detalle del evento dentro de `MisComprasPage` se rediseñó para alinearse con las maquetas definitivas. Toda la información sigue viniendo de `GET /eventos/mis_eventos/:id` (incluye `transferidos`) — no se inventaron endpoints.

### Componentes nuevos en este pase

| Archivo | Rol |
|---|---|
| `src/eventos/pages/perfil/components/BoletoCard.tsx` | Card unificada de boleto (variant `'vigente'` o `'transferido'`). Header con strip de marca, imagen con overlay (Categoría · Bloque · Sección · Asiento), footer con `Transferir boleto` o "Transferido a {fullName}" + precio. Soporta modo seleccionable (checkbox flotante) para flujos multi. |
| `src/eventos/pages/perfil/components/BoletoDetalleModal.tsx` | Modal que se abre al hacer clic en una `BoletoCard` vigente: muestra QR (`quemadoUUID`), categoría/bloque/sección/asiento, precio, botón "Transferir a un amigo" y los pases de Apple/Google Wallet (`WalletFooter` reutilizado). Reemplaza la antigua exposición inline del QR. |
| `src/eventos/pages/perfil/components/DetallesPedidoTab.tsx` | Tab "Detalles del pedido". Hero con imagen + título, fecha/dirección/fecha de la compra, bloque de método de pago (condicional a `evento.metodoPago`), tarjeta lateral con correo de entrega, lugar, desglose de boletos, número de pedido y total. |
| `src/eventos/components/MultiTransferirModal.tsx` | Flujo de transferencia múltiple. Envoltorio de `TransferirModal` con `permitirSeleccion` (paso 1: selector de boletos con "Seleccionar todos"; paso 2: destinatario + resumen + confirmación; paso 3: resultado). Su `onConfirmar` envía un `POST /transferencias` por cada boleto seleccionado al mismo destinatario (`Promise.allSettled` para tolerar fallos parciales). |

### Cambios en `MisComprasPage.tsx`

- La lista de eventos previa se conservó intacta.
- Al entrar a un evento ahora se muestran **tres pestañas**: `Mis boletos`, `Boletos transferidos`, `Detalles del pedido`.
- Encima de las pestañas se mantiene un botón azul **"Transferir boletos"** (multi) — sólo se muestra si hay al menos un boleto no quemado.
- **Filtros** dentro de `Mis boletos`:
  - Estado: `Sin quemar` (default) / `Quemados` — usa `quemadoFlag` del boleto.
  - Tipo: `Todos` / `Generales` (pool = `pasesGenerales`) / `Numerados` (pool = `boletos`) / `Abonos` (oculto cuando el conteo es 0, ya que el endpoint actual no devuelve abonos).
  - Cada chip muestra su conteo y se mantiene sincronizado con el estado actual (memo derivado de las listas).
- El render de boletos vigentes y transferidos ahora se delega 100% a `BoletoCard`. El QR + wallet vive en `BoletoDetalleModal`, accesible al hacer clic sobre la card vigente (preserva funcionalidad existente).
- `Transferir boleto` en la card → flujo 1-a-1 (modal existente `TransferirBoletoModal`).
- `Transferir boletos` en el header → flujo multi (`MultiTransferirModal`).
- Tras éxito en cualquiera de los dos modales se invoca `refetchBoletosEvento()` → vuelve a llamar `GET /eventos/mis_eventos/:id` y la UI se actualiza (boletos transferidos desaparecen de "Mis boletos" y aparecen en "Boletos transferidos").

### Datos esperados para `Detalles del pedido`

El tab pinta lo que esté disponible en la respuesta de `/eventos/mis_eventos/:id`. Si los siguientes campos no llegan, el bloque correspondiente queda oculto en lugar de mostrar texto basura:

- `evento.fechaCompra` → "Fecha de la compra".
- `evento.direccion` o `evento.recinto.direccion` → "Dirección".
- `evento.metodoPago` (`{ tipo, ultimosDigitos }`) → bloque "Método de pago".
- `evento.numeroPedido` o `boletos[0].ticket.id` → "Número de pedido".

El correo se toma de `perfil.email` (endpoint `/usuarios/mi_perfil`, ya existente).

---

## 4. Cambios en componentes existentes

### `src/router/router.tsx`

Se registra la nueva ruta dentro del grupo `perfil` protegido:

```tsx
{ path: "mis_amigos", element: <MisAmigosPage /> },
```

### `src/eventos/pages/perfil/components/Sidebar.tsx`

Se agrega la entrada **"Mis amigos"** (icono `LuUsers`) entre "Mis compras" y "Cerrar sesión", manteniendo el mismo estilo `NavLink` con `bg-accentLight text-neutral` para el estado activo.

### `src/eventos/pages/perfil/MisComprasPage.tsx`

- Botón **"Transferir a un amigo"** dentro del card de cada boleto (asiento o pase general), entre el footer del QR y el `WalletFooter`. Detecta el tipo con la misma lógica existente (`!!boleto.eventoSeccion` → pase general).
- Construye una descripción legible (evento + categoría/sección + asiento) que se muestra en el modal y en el toast de confirmación.
- Tras una transferencia exitosa, recarga los boletos del evento actual con `getMisBoletos(evento.id)` (ya existente en `useEventosStore`), lo que hace que el boleto transferido desaparezca de la vista — cumple "No asumir que después de transferir, el frontend puede seguir mostrando el boleto en caché" (sección 8 del doc).

> Nota: el endpoint `GET /boletos/mis` (sección 4 del doc) está expuesto vía `useTransferenciasStore.getMisBoletos()` y queda disponible para una refactor posterior si se quiere consolidar la pantalla de "Mis Boletos" alrededor de él. La integración actual respeta la UX y el endpoint vigentes para no romper "Mis compras".

---

## 5. Flujo extremo a extremo

### Amigos

1. Usuario abre `/perfil/mis_amigos` → `GET /amigos`, `GET /amigos/solicitudes/recibidas`, `GET /amigos/solicitudes/enviadas` en paralelo.
2. Tipea teléfono / nombre → debounce → `GET /amigos/buscar?q=...`.
3. Click resultado → `POST /amigos/solicitudes { destinatarioId }`.
4. Pestaña activa, polling cada 30 s a `recibidas`.
5. Aceptar → `PATCH /amigos/solicitudes/:id { accion: "aceptar" }`. El backend devuelve `solicitud + friendship` y la UI recarga las tres listas.
6. Rechazar → mismo PATCH con `"rechazar"`.
7. Cancelar (solo en enviadas) → PATCH con `"cancelar"` previa confirmación.
8. Quitar amigo → `DELETE /amigos/:friendshipId` previa confirmación.

### Transferir boleto

1. Usuario abre `/perfil/mis_compras` → selecciona evento → ve sus boletos.
2. Click "Transferir a un amigo" en un boleto.
3. Modal carga `GET /amigos` y `GET /transferencias/boleto/:tipo/:id`.
4. Click sobre amigo → confirmación → `POST /transferencias { tipo, boletoId, destinatarioId }`.
5. Éxito → toast + cierre + recarga `/eventos/mis_eventos/:id` para reflejar el cambio de propietario.
6. Errores del backend (`No eres el dueño actual del boleto`, `Boletos de cortesía no son transferibles`, etc.) se muestran tal cual al usuario.

---

## 6. Verificación

- `npm run build` (incluye `tsc -b`) pasa sin errores. Sólo aviso preexistente sobre `bluebird` (dependencia transitiva) y el tamaño total del bundle.
- TypeScript en modo estricto: todos los nuevos archivos cumplen `noUnusedLocals` y `noUnusedParameters`.
- Las llamadas usan el `apiApplication` central, por lo que `Authorization` y `x-api-key` se aplican automáticamente.
- Los contratos (DTOs, query params, query strings, métodos HTTP) coinciden 1:1 con `frontend-integracion-amigos-transferencias.md`. No se inventan endpoints.

---

## 7. Pendiente / futuro

- Cuando el backend agregue el WebSocket gateway (mencionado en sección 1 del doc), se puede reemplazar el polling de `solicitudes/recibidas` por suscripción real-time. La interfaz de `useAmigosStore` permanece intacta — el cambio sería interno.
- Si se desea unificar "Mis Boletos" alrededor de `GET /boletos/mis`, ya está expuesto en `useTransferenciasStore.getMisBoletos()` y los tipos en `src/types/Transferencias.ts`.
