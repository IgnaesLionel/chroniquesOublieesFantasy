// Couleurs PV centralisées : une seule source de vérité.
// - pvTexteColor : texte (fiches Personnages, vue Partie)
// - pvBarreColor : barre de progression (table Combat)
export function pvRatio(pv: number, max: number): number {
  if (!max || max <= 0) return 0;
  return pv / max;
}

export function pvTexteColor(pv: number, max: number): string {
  const r = pvRatio(pv, max);
  if (r > 0.5) return "text-green-400";
  if (r > 0.25) return "text-amber-400";
  return "text-red-400";
}

export function pvBarreColor(pv: number, max: number): string {
  const r = pvRatio(pv, max);
  if (r > 0.5) return "bg-green-500";
  if (r > 0.25) return "bg-amber-400";
  return "bg-red-500";
}
