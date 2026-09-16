-- ============================================================
-- FERMER LA LECTURE OUVERTE DE LA TABLE DES PROFILS
--
-- LA FUITE, MESUREE ET NON SUPPOSEE, le 14/09/2026. Avec le jeton d'un artisan
-- d'essai ordinaire, une seule requete rend ONZE profils :
--
--   Joan    contact@joanaglave.fr      admin = true
--   Alec    alec.ferrante.pro@gmail.com
--   ... et les sept comptes de recette
--
-- Ce que cela donne a n'importe quel inscrit : les adresses de l'equipe, et
-- surtout QUI EST ADMINISTRATEUR. C'est la premiere chose que cherche
-- quelqu'un qui veut s'attaquer a un systeme, et c'est une donnee personnelle
-- au sens du RGPD.
--
-- LA CAUSE, ecrite deux fois : schema.sql:67 et migration-admin.sql:58 posent
--   create policy "profils lecture connectes" on public.profils
--     for select to authenticated using (true);
-- `using (true)` veut dire « tout compte connecte lit toute la table ». C'etait
-- sans consequence quand les seuls comptes etaient ceux de l'equipe. Ca a cesse
-- de l'etre le jour ou des artisans se sont inscrits, et personne ne l'a vu
-- passer parce qu'une politique trop large ne produit aucune erreur.
--
-- LE CORRECTIF, et pourquoi celui-la. Deux besoins coexistent sur cette table :
--   1. un artisan doit lire SA ligne, parce que l'application s'en sert ;
--   2. le CRM doit lire TOUTE la table, pour la liste « Suivi par » et pour la
--      presence, sinon on casse un outil qui marche.
-- D'ou la condition : sa propre ligne, OU etre un utilisateur du CRM.
--
-- `est_actif()` est SECURITY DEFINER, donc elle contourne la securite par ligne
-- et ne provoque aucune recursion en etant appelee depuis une politique de la
-- table qu'elle lit. C'est le motif habituel, et c'est ce qui rend ce correctif
-- possible en une ligne.
--
-- ⚠️ CE FICHIER DOIT ETRE JOUE EN DERNIER. `schema.sql` et
-- `migration-admin.sql` recreent tous deux la politique ouverte : les rejouer
-- apres celui-ci ROUVRIRAIT la fuite. Le controle ci-dessous existe pour s'en
-- apercevoir tout de suite.
--
-- Rejouable : `drop policy if exists` avant `create policy`.
-- ============================================================

-- On supprime les DEUX noms : l ancien, qui est la fuite qu on ferme, et le
-- nouveau, sans quoi un second passage echoue sur « policy already exists ».
-- Ce fichier se disait rejouable et ne l etait pas : le banc l a trouve le
-- 16/09/2026, au second passage.
drop policy if exists "profils lecture connectes" on public.profils;
drop policy if exists "profils lecture cloisonnee" on public.profils;

create policy "profils lecture cloisonnee" on public.profils
  for select to authenticated
  using (id = auth.uid() or public.est_actif());

comment on table public.profils is
  'Profils de l''equipe et des inscrits. LECTURE CLOISONNEE depuis le 14/09/2026 : '
  'chacun lit sa ligne, les utilisateurs du CRM lisent tout. Voir '
  'migration-cloison-profils.sql, et ne pas rejouer schema.sql ni migration-admin.sql '
  'sans rejouer ce fichier apres.';

-- ------------------------------------------------- le controle
--
-- Une politique trop large ne leve aucune erreur : elle se constate en comptant
-- les lignes qui sortent, avec le jeton de quelqu'un qui ne devrait pas les
-- voir. Cette fonction dit au moins si la politique ouverte est revenue.

create or replace function public.controle_cloison_profils()
returns table (politique text, condition text, verdict text)
language sql
security definer
set search_path = public
as $$
  select pol.policyname::text,
         coalesce(pol.qual, '(aucune)')::text,
         case
           when pol.qual is null or btrim(pol.qual) = 'true'
             then 'OUVERTE : tout compte connecte lit toute la table'
           else 'cloisonnee'
         end::text
    from pg_policies pol
   where pol.schemaname = 'public'
     and pol.tablename = 'profils'
     and pol.cmd = 'SELECT'
$$;

revoke all on function public.controle_cloison_profils() from public, anon, authenticated;
grant execute on function public.controle_cloison_profils() to service_role;

-- ============================================================
-- CONTROLE, et il ne se fait pas en lisant ce fichier :
--   1. select * from public.controle_cloison_profils();  -> aucune « OUVERTE »
--   2. avec le jeton d'un artisan ordinaire :
--      select count(*) from public.profils;  -> doit rendre 1, sa seule ligne
--   3. avec le jeton d'un commercial : doit rendre la table entiere
-- ============================================================
