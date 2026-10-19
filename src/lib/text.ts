/** Normalise une chaîne pour la recherche : minuscules, sans accents, espaces compactés. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Vrai si chaque mot de la requête apparaît dans le texte (ordre libre). */
export function matchesQuery(text: string, query: string): boolean {
  const hay = normalize(text);
  const tokens = normalize(query).split(" ").filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => hay.includes(t));
}

/** Vrai si deux noms se recouvrent (l'un contient tous les mots de l'autre). */
export function similarName(a: string, b: string): boolean {
  const ta = new Set(normalize(a).split(" ").filter(Boolean));
  const tb = new Set(normalize(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  return inter === ta.size || inter === tb.size;
}
