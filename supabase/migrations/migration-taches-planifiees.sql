-- ============================================================
-- LES TACHES QUI N'ETAIENT JAMAIS EXECUTEES
--
-- CE QUE LE PLAN D'ARCHITECTURE A REVELE, le 14/09/2026. Trois fonctions
-- existaient, correctement ecrites, et RIEN ne les appelait jamais :
--
--   expirer_demandes()            une demande de mise en relation n'expirait
--                                 jamais : elle restait « envoyee » indefiniment,
--                                 et le destinataire gardait une liste qui
--                                 grossit sans jamais se vider.
--   publier_evaluations_echues()  une note a double sens ne se publie qu'une
--                                 fois les deux notes posees OU le delai passe.
--                                 Sans cette tache, le delai ne passe jamais :
--                                 une note laissee seule reste invisible POUR
--                                 TOUJOURS. C'est la plus grave des trois,
--                                 parce qu'elle vide de sens la promesse de
--                                 notation.
--   marquer_pieces_expirees()     une assurance decennale perimee restait
--                                 affichee comme valable. Une piece expiree
--                                 n'est pas une piece.
--
-- Mesure du 14/09/2026 : l'extension pg_cron n'etait PAS installee sur le
-- projet. Aucune de ces fonctions ne pouvait donc partir toute seule, et
-- personne ne s'en etait apercu parce qu'une tache qui ne tourne pas ne
-- produit aucune erreur. C'est le mode de panne le plus silencieux qui soit :
-- tout a l'air normal, et le produit derive lentement.
--
-- POURQUOI EN BASE ET NON AILLEURS. Ces trois traitements ne lisent et
-- n'ecrivent que des donnees de la base, sans appel exterieur. Les faire
-- porter par un service d'hebergement ajouterait une piece a maintenir, des
-- secrets a stocker, et un point de panne de plus. pg_cron vit la ou vivent
-- les donnees.
--
-- REJOUABLE : chaque tache est deprogrammee avant d'etre reprogrammee, donc
-- rejouer ce fichier ne cree pas de doublon. Et tout est garde par un test
-- d'existence de l'extension, pour que le banc d'essai hors production, ou
-- pg_cron n'existe pas, passe sans echouer.
-- ============================================================

do $$
declare
  v_a_cron boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_a_cron;

  if not v_a_cron then
    raise notice 'pg_cron absent : les taches ne sont pas planifiees. C''est le cas attendu sur le banc d''essai hors production, et un DEFAUT en production.';
    return;
  end if;

  -- Les heures sont creuses et decalees de dix minutes : trois traitements
  -- lances a la meme seconde se disputent les memes lignes sans raison.
  -- L'heure est en UTC, soit 5 h, 5 h 10 et 5 h 20 en heure d'ete francaise.

  perform cron.unschedule(jobname) from cron.job
   where jobname in ('expirer-demandes', 'publier-evaluations', 'marquer-pieces-expirees');

  perform cron.schedule('expirer-demandes', '0 3 * * *',
    $t$select public.expirer_demandes()$t$);

  perform cron.schedule('publier-evaluations', '10 3 * * *',
    $t$select public.publier_evaluations_echues()$t$);

  perform cron.schedule('marquer-pieces-expirees', '20 3 * * *',
    $t$select public.marquer_pieces_expirees()$t$);

  raise notice 'Trois taches planifiees.';
end
$$;

-- ------------------------------------------------- le controle
--
-- Une tache planifiee qui echoue le fait en silence : personne ne lit les
-- journaux d'une base. Cette fonction rend l'etat des trois taches et leur
-- dernier resultat, pour qu'un controle humain prenne dix secondes.

-- POURQUOI CETTE FONCTION EST CREEE PAR EXECUTE, et pas directement.
-- Une fonction `language sql` voit son corps VALIDE A LA CREATION par
-- PostgreSQL. Celle-ci lit `cron.job` : sans pg_cron, sa creation echoue, et la
-- migration entiere tombe. Le banc d'essai hors production, qui n'a pas
-- l'extension, ne pouvait donc pas jouer ce fichier du tout, et il n'etait
-- eprouve nulle part.
--
-- On la cree donc a l'interieur d'une garde. Quand pg_cron est absent, on pose
-- une version qui le DIT, plutot que rien : un appel a une fonction inexistante
-- rend une erreur technique, un appel a celle-ci rend une phrase lisible.

do $g$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $f$
      create or replace function public.controle_taches()
      returns table (tache text, planification text, active boolean,
                     dernier_statut text, derniere_fin timestamptz)
      language sql security definer set search_path = public, cron as $c$
        select j.jobname::text, j.schedule::text, j.active,
               (select d.status from cron.job_run_details d
                 where d.jobid = j.jobid order by d.start_time desc limit 1)::text,
               (select d.end_time from cron.job_run_details d
                 where d.jobid = j.jobid order by d.start_time desc limit 1)
          from cron.job j
         where j.jobname in ('expirer-demandes', 'publier-evaluations',
                             'marquer-pieces-expirees')
         order by j.jobname
      $c$;
    $f$;
  else
    execute $f$
      create or replace function public.controle_taches()
      returns table (tache text, planification text, active boolean,
                     dernier_statut text, derniere_fin timestamptz)
      language sql security definer set search_path = public as $c$
        select 'pg_cron absent'::text, '(aucune planification)'::text,
               false, 'l extension n est pas installee'::text, null::timestamptz
      $c$;
    $f$;
  end if;
end
$g$;

revoke all on function public.controle_taches() from public, anon, authenticated;
grant execute on function public.controle_taches() to service_role;

-- ============================================================
-- CONTROLE, a faire le lendemain de la premiere execution :
--   select * from public.controle_taches();
-- Les trois taches doivent etre actives et rendre « succeeded ».
-- Un statut « failed » ne remonte nulle part tout seul : c'est ici qu'on le voit.
-- ============================================================
