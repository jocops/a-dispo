-- ============================================================
-- FERMER L'APPEL DES TACHES D'ENTRETIEN AUX ARTISANS
--
-- LE DEFAUT, MESURE ET NON SUPPOSE, le 16/09/2026 sur un PostgreSQL monte en
-- memoire avec les droits par defaut de Supabase. Avec le jeton d'un artisan
-- d'essai ordinaire, les trois appels passent :
--
--   select public.expirer_demandes()             -> passe
--   select public.publier_evaluations_echues()   -> passe
--   select public.marquer_pieces_expirees()      -> passe
--
-- CE QUE CA PERMET. Les trois fonctions sont SECURITY DEFINER : elles
-- s'executent avec les droits de leur proprietaire, donc la securite par ligne
-- ne les arrete pas. N'importe quel inscrit pouvait donc, d'un seul appel :
--   faire expirer les demandes en attente de TOUT LE MONDE ;
--   publier prematurement les notes de TOUT LE MONDE, y compris celles qui
--   attendaient encore la reciproque ;
--   marquer perimees les pieces justificatives de TOUT LE MONDE, ce qui
--   depublie leurs fiches.
-- Aucune de ces trois actions n'est reversible d'un clic.
--
-- LA CAUSE, et elle est subtile : les trois fichiers ecrivent
--     revoke all on function public.<nom>() from public;
-- Or `from public` ne retire QUE les droits du pseudo-role PUBLIC. Il ne
-- touche pas a `anon` ni a `authenticated`, a qui Supabase accorde par defaut
-- `grant execute on all functions in schema public`. Le revoke avait donc
-- l'air juste et ne protegeait rien.
--
-- La forme correcte est celle que `controle_taches()` employait deja, dans le
-- meme fichier, deux ecrans plus bas : `from public, anon, authenticated`.
-- Une seule des quatre fonctions etait fermee.
--
-- CE QUI NE CHANGE PAS : pg_cron appelle ces fonctions en tant que
-- proprietaire de la base, pas en tant qu'artisan. La planification continue
-- de fonctionner a l'identique.
--
-- Rejouable : un revoke est idempotent.
-- ============================================================

revoke all on function public.expirer_demandes()           from public, anon, authenticated;
revoke all on function public.publier_evaluations_echues()  from public, anon, authenticated;
revoke all on function public.marquer_pieces_expirees()     from public, anon, authenticated;

grant execute on function public.expirer_demandes()          to service_role;
grant execute on function public.publier_evaluations_echues() to service_role;
grant execute on function public.marquer_pieces_expirees()    to service_role;

-- ------------------------------------------------- le controle
--
-- Un droit trop large ne leve aucune erreur : il se constate en essayant
-- d'appeler. Cette fonction dit qui peut appeler quoi, sans avoir a le tenter.

create or replace function public.controle_droits_taches()
returns table (fonction text, appelable_par text)
language sql
security definer
set search_path = public
as $$
  select p.proname::text,
         coalesce(
           (select string_agg(r.rolname, ', ' order by r.rolname)
              from pg_roles r
             where r.rolname in ('anon', 'authenticated', 'service_role')
               and has_function_privilege(r.rolname, p.oid, 'EXECUTE')),
           'personne') ::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('expirer_demandes', 'publier_evaluations_echues',
                       'marquer_pieces_expirees', 'controle_taches')
   order by p.proname
$$;

revoke all on function public.controle_droits_taches() from public, anon, authenticated;
grant execute on function public.controle_droits_taches() to service_role;

-- ============================================================
-- CONTROLE, et il ne se fait pas en lisant ce fichier :
--   select * from public.controle_droits_taches();
-- Les trois taches doivent rendre « service_role », et rien d'autre.
-- Si « authenticated » apparait, le correctif n'a pas ete joue.
-- ============================================================
