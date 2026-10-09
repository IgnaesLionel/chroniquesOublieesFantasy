import type { Scenario } from "@/src/lib/rules/scenario/types";

// Scénario d'exemple (NON officiel). Démontre SI/SINON : clé, indice, chef mort.
export const SEED_SCENARIOS: Scenario[] = [
  {
    id: "scn-val-brumeux",
    titre: "Les gobelins du Val Brumeux (exemple)",
    description: "Scénario de démonstration : arrivée au village, 3 pistes + conditions.",
    chapitres: [{ id: "ch1", titre: "Chapitre 1", sceneDepartId: "s1" }],
    exemple: true,
    scenes: [
      {
        id: "s1", titre: "Scène 1 — Arrivée au village",
        texteMJ: "Le village est silencieux. Des traces de petits pieds boueux mènent vers la forêt. Le tavernier vous fait signe.",
        notesMJ: "Flags MJ : cle (porte secrète), indice (dialogue spécial), chef_mort (antre).",
        choix: [
          { id: "c1a", label: "A — Interroger le tavernier", versSceneId: "s2a" },
          { id: "c1b", label: "B — Aller directement à la forêt", versSceneId: "s2b" },
          { id: "c1c", label: "C — Examiner les traces", versSceneId: "s2c" },
          { id: "c1d", label: "D — Passage secret (clé requise)", versSceneId: "s3", condition: { type: "flag", flag: "cle", op: "estVrai" } },
        ],
      },
      {
        id: "s2a", titre: "Scène 2A — Le tavernier",
        texteMJ: "Le tavernier chuchote : « Les gobelins ont pris la route de la forêt... leur chef porte un cimeterre rouillé. »",
        pnjIds: ["npc-tobin", "npc-mira"],
        itemIds: ["item-cle"],
        choix: [
          { id: "c2a", label: "Rejoindre la forêt", versSceneId: "s2b" },
          { id: "c2a2", label: "Évoquer l'indice X (dialogue spécial)", versSceneId: "s3", condition: { type: "flag", flag: "indice", op: "estVrai" } },
        ],
      },
      {
        id: "s2b", titre: "Scène 2B — La forêt",
        texteMJ: "Des grognements entre les arbres. Une embuscade gobeline se prépare ! (Prévoir rencontre : Gobelin ×3)",
        itemIds: ["item-potion", "item-torche"],
        choix: [
          { id: "c2b", label: "Retourner au village", versSceneId: "s1" },
          { id: "c2b2", label: "Fouiller l'antre (chef mort)", versSceneId: "s3", condition: { type: "flag", flag: "chef_mort", op: "estVrai" } },
        ],
      },
      {
        id: "s2c", titre: "Scène 2C — Les traces",
        texteMJ: "Test de pistage. Les traces confirment : 4 gobelins + 1 chef.",
        pnjIds: ["npc-ermite"],
        choix: [
          { id: "c2c1", label: "Suivre les traces vers la forêt", versSceneId: "s2b" },
          { id: "c2c2", label: "Retourner interroger le tavernier", versSceneId: "s2a" },
        ],
      },
      {
        id: "s3", titre: "Scène 3 — Salle secrète / Dénouement",
        texteMJ: "Branche conditionnelle atteinte (clé, indice ou chef mort). Récompense : trésor des gobelins.",
        itemIds: ["item-tresor"],
        choix: [{ id: "c3", label: "Retourner au village (fin)", versSceneId: "s1" }],
      },
    ],
  },
];
