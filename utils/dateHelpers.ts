import {
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  addDays,
  isWithinInterval,
  isAfter,
} from "date-fns";
import { es } from "date-fns/locale";
import { Locale } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const DEFAULT_TZ = "America/Mexico_City";

const getTimezone = (): string =>
  process.env.NEXT_PUBLIC_TIMEZONE || DEFAULT_TZ;

export const formatDate = (
  date: string | Date,
  dateFormat: string = "dd/MM/yyyy",
  locale: Locale = es
): string => {
  try {
    const tz = getTimezone();
    const d = typeof date === "string" ? parseISO(date) : date;
    return formatInTimeZone(d, tz, dateFormat, { locale });
  } catch (error) {
    console.error("Error al formatear la fecha:", error);
    return "Fecha invalida";
  }
};

const FECHA_INVALIDA = "Fecha invalida";

// Mismo dia segun la TZ de la app, nunca la del navegador.
export const esMismoDia = (a: string | Date, b: string | Date): boolean => {
  const diaA = formatDate(a, "yyyy-MM-dd");
  const diaB = formatDate(b, "yyyy-MM-dd");
  return diaA !== FECHA_INVALIDA && diaA === diaB;
};

// Hora de inicio y, si el evento termina ese mismo dia, la de fin: "06:30 AM - 11:30 AM".
export const formatRangoHora = (
  inicio: string | Date,
  fin?: string | Date | null,
  horaFormato: string = "hh:mm a"
): string => {
  const horaInicio = formatDate(inicio, horaFormato);
  if (!fin || !esMismoDia(inicio, fin)) return horaInicio;

  const horaFin = formatDate(fin, horaFormato);
  return horaFin === FECHA_INVALIDA ? horaInicio : `${horaInicio} - ${horaFin}`;
};

// Fecha con rango de horas. Si el final cae otro dia se escribe completo: "... al 13 de octubre de 2025, 02:00 AM".
export const formatFechaConRango = (
  inicio: string | Date,
  fin?: string | Date | null,
  fechaFormato: string = "d 'de' MMMM 'de' yyyy",
  horaFormato: string = "hh:mm a"
): string => {
  const base = `${formatDate(inicio, fechaFormato)}, ${formatRangoHora(inicio, fin, horaFormato)}`;
  if (!fin || esMismoDia(inicio, fin)) return base;

  const fechaFin = formatDate(fin, fechaFormato);
  if (fechaFin === FECHA_INVALIDA) return base;

  return `${base} al ${fechaFin}, ${formatDate(fin, horaFormato)}`;
};

// Filtro de fecha del listado de eventos y del home. Antes vivía duplicado en
// `app/(site)/eventos/page.tsx` y `publicUi/pages/HomePage.tsx` con dayjs +
// el plugin isBetween; se movió aquí al migrar a date-fns (doc 08).
// Semana de domingo a sábado (weekStartsOn: 0) para igualar a dayjs sin locale.
export type FiltroFechaEvento =
  | "finDeSemana"
  | "estaSemana"
  | "proximaSemana"
  | "proximamente"
  | (string & {});

export const eventoPasaFiltroFecha = (
  fechaEvento: string | Date,
  filtro: FiltroFechaEvento,
): boolean => {
  const fecha =
    typeof fechaEvento === "string" ? parseISO(fechaEvento) : fechaEvento;
  if (Number.isNaN(fecha.getTime())) return true;

  const hoy = new Date();
  const opts = { weekStartsOn: 0 as const };
  const inicioSemana = startOfWeek(hoy, opts);
  const finSemana = endOfWeek(hoy, opts);

  switch (filtro) {
    case "finDeSemana": // viernes hasta el fin de semana
      return isWithinInterval(fecha, {
        start: addDays(inicioSemana, 5),
        end: finSemana,
      });
    case "estaSemana":
      return isWithinInterval(fecha, { start: inicioSemana, end: finSemana });
    case "proximaSemana": {
      const prox = addWeeks(hoy, 1);
      return isWithinInterval(fecha, {
        start: startOfWeek(prox, opts),
        end: endOfWeek(prox, opts),
      });
    }
    case "proximamente":
      return isAfter(fecha, addDays(hoy, 15));
    default:
      return true;
  }
};

// Solo la hora cuando cae el mismo dia que la referencia; fecha completa cuando no.
export const formatHoraRelativa = (
  valor: string | Date,
  referencia?: string | Date | null,
  horaFormato: string = "hh:mm a",
  fechaFormato: string = "d 'de' MMMM 'de' yyyy"
): string =>
  referencia && esMismoDia(valor, referencia)
    ? formatDate(valor, horaFormato)
    : `${formatDate(valor, fechaFormato)}, ${formatDate(valor, horaFormato)}`;
