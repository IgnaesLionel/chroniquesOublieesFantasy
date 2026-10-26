// Moteur de génération pur : aucun accès React, DOM ou localStorage.
// Toutes les listes viennent des tables fournies par l'appelant. Un tirage
// aléatoire sans table renvoie une valeur vide + un avertissement, jamais une
// valeur inventée présentée comme officielle.

import type {
  ConditionsGeneration,
  EtatChamp,
  Faction,
  NpcGen,
  NpcGenerationOptions,
  NpcProfile,
  NpcStatBlock,
  PalierPuissance,
  ReferenceEntry,
  ReferenceTable,
  ResultatGeneration,
  SexePnj,
} from "@/src/lib/npcgen/types";
import {
  IMPORTANCE_LABEL,
  lireChamp,
  nomComplet,
  TABLE_IDS,
  ecrireChamp,
} from "@/src/lib/npcgen/types";

interface DonneesGeneration {
  tables: ReferenceTable[];
  entries: ReferenceEntry[];
  factions?: Faction[];
  profiles?: NpcProfile[];
}

interface Contexte {
  sexe?: SexePnj;
  espece?: string;
  culture?: string;
  profession?: string;
  categorieProfession?: string;
  niveauSocial?: string;
  importance?: string;
  tags: string[];
}

interface Regle {
  type: string;
  tableCible?: string;
  valeurCible?: string;
  tableCandidate?: string;
  tagCandidat?: string;
  tableRequise?: string;
  valeurRequise?: string;
  message?: string;
}

export interface RandomSource {
  next(): number;
  int(maxExclusif: number): number;
  chance(probabilite: number): boolean;
  pick<T>(valeurs: T[]): T | undefined;
}

/** PRNG déterministe (mulberry32) : même graine + mêmes tables = même PNJ. */
export function creerRandom(graine: string | number): RandomSource {
  let state = typeof graine === "number" ? graine >>> 0 : hacher(graine);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(maxExclusif) {
      if (maxExclusif <= 0) return 0;
      return Math.floor(next() * maxExclusif);
    },
    chance(probabilite) {
      return next() < probabilite;
    },
    pick<T>(valeurs: T[]) {
      return valeurs.length === 0 ? undefined : valeurs[Math.floor(next() * valeurs.length)];
    },
  };
}

export function hacher(texte: string): number {
  let hash = 2166136261;
  for (let i = 0; i < texte.length; i += 1) {
    hash ^= texte.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function nouvelleGraine(): string {
  return `pnj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function texteMeta(meta: Record<string, unknown>, cle: string): string {
  const valeur = meta[cle];
  return typeof valeur === "string" ? valeur : valeur == null ? "" : String(valeur);
}

/** Seuls deux sexes sont proposés ; une table vide ou invalide retombe sur masculin. */
function sexeDepuisMeta(meta: Record<string, unknown>): SexePnj {
  return texteMeta(meta, "code") === "feminin" ? "feminin" : "masculin";
}

function nombreMeta(meta: Record<string, unknown>, cle: string, repli = 0): number {
  const valeur = meta[cle];
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : repli;
}

function tableauMeta(meta: Record<string, unknown>, cle: string): string[] {
  const valeur = meta[cle];
  if (Array.isArray(valeur)) return valeur.filter((x): x is string => typeof x === "string");
  return typeof valeur === "string" ? [valeur] : [];
}

function inclutNormalise(liste: string[] | undefined, valeur: string | undefined): boolean {
  if (!liste || liste.length === 0) return true;
  // Une dimension pas encore connue (ex. le niveau social avant le choix du
  // métier) ne doit pas vider toutes les tables. Dès que le contexte la
  // renseigne, le filtre s'applique normalement.
  if (!valeur) return true;
  return liste.some((x) => normaliser(x) === normaliser(valeur));
}

function conditionsRespectees(conditions: ConditionsGeneration, ctx: Contexte): boolean {
  if (!inclutNormalise(conditions.sexes, ctx.sexe)) return false;
  if (!inclutNormalise(conditions.especes, ctx.espece)) return false;
  if (!inclutNormalise(conditions.cultures, ctx.culture)) return false;
  if (!inclutNormalise(conditions.professions, ctx.profession)) return false;
  if (!inclutNormalise(conditions.categoriesProfession, ctx.categorieProfession)) return false;
  if (!inclutNormalise(conditions.niveauxSociaux, ctx.niveauSocial)) return false;
  if (!inclutNormalise(conditions.importances, ctx.importance)) return false;
  if (conditions.tagsRequis?.length) {
    const tags = ctx.tags.map(normaliser);
    if (!conditions.tagsRequis.every((tag) => tags.includes(normaliser(tag)))) return false;
  }
  if (conditions.tagsExclus?.length) {
    const tags = ctx.tags.map(normaliser);
    if (conditions.tagsExclus.some((tag) => tags.includes(normaliser(tag)))) return false;
  }
  return true;
}

function lireRegles(entries: ReferenceEntry[]): Regle[] {
  return entries
    .filter((e) => e.tableId === TABLE_IDS.reglesCompatibilite && e.actif)
    .map((e) => ({
      type: texteMeta(e.meta, "type"),
      tableCible: texteMeta(e.meta, "tableCible"),
      valeurCible: texteMeta(e.meta, "valeurCible"),
      tableCandidate: texteMeta(e.meta, "tableCandidate"),
      tagCandidat: texteMeta(e.meta, "tagCandidat"),
      tableRequise: texteMeta(e.meta, "tableRequise"),
      valeurRequise: texteMeta(e.meta, "valeurRequise"),
      message: e.description,
    }))
    .filter((r) => r.type.length > 0);
}

function regleAutorise(
  candidate: ReferenceEntry,
  ctx: Contexte,
  selection: Map<string, ReferenceEntry>,
  regles: Regle[]
): { ok: boolean; raison?: string } {
  const tags = candidate.tags.map(normaliser);
  for (const regle of regles) {
    const cible = regle.tableCible ? selection.get(regle.tableCible) : undefined;
    const cibleOk = !!cible && (!regle.valeurCible || normaliser(cible.valeur) === normaliser(regle.valeurCible));

    if (regle.type === "exclusion" && cibleOk && regle.tableCandidate === candidate.tableId) {
      if (!regle.tagCandidat || tags.includes(normaliser(regle.tagCandidat))) {
        return { ok: false, raison: regle.message };
      }
    }

    if (regle.type === "requiert" && regle.tableCandidate === candidate.tableId) {
      if (regle.tagCandidat && !tags.includes(normaliser(regle.tagCandidat))) continue;
      const source = regle.tableRequise ? selection.get(regle.tableRequise) : undefined;
      const sourceOk = !!source && (!regle.valeurRequise || normaliser(source.valeur) === normaliser(regle.valeurRequise));
      if (!sourceOk && !ctx.profession) {
        return { ok: false, raison: regle.message };
      }
    }
  }
  return { ok: true };
}

function choisirEntree(
  tableId: string,
  ctx: Contexte,
  data: DonneesGeneration,
  rng: RandomSource,
  warnings: string[],
  tablesUtilisees: Set<string>,
  selection: Map<string, ReferenceEntry>,
  regles: Regle[],
  options: { ignorerTagsRequis?: boolean; dejaChoisis?: Set<string> } = {}
): ReferenceEntry | undefined {
  const table = data.tables.find((t) => t.id === tableId);
  if (!table) {
    warnings.push(`Table « ${tableId} » absente : valeur laissée vide.`);
    return undefined;
  }
  if (!table.actif) {
    warnings.push(`Table « ${table.nom} » inactive : valeur laissée vide.`);
    return undefined;
  }
  const deja = options.dejaChoisis ?? new Set<string>();
  const toutes = data.entries.filter(
    (e) => e.tableId === tableId && e.actif && e.poids > 0 && !deja.has(e.id)
  );
  if (toutes.length === 0) {
    warnings.push(`La table « ${table.nom} » ne contient aucune entrée active.`);
    return undefined;
  }

  const eligible = (e: ReferenceEntry, relaxerTags: boolean): boolean => {
    if (relaxerTags) {
      const { tagsRequis: _ignore, ...sansTags } = e.conditions;
      if (!conditionsRespectees(sansTags, ctx)) return false;
    } else if (!conditionsRespectees(e.conditions, ctx)) {
      return false;
    }
    if (ctx.culture && typeof e.meta.culture === "string" && e.meta.culture !== ctx.culture) return false;
    if (ctx.sexe && typeof e.meta.sexe === "string" && e.meta.sexe !== ctx.sexe) return false;
    if (
      ctx.categorieProfession &&
      e.tableId === TABLE_IDS.professions &&
      typeof e.meta.categorie === "string" &&
      normaliser(e.meta.categorie) !== normaliser(ctx.categorieProfession)
    ) {
      return false;
    }
    return regleAutorise(e, ctx, selection, regles).ok;
  };

  let candidates = toutes.filter((e) => eligible(e, false));
  if (candidates.length === 0 && options.ignorerTagsRequis) {
    candidates = toutes.filter((e) => eligible(e, true));
    if (candidates.length > 0) {
      warnings.push(`Aucune entrée de « ${table.nom} » ne correspondait aux affinités : repli sur les entrées générales.`);
    }
  }
  if (candidates.length === 0) {
    warnings.push(`Aucune entrée de « ${table.nom} » ne correspond au contexte : valeur laissée vide.`);
    return undefined;
  }

  const total = candidates.reduce((somme, e) => somme + Math.max(0, e.poids), 0);
  let tirage = rng.next() * total;
  let choisie = candidates[candidates.length - 1];
  for (const candidate of candidates) {
    tirage -= Math.max(0, candidate.poids);
    if (tirage <= 0) {
      choisie = candidate;
      break;
    }
  }
  tablesUtilisees.add(tableId);
  return choisie;
}

function choisirValeur(
  tableId: string,
  ctx: Contexte,
  data: DonneesGeneration,
  rng: RandomSource,
  warnings: string[],
  tablesUtilisees: Set<string>,
  selection: Map<string, ReferenceEntry>,
  regles: Regle[],
  options: { ignorerTagsRequis?: boolean; dejaChoisis?: Set<string> } = {}
): string {
  return choisirEntree(tableId, ctx, data, rng, warnings, tablesUtilisees, selection, regles, options)?.valeur ?? "";
}

function choisirPlusieurs(
  tableId: string,
  nombre: number,
  ctx: Contexte,
  data: DonneesGeneration,
  rng: RandomSource,
  warnings: string[],
  tablesUtilisees: Set<string>,
  selection: Map<string, ReferenceEntry>,
  regles: Regle[]
): string[] {
  const resultats: string[] = [];
  const deja = new Set<string>();
  for (let i = 0; i < nombre; i += 1) {
    const entree = choisirEntree(tableId, ctx, data, rng, warnings, tablesUtilisees, selection, regles, {
      ignorerTagsRequis: true,
      dejaChoisis: deja,
    });
    if (!entree) break;
    deja.add(entree.id);
    resultats.push(entree.valeur);
  }
  return resultats;
}

function entreeForcee(
  tableId: string,
  valeur: string | undefined,
  data: DonneesGeneration
): ReferenceEntry | undefined {
  if (!valeur) return undefined;
  if (!data.tables.some((t) => t.id === tableId && t.actif)) return undefined;
  return data.entries.find(
    (e) => e.tableId === tableId && e.actif && normaliser(e.valeur) === normaliser(valeur)
  );
}

function ajouterTags(tags: string[], ...valeurs: (string | undefined)[]): string[] {
  for (const valeur of valeurs) {
    if (!valeur) continue;
    const propre = valeur.trim();
    if (propre && !tags.some((t) => normaliser(t) === normaliser(propre))) tags.push(propre);
  }
  return tags;
}

function nombreDepart(options: NpcGenerationOptions, profiles: NpcProfile[] | undefined, warnings: string[]): NpcGenerationOptions {
  if (!options.profileId || !profiles) return options;
  const profil = profiles.find(
    (p) => p.actif && (p.id === options.profileId || normaliser(p.nom) === normaliser(options.profileId ?? ""))
  );
  if (!profil) {
    warnings.push(`Profil « ${options.profileId} » introuvable ou inactif : critères ignorés.`);
    return options;
  }
  // Les champs explicitement vides du formulaire ne doivent pas écraser les
  // valeurs du profil. On ne fusionne donc que les critères réellement définis.
  const explicites = Object.fromEntries(
    Object.entries(options).filter(([, valeur]) => valeur !== undefined)
  ) as Partial<NpcGenerationOptions>;
  return {
    ...profil.options,
    ...explicites,
    tags: ajouterTags(
      [],
      ...(profil.options.tags ?? []),
      ...(profil.tags ?? []),
      ...(options.tags ?? [])
    ),
    exclureTags: ajouterTags([], ...(profil.options.exclureTags ?? []), ...(options.exclureTags ?? [])),
  };
}

function remettreVariables(modele: string, npc: NpcGen): string {
  const valeurs: Record<string, string> = {
    nom: npc.nom,
    prenom: npc.prenom,
    profession: npc.profession,
    lieu: npc.lieu,
    secret: npc.motivations.secret,
    objet: npc.motivations.objetRecherche,
    faction: npc.factionNom,
    rumeur: npc.motivations.rumeur,
    age: String(npc.age),
    espece: npc.espece,
  };
  return modele.replace(/\{(\w+)\}/g, (_tout, cle: string) => valeurs[cle] ?? `{${cle}}`);
}

function construireStatBlock(
  npc: NpcGen,
  palier: PalierPuissance,
  data: DonneesGeneration,
  warnings: string[]
): NpcStatBlock {
  const voulu = palier.charAt(0).toUpperCase() + palier.slice(1);
  const entree =
    data.entries.find(
      (e) =>
        e.tableId === TABLE_IDS.paliersPuissance &&
        e.actif &&
        normaliser(e.valeur) === normaliser(voulu)
    ) ??
    data.entries.find((e) => e.tableId === TABLE_IDS.paliersPuissance && e.actif);

  if (!entree) {
    warnings.push("Aucun palier de puissance configuré : bloc de combat minimal.");
  }
  const meta = entree?.meta ?? {};
  if (!entree) {
    warnings.push("Créez ou activez un palier dans la table « Paliers de puissance » pour ajuster le combat.");
  }
  const niveau = Math.max(1, Math.round(nombreMeta(meta, "niveau", 1)));
  const bonus = nombreMeta(meta, "bonusAttaque", 0);
  const degats = texteMeta(meta, "degats") || "1d6";

  return {
    id: `stat-${npc.id}`,
    npcId: npc.id,
    source: "estimation",
    palier,
    niveau,
    pv: Math.max(1, Math.round(nombreMeta(meta, "pv", 6))),
    defense: Math.max(1, Math.round(nombreMeta(meta, "defense", 10))),
    initMod: Math.round(nombreMeta(meta, "initMod", 0)),
    attaques: [
      {
        id: `atk-${npc.id}-1`,
        nom: `Attaque de ${npc.profession || "PNJ"}`.replace(/\s+/g, " ").trim(),
        bonus,
        degats,
      },
    ],
    capacites: [
      `Estimation ${IMPORTANCE_LABEL[npc.importance].toLowerCase()} — à ajuster par le MJ`,
    ],
    notes:
      "Valeurs ESTIMÉES à partir du palier de puissance configurable du générateur. Elles ne constituent pas une règle officielle COF2.",
    updatedAt: new Date().toISOString(),
  };
}

/** Construit un bloc de combat estimé sans régénérer la fiche narrative. */
export function estimerCombat(
  npc: NpcGen,
  palier: PalierPuissance,
  data: DonneesGeneration,
  warnings: string[] = []
): NpcStatBlock {
  return construireStatBlock(npc, palier, data, warnings);
}

export function genererPnj(options: NpcGenerationOptions, data: DonneesGeneration): ResultatGeneration {
  const warnings: string[] = [];
  const opts = nombreDepart(options, data.profiles, warnings);
  const seed = opts.seed?.trim() || nouvelleGraine();
  const rng = creerRandom(seed);
  const regles = lireRegles(data.entries);
  const selection = new Map<string, ReferenceEntry>();
  const tablesUtilisees = new Set<string>();
  const sources: Record<string, EtatChamp> = {};
  const noter = (chemin: string, entree: ReferenceEntry | undefined, mode: EtatChamp["mode"] = "table") => {
    if (!entree) return;
    sources[chemin] = {
      verrouille: opts.verrous?.includes(chemin) ?? false,
      sourceTableId: entree.tableId,
      sourceEntryId: entree.id,
      mode,
    };
  };
  const fromMeta = (tableId: string, valeur: string | undefined, chemin: string): ReferenceEntry | undefined => {
    const entree = entreeForcee(tableId, valeur, data);
    if (entree) {
      selection.set(tableId, entree);
      tablesUtilisees.add(tableId);
      noter(chemin, entree);
    }
    return entree;
  };

  const ctx: Contexte = { tags: ajouterTags([], ...(opts.tags ?? [])) };

  const especeForcee = fromMeta(TABLE_IDS.especes, opts.espece, "espece");
  if (opts.espece && !especeForcee) warnings.push(`Espèce « ${opts.espece} » introuvable ou inactive.`);
  if (!especeForcee) {
    const e = choisirEntree(TABLE_IDS.especes, ctx, data, rng, warnings, tablesUtilisees, selection, regles);
    noter("espece", e);
    ctx.espece = e?.valeur;
  } else {
    ctx.espece = especeForcee.valeur;
  }

  const cultureForcee = fromMeta(TABLE_IDS.cultures, opts.culture, "culture");
  if (opts.culture && !cultureForcee) warnings.push(`Culture « ${opts.culture} » introuvable ou inactive.`);
  if (!cultureForcee) {
    const e = choisirEntree(TABLE_IDS.cultures, ctx, data, rng, warnings, tablesUtilisees, selection, regles);
    noter("culture", e);
    ctx.culture = e?.valeur;
  } else {
    ctx.culture = cultureForcee.valeur;
  }

  const sexeForce = opts.sexe;
  if (sexeForce) {
    ctx.sexe = sexeForce;
    const e = fromMeta(TABLE_IDS.sexes, sexeForce, "sexe");
    if (!e) warnings.push(`Sexe « ${sexeForce} » absent de la table : valeur conservée.`);
  } else {
    const e = choisirEntree(TABLE_IDS.sexes, ctx, data, rng, warnings, tablesUtilisees, selection, regles);
    ctx.sexe = sexeDepuisMeta(e?.meta ?? {});
    noter("sexe", e);
  }

  // Les prénoms sont conditionnés par le sexe et la culture ;
  const tablePrenoms =
    ctx.sexe === "feminin"
      ? TABLE_IDS.prenomsFeminins
      : ctx.sexe === "masculin"
        ? TABLE_IDS.prenomsMasculins
        : rng.chance(0.5)
          ? TABLE_IDS.prenomsFeminins
          : TABLE_IDS.prenomsMasculins;
  const sexePrenom: SexePnj = tablePrenoms === TABLE_IDS.prenomsFeminins ? "feminin" : "masculin";
  const ctxPrenom = { ...ctx, sexe: sexePrenom };
  const prenomE = choisirEntree(tablePrenoms, ctxPrenom, data, rng, warnings, tablesUtilisees, selection, regles, {
    ignorerTagsRequis: true,
  });
  noter("prenom", prenomE);
  const prenom = prenomE?.valeur ?? "";

  const nomFamilleE = choisirEntree(TABLE_IDS.nomsFamille, ctx, data, rng, warnings, tablesUtilisees, selection, regles, {
    ignorerTagsRequis: true,
  });
  noter("nomFamille", nomFamilleE);
  const nomFamille = nomFamilleE?.valeur ?? "";

  const trancheAgeE = choisirEntree(TABLE_IDS.tranchesAge, ctx, data, rng, warnings, tablesUtilisees, selection, regles);
  noter("age", trancheAgeE);
  const ageMin = nombreMeta(trancheAgeE?.meta ?? {}, "min", 18);
  const ageMax = Math.max(ageMin, nombreMeta(trancheAgeE?.meta ?? {}, "max", 60));
  const age = ageMin + rng.int(ageMax - ageMin + 1);

  const tailleE = choisirEntree(TABLE_IDS.tailles, ctx, data, rng, warnings, tablesUtilisees, selection, regles);
  noter("tailleCm", tailleE);
  const minTaille = nombreMeta(tailleE?.meta ?? {}, "min", 160);
  const maxTaille = Math.max(minTaille, nombreMeta(tailleE?.meta ?? {}, "max", 180));
  const modEspece =
    ctx.espece === "Nain"
      ? 0.82
      : ctx.espece === "Gnome"
        ? 0.72
        : ctx.espece === "Halfelin"
          ? 0.62
          : ctx.espece === "Orc"
            ? 1.06
            : 1;
  const tailleCm = Math.round((minTaille + rng.int(maxTaille - minTaille + 1)) * modEspece);
  const corpulenceE = choisirEntree(TABLE_IDS.corpulences, ctx, data, rng, warnings, tablesUtilisees, selection, regles);
  noter("poidsKg", corpulenceE);
  const facteurCorpulence = nombreMeta(corpulenceE?.meta ?? {}, "facteur", 1);
  const facteurSexe = ctx.sexe === "masculin" ? 1.05 : ctx.sexe === "feminin" ? 0.92 : 1;
  const poidsKg = Math.max(
    30,
    Math.round(22 * Math.pow(tailleCm / 100, 2) * facteurCorpulence * facteurSexe)
  );

  // La faction est choisie avant le métier et l'équipement pour que ses
  // affinités influencent réellement la fiche, pas seulement les relations.
  let faction: Faction | undefined;
  if (opts.factionId) {
    faction = data.factions?.find(
      (f) =>
        f.actif &&
        (f.id === opts.factionId || normaliser(f.nom) === normaliser(opts.factionId ?? ""))
    );
    if (!faction) warnings.push(`Faction « ${opts.factionId} » introuvable ou inactive : aucune faction liée.`);
  } else if (data.factions?.length && rng.chance(0.45)) {
    faction = rng.pick(data.factions.filter((f) => f.actif));
  }
  if (faction) ctx.tags = ajouterTags(ctx.tags, ...faction.tags, "faction");

  const professionForcee = fromMeta(TABLE_IDS.professions, opts.profession, "profession");
  if (opts.profession && !professionForcee) warnings.push(`Profession « ${opts.profession} » introuvable ou inactive.`);
  let professionE = professionForcee;
  if (!professionE) {
    professionE = choisirEntree(
      TABLE_IDS.professions,
      {
        ...ctx,
        niveauSocial: opts.niveauSocial ?? ctx.niveauSocial,
        categorieProfession: opts.categorieProfession ?? ctx.categorieProfession,
      },
      data,
      rng,
      warnings,
      tablesUtilisees,
      selection,
      regles,
      { ignorerTagsRequis: true }
    );
    noter("profession", professionE);
  }
  const profession = professionE?.valeur ?? "";
  const categorieProfession = texteMeta(professionE?.meta ?? {}, "categorie") || professionE?.categorie || "";
  const niveauSocialProfession =
    (texteMeta(professionE?.meta ?? {}, "niveauSocial") as NpcGen["niveauSocial"]) || opts.niveauSocial || "modeste";
  // Un critère explicite reste prioritaire ; sinon le métier détermine le rang.
  const niveauSocial = opts.niveauSocial || niveauSocialProfession;
  ctx.profession = profession || undefined;
  ctx.categorieProfession = categorieProfession || undefined;
  ctx.niveauSocial = niveauSocial;
  ctx.tags = ajouterTags(
    ctx.tags,
    ...tableauMeta(professionE?.meta ?? {}, "affinites"),
    categorieProfession
  );

  const importanceE = fromMeta(TABLE_IDS.importances, opts.importance, "importance");
  if (opts.importance && !importanceE) {
    warnings.push(`Importance « ${opts.importance} » introuvable ou inactive.`);
  }
  let importance = (importanceE?.valeur as NpcGen["importance"]) ?? "secondaire";
  if (!importanceE) {
    const e = choisirEntree(TABLE_IDS.importances, ctx, data, rng, warnings, tablesUtilisees, selection, regles);
    noter("importance", e);
    importance = (e?.valeur as NpcGen["importance"]) ?? "secondaire";
  }
  ctx.importance = importance;

  const niveauSocialE = fromMeta(TABLE_IDS.niveauxSociaux, niveauSocial, "niveauSocial");
  if (!niveauSocialE && !opts.niveauSocial) {
    const e = choixParmi(data.entries, TABLE_IDS.niveauxSociaux, niveauSocial);
    noter("niveauSocial", e);
  }

  const apparenceEntrees: Record<string, ReferenceEntry | undefined> = {
    carnation: choisirEntree(TABLE_IDS.carnations, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    cheveux: choisirEntree(TABLE_IDS.cheveux, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    yeux: choisirEntree(TABLE_IDS.yeux, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    visage: choisirEntree(TABLE_IDS.visages, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    particularite: choisirEntree(TABLE_IDS.particularitesPhysiques, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    signe: choisirEntree(TABLE_IDS.signesDistinctifs, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    maintien: choisirEntree(TABLE_IDS.maintien, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    hygiene: choisirEntree(TABLE_IDS.hygiene, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    demarche: choisirEntree(TABLE_IDS.demarche, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    geste: choisirEntree(TABLE_IDS.gestes, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    voix: choisirEntree(TABLE_IDS.voix, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
    vetement: choisirEntree(TABLE_IDS.vetements, ctx, data, rng, warnings, tablesUtilisees, selection, regles),
  };

  const valeur = (cle: string) => apparenceEntrees[cle]?.valeur ?? "";
  const morceauxApparence = [
    valeur("carnation"),
    valeur("cheveux"),
    valeur("yeux"),
    valeur("visage"),
    valeur("particularite"),
  ].filter(Boolean);
  const apparence = morceauxApparence.length > 0 ? `${morceauxApparence.join(", ")}.` : "";

  const identite = [
    `${nomComplet(prenom, nomFamille) || "Un PNJ sans nom"}, ${age} ans, ${ctx.espece || "espèce inconnue"}`,
    ctx.culture ? `de culture ${ctx.culture.toLowerCase()}` : "",
    profession ? `exerce comme ${profession.toLowerCase()}` : "n'a pas d'activité définie",
  ]
    .filter(Boolean)
    .join(", ");
  const description = [
    `${identite}.`,
    valeur("carnation") ? `${valeur("carnation")}.` : "",
    valeur("cheveux") ? `${valeur("cheveux")}.` : "",
    valeur("yeux") ? `${valeur("yeux")}.` : "",
    valeur("visage") ? `${valeur("visage")}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  noter("description", apparenceEntrees.carnation);
  noter("apparence", apparenceEntrees.visage);
  noter("voix", apparenceEntrees.voix);
  noter("vetements", apparenceEntrees.vetement);
  noter("gestes", apparenceEntrees.geste);
  noter("signesDistinctifs", apparenceEntrees.signe);

  const pickN = (
    tableId: string,
    nombre: number
  ) => choisirPlusieurs(tableId, nombre, ctx, data, rng, warnings, tablesUtilisees, selection, regles);
  const pick1 = (tableId: string) => choisirValeur(tableId, ctx, data, rng, warnings, tablesUtilisees, selection, regles, { ignorerTagsRequis: true });
  const pickEntry1 = (tableId: string) =>
    choisirEntree(tableId, ctx, data, rng, warnings, tablesUtilisees, selection, regles, { ignorerTagsRequis: true });

  const personnalite: NpcGen["personnalite"] = {
    traitsPositifs: pickN(TABLE_IDS.traitsPositifs, 2),
    traitsNegatifs: pickN(TABLE_IDS.traitsNegatifs, 1),
    traitsAmbivalents: pickN(TABLE_IDS.traitsAmbivalents, 1),
    qualitesMorales: pickN(TABLE_IDS.qualitesMorales, 1),
    defauts: pickN(TABLE_IDS.defauts, 1),
    peurs: pickN(TABLE_IDS.peurs, 1),
    prejuges: rng.chance(0.55) ? pickN(TABLE_IDS.prejuges, 1) : [],
    habitudes: pickN(TABLE_IDS.habitudes, 2),
    ticsVerbaux: rng.chance(0.65) ? pickN(TABLE_IDS.ticsVerbaux, 1) : [],
    expressions: rng.chance(0.7) ? pickN(TABLE_IDS.expressions, 1) : [],
    reactionsPression: pickN(TABLE_IDS.reactionsPression, 1),
    attitudeAutorite: pick1(TABLE_IDS.attitudesAutorite),
    attitudeDanger: pick1(TABLE_IDS.attitudesDanger),
    attitudeArgent: pick1(TABLE_IDS.attitudesArgent),
    attitudeMagie: pick1(TABLE_IDS.attitudesMagie),
    styleNegociation: pick1(TABLE_IDS.stylesNegociation),
    styleMensonge: pick1(TABLE_IDS.stylesMensonge),
    styleSeduction: pick1(TABLE_IDS.stylesSeduction),
    styleMenace: pick1(TABLE_IDS.stylesMenace),
  };
  noter("personnalite", pickEntry1(TABLE_IDS.traitsPositifs), "table");

  const motivations: NpcGen["motivations"] = {
    objectifImmediat: pick1(TABLE_IDS.objectifsImmediats),
    ambition: pick1(TABLE_IDS.ambitions),
    desir: pick1(TABLE_IDS.desirs),
    besoin: pick1(TABLE_IDS.besoins),
    secret: pick1(TABLE_IDS.secrets),
    mensonge: pick1(TABLE_IDS.mensonges),
    regret: pick1(TABLE_IDS.regrets),
    probleme: pick1(TABLE_IDS.problemes),
    dette: pick1(TABLE_IDS.dettes),
    objetRecherche: pick1(TABLE_IDS.objetsRecherches),
    personneProtegee: pick1(TABLE_IDS.personnesProtegees),
    personneRecherchee: pick1(TABLE_IDS.personnesRecherchees),
    conflit: pick1(TABLE_IDS.conflits),
    rumeur: pick1(TABLE_IDS.rumeurs),
    opportunite: pick1(TABLE_IDS.opportunites),
    raisonCooperation: pick1(TABLE_IDS.raisonsCooperation),
    raisonOpposition: pick1(TABLE_IDS.raisonsOpposition),
  };
  noter("motivations", pickEntry1(TABLE_IDS.secrets), "table");

  const roleplay: NpcGen["roleplay"] = {
    accroche: "",
    attitudeInitiale: pick1(TABLE_IDS.attitudesInitiales),
    raisonAttitude: pick1(TABLE_IDS.raisonsAttitude),
    premiereReaction: pick1(TABLE_IDS.premieresReactions),
    offre: pick1(TABLE_IDS.offres),
    demande: pick1(TABLE_IDS.demandes),
    levier: pick1(TABLE_IDS.leviers),
    declencheurHostilite: pick1(TABLE_IDS.declencheursHostilite),
    fuite: pick1(TABLE_IDS.fuites),
  };
  noter("roleplay", pickEntry1(TABLE_IDS.attitudesInitiales), "table");

  const detail = opts.detail ?? "standard";
  const nbEquipements = detail === "court" ? 1 : detail === "detaille" ? 3 : 2;
  const nbValeurs = detail === "court" ? 0 : rng.chance(0.65) ? (detail === "detaille" ? 2 : 1) : 0;
  const nbPersonnels = detail === "court" ? 0 : rng.chance(0.75) ? (detail === "detaille" ? 2 : 1) : 0;
  const nbSuspects =
    importance === "majeur" || importance === "important"
      ? rng.chance(0.5)
        ? 1
        : 0
      : rng.chance(0.2)
        ? 1
        : 0;
  const veutMagie = rng.chance(importance === "majeur" ? 0.2 : 0.06);
  const nbDocuments = detail === "court" ? 0 : rng.chance(0.55) ? 1 : 0;

  const equipement = pickN(TABLE_IDS.equipements, nbEquipements);
  const objetsValeurs = pickN(TABLE_IDS.objetsValeurs, nbValeurs);
  const objetsPersonnels = pickN(TABLE_IDS.objetsPersonnels, nbPersonnels);
  const objetsSuspects = pickN(TABLE_IDS.objetsSuspects, nbSuspects);
  const objetsMagiques = veutMagie ? pickN(TABLE_IDS.objetsMagiques, detail === "detaille" ? 2 : 1) : [];
  const documents = pickN(TABLE_IDS.documents, nbDocuments);
  if (objetsMagiques.length > 0) {
    warnings.push("Un objet magique a été tiré : vérifiez sa rareté et son effet avant de l'accorder.");
  }

  noter("equipement", pickEntry1(TABLE_IDS.equipements), "table");
  noter("objetsValeurs", pickEntry1(TABLE_IDS.objetsValeurs), "table");

  const lieuE = opts.lieu
    ? entreeForcee(TABLE_IDS.lieux, opts.lieu, data)
    : choisirEntree(TABLE_IDS.lieux, ctx, data, rng, warnings, tablesUtilisees, selection, regles, {
        ignorerTagsRequis: true,
      });
  if (opts.lieu && !lieuE) warnings.push(`Lieu « ${opts.lieu} » introuvable ou inactif.`);
  if (lieuE) {
    selection.set(TABLE_IDS.lieux, lieuE);
    tablesUtilisees.add(TABLE_IDS.lieux);
    noter("lieu", lieuE, opts.lieu ? "manuel" : "table");
  }

  const tags = ajouterTags(
    [...ctx.tags],
    ctx.espece,
    ctx.culture,
    profession,
    categorieProfession,
    niveauSocial,
    importance,
    faction?.nom
  );

  const nom = nomComplet(prenom, nomFamille) || "PNJ sans nom";
  const id = `npcgen-${hacher(`${seed}|${nom}|${profession}`).toString(36)}`;
  const maintenant = new Date().toISOString();

  let npc: NpcGen = {
    id,
    prenom,
    nomFamille,
    nom,
    titre: "",
    espece: ctx.espece ?? "",
    culture: ctx.culture ?? "",
    sexe: ctx.sexe ?? "masculin",
    age,
    tailleCm,
    poidsKg,
    profession,
    role: profession,
    categorieProfession,
    niveauSocial,
    importance,
    description,
    apparence,
    maintien: valeur("maintien"),
    voix: valeur("voix"),
    vetements: valeur("vetement"),
    gestes: valeur("geste"),
    signesDistinctifs: [valeur("signe"), valeur("particularite")].filter(Boolean).join(" · "),
    particularites: valeur("particularite"),
    personnalite,
    motivations,
    roleplay,
    equipement,
    objetsValeurs,
    objetsPersonnels,
    objetsSuspects,
    objetsMagiques,
    documents,
    tags,
    factionId: faction?.id ?? "",
    factionNom: faction?.nom ?? "",
    lieu: lieuE?.valeur ?? "",
    relations: [],
    notesMJ: "",
    seed,
    champs: {
      ...sources,
      nom: { verrouille: false, mode: "table" },
      age: { ...(sources.age ?? { verrouille: false, mode: "table" as const }) },
      equipement: { ...(sources.equipement ?? { verrouille: false, mode: "table" as const }) },
      objetsValeurs: { ...(sources.objetsValeurs ?? { verrouille: false, mode: "table" as const }) },
    },
    createdAt: maintenant,
    updatedAt: maintenant,
    version: 1,
  };

  const accrocheModele = pick1(TABLE_IDS.accroches);
  npc.roleplay.accroche = accrocheModele ? remettreVariables(accrocheModele, npc) : "";
  noter("roleplay.accroche", pickEntry1(TABLE_IDS.accroches), "table");
  if (!npc.roleplay.accroche) warnings.push("Aucune accroche disponible dans la table « Accroches ».");

  if (npc.motivations.personneProtegee) {
    npc.relations.push({
      id: `rel-${id}-protege`,
      nom: npc.motivations.personneProtegee,
      type: "Protège",
      intensite: 2,
      description: "Lien personnel important, exploitable comme levier.",
      publique: false,
    });
  }
  if (npc.motivations.personneRecherchee) {
    npc.relations.push({
      id: `rel-${id}-recherche`,
      nom: npc.motivations.personneRecherchee,
      type: "Recherche",
      intensite: 1,
      description: "Cette personne motive une partie de ses actions.",
      publique: true,
    });
  }
  if (faction) {
    npc.relations.push({
      id: `rel-${id}-faction`,
      nom: faction.nom,
      type: "Membre",
      intensite: 1,
      description: `Lié à ${faction.nom}.`,
      publique: true,
    });
  }

  // Les champs verrouillés reprennent leur valeur précédente, y compris pour
  // une régénération globale. Les sources restent celles de l'ancien état.
  const base = opts.base as NpcGen | undefined;
  if (base) {
    (opts.verrous ?? []).forEach((chemin) => {
      const ancienne = lireChamp(base, chemin);
      if (ancienne !== undefined) {
        npc = ecrireChamp(npc, chemin, structuredClone(ancienne));
        if (base.champs?.[chemin]) npc.champs[chemin] = { ...base.champs[chemin] };
      }
    });
    if (opts.verrous?.includes("prenom") || opts.verrous?.includes("nomFamille")) {
      npc.nom = nomComplet(npc.prenom, npc.nomFamille);
    }
  }

  const resultat: ResultatGeneration = {
    npc,
    warnings: [...new Set(warnings)],
    seed,
    tablesUtilisees: [...tablesUtilisees],
  };

  if (opts.genererCombat) {
    const palier = opts.palierPuissance ?? (importance === "majeur" ? "fort" : importance === "important" ? "moyen" : "faible");
    const statBlock = construireStatBlock(npc, palier, data, warnings);
    npc.statBlockId = statBlock.id;
    resultat.statBlock = statBlock;
    resultat.warnings = [...new Set(warnings)];
  }

  return resultat;
}

/** Entrée exacte d'une table, active ou non (utilisée par l'éditeur). */
function choixParmi(entries: ReferenceEntry[], tableId: string, valeur: string): ReferenceEntry | undefined {
  return entries.find((e) => e.tableId === tableId && normaliser(e.valeur) === normaliser(valeur));
}

/** Applique une modification manuelle et marque le champ comme édité. */
export function modifierChamp(npc: NpcGen, chemin: string, valeur: unknown): NpcGen {
  const suivant = ecrireChamp(npc, chemin, structuredClone(valeur));
  suivant.champs[chemin] = { ...(suivant.champs[chemin] ?? { verrouille: false }), mode: "manuel" };
  if (chemin === "prenom" || chemin === "nomFamille") suivant.nom = nomComplet(suivant.prenom, suivant.nomFamille);
  suivant.updatedAt = new Date().toISOString();
  return suivant;
}

export function basculerVerrou(npc: NpcGen, chemin: string): NpcGen {
  const suivant = structuredClone(npc);
  suivant.champs[chemin] = {
    ...(suivant.champs[chemin] ?? { mode: "table" }),
    verrouille: !(suivant.champs[chemin]?.verrouille ?? false),
  };
  suivant.updatedAt = new Date().toISOString();
  return suivant;
}

/**
 * Régénère un champ unique. Le reste de la fiche est conservé ; les autres
 * champs verrouillés restent intacts. La graine change pour que deux clics
 * donnent deux propositions différentes.
 */
export function regenererChamp(
  npc: NpcGen,
  chemin: string,
  data: DonneesGeneration,
  options: Partial<NpcGenerationOptions> = {}
): ResultatGeneration {
  const verrous = Object.entries(npc.champs)
    .filter(([, etat]) => etat.verrouille)
    .map(([nomChamp]) => nomChamp)
    .filter((nomChamp) => nomChamp !== chemin);
  // Le champ ciblé ne doit pas être imposé par le contexte de la fiche, sinon
  // « régénérer » renverrait toujours l'ancienne valeur. Pour le niveau social,
  // on relâche aussi le métier : il détermine sinon le rang à lui seul.
  const contextesSansChamp = new Set<string>([chemin]);
  if (chemin === "niveauSocial") contextesSansChamp.add("profession");
  // Les tags dérivés de l'ancienne valeur ne doivent pas ramener le même
  // résultat quand on demande explicitement à régénérer ce champ.
  const valeursRetirees: Record<string, string[]> = {
    espece: [npc.espece],
    culture: [npc.culture],
    profession: [npc.profession, npc.role, npc.categorieProfession],
    niveauSocial: [npc.niveauSocial],
    importance: [npc.importance],
    factionId: [npc.factionNom, "faction"],
    lieu: [npc.lieu],
  };
  const retires = new Set((valeursRetirees[chemin] ?? []).filter(Boolean).map(normaliser));
  const tagsContexte =
    chemin === "tags" ? [] : npc.tags.filter((tag) => !retires.has(normaliser(tag)));
  const contexte: NpcGenerationOptions = {
    ...options,
    // Le profil a déjà servi à créer la fiche : ses critères sont rejoués
    // explicitement ci-dessous, sauf le champ ciblé par la régénération.
    profileId: undefined,
    seed: options.seed ?? nouvelleGraine(),
    verrous,
    base: npc,
    genererCombat: false,
    tags: tagsContexte,
  };
  // Les critères du formulaire peuvent encore imposer le champ ciblé (par
  // exemple un profil qui pré-remplit « Garde »). On les retire aussi, sinon
  // le bouton ↻ renverrait systématiquement l'ancienne valeur.
  for (const champ of [
    "espece",
    "culture",
    "sexe",
    "profession",
    "niveauSocial",
    "importance",
    "factionId",
    "lieu",
  ] as const) {
    if (contextesSansChamp.has(champ)) delete contexte[champ];
  }
  if (contextesSansChamp.has("profession")) delete contexte.categorieProfession;
  if (!contextesSansChamp.has("espece")) contexte.espece = npc.espece || undefined;
  if (!contextesSansChamp.has("culture")) contexte.culture = npc.culture || undefined;
  if (!contextesSansChamp.has("sexe")) contexte.sexe = npc.sexe;
  if (!contextesSansChamp.has("profession")) contexte.profession = npc.profession || undefined;
  if (!contextesSansChamp.has("niveauSocial")) contexte.niveauSocial = npc.niveauSocial;
  if (!contextesSansChamp.has("importance")) contexte.importance = npc.importance;
  if (!contextesSansChamp.has("factionId")) contexte.factionId = npc.factionId || undefined;
  if (!contextesSansChamp.has("lieu")) contexte.lieu = npc.lieu || undefined;
  if (contextesSansChamp.has("tags")) contexte.tags = [];
  const resultat = genererPnj(contexte, data);
  const valeur = lireChamp(resultat.npc, chemin);
  if (valeur === undefined) {
    return { ...resultat, npc, warnings: [...resultat.warnings, `Champ « ${chemin} » inconnu : fiche inchangée.`] };
  }
  const suivant = ecrireChamp(npc, chemin, structuredClone(valeur));
  suivant.champs[chemin] = {
    ...(resultat.npc.champs[chemin] ?? { mode: "table" }),
    verrouille: npc.champs[chemin]?.verrouille ?? false,
  };
  if (chemin === "prenom" || chemin === "nomFamille") suivant.nom = nomComplet(suivant.prenom, suivant.nomFamille);
  suivant.updatedAt = new Date().toISOString();
  return { ...resultat, npc: suivant };
}

/** Contrôles de cohérence non bloquants, affichés dans l'éditeur. */
export function validerPnj(
  npc: NpcGen,
  tables: ReferenceTable[],
  entries: ReferenceEntry[]
): string[] {
  const problemes: string[] = [];
  if (!npc.nom.trim()) problemes.push("Le nom est vide.");
  if (!npc.profession.trim()) problemes.push("Aucune profession n'est renseignée.");
  if (npc.age < 0 || npc.age > 1000) problemes.push("L'âge semble invalide.");
  if (npc.tailleCm < 30 || npc.tailleCm > 260) problemes.push("La taille semble invalide.");
  if (npc.poidsKg < 5 || npc.poidsKg > 400) problemes.push("Le poids semble invalide.");
  for (const tableId of Object.values(TABLE_IDS)) {
    const table = tables.find((t) => t.id === tableId);
    if (!table?.actif) problemes.push(`La table « ${table?.nom ?? tableId} » est absente ou inactive.`);
  }
  if (npc.champs.personnalite?.sourceEntryId) {
    const source = entries.find((e) => e.id === npc.champs.personnalite?.sourceEntryId);
    if (source && !source.actif) problemes.push("Une entrée source de la personnalité a été désactivée.");
  }
  const listes = [
    npc.personnalite.traitsPositifs,
    npc.personnalite.traitsNegatifs,
    npc.personnalite.habitudes,
  ];
  listes.forEach((liste, i) => {
    if (new Set(liste.map(normaliser)).size !== liste.length) {
      problemes.push(`La liste de personnalité n°${i + 1} contient un doublon.`);
    }
  });
  return [...new Set(problemes)];
}

/** Résumé textuel pour impression / copie rapide. */
export function resumePnj(npc: NpcGen): string {
  return [
    `${npc.nom} — ${npc.profession || "sans profession"}`,
    `${npc.espece}, ${npc.age} ans, ${npc.sexe}`,
    npc.description,
    `Trait : ${npc.personnalite.traitsPositifs[0] ?? "—"} / ${npc.personnalite.traitsNegatifs[0] ?? "—"}`,
    `Objectif : ${npc.motivations.objectifImmediat}`,
    `Secret MJ : ${npc.motivations.secret}`,
    `Accroche : ${npc.roleplay.accroche}`,
  ]
    .filter(Boolean)
    .join("\n");
}
