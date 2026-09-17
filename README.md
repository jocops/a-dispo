# à dispo

Place de marché d'entraide entre artisans du bâtiment : un professionnel qui a
des demi-journées libres, un autre qui a promis une date et n'a pas les bras.

**Sous-traitance entre entreprises indépendantes, jamais de l'emploi.** L'article
L8241-1 interdit le prêt de main d'œuvre à but lucratif, jusqu'à 150 000 € pour
une personne morale. Le vocabulaire d'embauche est donc proscrit partout :
on dit confrère, chantier, lot, devis. Jamais mission, intérim ni personnel.

---

## Démarrer

```bash
npm install
npm run build      # construit dist/
npm run controle   # la recette et le banc SQL
npm run deploy     # construit puis déploie
```

Une seule commande construit tout : les douze écrans et le CRM.

## Les contrôles

`npm run controle` enchaîne les deux filets. Ils ne partent jamais en ligne.

**La recette** (`outils/recette.py`) passe onze contrôles sur les douze écrans :
les pages déclarées existent et `dist/` correspond à la source, aucun tiret
cadratin, aucun prix inventé, aucun vocabulaire d'emploi, aucune clé secrète,
les quatre états d'interface présents, aucun bouton mort, aucun lien cassé,
les libellés cohérents, un lien vers `/legal` sur chaque page, et le réglage du
service accordé à la forme de sortie du build. Elle ne lit pas les commentaires comme du balisage :
un contrôle qui signale sa propre documentation est un contrôle qu'on cesse de
croire.

## La sauvegarde

`outils/sauvegarde.py` copie **les 33 tables** du schéma `public`, pas une, et
sait prouver qu'elles reviennent.

```bash
python3 outils/sauvegarde.py --sauver      # copier, sceller, faire tourner sur 30 jours
python3 outils/sauvegarde.py --verifier    # le fichier est-il intact et complet ?
python3 outils/sauvegarde.py --eprouver    # LA PREUVE : est-ce que ça revient ?
```

`--eprouver` est la raison d'être de l'outil. Le devis signé dit qu'« une
sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde ». Il restaure
donc le fichier dans un schéma jetable, relit chaque table, compare les
empreintes SHA-256, puis supprime le schéma. **Il n'écrit jamais dans
`public`** : prouver une restauration en écrasant la production ferait courir
exactement le risque contre lequel la sauvegarde existe.

Relevé du 17/09/2026 : 33 tables sur 33 reviennent à l'identique, 1 444 lignes,
78 Ko. Une table refusait de revenir, `inscriptions` : sa colonne `email_norme`
est générée, et PostgreSQL interdit d'y écrire. L'outil nomme désormais ses
colonnes au lieu d'insérer par `select *`.

`--restaurer` est un blanc par défaut : il dit ce qu'il écrirait puis s'arrête.
Il faut `--vraiment` **et** une table nommée pour qu'une ligne de production
bouge. On ne restaure pas 33 tables d'un geste : chaque table est une décision.

Les fichiers vont dans `~/Sauvegardes/adispo/`, hors du dépôt, en 600. Ils
contiennent les 1 374 fiches de prospection : ils ne doivent jamais être
commités ni transmis.

Pour la quotidienne : `outils/sauvegarde.plist`, qui porte sa commande
d'installation. Il ne remplace pas encore `org.alpvalley.adispo-sauvegarde`,
qui copie une seule table dans un format que rien ne sait relire.

**Le banc SQL** (`outils/banc-sql.mjs`) monte un vrai PostgreSQL en mémoire
(PGlite), y pose ce que Supabase fournit, rejoue les quatorze migrations dans
l'ordre, les rejoue une seconde fois pour vérifier qu'elles sont rejouables,
puis vérifie qu'un artisan ne lit rien de ce qui appartient à un autre, ni le
fichier de prospection du CRM, et que l'essai de trente jours s'ouvre bien à la
fin du parcours. Il ne touche jamais à la base de production.

PGlite pèse 25 Mo et n'est pas dans `package.json` : Cloudflare réinstallerait
les dépendances à chaque construction. Une seule fois, en local :

```bash
npm install --no-save @electric-sql/pglite
```

## Ce qu'il y a dedans

```
app/              les écrans, en fragments HTML (pas d'en-tête : voir outils/)
  accueil/        la page publique
  connexion/      connexion par mot de passe ou par Google
  inscription/    la liste d'attente
  espace/         le parcours en cinq étapes, puis l'agenda
  recherche/      chercher un confrère par métier, dates et rayon
  artisan/        la fiche publique d'un confrère
  demandes/       les mises en relation et leur cycle de vie
  messages/       la messagerie, rattachée à un chantier
  mes-donnees/    le RGPD : voir, exporter, supprimer
  admin/          le back-office
  aide/           les vingt-cinq questions et leurs réponses
  legal/          les mentions légales
  assets/         les images
  public/         servi tel quel : favicon, robots.txt, en-têtes

crm/              l'outil commercial, quatre fichiers assemblés en un
supabase/         migrations et fonctions de périphérie
outils/           la chaîne de construction
```

## Comment ça tient

**Un seul socle de données.** Supabase porte l'authentification, la base et la
sécurité par ligne. Le site, le CRM et l'application mobile à venir sont trois
clients du même socle : une identité, une base, les mêmes droits.

**La sécurité est en base, jamais dans la page.** La clé publique est dans le
code source de chaque écran, c'est assumé : ce qu'elle ouvre est décidé par les
politiques de sécurité par ligne. Une page ne protège rien.

**Les sources sont des fragments.** `outils/construire.mjs` leur ajoute l'en-tête
commun et écrit `dist/`. Ne jamais éditer `dist/`, il est regénéré.

**Le CRM ne contient aucune donnée personnelle.** Les 1 374 fiches sont lues dans
Supabase après connexion. C'est ce qui permet de construire ce dépôt en public
sans exposer personne.

## Ce qui n'est pas encore raccordé

Le produit le dit à l'écran plutôt que de le promettre. Rien n'est écrit au
présent tant que ça ne marche pas.

- Le raccordement à Google Agenda, Outlook et Calendrier Apple. Le dépôt d'un
  fichier `.ics` fonctionne, lui.
- Le paiement. La banque n'est pas tranchée.
- Les mentions légales : 52 marqueurs s'affichent en clair, ils attendent des
  faits que seul le client peut fournir.

## Le site n'est pas indexé, et c'est voulu

La marque n'est pas déposée à l'INPI, et un service de surveillance veille sur
le nom voisin « adispo ». Trois barrières : `robots.txt` refuse la visite,
`_headers` pose `X-Robots-Tag`, et chaque page porte sa balise. À lever le jour
du dépôt.
