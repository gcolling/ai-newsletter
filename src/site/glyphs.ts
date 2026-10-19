import { type Html, raw } from "./html.ts";

/**
 * Small outlined icons, drawn inline so they follow the text color and need no requests.
 * Styled by `.glyph` (stroke, size); a pressed bookmark gets a fill from its button.
 */
const PATHS = {
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/>',
  bookmark: '<path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4-6 4v-16a1 1 0 0 1 1-1z"/>',
} as const;

export type GlyphName = keyof typeof PATHS;

export function glyph(name: GlyphName): Html {
  return raw(`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]}</svg>`);
}
