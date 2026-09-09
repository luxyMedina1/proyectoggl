# 3. Fix: selección de abonos cuando no hay abonos

Commit: `a4da7ba` — *Fix: sale selección de abonos sin abonos*
Archivo: `src/public/pages/HomePage.tsx`

## Por qué se hizo

Al abrir el modal de un evento estando autenticado y verificado, siempre se mostraba primero la vista intermedia `seleccionar_opcion` (elegir entre abono o fechas). El problema: **si el evento no tenía abonos, el usuario veía un paso vacío/innecesario** antes de llegar a las fechas.

El fix decide la vista **según el resultado real** de la consulta de abonos: si no hay abonos, se salta directo a `fechas`.

## Qué cambió

Antes se fijaba la vista **antes** de tener la respuesta:

```ts
setModalView('seleccionar_opcion');   // se decidía a ciegas
// ...luego fetch de abonos
```

Ahora se hace el fetch a una variable local, y **después** se decide:

```ts
setCargandoAbonos(true);
let abonos: Abono[] = [];
try {
  const { data } = await apiApplication.get(`/abonos/evento/${evento.id}`);
  if (Array.isArray(data)) abonos = data;
  else if (data && data.abonos) abonos = data.abonos;
  else if (data) abonos = [data];
} catch (error) {
  console.error("Error cargando abonos:", error);
  abonos = [];
} finally {
  setCargandoAbonos(false);
}
setAbonosDisponibles(abonos);
setModalView(abonos.length > 0 ? 'seleccionar_opcion' : 'fechas');
```

Además, en la vista `fechas` el botón **"← Regresar a opciones"** solo se muestra si realmente hay abonos (si no, no hay a dónde regresar):

```tsx
{abonosDisponibles.length > 0 && (
  <button onClick={() => setModalView('seleccionar_opcion')} ...>
    ← Regresar a opciones
  </button>
)}
```

## Cómo migrar a v3 (Next.js)

1. Mantén la regla: **la vista inicial depende del resultado del fetch de abonos**, no se fija a ciegas.
2. Oculta el botón de "Regresar a opciones" cuando `abonosDisponibles.length === 0`.
3. Optimización server side: en Next, la disponibilidad de abonos por evento se puede **precargar en el servidor** (o vía Route Handler cacheado) y pasar al cliente, evitando el spinner `cargandoAbonos` y el salto de vista. Si se resuelve en el servidor, la vista inicial correcta puede renderizarse directamente sin flash intermedio.
4. Conserva el manejo de las tres formas de respuesta (`array`, `{ abonos }`, objeto único) por compatibilidad con el backend actual, o normaliza esa forma en una función única.
