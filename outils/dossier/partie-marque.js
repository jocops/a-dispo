// PARTIE 1, chapitres 4 a 9 : la marque elle-meme.
const C = require("./commun");
const { D, t, p, h2, h3, encadre, tableau, puce, etape, source } = C;
const { Paragraph, PageBreak } = D;

const ROUGE = "9A3208";
const VERT = "116B40";

module.exports = function partieMarque() {
  const o = [];
  const A = (...x) => o.push(...x.flat());

  // ================================================================= 4
  A(h2("4. Les conditions pour qu'une marque soit valable"));
  A(p("Le code de la propriete intellectuelle pose trois series de conditions. Les deux premieres sont examinees par l'INPI, la troisieme ne l'est pas."));
  A(tableau(
    ["Condition", "Ce qu'elle exige", "L'INPI la verifie-t-il ?"],
    [
      [{ texte: "Etre un signe", bold: true }, "Le signe doit pouvoir etre represente de facon claire et precise (art. L711-1).", { texte: "Oui", color: VERT, bold: true }],
      [{ texte: "Etre distinctif", bold: true }, "Le signe ne doit ni decrire le service, ni etre usuel, ni etre depourvu de caractere distinctif (art. L711-2).", { texte: "Oui", color: VERT, bold: true }],
      [{ texte: "Etre disponible", bold: true }, "Ne pas porter atteinte a un droit anterieur : marque, denomination sociale, nom commercial, enseigne, nom de domaine (art. L711-3).", { texte: "NON", color: ROUGE, bold: true }],
    ], [22, 55, 23]));
  A(encadre("Le point que presque personne ne sait", [
    [t("L'INPI ne verifie PAS si le nom est deja pris.", { bold: true }), t(" Il controle la forme et le caractere distinctif, rien d'autre. C'est au deposant de verifier la disponibilite, et c'est un TIERS qui viendra s'y opposer, dans les deux mois suivant la publication.")],
    "Autrement dit : obtenir l'enregistrement ne prouve pas que le nom etait libre.",
  ], ROUGE));
  A(source("Sources : art. L711-1, L711-2 et L711-3 du code de la propriete intellectuelle, versions en vigueur depuis le 15/12/2019, et INPI, Directives Marques « La procedure d'enregistrement », juillet 2026. Consultes le 20/09/2026."));

  // ================================================================= 5
  A(h2("5. Le probleme du nom « a dispo »"));
  A(p("Ce chapitre est le plus important du dossier. Il expose deux difficultes distinctes, qui s'additionnent."));

  A(h3("Difficulte n 1 : le signe decrit le service"));
  A(p([t("L'article L711-2 3 du code de la propriete intellectuelle refuse l'enregistrement d'une marque « composee "), t("exclusivement", { bold: true, it: true }), t(" d'elements ou d'indications pouvant servir a designer, dans le commerce, une caracteristique du produit ou du service, et notamment l'espece, la qualite, la quantite, "), t("la destination", { bold: true }), t(", la valeur, la provenance geographique, l'epoque de la production du bien ou de la prestation du service ».")]));
  A(p([t("L'INPI definit la destination comme « le public auquel [le service] est destine, l'utilisation a laquelle le produit ou service est destine, voire le resultat attendu par cette utilisation ». Et son critere d'examen est le suivant : une marque est descriptive « si elle permet au consommateur d'etablir un "), t("rapport suffisamment direct et concret", { bold: true }), t(" entre le signe et les produits ou services ».")]));
  A(p([t("« a dispo » est l'abreviation courante de « a disposition ». Le service vend la mise a disposition de professionnels. "), t("Le rapport entre le signe et le service est aussi direct et concret qu'il peut l'etre.", { bold: true })]));
  A(source("Sources : art. L711-2 CPI (legifrance.gouv.fr/codes/article_lc/LEGIARTI000039381542) ; INPI, Directives Marques juillet 2026, pages 66 et 68 (inpi.fr/inpi-block/download-document?id=19981). Le critere du rapport direct et concret est d'origine europeenne, CJCE 23 octobre 2003, C-191/01 P, applique par la Cour de cassation. Consultes le 20/09/2026."));

  A(encadre("Trois fausses solutions, ecartees par les directives de l'INPI", [
    [t("Ecrire « adispo » ou « a-dispo » ne change rien.", { bold: true }), t(" Directives page 74 : « le fait de les accoler est sans incidence sur le manque de caractere distinctif ». Les trois graphies seront examinees de la meme maniere.")],
    [t("Ajouter « .fr » ou « www » ne change rien.", { bold: true }), t(" Meme page : ces elements « ne font qu'informer le consommateur que les produits/services sont accessibles sur internet ».")],
    [t("Avoir reserve le nom de domaine ne cree aucun droit de marque.", { bold: true }), t(" Un nom de domaine n'intervient que comme droit anterieur opposable par un tiers, et seulement si sa portee n'est pas purement locale.")],
  ], ROUGE));

  A(h3("La porte de sortie, et elle est reelle"));
  A(p([t("Le mot « exclusivement » de l'article est decisif. Les directives de l'INPI, page 66, en tirent la consequence : « un signe compose d'un element descriptif et d'elements qui ne le sont pas "), t("ne saurait etre refuse sur ce motif", { bold: true }), t(", si tant est que lesdits elements ajoutes sont en eux-memes de nature a etre percus » comme distinctifs. L'exemple donne par l'INPI est « PIECES AUTO DUPONT ».")]));
  A(p([t("Concretement, trois voies existent, par ordre de solidite :")]));
  A(etape([t("Ajouter un element verbal arbitraire", { bold: true }), t(" au signe descriptif. C'est la voie la plus sure, et la moins couteuse. Elle suppose d'accepter de changer le nom.")]));
  A(etape([t("Deposer en semi-figuratif", { bold: true }), t(", c'est-a-dire le mot ACCOMPAGNE d'un logo. Attention : les directives, pages 77 a 79, exigent que « les elements associes a la marque verbale descriptive soient en eux-memes dotes d'un caractere distinctif », c'est-a-dire arbitraires. Un logo purement decoratif, ou qui illustre le service, ne sauve rien. Et le monopole ne portera alors que sur l'ENSEMBLE, pas sur le mot.")]));
  A(etape([t("Revendiquer le caractere distinctif acquis par l'usage", { bold: true }), t(". Le dernier alinea de L711-2 le permet, mais les directives, pages 88 et 89, posent une condition que l'on decouvre souvent trop tard : « L'acquisition du caractere distinctif par l'usage doit avoir eu lieu "), t("anterieurement au depot", { bold: true }), t(" ». Un projet qui demarre ne peut pas s'en prevaloir.")]));

  A(h3("Difficulte n 2 : ce qu'une marque faible ne permettra pas d'interdire"));
  A(p([t("Meme enregistree, une marque construite sur un mot descriptif offre un monopole creux. L'article L713-6 I 2 prevoit qu'une marque « ne permet pas a son titulaire d'interdire a un tiers l'usage, dans la vie des affaires, conformement aux usages loyaux du commerce (...) de signes ou d'indications qui sont depourvus de caractere distinctif ».")]));
  A(p([t("Traduction : un concurrent pourra ecrire « nos artisans sont a dispo » sur son site sans que tu puisses rien faire. "), t("Tu paierais pour un titre que tu ne pourrais pas faire respecter.", { bold: true })]));

  // ================================================================= 6
  A(new Paragraph({ children: [new PageBreak()] }));
  A(h2("6. La recherche d'anteriorite, et son resultat"));

  A(h3("La methode, en cinq etapes"));
  A(etape([t("Recherche a l'identique, gratuite.", { bold: true }), t(" Sur data.inpi.fr, base Marques, en cochant les trois registres : francais, europeen et international. Puis sur TMview, qui agrege 81 offices.")]));
  A(etape([t("Recherche des entreprises.", { bold: true }), t(" Sur data.inpi.fr, base Entreprises (registre national des entreprises), pour les denominations sociales, noms commerciaux et enseignes.")]));
  A(etape([t("Recherche des noms de domaine.", { bold: true }), t(" Par le WHOIS de l'AFNIC pour le .fr, et le WHOIS classique pour les autres extensions.")]));
  A(etape([t("Recherche de similarites, payante.", { bold: true }), t(" C'est le seul niveau qui couvre les ressemblances visuelles, orthographiques, PHONETIQUES et intellectuelles. Une recherche gratuite ne les voit pas.")]));
  A(etape([t("Interpretation par un professionnel.", { bold: true }), t(" L'INPI livre des resultats bruts et renvoie explicitement au conseil en propriete industrielle pour les lire.")]));

  A(tableau(
    ["Recherche de disponibilite vendue par l'INPI", "Prix"],
    [
      ["Marques verbales, 3 classes ou moins, OU noms de societe similaires", { texte: "50 EUR", droite: true, mono: true }],
      ["Marques verbales ET noms de societe, 3 classes ou moins", { texte: "80 EUR", droite: true, mono: true }],
      [{ texte: "Marques verbales ET noms de societe ET noms de domaine, 1 a 3 classes", bold: true }, { texte: "150 EUR", droite: true, mono: true, bold: true }],
      ["Marque semi-figurative en France, une classe", { texte: "572 EUR", droite: true, mono: true }],
    ], [76, 24]));
  A(source("INPI, tarifs des prestations applicables au 2 juillet 2026. Delai annonce : 2 a 10 jours ouvres. Consultes le 20/09/2026."));

  A(h3("Ce que la recherche a trouve, le 20 septembre 2026"));
  A(p([t("La recherche a ete executee, sur data.inpi.fr, TMview, le registre national des entreprises, le BODACC et les serveurs WHOIS. "), t("Elle ne rend pas un terrain libre.", { bold: true })]));

  A(tableau(
    ["Signe", "Numero", "Statut", "Titulaire et portee"],
    [
      [{ texte: "ADISPO", bold: true }, "FR3180615", { texte: "En vigueur\njusqu'en 2032", color: ROUGE, bold: true }, { texte: "Verbale. Deposee le 26/08/2002 a Lyon, renouvelee. Personne physique, Sainte-Foy-les-Lyon. CLASSES 35, 41 ET 42.", bold: true, color: ROUGE }],
      [{ texte: "ADISPO", bold: true }, "FR3017609", { texte: "En vigueur", color: ROUGE, bold: true }, "Verbale. Deposee le 28/03/2000, renouvelee le 04/03/2020. La Banque Postale."],
      [{ texte: "DISPO", bold: true }, "FR5054655", { texte: "En vigueur\njusqu'en 2034", color: ROUGE, bold: true }, { texte: "Verbale. Deposee le 15/05/2024. Personne physique, Isere. CINQ CLASSES : 16, 35, 37, 41 ET 42.", bold: true, color: ROUGE }],
      [{ texte: "dispo", bold: true }, "FR4910051", { texte: "Enregistree", color: ROUGE, bold: true }, "Figurative en couleur, deposee le 02/11/2022. Plateforme d'intermediation."],
      ["ATADISPO", "FR5217464", "Demande publiee", "Deposee le 15/01/2026, publiee au BOPI 2026-06."],
      ["Dispo", "EM 018955477", "Enregistree", "Marque de l'Union europeenne, 2023, classes 9, 39 et 42."],
    ], [15, 17, 18, 50]));

  A(encadre("Les trois trouvailles qui doivent arreter la decision", [
    [t("Deux marques vivantes occupent DEJA les classes 35 et 42.", { bold: true }), t(" Or ce sont exactement les deux classes dont ce projet a besoin. ADISPO FR3180615 couvre les classes 35, 41 et 42 jusqu'en 2032. DISPO FR5054655 couvre les classes 16, 35, 37, 41 et 42 jusqu'en 2034. Le terrain vise n'est pas libre.")],
    [t("DISPO FR5054655 couvre aussi la classe 37, celle du batiment.", { bold: true }), t(" C'est le secteur du projet.")],
    [t("ADISPO INTERIM existe comme societe, et fait de l'interim.", { bold: true }), t(" SAS, SIREN 922 284 682, RCS Lyon, siege a Meyzieu dans le Rhone, avec le sigle ADISPO et le nom commercial ADISPO declares des sa creation, pour une activite d'agence de travail temporaire. L'interim, c'est la mise a disposition de personnel : le signe voisin, l'activite voisine, et la meme region que le projet.")],
    [t("Un nom commercial ou une enseigne est un droit anterieur opposable", {}), t(" des lors que sa portee n'est pas seulement locale et qu'il existe un risque de confusion (art. L711-3 I 4).")],
  ], ROUGE));

  A(p([t("A noter egalement : le domaine "), t("adispo.fr", { bold: true }), t(" est actif depuis le 04/12/2006 et son registrar est NAMESHIELD, une societe specialisee dans la protection et la surveillance de marques. Un titulaire qui paie une surveillance est un titulaire qui recoit une alerte le jour ou une marque voisine est publiee au BOPI.")]));
  A(source("Relevés du 20/09/2026 : data.inpi.fr (bases Marques et Entreprises, mises a jour au 18/09/2026), TMview (tmdn.org), BODACC (open data DILA), WHOIS AFNIC (whois.nic.fr)."));

  A(encadre("Ce qui reste a verifier, et par qui", [
    [t("L'usage serieux reel de la marque ADISPO FR3180615.", { bold: true }), t(" Si elle n'est pas exploitee serieusement depuis cinq ans, elle est attaquable en decheance (art. L714-5, requete a 600 euros). Cela se fait constater par un conseil, pas en regardant s'il existe un site web.")],
    [t("La portee, locale ou non, du nom commercial ADISPO INTERIM.", { bold: true }), t(" C'est la condition qui decide si cette societe peut ou non former opposition.")],
    [t("Une recherche de similarites phonetiques.", { bold: true }), t(" Aucune des recherches gratuites ne la couvre, et c'est precisement le terrain ou « a dispo » et « ADISPO » se rencontrent.")],
  ]));

  // ================================================================= 7
  A(new Paragraph({ children: [new PageBreak()] }));
  A(h2("7. Les classes de Nice"));
  A(p([t("Une marque ne protege pas dans l'absolu : elle protege pour des services designes, ranges dans des classes. La classification de Nice en vigueur est la "), t("13e edition, applicable depuis le 1er janvier 2026", { bold: true }), t(". Elle compte 45 classes, 34 de produits et 11 de services.")]));
  A(p("Elle n'a qu'une valeur administrative : le classement ne determine pas la portee de la protection, c'est le libelle qui compte."));

  A(tableau(
    ["Classe", "Pourquoi elle concerne ce projet", "Pertinence"],
    [
      [{ texte: "42", bold: true }, "La plateforme elle-meme. C'est la seule classe ou figure le logiciel en ligne non telechargeable, c'est-a-dire une application que l'on utilise sans l'installer. C'est le coeur du produit.", { texte: "INDISPENSABLE", bold: true, color: VERT }],
      [{ texte: "35", bold: true }, "La mise en relation commerciale entre professionnels, la promotion, et la gestion d'agendas. Attention : la note explicative exclut de cette classe les prestations dont l'objet principal est autre que commercial.", { texte: "INDISPENSABLE", bold: true, color: VERT }],
      [{ texte: "38", bold: true }, "La messagerie entre utilisateurs, en tant que service de telecommunication. Elle ne couvre PAS le contenu echange, seulement l'acheminement.", { texte: "UTILE", bold: true }],
      [{ texte: "45", bold: true }, "Le reseautage social en ligne figure dans l'intitule officiel de la classe. Si la plateforme est presentee comme un reseau de professionnels, elle a sa place ici.", { texte: "A DISCUTER", bold: true }],
      [{ texte: "9", bold: true }, "Uniquement si une application TELECHARGEABLE est publiee sur les magasins d'applications. Tant que le produit reste un site, elle ne sert pas.", { texte: "PLUS TARD", bold: true }],
      [{ texte: "37", bold: true }, "La location de materiel de chantier y figure. Mais c'est l'une des cinq classes de la marque DISPO deja deposee. A manier avec precaution.", { texte: "A DISCUTER", bold: true, color: ROUGE }],
      [{ texte: "36", bold: true }, "Services financiers. A EVITER tant que la plateforme n'encaisse ni commission ni paiement entre artisans.", { texte: "NON", bold: true, color: ROUGE }],
    ], [10, 68, 22]));

  A(encadre("Le piege du libelle, dans les deux sens", [
    [t("Trop large : la decheance.", { bold: true }), t(" L'article L714-5 permet a tout interesse de faire annuler une marque non exploitee serieusement pendant cinq ans. Payer 40 euros de plus pour une classe « au cas ou » revient a payer pour un droit qui tombera, et a s'exposer a une action a laquelle il faudra repondre.")],
    [t("Trop etroit : le trou.", { bold: true }), t(" Un service oublie n'est pas protege, et il faudra redeposer.")],
    [t("Attention : l'expression « mise en relation » ne figure dans AUCUN intitule de la classification.", { bold: true }), t(" Le libelle devra donc etre redige, et les directives de l'INPI exigent qu'il identifie les services « avec assez de clarte et de precision ». L'INPI publie un apercu de libelles pre-approuves : c'est par la qu'il faut commencer.")],
  ], ROUGE));
  A(source("Sources : classification de Nice 13e edition (inpi.fr) ; INPI, Directives Marques juillet 2026, sections 6.2 a 6.4 ; art. L714-5 CPI. Consultes le 20/09/2026. A noter : la page HTML de l'INPI annoncait encore la 12e edition au 20/09/2026, alors que le fichier telecharge est bien la 13e. Incoherence du site, sans consequence sur le droit applicable."));

  A(h3("Le cout selon le nombre de classes"));
  A(tableau(
    ["Classes retenues", "Cout du depot", "Cout du renouvellement, a 10 ans"],
    [
      ["1 classe (42 seule)", { texte: "190 EUR", droite: true, mono: true }, { texte: "290 EUR", droite: true, mono: true }],
      [{ texte: "2 classes (42 et 35)", bold: true }, { texte: "230 EUR", droite: true, mono: true, bold: true }, { texte: "330 EUR", droite: true, mono: true, bold: true }],
      ["3 classes (42, 35 et 38)", { texte: "270 EUR", droite: true, mono: true }, { texte: "370 EUR", droite: true, mono: true }],
      ["4 classes", { texte: "310 EUR", droite: true, mono: true }, { texte: "410 EUR", droite: true, mono: true }],
    ], [40, 30, 30]));

  // ================================================================= 8
  A(new Paragraph({ children: [new PageBreak()] }));
  A(h2("8. La procedure, pas a pas"));

  A(h3("Qui peut deposer"));
  A(puce("Une personne physique, ou une personne morale ayant la personnalite juridique."));
  A(puce([t("Une entreprise individuelle ou une micro-entreprise "), t("ne peut pas", { bold: true }), t(" etre titulaire : le depot se fait au nom et prenom de la personne physique.")]));
  A(puce([t("Une societe "), t("en cours de creation", { bold: true }), t(" peut deposer, au nom de la personne physique suivie de la mention « agissant pour le compte de la societe en cours de constitution ».")]));
  A(puce("Un depot a plusieurs est possible, mais impose alors un mandataire commun."));

  A(h3("Les pieces exigees"));
  A(p("L'article R712-3 du code de la propriete intellectuelle en exige quatre, et rien de plus :"));
  A(puce("l'identification du deposant ;"));
  A(puce("la representation de la marque ;"));
  A(puce("l'enumeration des produits ou services, et des classes correspondantes ;"));
  A(puce("le justificatif du paiement de la redevance."));
  A(p([t("Le depot est "), t("obligatoirement electronique", { bold: true }), t(", sur le portail e-procedures de l'INPI, et toutes les informations doivent etre redigees integralement en francais.")]));

  A(h3("Le calendrier"));
  A(tableau(
    ["Etape", "Delai", "Ce qui se passe"],
    [
      [{ texte: "Jour J : depot", bold: true }, "-", "Le paiement se fait au depot. La date est attribuee sous reserve de l'examen de recevabilite."],
      [{ texte: "Publication au BOPI", bold: true }, { texte: "6 semaines", bold: true, droite: true }, "La demande est publiee au Bulletin officiel de la propriete industrielle (art. R712-8)."],
      [{ texte: "Fenetre d'opposition", bold: true }, { texte: "2 mois", bold: true, droite: true, color: ROUGE }, "A compter de la PUBLICATION, non du depot. C'est la que les titulaires de droits anterieurs interviennent (art. L712-4)."],
      ["Observations de tiers", "2 mois", "Toute personne interessee peut adresser des observations a l'INPI."],
      ["Examen par l'INPI", "en parallele", "L'INPI controle la forme et le caractere distinctif. Il ne controle PAS la disponibilite."],
      [{ texte: "Enregistrement", bold: true }, { texte: "5 mois minimum", bold: true, droite: true }, "Publication de l'enregistrement au BOPI. Delai plus long en cas d'objection ou d'opposition."],
    ], [23, 17, 60]));
  A(encadre("La date qui compte", [
    [t("La protection prend effet a la DATE DE DEPOT", { bold: true }), t(", et non a la date d'enregistrement. Les cinq mois d'attente ne sont pas cinq mois sans protection : une fois enregistree, la marque produit ses effets retroactivement au jour du depot.")],
    "Duree : dix ans, renouvelables indefiniment, par periodes de dix ans. Territoire : la France seule. Pour l'Europe, il faut une marque de l'Union europeenne, deposee a l'EUIPO.",
  ], VERT));

  A(h3("Si quelqu'un s'oppose"));
  A(p([t("Une opposition coute 400 euros a celui qui la forme, plus 150 euros par droit anterieur supplementaire invoque. L'INPI rend sa decision dans un delai encadre. "), t("Une opposition ne signifie pas la perte automatique du dossier", { bold: true }), t(", mais elle ouvre une procedure contradictoire qui demande un conseil.")]));
  A(p([t("Et apres l'enregistrement, le risque ne disparait pas : une requete en nullite ou en decheance coute 600 euros a celui qui l'engage, plus 150 euros par droit supplementaire. "), t("Une marque fragile reste attaquable pendant toute sa vie.", { bold: true })]));

  A(h3("Les liens officiels"));
  A(tableau(
    ["Pour", "Adresse"],
    [
      ["Deposer la marque", { texte: "procedures.inpi.fr", mono: true }],
      ["Chercher les marques et les entreprises", { texte: "data.inpi.fr", mono: true }],
      ["Chercher dans 81 offices", { texte: "tmview.org", mono: true }],
      ["Commander une recherche de disponibilite", { texte: "inpi.fr, rubrique prestations", mono: true }],
      ["Deposer une e-Soleau", { texte: "inpi.fr, service e-Soleau", mono: true }],
      ["Consulter la classification de Nice", { texte: "inpi.fr, classifications internationales", mono: true }],
      ["Le texte de la loi", { texte: "legifrance.gouv.fr, art. L711-1 a L714-5 CPI", mono: true }],
    ], [45, 55]));

  // ================================================================= 9
  A(h2("9. L'e-Soleau"));
  A(p([t("L'e-Soleau ne protege rien. "), t("Elle prouve une date.", { bold: true }), t(" C'est une enveloppe numerique deposee a l'INPI, qui horodate des documents et en conserve l'empreinte. Le recepisse porte la date, l'heure en temps universel et l'empreinte numerique de chaque fichier.")]));
  A(tableau(
    ["", "Depot de marque", "e-Soleau"],
    [
      ["Ce que ca donne", { texte: "Un monopole : le droit d'interdire", bold: true }, "Une preuve de date. Aucun droit d'interdire."],
      ["Contre qui", "Tout le monde, pour les services designes", "Seulement comme element de preuve, devant un juge"],
      ["Cout", "190 EUR + 40 EUR par classe", "15 EUR jusqu'a 50 Mo, par periode de 5 ans"],
      ["Duree", "10 ans renouvelables sans limite", "5, 10, 15 ou 20 ans, a fixer au depot"],
      ["Examen", "Oui, par l'INPI", "Aucun. L'INPI ne lit pas le contenu"],
      ["Publie ?", "Oui, au BOPI", "Non. Le contenu reste secret"],
      [{ texte: "A quoi ca sert ici", bold: true }, "Proteger le nom, empecher un concurrent de l'utiliser", "Dater les maquettes et l'architecture avant de les montrer a un tiers"],
    ], [18, 41, 41]));
  A(p([t("Limites techniques : de 1 a 100 fichiers, 2 gigaoctets maximum en formule avec conservation. Une seconde formule calcule seulement les empreintes, sans limite de taille mais sans conserver les fichiers. "), t("Dans ce cas, c'est a toi de garder les originaux", { bold: true }), t(" : sans eux, l'empreinte ne prouve rien.")]));

  A(h3("Ce qu'il faut y mettre, et dans quel ordre"));
  A(etape("Un document de description du concept, date et signe, qui expose le probleme resolu, le fonctionnement et le modele economique."));
  A(etape("Les maquettes des ecrans, exportees en PDF."));
  A(etape("L'arborescence du site et le schema de la base de donnees."));
  A(etape("Les textes rediges, les conditions generales et la charte graphique."));
  A(etape("Une liste des fichiers deposes, pour retrouver plus tard ce que contenait l'enveloppe."));
  A(encadre("Le geste a faire quand meme", [
    [t("15 euros et une heure de travail.", { bold: true }), t(" L'e-Soleau ne resout pas le probleme du nom, mais elle date tout le reste avant la moindre presentation a un investisseur, un prestataire ou un partenaire. C'est le seul acte de ce dossier qui ne demande aucune decision prealable.")],
  ], VERT));


  // ================================================================= 10
  A(new Paragraph({ children: [new PageBreak()] }));
  A(h2("10. La marche a suivre, dans l'ordre"));
  A(p("L'ordre compte : chaque etape rend la suivante moins risquee ou moins chere."));
  A(tableau(
    ["", "Quoi", "Cout", "Quand"],
    [
      [{ texte: "1", bold: true }, { texte: "Deposer une e-Soleau avec les maquettes, l'arborescence et les textes.", bold: true }, { texte: "15 EUR", droite: true, mono: true }, "Tout de suite. Aucune decision prealable."],
      [{ texte: "2", bold: true }, { texte: "Faire trancher le nom par un conseil en propriete industrielle.", bold: true }, { texte: "150 a 400 EUR", droite: true, mono: true }, "Avant toute autre depense. C'est l'etape qui evite de perdre le reste."],
      [{ texte: "3", bold: true }, "Selon sa reponse : garder le nom en le renforcant, ou en changer.", { texte: "-", droite: true }, "Dans la foulee."],
      [{ texte: "4", bold: true }, "Commander a l'INPI la recherche marques + societes + noms de domaine, sur le nom retenu.", { texte: "150 EUR", droite: true, mono: true }, "2 a 10 jours ouvres de delai."],
      [{ texte: "5", bold: true }, "Arreter les classes et rediger les libelles, a partir des libelles pre-approuves de l'INPI.", { texte: "-", droite: true }, "Avant le depot."],
      [{ texte: "6", bold: true }, { texte: "Deposer sur procedures.inpi.fr.", bold: true }, { texte: "230 a 270 EUR", droite: true, mono: true }, "Paiement au depot."],
      [{ texte: "7", bold: true }, "Surveiller la publication au BOPI et la fenetre d'opposition.", { texte: "-", droite: true }, "6 semaines, puis 2 mois."],
      [{ texte: "8", bold: true }, "Commencer a exploiter la marque, et en garder les preuves datees.", { texte: "-", droite: true }, "Des le depot. Le compteur de la decheance court a 5 ans."],
    ], [5, 47, 16, 32]));
  A(p([t("Budget d'ensemble, hors conseil : "), t("environ 435 a 475 euros", { bold: true }), t(" pour une e-Soleau, une recherche serieuse et un depot en deux ou trois classes. Avec le conseil, compter entre 600 et 900 euros. "), t("C'est le prix d'un depot qui tient.", { bold: true })]));

  A(h3("La checklist avant de cliquer sur « deposer »"));
  A(puce("Le nom retenu n'est pas exclusivement descriptif du service, ou il est accompagne d'un element distinctif."));
  A(puce("Une recherche de similarites, pas seulement a l'identique, a ete faite sur ce nom."));
  A(puce("Les marques ADISPO, DISPO et voisines ont ete examinees, classe par classe, par un professionnel."));
  A(puce("Le statut de la societe ADISPO INTERIM a ete instruit."));
  A(puce("Le deposant est la bonne personne : societe immatriculee, ou personne physique avec la mention « pour le compte de la societe en cours de formation »."));
  A(puce("Les classes retenues correspondent a une activite reellement exercee, ou qui le sera sous cinq ans."));
  A(puce("Les libelles sont rediges avec clarte et precision, en francais, et verifies contre l'apercu de libelles pre-approuves."));
  A(puce("Le logo, s'il est depose, comporte un element arbitraire et non une simple illustration du service."));
  A(puce("Une e-Soleau a deja date les documents de conception."));
  A(puce("Le budget de renouvellement a dix ans est connu : 290 euros plus 40 par classe supplementaire."));

  // ================================================================= 11
  A(h2("11. Ce qui releve d'un conseil, et pourquoi"));
  A(p([t("Ce dossier etablit des faits et les source. Il ne remplace pas un avis. Cinq points, ici, demandent un conseil en propriete industrielle ou un avocat specialise, et l'INPI le dit lui-meme : il livre des resultats bruts et "), t("n'en donne aucune interpretation", { bold: true }), t(".")]));
  A(tableau(
    ["Le point", "Pourquoi un professionnel, et pas nous"],
    [
      [{ texte: "Le caractere distinctif de « a dispo »", bold: true }, "C'est une appreciation, pas un calcul. Elle depend des services designes, de la perception du public concerne et d'une jurisprudence mouvante. Un conseil dira en une heure ce que nous ne pouvons qu'estimer."],
      [{ texte: "Le risque de conflit avec ADISPO et DISPO", bold: true }, "Le risque de confusion s'apprecie globalement : ressemblance des signes, similarite des services, notoriete. Deux marques vivantes couvrent deja les classes 35 et 42."],
      [{ texte: "L'usage serieux de ADISPO FR3180615", bold: true }, "Si elle n'est pas exploitee depuis cinq ans, elle est attaquable. Cela se fait CONSTATER, pas deduire de l'absence de site web."],
      [{ texte: "La redaction des libelles", bold: true }, "Un libelle mal ecrit se paie deux fois : refus partiel a l'examen, ou protection trouee decouverte le jour d'un litige."],
      [{ texte: "L'arbitrage marque francaise ou europeenne", bold: true }, "Si l'ambition depasse la France, deposer d'abord en France puis en Europe n'est pas toujours le moins cher ni le plus sur."],
    ], [30, 70]));
  A(encadre("Ce que je recommande, en une phrase", [
    [t("Ne depose rien avant d'avoir fait regarder le nom.", { bold: true }), t(" Entre le caractere descriptif de « a dispo » et deux marques vivantes qui occupent deja les classes 35 et 42, le dossier cumule les deux motifs de perte : le refus par l'INPI, et l'opposition par un tiers.")],
    [t("Une consultation coute moins cher qu'un depot perdu, et infiniment moins cher qu'un changement de nom apres le lancement.", {})],
  ], ROUGE));

  return o;
};
