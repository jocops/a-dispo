# Prompt : la feuille de route « à dispo »

Ce fichier contient un prompt à coller tel quel dans une session Claude Code
ouverte sur `/Users/joanaglave/a-dispo`. Il produit une feuille de route
mesurée, et il est conçu pour être **relancé** : chaque exécution remesure la
réalité, réconcilie avec l'état connu, et dit ce qui a bougé.

Le texte entre les deux lignes de tirets est le prompt. Le reste est de la
documentation pour toi.

---

## CONTEXTE

Tu ouvres le projet « à dispo » : une plateforme de mise en relation entre
artisans du bâtiment indépendants, pour qu'ils se passent ou partagent des
chantiers quand l'un est indisponible ou surchargé. Abonnement mensuel, sans
commission. Cliente : Claire-Marie Bonel. Agence : Alp Valley (Joan Aglave),
avec Alec Ferrante.

Un devis de 6 060 € HT est signé, l'acompte de 3 030 € est encaissé. Une
livraison est engagée au **20 octobre 2026**, et c'est elle qui déclenche le
second versement, après validation ligne par ligne par la cliente.

Je veux **une feuille de route précise, mesurée, et faite pour être remise à
jour**. Pas un plan d'intentions : un état des lieux daté, avec ce qui bloque,
chez qui, et ce que ça empêche.

## LES SOURCES, ET LEUR AUTORITÉ

Lis-les toutes avant d'écrire la moindre ligne. En cas de contradiction,
l'ordre d'autorité est celui-ci, du plus fort au plus faible :

1. **La production, mesurée maintenant.** Le site répond sur
   `https://a-dispo.strattonn-pilotage.workers.dev`. La base Supabase est le
   projet `ucnyvsocoxenxbuakluo`, accès dans `~/.config/adispo/supabase.env`
   (ne jamais afficher une clé). `python3 outils/recette.py` passe onze
   contrôles. `python3 outils/sauvegarde.py --verifier` contrôle la sauvegarde.
2. **Le code du dépôt**, `/Users/joanaglave/a-dispo`, branche `main`.
   `git log` dit ce qui a été fait et quand.
3. **`etudes/devis-etat-20260917.json`** : les 27 lignes du devis signé,
   relevées le 17/09, chacune avec son état mesuré, sa preuve et son reste à
   produire. C'est le contrat, ligne par ligne.
4. **La base Notion « ✅ Tâches »**, source `a4636a4d-a765-4a85-b86c-f01a52d68241`,
   sous la page « à Dispo - Second Brain »
   (`3cdffe4f-bd63-8171-8abc-d784bf98dfeb`). Elle contient déjà 48 tâches avec
   porteur, priorité, chantier, état et « pourquoi maintenant ». **C'est la
   source de vérité de l'état HUMAIN d'une tâche.**
5. **`comptes-rendus/2026-09-20.md`** : le compte rendu de la dernière réunion,
   et **`comptes-rendus/2026-09-20-releve-verbatim.json`**, le relevé structuré
   du verbatim (118 décisions, 82 tâches, 92 chiffres, 63 questions ouvertes).
6. **`CAHIER-DES-CHARGES.md`** : 3 100 lignes, dont un chapitre AB de questions
   fermées en attente d'arbitrage.
7. **`etudes/`** : l'étude paiement (Stripe retenu contre BNP) et le dossier
   marque (`outils/dossier/recherche-inpi-20260920.json`, 105 faits sourcés).

**Le cahier des charges et les comptes rendus peuvent être périmés.** S'ils
contredisent le code ou la production, c'est la mesure qui gagne, et tu le
signales explicitement.

## LES RÈGLES DURES

1. **Mesurer, jamais deviner.** Chaque état que tu déclares porte sa preuve :
   `fichier:ligne`, une commande, ou une réponse HTTP. Un état sans preuve
   citable est refusé.
2. **Ne pas faire semblant.** Un bouton qui n'appelle rien n'est pas fait. Une
   fonction SQL écrite mais jamais appelée depuis l'interface n'est pas faite.
   Un écran qui affiche des données codées en dur n'est pas raccordé.
3. **N'invente aucune date.** Si une échéance n'a pas été dite, écris « non
   dite ». Les seules dates connues sont le 20 octobre (livraison), le
   20 novembre (offre d'un mois offert), et décembre (disponibilité de la
   cliente, qui n'est PAS une date de lancement décidée).
4. **Distingue ce qui est bloqué par du TRAVAIL de ce qui est bloqué par une
   DÉCISION.** C'est la distinction la plus importante de cette feuille de
   route : aujourd'hui, l'essentiel du retard vient de décisions non prises,
   pas de code non écrit. Une tâche bloquée par une décision doit nommer
   **qui** doit décider.
5. **Ne mets jamais de données nominatives** issues de `crm/contacts.json`
   (1 374 personnes réelles) : agrégats seulement.
6. **Lecture seule sur la production.** Tu mesures, tu ne répares pas dans le
   même geste.

## CE QUE JE VEUX DANS LA FEUILLE DE ROUTE

### A. L'en-tête
Date et heure du relevé. Jours restants avant le 20 octobre. Trois chiffres :
ce qui est fait, ce qui est entamé, ce qui n'est pas commencé, sur les 27 lignes
du devis.

### B. Le chemin critique
La suite ordonnée de ce qui doit arriver pour tenir le 20 octobre, avec les
dépendances explicites. Pour chaque maillon : ce qui le débloque, ce qu'il
débloque. **Dis clairement si le 20 octobre est tenable**, et si non, ce qu'il
faudrait abandonner ou décaler.

### C. Les décisions en attente
Un tableau : la décision, chez qui, depuis quand elle attend, ce qu'elle bloque,
et le coût de l'attendre une semaine de plus. Trie par coût décroissant.

### D. Les chantiers
Un bloc par chantier (marque, paiement, produit, juridique, communication,
infrastructure). Pour chacun : où on en est, avec la mesure ; ce qui reste,
chiffré en jours ; ce qui bloque.

### E. Les tâches
Toutes, groupées par porteur (Joan, Claire-Marie, Alec, tiers, à attribuer).
Pour chaque tâche :
`identifiant` · intitulé · porteur · état · priorité · échéance · ce qu'elle
débloque · sa preuve d'état.

**L'identifiant est stable et déterministe** : `<chantier>-<numéro>`, par
exemple `marque-03`. Il ne change jamais, même si l'intitulé est reformulé.
C'est lui qui permet la mise à jour.

### F. Ce qui a changé depuis le dernier relevé
Si une feuille de route antérieure existe dans `feuille-de-route/`, compare et
liste : tâches terminées, tâches nouvelles, tâches dont l'estimation a bougé,
et **tâches dont l'état déclaré ne correspond plus à la mesure** (le cas le plus
utile).

### G. Les risques
Ce qui peut faire rater le 20 octobre, par probabilité décroissante, avec la
parade pour chacun.

## LE MÉCANISME DE MISE À JOUR

C'est le point le plus important. La feuille de route doit pouvoir être
régénérée sans repartir de zéro et sans créer de doublons.

1. **Écris la feuille de route dans `feuille-de-route/AAAA-MM-JJ.md`**, datée.
   N'écrase jamais une version antérieure : l'historique est la valeur.
2. **Écris en parallèle `feuille-de-route/etat.json`**, un fichier de données
   qui porte, pour chaque tâche : identifiant, intitulé, porteur, état,
   priorité, échéance, estimation, ce qu'elle débloque, la preuve, et la date du
   dernier changement d'état. C'est ce fichier que la prochaine exécution lira.
3. **Réconcilie avec Notion par l'identifiant.** Une tâche dont l'identifiant
   existe déjà est **mise à jour**, jamais recréée. Une tâche disparue n'est pas
   supprimée : elle passe à l'état « abandonnée », avec le motif.
4. **Ne fais pas confiance à l'état déclaré.** Pour chaque tâche marquée faite,
   vérifie-le par la mesure. Si la mesure contredit, c'est la mesure qui gagne,
   et l'écart entre dans la section F.
5. **Termine par la commande exacte** permettant de relancer la mise à jour, de
   façon qu'on n'ait jamais à retrouver ce prompt.

## LE LIVRABLE

1. `feuille-de-route/AAAA-MM-JJ.md`, lisible par la cliente.
2. `feuille-de-route/etat.json`, lisible par la machine.
3. La base Notion mise à jour, par identifiant, sans doublon.
4. Un commit qui explique ce que le relevé a trouvé, pas seulement ce qu'il a
   écrit.
5. Dans ta réponse : le chemin critique, les décisions en attente, et ta réponse
   franche sur la tenue du 20 octobre.

## CE QUE TU NE DOIS PAS FAIRE

- Ne pousse rien (`git push` est refusé, et c'est volontaire) et n'envoie aucun
  mail. Tu commites, je pousse.
- N'arrondis pas une mauvaise nouvelle. Si le 20 octobre n'est pas tenable, le
  dire tôt vaut mieux que le découvrir le 19.
- Ne recopie pas le cahier des charges. Une feuille de route dit **quoi faire
  ensuite**, pas ce qu'est le projet.
- N'attribue pas un porteur qui n'a pas été nommé. « À attribuer » est une
  réponse valable, et utile.

---

## Notes d'usage, hors prompt

**Première exécution.** Il n'existe pas encore de `feuille-de-route/`. La
section F sera vide, c'est normal : elle se remplit à partir de la deuxième.

**Rythme conseillé.** Une fois par semaine, et systématiquement après une
réunion avec la cliente, une fois le compte rendu déposé.

**Pourquoi un `etat.json` en plus du Markdown.** Le Markdown est pour les
humains, le JSON pour la comparaison. Sans lui, la section « ce qui a changé »
oblige à relire et interpréter du texte, ce qui produit des faux écarts.

**Pourquoi des identifiants stables.** Sans eux, chaque exécution recrée les
tâches dans Notion et l'historique est perdu. C'est le défaut classique des
feuilles de route régénérées.

**La ligne à surveiller.** Au 17/09, il restait 34 jours à produire sur les
37,5 vendus, et cinq lots sur sept étaient en dépassement sur le seul reste à
faire. Si un relevé ultérieur annonce mieux sans qu'un travail correspondant ait
été commité, c'est le relevé qui se trompe.
