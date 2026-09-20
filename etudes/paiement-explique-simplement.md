# Encaisser les abonnements : ce qu'il faut comprendre

## 1. Deux métiers différents, souvent confondus

Encaisser un abonnement, ce sont **deux travaux séparés** :

**La caisse.** Prendre l'argent sur la carte du client et le virer sur ton compte.
C'est technique, c'est réglementé, et ça ne se bricole pas.

**Le carnet de comptes.** Savoir qui a payé, qui doit payer le 3 du mois prochain,
qui est en retard, à qui envoyer une facture, à qui offrir un mois, quoi rembourser
si quelqu'un part au milieu du mois.

**BNP Paribas Axepta vend la caisse.** Rien d'autre.
**Stripe vend la caisse ET le carnet.** Le carnet s'appelle Stripe Billing.

C'est toute la différence, et c'est elle qui coûte le plus cher.
Si tu prends BNP, le carnet est à écrire : environ 20 jours de travail, 6 000 euros.

## 2. Comment on te facture, dans les deux cas

Chaque paiement te coûte deux choses additionnées :

- **un pourcentage** du montant encaissé,
- **une somme fixe**, la même que le paiement fasse 5 euros ou 500 euros.

Sur un abonnement à 29,90 euros, la somme fixe fait très mal.
Les 0,25 euro fixes de Stripe représentent déjà **0,84 %** du montant, avant même
d'avoir compté le pourcentage. Sur un panier à 300 euros, ces mêmes 0,25 euro ne
représenteraient que 0,08 %.

**Retiens ceci : plus ton abonnement est petit, plus la somme fixe pèse.**
Et 29,90 euros, c'est petit.

## 3. Pourquoi BNP annonce des taux si bas

BNP affiche 0,27 % ou 0,37 %. Stripe affiche 1,5 %. L'écart paraît énorme.

Il s'explique : BNP est une **banque**. Elle te vend le prix de gros, au plus près
du coût réel. Stripe est un **revendeur** : il paie le même prix de gros, y ajoute
sa marge, et vend le tout emballé avec les outils.

Tu paies donc plus cher chez Stripe, et en échange tu ne développes presque rien.
C'est un arbitrage classique : **acheter du temps contre de l'argent.**

## 4. Le piège des cartes d'entreprise

Il y a deux familles de cartes, et elles ne coûtent pas le même prix :

- **la carte d'un particulier** : la loi européenne plafonne les frais, donc elle
  est bon marché ;
- **la carte d'une entreprise** (carte pro, carte affaires) : elle n'est **pas**
  plafonnée, donc elle coûte beaucoup plus cher.

Chez BNP, on passe de 0,27 % à 1,97 % selon le réseau.
Chez Stripe, on passe de 1,5 % à 2,8 %.

**Tes clients sont des artisans, donc des entreprises.** Une partie d'entre eux
paiera avec une carte professionnelle. C'est le paramètre le plus sensible de
toute l'étude, et personne ne peut le deviner à l'avance : il se mesure en
production, au bout d'une centaine de paiements.

## 5. Le prélèvement, l'option que personne ne regarde

Au lieu de taper sa carte tous les mois, le client **signe une autorisation une
seule fois**. Ensuite l'argent part tout seul de son compte. C'est le prélèvement
SEPA, exactement comme pour une facture d'électricité.

Deux avantages, et le second compte encore plus que le premier :

**C'est moins cher.** Chez Stripe, un prélèvement coûte **0,35 euro fixe, sans
aucun pourcentage**. Sur 29,90 euros, c'est 1,17 %. Une carte, au même endroit,
coûte entre 3 et 3,6 %. Soit **trois fois moins cher**.

**Ça ne s'arrête pas tout seul.** Une carte expire au bout de trois ans, se fait
voler, se fait remplacer. Chaque fois, le paiement casse, et il faut courir après
le client pour qu'il ressaisisse ses coordonnées. Beaucoup ne le font jamais et
l'abonnement meurt sans que personne ne l'ait décidé : on appelle ça l'impayé
involontaire. **Une autorisation de prélèvement, elle, n'expire pas.**

Le seul inconvénient : un prélèvement n'est pas instantané, et le client peut le
refuser jusqu'à huit semaines après. Il faut en tenir compte dans l'accès au
service.

## 6. Ce que ça donne, en euros

Pour un abonnement de 29,90 euros HT encaissé une fois par mois :

| Comment on encaisse | Coût d'un paiement | Part du prix |
|---|---|---|
| Prélèvement SEPA chez Stripe, sans le carnet | 0,35 euro | 1,17 % |
| Carte chez BNP, clients payant en carte perso | 0,31 euro | 1,03 % |
| Carte chez BNP, mélange réaliste avec des cartes pro | 0,42 euro | 1,42 % |
| Prélèvement SEPA chez Stripe, avec le carnet | 0,56 euro | 1,87 % |
| Carte chez Stripe, avec le carnet | 0,91 à 1,06 euro | 3,0 à 3,6 % |

Et sur cinq ans, avec une croissance jusqu'à 4 000 abonnés, développement du
carnet compris quand il faut l'écrire :

| Solution | Coût total sur 5 ans |
|---|---|
| Stripe en prélèvement, carnet écrit par nous | 41 070 euros |
| BNP Axepta, carnet écrit par nous | 48 252 euros |
| Stripe en prélèvement, avec Billing | 56 042 euros |
| Stripe en carte, avec Billing | 106 541 euros |

## 7. Ce qu'il faut retenir

**La vraie question n'est pas « BNP ou Stripe ».** C'est :

1. **Carte ou prélèvement ?** C'est ce choix qui fait le plus gros écart, de
   l'ordre de 1 à 3. Il pèse deux fois et demie plus lourd que le choix du
   prestataire.
2. **Acheter le carnet de comptes, ou l'écrire ?** L'acheter coûte 0,7 % du
   chiffre d'affaires à vie. L'écrire coûte 6 000 euros une fois, puis de
   l'entretien.

Et une fois ces deux questions tranchées, le prestataire vient presque tout seul.

**Un point important :** comme le carnet est à écrire aussi bien chez BNP que si
tu veux éviter Billing chez Stripe, l'effort de développement s'annule entre les
deux. Dans ce cas, **Stripe en prélèvement reste moins cher que BNP**, sans les
18 euros par mois d'abonnement, et avec une bien meilleure documentation.

## 8. La question à poser à la BNP avant toute décision

BNP annonce 0,27 % pour une carte de débit. Or le plafond européen des frais de
base pour ce type de carte est de 0,20 %. Leur prix est donc à 0,07 point
au-dessus du prix de gros, ce qui est **soit une très bonne offre, soit un
affichage incomplet**.

La question, à poser par écrit :

> « Les taux indiqués sont-ils tout compris, interchange et commissions réseau
> inclus, ou s'agit-il de votre seule commission d'acquisition, à laquelle
> s'ajoutent ces coûts ? »

Si la réponse est la seconde, **toute la comparaison bascule** et BNP devient
nettement plus cher que ce que la proposition laisse croire.

Trois autres choses manquent dans leur proposition, et il faut les demander :
le paiement récurrent est-il possible (encaisser tous les mois sans que le client
ressaisisse sa carte) ; proposent-ils le prélèvement SEPA et à quel prix ;
combien coûte un impayé ou une contestation.
