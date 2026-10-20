"use client";
import type { Character } from "@/src/lib/rules/types";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import type { Item } from "@/src/lib/rules/world/types";
import { labelFamilleArme } from "@/src/lib/rules/world/types";
import { familleDuProfil } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";

interface Props {
  participants: CombatParticipant[];
  lanceurId: string | null;
  characters: Character[];
  catalogue: Item[];
  onToggle: (lanceurId: string, itemId: string) => void;
}

/** Équipement en combat : sortir une arme du sac / rengainer, effet immédiat. */
export function EquipementPanel({ participants, lanceurId, characters, catalogue, onToggle }: Props) {
  const lanceur = participants.find((p) => p.instanceId === lanceurId) ?? null;
  const fiche = characters.find((c) => c.id === lanceur?.templateId) ?? null;
  if (!lanceur || !fiche) return null;
  const inv = fiche.inventaire ?? [];
  if (inv.length === 0) return null;

  return (
    <div className="rounded-lg border border-sky-900 bg-zinc-900 p-4 space-y-2">
      <h2 className="font-bold text-sm uppercase text-sky-300">🎒 Équipement — {lanceur.nom} <FamilleBadge famille={familleDuProfil(lanceur.profil)} className="ml-1" /></h2>
      <div className="space-y-1">
        {inv.map((e) => {
          const item = catalogue.find((o) => o.id === e.itemId);
          const fams = (item?.familles ?? []).map((f) => labelFamilleArme(f)).join(", ");
return (
            <div key={e.itemId} className="flex items-center gap-2 text-sm">
              <span className="flex-1">
                {item?.estArme ? "🗡 " : "🎒 "}{item?.nom ?? e.itemId}
                <span className="text-zinc-500 text-xs"> ×{e.quantite}</span>
                {item?.estArme && (
                  <span className="text-zinc-500 text-xs">
                    {" "}(+{item.bonusAttaque ?? 0} · {item.degats ?? "1d6"}{fams ? ` · ${fams}` : ""})
                  </span>
                )}
              </span>
              {item?.estArme ? (
                <button
                  onClick={() => onToggle(lanceur.instanceId, e.itemId)}
                  title={e.equipe ? "Rengainer (ne sera plus utilisable)" : "Sortir du sac : utilisable aussitôt"}
                  className={`text-xs px-2 py-0.5 rounded font-semibold ${e.equipe ? "bg-green-700" : "bg-zinc-800"}`}
                >
                  {e.equipe ? "✓ Équipée" : "Équiper"}
                </button>
              ) : (
                <span className="text-xs text-zinc-600">sac</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">Équiper en combat = disponible aussitôt (le MJ arbitre le coût en actions).</p>
    </div>
  );
}
