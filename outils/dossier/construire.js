// Assemble le dossier « a dispo » : marque + paiement, en un seul .docx.
const fs = require("fs");
const C = require("./commun");
const { D, t, p, h1, h2, encadre, tableau, puce, source,
        NUMEROTATION, ENCRE, ACCENT, GRIS, POLICE_TITRE, POLICE_TEXTE } = C;
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, PageBreak,
  Header, Footer, PageNumber, TableOfContents, BorderStyle, convertInchesToTwip,
} = D;

const partieProtections = require("./partie-protections");
const partieMarque = require("./partie-marque");
const partiePaiement = require("./partie-paiement");

const DATE = "20 septembre 2026";

// ------------------------------------------------------------ couverture
function couverture() {
  const bloc = (texte, o) => new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: o.after || 120 },
    children: [new TextRun({ text: texte, font: o.titre ? POLICE_TITRE : POLICE_TEXTE,
      size: o.size, bold: !!o.bold, color: o.color || ENCRE })],
  });
  return [
    new Paragraph({ spacing: { before: 2200, after: 0 }, children: [] }),
    bloc("A DISPO", { titre: true, size: 20, bold: true, color: ACCENT, after: 40 }),
    bloc("Deposer la marque, et choisir par qui encaisser", { titre: true, size: 52, bold: true, after: 200 }),
    new Paragraph({
      spacing: { after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 } },
      children: [],
    }),
    bloc("Dossier d'etude, " + DATE, { size: 24, color: GRIS, after: 500 }),
    bloc("Ce dossier reunit deux sujets qui conditionnent le lancement.", { size: 21, after: 100 }),
    new Paragraph({ numbering: { reference: "chiffres", level: 0 }, spacing: { after: 80 },
      children: [new TextRun({ text: "La protection juridique du projet, et la procedure exacte pour deposer la marque a l'INPI.", font: POLICE_TEXTE, size: 21 })] }),
    new Paragraph({ numbering: { reference: "chiffres", level: 0 }, spacing: { after: 400 },
      children: [new TextRun({ text: "Le choix du prestataire de paiement pour les abonnements, explique sans jargon et chiffre.", font: POLICE_TEXTE, size: 21 })] }),
    ...encadre("Comment lire ce dossier", [
      [t("Chaque chiffre porte sa source et la date a laquelle elle a ete lue.", { bold: true }), t(" Ce qui n'a pas pu etre verifie est ecrit « a verifier », et jamais comble par une valeur plausible.")],
      "Les FAITS issus des sources officielles, les INTERPRETATIONS et les RECOMMANDATIONS sont distingues partout.",
      [t("Ce dossier n'est pas une consultation juridique.", { bold: true }), t(" Le dernier chapitre dit precisement ou l'avis d'un conseil en propriete industrielle devient necessaire.")],
    ]),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ------------------------------------------------------------ resume
function resume() {
  const o = [];
  const A = (...x) => o.push(...x.flat());
  A(h1("Resume executif"));

  A(h2("Sur la marque"));
  A(puce([t("Une idee ne se protege pas.", { bold: true }), t(" Ce qui se protege, c'est le NOM (par la marque), la FORME de ce qu'on ecrit (par le droit d'auteur, automatiquement) et ce qu'on verrouille par CONTRAT. Le concept lui-meme est copiable, legalement.")]));
  A(puce([t("Le depot de marque francaise coute "), t("190 euros pour une classe, plus 40 euros par classe", { bold: true }), t(", et protege dix ans, renouvelables sans limite. Pour trois classes : 270 euros.")]));
  A(puce([t("Il y a un probleme serieux sur le nom.", { bold: true, color: "9A3208" }), t(" « a dispo » est l'abreviation de « a disposition », et le service vend justement de la mise a disposition. L'article L711-2 du code de la propriete intellectuelle refuse les signes qui decrivent une caracteristique du service. Ce point est developpe au chapitre 5, et il doit etre tranche AVANT de payer.")]));
  A(puce([t("L'e-Soleau (15 euros) ne protege rien : elle "), t("prouve une date", { bold: true }), t(". Elle est utile, elle n'est pas prioritaire.")]));

  A(h2("Sur le paiement"));
  A(puce([t("La vraie question n'est pas « BNP ou Stripe », mais "), t("carte ou prelevement", { bold: true }), t(", et "), t("acheter le carnet de comptes ou l'ecrire", { bold: true }), t(". Ces deux choix pesent bien plus lourd que le nom du prestataire.")]));
  A(puce([t("BNP Axepta vend la caisse, pas le carnet : ni abonnement recurrent gere, ni facture, ni relance d'impaye. "), t("Environ 20 jours de developpement", { bold: true }), t(" a prevoir, soit 6 000 euros.")]));
  A(puce([t("Le prelevement SEPA coute "), t("0,35 euro fixe chez Stripe", { bold: true }), t(", contre 0,91 a 1,06 euro pour une carte avec Billing. Trois fois moins cher, et l'abonnement ne meurt plus quand une carte expire.")]));
  A(puce([t("Sur cinq ans : Stripe en prelevement 41 070 euros, BNP 48 252, Stripe carte avec Billing 106 541. "), t("Comme le carnet est a ecrire des deux cotes, BNP ne rattrape jamais Stripe en prelevement.", { bold: true })]));

  A(h2("Les trois choses a faire cette semaine"));
  A(tableau(
    ["Quoi", "Aupres de qui", "Pourquoi maintenant"],
    [
      [{ texte: "Trancher le nom", bold: true }, "Conseil en propriete industrielle", "Le risque de refus pour caractere descriptif se traite AVANT le depot, pas apres. Une consultation coute moins cher qu'un depot perdu."],
      [{ texte: "Poser la question n 1 a la BNP", bold: true }, "Ton conseiller", "Savoir si les taux annonces sont tout compris. La reponse fait basculer toute la comparaison."],
      [{ texte: "Deposer une e-Soleau", bold: true }, "inpi.fr, en ligne", "15 euros, une heure de travail. Elle date les maquettes et l'architecture avant toute presentation a un tiers."],
    ], [24, 26, 50]));
  A(new Paragraph({ children: [new PageBreak()] }));
  return o;
}

// ------------------------------------------------------------ document
const doc = new Document({
  creator: "Joan Aglave",
  title: "a dispo : deposer la marque, et choisir par qui encaisser",
  description: "Dossier d'etude du 20 septembre 2026",
  numbering: NUMEROTATION,
  styles: {
    default: {
      document: { run: { font: POLICE_TEXTE, size: 21, color: ENCRE } },
    },
  },
  sections: [{
    properties: {
      page: { margin: { top: convertInchesToTwip(0.9), bottom: convertInchesToTwip(0.9),
                        left: convertInchesToTwip(0.85), right: convertInchesToTwip(0.85) } },
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D8D4CC", space: 4 } },
        children: [new TextRun({ text: "a dispo  |  dossier du " + DATE,
          font: POLICE_TEXTE, size: 16, color: GRIS })],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " sur ", PageNumber.TOTAL_PAGES],
          font: POLICE_TEXTE, size: 16, color: GRIS })],
      })] }),
    },
    children: [
      ...couverture(),
      new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 160 },
        children: [new TextRun({ text: "Sommaire", font: POLICE_TITRE, size: 32, bold: true, color: ENCRE })] }),
      new TableOfContents("Sommaire", { hyperlink: true, headingStyleRange: "1-3" }),
      new Paragraph({ children: [new PageBreak()] }),
      ...resume(),
      ...partieProtections(),
      ...partieMarque(),
      new Paragraph({ children: [new PageBreak()] }),
      ...partiePaiement(),
    ],
  }],
});

Packer.toBuffer(doc).then((b) => {
  const sortie = process.argv[2] || "dossier.docx";
  fs.writeFileSync(sortie, b);
  console.log("ecrit :", sortie, Math.round(b.length / 1024), "Ko");
});
