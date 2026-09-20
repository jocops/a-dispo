// PARTIE 2 : encaisser les abonnements. Ecrite en mots simples, a la demande.
const C = require("./commun");
const { t, p, h1, h2, h3, encadre, tableau, puce, etape, source, ACCENT, GRIS } = C;

module.exports = function partiePaiement() {
  const o = [];
  const A = (...x) => o.push(...x.flat());

  A(h1("Partie 2. Encaisser les abonnements : BNP Paribas ou Stripe"));

  A(p([t("Cette partie repond a une question simple : "), t("par qui faire passer l'argent de l'abonnement, et combien ca coute vraiment", { bold: true }), t(". Elle est ecrite sans jargon. Les chiffres viennent des tarifs publics releves le 20 septembre 2026, et de la proposition commerciale de la BNP.")]));

  // ---------------------------------------------------------------- 1
  A(h2("1. Deux metiers differents, souvent confondus"));
  A(p("Encaisser un abonnement, ce sont en realite deux travaux separes."));
  A(p([t("La caisse.", { bold: true }), t(" Prendre l'argent sur la carte du client et le virer sur ton compte. C'est technique, c'est reglemente, et ca ne se bricole pas.")]));
  A(p([t("Le carnet de comptes.", { bold: true }), t(" Savoir qui a paye, qui doit payer le 3 du mois prochain, qui est en retard, a qui envoyer une facture, a qui offrir un mois, quoi rembourser si quelqu'un part au milieu du mois.")]));
  A(encadre("La difference qui coute le plus cher", [
    [t("BNP Paribas Axepta vend la caisse.", { bold: true }), t(" Rien d'autre.")],
    [t("Stripe vend la caisse ", {}), t("et", { bold: true, it: true }), t(" le carnet. Le carnet s'appelle Stripe Billing.")],
    [t("Si tu prends BNP, le carnet est a ecrire : "), t("environ 20 jours de travail, soit 6 000 euros", { bold: true }), t(". Ce n'est ni un detail ni une option : sans lui, personne n'est preleve le mois suivant.")],
  ]));

  // ---------------------------------------------------------------- 2
  A(h2("2. Comment on te facture, dans les deux cas"));
  A(p("Chaque paiement te coute deux choses additionnees :"));
  A(puce([t("un "), t("pourcentage", { bold: true }), t(" du montant encaisse,")]));
  A(puce([t("une "), t("somme fixe", { bold: true }), t(", la meme que le paiement fasse 5 euros ou 500 euros.")]));
  A(p([t("Sur un abonnement a 29,90 euros, la somme fixe fait tres mal. Les 0,25 euro fixes de Stripe representent deja "), t("0,84 % du montant", { bold: true }), t(", avant meme d'avoir compte le pourcentage. Sur un panier a 300 euros, ces memes 0,25 euro ne pesseraient que 0,08 %.")]));
  A(encadre("A retenir", [
    "Plus ton abonnement est petit, plus la somme fixe pese. Et 29,90 euros, c'est petit.",
  ], "9A3208"));

  // ---------------------------------------------------------------- 3
  A(h2("3. Pourquoi la BNP annonce des taux si bas"));
  A(p("La BNP affiche 0,27 % ou 0,37 %. Stripe affiche 1,5 %. L'ecart parait enorme. Il s'explique."));
  A(p([t("La BNP est une "), t("banque", { bold: true }), t(" : elle te vend le prix de gros, au plus pres du cout reel. Stripe est un "), t("revendeur", { bold: true }), t(" : il paie le meme prix de gros, y ajoute sa marge, et vend le tout emballe avec les outils.")]));
  A(p([t("Tu paies donc plus cher chez Stripe, et en echange tu ne developpes presque rien. C'est un arbitrage classique : "), t("acheter du temps contre de l'argent.", { bold: true })]));

  // ---------------------------------------------------------------- 4
  A(h2("4. Le piege des cartes d'entreprise"));
  A(p("Il y a deux familles de cartes, et elles ne coutent pas le meme prix a encaisser :"));
  A(puce([t("la carte d'un "), t("particulier", { bold: true }), t(" : la loi europeenne plafonne les frais, donc elle est bon marche ;")]));
  A(puce([t("la carte d'une "), t("entreprise", { bold: true }), t(" (carte pro, carte affaires) : elle n'est "), t("pas", { it: true }), t(" plafonnee, donc elle coute beaucoup plus cher.")]));
  A(tableau(
    ["Qui paie", "Chez BNP Axepta", "Chez Stripe"],
    [
      ["Carte personnelle, debit", { texte: "0,27 %", droite: true, mono: true }, { texte: "1,5 % + 0,25 EUR", droite: true, mono: true }],
      ["Carte personnelle, credit", { texte: "0,37 %", droite: true, mono: true }, { texte: "1,5 % + 0,25 EUR", droite: true, mono: true }],
      [{ texte: "Carte d'entreprise", bold: true }, { texte: "0,94 % a 1,97 %", droite: true, mono: true, bold: true }, { texte: "2,8 % + 0,25 EUR", droite: true, mono: true, bold: true }],
      ["Carte hors Europe", { texte: "1,55 % + 0,12 EUR", droite: true, mono: true }, { texte: "3,15 % + 0,25 EUR", droite: true, mono: true }],
    ], [34, 33, 33]));
  A(source("BNP : proposition commerciale Axepta, tableau « Tarification des encaissements par Internet ». Stripe : stripe.com/fr/pricing, releve le 20/09/2026."));
  A(encadre("Le parametre le plus sensible de toute l'etude", [
    [t("Tes clients sont des artisans, donc des entreprises."), t(" Une partie d'entre eux paiera avec une carte professionnelle, et cela change le cout du simple au double.")],
    "Personne ne peut deviner cette proportion a l'avance : elle se mesure en production, au bout d'une centaine de paiements. C'est la premiere chose a relever apres la mise en service.",
  ], "9A3208"));

  // ---------------------------------------------------------------- 5
  A(h2("5. Le prelevement, l'option que personne ne regarde"));
  A(p("Au lieu de taper sa carte tous les mois, le client signe une autorisation une seule fois. Ensuite l'argent part tout seul de son compte. C'est le prelevement SEPA, exactement comme pour une facture d'electricite."));
  A(h3("Premier avantage : c'est trois fois moins cher"));
  A(p([t("Chez Stripe, un prelevement coute "), t("0,35 euro fixe, sans aucun pourcentage", { bold: true }), t(". Sur 29,90 euros, cela fait 1,17 %. Une carte, au meme endroit, coute entre 3 et 3,6 %.")]));
  A(h3("Second avantage, et il compte encore plus"));
  A(p("Une carte expire au bout de trois ans, se fait voler, se fait remplacer. Chaque fois, le paiement casse, et il faut courir apres le client pour qu'il ressaisisse ses coordonnees. Beaucoup ne le font jamais, et l'abonnement meurt sans que personne ne l'ait decide."));
  A(p([t("Une autorisation de prelevement, elle, "), t("n'expire pas", { bold: true }), t(".")]));
  A(h3("Le seul inconvenient, a connaitre"));
  A(p("Un prelevement n'est pas instantane, et le client peut le refuser jusqu'a huit semaines apres. Il faut en tenir compte dans l'acces au service : on n'ouvre pas un droit definitif sur un paiement qui peut encore revenir."));

  // ---------------------------------------------------------------- 6
  A(h2("6. Ce que cela donne, en euros"));
  A(p("Pour un abonnement de 29,90 euros HT encaisse une fois par mois :"));
  A(tableau(
    ["Comment on encaisse", "Cout d'un paiement", "Part du prix"],
    [
      [{ texte: "Prelevement SEPA chez Stripe, sans le carnet", bold: true }, { texte: "0,35 EUR", droite: true, mono: true, bold: true }, { texte: "1,17 %", droite: true, mono: true, bold: true }],
      ["Carte chez BNP, clients payant en carte perso", { texte: "0,31 EUR", droite: true, mono: true }, { texte: "1,03 %", droite: true, mono: true }],
      ["Carte chez BNP, melange realiste avec cartes pro", { texte: "0,42 EUR", droite: true, mono: true }, { texte: "1,42 %", droite: true, mono: true }],
      ["Prelevement SEPA chez Stripe, avec le carnet", { texte: "0,56 EUR", droite: true, mono: true }, { texte: "1,87 %", droite: true, mono: true }],
      [{ texte: "Carte chez Stripe, avec le carnet", color: "9A3208" }, { texte: "0,91 a 1,06 EUR", droite: true, mono: true, color: "9A3208" }, { texte: "3,0 a 3,6 %", droite: true, mono: true, color: "9A3208" }],
    ], [46, 27, 27]));

  A(h3("Et sur cinq ans"));
  A(p("Avec une croissance jusqu'a 4 000 abonnes en annee 5, developpement du carnet compris quand il faut l'ecrire :"));
  A(tableau(
    ["Solution", "Cout total sur 5 ans"],
    [
      [{ texte: "Stripe en prelevement, carnet ecrit par nous", bold: true }, { texte: "41 070 EUR", droite: true, mono: true, bold: true }],
      ["BNP Axepta, carnet ecrit par nous", { texte: "48 252 EUR", droite: true, mono: true }],
      ["Stripe en prelevement, avec Billing", { texte: "56 042 EUR", droite: true, mono: true }],
      [{ texte: "Stripe en carte, avec Billing", color: "9A3208" }, { texte: "106 541 EUR", droite: true, mono: true, color: "9A3208" }],
    ], [62, 38]));
  A(source("Hypothese de croissance : 150, 500, 1 200, 2 500 puis 4 000 abonnes moyens. Un paiement par abonne et par mois. Carnet estime a 20 jours a 300 euros."));

  // ---------------------------------------------------------------- 7
  A(h2("7. Ce qu'il faut retenir"));
  A(p([t("La vraie question n'est pas « BNP ou Stripe ». Ce sont ces deux-la :", { bold: true })]));
  A(etape([t("Carte ou prelevement ?", { bold: true }), t(" C'est ce choix qui fait le plus gros ecart, de l'ordre de 1 a 3. Il pese deux fois et demie plus lourd que le choix du prestataire.")]));
  A(etape([t("Acheter le carnet, ou l'ecrire ?", { bold: true }), t(" L'acheter coute 0,7 % du chiffre d'affaires a vie. L'ecrire coute 6 000 euros une fois, puis de l'entretien.")]));
  A(p("Une fois ces deux questions tranchees, le prestataire vient presque tout seul."));
  A(encadre("Le point contre-intuitif", [
    "Comme le carnet est a ecrire aussi bien chez BNP que si l'on veut eviter Billing chez Stripe, l'effort de developpement s'annule entre les deux.",
    [t("Dans ce cas, Stripe en prelevement reste moins cher que BNP", { bold: true }), t(" : 41 070 euros contre 48 252 sur cinq ans, sans les 18 euros par mois d'abonnement, et avec une bien meilleure documentation.")],
  ]));

  A(h3("Ma recommandation, en trois temps"));
  A(tableau(
    ["Quand", "Quoi", "Pourquoi"],
    [
      [{ texte: "0 a 300 abonnes", bold: true }, "Stripe, carte + Billing", "En ligne en 2 a 3 jours, zero developpement de facturation. A 100 abonnes le surcout est de 70 euros par mois : c'est le prix d'arriver au marche trois semaines plus tot."],
      [{ texte: "300 a 1 500", bold: true }, "Basculer sur le prelevement SEPA", "Le cout tombe de 3,56 % a 1,87 % sans toucher a l'architecture, et les abonnements cessent de mourir tout seuls quand une carte expire."],
      [{ texte: "Au-dela de 1 500", bold: true }, "Ecrire son carnet, quitter Billing", "On descend a 1,17 %. C'est aussi le moment ou renegocier avec la BNP a du sens, avec un volume reel en main."],
    ], [20, 27, 53]));

  // ---------------------------------------------------------------- 8
  A(h2("8. Les questions a poser a la BNP avant toute decision"));
  A(encadre("Question numero 1, a poser par ecrit", [
    [t("La BNP annonce 0,27 % pour une carte de debit. Or le plafond europeen des frais de base pour ce type de carte est de 0,20 %. Leur prix est donc a 0,07 point au-dessus du prix de gros : "), t("soit c'est une tres bonne offre, soit l'affichage est incomplet.", { bold: true })],
    [t("« Les taux indiques sont-ils tout compris, interchange et commissions reseau inclus, ou s'agit-il de votre seule commission d'acquisition, a laquelle s'ajoutent ces couts ? »", { it: true })],
    [t("Si la reponse est la seconde, toute la comparaison bascule", { bold: true }), t(" et la BNP devient nettement plus chere que ce que la proposition laisse croire.")],
  ], "9A3208"));
  A(p("Trois autres choses manquent dans leur proposition, et il faut les demander :"));
  A(puce([t("Le "), t("paiement recurrent", { bold: true }), t(" est-il possible ? C'est-a-dire encaisser tous les mois sans que le client ressaisisse sa carte. La proposition n'en dit rien, et sans cela il n'y a pas d'abonnement du tout.")]));
  A(puce([t("Proposent-ils le "), t("prelevement SEPA", { bold: true }), t(", et a quel prix ? C'est le poste qui decide, et il est absent de la proposition.")]));
  A(puce([t("Combien coute un "), t("impaye ou une contestation", { bold: true }), t(" ? Non chiffre chez eux. Chez Stripe, c'est 20 euros.")]));
  A(puce([t("Le forfait de 100 operations incluses est "), t("sature des 100 abonnes", { bold: true }), t(". Existe-t-il un palier superieur moins cher que 0,22 euro par operation ?")]));

  A(h3("Et ce qu'il faut verifier chez Stripe"));
  A(puce("La part reelle de cartes « premium », facturees 2,8 % au lieu de 1,5 %. Mesurable seulement en production."));
  A(puce("Billing facture 0,7 % du volume, y compris sur les paiements par prelevement. C'est un abonnement deguise, a reevaluer chaque annee."));

  A(h3("Un risque commun aux deux"));
  A(p([t("Pour pouvoir changer de prestataire un jour, il faut rester sur les standards : jeton de carte, webhook signe, et une table d'abonnements qui nous appartient. Et ne jamais stocker un numero de carte. A noter : "), t("les autorisations de prelevement SEPA sont portables d'un prestataire a l'autre, les jetons de carte beaucoup moins", { bold: true }), t(". C'est un argument de plus pour le prelevement.")]));

  return o;
};
