// PARTIE 1, chapitres 1 a 3 : peut-on proteger une idee, et quelles protections existent.
const C = require("./commun");
const { t, p, h1, h2, h3, encadre, tableau, puce, source } = C;

module.exports = function partieProtections() {
  const o = [];
  const A = (...x) => o.push(...x.flat());

  A(h1("Partie 1. Proteger le projet"));

  // ================================================================= 1
  A(h2("1. Peut-on proteger une idee ? Non."));
  A(p([t("C'est le principe le plus important de toute cette partie, et le plus mal connu : "), t("une idee n'est protegeable par personne, nulle part, jamais.", { bold: true }), t(" Le droit francais ne protege pas ce qu'on pense, il protege ce qu'on a MIS EN FORME et ce qu'on a DEPOSE.")]));
  A(p("« Une plateforme ou des artisans se passent des chantiers quand ils sont surcharges » est une idee. Elle peut etre reprise demain matin par n'importe qui, legalement. Ce qui se protege, ce sont les objets concrets qui la realisent."));

  A(h3("Ce qui se protege, et ce qui ne se protege pas"));
  A(tableau(
    ["L'objet", "Protegeable ?", "Par quoi, et a quelle condition"],
    [
      [{ texte: "L'idee", bold: true }, { texte: "NON", bold: true, color: "9A3208" }, "Rien. De libre parcours. Seul un contrat de confidentialite peut en limiter la circulation, et seulement entre les signataires."],
      [{ texte: "Le concept", bold: true }, { texte: "NON", bold: true, color: "9A3208" }, "Un concept n'est qu'une idee mieux habillee. Meme sort."],
      ["La methode commerciale", { texte: "NON", bold: true, color: "9A3208" }, "Une facon de faire des affaires n'est ni une invention brevetable ni une oeuvre."],
      [{ texte: "Le nom", bold: true }, { texte: "OUI", bold: true, color: "116B40" }, "Le depot de marque. C'est LA protection centrale d'un projet comme celui-ci."],
      ["L'identite visuelle (logo, charte)", { texte: "OUI", bold: true, color: "116B40" }, "Droit d'auteur des la creation si elle est originale, et marque semi-figurative si le logo est depose avec le nom."],
      ["Les maquettes et l'interface", { texte: "OUI", bold: true, color: "116B40" }, "Droit d'auteur sur la FORME (dessins, textes, agencement) si elle est originale. Pas sur la fonction."],
      [{ texte: "Le logiciel", bold: true }, { texte: "OUI", bold: true, color: "116B40" }, "Droit d'auteur, automatiquement : le code source, le code objet et le materiel de conception preparatoire. Article L112-2 13 du code de la propriete intellectuelle."],
      ["Les fonctionnalites du logiciel", { texte: "NON", bold: true, color: "9A3208" }, "Un concurrent peut refaire les MEMES fonctions avec son propre code, legalement. Seule l'ecriture est protegee, pas ce qu'elle fait."],
      [{ texte: "La base de donnees", bold: true }, { texte: "OUI", bold: true, color: "116B40" }, "Deux protections cumulables : droit d'auteur sur la structure si elle est originale, et droit du producteur si la constitution a demande un investissement substantiel. Article L341-1."],
      ["Le savoir-faire", { texte: "EN PARTIE", bold: true }, "Secret des affaires, a condition de prendre des mesures de protection reelles, et contrats de confidentialite."],
      ["Une invention technique", { texte: "SOUS CONDITION", bold: true }, "Le brevet, si l'invention est nouvelle, inventive et a effet technique. Un logiciel « en tant que tel » est exclu."],
    ], [26, 17, 57]));
  A(source("Sources : code de la propriete intellectuelle, art. L112-2 (legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278875), L112-3, L341-1 (LEGIARTI000006279245), consultes le 20/09/2026."));

  A(encadre("La consequence pratique, a accepter", [
    [t("Personne ne peut t'empecher de te faire copier le concept."), t(" Ce qui te protege reellement est ailleurs : le NOM, sous lequel le marche te reconnaitra, et l'AVANCE que tu prends.")],
    [t("C'est pourquoi la marque est la priorite, et non l'e-Soleau.", { bold: true }), t(" L'e-Soleau prouve une date, elle n'interdit rien a personne.")],
  ]));

  // ================================================================= 2
  A(h2("2. Reformulation du projet, en termes prudents"));
  A(p("La description ci-dessous est une formulation professionnelle du projet. Elle sert a remplir des formulaires, a parler a un avocat ou a un financeur. Elle ne constitue par elle-meme AUCUNE protection."));
  A(p([t("« Service de mise en relation, par voie electronique, entre professionnels independants du secteur du batiment, permettant a un professionnel confronte a une indisponibilite, a une surcharge d'activite ou a une demande qu'il ne peut traiter, d'identifier d'autres professionnels susceptibles d'executer tout ou partie de la prestation ou d'y collaborer, en fonction de leurs disponibilites declarees, de leurs qualifications et de leur zone d'intervention. »", { it: true })]));
  A(encadre("Une precaution de vocabulaire qui n'est pas cosmetique", [
    [t("N'ecris jamais que la plateforme « met a disposition de la main d'oeuvre », « fournit du personnel » ou « prete des salaries ». Le pret de main d'oeuvre a but lucratif est interdit par l'article L8241-1 du code du travail.", {})],
    [t("La formulation juste est : mise en relation entre entreprises independantes, en vue d'une SOUS-TRAITANCE. Chacun reste son propre employeur et facture sa prestation.", { bold: true })],
    "Cette precaution vaut pour le site, les conditions generales, la plaquette commerciale et le libelle depose a l'INPI.",
  ], "9A3208"));

  // ================================================================= 3
  A(h2("3. Les protections disponibles, comparees"));
  A(p("Sept protections sont envisageables. Trois seulement comptent vraiment ici."));

  A(tableau(
    ["Protection", "Ce qu'elle protege", "Duree", "Cout", "Interet ici"],
    [
      [{ texte: "Marque INPI", bold: true }, "Le nom et le logo, pour les services designes, sur le territoire francais", "10 ans, renouvelable sans limite", "190 EUR (1 classe) + 40 EUR par classe", { texte: "ESSENTIEL", bold: true, color: "116B40" }],
      [{ texte: "Droit d'auteur", bold: true }, "Le code, les textes, les maquettes, le logo, si originaux. Automatique, sans depot", "Vie de l'auteur + 70 ans", "Gratuit", { texte: "ACQUIS", bold: true, color: "116B40" }],
      [{ texte: "e-Soleau", bold: true }, "Rien. Elle PROUVE une date de possession", "5, 10, 15 ou 20 ans", "15 EUR jusqu'a 50 Mo, par periode de 5 ans", { texte: "UTILE", bold: true }],
      ["Droit du producteur de base de donnees", "Le contenu de la base, si sa constitution a demande un investissement substantiel", "15 ans, repart a chaque nouvel investissement substantiel", "Gratuit, automatique", "Utile plus tard, quand la base d'artisans aura de la valeur"],
      ["Dessins et modeles", "L'apparence d'un produit", "5 ans, renouvelable jusqu'a 25", "39 EUR + reproductions", { texte: "PEU PERTINENT", color: "5E5A56" }],
      ["Brevet", "Une invention technique nouvelle", "20 ans", "Environ 600 EUR de taxes + conseil, souvent plusieurs milliers", { texte: "NON PERTINENT", color: "5E5A56" }],
      [{ texte: "Contrats et confidentialite", bold: true }, "Ce que les signataires acceptent de ne pas divulguer ou reutiliser", "Ce que le contrat prevoit", "Le temps de redaction", { texte: "ESSENTIEL", bold: true, color: "116B40" }],
    ], [17, 27, 17, 21, 18]));
  A(source("Tarifs marque : bareme INPI applicable au 2 juillet 2026. Tarifs e-Soleau : inpi.fr, service e-Soleau. Le tarif dessins et modeles est donne a titre indicatif et reste a confirmer."));

  A(h3("Pourquoi le brevet ne sert a rien ici"));
  A(p("Un brevet protege une invention technique. Or le code de la propriete intellectuelle exclut expressement de la brevetabilite les programmes d'ordinateur « en tant que tels » et les methodes dans l'exercice d'activites economiques. Une plateforme de mise en relation, aussi bien concue soit-elle, tombe dans ces deux exclusions. Un brevet couterait cher pour etre refuse."));

  A(h3("Pourquoi les contrats comptent autant que la marque"));
  A(p("C'est la protection la plus sous-estimee, et la seule qui couvre ce que la propriete intellectuelle laisse a decouvert :"));
  A(puce([t("Avec un prestataire ou un developpeur : une "), t("clause de cession de droits", { bold: true }), t(". Sans elle, celui qui a ecrit le code en reste titulaire. Le droit d'auteur ne se transfere pas tout seul parce qu'on a paye une facture.")]));
  A(puce([t("Avec un associe, un investisseur ou un partenaire : un "), t("accord de confidentialite", { bold: true }), t(" signe AVANT la presentation, pas apres.")]));
  A(puce([t("Avec les utilisateurs : des "), t("conditions generales", { bold: true }), t(" qui interdisent l'extraction de la base d'artisans, et qui rappellent que chaque professionnel est une entreprise independante.")]));

  return o;
};
