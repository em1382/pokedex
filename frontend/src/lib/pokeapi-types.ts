// Minimal shapes of the PokeAPI v2 payloads we read. Rails passes these through untouched.

export interface NamedAPIResource {
  name: string;
  url: string;
}

export interface NamedAPIResourceList {
  count: number;
  next: string | null;
  previous: string | null;
  results: NamedAPIResource[];
}

export interface Name {
  name: string;
  language: NamedAPIResource;
}

export interface VerboseEffect {
  effect: string;
  short_effect: string;
  language: NamedAPIResource;
}

/** English entry from a localized array, falling back to the first entry. */
export function english<T extends { language: NamedAPIResource }>(
  entries: T[] | undefined | null,
): T | undefined {
  if (!entries?.length) return undefined;
  return entries.find((e) => e.language.name === "en") ?? entries[0];
}

export function names(list: NamedAPIResource[] | undefined | null): string {
  return (list ?? []).map((r) => r.name).join(", ");
}

/** Collapse whitespace/newlines PokeAPI leaves in flavor/effect text. */
export function clean(text: string | undefined | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

const SPRITE_PREFIX = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";

/** Rewrite a PokeAPI sprite URL to the copy served by our backend (/sprites/...). */
export function localSprite(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith(SPRITE_PREFIX) ? `/sprites/${url.slice(SPRITE_PREFIX.length)}` : url;
}
