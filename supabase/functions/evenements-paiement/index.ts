// ============================================================
// RECEVOIR LES EVENEMENTS DU PRESTATAIRE DE PAIEMENT.
// Fonction de peripherie Supabase (Deno).
//
// CE QU'ELLE EST. La SEULE porte par laquelle un acces payant s'ouvre ou se
// ferme. Le prestataire nous previent qu'un paiement est passe, a echoue, ou
// qu'un abonnement est resilie ; cette fonction verifie que le message vient
// bien de lui, le garde, puis l'applique.
//
// LE NAVIGATEUR NE CONFIRME JAMAIS UN PAIEMENT. Un artisan qui revient sur
// `/espace?paiement=ok` n'a rien prouve : l'adresse se tape a la main, la
// page peut etre fermee avant le retour, et le retour peut arriver avant que
// le prestataire ait encaisse. `ouvrir-paiement` ne fait donc qu'ouvrir une
// session, et c'est ici, et seulement ici, que l'acces change.
//
// LES QUATRE GARANTIES, ET OU ELLES SONT REELLEMENT TENUES.
//   1. LA SIGNATURE, tenue ici : sans secret configure, la fonction refuse
//      TOUT ; avec un secret, un message mal signe est refuse et N'EST MEME
//      PAS ENREGISTRE. Un message non signe peut venir de n'importe qui, et
//      il ouvrirait un acces gratuit.
//   2. L'IDEMPOTENCE, tenue par la BASE : `unique (prestataire,
//      reference_evenement)` sur `public.evenements_paiement`. Ce n'est pas un
//      `if` dans ce fichier, c'est un index unique : deux envois simultanes
//      ne passent pas. Second verrou au moment d'appliquer, `traite_le` non
//      nul, qui fait repondre « ignore_deja_traite ».
//   3. LE DESORDRE, tenu par la BASE : `appliquer_abonnement()` compare
//      l'horodatage declare par le prestataire a celui du dernier evenement
//      applique, et ignore les plus anciens.
//   4. LE JOURNAL, tenu par la BASE : la charge brute est conservee telle
//      quelle dans `public.evenements_paiement`, qui est explicitement le
//      « journal brut ». C'est elle qui permettra de rejouer un traitement
//      rate et de prouver ce que le prestataire a envoye, le jour d'un litige.
//
// POURQUOI ON RENVOIE 200 A UN EVENEMENT DEJA VU. Tous les prestataires
// reemettent quand notre reponse se perd. Repondre en erreur ferait boucler
// le renvoi sans fin. On repond donc 200 en disant `deja_vu`, ET on retente
// quand meme l'application : elle est sans effet si elle a deja eu lieu
// (verrou `traite_le`), et elle rattrape le cas ou le premier envoi avait ete
// enregistre puis mal applique. Un renvoi sert alors vraiment a quelque chose.
//
// CE QU'ELLE N'ECRIT PAS, ET POURQUOI, MESURE LE 13/09/2026 :
//   . AUCUN MONTANT COMPOSE PAR NOUS. Le seul montant qui entre en base est
//     celui que le prestataire declare avoir preleve : il est constate, pas
//     decide. Le prix de l'abonnement n'est toujours pas arrete.
//   . AUCUNE FACTURE, automatiquement. Deux raisons mesurees, pas une
//     preference : (a) `public.emettre_facture()` insere sans aucun controle
//     de doublon, et (b) le declencheur `factures_figees` REFUSE toute
//     suppression de facture. Une facture emise deux fois resterait donc en
//     base pour toujours, avec deux numeros. (c) S'y ajoute que le taux de TVA
//     n'est pas arrete et que la fonction leve « taux de TVA inconnu : il ne
//     sera pas invente ici ». L'emission reste donc un geste separe et
//     delibere. Voir le bloc final de ce fichier.
//   . AUCUNE RELANCE, tant que `RELANCES_JOURS` est vide. Le calendrier des
//     relances n'est pas arrete, et la migration le dit elle-meme. On ne
//     l'invente pas ici.
//   . AUCUN APPEL A `public.journaliser()` : mesure faite, cette fonction n'a
//     AUCUN grant d'execution (revoke all from public, aucun grant ensuite).
//     Elle n'est appelable que depuis l'interieur des declencheurs. L'appeler
//     ici echouerait sur « permission denied ». Le journal de cette fonction,
//     c'est `public.evenements_paiement`.
// ============================================================

import {
  env,
  erreur,
  hmac,
  json,
  masquerId,
  memesOctets,
  octetsDeBase64,
  octetsDeHexa,
  rpcService,
} from "../_partage/reponses.ts";
import { type EvenementLu, nomDemande, prestataireEnService } from "../_partage/prestataires.ts";

/** La tolerance sur l'age d'un message, en secondes. Au-dela, il est refuse :
 *  c'est ce qui empeche de rejouer un message capture il y a trois semaines.
 *  Cinq minutes par defaut, comme la plupart des prestataires. */
const TOLERANCE_S = (() => {
  const v = parseInt(env("PAIEMENT_TOLERANCE_SECONDES") || "300", 10);
  return Number.isFinite(v) && v > 0 ? v : 300;
})();

/** L'empreinte d'un texte, en hexadecimal. Sert de cle d'idempotence de
 *  SECOURS quand on ne sait pas encore lire l'identifiant du prestataire. */
async function empreinte(texte: string): Promise<string> {
  const octets = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------- la signature

type Verdict =
  | { ok: true }
  | { ok: false; etat: number; code: string; message: string; geste: string; manque?: string[] };

/**
 * Verifie que le message vient bien du prestataire.
 *
 * LE CORPS EST LE TEXTE BRUT RECU, JAMAIS UN JSON RE-SERIALISE.
 * `JSON.stringify(JSON.parse(x))` ne rend pas `x` : l'ordre des cles, les
 * espaces et l'ecriture des nombres changent. Une signature calculee sur le
 * texte re-serialise ne correspond jamais, et on passe une journee a chercher
 * une erreur de secret qui n'existe pas. C'est l'erreur classique de ce genre
 * de fonction, et c'est pour cela que `req.text()` est lu une seule fois, en
 * premier, et transporte tel quel jusqu'ici.
 */
async function verifierSignature(req: Request, corpsBrut: string): Promise<Verdict> {
  const p = prestataireEnService();
  const manque = p.manqueEvenements();
  const secret = env("PAIEMENT_SECRET_EVENEMENTS");
  if (manque.length || !secret) {
    return {
      ok: false,
      etat: 503,
      code: "non_branche",
      message:
        "Aucun message ne peut être accepté : le raccordement du prestataire n'est pas fait. Rien n'a été enregistré.",
      geste:
        "Poser les valeurs manquantes dans les secrets du projet Supabase (`supabase secrets set ...`). Les noms attendus sont dans supabase/functions/.env.example.",
      manque: manque.length ? manque : ["PAIEMENT_SECRET_EVENEMENTS"],
    };
  }

  const schema = p.signature();
  const donnee = req.headers.get(schema.entete) || "";
  if (!donnee) {
    return {
      ok: false,
      etat: 401,
      code: "signature_absente",
      message: `Aucune signature dans l'en-tête ${schema.entete}.`,
      geste:
        "Vérifier que PAIEMENT_ENTETE_SIGNATURE porte bien le nom utilisé par le prestataire, relevé sur un vrai message et non de mémoire.",
    };
  }

  // L'HORODATAGE, QUAND LE PRESTATAIRE EN FOURNIT UN. Il sert a deux choses :
  // il entre dans le texte signe, et il borne l'age du message. Sans lui, la
  // signature reste verifiee mais un message capture reste rejouable
  // indefiniment : c'est dit, et c'est pour cela qu'on le configure des qu'il
  // existe.
  let horodatage: string | null = null;
  if (schema.enteteHorodatage) {
    horodatage = req.headers.get(schema.enteteHorodatage);
    if (!horodatage) {
      return {
        ok: false,
        etat: 401,
        code: "horodatage_absent",
        message: `Aucun horodatage dans l'en-tête ${schema.enteteHorodatage}.`,
        geste: "Vérifier PAIEMENT_ENTETE_HORODATAGE, ou le laisser vide si le prestataire n'en envoie pas.",
      };
    }
    const secondes = /^\d+$/.test(horodatage.trim())
      ? parseInt(horodatage.trim(), 10)
      : Math.floor(new Date(horodatage).getTime() / 1000);
    if (!Number.isFinite(secondes)) {
      return {
        ok: false,
        etat: 401,
        code: "horodatage_illisible",
        message: "L'horodatage du message n'est pas lisible.",
        geste: "Relever son écriture réelle sur un message du prestataire.",
      };
    }
    const age = Math.abs(Math.floor(Date.now() / 1000) - secondes);
    if (age > TOLERANCE_S) {
      return {
        ok: false,
        etat: 401,
        code: "message_trop_vieux",
        message: `Message daté de ${age} secondes : au-delà de la tolérance de ${TOLERANCE_S} secondes.`,
        geste:
          "C'est la protection contre le rejeu. Si des messages légitimes sont refusés, vérifier l'horloge du serveur avant d'élargir PAIEMENT_TOLERANCE_SECONDES.",
      };
    }
  }

  const attendu = await hmac(secret, p.texteSigne(corpsBrut, horodatage), schema.algo);

  // Certains prestataires envoient plusieurs signatures dans le meme en-tete
  // (rotation de secret). On accepte si l'une correspond, et la comparaison
  // reste a duree constante pour chacune.
  const candidats = donnee.split(/[,\s]+/).map((c) => {
    const i = c.lastIndexOf("=");
    return i >= 0 ? c.slice(i + 1) : c;
  }).filter(Boolean);

  for (const c of candidats) {
    const octets = schema.ecriture === "base64" ? octetsDeBase64(c) : octetsDeHexa(c);
    if (octets && memesOctets(octets, attendu)) return { ok: true };
  }

  return {
    ok: false,
    etat: 401,
    code: "signature_refusee",
    message: "La signature ne correspond pas : le message n'a pas été enregistré.",
    geste:
      "Vérifier PAIEMENT_SECRET_EVENEMENTS, puis PAIEMENT_SIGNATURE_ECRITURE (hexa ou base64) et PAIEMENT_SIGNATURE_GABARIT. Ne jamais contourner ce contrôle : un message non signé peut venir de n'importe qui et ouvrirait un accès gratuit.",
  };
}

// ------------------------------------------------------------ l'application

/** Note une erreur de traitement SANS marquer l'evenement comme traite : il
 *  reste donc dans la file des evenements a traiter (`traite_le is null`) et
 *  pourra etre rejoue. Perdre la raison d'un echec coute une journee. */
async function noterErreur(id: number, texte: string): Promise<void> {
  const base = env("SUPABASE_URL");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !service) return;
  try {
    await fetch(base + "/rest/v1/evenements_paiement?id=eq." + id, {
      method: "PATCH",
      headers: {
        apikey: service,
        Authorization: "Bearer " + service,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ traitement_erreur: texte.slice(0, 500) }),
    });
  } catch {
    // Le journal de la fonction garde la trace : voir le console.log appelant.
  }
}

/**
 * Le calendrier des relances.
 *
 * VIDE PAR DEFAUT, ET C'EST UNE DECISION, PAS UN OUBLI.
 * `migration-abonnement-pieces.sql` ecrit : « LE CALENDRIER DES RELANCES N'EST
 * PAS ARRETE : combien, a quel rythme, sur quel canal. » Et aucun service
 * d'envoi de courriel n'est choisi : une relance programmee ne partirait de
 * toute facon pas. On ne programme donc rien tant que `RELANCES_JOURS` n'est
 * pas pose. Quand il l'est, `programmer_relance()` est idempotente par
 * contrainte `unique (paiement_id, rang, canal)` : rejouer ne double rien.
 */
function joursDeRelance(): number[] {
  return env("RELANCES_JOURS")
    .split(",")
    .map((j) => parseInt(j.trim(), 10))
    .filter((j) => Number.isFinite(j) && j >= 0);
}

async function appliquer(idEvenement: number, lu: EvenementLu): Promise<Record<string, unknown>> {
  const fait: Record<string, unknown> = {};

  // 1. L'ABONNEMENT. On n'appelle que si on a de quoi : un etat traduit ET un
  // artisan identifie. Sans l'un des deux, on ne devine pas : l'evenement
  // reste en base, non traite, et pourra etre rejoue quand la traduction sera
  // juste. Appliquer un etat devine ouvrirait ou fermerait un acces a tort.
  if (lu.etat && lu.artisanId) {
    const r = await rpcService("appliquer_abonnement", {
      p_evenement_id: idEvenement,
      p_artisan_id: lu.artisanId,
      p_etat: lu.etat,
      p_formule: lu.formule,
      p_periode_du: lu.periodeDu,
      p_periode_au: lu.periodeAu,
      p_prochain_prelevement_le: lu.prochainPrelevementLe,
      p_prestataire: nomDemande(),
      p_reference_externe: lu.referenceExterne,
    });
    fait.abonnement = r.ok ? r.donnees : "erreur";
    if (!r.ok) {
      await noterErreur(idEvenement, "appliquer_abonnement : " + r.detail);
      console.log("appliquer_abonnement refuse : " + r.detail);
    }
  } else {
    fait.abonnement = !lu.etat ? "aucun_etat_traduit" : "artisan_inconnu";
  }

  // 2. LE PAIEMENT CONSTATE. Le montant vient du prestataire, jamais d'ici.
  // `enregistrer_paiement()` est idempotente : `on conflict (prestataire,
  // reference_externe) do update`. Deux envois mettent a jour la meme ligne.
  if (lu.paiement && lu.artisanId) {
    const p = lu.paiement;
    const r = await rpcService("enregistrer_paiement", {
      p_artisan_id: lu.artisanId,
      p_prestataire: nomDemande(),
      p_reference_externe: p.reference,
      p_montant_ht_cents: p.montantHtCents,
      p_etat: p.etat,
      p_tva_cents: p.tvaCents ?? 0,
      p_paye_le: p.payeLe,
      p_moyen: p.moyen,
      p_periode_du: lu.periodeDu,
      p_periode_au: lu.periodeAu,
      p_echec_code: p.echecCode,
      p_echec_motif: p.echecMotif,
    });
    if (!r.ok) {
      fait.paiement = "erreur";
      await noterErreur(idEvenement, "enregistrer_paiement : " + r.detail);
      console.log("enregistrer_paiement refuse : " + r.detail);
    } else {
      const ligne = Array.isArray(r.donnees) ? r.donnees[0] : r.donnees;
      const idPaiement = ligne && typeof ligne === "object"
        ? (ligne as Record<string, unknown>).id
        : null;
      fait.paiement = idPaiement ? "enregistre" : "enregistre_sans_id";

      // 3. LES RELANCES, seulement en cas d'echec ET seulement si un
      // calendrier a ete pose. Voir `joursDeRelance()`.
      const jours = joursDeRelance();
      if (idPaiement && p.etat.toLowerCase().includes("echec") && jours.length) {
        const programmees: number[] = [];
        for (let i = 0; i < jours.length; i++) {
          const quand = new Date(Date.now() + jours[i] * 24 * 3600 * 1000).toISOString();
          const rr = await rpcService("programmer_relance", {
            p_paiement_id: idPaiement,
            p_rang: i + 1,
            p_canal: env("RELANCES_CANAL") || "email",
            p_prevue_le: quand,
          });
          if (rr.ok && rr.donnees !== null) programmees.push(i + 1);
        }
        fait.relances = programmees.length ? programmees : "deja_programmees";
      } else {
        fait.relances = jours.length ? "sans_objet" : "calendrier_non_arrete";
      }
    }
  } else {
    fait.paiement = "aucun_paiement_lu";
  }

  // 4. LA FACTURE : JAMAIS D'ICI. Voir le bloc d'en-tete de ce fichier.
  fait.facture = "non_emise_volontairement";

  return fait;
}

// ------------------------------------------------------------------ la porte

Deno.serve(async (req: Request) => {
  // PAS DE CORS, ET C'EST VOULU : cette fonction ne se parle qu'entre
  // serveurs. Une reponse de pre-verification ouvrirait la porte au
  // navigateur, donc a la cle publique du site, qui est lisible dans le code
  // source de chaque page.
  if (req.method === "OPTIONS") {
    return erreur(
      405,
      "navigateur_refuse",
      "Cette fonction ne s'appelle pas depuis un navigateur.",
      "Elle est appelée par le prestataire de paiement, de serveur à serveur, avec sa signature.",
    );
  }
  if (req.method !== "POST") {
    return erreur(
      405,
      "methode",
      `Méthode ${req.method} non prévue.`,
      "Le prestataire envoie ses messages en POST.",
    );
  }

  // LE CORPS BRUT, LU UNE SEULE FOIS. Tout part de la : la signature se
  // calcule dessus, et lui seul.
  let corpsBrut: string;
  try {
    corpsBrut = await req.text();
  } catch {
    return erreur(400, "corps_illisible", "Le corps de la requête n'a pas pu être lu.", "Renvoyer le message.");
  }

  const verdict = await verifierSignature(req, corpsBrut);
  if (!verdict.ok) {
    // RIEN N'EST ENREGISTRE quand la signature n'est pas verifiee. Garder ces
    // messages laisserait n'importe qui remplir la table.
    console.log(`message refuse : ${verdict.code}`);
    return erreur(verdict.etat, verdict.code, verdict.message, verdict.geste, verdict.manque);
  }

  let charge: unknown;
  try {
    charge = JSON.parse(corpsBrut);
  } catch {
    return erreur(
      400,
      "corps_illisible",
      "Le message est signé mais son corps n'est pas du JSON.",
      "Relever le format réel envoyé par le prestataire.",
    );
  }

  const p = prestataireEnService();
  const lu = p.lire(charge);

  // LA CLE D'IDEMPOTENCE. On prefere l'identifiant du prestataire, qui est
  // stable d'un renvoi a l'autre. Quand on ne sait pas encore le lire (les
  // chemins ne sont pas poses), on se rabat sur l'empreinte du corps : deux
  // envois du meme message portent le meme corps, donc la meme empreinte, et
  // le doublon est quand meme refuse par l'index unique. Un prestataire qui
  // modifierait son corps entre deux renvois echapperait a ce repli : c'est
  // dit plutot que fait croire, et cela cesse des que le chemin est pose.
  const reference = lu?.reference || "empreinte:" + (await empreinte(corpsBrut));
  const genre = lu?.genre || "non_traduit";
  const horodatage = lu?.horodatage || new Date().toISOString();

  const enregistre = await rpcService("enregistrer_evenement_paiement", {
    p_prestataire: nomDemande(),
    p_reference_evenement: reference,
    p_genre: genre,
    p_horodatage: horodatage,
    p_charge: charge,
    p_signature_verifiee: true,
    p_objet_type: lu?.paiement ? "paiement" : "abonnement",
    p_objet_reference: lu?.referenceExterne || lu?.paiement?.reference || null,
    p_artisan_id: lu?.artisanId || null,
  });

  if (!enregistre.ok) {
    // La base n'a pas pris le message. On repond en erreur POUR QUE LE
    // PRESTATAIRE RENVOIE : c'est le seul cas ou on veut un renvoi, puisque
    // rien n'a ete garde.
    console.log("enregistrement refuse : " + enregistre.detail);
    return erreur(
      500,
      "enregistrement_refuse",
      "Le message n'a pas pu être enregistré : merci de le renvoyer.",
      "Lire le journal de la fonction dans Supabase (Edge Functions, onglet Logs). Détail : " +
        enregistre.detail,
    );
  }

  const resultat = enregistre.donnees as { nouveau?: boolean; id?: number } | null;
  const idEvenement = resultat?.id;
  const nouveau = resultat?.nouveau === true;

  if (!idEvenement) {
    return erreur(
      500,
      "enregistrement_sans_identifiant",
      "La base n'a pas rendu d'identifiant d'événement.",
      "Vérifier que migration-abonnement-pieces.sql a bien été jouée sur le projet.",
    );
  }

  // UN MESSAGE QU'ON NE SAIT PAS TRADUIRE EST GARDE, PAS JETE. Il attend dans
  // `public.evenements_paiement` avec `traite_le` nul, donc dans la file des
  // evenements a traiter, et il sera rejouable le jour ou les chemins de
  // lecture seront poses. On repond 200 : le message est bien arrive, le
  // prestataire n'a pas a le renvoyer, c'est chez nous que le travail reste.
  if (!lu) {
    console.log(
      `evenement garde sans traduction : id=${idEvenement} nouveau=${nouveau} reference=${reference.slice(0, 32)}`,
    );
    return json({
      ok: true,
      deja_vu: !nouveau,
      enregistre: true,
      applique: false,
      motif: "message_non_traduit",
      geste:
        "Le message est conservé et rejouable. Relever sur lui les chemins de lecture (PAIEMENT_CHEMIN_REFERENCE, PAIEMENT_CHEMIN_ARTISAN, PAIEMENT_CHEMIN_ETAT...) et la table PAIEMENT_ETATS, puis les poser dans les secrets.",
    });
  }

  // ON APPLIQUE MEME SI LE MESSAGE ETAIT DEJA CONNU. La base tient le verrou :
  // `appliquer_abonnement()` repond « ignore_deja_traite » et ne touche a rien
  // si `traite_le` est deja pose. Un renvoi rattrape donc un premier envoi
  // enregistre puis mal applique, au lieu de ne rien faire.
  let fait: Record<string, unknown>;
  try {
    fait = await appliquer(idEvenement, lu);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await noterErreur(idEvenement, "application : " + detail);
    console.log("exception a l'application : " + detail);
    return erreur(
      500,
      "application_ratee",
      "Le message est enregistré mais son application a échoué : merci de le renvoyer.",
      "Il reste dans la file des événements à traiter (traite_le nul) et peut être rejoué. Lire le journal de la fonction.",
    );
  }

  console.log(
    `evenement traite : id=${idEvenement} nouveau=${nouveau} genre=${genre} artisan=${masquerId(lu.artisanId)} resultat=${JSON.stringify(fait)}`,
  );

  return json({ ok: true, deja_vu: !nouveau, enregistre: true, applique: true, fait });
});

// ============================================================
// CE QUI RESTE A FAIRE HORS DE CE FICHIER
//
// 1. TRANCHER LE PRESTATAIRE DE PAIEMENT. Decision de Claire-Marie et Joan,
//    apres la proposition du conseiller bancaire. Tant que
//    `PRESTATAIRE_PAIEMENT` est vide, cette fonction refuse tout, et l'ecran
//    d'abonnement affiche une carte eteinte qui le dit.
// 2. RELEVER LES CHEMINS DE LECTURE SUR UN VRAI MESSAGE, pas sur une
//    documentation lue de memoire : declencher un evenement d'essai, lire la
//    charge conservee en base, et poser les `PAIEMENT_CHEMIN_*` et
//    `PAIEMENT_ETATS` d'apres ce qu'on y voit.
// 3. CONFIRMER LE SCHEMA DE SIGNATURE du prestataire retenu. Celui qui est
//    ecrit ici (HMAC sur `<horodatage>.<corps>`) est le plus repandu, mais il
//    n'a ete execute contre AUCUN prestataire reel : il n'existe ni compte, ni
//    cle, ni offre chez qui que ce soit au 13/09/2026. Si le schema differe,
//    ajouter un branchement dans `_partage/prestataires.ts` : c'est une
//    interface, justement pour cela.
// 4. DECLARER L'ADRESSE DE CETTE FONCTION CHEZ LE PRESTATAIRE, et poser la
//    fonction en acces public (`verify_jwt = false`) : le prestataire ne
//    presente pas de jeton Supabase, il presente sa signature. C'est cette
//    signature qui protege la porte, et elle est verifiee ici.
// 5. LES FACTURES. Emission volontairement absente de cette fonction. Pour
//    l'ouvrir, il faut : le taux de TVA arrete, la serie de numerotation
//    choisie, la mention de TVA redigee, ET un controle de doublon avant
//    l'appel a `emettre_facture()`, qui n'en porte aucun alors qu'une facture
//    ne peut jamais etre supprimee.
// 6. LES RELANCES. Poser `RELANCES_JOURS` une fois le calendrier arrete, et
//    seulement quand un service d'envoi de courriel existe : aujourd'hui une
//    relance programmee resterait a l'etat « prevue » sans partir.
// 7. CONTROLER AVEC DEUX COMPTES REELS, comme le demandent tous les fichiers
//    de migration : un artisan ne doit jamais voir les paiements d'un autre.
// ============================================================
