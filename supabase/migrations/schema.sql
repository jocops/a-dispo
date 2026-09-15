-- ============================================================
-- CRM À dispo : schéma Supabase (Postgres)
--
-- Deux tables :
--   contacts : une ligne par contact. `base` = données d'origine (Pipedrive
--              ou saisie manuelle), `crm` = travail de prospection (statut,
--              notes, historique, corrections).
--   profils  : un prénom par compte utilisateur, rempli automatiquement
--              quand un compte est créé dans Supabase Auth.
--
-- Accès : uniquement les personnes connectées (comptes Supabase Auth).
-- La clé anon dans le HTML ne donne rien sans session.
-- Rejouable sans risque : tout est en `if not exists` / `or replace`.
-- ============================================================

-- ------------------------------------------------------------ contacts
create table if not exists public.contacts (
  id            bigint primary key,
  base          jsonb,
  crm           jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  updated_by    text,                 -- prénom, envoyé par le CRM
  updated_by_id uuid                  -- compte, posé par le trigger
);

create index if not exists contacts_updated_at_idx on public.contacts (updated_at);
create index if not exists contacts_crm_statut_idx on public.contacts ((crm->>'statut'));

create or replace function public.contacts_avant_ecriture() returns trigger
language plpgsql security definer as $$
begin
  if tg_op = 'UPDATE' and (new.updated_at is null or new.updated_at = old.updated_at) then
    new.updated_at := now();
  end if;
  if auth.uid() is not null then new.updated_by_id := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists contacts_avant_ecriture on public.contacts;
create trigger contacts_avant_ecriture before insert or update on public.contacts
  for each row execute function public.contacts_avant_ecriture();

alter table public.contacts enable row level security;

drop policy if exists "lecture equipe" on public.contacts;
drop policy if exists "ecriture equipe" on public.contacts;
drop policy if exists "maj equipe" on public.contacts;
drop policy if exists "contacts lecture connectes" on public.contacts;
drop policy if exists "contacts insertion connectes" on public.contacts;
drop policy if exists "contacts maj connectes" on public.contacts;

create policy "contacts lecture connectes"   on public.contacts for select to authenticated using (true);
create policy "contacts insertion connectes" on public.contacts for insert to authenticated with check (true);
create policy "contacts maj connectes"       on public.contacts for update to authenticated using (true) with check (true);
-- Pas de policy delete : le CRM ne supprime jamais une ligne (il pose crm.supprime = true).

-- ------------------------------------------------------------ profils
create table if not exists public.profils (
  id       uuid primary key references auth.users (id) on delete cascade,
  prenom   text not null,
  email    text,
  actif    boolean not null default true,
  cree_le  timestamptz not null default now()
);

alter table public.profils enable row level security;
drop policy if exists "profils lecture connectes" on public.profils;
create policy "profils lecture connectes" on public.profils for select to authenticated using (true);
-- Écriture des profils : réservée au tableau de bord Supabase (service role), pas au CRM.

-- Création automatique du profil quand un compte est ajouté dans Authentication > Users.
-- Le prénom vient du champ "User Metadata" {"prenom": "Claire-Marie"} ; sinon la partie avant @ de l'e-mail.
create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, prenom, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'prenom', ''), split_part(new.email, '@', 1)), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
drop trigger if exists creer_profil on auth.users;
create trigger creer_profil after insert on auth.users
  for each row execute function public.creer_profil();

-- Rattrapage : profils pour les comptes déjà existants au moment où ce script est joué.
insert into public.profils (id, prenom, email)
select u.id, coalesce(nullif(u.raw_user_meta_data->>'prenom', ''), split_part(u.email, '@', 1)), u.email
from auth.users u
on conflict (id) do nothing;

-- ------------------------------------------------------------ réglages Auth à faire dans le tableau de bord (pas en SQL)
-- Authentication > Providers > Email : activé. "Confirm email" : désactivé (les comptes sont créés par Joan, pas par inscription).
-- Authentication > Sign In / Up : "Allow new users to sign up" : DÉSACTIVÉ (personne ne peut se créer un compte seul).
-- Authentication > URL Configuration (mis à jour le 04/09/2026, bascule sur a-dispo.fr) :
--   Site URL      = https://a-dispo.fr/crm
--   Redirect URLs = https://a-dispo.fr/crm/**
--                   https://a-dispo.pages.dev/crm/**        (l'adresse technique Cloudflare)
--                   https://projet-dispo.vercel.app/crm/**  (à retirer une fois la bascule vérifiée)
--   Sans ces adresses, le bouton « Recevoir un lien de connexion par e-mail » renvoie
--   sur l'ancienne page et la connexion échoue.
-- Ajouter une personne : Authentication > Users > Add user > "Create new user", e-mail + mot de passe,
--   cocher "Auto Confirm User", et dans User Metadata : {"prenom": "Claire-Marie"}.
