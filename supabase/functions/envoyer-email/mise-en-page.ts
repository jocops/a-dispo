// ============================================================
// LA MISE EN PAGE DES EMAILS : une seule, pour les huit gabarits.
//
// POURQUOI UN FICHIER A PART. Un gabarit qui porte sa propre mise en page
// derive : au huitieme, les marges ne sont plus les memes et la marque a
// quatre bleus differents. Ici, un seul document, une seule palette, et les
// gabarits ne fournissent que des blocs.
//
// POURQUOI DES TABLEAUX ET DES STYLES EN LIGNE. Ce n'est pas du retard
// technique : Outlook sur Windows rend le HTML avec le moteur de Word, qui
// ignore flex, grid et une bonne partie des feuilles de style. Un email n'est
// pas une page web, et le construire comme une page web produit une colonne
// unique de 1 200 px de large chez un tiers des destinataires.
//
// POURQUOI AUCUNE IMAGE. Les images sont bloquees par defaut chez beaucoup de
// clients, et un logo absent laisse un carre vide en haut du message. Le
// mot-marque est ecrit en texte : il s'affiche toujours, il se lit a la voix
// haute, et il ne pese rien.
//
// POURQUOI PAS DE SIGNIKA NI DE KARLA. Les polices distantes ne se chargent
// pas dans un client de messagerie (Gmail les retire, Outlook ne les demande
// jamais). Ecrire un @font-face donnerait un rendu different de celui teste.
// On prend la pile systeme, qui est la meme partout et qui ne ment pas.
//
// LES CONTRASTES, MESURES LE 13/09/2026 (WCAG 2.1, seuil AA = 4,5:1) :
//   creme  #F2EAD8 sur nuit    #0C1421 : 15,41:1
//   creme  #F2EAD8 sur carte   #111C2E : 14,26:1
//   ambre  #E8B93E sur carte   #111C2E :  9,31:1
//   nuit   #111C2E sur ambre   #E8B93E :  9,31:1   (le texte du bouton)
//   gris   #A9B6C6 sur carte   #111C2E :  8,29:1   (les mentions du pied)
//   creme  #F2EAD8 sur surface #22344F : 10,49:1   (les encadres)
// Tous au-dessus de 4,5:1, le plus faible a 8,29:1.
// ============================================================

/** La palette de la marque, relevee sur `espace/index.html` le 13/09/2026. */
export const COULEURS = {
  nuit: "#0C1421",
  carte: "#111C2E",
  surface: "#22344F",
  creme: "#F2EAD8",
  cremeGris: "#A9B6C6",
  ambre: "#E8B93E",
  vert: "#4FD08A",
  alerte: "#F0A08A",
  // L'equivalent OPAQUE de --line, rgba(242,234,216,.10) posee sur #111C2E.
  // Calcule, pas devine : 0,9 x (17,28,46) + 0,1 x (242,234,216) = (40,49,63).
  // Outlook ignore rgba() sur une bordure et la rend noire.
  ligne: "#28313F",
} as const;

/** La pile de polices systeme. Aucune police distante : voir l'en-tete. */
const POLICES =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Echappe ce qui part dans du HTML. Tout ce qui vient de la base y passe. */
export function echapper(valeur: unknown): string {
  return String(valeur == null ? "" : valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Un titre de niveau 1. Un seul par email : c'est ce que lit d'abord une
 * personne qui parcourt ses messages sur un telephone, debout.
 */
export function titre(texte: string): string {
  return `<h1 style="margin:0 0 14px;font-family:${POLICES};font-size:24px;line-height:1.2;font-weight:700;color:${COULEURS.creme};">${echapper(texte)}</h1>`;
}

/**
 * Un paragraphe. `html` a true quand le gabarit a deja echappe lui-meme et
 * pose ses propres balises fortes (un nom d'entreprise en gras, par exemple).
 */
export function paragraphe(texte: string, html = false): string {
  return `<p style="margin:0 0 14px;font-family:${POLICES};font-size:16px;line-height:1.6;color:${COULEURS.creme};">${html ? texte : echapper(texte)}</p>`;
}

/** Une ligne discrete : precision, rappel, mention. */
export function mention(texte: string, html = false): string {
  return `<p style="margin:0 0 12px;font-family:${POLICES};font-size:13px;line-height:1.55;color:${COULEURS.cremeGris};">${html ? texte : echapper(texte)}</p>`;
}

/**
 * Le bouton d'action.
 *
 * MOBILE D'ABORD. 16 px de marge haute et basse plus 20 px de ligne font une
 * cible de 52 px de haut : au-dessus des 44 px recommandes pour un pouce, et
 * l'artisan tient son telephone d'une main.
 *
 * Le coin arrondi est ignore par Outlook sur Windows, qui rendra un rectangle.
 * C'est acceptable : le bouton reste cliquable et lisible, et le contourner
 * demanderait du balisage conditionnel VML que personne ne saura maintenir.
 */
export function bouton(libelle: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;">
  <tr><td style="border-radius:999px;background:${COULEURS.ambre};">
    <a href="${echapper(url)}" style="display:inline-block;padding:16px 28px;font-family:${POLICES};font-size:16px;line-height:20px;font-weight:700;color:${COULEURS.carte};text-decoration:none;border-radius:999px;">${echapper(libelle)}</a>
  </td></tr>
</table>`;
}

/**
 * Le lien ecrit en clair, juste sous le bouton.
 *
 * POURQUOI IL EST OBLIGATOIRE DES QU'IL Y A UN BOUTON. Un client de
 * messagerie qui n'affiche pas le HTML, un copier-coller vers un autre
 * telephone, un bouton qui ne reagit pas : sans l'adresse ecrite, la personne
 * est bloquee et nous ecrit. Avec, elle se debloque seule.
 */
export function lienEnClair(url: string): string {
  return `<p style="margin:0 0 18px;font-family:${POLICES};font-size:12px;line-height:1.5;color:${COULEURS.cremeGris};word-break:break-all;">Le bouton ne marche pas&nbsp;? Copie cette adresse&nbsp;:<br><a href="${echapper(url)}" style="color:${COULEURS.ambre};">${echapper(url)}</a></p>`;
}

/** Un encadre pour ce qui doit ressortir : un extrait, un rappel de droit. */
export function encadre(contenuHtml: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;background:${COULEURS.surface};border:1px solid ${COULEURS.ligne};border-radius:14px;">
  <tr><td style="padding:14px 16px;font-family:${POLICES};font-size:15px;line-height:1.55;color:${COULEURS.creme};">${contenuHtml}</td></tr>
</table>`;
}

/** Une liste a puces. Rien de plus que des puces : les emojis se rendent mal. */
export function liste(points: string[]): string {
  const items = points
    .map(
      (p) =>
        `<li style="margin:0 0 7px;">${echapper(p)}</li>`,
    )
    .join("");
  return `<ul style="margin:0 0 16px;padding-left:20px;font-family:${POLICES};font-size:16px;line-height:1.6;color:${COULEURS.creme};">${items}</ul>`;
}

export interface PiedDePage {
  /** Pourquoi cette personne recoit ce message. Jamais vide. */
  pourquoi: string;
  /** L'adresse de desabonnement. Absente pour un message de service. */
  urlDesabonnement?: string;
  /** Raison sociale, forme, adresse postale. Vient de la configuration. */
  mentions?: string;
}

/**
 * Le document complet.
 *
 * CE QUE LE PIED PORTE, ET CE QU'IL NE PORTE PAS. Il dit toujours POURQUOI le
 * message arrive : c'est la premiere chose que cherche une personne qui se
 * demande si elle s'est fait inscrire de force. Il ne porte AUCUNE phrase qui
 * decrit le service : tant que la marque n'est pas deposee a l'INPI, rien de
 * ce qui sort ne raconte le concept (meme regle que `outils/build.py`, qui
 * retire la balise meta description).
 */
export function document(options: {
  sujet: string;
  /** Le texte gris affiche par Gmail a cote de l'objet. */
  apercu: string;
  blocs: string[];
  pied: PiedDePage;
}): string {
  const { sujet, apercu, blocs, pied } = options;

  const desabo = pied.urlDesabonnement
    ? `<p style="margin:8px 0 0;font-family:${POLICES};font-size:12px;line-height:1.5;color:${COULEURS.cremeGris};"><a href="${echapper(pied.urlDesabonnement)}" style="color:${COULEURS.cremeGris};text-decoration:underline;">Me désinscrire</a>, en un clic, sans avoir à écrire à personne.</p>`
    : "";

  const mentions = pied.mentions
    ? `<p style="margin:8px 0 0;font-family:${POLICES};font-size:12px;line-height:1.5;color:${COULEURS.cremeGris};">${echapper(pied.mentions)}</p>`
    : "";

  return `<!doctype html>
<html lang="fr" style="margin:0;padding:0;">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${echapper(sujet)}</title>
<style>
  /* Le seul bloc de style du document, et il ne porte que ce qui ne peut pas
     s'ecrire en ligne : la requete de media, et le reglage sombre. Tout le
     reste est en attribut style, parce que Gmail retire les feuilles de
     style sur certains clients. */
  :root { color-scheme: dark; supported-color-schemes: dark; }
  @media (max-width: 480px) {
    .cadre { padding: 18px 16px !important; }
    .colonne { padding: 0 12px !important; }
  }
  /* Certains clients respectent la demande d'animation reduite. On n'anime
     rien du tout : c'est la seule maniere sure de la respecter partout. */
</style>
</head>
<body style="margin:0;padding:0;background:${COULEURS.nuit};">
  <!-- L'apercu. Cache a l'ecran, lu par la liste des messages. Les espaces
       insecables qui suivent empechent le client d'y coller le debut du
       corps, ce qui donnait des apercus tronques au milieu d'un mot. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${echapper(apercu)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COULEURS.nuit};">
    <tr>
      <td align="center" class="colonne" style="padding:24px 16px 40px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
          <!-- Le mot-marque, en texte. Le « à » en ambre, comme sur le site. -->
          <tr><td style="padding:0 0 16px;font-family:${POLICES};font-size:20px;font-weight:700;color:${COULEURS.creme};">
            <span style="color:${COULEURS.ambre};">à</span> dispo
          </td></tr>

          <tr><td class="cadre" style="padding:26px 28px;background:${COULEURS.carte};border:1px solid ${COULEURS.ligne};border-radius:18px;">
${blocs.join("\n")}
          </td></tr>

          <tr><td style="padding:18px 6px 0;">
            <p style="margin:0;font-family:${POLICES};font-size:12px;line-height:1.5;color:${COULEURS.cremeGris};">${echapper(pied.pourquoi)}</p>
            ${desabo}
            ${mentions}
          </td></tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Le repli texte.
 *
 * POURQUOI IL N'EST PAS FACULTATIF. Un message envoye en HTML seul part plus
 * souvent dans les indesirables, et il est illisible sur une montre, sur un
 * lecteur d'ecran mal configure et dans un client en mode texte. Il est ecrit
 * a la main dans chaque gabarit, pas genere en retirant les balises : une
 * traduction automatique donne des phrases coupees et des adresses perdues.
 *
 * Les lignes sont coupees a 72 caracteres, sauf les adresses, qu'on ne coupe
 * jamais : une adresse coupee n'est plus cliquable.
 */
export function documentTexte(options: {
  blocs: string[];
  pied: PiedDePage;
}): string {
  const corps = options.blocs.map((b) => couper(b, 72)).join("\n\n");
  const bas = [options.pied.pourquoi];
  if (options.pied.urlDesabonnement) {
    bas.push("Me désinscrire : " + options.pied.urlDesabonnement);
  }
  if (options.pied.mentions) bas.push(options.pied.mentions);

  return (
    "à dispo\n\n" +
    corps +
    "\n\n-- \n" +
    bas.map((l) => couper(l, 72)).join("\n")
  );
}

/** Coupe un texte a la largeur voulue sans jamais couper une adresse. */
function couper(texte: string, largeur: number): string {
  return texte
    .split("\n")
    .map((ligne) => {
      const mots = ligne.split(" ");
      const sorties: string[] = [];
      let courante = "";
      for (const mot of mots) {
        if (courante === "") courante = mot;
        else if (courante.length + 1 + mot.length <= largeur) courante += " " + mot;
        else {
          sorties.push(courante);
          courante = mot;
        }
      }
      if (courante !== "") sorties.push(courante);
      return sorties.join("\n");
    })
    .join("\n");
}
