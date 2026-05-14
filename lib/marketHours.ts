// NYSE/NASDAQ market hours and holiday calendar.
// Hours are 9:30–16:00 ET on regular weekdays, 9:30–13:00 ET on early-close days.
// Source: nyse.com/markets/hours-calendars
// Times surfaced to the user are in Uruguay time (America/Montevideo, UTC-3).

const HOLIDAYS_FULL_CLOSE: Record<string, string> = {
  "2025-01-01": "Año Nuevo",
  "2025-01-09": "Día de luto nacional",
  "2025-01-20": "Día de Martin Luther King Jr.",
  "2025-02-17": "Día de los Presidentes",
  "2025-04-18": "Viernes Santo",
  "2025-05-26": "Día de los Caídos",
  "2025-06-19": "Juneteenth",
  "2025-07-04": "Día de la Independencia",
  "2025-09-01": "Día del Trabajo",
  "2025-11-27": "Día de Acción de Gracias",
  "2025-12-25": "Navidad",
  "2026-01-01": "Año Nuevo",
  "2026-01-19": "Día de Martin Luther King Jr.",
  "2026-02-16": "Día de los Presidentes",
  "2026-04-03": "Viernes Santo",
  "2026-05-25": "Día de los Caídos",
  "2026-06-19": "Juneteenth",
  "2026-07-03": "Día de la Independencia (observado)",
  "2026-09-07": "Día del Trabajo",
  "2026-11-26": "Día de Acción de Gracias",
  "2026-12-25": "Navidad",
  "2027-01-01": "Año Nuevo",
  "2027-01-18": "Día de Martin Luther King Jr.",
  "2027-02-15": "Día de los Presidentes",
  "2027-03-26": "Viernes Santo",
  "2027-05-31": "Día de los Caídos",
  "2027-06-18": "Juneteenth (observado)",
  "2027-07-05": "Día de la Independencia (observado)",
  "2027-09-06": "Día del Trabajo",
  "2027-11-25": "Día de Acción de Gracias",
  "2027-12-24": "Navidad (observado)",
};

const EARLY_CLOSE_DAYS: Record<string, string> = {
  "2025-07-03": "Víspera del Día de la Independencia",
  "2025-11-28": "Día después de Acción de Gracias",
  "2025-12-24": "Nochebuena",
  "2026-11-27": "Día después de Acción de Gracias",
  "2026-12-24": "Nochebuena",
  "2027-11-26": "Día después de Acción de Gracias",
};

const OPEN_MINUTES = 9 * 60 + 30; // 09:30 ET
const REGULAR_CLOSE_MINUTES = 16 * 60; // 16:00 ET
const EARLY_CLOSE_MINUTES = 13 * 60; // 13:00 ET

const UY_TZ = "America/Montevideo";
const ET_TZ = "America/New_York";

const WEEKDAY_ES: Record<string, string> = {
  Mon: "lunes",
  Tue: "martes",
  Wed: "miércoles",
  Thu: "jueves",
  Fri: "viernes",
  Sat: "sábado",
  Sun: "domingo",
};

interface ETParts {
  dateKey: string; // YYYY-MM-DD in ET
  weekday: string;
  hour: number;
  minute: number;
  minutesSinceMidnight: number;
}

function getETParts(date: Date): ETParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  return {
    dateKey: `${year}-${month}-${day}`,
    weekday: get("weekday"),
    hour,
    minute,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Resolve a "wall-clock ET" time on a given ET calendar date to a UTC instant,
// honoring the actual ET offset on that date (handles EDT/EST transitions).
function etWallClockToInstant(dateKey: string, hour: number, minute: number): Date {
  for (const offset of ["-04:00", "-05:00"]) {
    const candidate = new Date(`${dateKey}T${pad(hour)}:${pad(minute)}:00${offset}`);
    const back = getETParts(candidate);
    if (back.dateKey === dateKey && back.hour === hour && back.minute === minute) {
      return candidate;
    }
  }
  return new Date(`${dateKey}T${pad(hour)}:${pad(minute)}:00-04:00`);
}

function formatUY(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: UY_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

function etMinutesToUYString(dateKey: string, etMinutes: number): string {
  const h = Math.floor(etMinutes / 60);
  const m = etMinutes % 60;
  return formatUY(etWallClockToInstant(dateKey, h, m));
}

function nextTradingDateKey(dateKey: string, weekday: string): { dateKey: string; weekday: string } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let idx = order.indexOf(weekday);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  for (let i = 1; i <= 10; i++) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    idx = (idx + 1) % 7;
    const nextWd = order[idx];
    const yyyy = cursor.getUTCFullYear();
    const mm = pad(cursor.getUTCMonth() + 1);
    const dd = pad(cursor.getUTCDate());
    const key = `${yyyy}-${mm}-${dd}`;
    if (nextWd === "Sat" || nextWd === "Sun") continue;
    if (HOLIDAYS_FULL_CLOSE[key]) continue;
    return { dateKey: key, weekday: nextWd };
  }
  return { dateKey, weekday: "Mon" };
}

function isWeekend(weekday: string): boolean {
  return weekday === "Sat" || weekday === "Sun";
}

export interface MarketStatus {
  isOpen: boolean;
  /** Short headline, e.g. "Mercado abierto" / "Mercado cerrado" */
  label: string;
  /** One-line context: closing time, holiday name, or next open day */
  detail: string;
  /** Current Uruguay-local time HH:MM */
  localTime: string;
  /** Open time of the current or next session, in Uruguay HH:MM */
  sessionOpen: string;
  /** Close time of the current or next session, in Uruguay HH:MM */
  sessionClose: string;
  /** When the displayed session takes place: "hoy", "lunes", etc. */
  sessionDayLabel: string;
  /** True if the displayed session is today's */
  sessionIsToday: boolean;
  /** Marked when the displayed session has an early close */
  sessionEarlyCloseReason?: string;
}

function buildSession(dateKey: string, weekday: string, isToday: boolean) {
  const earlyClose = EARLY_CLOSE_DAYS[dateKey];
  const closeMinutes = earlyClose ? EARLY_CLOSE_MINUTES : REGULAR_CLOSE_MINUTES;
  return {
    sessionOpen: etMinutesToUYString(dateKey, OPEN_MINUTES),
    sessionClose: etMinutesToUYString(dateKey, closeMinutes),
    sessionDayLabel: isToday ? "hoy" : (WEEKDAY_ES[weekday] ?? "próximo día hábil"),
    sessionIsToday: isToday,
    sessionEarlyCloseReason: earlyClose,
  };
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const parts = getETParts(now);
  const localTime = formatUY(now);

  const holiday = HOLIDAYS_FULL_CLOSE[parts.dateKey];
  if (holiday) {
    const next = nextTradingDateKey(parts.dateKey, parts.weekday);
    const session = buildSession(next.dateKey, next.weekday, false);
    return {
      isOpen: false,
      label: "Mercado cerrado",
      detail: `Feriado: ${holiday}. Reabre el ${session.sessionDayLabel} a las ${session.sessionOpen} (Uruguay).`,
      localTime,
      ...session,
    };
  }

  if (isWeekend(parts.weekday)) {
    const next = nextTradingDateKey(parts.dateKey, parts.weekday);
    const session = buildSession(next.dateKey, next.weekday, false);
    return {
      isOpen: false,
      label: "Mercado cerrado",
      detail: `Fin de semana. Reabre el ${session.sessionDayLabel} a las ${session.sessionOpen} (Uruguay).`,
      localTime,
      ...session,
    };
  }

  const earlyClose = EARLY_CLOSE_DAYS[parts.dateKey];
  const closeMinutes = earlyClose ? EARLY_CLOSE_MINUTES : REGULAR_CLOSE_MINUTES;
  const todaySession = buildSession(parts.dateKey, parts.weekday, true);

  if (parts.minutesSinceMidnight < OPEN_MINUTES) {
    return {
      isOpen: false,
      label: "Mercado cerrado",
      detail: `Pre-apertura. Abre hoy a las ${todaySession.sessionOpen} (Uruguay)${earlyClose ? ` · cierre anticipado ${todaySession.sessionClose} por ${earlyClose}` : ""}.`,
      localTime,
      ...todaySession,
    };
  }

  if (parts.minutesSinceMidnight >= closeMinutes) {
    const next = nextTradingDateKey(parts.dateKey, parts.weekday);
    const session = buildSession(next.dateKey, next.weekday, false);
    const reason = earlyClose ? `Cierre anticipado por ${earlyClose}.` : "Sesión finalizada.";
    return {
      isOpen: false,
      label: "Mercado cerrado",
      detail: `${reason} Reabre el ${session.sessionDayLabel} a las ${session.sessionOpen} (Uruguay).`,
      localTime,
      ...session,
    };
  }

  return {
    isOpen: true,
    label: "Mercado abierto",
    detail: earlyClose
      ? `Cierre anticipado a las ${todaySession.sessionClose} (Uruguay) por ${earlyClose}.`
      : `Cierra a las ${todaySession.sessionClose} (Uruguay).`,
    localTime,
    ...todaySession,
  };
}
