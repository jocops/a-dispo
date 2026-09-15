/* ===================================================================
   CRM À dispo : configuration
   Ce bloc est inliné dans index.html au build (outils/construire.py).
   Pour brancher la base partagée, remplir supabase.url et supabase.anonKey
   puis relancer le build. Vide = mode local (données dans le navigateur).
=================================================================== */
window.CRM_CONFIG = {
  version: 1,
  nomProjet: "À dispo",
  /* Base en ligne Supabase : données + comptes utilisateurs. OBLIGATOIRE en production.
     Vide = mode test (données dans le navigateur, prénom libre), uniquement pour ouvrir le fichier en local. */
  supabase: {
    url: "https://ucnyvsocoxenxbuakluo.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbnl2c29jb3hlbnhidWFrbHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjIyMDAsImV4cCI6MjEwMzk5ODIwMH0.IHTUOXDj69OdIbLOmxXk7dTBiUIZJHoshPaVGd6O3JY",  /* clé "anon public" du projet (publique par nature, la protection vient des comptes + RLS) */
    table: "contacts",
    pollMs: 20000     /* rafraîchissement des modifications faites depuis un autre appareil */
  },
  /* Code d'accès supplémentaire à l'ouverture. Inutile quand Supabase est branché (la connexion par compte suffit). */
  codeAcces: "",
  /* Prénoms proposés en mode test seulement. En ligne, les prénoms viennent des comptes (table profils). */
  utilisateurs: ["Claire-Marie"],
  /* Clé de stockage navigateur (mode local et préférences). */
  cleStockage: "adispo-crm.v1",
  /* Pipeline de recrutement des artisans. type : entree | actif | gagne | perdu
     Couleurs posees pour le fond clair (#F2F1EE) et MESUREES : chaque teinte de
     texte tient au moins 4,5:1 sur son propre aplat, l'aplat etant lui-meme pose
     sur le sol de la page. Releve du 3 septembre 2026, dans l'ordre ci-dessous :
     5,47 / 5,76 / 4,75 / 4,57 / 4,89 / 4,93 / 4,65. Toutes AA.
     Les trois teintes de caractere reprennent les chartes candidates : le bleu de
     travail pour l'echange amorce, la terre cuite pour l'interet, le laiton pour
     la discussion en cours. */
  statuts: [
    { key: "a_contacter", label: "À contacter",       type: "entree", fond: "rgba(86,88,96,.09)",    texte: "#565860", bord: "rgba(86,88,96,.20)" },
    { key: "contacte",    label: "Contacté",          type: "actif",  fond: "rgba(37,83,154,.10)",   texte: "#25539A", bord: "rgba(37,83,154,.24)" },
    { key: "echange",     label: "Échange en cours",  type: "actif",  fond: "rgba(124,90,14,.12)",   texte: "#7C5A0E", bord: "rgba(124,90,14,.26)" },
    { key: "interesse",   label: "Intéressé",         type: "actif",  fond: "rgba(168,69,44,.10)",   texte: "#A8452C", bord: "rgba(168,69,44,.26)" },
    { key: "inscrit",     label: "Inscrit",           type: "gagne",  fond: "rgba(15,107,65,.12)",   texte: "#0F6B41", bord: "rgba(15,107,65,.26)" },
    { key: "refus",       label: "Pas intéressé",     type: "perdu",  fond: "rgba(179,39,30,.10)",   texte: "#B3271E", bord: "rgba(179,39,30,.24)" },
    { key: "injoignable", label: "Injoignable",       type: "perdu",  fond: "rgba(99,99,106,.10)",   texte: "#63636A", bord: "rgba(99,99,106,.22)" }
  ],
  metiers: ["Menuisier", "Fermetures", "Portails et automatismes", "Serrurier métallier", "Électricien", "Plombier", "Chauffagiste", "Couvreur", "Charpentier", "Maçon", "Peintre", "Plaquiste", "Carreleur", "Paysagiste", "Isolation", "Autre"],
  /* Les trois modes de la maquette. */
  modes: [
    { key: "dispo",   label: "Je suis dispo",       icone: "☺" },
    { key: "cherche", label: "Je cherche des gens", icone: "?" },
    { key: "deux",    label: "Les deux",            icone: "⇄" }
  ],
  /* Les formules SANS MONTANT, et ce n'est pas un oubli. Le prix n'est pas
     arrete : la base elle-meme laisse `artisans.formule` en texte libre pour
     cette raison (migration-espace-artisan.sql), et le rendez-vous n°2 a
     rejete la grille mensuelle. Les trois libelles portaient encore un tarif
     mensuel : c'etait faire annoncer a Claire-Marie un prix qui n'existe pas,
     au telephone et dans les exports CSV. Les cles ne bougent pas : le travail
     deja saisi garde son sens, seul le libelle change. */
  formules: [
    { key: "dispo",   label: "Je suis dispo" },
    { key: "deux",    label: "Les deux" },
    { key: "cherche", label: "Je cherche des gens" }
  ],
  typesHistorique: [
    { key: "appel", label: "Appel", icone: "☎" },
    { key: "mail",  label: "E-mail", icone: "✉" },
    { key: "sms",   label: "SMS", icone: "💬" },
    { key: "rdv",   label: "Rendez-vous", icone: "📅" },
    { key: "note",  label: "Note", icone: "✎" },
    { key: "statut", label: "Statut", icone: "→" }
  ],
  sourceBase: "Pipedrive My Motor, extraction du 09/2026"
};
