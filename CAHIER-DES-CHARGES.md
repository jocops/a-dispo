# Cahier des charges de « à dispo »

> Document assemblé le 15/09/2026 sur le dépôt de référence `/Users/joanaglave/a-dispo`,
> déployé automatiquement à chaque poussée sur `https://a-dispo.strattonn-pilotage.workers.dev`.
> **Règle du document : chaque affirmation porte sa preuve.** Un fichier, une ligne, un comptage.
> Ce qui existe est écrit au présent et cité. Ce qui n'existe pas est écrit au futur et marqué
> **A CONSTRUIRE**. Ce qui n'a pas pu être vérifié est écrit « non vérifié » et compté à part.

## Ce qu'est le produit

Une place de marché d'entraide entre entreprises artisanales du bâtiment. Un professionnel a promis une date à son client et il lui manque une demi-journée de bras ; un autre a deux demi-journées vides la semaine prochaine. Le produit sert à ce que le premier trouve le second, **sur un jour nommé**.

Ce n'est jamais de l'emploi. L'article L8241-1 du code du travail interdit le prêt de main d'oeuvre à but lucratif, jusqu'à 150 000 euros pour une personne morale. La seule voie légale est la mise en relation entre entreprises immatriculées qui contractent en sous-traitance au sens de la loi de 1975. Cette contrainte a conditionné la conception : pas de facturation d'heures, pas de mise à disposition de personnel, pas d'annonce au taux horaire. Le vocabulaire d'embauche et d'intérim est proscrit partout, y compris dans ce document.

## Où le produit en est

Le socle est fait et il ne se reconstruit pas : 7 832 lignes de SQL, 35 tables, 83 déclarations de politique, rejouées deux fois sur un vrai PostgreSQL sans échec. Douze écrans sont construits et servis, plus l'outil commercial. **Le débat porte sur la façade, jamais sur la base.**

Un audit du 15/09/2026 a recensé **325 fonctions distinctes**, dans cinq états : 166 en service, **57 en base seulement**, 43 promises quelque part et absentes du code, 33 dessinées sans rien derrière, 26 manques identifiés jamais construits. Les 57 dormantes recouvrent le paiement, la facturation, les relances, le parrainage, les pièces justificatives, les huit courriels transactionnels, les rôles, les événements et trois tâches d'entretien. C'est le meilleur rapport du projet : **brancher coûte moins cher que construire**.

## À quoi sert ce document

Trois usages, et pas un quatrième.

1. **Dire ce qui est**, avec assez de précision pour qu'une personne qui n'a pas écrit le code puisse le reprendre.
2. **Dire ce qui manque**, en séparant ce qui attend une ligne de code de ce qui attend une décision de Joan, de Claire-Marie, d'un avocat ou d'un comptable.
3. **Servir de référence de recette** : chaque chiffre de ce document est re-mesurable par la commande qui l'accompagne.

Ce document ne vend rien et ne rassure personne. Quand une promesse du produit n'est pas tenue, il l'écrit.

---

## Sommaire

| | Chapitre | Ce qu'il porte |
|---|---|---|
| | [Les chiffres du dossier](#les-chiffres-du-dossier) | la mesure unique, à laquelle tous les chapitres renvoient |
| A | [Présentation](#a-présentation) | le produit, son état, ses acquis |
| B | [Objectifs](#b-objectifs) | ce qu'on cherche, ce qu'on refuse |
| C | [Personas](#c-personas) | le patron qui a dit jeudi, le solo, l'opératrice |
| D | [Parcours utilisateurs](#d-parcours-utilisateurs) | écran par écran, et ce qui échoue |
| E | [Fonctionnalités](#e-fonctionnalités) | les cinq états, et les 57 dormantes nommées |
| F | [Architecture technique](#f-architecture-technique) | la chaîne de la source à l'URL |
| G | [Architecture Supabase](#g-architecture-supabase) | le socle, les fonctions de périphérie, le stockage |
| H | [Schéma de base de données](#h-schéma-de-base-de-données) | 35 tables, 7 vues, ce que personne n'interroge |
| I | [Authentification](#i-authentification) | une seule table de comptes, et ses gardes |
| J | [Autorisations](#j-autorisations) | quatre rôles, et où ça tiendrait mal |
| K | [Le CRM commercial](#k-le-crm-commercial) | l'outil de Claire-Marie, et la fiche 360 manquante |
| L | [L'espace client](#l-lespace-client) | les douze écrans, et le prix qui se contredit |
| M | [L'application mobile](#m-lapplication-mobile) | elle n'existe pas : son architecture cible |
| N | [Le paiement](#n-le-paiement) | l'interface du prestataire, et les huit gestes qui restent |
| O | [Les notifications](#o-les-notifications) | huit courriels écrits, zéro appelant |
| P | [La mesure du parcours](#p-la-mesure-du-parcours) | l'entonnoir, et la minimisation |
| Q | [Données personnelles](#q-données-personnelles) | ce qui tourne, et les 52 mentions manquantes |
| R | [Sécurité](#r-sécurité) | l'audit, ses trous, et ce qu'il ne prouve pas |
| S | [API](#s-api) | il n'y a pas d'API maison, et c'est une décision |
| T | [UX et UI](#t-ux-et-ui) | navigation, états, geste, accessibilité |
| U | [Le design system](#u-le-design-system) | il n'existe pas comme fichier |
| V | [Référencement](#v-référencement) | le site refuse la visite, et jusqu'à quand |
| W | [Performance](#w-performance) | les poids mesurés, et 78 % de tiers |
| X | [Tests et contrôles](#x-tests-et-contrôles-automatiques) | zéro, et 1 898 lignes perdues |
| Y | [La surveillance](#y-la-surveillance) | le mode de panne qui ne lève aucune erreur |
| Z | [L'entretien](#z-lentretien) | tâches, conservation, migrations, sauvegardes |
| AA | [Les contradictions tranchées](#aa-les-contradictions-tranchées) | ce que six relevés disaient différemment |
| AB | [Ce qui reste à trancher](#ab-ce-qui-reste-à-trancher-par-joan) | questions fermées, pour décision |

---

## Les chiffres du dossier

Mesuré le 15/09/2026 sur `/Users/joanaglave/a-dispo`, branche `main`, arbre propre. **Aucun chapitre de ce document ne recompte ces valeurs : ils y renvoient.** Chaque ligne porte la commande qui la reproduit.

| Mesure | Valeur | Commande |
|---|---|---|
| Écrans construits et servis | **12**, plus le CRM | table `ECRANS`, `outils/construire.mjs:29-42` |
| Lignes de HTML applicatif | **16 364** | `wc -l app/*/index.html` |
| Fichiers SQL | **14** (13 migrations plus `schema.sql`) | `ls supabase/migrations/*.sql` |
| Lignes de SQL | **7 832** | `cat supabase/migrations/*.sql \| wc -l` |
| Tables | **35** | `grep -h "create table if not exists public." \| sort -u` |
| Vues | **7** | |
| Lignes portant le texte `create policy` | **83** | `grep -h "create policy" \| wc -l` |
| Instructions `create policy` réelles | **79** | les 4 autres sont dans des commentaires |
| Politiques vivantes après un rejeu complet | **non arrêté**, voir AA.2 | à mesurer en base |
| Noms de fonctions SQL distincts | **93** | `grep -h "create or replace function public." \| sort -u` |
| Fonctions de périphérie (Deno) | **4 dossiers, 3 510 lignes** | `find supabase/functions -name "*.ts" \| xargs wc -l` |
| Outil de construction | **110 lignes**, une commande | `wc -l outils/construire.mjs` |
| Poids de `dist/` | 1,3 Mo, 13 pages | |
| Marqueurs `[A COMPLETER]` affichés sur `/legal` | **39**, pour 35 intitulés distincts | `grep -c 'class="tc"' app/legal/index.html` |
| Marqueurs `[A COMPLETER]` affichés sur `/messages` | **6**, pour 5 intitulés distincts | lignes 694, 1359, 1360, 1432, 1556, 1924 |

**Les acquis, qui ne se rediscutent nulle part dans ce document :**

| Décision | Valeur | Date |
|---|---|---|
| Prix | 29,90 euros HT par mois, sans engagement, premier mois offert | 15/09/2026 |
| Régime | HT, parce que la cible est professionnelle et qu'un micro-entrepreneur ne récupère pas la TVA | 15/09/2026 |
| Rémunération Alp Valley | 7 % du chiffre d'affaires, **distincte du prix payé par l'artisan** | 02/09/2026 |
| Territoire | Lyon et Annecy pour commencer | 02/09/2026 |
| Charte | crème `#F8F4EC`, encre `#191512`, rouge `#E12154`, accent de texte `#890026`, Space Grotesk et DM Sans | |
| Voix | tutoiement partout, datée, brève, vérifiable | `VOIX.md` |
| Socle | ne se reconstruit pas | |
| Droit | sous-traitance entre entreprises indépendantes, jamais de l'emploi | art. L8241-1 |

**Le rouge vaut 4,21 sur le papier, sous le seuil AA de 4,5 : il ne porte jamais une lettre.** Quand un accent doit être lu, c'est `--accent-texte #890026`. Quand il doit être vu, c'est un aplat.

---

## A. Présentation

### A.1 L'architecture, en une phrase

Un socle Supabase (authentification, base, sécurité par ligne, compartiment de fichiers privé), et trois clients de ce même socle : le produit artisan (12 écrans), l'outil commercial `/crm`, et l'application mobile à venir. **Une identité, une base, les mêmes droits.**

Le site est statique : `wrangler.jsonc` déclare un worker qui ne sert que des fichiers, sans rendu serveur. Le navigateur parle directement à Supabase avec la clé publique, et ce qu'elle ouvre est décidé par les politiques, jamais par le code de la page. Ce n'est pas une intention : la table `inscriptions` n'a aucune politique de lecture pour `anon`, donc la liste d'attente ne peut pas être aspirée par qui lit le code source (`supabase/migrations/migration-inscriptions.sql:96-113`).

### A.2 Ce que le produit dit lui-même de ce qui ne marche pas

C'est la signature du dossier, et elle est tenue sur plusieurs fichiers : **une fonction non branchée ne s'écrit jamais au présent, et la cause est dite en clair, pour un artisan.**

- Les quatre raccordements d'agenda automatiques sont éteints, avec leur motif : `app/espace/index.html:1338`, `:1341`, `:1344`, `:1347` (`pret: false`).
- Le dépôt d'un fichier `.ics` fonctionne : c'est la seule des cinq voies qui ne demande de compte à personne.
- Le bouton Google de `/connexion` s'éteint tout seul après lecture de `/auth/v1/settings`, et il dit pourquoi (`app/connexion/index.html:341-355`).
- Le filtre de commune et le filtre de rayon de `/recherche` sont désactivés tant que la table `communes` est vide (`app/recherche/index.html:478` et `:492`).
- `/legal` affiche 39 marqueurs à l'endroit exact où l'information manque, et calcule la liste à chaque ouverture plutôt que de la recopier.

Cette règle est **cassée à trois endroits**, et ce sont les défauts les plus coûteux du produit : le courriel de confirmation promis et jamais envoyé (D.2), la résiliation promise au présent sans bouton (N.9), et le prix qui se contredit d'un écran à l'autre (L.4).

### A.3 Trois documents du projet ne décrivent plus ce dépôt

Ils gardent leur valeur pour les décisions et les mesures datées. Ils ne l'ont plus pour les chemins de fichiers et les comptages. **Seul le code fait foi.**

| Document | Ce qu'il décrit | Ce qui est vrai ici |
|---|---|---|
| `ARCHITECTURE.md` | chemins `crm/supabase/*.sql`, 7 681 lignes, 13 fichiers, 80 `create policy`, 63 politiques, 33 tables, une table `PAGES` dans `outils/build.py` à 28 entrées, un écran `/telecharger`, deux chaînes de construction, Cloudflare Pages | `supabase/migrations/`, 7 832 lignes, 14 fichiers, 83 `create policy`, 35 tables, la constante `ECRANS` de `outils/construire.mjs` à 12 entrées, aucun `/telecharger`, une seule chaîne, un Worker Cloudflare |
| `CHARTE-CLAIRE.md` | une charte ambre sur bleu nuit (`--bg #F6F3EC`, `--accent #E8B93E`, `--accent-texte #765A0E`) | les 12 écrans appliquent crème et rouge |
| `VOIX.md` | 40 réécritures ancrées sur `site/index.html` et `react/src/routes/*.tsx` | ni `site/` ni `react/` n'existent ici. **Les 23 règles restent valables**, leurs ancrages ne le sont plus |

La mémoire `dispo-deploiement.md` est dans le même cas : elle décrit Cloudflare Pages, le projet `projet-dispo`, trois commandes Python et l'obligation de `--branch main`. Ce dépôt déploie un Worker par `npm run deploy`, une seule commande Node. **A CONSTRUIRE : mettre à jour cette mémoire, sans quoi la prochaine session rejouera une chaîne qui n'existe plus.**

---

## B. Objectifs

### B.1 L'objectif qui commande les autres

**Rendre une disponibilité datée cherchable.** Personne ne sait répondre aujourd'hui à la question « qui est libre jeudi ». L'audit des huit acteurs du marché donne **0 oui sur 8** pour la disponibilité datée saisie à l'avance, et **0 oui sur 8** pour la granularité à la demi-journée.

Formule exacte à tenir, parce que la formule large se démonte en trois clics : un concurrent publie bien une disponibilité, avec deux états observés (Immédiate, Semaine) et aucune colonne de date. Donc jamais « personne ne permet de dire qu'on est libre », toujours « personne ne sait répondre à : qui est libre jeudi ».

### B.2 Les objectifs produit, et ce qui les mesure

| # | Objectif | Ce qui le mesure | État |
|---|---|---|---|
| 1 | Publier une disponibilité **datée**, à la **demi-journée** | table `occupations`, volet Disponibilités de `/espace` | EN SERVICE, par plages et non par cases de 11 px |
| 2 | Trouver un confrère par **métier, dates et lieu** | `rechercher_confreres()`, `migration-recherche-relations.sql:389` | EN SERVICE côté métier. **Lieu et rayon éteints** : `communes` est vide |
| 3 | Ouvrir les coordonnées **des deux côtés en même temps** | `coordonnees_confrere()`, `:885`, qui lève une exception tant que l'état n'est pas `acceptee` | EN SERVICE |
| 4 | Vérifier le SIRET à l'annuaire officiel dès l'inscription | `/espace` étape 2, `recherche-entreprises.api.gouv.fr` | EN SERVICE, 7 verdicts et non 2. **Mais le verdict est écrit par le navigateur** : R.6.2 |
| 5 | L'artisan garde sa facture : **zéro commission** | aucune table ne porte de commission | TENU par l'absence de colonne |
| 6 | Pas d'engagement, dit en page d'accueil | `/espace:1236` | Dit dans l'espace, **pas sur l'accueil** |
| 7 | Exercer ses droits sans écrire à personne | 4 droits RGPD branchés, `/mes-donnees` | EN SERVICE |
| 8 | Une entreprise ne voit jamais les données d'une autre | 79 politiques, `fiches_publiques` en colonnes nommées | EN SERVICE dans les fichiers, **à revérifier en base** |

### B.3 L'objectif commercial, et son hypothèse la plus fragile

Le modèle est **100 % abonnement, sans commission**. L'étude de marché le dit sans ménagement : « Personne n'a démontré que les artisans paient durablement un abonnement fixe pour ça. C'est l'hypothèse n°1 à valider, pas à supposer » (`02-ETUDE-DE-MARCHE.md`, synthèse).

Trois faits datés encadrent cet objectif :

- Le prix se place dans la fourchette basse du logiciel BTP (12 à 50 euros en entrée de gamme). **Le prix n'est pas le problème.**
- La double dépense l'est : l'artisan paie déjà 25 à 40 euros par mois pour sa facturation, rendue obligatoire en septembre 2026.
- Le déclencheur de résiliation identifié est le premier mois vide. Churn à modéliser entre 5 et 8 % par mois.

Conséquences déjà inscrites dans le produit : le premier mois est offert, et **la durée de l'essai est lue en base** (`reglages`), pas écrite dans une phrase. Un nombre recopié dans du texte ne se met jamais à jour.

### B.4 L'objectif de lancement

**Un bassin, deux à trois métiers, avant toute expansion.** Lyon et Annecy. La densité locale prime sur la couverture.

La liste d'attente sert exactement à cela : savoir **combien** d'artisans, dans **quel** métier, et **où**. La table `inscriptions` porte trois colonnes pour cette seule décision, plus `provenance`, qui dira quel canal mérite qu'on y remette de l'argent (`migration-inscriptions.sql:6-10` et `:63-65`).

Le fait qui doit rester sous les yeux : **0 fiche sur les 1 374 du CRM dans le Rhône, 0 en Haute-Savoie**, contrôlé deux fois, par le département et par le code postal. Le territoire de lancement est celui où le carnet est le plus vide.

### B.5 Ce que le produit refuse de faire, et pourquoi

Un cahier des charges qui ne dit pas ce qui est hors périmètre fait construire deux fois.

| Refus | Motif, sourcé |
|---|---|
| Toucher à l'argent du chantier | « je pense qu'il faut pas qu'on récupère d'argent » (RDV1). Deux acteurs sur 8 le font, c'est leur différence, pas la nôtre |
| Garantir un résultat | « satisfait ou remboursé, non, là on maîtrise pas le truc, donc non » (RDV2) |
| Afficher un compteur de volume auto-déclaré | 4 acteurs sur 6 en affichent un, aucun n'est audité, l'un en affiche deux incompatibles sur la même page |
| Afficher une distance en kilomètres | `communes` est vide : le rayon ne se calcule pas. Le lieu se nomme, il ne se chiffre pas |
| Un mur de commentaires public | « il y a beaucoup d'haters, ça part vite un peu en cacahuètes » (RDV3) |
| Corriger une donnée d'artisan depuis le back-office | Le déclencheur `artisans_moderation` la remet à sa valeur d'origine : corriger à la place de quelqu'un, c'est signer une information qu'on n'a pas vérifiée |
| Indexer le site | La marque n'est pas déposée à l'INPI, et `/artisan` porte le prénom d'une personne physique |

### B.6 L'objectif de ce cycle de travail

Il est nommé par le comptage de l'audit : **brancher les 57, avant de construire les 26.** Le SQL des 57 existe, il est testé, il porte ses politiques, et aucun écran ne l'appelle. C'est du travail déjà payé qui dort. Le chapitre E les nomme une par une.

---

## C. Personas

Le persona est établi dans `VOIX.md`. Il est repris ici, avec l'avertissement qui en fait partie.

### C.1 Le persona principal : le patron qui a dit jeudi

Plombier-chauffagiste, une entreprise de moins de dix personnes, autour de Lyon. Son problème n'est ni le manque de travail ni le prix : c'est un jour promis à un client qu'il ne peut pas tenir seul. Il n'embauchera pas, et ce n'est pas un pis-aller : c'est ce que le marché préfère déjà. Son compte est tendu, son marché recule, son poste logiciel augmente en septembre 2026 par obligation légale. Il arrive échaudé par des promesses d'avant-vente non tenues, donc toute phrase de promesse le referme. On le joint par téléphone. Sa représentation du produit est une application, pas un site. **Son unité de travail est la demi-journée, jamais la semaine.**

#### La contradiction assumée, qui ne se masque pas

**Cet angle est minoritaire en nombre.** Les entreprises sans salarié représentent **73,6 %** du secteur contre **26,4 %** pour les 1 à 10 salariés, soit 2,8 pour 1 (457 650 solos, environ 164 000 TPE). Conséquence tranchée, et c'est une règle de conception : entrée **neutre** pour tout le monde, vocabulaire d'effectif **interdit** sur les écrans partagés, toléré uniquement dans le parcours « je cherche », et seulement si Joan le valide.

#### L'avertissement qui fait partie de la fiche

Ce qui précède est un **scénario, pas une mesure**. Le dossier déclare explicitement inconnus son équipement numérique, son aisance avec une application, l'heure à laquelle il consulte, son âge, et le temps qu'il passe aujourd'hui à chercher une entreprise. Aucune analytique n'existe. Les deux seuls appuis mesurés sont le **canal** (téléphone, 97,7 % des fiches CRM) et l'**unité** (la demi-journée, verbatim RDV3 et code de l'espace artisan). Toute personne qui citera cette section dans six mois doit trouver cet avertissement avant le récit.

#### Ses deux moments

**Moment 1, le plus important.** Fin de journée. Le client a confirmé le chantier pour jeudi, et il manque une demi-journée de plomberie. Aujourd'hui il fait ce que Claire-Marie décrit pour une nacelle : « J'ai dû faire 15 appels pour trouver » (RDV3). Avec l'application : le métier, le jour. Puis il appelle.

**Moment 2.** Le planning de la semaine suivante s'est vidé sur deux demi-journées. Il les tape, parce que c'est l'unité réelle de son métier.

#### Ce qui le fait fuir, et ce que ça interdit au produit

| Ce qui le fait fuir | Ce que ça interdit |
|---|---|
| L'engagement, même court (irritant n°1 : 6 à 12 mois, frais de sortie à 50 % du restant dû, minimum 100 euros) | Toute clause de durée. « Sans engagement » en page d'accueil, pas au fond des conditions |
| Une promesse de vitrine que l'écran suivant dément | « Ta fiche en 2 minutes » contre 7 min 30 annoncées par le produit lui-même |
| Un chiffre de simplicité qu'il peut compter lui-même | « Trois écrans » contre 5 entrées de navigation |
| Un voyant vert qui ment | Aucun badge d'état qui ne soit adossé à une mesure |
| Le vocabulaire d'embauche et d'intérim | Interdit juridiquement |
| Toute phrase qui le place en demandeur | « il y a la fierté de l'artisan, de dire je n'ai pas envie de dire que je suis dispo » (RDV1) |
| L'alarmisme sur une douleur ancienne | « Prêt à ne plus jamais refuser un chantier ? » lui apprend ce qu'il sait depuis 2021 |
| Le registre de croissance | Marché en repli depuis sept trimestres, chiffre d'affaires en baisse de 6 % en 2024 |
| Un prix annoncé seul | Il paie déjà 25 à 40 euros par mois de logiciel |
| Un chemin de fichier ou un code d'erreur à l'écran | Aucun `PGRST205` visible par un artisan |
| Le texte trop petit et la phrase trop longue | « c'est écrit trop petit pour moi » (RDV2) |

#### Ce qui le convainc

- **Un jour nommé.** 0 oui sur 8 acteurs audités.
- **La demi-journée.** 0 oui sur 8. Le produit la porte déjà.
- **Le SIRET vérifié à l'annuaire officiel dès l'inscription.** 0 oui sur 8. Le concurrent qui met en avant des « artisans vérifiés » demande six champs et aucun SIRET.
- **Pas d'engagement, écrit en page d'accueil.** Réponse directe à l'irritant n°1, et cet argument dort chez les autres.
- **Une limite dite avant qu'il la trouve.** C'est déjà la signature du produit.
- **Sa facture qui reste la sienne.** Dit par sa conséquence, jamais comme une nouveauté.
- **Le paiement après le premier chantier.** « il sent qu'il a pas investi tout de suite pour rien » (RDV2). Le blocage est la trésorerie, pas le montant.
- **Le territoire étroit, nommé.** Dire où l'on n'ouvre pas est l'inverse exact du compteur auto-déclaré.
- **Le métier nommé.** Les taux de difficulté vont de 75 % à 82 % selon le métier : un couvreur se reconnaît dans son métier, pas dans une moyenne.
- **La paperasse nommée pièce par pièce**, comme un travail qu'on lui épargne.
- **Une phrase qu'il peut redire à un maçon sur un chantier.** Le parrainage fait x2,8 contre l'acquisition payante.

#### Ce sur quoi il est adossé, chiffre par chiffre

| Trait | Source |
|---|---|
| Entreprise de 1 à 10 salariés, environ 164 000, 26,4 % | `02-ETUDE-DE-MARCHE.md` l. 51 et l. 36 (CAPEB 2024) |
| Plomberie-chauffage, plus de 75 % de difficulté | l. 49, France Travail BMO 2024-2025 |
| Autour de Lyon | RDV du 02/09/2026, avec Annecy. **Aucun rayon en km n'est sourcé nulle part** |
| A déjà renoncé à un chantier : 63 % | OpinionWay pour la CAPEB, 2021. Statistique de population transformée en souvenir individuel : licence de persona, signalée comme telle |
| N'embauchera pas, et le préfère ainsi | « c'est le bordel un employé » (Claire-Marie, RDV3 du 06/09/2026) |
| Trésorerie tendue, marché en repli | 27 % de trésorerie dégradée fin 2024 |
| Joignable au téléphone | 97,7 % des 1 374 fiches portent un numéro, 74,0 % une adresse |
| Il n'est dans aucun de nos fichiers | 0 fiche dans le Rhône, 0 en Haute-Savoie |
| Sa représentation du produit est une application | « Non non non, il faut commencer par l'application » (RDV1) |
| Son unité est la demi-journée | « ils font des chantiers de demi-journées » (RDV3) |

**Réserve obligatoire quand on cite les taux du CRM :** ce fichier ne contient aucun plombier (les 7 valeurs de métier présentes sont vide, Électricien, Menuisier, Fermetures, Serrurier métallier, Portails et automatismes, Isolation). Ces taux décrivent une population voisine, pas la sienne.

### C.2 Le second public, à parts égales : le solo qui a une semaine creuse

`VOIX.md` pose **deux publics à parts égales**. Le solo sans salarié est majoritaire (73,6 %) et son geste est l'inverse : il publie ses demi-journées libres et prend du travail quand ça l'arrange.

Même écran d'entrée, même vocabulaire (la neutralité de l'entrée est une décision, pas une économie), même fiche, même vérification de SIRET, même messagerie. Ce qui diffère est le sens du parcours : il remplit ses disponibilités d'abord, il cherche ensuite, ou jamais. Le produit porte déjà les trois modes (« Je suis dispo », « Je cherche des gens », « Les deux ») dans `crm/src/config.js`, **sans aucun montant attaché** : le rendez-vous n°2 a rejeté la grille mensuelle par formule.

**Le fait qui gouverne le lancement, et qu'aucun des deux personas ne résout seul :** il faut amorcer l'offre avant la demande. Une recherche qui ne rend personne le premier mois produit une résiliation.

### C.3 Claire-Marie, l'opératrice

Ce n'est pas une cliente, c'est la personne qui fait tourner le produit. Elle a son écran, `/crm`. Son besoin est de qualifier un contact et de savoir où en est le fichier, pas d'utiliser la place de marché.

**Le trou est structurel et il est connu :** un inscrit arrive dans `artisans`, pas dans `contacts`. Elle le voit dans `/admin` avec un compte administrateur, pas dans son CRM avec son compte commercial. Aucun pont n'existe entre les deux mondes, et c'est volontaire : c'est la cloison qui protège les 1 374 fiches de prospection.

### C.4 Le persona qui n'existe pas encore : l'administrateur

`/admin` existe (1 278 lignes), il lit les artisans, les pièces, les demandes, les signalements et le journal, et il modère. Mais **le devis qui le porte n'est pas signé** : le fichier le dit lui-même en tête (`app/admin/index.html:2-7`). Cet écran existe, il n'est pas facturé. Il est décrit ici parce qu'il est dans le code, pas parce qu'il est vendu.

---

## D. Parcours utilisateurs

Ce chapitre a été marché en lisant le code, écran par écran. Chaque étape dit ce qui peut échouer et ce que l'écran affiche alors.

### D.0 Le graphe de navigation, relevé

Relevé par extraction de tous les `href="/..."` des 12 écrans.

| Écran | Vers |
|---|---|
| `/` | `/connexion`, `/inscription` |
| `/connexion` | `/aide` |
| `/inscription` | **aucun** |
| `/espace`, `/recherche`, `/artisan`, `/messages`, `/mes-donnees` | `/`, `/recherche`, `/demandes`, `/messages`, `/mes-donnees`, `/aide`, `/connexion` |
| `/demandes` | idem, sans `/connexion` |
| `/admin` | `/connexion`, `/espace` |
| `/aide` | **aucun** |
| `/legal` | **aucun** |

**Trois constats, mesurés.** `/legal` n'est cité par aucun écran : **les mentions légales ne sont atteignables qu'en tapant leur adresse**, ce qui est aussi un défaut légal. `/aide` n'est atteignable que depuis les écrans connectés, jamais depuis l'accueil. `/inscription`, `/aide` et `/legal` sont des culs-de-sac : rien n'en repart. `/artisan` n'a aucun lien littéral : il est atteint en JavaScript (`recherche/index.html:534`, constante `PAGE_FICHE`), ce qui rappelle que ce relevé ne voit pas les liens construits à l'exécution.

### D.1 Le visiteur, sur `/`

1 172 lignes. Une page publique, sans compte.

| Ce qui peut arriver | Ce que l'écran affiche |
|---|---|
| Tout va bien | Les deux sorties : « Créer mon compte » vers `/connexion`, « Rejoindre la liste d'attente » vers `/inscription` |
| Le visiteur cherche le prix | Ligne 896 : **« Tarif en cours d'arbitrage »**. Le prix est pourtant arrêté depuis le 15/09/2026 |
| Le visiteur cherche les mentions légales | **Rien.** Aucun lien vers `/legal` |
| Le visiteur compte lui-même | Ligne 850 « Ta fiche en 2 minutes », lignes 724 et 1066 « Trois écrans », ligne 848 « Trois gestes ». Le produit annonce 5 étapes et 7 min 30 |

**Ce qui échoue ici n'est pas technique, c'est une promesse que l'écran suivant dément.** C'est exactement l'irritant n°2 du persona.

### D.2 L'inscription à la liste d'attente, sur `/inscription`

337 lignes. **Ce n'est pas une création de compte.** C'est une liste d'attente : quatre champs, et un écrit direct dans `inscriptions` avec la clé publique.

1. Le menu des métiers est construit à partir d'une liste de 16 valeurs (ligne 204). « Un autre métier » fait surgir un champ libre, au moment exact où le manque se constate (ligne 220).
2. Deux pièges anti-robot : un champ leurre `societe` (ligne 178) et un chronomètre de 3 secondes (ligne 227). **On ne dit rien au robot** : il reçoit le même message qu'un succès, parce que lui répondre « refusé » lui apprend quoi contourner.
3. L'envoi est un `POST /rest/v1/inscriptions` avec `Prefer: return=minimal` : la base ne renvoie rien, ce qui garantit que **le jeton de confirmation ne sort jamais vers le navigateur**.

| Échec possible | Ce que l'écran affiche |
|---|---|
| Département invalide | « Deux chiffres, comme 69 ou 73 » (ligne 158) |
| Adresse mal formée | « Vérifie ton adresse : il manque quelque chose » |
| « Un autre métier » sans dire lequel | « Écris ton métier, c'est justement ce qu'on cherche à savoir ». La base refuse aussi, contrainte `metier_libre_si_autre` |
| Adresse déjà inscrite (23505) | « Tu es déjà dans la liste. » Ce n'est pas une erreur, et le dire comme une erreur inquiète pour rien |
| Table absente (PGRST205) | « Les inscriptions ne sont pas encore ouvertes », plus une ligne technique. **Un artisan ne doit jamais lire ce message** |
| Réseau coupé | « Pas de réseau. Ton inscription n'est pas partie » |
| Succès | « On vient de t'envoyer un email. Clique sur le lien qu'il contient pour confirmer » |

**Le défaut le plus grave du parcours est dans la dernière ligne.** L'écran affirme qu'un courriel est parti (`app/inscription/index.html:300`). **Aucun courriel ne part.** `supabase/functions/envoyer-email/` existe (1 836 lignes, huit gabarits validés) et n'est appelée par aucun fichier du dépôt ; `confirmer_inscription()` (`migration-inscriptions.sql:126`) n'est appelée par personne. La conséquence est double : l'artisan attend un message qui n'arrivera pas, et **le compteur d'inscrits confirmés restera à zéro alors que c'est lui qui doit décider où ouvrir**.

### D.3 La connexion, sur `/connexion`

525 lignes. Deux voies : Google, ou adresse et mot de passe. La bibliothèque Supabase n'est chargée **qu'au clic** (ligne 300) : sur un chantier en 4G, la faire descendre à quelqu'un qui ne fait que passer se compte en secondes.

**Le bouton Google dit la vérité avant d'être touché.** La page lit `/auth/v1/settings` au chargement, un point public. Si `google` vaut faux, le bouton s'éteint et dit pourquoi. Le motif est écrit dans le code (lignes 313 à 330) : `signInWithOAuth` fait **naviguer** le navigateur ; si le fournisseur est éteint, l'artisan atterrit sur une page blanche couverte de JSON, et aucun `try/catch` ne peut plus rien.

La voie par mot de passe se joue en deux temps. **Premier temps, et il ne charge rien** : le champ du mot de passe se révèle instantanément. On ne cherche **pas** à savoir si le compte existe : Supabase répond « identifiants invalides » dans les deux cas, et c'est voulu, sinon on saurait quelles adresses sont inscrites. **Second temps** : on tente d'entrer, et si la base refuse, on tente de créer. **L'ordre compte** : tenter la création d'abord renverrait « adresse déjà prise » à quelqu'un qui a simplement mal tapé son mot de passe.

| Échec possible | Ce que l'écran affiche |
|---|---|
| Mot de passe de moins de 8 caractères | « Huit caractères minimum. C'est la seule exigence » |
| Inscriptions fermées sur le projet Supabase | « Les inscriptions ne sont pas encore ouvertes. » Cas mesuré le 13/09/2026 : l'artisan recevait « vérifie ton mot de passe » alors que son mot de passe n'y était pour rien |
| Compte existant, mot de passe faux | « Ça ne passe pas. Vérifie ton mot de passe, ou demande à le réinitialiser. » On ne dit jamais « ce compte existe » |
| Compte créé, confirmation exigée | « Compte créé. On vient de t'envoyer un mail » (**et il ne part pas non plus**) |
| Mot de passe oublié | Même réponse que l'adresse existe ou non |
| Session déjà ouverte | Redirection vers `/espace`, **sans télécharger la bibliothèque** |

### D.4 Le parcours en cinq étapes, sur `/espace`

2 652 lignes, le plus gros écran du produit. Deux règles gouvernent :

- **On ne redemande jamais ce qu'on sait déjà.** L'étape atteinte est une colonne de la base (`artisans.etape`), pas une variable de page. Un artisan qui revient trois jours plus tard reprend où il s'était arrêté.
- **L'ordre des étapes suit l'effort croissant.** Le prénom coûte dix secondes, le SIRET trente, les compétences deux minutes, l'agenda demande d'aller chercher un mot de passe.

| # | Étape | Durée annoncée | Ce qui entre |
|---|---|---|---|
| 1 | `identite` | 30 secondes | prénom, nom, téléphone |
| 2 | `entreprise` | 1 minute | SIRET |
| 3 | `metier` | 2 minutes | métier, présentation, rayon |
| 4 | `abonnement` | 1 minute | choix, ou rien |
| 5 | `agenda` | 3 minutes | occupations |

**Total annoncé par le produit : 7 minutes 30** (constante `DUREE`, `app/espace/index.html:688-690`). L'accueil promet deux minutes. L'artisan le découvre pendant l'inscription, au pire moment.

#### Étape 2, la vérification du SIRET

L'étape la mieux écrite du parcours, et la seule du devis N°1 signé. La clé de contrôle est vérifiée dans le navigateur, puis le numéro est confronté à l'annuaire officiel (ligne 935).

| Échec possible | Ce que l'écran affiche |
|---|---|
| Moins de 14 chiffres | « Un SIRET compte 14 chiffres. Celui-ci en compte N » |
| Clé de contrôle fausse | Message de saisie, pas de refus d'entreprise |
| Entreprise absente de l'annuaire | « Si elle vient d'être immatriculée, c'est normal : réessaie dans quelques jours » |
| Entreprise non diffusible | État `NON_DIFFUSIBLE`, l'artisan **passe quand même** |
| Annuaire en panne | **On met en attente, on ne bloque jamais une inscription sur une panne qui n'est pas la sienne** |

Sept verdicts, pas deux. Un oui ou non ferait refuser de vrais artisans. **Réserve de sécurité : le verdict est écrit par le navigateur et aucune garde de base ne le recontrôle.** Voir R.6.2.

#### Étape 4, l'abonnement

Quatre états, et aucun écran blanc (lignes 1124 à 1130). Dans les quatre cas, **« Continuer sans payer » reste actif**. Le navigateur ne confirme jamais un paiement : il ouvre une session et envoie l'artisan chez le prestataire ; c'est `evenements-paiement` qui ouvre l'accès, sur message signé.

| État | Ce que l'écran affiche |
|---|---|
| Abonnement déjà actif ou impayé | « Ton abonnement est déjà en cours. » Aucun bouton, pour ne pas créer un second prélèvement |
| Paiement raccordé | « M'abonner », et « Tes coordonnées bancaires ne passent jamais par nous » |
| Paiement non raccordé | « Le prestataire de paiement n'est pas encore raccordé. Tu n'as aucune carte à saisir aujourd'hui » (`:1266-1271`) |
| Service injoignable | « On n'arrive pas à joindre le service de paiement. Ce n'est pas de ton fait » (`:1273-1276`) |

**Défaut mesuré : c'est le quatrième état qui s'affiche, pas le troisième.** Les trois fonctions de périphérie ne sont pas déployées (404 le 15/09/2026), donc `etatPaiement()` rend `inconnu`. **Le produit dit une panne là où il y a une décision non prise.** Le code est juste, c'est le déploiement qui manque.

Le prix s'affiche ici, ligne 1236 : **29,90 € HT par mois, sans engagement**, plus « Aucun pourcentage n'est prélevé sur tes chantiers. Ta facture reste la tienne. »

#### Étape 5, l'agenda

| Voie | État | Motif dit à l'écran |
|---|---|---|
| Google Agenda | éteinte | identifiants Google à créer |
| Microsoft Outlook | éteinte | application à déclarer chez Microsoft |
| Calendrier Apple | éteinte | raccordement à écrire |
| Adresse d'abonnement (ics distant) | éteinte | relais à écrire, un navigateur n'ayant pas le droit d'aller chercher un fichier ailleurs |
| **Dépôt d'un fichier .ics** | **marche** | rien à demander à personne |

La promesse tenue par l'absence de colonne : « On ne lit que le libre et l'occupé : jamais les titres, jamais les lieux, jamais les participants. » La table `occupations` ne porte ni titre ni lieu.

#### Fin du parcours

Entrer dans `fini` déclenche `ouvrir_essai_si_parcours_fini()`, qui crée la ligne d'abonnement en état `essai`. **Sans ce déclencheur, `acces_artisan()` rendait `ferme` pour toujours et le produit était inutilisable de bout en bout** (`migration-essai-30-jours.sql:15`). Repasser par `fini` ne donne pas un second essai.

#### L'espace terminé : quatre volets

« Aujourd'hui », « Disponibilités », « Ta fiche », « Tes agendas » (ligne 2437). Le volet Disponibilités porte le geste réel du métier : **l'artisan est libre par défaut et bloque des plages**, pas des demi-journées isolées. On touche le début, on touche la fin, la barre dit ce que ça change, et **un seul bouton** l'écrit. La vue change avec la largeur : liste des trois prochaines semaines sous 860 px avec des cibles à 48 px, grille du mois au-dessus. La version précédente posait soixante cibles de onze pixels à viser au pouce, avec des gants, sur un chantier.

### D.5 La recherche, sur `/recherche`

1 494 lignes. Trois champs : métier, période, commune. **Deux des trois sont éteints.**

| Champ | État | Motif écrit dans la page |
|---|---|---|
| Métier | actif | |
| Période | éteint | `:467` et `:471` |
| Commune du chantier | éteint | `:479`. La table `communes` est vide |
| Rayon | éteint | `:492`. « Le rayon s'applique à partir de la commune du chantier : sans commune, il ne filtre rien » |

La page mesure elle-même l'état de la base par `etat_recherche()` avant d'afficher quoi que ce soit, et n'allume un champ que si ce qu'il faut derrière existe. Quand la base ne rend rien, elle affiche des écrans d'exemple portant, **dans le même bloc visuel**, la mention « Écrans d'exemple. Les noms, les notes et les dates sont fictifs. » (ligne 579).

Quand aucun résultat ne sort : « Ce n'est pas un filtre trop serré : la liste est vide pour tout le monde », et une action. **Cette phrase est la signature du produit : une limite dite avant que l'artisan la trouve.**

### D.6 La fiche d'un confrère, sur `/artisan`

1 120 lignes. Elle **ne lit que la vue `fiches_publiques`**, jamais la table `artisans`. La vue nomme ses colonnes une par une : identifiant, prénom, dénomination, métier, présentation, photo, commune, département (code postal tronqué à 2 chiffres), rayon. **Le nom de famille, le téléphone et le SIRET n'y figurent pas**, et le code de la page ne tente rien pour les obtenir.

Elle se lit **sans être connecté** : la vue est ouverte à `anon`. C'est la condition pour qu'un lien reçu par SMS serve à quelque chose.

| Échec possible | Ce que l'écran affiche |
|---|---|
| Fiche introuvable ou non publiée | « fiche introuvable » et un retour vers la recherche |
| Les atouts (compétences, outillage, permis) | `artisan_atouts` n'a **aucune politique de lecture pour un visiteur**. Une lecture rendrait une liste vide même si l'artisan a déclaré quinze atouts. La page dit franchement que la vue publique `atouts_publics` reste à créer, plutôt que d'afficher « aucun atout déclaré », qui serait une fausse donnée |
| Accès fermé | `peut_demander()` est appelée avant d'afficher le bouton : s'il est faux, le bouton est éteint et dit pourquoi |

### D.7 La mise en relation, sur `/demandes`

1 998 lignes. Six états, portés par la base : `envoyee`, `vue`, `acceptee`, `refusee`, `annulee`, `expiree`.

La page **n'invente aucune règle d'état**. Le destinataire seul accepte, refuse ou ouvre ; le demandeur seul annule ; personne n'expire, sauf une tâche planifiée. Chaque carte ne montre que les actions permises à cet état, et quand la base refuse, la page répète ce que la base a dit.

| Échec possible | Ce que l'écran affiche |
|---|---|
| Fiche non publiée | « la base refuse les demandes vers une fiche non publiée », avec le geste qui débloque |
| Accès fermé (abonnement) | `peut_demander()` rend faux, bouton éteint, motif mesuré **en dates, jamais en euros** |
| Deux demandes en cours vers le même confrère, même période | Refusé par l'index unique partiel `demandes_en_cours_idx`. **Règle métier portée par la base, pas une optimisation** |
| Transition interdite | Le déclencheur `demandes_avant_maj()` lève une exception, la page la répète |
| Demande acceptée | `coordonnees_confrere()` ouvre le téléphone **des deux côtés en même temps** |
| Une demande ancienne | **Elle n'expire jamais.** La liste du destinataire grossit sans se vider |
| Une note posée seule | **Elle reste invisible pour toujours.** |

Les deux dernières lignes sont écrites par la page elle-même, lignes 79 et 80 : « LES TÂCHES D'ENTRETIEN NE TOURNENT PAS ». C'est un défaut connu, dit, et non corrigé. Voir Y.

### D.8 La messagerie, sur `/messages`

2 272 lignes. **Aucune conversation sans demande acceptée.** L'ouverture passe par `ouvrir_conversation()` et rien d'autre.

Un seul appel peint la liste : `mes_conversations()` rend déjà l'interlocuteur, l'extrait du dernier message, le compteur de non-lus, l'état fermé et le blocage. Pas de seconde requête, donc pas de liste qui s'affiche puis se remplit sous les yeux.

**Le navigateur envoie deux champs et pas un de plus** : `conversation_id` et `corps`. Le déclencheur `messages_avant_envoi` remplace l'auteur par la session, met `lu_le` à vide et date le message. Un navigateur qui prétend être quelqu'un d'autre n'obtient rien.

**Le marquage comme lu attend que l'onglet soit visible** : une conversation ouverte dans un onglet de fond, sur un téléphone posé sur un établi, n'a été lue par personne.

**Six marqueurs `[A COMPLETER]` sont visibles à l'écran** (lignes 694, 1359, 1360, 1432, 1556, 1924), pour cinq intitulés distincts : durée de conservation des messages, fournisseur d'envoi, délai avant relance d'un message non lu, délai de traitement d'un signalement, adresse de contact de la modération. C'est voulu : rien n'est inventé, et personne ne peut publier une mention fausse sans l'avoir vue passer.

### D.9 Les droits, sur `/mes-donnees`

1 977 lignes. Quatre droits **branchés pour de vrai** sur la base : voir (art. 15), emporter (art. 20), gérer ses consentements finalité par finalité (art. 7.3), supprimer son compte (art. 17, `supprimer_mon_compte(texte)` qui **exige le mot SUPPRIMER**).

Deux honnêtetés inscrites dans l'écran :

1. L'export **journalise lui-même** une ligne au registre, en genre `portabilite` : consulter ses données **est** l'exercice du droit d'accès. La page l'annonce en clair plutôt que de laisser découvrir une ligne inattendue. La base se garde d'une ligne par jour et par personne.
2. **La suppression n'efface pas le compte de connexion** (`auth.users`), qui demande la clé de service. La page le dit **avant**, et redonne la référence du journal **après**.

| Échec possible | Ce que l'écran affiche |
|---|---|
| Les six textes de consentement | Tous marqués `[A COMPLETER]` et `en_vigueur = false`. **La base refuse d'enregistrer un accord sur un texte qui n'existe pas**, et c'est voulu. Les boutons sont éteints, avec la raison et le geste |
| L'export | Ne contient ni les factures ni les abonnements : ils vivent dans une autre migration que la fonction ne lit pas. **Dit à l'écran, avec le geste** |
| Arrivée avant tout passage par `/espace` | `ma_fiche()` pose la ligne `artisans` si elle manque, sinon le premier accord serait refusé par une erreur de clé étrangère incompréhensible |

### D.10 Le parcours de Claire-Marie, sur `/crm`

Quatre fichiers assemblés en un par `outils/construire.mjs`. **Aucune donnée personnelle n'entre dans le fichier construit** : le repère `/*__DATA__*/` reçoit un tableau vide et un commentaire qui le dit. Les 1 374 fiches sont lues dans Supabase après connexion. C'est ce qui permet de construire le dépôt en public sans exposer personne.

**La régression à ne jamais laisser revenir :** le 14/09/2026, sur un PostgreSQL où les migrations avaient été rejouées, **un compte d'artisan ordinaire a lu la totalité de la table `contacts`**. Trois morceaux innocents se combinaient. La règle posée est qu'un profil naît **inactif**, et l'accès au CRM devient un geste explicite d'un administrateur. Critère de fin, à vérifier avant l'ouverture des inscriptions libres : depuis un compte d'essai d'artisan, `select count(*) from contacts` doit rendre **0**. S'il rend 1 374, refermer l'inscription.

### D.11 Ce que le parcours complet ne fait pas encore

| Rupture | Où elle casse |
|---|---|
| Aucun courriel ne part, à aucune étape | `/inscription` en promet un, `/connexion` en promet un autre. La fonction existe, personne ne l'appelle |
| Aucune demande n'expire, aucune note ne se publie, aucune pièce ne périme | Les tâches planifiées ne tournent pas |
| Aucun artisan ne peut déposer une pièce justificative | Aucun écran n'écrit dans le compartiment `pieces`. `/admin` sait en lire une, sa table sera toujours vide |
| Aucun paiement ne peut aboutir | Le prestataire n'est pas choisi, les fonctions ne sont pas déployées |
| Aucun consentement ne peut être enregistré | Les six textes sont `[A COMPLETER]` et `en_vigueur = false` |
| Le rayon ne se calcule pas | La table `communes` est vide |
| Aucune résiliation n'est possible depuis l'espace | Les deux fonctions existent, aucun bouton ne les appelle |

---

## E. Fonctionnalités

C'est le chapitre qui porte le plan de charge. Chaque ligne a été cherchée dans le code.

### E.0 Comment lire les états

| État | Ce qu'il veut dire |
|---|---|
| **EN SERVICE** | La chaîne complète fonctionne : un écran l'appelle, la base répond, l'artisan le voit |
| **EN BASE SEULEMENT** | Le SQL existe, il est testé, il porte ses politiques, et **aucun écran ne l'appelle** |
| **PROMIS** | Écrit quelque part dans le produit ou un document, absent du code |
| **DESSINÉ** | Un écran ou un bouton existe, rien derrière |
| **A CONSTRUIRE** | Manque identifié, jamais construit |

Répartition de l'audit du 15/09/2026, sur 325 fonctions distinctes : **166 en service, 57 en base seulement, 43 promises, 33 dessinées, 26 à construire.**

**La mesure refaite du côté SQL**, qui est celui qui commande le plan de charge :

| Mesure | Valeur | Méthode |
|---|---|---|
| Noms de fonctions SQL distincts | **93** | `grep` puis dédoublonnage |
| Réellement appelées depuis l'extérieur | **22** | recherche des seuls `.rpc("nom")` et `/rest/v1/rpc/nom` : 18 depuis les écrans, 4 depuis `evenements-paiement` |
| Jamais appelées de l'extérieur | **71** | dont 24 câblées en déclencheur et 3 portées par des politiques |

**Piège évité, et il vaut d'être dit :** une recherche naïve du nom d'une fonction dans les fichiers en trouve 37 « appelées ». Quinze d'entre elles ne sont **citées qu'en commentaire**, souvent pour dire qu'elles ne sont pas branchées. `emettre_facture` en est l'exemple exact : `evenements-paiement/index.ts` en parle ligne 46 et ligne 512, et ne l'appelle jamais.

### E.1 Identité et compte

| Fonction | État | Où |
|---|---|---|
| Connexion par adresse et mot de passe | EN SERVICE | `app/connexion/index.html:383` |
| Création de compte au même geste | EN SERVICE | `:441`, l'ordre entrer-puis-créer est délibéré |
| Mot de passe oublié | EN SERVICE | `:478`, réponse identique que l'adresse existe ou non |
| Session persistante et renouvelée | EN SERVICE | `:308` |
| Détection d'une session ouverte sans charger la bibliothèque | EN SERVICE | `:502` |
| Connexion Google | DESSINÉ, éteint avec son motif | `:341` |
| Création de `profils` à la création du compte | EN BASE SEULEMENT | `creer_profil()`, déclencheur sur `auth.users` |
| Création de `artisans` au premier passage | EN SERVICE | `ma_fiche()` |
| Suppression du compte de connexion | A CONSTRUIRE | demande la clé de service, dit à l'écran |
| Second facteur sur le compte administrateur | A CONSTRUIRE | c'est le compte qui lit le journal, les signalements et 1 374 fiches |

### E.2 Liste d'attente

| Fonction | État | Où |
|---|---|---|
| Formulaire en quatre champs, écriture directe | EN SERVICE | `app/inscription/index.html:288` |
| Unicité de l'adresse portée par la base | EN SERVICE | index unique sur colonne calculée |
| Deux pièges anti-robot, muets | EN SERVICE | `:178` et `:227` |
| Le jeton de confirmation ne revient jamais au navigateur | EN SERVICE | `Prefer: return=minimal` |
| Comptage par métier et par département | EN BASE SEULEMENT | vues `inscriptions_par_metier`, `inscriptions_par_departement` |
| **Courriel de confirmation** | **PROMIS**, l'écran l'annonce, rien ne l'envoie | |
| Double confirmation | EN BASE SEULEMENT | `confirmer_inscription()` |
| Plafond d'insertions anonymes | A CONSTRUIRE | rien ne limite le débit : R.6.3 |

### E.3 Fiche artisan

| Fonction | État | Où |
|---|---|---|
| Parcours en cinq étapes, reprise là où on s'est arrêté | EN SERVICE | `app/espace/index.html:688` |
| Enregistrement à chaque sortie d'étape | EN SERVICE | pas de bouton final |
| Vérification du SIRET, 7 verdicts | EN SERVICE côté parcours, **non garanti côté base** | `:922`, voir R.6.2 |
| Métier, présentation, rayon | EN SERVICE | `:991` |
| Publier ou retirer sa fiche | EN SERVICE | `:2490` |
| Fiche publique lisible sans compte | EN SERVICE | vue `fiches_publiques` |
| Photo de fiche | A CONSTRUIRE | la colonne existe, aucun dépôt d'image |
| **Atouts publics** | **A CONSTRUIRE** | la table existe et se remplit, la vue `atouts_publics` n'existe pas |

### E.4 Disponibilités et agenda

| Fonction | État | Où |
|---|---|---|
| Saisie par plages, un seul bouton pour écrire | EN SERVICE | volet Disponibilités |
| Grille du mois, liste sous 860 px, cibles à 48 px | EN SERVICE | |
| Dépôt d'un fichier `.ics` | EN SERVICE | seule voie qui ne demande rien à personne |
| Le produit ne lit que le libre et l'occupé | TENU par l'absence de colonne | table `occupations` |
| Google, Microsoft, Apple, ics distant | DESSINÉS, éteints | `:1338` à `:1347` |

### E.5 Recherche

| Fonction | État | Où |
|---|---|---|
| Recherche par métier | EN SERVICE | `rechercher_confreres()` |
| État de la base lu avant d'allumer un champ | EN SERVICE | `etat_recherche()` |
| Écrans d'exemple marqués dans le même bloc visuel | EN SERVICE | `:579` |
| Journal des recherches, y compris les vides | EN BASE SEULEMENT | table `recherches`. **C'est elle qui dit où il manque des artisans** |
| Filtres période, commune, rayon, tri par distance | DESSINÉS, éteints | `communes` vide |
| **Chargement de la table des communes** | **A CONSTRUIRE** | c'est le geste qui allume trois champs d'un coup |

### E.6 Mise en relation

| Fonction | État | Où |
|---|---|---|
| Envoyer une demande datée | EN SERVICE | `app/demandes/index.html` |
| Accepter, refuser avec motif, annuler | EN SERVICE | `demandes_avant_maj()` |
| Ouverture des coordonnées des deux côtés en même temps | EN SERVICE | `coordonnees_confrere()` |
| Une seule demande en cours par confrère et par période | EN SERVICE | index unique partiel |
| Contrôle de l'accès avant d'afficher le bouton | EN SERVICE | `peut_demander()`, mesuré en dates |
| Notation à double sens, la pose | EN SERVICE | table `evaluations` |
| Publication de la note après délai | EN BASE SEULEMENT | `publier_evaluations_echues()` |
| Invitation à noter | EN BASE SEULEMENT | `inviter_evaluations()`, **sans grant ni planification** |
| Notes publiques agrégées | EN BASE SEULEMENT | vue `notes_publiques` |
| Expiration d'une demande | EN BASE SEULEMENT | `expirer_demandes()` |

### E.7 Messagerie

| Fonction | État | Où |
|---|---|---|
| Liste des conversations en un seul appel | EN SERVICE | `mes_conversations()` |
| Envoi, auteur et date posés par la base | EN SERVICE | `messages_avant_envoi()` |
| Marquage comme lu à l'ouverture réelle | EN SERVICE | `marquer_lu()` |
| Pastille de non-lus | EN SERVICE | `mes_messages_non_lus()` |
| Rappel du chantier dans chaque fil | EN SERVICE | lecture de `demandes` |
| Blocage d'un interlocuteur | EN SERVICE | table `blocages` |
| Signalement, le dépôt | EN SERVICE | `signalements_avant_depot()` |
| Plafond horaire de messages | EN SERVICE, porté par la base | `plafond_messages_par_heure()` |
| Pièce jointe | HORS PÉRIMÈTRE, assumé | |
| Purge des messages anciens | A CONSTRUIRE, **bloquant** | aucune durée décidée, dépend de l'avocat |
| Relance d'un message non lu | PROMIS | délai non tranché |

### E.8 Données personnelles

| Fonction | État | Où |
|---|---|---|
| Voir, emporter (art. 15 et 20) | EN SERVICE | `mes_donnees_personnelles()` |
| Supprimer son compte (art. 17) | EN SERVICE, partiel | `supprimer_mon_compte()` |
| Déposer une demande au registre | EN SERVICE | `deposer_demande_rgpd()` |
| Garde-fou : une ligne de journal par jour et par personne | EN SERVICE | |
| **Enregistrer un consentement** (art. 7.3) | **DESSINÉ, éteint** | les six textes sont `[A COMPLETER]` et `en_vigueur = false`, la base refuse |
| Bandeau de traceurs | EN SERVICE, liste vide | `app/assets/consentement.js`, 428 lignes |
| Voir une demande RGPD déposée | **A CONSTRUIRE** | `/admin` ne lit pas `demandes_rgpd` : Q.4 |
| Durées de conservation | A CONSTRUIRE, **bloquant** | ni pour le journal, ni pour les recherches, ni pour les messages |

### E.9 Back-office et commercial

| Fonction | État | Où |
|---|---|---|
| Compteurs du back-office | EN SERVICE | `chiffres_back_office()` |
| Liste et modération des fiches | EN SERVICE | `moderer_fiche()`, `artisans_moderation()` |
| Lecture d'une pièce par lien signé de 60 secondes | EN SERVICE | `app/admin/index.html:862` |
| Contrôle d'une pièce | EN SERVICE côté écran, **table toujours vide** | aucun artisan ne peut en déposer |
| Journal d'administration | EN SERVICE | table `journal` |
| CRM : 1 374 fiches, filtres, qualification, présence | EN SERVICE | `crm/src/app.js`, 1 656 lignes |
| Aucune donnée personnelle dans le fichier construit | EN SERVICE | `outils/construire.mjs:95` |
| **Pont entre un inscrit et le CRM** | **A CONSTRUIRE**, volontairement non préempté | c'est la cloison qui protège les 1 374 fiches |

### E.10 Les 57 fonctions en base seulement, nommées une par une

Chacune existe, est testée, porte ses politiques, et n'est appelée par personne. Les chemins sont relatifs à `/Users/joanaglave/a-dispo`.

#### Paiement (9)

| # | Fonction | Où | Ce qui manque |
|---|---|---|---|
| 1 | Ouvrir une session de paiement | `supabase/functions/ouvrir-paiement/index.ts`, 362 lignes | Le prestataire n'est pas choisi. L'écran l'appelle déjà (`espace:1150`) |
| 2 | Recevoir un message signé, le dédoublonner | `supabase/functions/evenements-paiement/index.ts`, 519 lignes | Aucune adresse de retour déclarée |
| 3 | `enregistrer_evenement_paiement()` | `migration-abonnement-pieces.sql:1240` | Dépend de 2 |
| 4 | `enregistrer_paiement()` | `:978` | Dépend de 2 |
| 5 | `appliquer_abonnement()` | `:1295` | Dépend de 2 |
| 6 | `acces_artisan()` | `:582` | Écrite, jamais appelée : `ouvrir-paiement` dit ligne 217 qu'il ne s'en sert pas |
| 7 | `ouvrir_mon_essai()` | `:643` | `app/artisan/index.html:915` demande explicitement à la brancher |
| 8 | `demander_resiliation()` | `:689` | Aucun bouton. **Le produit le promet pourtant au présent** |
| 9 | `annuler_resiliation()` | `:715` | Idem |

#### Facturation (5)

| # | Fonction | Où | Remarque |
|---|---|---|---|
| 10 | `emettre_facture()` | `:1066` | Citée deux fois en commentaire, appelée zéro fois. **Aucun contrôle de doublon** |
| 11 | `prochain_rang_facture()` | `:1032` | Numérotation continue, exigence comptable |
| 12 | `factures_figees()` | `:940` | Déclencheur posé, aucune ligne n'entre |
| 13 | Vue `mes_factures` | | Un abonné ne peut pas voir sa facture |
| 14 | Tables `factures` et `facture_compteurs` | | Aucun écran |

#### Relances de paiement (5)

| # | Fonction | Où | Remarque |
|---|---|---|---|
| 15 | `programmer_relance()` | `:1460` | Appelée par `evenements-paiement`, qui ne tourne pas |
| 16 | `reserver_relances()` | `:1493` | `for update skip locked` : deux traitements simultanés ne prennent pas la même |
| 17 | `marquer_relance_envoyee()` | `:1513` | |
| 18 | `annuler_relances()` | `:1537` | |
| 19 | Table `relances_paiement` | | Le calendrier des relances n'est pas arrêté, donc il n'est pas écrit |

#### Parrainage (5)

Le levier prioritaire identifié par l'étude : x2,8 contre l'acquisition payante.

| # | Fonction | Où |
|---|---|---|
| 20 | `mon_code_parrainage()`, qui crée le code au premier appel | `:1648` |
| 21 | `enregistrer_parrainage(code)` | `:1696` |
| 22 | `valider_parrainage(filleul)` | `:1725` |
| 23 | `mes_parrainages()` | `:1760` |
| 24 | Tables `codes_parrainage` et `parrainages` | aucun écran |

`reglages.parrainage_mois_parrain` vaut `null`, avec la note « Non arrêté : la récompense dépend du prix ». Le prix est arrêté : la récompense peut l'être aussi.

#### Pièces justificatives (4)

| # | Fonction | Où | Remarque |
|---|---|---|---|
| 25 | Dépôt d'une pièce dans le compartiment privé | aucun écran | **Zéro `storage.from(...).upload` dans les 12 écrans.** La politique d'insertion est écrite et attend |
| 26 | `pieces_controle()` | `:273` | Déclencheur d'audit, aucune ligne à contrôler |
| 27 | `marquer_pieces_expirees()` | `:400` | Une décennale périmée resterait affichée comme valable |
| 28 | Vue `mes_pieces` | | Un artisan ne voit pas ses propres pièces |

Les six genres sont déjà arrêtés en base : immatriculation, assurance décennale, RC pro, vigilance URSSAF, habilitation, autre. C'est exactement la paperasse que le persona veut se voir épargner. **Conséquence en clair : un artisan ne peut pas fournir son assurance décennale, alors que toute la mécanique de contrôle et d'expiration existe derrière.**

#### Courriels transactionnels (9)

La fonction complète existe : 1 836 lignes sur quatre fichiers. **Zéro appelant dans tout le dépôt.** Contrastes mesurés le 13/09/2026 : le plus faible à 8,29:1. Poids : de 4,7 à 5,8 Ko, sans aucune image.

| # | Élément | Nature |
|---|---|---|
| 29 | La fonction `envoyer-email/` elle-même | 1 836 lignes, aucun appel |
| 30 | Gabarit `liste-attente-confirmation` | transactionnel. **C'est lui qui manque à `/inscription`** |
| 31 | Gabarit `bienvenue` | **relationnel**, exige la preuve d'un consentement |
| 32 à 37 | `demande-recue`, `demande-acceptee`, `demande-refusee`, `message-recu`, `paiement-echoue`, `facture-disponible` | transactionnels |

Une seule pièce manque pour les huit : **le choix du service d'envoi**, qui tient dans une variable d'environnement. Les enregistrements DNS à poser sont déjà écrits (`supabase/functions/envoyer-email/DNS.md`, 227 lignes).

#### Rôles (6)

| # | Fonction | Où | Remarque |
|---|---|---|---|
| 38 | `definir_role(compte, role)` | `migration-roles-evenements.sql:522` | Aucun écran ne permet de nommer un commercial ou un administrateur |
| 39 | `role_courant()` | `:395` | |
| 40 | `est_commercial()` | `:410` | Portée par 6 politiques, jamais lue par un écran |
| 41 | `controle_roles()` | `:574` | Fonction de contrôle, jamais jouée |
| 42 | `controle_cloison_crm()` | `migration-cloison-crm.sql:75` | **C'est elle qui prouve que les 1 374 fiches sont refermées. Personne ne la joue** |
| 43 | `controle_cloison_profils()` | `migration-cloison-profils.sql:61` | Idem pour les profils |

#### Événements et entonnoir (8)

Huit genres arrêtés, quatre colonnes et pas une de plus, aucune clé étrangère vers `artisans` pour que l'entonnoir du trimestre passé ne se réécrive pas à la baisse quand un compte disparaît.

| # | Fonction | Où |
|---|---|---|
| 44 | Tables `evenements` et `evenement_genres` | `migration-roles-evenements.sql:632` |
| 45 à 49 | `noter_evenement()`, `evenements_artisan()`, `evenements_demande()`, `evenements_conversation()`, `evenements_abonnement()` | `:726` à `:859` |
| 50 | `entonnoir()` | `:952`, la seule mesure d'usage du produit |
| 51 | `purger_evenements()` | `:897` |

**Précision qui change le geste :** tout cela est écrit **dans le fichier**, et **rien n'est joué en base** (mesure du 15/09/2026, chapitre P). Ce n'est pas du code à écrire, c'est une commande à passer.

#### Entretien, notifications, confirmation (6)

| # | Fonction | Où | Conséquence de son sommeil |
|---|---|---|---|
| 52 | `expirer_demandes()` | `migration-recherche-relations.sql:854` | Une demande reste « envoyée » indéfiniment |
| 53 | `publier_evaluations_echues()` | `:1335` | **La plus grave.** Une note laissée seule reste invisible pour toujours |
| 54 | `controle_taches()` | `migration-taches-planifiees.sql:77` | Une tâche qui échoue le fait en silence : c'est ici qu'on le verrait |
| 55 | `notifier()` et la table `notifications` | `:1013` | Le produit pose des notifications que rien ne fabrique hors demandes |
| 56 | `inviter_evaluations()` | `:1097` | **Aucun grant, aucune planification, aucun appelant.** Personne n'est invité à noter, donc la n°53 tourne sur du vide |
| 57 | `confirmer_inscription()` | `migration-inscriptions.sql:126` | Le compteur d'inscrits confirmés restera à zéro, et c'est lui qui décide où ouvrir |

**Mesure du 14/09/2026 : l'extension `pg_cron` n'était pas installée sur le projet.** Aucune tâche ne pouvait partir seule, et personne ne s'en était aperçu, parce qu'une tâche qui ne tourne pas ne produit aucune erreur. C'est le mode de panne le plus silencieux qui soit.

### E.11 Ce que ce chapitre dit du plan de charge

Trois pièces débloquent à elles seules **31 des 57** :

| Pièce à obtenir | Débloque | Nature du geste |
|---|---|---|
| Le choix d'un service d'envoi de courriels | 9 courriels, plus les n°55, 56, 57, soit **12** | Une variable d'environnement, les DNS sont déjà écrits |
| Le choix d'un prestataire de paiement | 9 de paiement, 5 de facturation, 5 de relances, soit **19** | Une décision commerciale, le code des deux côtés est écrit |
| L'installation de `pg_cron` | 3 tâches d'entretien, plus une quatrième non planifiée | Une extension à activer |

Les 26 restantes demandent chacune un écran ou un bouton, pas une décision extérieure : parrainage (5), pièces (4), rôles (6), événements (8), et les trois fonctions de résiliation et d'accès.

**Ce qui n'est pas dans les 57 et qui pèse autant :** le chargement de la table `communes`, qui allume d'un coup trois champs de `/recherche`, et la vue `atouts_publics`, qui rend visibles des atouts que les artisans saisissent déjà.

---

## F. Architecture technique

### F.1 La chaîne réelle, de la source à l'URL

| Étape | Objet | Mesure |
|---|---|---|
| 1. Sources | `app/<ecran>/index.html` | **12 fragments**. Un fragment porte son `<style>`, son corps et ses scripts, **pas** son `<head>` |
| 2. Construction | `outils/construire.mjs` | **110 lignes**, zéro dépendance, Node seul |
| 3. Sortie | `dist/` | **1,3 Mo**, 13 fichiers `index.html` |
| 4. Service | `wrangler.jsonc` | worker d'assets, `assets.directory = ./dist`, `not_found_handling = single-page-application` |
| 5. En ligne | `a-dispo.strattonn-pilotage.workers.dev` | répond 200, et le fichier servi est **identique au bit près** au `dist/` local |

Le choix de Node plutôt que Python est écrit et motivé (`outils/construire.mjs:8-11`) : Node est présent dans l'environnement de construction de Cloudflare, Python ne l'est pas de façon garantie. Une chaîne qui ne se construit que sur une machine n'est pas une chaîne.

### F.2 Les douze écrans, et leur poids servi

Aucun titre d'onglet ne nomme la marque, et la raison est écrite ligne 26 : la marque n'est pas déposée à l'INPI.

| URL | Source (lignes) | Page servie (octets) |
|---|---|---|
| `/` | 1 172 | 109 254 |
| `/espace` | 2 652 | 143 783 |
| `/messages` | 2 272 | 124 726 |
| `/mes-donnees` | 1 977 | 109 190 |
| `/demandes` | 1 998 | 105 866 |
| `/recherche` | 1 494 | 78 735 |
| `/legal` | 1 230 | 73 295 |
| `/admin` | 1 278 | 67 247 |
| `/artisan` | 1 120 | 62 994 |
| `/connexion` | 525 | 26 690 |
| `/aide` | 309 | 20 973 |
| `/inscription` | 337 | 17 534 |
| `/crm` | 2 664 (4 fichiers) | 187 892 |

### F.3 Ce que `construire.mjs` fait, exactement

1. **Il efface `dist/` en entier** puis le recrée (ligne 66).
2. Pour chaque écran : il lit le fragment, **retire son `<title>`**, et l'enveloppe dans un `<head>` unique (jeu de caractères, cadrage mobile, `color-scheme: light`, favicon, `apple-touch-icon`, `theme-color: #F8F4EC`, et la balise `robots` de refus d'indexation). Cet en-tête vit à un seul endroit, lignes 44 à 60, **et c'est la raison d'être du fichier**.
3. Il recopie `app/assets` vers `dist/assets` et `app/public` à la racine de `dist`.
4. **Il assemble le CRM** : quatre marqueurs (`/*__STYLES__*/`, `/*__CONFIG__*/`, `/*__DATA__*/`, `/*__APP__*/`) reçoivent le style, la configuration, les données et l'application.
5. **Aucune donnée personnelle n'entre dans le fichier produit** : le marqueur des données est remplacé par `window.CRM_CONTACTS = []` et un commentaire qui le dit.

Non destructif : le fichier ne lit que `app/` et `crm/src/`, n'écrit que `dist/`. `dist/` et `node_modules/` sont dans `.gitignore`, comme `crm/contacts.json` et `supabase/seed.sql`.

### F.4 Le contrôle de la chaîne, mesuré en ligne le 15/09/2026

| Contrôle | Résultat |
|---|---|
| Le déployé est bien le construit | `md5` identiques des deux côtés |
| Les en-têtes de `app/public/_headers` sont appliqués | `x-robots-tag`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin` : **les quatre sont là** |
| Une adresse sans barre finale | **307** vers `/connexion/`, puis 200 |
| Une adresse inconnue | **200** et 109 254 octets, c'est-à-dire la page d'accueil |
| Refus de visite | `User-agent: *` / `Disallow: /`, aucun chemin nommé pour ne pas annoncer `/crm` |

### F.5 Ce que cette chaîne ne sait pas faire

Huit points, chacun mesuré. Ce n'est pas un reproche : c'est le périmètre exact de l'outil.

1. **Elle ne partage aucun style.** Les douze écrans portent chacun leur bloc `:root` : 12 blocs, 7 variantes distinctes. Un changement de charte se fait douze fois, à la main, sans filet.
2. **Elle efface tout `dist/` à chaque construction.** `dist/_banc/aujourdhui.html`, posé par un autre outil, disparaît au prochain `npm run build`. Rien ne prévient.
3. **Elle ne pose aucune empreinte sur les images.** `_headers` pose `Cache-Control: max-age=31536000, immutable` sur `/assets/*`, et aucun fichier ne porte d'empreinte de contenu. **Une image ou un script remplacé garde son nom et reste un an dans le cache de qui l'a déjà vu.** Sur `consentement.js`, c'est un problème de conformité avant d'être un problème de cache.
4. **Un écran absent ne fait pas échouer la construction.** Ligne 74 : si la source manque, le script écrit `ABSENT, ignore` et continue, avec un code de sortie zéro.
5. **Une adresse inconnue rend 200, pas 404.** Un lien mort ne se voit ni dans un journal de serveur, ni dans un outil de surveillance : il ressemble à une visite de la page d'accueil.
6. **L'assemblage du CRM est muet en cas d'erreur.** Si un marqueur est renommé, le remplacement ne se fait pas, aucune exception n'est levée, et le fichier sort sans son style ou sans son application.
7. **Aucune minification, aucun test, aucun contrôle.** `outils/` ne contient que `construire.mjs`.
8. **Elle n'héberge pas ses polices.** Les treize pages appellent `fonts.googleapis.com`. Chaque visite envoie donc l'adresse IP du visiteur à Google, ce que `app/mes-donnees/index.html:1304` déclare déjà. Et l'accueil demande `Karla` là où les onze autres demandent `DM Sans`.

### F.6 Le déploiement, et ce qui n'est pas vérifiable d'ici

`package.json` déclare deux commandes : `build` (`node outils/construire.mjs`) et `deploy` (`npm run build && wrangler deploy`). `wrangler` est une dépendance de développement ; `npm run build` fonctionne sans rien installer.

**Le dépôt ne contient aucune trace de construction automatique** : pas de `.github/workflows`, aucune section `build` dans `wrangler.jsonc`. La construction à chaque poussée est configurée dans le tableau de bord Cloudflare, hors du dépôt. **Non vérifié d'ici**, mais l'égalité octet pour octet entre `dist/` local et la page en ligne prouve qu'elle tourne.

### F.7 A CONSTRUIRE

| Chantier | Ce qu'il faudra | Pourquoi |
|---|---|---|
| **Une feuille de style partagée** | `construire.mjs` lira un `app/commun.css` et l'insérera comme il insère déjà l'en-tête | Le mécanisme existe : c'est vingt lignes, pas un chantier |
| **Une empreinte sur les assets** | Le nom du fichier portera l'empreinte de son contenu | Sans elle, l'en-tête `immutable` d'un an est un piège |
| **Un vrai 404** | Retirer `not_found_handling: single-page-application`, ajouter `/404` | Le produit n'est pas une application à une seule page : treize documents distincts sont servis |
| **Un contrôle de construction** | Échouer si un écran de `ECRANS` est absent, si un marqueur du CRM manque, ou si une page dépasse un poids convenu | Aujourd'hui, l'échec est silencieux dans les trois cas |
| **Les polices servies par le worker** | Deux familles en `woff2` dans `app/public/`, un `@font-face` dans la feuille partagée | Supprime une dépendance tierce et une mention RGPD |
| **Le raccordement de `a-dispo.fr`** | Accès OVH, attendus de Claire-Marie | Bloque aussi SPF, DKIM, DMARC, donc tous les courriels |

---

## G. Architecture Supabase

> **Le socle ne se reconstruit pas.** Ce chapitre est un relevé de ce qui existe, pas une proposition.

### G.1 Le projet, et la règle qui commande tout

Un seul projet : `ucnyvsocoxenxbuakluo.supabase.co`, cité dans les 8 écrans qui parlent à la base et dans `crm/src/config.js:13`.

**La clé publique est dans le code source de chaque page, et c'est assumé.** Le `README.md` l'écrit : « La sécurité est en base, jamais dans la page. Une page ne protège rien. » Conséquence directe : **aucun contrôle écrit dans un écran n'est une sécurité**.

**Cette formule est vraie mais incomplète, et il faut le dire ici** : la sécurité est en base **à deux endroits**, les politiques par ligne et les fonctions `security definer` appelables, qui contournent les politiques par construction. Chacune de ces fonctions est son propre mur. Il y a donc deux surfaces à auditer, pas une (voir J.3).

Les huit écrans qui ouvrent une session chargent le client depuis `cdn.jsdelivr.net`. Quatre écrans (`/accueil`, `/aide`, `/legal`, `/inscription`) ne chargent pas le client du tout : `/inscription` écrit sa ligne par un `fetch` direct (`app/inscription/index.html:287`).

### G.2 L'identité : un compte, une ligne métier

| Table | Ce que c'est | Qui la crée |
|---|---|---|
| `auth.users` | le compte de connexion | Supabase Auth |
| `public.artisans` | le profil métier de l'artisan | `ma_fiche()`, à la première visite |
| `public.profils` | le profil interne (équipe, et tout inscrit) | le déclencheur `creer_profil()` sur `auth.users` |

Les deux tables métier portent **la même clé primaire que le compte**, en `on delete cascade`. Aucun chemin ne peut produire deux lignes métier pour un même compte : c'est une contrainte de clé primaire, pas une intention. C'est aussi ce qui garantit que l'application mobile, quand elle existera, n'aura jamais sa propre base.

### G.3 La sécurité par ligne : ce qui est réellement posé

Les comptages sont ceux du chapitre « Les chiffres du dossier ». Ce qui s'y ajoute :

| Mesure | Valeur |
|---|---|
| Tables avec `enable row level security` | **35 sur 35**, zéro table sans protection |
| Déclencheurs distincts | **36** (35 sur des tables `public`, 1 sur `auth.users`) |
| Instructions `create or replace function` | 97, pour **93 noms distincts** |
| Dont `security definer` | 89 déclarations, **85 fonctions distinctes** |
| Index déclarés | **74**, dont 9 uniques |

#### Les politiques par table

| Table | Nb écrites | Ce qu'elles disent |
|---|---|---|
| `contacts` | 9, 3 en vigueur | Trois générations successives : « connectes », puis « actifs », puis « le commerce » |
| `pieces` | 5 | Lecture, dépôt et retrait par le propriétaire ; lecture et contrôle par l'administration |
| `profils` | 5, 3 en vigueur | Voir ci-dessous |
| `artisans`, `consentements`, `demandes`, `evaluations`, `inscriptions`, `signalements` | 3 chacune | |
| `abonnements`, `agendas`, `artisan_atouts`, `codes_parrainage`, `conversations`, `demandes_rgpd`, `factures`, `messages`, `notifications`, `occupations`, `paiements`, `parrainages`, `relances_paiement` | 2 chacune | Toujours le même couple : « la sienne » et « lues par l'administration » |
| `abonnement_etats`, `blocages`, `communes`, `consentement_textes`, `evenement_genres`, `evenements`, `evenements_paiement`, `journal`, `metiers`, `recherches`, `reglages` | 1 chacune | |
| `agenda_secrets`, `facture_compteurs` | **0** | Sécurité activée, aucune politique : **personne ne lit, jamais**, et c'est voulu |
| `storage.objects` | 5 | Pièces et factures |

**Le cas `profils`, et pourquoi il mérite son paragraphe.** `schema.sql:67` et `migration-admin.sql:58` posent tous deux `create policy "profils lecture connectes" ... using (true)` : tout compte connecté lisait toute la table, donc les adresses de l'équipe et surtout **qui est administrateur**. `migration-cloison-profils.sql:43-47` supprime cette politique et la remplace par `id = auth.uid() or public.est_actif()`. Le fichier porte l'avertissement en toutes lettres : il **doit être joué en dernier**, sinon rejouer `schema.sql` rouvre la fuite. **Un avertissement dans un commentaire n'est pas une garde** : voir J.5.

### G.4 Les fonctions de périphérie

Quatre dossiers, **3 510 lignes de TypeScript (Deno)**, dont un dossier partagé qui ne se déploie pas.

| Dossier | Lignes | Ce qu'elle fait | Qui l'appelle |
|---|---|---|---|
| `ouvrir-paiement/` | 362 | Ouvre une session chez le prestataire et rend l'adresse. **N'écrit rien** | `app/espace/index.html:1150` et `:1299` |
| `evenements-paiement/` | 519 | **La seule porte par laquelle un accès payant s'ouvre ou se ferme.** Vérifie la signature sur le corps brut | le prestataire, de serveur à serveur |
| `envoyer-email/` | 1 836 (4 fichiers) | Un nom de gabarit, une adresse, des données, un courriel parti | **personne, à ce jour** |
| `_partage/` | 793 (2 fichiers) | `reponses.ts` (CORS, HMAC, appels RPC, masquage d'identifiants) et `prestataires.ts` | les trois autres |

**Les trois sont absentes du projet Supabase.** Mesure du 15/09/2026 : `/functions/v1/ouvrir-paiement`, `/functions/v1/evenements-paiement` et `/functions/v1/envoyer-email` rendent 404, **exactement comme le témoin d'un nom inventé**. Une fonction déployée mais protégée rendrait 401. Elles ne sont pas déployées.

**Le navigateur ne confirme jamais un paiement.** C'est écrit dans les deux fichiers et tenu par le code. **Tant que `PRESTATAIRE_PAIEMENT` est vide, le prestataire en service est `aucun`** (`_partage/prestataires.ts:444`) : il refuse tout et dit pourquoi, avec la liste complète de ce qui manque et un champ `geste` qui dit quoi faire.

`envoyer-email` exige un secret propre, l'en-tête `x-cle-envoi`, précisément pour qu'elle ne soit **pas** appelable depuis un navigateur avec la clé publique. Quatre fournisseurs sont branchés (Resend, Brevo, Postmark, Mailjet) et aucun n'est choisi.

### G.5 Le stockage

Deux compartiments, tous deux **privés**, tous deux plafonnés à 10 485 760 octets.

| Compartiment | Types acceptés | Règle de cloisonnement |
|---|---|---|
| `pieces` | PDF, JPEG, PNG, HEIC, HEIF | Le **premier segment du chemin est l'identifiant du compte**. `storage.foldername(name)` le rend, la comparaison avec `auth.uid()` fait tout le cloisonnement |
| `factures` | PDF seulement | Lecture seule pour l'abonné : une facture est écrite par le serveur, jamais déposée depuis un navigateur |

**Aucun écran ne dépose de pièce.** Le seul accès au stockage dans tout le produit est `app/admin/index.html:862`, qui crée une adresse signée de 60 secondes pour lire une pièce. La politique « dépôt de ses pièces » existe, elle est correcte, **et elle n'a pas d'écran**.

### G.6 Les tâches planifiées

`migration-taches-planifiees.sql` programme **trois** tâches par `pg_cron`, à 3 h, 3 h 10 et 3 h 20 UTC, décalées de dix minutes pour que trois traitements ne se disputent pas les mêmes lignes. Une quatrième, hebdomadaire, purge les événements.

Tout est gardé par un test d'existence de l'extension : si `pg_cron` est absent, le fichier écrit un avertissement et ne casse pas. Le fichier dit lui-même que l'absence est « le cas attendu sur le banc d'essai, et un DEFAUT en production ».

**Il en manque une cinquième, et personne ne l'avait vue.** `inviter_evaluations()` (`migration-recherche-relations.sql:1097`) envoie la notification `evaluation_a_deposer` aux deux bouts d'un chantier terminé. Elle n'a **aucun `grant`, aucune planification, aucun appelant** dans tout le dépôt. Sans elle, personne n'est jamais invité à noter, donc `publier_evaluations_echues()` n'a rien à publier : **une tâche bien planifiée tourne sur du vide, et la promesse de notation ne se réalise jamais**.

### G.7 Les réglages hors code

**52 variables d'environnement** sont lues par les fonctions de périphérie. Un bouton peut appeler correctement un service qui refuse, sans qu'aucun code soit en cause.

| Variable | Ce qui casse sans elle |
|---|---|
| `PRESTATAIRE_PAIEMENT`, `PAIEMENT_CLE`, `REFERENCE_OFFRE` | Aucun paiement possible, `ouvrir-paiement` rend 503 avec la liste |
| `PAIEMENT_SECRET_EVENEMENTS`, `PAIEMENT_ENTETE_SIGNATURE` | Aucun accès payant ne s'ouvre, **et c'est le bon comportement** |
| `CLE_ENVOI` | `envoyer-email` refuse tout : jamais de porte ouverte par défaut |
| `FOURNISSEUR_EMAIL`, `FOURNISSEUR_CLE`, `EXPEDITEUR_EMAIL` | Aucun courriel ne part |
| `ORIGINES_AUTORISEES`, `HOTES_LIENS`, `URL_RETOUR_OK` | Les retours de paiement et les liens des courriels ne sont plus contrôlés |
| `SUPABASE_SERVICE_ROLE_KEY` | Les fonctions ne peuvent plus appeler les RPC réservées |

`supabase/functions/.env.example` (249 lignes) documente chacune, **et n'est pas suivi par git** : la règle `.env*` du `.gitignore` l'exclut. Un clone neuf du dépôt ne saura pas quelles variables poser. Le fichier signale lui-même le piège, lignes 12 à 17, et renvoie la décision à Joan.

### G.8 A CONSTRUIRE

| Chantier | État aujourd'hui | Ce qu'il faudra |
|---|---|---|
| **Déployer les trois fonctions de périphérie** | 404, mesuré | `supabase functions deploy`, plus `verify_jwt = false` sur `evenements-paiement` |
| **Le prestataire de paiement** | branchement générique écrit et testé, aucune clé | Trancher la banque, créer l'offre, poser trois secrets. **Aucune ligne de code à écrire** |
| **Le fournisseur de courriel** | 4 branchements écrits, 8 gabarits écrits, zéro appelant | Choisir, poser `CLE_ENVOI`, puis brancher les 8 gabarits sur leurs 8 événements |
| **`pg_cron` et la cinquième tâche** | trois tâches écrites et gardées, `inviter_evaluations()` orpheline | Installer l'extension, ajouter une ligne de planification |
| **L'écran de dépôt de pièces** | compartiment, table, politiques, contrôle : tout est là | Un écran dans `/espace`. **C'est le meilleur rapport du dossier** |
| **La rétention de `journal` et de `recherches`** | aucune purge écrite | Décision d'avocat avant d'écrire la ligne |
| **Les agendas Google, Microsoft, Apple** | `agendas` et `agenda_secrets` existent, le `.ics` fonctionne | Comptes développeur à créer chez les trois |

---

## H. Schéma de base de données

> **Relevé, pas conception.** Chaque table est citée à son fichier et à sa ligne.

### H.1 Les comptages propres au schéma

| Mesure | Valeur |
|---|---|
| **Colonnes** | **338**, dont 13 ajoutées après coup par `alter table ... add column` |
| Contraintes `check` | **116**, dont **21 listes fermées** |
| Colonnes calculées par la base | 3 |
| Tables sans aucun index déclaré | 7 |
| Tables sans aucun déclencheur | 22 |

### H.2 Les 35 tables, par domaine

« Lue par » indique l'interface qui l'interroge **directement**.

#### Référentiels

| Table | Source | Col. | Lue par |
|---|---|---|---|
| `metiers` | `migration-espace-artisan.sql:41` | 4 | espace, recherche, demandes, messages, admin, CRM |
| `communes` | `migration-recherche-relations.sql:116` | 6 | **aucun écran** : lue par `chercher_commune()` |
| `reglages` | `migration-abonnement-pieces.sql:87` | 5 | **aucun écran** : lue par `reglage()` |
| `abonnement_etats` | `migration-abonnement-pieces.sql:444` | 6 | CRM |
| `evenement_genres` | `migration-roles-evenements.sql:623` | 4 | **aucun** |
| `consentement_textes` | `migration-messagerie-rgpd.sql:953` | 6 | mes-donnees |

`abonnement_etats` mérite une mention : elle porte `acces` (`complet` / `lecture` / `ferme`), `fiche_publiee` et `message`. **Ce que l'application fait d'un état est une donnée, pas un commentaire ni un `if` dans une page.**

#### Identité et fiche

| Table | Source | Col. | Index | Décl. | Lue par |
|---|---|---|---|---|---|
| `artisans` | `migration-espace-artisan.sql:70` | **23 + 9 = 32** | 6 | **7** | espace, artisan, demandes, admin, CRM |
| `profils` | `schema.sql:57` | **5 + 4 = 9** | 1 | 2 | admin, CRM |
| `artisan_atouts` | `migration-espace-artisan.sql:128` | 5 | 2 | 0 | espace |
| `inscriptions` | `migration-inscriptions.sql:38` | 11 | 4 | 0 | inscription (écriture), CRM |
| `contacts` | `schema.sql:17` | 6 | 2 | 1 | CRM seul |

`artisans` est la table centrale et la plus contrainte : `etape` en liste fermée de 6 valeurs, `telephone` sur un motif, `siret` sur 14 chiffres, `code_postal` sur 5 chiffres, `rayon_km` entre 5 et 200, `publie` **faux par défaut**.

`inscriptions.email_norme` est une **colonne calculée par la base** (`lower(btrim(email))`, stockée) et c'est elle qui porte l'unicité. Normaliser côté navigateur ne protège de rien.

#### Agenda

| Table | Source | Col. | Lue par |
|---|---|---|---|
| `agendas` | `migration-espace-artisan.sql:143` | 8 | espace |
| `agenda_secrets` | `migration-espace-artisan.sql:160` | 4 | **personne, par construction** |
| `occupations` | `migration-espace-artisan.sql:174` | 6 | espace |

`agenda_secrets` isole le jeton d'accès dans sa propre table : sécurité par ligne activée, **zéro politique**. Aucune requête, d'aucun compte, ne sort une ligne. `occupations.saisie` distingue ce que l'artisan a posé à la main de ce qui vient de son agenda, pour qu'un débranchement efface le second sans toucher au premier.

#### Mise en relation

| Table | Source | Col. | Index | Décl. | Lue par |
|---|---|---|---|---|---|
| `recherches` | `migration-recherche-relations.sql:324` | 11 | 3 | 0 | **aucun écran** |
| `demandes` | `:657` | 16 | **4** | **8** | demandes, espace, admin, messages, CRM |
| `notifications` | `:947` | 8 | 3 | 1 | demandes |
| `evaluations` | `:1159` | 14 | 3 | **6** | demandes, espace |
| `journal` | `:1417` | 8 | 3 | 0 | admin |

**Trois index qui sont des règles métier, pas des optimisations :**
- `demandes_en_cours_idx`, unique partiel : impossible d'envoyer deux demandes en cours au même confrère pour la même période.
- `notifications_unicite_idx` : la même notification n'arrive pas deux fois.
- `abonnements_un_vivant_idx` : un seul abonnement vivant par artisan.

`demandes` porte 8 déclencheurs, le plus lourd du schéma. **Les transitions vivent dans le déclencheur, pas dans la page** : une règle d'état qui vit dans le navigateur se contourne.

`evaluations` porte une contrainte à double sens : le demandeur note la `qualite`, le destinataire note les `delais_paiement`, jamais les deux. Et `role_auteur` est **posé par le déclencheur à partir de la demande**, jamais envoyé par la page : il se déduit, il ne se déclare pas.

`journal` **ne porte aucune clé étrangère vers `artisans`** : `acteur_id` est un uuid nu. Il survit donc à la suppression d'un compte. Aucune politique d'insertion, de mise à jour ni de suppression : **un journal qu'on peut réécrire n'est pas un journal**.

#### Messagerie

| Table | Source | Col. | Décl. |
|---|---|---|---|
| `conversations` | `migration-messagerie-rgpd.sql:211` | 7 | 2 |
| `messages` | `:293` | 6 | 2 |
| `blocages` | `:333` | 5 | 0 |
| `signalements` | `:364` | 9 | 1 |

`messages.auteur_id` est en `on delete set null` : **le message survit à la disparition de son auteur**. C'est le coeur de l'anonymisation RGPD. `conversations.couple_ordonne` force `artisan_bas < artisan_haut` : deux artisans ne peuvent pas avoir deux fils selon qui a écrit le premier. Une conversation fermée reste **lisible** et devient muette : un échange entre professionnels peut servir de preuve d'un accord de sous-traitance.

#### Argent

| Table | Source | Col. | Lue par |
|---|---|---|---|
| `abonnements` | `migration-abonnement-pieces.sql:483` | 18 | CRM |
| `paiements` | `:775` | 18 | **aucun** |
| `factures` | `:822` | 30 | **aucun** |
| `facture_compteurs` | `:902` | 3 | **aucun** |
| `evenements_paiement` | `:1190` | 14 | **aucun** |
| `relances_paiement` | `:1418` | 11 | **aucun** |
| `codes_parrainage` | `:1590` | 4 | **aucun** |
| `parrainages` | `:1597` | 10 | **aucun** |

**Trois garanties tenues par la base et non par du code :**
- `evenements_paiement` : `unique (prestataire, reference_evenement)`. Recevoir deux fois « paiement réussi » ne produit pas deux factures. Ce n'est pas un `if`, c'est un index unique : deux appels simultanés ne passent pas.
- `abonnements.evenement_horodatage` : un événement plus ancien que le dernier appliqué est ignoré. Les prestataires ne garantissent aucun ordre, « résilié » peut arriver avant « payé ».
- `factures_figees` : déclencheur `before update or delete`. **Un document comptable ne se réécrit pas**, et le déclencheur tient même contre la clé de service, là où une politique se contourne.

`factures` porte **la photo du client au jour de l'émission**, recopiée et jamais jointe. Le lien vers `artisans` est en `on delete set null` : le document survit intact au départ de la personne. Un `on delete restrict` aurait fait échouer toute suppression de compte, ce qui contredirait la page légale.

`montant_ttc_cents` est calculée et stockée. Trois contraintes portent le droit : `avoir_pointe_une_facture`, `signe_selon_le_genre`, `mention_si_taux_nul`.

**La colonne `formule` est restée en texte libre**, dans `artisans` comme dans `abonnements`, avec un commentaire qui motive ce choix par le fait que le prix n'est pas arrêté (`:492`). **La raison a disparu le 15/09/2026, la conséquence est restée.** La liste fermée peut maintenant être posée.

#### Pièces, conformité, événements

| Table | Source | Col. | Lue par |
|---|---|---|---|
| `pieces` | `migration-abonnement-pieces.sql:169` | 14 | admin seul |
| `consentements` | `migration-messagerie-rgpd.sql:993` | 7 | mes-donnees |
| `demandes_rgpd` | `:1075` | 8 | mes-donnees |
| `evenements` | `migration-roles-evenements.sql:670` | 5 | **aucun** |

`pieces.refus_motive` : un refus sans motif d'au moins 3 caractères est refusé par la base. **Un refus qu'on ne peut pas contester n'est pas un refus.** `pieces.chemin_sous_son_dossier` exige que le chemin contienne une barre oblique, ce qui, avec la politique d'insertion, interdit de pointer le fichier d'un autre.

`consentement_actif_unique` : un consentement actif et un seul par finalité.

### H.3 Les 7 vues

| Vue | Mode | Ce qu'elle rend | Lue par |
|---|---|---|---|
| `fiches_publiques` | `security_invoker = off` | 10 colonnes de `artisans where publie and etape = 'fini'`. **Le nom de famille n'y est pas**, et le code postal est tronqué à 2 chiffres | recherche, artisan, demandes, messages |
| `notes_publiques` | `off` | moyennes des évaluations publiées et non masquées | artisan |
| `mon_abonnement` | `on` | l'abonnement joint à son état | espace |
| `mes_pieces` | `on` | ses pièces, plus `valable` et `en_vigueur` | **personne** |
| `mes_factures` | `on` | ses factures | **personne** |
| `inscriptions_par_metier` | | comptages | **personne** |
| `inscriptions_par_departement` | | comptages | **personne** |

La distinction compte : `security_invoker = off` fait lire la vue avec les droits de son propriétaire, ce qui permet d'ouvrir `fiches_publiques` à `anon` **sans ouvrir `artisans`**. Les trois vues en `on` s'appuient au contraire sur la sécurité par ligne de la table sous-jacente.

### H.4 Ce qu'aucun écran n'interroge

**13 tables sur 35** ne sont interrogées par aucune des 12 pages ni par le CRM :

| Table | Pourquoi, et ce que ça coûte |
|---|---|
| `agenda_secrets`, `facture_compteurs` | **Normal et voulu.** Zéro politique : elles ne doivent jamais sortir |
| `communes`, `reglages`, `recherches`, `evenements` | **Atteintes indirectement** par une fonction serveur. Le socle fonctionne |
| `paiements`, `factures`, `evenements_paiement`, `relances_paiement` | **Dorment.** Il manque le prestataire et les écrans |
| `codes_parrainage`, `parrainages` | **Dorment.** Tout est écrit. Aucun écran |
| `evenement_genres` | Référentiel, lu par les fonctions |

Et **5 vues sur 7** ne sont lues par personne, dont `mes_pieces` et `mes_factures` : les deux écrans qui les justifieraient n'existent pas.

### H.5 Ce qui manque, ou ce qui cloche

| Point | Mesure | A CONSTRUIRE ou à corriger |
|---|---|---|
| **Deux durées d'essai qui ne disent pas la même chose** | `reglages.essai_mois = 1` (`migration-abonnement-pieces.sql:99`, lu par `ouvrir_mon_essai()` ligne 664) et `reglages.essai_jours = 30` (`migration-essai-30-jours.sql:45`, lu par le déclencheur lignes 82 et 109). Deux chemins d'ouverture, deux réglages, et en février un mois fait 28 jours. **Les deux existent en base, mesurés le 15/09/2026** | **A corriger avant tout écran de paiement. Une clé à retirer, pas à ajouter.** Le chemin branché sur le parcours est `essai_jours` : c'est 30 jours qui s'appliquent aujourd'hui |
| `formule` en texte libre | Motivée par un prix non arrêté. Il l'est | La liste fermée peut être posée |
| Rétention de `journal` et de `recherches` | Aucune purge. `journal` grossit sans limite et porte des identifiants ; `recherches` journalise `chercheur_id` | A CONSTRUIRE, après décision d'avocat |
| Purge des `messages` | Aucune purge écrite, et `migration-messagerie-rgpd.sql:1559` explique pourquoi : effacer sur une durée inventée serait pire | A CONSTRUIRE, bloquant pour la page légale |
| Table des appareils | Une notification poussée demande un jeton par appareil | A CONSTRUIRE le jour de l'application mobile |
| `consentement_textes.en_vigueur` | La colonne existe, **aucune ligne n'est marquée en vigueur nulle part** | A CONSTRUIRE : sans elle, la chaîne de preuve du consentement est ouverte |

**Ce qui ne doit surtout pas bouger :** `artisans.id` et `profils.id`. Ce sont les deux clés qui tiennent la règle « un utilisateur, une identité ». Les changer coûterait une migration de chaque clé étrangère du projet.

---

## I. Authentification

### I.1 Ce qui est en service

L'identité est portée par Supabase Auth. Il n'y a **pas d'autre répertoire de comptes** : le site, le CRM et l'application mobile à venir partagent la même table `auth.users`. Un commercial et un artisan sont deux lignes de la même table, séparées par un rôle, pas par deux systèmes.

| Mécanisme | Où | État mesuré |
|---|---|---|
| Adresse mail et mot de passe | `app/connexion/index.html:447` et `:450` | en service |
| Connexion Google | `:369` | câblé, fournisseur **éteint** |
| Réinitialisation du mot de passe | `:496` | en service |
| Création automatique du profil | `migration-cloison-crm.sql:52-68` | en service, **profil inactif à la naissance** depuis le 14/09 |
| Confirmation d'adresse par courriel | `:479-484` | **non raccordée** : aucun fournisseur d'envoi choisi |
| Second facteur | nulle part | **A CONSTRUIRE** |

#### Trois décisions de conception qui tiennent, et qu'il faut garder

**On tente d'entrer avant de créer** (`:445-450`). L'ordre inverse renverrait « adresse déjà prise » à quelqu'un qui a simplement mal tapé son mot de passe, et dirait au passage que cette adresse est inscrite.

**Aucun message ne révèle qu'une adresse existe.** Échec d'entrée et échec de création rendent le même texte (`:470-474`). La réinitialisation répond « c'est envoyé » que le compte existe ou non. C'est ce qui empêche d'utiliser le formulaire comme annuaire.

**La bibliothèque Supabase n'est pas téléchargée pour rien.** Les pages cherchent d'abord la clé `sb-<projet>-auth-token` dans le stockage local avant d'importer le module. Sur un chantier en 4G, cela évite quelques dizaines de kilo-octets à un visiteur de passage.

#### Le réglage de session, mesuré

`persistSession: true`, `autoRefreshToken: true` sur les neuf écrans qui parlent à la base. `detectSessionInUrl` vaut **true sur `/connexion` seulement** (`:309`) et **false partout ailleurs**. Un jeton posé dans une adresse n'est donc consommé qu'à un seul endroit, celui qui sait quoi en faire.

### I.2 Les gardes, écran par écran

| Écran | Garde | Sans session |
|---|---|---|
| `/admin` | redirection (`:1245-1248`) | va à `/connexion` |
| `/demandes` | redirection (`:1923-1924`) | va à `/connexion` |
| `/espace` | redirection (`:2567-2568`) | va à `/connexion` |
| `/mes-donnees` | redirection (`:1828`) | va à `/connexion` |
| `/messages` | écran hors session (`:2149-2150`) | reste sur place, explique |
| `/recherche` | mode public dégradé (`:901-935`) | métier seul, dates et rayon éteints |
| `/artisan` | bouton « Se connecter » (`:852-870`) | fiche publique lisible |
| `/accueil`, `/aide`, `/legal`, `/inscription` | aucune | publiques, c'est voulu |

**Aucune de ces gardes ne protège une donnée.** Elles choisissent quel écran montrer. `app/admin/index.html:1256-1258` l'écrit lui-même : « La réponse ne protège rien : elle sert seulement à afficher une phrase juste au lieu de six panneaux vides. »

### I.3 Ce qui manque

#### Le SIRET est vérifié dans le navigateur, et la base ne le recontrôle pas

Le module est sérieux (`app/espace/index.html:925-980`). Mais le résultat est **écrit par le navigateur** : `siret`, `siret_etat: 'valide'` et `siret_verifie_le` partent dans `public.artisans` par la politique « sa fiche » (`migration-espace-artisan.sql:198`), qui autorise le propriétaire à écrire toutes les colonnes de sa ligne. Aucun déclencheur ne protège ces trois colonnes. La seule contrainte de base est un format à quatorze chiffres.

C'est traité au chapitre R.6.2, parce que c'est une faille d'intégrité et non un défaut d'authentification. Il est nommé ici parce que **c'est le seul endroit du parcours d'entrée où la base fait confiance à la page**.

#### Les autres manques

| Manque | État | Ce qu'il faudra |
|---|---|---|
| Confirmation d'adresse | éteinte, faute de fournisseur d'envoi | choisir le fournisseur, poser `CLE_ENVOI`, rallumer « Confirm email » |
| Second facteur sur le compte administrateur | absent | c'est le compte qui lit le journal, les signalements et 1 374 fiches |
| Durée de session et révocation à distance | non réglé | A CONSTRUIRE |
| Politique de mot de passe côté serveur | la page exige huit caractères, le minimum réellement imposé par le projet est **non vérifié** | relever le réglage, puis l'aligner |
| Limitation des tentatives | repose sur les limites propres de Supabase, **non vérifiées** | relever, puis décider |

---

## J. Autorisations

### J.1 Le principe

La clé publique Supabase est écrite en clair dans le code source de **dix fichiers**. Mesure du 15/09/2026, jeton décodé fichier par fichier : **dix jetons sur dix portent `"role":"anon"`**. Aucune clé de service nulle part dans `app/`, `crm/` ni `outils/`.

Ce que cette clé ouvre : **rien par elle-même**. Elle nomme le projet, elle ne nomme personne. Ce qui décide, c'est le jeton de session que la bibliothèque ajoute dans l'en-tête `Authorization`, et que PostgreSQL relit par `auth.uid()` **à l'intérieur de la transaction**, du côté serveur.

Deux conséquences qu'il faut accepter en entier, ou pas du tout.

1. **Tout ce qu'un écran peut lire, un terminal muni du même jeton peut le lire.** C'est pour cela qu'un audit de sécurité ici ne se fait jamais en regardant les écrans : il se fait en comptant les lignes qui sortent.
2. **Rien de secret ne peut vivre dans une page.** Le corollaire est tenu : les fonctions qui ont besoin d'un secret vivent hors du navigateur.

### J.2 Les quatre rôles

Source unique : `migration-roles-evenements.sql:395-425`.

| Rôle | Qui | Ce qu'il atteint |
|---|---|---|
| `anonyme` | pas de session | communes, métiers actifs, textes de consentement, fiches publiées, et le formulaire de liste d'attente en écriture seule |
| `usager` | tout compte inscrit | sa fiche, ses agendas, ses demandes, ses messages, ses données. Rien de ce qui appartient à un autre |
| `commercial` | membre de l'équipe | en plus : les 1 374 contacts de prospection, la liste d'attente, les événements |
| `admin` | Joan | en plus : modération des fiches, signalements, pièces, journal, comptabilité |

**« Artisan » n'est pas un rôle, et c'est important.** Un artisan est un `usager` qui porte une ligne dans `public.artisans`. La cloison entre le produit et le fichier de prospection ne passe donc pas par un rôle d'artisan, mais par l'absence de rôle commercial.

### J.3 Le miroir et ses trois refus

`profils.role` est une liste fermée, et `actif` / `admin` en sont le reflet, tenu par le déclencheur `profils_role`. Trois refus y sont écrits, et chacun ferme une porte qui avait été ouverte :

**Refus 1** (`:318-323`). Hors administrateur, `role`, `admin` et `actif` repartent avec leurs valeurs d'origine. Sans lui, la politique « profils presence soi-meme », qui autorise chacun à écrire sur sa propre ligne, **suffisait à se promouvoir en trois lignes dans la console du navigateur**.

**Refus 2** (`:337-343`). Le rôle `admin` ne se pose jamais depuis une session. Il se pose au tableau de bord Supabase, avec la clé de service.

**Refus 3** (`:349-357`). Un compte qui porte une fiche d'artisan ne peut pas devenir commercial. C'est ce qui rend le bouton « Rendre l'accès » du CRM sans effet sur un artisan : **la base refuse, elle ne compte pas sur le fait que personne ne cliquera**.

Le fichier documente aussi que l'**ordre alphabétique des déclencheurs** est porteur : `profils_protege_admin` passe avant `profils_role`. C'est acquis sans rien forcer, mais c'est une dépendance à un comportement de PostgreSQL, et elle mérite d'être revérifiée à chaque montée de version.

### J.4 Les fonctions appelables sont, par construction, hors des politiques

**85 fonctions `security definer` distinctes**, dont 56 appelables et 29 déclencheurs. Chacune des appelables contourne la sécurité par ligne, par définition. Chacune est donc son propre mur.

Audit du 15/09/2026, fonction par fonction : **20 d'entre elles prennent un identifiant en paramètre**, c'est-à-dire qu'un appelant peut y désigner quelqu'un d'autre. Les quatorze sensibles ont été lues une par une, et **toutes refont le contrôle à l'intérieur** : `definir_role` lève `42501` si `est_admin()` est faux, `moderer_fiche`, `notifier`, `valider_parrainage`, `coordonnees_confrere` sont toutes révoquées de `public` puis accordées étroitement. Aucun trou trouvé.

**Un défaut de convention, mesuré.** La convention du dépôt est `revoke all on function ... from public` puis `grant execute ... to <role>`. Comptage : **55 instructions `revoke`, dont 10 seulement nomment `anon` et `authenticated`**. Et **huit fonctions ne portent aucun `revoke`** : `est_admin`, `est_actif`, `distance_km`, `delai_avis`, `plafond_messages_par_heure`, `ecriture_interne` (ni revoke ni grant), plus `est_commercial` et `role_courant` (un grant, pas de revoke).

Postgres accorde `execute` à `public` par défaut. **Ces huit sont donc exposées à `anon` sur `/rest/v1/rpc/` sans que personne l'ait décidé.** Leur contenu est inoffensif (`est_admin()` rend `false` pour un visiteur, `distance_km()` est du calcul pur, `role_courant()` est même accordée à `anon` exprès), mais **la surface est plus large que ce que le dépôt croit**, et un futur ajout dans ce style ne serait pas plus visible. Le cas grave du même mécanisme est au chapitre Y.3.

### J.5 Où ça tiendrait mal

#### 1. L'ordre de rejeu des migrations, et rien ne l'impose

Les fichiers ne sont pas numérotés. Deux d'entre eux recréent des politiques ouvertes que des fichiers ultérieurs ferment. Simulation faite le 15/09/2026 :

| Ordre rejoué | Lectures ouvertes |
|---|---|
| ordre des dépendances | 5, toutes justifiées |
| **+ `schema.sql` rejoué en dernier** | 8, dont **`contacts` en lecture ET en écriture**, et `profils` |
| **+ `migration-admin.sql` rejoué en dernier** | 6, dont `profils` |

C'est-à-dire : **rejouer `schema.sql` sur la base de production rouvre les 1 374 fiches de prospection à tout compte connecté, en lecture et en mise à jour, sans qu'aucune erreur ne soit levée.** `migration-cloison-profils.sql:35-38` porte l'avertissement, en toutes lettres. **Un avertissement dans un commentaire n'est pas une garde.**

**Gravité : haute.** Ce n'est pas une faille dans le système tel qu'il tourne, c'est un piège dans la procédure de maintenance. Un piège dans la procédure finit toujours par se déclencher.

**A CONSTRUIRE.** Numéroter les migrations, ou poser une table `migrations_jouees` avec un contrôle préalable. Et généraliser la fonction de contrôle de `migration-cloison-profils.sql:60-79` à **toutes** les tables : une requête sur `pg_policies` qui rend chaque politique dont la condition est nulle ou vaut `true`, à jouer après chaque migration. Vingt lignes.

#### 2. Les vues s'exécutent avec les droits de leur propriétaire, par défaut

Une vue PostgreSQL ignore la sécurité par ligne de la table qu'elle lit, sauf `security_invoker = on`. Le projet s'en est aperçu une fois et l'a corrigé à la main sur deux vues de comptage. Une autre s'appuie délibérément sur `off` pour choisir ses colonnes une par une, et c'est un bon motif.

Le risque n'est pas dans ces trois vues, il est dans **la prochaine**. **A CONSTRUIRE** : une règle écrite, toute nouvelle vue déclare `security_invoker` explicitement, dans un sens ou dans l'autre, et dit pourquoi.

#### 3. Le jour où l'inscription libre s'ouvre

`migration-cloison-crm.sql:19-26` le dit : l'inscription libre est désactivée au tableau de bord, et le jour où l'interrupteur bascule, la cloison doit déjà être en place. Elle l'est depuis le 14/09. **Le contrôle à refaire avant de basculer l'interrupteur est écrit** (`:95-102`) : créer un compte d'essai d'artisan et tenter `select count(*) from contacts`, attendu **0**. **Il n'a pas été refait.**

---

## K. Le CRM commercial

### K.1 Ce que c'est, matériellement

| Fichier | Lignes | Rôle |
|---|---|---|
| `crm/src/app.js` | 1 656 | toute l'application, aucune dépendance |
| `crm/src/styles.css` | 679 | 429 règles, son propre jeu de variables |
| `crm/src/index.html` | 260 | le gabarit et les quatre repères d'assemblage |
| `crm/src/config.js` | 69 | statuts, métiers, modes, clé publique |
| **Total** | **2 664** | |

### K.2 Les six vues en service

| Vue | Ce qu'elle fait | Source |
|---|---|---|
| Tableau de bord | 5 compteurs, entonnoir, relances en retard, quatre répartitions, activité récente, qualité de la base | `app.js:486-549` |
| Contacts | rail de 7 filtres, tableau triable, sélection multiple, export CSV, fiche à droite | `:550-654` |
| Inscrits | les artisans de la plateforme, liste et fiche complète, **en lecture seule** | `:1005-1513` |
| Pipeline | kanban à 7 colonnes, glisser pour changer de statut | `:775-803` |
| Relances | toutes les fiches portant une date de relance ou une prochaine action | `:804-818` |
| Réglages | stockage, sauvegarde JSON, session, présence, administration des comptes | `:819-1004` |

### K.3 Les deux populations, et pourquoi elles ne se mélangent pas

Le CRM tient **deux tables distinctes** et l'écran le dit lui-même (`app.js:1470-1476`) : `public.contacts` (prospection, importée de Pipedrive, extraction du 09/2026) et `public.artisans` (ceux qui ont ouvert un compte eux-mêmes).

« Les additionner donnerait un chiffre faux : un prospect démarché n'est pas un inscrit. » La règle est bonne. Sa conséquence ne l'est pas : **rien ne rapproche les deux**.

### K.4 Ce que le CRM écrit réellement

Sur 1 656 lignes, **deux tables seulement reçoivent une écriture** : `contacts` (upsert d'une fiche, `:266-271`) et `profils` (prénom, actif, admin, `:196-205` ; battement de présence toutes les 30 s, `:215-219`).

Aucun `PATCH`, aucun `POST` vers `artisans`, `abonnements` ou `demandes`. **La vue Inscrits est strictement consultative**, et c'est un choix assumé : la lecture passe par la session de la personne, jamais par une clé d'administration.

Lecture par pages de 1 000 lignes, rafraîchissement toutes les 20 secondes. Pas de websocket : deux requêtes par minute et par personne, ce qui tient dans l'offre gratuite.

### K.5 La fiche telle qu'elle existe

**Fiche prospect** (`:666-753`) : badges, cinq actions rapides (appeler en `tel:`, écrire en `mailto:`, ouvrir le site, « message laissé », « rappeler dans 3 j »), bloc coordonnées avec formulaire de correction **non destructif** (la correction vit dans `crm.fix`, la donnée Pipedrive n'est jamais écrasée), bloc suivi, historique à 6 types, source horodatée.

**Fiche inscrit** (`:1276-1387`) : identité, quatre badges, jauge des 6 étapes du parcours, alertes de suspension et de suppression, bloc entreprise, bloc contact, bloc abonnement et essai, bloc demandes de sous-traitance envoyées et reçues, et un bloc **Notes marqué « non branché »** qui explique en clair ce qui manque au lieu d'afficher un champ qui perdrait le texte.

**Une incohérence que le produit affiche lui-même** (`:1398-1400`) : quand `abonnements` ne porte aucune ligne et que `artisans.essai_jusqu_au` porte une date, l'écran affiche « les deux ne s'accordent pas, à vérifier ». Le produit connaît sa propre incohérence sans la résoudre. C'est honnête, et c'est une conséquence directe des deux chemins d'ouverture d'essai (H.5).

Le vocabulaire est celui de la sous-traitance entre entreprises indépendantes, jamais celui de l'emploi : la liste fermée des états de demande est commentée en ce sens.

### K.6 Ce qui manque pour la fiche client 360

Neuf manques. **Sept sur neuf sont un raccordement, pas une construction.**

| # | Ce qui manque | État réel | Geste |
|---|---|---|---|
| 1 | **Le rapprochement prospect / inscrit** | aucun code de rapprochement sur le SIRET ni sur l'e-mail | A CONSTRUIRE : une colonne `contacts.artisan_id`, alimentée au SIRET, et un bandeau des deux côtés |
| 2 | **Les notes d'équipe sur un inscrit** | la place est réservée et la cause écrite (`:1364-1373`) : aucune table ne porte de note sur un compte | A CONSTRUIRE : table `notes_artisan`, politique réservée à `est_admin()` |
| 3 | **L'historique du client** | `evenements` et quatre fonctions d'alimentation existent. **Zéro écran ne les lit** | A BRANCHER : c'est exactement la frise du 360 |
| 4 | **La facturation** | `factures`, `facture_compteurs`, `emettre_facture()`, `prochain_rang_facture()` existent | A BRANCHER |
| 5 | **Les paiements et les relances** | six objets existent | A BRANCHER, après le choix du prestataire |
| 6 | **Le parrainage** | deux tables et quatre fonctions ouvertes à un compte connecté. Zéro appel | A BRANCHER, après l'arbitrage de la récompense |
| 7 | **Les pièces justificatives** | `pieces` et `pieces_controle()` existent ; seul `/admin` les lit | A BRANCHER dans la fiche inscrit |
| 8 | **L'e-mail de l'artisan** | il vit dans `auth.users`, hors de portée d'une session (`:1381`) | A CONSTRUIRE : une vue exposant l'adresse aux seuls comptes que `est_admin()` reconnaît |
| 9 | **La modération depuis la fiche** | `moderer_fiche()` existe et est ouverte ; le CRM renvoie vers un autre outil (`:1322-1325`) | A BRANCHER : un seul outil commercial, pas deux |

**Ce que le CRM refuse de lire, et à garder tel quel** (`:1378-1385`) : les jetons d'agenda, le contenu des messages, et les créneaux d'occupation. **Une fiche 360 ne veut pas dire tout voir.**

### K.7 Le point faible de fabrication

Le CRM porte **sa propre feuille de style**, indépendante des douze écrans : 429 règles, une palette voisine mais pas identique, une typographie différente (Bricolage Grotesque contre Space Grotesk et DM Sans), et un système de rayons que l'application n'a pas. **Deux systèmes qui se ressemblent divergent : ils ont déjà divergé.** Détail au chapitre U.6.

---

## L. L'espace client

### L.1 Les douze écrans, et ce qu'ils lisent

| Écran | Lignes | Ce qu'il lit en base |
|---|---|---|
| `accueil` | 1 172 | rien |
| `connexion` | 525 | rien (Supabase Auth seul) |
| `inscription` | 337 | `inscriptions` |
| `espace` | 2 652 | `artisans`, `artisan_atouts`, `agendas`, `occupations`, `metiers`, `mon_abonnement`, `demandes`, `evaluations` |
| `recherche` | 1 494 | `metiers`, `communes`, `fiches_publiques`, 3 fonctions |
| `artisan` | 1 120 | `fiches_publiques`, `notes_publiques`, `peut_demander` |
| `demandes` | 1 998 | `demandes`, `fiches_publiques`, `metiers`, `notifications`, `evaluations`, `artisans` |
| `messages` | 2 272 | `conversations`, `messages`, `blocages`, `signalements`, `demandes`, `fiches_publiques`, `metiers` |
| `mes-donnees` | 1 977 | `consentements`, `consentement_textes`, `demandes_rgpd` |
| `admin` | 1 278 | `artisans`, `demandes`, `metiers`, `pieces`, `profils`, `signalements`, `journal` |
| `aide` | 309 | rien |
| `legal` | 1 230 | rien |

Dix-huit fonctions serveur distinctes sont appelées depuis ces écrans, sur les 93 définies.

### L.2 La coquille de l'espace

Un seul motif, repris sur six écrans (`espace`, `recherche`, `artisan`, `demandes`, `messages`, `mes-donnees`) :

- au-dessus de 900 px, un menu latéral fixe de 248 px, **cinq entrées** : `/espace`, `/recherche`, `/demandes`, `/messages`, `/mes-donnees` ;
- en dessous, une barre collante de 56 px et un tiroir qui s'ouvre vraiment, se ferme à Échap et au clic sur le voile, et rend le focus ;
- l'écran courant est un aplat d'encre, jamais une lettre d'accent : `#FEFCF8` sur `#191512` rend **17,71 : 1**, là où le rouge de marque en lettre sur le papier plafonne à 4,21.

**Cinq entrées de navigation, et l'accueil annonce « Trois écrans ».** Un chiffre de simplicité que l'artisan peut compter lui-même.

### L.3 Le parcours d'entrée, et sa règle

Détaillé en D.4. Le principe : l'étape atteinte est **une colonne de la base**, pas une variable de page ; chaque étape s'enregistre en sortant ; il n'y a pas de bouton « enregistrer » final.

Les données d'exemple portent leur mention dans le **même bloc visuel** qu'elles (`espace:720`) : « Écrans d'exemple. Les noms, les notes et les dates sont fictifs. » Elles ne touchent jamais la base et disparaissent avec leur mention dès qu'elle rend quelque chose.

### L.4 Le prix, et la contradiction qu'il a laissée

Le prix est arrêté depuis le 15/09/2026 : **29,90 euros HT par mois, sans engagement, premier mois offert**. La durée de l'essai vient de `reglages`, pas d'un nombre écrit dans la page.

**Trois écrans portent le prix, cinq disent encore qu'il n'existe pas.** Mesuré, texte visible seulement :

| Écran | Ce qui est affiché | Ligne |
|---|---|---|
| `espace` | 29,90 € HT par mois, sans engagement | `:1236` |
| `demandes` | 29,90 € HT, le premier mois offert | `:1177` et `:1235` |
| `aide` | « le prix est arrêté depuis le 15/09/2026 : 29,90 € HT » | `:143` |
| `aide` | **« Le tarif est en cours d'arbitrage »**, dans la réponse à la question sur le prix | `:225` |
| `accueil` | « Tarif en cours d'arbitrage », et « Il sera affiché ici dès qu'il est arrêté, et pas avant » | `:896` et `:898` |
| `artisan` | « est en cours d'arbitrage et rien ne t'est demandé aujourd'hui » | `:914` |
| `admin` | « le tarif est en cours d'arbitrage. On compte des abonnements, jamais des euros » | `:570` |
| `legal` | **« Le prix de l'abonnement n'est pas arrêté à ce jour »** | `:824` |

S'y ajoutent deux commentaires de code périmés, `recherche:50` et `mes-donnees:73`.

**`aide/index.html` se contredit dans la même page, aux yeux de l'artisan** : la ligne 143 et la ligne 225 sont toutes deux du texte visible. C'est la page la plus lue du produit. **À corriger avant tout le reste.**

### L.5 Ce qui manque à l'espace client

#### Ce qui existe en base et qu'aucun écran n'appelle

Dix tables portent du SQL testé que rien ne consomme : `codes_parrainage`, `evenement_genres`, `evenements`, `evenements_paiement`, `facture_compteurs`, `factures`, `paiements`, `parrainages`, `recherches`, `relances_paiement`.

Quatorze fonctions ouvertes à un compte connecté ne sont appelées par aucun écran : `acces_artisan`, `annuler_resiliation`, `contrat_demandes`, `definir_role`, `demander_resiliation`, `enregistrer_parrainage`, `entonnoir`, `est_commercial`, `est_membre_conversation`, `fil_signale`, `mes_parrainages`, `mon_code_parrainage`, `ouvrir_mon_essai`, `relation_acceptee`.

**Deux d'entre elles sont graves parce qu'une page les promet :** `demander_resiliation` et `annuler_resiliation` existent, et deux écrans annoncent la résiliation au présent (`aide:228` « Tu résilies depuis ton compte, sans nous écrire et sans justification », `espace:1193` « Tu peux arrêter depuis ton espace, sans nous écrire »). **Aucun écran ne porte ce bouton.**

Le parrainage est dans le même cas : `aide` promet un mois offert pour un filleul, deux tables et quatre fonctions existent, zéro écran les appelle, et `reglages.parrainage_mois_parrain` vaut `null`.

#### Ce qui n'existe nulle part

| Manque | Preuve | État |
|---|---|---|
| Écran de facturation | 0 lecture de `factures` dans les 12 écrans | A CONSTRUIRE |
| Écran de parrainage | le mot n'apparaît que dans `aide` et `mes-donnees`, jamais comme parcours | A CONSTRUIRE |
| Écran de dépôt de pièces | 0 `storage.from(...).upload` dans `app/` | A CONSTRUIRE |
| Changement de carte et de date de prélèvement | promis par `aide:235`, aucun prestataire raccordé | A CONSTRUIRE |
| Location de matériel | promise par `aide`, aucune table d'annonce. `artisan_atouts.genre = 'materiel'` désigne le matériel possédé, pas une location | A TRANCHER puis construire, ou retirer la réponse |
| Revérification automatique du SIRET | promise par `aide`, aucune tâche ne la porte | A CONSTRUIRE, ou retirer la promesse |
| Les huit courriels transactionnels | 646 lignes de gabarits écrites, aucun fournisseur choisi | A BRANCHER |

#### Le défaut de navigation le plus coûteux

**`/legal` n'est lié depuis aucun écran.** Mesuré : 0 occurrence de `href="/legal"` dans les douze fragments. C'est la page qui porte 39 marqueurs, et les mentions légales doivent être atteignables depuis toute page. **Un pied de page commun résout un défaut d'usage et une obligation légale d'un coup.** `/admin` est dans le même cas, mais c'est voulu.

---

## M. L'application mobile

> **L'application n'existe pas.** Ce chapitre décrit son architecture cible, pas son code. Tout ce qui suit est au futur et marqué **A CONSTRUIRE**. Elle relève du devis N°2, pas du N°1.

### M.1 Ce qui est mesuré aujourd'hui

| Vérification | Résultat |
|---|---|
| Dossier d'application dans le dépôt | aucun |
| Écran `/telecharger` | absent (12 écrans déclarés dans `ECRANS`) |
| Manifeste d'application web | aucun : `app/public/` contient `_headers`, `favicon.svg`, `icone-app.svg`, `robots.txt` |
| Agent de service (hors ligne) | aucun |
| Table `appareils` | absente des 35 tables |
| Canal d'envoi sur `notifications` | absent : la table porte `genre`, `titre`, `corps`, `lu_le`, jamais un jeton ni une date d'envoi |

### M.2 Ce que l'architecture actuelle garantit déjà

Ce n'est pas une promesse, c'est une conséquence du socle en place.

| Garantie | Pourquoi elle tient |
|---|---|
| **Même compte, mêmes droits** | `artisans.id` **est** `auth.users.id`. Une session posée sur un téléphone porte le même identifiant que celle du navigateur. Rien à rapprocher, rien à migrer |
| **Sessions simultanées** | Supabase Auth émet un jeton par appareil : se connecter sur le téléphone ne déconnecte pas le navigateur |
| **La logique métier vit en base** | les transitions de `demandes` sont dans un déclencheur, l'accès dans `acces_artisan()`. L'application les appelle, elle n'a pas à les connaître |
| **La sécurité tient sans le client** | les politiques par ligne sur 35 tables. Un client mobile mal écrit ne lit pas plus qu'un navigateur mal écrit |
| **Une seule interface d'accès** | PostgREST plus les fonctions de périphérie. L'application appellera exactement les mêmes points que `/espace` |
| **Rien ne dépend de l'hébergeur** | les fonctions serveur vivent chez Supabase. L'hébergement du site a déjà changé ce mois-ci |

### M.3 Ce qu'il faudra ajouter côté base, et rien de plus

| Ajout | Pourquoi il n'existe pas déjà | Forme |
|---|---|---|
| Table `appareils` | une notification poussée demande un jeton par appareil | `appareils(id, artisan_id, plateforme, jeton, cree_le, vu_le)`, politique « sa propre ligne », plus une écriture réservée au service |
| Colonnes de canal sur `notifications` | on ne sait pas aujourd'hui si une notification a été poussée, ni quand | `canal`, `envoye_le`, `echec_motif` |
| Table `preferences_notification` | une notification qu'on ne peut pas couper se fait couper au niveau du système, et on perd tout le canal | une ligne par artisan, une colonne par genre |
| Fonction de périphérie `pousser-notification` | les fonctions actuelles couvrent le courriel et le paiement, pas la poussée | une quatrième, au même endroit |
| Adresse de retour de lien profond | `signInWithOAuth` a besoin d'une adresse que le système sait rouvrir | **réglage**, pas du code |

### M.4 Ce que l'application consommera

Exactement ce que `/espace` consomme, et rien de plus. L'ordre de priorité des écrans suit l'usage réel, pas la symétrie avec le site : **l'agenda d'abord** (le geste du chantier), les demandes ensuite, la messagerie troisième. La recherche et les données personnelles peuvent rester sur le site la première année.

### M.5 Les cinq manières de se tromper, et ce qu'elles coûtent

| Erreur | Ce qu'elle coûte |
|---|---|
| **Une base locale synchronisée** | deux sources de vérité, donc des conflits, donc des données divergentes. Un cache **en lecture seule** pour afficher les demandes hors réseau, jamais une base de synchronisation |
| **Un compte séparé pour l'application** | deux lignes `auth.users` pour une personne, donc deux fiches, deux abonnements, deux historiques. Incorrigible sans migration compte par compte |
| **Réimplémenter les règles métier dans le client** | le jour où une transition change en base, l'application affiche des boutons qui échouent |
| **Une interface maison entre l'application et Supabase** | une couche de plus à sécuriser, déployer et maintenir, qui n'ajoute rien |
| **Embarquer la clé de service** | elle contourne toutes les politiques, et une application se décompile |

### M.6 Le préalable non technique

Deux exigences de magasin d'applications à instruire avant la première ligne : le consentement au suivi exigé par Apple si une mesure d'audience est active (la finalité existe déjà dans `consentements`), et la présence d'un parcours de suppression de compte **dans l'application**, exigée par Apple depuis 2022. Ce parcours existe déjà côté base : `supprimer_mon_compte()`. Il suffira de l'appeler.

Rien ici n'est à commencer avant que le site et le parcours soient jugés bons.

---

## N. Le paiement

### N.1 Où en est le paiement, mesuré

**Le socle est joué.** Interrogées en production le 15/09/2026 avec la seule clé publique, les six tables du paiement répondent 200 : `abonnements`, `paiements`, `factures`, `facture_compteurs`, `relances_paiement`, `evenements_paiement`. Témoin : une table inventée rend `PGRST205`. `migration-abonnement-pieces.sql` (1 881 lignes) est donc bien en base.

**Les trois fonctions de périphérie ne sont pas déployées** : 404 `NOT_FOUND`, **exactement la même réponse que le témoin d'un nom inventé**. Une fonction déployée mais protégée rendrait 401.

**Conséquence visible à l'écran, aujourd'hui** : `etatPaiement()` ne reçoit pas de réponse lisible, rend `inconnu`, et l'artisan lit « On n'arrive pas à joindre le service de paiement » (`app/espace/index.html:1273-1276`). La carte prévue pour dire la vérité, « Pas encore raccordé : le prestataire n'est pas choisi » (`:1266-1271`), **ne s'affiche jamais**. Le produit dit une panne là où il y a une décision non prise. Le code est juste, c'est le déploiement qui manque.

**Les 7 % de rémunération Alp Valley n'ont aucune ligne de code, et c'est juste** : c'est un flux Alp Valley, pas un flux produit. Ils ne doivent jamais apparaître dans une facture d'abonnement. Aucune confusion n'est possible aujourd'hui : le produit ne connaît qu'un nombre, 29,90.

### N.2 La règle qui commande tout le chapitre

**Le navigateur ne confirme jamais un paiement.** Elle est écrite trois fois, au même endroit que le code qui la tient (`ouvrir-paiement/index.ts:8-13`, `evenements-paiement/index.ts:10-14`, `app/espace/index.html:1120-1123`), et elle est répétée dans la réponse rendue à l'appelant, pour qu'une page qui la croirait fausse lise le rappel dans son propre JSON.

Raison, en trois faits : l'adresse de retour se tape à la main ; la page peut être fermée avant le retour ; le retour peut arriver avant l'encaissement. **Un accès ouvert sur un retour de navigateur est un accès gratuit pour qui sait lire une barre d'adresse.**

### N.3 L'interface attendue du prestataire

Le prestataire n'est pas choisi : Joan envisage la BNP plutôt que Stripe. Le code ne nomme donc personne. Il nomme une **interface**, et c'est elle qui tient quel que soit le choix (`_partage/prestataires.ts:88-101`).

| Membre | Ce qu'il doit faire | Ce qu'il ne doit jamais faire |
|---|---|---|
| `manqueSession()` | rendre la liste des variables absentes, en clair | rendre une valeur de secret |
| `manqueEvenements()` | idem, pour la réception | idem |
| `ouvrirSession(d)` | demander une session en citant une **référence d'offre**, rendre une adresse https | composer un montant |
| `signature()` | nommer l'en-tête, l'écriture, l'algorithme | supposer |
| `texteSigne(corpsBrut, horodatage)` | composer ce qui est signé, sur le **texte brut reçu** | re-sérialiser le JSON |
| `lire(charge)` | traduire un message, ou rendre `null` | deviner un état |

Deux branchements existent : `aucun`, qui refuse et dit pourquoi, et `generique`, qui couvre le schéma le plus répandu (HMAC-SHA256 sur `<horodatage>.<corps>`). **Le générique n'a été exécuté contre aucun prestataire réel.** Le jour du choix, si le schéma diffère, on ajoute un branchement à côté : c'est pour cela que c'est une interface et non un `if`.

#### Ce qu'il faudra relever chez le prestataire retenu

À relever sur un **vrai message d'essai**, jamais sur une documentation lue de mémoire.

| Variable | Ce que c'est |
|---|---|
| `PRESTATAIRE_PAIEMENT` | le nom retenu ; sa seule présence fait basculer du mode qui refuse au branchement générique |
| `PAIEMENT_CLE`, `PAIEMENT_URL_SESSION` | la clé d'appel, l'adresse d'ouverture d'une session |
| `REFERENCE_OFFRE` | **la variable la plus importante du fichier** : c'est elle qui porte les 29,90 euros HT, chez lui |
| `PAIEMENT_SECRET_EVENEMENTS` | le secret de signature ; sans lui la fonction refuse tout |
| `PAIEMENT_ENTETE_SIGNATURE`, `PAIEMENT_ENTETE_HORODATAGE` | à relever sur un vrai message |
| `PAIEMENT_CHEMIN_REFERENCE` | où lire l'identifiant du message : **c'est la clé d'idempotence** |
| `PAIEMENT_CHEMIN_ARTISAN` | où retrouver notre identifiant, renvoyé tel qu'on l'a donné |
| `PAIEMENT_ETATS` | la table `son_mot=notre_état` |

**Le prix ne s'écrit jamais dans une variable.** Il vit chez le prestataire sous `REFERENCE_OFFRE`, et se change chez lui sans redéploiement. Le seul montant qui entre en base est celui d'un paiement **déjà encaissé**, lu dans son message : constaté, pas décidé. `ouvrir-paiement` refuse d'ailleurs bruyamment tout champ qui ressemble à un montant, en 422.

C'est cohérent avec `migration-abonnement-pieces.sql:113-114`, qui impose que la table `reglages` ne porte aucune clé de prix, et avec le commentaire de fin de fichier qui exige que la recherche d'un montant dans le fichier rende zéro.

### N.4 Les six états, et ce que chacun donne

Source unique : `public.abonnement_etats`. Le comportement est une **donnée**, pas un `switch` recopié dans chaque écran.

| Code | Accès | Fiche visible |
|---|---|---|
| `essai` | complet | oui |
| `actif` | complet | oui |
| `impaye` | complet | oui |
| `suspendu` | lecture | non |
| `resilie` | complet | oui |
| `expire` | fermé | non |

Deux règles portées par la base, donc vraies même sous appels concurrents : **un seul abonnement vivant par artisan** (index unique partiel), et **la période prime sur l'état** (`periode_au` ferme l'accès, pas l'état seul).

`impaye` laisse l'accès **ouvert**. C'est une décision commerciale inscrite en base : on ne coupe pas un artisan pendant qu'on réessaie sa carte.

### N.5 Les quatre garanties, et où chacune est tenue

| Garantie | Tenue par | Preuve |
|---|---|---|
| La signature | la fonction | `evenements-paiement/index.ts:108-203`. Sans secret, elle refuse **tout** ; un message mal signé n'est **même pas enregistré** |
| L'idempotence | la **base** | `unique (prestataire, reference_evenement)`. Ce n'est pas un `if`, c'est un index unique : deux envois simultanés ne passent pas |
| Le désordre | la **base** | `appliquer_abonnement()` compare l'horodatage déclaré au dernier appliqué, sous `for update` |
| Le journal | la **base** | la charge brute est conservée telle quelle dans `evenements_paiement` |

Deux points à ne pas perdre le jour du branchement :

1. **Le corps signé est le texte brut reçu, jamais un JSON re-sérialisé.** `JSON.stringify(JSON.parse(x))` ne rend pas `x` : ordre des clés, espaces, écriture des nombres. `req.text()` est donc lu **une seule fois, en premier**. C'est l'erreur classique, et elle coûte une journée à chercher un secret qui n'a rien.
2. **On répond 200 à un message déjà vu, et on retente quand même l'application.** Répondre en erreur ferait boucler le renvoi sans fin ; retenter rattrape un premier envoi enregistré puis mal appliqué.

### N.6 Les factures : pourquoi rien ne s'émet

`fait.facture = "non_emise_volontairement"` (`evenements-paiement/index.ts:331`). Trois raisons mesurées, pas une préférence :

- `emettre_facture()` n'a **aucun contrôle de doublon** ;
- le déclencheur `factures_figees` **refuse toute suppression** de facture, et tient même contre la clé de service ;
- la fonction lève « taux de TVA inconnu : il ne sera pas inventé ici », et la contrainte `mention_si_taux_nul` refuse un taux nul sans mention légale.

**Une facture émise deux fois resterait donc en base pour toujours, avec deux numéros.** L'émission reste un geste séparé et délibéré.

Ce qui est déjà juste et n'aura pas à être refait : la numérotation passe par une **ligne** de compteur incrémentée dans la même transaction, pas par une séquence, parce qu'une séquence avance même quand la transaction échoue et laisse des trous. Et la facture est une **photo** : les colonnes `client_*` sont recopiées à l'émission, jamais jointes.

**A CONSTRUIRE**, dans cet ordre : arrêter le taux de TVA avec le comptable, choisir la série de numérotation, rédiger la mention, **puis** écrire un contrôle de doublon avant tout appel à `emettre_facture()`. La vue `mes_factures` existe déjà et n'est appelée par aucun écran : l'écran « Tes factures » sera donc une lecture, pas une construction.

### N.7 Les relances

La mécanique est complète en base et dormante. Rien ne part, et c'est écrit : tant que `RELANCES_JOURS` est vide, aucune relance n'est programmée. **Deux verrous à lever, et le second passe avant le premier** : le calendrier n'est pas arrêté (combien, à quel rythme, sur quel canal), et aucun service d'envoi de courriel n'existe. Une relance programmée aujourd'hui resterait à l'état `prevue` sans jamais partir.

### N.8 La seule promesse fausse de ce chapitre

`app/espace/index.html:1193` écrit, au présent, sous le titre de l'abonnement : « Tu peux arrêter depuis ton espace, sans nous écrire. » `app/aide/index.html:228` le redit.

**Mesure du 15/09/2026 : aucun écran n'appelle `demander_resiliation()` ni `annuler_resiliation()`.** Zéro occurrence dans `app/` et `crm/src/`. Les deux fonctions existent, sont correctes, et sont accordées à `authenticated`. `demander_resiliation()` fait même la chose difficile : elle ne coupe pas un accès déjà réglé, elle pose l'effet au bout de la période.

C'est une infraction directe à la règle 2 de `VOIX.md`, qui impose le gabarit « Pas encore raccordé : la cause en clair » pour toute fonction non branchée. Deux corrections possibles, **la seconde est la bonne** : retirer la phrase, ou **brancher le bouton**, qui coûte un appel `sb.rpc("demander_resiliation")` sur une fonction déjà écrite, déjà accordée, déjà jouée en base.

### N.9 Ce qui reste à faire, dans l'ordre

| # | Geste | Qui | Bloque |
|---|---|---|---|
| 1 | **Trancher le prestataire** (BNP ou autre), ouvrir le compte, créer l'offre à 29,90 euros HT chez lui | Joan et Claire-Marie | tout le reste |
| 2 | **Déployer les trois fonctions de périphérie**, et poser `evenements-paiement` en `verify_jwt = false` : le prestataire ne présente pas de jeton Supabase, il présente sa signature | Joan | l'écran d'abonnement dit « indisponible » au lieu de « pas encore raccordé » |
| 3 | **Relever les chemins de lecture sur un vrai message d'essai**, pas sur une documentation | Joan | la traduction des états |
| 4 | **Confirmer le schéma de signature** du prestataire retenu | Joan | la sécurité de la porte |
| 5 | **Retirer l'un des deux réglages d'essai**, puis brancher `ouvrir_mon_essai()` et la résiliation | technique | une promesse écrite au présent et non tenue |
| 6 | Écrire le contrôle de doublon avant `emettre_facture()`, une fois TVA et série arrêtées | technique, après comptable | les factures |
| 7 | Poser `RELANCES_JOURS`, après le calendrier **et** après le fournisseur de courriel | Claire-Marie puis technique | les relances |
| 8 | **Contrôler avec deux comptes réels** : un artisan ne doit jamais voir les paiements d'un autre. Jamais par lecture du code | technique | la preuve de cloisonnement |

**Le point 2 est le moins cher et le plus visible** : il transforme un mensonge d'écran en information juste, sans qu'aucune décision commerciale soit prise.

---

## O. Les notifications

Deux canaux existent et ne se remplacent pas : la notification **dans le produit**, qui marche, et le **courriel**, qui est écrit et ne part pas.

### O.1 Ce qui marche : la notification dans le produit

`public.notifications`, sept genres en liste fermée : `demande_recue`, `demande_acceptee`, `demande_refusee`, `demande_annulee`, `demande_expiree`, `evaluation_a_deposer`, `evaluation_publiee`.

Elle est écrite par des déclencheurs via `public.notifier()`, en `on conflict do nothing` : rejouer une transition ne double pas la notification. Elle est **lue par un écran** : `app/demandes/index.html`. Chaîne complète, mesurée.

La table ne porte ni `canal`, ni `envoye_le`. C'est cohérent : elle ne décrit que ce qui s'affiche dans le produit. **Le courriel est un autre chemin, et il ne doit pas être greffé sur ces colonnes.**

### O.2 Ce qui est écrit et ne part pas : les huit courriels

`supabase/functions/envoyer-email/`, quatre fichiers, 1 836 lignes : `index.ts` (625, la porte, les contrôles, l'idempotence), `gabarits.ts` (646, les huit modèles), `mise-en-page.ts` (279), `fournisseurs.ts` (286).

| Id | Catégorie | Ligne |
|---|---|---|
| `liste-attente-confirmation` | transactionnel | `gabarits.ts:147` |
| `bienvenue` | **relationnel** | `:207` |
| `demande-recue` | transactionnel | `:266` |
| `demande-acceptee` | transactionnel | `:333` |
| `demande-refusee` | transactionnel | `:395` |
| `message-recu` | transactionnel | `:453` |
| `paiement-echoue` | transactionnel | `:516` |
| `facture-disponible` | transactionnel | `:591` |

La distinction n'est pas décorative : **sept transactionnels, un relationnel**. Le relationnel exige la preuve d'un consentement avant de partir ; les transactionnels sont dus au titre du service demandé.

### O.3 La porte, et pourquoi elle est fermée à clé

`envoyer-email` **n'est pas appelable depuis un navigateur**. La raison est mesurée : la clé publique Supabase est lisible dans le code source de chaque page. Si la fonction se contentait de la vérification de jeton par défaut, n'importe qui la lirait dans `app/inscription/index.html` et ferait partir des courriels signés du domaine. **En un après-midi le domaine serait grillé chez Gmail, et il n'y a pas de retour en arrière.**

La fonction exige donc un secret propre, l'en-tête `x-cle-envoi`, qui ne sort jamais d'un serveur. Tant qu'il n'est pas configuré, elle refuse tout : **jamais de porte ouverte par défaut**.

Deux autres contrôles à l'entrée, faits une fois pour les huit gabarits :

- **les caractères de contrôle sont refusés** (`index.ts:76-90`). Un nom d'expéditeur passe dans l'objet du message ; une valeur qui contient un saut de ligne permet, chez un fournisseur qui assemble les en-têtes lui-même, d'ajouter un `Bcc` de son choix. Mesure du 13/09/2026, sur échantillon adverse ;
- **aucun montant ne peut entrer**, même par un champ mal nommé.

### O.4 Ce qui manque, et le geste qui débloque

| # | Ce qui manque | Conséquence mesurée | Le geste |
|---|---|---|---|
| 1 | **Le fournisseur d'envoi n'est pas choisi** | `FOURNISSEUR_EMAIL` vide vaut `aucun`, qui refuse net | Trancher entre `resend`, `brevo`, `postmark`, `mailjet` (les quatre branchements écrits), ouvrir le compte, poser deux variables |
| 2 | **La fonction n'est pas déployée** | 404 le 15/09/2026, identique au témoin | `supabase functions deploy envoyer-email` |
| 3 | **`public.emails_envoyes` n'existe pas** | le journal des envois est inactif. La fonction envoie quand même et le dit : perdre une ligne de journal ne justifie pas de perdre un courriel | créer la table, puis poser `JOURNAL_BASE=1` |
| 4 | **Le domaine `a-dispo.fr` n'est pas raccordé** | il sert une page de parking OVH. Donc ni SPF, ni DKIM, ni DMARC | accès OVH, à demander à Claire-Marie. `DNS.md`, 227 lignes, dit exactement quoi poser |
| 5 | **Les six textes de consentement ne sont pas en vigueur** | la base **refuse** d'enregistrer un consentement. Le gabarit `bienvenue`, relationnel, ne peut donc pas partir légalement | l'avocat, puis Claire-Marie |
| 6 | **Aucun appelant** | `envoyer-email` apparaît deux fois dans `app/`, **les deux fois en commentaire**. Zéro appel réel | écrire les déclencheurs ou la tâche qui appellent la fonction, une fois 1 et 2 réglés |

**Le point 6 est le plus souvent oublié : brancher un fournisseur ne fait rien partir si personne n'appelle la porte.**

### O.5 Le contrat d'appel, à ne pas réinventer

Il est déjà arrêté et documenté : un POST avec `x-cle-envoi`, un nom de gabarit, une adresse, des données **déjà résolues**, et une clé d'idempotence. **La fonction ne lit aucune table** : c'est l'appelant qui fournit les valeurs. C'est ce qui lui permet de ne dépendre d'aucun schéma, et c'est pourquoi le jeton de confirmation d'inscription ne doit jamais passer par un navigateur.

Quatre états rendus, et aucun silence : en marche (200, l'identifiant du fournisseur), rien à faire (200 `deja_envoye`), erreur (4xx ou 5xx **toujours** avec un champ `geste`), non branché (503). **Un courriel perdu sans bruit ne se rattrape pas.**

**Contrôler sans rien envoyer** : poser `FOURNISSEUR_EMAIL=journal`. Le message rendu part dans les logs, rien ne sort. C'est la bonne recette de première mise en route.

### O.6 A construire

| # | Ce qui sera construit | Prérequis |
|---|---|---|
| 1 | La table `public.emails_envoyes` avec sa clé d'idempotence | aucun, elle peut s'écrire tout de suite |
| 2 | Les appelants : déclencheurs de base ou tâche, un par gabarit transactionnel | fournisseur choisi et fonction déployée |
| 3 | La boucle des relances de paiement | le calendrier `RELANCES_JOURS` |
| 4 | La relance des messages non lus | un délai tranché, aujourd'hui inconnu |
| 5 | Une durée de conservation des `emails_envoyes` et sa purge | la même décision d'avocat que le reste |

Rien de ce qui précède n'exige de réécrire les huit gabarits : ils sont écrits, contrôlés à l'entrée, et rendus en HTML et en texte.

---

## P. La mesure du parcours

> **Ce chapitre corrige une prémisse.** L'audit décrivait les événements comme « en base, et rien ne les écrit ». La mesure faite en production le 15/09/2026 dit autre chose, et la différence change ce qu'il y a à faire.

### P.1 La mesure, avant tout le reste

Interrogation de la production le 15/09/2026, clé publique seule, avec témoin :

| Objet | Réponse | Ce que ça prouve |
|---|---|---|
| `public.evenements` | 404 `PGRST205` | **la table n'existe pas en base** |
| `public.evenement_genres` | 404 `PGRST205` | idem |
| `public.purger_evenements()` | 404 `PGRST202` | **la purge n'existe pas** |
| `public.entonnoir()` | 404 `PGRST202` | **la lecture n'existe pas** |
| une table inventée (témoin) | 404 `PGRST205`, **réponse identique** | le protocole est bon |
| `public.abonnements` (témoin positif) | 200 | une table jouée répond 200 |

**`migration-roles-evenements.sql` (1 035 lignes) n'a jamais été jouée sur le projet.** La formulation juste est donc celle-ci, et elle est plus favorable que l'autre :

- **dans les fichiers**, la mesure est complète : la table, la liste fermée, **huit déclencheurs qui l'écrivent**, la purge, la tâche hebdomadaire et la fonction de lecture ;
- **en base**, rien de tout cela n'existe ;
- **dans les écrans**, personne ne lit : zéro occurrence de `entonnoir` dans `app/` et `crm/src/`.

**Ce n'est pas du travail à écrire. C'est un fichier à jouer, puis un écran à brancher.**

### P.2 Les huit événements à poser, et pas un neuvième

La liste est une **table** et non une contrainte `check`, pour deux raisons : un écran doit pouvoir afficher le libellé français sans le réécrire dans son JavaScript, et l'ordre de l'entonnoir est une donnée, pas une convention tacite.

| Ordre | Code | Porte sur | Écrit par |
|---|---|---|---|
| 10 | `compte.cree` | artisan | `evenements_artisan()` à l'insertion (`:750`) |
| 20 | `parcours.commence` | artisan | quand `etape` quitte `identite` (`:762`) |
| 30 | `parcours.termine` | artisan | `:765` |
| 40 | `fiche.publiee` | artisan | `:771` |
| 50 | `demande.envoyee` | demande | `evenements_demande()` (`:800`) |
| 60 | `demande.acceptee` | demande | `:803` |
| 70 | `conversation.ouverte` | conversation | **deux fois par conversation**, une par artisan (`:838`, `:841`) |
| 80 | `abonnement.ouvert` | abonnement | `evenements_abonnement()` (`:865`) |

Une honnêteté est déjà écrite dans le fichier et doit rester : `abonnement.ouvert` tombe aujourd'hui **à la même seconde** que `parcours.termine`, puisque le déclencheur ouvre l'essai à la fin du parcours. Les deux se sépareront le jour où le paiement sera branché. **Un entonnoir qui montre deux étapes superposées et ne le dit pas fait croire à une conversion de 100 %.**

### P.3 Ce qu'il ne faut PAS poser, et c'est la partie qui compte

Le RGPD impose la minimisation. Une stratégie qui ratisse large est une dette juridique : chaque champ collecté doit être justifié au registre, porté par une base légale, purgé à une date, et rendu dans l'export de l'article 15. **Ce qui n'existe pas ne fuite pas, ne s'exporte pas et ne se justifie pas.**

**La table fait quatre colonnes, et pas une de plus** : `quand`, `genre`, `sujet_id`, `objet_id`.

| À ne jamais poser | Pourquoi |
|---|---|
| Adresse IP, même tronquée | donnée personnelle directe. Rien dans l'entonnoir n'en a besoin |
| Empreinte de navigateur, agent utilisateur, résolution | traceur au sens de l'article 82, donc bandeau, donc perte de la moitié de la mesure |
| Identifiant de session ou de visite | permet de recomposer un parcours horodaté individuel |
| Référent, adresse d'origine, paramètres de campagne | peut porter le nom d'une entreprise ou un identifiant d'annonce |
| Le **contenu** : métier, commune, montant, texte d'un message | la mesure devient une seconde base métier, avec ses propres droits à tenir |
| Un événement par clic, par vue d'écran, par défilement | la table grossit sans limite, et rien de ce volume ne répond à une question posée |
| Un genre libre, non déclaré | un genre inventé par une page rend la série incomparable d'un trimestre à l'autre |

Trois règles structurelles qui tiennent cette discipline, déjà écrites :

1. **Aucune politique d'écriture, pour personne**, pas même pour un administrateur. La vérification tient en une requête : `select count(*) from pg_policies where tablename = 'evenements' and cmd <> 'SELECT'` doit rendre 0. *Une mesure qu'une page peut écrire est une mesure qu'une page peut fabriquer.*
2. **Aucune clé étrangère vers `artisans`.** Une cascade effacerait la mesure au moment où un compte disparaît, et l'entonnoir du trimestre passé se réécrirait tout seul, à la baisse. Effet secondaire exactement conforme au RGPD : à l'instant où le compte de connexion est supprimé, l'identifiant ne désigne plus personne et **la ligne devient anonyme sans qu'aucune tâche n'ait à passer**.
3. **Un événement ne se compte qu'une fois** : index unique `(genre, sujet_id, objet_id) nulls not distinct`. Sans le `nulls not distinct`, republier sa fiche quatre fois compterait quatre artisans.

Le genre est fermé par clé étrangère : **un genre inventé est refusé par la base, pas par une relecture**.

### P.4 La conservation : 730 jours

Réglage `evenements_conservation_jours` = 730, soit 24 mois. Justification écrite : deux saisons complètes pour comparer une année à l'autre, et en deçà des 25 mois que la CNIL recommande pour la mesure d'audience.

La durée vit dans `reglages`, pas dans le code. `purger_evenements()` rend le nombre de lignes effacées, **pour qu'une tâche silencieuse reste vérifiable**. La tâche est hebdomadaire, le lundi à 3 h 30 UTC : la durée se compte en années, pas en heures.

**Sans pg_cron, cette durée n'est qu'une phrase dans un commentaire.**

### P.5 La lecture : une fonction, jamais une vue

`public.entonnoir()`. Le choix est une doctrine : une **vue** rendrait des zéros à un compte qui n'a pas le droit de lire, et **un tableau de bord qui affiche zéro là où il ne sait pas est un tableau de bord qui ment**. La fonction **refuse** (`42501`), comme `chiffres_back_office()`.

Elle rend **trois nombres par étape**, parce qu'un seul mentirait : `comptes` (combien de comptes distincts ont franchi l'étape), `objets` (combien de lignes distinctes, nul quand l'étape ne porte que sur un compte), `evenements` (le total brut, qui n'est égal aux précédents que par hasard). Sur `conversation.ouverte`, `comptes` vaut jusqu'à deux fois `objets`. C'est dit dans le fichier plutôt que découvert six mois plus tard.

La lecture est réservée à `est_commercial()` : c'est le travail du commercial de savoir qui a ouvert un compte sans finir son parcours, pour le rappeler.

### P.6 Aucun traceur, et ce n'est pas un oubli

`app/assets/consentement.js:81` : `var TRACEURS = [];`

Mesure du 13/09/2026, refaite le 15/09/2026 : le dépôt ne charge **aucun** traceur. Recherche sur gtag, google-analytics, googletagmanager, plausible, matomo, umami, hotjar, posthog, fbq, clarity, mixpanel, segment, doubleclick : zéro occurrence dans du code de page.

Trois écritures locales seulement, toutes exemptées de consentement par l'article 82 de la loi du 6 janvier 1978 : la session Supabase, et deux préférences d'outils internes qui ne sortent jamais du navigateur.

**Conséquence tenue dans le code** : tant que `TRACEURS` est vide, le fichier ne dessine rien. Pas de bandeau, pas de bouton, pas une ligne de mémoire écrite. **Un bandeau qui demande le consentement pour rien fait fuir, habitue à cliquer sans lire, et n'a aucune valeur juridique le jour où il en faudrait une.**

`/legal` attend toujours « outil de mesure d'audience retenu, et sa configuration ». **La réponse la plus solide est : aucun.** L'entonnoir en base répond aux questions qui décident sans déposer quoi que ce soit chez le visiteur, donc sans bandeau, donc sans biais de consentement.

**Un défaut à corriger avant tout traceur** : seule `/mes-donnees` charge `consentement.js`. Le jour où un traceur arrive, le bandeau n'apparaîtrait que sur cette page, et pas sur la vitrine où il est le plus nécessaire. **A CONSTRUIRE : ajouter la ligne de script à `/accueil`, `/inscription` et `/legal` avant tout traceur.**

### P.7 À construire

| # | Ce qui sera construit | Effort | Ce que ça débloque |
|---|---|---|---|
| 1 | **Jouer `migration-roles-evenements.sql`** sur le projet, avec le jeton personnel `sbp_` | une commande | la table, les 8 déclencheurs, la purge, la tâche, `entonnoir()` et `est_commercial()` |
| 2 | Re-mesurer après coup en base | dix secondes | le nombre en base ne se vérifie **qu'en base** |
| 3 | **Rejouer le fichier une seconde fois** : les déclencheurs sur `demandes`, `conversations` et `abonnements` sont posés sous garde d'existence de table | une commande | les événements 50 à 80, qui sinon ne s'écrivent pas |
| 4 | **Brancher un écran sur `entonnoir()`** : huit lignes, trois nombres. Le CRM est le bon endroit, pas le produit | un écran de lecture | la seule mesure du parcours que le projet aura |
| 5 | Inscrire la mesure au **registre des traitements** | rédaction | l'obligation de l'article 30 |
| 6 | Trancher : un commercial doit-il voir les fiches d'artisan ? Aujourd'hui **non** | décision | ouvrir `artisans` au commerce, c'est ouvrir le SIRET et le téléphone de toutes les entreprises inscrites. Cela ne se décide pas dans un fichier de migration, et surtout pas en silence |

**Le point 1 est le meilleur rapport de ce chapitre : une commande rend vivantes 1 035 lignes déjà écrites, déjà relues, et déjà payées.**

---

## Q. Données personnelles

### Q.1 Ce qui est construit, et qui tourne

Contrairement à la plupart des projets à ce stade, le socle RGPD n'est pas une intention : il est en base et il est appelé par un écran.

| Droit | Fonction | Écran | État |
|---|---|---|---|
| Accès et portabilité | `mes_donnees_personnelles()` (`migration-messagerie-rgpd.sql:1119`) | `/mes-donnees` | **en service** |
| Effacement | `supprimer_mon_compte(p_confirmation)` (`:1324`) | `/mes-donnees` | **en service, partiel** |
| Rectification, limitation, opposition | `deposer_demande_rgpd(p_genre, p_detail)` (`:1426`) | `/mes-donnees` | **déposé, jamais relu** |
| Preuve du consentement | `consentements` et `consentement_textes` | `/mes-donnees` | **construit, inutilisable** |
| Traceurs | `app/assets/consentement.js`, 428 lignes | `/mes-donnees` | **construit, liste vide, ne dessine rien** |
| Délai légal | `demandes_rgpd.echeance_le`, défaut `now() + interval '1 month'` | - | en base, **rien ne le surveille** |

Trois choix méritent d'être gardés tels quels.

**Effacer ce qui n'appartient qu'à la personne, anonymiser ce qui appartient aussi à un autre** (`:1267-1306`). La suppression efface la fiche, les atouts, les créneaux, les agendas et leurs jetons, les blocages, les consentements et la ligne de liste d'attente ; elle anonymise les messages, les signalements et les conversations, **pour que le confrère en face garde son fil entier**. Et l'anonymisation se fait maintenant, pas au moment où quelqu'un supprimera le compte de connexion à la main.

**Le retrait d'un consentement ne supprime pas la ligne.** On pose une date de retrait. Effacer la ligne détruirait la preuve que le traitement passé était licite.

**Aucune adresse IP n'est conservée comme preuve de consentement**, avec le motif écrit : collecter une donnée personnelle de plus pour protéger une donnée personnelle n'est pas une protection. Point à confirmer avec l'avocat, et le fichier le dit.

### Q.2 Les mentions manquantes, recomptées

`A-FOURNIR.md` dénombre 52 éléments sur 5 pages, dont 35 sur `/legal`. **Ce relevé a été fait sur un autre dépôt.** Contre-mesure du 15/09/2026 sur le dépôt de référence : `app/legal/index.html` porte **39 marqueurs affichés**, qui se réduisent à **35 intitulés distincts** (quatre reviennent deux fois : raison sociale, adresse du siège, prestataire de paiement retenu, adresse électronique de contact). `app/messages/index.html` porte **6 marqueurs affichés** pour **5 intitulés distincts**. Les deux comptages concordent.

**Le `README.md` annonce « 52 marqueurs » : c'est un chiffre repris de l'autre dépôt, à corriger.** Et l'outil qui tenait la liste à jour n'existe plus dans ce dépôt (chapitre X).

Le choix d'afficher ces marqueurs **en clair, à l'écran, à l'endroit exact où l'information manque** est bon et doit être gardé : personne ne peut publier une mention fausse sans l'avoir vue passer.

### Q.3 Ce qui bloque une mise en ligne publique

Les éléments ne pèsent pas le même poids. Trié par ce qui empêche réellement d'ouvrir au public.

#### Bloquant absolu : la page n'existe pas légalement sans ces 11 lignes

Article 6 III de la loi pour la confiance dans l'économie numérique, et articles 13 et 14 du RGPD.

| # | Mention | Marqueur |
|---|---|---|
| 1 | raison sociale | `legal:554`, `:613` |
| 2 | forme juridique et capital social | `:555` |
| 3 | adresse du siège | `:556`, `:614` |
| 4 | SIRET | `:558` |
| 5 | numéro RCS et ville du greffe | `:559` |
| 6 | numéro de TVA, ou mention d'exonération | `:560` |
| 7 | adresse électronique de contact | `:561`, `:869` |
| 8 | numéro de téléphone | `:562` |
| 9 | directeur de publication | `:571` |
| 10 | hébergeur du site | `:574` |
| 11 | hébergeur de la base, **et son pays** | `:576` |

#### Bloquant RGPD : sans elles, aucune information des personnes n'est valable

| # | Mention | Marqueur |
|---|---|---|
| 15 | adresse électronique dédiée aux données personnelles | `legal:615` |
| 16 | délégué à la protection des données, ou constat qu'il n'est pas obligatoire | `:617` |
| 18 | durées de conservation, poste par poste | `:671` |
| 20 | liste des sous-traitants, leur rôle, leur pays | `:679` |
| 21 | transferts hors Union européenne, et leur encadrement | `:681` |
| - | durée de conservation des messages | `messages:694` |

**Et le point le plus dur, qui n'est dans aucune des deux listes.** Les six textes de consentement sont **tous** marqués `[A COMPLETER]` et **tous** `en_vigueur = false` (`cgu`, `fiche_publique`, `partage_coordonnees`, `messagerie`, `prospection`, `mesure_audience`). Or `consentements` porte une clé étrangère vers `(finalite, version)` de cette table. **Tant qu'aucun texte n'est en vigueur, aucun consentement ne peut être recueilli de façon opposable.** Un artisan qui publie sa fiche aujourd'hui consentirait à un texte qui dit `[A COMPLETER]`. C'est le blocage le plus structurel du bloc RGPD, et **il se lève par un travail d'avocat, pas de code**.

#### Bloquant contractuel : sans elles, on ne peut pas encaisser

| # | Mention | Marqueur |
|---|---|---|
| 17 | prestataire de paiement retenu | `legal:661`, `:840` |
| 22 | numéro de version des conditions, à horodater à l'acceptation | `:741` |
| 28 | prix de l'abonnement, des options, remise annuelle | `:825` |
| 29 | régime de TVA applicable à l'abonnement | `:828` |
| 30 | durée de la période d'essai et conditions de sortie | `:836` |
| 31 | taux des pénalités de retard et indemnité forfaitaire | `:846` |
| 32 | durée d'engagement, préavis, remboursement | `:857` |
| 34 | droit applicable et tribunal compétent | `:879` |

Le prix est arrêté. **Il reste à l'écrire à un seul endroit du côté technique : chez le prestataire de paiement, sous la référence de l'offre.** Dans les pages, il s'écrit partout de la même façon (voir L.4), et `legal:824` doit cesser d'affirmer le contraire.

#### Non bloquant pour ouvrir, bloquant pour tenir

Les mentions restantes de `/legal` (marque INPI, assureur, contrat-type de sous-traitance, règles de modération des avis, procédure de suspension, médiateur de la consommation, outil de mesure d'audience) n'empêchent pas techniquement l'ouverture, mais elles engagent : **le contrat-type de sous-traitance est la pièce qui matérialise la position juridique du produit**, sous-traitance entre entreprises indépendantes et jamais du prêt de main d'oeuvre.

Les 12 éléments des trois documents autonomes (`/deck-investisseur`, `/aides`, `/statuts`) **ne bloquent rien** : aucune page du produit n'y mène.

### Q.4 Ce qui manque en plus de A-FOURNIR.md

Quatre trous mesurés dans le code, qu'aucune liste de mentions ne couvre.

**1. Une demande RGPD déposée n'est visible nulle part.** Le back-office lit sept tables (`artisans`, `demandes`, `journal`, `metiers`, `pieces`, `profils`, `signalements`). **`demandes_rgpd` n'en fait pas partie.** Un artisan peut donc déposer une demande de rectification, la base l'enregistre avec une échéance à un mois, l'index `demandes_rgpd_a_traiter_idx` est même posé pour la retrouver, **et aucun écran ne l'affiche à personne**. Le délai de l'article 12.3 court sans que quiconque le sache. **A CONSTRUIRE, et c'est le premier geste du bloc.**

**2. L'export ne contient ni les factures ni les abonnements.** Dit par le code lui-même (`app/mes-donnees/index.html:51-53`). Le droit d'accès les couvre pourtant. **A CONSTRUIRE.**

**3. La suppression laisse le compte de connexion.** `supprimer_mon_compte` efface et anonymise tout, puis inscrit au journal « Reste à supprimer le compte de connexion avec la clé de service » et laisse l'état à `en_cours`. C'est honnête, et c'est la bonne façon de le dire. Mais **rien ne rappelle que le geste est dû** : voir le point 1.

**4. Aucune purge automatique.** Les trois tâches planifiées sont l'expiration des demandes, la publication des notes et le marquage des pièces périmées. **Aucune purge de données.** Le fichier RGPD le nomme : la durée de conservation des messages n'est pas arrêtée, donc la purge n'est pas écrite, « écrire une purge sur une durée inventée serait pire que pas de purge ». C'est juste. **Il faut donc trancher la durée avant d'écrire le code**, et la mention #18 de `/legal` est le même travail.

### Q.5 Une contradiction à corriger dans le code

`app/mes-donnees/index.html:59-62` affirme : « /assets/consentement.js n'est copié dans `dist/` par aucune étape du build (mesure du 13/09/2026 : ni build.py ni cloudflare_adispo.py ne touchent à assets/) ».

**Mesure du 15/09/2026 : `outils/construire.mjs:84-87` copie bien `app/assets` vers `dist/assets`, `dist/assets/consentement.js` existe, et les deux outils cités n'existent pas dans ce dépôt.** Le commentaire est un relevé périmé d'une autre chaîne de construction. **Il faut le corriger : un commentaire faux fait chercher au mauvais endroit, et c'est précisément le reproche que le projet fait aux autres.**

---

## R. Sécurité

### R.1 Méthode et périmètre

Cet audit a été fait **sur les fichiers**, par lecture et comptage, et par **rejeu simulé** des quatorze migrations pour savoir quelles politiques survivent aux `drop` des fichiers suivants. Quelques appels anonymes ont été faits en production, et ils sont signalés comme tels. Ce que cet audit ne peut pas prouver est listé en R.8, **et il faut le lire avant de conclure quoi que ce soit**.

### R.2 La chasse aux politiques trop larges

Recherche de toute politique vivante dont la condition vaut littéralement `true`. **Six trouvées.** Chacune a été jugée sur ce qu'elle expose réellement.

| Table | Condition | Verdict |
|---|---|---|
| `communes` | `select` à `anon` | **légitime** : référentiel public |
| `metiers` | `select` sur `actif` | **légitime**, et même pas `true` |
| `consentement_textes` | `select` à `anon` | **légitime** : ce sont des textes juridiques, ils doivent être lisibles avant de consentir |
| `evenement_genres` | `select` | **légitime** : liste fermée de libellés |
| `abonnement_etats` | `select` | **légitime** : liste fermée d'états |
| `reglages` | `select` | **acceptable, à surveiller** : la table ne contient aucun prix, et le commentaire de la table l'impose. **Le jour où une clé sensible y entre, cette politique la publie à tout inscrit** |
| `inscriptions` | `insert` à `anon` | **nécessaire et non protégé** : voir R.6.3 |

**Aucune politique de lecture trop large sur une table de données personnelles.** Les trois candidates historiques sont fermées : `contacts` (14/09, par le rôle commercial), `profils` (14/09, `id = auth.uid() or public.est_actif()`), `inscriptions` en lecture (14/09, la politique `using (true)` est explicitement supprimée).

### R.3 Les clés

| Contrôle | Résultat |
|---|---|
| Jetons dans le code source des pages | 10 fichiers, 10 jetons, **10 sur 10 portent `"role":"anon"`** |
| Occurrence d'une clé de service dans `app/`, `crm/`, `outils/` | **zéro** |
| Mentions de `service_role` dans le dépôt | 2, toutes deux dans des commentaires côté serveur |
| Secrets exclus de git | `.gitignore:25` exclut `.env*`, `:12-14` excluent `crm/contacts.json` et `supabase/seed.sql` |

**Rien à signaler sur les clés.** Un effet de bord mesuré, en revanche : `supabase/functions/.env.example`, qui ne contient aucun secret mais documente les variables attendues, est **présent sur le disque et absent de git**, parce que `.gitignore:25` exclut `.env*`. **Un clone neuf ne saura donc pas quelles variables poser.** Le fichier le signale lui-même et renvoie la décision à Joan : modifier la règle d'exclusion d'un dépôt n'est pas une décision de code.

### R.4 Les fonctions `security definer` et leur `search_path`

Une fonction `security definer` sans `set search_path` s'exécute avec les droits de son propriétaire **et** résout les noms de tables selon le chemin de l'appelant. Qui peut créer un schéma peut alors lui faire lire la mauvaise table.

| Mesure | Valeur |
|---|---|
| Fonctions déclarées | 97 déclarations, 93 noms distincts |
| Dont `security definer` | 89 déclarations, **85 fonctions distinctes** |
| **Sans `set search_path`** | **1** |

**La fonction en cause : `public.contacts_avant_ecriture()`, `supabase/migrations/schema.sql:29-36`.** C'est un déclencheur sur `public.contacts`, la table des 1 374 contacts de prospection. Toutes les 84 autres portent `set search_path = public`.

La portée réelle est étroite : le corps ne nomme aucune table, il ne fait qu'écrire `new.updated_at` et `new.updated_by_id`, et il appelle `auth.uid()`, qui est qualifié. **Le risque est théorique aujourd'hui. Il ne le restera pas** : c'est la seule fonction du projet qui dérogerait à la règle le jour où son corps grossira.

**Correctif : une ligne**, `set search_path = public` à ajouter à `schema.sql:30`.

### R.5 La fuite du 14/09 est fermée

La fuite du 14/09/2026 (lecture ouverte de `public.profils`, onze profils rendus avec le jeton d'un artisan d'essai, dont l'information de qui est administrateur) est fermée par `migration-cloison-profils.sql`. Vérifié ligne à ligne : la politique ouverte est supprimée, la politique cloisonnée la remplace, la table porte un commentaire d'avertissement, et une fonction de contrôle est accordée au seul `service_role`. **Rien à redire sur le correctif.**

### R.6 En voici trois autres

#### R.6.1 La fuite se rouvre toute seule si on rejoue le mauvais fichier

Décrit en J.5.1. **Gravité : haute.** Rejouer `schema.sql` sur la production rouvre les 1 374 fiches de prospection à tout compte connecté, **en lecture et en mise à jour**, sans qu'aucune erreur ne soit levée. C'est exactement le mécanisme de la fuite du 14/09, et il est toujours armé.

**Correctif.** Numéroter les migrations, et généraliser la fonction de contrôle des politiques `true` à **toutes** les tables, à jouer après chaque migration.

#### R.6.2 Le SIRET est déclaré par le navigateur, et la base le croit

Le module de vérification est sérieux. Mais **c'est le navigateur qui écrit le verdict** : `siret`, `siret_etat = 'valide'` et `siret_verifie_le` partent dans `public.artisans` par la politique « sa fiche », qui ouvre toutes les colonnes de sa propre ligne au propriétaire.

Aucune garde en base : pas de déclencheur sur ces colonnes (`artisans_moderation` ne gèle que la suspension, et l'écrit : « LE PROPRIETAIRE. Il fait ce qu'il veut de sa fiche, sauf de sa modération »), pas de contrainte liant `publie = true` à `siret_etat = 'valide'`, et pour seule contrainte un format à quatorze chiffres.

**Trois lignes dans la console d'un navigateur connecté suffisent donc à publier une fiche portant un SIRET inventé.**

**Pourquoi c'est grave ici et pas ailleurs.** Tout le reste du projet applique la règle inverse, et la documente : `messages_avant_envoi` réécrit l'auteur depuis la session (« L'auteur n'est jamais celui que le navigateur prétend »), `evaluations_avant_insert` dérive l'auteur et la cible de la demande, la politique de dépôt des pièces impose `etat = 'deposee'`. **Le SIRET est le seul endroit où la base fait confiance à la page**, et c'est celui sur lequel repose la promesse juridique du produit : « Chaque fiche est rattachée à un SIRET. Pas de SIRET, pas de fiche » (`accueil:1068`), « Il faut un compte vérifié au SIRET pour demander une mise en relation » (`artisan:869`), et `aide:208`.

**Circonstance atténuante, mesurée.** La vue publique `fiches_publiques` n'expose ni `siret` ni `siret_etat` : aucun visiteur ne voit aujourd'hui un badge « vérifié » calculé sur cette donnée. Le badge vert de `accueil:778` est une maquette statique, pas un affichage de base. **La promesse est donc vraie dans le parcours normal, fausse contre quelqu'un qui ouvre la console.**

**Correctif : A CONSTRUIRE.** Déplacer la vérification dans une fonction de périphérie qui appelle l'annuaire côté serveur et écrit `siret_etat` avec la clé de service, puis ajouter un déclencheur qui gèle `siret`, `siret_etat`, `denomination`, `activite` et `siret_verifie_le` contre toute écriture portant une session, sur le modèle exact de `profils_protege_admin`. **Compter une journée.**

#### R.6.3 La liste d'attente est ouverte à l'écriture anonyme, sans garde-fou

`inscription publique` accorde l'insertion à `anon` avec la condition `true`. **C'est nécessaire** : c'est un formulaire d'inscription publique, et le fichier assume le choix d'écrire directement depuis le navigateur plutôt que d'ajouter un serveur intermédiaire.

Ce qui protège la table : la lecture est fermée au commerce, l'unicité de l'adresse est portée par un index, le format des champs est contraint, et le jeton de confirmation ne revient jamais au navigateur.

Ce qui ne protège pas la table : **rien ne limite le débit.** Aucun déclencheur, aucun plafond, aucun captcha. Un script peut donc remplir la table d'adresses plausibles et distinctes. **Le compteur d'inscrits, qui est précisément la donnée sur laquelle se décide le territoire de lancement, deviendrait faux.**

Le projet sait faire : `plafond_messages_par_heure()` pose 30 messages par heure sur la messagerie. Le même motif s'applique ici.

**Gravité : moyenne.** Ce n'est pas une fuite de données, c'est une atteinte à la fiabilité du seul chiffre qui sert à décider. **A CONSTRUIRE avant l'ouverture publique.**

### R.7 Les fonctions de périphérie et les en-têtes

| Fonction | Garde | Verdict |
|---|---|---|
| `evenements-paiement` | signature HMAC vérifiée, **refus total si le secret n'est pas configuré**, horodatage contrôlé, comparaison à temps constant, plusieurs signatures acceptées pour la rotation de secret | **bien fait**. Rien n'est enregistré quand la signature ne passe pas |
| `ouvrir-paiement` | origine vérifiée, jamais `*`, lecture de l'abonnement faite **avec le jeton de l'artisan** et non avec la clé de service | **bien fait** |
| `envoyer-email` | secret d'appel en en-tête, comparaison à temps constant, **refuse tout si le secret est absent**, hôtes autorisés dans les liens | **bien fait**, et explicitement non appelable depuis un navigateur |

Les trois appliquent la même règle : **pas de secret, pas de service.** C'est le bon défaut, et c'est rare.

`app/public/_headers` pose quatre en-têtes sur tout le site : `X-Robots-Tag`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.

| En-tête absent | Ce qu'il protégerait | Difficulté |
|---|---|---|
| `Content-Security-Policy` | l'injection de script. Les pages chargent Supabase depuis `cdn.jsdelivr.net` et appellent `recherche-entreprises.api.gouv.fr` : une politique fermée à ces deux origines est écrivable en une ligne | faible, mais à tester écran par écran |
| `Strict-Transport-Security` | la première visite en clair | triviale |
| `Permissions-Policy` | caméra, micro, géolocalisation, dont aucun écran n'a besoin | triviale |

**Sur l'échappement.** Les sept écrans qui affichent de la donnée venue d'un autre utilisateur portent tous une fonction `echapper`. Les cinq qui n'en ont pas n'affichent aucune donnée d'autrui. Le nombre d'usages de `innerHTML` reste élevé (47 sur `/admin`, 32 sur `/espace`, 258 au total) : **chacun n'a pas été vérifié un par un**, et c'est noté en R.8. Une politique de sécurité du contenu réduirait la portée de toute erreur restante, et c'est l'argument principal pour la poser.

### R.8 Ce qui n'a pas pu être vérifié

À compter à part. Tant que ces sept points ne sont pas relevés, **cet audit vaut pour les fichiers, pas pour la production**.

1. **Aucune requête SQL jouée sur un PostgreSQL vivant.** Les comptages de politiques viennent d'un rejeu simulé, pas de `pg_policies`.
2. **Aucune session ouverte sur le site en ligne.** Le contrôle qui compte, « avec le jeton d'un artisan ordinaire, `select count(*) from profils` rend 1 », n'a pas été refait.
3. **Les réglages du tableau de bord Supabase n'ont pas été lus** : inscription libre, confirmation d'adresse, durée de jeton, longueur minimale de mot de passe, limitation des tentatives.
4. **La présence de `pg_cron` n'a pas été vérifiée aujourd'hui.** Elle était absente le 14/09. Sans elle, les tâches d'entretien ne partent jamais, **et rien ne lève d'erreur**.
5. **L'état réel des secrets** (`CLE_ENVOI`, `PAIEMENT_SECRET_EVENEMENTS`) n'a pas été relevé.
6. **On ne sait pas si `migration-cloison-profils.sql` a été joué en production.** On sait que `migration-roles-evenements.sql` ne l'a pas été (chapitre P).
7. **Les 258 usages de `innerHTML`** n'ont pas été relus un par un.

### R.9 Les gestes, par ordre

| # | Geste | Pourquoi maintenant | Coût |
|---|---|---|---|
| 1 | **Corriger les trois `revoke` faibles** des tâches d'entretien (voir Y.3), puis re-mesurer par un appel anonyme | défaut de sécurité mesuré en production | 15 minutes |
| 2 | Jouer `controle_cloison_profils()` et `controle_cloison_crm()` sur la production | seul moyen de savoir si la fuite du 14/09 est fermée **en base** et pas seulement dans un fichier | 10 minutes |
| 3 | Numéroter les migrations et généraliser le contrôle des politiques `true` | R.6.1 : le piège est armé | 1 heure |
| 4 | Ajouter `set search_path = public` à `schema.sql:30` | R.4, une ligne | 5 minutes |
| 5 | Geler `siret_etat` contre toute écriture portant une session, et déplacer la vérification côté serveur | R.6.2 : c'est la promesse juridique du produit | 1 jour |
| 6 | Plafonner les insertions anonymes dans `inscriptions` | R.6.3, avant l'ouverture publique | 2 heures |
| 7 | Installer `pg_cron` et vérifier par `controle_taches()` | quatre traitements dorment en silence | 30 minutes |
| 8 | Poser `Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy` | R.7 | 2 heures avec les tests |
| 9 | Second facteur sur le compte administrateur | c'est le compte qui lit le journal, les signalements et 1 374 fiches | à arbitrer |

---

## S. API

> **Il n'y a pas d'API maison, et c'est une décision, pas un manque.** La surface d'accès est PostgREST, engendrée par Supabase à partir du schéma, plus trois fonctions de périphérie.

### S.1 Les trois surfaces, et une seule règle

| Surface | Adresse | Qui peut l'atteindre |
|---|---|---|
| Tables et vues | `/rest/v1/<table>` | Tout porteur de la clé publique. **Ce qui sort est décidé par les politiques de sécurité par ligne** |
| Fonctions | `/rest/v1/rpc/<fonction>` | Les rôles à qui la fonction a été accordée |
| Périphérie | `/functions/v1/<fonction>` | Selon la fonction : jeton d'artisan, signature du prestataire, ou secret propre |

La règle unique : **la clé publique est lisible dans le source de chaque page.** Elle n'ouvre donc rien par elle-même. Un contrôle écrit dans un écran est un confort d'affichage, jamais une sécurité.

### S.2 Les fonctions réellement appelées par le produit

**18 fonctions distinctes, 22 points d'appel.**

| Fonction | Appelée depuis | Ce qu'elle garantit côté serveur |
|---|---|---|
| `ma_fiche()` | `espace:2578`, `mes-donnees:1849` | Crée la fiche au premier passage et la rend, en une fois. Deux onglets ouverts ne créent pas deux lignes : c'est la base qui tranche |
| `reglage(p_cle)` | `espace:1183` | La durée de l'essai vient de la base, pas d'une phrase écrite à la main |
| `chercher_commune(...)` | `recherche:1005`, `demandes:1290` | Seule porte vers `communes`. Ouverte à `anon` |
| `rechercher_confreres(...)` | `recherche:1112` | Filtre par métier, dates, position et rayon. **Écrit aussi la ligne dans `recherches`**, y compris quand le résultat est vide |
| `etat_recherche()` | `recherche:942` | Dit si la recherche est utilisable, plutôt que de rendre un écran vide |
| `est_publie(p_artisan)` | `demandes:995` | |
| `peut_demander(p_artisan)` | `artisan:891`, `demandes:963` | Délègue à `acces_artisan()` |
| `coordonnees_confrere(p_demande)` | `demandes:1513` | Compare `auth.uid()` aux deux bouts puis exige `etat = 'acceptee'` |
| `mes_conversations()` | `messages:1647`, `:2063` | |
| `mes_messages_non_lus()` | `messages:102` | La pastille, servie par `messages_non_lus_idx` |
| `ouvrir_conversation(p_demande)` | `messages:2003` | Refuse s'il n'y a pas de demande acceptée. **Une conversation n'est jamais libre, elle est adossée à un chantier** |
| `marquer_lu(p_conversation)` | `messages:1776` | |
| `mes_donnees_personnelles()` | `mes-donnees:919` | L'export RGPD, en une fonction |
| `deposer_demande_rgpd(...)` | `mes-donnees:1561` | Pose l'échéance d'un mois de l'article 12.3 |
| `supprimer_mon_compte(...)` | `mes-donnees:1724` | **Exige le mot `SUPPRIMER` en clair** |
| `chiffres_back_office()` | `admin:546`, `crm/src/app.js:1073` | Le seul appel RPC du CRM |
| `moderer_fiche(...)` | `admin:713` | |
| `est_admin()` | `admin:1259` | Affichage seulement |

Le CRM n'utilise **pas** le client Supabase : il parle à PostgREST en `fetch` direct, y compris pour l'authentification.

### S.3 Les trois points d'entrée de périphérie

| Adresse | Méthodes | Qui | Refus attendu |
|---|---|---|---|
| `/functions/v1/ouvrir-paiement` | `GET`, `POST`, `OPTIONS` | un artisan connecté, jeton vérifié | **503 avec la liste complète de ce qui manque** si le prestataire n'est pas branché. 405 sur toute autre méthode |
| `/functions/v1/evenements-paiement` | `POST`, `OPTIONS` | le prestataire, de serveur à serveur | **Signature vérifiée sur le corps brut.** Sans secret, refus de tout. 200 avec `deja_vu` sur un renvoi |
| `/functions/v1/envoyer-email` | `POST`, `GET` (contrôle, aperçu) | **jamais un navigateur** : en-tête `x-cle-envoi` | Tant que le secret n'est pas posé, refus de tout |

Les trois rendent **quatre états, jamais un silence** : en marche, rien à faire, non branché (503 avec ce qui manque), erreur (toujours avec un champ `geste` qui dit ce qu'un humain doit faire). **Les trois sont absentes du projet à ce jour (404).**

### S.4 Les fonctions qui existent sans appelant

#### Ouvertes au navigateur, jamais appelées : 10

| Fonction | Ce qu'elle ferait | Ce qu'il manque |
|---|---|---|
| `ouvrir_mon_essai()` | Ouvre l'essai, une seule fois dans la vie du compte | Rien, côté base. **Attention : elle lit `essai_mois`, l'autre chemin lit `essai_jours`** |
| `demander_resiliation(p_motif)` | Pose la demande et la date d'effet, sans couper un accès déjà réglé | Un bouton dans `/espace` |
| `annuler_resiliation()` | Annule la demande | Idem |
| `confirmer_inscription(p_jeton)` | Confirme une inscription à la liste d'attente | L'écran de retour, et le courriel qui porte le jeton |
| `mon_code_parrainage()` | Rend, ou crée, le code de l'artisan | Tout le parcours de parrainage |
| `enregistrer_parrainage(p_code)` | Rattache un filleul | Idem |
| `mes_parrainages()` | La liste de ses filleuls et leur état | Idem |
| `definir_role(p_compte, p_role)` | Change le rôle d'un compte | Un écran dans `/admin`. **Sans lui, un rôle se change à la main dans le tableau de bord** |
| `entonnoir()` | Le tunnel de conversion | Un écran, et la migration jouée |
| `role_courant()` | Rend le rôle de la session | |

#### Réservées au serveur, jamais appelées : 8

`emettre_facture()`, `prochain_rang_facture()`, `reserver_relances()`, `marquer_relance_envoyee()`, `annuler_relances()`, `valider_parrainage()`, `purger_evenements()`, et **`inviter_evaluations()`** qui n'a même pas de planification.

S'y ajoutent **6 fonctions de contrôle** à jouer à la main : `controle_cloison_crm()`, `controle_cloison_profils()`, `controle_essai()`, `controle_roles()`, `controle_taches()`, plus `chiffres_back_office()` qui, elle, est appelée.

#### Et 8 gabarits de courriel sans appelant

Aucune ligne, nulle part dans le dépôt, n'appelle `envoyer-email`.

### S.5 A CONSTRUIRE

| Point d'entrée | Ce qu'il faudra | Ordre |
|---|---|---|
| **Le dépôt de pièces** | Un écran qui téléverse dans le compartiment `pieces` (chemin préfixé par l'identifiant du compte) puis insère la ligne. Les politiques, le compartiment et le contrôle existent | 1. Coût le plus faible, valeur immédiate |
| **L'essai et la résiliation** | Brancher `ouvrir_mon_essai()`, `demander_resiliation()`, `annuler_resiliation()`, **après avoir retiré l'un des deux réglages d'essai** | 2 |
| **Les 8 courriels** | Choisir le fournisseur, poser `CLE_ENVOI`, puis appeler `envoyer-email` depuis les 8 endroits qui le justifient | 3. Un produit muet perd ses inscrits |
| **Le parrainage** | Les quatre fonctions, plus l'arbitrage de la récompense | 4 |
| **La facture** | `emettre_facture()` et le dépôt du PDF, puis la vue `mes_factures` dans un écran | 5. Après le prestataire |
| **Les rôles** | Un écran pour `definir_role()` | 6 |
| **Les six `revoke` manquants** | Six lignes, puis un `grant` explicite pour les trois que les politiques utilisent | à faire avec R.9.1 |

---

## T. UX et UI

### T.1 Le graphe de navigation, relevé et non supposé

Comptage des `href` littéraux dans les douze écrans. **Un écran que rien ne cite n'existe pas pour l'utilisateur.**

| Écran | Nombre d'écrans qui y mènent |
|---|---|
| `/connexion`, `/espace`, `/aide` | 7 |
| `/`, `/demandes`, `/messages`, `/mes-donnees`, `/recherche` | 6 |
| `/inscription` | 1 (accueil) |
| `/artisan` | **0 lien littéral**, atteint en JavaScript (`recherche:534`) |
| `/admin` | **0**, saisie directe, session administrateur : voulu |
| `/legal` | **0** : **défaut** |

**Deux conclusions.** `/legal` est orphelin et porte 39 marqueurs : à raccorder par un pied de page commun, ce qui est aussi une obligation légale. Et la mesure par `href` littéral ne voit pas les liens construits en JavaScript : le contrôle réel appartient à une recette de bout en bout, pas à ce document.

### T.2 Les quatre états de chaque écran

Le produit tient une règle rare et il faut la garder : **aucun écran blanc**. Chaque état a son texte.

| État | Comment il se dit | Exemple |
|---|---|---|
| Chargement | classe `.chargement`, sur 7 écrans sur 12 | `espace:239` |
| Vide | classe `.vide`, sur 9 écrans sur 12 | `messages`, `demandes`, `recherche` |
| Refus de droit | un écran qui nomme la cause, jamais un code | CRM `app.js:1490-1493` : « Ton compte ne lit pas les inscrits. Ce n'est pas la page qui décide, c'est la règle d'accès : cacher un bouton ne changerait rien » |
| Non raccordé | un **seul** dialogue pour toutes les fonctions non branchées, qui dit ce qui ne marche pas, pourquoi en clair, et ce qu'on peut faire à la place | `espace:520-539` |

Le dialogue de raccordement est le bon motif et il n'existe **qu'une fois** sur douze écrans. Les onze autres n'ont pas de manière commune de dire « pas encore ». **À unifier.**

### T.3 Le geste, mesuré

Cible tactile minimale de 44 px, comptée en nombre de règles CSS qui la posent :

| Écran | Règles | Écran | Règles |
|---|---|---|---|
| espace | 20 | recherche | 9 |
| messages | 15 | accueil | 8 |
| mes-donnees | 13 | admin | 6 |
| demandes | 10 | legal | 4 |
| artisan | 9 | connexion | 3 |
| | | **aide** | **0** |
| | | **inscription** | **0** |

`aide` et `inscription` ne posent aucune cible tactile. **`inscription` est le seul écran de conversion du site public, et `aide` est la page la plus lue.**

L'agenda de `/espace` est le meilleur exemple du produit et mérite d'être la référence : il sélectionne **une plage**, montre la conséquence chiffrée, et un seul bouton l'écrit. La vue **change** avec la largeur au lieu de se comprimer : liste des trois prochaines semaines sous 860 px, grille du mois au-dessus, bilan à côté à 1 100.

### T.4 Le mouvement et l'accessibilité

`prefers-reduced-motion` est respecté sur **10 écrans sur 12**. Manquent `aide` et `inscription`, les deux mêmes.

| Écran | aria-live | role | aria-label | focus-visible |
|---|---|---|---|---|
| espace | 6 | 5 | 17 | 18 |
| messages | 4 | 12 | 15 | 13 |
| mes-donnees | 4 | 14 | 8 | 11 |
| legal | 4 | 4 | 2 | 3 |
| recherche | 3 | 0 | 8 | 11 |
| artisan | 1 | 3 | 8 | 8 |
| demandes | 1 | 0 | 6 | 10 |
| connexion | 1 | 2 | 0 | 3 |
| **accueil** | **0** | 8 | 6 | **2** |
| **admin** | **0** | **0** | 4 | 4 |
| **aide** | **0** | **0** | 1 | 1 |
| **inscription** | **0** | **0** | **0** | 1 |

Deux constats. `accueil`, avec 549 lignes de CSS, ne pose que **2** règles de focus visible : c'est le seul écran qu'un visiteur non connecté voit, et c'est le moins navigable au clavier. Et **aucun écran ne porte de lien d'évitement** : 0 sur 12. Sur un écran à menu latéral de cinq entrées, un utilisateur au clavier retraverse tout le menu à chaque page.

### T.5 La voix, vérifiée contre ses propres règles

| Règle de `VOIX.md` | Mesure | Verdict |
|---|---|---|
| 21. Zéro tiret cadratin ni demi-cadratin, partout, commentaires compris | 0 occurrence sur les 12 écrans et les 4 fichiers du CRM | **tenue** |
| 5. Tutoiement partout | 2 069 marques de tutoiement contre 30 « vous ». Les « vous » restants sont concentrés sur `aide` (8), `messages` (7), `demandes` (5) | à finir, écran par écran |
| 6. La navigation et les titres emploient la deuxième personne | tenue par onze écrans. `app/admin/index.html:348` dit encore « Mon espace » | à corriger, une ligne |
| 1. Tout chiffre affiché égale ce que le produit mesure, sauf mention d'exemple dans le même bloc | la mention existe et est unique | **tenue** |
| 2. Une fonction non branchée ne s'écrit jamais au présent | **cassée trois fois** : le courriel de `/inscription`, la résiliation de `/espace` et de `/aide` | à corriger |
| 13. Le prix, une fois arrêté, s'écrit partout de la même façon | 3 écrans le portent, 5 disent encore qu'il n'existe pas | **cassée**, voir L.4 |

### T.6 Les six corrections à faire avant tout ajout

Rangées par coût croissant, toutes vérifiables.

1. **Le prix** : une seule phrase, au même endroit, sur les huit écrans concernés. `aide` se contredit dans la même page.
2. **Le pied de page commun** avec `/legal`, `/aide` et la version des conditions : règle une orpheline et une obligation légale.
3. **Le lien d'évitement** sur les douze écrans : une ligne de HTML et quatre de CSS.
4. **`aide` et `inscription`** : cibles tactiles à 44 px et respect de `prefers-reduced-motion`, comme les dix autres.
5. **Le focus visible sur `accueil`** : la page d'entrée doit être la mieux traitée, pas la moins.
6. **Le dialogue « pas encore raccordé »** sorti de `espace` et rendu commun aux douze écrans.

---

## U. Le design system

> Relevé dans `app/espace/index.html:55-101`, le bloc qui fait référence. **Tous les ratios de ce chapitre ont été recalculés par la formule WCAG 2.1 le 15/09/2026, sur les valeurs réellement présentes dans le code**, et non repris des commentaires.

### U.1 Le fait qui commande ce chapitre

Les commentaires du code décrivent une **charte ambre sur bleu nuit**. Le code applique une **charte rouge sur encre chaude**. Les noms des variables sont restés, les valeurs ont changé, **les mesures écrites à côté n'ont pas été refaites**.

Trois chartes successives sont documentées dans le projet (la mémoire `dispo-charte-officielle.md` en fixe une quatrième, bleu nuit et ambre, titres en Signika et texte en Karla, relevée le 05/09/2026) et **une seule est appliquée**. Seul le code fait foi.

### U.2 Les couleurs, avec leur contraste mesuré

Les quatre fonds, du plus clair au plus foncé : carte `#FEFCF8`, sol `#F8F4EC`, champ `#EEEBE3`, puits `#EAE6DC`.

| Jeton | Valeur | Rôle |
|---|---|---|
| `--bg` | `#F8F4EC` | le sol, la page |
| `--bg-2` | `#FEFCF8` | la carte posée dessus |
| `--surface` | `#EEEBE3` | les champs, les étiquettes, les cases du calendrier |
| `--surface-2` | `#EAE6DC` | le puits |

#### Encres, mesurées sur les quatre fonds

| Jeton | Valeur | carte | sol | champ | puits | Verdict |
|---|---|---|---|---|---|---|
| `--cream` | `#191512` | **17,71** | 16,54 | 15,23 | 14,56 | AAA partout |
| `--cream-mut` | `#5E5A56` | **6,67** | 6,23 | 5,74 | 5,48 | AA partout |
| `--cream-dim` | `#686561` | **5,66** | 5,28 | 4,87 | 4,65 | AA partout, marge faible au puits |
| `--vert` | `#116B40` | **6,40** | 5,98 | 5,51 | 5,26 | AA partout |
| `--alerte` | `#9A3208` | **7,23** | 6,76 | 6,22 | 5,95 | AA partout |
| `--accent-texte` | `#890026` | **9,80** | 9,15 | 8,43 | 8,06 | AAA partout |

Les commentaires du code annoncent pour ces six jetons : 18,46 / 8,94 / 6,18 / 6,87 / 6,25. **Cinq sur six sont faux.** Aucun n'est faux dans le sens dangereux (rien ne passe sous 4,5), **mais un chiffre faux dans un commentaire finit par être cité comme vrai**.

#### L'accent, et la règle qui le gouverne

| Jeton | Valeur | Emploi |
|---|---|---|
| `--accent` | `#E12154` | **remplissage uniquement** |
| `--accent-2` | `#C41A47` | survol, bas de dégradé |
| `--accent-soft` | `rgba(225,33,84,.13)` | voile d'étiquette et d'état |
| `--accent-texte` | `#890026` | l'accent quand il doit être une lettre, un trait ou un focus |

| Paire | Ratio | Seuil | Verdict |
|---|---|---|---|
| `#E12154` en **lettre** sur le sol | **4,21** | 4,5 | **échoue**, d'où la règle |
| `#E12154` en **aplat** sur le sol | 4,21 | 3,0 | passe |
| `#890026` en lettre sur le sol | 9,15 | 4,5 | AAA |
| **blanc sur `#E12154`** | **4,62** | 4,5 | passe de justesse |
| blanc sur `#C41A47` (survol) | 5,86 | 4,5 | passe |
| `--encre #191512` sur `#E12154` | **3,93** | 4,5 | **échouerait** |
| encre sur `--accent-soft` posé sur carte | 14,55 | 4,5 | AAA |

**Le commentaire « l'encre posée sur un aplat de couleur, 10,06 sur l'ambre » est faux pour ce rouge** : l'encre sur `#E12154` vaut 3,93. Le code ne commet pas l'erreur, il écrit `color:#fff` (32 fois, mesuré). **Mais le jeton `--encre` déclaré pour cet usage ne peut pas servir à cet usage**, et il est déclaré sans être utilisé sur 7 écrans sur 12. Les commentaires de `espace:390` et `:445` annoncent 10,06 pour des règles qui rendent 4,62.

**Décision à acter** : soit `--encre` devient `#FFFFFF` et les 32 `color:#fff` passent par lui, soit `--accent` s'assombrit jusqu'à porter l'encre. **4,62 pour du texte gras de 16 px est une marge de 0,12 : une retouche de teinte la fait tomber.**

#### Le reste

| Jeton | Valeur | Mesure |
|---|---|---|
| `--agenda-fond` | `#DCD7CC` | le seul aplat neutre qui accepte l'encre : **12,65** (commentaire : 12,23) |
| `--line` | `#D8D4CC` | 1,44 sur la carte : un filet, pas un contour de composant |

**Le vocabulaire est périmé dans les douze écrans** : ils parlent d'ambre dans leurs commentaires, 13 à 27 occurrences par fichier, **162 au total**, pour décrire un rouge. Le mot ne désigne plus rien du produit.

### U.3 Les mesures et la typographie

| Jeton | Valeur | Emploi |
|---|---|---|
| `--gut` | `clamp(1.1rem,4.5vw,3rem)` | la gouttière, fluide |
| `--t1` | `clamp(27px,5.4vw,36px)` | le titre, et le seul grand chiffre |
| `--t2` | `20px` | intertitres, mot-marque |
| `--t3` | `16px` | corps, champs, bouton plein |
| `--t4` | `14px` | secondaire, libellés, onglets |
| `--t5` | `12.5px` | aide, légende, étiquettes |
| `--t6` | `11px` | micro : dates, compteurs, demi-journées |

Trois familles, chargées par un seul appel : **Space Grotesk** pour les titres et la marque, **DM Sans** pour le corps, **JetBrains Mono** pour les chiffres et les dates.

| Mesure | Chiffre |
|---|---|
| Tailles posées **par une variable**, 12 écrans | **146** |
| Tailles posées **en dur** | **323** |
| Valeurs distinctes en dur | **30**, de 8 px à 24 px, dont `12.5px` 45 fois, `13.5px` 34 fois, `14.5px` 17 fois |

L'échelle à six pas est tenue sur `espace` seul (63 usages par variable contre 14 en dur). Sur les onze autres écrans, **elle est déclarée et contournée**. Neuf valeurs entre 13 et 17 px que l'oeil ne sépare pas sont neuf décisions non coordonnées.

**Et l'échelle est trouée** : `var(--t5)` est utilisé sur `/recherche`, `/artisan`, `/demandes`, `/mes-donnees` et `/messages` sans être défini dans ces pages, et `var(--t4)` sur `/connexion`. **Six déclarations `font-size` invalides**, toutes sur la classe `.nav-note`.

### U.4 Les ombres, et les rayons qui manquent

| Jeton | Valeur |
|---|---|
| `--ombre-1` | `0 1px 2px rgba(25,21,18,.05)` |
| `--ombre-2` | `0 4px 12px rgba(25,21,18,.08), 0 1px 3px rgba(25,21,18,.05)` |
| `--ombre-3` | `0 16px 40px rgba(25,21,18,.14), 0 3px 8px rgba(25,21,18,.07)` |

**Il n'existe aucun jeton de rayon dans l'application.** Les rayons sont écrits en dur, et ils divergent : 10, 12, 14, 16, 18 px et `999px` cohabitent dans `espace` seul. Le CRM, lui, a ce système (`--r`, `--r-sm`, `--r-lg`, `--r-pill`). De même, **aucun jeton d'espacement** et **aucun jeton de durée ou de courbe** dans l'application. **A CONSTRUIRE : quatre jetons, repris du CRM.**

### U.5 Les composants réellement présents

Dans combien des douze écrans le sélecteur existe :

| Composant | Écrans | Référence |
|---|---|---|
| **État** (`.etat`) | 10 / 12 | `espace:231-237` |
| **Vide** (`.vide`) | 9 / 12 | motif commun, style local |
| **Bouton** | 9 / 12 | `espace:176-190` |
| **Carte** | 8 / 12 | `espace:219-229` |
| **Chargement** | 7 / 12 | `espace:239` |
| **Champ** | 7 / 12 | `espace:152-175` |
| **Coquille** | 6 / 12 | `espace:464-518` |
| **Navigation à pastilles** | 6 / 12 | `espace:438-449` |
| **Onglets** | 4 / 12 | `espace:242-266` |
| **Étiquette effaçable**, **lien-bouton**, **bouton rond** | 3 / 12 | |
| **Dialogue** (`dialog.raccord`) | **1 / 12** | `espace:520-539` |
| **Jauge** | **1 / 12** | `espace:299-302` |
| **Agenda** | **1 / 12** | `espace:275-436` |

Trois règles d'emploi tenues et à garder, toutes mesurées :

1. **Jamais d'opacité pour éteindre.** Une demi-opacité fait tomber même l'encre à 3,49 sur ce papier. Les états éteints emploient des couleurs mesurées.
2. **La couleur ne porte jamais seule l'information.** La demi-journée occupée venue d'un agenda externe porte un aplat neutre **et** une hachure **et** un libellé.
3. **Un seul bouton plein par écran.**

### U.6 Ce qui manque, et le chantier qu'il ouvre

#### Le manque structurel : il n'y a pas de fichier

**Le design system n'existe pas comme artefact.** Aucun écran ne charge de feuille de style : le seul `<link rel="stylesheet">` des douze fragments pointe vers Google Fonts. Les **4 106 lignes de CSS** sont recopiées dans douze blocs `<style>`, et le bloc `:root` est dupliqué douze fois.

| Écart mesuré | Détail |
|---|---|
| Nombre de jetons dans `:root` | de **8** (`inscription`) à **30** (`accueil`), contre 28 pour `espace` |
| **La police du corps** | `accueil` charge **Karla**, les onze autres **DM Sans**. Et il déclare `font-family:'Signika'` deux fois, **une police que son `<link>` ne charge pas** : elle se rend en Karla ou en Arial Black |
| Jetons déclarés jamais utilisés | 26 cas, dont `--ombre-3` sur 7 écrans, `--encre` sur 7, `--agenda-fond` sur 6 |
| Couleurs en dur hors `:root` | `accueil` pose `background:#1A2740`, **un bleu nuit de l'ancienne charte** ; `connexion` pose `color:#1F1F1F` ; `legal` recopie cinq valeurs de jetons |
| Points de rupture | **17 valeurs distinctes** : 400, 420, 430, 460, 470, 520, 559, 560, 600, 640, 700, 720, 760, 800, 899, 900, 1100 px. Aucun système |
| **Une variable mal nommée** | `--cream` vaut `#191512`, **qui est l'encre, pas la crème**. La crème est portée par `--bg`. Vrai dans 12 pages sur 13 |

#### Le second système, celui du CRM

`crm/src/styles.css` porte **429 règles** et son propre `:root`. Il partage les primitives de couleur mais diverge sur tout le reste :

| Point | Application | CRM |
|---|---|---|
| Nom de l'encre | `--cream` | `--encre` |
| Niveaux d'encre | trois couleurs opaques | `rgba` à trois opacités (6,37 / 5,22 / **2,79**) |
| Typographie | Space Grotesk plus DM Sans | police système, marque en **Bricolage Grotesque** |
| Rayons, courbe | aucun jeton | `--r`, `--r-sm`, `--r-lg`, `--r-pill`, `--ease` |
| Couleurs de sens | vert, alerte | vert, rouge, jaune, bleu, occupé |
| Verre et voile | aucun | `--verre`, `--flou`, `--voile` |
| `--accent-texte` | défini à `#890026` | **appelé 25 fois, jamais défini** : 41 variables dans son `:root`, celle-ci n'en fait pas partie |

`--encre-faint` vaut **2,79 sur le sol** : sous 4,5 et sous 3,0. Le commentaire du fichier le dit et cadre son emploi (« ne porte jamais d'information : séparateurs et textes de substitution seulement »). **C'est acceptable tant que la règle tient, et c'est à écrire dans le système plutôt que dans un commentaire.**

Le commentaire de `crm/src/styles.css:23-27` annonce pour l'accent « 7,18:1 sur le sol et 8,11:1 en blanc sur aplat, AAA dans les deux sens » : **ces chiffres décrivent un bleu remplacé depuis par le rouge.** Mesuré : **4,21** et **4,62**, ni l'un ni l'autre AAA.

Les sept teintes de statut du CRM ont été remesurées sur le sol actuel : 5,69 / 5,92 / 4,89 / 4,67 / 5,04 / 5,08 / 4,78. **Toutes AA.** Les valeurs annoncées dans le commentaire ont été prises sur l'ancien sol `#F2F1EE` : périmées mais conservatrices.

#### Les composants manquants

| Composant | État |
|---|---|
| Pastille ou badge d'état commun | A CONSTRUIRE : le CRM a `.pill`, l'application bricole à chaque écran |
| Notification passagère | A CONSTRUIRE : le CRM a `.toast`, l'application n'en a aucune |
| Dialogue de confirmation | A CONSTRUIRE : le seul `dialog` du produit sert à dire « pas encore raccordé » |
| Tableau | A CONSTRUIRE : seul le CRM en a un |
| Infobulle | A CONSTRUIRE : aucune, dans les deux interfaces |
| Jetons de rayon, d'espacement, de durée | A CONSTRUIRE dans l'application, à reprendre du CRM |
| Lien d'évitement | A CONSTRUIRE : 0 sur 12 écrans |

#### L'ordre de travail proposé

1. **Remesurer et réécrire les commentaires du bloc `:root`.** Cinq chiffres sur six sont faux dans les douze écrans. Zéro risque, gain immédiat de confiance.
2. **Trancher `--encre` sur l'aplat rouge** (3,93 aujourd'hui, contre 4,62 pour le blanc écrit en dur 32 fois).
3. **Sortir le bloc `:root` et les composants communs dans un fichier unique**, injecté par `construire.mjs` comme l'en-tête l'est déjà : la mécanique existe, il suffit d'un cinquième repère.
4. **Aligner `accueil`** sur DM Sans, ou acter Karla pour tout le monde. Et retirer `Signika`, qui n'est pas chargée.
5. **Définir `--accent-texte` dans le CRM**, et `--t5` / `--t4` là où ils sont utilisés.
6. **Renommer `--cream`**, qui porte l'encre.
7. **Ajouter les rayons, l'espacement et la courbe**, repris du CRM.
8. **Ramener 17 points de rupture à quatre**, choisis sur le contenu et non sur des appareils.

---

## V. Référencement

### V.1 Ce qui est : le site refuse la visite, et ce n'est pas un oubli

Le produit n'est pas mal référencé. Il est **fermé aux robots, volontairement, sur trois barrières**, toutes vérifiées en ligne le 15/09/2026.

| # | Barrière | Source | Ce qui est servi |
|---|---|---|---|
| 1 | Refus de **visite** | `app/public/robots.txt` | `User-agent: *` puis `Disallow: /` |
| 2 | En-tête HTTP | `app/public/_headers` | `x-robots-tag: noindex, nofollow, noarchive, nosnippet` |
| 3 | Balise de page | `outils/construire.mjs`, gabarit `enveloppe()` | `<meta name="robots" ...>` sur **13 pages sur 13** |

L'étagement est raisonné : un `X-Robots-Tag: noindex` laisse un robot poli **lire** chaque page et n'arrête aucun robot d'entraînement ; seul `Disallow: /` demande de ne pas venir. Et `robots.txt` ne nomme aucun chemin, **parce que lister `/crm` reviendrait à l'annoncer**.

**Une quatrième barrière, non écrite mais réelle :** aucun des 13 titres d'onglet ne contient le mot « dispo ». Les titres valent « Accueil », « Connexion », « Ton espace », « Liste d'attente ».

### V.2 Pourquoi, et jusqu'à quand

La marque n'est pas déposée à l'INPI, et le nom voisin est surveillé. **Re-mesuré le 15/09/2026**, `dig +short adispo.fr NS` rend `obs.ns1.fr.`, `ns2.observatoiredesmarques.fr.`, `ns3.nameshield.net.` : les serveurs de noms d'`adispo.fr` sont ceux d'un service de surveillance de marques, chez un registrar de protection de marques. **C'est le profil d'un titulaire qui formerait opposition à un dépôt.** Le fait a été établi le 02/09/2026 et il est encore vrai treize jours plus tard.

Le coût de la levée : 190 euros pour une classe, 40 euros par classe supplémentaire, soit environ **270 euros pour les trois classes visées** (9 logiciel, 35 mise en relation, 42 SaaS). Le SME Fund 2026 rembourse jusqu'à 75 % des taxes, plafond 700 euros, **à demander avant de payer**. L'étude prévient que le vrai poste n'est pas la taxe mais le conseil : « Dispo » est descriptif, donc faible.

**Tant que ce dépôt n'est pas fait, les trois barrières restent.**

### V.3 Ce qui manquera de toute façon le jour où elles tomberont

| Élément | Présent |
|---|---|
| `<html lang="fr">` | **13 / 13** |
| `<title>` non vide | **13 / 13** (un à trois mots) |
| `rel="canonical"` | **0 / 13** |
| `<meta name="description">` | **0 / 13** |
| `property="og:*"` | **0 / 13** |
| `application/ld+json` | **0 / 13** |
| `sitemap.xml` | absent |

Aucun partage de lien ne produira donc d'aperçu : ni titre lisible, ni résumé, ni image.

**Le piège le plus coûteux, mesuré :** `wrangler.jsonc` pose `"not_found_handling": "single-page-application"`. `/cette-page-n-existe-pas` rend **200 et 109 254 octets**, exactement le poids de `dist/index.html`. **Toute adresse inventée rend la page d'accueil avec un code 200.** Aujourd'hui c'est sans effet, puisque personne ne vient. **Le jour du dépôt, c'est une usine à doublons**, et un `rel="canonical"` absent ne le corrige pas. C'est aussi, dès aujourd'hui, ce qui fait qu'un lien mort ne produit aucune trace exploitable.

### V.4 A CONSTRUIRE : ce qu'on fera le jour du dépôt, dans l'ordre

**Étape 0, préalable non technique.** Le dépôt INPI sera enregistré et son numéro connu. Il alimentera la mention de `/legal` qui l'attend. **Aucune barrière ne tombera avant.**

**Étape 1, décider page par page.** Sur 13 pages, **5 seulement** ont quelque chose à gagner à être visitées.

| Page | Après le dépôt | Pourquoi |
|---|---|---|
| `/` | ouverte | la page publique du produit |
| `/aide` | ouverte | 25 questions et leurs réponses, c'est du contenu de recherche |
| `/legal` | ouverte | obligation d'accessibilité des mentions |
| `/inscription` | ouverte | la liste d'attente est la conversion |
| `/artisan` | ouverte, sous conditions | `fiches_publiques` est déjà lisible sans session et n'expose ni nom, ni téléphone, ni SIRET. **Indexable et cohérent avec le droit** |
| les 8 autres | fermées | écrans de session ; `/crm` porte la prospection, `/admin` le back-office |

**Étape 2, `robots.txt`.** Le `Disallow: /` sera remplacé par un refus nommé sur les huit chemins fermés, plus un `Sitemap:`. Le compromis s'inverse : à l'ouverture, laisser un robot parcourir `/crm` coûte plus qu'en révéler l'existence. **La seule protection réelle du CRM restera la connexion par compte.**

**Étape 3, `_headers`.** Le `X-Robots-Tag` global disparaîtra du bloc `/*` et sera reposé, bloc par bloc, sur les huit chemins fermés. Les trois autres en-têtes ne bougent pas.

**Étape 4, `construire.mjs`.** Trois changements dans un seul fichier, ce qui est l'intérêt d'avoir un gabarit unique : la balise `robots` deviendra conditionnelle, pilotée par un champ `indexable` ajouté à chaque entrée de `ECRANS` ; la table portera un `description` d'environ 150 signes et un `titreLong` qui nommera enfin la marque ; le gabarit émettra `rel="canonical"`, les quatre balises `og:` utiles et `twitter:card`.

**Étape 5, le plan du site.** `construire.mjs` écrira `dist/sitemap.xml` depuis la même table, filtrée sur `indexable`. **Le plan se déduit de la source de vérité, il ne se tient pas à la main.**

**Étape 6, supprimer le faux 200.** `not_found_handling` passera à `404-page`. **Sans cette étape, les étapes 2 à 5 ne servent à rien** : un moteur trouvera toujours la page d'accueil derrière n'importe quelle adresse.

**Étape 7, le nom de domaine.** Une adresse de travail n'est pas une adresse de marque, et le `canonical` doit pointer sur le domaine définitif. **Le choix du domaine est un préalable à l'étape 4, pas une finition.**

**Étape 8, une donnée structurée, une seule.** Un bloc `Organization` sur `/` et `FAQPage` sur `/aide`. Rien d'autre : `LocalBusiness` et `Service` décriraient un produit qui n'a pas encore d'artisans inscrits.

**Étape 9, contrôler.** L'ouverture se vérifie, elle ne se suppose pas. Un script relira le site en ligne et échouera si une page fermée devient visitable, ou si une page ouverte perd son `canonical`.

### V.5 Ce qui ne changera pas, même après le dépôt

Le vocabulaire. **Le référencement ne sera pas une raison d'écrire « trouver du personnel » pour capter une requête** : l'article L8241-1 vaut jusqu'à 150 000 euros pour une personne morale, et une page bien classée sur le mauvais mot est un risque, pas un actif.

### V.6 Non vérifié

- Aucune mesure d'outil de référencement (Search Console, Lighthouse SEO) : le site refuse la visite, ces outils n'auraient rien à lire.
- Le titulaire de `a-dispo.fr` n'a pas été établi : seuls ses serveurs de noms ont été relevés (OVH).
- Le nombre de `<h1>` par page a été compté (jusqu'à 9 sur `/espace`) mais **les pages n'ont pas été exécutées** : on ne sait pas combien sont visibles en même temps.

---

## W. Performance

> Relevé le 15/09/2026, sur `dist/` construit à 20 h 37 et sur le déploiement en ligne. **Aucun chiffre de Lighthouse n'apparaît dans ce chapitre : aucun n'a été relevé.**

### W.1 Méthode

Trois mesures distinctes : le poids sur disque (`wc -c`), le poids transféré (`curl` avec brotli contre le worker, **le seul qui compte pour un visiteur**), et le poids des tiers.

Vérification préalable : la page d'accueil en ligne fait **109 254 octets, exactement comme `dist/index.html`**, et `cmp` les déclare identiques. **La chaîne de construction tourne bien à chaque poussée**, et mesurer `dist/` revient à mesurer le site.

### W.2 Poids de chaque page

| Page | Sur disque | Transféré (brotli) | Rapport |
|---|---:|---:|---:|
| `/` | 109 254 o | **27 454 o** | 4,0 |
| `/connexion` | 26 690 o | 11 256 o | 2,4 |
| `/inscription` | 17 534 o | 7 499 o | 2,3 |
| `/aide` | 20 973 o | 8 651 o | 2,4 |
| `/legal` | 73 295 o | 25 616 o | 2,9 |
| `/admin` | 67 247 o | 20 507 o | 3,3 |
| `/artisan` | 62 994 o | 21 788 o | 2,9 |
| `/recherche` | 78 735 o | 26 964 o | 2,9 |
| `/demandes` | 105 866 o | 34 833 o | 3,0 |
| `/mes-donnees` | 109 190 o | 36 493 o | 3,0 |
| `/messages` | 124 726 o | 39 822 o | 3,1 |
| `/espace` | **143 783 o** | **44 760 o** | 3,2 |
| `/crm` | **187 892 o** | **55 055 o** | 3,4 |
| **Total 13 pages** | **1 128 179 o** | **360 698 o** | 3,1 |

Le reste de `dist/` : `assets/consentement.js` 19 713 o, dix vignettes QR pour 11 718 o, `favicon.svg` 336 o, `icone-app.svg` 343 o, `robots.txt` 631 o, `_headers` 232 o.

La compression brotli est active côté Cloudflare. **Elle n'est pas configurée dans le dépôt : elle vient du worker.**

### W.3 De quoi ces octets sont faits

Chaque page est **autonome** : tout le CSS et tout le JS sont en ligne dans le document.

| Page | CSS | JS | HTML |
|---|---:|---:|---:|
| `/` | 40 528 o | 4 133 o | **64 142 o** |
| `/espace` | 36 537 o | **98 407 o** | 8 383 o |
| `/messages` | 32 558 o | 77 525 o | 14 229 o |
| `/mes-donnees` | 23 989 o | 72 323 o | 12 124 o |
| `/demandes` | 25 826 o | 67 847 o | 11 810 o |
| `/crm` | 50 130 o | **122 632 o** | 14 379 o |
| `/legal` | 23 444 o | 11 459 o | 37 464 o |

Deux profils opposés, et les deux s'expliquent. **L'accueil est du HTML**, 64 Ko, parce qu'il porte **47 SVG en ligne** : aucune image n'est téléchargée, aucune requête ne part. **Les écrans d'application sont du JS**, jusqu'à 98 Ko sur `/espace`, parce qu'ils portent tout le parcours.

**Ce que cette autonomie coûte.** Comparaison des règles CSS des 12 pages du produit : 1 225 règles distinctes au total, et **une seule** est présente dans au moins 11 pages sur 12. **Le CSS n'est pas dupliqué, il est différent partout.** Il n'y a rien à factoriser dans un fichier commun sans réécrire les douze feuilles d'abord. Aucune économie de cache n'est disponible à court terme, et la promettre serait faux.

### W.4 Les polices : trois piles typographiques pour treize pages

C'est le poste le plus lourd du produit, et le seul où une décision déjà prise n'est pas appliquée.

Aucune page ne porte de `@font-face` local (0 sur 13). Les 13 pages vont chercher leurs polices chez Google. **Et elles ne demandent pas la même chose :**

| Requête | Pages | Poids des woff2 latin |
|---|---|---:|
| Space Grotesk + **DM Sans** + JetBrains Mono 400;600 | 11 écrans du produit | 90 640 o en 3 fichiers |
| Space Grotesk + **Karla** + JetBrains Mono 500 | **`/` seule** | 68 460 o en 3 fichiers |
| **Bricolage Grotesque** 700;800 | **`/crm` seule** | 41 236 o en 1 fichier |

La charte arrête **Space Grotesk et DM Sans**. Karla et Bricolage Grotesque ne sont pas dans la charte, **et la page d'accueil est justement celle qui n'applique pas la charte**.

**Le coût, mesuré :** un visiteur qui arrive sur `/` puis clique vers `/connexion` télécharge les polices **deux fois**. Sur les quatre fichiers demandés par les deux pages, **un seul est commun** : Space Grotesk, 22 320 o. Le trajet `/` puis `/espace` coûte donc **136 780 octets de polices** là où une pile unique en coûterait 90 640, une fois. **46 140 octets jetés au premier clic, sur chaque visiteur, sur chaque appareil.**

Autre gaspillage : `/connexion` charge JetBrains Mono (31 340 o) et ne l'utilise jamais.

### W.5 Le tiers logiciel : supabase-js

Huit pages chargent la bibliothèque par import dynamique. `/crm` ne la charge pas : il parle en REST direct.

| Module | Transféré (brotli) |
|---|---:|
| `supabase-js` | 4 985 o |
| `auth-js@2.116.0` | 26 556 o |
| `storage-js@2.116.0` | 13 236 o |
| `realtime-js@2.116.0` | 10 766 o |
| `postgrest-js@2.116.0` | 5 908 o |
| `functions-js`, `tslib`, `iceberg-js` | 8 228 o |
| **Total** | **69 679 o en 8 requêtes** |

Non compressé, la même chaîne pèse 240 749 octets.

**Le vrai sujet n'est pas le poids, c'est la version.** `@2` n'est pas une version, c'est une famille. Au moment de la mesure elle résout vers **2.116.0**. Demain elle résoudra vers autre chose, **sans qu'aucune ligne du dépôt change et sans qu'aucun contrôle ne le voie**. Huit écrans du produit dépendent d'un fichier dont personne ne choisit le contenu.

### W.6 Requêtes par page, première visite

| Page | Requêtes |
|---|---:|
| `/` | **6** |
| `/aide`, `/inscription`, `/legal` | **6** |
| `/connexion`, `/espace`, `/recherche`, `/artisan`, `/demandes`, `/messages`, `/admin` | **14** |
| `/mes-donnees` | **15** |
| `/crm` | **4** |

Première visite sur `/espace`, en partant de rien : **206 351 octets en 14 requêtes**, dont **160 255 octets de tiers, soit 78 %**. **Le produit lui-même pèse moins d'un quart de sa propre page.**

### W.7 Ce qui coûte pour rien, et qui se corrige

**1. Un aller-retour par clic, sur 97 liens.** Le worker renvoie un **307** vers l'adresse avec barre finale. Compté dans `dist/` : **115 liens internes, dont 0 avec barre finale**. Dix-huit pointent sur `/` et ne redirigent pas, donc **97 liens coûtent chacun un aller-retour de plus**. Correction : écrire les `href` avec la barre finale. Aucun effet de bord.

**2. Un cache d'un an sur un fichier sans empreinte.** `_headers` pose `Cache-Control: public, max-age=31536000, immutable` sur `/assets/*`, vérifié en ligne sur `consentement.js`. Or le fichier n'a pas d'empreinte de contenu dans son nom. **Le jour où le texte de consentement change, les visiteurs déjà venus garderont l'ancien pendant un an**, sans aucun signal. **Sur un fichier de consentement, c'est un problème de conformité avant d'être un problème de cache.**

**3. Une échelle typographique trouée.** Six déclarations `font-size` invalides sur `.nav-note`, plus 25 usages de `--accent-texte` non défini dans `/crm`. Coût en octets : nul. Coût visuel : réel.

**4. Une variable mal nommée.** `--cream` vaut `#191512` dans 12 pages sur 13. Rien ne casse, mais **toute relecture de la charte trébuche dessus**.

**5. Un fichier étranger dans le dossier servi.** `dist/_banc/aujourdhui.html`, 143 301 octets, horodaté 21 h 40, soit **après** la construction de 20 h 37. Il n'est **pas** en ligne aujourd'hui. `construire.mjs` efface `dist/` avant chaque construction, donc `npm run deploy` l'emporterait. **Mais un `wrangler deploy` seul, sans construction, le publierait.**

### W.8 Ce qui est déjà bon, et qu'il ne faut pas défaire

- **Zéro image sur l'accueil.** 47 SVG en ligne, aucune requête d'image, aucun décalage de mise en page à l'arrivée.
- **Brotli actif**, rapport 4,0 sur la page d'accueil.
- **`preconnect` posé** vers `fonts.googleapis.com` et `fonts.gstatic.com` sur les 13 pages.
- **Tous les scripts sont différés** : 8 `type="module"`, 1 `defer`, aucun script bloquant.
- **Un seul en-tête, écrit une fois.** Les gains de ce chapitre se posent à un seul endroit pour les 13 pages : **c'est ce qui rend la correction bon marché.**

### W.9 A CONSTRUIRE : le budget à tenir

Aucun budget n'existe aujourd'hui. Il sera écrit dans le contrôle décrit au chapitre X, et il échouera au dépassement.

| Ce qui est mesuré | Plafond proposé | Où on en est |
|---|---:|---|
| Poids transféré d'une page | 60 000 o | tenu partout |
| Requêtes d'une page, première visite | 12 | dépassé sur 8 pages |
| Piles typographiques distinctes | **1** | **3** |
| Familles de polices chargées | 3 | 5 |
| Variables CSS utilisées et jamais définies | **0** | 6 sur 5 pages, plus 25 usages sur `/crm` |
| Liens internes sans barre finale | **0** | 97 |
| Versions de bibliothèque flottantes | **0** | 1 |

L'ordre de traitement est celui du rapport entre gain et risque : **la pile typographique unique d'abord** (46 140 octets par visiteur, zéro risque technique, mais une décision de charte à faire trancher), les barres finales ensuite, puis l'empreinte sur `consentement.js`, puis la version figée de supabase-js.

### W.10 Non vérifié

- **Aucune mesure Lighthouse, aucun Core Web Vital.** Ni FCP, ni LCP, ni CLS, ni INP.
- **Aucune mesure sur réseau mobile ni sur appareil réel.** Les temps relevés (0,07 s à 0,23 s) sont ceux d'une machine filaire vers Cloudflare depuis Marseille et ne disent rien de l'expérience d'un artisan sur un chantier.
- **Le coût d'exécution du JS n'a pas été mesuré.** Les 98 407 octets de `/espace` sont pesés, pas chronométrés.
- **Les requêtes vers Supabase à l'exécution** ne sont pas comptées : aucune session n'a été ouverte.
- **La configuration Workers Builds** vit dans le tableau de bord, pas dans le dépôt.

---

## X. Tests et contrôles automatiques

### X.1 L'état : zéro

**Le dépôt de référence n'a aucun contrôle automatique.** Ce n'est pas une opinion, c'est un inventaire :

| Ce qu'on a cherché | Résultat |
|---|---|
| Contenu de `outils/` | **un seul fichier**, `construire.mjs` |
| Script `test` dans `package.json` | absent (`build` et `deploy` seulement) |
| Dossier `.github/` | absent |
| Fichiers `*test*`, `*spec*`, `*recette*`, `*banc*` | **un seul**, `crm/outils/verifier-contacts.py`, qui contrôle un fichier de contacts et non le produit |

**Rien ne s'exécute avant une poussée, rien ne s'exécute à la poussée, rien ne s'exécute après le déploiement. Le produit part en ligne sur la foi de la relecture.**

### X.2 La régression, nommée

Ce n'est pas un manque : c'est une **perte**. L'ancien dépôt contient **1 898 lignes d'outils de contrôle qui ne sont pas reprises**.

| Outil | Lignes | Ce qu'il mesure | Repris ? |
|---|---:|---|---|
| `recette.py` | 896 | 8 contrôles bloquants sur les sources, plus 1 informatif | **non** |
| `banc-sql.mjs` | 223 | rejoue toutes les migrations sur un vrai PostgreSQL (PGlite) et teste les cloisons | **non** |
| `verifier-coherence.py` | 203 | concordance des chiffres entre documents | **non** |
| `verifier-en-ligne.sh` | 169 | le déploiement réel, adresse par adresse | **non** |
| `contrastes.py` | 162 | contrastes WCAG | **non** |
| `check-mobile.py` | 136 | débordement latéral, largeur par largeur | **non** |
| `a-fournir.py` | 109 | relève les mentions manquantes, produit `A-FOURNIR.md` | **non** |

Les mentions d'`A-FOURNIR.md` ont été relevées par le septième de ces outils. **La liste existe, l'outil qui la tient à jour n'est plus dans le dépôt de référence.** Le document dit lui-même : « Ne pas tenir cette liste à la main : la relancer. » **Il n'y a plus rien à relancer**, et c'est pourquoi ses comptages portent encore sur l'autre dépôt (Q.2).

### X.3 Ce que le banc SQL trouvait, et qui justifie de le remettre en premier

`banc-sql.mjs` monte un PostgreSQL complet en mémoire, pose les doublures de Supabase (schémas `auth` et `storage`, rôles, `auth.uid()`), rejoue les migrations dans l'ordre, puis pose les questions qui comptent. **35 contrôles** quand tout passe : exécution de chaque fichier (12), rejouabilité (7), cloison entre artisans (6), cloison du CRM (1), essai et sécurité par ligne (9).

**Son palmarès :** le 13/09/2026, au premier passage, il a trouvé qu'**un compte d'artisan ordinaire lisait la totalité de la table `contacts`**, c'est-à-dire les **1 374 personnes démarchées**. Trois morceaux innocents mis bout à bout. **Aucune relecture ne l'avait vu. Un banc l'a vu en une exécution.**

Le socle ne se reconstruit pas, c'est acquis. **Mais il se re-mesure, et aujourd'hui rien ne le re-mesure.**

### X.4 A CONSTRUIRE : ce qu'il faut remettre, et dans quel ordre

L'ordre n'est pas celui de l'ancien dépôt. Il est celui du rapport entre ce qu'un contrôle attrape et ce qu'il coûte à remettre.

#### Étape 1 : le banc SQL, `outils/banc-sql.mjs`

**Pourquoi en premier.** C'est le seul outil qui protège de la fuite de données, le seul défaut du projet qui a déjà coûté. Et il est déjà en Node, donc compatible avec la chaîne du nouveau dépôt, contrairement aux six outils Python.

**Ce n'est pas un copier-coller. Deux corrections obligatoires, mesurées :**

1. Il lit `crm/supabase/<fichier>`. Dans le dépôt de référence, les migrations vivent dans `supabase/migrations/`. Sans ce changement, **il échoue à la première lecture**.
2. **Sa liste `MIGRATIONS` contient 12 fichiers. Le dépôt en a 14.** Manquent `migration-cloison-profils.sql` et `migration-taches-planifiees.sql`. **Un banc qui ne rejoue pas deux migrations sur quatorze donne un vert qui ne vaut rien.** La liste devra être **déduite du dossier**, dans un ordre explicite, pas recopiée.

**Dépendance :** `npm install @electric-sql/pglite`, une seule, en dépendance de développement.

**Contrôle à ajouter pendant le portage :** le banc devra dire si `pg_cron` est attendu et absent. Une tâche qui ne tourne pas ne produit aucune erreur.

#### Étape 2 : la recette des sources, `outils/recette.py`

**Ce qu'elle attrape, et que rien d'autre n'attrape :** un tiret cadratin, un montant d'abonnement affiché avant l'heure, du vocabulaire d'emploi, une clé secrète dans une page, un écran sans état de chargement ou d'erreur, un bouton mort, un lien interne vers une page inexistante.

**Le portage n'est pas neutre.** `recette.py` lit `outils/build.py` pour connaître la liste des pages. **Ce fichier n'existe pas dans ce dépôt** : la table des écrans vit dans la constante `ECRANS` de `outils/construire.mjs`. Deux options, **et la seconde est la bonne** : réécrire l'analyse pour lire le JavaScript, ce qui recrée le même couplage fragile ; ou **sortir `ECRANS` dans `outils/ecrans.json`**, que `construire.mjs` et la recette lisent tous les deux. **La table des écrans devient une donnée, plus un morceau de code.** C'est aussi ce dont l'étape 5 du chapitre V a besoin.

**Un contrôle à inverser :** le contrôle 3 de `recette.py` interdit tout montant d'abonnement dans les pages, parce que le prix n'était pas arrêté. **Il l'est depuis le 15/09/2026. Le contrôle est devenu faux dans son principe** : au lieu d'interdire tout montant, il vérifiera que le seul montant affiché est 29,90, et qu'il est suivi de « HT ».

#### Étape 3 : un contrôle de construction, `outils/verifier-dist.mjs`, à écrire

Aucun équivalent n'existe. Il tient le budget du chapitre W et rattrape ce qui a été trouvé aujourd'hui. **Sept assertions, toutes vérifiables sans navigateur :**

1. **Une seule pile typographique.** Aujourd'hui : 3.
2. **Aucune variable CSS utilisée sans être définie.** Aujourd'hui : `--t5` sur 5 pages, `--t4` sur `/connexion`, `--accent-texte` **25 fois** sur `/crm`. Attention au faux positif : `--d`, `--v`, `--w` sur `/` et `--st-fond` sur `/crm` sont posées en style direct, elles sont légitimes.
3. **Les couleurs de la charte aux bons noms.** `--bg` vaut `#F8F4EC`, `--encre` vaut `#191512`, `--accent` vaut `#E12154`, `--accent-texte` vaut `#890026`, dans les 13 pages. Signaler `--cream: #191512`.
4. **Aucun lien interne sans barre finale.** Aujourd'hui : 97.
5. **Aucune version de bibliothèque flottante.** Aujourd'hui : `supabase-js@2` sur 8 pages.
6. **Aucun fichier dans `dist/` qui ne vienne pas de la construction.** Aujourd'hui : `dist/_banc/aujourdhui.html`.
7. **Le budget de poids et de requêtes** du chapitre W.

**Ces sept assertions auraient toutes trouvé un défaut réel aujourd'hui. C'est le meilleur rapport de ce chapitre : un fichier à écrire, sept défauts déjà présents.**

#### Étape 4 : le contrôle du site en ligne

Le déploiement est automatique à chaque poussée : **c'est justement pour cela qu'il faut le relire.**

- les 13 adresses répondent 200 ;
- **les trois barrières du chapitre V sont toujours en place** tant que la marque n'est pas déposée ;
- le jour où elles tomberont, le **même** script vérifiera l'inverse, page ouverte par page ouverte ;
- aucune clé de service ne figure dans une page servie ;
- `content-encoding: br` est bien actif.

#### Étape 5 : `a-fournir.py`, contrastes, mobile

Dans cet ordre. `a-fournir.py` parce que `A-FOURNIR.md` est un livrable client **qui se périme en silence**, et que ses éléments sont affichés en clair à l'écran : le jour où quelqu'un en remplit un, la liste doit le savoir. `contrastes.py` et `check-mobile.py` ensuite : ils demandent un Chrome piloté, donc une installation, donc un coût qui les met après les quatre outils qui n'en demandent pas.

#### Étape 6 : le déclencheur

Tant qu'il n'y a pas de dossier `.github/`, les étapes 1 à 5 sont des scripts qu'on oublie de lancer. Deux niveaux, le premier suffit pour commencer : `npm test` enchaînant banc SQL, recette et vérification de `dist/`, avec un code de sortie non nul au premier échec ; puis un déclenchement à la poussée.

### X.5 Ce qu'un contrôle aurait déjà attrapé, aujourd'hui

Ces sept défauts ont été trouvés à la main, en une session, sans navigateur. **Aucun n'aurait survécu à l'étape 3.**

| Défaut | Mesure |
|---|---|
| Trois piles typographiques | 3 requêtes Google Fonts distinctes sur 13 pages |
| `--accent-texte` jamais défini dans `/crm` | 25 usages, 0 définition |
| `--t5` et `--t4` jamais définis | 6 usages sur 6 pages |
| `--cream` porte l'encre | `#191512` dans 12 pages |
| 97 liens sans barre finale | 115 liens, 0 avec barre |
| `supabase-js@2` flottante | résout vers 2.116.0 ce jour |
| `dist/_banc/aujourdhui.html` | 143 301 o, hors construction |

### X.6 Non vérifié

- **Aucun des sept outils de l'ancien dépôt n'a été exécuté.** Leurs comptages de contrôles sont lus dans leur code, pas observés à l'exécution.
- **Aucune recette avec deux comptes réels n'a été faite.** C'est la règle du projet : **la clé de service contourne toutes les politiques par ligne et ne prouve rien.** Le banc attrape ce qui est attrapable avant, il ne remplace pas ce contrôle.
- **Les 43 fonctions « promises quelque part, absentes du code » et les 33 « dessinées, rien derrière » de l'audit n'ont pas été recomptées** dans cette session.

---

## Y. La surveillance

> Ce chapitre porte sur le mode de panne le plus dangereux du projet : **celui qui ne lève aucune erreur**.

### Y.1 pg_cron : comment on sait, et ce qu'on sait

Trois façons de le savoir, de la plus sûre à la plus rapide :

1. **La requête directe**, avec le jeton personnel `sbp_` (le seul qui exécute du SQL ; la clé de service rend 401 sur ce point) : `select extname from pg_extension where extname = 'pg_cron';`
2. **Le contrôle prévu pour ça** : `select * from public.controle_taches()`. Elle rend, pour chaque tâche, la planification, l'état actif, **le dernier statut** et **la dernière fin**.
3. **Le notice au moment de jouer la migration** : le fichier écrit en clair « pg_cron absent : les tâches ne sont pas planifiées. C'est le cas attendu sur le banc d'essai hors production, et **un DEFAUT en production**. »

**Mesuré le 14/09/2026 : l'extension n'était pas installée sur le projet.**

Mesure indirecte du 15/09/2026 : `controle_taches()` **existe** en base (elle rend `42501 permission denied`, pas `404`). Le fichier de tâches a donc été joué. **Cela ne dit rien de l'extension elle-même** : le fichier se joue sans échouer même quand pg_cron est absent, c'est exactement ce que sa garde organise. **Non vérifié à ce jour** : l'état réel de l'extension, qui demande le jeton `sbp_`.

### Y.2 Ce qui casse si les tâches ne tournent pas

| Tâche | Heure UTC | Ce qui casse |
|---|---|---|
| `expirer-demandes` | 3 h 00 | Une demande **n'expire jamais**. Elle reste `envoyee` indéfiniment, et le destinataire garde une liste qui grossit sans jamais se vider |
| `publier-evaluations` | 3 h 10 | **La plus grave.** Une note à double sens ne se publie qu'une fois les deux notes posées **ou** le délai passé. Sans cette tâche, le délai ne passe jamais : **une note laissée seule reste invisible pour toujours.** Cela vide de sens toute la promesse de notation |
| `marquer-pieces-expirees` | 3 h 20 | Une assurance décennale périmée **reste affichée comme valable**. Une pièce expirée n'est pas une pièce : c'est un confrère qui choisit un sous-traitant sur une garantie qui n'existe plus |
| `purger-evenements` | lundi 3 h 30 | La conservation de 730 jours **n'est pas appliquée**. Elle reste une phrase dans un commentaire, et le registre des traitements devient faux |
| **`inviter_evaluations()`** | **non planifiée** | **Personne n'est jamais invité à noter**, donc `publier-evaluations` tourne sur du vide même le jour où elle tourne |

**Le point commun, et c'est lui le sujet du chapitre : aucune de ces pannes ne lève d'erreur.** Tout a l'air normal. Aucune page ne blanchit, aucun journal ne rougit, aucun utilisateur ne se plaint le premier jour. **Le produit dérive lentement, et on s'en aperçoit sur une note qui n'est jamais apparue, trois mois plus tard.**

C'est pour cela que `controle_taches()` existe, et c'est pour cela qu'elle doit être **regardée**, ce qui n'est le cas d'aucun écran aujourd'hui.

### Y.3 Un défaut de sécurité mesuré le 15/09/2026, et il passe avant le reste

#### La mesure

Appels POST anonymes, clé publique seule, sur `/rest/v1/rpc/` :

| Fonction | Réponse | Ce que dit son `revoke` |
|---|---|---|
| `controle_taches()` | **401**, permission denied | `revoke all ... from public, anon, authenticated` |
| `expirer_demandes()` | **200**, résultat `0` | `revoke all ... from public;` **seul** |
| `publier_evaluations_echues()` | **200**, résultat `0` | `revoke all ... from public;` **seul** |
| `marquer_pieces_expirees()` | **200**, résultat `0` | `revoke all ... from public;` **seul** |

**Le témoin est parfait :** quatre fonctions de la même famille, sur le même projet, au même instant. **La seule dont le `revoke` nomme `anon` et `authenticated` est la seule qui refuse.**

#### La cause racine

`revoke all on function ... from public` retire le droit accordé au pseudo-rôle `PUBLIC`. Il **ne retire pas** le droit accordé explicitement aux rôles `anon` et `authenticated`, **que Supabase accorde par défaut sur le schéma `public`**. Un `revoke from public` seul, sur une fonction `security definer`, laisse donc la porte ouverte à un visiteur non connecté.

#### L'ampleur

Comptage sur les 14 migrations : **55 instructions `revoke all on function`, dont 10 seulement nomment `anon` et `authenticated`**. Les 45 autres ne sont pas toutes en défaut : beaucoup reçoivent ensuite un `grant execute ... to authenticated` délibéré. **Sont en défaut celles qui sont censées être réservées au serveur et ne reçoivent qu'un `grant ... to service_role`, ou aucun grant du tout.** Les trois tâches d'entretien en font partie, mesurées. **Non vérifié** : la liste exhaustive des autres, qui demande une requête sur `information_schema.role_routine_grants` avec le jeton `sbp_`.

S'y ajoute le défaut voisin du chapitre J.4 : **huit fonctions ne portent aucun `revoke` du tout**.

#### Le dommage réel, sans le surestimer

Les trois fonctions ne prennent aucun paramètre et sont gardées par leur condition : appeler `publier_evaluations_echues()` ne publie **pas** une note avant son délai, la clause tient. **Il n'y a pas de fuite de données ni de publication anticipée.** Ce qui est ouvert, c'est **un balayage en écriture sur trois tables, déclenchable à volonté par n'importe qui**, et une fonction `security definer` accessible au monde entier **alors que la migration affirme le contraire**. C'est un levier de déni de service et une affirmation fausse dans la documentation du socle.

#### La correction

Une ligne par fonction, à ajouter puis rejouer : `revoke all on function public.expirer_demandes() from anon, authenticated;` et la même pour les deux autres. Puis **re-mesurer avec le même appel anonyme** : les trois doivent rendre 42501, comme `controle_taches()`.

### Y.4 Ce qu'on surveille aujourd'hui, et ce qu'on ne surveille pas

| Objet | État | Où |
|---|---|---|
| Les 16 compteurs métier | **en service** | `chiffres_back_office()`, appelé par `app/admin/index.html:546` |
| Le journal d'audit | **en service** en écriture, lu par l'administration | `public.journal` |
| Les demandes RGPD hors délai | **en service** : compteur `rgpd_en_retard` | `migration-back-office.sql:378` |
| L'état des tâches | **en base, aucun écran** | `controle_taches()` |
| Les journaux des fonctions de périphérie | **des `console.log` bien placés, et personne ne les lit** | Supabase, onglet Logs |
| La disponibilité du site | **aucune sonde** | mesuré à la main le 15/09/2026 |
| **La sauvegarde quotidienne** | **échoue chaque soir à 19 h 30** | `SUPABASE_SERVICE_KEY` absente de `~/.config/adispo/supabase.env` |

**La dernière ligne mérite d'être lue deux fois. Une sauvegarde qui échoue tous les soirs sans que personne soit prévenu est une sauvegarde qui n'existe pas.**

**Une qualité à garder** : `chiffres_back_office()` refuse (`42501`) plutôt que de rendre des zéros à un compte non administrateur. Même doctrine que `entonnoir()`. La fonction rend d'ailleurs, pour chaque compteur absent, **la raison** : « la table X n'existe pas dans cette base : la migration qui la pose n'a pas été jouée ». **C'est exactement ce qui aurait révélé le point P.1 sans aucune mesure extérieure.**

### Y.5 À construire

| # | Ce qui sera construit | Priorité |
|---|---|---|
| 1 | **Corriger les trois `revoke`**, puis re-mesurer par un appel anonyme | immédiate, c'est un défaut de sécurité mesuré |
| 2 | **Installer pg_cron** et vérifier le lendemain par `controle_taches()` | immédiate : quatre traitements écrits, payés, et qui ne tournent pas |
| 3 | **Réparer la sauvegarde quotidienne** et la faire crier quand elle échoue | immédiate |
| 4 | **Planifier `inviter_evaluations()`** et lui donner son `grant` | haute : sans elle, la notation ne démarre jamais |
| 5 | Un panneau « Entretien » dans `/admin` qui affiche `controle_taches()` | haute : une tâche en `failed` ne remonte nulle part toute seule |
| 6 | Une sonde de disponibilité externe sur `/`, `/espace` et `/crm`, qui prévient sur un canal que quelqu'un lit | moyenne |
| 7 | Un compteur « événements de paiement non traités » ajouté à `chiffres_back_office()` : c'est la file d'attente des paiements ratés, aujourd'hui invisible | à faire avec le branchement du paiement |

**Aucun de ces sept points n'est une fonctionnalité. Ce sont les sept façons dont le produit s'abîmerait sans que personne le voie.**

---

## Z. L'entretien

### Z.1 Les tâches d'entretien

Toutes portées par pg_cron, toutes gardées par un test d'existence de l'extension pour que le banc d'essai passe sans échouer, toutes **déprogrammées avant d'être reprogrammées** pour que rejouer un fichier ne crée pas de doublon.

| Nom | Planification | Fonction | Fichier |
|---|---|---|---|
| `expirer-demandes` | `0 3 * * *` | `expirer_demandes()` | `migration-taches-planifiees.sql:58` |
| `publier-evaluations` | `10 3 * * *` | `publier_evaluations_echues()` | `:61` |
| `marquer-pieces-expirees` | `20 3 * * *` | `marquer_pieces_expirees()` | `:64` |
| `purger-evenements` | `30 3 * * 1` | `purger_evenements()` | `migration-roles-evenements.sql:927` |
| **manquante** | - | `inviter_evaluations()` | `migration-recherche-relations.sql:1097` |

Les heures sont creuses et décalées de dix minutes : trois traitements lancés à la même seconde se disputent les mêmes lignes sans raison. L'heure est en UTC, soit 5 h, 5 h 10 et 5 h 20 en heure d'été française.

**Pourquoi en base et non ailleurs** (`migration-taches-planifiees.sql:28-32`) : ces traitements ne lisent et n'écrivent que des données de la base, sans appel extérieur. Les faire porter par un service d'hébergement ajouterait une pièce à maintenir, des secrets à stocker et un point de panne de plus. **L'hébergement a déjà changé deux fois ; la base n'a pas bougé.**

### Z.2 Les durées de conservation

**Une seule est arrêtée sur cinq.**

| Donnée | Durée | État | Qui tranche |
|---|---|---|---|
| `evenements` | **730 jours** | **arrêtée**, avec sa purge écrite et sa tâche planifiée | déjà tranchée |
| `journal` (audit) | non arrêtée | **la table grossit sans limite** et porte des identifiants avec leur contexte (`avant`, `apres` en jsonb) | Claire-Marie avec l'avocat |
| `recherches` | non arrêtée | porte de la donnée personnelle, y compris les recherches **vides** | idem |
| `messages` | non arrêtée | le fichier de migration **refuse d'inventer une durée** | idem |
| Pièces comptables | non arrêtée | `factures_figees` **interdit toute suppression de facture** : aucune purge n'est possible sans lever ce déclencheur, ce qui doit être un geste conscient | le comptable |

Un délai voisin, lui, est tenu : `demandes_rgpd.echeance_le` vaut `now() + interval '1 month'`, le délai de l'article 12.3, et le dépassement remonte dans le compteur `rgpd_en_retard`. La colonne est ordinaire et non générée, parce qu'une addition de mois dépend du fuseau de la session.

### Z.3 Les migrations

**Elles sont rejouables, et c'est une discipline tenue partout** : `create table if not exists`, `create or replace function`, `drop policy if exists` avant chaque `create policy` (90 `drop` pour 79 `create`), `on conflict do nothing` sur chaque semis de référentiel, déprogrammation avant reprogrammation des tâches.

Deux cas particuliers à connaître avant de rejouer :

- `migration-roles-evenements.sql` pose ses déclencheurs sur `demandes`, `conversations` et `abonnements` **sous garde d'existence** (`:811`, `:849`, `:872`). Si ces tables n'existaient pas au premier passage, le fichier écrit un `notice` et continue. **Il faut alors le rejouer une seconde fois**, sans quoi quatre des huit événements ne s'écrivent jamais.
- `insert into public.reglages ... on conflict (cle) do nothing` et non `do update` : si quelqu'un a déjà tranché une autre durée, rejouer ne la lui reprend pas dans le dos.

**Ce qui manque à l'outillage, et qui se paiera :** il n'y a **pas de `supabase/config.toml`** dans le dépôt, pas de table de versions de schéma, et **aucun fichier n'écrit l'ordre dans lequel les 14 migrations doivent être jouées**. Cet ordre existe pourtant, et il est porteur de sécurité (J.5.1). **Aujourd'hui il vit dans la tête de qui l'a écrit.**

**A CONSTRUIRE** : un préfixe numérique sur les fichiers, ou un `supabase/migrations/ORDRE.md` qui pose la séquence et les dépendances ; et un `supabase/config.toml` qui déclare les trois fonctions de périphérie, dont `evenements-paiement` en `verify_jwt = false`. Sans lui, la configuration de déploiement vit dans une commande tapée à la main.

### Z.4 La construction et le déploiement

Une seule commande construit tout : `npm run build`, soit `node outils/construire.mjs`, **110 lignes**.

Trois choix qui doivent survivre à ce chapitre :

1. **En Node, pas en Python** : Cloudflare reconstruit le site à chaque poussée, Node est présent dans son environnement de construction. **Une chaîne qui ne se construit que sur une machine n'est pas une chaîne.**
2. **Non destructif** : ne lit que `app/` et `crm/src/`, n'écrit que `dist/`. `dist/` est effacé et réécrit à chaque construction : **ne jamais l'éditer**.
3. **L'en-tête vit à un seul endroit.** Répété douze fois, il divergerait.

**Un piège structurel, déjà payé sur le dépôt précédent** : une page dont le dossier existe sur le disque mais qui n'est **pas déclarée dans `ECRANS`** n'existe pas en ligne. Le constructeur écrit `ABSENT, ignore` et continue. **Un contrôle à ajouter : comparer la liste des dossiers de `app/` à `ECRANS` et échouer bruyamment sur l'écart.**

### Z.5 Les secrets et les sauvegardes

| Clé | Ce qu'elle ouvre | Où elle vit |
|---|---|---|
| Clé publique (`anon`) | ce que les politiques par ligne autorisent. **Elle est dans le code source de chaque page, c'est assumé** | les 10 fichiers concernés |
| Clé de service | toutes les tables, l'API d'administration des comptes, le stockage. **401 sur l'exécution de SQL** | `~/.config/adispo/supabase.env`, en 600 |
| Jeton personnel `sbp_` | l'API de gestion : exécuter du SQL, changer la configuration. **Le seul qui débloque les migrations** | idem |

**Un geste à ne jamais répéter** : ne pas faire passer un secret par une commande tapée. Sous zsh, `read -p` signifie « lire depuis un coprocessus » et la ligne part en clair dans l'historique. **Le bon geste est `pbpaste`.**

`supabase/functions/.env.example` ne contient **aucun secret** et ne doit jamais en contenir : il ne porte que des noms et la raison d'être de chacun. **Piège mesuré le 13/09/2026 et toujours ouvert :** le `.gitignore` ignore `.env*`, ce fichier est donc **présent sur le disque et invisible pour git** tant que personne n'ajoute `!supabase/functions/.env.example`. **Décision à prendre par Joan : modifier la règle d'exclusion d'un dépôt n'est pas une décision de code.**

**La sauvegarde quotidienne échoue chaque soir à 19 h 30.** C'est le premier point d'entretien à régler : **tout le reste de ce chapitre suppose qu'on peut revenir en arrière.**

### Z.6 À construire

| # | Ce qui sera construit | Pourquoi maintenant |
|---|---|---|
| 1 | **Réparer la sauvegarde quotidienne**, et la faire crier quand elle échoue | une sauvegarde qui échoue en silence n'existe pas |
| 2 | **`supabase/config.toml`**, qui déclare les trois fonctions et pose `verify_jwt = false` sur `evenements-paiement` | sans lui, la configuration de déploiement n'est écrite nulle part |
| 3 | **L'ordre de rejeu des 14 migrations**, écrit dans le dépôt | il existe, il n'est pas écrit, et il se perdra |
| 4 | Un contrôle dans `construire.mjs` : tout dossier de `app/` absent de `ECRANS` fait **échouer** la construction | une page qui n'existe pas en ligne sans erreur est déjà arrivée |
| 5 | Les **quatre durées de conservation manquantes**, puis leurs purges, puis leurs tâches | quatre traitements non déclarés au registre, dont deux portent de la donnée personnelle |
| 6 | La purge de `public.journal`, avec la question préalable : que garde-t-on d'un `avant`/`apres` en jsonb ? | la table grossit sans limite depuis l'origine |
| 7 | **Mettre à jour la mémoire `dispo-deploiement.md`** | elle décrit une chaîne qui n'existe plus : la prochaine session la rejouerait |

Les points 2, 3 et 4 ne coûtent qu'une heure chacun et suppriment trois façons de perdre une journée.

---

## AA. Les contradictions tranchées

Six relevés ont été faits en parallèle sur le même dépôt. Voici ce qu'ils disaient différemment, et ce qui a été retenu. **Chaque arbitrage porte sa mesure.**

### AA.1 Les comptages du dépôt

| Point | Ce qui était dit | Tranché |
|---|---|---|
| Lignes de `construire.mjs` | 90 (cadrage) contre 110 | **110**, `wc -l outils/construire.mjs` |
| Lignes de HTML applicatif | 16 663 contre 16 364 | **16 364**, `wc -l app/*/index.html` |
| Lignes des fonctions de périphérie | 3 421 contre 3 510 | **3 510**, `find supabase/functions -name "*.ts" \| xargs wc -l` |
| Fonctions SQL distinctes | 92 contre 93 | **93**, mesure refaite |
| Migrations | « 14 migrations » | **14 fichiers `.sql`, dont 13 migrations et `schema.sql`**, qui est le schéma d'origine du CRM et non une migration |
| Ligne du prix dans `/espace` | 1229 contre 1236 | **1236** (`:1231` est le commentaire au-dessus) |
| Marqueurs sur `/legal` | 35 (A-FOURNIR) contre 39 | **39 affichés, 35 intitulés distincts** : quatre reviennent deux fois |
| Marqueurs sur `/messages` | 5 contre 6 | **6 affichés, 5 intitulés distincts** (une septième occurrence est dans un commentaire) |
| Marqueurs annoncés par le `README` | 52 | **faux pour ce dépôt** : chiffre repris de l'autre dépôt, qui comptait 52 éléments sur 5 pages dont 12 hors du parcours produit |

### AA.2 Le nombre de politiques : quatre nombres, tous justes, qui ne comptent pas la même chose

| Ce qu'on compte | Valeur | Comment |
|---|---|---|
| Lignes portant le texte `create policy` | **83** | `grep -h "create policy" \| wc -l`. **C'est le chiffre du cadrage** |
| Dont dans des commentaires | **4** | `migration-back-office.sql:69`, `migration-cloison-profils.sql:17` et `:40`, `migration-roles-evenements.sql:162` |
| Instructions `create policy` réelles | **79** | 78 couples (table, nom) distincts |
| Politiques vivantes après un rejeu complet | **70 selon deux relevés, 77 selon un troisième** | **non arrêté** |

**Arbitrage.** Les trois premiers nombres sont établis et re-mesurables. **Le quatrième ne l'est pas**, parce qu'il dépend de l'ordre de rejeu simulé, et que cet ordre n'est écrit nulle part (Z.3). Ce document retient donc 83 et 79, et **inscrit le nombre vivant comme non vérifié**. Le seul qui compte en production est celui que rendra `select count(*) from pg_policies where schemaname = 'public'`, **et il n'a pas été relevé**. C'est le geste R.9.2.

Une seule chose est sûre dans les deux simulations : **« profils lecture connectes » est supprimée par `migration-cloison-profils.sql` et jamais recréée**, sauf si l'on rejoue `schema.sql` ou `migration-admin.sql` après elle.

### AA.3 Les fonctions sans `revoke`

Un relevé en nommait quatre (`est_actif`, `est_admin`, `est_commercial`, `role_courant`) et les jugeait sans conséquence ; un autre en nommait six (`est_admin`, `est_actif`, `distance_km`, `delai_avis`, `plafond_messages_par_heure`, `ecriture_interne`).

**Mesure refaite, fonction par fonction :** **huit fonctions ne portent aucun `revoke`**. Six n'ont ni `revoke` ni `grant` (les six du second relevé), deux ont un `grant` sans `revoke` (`est_commercial`, `role_courant`). Les deux relevés avaient chacun une partie de la liste.

### AA.4 La durée d'essai

Un relevé présentait `essai_mois = 1` et `essai_jours = 30` comme deux acquis compatibles ; un autre comme un défaut à corriger avant tout paiement.

**Tranché : c'est un défaut.** Les deux clés existent en base, mesurées le 15/09/2026. Elles s'accordent sur le fond (un mois offert), mais **en février un mois fait 28 jours**, et surtout deux sources pour une même règle finissent par diverger. Le chemin branché sur le parcours est `ouvrir_essai_si_parcours_fini()`, qui lit `essai_jours` : **c'est 30 jours qui s'appliquent en pratique**. `ouvrir_mon_essai()`, qui lit `essai_mois`, n'est appelée par aucun écran. **Une clé est à retirer, pas à ajouter**, et le CRM affiche déjà lui-même le désaccord qui en découle (`app.js:1398-1400`).

### AA.5 Les états du produit, écran par écran

| Point | Ce qui était dit | Tranché |
|---|---|---|
| **Le prix** | trois relevés donnaient des listes partielles | **3 écrans le portent (`espace:1236`, `demandes:1177` et `:1235`, `aide:143`), 5 disent encore qu'il n'existe pas (`accueil:896` et `:898`, `artisan:914`, `admin:570`, `legal:824`), et `aide` se contredit dans la même page (`:143` contre `:225`)** |
| **L'état d'abonnement affiché** | « le paiement dit : pas encore raccordé » contre « il dit : service injoignable » | **C'est « service injoignable » qui s'affiche**, parce que les fonctions ne sont pas déployées. La carte juste existe et ne se montre jamais |
| **Les événements** | « en base, rien ne les écrit » | **Faux.** Les tables et fonctions **n'existent pas en base** (404 `PGRST205` et `PGRST202`, témoin identique) ; dans les fichiers, huit déclencheurs les écrivent. **C'est une commande à passer, pas du code à écrire** |
| **`consentement.js` et le build** | le commentaire de `mes-donnees:59-62` dit qu'aucune étape ne le copie | **Faux depuis ce dépôt** : `construire.mjs:84-87` copie bien `app/assets`, et les deux outils Python cités n'existent pas ici. Commentaire périmé à corriger |
| **Le SIRET vérifié** | « fiche vérifiée au SIRET » | **Vraie dans le parcours normal, fausse contre quelqu'un qui ouvre la console** : le verdict est écrit par le navigateur, aucune garde de base ne le recontrôle |
| **La sécurité « en base, jamais dans la page »** | présenté comme complet | **Vrai mais incomplet** : 85 fonctions `security definer`, dont 56 appelables, constituent un second mur à auditer |

### AA.6 Les documents du projet contre le dépôt

`ARCHITECTURE.md`, `CHARTE-CLAIRE.md`, `VOIX.md` et la mémoire `dispo-deploiement.md` décrivent tous, sur au moins un point, un autre dépôt ou une autre charte. **Le détail est en A.3, et l'arbitrage est uniforme : seul le code fait foi.** Les décisions datées et les mesures horodatées de ces documents restent utilisables ; leurs chemins de fichiers, leurs numéros de ligne et leurs comptages ne le sont plus.

Deux conséquences pratiques :

- **les numéros de ligne cités par `ARCHITECTURE.md` ne sont pas transposables** dans ce dépôt ;
- **`A-FOURNIR.md` doit être relancé** sur `/Users/joanaglave/a-dispo`, et l'outil qui le produit n'existe plus ici (X.2).

### AA.7 Les outils de contrôle perdus

`banc-sql.mjs` liste 12 fichiers de migration et lit `crm/supabase/` ; le dépôt en a 14 dans `supabase/migrations/`. `recette.py` lit `outils/build.py`, qui n'existe pas. **Son contrôle 3, qui interdit tout montant d'abonnement dans les pages, est devenu faux dans son principe depuis que le prix est arrêté.** Les trois sont des corrections de portage, pas des réécritures.

---

## AB. Ce qui reste à trancher par Joan

Questions fermées. Chacune bloque un travail nommé, et aucune ne demande d'écrire du code pour être répondue.

### AB.1 Le produit et le commerce

| # | Question | Ce que ça débloque |
|---|---|---|
| 1 | **Le prestataire de paiement : BNP, ou un autre ?** | 19 des 57 fonctions dormantes. Tout le reste du chapitre N |
| 2 | **Le fournisseur d'envoi de courriels : Resend, Brevo, Postmark ou Mailjet ?** | 12 des 57, dont le courriel de confirmation que `/inscription` promet déjà |
| 3 | **La récompense de parrainage : combien de mois offerts au parrain ?** (`reglages.parrainage_mois_parrain` vaut `null` et la note dit « dépend du prix ». Le prix est arrêté) | 5 des 57, et le levier d'acquisition à x2,8 identifié par l'étude |
| 4 | **Le calendrier des relances de paiement : combien de relances, à quel rythme, sur quel canal ?** | 5 des 57 |
| 5 | **La location de matériel est-elle dans le périmètre, oui ou non ?** `aide` la promet, aucune table d'annonce n'existe | soit un chantier, soit une réponse de FAQ à retirer |
| 6 | **Un commercial doit-il voir les fiches d'artisan ?** Aujourd'hui non : il a `inscriptions` et les événements, pas `artisans` | ouvrir `artisans` au commerce, c'est ouvrir le SIRET et le téléphone de toutes les entreprises inscrites. **Cela ne se décide pas dans un fichier de migration** |

### AB.2 Les contradictions du produit, à arbitrer par une phrase

| # | Question | Aujourd'hui |
|---|---|---|
| 7 | **On aligne les 5 écrans en retard sur 29,90 euros HT, oui ?** | `aide` se contredit dans la même page, `legal` affirme que le prix n'est pas arrêté |
| 8 | **La durée annoncée du parcours : on corrige l'accueil (7 min 30), ou on raccourcit le parcours ?** | l'accueil promet 2 minutes, la constante du produit totalise 7 min 30 |
| 9 | **Le nombre d'écrans annoncé : on écrit cinq, ou on ramène la navigation à trois ?** | l'accueil dit « trois écrans », la navigation en compte cinq |
| 10 | **La police de l'accueil : on aligne sur DM Sans, ou on acte Karla partout ?** | un écran sur douze est hors charte, et c'est celui que le visiteur voit en premier. Économie mesurée de l'alignement : 46 140 octets par visiteur |
| 11 | **La police du CRM : on aligne Bricolage Grotesque sur la charte, oui ?** | troisième pile typographique, pour un seul écran |
| 12 | **L'encre sur l'aplat rouge : `--encre` devient blanc, ou `--accent` s'assombrit ?** | le jeton déclaré pour cet usage vaut 3,93, sous le seuil ; le code écrit `color:#fff` 32 fois, à 4,62, soit 0,12 de marge |

### AB.3 Les décisions qui demandent un tiers

| # | Question | Qui répond | Ce que ça bloque |
|---|---|---|---|
| 13 | **Les six textes de consentement : quand l'avocat les livre-t-il ?** | avocat | **aucun consentement n'est opposable tant qu'aucun texte n'est en vigueur.** C'est le blocage le plus structurel du bloc RGPD |
| 14 | **Les durées de conservation : journal, recherches, messages, pièces comptables** | avocat et comptable | quatre purges non écrites, et la mention #18 de `/legal` |
| 15 | **Le taux de TVA et la série de numérotation des factures** | comptable | `emettre_facture()` lève « taux de TVA inconnu : il ne sera pas inventé ici » |
| 16 | **Le dépôt INPI : on dépose, à quelle date, sur quelles classes ?** (environ 270 euros pour trois classes, SME Fund à demander **avant** de payer) | Joan | les trois barrières d'indexation, et la mention légale de la marque |
| 17 | **Les accès OVH de `a-dispo.fr`** | Claire-Marie | SPF, DKIM, DMARC, donc **tous** les courriels |
| 18 | **L'écran `/admin` : on le facture, ou on acte qu'il est hors devis ?** | Joan | 1 278 lignes existent et le fichier dit lui-même que le devis n'est pas signé |

### AB.4 Les décisions de dépôt et de méthode

| # | Question | Aujourd'hui |
|---|---|---|
| 19 | **On ajoute `!supabase/functions/.env.example` au `.gitignore`, oui ?** | le fichier ne contient aucun secret, documente 15 variables, et **un clone neuf ne saura pas quelles variables poser** |
| 20 | **On numérote les 14 migrations, oui ?** | rien n'impose l'ordre de rejeu, et rejouer `schema.sql` rouvre les 1 374 fiches de prospection en lecture **et en écriture**, sans lever d'erreur |
| 21 | **On sort `ECRANS` dans `outils/ecrans.json`, oui ?** | la table des écrans est du code ; la recette et le plan du site en ont tous deux besoin comme donnée |
| 22 | **On remet les outils de contrôle, dans l'ordre proposé au chapitre X ?** | 1 898 lignes existent dans l'ancien dépôt, zéro contrôle dans celui-ci, et **sept défauts trouvés à la main aujourd'hui auraient été attrapés par le seul contrôle de construction** |
| 23 | **On met à jour `ARCHITECTURE.md`, `CHARTE-CLAIRE.md`, `VOIX.md` et la mémoire de déploiement, ou on les marque périmés ?** | quatre documents décrivent un autre dépôt ou une autre charte |

### AB.5 Ce qui ne demande aucune décision, et qui devrait partir tout de suite

Pour mémoire, et parce que la liste est courte. **Aucun de ces gestes n'attend une réponse de qui que ce soit.**

1. **Corriger les trois `revoke` faibles** des tâches d'entretien : défaut de sécurité mesuré en production, 15 minutes.
2. **Réparer la sauvegarde quotidienne**, qui échoue chaque soir depuis plusieurs jours.
3. **Installer `pg_cron`**, puis vérifier le lendemain par `controle_taches()`.
4. **Jouer `migration-roles-evenements.sql`**, puis le rejouer une seconde fois : 1 035 lignes déjà écrites, déjà relues, déjà payées.
5. **Déployer les trois fonctions de périphérie** : cela transforme « on n'arrive pas à joindre le service de paiement » en « pas encore raccordé, le prestataire n'est pas choisi », sans qu'aucune décision commerciale soit prise.
6. **Ajouter un pied de page commun** vers `/legal` et `/aide` : un défaut d'usage et une obligation légale, d'un coup.
7. **Brancher `demander_resiliation()`** sur un bouton : un appel, sur une fonction déjà écrite, déjà accordée, déjà jouée.
8. **Corriger le commentaire périmé** de `app/mes-donnees/index.html:59-62`, et la ligne « Mon espace » de `app/admin/index.html:348`.
9. **Ajouter `set search_path = public`** à `schema.sql:30` : une ligne, la seule fonction du projet qui déroge à la règle.

---

*Fin du cahier des charges. Assemblé le 15/09/2026 à partir de vingt-six relevés indépendants sur `/Users/joanaglave/a-dispo`. Toute reprise de ce document doit re-mesurer les chiffres avant de les citer : chaque tableau porte la commande qui le reproduit.*
