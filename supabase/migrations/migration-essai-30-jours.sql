-- ============================================================
-- L'ESSAI DE 30 JOURS, OUVERT A LA FIN DU PARCOURS
--
-- LE PROBLEME, MESURE ET NON SUPPOSE. Le 14/09/2026, la chaine complete a ete
-- eprouvee avec deux vrais comptes d'artisan : Bruno cherche Alice, la trouve,
-- et ne peut pas lui envoyer de demande. La base refuse, code 42501 :
--   new row violates row-level security policy for table "demandes"
--
-- La politique d'insertion exige trois conditions :
--   demandeur_id = auth.uid()  AND  peut_demander()  AND  est_publie(destinataire)
-- C'est la deuxieme qui bloque. `peut_demander()` delegue a `acces_artisan()`,
-- qui ne lit QUE la table `abonnements`. Or RIEN ne cree jamais de ligne
-- d'abonnement : ni l'inscription, ni la fin du parcours, ni l'ecran abonnement
-- qui n'est pas raccorde au prestataire de paiement. Donc tout artisan vaut
-- `ferme`, pour toujours, et le produit est inutilisable de bout en bout.
--
-- Personne ne l'avait vu parce que personne n'avait marche la chaine.
--
-- LA DECISION. Trente jours d'essai, ouverts automatiquement quand l'artisan
-- TERMINE son parcours, et non quand il cree son compte. La raison tient en une
-- phrase : un essai qui demarre a l'inscription se consomme pendant que
-- l'artisan cherche son numero de SIRET et remplit sa fiche. Il doit demarrer
-- le jour ou le produit devient utilisable pour lui.
--
-- LE PRIX N'EST PAS ARRETE, et rien ici n'en depend : `formule` reste nulle, et
-- aucun montant n'est ecrit. L'essai fonctionne sans que le tarif existe, ce qui
-- est exactement ce qu'il faut pour ouvrir avant de l'avoir tranche.
--
-- CE QUI EST REPARE AU PASSAGE. Deux migrations ne s'accordaient pas sur le lieu
-- de verite de l'essai : `migration-espace-artisan.sql` a cree les colonnes
-- `artisans.essai_jusqu_au` et `artisans.abonne_jusqu_au`,
-- `migration-abonnement-pieces.sql` a cree la table `abonnements` et lui a donne
-- autorite. Les colonnes etaient devenues de l'etat mort que plus rien ne lit,
-- et un ecran qui les afficherait mentirait. Elles ne sont pas supprimees, ce
-- serait destructif : elles sont desormais TENUES A JOUR par le meme declencheur,
-- donc elles disent la meme chose que la table.
--
-- Rejouable sans risque : `or replace`, `drop trigger if exists`, et la creation
-- d'abonnement ne se fait QUE si l'artisan n'en a aucun.
-- ============================================================

-- La duree vit dans un reglage, pas dans le corps de la fonction : la changer
-- ne doit pas demander de relire du code, et `reglage()` existe deja.
insert into public.reglages (cle, valeur, qui, note)
values ('essai_jours', 30, 'Claire-Marie',
        'Duree de l''essai gratuit, en jours, ouverte a la FIN du parcours. Tranchee le 14/09/2026.')
on conflict (cle) do update
  set valeur = excluded.valeur, qui = excluded.qui, note = excluded.note, maj_le = now();

-- ------------------------------------------------- l'ouverture de l'essai
--
-- SECURITY DEFINER, et c'est indispensable : la table `abonnements` n'est pas
-- ecrivable depuis un navigateur, par construction, parce que tout ce qui touche
-- a l'argent doit passer par le serveur. Le declencheur est ce serveur.
--
-- LA GARDE QUI COMPTE : on n'ouvre un essai que si l'artisan n'a AUCUNE ligne
-- d'abonnement. Sans elle, un artisan qui repasse par son parcours, ou dont la
-- fiche est republiee, se verrait offrir un second essai de trente jours, autant
-- de fois qu'il le voudrait.

create or replace function public.ouvrir_essai_si_parcours_fini()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jours integer;
begin
  -- Seulement au moment ou l'etape DEVIENT « fini », pas a chaque ecriture.
  if new.etape is distinct from 'fini' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.etape = 'fini' then
    return new;
  end if;

  if exists (select 1 from public.abonnements where artisan_id = new.id) then
    return new;
  end if;

  v_jours := coalesce(public.reglage('essai_jours'), 30);

  insert into public.abonnements (artisan_id, etat, essai_du, essai_au)
  values (new.id, 'essai', current_date, current_date + v_jours);

  -- Les deux colonnes historiques suivent, pour qu'elles cessent de mentir.
  new.essai_jusqu_au := current_date + v_jours;

  return new;
end;
$$;

revoke all on function public.ouvrir_essai_si_parcours_fini() from public, anon, authenticated;

drop trigger if exists ouvrir_essai on public.artisans;
create trigger ouvrir_essai
  before insert or update of etape on public.artisans
  for each row execute function public.ouvrir_essai_si_parcours_fini();

-- ------------------------------------------------- le rattrapage
--
-- Les artisans qui ont DEJA fini leur parcours avant ce fichier n'ont pas
-- d'abonnement, donc pas d'acces. Ils en recoivent un, une seule fois. Sans ce
-- bloc, les comptes existants resteraient bloques sans que rien ne le signale.

insert into public.abonnements (artisan_id, etat, essai_du, essai_au)
select a.id, 'essai', current_date,
       current_date + coalesce(public.reglage('essai_jours'), 30)
  from public.artisans a
 where a.etape = 'fini'
   and not exists (select 1 from public.abonnements b where b.artisan_id = a.id);

update public.artisans a
   set essai_jusqu_au = b.essai_au
  from public.abonnements b
 where b.artisan_id = a.id
   and b.etat = 'essai'
   and a.essai_jusqu_au is distinct from b.essai_au;

-- ------------------------------------------------- le controle
--
-- A jouer apres, pour verifier par la mesure et non par l'impression. Doit
-- rendre `complet` pour tout artisan ayant termine son parcours.

create or replace function public.controle_essai()
returns table (artisan uuid, etape text, etat_abonnement text, essai_au date, acces text)
language sql
security definer
set search_path = public
as $$
  select a.id, a.etape, b.etat, b.essai_au, public.acces_artisan(a.id)
    from public.artisans a
    left join public.abonnements b on b.artisan_id = a.id
   order by a.etape, a.cree_le
$$;

revoke all on function public.controle_essai() from public, anon, authenticated;
grant execute on function public.controle_essai() to service_role;

-- ============================================================
-- CONTROLE, apres avoir joue ce fichier :
--   select * from public.controle_essai();
-- Tout artisan en etape « fini » doit rendre acces = 'complet'.
-- ============================================================
