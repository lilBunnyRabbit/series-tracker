// Tiny RFC-5545 generator for the upcoming-episodes export. Per spec, lines
// >75 octets must be folded with CRLF + space; titles with semicolons /
// commas / backslashes need escaping.

export type IcsEvent = {
  uid: string;
  /** All-day start (YYYY-MM-DD); upcoming episodes have no time, only an air date. */
  date: string;
  summary: string;
  description?: string;
  url?: string;
};

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line: string): string {
  if (line.length <= 75) return line;
  // RFC-5545: continuation lines start with a single space.
  let out = line.slice(0, 75);
  let i = 75;
  while (i < line.length) {
    out += "\r\n " + line.slice(i, i + 74);
    i += 74;
  }
  return out;
}

function dtstamp(): string {
  // YYYYMMDDTHHMMSSZ from current time.
  const d = new Date();
  return (
    d.getUTCFullYear().toString().padStart(4, "0") +
    (d.getUTCMonth() + 1).toString().padStart(2, "0") +
    d.getUTCDate().toString().padStart(2, "0") +
    "T" +
    d.getUTCHours().toString().padStart(2, "0") +
    d.getUTCMinutes().toString().padStart(2, "0") +
    d.getUTCSeconds().toString().padStart(2, "0") +
    "Z"
  );
}

function dateOnly(iso: string): string {
  // VALUE=DATE expects YYYYMMDD with no separators.
  return iso.replace(/-/g, "").slice(0, 8);
}

function nextDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildIcs(events: IcsEvent[], calName = "Series Tracker — Upcoming"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Series Tracker//Upcoming//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${escapeText(calName)}`),
  ];
  const stamp = dtstamp();
  for (const e of events) {
    const start = dateOnly(e.date);
    const end = dateOnly(nextDay(e.date));
    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:${e.uid}`));
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${end}`);
    lines.push(fold(`SUMMARY:${escapeText(e.summary)}`));
    if (e.description) lines.push(fold(`DESCRIPTION:${escapeText(e.description)}`));
    if (e.url) lines.push(fold(`URL:${e.url}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
