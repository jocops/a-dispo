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
npm run build     # construit dist/
npm run deploy    # construit puis déploie
```

Une seule commande construit tout : les douze écrans et le CRM. Aucune
dépendance autre que wrangler, aucun Python.

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
