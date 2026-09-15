// ============================================================
// CE QUE LES DEUX FONCTIONS DE PAIEMENT PARTAGENT.
//
// POURQUOI UN FICHIER COMMUN PLUTOT QUE DEUX COPIES. `ouvrir-paiement` et
// `evenements-paiement` rendent les memes formes de reponse et comparent les
// memes secrets. Ecrites deux fois, ces regles divergent : c'est mesure dans
// ce depot meme, ou `dire()` existe en trois versions legerement differentes
// (espace, connexion, inscription). Ici on ne recommence pas.
//
// LE PREFIXE `_` DU DOSSIER N'EST PAS DECORATIF : Supabase ne deploie PAS un
// dossier de `functions/` dont le nom commence par un souligne. C'est ce qui
// permet de poser du code commun a cote des fonctions sans creer une
// troisieme porte ouverte sur Internet.
//
// CE FICHIER NE LIT AUCUNE TABLE, N'APPELLE AUCUN PRESTATAIRE ET NE CONNAIT
// AUCUN MONTANT. Il ne sait que repondre, comparer et lire une variable.
// ============================================================

/** Une variable d'environnement, vide plutot que `undefined` : tout le reste
 *  du code teste « est-ce vide », jamais « est-ce defini ». */
export const env = (cle: string) => Deno.env.get(cle)?.trim() || "";

/**
 * CE QUI NE DOIT JAMAIS ENTRER DANS UN CHAMP QU'ON COMPOSE NOUS-MEMES.
 *
 * Le prix de l'abonnement n'est pas arrete au 13/09/2026. La regle du
 * chantier est qu'aucun montant ne s'ecrit nulle part : ni en base, ni a
 * l'ecran, ni en commentaire. Cette expression est le garde-fou automatique
 * de cette regle, repris de `envoyer-email/index.ts` ou elle protege les
 * gabarits. Ici elle protege ce que la page envoie a la fonction.
 *
 * ELLE NE S'APPLIQUE PAS a ce qui revient du prestataire : le montant d'un
 * paiement reellement encaisse vient de lui, et il a sa place dans
 * `public.paiements`. La regle est « on n'invente pas un montant », pas « on
 * ignore ce qui a ete preleve ».
 */
export const R_MONTANT = /montant|prix|tarif|euro|somme|^ht$|^ttc$/i;

// ------------------------------------------------------------- les reponses

/**
 * Les origines autorisees a appeler une fonction depuis un navigateur.
 *
 * `ouvrir-paiement` est appelee par `espace/index.html`, donc depuis un
 * navigateur, donc elle a besoin de CORS. `evenements-paiement` n'en a pas et
 * n'en aura jamais : elle ne se parle qu'entre serveurs.
 *
 * ON N'ECRIT PAS `*`. Une fonction qui ouvre une session de paiement au nom
 * d'un compte connecte ne doit pas etre appelable depuis n'importe quelle
 * page : un site tiers pourrait la declencher dans le dos d'un artisan
 * connecte. On liste donc les origines, et on refuse le reste.
 */
export function originesAutorisees(): Set<string> {
  const liste = new Set<string>();
  const site = env("URL_SITE");
  if (site) {
    try {
      liste.add(new URL(site).origin);
    } catch {
      // Une URL_SITE mal ecrite ne doit pas faire tomber la fonction : elle
      // fait simplement qu'aucune origine n'est reconnue, et l'appel est
      // refuse avec un message qui le dit.
    }
  }
  for (const o of env("ORIGINES_AUTORISEES").split(",")) {
    const n = o.trim();
    if (!n) continue;
    try {
      liste.add(new URL(n).origin);
    } catch { /* entree ignoree, voir ci-dessus */ }
  }
  return liste;
}

/** Les en-tetes CORS pour une origine donnee, ou rien si elle n'est pas
 *  declaree. Rendre l'objet vide plutot qu'un joker : le navigateur bloquera,
 *  et c'est le comportement voulu. */
export function entetesCors(origine: string | null): Record<string, string> {
  if (!origine || !originesAutorisees().has(origine)) return {};
  return {
    "access-control-allow-origin": origine,
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "3600",
    // L'origine change la reponse : sans ce `vary`, un cache partage pourrait
    // servir a un site les en-tetes calcules pour un autre.
    vary: "Origin",
  };
}

export function json(corps: unknown, etat = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corps, null, 2), {
    status: etat,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Rien de ce que rendent ces deux fonctions ne se met en cache. Une
      // adresse de session de paiement rejouee depuis un cache enverrait deux
      // artisans sur la meme session.
      "cache-control": "no-store",
      ...cors,
    },
  });
}

/**
 * Une erreur porte TOUJOURS quatre choses : un code lisible par une machine,
 * une phrase lisible par un humain, le geste qui debloque, et la liste
 * complete de ce qui manque quand il manque plusieurs pieces.
 *
 * POURQUOI LA LISTE COMPLETE. Mesure du 13/09/2026 sur `envoyer-email` : en
 * s'arretant a la premiere piece absente, on obligeait a trois allers-retours
 * pour decouvrir trois manques. On les donne tous d'un coup, dans l'ordre ou
 * un humain les traite.
 */
export function erreur(
  etat: number,
  code: string,
  message: string,
  geste: string,
  manque?: string[],
  cors: Record<string, string> = {},
): Response {
  return json({ ok: false, erreur: { code, message, geste, manque } }, etat, cors);
}

// -------------------------------------------------------------- les secrets

/**
 * Comparaison a duree constante.
 *
 * Une comparaison ordinaire s'arrete au premier caractere different, et la
 * duree de la reponse laisse deviner le secret, caractere par caractere. La
 * difference de longueur reste observable : c'est admis, elle ne donne aucun
 * caractere. Meme fonction que dans `envoyer-email/index.ts`, et pour la
 * meme raison.
 */
export function memeSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let ecart = 0;
  for (let i = 0; i < a.length; i++) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ecart === 0;
}

/** Compare deux suites d'octets a duree constante. La signature d'un
 *  prestataire est une suite d'octets, pas du texte : la comparer en texte
 *  apres un decodage approximatif fait passer des signatures fausses. */
export function memesOctets(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let ecart = 0;
  for (let i = 0; i < a.length; i++) ecart |= a[i] ^ b[i];
  return ecart === 0;
}

/** Une suite d'octets ecrite en hexadecimal, vers ses octets. Rend null si
 *  ce n'est pas de l'hexadecimal : une signature illisible est une signature
 *  refusee, jamais une signature acceptee par defaut. */
export function octetsDeHexa(valeur: string): Uint8Array | null {
  const propre = valeur.trim().toLowerCase();
  if (propre.length === 0 || propre.length % 2 !== 0) return null;
  if (!/^[0-9a-f]+$/.test(propre)) return null;
  const out = new Uint8Array(propre.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(propre.substr(i * 2, 2), 16);
  return out;
}

/** Idem depuis du base64. Les prestataires se partagent entre les deux
 *  ecritures : on accepte les deux plutot que d'en imposer une. */
export function octetsDeBase64(valeur: string): Uint8Array | null {
  try {
    const brut = atob(valeur.trim());
    const out = new Uint8Array(brut.length);
    for (let i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Le condensat HMAC-SHA256 d'un texte, en octets. */
export async function hmac(secret: string, texte: string, algo = "SHA-256"): Promise<Uint8Array> {
  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: algo },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(texte));
  return new Uint8Array(signature);
}

// ------------------------------------------------------------ la lecture JSON

/**
 * Va chercher une valeur dans un objet par un chemin en points
 * (`donnees.objet.metadata.artisan`).
 *
 * POURQUOI PAR CHEMIN CONFIGURABLE ET NON EN DUR. Aucun prestataire de
 * paiement n'est choisi au 13/09/2026 : ecrire `charge.data.object.id` serait
 * inventer la forme des messages d'un prestataire qu'on ne connait pas. Le
 * chemin est donc une variable d'environnement, et le jour du choix on le
 * pose apres avoir lu un vrai message, pas une documentation de memoire.
 */
export function parChemin(objet: unknown, chemin: string): unknown {
  if (!chemin) return undefined;
  let courant: unknown = objet;
  for (const morceau of chemin.split(".")) {
    if (courant === null || typeof courant !== "object") return undefined;
    courant = (courant as Record<string, unknown>)[morceau];
  }
  return courant;
}

/** La meme chose, ramenee a du texte, et `null` quand il n'y a rien. On ne
 *  rend jamais la chaine « undefined » : elle finirait en base. */
export function texteParChemin(objet: unknown, chemin: string): string | null {
  const v = parChemin(objet, chemin);
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

/** Idem pour un nombre entier. Rend `null` plutot que `NaN` : `NaN` traverse
 *  les tests ordinaires et s'ecrit en base sans bruit. */
export function entierParChemin(objet: unknown, chemin: string): number | null {
  const v = parChemin(objet, chemin);
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return null;
}

// --------------------------------------------------------------- la base

/**
 * Appelle une fonction SQL avec la CLE DE SERVICE.
 *
 * A N'UTILISER QUE POUR CE QUI NE PEUT PAS PASSER PAR UNE SESSION : les six
 * fonctions de `migration-abonnement-pieces.sql` accordees au seul
 * `service_role` (`enregistrer_evenement_paiement`, `appliquer_abonnement`,
 * `enregistrer_paiement`, `emettre_facture`, `programmer_relance`...). Pour
 * tout ce qu'un artisan a le droit de voir, on passe par SON jeton, pour que
 * la securite par ligne fasse son travail : voir `rpcAvecJeton` ci-dessous.
 */
export async function rpcService(
  fonction: string,
  parametres: Record<string, unknown>,
): Promise<{ ok: true; donnees: unknown } | { ok: false; etat: number; detail: string }> {
  const base = env("SUPABASE_URL");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !service) {
    return {
      ok: false,
      etat: 503,
      detail: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente de l'environnement de la fonction.",
    };
  }
  return await appeler(base + "/rest/v1/rpc/" + fonction, service, service, parametres);
}

/** Appelle une fonction SQL AVEC LE JETON DE L'ARTISAN : c'est la securite
 *  par ligne qui decide de ce qu'il voit, pas cette fonction. */
export async function rpcAvecJeton(
  jeton: string,
  fonction: string,
  parametres: Record<string, unknown>,
): Promise<{ ok: true; donnees: unknown } | { ok: false; etat: number; detail: string }> {
  const base = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  if (!base || !anon) {
    return { ok: false, etat: 503, detail: "SUPABASE_URL ou SUPABASE_ANON_KEY absente." };
  }
  return await appeler(base + "/rest/v1/rpc/" + fonction, anon, jeton, parametres);
}

async function appeler(
  adresse: string,
  apikey: string,
  porteur: string,
  parametres: Record<string, unknown>,
): Promise<{ ok: true; donnees: unknown } | { ok: false; etat: number; detail: string }> {
  try {
    const r = await fetch(adresse, {
      method: "POST",
      headers: {
        apikey,
        Authorization: "Bearer " + porteur,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parametres),
    });
    const texte = await r.text();
    if (!r.ok) return { ok: false, etat: r.status, detail: texte.slice(0, 500) };
    try {
      return { ok: true, donnees: texte ? JSON.parse(texte) : null };
    } catch {
      return { ok: true, donnees: texte };
    }
  } catch (e) {
    return { ok: false, etat: 502, detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Qui appelle ? On demande a Supabase plutot que de lire le jeton nous-memes.
 *
 * POURQUOI ON NE DECODE PAS LE JETON ICI. Decoder un JWT sans verifier sa
 * signature revient a croire sur parole qui que ce soit : n'importe qui peut
 * fabriquer un jeton qui affirme etre un autre artisan. Verifier la signature
 * demanderait le secret du projet et une bibliotheque de plus. L'appel a
 * `/auth/v1/user` fait exactement ce travail, du cote de Supabase, et rend
 * l'identifiant reel ou rien.
 */
export async function quiAppelle(jeton: string): Promise<{ id: string; email: string | null } | null> {
  const base = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  if (!base || !anon || !jeton) return null;
  try {
    const r = await fetch(base + "/auth/v1/user", {
      headers: { apikey: anon, Authorization: "Bearer " + jeton },
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || typeof u.id !== "string") return null;
    return { id: u.id, email: typeof u.email === "string" ? u.email : null };
  } catch {
    return null;
  }
}

/** Le jeton porte par l'en-tete `Authorization`, ou une chaine vide. */
export function jetonDe(req: Request): string {
  const brut = req.headers.get("authorization") || "";
  const m = brut.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

/**
 * Un identifiant de compte, masque pour le journal.
 *
 * Les journaux de fonction se gardent, se partagent et s'exportent. Les huit
 * premiers caracteres suffisent a recouper deux lignes entre elles, et ne
 * suffisent pas a designer quelqu'un.
 */
export function masquerId(id: string | null | undefined): string {
  if (!id) return "(inconnu)";
  return id.slice(0, 8) + "…";
}
