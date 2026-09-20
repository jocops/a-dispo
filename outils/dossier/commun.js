// Briques communes du document « a dispo ». Aucune donnee ici : rien que la forme.
const D = require("docx");
const {
  Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PositionalTab, PositionalTabAlignment,
  PositionalTabLeader, LevelFormat, convertInchesToTwip,
} = D;

// Largeur utile d'une A4 avec des marges de 1 pouce : 11906 - 2 x 1440.
const UTILE = 9026;

const ENCRE = "191512";
const ACCENT = "890026";   // le rouge de la charte ne porte JAMAIS une lettre : ici on
                           // prend sa variante lettre, mesuree a 9,15 sur du papier
const GRIS = "5E5A56";
const VOILE = "F2EEE6";
const VOILE_2 = "EAE6DC";

const POLICE_TITRE = "Arial";   // pas de police exotique : le fichier doit s'ouvrir partout
const POLICE_TEXTE = "Calibri";

function t(texte, o = {}) {
  return new TextRun({ text: texte, font: o.mono ? "Consolas" : POLICE_TEXTE,
    size: o.size || 21, bold: !!o.bold, italics: !!o.it,
    color: o.color || ENCRE, break: o.break || 0 });
}

function p(texte, o = {}) {
  const runs = Array.isArray(texte) ? texte : [t(texte, o)];
  return new Paragraph({
    children: runs,
    spacing: { after: o.after === undefined ? 140 : o.after, line: 276 },
    alignment: o.align || AlignmentType.LEFT,
    indent: o.indent,
    border: o.border,
    shading: o.shading,
  });
}

function h1(texte) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 380, after: 180 },
    children: [new TextRun({ text: texte, font: POLICE_TITRE, size: 32, bold: true, color: ENCRE })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: ACCENT, space: 6 } },
  });
}
function h2(texte) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 130 },
    children: [new TextRun({ text: texte, font: POLICE_TITRE, size: 25, bold: true, color: ENCRE })],
  });
}
function h3(texte) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3, spacing: { before: 220, after: 100 },
    children: [new TextRun({ text: texte, font: POLICE_TITRE, size: 22, bold: true, color: ACCENT })],
  });
}

// Encadre : un tableau d'UNE cellule, et non un paragraphe borde.
// POURQUOI. docx-js serialise les bordures de paragraphe dans l'ordre
// haut / bas / gauche / droite, alors que le schema OOXML impose
// haut / gauche / bas / droite. Le fichier produit etait invalide, et
// l'ordre des clefs de l'objet n'y change rien : c'est la bibliotheque qui
// decide. Un tableau, lui, sort ses bordures dans le bon ordre.
function encadre(titre, lignes, couleur) {
  const c = couleur || ACCENT;
  const corps = [new Paragraph({
    children: [new TextRun({ text: titre, font: POLICE_TITRE, size: 21, bold: true, color: c })],
    spacing: { after: 100, line: 264 },
  })];
  lignes.forEach((l, i) => corps.push(new Paragraph({
    children: Array.isArray(l) ? l : [t(l)],
    spacing: { after: i === lignes.length - 1 ? 0 : 90, line: 276 },
  })));

  const trait = (taille) => ({ style: BorderStyle.SINGLE, size: taille, color: c });
  // On rend une LISTE : les appelants l'etalent, et le paragraphe vide qui suit
  // empeche deux encadres consecutifs de se souder en un seul tableau.
  return [new Table({
    columnWidths: [UTILE],
    width: { size: UTILE, type: WidthType.DXA },
    margins: { top: 130, left: 170, bottom: 130, right: 150 },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: UTILE, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: VOILE },
      children: corps,
    })] })],
    borders: {
      top: trait(4), left: trait(24), bottom: trait(4), right: trait(4),
      insideHorizontal: { style: BorderStyle.NONE, size: 0 },
      insideVertical: { style: BorderStyle.NONE, size: 0 },
    },
  }), new Paragraph({ spacing: { after: 220 }, children: [] })];
}

// Tableau : largeurs en DXA des deux cotes, sans quoi Google Docs casse la mise en page.
function tableau(entetes, lignes, parts) {
  const total = parts.reduce((a, b) => a + b, 0);
  const cols = parts.map((x) => Math.round(UTILE * x / total));
  cols[cols.length - 1] = UTILE - cols.slice(0, -1).reduce((a, b) => a + b, 0);

  const cellule = (contenu, i, opt = {}) => new TableCell({
    width: { size: cols[i], type: WidthType.DXA },
    shading: opt.fill ? { type: ShadingType.CLEAR, fill: opt.fill } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [new Paragraph({
      alignment: opt.droite ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { after: 0, line: 252 },
      children: Array.isArray(contenu) ? contenu
        : [new TextRun({ text: String(contenu), font: opt.mono ? "Consolas" : POLICE_TEXTE,
            size: opt.size || 19, bold: !!opt.bold, color: opt.color || ENCRE })],
    })],
  });

  const rows = [new TableRow({
    tableHeader: true,
    children: entetes.map((e, i) => cellule(e, i, { bold: true, fill: VOILE_2, size: 18 })),
  })];
  lignes.forEach((l, n) => rows.push(new TableRow({
    children: l.map((c, i) => {
      const o = typeof c === "object" && !Array.isArray(c) && c.texte !== undefined ? c : { texte: c };
      return cellule(o.texte, i, {
        bold: o.bold, droite: o.droite, mono: o.mono, color: o.color,
        fill: o.fill || (n % 2 ? "FBF9F5" : undefined),
      });
    }),
  })));

  return new Table({
    columnWidths: cols, width: { size: UTILE, type: WidthType.DXA }, rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "C9C4BA" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "C9C4BA" },
      left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DDD8CE" },
      insideVertical: { style: BorderStyle.NONE, size: 0 },
    },
  });
}

// Puces : jamais un « • » tape a la main, sinon Word ne sait pas l'indenter.
const NUMEROTATION = {
  config: [
    { reference: "puces", levels: [
      { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 220 } } } },
      { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 820, hanging: 220 } } } },
    ]},
    { reference: "chiffres", levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 220 } } } },
    ]},
  ],
};

function puce(texte, niveau = 0) {
  return new Paragraph({
    numbering: { reference: "puces", level: niveau },
    children: Array.isArray(texte) ? texte : [t(texte)],
    spacing: { after: 70, line: 264 },
  });
}
function etape(texte) {
  return new Paragraph({
    numbering: { reference: "chiffres", level: 0 },
    children: Array.isArray(texte) ? texte : [t(texte)],
    spacing: { after: 80, line: 264 },
  });
}

// Une source, en petit et en gris, juste sous ce qu'elle appuie.
function source(texte) {
  return new Paragraph({
    children: [new TextRun({ text: texte, font: POLICE_TEXTE, size: 16, color: GRIS, italics: true })],
    spacing: { after: 160, line: 240 },
  });
}

module.exports = { D, UTILE, ENCRE, ACCENT, GRIS, VOILE, VOILE_2,
  POLICE_TITRE, POLICE_TEXTE, t, p, h1, h2, h3, encadre, tableau,
  NUMEROTATION, puce, etape, source };
