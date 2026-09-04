// Delivery times are wall-clock times in Columbus. Storing them as
// timestamptz keeps the instant unambiguous, but every render has to
// pin the zone explicitly — otherwise a volunteer reading the board
// from another state sees a different time than the family expects.
export const ORG_TIME_ZONE = "America/New_York";

const DATE_PARTS = { year: "numeric", month: "short", day: "numeric", weekday: "short" };
const TIME_PARTS = { hour: "numeric", minute: "2-digit" };

function fmt(value, options) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", { timeZone: ORG_TIME_ZONE, ...options }).format(d);
}

// "Sat, Sep 14, 2026 at 3:00 PM"
export function formatDateTime(value) {
  if (!value) return "";
  const date = fmt(value, DATE_PARTS);
  const time = fmt(value, TIME_PARTS);
  return date && time ? `${date} at ${time}` : date;
}

// "Sat, Sep 14, 2026"
export function formatDate(value) {
  return fmt(value, DATE_PARTS);
}

// Splits a timestamp into the Y/M/D/H/M numbers it has *in the org's
// timezone*. Everything below builds on this so the DST rules for the
// specific date are applied, rather than today's offset.
function orgParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const out = {};
  for (const p of parts) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out;
}

// How far the org's zone is from UTC at a given instant, in ms.
function orgOffsetMs(date) {
  const p = orgParts(date);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - date.getTime();
}

// Converts "2026-09-14T15:00" — what a datetime-local input produces,
// which carries no zone — into the UTC instant of 3:00 PM in Columbus.
//
// The offset is looked up by probing with the naive value first, then
// re-probing with the corrected instant. The second pass matters only
// for the couple of hours a year when a DST change sits between the
// two, where a single pass would land an hour off.
export function orgLocalToUtcIso(localValue) {
  if (!localValue) return null;
  const naive = new Date(`${localValue}${localValue.length === 16 ? ":00" : ""}Z`);
  if (Number.isNaN(naive.getTime())) return null;
  const firstPass = new Date(naive.getTime() - orgOffsetMs(naive));
  const corrected = new Date(naive.getTime() - orgOffsetMs(firstPass));
  return corrected.toISOString();
}

// Inverse of the above: a stored timestamp rendered as the
// "YYYY-MM-DDTHH:mm" a datetime-local input expects, in org time.
export function utcToOrgLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = orgParts(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// The earliest acceptable delivery slot, as a datetime-local value —
// used for the input's min attribute and for submit-time validation,
// so the two can never disagree.
export function minNoticeLocalValue(days) {
  const now = new Date();
  const p = orgParts(now);
  const pad = (n) => String(n).padStart(2, "0");
  // Advance the calendar date in org time, keeping midnight as the
  // boundary: any slot on the Nth day out is acceptable.
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}T00:00`;
}
