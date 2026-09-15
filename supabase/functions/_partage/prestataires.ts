// ============================================================
// LE PRESTATAIRE DE PAIEMENT : UNE INTERFACE, ET DES BRANCHEMENTS DERRIERE.
//
// POURQUOI CE FICHIER EXISTE. Le prestataire de paiement N'EST PAS CHOISI au
// 13/09/2026 : le conseiller bancaire doit faire une proposition, a comparer
// au standard du marche. Ecrire ses appels en dur dans les deux fonctions
// obligerait a les reecrire le jour du choix. Ici, le reste du code ne
// connait QUE `ouvrirSession()` et `lire()`.
//
// C'EST AUSSI CE QUE LA BASE A DECIDE. `migration-abonnement-pieces.sql`
// ecrit, au-dessus de `appliquer_abonnement()` : « La correspondance entre le
// vocabulaire d'un prestataire et nos six etats depend du prestataire, et
// AUCUN prestataire n'est choisi a ce jour. L'ecrire maintenant reviendrait a
// inventer. [...] La traduction se fera dans la fonction serveur du
// prestataire retenu. » Ce fichier EST cet endroit.
//
// LE MONTANT N'EST JAMAIS COMPOSE ICI, ET C'EST LE POINT CENTRAL.
// Une session de paiement s'ouvre en citant une REFERENCE D'OFFRE creee chez
// le prestataire (`REFERENCE_OFFRE`), jamais un nombre. Le prix vit chez le
// prestataire, il est modifie chez lui, et notre code ne l'apprend jamais.
// C'est la seule facon de tenir la regle du chantier (« aucun montant nulle
// part ») tout en ayant un paiement qui marche le jour ou le prix est arrete.
// Le seul montant qui entre dans notre base est celui d'un paiement DEJA
// ENCAISSE, lu dans le message du prestataire : il est constate, pas decide.
//
// LE MODE PAR DEFAUT EST « aucun », ET IL REFUSE. Il ne fait pas semblant, ne
// rend pas de fausse adresse de paiement et ne perd rien en silence : il
// repond 503 avec ce qu'il faut faire. Meme doctrine que `fournisseurs.ts`
// pour l'envoi des courriels, et que les quatre cartes d'agenda eteintes de
// `espace/index.html`.
// ============================================================

import { entierParChemin, env, parChemin, texteParChemin } from "./reponses.ts";

/** Les six etats d'abonnement, tels que `public.abonnement_etats` les seme.
 *  Cette liste est recopiee de la base et doit le rester : une valeur hors
 *  de cette liste fait echouer la contrainte, et c'est tant mieux. */
export const ETATS = ["essai", "actif", "impaye", "suspendu", "resilie", "expire"] as const;
export type Etat = (typeof ETATS)[number];

export function etatConnu(valeur: string): valeur is Etat {
  return (ETATS as readonly string[]).includes(valeur);
}

/** Ce qu'on demande au prestataire quand un artisan veut s'abonner. Aucun
 *  montant : une reference d'offre, un compte, et par ou revenir. */
export interface DemandeSession {
  artisanId: string;
  email: string | null;
  referenceOffre: string;
  retourOk: string;
  retourAnnule: string;
}

export type ResultatSession =
  | { ok: true; prestataire: string; url: string; reference: string | null }
  | { ok: false; prestataire: string; etat: number; message: string; geste: string };

/** Ce qu'on a compris d'un message du prestataire. Tous les champs sont
 *  facultatifs sauf les trois premiers : un message qu'on ne sait pas
 *  traduire est garde en base tel quel, il n'est pas jete. */
export interface EvenementLu {
  reference: string;
  genre: string;
  horodatage: string;
  artisanId: string | null;
  etat: Etat | null;
  formule: string | null;
  referenceExterne: string | null;
  periodeDu: string | null;
  periodeAu: string | null;
  prochainPrelevementLe: string | null;
  paiement: PaiementLu | null;
}

/** Un paiement CONSTATE chez le prestataire. Les montants viennent de lui. */
export interface PaiementLu {
  reference: string;
  etat: string;
  montantHtCents: number | null;
  tvaCents: number | null;
  payeLe: string | null;
  moyen: string | null;
  echecCode: string | null;
  echecMotif: string | null;
}

export interface Prestataire {
  nom: string;
  /** Ce qui manque pour ouvrir une session de paiement. Vide = pret. */
  manqueSession(): string[];
  /** Ce qui manque pour recevoir les messages. Vide = pret. */
  manqueEvenements(): string[];
  ouvrirSession(d: DemandeSession): Promise<ResultatSession>;
  /** Le nom de l'en-tete qui porte la signature, et comment elle est ecrite. */
  signature(): { entete: string; enteteHorodatage: string; ecriture: string; algo: string };
  /** Ce qui est signe : le prestataire signe rarement le corps seul. */
  texteSigne(corpsBrut: string, horodatage: string | null): string;
  /** Traduit un message. Rend `null` quand on ne sait pas le lire. */
  lire(charge: unknown): EvenementLu | null;
}

// ------------------------------------------------------------------ aucun

/**
 * Le defaut. Il refuse, et il dit pourquoi.
 *
 * C'est lui qui tourne aujourd'hui, et c'est ce qui fait que l'ecran
 * d'abonnement de `espace/index.html` continue d'afficher une carte eteinte
 * au lieu d'un bouton mort.
 */
const aucun: Prestataire = {
  nom: "aucun",
  manqueSession: () => [
    "Le prestataire de paiement n'est pas choisi (variable PRESTATAIRE_PAIEMENT). [A COMPLETER : décision de Claire-Marie et Joan, après la proposition du conseiller bancaire]",
  ],
  manqueEvenements: () => [
    "Le prestataire de paiement n'est pas choisi (variable PRESTATAIRE_PAIEMENT). [A COMPLETER : même décision]",
  ],
  ouvrirSession(): Promise<ResultatSession> {
    return Promise.resolve({
      ok: false,
      prestataire: "aucun",
      etat: 503,
      message: "Aucun prestataire de paiement n'est raccordé : aucune session n'a été ouverte.",
      geste:
        "Trancher le prestataire, ouvrir le compte, créer l'offre chez lui, puis poser PRESTATAIRE_PAIEMENT, PAIEMENT_CLE et REFERENCE_OFFRE dans les secrets du projet Supabase.",
    });
  },
  signature: () => ({ entete: "", enteteHorodatage: "", ecriture: "hexa", algo: "SHA-256" }),
  texteSigne: (corps) => corps,
  lire: () => null,
};

// --------------------------------------------------------------- generique

/**
 * LE BRANCHEMENT GENERIQUE, ET CE QU'IL EST HONNETEMENT.
 *
 * Il couvre le schema le plus repandu chez les prestataires de paiement : un
 * en-tete qui porte un condensat HMAC-SHA256, calcule sur l'horodatage et le
 * corps brut de la requete, avec une fenetre de tolerance contre le rejeu.
 * La lecture des champs se fait par des CHEMINS configures en variables
 * d'environnement, pas par des noms ecrits en dur.
 *
 * CE QU'IL N'EST PAS. Il n'a ete execute contre AUCUN prestataire reel : il
 * n'existe ni compte, ni cle, ni offre chez qui que ce soit au 13/09/2026.
 * Le jour du choix, la premiere chose a faire n'est pas de relire ce fichier,
 * c'est de declencher un vrai message d'essai et de comparer, champ par
 * champ, avec ce que `PAIEMENT_CHEMIN_*` va chercher. Si le schema de
 * signature du prestataire retenu differe (certains signent le corps seul,
 * d'autres ajoutent une version), on ecrit un branchement dedie a cote de
 * celui-ci : c'est pour cela que c'est une interface et non un `if`.
 *
 * POURQUOI ON NE DEVINE PAS LES CHEMINS. Un chemin absent rend `null`, et un
 * message qu'on ne sait pas traduire est GARDE en base sans etre applique. Il
 * pourra etre rejoue le jour ou le chemin est juste. Deviner, au contraire,
 * appliquerait un etat faux a un abonnement, ce qui ouvre ou ferme un acces
 * a tort.
 */
const generique: Prestataire = {
  nom: env("PRESTATAIRE_PAIEMENT") || "generique",

  manqueSession() {
    const manque: string[] = [];
    if (!env("PAIEMENT_CLE")) {
      manque.push("PAIEMENT_CLE : la clé d'appel du prestataire. [A COMPLETER : compte à ouvrir]");
    }
    if (!env("PAIEMENT_URL_SESSION")) {
      manque.push(
        "PAIEMENT_URL_SESSION : l'adresse d'ouverture d'une session chez le prestataire. [A COMPLETER : documentation du prestataire retenu]",
      );
    }
    if (!env("REFERENCE_OFFRE")) {
      manque.push(
        "REFERENCE_OFFRE : la référence de l'offre CHEZ LE PRESTATAIRE. C'est elle qui porte le prix, et c'est pour cela qu'aucun montant n'est écrit ici. [A COMPLETER : offre à créer chez le prestataire, une fois le tarif arrêté par Claire-Marie]",
      );
    }
    return manque;
  },

  manqueEvenements() {
    const manque: string[] = [];
    if (!env("PAIEMENT_SECRET_EVENEMENTS")) {
      manque.push(
        "PAIEMENT_SECRET_EVENEMENTS : le secret de signature des messages. Sans lui, aucune signature ne peut être vérifiée, donc aucun message n'est accepté. [A COMPLETER : tableau de bord du prestataire]",
      );
    }
    if (!env("PAIEMENT_ENTETE_SIGNATURE")) {
      manque.push(
        "PAIEMENT_ENTETE_SIGNATURE : le nom de l'en-tête qui porte la signature. [A COMPLETER : documentation du prestataire retenu]",
      );
    }
    if (!env("PAIEMENT_CHEMIN_REFERENCE")) {
      manque.push(
        "PAIEMENT_CHEMIN_REFERENCE : où lire l'identifiant du message dans sa charge. C'est la clé d'idempotence : sans elle, un renvoi créerait un doublon. [A COMPLETER : à relever sur un vrai message d'essai]",
      );
    }
    return manque;
  },

  async ouvrirSession(d: DemandeSession): Promise<ResultatSession> {
    const adresse = env("PAIEMENT_URL_SESSION");
    const cle = env("PAIEMENT_CLE");

    // LE CORPS DE LA DEMANDE NE PORTE AUCUN MONTANT. Il cite une reference
    // d'offre, l'identifiant de l'artisan (pour le retrouver au retour du
    // message) et les deux adresses de retour, qui ont ete verifiees comme
    // etant chez nous avant d'arriver ici.
    const corps: Record<string, unknown> = {
      reference_offre: d.referenceOffre,
      reference_client: d.artisanId,
      retour_ok: d.retourOk,
      retour_annule: d.retourAnnule,
    };
    if (d.email) corps.email = d.email;

    try {
      const r = await fetch(adresse, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + cle,
          "Content-Type": "application/json",
          // L'ouverture d'une session est rejouable sans creer deux
          // abonnements : la plupart des prestataires acceptent cet en-tete.
          // S'il est ignore, rien ne casse.
          "Idempotency-Key": "session-" + d.artisanId,
        },
        body: JSON.stringify(corps),
      });
      const texte = await r.text();
      if (!r.ok) {
        return {
          ok: false,
          prestataire: this.nom,
          etat: 502,
          message: "Le prestataire a refusé d'ouvrir la session (" + r.status + ").",
          geste:
            "Lire la réponse dans le journal de la fonction, puis vérifier la clé d'appel et la référence de l'offre chez le prestataire. Réponse : " +
            texte.slice(0, 300),
        };
      }
      let charge: unknown = null;
      try {
        charge = JSON.parse(texte);
      } catch {
        charge = null;
      }
      const url = texteParChemin(charge, env("PAIEMENT_CHEMIN_URL") || "url");
      if (!url) {
        return {
          ok: false,
          prestataire: this.nom,
          etat: 502,
          message: "Le prestataire a répondu, mais sans adresse de paiement lisible.",
          geste:
            "Relever où se trouve l'adresse dans sa réponse, et poser PAIEMENT_CHEMIN_URL (chemin en points, par exemple `donnees.url`).",
        };
      }
      // L'adresse rendue par le prestataire n'est PAS verifiee contre nos
      // hotes : c'est justement une adresse chez lui. Elle est simplement
      // exigee en https, pour qu'une reponse alteree ne renvoie pas un
      // artisan sur une page en clair.
      if (!url.startsWith("https://")) {
        return {
          ok: false,
          prestataire: this.nom,
          etat: 502,
          message: "L'adresse de paiement rendue n'est pas en https.",
          geste: "Vérifier la configuration chez le prestataire : une page de paiement est toujours en https.",
        };
      }
      return {
        ok: true,
        prestataire: this.nom,
        url,
        reference: texteParChemin(charge, env("PAIEMENT_CHEMIN_SESSION") || "id"),
      };
    } catch (e) {
      return {
        ok: false,
        prestataire: this.nom,
        etat: 502,
        message: "Le prestataire est injoignable : " + (e instanceof Error ? e.message : String(e)),
        geste: "Réessayer. Si cela dure, vérifier l'état du service du prestataire avant de toucher au code.",
      };
    }
  },

  signature: () => ({
    entete: env("PAIEMENT_ENTETE_SIGNATURE"),
    enteteHorodatage: env("PAIEMENT_ENTETE_HORODATAGE"),
    ecriture: (env("PAIEMENT_SIGNATURE_ECRITURE") || "hexa").toLowerCase(),
    algo: env("PAIEMENT_SIGNATURE_ALGO") || "SHA-256",
  }),

  /**
   * Ce qui est signe.
   *
   * Par defaut `<horodatage>.<corps brut>` quand un horodatage est fourni,
   * sinon le corps seul. Le gabarit est configurable pour le cas ou le
   * prestataire retenu compose autrement : `PAIEMENT_SIGNATURE_GABARIT` peut
   * valoir par exemple `{horodatage}:{corps}`.
   *
   * LE CORPS EST TOUJOURS LE TEXTE BRUT RECU, jamais un JSON re-serialise :
   * `JSON.stringify(JSON.parse(x))` ne rend pas `x` (ordre des cles, espaces,
   * nombres). Une signature calculee sur le texte re-serialise ne correspond
   * jamais. C'est l'erreur classique de ce genre de fonction.
   */
  texteSigne(corpsBrut: string, horodatage: string | null): string {
    const gabarit = env("PAIEMENT_SIGNATURE_GABARIT");
    if (gabarit) {
      return gabarit.replace("{horodatage}", horodatage || "").replace("{corps}", corpsBrut);
    }
    return horodatage ? horodatage + "." + corpsBrut : corpsBrut;
  },

  lire(charge: unknown): EvenementLu | null {
    const reference = texteParChemin(charge, env("PAIEMENT_CHEMIN_REFERENCE"));
    if (!reference) return null;

    const genre = texteParChemin(charge, env("PAIEMENT_CHEMIN_GENRE") || "genre") || "inconnu";

    // L'HEURE DU FAIT, declaree par le prestataire : c'est elle qui ordonne
    // les messages dans `appliquer_abonnement()`. A defaut, l'heure de
    // reception, qui est moins bonne mais jamais absente : un horodatage nul
    // ferait echouer l'insertion (`not null` en base).
    const brutHeure = texteParChemin(charge, env("PAIEMENT_CHEMIN_HORODATAGE") || "horodatage");
    const horodatage = enIso(brutHeure) || new Date().toISOString();

    const etatBrut = texteParChemin(charge, env("PAIEMENT_CHEMIN_ETAT") || "etat");
    const etat = traduireEtat(genre, etatBrut);

    const refPaiement = texteParChemin(charge, env("PAIEMENT_CHEMIN_PAIEMENT") || "");
    const paiement: PaiementLu | null = refPaiement
      ? {
        reference: refPaiement,
        etat: texteParChemin(charge, env("PAIEMENT_CHEMIN_PAIEMENT_ETAT") || "") || genre,
        // CE MONTANT VIENT DU PRESTATAIRE. Il constate ce qui a ete
        // preleve : il n'est compose nulle part dans notre code.
        montantHtCents: entierParChemin(charge, env("PAIEMENT_CHEMIN_MONTANT_HT") || ""),
        tvaCents: entierParChemin(charge, env("PAIEMENT_CHEMIN_TVA") || ""),
        payeLe: enIso(texteParChemin(charge, env("PAIEMENT_CHEMIN_PAYE_LE") || "")),
        moyen: texteParChemin(charge, env("PAIEMENT_CHEMIN_MOYEN") || ""),
        echecCode: texteParChemin(charge, env("PAIEMENT_CHEMIN_ECHEC_CODE") || ""),
        echecMotif: texteParChemin(charge, env("PAIEMENT_CHEMIN_ECHEC_MOTIF") || ""),
      }
      : null;

    return {
      reference,
      genre,
      horodatage,
      artisanId: normaliserUuid(texteParChemin(charge, env("PAIEMENT_CHEMIN_ARTISAN") || "")),
      etat,
      formule: texteParChemin(charge, env("PAIEMENT_CHEMIN_FORMULE") || ""),
      referenceExterne: texteParChemin(charge, env("PAIEMENT_CHEMIN_ABONNEMENT") || ""),
      periodeDu: enIso(texteParChemin(charge, env("PAIEMENT_CHEMIN_PERIODE_DU") || "")),
      periodeAu: enIso(texteParChemin(charge, env("PAIEMENT_CHEMIN_PERIODE_AU") || "")),
      prochainPrelevementLe: enIso(
        texteParChemin(charge, env("PAIEMENT_CHEMIN_PROCHAIN_PRELEVEMENT") || ""),
      ),
      paiement,
    };
  },
};

/**
 * LA CORRESPONDANCE ENTRE LE VOCABULAIRE DU PRESTATAIRE ET NOS SIX ETATS.
 *
 * Elle se pose dans `PAIEMENT_ETATS`, sous la forme
 * `genre_ou_etat_du_prestataire=notre_etat`, separes par des virgules. La
 * comparaison se fait d'abord sur l'etat declare, puis sur le genre du
 * message : certains prestataires portent l'information dans l'un, d'autres
 * dans l'autre.
 *
 * RIEN N'EST DEVINE. Une valeur absente de la table rend `null`, et le
 * message est alors garde sans etre applique. Un abonnement ne change jamais
 * d'etat sur une supposition.
 */
function traduireEtat(genre: string, etatBrut: string | null): Etat | null {
  const table = new Map<string, string>();
  for (const couple of env("PAIEMENT_ETATS").split(",")) {
    const [de, vers] = couple.split("=");
    if (de && vers) table.set(de.trim().toLowerCase(), vers.trim().toLowerCase());
  }
  for (const candidat of [etatBrut, genre]) {
    if (!candidat) continue;
    const vise = table.get(candidat.trim().toLowerCase());
    if (vise && etatConnu(vise)) return vise;
  }
  return null;
}

/**
 * Une date, quelle que soit la facon dont le prestataire l'ecrit.
 *
 * Les deux ecritures repandues : une chaine ISO, ou un nombre de secondes
 * depuis 1970. On distingue les secondes des millisecondes par la taille :
 * au-dela de 10^11, c'est deja des millisecondes. Une valeur illisible rend
 * `null` plutot qu'une date fausse : une date fausse fausserait l'ordre des
 * messages, donc l'etat final de l'abonnement.
 */
function enIso(valeur: string | null): string | null {
  if (!valeur) return null;
  const brut = valeur.trim();
  if (/^\d{9,14}$/.test(brut)) {
    const n = parseInt(brut, 10);
    const ms = n > 100000000000 ? n : n * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(brut);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Notre identifiant de compte est un uuid. Une valeur qui n'en est pas un
 *  est refusee ici : passee a la base, elle ferait echouer la requete avec un
 *  message incomprehensible, et surtout elle designerait peut-etre le mauvais
 *  compte. */
function normaliserUuid(valeur: string | null): string | null {
  if (!valeur) return null;
  const v = valeur.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? v : null;
}

// ------------------------------------------------------------ le choix

/** Le nom demande dans l'environnement, tel quel, pour le rapport d'etat. */
export function nomDemande(): string {
  return env("PRESTATAIRE_PAIEMENT") || "(aucun)";
}

/**
 * Le prestataire en service.
 *
 * Tant que `PRESTATAIRE_PAIEMENT` est vide, c'est `aucun` : il refuse tout et
 * dit pourquoi. Des qu'un nom est pose, c'est le branchement generique qui
 * prend la main, avec les chemins de lecture de l'environnement. Le jour ou
 * un prestataire demande un schema qui ne rentre pas dans ce moule, on ajoute
 * son branchement ici et on ne touche a rien d'autre.
 */
export function prestataireEnService(): Prestataire {
  return env("PRESTATAIRE_PAIEMENT") ? generique : aucun;
}
