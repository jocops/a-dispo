// ============================================================
// LES HUIT GABARITS D'EMAIL.
//
// CE QUI GOUVERNE CE FICHIER : UN GABARIT DECLARE CE QU'IL LUI FAUT.
// Chaque gabarit porte la liste de ses champs, leur genre et leur caractere
// obligatoire. C'est `index.ts` qui verifie, une fois pour les huit. Un
// controle ecrit gabarit par gabarit finit toujours par etre oublie dans le
// huitieme, et c'est celui-la qui part avec un bouton mort.
//
// AUCUN BOUTON MORT. Une adresse obligatoire manquante fait REFUSER l'envoi,
// avec le geste qui le debloque. Une adresse facultative absente fait
// disparaitre le bouton, et le message reste complet sans lui. Jamais de
// bouton qui pointe vers une page qui n'existe pas.
//
// AUCUN MONTANT D'ABONNEMENT, NULLE PART. Le prix n'est pas arrete (releve le
// 13/09/2026 dans `espace/index.html` : « Le tarif est en cours d'arbitrage »).
// Aucun gabarit n'a de champ montant, et `index.ts` refuse une demande qui en
// porterait un. Le montant d'une facture vit dans la facture, pas dans l'email
// qui l'annonce.
//
// LE VOCABULAIRE DU DROIT. Mise en relation d'ENTREPRISES INDEPENDANTES en
// sous-traitance. Jamais « embaucher », « recruter », « employer »,
// « personnel », « interim » : l'article L8241-1 du Code du travail interdit
// le pret de main d'oeuvre a but lucratif, et un email qui emploie ces mots
// donne au juge la qualification qu'on veut eviter. Le controle est
// automatique : voir `MOTS_INTERDITS` et la route de controle d'`index.ts`.
//
// TUTOIEMENT. C'est celui du site, releve sur `inscription/index.html` et
// `espace/index.html` (« Sois prévenu », « Ton métier »). Un email qui
// vouvoie apres un site qui tutoie ne vient pas de la meme maison.
// ============================================================

import {
  bouton,
  document as documentHtml,
  documentTexte,
  echapper,
  encadre,
  lienEnClair,
  liste,
  mention,
  paragraphe,
  titre,
  type PiedDePage,
} from "./mise-en-page.ts";

/**
 * TRANSACTIONNEL : le message repond a un acte de la personne ou a un fait de
 * son contrat (elle a demande, on lui a repondu, son paiement a echoue). Il
 * ne porte PAS de lien de desabonnement : s'en desabonner reviendrait a se
 * couper du service qu'on utilise.
 *
 * RELATIONNEL : le message entretient le lien sans qu'elle vienne de faire
 * quoi que ce soit. Il ne part QUE si le consentement est acquis, il porte
 * toujours un lien de desabonnement, et le pied porte l'identite de
 * l'expediteur.
 */
export type Categorie = "transactionnel" | "relationnel";

export interface Champ {
  nom: string;
  genre: "texte" | "url";
  obligatoire: boolean;
  /** Longueur maximale. Au-dela, `index.ts` refuse plutot que de tronquer. */
  max: number;
  role: string;
}

export interface Contexte {
  /** Raison sociale, forme juridique, adresse. Vient de la configuration. */
  mentions?: string;
}

export interface EmailRendu {
  sujet: string;
  html: string;
  texte: string;
}

export interface Gabarit {
  id: string;
  categorie: Categorie;
  /** Ce que ce message dit, en une ligne, pour le LISEZMOI et le controle. */
  resume: string;
  champs: Champ[];
  /** Un jeu de donnees complet, qui sert au controle sans rien envoyer. */
  exemple: Record<string, string>;
  rendre: (d: Record<string, string>, c: Contexte) => EmailRendu;
}

type Donnees = Record<string, string>;

/** Les mots que le droit nous interdit. Controles sur le rendu, pas sur la
 *  bonne volonte. `personnel` est absent de la liste : « données personnelles »
 *  est une expression legitime, et un controle qui crie a tort finit ignore. */
export const MOTS_INTERDITS = [
  "embauche",
  "embaucher",
  "recruter",
  "recrutement",
  "employer",
  "employé",
  "salarié",
  "intérim",
  "interim",
  "main d'oeuvre",
  "main-d'oeuvre",
];

/** Le prenom quand on l'a, une formule neutre sinon. Jamais « Bonjour , ». */
function bonjour(d: Donnees): string {
  const p = (d.prenom || "").trim();
  return p ? `Bonjour ${p},` : "Bonjour,";
}

/** Pourquoi ce message arrive : la premiere chose que cherche une personne
 *  qui se demande si on l'a inscrite de force. */
function pied(pourquoi: string, c: Contexte, urlDesabonnement?: string): PiedDePage {
  return { pourquoi, mentions: c.mentions, urlDesabonnement };
}

/** Coupe un extrait de message a une longueur qui tient dans un apercu. */
function extrait(texte: string, max = 220): string {
  const t = texte.trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

// ------------------------------------------------------------------ 1 sur 8

/**
 * LA DOUBLE CONFIRMATION DE LA LISTE D'ATTENTE.
 *
 * POURQUOI ELLE EXISTE. Sans elle, la liste se remplit d'adresses fausses ou
 * saisies de travers et le compteur ment. Or c'est ce compteur, metier par
 * metier et departement par departement, qui sert a decider ou ouvrir
 * (`crm/supabase/migration-inscriptions.sql`).
 *
 * PAS DE LIEN DE DESABONNEMENT ICI, ET C'EST VOULU. Il n'y a encore aucun
 * consentement : le message EST la demande de consentement. Sans clic, rien
 * n'est confirme. On le dit, c'est plus clair qu'un lien de sortie.
 *
 * PAS DE DUREE DE VALIDITE ANNONCEE. La colonne `jeton` de la table n'a
 * aucune date d'expiration (verifie ligne par ligne le 13/09/2026). Ecrire
 * « ce lien expire dans 7 jours » serait une donnee inventee.
 */
const listeAttenteConfirmation: Gabarit = {
  id: "liste-attente-confirmation",
  categorie: "transactionnel",
  resume: "Confirme l'adresse laissée sur la liste d'attente. Un clic, et c'est tout.",
  champs: [
    { nom: "prenom", genre: "texte", obligatoire: false, max: 60, role: "Le prénom, s'il est connu." },
    { nom: "url_confirmation", genre: "url", obligatoire: true, max: 400, role: "L'adresse qui porte le jeton. Construite côté serveur, jamais par le navigateur." },
  ],
  exemple: {
    prenom: "Jean",
    url_confirmation: "https://a-dispo.fr/confirmation?jeton=00000000-0000-0000-0000-000000000000",
  },
  rendre(d, c) {
    const url = d.url_confirmation;
    const blocs = [
      titre("Confirme ton inscription"),
      paragraphe(bonjour(d)),
      paragraphe(
        "Tu viens de laisser ton adresse pour être prévenu à l'ouverture. Dernière étape : confirme qu'elle est bien la tienne.",
      ),
      bouton("Je confirme mon inscription", url),
      lienEnClair(url),
      mention("Sans ce clic, on ne pourra pas te prévenir."),
      mention(
        "Si tu n'es pas à l'origine de cette demande, ignore ce message : rien ne sera confirmé, et tu ne recevras rien d'autre.",
      ),
    ];
    const texte = [
      "Confirme ton inscription",
      bonjour(d),
      "Tu viens de laisser ton adresse pour être prévenu à l'ouverture. Dernière étape : confirme qu'elle est bien la tienne.",
      "Confirme ici : " + url,
      "Sans ce clic, on ne pourra pas te prévenir.",
      "Si tu n'es pas à l'origine de cette demande, ignore ce message : rien ne sera confirmé, et tu ne recevras rien d'autre.",
    ];
    const p = pied(
      "Tu reçois ce message parce que cette adresse vient d'être laissée sur la liste d'attente d'À dispo.",
      c,
    );
    return {
      sujet: "Confirme ton inscription",
      html: documentHtml({ sujet: "Confirme ton inscription", apercu: "Un clic, et c'est réglé.", blocs, pied: p }),
      texte: documentTexte({ blocs: texte, pied: p }),
    };
  },
};

// ------------------------------------------------------------------ 2 sur 8

/**
 * LA BIENVENUE, APRES LA CONFIRMATION.
 *
 * SEUL GABARIT RELATIONNEL DES HUIT. Il part une fois le consentement acquis,
 * porte un lien de desabonnement, et `index.ts` refuse de l'envoyer si
 * l'identite de l'expediteur n'est pas configuree.
 *
 * CE QU'IL NE PROMET PAS. Ni date d'ouverture, ni departements retenus, ni
 * fonctionnalites : rien de tout cela n'est arrete. Promettre ici obligerait
 * a se dedire plus tard.
 */
const bienvenue: Gabarit = {
  id: "bienvenue",
  categorie: "relationnel",
  resume: "L'inscription est confirmée. Dit ce qu'on enverra, et rien de plus.",
  champs: [
    { nom: "prenom", genre: "texte", obligatoire: false, max: 60, role: "Le prénom, s'il est connu." },
    { nom: "departement", genre: "texte", obligatoire: false, max: 3, role: "Le département déclaré, pour dire qu'on l'a bien noté." },
    { nom: "url_desabonnement", genre: "url", obligatoire: true, max: 400, role: "Obligatoire : message relationnel." },
  ],
  exemple: {
    prenom: "Jean",
    departement: "69",
    url_desabonnement: "https://a-dispo.fr/desabonnement?jeton=00000000-0000-0000-0000-000000000000",
  },
  rendre(d, c) {
    const ou = d.departement ? ` dans le ${d.departement}` : "";
    const blocs = [
      titre("C'est confirmé"),
      paragraphe(bonjour(d)),
      paragraphe(`Ton inscription est enregistrée. On te préviendra dès que ça démarre${ou}.`),
      paragraphe("D'ici là, tu n'as rien à faire."),
      encadre(
        paragraphe("Ce que tu recevras :", false) +
          liste([
            "Un message le jour de l'ouverture près de chez toi.",
            "Rien d'autre : pas de publicité, pas de revente de ton adresse.",
          ]),
      ),
    ];
    const texte = [
      "C'est confirmé",
      bonjour(d),
      `Ton inscription est enregistrée. On te préviendra dès que ça démarre${ou}.`,
      "D'ici là, tu n'as rien à faire.",
      "Ce que tu recevras : un message le jour de l'ouverture près de chez toi. Rien d'autre : pas de publicité, pas de revente de ton adresse.",
    ];
    const p = pied(
      "Tu reçois ce message parce que tu as confirmé ton inscription à la liste d'attente d'À dispo.",
      c,
      d.url_desabonnement,
    );
    return {
      sujet: "C'est confirmé, tu es dans la liste",
      html: documentHtml({ sujet: "C'est confirmé, tu es dans la liste", apercu: "On te préviendra à l'ouverture.", blocs, pied: p }),
      texte: documentTexte({ blocs: texte, pied: p }),
    };
  },
};

// ------------------------------------------------------------------ 3 sur 8

/**
 * UNE DEMANDE DE MISE EN RELATION ARRIVE.
 *
 * LE MOT JUSTE. Une entreprise en cherche une autre pour un chantier, en
 * sous-traitance. Ce n'est ni une offre d'emploi, ni une mission d'interim :
 * le message le dit avec ses mots a lui, et le rappel de droit est dans
 * l'encadre pour que personne ne s'y trompe.
 */
const demandeRecue: Gabarit = {
  id: "demande-recue",
  categorie: "transactionnel",
  resume: "Une entreprise demande une mise en relation pour un chantier.",
  champs: [
    { nom: "prenom", genre: "texte", obligatoire: false, max: 60, role: "Le prénom du destinataire." },
    { nom: "entreprise_demandeuse", genre: "texte", obligatoire: true, max: 120, role: "La dénomination de l'entreprise qui demande." },
    { nom: "metier", genre: "texte", obligatoire: false, max: 60, role: "Le métier recherché." },
    { nom: "commune", genre: "texte", obligatoire: false, max: 80, role: "Où se trouve le chantier." },
    { nom: "periode", genre: "texte", obligatoire: false, max: 80, role: "Quand, en clair : « du 6 au 10 octobre »." },
    { nom: "url_demande", genre: "url", obligatoire: true, max: 400, role: "La page de la demande dans l'espace." },
  ],
  exemple: {
    prenom: "Jean",
    entreprise_demandeuse: "SARL Bertrand Couverture",
    metier: "Plombier",
    commune: "Villeurbanne",
    periode: "du 6 au 10 octobre",
    url_demande: "https://a-dispo.fr/demandes",
  },
  rendre(d, c) {
    const details: string[] = [];
    if (d.metier) details.push("Métier recherché : " + d.metier);
    if (d.commune) details.push("Chantier : " + d.commune);
    if (d.periode) details.push("Période : " + d.periode);

    const blocs = [
      titre("Une entreprise te cherche"),
      paragraphe(bonjour(d)),
      paragraphe(
        `<b>${echapper(d.entreprise_demandeuse)}</b> vient de t'envoyer une demande de mise en relation.`,
        true,
      ),
      details.length ? liste(details) : "",
      bouton("Voir la demande", d.url_demande),
      lienEnClair(d.url_demande),
      encadre(
        mention(
          "À dispo met deux entreprises en relation. Le contrat de sous-traitance, le prix et les assurances se règlent entre vous deux, directement.",
        ),
      ),
    ].filter(Boolean);

    const texte = [
      "Une entreprise te cherche",
      bonjour(d),
      `${d.entreprise_demandeuse} vient de t'envoyer une demande de mise en relation.`,
      ...details,
      "Voir la demande : " + d.url_demande,
      "À dispo met deux entreprises en relation. Le contrat de sous-traitance, le prix et les assurances se règlent entre vous deux, directement.",
    ];
    const p = pied(
      "Tu reçois ce message parce que ta fiche est publiée sur À dispo. C'est une notification liée au service.",
      c,
    );
    return {
      sujet: "Nouvelle demande de mise en relation",
      html: documentHtml({ sujet: "Nouvelle demande de mise en relation", apercu: `${d.entreprise_demandeuse} te cherche.`, blocs, pied: p }),
      texte: documentTexte({ blocs: texte, pied: p }),
    };
  },
};

// ------------------------------------------------------------------ 4 sur 8

/** LA DEMANDE EST ACCEPTEE. Le rappel de droit est ici aussi, et surtout ici :
 *  c'est le moment ou les deux entreprises vont s'engager. */
const demandeAcceptee: Gabarit = {
  id: "demande-acceptee",
  categorie: "transactionnel",
  resume: "L'entreprise sollicitée a accepté. La conversation s'ouvre.",
  champs: [
    { nom: "prenom", genre: "texte", obligatoire: false, max: 60, role: "Le prénom du destinataire." },
    { nom: "entreprise", genre: "texte", obligatoire: true, max: 120, role: "La dénomination de l'entreprise qui a accepté." },
    { nom: "url_conversation", genre: "url", obligatoire: true, max: 400, role: "La conversation, dans l'espace." },
  ],
  exemple: {
    prenom: "Jean",
    entreprise: "SARL Bertrand Couverture",
    url_conversation: "https://a-dispo.fr/demandes",
  },
  rendre(d, c) {
    const blocs = [
      titre("C'est accepté"),
      paragraphe(bonjour(d)),
      paragraphe(`<b>${echapper(d.entreprise)}</b> a accepté ta demande.`, true),
      paragraphe("Vous pouvez maintenant échanger directement."),
      bouton("Ouvrir la conversation", d.url_conversation),
      lienEnClair(d.url_conversation),
      encadre(
        mention(
          "La suite se règle entre vos deux entreprises : contrat de sous-traitance, prix, dates, attestations. À dispo ne prend pas part au contrat.",
        ),
      ),
    ];
    const texte = [
      "C'est accepté",
      bonjour(d),
      `${d.entreprise} a accepté ta demande.`,
      "Vous pouvez maintenant échanger directement.",
      "Ouvrir la conversation : " + d.url_conversation,
      "La suite se règle entre vos deux entreprises : contrat de sous-traitance, prix, dates, attestations. À dispo ne prend pas part au contrat.",
    ];
    const p = pied(
      "Tu reçois ce message parce que tu as envoyé cette demande depuis À dispo.",
      c,
    );
    return {
      sujet: "Ta demande est acceptée",
      html: documentHtml({ sujet: "Ta demande est acceptée", apercu: `${d.entreprise} a accepté.`, blocs, pied: p }),
      texte: documentTexte({ blocs: texte, pied: p }),
    };
  },
};

// ------------------------------------------------------------------ 5 sur 8

/**
 * LA DEMANDE EST REFUSEE.
 *
 * LE TON. Un refus n'est pas un echec personnel : un chantier tombe, un
 * planning bouge. Le message le dit en une ligne et propose la suite. Aucun
 * motif n'est invente : s'il n'a pas ete saisi, il n'apparait pas.
 *
 * LE BOUTON EST FACULTATIF, ET C'EST DELIBERE. Tant que la page de recherche
 * n'est pas en ligne, l'appelant n'envoie pas d'adresse et le message part
 * sans bouton. Mieux vaut un message sans bouton qu'un bouton vers une page
 * qui n'existe pas.
 */
const demandeRefusee: Gabarit = {
  id: "demande-refusee",
  categorie: "transactionnel",
  resume: "L'entreprise sollicitée n'a pas donné suite.",
  champs: [
    { nom: "prenom", genre: "texte", obligatoire: false, max: 60, role: "Le prénom du destinataire." },
    { nom: "entreprise", genre: "texte", obligatoire: true, max: 120, role: "La dénomination de l'entreprise qui a refusé." },
    { nom: "motif", genre: "texte", obligatoire: false, max: 300, role: "Le motif, seulement s'il a été écrit. Jamais inventé." },
    { nom: "url_recherche", genre: "url", obligatoire: false, max: 400, role: "La recherche. Absente tant que la page n'est pas en ligne : pas de bouton." },
  ],
  exemple: {
    prenom: "Jean",
    entreprise: "SARL Bertrand Couverture",
    motif: "Déjà pris sur cette période.",
    url_recherche: "https://a-dispo.fr/recherche",
  },
  rendre(d, c) {
    const blocs = [
      titre("Pas cette fois"),
      paragraphe(bonjour(d)),
      paragraphe(`<b>${echapper(d.entreprise)}</b> n'a pas donné suite à ta demande.`, true),
      d.motif ? encadre(mention("Ce qu'elle a répondu : " + echapper(d.motif))) : "",
      paragraphe("Ça arrive : un chantier tombe, un planning bouge. Ça ne dit rien de ta fiche."),
      d.url_recherche ? bouton("Chercher une autre entreprise", d.url_recherche) : "",
      d.url_recherche ? lienEnClair(d.url_recherche) : "",
    ].filter(Boolean);

    const texte = [
      "Pas cette fois",
      bonjour(d),
      `${d.entreprise} n'a pas donné suite à ta demande.`,
      d.motif ? "Ce qu'elle a répondu : " + d.motif : "",
      "Ça arrive : un chantier tombe, un planning bouge. Ça ne dit rien de ta fiche.",
      d.url_recherche ? "Chercher une autre entreprise : " + d.url_recherche : "",
    ].filter(Boolean);

    const p = pied(
      "Tu reçois ce message parce que tu as envoyé cette demande depuis À dispo.",
      c,
    );
    return {
      sujet: "Ta demande n'a pas abouti",
      html: documentHtml({ sujet: "Ta demande n'a pas abouti", apercu: "Une autre entreprise, une autre fois.", blocs, pied: p }),
      texte: documentTexte({ blocs: texte, pied: p }),
    };
  },
};

// ------------------------------------------------------------------ 6 sur 8

/**
 * UN MESSAGE EST ARRIVE.
 *
 * L'EXTRAIT EST FACULTATIF ET COURT. Recopier tout le message dans l'email
 * sort la conversation de la plateforme et la depose chez un fournisseur
 * d'envoi : moins on en sort, mieux c'est. 220 caracteres suffisent a savoir
 * si ca urge.
 */
const messageRecu: Gabarit = {
  id: "message-recu",
  categorie: "transactionnel",
  resume: "Un message est arrivé dans la messagerie.",
  champs: [
    { nom: "prenom", genre: "texte", obligatoire: false, max: 60, role: "Le prénom du destinataire." },
    { nom: "expediteur", genre: "texte", obligatoire: true, max: 120, role: "Qui écrit : entreprise ou prénom." },
    { nom: "extrait", genre: "texte", obligatoire: false, max: 500, role: "Le début du message. Coupé à 220 caractères dans l'email." },
    { nom: "url_conversation", genre: "url", obligatoire: true, max: 400, role: "La conversation, dans l'espace." },
  ],
  exemple: {
    prenom: "Jean",
    expediteur: "SARL Bertrand Couverture",
    extrait: "Bonjour, on serait sur le chantier de Villeurbanne à partir du 6. Vous êtes dispo le matin ?",
    url_conversation: "https://a-dispo.fr/demandes",
  },
  rendre(d, c) {
    const ex = d.extrait ? extrait(d.extrait) : "";
    const blocs = [
      titre("Nouveau message"),
      paragraphe(bonjour(d)),
      paragraphe(`<b>${echapper(d.expediteur)}</b> t'a écrit.`, true),
      ex ? encadre(paragraphe(echapper(ex), true)) : "",
      bouton("Lire et répondre", d.url_conversation),
      lienEnClair(d.url_conversation),
      mention("Réponds depuis la messagerie : ton numéro et ton adresse restent chez toi."),
    ].filter(Boolean);

    const texte = [
      "Nouveau message",
      bonjour(d),
      `${d.expediteur} t'a écrit.`,
      ex ? "« " + ex + " »" : "",
      "Lire et répondre : " + d.url_conversation,
      "Réponds depuis la messagerie : ton numéro et ton adresse restent chez toi.",
    ].filter(Boolean);

    const p = pied(
      "Tu reçois ce message parce qu'une conversation est ouverte avec toi sur À dispo.",
      c,
    );
    return {
      sujet: `Nouveau message de ${d.expediteur}`.slice(0, 120),
      html: documentHtml({ sujet: "Nouveau message", apercu: ex || "Un message t'attend.", blocs, pied: p }),
      texte: documentTexte({ blocs: texte, pied: p }),
    };
  },
};

// ------------------------------------------------------------------ 7 sur 8

/**
 * LE PAIEMENT A ECHOUE.
 *
 * AUCUN MONTANT. Le prix n'est pas arrete : ecrire une somme ici reviendrait
 * a l'inventer, et l'artisan la citerait.
 *
 * AUCUNE POLITIQUE DE RELANCE INVENTEE. Combien de tentatives, au bout de
 * combien de jours l'acces se coupe : rien de tout cela n'est tranche. Le
 * message dit donc ce qui est vrai (le paiement n'est pas passe, voici le
 * geste) et affiche une date de nouvelle tentative UNIQUEMENT si l'appelant
 * la fournit, parce que lui seul la connait.
 */
const paiementEchoue: Gabarit = {
  id: "paiement-echoue",
  categorie: "transactionnel",
  resume: "Le paiement de l'abonnement n'est pas passé, et ce qu'il faut faire.",
  champs: [
    { nom: "prenom", genre: "texte", obligatoire: false, max: 60, role: "Le prénom du destinataire." },
    { nom: "raison", genre: "texte", obligatoire: false, max: 200, role: "Ce que dit la banque, en clair. Seulement si on l'a." },
    { nom: "prochaine_tentative", genre: "texte", obligatoire: false, max: 80, role: "« le 20 octobre ». Seulement si l'appelant la connaît." },
    { nom: "url_paiement", genre: "url", obligatoire: true, max: 400, role: "Où mettre à jour le moyen de paiement." },
  ],
  exemple: {
    prenom: "Jean",
    raison: "Carte expirée.",
    prochaine_tentative: "le 20 octobre",
    url_paiement: "https://a-dispo.fr/espace",
  },
  rendre(d, c) {
    const blocs = [
      titre("Ton paiement n'est pas passé"),
      paragraphe(bonjour(d)),
      paragraphe("Le dernier paiement de ton abonnement a été refusé."),
      d.raison ? encadre(mention("Ce que dit la banque : " + echapper(d.raison))) : "",
      paragraphe("Ce qu'il faut faire : mettre à jour ton moyen de paiement. Deux minutes."),
      bouton("Mettre à jour mon paiement", d.url_paiement),
      lienEnClair(d.url_paiement),
      d.prochaine_tentative
        ? mention("Sans changement de ta part, une nouvelle tentative aura lieu " + d.prochaine_tentative + ".")
        : "",
      mention("Si tu penses que c'est une erreur, réponds à ce message."),
    ].filter(Boolean);

    const texte = [
      "Ton paiement n'est pas passé",
      bonjour(d),
      "Le dernier paiement de ton abonnement a été refusé.",
      d.raison ? "Ce que dit la banque : " + d.raison : "",
      "Ce qu'il faut faire : mettre à jour ton moyen de paiement. Deux minutes.",
      "Mettre à jour : " + d.url_paiement,
      d.prochaine_tentative
        ? "Sans changement de ta part, une nouvelle tentative aura lieu " + d.prochaine_tentative + "."
        : "",
      "Si tu penses que c'est une erreur, réponds à ce message.",
    ].filter(Boolean);

    const p = pied(
      "Tu reçois ce message parce qu'un paiement lié à ton abonnement À dispo a échoué.",
      c,
    );
    return {
      sujet: "Ton paiement n'est pas passé",
      html: documentHtml({ sujet: "Ton paiement n'est pas passé", apercu: "Deux minutes pour régulariser.", blocs, pied: p }),
      texte: documentTexte({ blocs: texte, pied: p }),
    };
  },
};

// ------------------------------------------------------------------ 8 sur 8

/**
 * LA FACTURE EST DISPONIBLE.
 *
 * AUCUN MONTANT DANS L'EMAIL. Il vit dans la facture, qui fait foi. Un
 * montant recopie dans un email est un montant qui finira par diverger de la
 * piece comptable, et c'est la piece comptable qui compte.
 *
 * L'ADRESSE : MIEUX VAUT CELLE DE L'ESPACE QUE CELLE DU FICHIER. Releve le
 * 13/09/2026 dans `crm/supabase/migration-abonnement-pieces.sql` : les
 * factures vivent dans un compartiment de stockage PRIVE. Une adresse de
 * telechargement est donc une adresse signee QUI EXPIRE, servie par le
 * domaine du projet Supabase et non par le notre. Collee dans un email, elle
 * devient un lien mort quelques jours plus tard, et l'artisan qui rouvre son
 * message six mois apres pour sa comptabilite tombe sur une erreur.
 * `index.ts` refuse d'ailleurs cet hote tant qu'il n'est pas declare dans
 * HOTES_LIENS : sans ce controle, la fonction serait un relais a hameconnage.
 */
const factureDisponible: Gabarit = {
  id: "facture-disponible",
  categorie: "transactionnel",
  resume: "Une facture est disponible. Le montant reste dans la facture.",
  champs: [
    { nom: "prenom", genre: "texte", obligatoire: false, max: 60, role: "Le prénom du destinataire." },
    { nom: "numero", genre: "texte", obligatoire: true, max: 40, role: "Le numéro de la facture." },
    { nom: "periode", genre: "texte", obligatoire: false, max: 80, role: "« septembre 2026 ». Seulement si elle est connue." },
    { nom: "url_facture", genre: "url", obligatoire: true, max: 400, role: "Où télécharger la facture." },
  ],
  exemple: {
    prenom: "Jean",
    numero: "2026-0042",
    periode: "septembre 2026",
    url_facture: "https://a-dispo.fr/espace",
  },
  rendre(d, c) {
    const quand = d.periode ? ` (${d.periode})` : "";
    const blocs = [
      titre("Ta facture est disponible"),
      paragraphe(bonjour(d)),
      paragraphe(`La facture n° ${echapper(d.numero)}${echapper(quand)} est prête.`, true),
      bouton("Voir ma facture", d.url_facture),
      lienEnClair(d.url_facture),
      mention("Garde-la : c'est une pièce comptable."),
    ];
    const texte = [
      "Ta facture est disponible",
      bonjour(d),
      `La facture n° ${d.numero}${quand} est prête.`,
      "Voir ma facture : " + d.url_facture,
      "Garde-la : c'est une pièce comptable.",
    ];
    const p = pied(
      "Tu reçois ce message parce qu'une facture liée à ton abonnement À dispo vient d'être émise.",
      c,
    );
    return {
      sujet: `Ta facture n° ${d.numero}`.slice(0, 120),
      html: documentHtml({ sujet: "Ta facture est disponible", apercu: "Elle est dans ton espace.", blocs, pied: p }),
      texte: documentTexte({ blocs: texte, pied: p }),
    };
  },
};

/** Le registre. C'est la seule porte d'entree : `index.ts` ne connait pas les
 *  gabarits un par un, il ne connait que cette table. */
export const GABARITS: Record<string, Gabarit> = {
  [listeAttenteConfirmation.id]: listeAttenteConfirmation,
  [bienvenue.id]: bienvenue,
  [demandeRecue.id]: demandeRecue,
  [demandeAcceptee.id]: demandeAcceptee,
  [demandeRefusee.id]: demandeRefusee,
  [messageRecu.id]: messageRecu,
  [paiementEchoue.id]: paiementEchoue,
  [factureDisponible.id]: factureDisponible,
};
