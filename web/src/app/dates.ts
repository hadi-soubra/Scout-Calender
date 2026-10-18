const pad = (n: number) => String(n).padStart(2, '0');

/** Local date -> "YYYY-MM-DD" */
export function toDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date -> "YYYY-MM-DDTHH:mm" */
export function toDateTime(d: Date) {
  return `${toDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Shift a "YYYY-MM-DD" string by whole days. */
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  return toDay(new Date(y, m - 1, d + n));
}

/** Mix a hex colour with white; `amount` is the share of the original colour (0–1). */
export function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * amount + 255 * (1 - amount));
  return `rgb(${mix(n >> 16)} ${mix((n >> 8) & 255)} ${mix(n & 255)})`;
}
