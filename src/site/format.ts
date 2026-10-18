import type { Story } from "../types.ts";

const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options });

const weekdayFmt = fmt({ weekday: "long" });
const dayMonthFmt = fmt({ day: "numeric", month: "long" });
const longFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDayFmt = fmt({ weekday: "short", day: "numeric" });
const monthFmt = fmt({ month: "long", year: "numeric" });
const stampFmt = fmt({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit" });

/** "Saturday" */
export const weekday = (date: string) => weekdayFmt.format(utc(date));
/** "18 October" */
export const dayMonth = (date: string) => dayMonthFmt.format(utc(date));
/** "Saturday 18 October 2026" */
export const longDate = (date: string) => longFmt.format(utc(date)).replace(",", "");
/** "Sat 18" */
export const shortDay = (date: string) => shortDayFmt.format(utc(date));
/** "October 2026" */
export const monthOf = (date: string) => monthFmt.format(utc(date));
/** "17 Oct, 22:31 UTC": the no-JS fallback; the browser rewrites it in local time. */
export const stamp = (iso: string) => `${stampFmt.format(new Date(iso))} UTC`;
/** "06:00 UTC" */
export const timeUtc = (iso: string) => `${timeFmt.format(new Date(iso))} UTC`;

/** Permalink path of an issue, relative to the site root: "2026/10/18/". */
export const issuePath = (date: string) => `${date.replaceAll("-", "/")}/`;

/** Roughly 30 seconds per story to read the card and decide. */
export const readingTime = (count: number) => {
  const minutes = Math.max(1, Math.round(count / 2));
  return `about ${minutes} min`;
};

/** "The Verge - AI" → "The Verge", "Interconnects (Nathan Lambert)" → "Interconnects". */
export const outlet = (name: string) =>
  name
    .replace(/\s+[-–]\s+.*$/, "")
    .replace(/\s*\(.*\)$/, "")
    .trim();

/** Where the "Read" button takes you, in words. */
export function destination(story: Story): string {
  if (story.section === "papers") return "Hugging Face";
  if (story.section === "community") return story.host;
  return outlet(story.source.name);
}

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
