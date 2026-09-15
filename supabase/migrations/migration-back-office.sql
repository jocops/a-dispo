-- ============================================================
-- LE BACK OFFICE : VOIR, CORRIGER, SUSPENDRE, MODERER.
--
-- A jouer APRES schema.sql, migration-admin.sql, migration-presence.sql et
-- migration-espace-artisan.sql. Ce fichier appelle `public.est_admin()`, qui
-- vient de migration-admin.sql : sans elle, tout ce qui suit refuse de se
-- creer, et le controle prealable le dit en une phrase au lieu de laisser
-- tomber une erreur de Postgres.
--
-- Les trois migrations du meme jour (migration-recherche-relations.sql,
-- migration-abonnement-pieces.sql, migration-messagerie-rgpd.sql) ne sont PAS
-- exigees. Ce fichier ne suppose l'existence d'aucune de leurs tables : il la
-- VERIFIE au moment de compter, et dit laquelle manque. Un back office qui
-- refuse de s'ouvrir parce qu'une migration voisine n'a pas ete jouee ne sert
-- a rien le jour ou il faut moderer.
--
-- PERIMETRE CONTRACTUEL, ET IL FAUT LE SAVOIR AVANT DE LIRE. Ce fichier
-- couvre une partie de la ligne « Ton interface d'administration : voir,
-- corriger, suspendre, modérer » (2,5 j), du devis 2027-02, NON SIGNE au
-- 13/09/2026. Le seul devis qui engage est le N°20260910-1 du 10/09/2026
-- (37,5 j, 6 060 EUR, acompte de 50 % encaisse le 13/09/2026), et il ne porte
-- AUCUNE ligne de back office. Ecrire ces politiques ne les facture pas : le
-- rattachement reste a trancher, et il est rappele dans le bloc final.
--
-- LE TROU QUE CE FICHIER BOUCHE, ET IL EST MESURE. Avant lui, `est_admin()`
-- n'est invoquee qu'a quatre endroits, tous dans migration-admin.sql et
-- migration-presence.sql : la politique « profils maj admin » et le
-- declencheur qui gele `actif`. Sur `artisans`, la seule politique posee est
-- « sa fiche », en id = auth.uid(). En clair, et c'est verifiable en une
-- requete : aujourd'hui un administrateur ne peut lire AUCUNE fiche
-- d'artisan, et ne peut suspendre AUCUNE publication. Une page qui cacherait
-- ses boutons a un non-administrateur ne changerait rien : la cle publique
-- est dans le code source de chaque page, et la console du navigateur
-- contourne un bouton cache en trois lignes. La reserve se porte en base.
--
-- LES QUATRE REGLES QUI GOUVERNENT CE FICHIER.
--
--   1. UNE SEULE GARDE DE ROLE, ET C'EST L'EXISTANTE. `public.est_admin()`,
--      et rien d'autre : pas de seconde table de roles, pas de liste
--      d'adresses en dur, pas de drapeau nouveau. On n'emploie JAMAIS
--      `est_actif()`, qui vaut vrai pour n'importe quel compte des lors qu'un
--      profil existe, artisan compris : c'est exactement la confusion qui
--      produit deja la fuite decrite au bloc final.
--
--   2. LA SUSPENSION N'EST PAS UN SIMPLE `publie = false`. Un administrateur
--      qui se contenterait de depublier serait defait a la seconde ou
--      l'artisan rouvre son espace et reclique sur « Publier ma fiche »
--      (espace/index.html, volet « Ma fiche »). La suspension est donc une
--      donnee a part, que l'artisan ne peut ni ecrire ni effacer, et qui
--      interdit la republication tant qu'elle tient.
--
--   3. MAIS ELLE PASSE PAR `publie`, ET C'EST DELIBERE. Suspendre repose
--      `publie = false` en meme temps que ca marque la fiche. Consequence :
--      tout ce qui filtre deja sur `publie` honore la suspension sans etre
--      reecrit, a savoir la vue `fiches_publiques`, les fonctions
--      `rechercher_confreres` et `est_publie`, et les index partiels
--      `artisans_metier_idx`, `artisans_cp_idx`, `artisans_publie_idx`.
--      Remplacer la vue et la fonction d'un autre fichier pour y ajouter une
--      condition aurait cree deux verites a tenir a jour, et l'une des deux
--      aurait fini en retard sur l'autre.
--
--   4. UN COMPTEUR QU'ON NE PEUT PAS CALCULER SE DIT, IL NE SE DEVINE PAS.
--      `chiffres_back_office()` rend une ligne par compteur, avec la raison
--      en clair quand la table n'existe pas dans cette base. Un tableau de
--      bord qui affiche zero la ou il ne sait pas est un tableau de bord qui
--      ment, et c'est sur lui qu'on prendra une decision.
--
-- Rejouable sans risque : create ... if not exists, create or replace,
-- drop policy if exists avant chaque create policy, drop trigger if exists
-- avant chaque create trigger. Aucun drop table, aucun delete, aucun
-- truncate, aucun alter ... drop column.
-- ============================================================


-- ------------------------------------------------------------ controle prealable
--
-- Deux dependances, et elles sont nommees. Sans ce bloc, l'erreur tomberait
-- vingt lignes plus bas sous une forme que personne ne rattache au fichier
-- manquant.

do $$
begin
  if to_regprocedure('public.est_admin()') is null then
    raise exception
      'public.est_admin() n''existe pas : joue d''abord crm/supabase/migration-admin.sql.';
  end if;
  if to_regclass('public.artisans') is null then
    raise exception
      'public.artisans n''existe pas : joue d''abord crm/supabase/migration-espace-artisan.sql.';
  end if;
end $$;


-- ------------------------------------------------------------ la suspension
--
-- Trois colonnes, et pas une de plus. `suspendu_le` porte a elle seule l'etat
-- (nulle = pas suspendue), `suspendu_par` dit qui a decide, `motif_suspension`
-- dit pourquoi. Une suspension sans motif ne se conteste pas : c'est la meme
-- regle que `refus_motive` sur les pieces justificatives, et elle est ecrite
-- pour la meme raison, cote base, parce qu'une regle qui vit dans une page se
-- perd a la premiere refonte de la page.

alter table public.artisans add column if not exists suspendu_le  timestamptz;
alter table public.artisans add column if not exists suspendu_par uuid
  references auth.users(id) on delete set null;
alter table public.artisans add column if not exists motif_suspension text;

comment on column public.artisans.suspendu_le is
  'Suspension par l''administration. Nulle = fiche libre. L''artisan ne peut ni la poser ni la lever.';

-- `add constraint if not exists` n'existe pas en Postgres : le garde-fou se
-- fait au catalogue, sinon le second rejeu du fichier echoue.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'suspension_motivee'
       and conrelid = 'public.artisans'::regclass) then
    alter table public.artisans add constraint suspension_motivee
      check (suspendu_le is null
             or char_length(btrim(coalesce(motif_suspension, ''))) >= 3);
  end if;
end $$;

-- Index partiel : on ne cherche jamais les fiches NON suspendues par cette
-- colonne, et elles sont l'ecrasante majorite.
create index if not exists artisans_suspendus_idx
  on public.artisans (suspendu_le) where suspendu_le is not null;


-- ------------------------------------------------------------ le gel des colonnes
--
-- CE DECLENCHEUR EST LA PIECE CENTRALE DU FICHIER. Il repond a deux questions
-- que ni une politique ni une page ne savent traiter.
--
-- QUESTION 1 : l'artisan peut-il lever sa propre suspension ? Non. Les trois
-- colonnes de moderation sont remises a leur valeur d'origine des que
-- l'ecriture vient de lui, et une republication est refusee tant que la
-- suspension tient. C'est le meme procede que `profils_protege_admin` de
-- migration-admin.sql, applique a une autre table pour la meme raison.
--
-- QUESTION 2 : l'administrateur peut-il corriger un SIRET, un telephone ou un
-- nom depuis le back office ? Non plus, et c'est un choix. Corriger une donnee
-- a la place de son proprietaire, c'est signer une information qu'on n'a pas
-- verifiee, et la fiche ne dirait plus qui l'a ecrite. L'administrateur
-- publie, depublie, suspend et leve : quatre gestes, pas un de plus.
--
-- LA MANIERE DE GELER COMPTE. On ne recopie pas les colonnes une par une : on
-- repart de la ligne d'origine et on n'y reporte QUE les champs autorises.
-- Une colonne ajoutee a `artisans` dans six mois sera donc gelee toute seule,
-- sans que personne ait a penser a revenir ici. Une liste de colonnes a
-- maintenir finit toujours par etre en retard d'une colonne.

create or replace function public.artisans_moderation() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  garde public.artisans;
begin
  -- Ecriture sans session : cle de service, tache d'entretien, fonction
  -- serveur. On ne s'en mele pas, exactement comme `profils_protege_admin`.
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() = old.id then
    -- LE PROPRIETAIRE. Il fait ce qu'il veut de sa fiche, sauf de sa
    -- moderation. Une suspension qu'on leve soi-meme n'est pas une suspension.
    new.suspendu_le      := old.suspendu_le;
    new.suspendu_par     := old.suspendu_par;
    new.motif_suspension := old.motif_suspension;
    if new.publie and old.suspendu_le is not null then
      raise exception
        'Ta fiche est suspendue : écris-nous avant de la republier.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- QUELQU'UN D'AUTRE. Seul un administrateur franchit la politique, mais on
  -- le reverifie ici : une politique se remplace au prochain fichier, un
  -- declencheur se declenche pour tout le monde, y compris pour du code
  -- serveur qui porterait une session.
  if not public.est_admin() then
    raise exception 'Cette fiche ne t''appartient pas.' using errcode = '42501';
  end if;

  garde := old;
  garde.publie           := new.publie;
  garde.suspendu_le      := new.suspendu_le;
  garde.suspendu_par     := new.suspendu_par;
  garde.motif_suspension := new.motif_suspension;
  garde.maj_le           := new.maj_le;
  return garde;
end $$;

-- Il s'execute APRES `artisans_maj` (ordre alphabetique des declencheurs de
-- meme moment : artisans_maj, puis artisans_moderation), donc `new.maj_le`
-- porte deja `now()` quand on le reporte.
drop trigger if exists artisans_moderation on public.artisans;
create trigger artisans_moderation before update on public.artisans
  for each row execute function public.artisans_moderation();


-- ------------------------------------------------------------ les politiques
--
-- Quatre lectures et une seule ecriture. Les politiques sont PERMISSIVES en
-- Postgres, donc elles s'ajoutent a « sa fiche » par un OU : un artisan garde
-- exactement ce qu'il avait, un administrateur voit tout.

drop policy if exists "artisans lus par l administration" on public.artisans;
create policy "artisans lus par l administration" on public.artisans
  for select to authenticated using (public.est_admin());

drop policy if exists "atouts lus par l administration" on public.artisan_atouts;
create policy "atouts lus par l administration" on public.artisan_atouts
  for select to authenticated using (public.est_admin());

drop policy if exists "agendas lus par l administration" on public.agendas;
create policy "agendas lus par l administration" on public.agendas
  for select to authenticated using (public.est_admin());

-- LA LECTURE DES OCCUPATIONS, ET LA RETENUE QU'ELLE DEMANDE. La table ne porte
-- ni titre, ni lieu, ni participant : c'est une promesse publique, tenue par
-- l'absence de colonne (aide/index.html). Un administrateur y lit donc des
-- creneaux occupes, et rien d'autre. La politique est posee parce qu'il faut
-- pouvoir repondre a « pourquoi cet artisan ne sort jamais dans la recherche »
-- sans demander a l'artisan de faire une capture d'ecran. Le back office s'en
-- sert pour COMPTER, jamais pour afficher l'agenda de quelqu'un.
drop policy if exists "occupations lues par l administration" on public.occupations;
create policy "occupations lues par l administration" on public.occupations
  for select to authenticated using (public.est_admin());

-- L'ECRITURE. Elle est bornee par le declencheur ci-dessus, pas par la
-- politique : une politique sait dire QUI ecrit, elle ne sait pas dire QUOI.
drop policy if exists "fiches moderees par l administration" on public.artisans;
create policy "fiches moderees par l administration" on public.artisans
  for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- AUCUNE POLITIQUE DE SUPPRESSION POUR L'ADMINISTRATION, et c'est volontaire.
-- Effacer une fiche depuis un back office n'est pas de la moderation : c'est
-- un effacement de donnees personnelles, il a son circuit, sa tracabilite et
-- son delai d'un mois (table `demandes_rgpd`). Un bouton « supprimer » dans
-- une interface de moderation finit toujours par servir a autre chose.


-- ------------------------------------------------------------ moderer une fiche
--
-- POURQUOI UNE FONCTION ALORS QUE LA POLITIQUE SUFFIRAIT. Parce que trois
-- choses doivent arriver ensemble, ou pas du tout : la depublication, le
-- marquage, et la trace au journal. Laisser la page les enchainer, c'est
-- accepter qu'une coupure reseau entre deux appels laisse une fiche suspendue
-- dont personne ne sait qui l'a suspendue.
--
-- ET POURQUOI ELLE REFUSE DE TRAVAILLER SANS JOURNAL. Une suspension sans
-- trace, c'est une decision que personne ne pourra expliquer a l'artisan qui
-- la conteste. Plutot que de moderer en silence, la fonction dit quelle
-- migration manque. C'est la meme doctrine que les boutons eteints des pages :
-- ce qui ne peut pas marcher le dit, il ne fait pas semblant.

create or replace function public.moderer_fiche(
  p_artisan   uuid,
  p_suspendre boolean,
  p_motif     text default null)
returns public.artisans
language plpgsql
security definer
set search_path = public
as $$
declare
  avant public.artisans;
  apres public.artisans;
begin
  if not public.est_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;

  if to_regprocedure('public.journaliser(text,text,text,jsonb,jsonb)') is null then
    raise exception
      'Le journal d''audit n''existe pas dans cette base : joue crm/supabase/migration-recherche-relations.sql avant de modérer.'
      using errcode = '55000';
  end if;

  select * into avant from public.artisans where id = p_artisan;
  if not found then
    raise exception 'Cette fiche n''existe pas.' using errcode = 'P0002';
  end if;

  if p_suspendre then
    if char_length(btrim(coalesce(p_motif, ''))) < 3 then
      raise exception
        'Une suspension sans motif ne se conteste pas : écris le motif.'
        using errcode = '22023';
    end if;
    update public.artisans
       set publie           = false,
           suspendu_le      = now(),
           suspendu_par     = auth.uid(),
           motif_suspension = btrim(p_motif)
     where id = p_artisan
    returning * into apres;
  else
    -- Lever la suspension ne republie PAS la fiche : c'est a l'artisan de
    -- decider s'il veut revenir en ligne. Republier a sa place, ce serait
    -- decider pour lui de se remontrer apres un incident.
    update public.artisans
       set suspendu_le      = null,
           suspendu_par     = null,
           motif_suspension = null
     where id = p_artisan
    returning * into apres;
  end if;

  perform public.journaliser(
    case when p_suspendre then 'fiche.suspension' else 'fiche.levee_de_suspension' end,
    'artisans', p_artisan::text,
    jsonb_build_object('publie', avant.publie,
                       'suspendu_le', avant.suspendu_le,
                       'motif_suspension', avant.motif_suspension),
    jsonb_build_object('publie', apres.publie,
                       'suspendu_le', apres.suspendu_le,
                       'motif_suspension', apres.motif_suspension));

  return apres;
end $$;

revoke all on function public.moderer_fiche(uuid, boolean, text) from public;
grant execute on function public.moderer_fiche(uuid, boolean, text) to authenticated;


-- ------------------------------------------------------------ les compteurs
--
-- QUINZE COMPTEURS, ET LA RAISON QUAND L'UN MANQUE. La fonction rend une ligne
-- par compteur : la cle, son libelle en francais, la valeur, et `pourquoi`
-- rempli UNIQUEMENT quand la valeur est nulle. Une page n'a donc jamais a
-- choisir entre afficher zero et n'afficher rien.
--
-- LE `execute format` N'OUVRE AUCUNE INJECTION : les seize chaines de la liste
-- sont ecrites ici, en dur, et rien de ce que l'appelant envoie n'y entre. La
-- fonction ne prend d'ailleurs aucun argument.
--
-- ELLE EST EN `security definer` ET ELLE VERIFIE ELLE-MEME `est_admin()` :
-- sans cette verification, une fonction definer contournerait les politiques
-- qu'on vient tout juste de poser, et compterait pour n'importe qui.

create or replace function public.chiffres_back_office()
returns table (cle text, libelle text, valeur bigint, pourquoi text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n bigint;
begin
  if not public.est_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;

  for r in
    select * from (values
      ('artisans_inscrits',   'Comptes ouverts',            'public.artisans',      'true'),
      ('artisans_finis',      'Parcours terminés',          'public.artisans',      'etape = ''fini'''),
      ('artisans_publies',    'Fiches en ligne',            'public.artisans',      'publie'),
      ('artisans_suspendus',  'Fiches suspendues',          'public.artisans',      'suspendu_le is not null'),
      ('artisans_sans_metier','Sans métier déclaré',        'public.artisans',      'metier is null and metier_libre is null'),
      ('liste_attente',       'Liste d''attente',           'public.inscriptions',  'true'),
      ('pieces_a_controler',  'Pièces à contrôler',         'public.pieces',        'etat in (''deposee'',''en_controle'')'),
      ('abonnements_actifs',  'Abonnements actifs',         'public.abonnements',   'etat = ''actif'''),
      ('abonnements_essai',   'Essais en cours',            'public.abonnements',   'etat = ''essai'''),
      ('demandes_total',      'Mises en relation',          'public.demandes',      'true'),
      ('demandes_attente',    'Demandes sans réponse',      'public.demandes',      'etat in (''envoyee'',''vue'')'),
      ('demandes_acceptees',  'Demandes acceptées',         'public.demandes',      'etat = ''acceptee'''),
      ('signalements_ouverts','Signalements non traités',   'public.signalements',  'traite_le is null'),
      ('rgpd_en_retard',      'Demandes RGPD hors délai',   'public.demandes_rgpd',
         'etat in (''recue'',''en_cours'') and echeance_le < now()'),
      ('evaluations_masquees','Notes masquées',             'public.evaluations',   'masquee_le is not null'),
      ('journal_lignes',      'Lignes au journal',          'public.journal',       'true')
    ) as t(cle, libelle, tab, cond)
  loop
    cle := r.cle;
    libelle := r.libelle;
    if to_regclass(r.tab) is null then
      valeur := null;
      pourquoi := 'La table ' || r.tab
        || ' n''existe pas dans cette base : la migration qui la pose n''a pas été jouée.';
    else
      execute format('select count(*)::bigint from %s where %s', r.tab, r.cond) into n;
      valeur := n;
      pourquoi := null;
    end if;
    return next;
  end loop;
end $$;

revoke all on function public.chiffres_back_office() from public;
grant execute on function public.chiffres_back_office() to authenticated;


-- ============================================================
-- CE QUI RESTE A FAIRE HORS DE CE FICHIER :
--
--   1. TRANCHER LE RATTACHEMENT CONTRACTUEL. La ligne « Ton interface
--      d'administration : voir, corriger, suspendre, modérer » (2,5 j /
--      600 EUR) est au devis 2027-02, NON SIGNE. Le devis signe N°20260910-1
--      ne la porte pas. Avenant, signature du devis 2, ou geste commercial
--      assume : a decider par Joan, pas par ce fichier.
--
--   2. LA FUITE MESUREE, ET ELLE PASSE AVANT TOUT LE RESTE. Le declencheur
--      `creer_profil` cree un `profils` ACTIF pour chaque ligne de
--      `auth.users`, donc pour chaque compte artisan cree en libre service par
--      connexion/index.html. Les politiques de `contacts` (est_actif()) et de
--      `inscriptions` (« lecture par les comptes », using true) ne distinguent
--      pas un artisan d'un membre de l'equipe. Le jour ou les inscriptions
--      sont ouvertes dans Supabase, un artisan lit la totalite du CRM et de la
--      liste d'attente. Ce fichier n'aggrave rien : il n'emploie QUE
--      `est_admin()`. Mais il ne repare pas la fuite non plus, et elle doit
--      etre reglee AVANT l'ouverture des inscriptions.
--
--   3. DECIDER QUI EST ADMINISTRATEUR. Aujourd'hui, une seule adresse :
--      migration-admin.sql pose le drapeau sur lower(email) =
--      'contact@joanaglave.fr'. Claire-Marie doit-elle moderer elle-meme ? Si
--      oui, le drapeau se pose au tableau de bord Supabase, jamais depuis une
--      page : `profils_protege_admin` le remet a sa valeur d'origine des que
--      l'ecriture vient d'une session.
--
--   4. ECRIRE LA REGLE DE MODERATION AVANT DE S'EN SERVIR. Rien nulle part ne
--      dit ce qui justifie une suspension, ni ce que l'artisan peut opposer.
--      La base impose un motif, elle ne peut pas imposer qu'il soit juste.
--
--   5. LA RETENTION DU JOURNAL. `journal` grossit sans limite et porte des
--      identifiants de personnes. Une duree de conservation doit etre fixee
--      avec l'avocat, puis appliquee par une tache d'entretien a la cle de
--      service. Ce n'est pas un detail de confort : c'est la meme question que
--      la duree de conservation des messages.
--
--   6. VERIFIER AVEC DEUX COMPTES REELS, jamais par lecture du code :
--      qu'un artisan connecte ne lit toujours AUCUNE ligne d'un autre apres ce
--      fichier ; qu'un artisan suspendu ne peut pas se republier depuis son
--      espace ; qu'un administrateur qui tente de corriger un SIRET voit la
--      valeur revenir d'elle-meme ; et qu'un compte non administrateur qui
--      appelle `chiffres_back_office()` recoit un refus, pas des zeros.
-- ============================================================

-- ------------------------------------------------------------ controles
-- select * from public.chiffres_back_office();
-- select id, prenom, denomination, etape, publie, suspendu_le, motif_suspension
--   from public.artisans order by cree_le desc limit 50;
-- select quand, action, table_cible, ligne_cible from public.journal
--   order by quand desc limit 50;
-- select id, prenom from public.profils where admin;
-- select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' and tablename in
--     ('artisans','artisan_atouts','agendas','occupations') order by tablename, policyname;
