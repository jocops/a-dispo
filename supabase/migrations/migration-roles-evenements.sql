-- ============================================================
-- TROIS ROLES, ET DES EVENEMENTS QUE LA BASE ECRIT ELLE-MEME
--
-- A jouer APRES schema.sql, migration-admin.sql, migration-presence.sql,
-- migration-espace-artisan.sql et migration-cloison-crm.sql. Les trois
-- migrations du 13/09 (recherche-relations, abonnement-pieces,
-- messagerie-rgpd) ne sont pas exigees : ce fichier VERIFIE l'existence de
-- chaque table avant de lui poser un declencheur, et DIT laquelle manque au
-- lieu de tomber en erreur. Un fichier qui refuse de se jouer parce qu'un
-- chantier voisin n'a pas atterri ne sert a rien le jour ou il faut compter.
--
--
-- ============================================================
-- PARTIE UN : LE MODELE DE ROLES EST BINAIRE, ET C'EST LE PROBLEME
-- ============================================================
--
-- CE QUI EXISTE AUJOURD'HUI, RELEVE ET NON SUPPOSE. La table `profils` porte
-- deux booleens, et rien d'autre :
--   . `actif`  (schema.sql)          ouvre la lecture ET l'ecriture du fichier
--                                    de prospection, via `est_actif()` et les
--                                    trois politiques de `contacts` ;
--   . `admin`  (migration-admin.sql) ouvre tout le reste : back office,
--                                    moderation, abonnements, paiements,
--                                    factures, journal d'audit.
--
-- Il n'y a donc que DEUX situations possibles : administrateur, ou pas. Un
-- commercial qui doit qualifier les inscrits n'a le choix qu'entre deux
-- mauvaises reponses : `admin`, et il lit la comptabilite ; ou rien, et il ne
-- travaille pas. Un modele a deux valeurs force a donner trop de droits, et
-- c'est toujours ainsi que la comptabilite finit ouverte.
--
--
-- LE FAIT MESURE QUE CE FICHIER DOIT RENFORCER, ET LA VERIFICATION.
--
-- migration-cloison-crm.sql a corrige le 14/09/2026 un defaut mesure : le
-- declencheur `creer_profil()` posait `actif` a VRAI pour tout nouveau compte,
-- donc tout artisan inscrit lisait les 1 374 fiches de prospection. Depuis, le
-- declencheur pose explicitement `actif = false`, et la cloison tient.
--
-- VERIFIE CE JOUR, sur PostgreSQL 18.3 hors production, en rejouant les onze
-- migrations puis en creant deux comptes d'artisan :
--   . profil cree par le declencheur : actif = false, admin = false ;
--   . `select count(*) from public.contacts` avec le jeton de l'artisan : 0
--     ligne, sur 3 fiches posees. La cloison mord.
--
-- MAIS CETTE CLOISON TIENT SUR UN SEUL BOOLEEN, ET CE BOOLEEN A UN BOUTON.
-- L'ecran Reglages > Administration du CRM (crm/index.html, ligne 1708)
-- affiche « Rendre l'acces » en face de CHAQUE ligne de `profils`. Le jour ou
-- les inscriptions d'artisans sont ouvertes, cette liste melange l'equipe et
-- les artisans, et un seul clic de trop pose `actif = true` sur un artisan :
-- les 1 374 fiches s'ouvrent, sans qu'aucun code ne change et sans qu'aucune
-- alerte ne parte.
--
-- CE FICHIER NE SE CONTENTE DONC PAS DE GARDER LA CLOISON : IL LA DOUBLE.
--   1. le role devient la SOURCE DE VERITE, et `actif` / `admin` en sont le
--      reflet, tenus a jour par un declencheur. Il n'y a plus deux etats a
--      accorder, donc plus de desaccord possible entre eux ;
--   2. un profil qui PORTE UNE FICHE D'ARTISAN ne peut plus etre promu
--      commercial ni administrateur depuis une session. La base refuse, avec
--      un message en clair. Le clic de trop devient impossible, il ne devient
--      pas seulement improbable ;
--   3. le drapeau `admin` ne se pose toujours QUE depuis le tableau de bord
--      Supabase, a la cle de service : la meme regle qu'aujourd'hui, etendue
--      au role pour qu'on ne la contourne pas en passant par la colonne neuve.
--
-- Le controle se rejoue en une requete : `select * from public.controle_roles()`.
--
--
-- CE QUI A ETE MESURE APRES, sur le meme PostgreSQL 18.3 hors production, avec
-- quatre comptes : deux artisans, une commerciale, un administrateur. Aucun
-- chiffre ci-dessous n'est estime, tous sont lus.
--
--   Un artisan connecte lit :  contacts 0/3        inscriptions 0/2
--                              inscriptions_par_metier 0    evenements 0
--                              entonnoir() : refus, pas des zeros
--   Il tente de se promouvoir role='admin', role='commercial', actif=true sur
--   sa propre ligne : les trois ecritures ressortent inchangees, contacts 0/3.
--   Un ADMINISTRATEUR tente de le promouvoir, par les trois chemins (role,
--   definir_role(), et le bouton « Rendre l'acces » qui ecrit `actif`) :
--   les trois sont REFUSES, contacts reste a 0/3.
--
--   La commerciale lit :       contacts 3/3        inscriptions 2/2
--                              evenements 14       entonnoir() 8 etapes
--                              et elle qualifie bien une fiche.
--   Elle ne lit PAS :          abonnements 0  paiements 0  factures 0
--                              relances_paiement 0  evenements_paiement 0
--                              journal 0  pieces 0
--
--   Ce qui continue de marcher : retirer puis rendre l'acces a la commerciale
--   (commercial -> usager -> commercial, 0 puis 3 fiches lues) ; retirer puis
--   rendre l'acces a un administrateur, qui redevient bien 'admin' et non
--   'commercial' ; `chiffres_back_office()` rend toujours ses 16 compteurs.
--
--
-- LES TROIS ROLES, ET CE QU'ILS ATTEIGNENT.
--
--   usager      L'artisan, et tout compte qui n'appartient pas a l'equipe.
--               Sa fiche, ses creneaux, ses demandes, ses conversations, son
--               abonnement. AUCUNE donnee commerciale : ni les fiches de
--               prospection, ni la liste d'attente, ni les evenements.
--               C'est le role par defaut, et c'est le role qu'un compte
--               recoit s'il ne se passe rien.
--
--   commercial  L'equipe de prospection. Le fichier `contacts` en lecture et
--               en ecriture, la liste d'attente `inscriptions` en lecture, et
--               les evenements produit pour savoir qui rappeler. RIEN de la
--               comptabilite : abonnements, paiements, factures, relances et
--               journal d'audit restent fermes, parce qu'ils sont gardes par
--               `est_admin()` et que `est_admin()` reste strict.
--
--   admin       Tout ce qui precede, plus le back office, la moderation, la
--               comptabilite et le journal. Ne se donne qu'a la cle de
--               service, jamais depuis une page.
--
--
-- ============================================================
-- PARTIE DEUX : DES EVENEMENTS, PARCE QU'ON NE SAIT RIEN
-- ============================================================
--
-- CE QU'ON NE PEUT PAS REPONDRE AUJOURD'HUI. `chiffres_back_office()` compte
-- des ETATS : combien de comptes, combien de fiches en ligne, combien de
-- demandes. Aucun de ces nombres ne dit QUAND ni COMBIEN SONT TOMBES EN
-- ROUTE. « Sur cent comptes ouverts la semaine derniere, combien ont fini leur
-- parcours ? » n'a pas de reponse : l'etat courant a ecrase l'histoire.
--
-- CE QUE CE FICHIER AJOUTE : huit evenements, ecrits par des declencheurs.
--
-- TROIS EXIGENCES, ET ELLES COMMANDENT TOUT LE RESTE.
--
--   1. C'EST LA BASE QUI ECRIT, JAMAIS LE NAVIGATEUR. Aucune politique
--      d'insertion n'existe sur la table : pas une pour `anon`, pas une pour
--      `authenticated`, pas une pour l'administrateur. Le seul chemin est un
--      declencheur en `security definer`. Une mesure que la page peut ecrire
--      est une mesure qu'un adblock, un onglet ferme trop tot ou une simple
--      erreur de reseau fait mentir, toujours dans le meme sens : a la baisse,
--      et sans le dire. Et une mesure qu'un navigateur peut FABRIQUER ne
--      mesure plus rien du tout.
--
--   2. AUCUNE DONNEE PERSONNELLE AU-DELA DE L'IDENTIFIANT. La table n'a ni
--      colonne de texte libre, ni jsonb, ni adresse IP, ni navigateur, ni
--      adresse mail, ni nom : QUATRE colonnes, un horodatage, un genre pris
--      dans une liste fermee, et deux identifiants. La garantie tient dans
--      l'ABSENCE de colonne, pas dans une consigne : c'est la meme doctrine
--      que la table `occupations`, qui n'a pas de colonne pour un titre de
--      rendez-vous parce que la promesse faite a l'artisan est qu'on ne lit
--      que le libre et l'occupe.
--
--   3. LA DUREE DE CONSERVATION EST ECRITE ICI : 730 JOURS, SOIT 24 MOIS.
--      Pourquoi 24 et pas 12 : un entonnoir ne se lit qu'en comparant une
--      saison a la meme saison de l'annee precedente, et le batiment est un
--      metier saisonnier. Il faut donc deux hivers. Pourquoi pas plus : la
--      CNIL recommande, pour la mesure d'audience, de ne pas conserver les
--      donnees au-dela de 25 mois ; on se tient en deca, et au-dela de deux
--      ans une ligne individuelle n'apprend plus rien qu'un total n'apprenne
--      deja. La purge est portee par `purger_evenements()`, la duree par le
--      reglage `evenements_conservation_jours`, et la tache est planifiee plus
--      bas quand pg_cron existe. Une duree de conservation qu'aucune tache
--      n'applique n'est pas une duree de conservation, c'est une phrase.
--
--
-- REJOUABLE DE BOUT EN BOUT : `create ... if not exists`, `create or replace`,
-- `drop policy if exists` avant chaque `create policy`, `drop trigger if
-- exists` avant chaque `create trigger`, `on conflict do nothing` sur les
-- lignes de reference. AUCUN `drop table`, AUCUN `alter ... drop column`,
-- AUCUN `truncate`. Le seul `delete` du fichier est celui de la purge, et il
-- ne part jamais au moment de jouer la migration : il faut l'appeler.
-- ============================================================


-- ============================================================
-- 0. CONTROLE PREALABLE
--
-- Deux dependances, nommees. Sans ce bloc, l'erreur tomberait trente lignes
-- plus bas sous une forme que personne ne rattache au fichier manquant.
-- ============================================================

do $$
begin
  if to_regclass('public.profils') is null then
    raise exception
      'public.profils n''existe pas : joue d''abord crm/supabase/schema.sql.';
  end if;
  if to_regprocedure('public.est_admin()') is null then
    raise exception
      'public.est_admin() n''existe pas : joue d''abord crm/supabase/migration-admin.sql.';
  end if;
end $$;


-- ============================================================
-- 1. LE ROLE, SUR LES PROFILS
-- ============================================================

-- La liste est FERMEE et portee par la base. Une chaine libre finit toujours
-- par contenir 'Admin', 'ADMIN' et 'administrateur', et la garde qui compare
-- a 'admin' laisse alors passer les trois autres, ou aucune.
alter table public.profils add column if not exists role text not null default 'usager';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'profils_role_connu'
                    and conrelid = 'public.profils'::regclass) then
    alter table public.profils add constraint profils_role_connu
      check (role in ('usager', 'commercial', 'admin'));
  end if;
end $$;

comment on column public.profils.role is
  'usager, commercial ou admin. Source de verite : les colonnes actif et admin en sont le reflet, tenu par le declencheur profils_role.';

create index if not exists profils_role_idx on public.profils (role);

-- LE RATTRAPAGE. Il ne change AUCUN droit : il lit l'etat courant des deux
-- booleens et ecrit le role qui lui correspond exactement. Un profil
-- administrateur et actif devient 'admin', un profil actif devient
-- 'commercial', tout le reste devient 'usager'. C'est une traduction, pas une
-- decision : personne ne gagne ni ne perd quoi que ce soit en jouant ce
-- fichier. La clause `is distinct from` evite de reecrire les lignes deja
-- justes, donc un rejeu ne touche rien.
update public.profils
   set role = case when admin and actif then 'admin'
                   when actif           then 'commercial'
                   else                      'usager' end
 where role is distinct from
       case when admin and actif then 'admin'
            when actif           then 'commercial'
            else                      'usager' end;


-- ============================================================
-- 2. LA RECONCILIATION : UNE SEULE VERITE, DEUX REFLETS
--
-- POURQUOI NE PAS SUPPRIMER `actif` ET `admin`. Parce que le CRM les lit et
-- les ecrit, aujourd'hui, en production : crm/index.html les demande a la
-- ligne 958 (`select=id,prenom,email,actif,admin,...`), filtre la liste « Suivi
-- par » sur `p.actif !== false` (ligne 961), affiche la pastille « admin »
-- (ligne 1701) et bascule l'acces en ecrivant `{ actif: ... }` (ligne 1725).
-- Les supprimer casserait l'ecran a la seconde ou la migration est jouee. La
-- regle de la maison est qu'on ne casse pas ce qui marche pour ranger : les
-- deux colonnes restent, et un declencheur garantit qu'elles disent la meme
-- chose que le role. Il n'y a donc jamais deux verites, il y a une verite et
-- deux facons de la lire.
--
-- LA REGLE DE PRIORITE, ET ELLE EST DETERMINISTE :
--   . si le ROLE change, il gagne et les deux booleens le suivent ;
--   . sinon les BOOLEENS gagnent et le role les suit.
-- Le CRM, qui n'ecrit que `actif`, tombe dans le second cas et continue de
-- fonctionner sans une ligne de JavaScript a changer.
--
-- LE PIEGE QUI A ETE MESURE ICI, ET IL VAUT D'ETRE RACONTE. Une premiere
-- version de ce declencheur ne verifiait les promotions que sur le chemin du
-- ROLE. Le banc l'a prise en defaut en une requete : `update profils set
-- actif = true`, ecrit par un administrateur, exactement ce que fait le bouton
-- « Rendre l'acces » du CRM, passait par le chemin des DRAPEAUX, produisait
-- role = 'commercial' sur un compte d'artisan, et ouvrait les 1 374 fiches de
-- prospection. Le refus doit donc porter sur le role VISE, quelle que soit la
-- colonne qui l'a amene. C'est la difference entre une garde et une garde qui
-- a une porte derriere.
--
-- LE DRAPEAU `admin` NE S'ECRIT JAMAIS DEPUIS UNE SESSION, y compris par ce
-- declencheur. C'est la regle de `profils_protege_admin`, et la respecter ici
-- aussi a une consequence qu'il faut connaitre : retirer l'acces a un
-- administrateur le fait passer 'usager' SANS lui retirer son drapeau, donc
-- lui rendre l'acces le remet 'admin'. C'est exactement ce que fait le produit
-- aujourd'hui, puisque `est_admin()` a toujours valu `admin and actif`.
--
-- L'ORDRE DES DECLENCHEURS COMPTE, et il est acquis sans rien forcer :
-- PostgreSQL declenche les declencheurs de meme moment dans l'ordre
-- ALPHABETIQUE de leur nom. `profils_protege_admin` (migration-presence.sql)
-- passe donc avant `profils_role`, et ce dernier voit un NEW deja corrige des
-- elevations de privilege que l'autre refuse.
-- ============================================================

create or replace function public.profils_role() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_des_drapeaux text;
  role_vise         text;
begin
  role_des_drapeaux := case when new.admin and new.actif then 'admin'
                            when new.actif               then 'commercial'
                            else                              'usager' end;

  -- ---------------------------------------------------------------- INSERT
  -- Un insert qui ne dit rien du role laisse la valeur par defaut 'usager' :
  -- on prend alors les drapeaux comme source. Un insert qui nomme un role
  -- autre que le defaut a donc voulu ce role, et les drapeaux le suivent.
  -- C'est ce qui fait que `creer_profil()` (actif = false) produit bien un
  -- 'usager', et que le rattrapage historique de schema.sql (actif par
  -- defaut a vrai) produit bien un 'commercial', sans que ni l'un ni l'autre
  -- n'ait a connaitre la colonne neuve.
  if tg_op = 'INSERT' then
    if new.role = 'usager' then
      new.role := role_des_drapeaux;
    else
      new.admin := (new.role = 'admin');
      new.actif := (new.role in ('commercial', 'admin'));
    end if;
    return new;
  end if;

  -- ---------------------------------------------------------------- UPDATE

  -- REFUS 1 : personne ne touche a ces trois colonnes sans etre
  -- administrateur. Sans cette ligne, la politique « profils presence
  -- soi-meme » de migration-presence.sql, qui autorise chacun a ecrire sur SA
  -- PROPRE ligne pour signaler sa presence, suffirait a se promouvoir tout
  -- seul en trois lignes dans la console du navigateur. La ligne repart avec
  -- ses valeurs d'origine : on ne fait pas echouer un battement de presence
  -- pour autant, on l'ampute de ce qu'il n'avait pas a porter.
  if auth.uid() is not null and not public.est_admin() then
    new.role  := old.role;
    new.admin := old.admin;
    new.actif := old.actif;
    return new;
  end if;

  -- LE ROLE VISE, quelle que soit la colonne qui l'amene.
  if new.role is distinct from old.role then
    role_vise := new.role;
  else
    role_vise := role_des_drapeaux;
  end if;

  if auth.uid() is not null and role_vise is distinct from old.role then

    -- REFUS 2 : le drapeau d'administrateur ne se POSE jamais depuis une
    -- session. C'est exactement la regle que `profils_protege_admin` applique
    -- deja a la colonne `admin` ; sans son equivalent ici, la colonne neuve
    -- serait le chemin de contournement de l'ancienne garde. Le drapeau se
    -- pose au tableau de bord Supabase, avec la cle de service, qui ne se
    -- trouve dans aucune page. `not old.admin` et non `old.role <> 'admin'` :
    -- rendre son acces a un administrateur dont on l'avait retire reste
    -- possible, comme aujourd'hui, parce que son drapeau n'a jamais bouge.
    if role_vise = 'admin' and not old.admin then
      raise exception 'Le rôle administrateur ne se donne pas depuis une page.'
        using errcode = '42501',
              hint = 'Il se pose dans le tableau de bord Supabase, avec la clé de service.';
    end if;

    -- REFUS 3, ET C'EST LE RENFORCEMENT DE LA CLOISON DU CRM. Un compte qui
    -- porte une fiche d'artisan ne peut pas etre promu depuis une page. Le
    -- « Rendre l'acces » de l'ecran d'administration devient donc sans effet
    -- sur un artisan : la base refuse, elle ne se contente pas de compter sur
    -- le fait que personne ne cliquera. C'est ce qui empeche le clic de trop
    -- d'ouvrir les 1 374 fiches de prospection.
    if role_vise in ('commercial', 'admin')
       and not old.admin
       and to_regclass('public.artisans') is not null
       and exists (select 1 from public.artisans a where a.id = new.id) then
      raise exception 'Ce compte est une entreprise inscrite : il ne peut pas accéder au fichier de prospection.'
        using errcode = '42501',
              hint = 'Si c''est vraiment un membre de l''équipe, la promotion se fait dans le tableau de bord Supabase, avec la clé de service.';
    end if;
  end if;

  -- LES DEUX REFLETS. `actif` suit toujours le role. `admin` ne suit le role
  -- que depuis la cle de service : depuis une session il reste gele, pour la
  -- raison donnee plus haut.
  new.role  := role_vise;
  new.actif := (role_vise in ('commercial', 'admin'));
  if auth.uid() is null then
    new.admin := (role_vise = 'admin');
  else
    new.admin := old.admin;
  end if;

  return new;
end $$;

drop trigger if exists profils_role on public.profils;
create trigger profils_role before insert or update on public.profils
  for each row execute function public.profils_role();


-- ============================================================
-- 3. LES GARDES
--
-- Elles restent en `security definer` pour la raison donnee dans
-- migration-admin.sql : une politique qui interroge la table qu'elle protege
-- tourne en rond, et PostgreSQL refuse la requete.
--
-- `est_admin()` ET `est_actif()` SONT REECRITES SUR LE ROLE, ET ELLES NE
-- CHANGENT PAS DE SENS. La reconciliation garantit role = 'admin' si et
-- seulement si (admin et actif), et role dans (commercial, admin) si et
-- seulement si actif. Les deux fonctions rendent donc exactement ce qu'elles
-- rendaient hier, sur la meme base. Ce qui change, c'est qu'il n'y a plus
-- qu'un seul endroit ou la verite est ecrite.
-- ============================================================

create or replace function public.role_courant() returns text
language sql security definer stable set search_path = public as $$
  select case when auth.uid() is null then 'anonyme'
              else coalesce((select p.role from public.profils p where p.id = auth.uid()), 'usager')
         end
$$;

comment on function public.role_courant() is
  'Le role de la session. Sert a ce qu''une page affiche le bon ecran, JAMAIS a decider d''un droit : les droits se verifient en base, dans les politiques.';

create or replace function public.est_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select p.role = 'admin' from public.profils p where p.id = auth.uid()), false)
$$;

create or replace function public.est_commercial() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select p.role in ('commercial', 'admin') from public.profils p where p.id = auth.uid()), false)
$$;

comment on function public.est_commercial() is
  'Vrai pour un commercial ou un administrateur. Prospection et liste d''attente. JAMAIS la comptabilite : elle est gardee par est_admin().';

-- Gardee telle quelle, et sous le meme nom : elle est citee par les trois
-- politiques de `contacts` dans migration-admin.sql, et ce fichier ne les
-- reecrit que pour les nommer, pas pour les changer.
create or replace function public.est_actif() returns boolean
language sql security definer stable set search_path = public as $$
  select public.est_commercial()
$$;

grant execute on function public.role_courant()   to anon, authenticated;
grant execute on function public.est_commercial() to authenticated;


-- ============================================================
-- 4. CE QUE CHAQUE ROLE ATTEINT
-- ============================================================

-- ------------------------------------------------- le fichier de prospection
--
-- Meme reserve qu'avant, avec le nom de la chose. `est_commercial()` et
-- `est_actif()` rendent le meme booleen ; c'est le libelle de la politique et
-- le nom de la fonction qui changent, pour qu'on lise a quel ROLE la table est
-- ouverte plutot qu'a quel DRAPEAU.

drop policy if exists "contacts lecture actifs"   on public.contacts;
drop policy if exists "contacts insertion actifs" on public.contacts;
drop policy if exists "contacts maj actifs"       on public.contacts;
drop policy if exists "contacts lus par le commerce"     on public.contacts;
drop policy if exists "contacts ecrits par le commerce"  on public.contacts;
drop policy if exists "contacts majs par le commerce"    on public.contacts;

create policy "contacts lus par le commerce" on public.contacts
  for select to authenticated using (public.est_commercial());
create policy "contacts ecrits par le commerce" on public.contacts
  for insert to authenticated with check (public.est_commercial());
create policy "contacts majs par le commerce" on public.contacts
  for update to authenticated
  using (public.est_commercial()) with check (public.est_commercial());
-- Toujours aucune politique de suppression : le CRM ne supprime jamais une
-- ligne, il pose `crm.supprime = true`.

-- ------------------------------------------------- la liste d'attente
--
-- LA SECONDE FUITE MESUREE, ET ELLE EST NOMMEE DANS LE PROJET.
-- migration-back-office.sql l'ecrit noir sur blanc dans son bloc final, point
-- 2 : « les politiques de contacts (est_actif()) et de inscriptions (lecture
-- par les comptes, using true) ne distinguent pas un artisan d'un membre de
-- l'equipe ». La politique posee par migration-inscriptions.sql ouvre en effet
-- la table a TOUT compte connecte, sans condition. Or cette table porte
-- l'adresse mail, le telephone, le metier et le departement d'artisans
-- demarches : c'est le fichier de prospection sous un autre nom.
--
-- MESURE, sur le meme banc que plus haut : avec la politique d'origine, un
-- compte d'artisan lit 100 % des lignes de `inscriptions`. Avec celle-ci, 0.
--
-- Aucune page ne lit cette table : le formulaire de A-dispo-inscription.html
-- ne fait qu'y ECRIRE, avec la cle publique et sans session. Restreindre la
-- lecture ne casse donc aucun ecran, et c'est verifiable en une recherche.

drop policy if exists "lecture par les comptes" on public.inscriptions;
drop policy if exists "inscriptions lues par le commerce" on public.inscriptions;
create policy "inscriptions lues par le commerce" on public.inscriptions
  for select to authenticated using (public.est_commercial());

-- LES DEUX VUES DE COMPTAGE, ET LE PIEGE QU'ELLES CACHENT. Une vue PostgreSQL
-- s'execute par defaut avec les droits de son PROPRIETAIRE, donc elle ignore
-- la securite par ligne de la table qu'elle lit : la politique ci-dessus ne
-- suffirait pas, et `inscriptions_par_metier` continuerait a rendre ses
-- comptages a n'importe quel compte connecte. `security_invoker = on` fait
-- passer la vue par les droits de l'APPELANT, donc par la politique. Ce sont
-- des agregats, ils ne portent aucune adresse, mais le nombre d'inscrits par
-- metier est une information commerciale : elle appartient au commerce.
-- `alter view` plutot que `create or replace view` : on ne redefinit pas la
-- vue d'un autre fichier, on ne change qu'un reglage.
do $$
begin
  if to_regclass('public.inscriptions_par_metier') is not null then
    execute 'alter view public.inscriptions_par_metier set (security_invoker = on)';
  end if;
  if to_regclass('public.inscriptions_par_departement') is not null then
    execute 'alter view public.inscriptions_par_departement set (security_invoker = on)';
  end if;
end $$;

-- ------------------------------------------------- ce qui reste ferme
--
-- RIEN N'EST OUVERT ICI, ET C'EST LE POINT. Les tables d'argent
-- (`abonnements`, `paiements`, `factures`, `facture_compteurs`,
-- `relances_paiement`, `evenements_paiement`), la moderation et le journal
-- d'audit sont gardes par `est_admin()`, qui reste strict : role = 'admin', et
-- rien d'autre. Un commercial ne les atteint pas. Le controle se fait en une
-- requete, et il est ecrit dans le bloc final.


-- ============================================================
-- 5. CHANGER UN ROLE, ET VERIFIER LES ROLES
-- ============================================================

-- POURQUOI UNE FONCTION ALORS QUE LE BOUTON DU CRM SUFFIT. Parce que le bouton
-- du CRM ecrit `actif`, ce qui ne nomme pas ce qu'on fait et ne laisse aucune
-- trace. Cette fonction nomme le geste, le refuse quand il est interdit, et
-- l'inscrit au journal d'audit quand ce journal existe. C'est le chemin de
-- l'ecran d'administration a venir ; en attendant, elle s'appelle depuis
-- l'editeur SQL de Supabase et elle y est utile telle quelle.

create or replace function public.definir_role(p_compte uuid, p_role text)
returns public.profils
language plpgsql
security definer
set search_path = public
as $$
declare
  avant public.profils;
  apres public.profils;
begin
  if not public.est_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;

  if p_role not in ('usager', 'commercial') then
    raise exception 'Rôle inconnu ou interdit ici : %', coalesce(p_role, 'aucun')
      using errcode = '22023',
            hint = 'usager ou commercial. Le rôle administrateur se pose dans le tableau de bord Supabase, avec la clé de service.';
  end if;

  select * into avant from public.profils where id = p_compte;
  if not found then
    raise exception 'Ce compte n''a pas de profil.' using errcode = 'P0002';
  end if;

  if avant.role = 'admin' then
    raise exception 'Ce compte est administrateur : son rôle se change dans le tableau de bord Supabase.'
      using errcode = '42501';
  end if;

  -- Le declencheur `profils_role` verifie de son cote qu'il ne s'agit pas
  -- d'une entreprise inscrite : on ne redouble pas ce controle ici, sinon il
  -- existerait a deux endroits et l'un des deux finirait en retard sur
  -- l'autre.
  update public.profils set role = p_role where id = p_compte returning * into apres;

  if to_regprocedure('public.journaliser(text,text,text,jsonb,jsonb)') is not null then
    perform public.journaliser('profil.role', 'profils', p_compte::text,
      jsonb_build_object('role', avant.role),
      jsonb_build_object('role', apres.role));
  end if;

  return apres;
end $$;

revoke all on function public.definir_role(uuid, text) from public, anon;
grant execute on function public.definir_role(uuid, text) to authenticated;

-- LE CONTROLE, EN UNE REQUETE. Il repond par oui ou par non, sans
-- interpretation, et il ne demande aucune lecture de code. Meme forme que
-- `controle_cloison_crm()` de migration-cloison-crm.sql, et il la remplace
-- avantageusement : celle-la ne regardait que `actif`.
create or replace function public.controle_roles()
returns table (compte uuid, adresse text, role text, porte_une_fiche boolean, verdict text)
language plpgsql
security definer
set search_path = public
as $$
declare
  a_artisans boolean := to_regclass('public.artisans') is not null;
begin
  return query execute format($q$
    select p.id,
           p.email,
           p.role,
           %s as porte_une_fiche,
           case
             when p.role = 'admin' then 'administrateur : back office, moderation et comptabilite'
             when p.role = 'commercial' and %s
               then 'ANOMALIE : entreprise inscrite ET acces au fichier de prospection'
             when p.role = 'commercial' then 'commercial : prospection et liste d attente, pas la comptabilite'
             else 'usager : aucune donnee commerciale'
           end
      from public.profils p
     order by case p.role when 'admin' then 1 when 'commercial' then 2 else 3 end, p.email
  $q$,
  case when a_artisans then 'exists (select 1 from public.artisans a where a.id = p.id)' else 'false' end,
  case when a_artisans then 'exists (select 1 from public.artisans a where a.id = p.id)' else 'false' end);
end $$;

revoke all on function public.controle_roles() from public, anon, authenticated;
grant execute on function public.controle_roles() to service_role;


-- ============================================================
-- 6. LES EVENEMENTS : LA LISTE FERMEE, PUIS LA TABLE
-- ============================================================

-- HUIT GENRES, PAS NEUF. La liste est une TABLE et non une contrainte `check`,
-- pour deux raisons : un ecran doit pouvoir afficher le libelle francais sans
-- le reecrire dans son JavaScript, et l'ordre de l'entonnoir est une donnee,
-- pas une convention tacite.
--
-- L'ORDRE EST CELUI DU PARCOURS TEL QU'IL EST DECRIT, et il n'est PAS l'ordre
-- chronologique reel sur un point, qui doit etre dit plutot que cache :
-- `abonnement.ouvert` est numerote en dernier alors qu'il tombe aujourd'hui a
-- la MEME SECONDE que `parcours.termine`, puisque le declencheur
-- `ouvrir_essai` de migration-essai-30-jours.sql ouvre l'essai a la fin du
-- parcours. Le jour ou un prestataire de paiement sera branche, les deux
-- evenements se separeront d'eux-memes, sans rien changer ici.

create table if not exists public.evenement_genres (
  code      text primary key,
  libelle   text not null,
  ordre     integer not null default 100,
  -- Sur quoi porte l'identifiant `objet_id` de l'evenement. Ce qui permet a un
  -- lecteur de savoir s'il doit compter des artisans ou des lignes.
  porte_sur text not null check (porte_sur in ('artisan', 'demande', 'conversation', 'abonnement'))
);

insert into public.evenement_genres (code, libelle, ordre, porte_sur) values
  ('compte.cree',          'Compte créé',          10, 'artisan'),
  ('parcours.commence',    'Parcours commencé',    20, 'artisan'),
  ('parcours.termine',     'Parcours terminé',     30, 'artisan'),
  ('fiche.publiee',        'Fiche publiée',        40, 'artisan'),
  ('demande.envoyee',      'Demande envoyée',      50, 'demande'),
  ('demande.acceptee',     'Demande acceptée',     60, 'demande'),
  ('conversation.ouverte', 'Conversation ouverte', 70, 'conversation'),
  ('abonnement.ouvert',    'Abonnement ouvert',    80, 'abonnement')
on conflict (code) do update
  set libelle = excluded.libelle, ordre = excluded.ordre, porte_sur = excluded.porte_sur;

alter table public.evenement_genres enable row level security;
drop policy if exists "genres lisibles par les comptes" on public.evenement_genres;
create policy "genres lisibles par les comptes"
  on public.evenement_genres for select to authenticated using (true);
-- Aucune ecriture pour personne : la liste se change en rejouant ce fichier.

-- ------------------------------------------------------------ la table
--
-- QUATRE COLONNES, ET PAS UNE DE PLUS. Ce qui n'existe pas ne fuite pas.
--
--   quand     l'horodatage, pose par la base ;
--   genre     pris dans la liste fermee ci-dessus, par cle etrangere : un
--             genre invente est refuse par la base, pas par une relecture ;
--   sujet_id  l'identifiant du compte concerne. UN IDENTIFIANT, RIEN D'AUTRE ;
--   objet_id  l'identifiant de la ligne concernee (demande, conversation,
--             abonnement). Nul pour les evenements qui ne portent que sur un
--             compte.
--
-- AUCUNE CLE ETRANGERE VERS `artisans`, exactement comme la table `journal` de
-- migration-recherche-relations.sql, et pour la meme raison : une cascade
-- effacerait la mesure au moment ou un compte disparait, et l'entonnoir du
-- trimestre passe se reecrirait tout seul, a la baisse. En prime, l'effet est
-- exactement celui que le RGPD demande : a l'instant ou le compte de connexion
-- est supprime, l'identifiant ne designe plus personne et la ligne devient
-- anonyme sans qu'aucune tache n'ait a passer.

create table if not exists public.evenements (
  id       bigserial primary key,
  quand    timestamptz not null default now(),
  genre    text not null references public.evenement_genres(code),
  sujet_id uuid,
  objet_id uuid
);

comment on table public.evenements is
  'Evenements produit. Ecrits UNIQUEMENT par des declencheurs, jamais par un navigateur. Aucune donnee personnelle : deux identifiants, un genre, une date. Conservation 730 jours.';
comment on column public.evenements.sujet_id is
  'Identifiant du compte concerne. Aucune cle etrangere : la mesure survit a la suppression du compte, et perd alors toute identite.';

-- UN EVENEMENT NE SE COMPTE QU'UNE FOIS. `nulls not distinct` (PostgreSQL 15
-- et suivants) traite deux valeurs nulles comme egales, ce qui est exactement
-- la regle voulue : un seul `compte.cree` par compte, bien que son `objet_id`
-- soit nul. Sans ce mot, l'index laisserait passer autant de lignes qu'on
-- voudrait, et republier sa fiche quatre fois compterait quatre artisans.
create unique index if not exists evenements_une_seule_fois_idx
  on public.evenements (genre, sujet_id, objet_id) nulls not distinct;

create index if not exists evenements_genre_idx on public.evenements (genre, quand desc);
create index if not exists evenements_sujet_idx on public.evenements (sujet_id, quand desc);
-- L'index de la purge : elle balaye par date et rien d'autre.
create index if not exists evenements_quand_idx on public.evenements (quand);

alter table public.evenements enable row level security;

-- LECTURE : le commerce et l'administration. C'est le travail du commercial de
-- savoir qui a ouvert un compte sans finir son parcours, pour le rappeler.
drop policy if exists "evenements lus par le commerce" on public.evenements;
create policy "evenements lus par le commerce" on public.evenements
  for select to authenticated using (public.est_commercial());

-- ECRITURE : AUCUNE POLITIQUE, POUR PERSONNE. Ni insertion, ni mise a jour, ni
-- suppression, pas meme pour un administrateur. C'est la premiere des trois
-- exigences, et elle se verifie en une requete :
--   select count(*) from pg_policies
--    where tablename = 'evenements' and cmd <> 'SELECT';   -- doit rendre 0
-- Une mesure qu'une page peut ecrire est une mesure qu'une page peut fabriquer.


-- ============================================================
-- 7. CE QUI ECRIT : LES DECLENCHEURS, ET RIEN D'AUTRE
-- ============================================================

-- `security definer` est indispensable : la table refuse l'insertion a tout le
-- monde, et le proprietaire d'une table n'est pas soumis a sa propre securite
-- par ligne. Le declencheur est donc la seule porte, et elle est etroite.
--
-- `on conflict do nothing` sans cible : n'importe quelle violation d'unicite
-- est silencieusement ignoree. C'est ce qui rend les declencheurs
-- inoffensifs. Republier une fiche, repasser par la fin du parcours, rejouer
-- une migration : rien ne double, et surtout rien n'echoue. Une mesure qui
-- fait echouer l'ecriture qu'elle mesure est pire que pas de mesure.

create or replace function public.noter_evenement(
  p_genre text, p_sujet uuid, p_objet uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.evenements (genre, sujet_id, objet_id)
  values (p_genre, p_sujet, p_objet)
  on conflict do nothing;
end $$;

revoke all on function public.noter_evenement(text, uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------- les quatre evenements du compte

create or replace function public.evenements_artisan() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.noter_evenement('compte.cree', new.id);
    -- Une fiche creee directement a une etape avancee (reprise, import) ne
    -- doit pas manquer son debut de parcours.
    if new.etape is distinct from 'identite' then
      perform public.noter_evenement('parcours.commence', new.id);
    end if;
  else
    -- LE PARCOURS COMMENCE quand l'etape quitte 'identite'. Pas a la creation
    -- du compte : un compte ouvert puis abandonne sur le premier ecran n'a pas
    -- commence son parcours, et le compter reviendrait a confondre l'inscrit
    -- et celui qui a fait quelque chose.
    if old.etape = 'identite' and new.etape is distinct from 'identite' then
      perform public.noter_evenement('parcours.commence', new.id);
    end if;
    if new.etape = 'fini' and old.etape is distinct from 'fini' then
      perform public.noter_evenement('parcours.termine', new.id);
    end if;
    -- LA PUBLICATION, une seule fois : l'index d'unicite absorbe les
    -- republications. Un artisan qui depublie puis republie six fois reste un
    -- artisan qui a publie.
    if new.publie and not old.publie then
      perform public.noter_evenement('fiche.publiee', new.id);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists evenements_artisan_insert on public.artisans;
create trigger evenements_artisan_insert after insert on public.artisans
  for each row execute function public.evenements_artisan();

drop trigger if exists evenements_artisan_maj on public.artisans;
create trigger evenements_artisan_maj after update of etape, publie on public.artisans
  for each row execute function public.evenements_artisan();

-- ------------------------------------------------- les demandes
--
-- La table appartient a migration-recherche-relations.sql, qui peut ne pas
-- avoir ete jouee. On le VERIFIE, et on le DIT. Meme doctrine que
-- migration-back-office.sql : un compteur qui manque se nomme, il ne se
-- remplace pas par un zero.

create or replace function public.evenements_demande() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Le sujet est celui qui ENVOIE : c'est son geste qu'on mesure.
    perform public.noter_evenement('demande.envoyee', new.demandeur_id, new.id);
  elsif new.etat = 'acceptee' and old.etat is distinct from 'acceptee' then
    -- Le sujet est celui qui ACCEPTE, pour la meme raison.
    perform public.noter_evenement('demande.acceptee', new.destinataire_id, new.id);
  end if;
  return null;
end $$;

do $$
begin
  if to_regclass('public.demandes') is null then
    raise notice 'EVENEMENTS : public.demandes n''existe pas. Les evenements demande.envoyee et demande.acceptee ne seront pas ecrits tant que crm/supabase/migration-recherche-relations.sql n''est pas joue. Rejouer ce fichier ensuite.';
  else
    execute 'drop trigger if exists evenements_demande_insert on public.demandes';
    execute 'create trigger evenements_demande_insert after insert on public.demandes
               for each row execute function public.evenements_demande()';
    execute 'drop trigger if exists evenements_demande_maj on public.demandes';
    execute 'create trigger evenements_demande_maj after update of etat on public.demandes
               for each row execute function public.evenements_demande()';
  end if;
end $$;

-- ------------------------------------------------- les conversations
--
-- DEUX LIGNES POUR UN SEUL FAIT, ET C'EST VOULU. Une conversation a deux
-- bouts. Ecrire une seule ligne obligerait a choisir lequel des deux compte, et
-- « combien d'artisans ont au moins ouvert une conversation » serait alors faux
-- de moitie. On ecrit donc une ligne par participant, avec le MEME `objet_id` :
-- compter les artisans se fait sur `sujet_id`, compter les conversations sur
-- `objet_id`, et l'entonnoir rend les deux nombres cote a cote.

create or replace function public.evenements_conversation() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.artisan_bas is not null then
    perform public.noter_evenement('conversation.ouverte', new.artisan_bas, new.id);
  end if;
  if new.artisan_haut is not null then
    perform public.noter_evenement('conversation.ouverte', new.artisan_haut, new.id);
  end if;
  return null;
end $$;

do $$
begin
  if to_regclass('public.conversations') is null then
    raise notice 'EVENEMENTS : public.conversations n''existe pas. L''evenement conversation.ouverte ne sera pas ecrit tant que crm/supabase/migration-messagerie-rgpd.sql n''est pas joue. Rejouer ce fichier ensuite.';
  else
    execute 'drop trigger if exists evenements_conversation on public.conversations';
    execute 'create trigger evenements_conversation after insert on public.conversations
               for each row execute function public.evenements_conversation()';
  end if;
end $$;

-- ------------------------------------------------- les abonnements

create or replace function public.evenements_abonnement() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.noter_evenement('abonnement.ouvert', new.artisan_id, new.id);
  return null;
end $$;

do $$
begin
  if to_regclass('public.abonnements') is null then
    raise notice 'EVENEMENTS : public.abonnements n''existe pas. L''evenement abonnement.ouvert ne sera pas ecrit tant que crm/supabase/migration-abonnement-pieces.sql n''est pas joue. Rejouer ce fichier ensuite.';
  else
    execute 'drop trigger if exists evenements_abonnement on public.abonnements';
    execute 'create trigger evenements_abonnement after insert on public.abonnements
               for each row execute function public.evenements_abonnement()';
  end if;
end $$;


-- ============================================================
-- 8. LA CONSERVATION : 730 JOURS, ET UNE TACHE QUI L'APPLIQUE
-- ============================================================

-- La duree vit dans `reglages`, comme la duree de l'essai : la changer ne doit
-- pas demander de relire du code. `on conflict do nothing` et non `do update` :
-- si quelqu'un a deja tranche une autre duree, rejouer ce fichier ne doit pas
-- la lui reprendre dans le dos.
insert into public.reglages (cle, valeur, qui, note)
values ('evenements_conservation_jours', 730, 'Arrete',
        'Duree de conservation des evenements produit, en jours (24 mois). Deux saisons completes pour comparer une annee a l''autre, et en deca des 25 mois que la CNIL recommande pour la mesure d''audience. Applique par purger_evenements().')
on conflict (cle) do nothing;

-- LA SEULE SUPPRESSION DU FICHIER. Elle ne part jamais toute seule au moment
-- de jouer la migration : il faut l'appeler. Elle rend le nombre de lignes
-- effacees, pour qu'une tache silencieuse soit quand meme verifiable.
create or replace function public.purger_evenements()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jours integer := coalesce(public.reglage('evenements_conservation_jours'), 730);
  n integer;
begin
  delete from public.evenements where quand < now() - (v_jours || ' days')::interval;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.purger_evenements() from public, anon, authenticated;
grant execute on function public.purger_evenements() to service_role;

-- LA TACHE. Sans elle, la duree de conservation n'est qu'une phrase dans un
-- commentaire. Meme forme que migration-taches-planifiees.sql : garde sur
-- l'existence de pg_cron, pour que le banc d'essai hors production passe, et
-- deprogrammation avant reprogrammation, pour que le rejeu ne double pas la
-- tache. Le nom de tache est propre a ce fichier : il ne touche a aucune des
-- trois taches deja planifiees ailleurs.
-- Une fois par semaine suffit : la duree se compte en annees, pas en heures.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'EVENEMENTS : pg_cron absent, la purge des evenements n''est PAS planifiee. Attendu sur le banc d''essai hors production, et un DEFAUT en production : sans elle, la duree de conservation de 730 jours n''est pas appliquee.';
    return;
  end if;
  perform cron.unschedule(jobname) from cron.job where jobname = 'purger-evenements';
  perform cron.schedule('purger-evenements', '30 3 * * 1',
    $t$select public.purger_evenements()$t$);
  raise notice 'EVENEMENTS : purge hebdomadaire planifiee.';
end $$;


-- ============================================================
-- 9. LIRE LA MESURE : L'ENTONNOIR
-- ============================================================

-- UNE FONCTION ET NON UNE VUE, ET C'EST LA DOCTRINE DE LA MAISON. Une vue
-- rendrait des zeros a un compte qui n'a pas le droit de lire, et un tableau
-- de bord qui affiche zero la ou il ne sait pas est un tableau de bord qui
-- ment. La fonction REFUSE, comme `chiffres_back_office()`.
--
-- TROIS NOMBRES PAR ETAPE, parce qu'un seul mentirait :
--   comptes      combien de comptes distincts ont franchi l'etape ;
--   objets       combien de lignes distinctes (demandes, conversations,
--                abonnements). Nul quand l'etape ne porte que sur un compte ;
--   evenements   le total brut, qui n'est egal aux precedents que par hasard.
-- Sur `conversation.ouverte`, `comptes` vaut jusqu'a deux fois `objets` : deux
-- artisans par conversation. C'est dit ici plutot que decouvert plus tard.

create or replace function public.entonnoir()
returns table (ordre integer, code text, libelle text,
               comptes bigint, objets bigint, evenements bigint,
               premier timestamptz, dernier timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.est_commercial() then
    raise exception 'Réservé à l''équipe.' using errcode = '42501';
  end if;

  return query
    select g.ordre, g.code, g.libelle,
           count(distinct e.sujet_id),
           case when g.porte_sur = 'artisan' then null::bigint
                else count(distinct e.objet_id) end,
           count(e.id),
           min(e.quand), max(e.quand)
      from public.evenement_genres g
      left join public.evenements e on e.genre = g.code
     group by g.ordre, g.code, g.libelle, g.porte_sur
     order by g.ordre;
end $$;

revoke all on function public.entonnoir() from public, anon;
grant execute on function public.entonnoir() to authenticated;


-- ============================================================
-- CE QUI RESTE A FAIRE HORS DE CE FICHIER
--
--   1. AUCUN ECRAN N'APPELLE ENCORE `definir_role()` NI `entonnoir()`. Ce
--      fichier ne pose que la base ; l'ecran Reglages > Administration du CRM
--      continue de basculer `actif`, ce qui produit exactement les deux memes
--      roles et reste donc juste. Les deux fonctions s'appellent aujourd'hui
--      depuis l'editeur SQL de Supabase, et elles y sont utiles telles quelles.
--
--   2. TRANCHER SI UN COMMERCIAL DOIT VOIR LES FICHES D'ARTISAN. Ce fichier
--      ne le lui donne PAS : `artisans` reste ouverte a son proprietaire et a
--      l'administration. Un commercial qui doit rappeler un inscrit a
--      aujourd'hui `inscriptions` (metier, departement, telephone) et les
--      evenements. Ouvrir `artisans` au commerce, c'est ouvrir le SIRET et le
--      telephone de toutes les entreprises inscrites : ca ne se decide pas
--      dans un fichier de migration, et surtout pas en silence.
--
--   3. VERIFIER AVEC DEUX COMPTES REELS, jamais par lecture du code. Le banc
--      d'essai attrape ce qui est attrapable hors production ; il ne remplace
--      pas le controle dans Supabase :
--        . un artisan connecte : select count(*) from contacts      -> 0
--        . un artisan connecte : select count(*) from inscriptions  -> 0
--        . un artisan connecte : select count(*) from evenements    -> 0
--        . un commercial : select count(*) from abonnements         -> 0
--        . un commercial : select * from public.entonnoir()         -> 8 lignes
--        . un artisan : select * from public.entonnoir()            -> refus
--
--   4. LE REFUS EST VISIBLE MAIS PAS LISIBLE DANS LE CRM. Quand le bouton
--      « Rendre l'acces » tombe sur une entreprise inscrite, la base refuse et
--      l'ecran affiche « La base a refusé la modification (400) » : le geste ne
--      passe pas, ce qui est l'essentiel, mais la raison reste dans la reponse
--      HTTP. Une ligne a changer dans crm/index.html (`sbMajProfil`, lire
--      `message` du corps JSON avant de lever l'erreur) afficherait le vrai
--      message. Ce fichier ne touche pas au CRM, c'est un autre chantier.
--
--   5. LA PURGE DU JOURNAL D'AUDIT RESTE OUVERTE. Ce fichier fixe une duree de
--      conservation pour SES evenements, pas pour `public.journal`, qui
--      grossit toujours sans limite et porte, lui, des identifiants avec du
--      contexte. C'est le point 5 du bloc final de migration-back-office.sql,
--      et il attend toujours l'avocat.
--
--   6. LE REGISTRE DES TRAITEMENTS. Une table d'evenements produit est un
--      traitement, meme sans donnee personnelle au sens courant : elle porte
--      un identifiant de compte, donc une donnee pseudonymisee. La finalite
--      (mesurer le parcours pour l'ameliorer), la duree (730 jours) et la base
--      legale sont a inscrire au registre avec le reste.
-- ============================================================

-- ------------------------------------------------------------ controles
-- select * from public.controle_roles();
-- select * from public.entonnoir();
-- select role, count(*) from public.profils group by role order by 1;
-- select count(*) from pg_policies where tablename = 'evenements' and cmd <> 'SELECT';
-- select genre, count(*) from public.evenements group by genre order by 1;
