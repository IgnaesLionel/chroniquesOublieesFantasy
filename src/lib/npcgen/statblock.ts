import type { MonsterTemplate } from "@/src/lib/rules/types";
import type { NpcGen, NpcStatBlock, PalierPuissance } from "@/src/lib/npcgen/types";

/**
 * Copie un profil du bestiaire existant. La provenance est conservée dans la
 * fiche pour que le MJ sache que ces valeurs ne sont pas une estimation
 * générée. Les attaques et capacités sont recopiées, pas réinventées.
 */
export function statBlockDepuisMonstre(
  monstre: MonsterTemplate,
  npcId: string,
  palier: PalierPuissance = "moyen"
): NpcStatBlock {
  return {
    id: `stat-${npcId}`,
    npcId,
    source: "bestiaire",
    palier,
    niveau: monstre.niveau,
    pv: Math.max(1, monstre.pvMax),
    defense: monstre.defense,
    initMod: monstre.initMod,
    caracteristiques: monstre.caracteristiques ? structuredClone(monstre.caracteristiques) : undefined,
    attaques: monstre.attaques.map((a) => ({ ...a, id: `${a.id}-${npcId}` })),
    capacites: [...monstre.capacites],
    monsterId: monstre.id,
    monsterNom: monstre.nom,
    notes: `Valeurs copiées du bestiaire « ${monstre.nom} » (${monstre.type}, NC ${monstre.niveau}).`,
    updatedAt: new Date().toISOString(),
  };
}

export function libelleSourceStatBlock(bloc: NpcStatBlock): string {
  if (bloc.source === "bestiaire") {
    return `Bestiaire — ${bloc.monsterNom ?? bloc.monsterId ?? "créature inconnue"}`;
  }
  return "Estimation configurable — à ajuster par le MJ";
}

/** HTML minimal et échappé pour l'impression d'une fiche PNJ. */
export function htmlImpressionPnj(
  npc: NpcGen,
  statBlock?: NpcStatBlock,
  factionNom?: string
): string {
  const esc = (valeur: unknown) =>
    String(valeur ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const liste = (valeurs: string[]) =>
    valeurs.length ? `<ul>${valeurs.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>` : "<p class=\"vide\">—</p>";
  const p = (titre: string, valeur: string) =>
    valeur ? `<p><b>${esc(titre)} :</b> ${esc(valeur)}</p>` : "";

  const combat = statBlock
    ? `<section class="combat">
        <h2>Bloc de combat</h2>
        <p class="note">${esc(libelleSourceStatBlock(statBlock))}</p>
        <p><b>Niveau</b> ${esc(statBlock.niveau)} · <b>PV</b> ${esc(statBlock.pv)} · <b>Défense</b> ${esc(statBlock.defense)} · <b>Init.</b> ${esc(statBlock.initMod)}</p>
        ${statBlock.attaques.map((a) => `<p><b>${esc(a.nom)}</b> : +${esc(a.bonus)}, ${esc(a.degats)}</p>`).join("")}
        ${liste(statBlock.capacites)}
        <p class="note">${esc(statBlock.notes)}</p>
      </section>`
    : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(npc.nom)}</title>
  <style>
    body{font-family:Georgia,serif;max-width:760px;margin:32px auto;color:#1b1b1b;line-height:1.45}
    h1{font-size:28px;margin:0 0 4px} h2{font-size:17px;border-bottom:1px solid #999;margin:22px 0 8px;padding-bottom:3px}
    .sous{color:#555;margin:0 0 18px} .grille{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}
    p{margin:4px 0} b{font-variant:small-caps} ul{margin:4px 0 8px 20px;padding:0}
    .secret{border:1px solid #7a1f1f;background:#faf1f1;padding:10px;margin-top:10px}
    .note{color:#666;font-size:12px;font-style:italic}.vide{color:#999}
    @media print{body{margin:0}.no-print{display:none}}
  </style></head><body>
    <h1>${esc(npc.nom)}</h1>
    <p class="sous">${esc(npc.profession || "Sans profession")}${factionNom ? ` · ${esc(factionNom)}` : ""}${npc.lieu ? ` · ${esc(npc.lieu)}` : ""}</p>
    <div class="grille">
      ${p("Espèce", npc.espece)}${p("Culture", npc.culture)}${p("Sexe", npc.sexe)}${p("Âge", String(npc.age))}
      ${p("Taille", `${npc.tailleCm} cm`)}${p("Poids", `${npc.poidsKg} kg`)}${p("Niveau social", npc.niveauSocial)}${p("Importance", npc.importance)}
    </div>
    <h2>Description</h2><p>${esc(npc.description)}</p>
    ${p("Apparence", npc.apparence)}${p("Voix", npc.voix)}${p("Vêtements", npc.vetements)}${p("Signes", npc.signesDistinctifs)}
    <h2>Personnalité</h2>
    ${p("Traits positifs", npc.personnalite.traitsPositifs.join(", "))}
    ${p("Traits négatifs", npc.personnalite.traitsNegatifs.join(", "))}
    ${p("Qualités", npc.personnalite.qualitesMorales.join(", "))}
    ${p("Défauts", npc.personnalite.defauts.join(", "))}
    ${p("Peurs", npc.personnalite.peurs.join(", "))}
    ${p("Habitudes", npc.personnalite.habitudes.join(", "))}
    <h2>Motivations</h2>
    ${p("Objectif immédiat", npc.motivations.objectifImmediat)}
    ${p("Ambition", npc.motivations.ambition)}
    ${p("Désir", npc.motivations.desir)}
    ${p("Besoin", npc.motivations.besoin)}
    ${p("Problème", npc.motivations.probleme)}
    ${p("Conflit", npc.motivations.conflit)}
    <h2>Roleplay</h2>
    ${p("Attitude initiale", npc.roleplay.attitudeInitiale)}
    ${p("Première réaction", npc.roleplay.premiereReaction)}
    ${p("Offre", npc.roleplay.offre)}
    ${p("Demande", npc.roleplay.demande)}
    ${p("Levier", npc.roleplay.levier)}
    ${p("Déclencheur d'hostilité", npc.roleplay.declencheurHostilite)}
    <p><b>Accroche :</b> ${esc(npc.roleplay.accroche)}</p>
    <h2>Équipement</h2>
    ${liste([...npc.equipement, ...npc.objetsValeurs, ...npc.objetsPersonnels, ...npc.objetsSuspects, ...npc.objetsMagiques, ...npc.documents])}
    ${npc.relations.length ? `<h2>Relations</h2><ul>${npc.relations.map((r) => `<li><b>${esc(r.nom)}</b> — ${esc(r.type)} : ${esc(r.description)}</li>`).join("")}</ul>` : ""}
    ${combat}
    <div class="secret"><b>Secret MJ :</b> ${esc(npc.motivations.secret)}</div>
    <h2>Notes MJ</h2><p>${esc(npc.notesMJ || "—")}</p>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`;
}

export function ouvrirImpressionPnj(npc: NpcGen, statBlock?: NpcStatBlock, factionNom?: string): void {
  // `noopener` dans les options fait renvoyer null par window.open dans
  // plusieurs navigateurs ; on coupe la référence manuellement après coup.
  const fenetre = window.open("", "_blank");
  if (!fenetre) return;
  fenetre.opener = null;
  fenetre.document.write(htmlImpressionPnj(npc, statBlock, factionNom));
  fenetre.document.close();
  fenetre.focus();
}
