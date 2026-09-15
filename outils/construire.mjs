// Enveloppe les ecrans et ecrit le dossier servi.
//
// POURQUOI UNE ENVELOPPE. Les fichiers de app/ sont des FRAGMENTS : ils portent
// leur style et leur corps, pas leur en-tete. L'en-tete est commun aux douze
// ecrans (jeu de caracteres, cadrage mobile, favicon, refus d'indexation), et
// le repeter douze fois garantit qu'il divergera. Il vit donc ici, une fois.
//
// POURQUOI EN NODE ET NON EN PYTHON. Cloudflare reconstruit le site a chaque
// push. Node est present dans son environnement de construction, Python ne l'est
// pas de facon garantie. Une chaine qui ne se construit que sur ma machine n'est
// pas une chaine.
//
// NON DESTRUCTIF : ne lit que app/, n'ecrit que dist/. Les sources ne bougent pas.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(RACINE, "app");
const SORTIE = join(RACINE, "dist");

// L'adresse de chaque ecran, et le titre de son onglet.
// TANT QUE LA MARQUE N'EST PAS DEPOSEE A L'INPI, aucun titre ne la nomme :
// l'etude de marche a releve qu'un service de surveillance veille sur le nom
// voisin « adispo ».
const ECRANS = [
  { dossier: "accueil",     url: "/",             titre: "Accueil" },
  { dossier: "connexion",   url: "/connexion",    titre: "Connexion" },
  { dossier: "inscription", url: "/inscription",  titre: "Liste d'attente" },
  { dossier: "espace",      url: "/espace",       titre: "Ton espace" },
  { dossier: "recherche",   url: "/recherche",    titre: "Chercher" },
  { dossier: "artisan",     url: "/artisan",      titre: "Fiche" },
  { dossier: "demandes",    url: "/demandes",     titre: "Tes demandes" },
  { dossier: "messages",    url: "/messages",     titre: "Tes messages" },
  { dossier: "mes-donnees", url: "/mes-donnees",  titre: "Tes donnees" },
  { dossier: "admin",       url: "/admin",        titre: "Administration" },
  { dossier: "aide",        url: "/aide",         titre: "Aide" },
  { dossier: "legal",       url: "/legal",        titre: "Mentions legales" },
];

const enveloppe = (titre, corps) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icone-app.svg">
<meta name="theme-color" content="#F8F4EC">
<title>${titre}</title>
</head>
<body>
${corps}
</body>
</html>
`;

if (existsSync(SORTIE)) rmSync(SORTIE, { recursive: true });
mkdirSync(SORTIE, { recursive: true });

let n = 0, poids = 0;
for (const e of ECRANS) {
  const src = join(SOURCE, e.dossier, "index.html");
  if (!existsSync(src)) { console.log(`  ABSENT, ignore : ${e.dossier}`); continue; }
  // Le <title> de la source sert quand on ouvre le fragment seul ; dans le
  // document complet il vit dans <head>, et il n'y en a qu'un.
  const corps = readFileSync(src, "utf8").replace(/<title>[\s\S]*?<\/title>\s*/, "").trim();
  const doc = enveloppe(e.titre, corps);
  const dest = e.url === "/" ? SORTIE : join(SORTIE, e.url.slice(1));
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, "index.html"), doc);
  n++; poids += doc.length;
  console.log(`  ${e.url.padEnd(14)} ${(doc.length / 1024).toFixed(1).padStart(6)} Ko`);
}

// Les images et les fichiers servis tels quels.
for (const [de, vers] of [["app/assets", "assets"], ["app/public", ""]]) {
  const s = join(RACINE, de);
  if (existsSync(s)) cpSync(s, vers ? join(SORTIE, vers) : SORTIE, { recursive: true });
}

// LE CRM, assemble ici aussi, pour qu'une seule commande construise tout.
// Il vit en quatre fichiers dans crm/src/ et se sert en un seul : le gabarit
// porte quatre reperes ou viennent s'inserer le style, la configuration, les
// donnees et l'application.
//
// AUCUNE DONNEE PERSONNELLE n'entre ici. Les 1 374 fiches sont lues dans
// Supabase apres connexion, jamais posees dans un fichier public. C'est ce qui
// permet au depot d'etre construit par Cloudflare sans exposer personne.
const crmSrc = join(RACINE, "crm", "src");
if (existsSync(join(crmSrc, "index.html"))) {
  const lire = (f) => readFileSync(join(crmSrc, f), "utf8");
  const vide = "/* Aucune donnee personnelle dans ce fichier : les fiches sont lues\n"
             + "   dans Supabase apres connexion. Voir outils/construire.mjs. */\n"
             + "window.CRM_CONTACTS = [];";
  const crm = lire("index.html")
    .replace("/*__STYLES__*/", () => lire("styles.css"))
    .replace("/*__CONFIG__*/", () => lire("config.js"))
    .replace("/*__DATA__*/",   () => vide)
    .replace("/*__APP__*/",    () => lire("app.js"))
    .replace("<title>", "<!-- Assemble par outils/construire.mjs. NE PAS EDITER A LA MAIN :\n"
                      + "     modifier crm/src/ puis reconstruire. -->\n<title>");
  mkdirSync(join(SORTIE, "crm"), { recursive: true });
  writeFileSync(join(SORTIE, "crm", "index.html"), crm);
  console.log(`  /crm           ${(crm.length / 1024).toFixed(1).padStart(6)} Ko  (aucune donnee personnelle)`);
}

console.log(`\n${n} ecran(s), ${(poids / 1024).toFixed(0)} Ko. Sources intactes.`);
