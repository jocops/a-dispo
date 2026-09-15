// ============================================================
// OUVRIR UNE SESSION DE PAIEMENT. Fonction de peripherie Supabase (Deno).
//
// CE QU'ELLE EST. La porte par laquelle un artisan connecte demande a
// s'abonner. Elle verifie qui appelle, demande au prestataire d'ouvrir une
// session, et rend l'adresse ou envoyer l'artisan. Elle ne fait rien d'autre.
//
// CE QU'ELLE N'EST PAS, ET C'EST LE POINT LE PLUS IMPORTANT DU FICHIER.
// ELLE NE CONFIRME AUCUN PAIEMENT. Le navigateur ne confirme jamais un
// paiement : il peut etre ferme au mauvais moment, trafique, ou rappele par
// quelqu'un qui n'a rien paye. Seule `evenements-paiement` ouvre un acces, et
// seulement sur un message signe du prestataire. Cette fonction-ci n'ecrit
// RIEN dans `public.abonnements`, ni dans `public.paiements`.
//
// ELLE N'ECRIT AUCUN MONTANT NON PLUS. Elle cite une reference d'offre creee
// chez le prestataire (`REFERENCE_OFFRE`). Le prix vit chez lui. C'est ce qui
// permet de construire tout le raccordement avant que le tarif soit arrete
// par Claire-Marie, sans ecrire un nombre qu'il faudrait ensuite retrouver
// partout.
//
// POURQUOI UNE FONCTION DE PERIPHERIE ET NON UNE FONCTION DE L'HEBERGEUR.
// L'hebergement a deja change une fois (Vercel, puis Cloudflare Pages le
// 13/09/2026). Ce qui depend de l'hebergeur casse au prochain changement. Une
// fonction de peripherie vit avec la base, qui, elle, n'a pas bouge.
//
// LES QUATRE ETATS QU'ELLE REND, PARCE QU'UNE FONCTION EN A AUSSI :
//   . en marche    : 200 avec l'adresse de la session
//   . rien a faire : 200 avec `deja_actif`, quand l'artisan a deja un acces
//   . non branche  : 503 avec la LISTE COMPLETE de ce qui manque
//   . erreur       : 4xx ou 5xx, toujours avec un champ `geste`
// Aucun silence, aucun faux succes : une adresse de paiement inventee
// enverrait un artisan sur une page morte, avec sa carte a la main.
//
// CE QU'ELLE LIT AILLEURS, SANS LE CREER.
//   . `public.mon_abonnement` et `public.acces_artisan()`
//     (`crm/supabase/migration-abonnement-pieces.sql`), lues AVEC LE JETON DE
//     L'ARTISAN pour que la securite par ligne fasse son travail.
//   Elle n'ecrit dans aucune table. C'est volontaire.
// ============================================================

import {
  entetesCors,
  env,
  erreur,
  jetonDe,
  json,
  masquerId,
  originesAutorisees,
  quiAppelle,
  R_MONTANT,
} from "../_partage/reponses.ts";
import { nomDemande, prestataireEnService } from "../_partage/prestataires.ts";

/**
 * Les hotes ou un artisan a le droit d'etre renvoye apres son paiement.
 *
 * POURQUOI CE CONTROLE EXISTE. Les adresses de retour partent chez le
 * prestataire et lui servent a rediriger. Si un appelant pouvait les choisir
 * librement, il ferait rebondir un artisan depuis une page de paiement
 * credible vers son propre site : c'est le mecanisme exact d'une campagne
 * d'hameconnage, avec notre nom dessus. Meme regle que `hotesAutorises()`
 * dans `envoyer-email/index.ts`, et pour la meme raison.
 */
function hotesRetour(): Set<string> {
  const hotes = new Set<string>();
  for (const o of originesAutorisees()) {
    try {
      hotes.add(new URL(o).hostname);
    } catch { /* origine mal ecrite : ignoree, l'appel sera refuse plus loin */ }
  }
  return hotes;
}

function adresseRetourSure(valeur: string): string | null {
  let u: URL;
  try {
    u = new URL(valeur);
  } catch {
    return "ce n'est pas une adresse valide";
  }
  if (u.protocol !== "https:") return "l'adresse de retour doit être en https";
  const hotes = hotesRetour();
  if (hotes.size === 0) {
    return "aucun hôte de retour n'est déclaré (URL_SITE ou ORIGINES_AUTORISEES)";
  }
  if (!hotes.has(u.hostname)) return `l'hôte ${u.hostname} n'est pas déclaré`;
  return null;
}

/** Les deux adresses de retour, composees a partir du site. Elles ne sont
 *  JAMAIS prises dans le corps de la requete : une adresse choisie par
 *  l'appelant est une redirection ouverte. */
function retours(): { ok: string; annule: string; souci: string[] } {
  const site = (env("URL_SITE") || "").replace(/\/+$/, "");
  const souci: string[] = [];
  if (!site) {
    souci.push(
      "URL_SITE : l'adresse du site, qui sert à composer les retours de paiement. [A COMPLETER : par exemple https://a-dispo.fr]",
    );
    return { ok: "", annule: "", souci };
  }
  const ok = env("URL_RETOUR_OK") || site + "/espace?paiement=ok";
  const annule = env("URL_RETOUR_ANNULE") || site + "/espace?paiement=annule";
  for (const [nom, adresse] of [["URL_RETOUR_OK", ok], ["URL_RETOUR_ANNULE", annule]]) {
    const mal = adresseRetourSure(adresse);
    if (mal) souci.push(`${nom} (${adresse}) est refusée : ${mal}.`);
  }
  return { ok, annule, souci };
}

// ---------------------------------------------------------------- l'etat

/**
 * L'ETAT DU RACCORDEMENT, SANS RIEN DEVOILER DE SECRET.
 *
 * C'est ce que `espace/index.html` appelle en arrivant sur l'ecran
 * d'abonnement, pour savoir s'il affiche un vrai bouton ou une carte eteinte
 * qui dit ce qui manque. On ne rend AUCUNE valeur de secret : seulement les
 * NOMS des variables absentes, qui ne sont un secret pour personne et qui
 * sont exactement ce qu'un humain doit lire pour debloquer.
 *
 * Il faut une session pour l'interroger : la liste de ce qui nous manque n'a
 * pas a etre lisible par un passant.
 */
function etatRaccordement() {
  const p = prestataireEnService();
  const manque = [...p.manqueSession()];
  const r = retours();
  manque.push(...r.souci);
  return {
    ok: true,
    pret: manque.length === 0,
    prestataire: nomDemande(),
    // Le nom de l'offre, pas son contenu : la reference ne porte pas de
    // montant, c'est le prestataire qui en tient un.
    offre_declaree: env("REFERENCE_OFFRE") ? true : false,
    manque,
    // Dit explicitement ce que cette fonction ne fera jamais, pour qu'on ne
    // l'attende pas d'elle en lisant la reponse.
    rappel: "Cette fonction ouvre une session. Elle ne confirme aucun paiement : c'est evenements-paiement qui le fait, sur message signé.",
  };
}

// -------------------------------------------------------------- l'ouverture

async function ouvrir(req: Request, cors: Record<string, string>): Promise<Response> {
  const jeton = jetonDe(req);
  if (!jeton) {
    return erreur(
      401,
      "session_absente",
      "Aucune session : impossible de savoir pour qui ouvrir un paiement.",
      "Se connecter, puis réessayer depuis l'espace.",
      undefined,
      cors,
    );
  }
  const qui = await quiAppelle(jeton);
  if (!qui) {
    return erreur(
      401,
      "session_refusee",
      "La session n'est pas valide ou a expiré.",
      "Se reconnecter depuis /connexion, puis réessayer.",
      undefined,
      cors,
    );
  }

  // LE CORPS NE SERT A RIEN, ET C'EST VOULU. Tout ce qui compte (qui paie,
  // quelle offre, ou revenir) vient de la session et de l'environnement,
  // jamais de l'appelant. On lit quand meme le corps pour REFUSER
  // bruyamment un montant qu'une page essaierait de passer : ce serait un
  // bogue a corriger tout de suite, pas a laisser filer.
  if (req.method === "POST") {
    let brut: Record<string, unknown> = {};
    try {
      const texte = await req.text();
      brut = texte ? JSON.parse(texte) : {};
    } catch {
      brut = {};
    }
    for (const cle of Object.keys(brut)) {
      if (R_MONTANT.test(cle)) {
        return erreur(
          422,
          "montant_refuse",
          `Le champ « ${cle} » ressemble à un montant. Aucun montant ne transite par cette fonction.`,
          "Le prix vit chez le prestataire, sous la référence REFERENCE_OFFRE. Retirer ce champ de l'appel.",
          undefined,
          cors,
        );
      }
    }
  }

  // TOUT CE QUI MANQUE, D'UN SEUL COUP.
  const p = prestataireEnService();
  const r = retours();
  const manque = [...p.manqueSession(), ...r.souci];
  if (manque.length) {
    return erreur(
      503,
      "non_branche",
      `Le paiement n'est pas raccordé : ${manque.length} pièce${manque.length > 1 ? "s" : ""} manque${manque.length > 1 ? "nt" : ""}, et aucune ne peut être fabriquée par du code.`,
      "Poser ces valeurs dans les secrets du projet Supabase (`supabase secrets set ...`). Les noms attendus sont listés dans supabase/functions/.env.example.",
      manque,
      cors,
    );
  }

  // A-T-IL DEJA UN ABONNEMENT EN COURS ? Lu AVEC SON JETON : c'est la
  // securite par ligne qui decide de ce qu'il voit, pas cette fonction. Un
  // artisan deja actif qui reclique ne doit pas ouvrir une seconde session et
  // se faire prelever deux fois.
  //
  // ON NE SE SERT PAS DE `acces_artisan()` ICI, ET C'EST DELIBERE : elle rend
  // « complet » aussi bien pour un abonnement actif que pour un essai en
  // cours. Or l'artisan en essai a justement le droit de s'abonner tout de
  // suite. Seul l'etat permet de distinguer les deux cas.
  const vue = await lireMonAbonnement(jeton);
  if (vue && (vue.etat === "actif" || vue.etat === "impaye")) {
    return json(
      {
        ok: true,
        deja_actif: true,
        etat: vue.etat,
        // Le message vient de `public.abonnement_etats`, donc d'un seul
        // endroit : la page l'affiche tel quel sans le reecrire.
        message: vue.message,
      },
      200,
      cors,
    );
  }

  const resultat = await p.ouvrirSession({
    artisanId: qui.id,
    email: qui.email,
    referenceOffre: env("REFERENCE_OFFRE"),
    retourOk: r.ok,
    retourAnnule: r.annule,
  });

  if (!resultat.ok) {
    console.log(
      `session refusee : prestataire=${resultat.prestataire} artisan=${masquerId(qui.id)} etat=${resultat.etat}`,
    );
    return erreur(resultat.etat, "prestataire_refuse", resultat.message, resultat.geste, undefined, cors);
  }

  console.log(
    `session ouverte : prestataire=${resultat.prestataire} artisan=${masquerId(qui.id)} reference=${resultat.reference ?? "(sans)"}`,
  );
  return json(
    {
      ok: true,
      url: resultat.url,
      prestataire: resultat.prestataire,
      reference: resultat.reference,
      // Repete a l'appelant ce qu'il ne doit pas croire : revenir sur
      // l'adresse de retour ne prouve rien. L'acces s'ouvrira quand le
      // message signe arrivera.
      rappel: "Le retour sur le site ne vaut pas paiement : l'accès s'ouvre à la réception du message signé du prestataire.",
    },
    200,
    cors,
  );
}

/** La vue `public.mon_abonnement`, lue avec le jeton de l'artisan. Zero ligne
 *  rendue veut dire « aucun abonnement encore ouvert », ce qui est un etat
 *  normal et non une erreur. */
async function lireMonAbonnement(
  jeton: string,
): Promise<{ etat: string; message: string } | null> {
  const base = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  if (!base || !anon) return null;
  try {
    const r = await fetch(base + "/rest/v1/mon_abonnement?select=etat,message&limit=1", {
      headers: { apikey: anon, Authorization: "Bearer " + jeton },
    });
    if (!r.ok) return null;
    const lignes = await r.json();
    if (!Array.isArray(lignes) || lignes.length === 0) return null;
    return { etat: String(lignes[0].etat || ""), message: String(lignes[0].message || "") };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ la porte

Deno.serve(async (req: Request) => {
  const origine = req.headers.get("origin");
  const cors = entetesCors(origine);

  // LA PRE-VERIFICATION DU NAVIGATEUR. Contrairement a `envoyer-email`, cette
  // fonction-ci EST appelee depuis un navigateur : c'est l'ecran
  // d'abonnement de l'espace qui l'appelle, avec la session de l'artisan.
  // L'origine est verifiee : une page tierce ne doit pas pouvoir declencher
  // l'ouverture d'un paiement dans le dos d'un artisan connecte.
  if (req.method === "OPTIONS") {
    if (Object.keys(cors).length === 0) {
      return erreur(
        403,
        "origine_refusee",
        "Cette origine n'est pas autorisée à appeler la fonction.",
        "Ajouter l'origine du site dans URL_SITE ou ORIGINES_AUTORISEES, puis redéployer les secrets.",
      );
    }
    return new Response(null, { status: 204, headers: cors });
  }

  if (origine && Object.keys(cors).length === 0) {
    return erreur(
      403,
      "origine_refusee",
      "Cette origine n'est pas autorisée à appeler la fonction.",
      "Ajouter l'origine du site dans URL_SITE ou ORIGINES_AUTORISEES.",
    );
  }

  if (req.method === "GET") {
    // L'etat du raccordement exige une session : ce n'est pas un secret, mais
    // ce n'est pas non plus une information a laisser ramasser par un passant.
    const qui = await quiAppelle(jetonDe(req));
    if (!qui) {
      return erreur(
        401,
        "session_absente",
        "Il faut une session pour lire l'état du raccordement.",
        "Appeler depuis l'espace, connecté.",
        undefined,
        cors,
      );
    }
    return json(etatRaccordement(), 200, cors);
  }

  if (req.method !== "POST") {
    return erreur(405, "methode", `Méthode ${req.method} non prévue.`, "GET pour l'état, POST pour ouvrir une session.", undefined, cors);
  }

  try {
    return await ouvrir(req, cors);
  } catch (e) {
    // Le dernier filet. Une exception non prevue ne doit pas rendre une page
    // blanche a l'artisan : elle rend un objet lisible, comme le reste, et le
    // detail part dans le journal.
    console.log("exception : " + (e instanceof Error ? e.stack || e.message : String(e)));
    return erreur(
      500,
      "imprevu",
      "La session n'a pas pu être ouverte : erreur inattendue dans la fonction.",
      "Lire le journal de la fonction dans Supabase (Edge Functions, onglet Logs), ligne « exception ».",
      undefined,
      cors,
    );
  }
});
