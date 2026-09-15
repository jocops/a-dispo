-- ============================================================
-- LA MESSAGERIE INTERNE, ET LE VOLET RGPD.
--
-- Ligne du devis N°20260910-1, SIGNE : « Integration d'une messagerie
-- interne », 2 jours, 480 € (source : plan/index.html, ligne 451). Ce n'est
-- pas une option a discuter : c'est une prestation payee, elle se construit.
--
-- ------------------------------------------------------------------
-- CE QUI GOUVERNE TOUT CE FICHIER, ET QU'IL FAUT LIRE AVANT LE RESTE.
--
-- ON N'OUVRE PAS UNE CONVERSATION AVEC N'IMPORTE QUI. Une conversation
-- n'existe qu'adossee a une mise en relation ACCEPTEE. Sans cette regle, la
-- plateforme devient un annuaire de numeros gratuits : le premier demarcheur
-- venu s'inscrit, ecrit a 400 artisans en une nuit, et les vrais partent. La
-- regle n'est pas un reglage d'interface, elle est portee par la base : il
-- n'existe AUCUNE politique d'insertion sur `conversations`. Le seul chemin
-- est la fonction `ouvrir_conversation()`, qui verifie la demande acceptee
-- avant d'ecrire. Une regle qui vit dans une page se contourne en lisant le
-- code source de cette page.
--
-- ------------------------------------------------------------------
-- CE QUE J'ATTENDS DE `public.demandes`, QUE JE NE CREE PAS.
--
-- La table des demandes de mise en relation est construite en ce moment meme
-- par un autre chantier (crm/supabase/migration-recherche-relations.sql). Je
-- ne la cree pas, je ne la modifie pas : je m'y adosse. Voici le contrat dont
-- j'ai besoin, et rien de plus :
--
--   · `public.demandes.id`              uuid, cle primaire ;
--   · `public.demandes.demandeur_id`    uuid, celui qui a demande ;
--   · `public.demandes.destinataire_id` uuid, celui a qui on demande ;
--   · `public.demandes.etat`            text, qui vaut 'acceptee' quand la
--                                       mise en relation est acceptee.
--
-- CONTRAT VERIFIE, ET NON SUPPOSE. Releve le 13/09/2026 dans
-- crm/supabase/migration-recherche-relations.sql, lignes 629 a 653 : `id uuid
-- primary key default gen_random_uuid()`, `demandeur_id uuid not null`,
-- `destinataire_id uuid not null`, et `etat` en liste fermee
-- ('envoyee','vue','acceptee','refusee','annulee','expiree'). Les quatre
-- colonnes attendues sont la, avec les bons types, et 'acceptee' est bien la
-- valeur qui marque l'acceptation. Rien a corriger dans l'adaptateur.
--
-- Pourquoi uuid et pas un entier qui s'incremente : l'identifiant d'une
-- demande voyage dans une adresse (/demandes?d=...) et dans un mail de
-- notification. Un entier sequentiel se devine en ajoutant 1, et permet de
-- mesurer le nombre de demandes de la plateforme en en creant deux. C'est la
-- meme raison qui a fait choisir uuid pour `inscriptions`.
--
-- CE QUE LA LECTURE DE LEUR FICHIER A CHANGE ICI, ET C'EST IMPORTANT. Leurs
-- deux colonnes `demandeur_id` et `destinataire_id` sont en `on delete
-- cascade` vers `artisans`. Donc le jour ou un compte disparait, SES DEMANDES
-- DISPARAISSENT AVEC LUI. Si `conversations.demande_id` avait ete pose en
-- `on delete cascade`, la suppression d'un compte aurait emporte les
-- conversations, donc les messages, donc le fil de l'autre. Le `on delete set
-- null` de la section 2.1 n'est pas une precaution theorique : il est la
-- reponse mesuree a ce comportement-la.
--
-- UN SEUL ENDROIT DE CE FICHIER CONNAIT LA FORME DE CETTE TABLE : la fonction
-- `relation_acceptee()`. Si l'autre chantier renomme ses colonnes un jour,
-- c'est cette fonction-la qu'on corrige, et elle seule : trois lignes de SQL.
--
-- SI LA TABLE N'EXISTE PAS ENCORE au moment ou ce fichier est joue : la
-- migration ne tombe pas. Elle pose tout le reste, elle affiche un avis
-- lisible, et la contrainte de cle etrangere se pose toute seule au prochain
-- passage. Tant que la table manque, `ouvrir_conversation()` refuse avec une
-- phrase en francais et le geste humain qui debloque, jamais avec une erreur
-- Postgres illisible.
--
-- ------------------------------------------------------------------
-- AUCUNE PIECE JOINTE, ET C'EST DELIBERE.
--
-- Trois raisons, dans l'ordre de leur poids :
--   1. Un fichier televerse par un tiers est une surface d'attaque : il faut
--      verifier le type reel et pas l'extension, se proteger des images
--      piegees, et ne jamais servir le fichier depuis le meme domaine que
--      l'application. C'est un chantier a part entiere, pas une colonne.
--   2. Le stockage se paie au mois, pour toujours. Un artisan qui envoie
--      quinze photos de chantier par semaine coute plus cher que son
--      abonnement, et l'abonnement n'est pas arrete.
--   3. Personne ne l'a demande. Aucune ligne du devis, aucune question de la
--      page d'aide, aucun retour de Claire-Marie ne parle de piece jointe.
-- Le jour ou ca se demande, ca se chiffre et ca s'ajoute. Il n'y a donc ni
-- colonne `fichier`, ni compartiment de stockage : ce qui n'existe pas ne
-- fuite pas et ne coute rien.
--
-- ------------------------------------------------------------------
-- LE VOLET RGPD, DANS LE MEME FICHIER, ET POURQUOI.
--
-- Parce que la messagerie est precisement ce qui fait entrer le projet dans
-- le RGPD pour de bon : jusqu'ici la base contenait des fiches que leur
-- proprietaire remplissait ; a partir d'ici elle contient ce que des gens
-- s'ecrivent. Traiter le consentement, l'export et la suppression dans un
-- second fichier « plus tard » revient a livrer une messagerie sans porte de
-- sortie. On pose les deux ensemble.
--
-- Trois idees portent ce volet :
--   · UN CONSENTEMENT QUI NE PEUT PAS SE PROUVER N'EXISTE PAS. On garde donc
--     la finalite, la date, ET LA VERSION EXACTE DU TEXTE accepte. « Il a
--     coche la case » ne vaut rien si on ne sait plus ce que disait la case.
--   · CE QUI NE PEUT PAS ETRE EFFACE DOIT ETRE ANONYMISE, PAS CONSERVE EN
--     CLAIR. Voir la section 3.5 pour la difference, longuement.
--   · UNE DEMANDE RGPD SE JOURNALISE. Qui a demande quoi, quand, et si c'est
--     fait. L'article 12.3 du RGPD donne un mois pour repondre : sans
--     journal, ce delai n'est ni tenu ni prouvable.
--
-- ------------------------------------------------------------------
-- LA REGLE DES IDENTIFIANTS, TENUE PARTOUT DANS CE FICHIER.
-- uuid quand l'identifiant voyage dans une adresse ou dans un mail
-- (conversations, demandes RGPD). Entier qui s'incremente quand il ne sert
-- qu'en interne et que le volume compte (messages, signalements, blocages,
-- consentements).
--
-- ------------------------------------------------------------------
-- A JOUER APRES, DANS CET ORDRE : schema.sql, migration-admin.sql,
-- migration-espace-artisan.sql. Les controles de la section 1 le verifient et
-- le disent en clair.
--
-- LES ACCENTS. Les commentaires n'en portent pas, comme dans les deux
-- dernieres migrations du depot. Les phrases destinees a etre AFFICHEES a un
-- artisan en portent, evidemment : ce sont elles qu'il lira a l'ecran.
--
-- Rejouable de bout en bout : tout est en `if not exists` / `or replace` /
-- `drop ... if exists`. Aucune donnee n'est detruite par un second passage.
-- ============================================================


-- ============================================================
-- 1. CONTROLES PREALABLES
--
-- Une migration qui echoue sur « relation "public.artisans" does not exist »
-- fait perdre un quart d'heure a celui qui la joue. Elle doit dire quel
-- fichier manque, et lequel jouer.
-- ============================================================

do $$
begin
  if to_regclass('public.artisans') is null then
    raise exception 'La table public.artisans n''existe pas.'
      using hint = 'Jouer d''abord crm/supabase/migration-espace-artisan.sql, puis rejouer ce fichier.';
  end if;
  if to_regprocedure('public.est_admin()') is null then
    raise exception 'La fonction public.est_admin() n''existe pas.'
      using hint = 'Jouer d''abord crm/supabase/schema.sql puis crm/supabase/migration-admin.sql, puis rejouer ce fichier.';
  end if;
  -- L'export RGPD doit rassembler TOUT ce que la base sait de la personne, y
  -- compris son inscription a la liste d'attente et sa fiche de prospection.
  -- Ces deux tables sont donc une dependance de ce fichier, pas un bonus.
  if to_regclass('public.inscriptions') is null then
    raise exception 'La table public.inscriptions n''existe pas.'
      using hint = 'Jouer d''abord crm/supabase/migration-inscriptions.sql : l''export RGPD doit pouvoir rendre la ligne de liste d''attente de la personne.';
  end if;
  if to_regclass('public.contacts') is null then
    raise exception 'La table public.contacts n''existe pas.'
      using hint = 'Jouer d''abord crm/supabase/schema.sql : l''export RGPD doit pouvoir rendre la fiche de prospection de la personne.';
  end if;
end;
$$;

-- L'INTERRUPTEUR D'ECRITURE INTERNE.
--
-- Plusieurs declencheurs de ce fichier gelent des colonnes pour empecher un
-- navigateur de les reecrire. Mais certaines fonctions de ce meme fichier ont
-- BESOIN d'y toucher : la date du dernier message, et l'anonymisation au
-- moment de la suppression du compte. Sans interrupteur, le gel annulerait
-- silencieusement ces ecritures-la, et l'anonymisation n'aurait pas lieu.
--
-- Le drapeau est POSE POUR LA SEULE TRANSACTION en cours (`set_config` avec
-- `is_local` a vrai). Il n'est pas atteignable depuis un navigateur : l'API
-- de Supabase ne laisse fixer que ses propres reglages (`request.*`), jamais
-- un reglage arbitraire. Il ne remplace donc aucune politique de securite, il
-- distingue seulement nos ecritures des leurs.
create or replace function public.ecriture_interne()
returns boolean
language sql
stable
as $$ select coalesce(current_setting('dispo.interne', true), '') = 'oui' $$;


-- ============================================================
-- 2. LA MESSAGERIE
-- ============================================================

-- ----------------------------------------------------- 2.1 les conversations
--
-- LE COUPLE EST ORDONNE. `artisan_bas` porte toujours le plus petit des deux
-- identifiants. Sans cet ordre, (A,B) et (B,A) sont deux lignes differentes
-- pour la meme chose, et toute recherche doit tester les deux sens.
--
-- `demande_id` EST NULLABLE, ET CE N'EST PAS UN RELACHEMENT DE LA REGLE.
-- La regle « pas de conversation sans mise en relation acceptee » est tenue a
-- l'OUVERTURE, par `ouvrir_conversation()`, qui refuse sans demande acceptee.
-- La colonne accepte le vide pour une seule raison : une conversation ne doit
-- JAMAIS etre detruite par la disparition de la demande qui l'a ouverte. La
-- cle etrangere est donc en `on delete set null`. Un message efface par effet
-- de bord est un message perdu pour les deux, et personne ne comprend
-- pourquoi. Ce n'est pas une precaution en l'air : `public.demandes` rattache
-- ses deux artisans en `on delete cascade` (verifie le 13/09/2026), donc la
-- suppression d'un compte efface ses demandes. En cascade, elle aurait efface
-- les conversations et les messages de l'autre avec.
--
-- UNE CONVERSATION PAR DEMANDE, ET NON PAR PERSONNE. Deux artisans qui
-- travaillent ensemble trois fois dans l'annee ont trois chantiers
-- differents. Un fil unique melangerait les trois, et plus personne ne
-- retrouverait ce qui avait ete dit sur lequel. Le fil suit le chantier.
--
-- LES DEUX COTES SONT EN `on delete set null`. Quand un compte disparait, la
-- conversation reste lisible par CELUI QUI RESTE. C'est exactement le
-- principe du volet RGPD : ce qui ne peut pas etre efface sans detruire la
-- donnee d'un tiers est anonymise.

create table if not exists public.conversations (
  id           uuid primary key default gen_random_uuid(),
  demande_id   uuid,
  artisan_bas  uuid references public.artisans(id) on delete set null,
  artisan_haut uuid references public.artisans(id) on delete set null,
  cree_le      timestamptz not null default now(),
  -- Recopie a chaque envoi par le declencheur de la section 2.6. C'est ce qui
  -- permet de trier la liste des conversations sans lire la table des
  -- messages : sur un telephone, cette economie se voit.
  dernier_le   timestamptz,
  -- Une conversation fermee reste LISIBLE et devient muette. On ne supprime
  -- pas un echange entre professionnels : il peut servir de preuve d'un
  -- accord de sous-traitance.
  ferme_le     timestamptz,
  constraint couple_ordonne check (artisan_bas is null or artisan_haut is null
                                   or artisan_bas < artisan_haut)
);

create unique index if not exists conversations_demande_unique
  on public.conversations (demande_id) where demande_id is not null;
create index if not exists conversations_bas_idx
  on public.conversations (artisan_bas, dernier_le desc);
create index if not exists conversations_haut_idx
  on public.conversations (artisan_haut, dernier_le desc);

-- La cle etrangere vers `public.demandes` se pose ici, et seulement si la
-- table de l'autre chantier existe ET porte bien un `id` de type uuid. Si ce
-- n'est pas le cas, on le DIT et on continue : le fichier entier ne doit pas
-- echouer parce qu'un chantier voisin n'a pas encore atterri. Rejouer ce
-- fichier apres l'atterrissage pose la contrainte.
do $$
declare
  type_id text;
begin
  if to_regclass('public.demandes') is null then
    raise notice 'MESSAGERIE : public.demandes n''existe pas encore. Les tables sont posees, mais AUCUNE conversation ne pourra s''ouvrir tant que l''autre chantier (crm/supabase/migration-recherche-relations.sql) n''est pas joue. Rejouer ce fichier ensuite pour poser la cle etrangere.';
    return;
  end if;

  select data_type into type_id
    from information_schema.columns
   where table_schema = 'public' and table_name = 'demandes' and column_name = 'id';

  if type_id is distinct from 'uuid' then
    raise notice 'MESSAGERIE : public.demandes.id est de type % au lieu de uuid. La cle etrangere n''est pas posee. Voir le contrat attendu en tete de ce fichier, section « CE QUE J''ATTENDS DE public.demandes ».',
      coalesce(type_id, 'inexistant');
    return;
  end if;

  -- Le nom d'une contrainte n'est unique QUE par table : on verifie donc le
  -- couple (nom, table), sinon une contrainte homonyme ailleurs ferait croire
  -- que celle-ci est deja posee.
  if not exists (select 1 from pg_constraint
                  where conname = 'conversations_demande_fk'
                    and conrelid = 'public.conversations'::regclass) then
    alter table public.conversations
      add constraint conversations_demande_fk
      foreign key (demande_id) references public.demandes(id) on delete set null;
    raise notice 'MESSAGERIE : cle etrangere conversations.demande_id -> demandes.id posee.';
  end if;
end;
$$;

-- ---------------------------------------------------------- 2.2 les messages
--
-- UN MESSAGE NE SE MODIFIE NI NE SE SUPPRIME. Aucune politique de mise a jour
-- ni de suppression n'existe sur cette table. Deux raisons :
--   · un echange entre professionnels peut servir a rappeler ce qui avait ete
--     convenu sur un chantier ; un message reecrit apres coup ne vaut rien ;
--   · un message effacable rend le signalement inutile : il suffit d'insulter
--     puis d'effacer.
-- La seule ecriture possible apres coup est `lu_le`, et elle passe par la
-- fonction `marquer_lu()`, jamais par une politique ouverte sur la table.
--
-- UN SEUL `lu_le`, ET PAS UNE TABLE DE LECTURES. Une conversation a
-- exactement deux participants : le lecteur d'un message est toujours celui
-- qui ne l'a pas ecrit. Une table « qui a lu quoi » ajouterait une jointure a
-- chaque affichage sans rien apprendre de plus.
--
-- 4 000 CARACTERES. Au-dela, ce n'est plus un message, c'est un document. Les
-- documents ne sont pas dans ce lot : voir « aucune piece jointe » en tete.

create table if not exists public.messages (
  id              bigserial primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  -- `on delete set null` : le message survit a la disparition de son auteur.
  -- C'est le coeur de l'anonymisation de la section 3.5.
  auteur_id       uuid references public.artisans(id) on delete set null,
  corps           text not null,
  envoye_le       timestamptz not null default now(),
  lu_le           timestamptz,
  constraint corps_utile check (char_length(btrim(corps)) between 1 and 4000)
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, envoye_le);
-- L'index du compteur de non-lus, visible depuis n'importe quelle page : il
-- ne porte que sur les messages non lus, donc il reste petit meme quand la
-- table grossit. `envoye_le` y figure pour la relance par mail (section 4,
-- point 4) : « les messages non lus envoyes il y a plus de N heures » se lit
-- alors dans le meme index, sans balayer la table.
create index if not exists messages_non_lus_idx
  on public.messages (conversation_id, auteur_id, envoye_le) where lu_le is null;
-- L'index du plafond d'envoi (section 2.6) : compter les messages d'un auteur
-- sur la derniere heure sans balayer la table.
create index if not exists messages_auteur_idx
  on public.messages (auteur_id, envoye_le desc);

-- ---------------------------------------------------------- 2.3 les blocages
--
-- UNE PLACE DE MARCHE SANS BOUTON DE BLOCAGE DEVIENT IMPRATICABLE. Le premier
-- lourdaud suffit a faire partir quelqu'un qui n'a aucun moyen de l'arreter.
--
-- LE BLOCAGE EST A SENS UNIQUE MAIS IL COUPE LES DEUX SENS. A bloque B :
-- B ne peut plus ecrire a A, et A ne peut plus ecrire a B non plus. Sinon A
-- garderait le droit de harceler B tout en l'empechant de repondre.
--
-- `on delete cascade` DES DEUX COTES, contrairement au reste du fichier : un
-- blocage pose par un compte disparu, ou visant un compte disparu, ne protege
-- plus personne. Il n'a aucune valeur de trace. Ce qui garde une valeur de
-- trace, c'est le signalement, et lui est conserve.

create table if not exists public.blocages (
  id          bigserial primary key,
  bloqueur_id uuid not null references public.artisans(id) on delete cascade,
  bloque_id   uuid not null references public.artisans(id) on delete cascade,
  cree_le     timestamptz not null default now(),
  -- Facultatif : le motif sert a la moderation quand un signalement suit.
  motif       text,
  constraint pas_soi_meme check (bloqueur_id <> bloque_id),
  unique (bloqueur_id, bloque_id)
);

create index if not exists blocages_bloque_idx on public.blocages (bloque_id);

-- ------------------------------------------------------- 2.4 les signalements
--
-- LA MODERATION A BESOIN DE LA TRACE, pas seulement du bouton. Un signalement
-- qui ne laisse rien derriere lui ne permet ni de reperer le recidiviste, ni
-- de justifier une exclusion, ni de repondre a celui qui a signale.
--
-- UN SIGNALEMENT VISE UN MESSAGE, OU UN ARTISAN, OU LES DEUX. Un message
-- precis quand il y a une phrase a montrer ; un artisan quand c'est le
-- comportement d'ensemble qui pose probleme. Exiger un message forcerait a
-- signaler « un » message pour parler de quinze.
--
-- HOMONYME A CONNAITRE : le CRM porte deja une cle `signalements` DANS le
-- jsonb des contacts (crm/outils/extraire-contacts.py). Elle designe des
-- anomalies de fiche importees de Pipedrive, rien a voir avec celle-ci.
--
-- `signale_par` en `on delete set null` : la trace survit au depart de celui
-- qui a signale. La moderation garde le fait, elle perd le nom.

create table if not exists public.signalements (
  id           bigserial primary key,
  message_id   bigint references public.messages(id) on delete set null,
  artisan_vise uuid   references public.artisans(id) on delete set null,
  signale_par  uuid   references public.artisans(id) on delete set null,
  cree_le      timestamptz not null default now(),
  motif        text not null check (motif in
                 ('demarchage','insultes','hors_sujet','arnaque','usurpation','autre')),
  detail       text check (detail is null or char_length(detail) <= 2000),
  -- Le suivi de moderation. `decision` reste libre : figer une liste de
  -- decisions avant d'avoir traite le premier signalement, c'est deviner.
  traite_le    timestamptz,
  decision     text,
  constraint vise_quelque_chose check (message_id is not null or artisan_vise is not null)
);

create index if not exists signalements_a_traiter_idx
  on public.signalements (cree_le desc) where traite_le is null;
create index if not exists signalements_message_idx on public.signalements (message_id);
create index if not exists signalements_vise_idx    on public.signalements (artisan_vise);

-- ------------------------------------------- 2.5 la regle d'ouverture
--
-- L'ADAPTATEUR, ET LE SEUL ENDROIT QUI CONNAIT `public.demandes`.
--
-- `contrat_demandes()` repond a une seule question : la table de l'autre
-- chantier est-elle la, et porte-t-elle les colonnes dont j'ai besoin ? Elle
-- rend un texte, pas un booleen, parce qu'un « non » qui ne dit pas POURQUOI
-- oblige a ouvrir l'editeur SQL pour comprendre.

create or replace function public.contrat_demandes()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  manquantes text;
begin
  if to_regclass('public.demandes') is null then
    return 'table public.demandes absente';
  end if;
  select string_agg(c, ', ') into manquantes
    from unnest(array['id','demandeur_id','destinataire_id','etat']) as c
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'demandes'
                        and column_name = c);
  if manquantes is not null then
    return 'colonnes manquantes dans public.demandes : ' || manquantes;
  end if;
  return 'ok';
end;
$$;

comment on function public.contrat_demandes() is
  'Dit si la table des mises en relation de l''autre chantier est branchee, et ce qui manque sinon.';

-- Rend le couple d'une mise en relation ACCEPTEE, ou rien.
--
-- La requete est en SQL dynamique a dessein : c'est la marque visible que
-- cette fonction parle a une table qui ne m'appartient pas. Si l'autre
-- chantier a nomme ses colonnes autrement, c'est ces trois lignes qu'on
-- corrige, et rien d'autre dans le fichier.

create or replace function public.relation_acceptee(p_demande uuid)
returns table (demandeur uuid, destinataire uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  etat_contrat text := public.contrat_demandes();
begin
  if etat_contrat <> 'ok' then
    raise exception 'La mise en relation n''est pas encore branchée.'
      using hint = 'La table des demandes est construite par un autre chantier (crm/supabase/migration-recherche-relations.sql). Détail technique : ' || etat_contrat || '.';
  end if;
  return query execute
    'select d.demandeur_id, d.destinataire_id
       from public.demandes d
      where d.id = $1 and d.etat = ''acceptee'''
    using p_demande;
end;
$$;

-- OUVRIR UNE CONVERSATION. Le seul chemin vers une ligne de `conversations`.
--
-- Elle est idempotente : deux clics sur le bouton, ou deux onglets ouverts,
-- rendent la meme conversation au lieu d'en creer deux. C'est la base qui
-- tranche, pas le navigateur.
--
-- Chaque refus dit une phrase en francais ET le geste qui debloque. Un refus
-- muet produit un bouton mort, et un bouton mort fait partir l'artisan.

create or replace function public.ouvrir_conversation(p_demande uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  moi   uuid := auth.uid();
  couple record;
  autre uuid;
  fil   public.conversations;
begin
  if moi is null then
    raise exception 'Vous n''êtes pas connecté.'
      using hint = 'Reconnectez-vous depuis la page de connexion, puis rouvrez la demande.';
  end if;

  select * into couple from public.relation_acceptee(p_demande);

  if not found then
    raise exception 'Cette mise en relation n''est pas acceptée.'
      using hint = 'Une conversation ne s''ouvre qu''après acceptation : attendez la réponse, ou relancez depuis la demande.';
  end if;

  -- `is distinct from` et non `not in` : avec `not in`, une colonne vide du
  -- cote de l'autre chantier rendrait `null`, donc ni vrai ni faux, et le
  -- refus ne se declencherait pas. Un controle de securite qui ne se
  -- declenche pas sur une valeur vide n'est pas un controle.
  if moi is distinct from couple.demandeur
     and moi is distinct from couple.destinataire then
    raise exception 'Cette mise en relation ne vous concerne pas.'
      using hint = 'Revenez à vos demandes et ouvrez la conversation depuis la bonne ligne.';
  end if;

  autre := case when couple.demandeur = moi then couple.destinataire else couple.demandeur end;

  if exists (select 1 from public.blocages b
              where (b.bloqueur_id = moi and b.bloque_id = autre)
                 or (b.bloqueur_id = autre and b.bloque_id = moi)) then
    raise exception 'Cette conversation ne peut pas s''ouvrir.'
      using hint = 'Vous avez bloqué ce professionnel, ou il ne souhaite plus être contacté. Retirez le blocage depuis vos réglages si c''est une erreur.';
  end if;

  insert into public.conversations (demande_id, artisan_bas, artisan_haut)
  values (p_demande, least(couple.demandeur, couple.destinataire),
                     greatest(couple.demandeur, couple.destinataire))
  on conflict (demande_id) where demande_id is not null do nothing;

  select * into fil from public.conversations where demande_id = p_demande;
  return fil;
end;
$$;

revoke all on function public.ouvrir_conversation(uuid) from public;
grant execute on function public.ouvrir_conversation(uuid) to authenticated;
revoke all on function public.relation_acceptee(uuid) from public;
grant execute on function public.relation_acceptee(uuid) to authenticated;
revoke all on function public.contrat_demandes() from public;
grant execute on function public.contrat_demandes() to authenticated;

-- ------------------------------------------- 2.6 le garde-fou a l'envoi
--
-- Deux fonctions d'appui, toutes deux en `security definer` POUR LA MEME RAISON
-- que `est_actif()` et `est_admin()` dans migration-admin.sql : une politique
-- de securite qui interroge la table qu'elle protege tourne en rond, et
-- Postgres refuse la requete. On sort de la boucle par une fonction.

create or replace function public.est_membre_conversation(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
     where c.id = p_conversation
       and auth.uid() in (c.artisan_bas, c.artisan_haut))
$$;

-- La moderation ne lit QUE ce qui a ete signale. Une equipe qui peut lire
-- toutes les conversations privees n'a aucune raison technique de le faire,
-- et l'artisan a toutes les raisons de le redouter. Le droit de lecture est
-- donc adosse a l'existence d'un signalement sur le fil.
create or replace function public.fil_signale(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.signalements s
      join public.messages m on m.id = s.message_id
     where m.conversation_id = p_conversation)
$$;

-- LE PLAFOND D'ENVOI, contre le demarchage en masse.
--
-- LA VALEUR N'EST PAS MESUREE, et c'est ecrit ici plutot que cache dans un
-- declencheur : 30 messages par heure est une valeur d'attente, choisie pour
-- ne gener aucun usage normal (un artisan qui repond a dix confreres dans la
-- meme heure passe largement dessous). Elle est a arreter avec Claire-Marie
-- une fois le premier mois d'usage observe. Voir [A COMPLETER] en fin de
-- fichier. La changer coute une ligne et un `create or replace`.
create or replace function public.plafond_messages_par_heure()
returns integer
language sql
immutable
as $$ select 30 $$;

create or replace function public.messages_avant_envoi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fil   public.conversations;
  autre uuid;
  combien integer;
begin
  -- L'auteur n'est jamais celui que le navigateur pretend : c'est la session.
  if auth.uid() is not null then
    new.auteur_id := auth.uid();
  end if;
  -- Un message ne nait jamais lu, et jamais date par le client.
  new.lu_le := null;
  new.envoye_le := now();

  select * into fil from public.conversations where id = new.conversation_id;
  if fil is null then
    raise exception 'Cette conversation n''existe pas.'
      using hint = 'Revenez à la liste de vos conversations.';
  end if;

  if fil.ferme_le is not null then
    raise exception 'Cette conversation est fermée.'
      using hint = 'Elle reste lisible, mais on ne peut plus y écrire.';
  end if;

  -- `is distinct from` et non `not in` : voir `ouvrir_conversation()`. Quand
  -- un des deux cotes est vide (compte supprime), `not in` rend `null` et le
  -- refus ne partirait pas.
  if new.auteur_id is distinct from fil.artisan_bas
     and new.auteur_id is distinct from fil.artisan_haut then
    raise exception 'Cette conversation ne vous concerne pas.'
      using hint = 'Revenez à la liste de vos conversations.';
  end if;

  autre := case when fil.artisan_bas = new.auteur_id then fil.artisan_haut else fil.artisan_bas end;

  -- Les deux messages de refus sont DIFFERENTS a dessein. Celui qui a bloque
  -- doit savoir qu'il l'a fait et comment revenir en arriere ; celui qui est
  -- bloque n'a pas a l'apprendre, mais il ne doit pas non plus rester devant
  -- un bouton qui ne fait rien. On lui dit la verite utile : c'est fermé.
  if exists (select 1 from public.blocages b
              where b.bloqueur_id = new.auteur_id and b.bloque_id = autre) then
    raise exception 'Vous avez bloqué ce professionnel.'
      using hint = 'Retirez le blocage depuis vos réglages pour pouvoir lui écrire à nouveau.';
  end if;

  if exists (select 1 from public.blocages b
              where b.bloqueur_id = autre and b.bloque_id = new.auteur_id) then
    raise exception 'Cette conversation est fermée : votre interlocuteur ne souhaite plus être contacté ici.'
      using hint = 'Si vous aviez un chantier en cours ensemble, passez par les coordonnées qu''il vous a données, ou signalez-nous le problème.';
  end if;

  select count(*) into combien
    from public.messages m
   where m.auteur_id = new.auteur_id
     and m.envoye_le > now() - interval '1 hour';

  if combien >= public.plafond_messages_par_heure() then
    raise exception 'Vous avez envoyé beaucoup de messages en peu de temps.'
      using hint = 'Réessayez dans une heure. Cette limite existe pour empêcher le démarchage en masse.';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_avant_envoi on public.messages;
create trigger messages_avant_envoi before insert on public.messages
  for each row execute function public.messages_avant_envoi();

-- Apres l'envoi : la date du dernier message remonte sur la conversation.
-- Tenue par la base et non par le code : un champ de date tenu par le code
-- finit toujours par etre oublie dans une branche (meme raison que
-- `artisans_touche()` dans migration-espace-artisan.sql).
create or replace function public.messages_apres_envoi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Le drapeau autorise le declencheur de gel (section 2.8) a laisser passer
  -- CETTE ecriture-la. Sans lui, le gel remettrait l'ancienne date et la
  -- liste des conversations ne se reordonnerait jamais.
  perform set_config('dispo.interne', 'oui', true);
  update public.conversations set dernier_le = new.envoye_le where id = new.conversation_id;
  perform set_config('dispo.interne', 'non', true);
  return null;
end;
$$;

drop trigger if exists messages_apres_envoi on public.messages;
create trigger messages_apres_envoi after insert on public.messages
  for each row execute function public.messages_apres_envoi();

-- ------------------------------------------- 2.7 lire, et compter les non-lus
--
-- LA LISTE DES CONVERSATIONS EST UNE FONCTION, PAS UNE VUE. Elle doit rendre
-- l'identite de l'interlocuteur (prenom, entreprise, metier), et ces colonnes
-- vivent dans `artisans`, ou la politique de securite interdit de lire la
-- ligne d'un autre. Une vue en droits de l'appelant rendrait donc une liste
-- de conversations SANS AUCUN NOM : un ecran vide et incomprehensible. Une
-- fonction `security definer` ouvre une porte etroite, et cette porte ne
-- laisse passer QUE LES MEMES COLONNES QUE `fiches_publiques` : ni telephone,
-- ni SIRET, ni adresse. Ce qui ne sort pas ici ne peut pas fuiter.

create or replace function public.mes_conversations()
returns table (
  conversation_id       uuid,
  demande_id            uuid,
  interlocuteur_id      uuid,
  interlocuteur_prenom  text,
  interlocuteur_entreprise text,
  interlocuteur_metier  text,
  interlocuteur_commune text,
  interlocuteur_photo   text,
  dernier_le            timestamptz,
  dernier_extrait       text,
  dernier_de_moi        boolean,
  non_lus               integer,
  ferme                 boolean,
  bloque_par_moi        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with mes_fils as (
    select c.*,
           case when c.artisan_bas = auth.uid() then c.artisan_haut else c.artisan_bas end as autre
      from public.conversations c
     where auth.uid() in (c.artisan_bas, c.artisan_haut)
  )
  select f.id,
         f.demande_id,
         f.autre,
         a.prenom,
         a.denomination,
         coalesce(m.libelle, a.metier_libre),
         a.commune,
         a.photo_url,
         f.dernier_le,
         -- L'extrait, et pas le message entier : la liste ne sert pas a lire.
         left(dm.corps, 120),
         dm.auteur_id is not distinct from auth.uid(),
         (select count(*)::integer from public.messages n
           where n.conversation_id = f.id
             and n.lu_le is null
             and n.auteur_id is distinct from auth.uid()),
         f.ferme_le is not null,
         exists (select 1 from public.blocages b
                  where b.bloqueur_id = auth.uid() and b.bloque_id = f.autre)
    from mes_fils f
    -- `left join` : quand l'interlocuteur a supprime son compte, sa ligne
    -- n'existe plus. La conversation doit rester dans la liste, avec des
    -- colonnes vides que la page affiche « Compte supprimé ».
    left join public.artisans a on a.id = f.autre
    left join public.metiers  m on m.code = a.metier
    -- Toutes les colonnes sont prefixees, ici comme ailleurs dans cette
    -- fonction : les colonnes rendues par `returns table` sont aussi des noms
    -- de variables, et un nom nu qui existe des deux cotes fait echouer la
    -- fonction sur « column reference is ambiguous ».
    left join lateral (
      select mm.corps, mm.auteur_id
        from public.messages mm
       where mm.conversation_id = f.id
       order by mm.envoye_le desc limit 1
    ) dm on true
   order by f.dernier_le desc nulls last, f.cree_le desc
$$;

-- LE COMPTEUR GLOBAL, visible depuis n'importe quelle page (ligne du devis).
-- Un seul appel, un seul entier : c'est ce qui permet de l'afficher dans
-- l'en-tete de toutes les pages sans alourdir chaque chargement.
create or replace function public.mes_messages_non_lus()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::integer
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
   where m.lu_le is null
     and m.auteur_id is distinct from auth.uid()
     and auth.uid() in (c.artisan_bas, c.artisan_haut)
$$;

-- MARQUER LU. Une fonction et pas une politique de mise a jour : une
-- politique ouverte sur `messages` permettrait aussi de reecrire le corps du
-- message. Ici, une seule colonne bouge, et seulement sur les messages des
-- AUTRES (on ne « lit » pas ses propres messages).
create or replace function public.marquer_lu(p_conversation uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touche integer;
begin
  if not public.est_membre_conversation(p_conversation) then
    raise exception 'Cette conversation ne vous concerne pas.'
      using hint = 'Revenez à la liste de vos conversations.';
  end if;
  update public.messages
     set lu_le = now()
   where conversation_id = p_conversation
     and lu_le is null
     and auteur_id is distinct from auth.uid();
  get diagnostics touche = row_count;
  return touche;
end;
$$;

revoke all on function public.mes_conversations()      from public;
revoke all on function public.mes_messages_non_lus()   from public;
revoke all on function public.marquer_lu(uuid)         from public;
revoke all on function public.est_membre_conversation(uuid) from public;
revoke all on function public.fil_signale(uuid)        from public;
grant execute on function public.mes_conversations()      to authenticated;
grant execute on function public.mes_messages_non_lus()   to authenticated;
grant execute on function public.marquer_lu(uuid)         to authenticated;
grant execute on function public.est_membre_conversation(uuid) to authenticated;
grant execute on function public.fil_signale(uuid)        to authenticated;

-- --------------------------------------- 2.8 les autorisations de la messagerie
--
-- LA REGLE, PARTOUT : un artisan ne lit que SES conversations et SES
-- messages. La seule exception est la moderation, et elle est bornee aux fils
-- qui portent un signalement.

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.blocages      enable row level security;
alter table public.signalements  enable row level security;

-- CONVERSATIONS : lecture par les deux parties. AUCUNE insertion : le seul
-- chemin est `ouvrir_conversation()`. AUCUNE suppression : un echange entre
-- professionnels ne s'efface pas.
drop policy if exists "ses conversations" on public.conversations;
create policy "ses conversations" on public.conversations
  for select to authenticated
  using (auth.uid() in (artisan_bas, artisan_haut)
         or (public.est_admin() and public.fil_signale(id)));

-- Fermer une conversation : la seule mise a jour permise a une partie. Le
-- declencheur ci-dessous gele tout le reste, sinon cette politique
-- permettrait aussi de rattacher la conversation a une autre demande.
drop policy if exists "fermer sa conversation" on public.conversations;
create policy "fermer sa conversation" on public.conversations
  for update to authenticated
  using (auth.uid() in (artisan_bas, artisan_haut))
  with check (auth.uid() in (artisan_bas, artisan_haut));

create or replace function public.conversations_gel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ecriture_interne() and auth.uid() is not null and not public.est_admin() then
    new.id := old.id;
    new.demande_id := old.demande_id;
    new.artisan_bas := old.artisan_bas;
    new.artisan_haut := old.artisan_haut;
    new.cree_le := old.cree_le;
    new.dernier_le := old.dernier_le;
    -- On ferme, on ne rouvre pas : rouvrir un fil ferme par l'autre serait
    -- contourner sa decision.
    if old.ferme_le is not null then new.ferme_le := old.ferme_le; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists conversations_gel on public.conversations;
create trigger conversations_gel before update on public.conversations
  for each row execute function public.conversations_gel();

-- MESSAGES : lecture par les membres du fil, ecriture par le membre pour
-- lui-meme. Ni modification ni suppression, pour personne.
drop policy if exists "ses messages" on public.messages;
create policy "ses messages" on public.messages
  for select to authenticated
  using (public.est_membre_conversation(conversation_id)
         or (public.est_admin() and public.fil_signale(conversation_id)));

drop policy if exists "ecrire dans son fil" on public.messages;
create policy "ecrire dans son fil" on public.messages
  for insert to authenticated
  with check (public.est_membre_conversation(conversation_id));

-- BLOCAGES : chacun gere les siens, et personne ne voit qui l'a bloque.
-- Pas de politique de lecture pour la personne bloquee : elle n'apprend rien
-- de cette table. Ce qu'elle voit, c'est le message de refus a l'envoi, qui
-- lui dit la verite utile sans designer une decision qui ne lui appartient pas.
drop policy if exists "ses blocages" on public.blocages;
create policy "ses blocages" on public.blocages
  for all to authenticated
  using (bloqueur_id = auth.uid())
  with check (bloqueur_id = auth.uid());

-- SIGNALEMENTS : on depose le sien, on relit le sien. La moderation lit tout,
-- c'est son travail.
-- Celui qui signale est la session, jamais ce que le navigateur declare. La
-- page n'envoie donc que le message vise et le motif : un champ de moins a
-- remplir, et un champ de moins a falsifier.
create or replace function public.signalements_avant_depot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then new.signale_par := auth.uid(); end if;
  new.cree_le   := now();
  new.traite_le := null;
  new.decision  := null;
  -- Signaler un message designe aussi son auteur : c'est lui que la
  -- moderation doit retrouver quand le meme nom revient trois fois.
  if new.artisan_vise is null and new.message_id is not null then
    select m.auteur_id into new.artisan_vise from public.messages m where m.id = new.message_id;
  end if;
  return new;
end;
$$;
drop trigger if exists signalements_avant_depot on public.signalements;
create trigger signalements_avant_depot before insert on public.signalements
  for each row execute function public.signalements_avant_depot();

drop policy if exists "deposer un signalement" on public.signalements;
create policy "deposer un signalement" on public.signalements
  for insert to authenticated
  with check (signale_par = auth.uid()
              and (message_id is null or public.est_membre_conversation(
                     (select m.conversation_id from public.messages m where m.id = message_id))));

drop policy if exists "ses signalements" on public.signalements;
create policy "ses signalements" on public.signalements
  for select to authenticated
  using (signale_par = auth.uid() or public.est_admin());

drop policy if exists "moderation des signalements" on public.signalements;
create policy "moderation des signalements" on public.signalements
  for update to authenticated
  using (public.est_admin()) with check (public.est_admin());


-- ============================================================
-- 3. LE VOLET RGPD
-- ============================================================

-- --------------------------------------- 3.1 les textes de consentement
--
-- UN CONSENTEMENT QUI NE PEUT PAS SE PROUVER N'EXISTE PAS. Prouver un
-- consentement, ce n'est pas prouver qu'une case a ete cochee : c'est prouver
-- CE QUE DISAIT la case, le jour ou elle a ete cochee. Un texte modifie six
-- mois plus tard rend toutes les preuves anterieures inutilisables si on ne
-- garde pas la version.
--
-- D'ou une table de textes VERSIONNES, et une reference depuis chaque
-- consentement. Le texte lui-meme n'est PAS ecrit ici : il engage
-- juridiquement, il est redige par un avocat (voir le hors perimetre du
-- devis). Les lignes sont posees avec un marqueur visible et `en_vigueur` a
-- faux : tant que le texte n'est pas ecrit, AUCUN consentement ne peut etre
-- enregistre sur cette finalite. C'est voulu : mieux vaut un formulaire qui
-- refuse en le disant qu'un consentement recueilli sur un texte vide.
--
-- `base_legale` liste les bases de l'article 6 du RGPD. La valeur de chaque
-- ligne reste vide : dire que telle finalite repose sur l'interet legitime
-- plutot que sur le consentement est une qualification juridique, elle ne
-- s'invente pas depuis un editeur SQL.

create table if not exists public.consentement_textes (
  finalite    text not null,
  version     integer not null,
  texte       text not null,
  base_legale text check (base_legale in
                ('consentement','contrat','obligation_legale','interet_legitime')),
  publie_le   timestamptz,
  en_vigueur  boolean not null default false,
  primary key (finalite, version)
);

-- Une seule version en vigueur par finalite : deux textes actifs en meme
-- temps, et on ne sait plus lequel a ete montre.
create unique index if not exists consentement_texte_en_vigueur
  on public.consentement_textes (finalite) where en_vigueur;

-- Les finalites du produit, et rien de plus. Chacune correspond a une chose
-- que la plateforme fait vraiment aujourd'hui ou dans ce lot.
insert into public.consentement_textes (finalite, version, texte, en_vigueur) values
  ('cgu',                 1, '[A COMPLETER : conditions générales d''utilisation, rédigées par l''avocat]', false),
  ('fiche_publique',      1, '[A COMPLETER : publication de la fiche et des disponibilités auprès des autres professionnels]', false),
  ('partage_coordonnees', 1, '[A COMPLETER : transmission du téléphone au professionnel dont la mise en relation est acceptée]', false),
  ('messagerie',          1, '[A COMPLETER : être joignable par la messagerie interne, et conservation des échanges]', false),
  ('prospection',         1, '[A COMPLETER : recevoir par courriel les nouveautés et les offres de la plateforme]', false),
  ('mesure_audience',     1, '[A COMPLETER : mesure d''audience du site]', false)
on conflict (finalite, version) do nothing;

-- ------------------------------------------------- 3.2 les consentements
--
-- UNE LIGNE PAR CONSENTEMENT DONNE, ET LE RETRAIT NE SUPPRIME RIEN. Retirer
-- un consentement en effacant la ligne detruirait la preuve qu'il avait ete
-- donne, et donc la preuve que le traitement passe etait licite. On pose une
-- date de retrait, et on garde la ligne.
--
-- PAS D'ADRESSE IP. La CNIL admet de conserver une preuve du consentement ;
-- elle n'oblige pas a conserver l'IP, qui est elle-meme une donnee
-- personnelle. La finalite, la version du texte, la date et l'origine
-- suffisent a rapporter la preuve. Ajouter l'IP, ce serait collecter une
-- donnee de plus pour proteger une donnee. Point a confirmer avec l'avocat.

create table if not exists public.consentements (
  id         bigserial primary key,
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  finalite   text not null,
  version    integer not null,
  accorde_le timestamptz not null default now(),
  retire_le  timestamptz,
  -- D'ou vient le consentement : 'inscription', 'espace/etape-metier',
  -- 'bandeau-mesure'. Sert a retrouver l'ecran exact si la preuve est
  -- contestee.
  origine    text,
  foreign key (finalite, version) references public.consentement_textes (finalite, version),
  constraint retrait_apres_accord check (retire_le is null or retire_le >= accorde_le)
);

-- Un seul consentement ACTIF par finalite. Les retires s'empilent a cote :
-- c'est l'historique, et c'est lui qui prouve.
create unique index if not exists consentement_actif_unique
  on public.consentements (artisan_id, finalite) where retire_le is null;
create index if not exists consentements_artisan_idx on public.consentements (artisan_id);

-- On ne consent pas a un texte qui n'est pas en vigueur : sinon on recueille
-- un accord sur un marqueur [A COMPLETER], ce qui ne vaut rien et se
-- decouvre le jour du controle.
create or replace function public.consentements_avant_ecriture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.artisan_id := auth.uid(); end if;
    new.accorde_le := now();
    new.retire_le  := null;
    if not exists (select 1 from public.consentement_textes t
                    where t.finalite = new.finalite and t.version = new.version
                      and t.en_vigueur) then
      raise exception 'Ce texte n''est pas en vigueur : le consentement ne peut pas être enregistré.'
        using hint = 'Le texte de cette finalité n''a pas encore été publié. Voir consentement_textes.';
    end if;
  elsif auth.uid() is not null then
    -- Un consentement ne se reecrit pas. La seule chose qui bouge, c'est le
    -- retrait, et il ne se defait pas : pour re-consentir, on cree une ligne.
    --
    -- Le gel ne s'applique QU'A UNE SESSION, comme le declencheur des profils
    -- dans migration-presence.sql : sans le `auth.uid() is not null`, une
    -- correction faite depuis le tableau de bord Supabase avec la cle de
    -- service serait annulee sans un mot, et on chercherait longtemps.
    new.id := old.id; new.artisan_id := old.artisan_id;
    new.finalite := old.finalite; new.version := old.version;
    new.accorde_le := old.accorde_le; new.origine := old.origine;
    if old.retire_le is not null then new.retire_le := old.retire_le;
    elsif new.retire_le is not null then new.retire_le := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists consentements_avant_ecriture on public.consentements;
create trigger consentements_avant_ecriture before insert or update on public.consentements
  for each row execute function public.consentements_avant_ecriture();

-- --------------------------------------- 3.3 le journal des demandes RGPD
--
-- QUI A DEMANDE QUOI, QUAND, ET SI C'EST FAIT. Sans ce journal, le delai d'un
-- mois de l'article 12.3 du RGPD n'est ni tenu ni prouvable, et « on l'a
-- fait » ne se demontre pas.
--
-- `artisan_id` EN `on delete set null`, ET C'EST LE POINT LE PLUS FIN DU
-- FICHIER. Le journal doit survivre a la suppression du compte : c'est meme
-- sa raison d'etre, prouver qu'on a honore la demande. Mais il ne doit pas
-- garder le nom de quelqu'un qu'on vient d'effacer. Les deux se concilient
-- tout seuls : tant que le compte existe, la ligne le designe, ce qui permet
-- de savoir quel compte reste a effacer ; a l'instant ou le compte disparait,
-- la ligne perd l'identite et garde la trace. L'anonymisation se fait au bon
-- moment sans que personne ait a y penser.
--
-- `id` sert de REFERENCE communiquee a la personne : elle peut la citer dans
-- un courrier sans qu'on ait a stocker son adresse mail une seconde fois.

create table if not exists public.demandes_rgpd (
  id          uuid primary key default gen_random_uuid(),
  artisan_id  uuid references public.artisans(id) on delete set null,
  genre       text not null check (genre in
                ('acces','portabilite','rectification','effacement','limitation','opposition')),
  demande_le  timestamptz not null default now(),
  -- Le delai de l'article 12.3 du RGPD : un mois. Colonne ordinaire et non
  -- calculee, parce qu'une addition de mois depend du fuseau de la session et
  -- ne peut donc pas etre stockee comme colonne generee.
  echeance_le timestamptz not null default now() + interval '1 month',
  etat        text not null default 'recue'
                check (etat in ('recue','en_cours','faite','refusee')),
  traite_le   timestamptz,
  detail      text
);

create index if not exists demandes_rgpd_artisan_idx on public.demandes_rgpd (artisan_id);
create index if not exists demandes_rgpd_a_traiter_idx
  on public.demandes_rgpd (echeance_le) where traite_le is null;

-- ------------------------------------------------------- 3.4 l'export
--
-- TOUT CE QUE LA BASE SAIT D'UN ARTISAN, EN UN SEUL OBJET, EXECUTABLE PAR LUI
-- SEUL. `security definer` parce que l'export doit traverser des tables que
-- l'appelant n'a pas le droit de lire ligne a ligne ; mais la fonction ne
-- prend AUCUN parametre, et ne lit que `auth.uid()`. Il n'existe donc aucun
-- moyen de demander l'export de quelqu'un d'autre.
--
-- CE QUI N'EST PAS DANS L'EXPORT, ET POURQUOI :
--   · LES JETONS D'AGENDA (`agenda_secrets`). Ce ne sont pas des donnees sur
--     la personne, ce sont des CLES qui ouvrent son agenda Google. Un export
--     part par mail, se pose dans un dossier de telechargements, se transfere.
--     Y mettre une cle, c'est fabriquer la fuite qu'on pretend eviter. On
--     exporte l'existence et l'etat du branchement, jamais le jeton.
--   · LES MESSAGES DE L'INTERLOCUTEUR sont exportes AVEC leur corps, mais
--     l'auteur est reduit a son identite publique. L'artisan les a deja lus
--     dans l'application : les lui rendre ne lui apprend rien. En revanche,
--     lui rendre le nom de famille ou le telephone du confrere lui donnerait
--     une donnee qu'il n'avait pas. Point a confirmer avec l'avocat.
--
-- L'EXPORT SE JOURNALISE LUI-MEME, en etat 'faite' : une demande d'acces
-- honoree a la seconde ou elle est faite est quand meme une demande, et elle
-- compte dans le registre.

create or replace function public.mes_donnees_personnelles()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  moi        uuid := auth.uid();
  mon_email  text;
  etat_dem   text := public.contrat_demandes();
  les_demandes jsonb;
  sortie     jsonb;
begin
  if moi is null then
    raise exception 'Vous n''êtes pas connecté.'
      using hint = 'Reconnectez-vous, puis relancez l''export.';
  end if;

  -- On lit l'adresse dans `auth.users` plutot que par `auth.email()` : la
  -- lecture directe marche quelle que soit la version de Supabase installee.
  select u.email into mon_email from auth.users u where u.id = moi;

  -- Les mises en relation appartiennent a l'autre chantier. Si la table n'est
  -- pas la, l'export le DIT au lieu de faire comme s'il n'y avait rien.
  if etat_dem = 'ok' then
    execute 'select coalesce(jsonb_agg(to_jsonb(d)), ''[]''::jsonb)
               from public.demandes d
              where d.demandeur_id = $1 or d.destinataire_id = $1'
      into les_demandes using moi;
  else
    les_demandes := jsonb_build_object(
      '_non_branche', 'Les demandes de mise en relation ne sont pas encore en base (' || etat_dem || '). Rien n''est caché : cette partie n''existe pas encore.');
  end if;

  sortie := jsonb_build_object(
    '_lisez_moi', 'Export des données personnelles détenues par « à dispo ». Chaque section porte le nom de ce qu''elle contient. Les jetons d''accès aux agendas ne sont volontairement pas inclus : ce sont des clés, pas des données vous concernant.',
    'exporte_le', now(),
    'compte', jsonb_build_object('identifiant', moi, 'adresse_mail', mon_email),

    'fiche', (select to_jsonb(a) from public.artisans a where a.id = moi),

    'competences_et_materiel',
      (select coalesce(jsonb_agg(to_jsonb(t) - 'artisan_id'), '[]'::jsonb)
         from public.artisan_atouts t where t.artisan_id = moi),

    -- L'etat du branchement, jamais le jeton.
    'agendas_branches',
      (select coalesce(jsonb_agg(jsonb_build_object(
                'fournisseur', g.fournisseur, 'libelle', g.libelle,
                'branche_le', g.branche_le, 'synchro_le', g.synchro_le,
                'actif', g.actif)), '[]'::jsonb)
         from public.agendas g where g.artisan_id = moi),

    'creneaux_occupes',
      (select coalesce(jsonb_agg(jsonb_build_object(
                'debut', o.debut, 'fin', o.fin, 'saisi_a_la_main', o.saisie)), '[]'::jsonb)
         from public.occupations o where o.artisan_id = moi),

    'mises_en_relation', les_demandes,

    'conversations',
      (select coalesce(jsonb_agg(jsonb_build_object(
                'ouverte_le', c.cree_le,
                'fermee_le', c.ferme_le,
                'interlocuteur', (select jsonb_build_object(
                     'prenom', x.prenom, 'entreprise', x.denomination, 'commune', x.commune)
                   from public.artisans x
                  where x.id = case when c.artisan_bas = moi then c.artisan_haut else c.artisan_bas end),
                'messages', (select coalesce(jsonb_agg(jsonb_build_object(
                       'de_moi', m.auteur_id is not distinct from moi,
                       'envoye_le', m.envoye_le,
                       'lu_le', m.lu_le,
                       'corps', m.corps) order by m.envoye_le), '[]'::jsonb)
                   from public.messages m where m.conversation_id = c.id))), '[]'::jsonb)
         from public.conversations c
        where moi in (c.artisan_bas, c.artisan_haut)),

    'signalements_deposes',
      (select coalesce(jsonb_agg(jsonb_build_object(
                'cree_le', s.cree_le, 'motif', s.motif, 'detail', s.detail,
                'traite_le', s.traite_le)), '[]'::jsonb)
         from public.signalements s where s.signale_par = moi),

    'professionnels_bloques',
      (select coalesce(jsonb_agg(jsonb_build_object(
                'cree_le', b.cree_le, 'motif', b.motif)), '[]'::jsonb)
         from public.blocages b where b.bloqueur_id = moi),

    'consentements',
      (select coalesce(jsonb_agg(jsonb_build_object(
                'finalite', k.finalite, 'version_du_texte', k.version,
                'texte', t.texte, 'accorde_le', k.accorde_le,
                'retire_le', k.retire_le, 'origine', k.origine) order by k.accorde_le), '[]'::jsonb)
         from public.consentements k
         join public.consentement_textes t
           on t.finalite = k.finalite and t.version = k.version
        where k.artisan_id = moi),

    'demandes_rgpd',
      (select coalesce(jsonb_agg(jsonb_build_object(
                'reference', r.id, 'genre', r.genre, 'demande_le', r.demande_le,
                'etat', r.etat, 'traite_le', r.traite_le) order by r.demande_le), '[]'::jsonb)
         from public.demandes_rgpd r where r.artisan_id = moi),

    -- La liste d'attente d'avant l'ouverture. Le rapprochement se fait sur
    -- l'adresse normalisee, la seule colonne qui porte l'unicite.
    'liste_d_attente',
      (select coalesce(jsonb_agg(jsonb_build_object(
                'inscrit_le', i.cree_le, 'metier', i.metier,
                'metier_libre', i.metier_libre, 'departement', i.departement,
                'telephone', i.telephone, 'confirme_le', i.confirme_le,
                'provenance', i.provenance)), '[]'::jsonb)
         from public.inscriptions i
        where mon_email is not null and i.email_norme = lower(btrim(mon_email))),

    -- LA PROSPECTION. Si la personne a ete demarchee avant de s'inscrire, la
    -- base en garde une fiche, avec les notes prises pendant la prospection.
    -- Ces notes SONT des donnees personnelles la concernant : le droit
    -- d'acces les couvre. La consequence pratique est a connaitre de toute
    -- l'equipe : une note du CRM est lisible par la personne qu'elle decrit.
    -- Le rapprochement se fait sur `base->>'email'`, ecrite en minuscules par
    -- crm/outils/extraire-contacts.py.
    'fiche_de_prospection',
      (select coalesce(jsonb_agg(jsonb_build_object(
                'origine', c.base, 'suivi', c.crm, 'modifie_le', c.updated_at)), '[]'::jsonb)
         from public.contacts c
        where mon_email is not null and lower(c.base->>'email') = lower(btrim(mon_email)))
  );

  -- UNE SEULE LIGNE DE JOURNAL PAR JOUR ET PAR PERSONNE. Sans ce garde-fou,
  -- une page qui rappelle l'export a chaque affichage remplirait le registre
  -- de milliers de lignes, et un registre illisible ne prouve plus rien.
  if not exists (select 1 from public.demandes_rgpd r
                  where r.artisan_id = moi and r.genre = 'portabilite'
                    and r.demande_le > now() - interval '1 day') then
    insert into public.demandes_rgpd (artisan_id, genre, etat, traite_le, detail)
    values (moi, 'portabilite', 'faite', now(), 'Export effectué par la personne elle-même.');
  end if;

  return sortie;
end;
$$;

revoke all on function public.mes_donnees_personnelles() from public;
grant execute on function public.mes_donnees_personnelles() to authenticated;

-- ------------------------------------------------- 3.5 la suppression
--
-- CE QUI S'EFFACE, CE QUI S'ANONYMISE, ET POURQUOI LA DIFFERENCE EXISTE.
--
-- EFFACER, c'est faire disparaitre la ligne. C'est le traitement normal de
-- tout ce qui ne concerne QUE la personne : sa fiche, ses competences, ses
-- creneaux occupes, ses agendas branches, ses blocages, ses consentements.
-- Personne d'autre n'en depend, rien ne se casse.
--
-- ANONYMISER, c'est garder la ligne et lui retirer l'identite. C'est le
-- traitement de ce qui ne peut pas disparaitre sans detruire la donnee d'un
-- tiers ou une obligation :
--   · UN MESSAGE LAISSE A UN CONFRERE. Il appartient AUSSI a celui qui l'a
--     recu. L'effacer, c'est trouer sa conversation : il lui resterait ses
--     propres phrases repondant a des questions disparues. Le message perd
--     son auteur et garde sa valeur.
--   · UN SIGNALEMENT. La moderation doit garder le fait : un compte qui part
--     apres avoir ete signale trois fois ne doit pas effacer les trois traces
--     en partant.
--   · UNE FACTURE. Une piece comptable survit a la suppression du compte,
--     pour des raisons comptables et fiscales : les documents comptables se
--     conservent (article L123-22 du Code de commerce), et l'administration
--     peut les demander bien apres le depart du client. Les factures ne sont
--     PAS dans ce fichier : elles appartiennent a la migration des
--     abonnements et pieces, construite par l'autre chantier. CE QUE
--     J'ATTENDS D'ELLE : que la suppression d'un compte n'efface aucune
--     facture, et que l'identite qui y figure soit conservee telle quelle,
--     parce qu'une facture anonyme n'est plus une facture.
--   · LE JOURNAL DES DEMANDES RGPD. Il prouve qu'on a honore la demande. Il
--     perd l'identite au moment exact ou le compte disparait (voir 3.3).
--
-- LE CAS PARTICULIER DES CONSENTEMENTS : ils s'EFFACENT. C'est le seul
-- endroit du fichier ou une preuve disparait, et c'est assume. La section 3.2
-- garde l'historique des retraits precisement pour prouver la liceite des
-- traitements passes ; mais une preuve de consentement dont le sujet a ete
-- efface ne prouve plus rien sur personne, et la garder reviendrait a
-- conserver une donnee personnelle sans finalite. Point a confirmer avec
-- l'avocat : si un delai de conservation de la preuve est exige, il faudra
-- anonymiser au lieu d'effacer, et ces lignes changeront.
--
-- ET CE QU'ON NE FAIT SURTOUT PAS : conserver en clair « au cas ou ». Une
-- donnee qu'on ne peut pas effacer et qu'on n'anonymise pas, c'est une donnee
-- gardee sans finalite, et c'est exactement ce que le RGPD interdit.
--
-- CE QUE CETTE FONCTION NE PEUT PAS FAIRE, ET QUI EST DIT EN CLAIR.
-- Elle n'efface pas le COMPTE DE CONNEXION (`auth.users` : adresse mail et
-- mot de passe). Cette table n'est accessible qu'avec la cle de service, qui
-- ne doit jamais se trouver dans un navigateur. Tant que ce geste n'est pas
-- fait, la personne peut se reconnecter et retomber sur un espace vide. Le
-- journal RGPD porte la ligne a traiter, et elle designe le compte a
-- supprimer tant qu'il existe : c'est la liste de travail.

-- La marque de suppression sur la fiche. `add column if not exists` : la
-- meme facon de faire que migration-admin.sql et migration-presence.sql, qui
-- ajoutent des colonnes a `profils` sans reecrire schema.sql.
alter table public.artisans add column if not exists supprime_le timestamptz;
comment on column public.artisans.supprime_le is
  'Date de la demande de suppression. La ligne ne porte plus aucune donnée identifiante à partir de là ; elle attend la suppression du compte de connexion, qui l''emportera.';

create or replace function public.supprimer_mon_compte(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  moi       uuid := auth.uid();
  mon_email text;
  reference uuid;
  n_messages integer := 0;
  n_fils     integer := 0;
begin
  if moi is null then
    raise exception 'Vous n''êtes pas connecté.'
      using hint = 'Reconnectez-vous, puis relancez la suppression.';
  end if;

  -- Une suppression definitive ne se declenche pas par un clic malheureux sur
  -- un telephone tenu d'une main. La personne tape le mot.
  if upper(btrim(coalesce(p_confirmation, ''))) <> 'SUPPRIMER' then
    raise exception 'La suppression n''a pas été confirmée.'
      using hint = 'Tapez le mot SUPPRIMER pour confirmer. Rien n''a été effacé.';
  end if;

  select u.email into mon_email from auth.users u where u.id = moi;

  -- Le gel des conversations (section 2.8) empeche un navigateur de se
  -- retirer d'un fil. L'anonymisation, elle, doit precisement le faire. On
  -- leve le gel POUR CETTE TRANSACTION, et pas plus loin.
  perform set_config('dispo.interne', 'oui', true);

  -- 1. CE QUI S'EFFACE : ce qui ne concerne que la personne.
  delete from public.artisan_atouts where artisan_id = moi;
  delete from public.occupations    where artisan_id = moi;
  -- La suppression des agendas emporte les jetons par `on delete cascade` :
  -- c'est ce qui coupe reellement l'acces a son agenda Google.
  delete from public.agendas        where artisan_id = moi;
  delete from public.blocages       where bloqueur_id = moi or bloque_id = moi;
  delete from public.consentements  where artisan_id = moi;
  if mon_email is not null then
    delete from public.inscriptions where email_norme = lower(btrim(mon_email));
  end if;

  -- 2. CE QUI S'ANONYMISE : ce qui appartient aussi a quelqu'un d'autre.
  --    L'anonymisation se fait MAINTENANT et non a la suppression du compte
  --    de connexion : une anonymisation qui attend un geste manuel est une
  --    anonymisation qui n'arrive pas.
  update public.messages set auteur_id = null where auteur_id = moi;
  get diagnostics n_messages = row_count;

  update public.signalements set signale_par  = null where signale_par  = moi;
  update public.signalements set artisan_vise = null where artisan_vise = moi;

  -- On se retire des conversations sans y toucher autrement : celui qui reste
  -- garde son fil entier et continue de le lire.
  update public.conversations set ferme_le = coalesce(ferme_le, now())
   where moi in (artisan_bas, artisan_haut);
  get diagnostics n_fils = row_count;
  update public.conversations set artisan_bas  = null where artisan_bas  = moi;
  update public.conversations set artisan_haut = null where artisan_haut = moi;

  -- 3. LA FICHE : videe de tout ce qui identifie, et marquee.
  update public.artisans
     set prenom = null, nom = null, telephone = null, photo_url = null,
         siret = null, siret_etat = null, denomination = null, activite = null,
         commune = null, code_postal = null, siret_verifie_le = null,
         metier = null, metier_libre = null, presentation = null,
         formule = null, essai_jusqu_au = null, abonne_jusqu_au = null,
         publie = false, supprime_le = now()
   where id = moi;

  -- 4. LE JOURNAL. Il reste en 'en_cours' : la suppression n'est complete que
  --    quand le compte de connexion a disparu, et ce geste-la n'est pas
  --    automatisable depuis ici.
  insert into public.demandes_rgpd (artisan_id, genre, etat, detail)
  values (moi, 'effacement', 'en_cours',
          'Données effacées et anonymisées par la personne elle-même. Reste à supprimer le compte de connexion (auth.users) avec la clé de service.')
  returning id into reference;

  perform set_config('dispo.interne', 'non', true);

  return jsonb_build_object(
    'reference', reference,
    'efface', jsonb_build_array('fiche', 'compétences et matériel', 'créneaux occupés',
                                'agendas branchés et leurs jetons', 'blocages',
                                'consentements', 'inscription à la liste d''attente'),
    'anonymise', jsonb_build_object(
        'messages', n_messages,
        'conversations', n_fils,
        'signalements', 'auteur et personne visée retirés'),
    'reste_a_faire', 'La suppression du compte de connexion (adresse e-mail et mot de passe) demande une intervention de notre côté. Elle est inscrite au journal sous la référence ci-dessus.');
end;
$$;

revoke all on function public.supprimer_mon_compte(text) from public;
grant execute on function public.supprimer_mon_compte(text) to authenticated;

-- Deposer une demande RGPD qui n'est pas l'export ni la suppression :
-- rectification, limitation, opposition. Une fonction plutot qu'une insertion
-- directe, pour que `artisan_id` et `echeance_le` ne dependent pas de ce que
-- le navigateur envoie.
create or replace function public.deposer_demande_rgpd(p_genre text, p_detail text default null)
returns public.demandes_rgpd
language plpgsql
security definer
set search_path = public
as $$
declare
  moi uuid := auth.uid();
  ligne public.demandes_rgpd;
begin
  if moi is null then
    raise exception 'Vous n''êtes pas connecté.'
      using hint = 'Reconnectez-vous pour déposer votre demande.';
  end if;
  if p_genre not in ('acces','portabilite','rectification','effacement','limitation','opposition') then
    raise exception 'Ce type de demande n''existe pas.'
      using hint = 'Choisissez : accès, portabilité, rectification, effacement, limitation ou opposition.';
  end if;
  insert into public.demandes_rgpd (artisan_id, genre, detail)
  values (moi, p_genre, left(coalesce(p_detail, ''), 2000))
  returning * into ligne;
  return ligne;
end;
$$;

revoke all on function public.deposer_demande_rgpd(text, text) from public;
grant execute on function public.deposer_demande_rgpd(text, text) to authenticated;

-- ------------------------------------------ 3.6 les autorisations du volet RGPD

alter table public.consentement_textes enable row level security;
alter table public.consentements       enable row level security;
alter table public.demandes_rgpd       enable row level security;

-- LES TEXTES SONT LISIBLES PAR TOUT LE MONDE, y compris sans compte : on doit
-- pouvoir lire ce a quoi on consent AVANT de creer le compte. Ecriture
-- reservee au tableau de bord Supabase (cle de service), comme les profils.
drop policy if exists "textes de consentement lisibles" on public.consentement_textes;
create policy "textes de consentement lisibles" on public.consentement_textes
  for select to anon, authenticated using (true);

-- SES CONSENTEMENTS : il les lit, il les donne, il les retire. Il ne les
-- supprime pas : aucune politique de suppression, la preuve doit rester.
drop policy if exists "ses consentements" on public.consentements;
create policy "ses consentements" on public.consentements
  for select to authenticated using (artisan_id = auth.uid());

drop policy if exists "donner son consentement" on public.consentements;
create policy "donner son consentement" on public.consentements
  for insert to authenticated with check (artisan_id = auth.uid());

drop policy if exists "retirer son consentement" on public.consentements;
create policy "retirer son consentement" on public.consentements
  for update to authenticated
  using (artisan_id = auth.uid()) with check (artisan_id = auth.uid());

-- SES DEMANDES RGPD : il les lit. Il les depose par la fonction ci-dessus,
-- pas par une insertion directe. La moderation, elle, doit toutes les voir :
-- c'est le registre, et c'est lui qu'on presente en cas de controle.
drop policy if exists "ses demandes rgpd" on public.demandes_rgpd;
create policy "ses demandes rgpd" on public.demandes_rgpd
  for select to authenticated
  using (artisan_id = auth.uid() or public.est_admin());

drop policy if exists "traiter les demandes rgpd" on public.demandes_rgpd;
create policy "traiter les demandes rgpd" on public.demandes_rgpd
  for update to authenticated
  using (public.est_admin()) with check (public.est_admin());


-- ============================================================
-- 4. CE QUI N'EST PAS BRANCHE, ET LE GESTE HUMAIN QUI LE DEBLOQUE
--
-- Ecrit ici et pas seulement dans un compte rendu : celui qui rejouera ce
-- fichier dans six mois lira ce fichier, pas le compte rendu.
--
--   1. LA TABLE DES MISES EN RELATION. Le fichier de l'autre chantier,
--      crm/supabase/migration-recherche-relations.sql, EXISTE sur le disque
--      au 13/09/2026 et porte bien le contrat attendu. Mais un fichier sur le
--      disque n'est pas une table en base. Tant que `public.demandes` n'est
--      pas JOUEE, aucune conversation ne peut s'ouvrir, et c'est le
--      comportement voulu, pas une panne. Geste : jouer leur fichier, puis
--      REJOUER celui-ci pour poser la cle etrangere (la migration est faite
--      pour ca, elle ne recree rien). Controle :
--      `select public.contrat_demandes();` doit rendre 'ok', et
--      `select conname from pg_constraint where conrelid = 'public.conversations'::regclass;`
--      doit contenir `conversations_demande_fk`.
--
--   2. LES TEXTES DE CONSENTEMENT. Les six finalites sont posees avec un
--      marqueur [A COMPLETER] et `en_vigueur = false`. Aucun consentement ne
--      peut etre enregistre tant que le texte n'est pas ecrit : la fonction
--      refuse en le disant. Geste : l'avocat ecrit les textes, on les pose en
--      base, on passe `en_vigueur` a vrai. Ce sont des textes qui engagent :
--      ils ne s'ecrivent pas depuis un editeur SQL.
--
--   3. LA SUPPRESSION DU COMPTE DE CONNEXION. `supprimer_mon_compte()` fait
--      tout sauf effacer la ligne `auth.users`, qui demande la cle de
--      service. Geste : traiter les lignes de `demandes_rgpd` en etat
--      'en_cours' et de genre 'effacement', supprimer le compte dans
--      Authentication > Users, puis passer la ligne en 'faite'. La requete de
--      travail :
--        select id, artisan_id, demande_le, echeance_le from public.demandes_rgpd
--         where genre = 'effacement' and etat = 'en_cours' order by echeance_le;
--      A automatiser dans une fonction serveur le jour ou il y en aura plus
--      d'une par mois.
--
--   4. LA RELANCE PAR MAIL de celui qui n'a pas lu son message (ligne du
--      devis). Trois pieces, dont deux sont faites :
--        · le gabarit d'email existe deja : `message-recu`, dans
--          supabase/functions/envoyer-email/ (autre chantier, 13/09/2026) ;
--        · la base sait deja QUI relancer : les messages dont `lu_le` est
--          vide depuis plus de N heures, l'index `messages_non_lus_idx` est
--          pose pour cette requete-la ;
--        · ce qui manque : LE FOURNISSEUR D'ENVOI n'est pas choisi (leur
--          LISEZMOI le dit, et c'est le meme blocage que la double
--          confirmation de migration-inscriptions.sql), et rien n'appelle
--          encore cette fonction depuis la messagerie.
--      Geste : choisir le fournisseur d'envoi. C'est un seul choix pour les
--      deux chantiers, il ne se paie qu'une fois. Le delai de relance (N
--      heures) reste a arreter avec Claire-Marie : relancer au bout d'une
--      heure agace, au bout de trois jours ne sert plus a rien, et aucune de
--      ces deux valeurs n'est mesuree aujourd'hui.
--
--   5. « A DISPO » QUI ECRIT A SES INSCRITS (ligne du devis : ecrire a un
--      inscrit, a un groupe par metier ou par departement, a tous). Ce
--      fichier ne le couvre pas, et c'est un choix de structure a trancher :
--      une conversation est ici adossee a une mise en relation entre deux
--      artisans, or la plateforme n'est pas un artisan et n'a pas de demande
--      acceptee. Deux voies possibles : un expediteur « plateforme » admis
--      comme troisieme type de participant, ou un canal d'annonces separe qui
--      n'est pas une conversation. La seconde est plus propre et ne fragilise
--      pas la regle d'ouverture. A trancher avant de coder.
--
--   6. LA DUREE DE CONSERVATION DES MESSAGES. Elle est marquee [AVOCAT] au
--      plan d'action, et elle n'est pas arretee. Aucune purge automatique
--      n'est ecrite ici : programmer un effacement sur une duree inventee
--      detruirait des echanges que le droit demande peut-etre de garder.
--      Geste : arreter la duree avec l'avocat, puis ecrire la purge.
--
--   7. LE PLAFOND D'ENVOI n'est pas mesure (30 messages par heure, valeur
--      d'attente, voir `plafond_messages_par_heure()`). Geste : observer le
--      premier mois d'usage reel et arreter la valeur avec Claire-Marie.
--
--   8. UN POINT DE SECURITE QUI NE VIENT PAS DE CE FICHIER, ET QU'IL FAUT
--      CONTROLER AVANT D'OUVRIR LES INSCRIPTIONS AUX ARTISANS. Le declencheur
--      `creer_profil` de schema.sql cree une ligne dans `public.profils` pour
--      TOUT nouveau compte `auth.users`, avec `actif = true` par defaut. Or
--      la politique « contacts lecture actifs » de migration-admin.sql ouvre
--      la lecture de `public.contacts` a quiconque a un profil actif. Le jour
--      ou un artisan pourra creer son compte lui-meme, il obtiendra donc la
--      lecture des fiches de prospection du CRM. Aujourd'hui c'est sans effet
--      parce que schema.sql note que la creation de compte est desactivee
--      dans le tableau de bord ; migration-espace-artisan.sql demande
--      justement de l'activer. Ce n'est pas corrige ici : distinguer
--      l'equipe d'un artisan demande une decision (une colonne `equipe` sur
--      `profils` ? une verification que la ligne existe dans `artisans` ?) et
--      toucher a la politique du CRM pendant que Claire-Marie y travaille se
--      fait avec elle, pas a son insu. CONTROLE A FAIRE : creer un compte
--      d'essai d'artisan, et depuis ce compte tenter
--      `select count(*) from contacts`. Le resultat attendu est 0 ou une
--      erreur ; s'il rend 1 374, il faut traiter ce point avant l'ouverture.
--
-- LES MARQUEURS [A COMPLETER] POSES PAR CE FICHIER :
--   [A COMPLETER : conditions générales d'utilisation]            consentement_textes
--   [A COMPLETER : publication de la fiche et des disponibilités] consentement_textes
--   [A COMPLETER : transmission du téléphone]                     consentement_textes
--   [A COMPLETER : messagerie interne et conservation]            consentement_textes
--   [A COMPLETER : prospection par courriel]                      consentement_textes
--   [A COMPLETER : mesure d'audience]                             consentement_textes
--   [A COMPLETER : base légale de chaque finalité]  consentement_textes.base_legale, vide
--   [A COMPLETER : durée de conservation des messages]            aucune purge ecrite
--   [A COMPLETER : plafond d'envoi par heure]       plafond_messages_par_heure(), 30 en attente
--   [A COMPLETER : délai avant la relance d'un message non lu]    rien d'écrit
--   [A COMPLETER : fournisseur d'envoi des e-mails]  choix commun aux deux chantiers
--
-- ============================================================
-- 5. LES CONTROLES A FAIRE APRES AVOIR JOUE CE FICHIER
--
-- Rien de ce qui suit ne se verifie en relisant le code : il faut deux
-- comptes d'essai et un navigateur.
--
--   select public.contrat_demandes();
--     -> 'ok' quand l'autre chantier a atterri, sinon la phrase qui dit quoi.
--
--   -- Depuis le compte A, connecte :
--   select public.ouvrir_conversation('<une demande NON acceptee>');
--     -> doit refuser avec « Cette mise en relation n'est pas acceptée. »
--   select * from public.messages;
--     -> ne doit rendre QUE les messages des fils de A. Zero ligne de B.
--   select count(*) from public.conversations;
--     -> le nombre de fils de A, jamais le total de la table.
--
--   -- Depuis le compte B : ecrire a A, puis A bloque B, puis B reessaie.
--     -> B doit lire « Cette conversation est fermée : votre interlocuteur
--        ne souhaite plus être contacté ici. », et A « Vous avez bloqué ce
--        professionnel. »
--
--   select public.mes_donnees_personnelles();
--     -> un seul objet, et AUCUN jeton d'agenda dedans. Le verifier a l'oeil.
--
--   select public.supprimer_mon_compte('non');
--     -> doit refuser sans rien effacer.
--
-- ============================================================
-- 6. LE CONTRAT AVEC LES ECRANS QUI VIENDRONT
--
-- Une base ne dessine pas un ecran, mais elle decide de ce que l'ecran peut
-- montrer. Ce qui suit dit ce que chaque fonction rend dans les quatre etats
-- obligatoires, pour qu'aucune page ne se retrouve blanche.
--
--   CHARGEMENT. Un seul appel suffit a peindre la liste :
--     `mes_conversations()` rend tout ce qu'il faut, interlocuteur et compteur
--     compris. Pas de seconde requete pour les noms, donc pas de liste qui
--     s'affiche puis se remplit.
--
--   VIDE. `mes_conversations()` rend ZERO LIGNE quand il n'y a rien, et zero
--     ligne n'est pas une erreur. C'est le cas normal d'un compte neuf, et la
--     page doit y repondre par une phrase et un geste (« Vos conversations
--     s'ouvrent quand une mise en relation est acceptée. Voir mes demandes »),
--     jamais par un vide.
--
--   ERREUR. Chaque refus porte un `message` ET un `hint` : la phrase, et le
--     geste. Voir ci-dessous.
--
--   SUCCES. Les fonctions qui ecrivent rendent de quoi confirmer a l'ecran
--     sans relire la base : `marquer_lu()` rend le nombre de messages passes
--     en lu, `supprimer_mon_compte()` rend le detail de ce qui a ete efface et
--     de ce qui a ete anonymise, `ouvrir_conversation()` rend la conversation.
--
--   CE QUI CONCERNE L'ECRAN ET PAS LA BASE, et qui reste a tenir cote page :
--     navigation au clavier et focus visible, libelle relie a chaque champ,
--     message d'erreur relie au champ fautif, animation reduite si le systeme
--     le demande, cibles tactiles suffisantes, et aucun debordement lateral :
--     l'artisan lit son telephone debout, au soleil, avec une main.
--
--   UN POINT MESURE AU PASSAGE, POUR LA PAGE QUI VIENDRA. Le formulaire de
--     inscription/index.html pose bien `aria-invalid` sur le champ fautif
--     (2 occurrences), mais AUCUN `aria-describedby` : 0 occurrence, ni la,
--     ni dans espace/index.html. Le texte de l'erreur n'est donc rattache au
--     champ par rien d'autre que sa position a l'ecran, et un lecteur d'ecran
--     annonce « champ invalide » sans jamais dire pourquoi. Les ecrans de la
--     messagerie ne doivent pas recopier ce defaut : `aria-describedby` qui
--     pointe l'identifiant du paragraphe d'erreur, sur chaque champ.
--
-- CE QUE LA PAGE DEVRA AFFICHER, et qui se prepare ici : chaque refus de ce
-- fichier porte un `message` ET un `hint`. Supabase les rend tous les deux
-- dans l'objet d'erreur. Une page qui n'affiche que `message` perd le geste
-- humain, et un ecran sans geste humain est un ecran mort.
-- ============================================================
