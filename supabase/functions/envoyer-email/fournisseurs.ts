// ============================================================
// LE FOURNISSEUR D'ENVOI : UNE INTERFACE, ET DES BRANCHEMENTS DERRIERE.
//
// POURQUOI CE FICHIER EXISTE. Le service d'envoi N'EST PAS CHOISI au
// 13/09/2026. Ecrire les appels d'un fournisseur en dur dans la fonction
// obligerait a la reecrire le jour du choix, gabarits compris. Ici, le reste
// du code ne connait QUE `Fournisseur.envoyer(message)`. Changer de
// fournisseur, c'est changer une variable d'environnement.
//
// CE QUE CHAQUE BRANCHEMENT SAIT FAIRE, ET RIEN DE PLUS : prendre un message
// deja ecrit et deja verifie, l'envoyer, et rendre soit un identifiant, soit
// une erreur avec le geste qui la debloque. Aucun ne met en page, aucun ne
// valide : ce serait quatre versions de la meme regle.
//
// L'ETAT REEL DE CES BRANCHEMENTS, DIT EN CLAIR. Les quatre appels HTTP sont
// ecrits d'apres la documentation publique de chaque fournisseur. AUCUN N'A
// ETE EXECUTE : il n'existe ni compte, ni cle, ni domaine verifie chez aucun
// des quatre. Le jour du choix, la premiere chose a faire est un envoi reel
// vers une adresse a soi, pas une relecture de ce fichier.
//
// LE MODE PAR DEFAUT EST « aucun », ET IL REFUSE D'ENVOYER. Il ne fait pas
// semblant, ne rend pas un faux succes et ne perd pas le message en silence :
// il repond 503 avec ce qu'il faut faire. Un faux succes ici, et personne ne
// s'apercoit pendant trois semaines que la liste d'attente ne recoit rien.
// ============================================================

export interface Message {
  expediteurEmail: string;
  expediteurNom: string;
  repondreA?: string;
  destinataire: string;
  sujet: string;
  html: string;
  texte: string;
  /** List-Unsubscribe et compagnie. Voir `index.ts`. */
  entetes: Record<string, string>;
}

export type Resultat =
  | { ok: true; fournisseur: string; identifiant?: string }
  | { ok: false; fournisseur: string; etat: number; message: string; geste: string };

export interface Fournisseur {
  nom: string;
  /** Ce qui manque pour que ce branchement puisse envoyer. Vide = pret. */
  manque(): string[];
  envoyer(m: Message): Promise<Resultat>;
}

const env = (cle: string) => Deno.env.get(cle)?.trim() || "";

/** L'adresse au format « Nom <adresse> », quand le fournisseur l'attend. */
function expediteurComplet(m: Message): string {
  return m.expediteurNom ? `${m.expediteurNom} <${m.expediteurEmail}>` : m.expediteurEmail;
}

/** Lit une reponse d'API sans jamais planter dessus : un corps vide, du HTML
 *  d'erreur ou un JSON inattendu ne doivent pas masquer le vrai probleme. */
async function corps(r: Response): Promise<string> {
  try {
    const t = await r.text();
    return t.slice(0, 500);
  } catch {
    return "(corps illisible)";
  }
}

// ------------------------------------------------------------------ aucun

/** Le defaut. Il refuse, et il dit pourquoi. */
const aucun: Fournisseur = {
  nom: "aucun",
  manque: () => ["le choix du service d'envoi (variable FOURNISSEUR_EMAIL)"],
  envoyer(): Promise<Resultat> {
    return Promise.resolve({
      ok: false,
      fournisseur: "aucun",
      etat: 503,
      message: "Aucun service d'envoi n'est choisi : le message n'est pas parti.",
      geste:
        "Trancher le service d'envoi, créer le compte, puis poser FOURNISSEUR_EMAIL et FOURNISSEUR_CLE dans les secrets du projet Supabase. Voir LISEZMOI.md.",
    });
  },
};

// ---------------------------------------------------------------- journal

/**
 * Le mode d'essai : il n'envoie rien et ecrit le message rendu dans le
 * journal de la fonction. C'est ce qui permet de relire les huit gabarits, en
 * vrai, avant d'avoir un compte chez qui que ce soit.
 *
 * Il n'ecrit PAS l'adresse en clair, meme la : les journaux se gardent, se
 * partagent et s'exportent.
 */
const journal: Fournisseur = {
  nom: "journal",
  manque: () => [],
  envoyer(m: Message): Promise<Resultat> {
    console.log(
      JSON.stringify({
        mode: "journal, rien n'est envoye",
        destinataire: masquer(m.destinataire),
        sujet: m.sujet,
        entetes: m.entetes,
        texte: m.texte,
        octetsHtml: m.html.length,
      }),
    );
    return Promise.resolve({ ok: true, fournisseur: "journal", identifiant: "journal" });
  },
};

/** j***@exemple.fr : assez pour reconnaitre un envoi, pas assez pour ficher. */
export function masquer(adresse: string): string {
  const [avant, apres] = adresse.split("@");
  if (!apres) return "***";
  return avant.slice(0, 1) + "***@" + apres;
}

// ----------------------------------------------------------------- resend

const resend: Fournisseur = {
  nom: "resend",
  manque: () => (env("FOURNISSEUR_CLE") ? [] : ["FOURNISSEUR_CLE (la clé d'API Resend)"]),
  async envoyer(m) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env("FOURNISSEUR_CLE"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: expediteurComplet(m),
        to: [m.destinataire],
        subject: m.sujet,
        html: m.html,
        text: m.texte,
        reply_to: m.repondreA || undefined,
        headers: m.entetes,
      }),
    });
    if (!r.ok) return echec("resend", r.status, await corps(r));
    const j = await r.json().catch(() => ({}));
    return { ok: true, fournisseur: "resend", identifiant: j?.id };
  },
};

// ------------------------------------------------------------------ brevo

const brevo: Fournisseur = {
  nom: "brevo",
  manque: () => (env("FOURNISSEUR_CLE") ? [] : ["FOURNISSEUR_CLE (la clé d'API Brevo)"]),
  async envoyer(m) {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env("FOURNISSEUR_CLE"),
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        sender: { email: m.expediteurEmail, name: m.expediteurNom },
        to: [{ email: m.destinataire }],
        subject: m.sujet,
        htmlContent: m.html,
        textContent: m.texte,
        replyTo: m.repondreA ? { email: m.repondreA } : undefined,
        headers: m.entetes,
      }),
    });
    if (!r.ok) return echec("brevo", r.status, await corps(r));
    const j = await r.json().catch(() => ({}));
    return { ok: true, fournisseur: "brevo", identifiant: j?.messageId };
  },
};

// --------------------------------------------------------------- postmark

const postmark: Fournisseur = {
  nom: "postmark",
  manque: () => (env("FOURNISSEUR_CLE") ? [] : ["FOURNISSEUR_CLE (le jeton de serveur Postmark)"]),
  async envoyer(m) {
    const r = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": env("FOURNISSEUR_CLE"),
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        From: expediteurComplet(m),
        To: m.destinataire,
        Subject: m.sujet,
        HtmlBody: m.html,
        TextBody: m.texte,
        ReplyTo: m.repondreA || undefined,
        // Le flux de messages. Chez Postmark, transactionnel et diffusion sont
        // separes, et melanger les deux fait perdre la reputation du premier.
        MessageStream: env("FOURNISSEUR_FLUX") || "outbound",
        Headers: Object.entries(m.entetes).map(([Name, Value]) => ({ Name, Value })),
      }),
    });
    if (!r.ok) return echec("postmark", r.status, await corps(r));
    const j = await r.json().catch(() => ({}));
    return { ok: true, fournisseur: "postmark", identifiant: j?.MessageID };
  },
};

// ---------------------------------------------------------------- mailjet

const mailjet: Fournisseur = {
  nom: "mailjet",
  manque: () => {
    const m: string[] = [];
    if (!env("FOURNISSEUR_CLE")) m.push("FOURNISSEUR_CLE (la clé publique Mailjet)");
    if (!env("FOURNISSEUR_CLE_2")) m.push("FOURNISSEUR_CLE_2 (la clé secrète Mailjet)");
    return m;
  },
  async envoyer(m) {
    const auth = btoa(env("FOURNISSEUR_CLE") + ":" + env("FOURNISSEUR_CLE_2"));
    const r = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: { "Authorization": "Basic " + auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: m.expediteurEmail, Name: m.expediteurNom },
            To: [{ Email: m.destinataire }],
            Subject: m.sujet,
            HTMLPart: m.html,
            TextPart: m.texte,
            ReplyTo: m.repondreA ? { Email: m.repondreA } : undefined,
            Headers: m.entetes,
          },
        ],
      }),
    });
    if (!r.ok) return echec("mailjet", r.status, await corps(r));
    const j = await r.json().catch(() => ({}));
    return { ok: true, fournisseur: "mailjet", identifiant: j?.Messages?.[0]?.To?.[0]?.MessageID };
  },
};

/** Une erreur de fournisseur, traduite en quelque chose d'actionnable. */
function echec(nom: string, etat: number, detail: string): Resultat {
  let geste =
    "Lire le détail ci-dessous dans le tableau de bord du fournisseur, puis corriger la configuration.";
  if (etat === 401 || etat === 403) {
    geste = "La clé d'API est refusée : la regénérer chez le fournisseur et la reposer dans les secrets Supabase (FOURNISSEUR_CLE).";
  } else if (etat === 422 || etat === 400) {
    geste = "Le fournisseur refuse le message : le plus souvent, le domaine expéditeur n'est pas vérifié chez lui. Voir DNS.md.";
  } else if (etat === 429) {
    geste = "Quota atteint chez le fournisseur : attendre, ou relever le plan.";
  } else if (etat >= 500) {
    geste = "Panne chez le fournisseur : réessayer plus tard. Le message n'est pas parti.";
  }
  return { ok: false, fournisseur: nom, etat, message: `Le fournisseur a répondu ${etat}. ${detail}`, geste };
}

const BRANCHEMENTS: Record<string, Fournisseur> = {
  aucun,
  journal,
  resend,
  brevo,
  postmark,
  mailjet,
};

/** Les noms acceptes par FOURNISSEUR_EMAIL, pour les messages d'erreur. */
export const NOMS_FOURNISSEURS = Object.keys(BRANCHEMENTS);

/**
 * Le fournisseur en service. Un nom inconnu ne tombe PAS sur un defaut
 * silencieux : on rend `aucun`, qui refuse et explique. Un repli muet ferait
 * disparaitre une faute de frappe dans une variable d'environnement.
 */
export function fournisseurEnService(): Fournisseur {
  const nom = (env("FOURNISSEUR_EMAIL") || "aucun").toLowerCase();
  return BRANCHEMENTS[nom] ?? aucun;
}

/** Le nom demande, meme s'il est inconnu : sert a le dire dans l'erreur. */
export function nomDemande(): string {
  return (env("FOURNISSEUR_EMAIL") || "aucun").toLowerCase();
}
