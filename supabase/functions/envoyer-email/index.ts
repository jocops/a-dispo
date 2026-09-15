// ============================================================
// ENVOYER UN EMAIL TRANSACTIONNEL. Fonction de peripherie Supabase (Deno).
//
// CE QU'ELLE EST. Une porte unique : on lui donne un nom de gabarit, une
// adresse et des donnees, elle rend un email ecrit, verifie et parti. Elle ne
// decide de rien d'autre.
//
// CE QU'ELLE N'EST PAS. Elle ne choisit pas le fournisseur d'envoi (il n'est
// pas tranche au 13/09/2026, voir `fournisseurs.ts`), elle n'ecrit pas dans
// les tables metier, et elle n'est PAS appelable depuis un navigateur.
//
// POURQUOI PAS DEPUIS UN NAVIGATEUR, ET C'EST LE POINT LE PLUS IMPORTANT DE
// CE FICHIER. Les pages du site ecrivent dans la base avec la cle publique,
// qui est lisible dans leur code source. Cette cle est un jeton valide : si
// la fonction se contentait de la verification de jeton par defaut de
// Supabase, n'importe qui pourrait la lire dans `inscription/index.html` et
// s'en servir pour faire partir des emails signes a-dispo.fr. En un
// apres-midi, le domaine serait grille chez Gmail et il n'y a pas de retour
// en arriere. On exige donc un SECRET PROPRE a la fonction, l'en-tete
// `x-cle-envoi`, qui ne sort jamais d'un serveur. Tant qu'il n'est pas
// configure, la fonction refuse TOUT : jamais de porte ouverte par defaut.
//
// LES ETATS, PARCE QU'UNE FONCTION AUSSI EN A QUATRE :
//   · en marche      : 200, l'identifiant du message rendu par le fournisseur
//   · rien a faire   : 200 avec `deja_envoye`, quand la cle d'idempotence a
//                      deja servi (un declencheur de base peut tirer deux fois)
//   · erreur         : 4xx ou 5xx, TOUJOURS avec un champ `geste` qui dit ce
//                      qu'un humain doit faire pour debloquer
//   · non branche    : 503, quand il manque une piece qu'aucun code ne peut
//                      fabriquer (le fournisseur, l'adresse d'expedition)
// Aucun silence, aucun faux succes : un email perdu sans bruit ne se
// rattrape pas.
//
// CE QU'ELLE ATTEND D'AILLEURS, SANS LE CREER NI LE LIRE. Releve le
// 13/09/2026 dans les migrations des autres chantiers. Aucune de ces tables
// n'est interrogee ici : c'est l'appelant qui fournit des valeurs deja
// resolues, et c'est ce qui permet a cette fonction de ne dependre d'aucun
// schema.
//   · `public.inscriptions` (`crm/supabase/migration-inscriptions.sql`) pour
//     la colonne `jeton`, qui ne doit jamais passer par un navigateur.
//   · `public.notifications` et `public.demandes`
//     (`crm/supabase/migration-recherche-relations.sql`) pour les trois
//     gabarits de demande.
//   · `public.messages` et `public.conversations`
//     (`crm/supabase/migration-messagerie-rgpd.sql`) pour le message recu, et
//     `public.consentements` pour prouver l'accord avant tout relationnel.
//   · `public.relances_paiement` et `public.factures`
//     (`crm/supabase/migration-abonnement-pieces.sql`) pour l'echec de
//     paiement et la facture. Jamais leurs colonnes de montant.
//   · `public.emails_envoyes`, QUI N'EXISTE PAS ENCORE : le journal des envois.
//     Attendu avec les colonnes citees dans LISEZMOI.md. Tant qu'elle manque,
//     la fonction envoie quand meme et le dit dans son journal.
// ============================================================

import { GABARITS, type Contexte, type Gabarit, MOTS_INTERDITS } from "./gabarits.ts";
import {
  fournisseurEnService,
  masquer,
  type Message,
  nomDemande,
  NOMS_FOURNISSEURS,
} from "./fournisseurs.ts";

const env = (cle: string) => Deno.env.get(cle)?.trim() || "";

/** La meme regle que la contrainte `email_plausible` de la base. Ecrite deux
 *  fois volontairement : la base reste seule juge, ceci evite un aller-retour
 *  chez le fournisseur pour une adresse manifestement fausse. */
const R_EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/** Ce qui trahirait un montant d'abonnement. Le prix n'est pas arrete : aucun
 *  montant ne doit pouvoir entrer, meme par un champ mal nomme. */
const R_MONTANT = /montant|prix|tarif|euro|somme|^ht$|^ttc$/i;

/**
 * Les caracteres de controle, retour chariot et saut de ligne compris.
 *
 * MESURE DU 13/09/2026, SUR ECHANTILLON ADVERSE. Un nom d'expediteur passe
 * tel quel dans l'objet du message. Une valeur qui contient un saut de ligne
 * permet donc, chez un fournisseur qui assemble les en-tetes lui-meme,
 * d'ajouter un en-tete de son choix : un Bcc vers une adresse etrangere, par
 * exemple. On refuse la valeur a l'entree, une fois, pour les huit gabarits.
 * Nettoyer plus loin laisserait un chemin ou le nettoyage est oublie.
 */
function porteCaractereDeControle(valeur: string): boolean {
  for (let i = 0; i < valeur.length; i++) {
    const code = valeur.charCodeAt(i);
    // 0 a 31 : les caracteres de controle, dont le retour chariot (13)
    // et le saut de ligne (10). 127 : la suppression.
    if (code < 32 || code === 127) return true;
  }
  return false;
}

// ------------------------------------------------------------ les reponses

function json(corps: unknown, etat = 200): Response {
  return new Response(JSON.stringify(corps, null, 2), {
    status: etat,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Cette fonction ne se met jamais en cache : une reponse d'envoi
      // rejouee depuis un cache serait un envoi fantome.
      "cache-control": "no-store",
    },
  });
}

/** Une erreur porte TOUJOURS trois choses : un code lisible par une machine,
 *  une phrase lisible par un humain, et le geste qui debloque. `manque` s'y
 *  ajoute quand plusieurs pieces sont absentes : on les donne TOUTES d'un
 *  coup. Les livrer une par une fait recommencer le tour trois fois. */
function erreur(
  etat: number,
  code: string,
  message: string,
  geste: string,
  manque?: string[],
): Response {
  return json({ ok: false, erreur: { code, message, geste, manque } }, etat);
}

// -------------------------------------------------------------- le secret

/**
 * Comparaison a duree constante. Une comparaison ordinaire s'arrete au
 * premier caractere different, et la duree de la reponse laisse deviner le
 * secret, caractere par caractere. La difference de longueur reste
 * observable : c'est admis, elle ne donne aucun caractere.
 */
function memeSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let ecart = 0;
  for (let i = 0; i < a.length; i++) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ecart === 0;
}

function controlerAcces(req: Request): Response | null {
  const attendu = env("CLE_ENVOI");
  if (!attendu) {
    return erreur(
      503,
      "secret_absent",
      "La fonction n'a pas de secret d'appel : elle refuse tout, plutôt que de rester ouverte.",
      "Générer un secret long (par exemple `openssl rand -hex 32`) et le poser : `supabase secrets set CLE_ENVOI=...`. Voir LISEZMOI.md.",
    );
  }
  const donne = req.headers.get("x-cle-envoi") || "";
  if (!memeSecret(donne, attendu)) {
    return erreur(
      401,
      "secret_refuse",
      "En-tête x-cle-envoi absent ou faux.",
      "Appeler la fonction depuis un serveur, avec l'en-tête x-cle-envoi. Cette fonction n'est pas appelable depuis un navigateur : la clé publique du site ne l'ouvre pas.",
    );
  }
  return null;
}

// ------------------------------------------------------- les adresses sures

/**
 * Les hotes autorises dans les liens.
 *
 * POURQUOI CE CONTROLE EXISTE. Sans lui, qui obtient le secret d'appel peut
 * faire partir, depuis notre domaine, un email parfaitement credible qui
 * pointe vers son propre site. C'est le mecanisme exact d'une campagne
 * d'hameconnage, avec notre reputation en prime. On n'accepte donc que le
 * domaine du site, plus ceux qui ont ete declares explicitement (le
 * prestataire de paiement, pour une facture).
 */
function hotesAutorises(): Set<string> {
  const hotes = new Set<string>();
  try {
    hotes.add(new URL(env("URL_SITE") || "https://a-dispo.fr").hostname);
  } catch {
    hotes.add("a-dispo.fr");
  }
  for (const h of env("HOTES_LIENS").split(",")) {
    const n = h.trim().toLowerCase();
    if (n) hotes.add(n);
  }
  return hotes;
}

function adresseSure(valeur: string, hotes: Set<string>): string | null {
  let u: URL;
  try {
    u = new URL(valeur);
  } catch {
    return "ce n'est pas une adresse valide";
  }
  if (u.protocol !== "https:") return "l'adresse doit être en https";
  if (!hotes.has(u.hostname)) {
    return `l'hôte ${u.hostname} n'est pas déclaré`;
  }
  return null;
}

// ------------------------------------------------------------ la validation

interface Demande {
  gabarit: Gabarit;
  destinataire: string;
  donnees: Record<string, string>;
  cleIdempotence?: string;
}

function valider(brut: Record<string, unknown>): Demande | Response {
  const nom = String(brut.gabarit ?? "");
  const gabarit = GABARITS[nom];
  if (!gabarit) {
    return erreur(
      422,
      "gabarit_inconnu",
      `Gabarit « ${nom} » inconnu.`,
      "Utiliser l'un des huit : " + Object.keys(GABARITS).join(", "),
    );
  }

  // L'adresse du destinataire passe elle aussi par le controle des caracteres
  // de controle : l'expression reguliere ci-dessus refuse les espaces, pas les
  // octets nuls, et cette adresse finit dans un en-tete.
  const destinataire = String(brut.destinataire ?? "").trim();
  if (!R_EMAIL.test(destinataire) || porteCaractereDeControle(destinataire)) {
    return erreur(422, "destinataire_invalide", "L'adresse du destinataire n'est pas valide.", "Vérifier l'adresse passée par l'appelant.");
  }

  const entrees = (brut.donnees ?? {}) as Record<string, unknown>;
  if (typeof entrees !== "object" || entrees === null || Array.isArray(entrees)) {
    return erreur(422, "donnees_invalides", "`donnees` doit être un objet.", "Corriger l'appel.");
  }

  const connus = new Set(gabarit.champs.map((c) => c.nom));
  const donnees: Record<string, string> = {};
  const hotes = hotesAutorises();

  for (const [cle, valeur] of Object.entries(entrees)) {
    // LE PRIX N'EST PAS ARRETE. Un champ qui ressemble a un montant est
    // refuse avant tout le reste, et on dit pourquoi : c'est une decision du
    // projet, pas un bogue d'appel.
    if (R_MONTANT.test(cle)) {
      return erreur(
        422,
        "montant_refuse",
        `Le champ « ${cle} » ressemble à un montant. Aucun montant d'abonnement ne part dans un email.`,
        "Le prix n'est pas arrêté. Le montant d'une facture vit dans la facture, pas dans l'email qui l'annonce.",
      );
    }
    if (!connus.has(cle)) {
      return erreur(
        422,
        "champ_inconnu",
        `Le gabarit « ${gabarit.id} » n'attend pas de champ « ${cle} ».`,
        "Champs attendus : " + gabarit.champs.map((c) => c.nom).join(", "),
      );
    }
    if (valeur === null || valeur === undefined || valeur === "") continue;
    if (typeof valeur !== "string") {
      return erreur(422, "champ_invalide", `Le champ « ${cle} » doit être du texte.`, "Convertir la valeur côté appelant.");
    }
    const propre = valeur.trim();
    if (porteCaractereDeControle(propre)) {
      return erreur(
        422,
        "champ_controle",
        `Le champ « ${cle} » contient un saut de ligne ou un caractère de contrôle.`,
        "Refusé volontairement : une valeur de ce genre se retrouve dans l'objet du message et permet d'y greffer un en-tête. Nettoyer la donnée à la source.",
      );
    }
    donnees[cle] = propre;
  }

  for (const champ of gabarit.champs) {
    const v = donnees[champ.nom];
    if (!v) {
      if (champ.obligatoire) {
        return erreur(
          422,
          "champ_manquant",
          `Le champ « ${champ.nom} » est obligatoire pour « ${gabarit.id} » : ${champ.role}`,
          "Sans lui, l'email partirait incomplet ou avec un bouton mort. L'appelant doit le fournir.",
        );
      }
      continue;
    }
    if (v.length > champ.max) {
      return erreur(
        422,
        "champ_trop_long",
        `Le champ « ${champ.nom} » dépasse ${champ.max} caractères (${v.length}).`,
        "Raccourcir côté appelant. On préfère refuser que tronquer au milieu d'un mot.",
      );
    }
    if (champ.genre === "url") {
      const souci = adresseSure(v, hotes);
      if (souci) {
        return erreur(
          422,
          "adresse_refusee",
          `Le champ « ${champ.nom} » est refusé : ${souci}.`,
          "Un email ne part que vers des adresses de notre domaine. Pour un hôte légitime de plus (le prestataire de paiement, par exemple), l'ajouter à la variable HOTES_LIENS.",
        );
      }
    }
  }

  const cleIdempotence = brut.cle_idempotence ? String(brut.cle_idempotence).slice(0, 120) : undefined;
  return { gabarit, destinataire, donnees, cleIdempotence };
}

// --------------------------------------------------------- l'idempotence

/**
 * Ce qui a deja ete envoye, pendant dix minutes.
 *
 * CE QUE CA COUVRE, ET CE QUE CA NE COUVRE PAS. Un declencheur de base qui
 * tire deux fois en quelques secondes est arrete ici. Une reprise apres le
 * reveil d'une nouvelle instance ne l'est PAS : cette memoire vit dans
 * l'instance, et une fonction de peripherie est arretee des qu'elle ne sert
 * plus. La seule protection solide serait une contrainte d'unicite dans la
 * base, sur `public.emails_envoyes` (voir le LISEZMOI, `cle_idempotence`
 * unique). C'est dit plutot que fait croire.
 */
const DEJA = new Map<string, number>();
const TTL_MS = 10 * 60 * 1000;

function dejaEnvoye(cle: string): boolean {
  const t = DEJA.get(cle);
  if (t && Date.now() - t < TTL_MS) return true;
  return false;
}
function noterEnvoi(cle: string): void {
  DEJA.set(cle, Date.now());
  if (DEJA.size > 500) {
    for (const [k, t] of DEJA) if (Date.now() - t > TTL_MS) DEJA.delete(k);
  }
}

// ------------------------------------------------------------ le journal

/**
 * Le journal des envois, dans la base, SI la table existe.
 *
 * Elle n'est pas creee ici : les migrations sont le terrain d'un autre
 * chantier. Tant qu'elle manque, l'erreur PGRST205 est reconnue et l'envoi
 * n'est pas compte comme rate. Perdre une ligne de journal ne justifie pas de
 * perdre un email.
 */
async function journaliser(ligne: Record<string, unknown>): Promise<void> {
  const base = env("SUPABASE_URL");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (env("JOURNAL_BASE") !== "1" || !base || !service) return;
  try {
    const r = await fetch(base + "/rest/v1/emails_envoyes", {
      method: "POST",
      headers: {
        apikey: service,
        Authorization: "Bearer " + service,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(ligne),
    });
    if (!r.ok) {
      const detail = await r.text();
      if (detail.includes("PGRST205")) {
        console.log("journal : la table public.emails_envoyes n'existe pas encore, envoi non journalise");
      } else {
        console.log("journal : refus de la base, " + detail.slice(0, 300));
      }
    }
  } catch (e) {
    console.log("journal : injoignable, " + (e instanceof Error ? e.message : String(e)));
  }
}

// ------------------------------------------------------------- les en-tetes

function entetes(gabarit: Gabarit, donnees: Record<string, string>): Record<string, string> {
  const e: Record<string, string> = {
    // Empeche les reponses automatiques d'absence de repartir en boucle.
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "OOF, AutoReply",
  };
  const url = donnees.url_desabonnement;
  if (url) {
    e["List-Unsubscribe"] = `<${url}>`;
    // LE CLIC UNIQUE N'EST ANNONCE QUE S'IL EXISTE VRAIMENT. L'annoncer
    // oblige la page a accepter un POST (RFC 8058) ; l'annoncer sans l'avoir
    // ecrit fait echouer les desabonnements de Gmail en silence, ce qui est
    // pire que pas de bouton du tout.
    if (env("DESABO_UN_CLIC") === "1") {
      e["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
  }
  return e;
}

// ----------------------------------------------------------------- l'envoi

async function envoyer(demande: Demande): Promise<Response> {
  const { gabarit, destinataire, donnees, cleIdempotence } = demande;

  // TOUT CE QUI MANQUE, D'UN SEUL COUP.
  // Mesure du 13/09/2026 : en rendant la premiere piece absente et en
  // s'arretant la, on obligeait a trois allers-retours pour decouvrir trois
  // manques. On les liste donc tous, dans l'ordre ou un humain les traite.
  const fournisseur = fournisseurEnService();
  const mentions = env("MENTIONS_LEGALES");
  const expediteurEmail = env("EXPEDITEUR_EMAIL");
  const manquantes: string[] = [];

  for (const m of fournisseur.manque()) {
    manquantes.push(
      `Service d'envoi : ${m}. Noms acceptés pour FOURNISSEUR_EMAIL : ${NOMS_FOURNISSEURS.join(", ")}.`,
    );
  }
  if (!expediteurEmail || !R_EMAIL.test(expediteurEmail)) {
    manquantes.push(
      "EXPEDITEUR_EMAIL : l'adresse d'expédition. [A COMPLETER : adresse d'envoi, par exemple bonjour@a-dispo.fr, à créer chez OVH]",
    );
  }
  if (gabarit.categorie === "relationnel" && !mentions) {
    manquantes.push(
      "MENTIONS_LEGALES : l'identité de l'expéditeur, obligatoire dans un message qui n'est pas transactionnel. [A COMPLETER : raison sociale, forme juridique, adresse postale]",
    );
  }
  if (manquantes.length) {
    return erreur(
      503,
      "non_branche",
      `Le message n'est pas parti : ${manquantes.length} pièce${manquantes.length > 1 ? "s" : ""} manque${manquantes.length > 1 ? "nt" : ""}, et aucune ne peut être fabriquée par du code.`,
      "Poser ces valeurs dans les secrets du projet Supabase (`supabase secrets set ...`), puis rappeler. Les gestes sont détaillés dans LISEZMOI.md et DNS.md.",
      manquantes,
    );
  }

  // Garde-fou pour un neuvieme gabarit qui serait declare relationnel sans
  // declarer son champ de desinscription : les huit d'aujourd'hui le
  // declarent obligatoire, et la validation les arrete plus tot.
  if (gabarit.categorie === "relationnel" && !donnees.url_desabonnement) {
    return erreur(
      422,
      "desabonnement_absent",
      "Un message relationnel ne part jamais sans lien de désinscription.",
      "L'appelant doit fournir url_desabonnement.",
    );
  }

  const cle = cleIdempotence ? `${gabarit.id}|${destinataire}|${cleIdempotence}` : "";
  if (cle && dejaEnvoye(cle)) {
    return json({ ok: true, deja_envoye: true, gabarit: gabarit.id });
  }

  const contexte: Contexte = { mentions: mentions || undefined };
  const rendu = gabarit.rendre(donnees, contexte);

  const message: Message = {
    expediteurEmail,
    expediteurNom: env("EXPEDITEUR_NOM") || "À dispo",
    repondreA: env("REPONDRE_A") || undefined,
    destinataire,
    sujet: rendu.sujet,
    html: rendu.html,
    texte: rendu.texte,
    entetes: entetes(gabarit, donnees),
  };

  const resultat = await fournisseur.envoyer(message);

  await journaliser({
    gabarit: gabarit.id,
    destinataire_masque: masquer(destinataire),
    fournisseur: resultat.fournisseur,
    reussi: resultat.ok,
    identifiant: resultat.ok ? resultat.identifiant ?? null : null,
    erreur: resultat.ok ? null : resultat.message.slice(0, 500),
    cle_idempotence: cleIdempotence ?? null,
  });

  if (!resultat.ok) {
    console.log(
      `envoi refuse : gabarit=${gabarit.id} fournisseur=${resultat.fournisseur} etat=${resultat.etat} vers=${masquer(destinataire)}`,
    );
    return erreur(502, "fournisseur_refuse", resultat.message, resultat.geste);
  }

  if (cle) noterEnvoi(cle);
  console.log(`envoi ok : gabarit=${gabarit.id} fournisseur=${resultat.fournisseur} vers=${masquer(destinataire)}`);
  return json({
    ok: true,
    gabarit: gabarit.id,
    fournisseur: resultat.fournisseur,
    identifiant: resultat.identifiant ?? null,
  });
}

// ---------------------------------------------------------------- controle

/**
 * LE CONTROLE : rendre les huit gabarits, sans rien envoyer, et MESURER.
 *
 * POURQUOI IL EST DANS LA FONCTION ET NON DANS UN SCRIPT A COTE. Un controle
 * qui vit ailleurs teste un autre code que celui qui tourne. Celui-ci
 * traverse exactement le chemin d'un envoi reel, arrete juste avant le
 * fournisseur.
 *
 * Ce qu'il mesure, par gabarit : l'objet et sa longueur, le poids du HTML et
 * du texte, les mots que le droit nous interdit, les marqueurs [A COMPLETER]
 * restes dans le rendu, et la presence d'un montant.
 */
function controler(): Response {
  const contexte: Contexte = { mentions: env("MENTIONS_LEGALES") || undefined };
  const rapport = Object.values(GABARITS).map((g) => {
    const rendu = g.rendre(g.exemple, contexte);
    const tout = (rendu.sujet + " " + rendu.texte).toLowerCase();
    return {
      gabarit: g.id,
      categorie: g.categorie,
      objet: rendu.sujet,
      caracteres_objet: rendu.sujet.length,
      octets_html: rendu.html.length,
      octets_texte: rendu.texte.length,
      lien_desabonnement: rendu.texte.includes("Me désinscrire"),
      mots_interdits: MOTS_INTERDITS.filter((m) => tout.includes(m.toLowerCase())),
      marqueurs_a_completer: (rendu.texte.match(/\[A COMPLETER[^\]]*\]/g) || []).length,
      montant_detecte: /\d[\d\s.,]*\s?(€|euros?)/i.test(rendu.texte),
    };
  });

  const fournisseur = fournisseurEnService();
  return json({
    ok: true,
    mesure_le: new Date().toISOString(),
    configuration: {
      fournisseur_demande: nomDemande(),
      fournisseur_en_service: fournisseur.nom,
      manque: fournisseur.manque(),
      expediteur: env("EXPEDITEUR_EMAIL") || "[A COMPLETER : adresse d'expédition]",
      repondre_a: env("REPONDRE_A") || "[A COMPLETER : adresse de réponse surveillée]",
      mentions_legales: env("MENTIONS_LEGALES") || "[A COMPLETER : raison sociale, forme juridique, adresse postale]",
      hotes_de_liens: [...hotesAutorises()],
      desabonnement_un_clic: env("DESABO_UN_CLIC") === "1",
      journal_en_base: env("JOURNAL_BASE") === "1",
    },
    gabarits: rapport,
  });
}

/** L'apercu d'un gabarit, en HTML, pour le regarder dans un navigateur.
 *  Rien n'est envoye. Le secret est exige : un apercu ouvert dirait a qui
 *  veut ce que la maison ecrit a ses inscrits. */
function apercu(id: string): Response {
  const g = GABARITS[id];
  if (!g) {
    return erreur(404, "gabarit_inconnu", `Gabarit « ${id} » inconnu.`, "Les huit : " + Object.keys(GABARITS).join(", "));
  }
  const rendu = g.rendre(g.exemple, { mentions: env("MENTIONS_LEGALES") || undefined });
  return new Response(rendu.html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// ------------------------------------------------------------------ la porte

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Pas de CORS, et c'est voulu : cette fonction ne se parle qu'entre
  // serveurs. Une reponse de pre-verification ouvrirait la porte au
  // navigateur, donc a la cle publique du site.
  if (req.method === "OPTIONS") {
    return erreur(
      405,
      "navigateur_refuse",
      "Cette fonction ne s'appelle pas depuis un navigateur.",
      "L'appeler depuis un serveur (déclencheur de base, fonction serveur) avec l'en-tête x-cle-envoi.",
    );
  }

  const refus = controlerAcces(req);
  if (refus) return refus;

  if (req.method === "GET") {
    if (url.searchParams.get("controle") === "1") return controler();
    const vu = url.searchParams.get("apercu");
    if (vu) return apercu(vu);
    return erreur(
      400,
      "usage",
      "GET sert au contrôle et à l'aperçu, pas à l'envoi.",
      "?controle=1 pour le rapport mesuré, ?apercu=<gabarit> pour voir un email, POST pour envoyer.",
    );
  }

  if (req.method !== "POST") {
    return erreur(405, "methode", `Méthode ${req.method} non prévue.`, "POST pour envoyer, GET pour contrôler.");
  }

  let brut: Record<string, unknown>;
  try {
    brut = await req.json();
  } catch {
    return erreur(400, "corps_illisible", "Le corps de la requête n'est pas du JSON.", "Envoyer un JSON avec gabarit, destinataire et donnees.");
  }

  const demande = valider(brut);
  if (demande instanceof Response) return demande;

  try {
    return await envoyer(demande);
  } catch (e) {
    // Le dernier filet. Une exception non prevue ne doit pas rendre une page
    // blanche au serveur qui appelle : elle rend un objet lisible, comme le
    // reste, et le detail part dans le journal.
    console.log("exception : " + (e instanceof Error ? e.stack || e.message : String(e)));
    return erreur(
      500,
      "imprevu",
      "Le message n'est pas parti : erreur inattendue dans la fonction.",
      "Lire le journal de la fonction dans Supabase (Edge Functions, onglet Logs), ligne « exception ».",
    );
  }
});
