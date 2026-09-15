# L'envoi des emails transactionnels

> Fonction de périphérie Supabase (Deno, TypeScript). Écrite le 13/09/2026.
> **Le service d'envoi n'est pas choisi.** Cette fonction est faite pour que ce choix n'oblige à
> réécrire ni les huit gabarits, ni la validation, ni les appels : il tient dans une variable
> d'environnement.

---

## 1. Ce qui est fait

| Fichier | Ce qu'il porte |
|---|---|
| `index.ts` | La porte : sécurité d'appel, validation, états, envoi, journal, contrôle. 625 lignes. |
| `gabarits.ts` | Les huit emails, HTML et repli texte. 646 lignes. |
| `mise-en-page.ts` | La mise en page commune, la palette, les mesures de contraste. 279 lignes. |
| `fournisseurs.ts` | L'interface d'envoi et cinq branchements derrière elle. 286 lignes. |
| `DNS.md` | Les enregistrements à poser chez OVH, et pourquoi. |
| `LISEZMOI.md` | Ce fichier. |

**Les huit gabarits**, tous en HTML sobre **et** en repli texte écrit à la main :

| Gabarit | Nature | Lien de désinscription |
|---|---|---|
| `liste-attente-confirmation` | transactionnel | non : c'est le message qui **demande** le consentement |
| `bienvenue` | relationnel | **oui, obligatoire** |
| `demande-recue` | transactionnel | non |
| `demande-acceptee` | transactionnel | non |
| `demande-refusee` | transactionnel | non |
| `message-recu` | transactionnel | non |
| `paiement-echoue` | transactionnel | non |
| `facture-disponible` | transactionnel | non |

**Ce qui a été mesuré, pas supposé** (13/09/2026) :

- **Contrastes WCAG** de la palette utilisée : le plus faible est **8,29:1** (gris des mentions sur
  le fond de carte), le plus fort 15,41:1. Seuil AA : 4,5:1. Le texte du bouton, nuit sur ambre,
  est à 9,31:1.
- **Poids des messages** : de **4,7 Ko à 5,8 Ko** de HTML. Gmail coupe un message au-delà de 102 Ko
  et affiche « message tronqué » : on en est loin, et sans aucune image.
- **Mobile** : rendu à **375 x 812** dans un navigateur, `scrollWidth` = 375 px, **aucun
  débordement latéral**. Le bouton principal mesure **180 x 52 px** (cible tactile recommandée :
  44 px).
- **Objets** : de 23 à 43 caractères, donc lisibles en entier sur un écran de téléphone.
- **24 essais de bout en bout**, plus 3 contrôles (aperçu, idempotence, rapport) : tous passent.
  Secret absent, secret faux, appel depuis un navigateur, pièces manquantes listées d'un coup,
  neuf refus de validation, envoi nominal, message relationnel. Y compris un **échantillon
  adverse** : injection de balises dans un nom d'entreprise (échappée), saut de ligne et octet nul
  dans un champ (refusés), adresse de 200 caractères, champs facultatifs tous absents, nom
  d'entreprise de 79 caractères.
  Ces essais tournent avec un Deno simulé, sur le code réel de la fonction : ils ne remplacent pas
  un envoi vrai, qui reste à faire le jour où un fournisseur est choisi.
- **Aucun mot interdit** par l'article L8241-1 dans les huit rendus (contrôle automatique).
- **Aucun montant** dans aucun rendu (contrôle automatique).
- **Aucun tiret cadratin ni demi-cadratin** dans les six fichiers.

**Trois protections qui ne sautent pas aux yeux mais qui sont le cœur du fichier :**

1. **La fonction n'est pas appelable depuis un navigateur.** Les pages du site écrivent dans la
   base avec la clé publique, lisible dans leur code source. Cette clé est un jeton valide : la
   vérification de jeton par défaut de Supabase l'accepterait, et n'importe qui pourrait faire
   partir des emails signés `a-dispo.fr`. On exige donc un secret propre à la fonction
   (`x-cle-envoi`). **Tant qu'il n'est pas configuré, la fonction refuse tout.**
2. **Les liens sont bridés à notre domaine.** Qui obtiendrait le secret ne peut pas s'en servir
   pour envoyer, depuis notre domaine, un email crédible pointant vers son site. Un hôte
   supplémentaire légitime (le prestataire de paiement, pour une facture) s'ajoute explicitement
   dans `HOTES_LIENS`.
3. **Les sauts de ligne sont refusés dans les champs.** Un nom d'expéditeur passe dans l'objet du
   message : une valeur contenant un retour chariot permettrait d'y greffer un en-tête, par
   exemple une copie cachée vers une adresse étrangère.

---

## 2. Ce qui ne peut pas marcher aujourd'hui, et le geste qui le débloque

**Rien ne part pour l'instant, et c'est dit en clair par la fonction elle-même** : elle répond
`503 non_branche` avec la liste complète de ce qui manque. Elle ne fait jamais semblant d'avoir
envoyé.

| # | Ce qui manque | Pourquoi ça bloque | Le geste humain |
|---|---|---|---|
| 1 | **Le service d'envoi n'est pas choisi** | Supabase n'envoie pas d'email arbitraire. Sans fournisseur, aucun message ne sort. | Trancher entre les candidats, ouvrir le compte. **Décision de Claire-Marie et Joan.** |
| 2 | **Aucune adresse d'expédition n'existe** | Un email part forcément d'une adresse. Aucune n'existe sur `a-dispo.fr`. | La créer chez OVH. `[A COMPLETER : adresse d'envoi]` |
| 3 | **Ni DKIM ni DMARC, et un SPF strict** | Mesuré : `v=spf1 include:mx.ovh.com -all`, aucun DKIM, aucun DMARC. Un tiers non déclaré sera rejeté ou classé indésirable. | Poser les enregistrements chez OVH. **Voir `DNS.md`. Bloqué : personne ici n'a l'accès au compte OVH.** |
| 4 | **La page `/confirmation` n'existe pas** | Le lien de la double confirmation n'a aucune destination. La fonction refuse l'envoi si l'adresse n'est pas fournie, donc ce gabarit ne peut pas partir aujourd'hui. | Écrire la page qui appelle `confirmer_inscription(jeton)` et l'inscrire dans `outils/build.py`. **Ce chantier n'a pas le droit de modifier `build.py` : c'est le chef d'orchestre qui enregistre la page.** |
| 5 | **La page `/desabonnement` n'existe pas** | Sans elle, le gabarit `bienvenue` (le seul relationnel) ne peut pas partir. | Même geste que le 4, plus la fonction en base qui marque la désinscription. |
| 6 | **Personne n'appelle la fonction** | Aucun déclencheur n'existe. `crm/supabase/migration-inscriptions.sql` crée la ligne, mais rien ne demande l'envoi. | Écrire le déclencheur (webhook de base Supabase sur `insert` dans `inscriptions`, ou trigger `pg_net`) qui lit le `jeton`, compose l'adresse et appelle cette fonction avec `x-cle-envoi`. **Ce fichier appartient aux migrations, terrain d'un autre chantier.** |
| 7 | **Le paiement n'est pas raccordé** | Relevé dans `espace/index.html` : « Le prestataire de paiement n'est pas encore raccordé ». Les gabarits `paiement-echoue` et `facture-disponible` n'ont donc aucun événement qui puisse les déclencher. | Ils sont écrits et testés, prêts pour le jour du raccordement. Rien à faire avant. |
| 8 | **`public.emails_envoyes` n'existe pas** | Le journal des envois en base est donc inactif. La fonction envoie quand même et le dit dans ses logs : perdre une ligne de journal ne justifie pas de perdre un email. | Créer la table (colonnes attendues en 5), puis poser `JOURNAL_BASE=1`. |
| 9 | **`supabase/config.toml` n'est pas écrit ici** | Il vit hors de ce dossier, et un autre chantier travaille dans `supabase/functions/`. | Le chef d'orchestre y ajoute, le moment venu, le bloc de la fonction. La sécurité ne dépend pas de lui : elle tient au secret `x-cle-envoi`. |
| 10 | **Les branchements fournisseurs n'ont jamais été exécutés** | Écrits d'après la documentation publique de chacun. Aucun compte, aucune clé, aucun domaine vérifié. | Le jour du choix : un envoi réel vers une adresse à soi, puis lire les en-têtes (`DNS.md`, section 4). |

---

## 3. Les gestes humains, dans l'ordre

Chaque ligne porte **son critère de fin** : sans lui, on ne sait pas si c'est fait.

1. **Trancher le service d'envoi.**
   *Fini quand :* le nom est écrit dans le registre de décisions du projet.
2. **Ouvrir le compte et y déclarer le domaine `a-dispo.fr`.**
   *Fini quand :* le tableau de bord du service affiche le domaine, en attente de vérification.
3. **Créer l'adresse d'expédition chez OVH.**
   *Fini quand :* un message envoyé à cette adresse arrive dans une boîte qu'on sait relever.
4. **Poser DKIM, l'include SPF si nécessaire, et DMARC `p=none`** (`DNS.md`).
   *Fini quand :* `dig +short TXT _dmarc.a-dispo.fr` répond, et que le fournisseur affiche le
   domaine comme vérifié.
5. **Générer le secret d'appel et poser les variables :**
   ```bash
   openssl rand -hex 32                      # le secret, à garder
   supabase secrets set CLE_ENVOI=...        # le même, côté fonction
   supabase secrets set FOURNISSEUR_EMAIL=... FOURNISSEUR_CLE=...
   supabase secrets set EXPEDITEUR_EMAIL=... EXPEDITEUR_NOM="À dispo"
   ```
   *Fini quand :* `GET ?controle=1` répond avec `manque: []`.
6. **Déployer et faire un envoi réel vers une adresse à soi.**
   ```bash
   supabase functions deploy envoyer-email
   ```
   *Fini quand :* le message est reçu **et** que ses en-têtes affichent `DKIM: PASS` avec
   `d=a-dispo.fr`.
7. **Écrire la page `/confirmation`** (elle appelle `confirmer_inscription(jeton)`) **et la page
   `/desabonnement`**, puis les faire enregistrer dans `outils/build.py`.
   *Fini quand :* une inscription d'essai se confirme de bout en bout, et que la vue
   `inscriptions_par_metier` compte un confirmé de plus.
8. **Écrire le déclencheur** qui appelle la fonction à l'insertion d'une inscription.
   *Fini quand :* une inscription faite depuis le formulaire déclenche l'email sans intervention.
9. **Durcir le DMARC** en `quarantine` puis `reject`, après lecture des rapports.
   *Fini quand :* deux à quatre semaines de rapports ne montrent plus d'envoi illégitime.

---

## 4. Le contrat : comment on l'appelle

**Depuis un serveur uniquement.** Jamais depuis une page du site.

```
POST https://<projet>.supabase.co/functions/v1/envoyer-email
x-cle-envoi: <le secret CLE_ENVOI>
content-type: application/json

{
  "gabarit": "liste-attente-confirmation",
  "destinataire": "jean@monentreprise.fr",
  "donnees": { "prenom": "Jean", "url_confirmation": "https://a-dispo.fr/confirmation?jeton=..." },
  "cle_idempotence": "inscription-<id>"        // facultatif, voir plus bas
}
```

**Réponses :**

| Code | Corps | Ce que ça veut dire |
|---|---|---|
| 200 | `{ok:true, gabarit, fournisseur, identifiant}` | Parti. |
| 200 | `{ok:true, deja_envoye:true}` | Déjà envoyé avec cette clé d'idempotence. Rien n'a été renvoyé. |
| 401 | `secret_refuse` | En-tête `x-cle-envoi` absent ou faux. |
| 400 | `corps_illisible`, `usage` | Le JSON, ou la méthode. |
| 405 | `navigateur_refuse`, `methode` | Appel depuis un navigateur, ou verbe non prévu. |
| 422 | `gabarit_inconnu`, `destinataire_invalide`, `champ_manquant`, `champ_inconnu`, `champ_trop_long`, `champ_controle`, `adresse_refusee`, `montant_refuse`, `desabonnement_absent` | La demande est mal formée. Le message dit lequel des champs, et pourquoi. |
| 502 | `fournisseur_refuse` | Le service d'envoi a refusé. Le motif et le geste sont dans la réponse. |
| 503 | `secret_absent`, `non_branche` | Il manque une pièce qu'aucun code ne fabrique. La liste complète est dans `erreur.manque`. |
| 500 | `imprevu` | Filet de sécurité. Le détail est dans le journal de la fonction. |

**Toute erreur porte un champ `geste`** : ce qu'un humain doit faire pour la lever.

**Les champs de chaque gabarit** (obligatoire en gras) :

| Gabarit | Champs |
|---|---|
| `liste-attente-confirmation` | prenom, **url_confirmation** |
| `bienvenue` | prenom, departement, **url_desabonnement** |
| `demande-recue` | prenom, **entreprise_demandeuse**, metier, commune, periode, **url_demande** |
| `demande-acceptee` | prenom, **entreprise**, **url_conversation** |
| `demande-refusee` | prenom, **entreprise**, motif, url_recherche *(sans elle : pas de bouton, et le message reste complet)* |
| `message-recu` | prenom, **expediteur**, extrait, **url_conversation** |
| `paiement-echoue` | prenom, raison, prochaine_tentative, **url_paiement** |
| `facture-disponible` | prenom, **numero**, periode, **url_facture** |

**Aucun champ de montant n'existe, et un champ qui y ressemble est refusé** (`montant`, `prix`,
`tarif`, `euro`, `somme`, `ht`, `ttc`). Le prix de l'abonnement n'est pas arrêté : le montant d'une
facture vit dans la facture.

**L'idempotence** : `cle_idempotence` empêche le doublon quand un déclencheur tire deux fois.
Attention à sa portée réelle : la mémoire vit **dans l'instance** de la fonction, dix minutes. Elle
arrête un double appel rapproché, pas une reprise après redémarrage. La seule protection solide
serait une contrainte d'unicité en base, sur la table du point 5.

---

## 5. Ce que cette fonction attend d'ailleurs, sans le créer

**Tables existantes, utilisées indirectement** (l'appelant lit, la fonction ne lit rien) :

- `public.inscriptions` (`crm/supabase/migration-inscriptions.sql`) : la colonne `jeton`, qui ne
  doit **jamais** transiter par un navigateur. C'est le déclencheur, côté serveur, qui compose
  `https://a-dispo.fr/confirmation?jeton=<jeton>` et la passe à cette fonction.

**Tables écrites par les autres chantiers.** Elles ont été relues le 13/09/2026 dans
`crm/supabase/migration-recherche-relations.sql`, `migration-messagerie-rgpd.sql` et
`migration-abonnement-pieces.sql`. Elles sont **nommées, jamais créées ni modifiées ici**. La
fonction n'en lit aucune : c'est l'appelant qui fournit des valeurs déjà résolues.

| Gabarit | Ce qui le déclenche, et où les valeurs se lisent |
|---|---|
| `demande-recue`, `demande-acceptee`, `demande-refusee` | `public.notifications`, genres `demande_recue`, `demande_acceptee`, `demande_refusee`, écrites par `public.notifier(...)` et le déclencheur `demandes_notifier()`. Les détails du chantier viennent de `public.demandes`. |
| `message-recu` | `public.messages` et `public.conversations`. La conversation s'ouvre par `public.ouvrir_conversation(p_demande)`. |
| `paiement-echoue` | `public.relances_paiement`, ligne de canal `email` et d'état `prevue`. La file se prend avec `public.reserver_relances(...)` et se solde avec `public.marquer_relance_envoyee(...)`. Le champ `prochaine_tentative` de l'email se remplit avec la `prevue_le` du rang suivant, s'il y en a un. |
| `facture-disponible` | `public.factures` : `numero`, `periode_du`, `periode_au`. **Jamais les colonnes de montant.** |
| `bienvenue` | La confirmation de la liste d'attente (`inscriptions.confirme_le`). Pour un artisan inscrit, le consentement se prouve dans `public.consentements` (`finalite` + `version`, un seul actif à la fois) : **rien de relationnel ne part sans une ligne active.** |

**Un piège mesuré sur les factures.** Les factures sont déposées dans un compartiment de stockage
**privé** (`migration-abonnement-pieces.sql` : le compartiment `factures` est créé avec
`public = false`). Une adresse de téléchargement est donc une **adresse signée qui expire**, servie
par `<projet>.supabase.co` et non par `a-dispo.fr`. Deux conséquences :

1. Le contrôle d'hôte de cette fonction la refusera tant que `<projet>.supabase.co` n'est pas
   déclaré dans `HOTES_LIENS`. C'est voulu : il faut le décider, pas le subir.
2. **Mieux vaut envoyer le lien vers l'espace** que l'adresse signée elle-même. Une adresse signée
   collée dans un email devient un lien mort quelques jours plus tard, et l'artisan qui rouvre son
   message six mois après pour sa comptabilité tombe sur une erreur.

**Un manque à signaler.** `public.notifications` déclare **sept** genres :
`demande_recue`, `demande_acceptee`, `demande_refusee`, `demande_annulee`, `demande_expiree`,
`evaluation_a_deposer`, `evaluation_publiee`. Ce chantier a écrit les **trois** que la mission
demandait. **Quatre genres n'ont donc pas d'email** : une demande annulée, une demande expirée, une
invitation à évaluer et une évaluation publiée resteront dans l'espace, sans notification par mail.
Ce n'est pas un oubli, c'est un périmètre : à ouvrir comme un chantier à part.

**Table attendue, qui n'existe pas** : `public.emails_envoyes`, le journal des envois.

```
id                   uuid primary key default gen_random_uuid()
cree_le              timestamptz not null default now()
gabarit              text not null
destinataire_masque  text not null        -- « j***@exemple.fr », jamais l'adresse en clair
fournisseur          text not null
reussi               boolean not null
identifiant          text                 -- l'identifiant rendu par le fournisseur
erreur               text
cle_idempotence      text                 -- unique : c'est ce qui rendrait l'idempotence solide
```

Tant qu'elle manque, la fonction reconnaît l'erreur `PGRST205`, écrit une ligne dans ses logs et
**envoie quand même**.

---

## 6. Les variables d'environnement

| Variable | Rôle | Sans elle |
|---|---|---|
| `CLE_ENVOI` | Le secret d'appel. **Obligatoire.** | La fonction refuse tout (503). |
| `FOURNISSEUR_EMAIL` | `aucun` (défaut), `journal`, `resend`, `brevo`, `postmark`, `mailjet` | Refus net, pas de faux succès. |
| `FOURNISSEUR_CLE` | La clé d'API du service. | 503 `non_branche`. |
| `FOURNISSEUR_CLE_2` | La clé secrète (Mailjet seulement). | 503 `non_branche`. |
| `FOURNISSEUR_FLUX` | Le flux de messages (Postmark). Défaut `outbound`. | Flux par défaut. |
| `EXPEDITEUR_EMAIL` | L'adresse d'expédition. **Obligatoire pour envoyer.** | 503 `non_branche`. |
| `EXPEDITEUR_NOM` | Défaut : `À dispo`. | Le défaut. |
| `REPONDRE_A` | L'adresse de réponse, si différente. | Les réponses vont à l'expéditeur. |
| `URL_SITE` | Défaut `https://a-dispo.fr`. Donne l'hôte autorisé dans les liens. | Le défaut. |
| `HOTES_LIENS` | Hôtes légitimes en plus, séparés par des virgules. | Seul le domaine du site est accepté. |
| `MENTIONS_LEGALES` | Raison sociale, forme, adresse. | Les messages relationnels ne partent pas. |
| `DESABO_UN_CLIC` | `1` **seulement** si `/desabonnement` accepte un POST (RFC 8058). | L'en-tête de désinscription reste un simple lien. |
| `JOURNAL_BASE` | `1` pour journaliser en base. | Pas de journal en base. |

Un nom inconnu dans `FOURNISSEUR_EMAIL` **ne tombe pas sur un défaut silencieux** : il vaut
`aucun`, qui refuse et explique. Une faute de frappe se voit tout de suite.

---

## 7. Comment contrôler sans rien envoyer

**Le rapport mesuré**, qui rend les huit gabarits et compte tout ce qui doit être compté :

```bash
curl -s -H "x-cle-envoi: $CLE_ENVOI" \
  "https://<projet>.supabase.co/functions/v1/envoyer-email?controle=1" | jq
```

Il rend, par gabarit : l'objet et sa longueur, le poids du HTML et du texte, la présence du lien de
désinscription, les mots interdits trouvés, les marqueurs `[A COMPLETER]` restés dans le rendu, et
la détection d'un montant. Et en tête, l'état de la configuration : ce qui manque, et où.

**Voir un email dans un navigateur :**

```bash
curl -s -H "x-cle-envoi: $CLE_ENVOI" \
  "https://<projet>.supabase.co/functions/v1/envoyer-email?apercu=demande-recue" > /tmp/a.html
```

**Tout écrire sans rien envoyer :** poser `FOURNISSEUR_EMAIL=journal`. Le message rendu part dans
le journal de la fonction, avec l'adresse masquée. C'est ce mode qui a servi aux 26 essais.

**En local**, sans déployer :

```bash
supabase functions serve envoyer-email --env-file .env.local
```

Le fichier `.env.local` est à créer à la main, il porte des secrets et **n'est pas versionné** :
la ligne `.env*` du `.gitignore` de la racine l'exclut déjà (vérifié le 13/09/2026).

---

## 8. Ce qui reste à trancher

1. **Le service d'envoi.** Les quatre branchements écrits sont des candidats, pas une
   recommandation : aucun n'a été essayé, et le prix n'a pas été comparé ici.
2. **L'adresse d'expédition** et l'adresse de réponse : la même, ou deux ? Une adresse de réponse
   qui n'est relevée par personne se retourne toujours contre nous.
3. **La politique de relance d'un paiement refusé** : la mécanique existe désormais
   (`public.relances_paiement`, rangs 1 à 10, canal et date programmés un par un), mais **le
   contenu de la politique n'est pas écrit** : combien de relances, à quel rythme, et au bout de
   combien de temps l'accès se ferme. Le gabarit n'invente rien et n'affiche une date de nouvelle
   tentative que si l'appelant la lui donne.
4. **Le désabonnement en un clic** (RFC 8058) : il demande une page qui accepte un POST. Tant
   qu'elle n'existe pas, `DESABO_UN_CLIC` reste à zéro, sinon les désinscriptions de Gmail
   échouent en silence.
5. **La conservation du journal des envois** : combien de temps on garde une ligne. À poser avec le
   registre des traitements.
