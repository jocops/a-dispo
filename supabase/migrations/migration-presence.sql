-- ============================================================
-- CRM À dispo : qui est connecté, et sur quoi
-- À jouer APRÈS schema.sql et migration-admin.sql, dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
--
-- Ce que ça ajoute : chaque personne connectée signale sa présence toutes les
-- 30 secondes, et dit sur quelle vue et sur quelle fiche elle se trouve. Le CRM
-- affiche alors qui travaille en ce moment, et prévient quand deux personnes
-- ouvrent la même fiche. C'est ce qui évite d'appeler deux fois le même artisan.
--
-- Pourquoi un battement plutôt que des websockets : le CRM parle à Supabase en
-- REST, sans bibliothèque. Un battement de 30 secondes coûte deux requêtes par
-- minute et par personne, il tient dans l'offre gratuite, et il donne en prime
-- « vue il y a 12 minutes » pour ceux qui ne sont plus là. Le temps réel par
-- websocket reste possible plus tard, il n'annulerait pas ce travail.
-- ============================================================

-- ------------------------------------------------------------ deux colonnes
alter table public.profils add column if not exists vu_le    timestamptz;
alter table public.profils add column if not exists presence jsonb not null default '{}'::jsonb;

comment on column public.profils.vu_le    is 'Dernier battement. En ligne = moins de 90 secondes.';
comment on column public.profils.presence is 'Ou la personne se trouve : {vue, fiche, libelle}.';

-- ------------------------------------------------------------ chacun signale sa propre présence
-- Sans cette règle, seul un admin pouvait écrire dans profils : personne n'aurait
-- pu signaler sa présence. La règle est limitée à SA PROPRE ligne.
drop policy if exists "profils presence soi-meme" on public.profils;
create policy "profils presence soi-meme" on public.profils for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------ ce qu'on ne peut pas s'accorder à soi-même
-- Le déclencheur de migration-admin.sql gelait déjà `admin`, `id` et `email`.
-- Il gèle maintenant aussi `actif` pour qui n'est pas admin : sans cela, la règle
-- ci-dessus permettrait à quelqu'un de se réactiver après un retrait d'accès.
create or replace function public.profils_protege_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if new.admin is distinct from old.admin then new.admin := old.admin; end if;
    if new.id is distinct from old.id then new.id := old.id; end if;
    if new.email is distinct from old.email then new.email := old.email; end if;
    -- Un admin garde la main sur l'accès des autres ; personne ne se réactive seul.
    if new.actif is distinct from old.actif and not public.est_admin() then
      new.actif := old.actif;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profils_protege_admin on public.profils;
create trigger profils_protege_admin before update on public.profils
  for each row execute function public.profils_protege_admin();

-- ------------------------------------------------------------ contrôle
-- select prenom, actif, admin, vu_le, presence,
--        (vu_le > now() - interval '90 seconds') as en_ligne
-- from public.profils order by vu_le desc nulls last;
