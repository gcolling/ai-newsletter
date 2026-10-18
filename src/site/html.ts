/**
 * Tiny HTML templating: every interpolated value is escaped unless it is already Html.
 * Feed content is untrusted, so there is no way to inject markup by accident.
 */
export class Html {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString(): string {
    return this.value;
  }
}

type Part = Html | string | number | boolean | null | undefined | Part[];

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

function render(part: Part): string {
  if (part instanceof Html) return part.value;
  if (Array.isArray(part)) return part.map(render).join("");
  if (part === null || part === undefined || part === false) return "";
  return escapeHtml(String(part));
}

export function html(strings: TemplateStringsArray, ...parts: Part[]): Html {
  let out = strings[0] ?? "";
  parts.forEach((part, i) => {
    out += render(part) + (strings[i + 1] ?? "");
  });
  return new Html(out);
}

/** Marks trusted markup (our own CSS, JSON we serialised) as safe. */
export function raw(value: string): Html {
  return new Html(value);
}

/** Only http(s) links leave the site; anything else becomes inert. */
export function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "#";
  } catch {
    return "#";
  }
}
