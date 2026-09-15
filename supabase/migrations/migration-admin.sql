-- ============================================================
-- CRM À dispo : administration des comptes
-- À jouer APRÈS schema.sql, dans l'éditeur SQL de Supabase.
-- Rejouable sans risque : tout est en `if not exists` / `or replace`.
--
-- Ce que cette migration ajoute :
--   1. un drapeau `admin` sur les profils ;
--   2. la révocation réelle d'un accès par `actif = false` ;
--   3. le droit, pour un admin seulement, de changer le prénom et l'accès
--      des autres depuis le CRM, sans passer par le tableau de bord Supabase.
--
-- Le point important : avant cette migration, `actif` ne servait qu'à masquer
-- un prénom dans la liste « Suivi par ». Les règles d'accès de la table
-- contacts n'en tenaient aucun compte, donc désactiver quelqu'un ne lui retirait
-- rien du tout. Un bouton « retirer l'accès » qui ne retire pas l'accès est pire
-- que pas de bouton. Désormais toute lecture et toute écriture exigent un profil
-- actif, vérifié à chaque requête.
-- ============================================================

-- ------------------------------------------------------------ le drapeau admin
alter table public.profils add column if not exists admin boolean not null default false;

-- Joan administre. Si le compte n'existe pas encore, la ligne ne fait rien et
-- il suffit de rejouer cette instruction après sa création.
update public.profils set admin = true where lower(email) = 'contact@joanaglave.fr';

-- ------------------------------------------------------------ deux fonctions de garde
-- Elles sont en `security definer` pour lire `profils` sans repasser par les
-- règles d'accès de cette même table : sans cela, une règle qui interroge la
-- table qu'elle protège tourne en rond et Postgres refuse la requête.
create or replace function public.est_actif() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select actif from public.profils where id = auth.uid()), false)
$$;

create or replace function public.est_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select admin and actif from public.profils where id = auth.uid()), false)
$$;

-- ------------------------------------------------------------ contacts : profil actif exigé
drop policy if exists "contacts lecture connectes"   on public.contacts;
drop policy if exists "contacts insertion connectes" on public.contacts;
drop policy if exists "contacts maj connectes"       on public.contacts;

create policy "contacts lecture actifs"   on public.contacts for select to authenticated using (public.est_actif());
create policy "contacts insertion actifs" on public.contacts for insert to authenticated with check (public.est_actif());
create policy "contacts maj actifs"       on public.contacts for update to authenticated using (public.est_actif()) with check (public.est_actif());
-- Toujours aucune règle de suppression : le CRM ne supprime jamais une ligne.

-- ------------------------------------------------------------ profils : lecture pour tous, écriture pour l'admin
drop policy if exists "profils lecture connectes" on public.profils;
drop policy if exists "profils maj admin"        on public.profils;

-- La lecture reste ouverte aux comptes connectés : c'est elle qui alimente la
-- liste « Suivi par », et un compte désactivé doit encore pouvoir lire son
-- propre profil pour comprendre pourquoi il n'a plus accès.
create policy "profils lecture connectes" on public.profils for select to authenticated using (true);
create policy "profils maj admin"         on public.profils for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- Un admin peut changer un prénom et couper un accès. Il ne peut pas se
-- fabriquer un pair : le drapeau `admin` ne se modifie que depuis le tableau de
-- bord Supabase, où il faut la clé de service. Le déclencheur ci-dessous remet
-- la valeur d'origine si une requête cliente essaie d'y toucher.
create or replace function public.profils_protege_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.admin is distinct from old.admin and auth.uid() is not null then
    new.admin := old.admin;
  end if;
  if new.id is distinct from old.id or new.email is distinct from old.email then
    new.id := old.id; new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists profils_protege_admin on public.profils;
create trigger profils_protege_admin before update on public.profils
  for each row execute function public.profils_protege_admin();

-- ------------------------------------------------------------ contrôle
-- select prenom, email, actif, admin from public.profils order by cree_le;
-- select public.est_actif(), public.est_admin();
