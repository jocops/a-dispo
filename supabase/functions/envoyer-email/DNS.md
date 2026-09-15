# Ce qu'il faut déclarer dans le DNS pour qu'un email parte

> Fichier d'accompagnement de `supabase/functions/envoyer-email/`.
> Tout ce qui suit est un **geste humain chez OVH**, dans le compte du domaine.
> Aucun code ne peut le faire : personne ici n'a accès au compte OVH de `a-dispo.fr`.
> **Tant que ces enregistrements ne sont pas posés, le service d'envoi peut être parfaitement
> configuré, les emails partiront dans les indésirables ou seront rejetés.**

---

## 1. Ce qui est vrai aujourd'hui, mesuré

Relevé le **13/09/2026 à 22:27**, avec `dig` depuis cette machine.

| Ce qu'on demande | Ce que répond le DNS |
|---|---|
| `dig NS a-dispo.fr` | `ns200.anycast.me` et `dns200.anycast.me` |
| `dig TXT a-dispo.fr` | `"v=spf1 include:mx.ovh.com -all"` |
| `dig TXT mx.ovh.com` | `"v=spf1 ptr:mail-out.ovh.net ptr:mail.ovh.net ip4:8.33.137.105/32 ip4:192.99.77.81/32 ?all"` |
| `dig MX a-dispo.fr` | `mx1`, `mx2`, `mx3.mail.ovh.net` |
| `dig TXT _dmarc.a-dispo.fr` | **rien** |
| `dig TXT default._domainkey.a-dispo.fr` et 9 autres sélecteurs courants | **rien** |
| `dig A a-dispo.fr` | `188.165.53.185` |

Trois conclusions, et elles commandent tout le reste.

1. **La zone est encore servie par OVH**, pas par Cloudflare (`anycast.me` est OVH).
   `DEPLOIEMENT.md` annonce la zone gérée dans Cloudflare : ce n'est pas encore le cas.
   **Les enregistrements ci-dessous se posent donc chez OVH** (Noms de domaine > `a-dispo.fr` >
   Zone DNS). Le jour où les serveurs de noms basculent chez Cloudflare, il faudra vérifier qu'ils
   ont bien été repris : le scan d'import n'attrape pas toujours tout.
2. **Le SPF est strict et se termine par `-all`.** L'unique `include` renvoie vers OVH, dont le
   propre enregistrement se termine par `?all` (neutre). Un `include` ne « passe » que s'il rend
   un `pass` : un serveur qui n'est pas dans la liste d'OVH tombe donc sur le `-all` final, et
   c'est un **échec dur**, pas un avertissement.
3. **Il n'y a ni DKIM ni DMARC.** Rien ne signe les messages, rien ne dit aux destinataires quoi
   faire d'un message mal authentifié, et personne ne reçoit de rapport.

---

## 2. Le piège, dit précisément

On répète souvent « SPF vérifie l'expéditeur ». C'est faux, et la nuance décide de ce qu'il faut
poser.

**SPF vérifie l'adresse de retour de l'enveloppe** (le `Return-Path`, celui qui reçoit les
rebonds), **pas l'adresse `From:` que voit l'artisan.** D'où trois cas, et trois seulement :

| Cas | Ce qui se passe |
|---|---|
| **A.** On envoie par le serveur SMTP d'OVH, avec une adresse `@a-dispo.fr` | SPF **passe déjà**, sans rien changer : OVH est dans la liste. Rien à faire côté SPF. |
| **B.** On envoie par un service tiers qui met **son propre** `Return-Path` | SPF passe, mais **pour le domaine du fournisseur**, pas pour le nôtre. Le `From:` en `@a-dispo.fr` n'est donc **pas aligné**. Sans DKIM à notre nom, le message est authentifié « au nom de quelqu'un d'autre » : Gmail l'affiche comme tel, et le classe souvent en indésirable. |
| **C.** On envoie par un service tiers avec un `Return-Path` en `@a-dispo.fr` sans l'avoir déclaré dans notre SPF | **Échec dur** à cause du `-all`. Message **rejeté**. C'est le cas le plus brutal, et le plus fréquent quand on branche un fournisseur à la va-vite. |

**La conclusion pratique : DKIM n'est pas une option.** C'est la seule signature qui reste attachée
au domaine quel que soit le chemin. SPF ne suffit dans aucun des cas B ou C.

---

## 3. Les enregistrements à ajouter, exactement

### 3.1 DKIM : obligatoire, valeur donnée par le fournisseur

Forme exacte, une fois le service d'envoi choisi (voir LISEZMOI.md, décision en attente) :

```
Type  : TXT           (certains fournisseurs demandent un CNAME à la place)
Nom   : <selecteur>._domainkey.a-dispo.fr
Valeur: v=DKIM1; k=rsa; p=[A COMPLETER : clé publique fournie par le service d'envoi]
TTL   : 3600
```

- `<selecteur>` est **donné par le fournisseur** (`resend`, `mj`, `brevo1`, `pm`...). Ne pas
  l'inventer : un sélecteur qui ne correspond pas à la clé privée du signataire ne signe rien.
- Certains services donnent **deux** enregistrements (rotation de clé). Poser les deux.
- Clé de 2048 bits quand le choix est offert.

### 3.2 SPF : une seule ligne, et le `-all` reste

Il ne doit **jamais** y avoir deux enregistrements SPF sur un domaine : deux lignes rendent un
`permerror`, ce qui est pire qu'aucune ligne. On **modifie** celle qui existe, on n'en ajoute pas.

Ligne actuelle :

```
v=spf1 include:mx.ovh.com -all
```

Ligne à publier, selon le service retenu (à confirmer dans le tableau de bord du fournisseur le
jour du choix : ce qui suit vient de leur documentation publique, pas d'un compte ouvert) :

```
Brevo     : v=spf1 include:mx.ovh.com include:spf.brevo.com -all
Mailjet   : v=spf1 include:mx.ovh.com include:spf.mailjet.com -all
Postmark  : v=spf1 include:mx.ovh.com -all          (inchangé : Postmark demande un CNAME de
                                                     rebond, voir 3.4, plutôt qu'un include)
Resend    : v=spf1 include:mx.ovh.com -all          (inchangé : Resend fait signer un
                                                     sous-domaine, voir 3.4)
OVH seul  : v=spf1 include:mx.ovh.com -all          (inchangé, cas A)
```

Deux règles à ne pas perdre de vue :

- **Le `-all` reste à la fin.** Le passer à `~all` « pour être tranquille » ouvre le domaine à
  l'usurpation, et c'est exactement ce contre quoi on se protège.
- **Maximum 10 résolutions DNS** dans la chaîne SPF, `include` compris. Avec deux `include` on est
  très loin du plafond. Au troisième, vérifier avec un outil de contrôle SPF avant de publier.

### 3.3 DMARC : à poser, en trois temps

Il n'existe pas aujourd'hui. Sans lui, personne ne dit aux destinataires quoi faire d'un message
mal authentifié, et **aucun rapport ne remonte** : on découvrirait un problème de délivrabilité par
un artisan qui appelle, des semaines plus tard.

**Temps 1, à poser dès maintenant, sans risque** (observation seule, ne fait rejeter aucun email) :

```
Type  : TXT
Nom   : _dmarc.a-dispo.fr
Valeur: v=DMARC1; p=none; rua=mailto:[A COMPLETER : adresse qui recevra les rapports]; adkim=s; aspf=s; fo=1
TTL   : 3600
```

**Temps 2**, après deux à quatre semaines de rapports lus, si tout ce qui part est bien signé :

```
Valeur: v=DMARC1; p=quarantine; pct=100; rua=mailto:[A COMPLETER]; adkim=s; aspf=s; fo=1
```

**Temps 3**, quand plus rien d'illégitime n'apparaît dans les rapports :

```
Valeur: v=DMARC1; p=reject; rua=mailto:[A COMPLETER]; adkim=s; aspf=s; fo=1
```

Ce que disent ces lettres, puisqu'on ne copie pas une ligne qu'on ne comprend pas :

- `p=` ce que le destinataire fait d'un message non authentifié : rien, mise en quarantaine, rejet.
- `rua=` où arrivent les rapports agrégés quotidiens. **Une adresse qui existe et qui est lue.**
- `adkim=s` et `aspf=s` : alignement **strict**. Un sous-domaine ne suffit pas, il faut
  exactement `a-dispo.fr`. C'est plus exigeant que le défaut (`r`, relâché), et c'est voulu :
  on part propre.
- `fo=1` : demander un rapport dès qu'une authentification échoue, pas seulement quand tout échoue.

### 3.4 Le chemin de retour, selon le fournisseur

C'est ce qui aligne le `Return-Path` sur notre domaine (cas B ci-dessus). D'après la documentation
publique de chacun, à confirmer le jour du choix :

```
Postmark : CNAME  pm-bounces.a-dispo.fr        ->  pm.mtasv.net
Resend   : MX     send.a-dispo.fr              ->  feedback-smtp.<région>.amazonses.com  (priorité 10)
           TXT    send.a-dispo.fr              ->  "v=spf1 include:amazonses.com ~all"
Brevo    : rien de particulier (l'include SPF de 3.2 suffit)
Mailjet  : rien de particulier (l'include SPF de 3.2 suffit)
```

### 3.5 Ce qu'il ne faut surtout pas toucher

- **Les MX.** `mx1`, `mx2`, `mx3.mail.ovh.net` font arriver le courrier du domaine. Un service
  d'envoi ne demande jamais de les changer. Si un tutoriel le demande, c'est qu'on a mal lu.
- **L'enregistrement A** `188.165.53.185` : c'est le site, pas la messagerie.
- Le jour de la bascule vers Cloudflare, **revérifier MX, SPF, DKIM et DMARC après coup** avec la
  section 5 : une bascule de serveurs de noms déplace toute la zone, messagerie comprise
  (`DEPLOIEMENT.md` le signale déjà pour les MX).

---

## 4. Ce que le fournisseur demande en plus du DNS

Aucun service sérieux n'envoie pour un domaine qu'on n'a pas prouvé. Après avoir posé le DKIM :

1. Ajouter le domaine `a-dispo.fr` dans le tableau de bord du service.
2. Cliquer sur « vérifier » et attendre la propagation (de quelques minutes à quelques heures).
3. **Envoyer un premier message vers une adresse à soi**, puis ouvrir l'original du message
   (Gmail : les trois points, « Afficher l'original ») et lire :
   ```
   SPF   : PASS
   DKIM  : PASS   avec  d=a-dispo.fr      <- c'est ce « d= » qui compte
   DMARC : PASS
   ```
   Un `DKIM: PASS` avec `d=` le domaine du fournisseur n'est **pas** un succès : le message est
   signé au nom de quelqu'un d'autre.

Gmail et Yahoo exigent depuis 2024 SPF, DKIM et DMARC des expéditeurs, avec des seuils de volume
qui leur sont propres. Le seuil exact est à revérifier chez eux avant le lancement : il n'est pas
recopié ici, parce qu'un chiffre non vérifié est un chiffre faux.

---

## 5. Comment contrôler, après

```bash
dig +short TXT a-dispo.fr                       # une seule ligne v=spf1, finissant par -all
dig +short TXT _dmarc.a-dispo.fr                # v=DMARC1; p=...
dig +short TXT <selecteur>._domainkey.a-dispo.fr  # v=DKIM1; k=rsa; p=...
dig +short MX a-dispo.fr                        # les trois mx*.mail.ovh.net, intacts
```

Le contrôle qui compte reste le point 4.3 : l'en-tête d'un message réellement reçu. Le DNS peut
être parfait et le fournisseur mal configuré.

---

## 6. Les gestes humains, dans l'ordre, et qui les fait

| # | Geste | Qui | Bloqué aujourd'hui par |
|---|---|---|---|
| 1 | Trancher le service d'envoi | Claire-Marie et Joan | Décision en attente |
| 2 | Créer le compte et y déclarer `a-dispo.fr` | Joan | Dépend du 1 |
| 3 | Créer l'adresse d'expédition (`[A COMPLETER]@a-dispo.fr`) | Joan, chez OVH | Accès OVH |
| 4 | Poser le DKIM (3.1) et, si besoin, l'include SPF (3.2) | Joan, chez OVH | **Accès OVH : personne ici ne l'a** |
| 5 | Poser le DMARC `p=none` (3.3) | Joan, chez OVH | Accès OVH, et l'adresse `rua=` |
| 6 | Envoyer un message d'essai et lire ses en-têtes (4.3) | Joan | Dépend du 2 au 5 |
| 7 | Durcir le DMARC en `quarantine` puis `reject` | Joan | Deux à quatre semaines de rapports |

**Ce qui bloque tout le reste, c'est le point 4.** Il ne demande pas de code, il demande le mot de
passe du compte OVH et dix minutes.

---

## 7. Les marqueurs à compléter dans ce fichier

- `[A COMPLETER : clé publique fournie par le service d'envoi]` (DKIM, 3.1)
- `[A COMPLETER : adresse qui recevra les rapports]` (DMARC `rua=`, 3.3)
- `[A COMPLETER]@a-dispo.fr` : l'adresse d'expédition (6, ligne 3)
- Le sélecteur DKIM et la région du fournisseur (3.1 et 3.4), connus une fois le compte ouvert
