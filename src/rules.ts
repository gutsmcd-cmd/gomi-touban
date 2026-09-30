export type Kind = 'weekly' | 'nth' | 'dates';
export interface Rule {
  id: string;
  categoryId: string;
  kind: Kind;
  weekday: number;
  dates: string[];
}

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** nth occurrence of weekday in a month (1 = first). Weekday is Date.getDay() (0 = Sunday). */
export function nthWeekday(year: number, monthIndex: number, weekday: number, n: number): string | null {
  const first = new Date(year, monthIndex, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  const dt = new Date(year, monthIndex, day);
  if (dt.getMonth() !== monthIndex) return null;
  return iso(dt);
}

export function ruleMatches(rule: Rule, date: Date): boolean {
  if (rule.kind === 'dates') return rule.dates.includes(iso(date));
  if (date.getDay() !== rule.weekday) return false;
  if (rule.kind === 'weekly') return true;
  const key = iso(date);
  return nthWeekday(date.getFullYear(), date.getMonth(), rule.weekday, 1) === key
    || nthWeekday(date.getFullYear(), date.getMonth(), rule.weekday, 3) === key;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function todayDate(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
