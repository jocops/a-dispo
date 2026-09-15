-- ============================================================
-- L'ESPACE ARTISAN : comptes, fiche, agendas.
--
-- PERIMETRE, ET IL FAUT LE SAVOIR AVANT DE LIRE. Ce fichier couvre des lignes
-- des DEUX devis :
--   · devis N°1, SIGNE : les quatre modules d'agenda (960 €), la verification
--     du SIRET, le paiement en ligne ;
--   · devis N°2, NON SIGNE : la creation de compte, la fiche entreprise, le
--     calendrier de saisie des disponibilites, la fiche publique.
-- Les modules d'agenda sont payes mais ne peuvent pas exister sans comptes :
-- le premier devis ne peut pas se terminer sans une partie du second.
--
-- CE QUI GOUVERNE TOUT LE FICHIER : UN ARTISAN NE VOIT QUE SA PROPRE FICHE.
-- Chaque table porte une politique qui compare `auth.uid()` au proprietaire de
-- la ligne. Sans ca, n'importe quel inscrit lirait les coordonnees de tous les
-- autres avec la cle publique, qui est lisible dans le code source de la page.
--
-- LE PIEGE DES JETONS D'AGENDA, ET POURQUOI ILS ONT LEUR PROPRE TABLE.
-- Brancher un agenda Google, Outlook ou Apple donne un jeton qui ouvre
-- l'agenda personnel de l'artisan. Ce jeton ne doit JAMAIS pouvoir etre lu par
-- un navigateur, meme celui de son proprietaire : une extension malveillante,
-- un poste partage sur un chantier, et il part. Il vit donc dans une table
-- separee, `agenda_secrets`, SANS AUCUNE POLITIQUE DE LECTURE. Seules les
-- fonctions serveur y accedent. La table `agendas`, elle, ne porte que l'etat :
-- branche ou non, derniere synchronisation, erreur eventuelle.
--
-- CE QU'ON NE STOCKE PAS DES AGENDAS. Ni les titres, ni les lieux, ni les
-- participants : uniquement des creneaux occupes. C'est une promesse faite a
-- l'artisan sur la page d'aide, et elle se tient dans le schema, pas seulement
-- dans le discours. La table `occupations` n'a pas de colonne pour un titre.
--
-- Rejouable sans risque : tout est en `if not exists` / `or replace`.
-- ============================================================

-- ------------------------------------------------------- le referentiel metiers
--
-- Une table plutot qu'une liste en dur dans le code : Claire-Marie doit pouvoir
-- ajouter un metier sans nous, et le formulaire « votre metier n'est pas dans
-- la liste » n'a de sens que si l'ajout est possible.

create table if not exists public.metiers (
  code    text primary key,
  libelle text not null,
  ordre   integer not null default 100,
  actif   boolean not null default true
);

insert into public.metiers (code, libelle, ordre) values
  ('plombier','Plombier',10), ('macon','Maçon',20),
  ('electricien','Électricien',30), ('charpentier','Charpentier',40),
  ('couvreur','Couvreur',50), ('peintre','Peintre',60),
  ('carreleur','Carreleur',70), ('menuisier','Menuisier',80),
  ('serrurier','Serrurier',90), ('chauffagiste','Chauffagiste',100),
  ('plaquiste','Plaquiste',110), ('terrassier','Terrassier',120),
  ('facadier','Façadier',130), ('etancheur','Étancheur',140),
  ('paysagiste','Paysagiste',150)
on conflict (code) do nothing;

alter table public.metiers enable row level security;
drop policy if exists "metiers lisibles par tous" on public.metiers;
create policy "metiers lisibles par tous"
  on public.metiers for select to anon, authenticated using (actif);

-- ------------------------------------------------------------------ l'artisan
--
-- Une ligne par compte, liee a `auth.users`. La cle primaire EST l'identifiant
-- du compte : un artisan ne peut pas avoir deux fiches, et la contrainte est
-- portee par la base plutot que par le code.

create table if not exists public.artisans (
  id            uuid primary key references auth.users(id) on delete cascade,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),

  -- L'ETAPE DE L'ACCOMPAGNEMENT. C'est elle qui dit ou reprendre quand
  -- l'artisan revient trois jours plus tard : il ne recommence pas, il
  -- continue. Sans ce champ, on redemande tout a chaque visite et il part.
  etape         text not null default 'identite'
                check (etape in ('identite','entreprise','metier','abonnement','agenda','fini')),

  -- Qui il est
  prenom        text,
  nom           text,
  telephone     text,
  photo_url     text,

  -- Son entreprise, remplie par le module de verification du SIRET
  siret         text,
  siret_etat    text check (siret_etat in ('valide','non_diffusible')),
  denomination  text,
  activite      text,
  commune       text,
  code_postal   text,
  siret_verifie_le timestamptz,

  -- Son metier
  metier        text references public.metiers(code),
  metier_libre  text,
  presentation  text,
  rayon_km      integer not null default 30 check (rayon_km between 5 and 200),

  -- Son abonnement. `formule` reste libre tant que le prix n'est pas arrete :
  -- ecrire des valeurs en dur ici obligerait a une migration le jour ou il
  -- change, et il n'est pas encore fixe.
  formule       text,
  essai_jusqu_au date,
  abonne_jusqu_au date,

  -- Sa fiche est-elle visible des autres ? Jamais par defaut : une fiche vide
  -- publiee fait mauvaise impression, sur lui et sur la plateforme.
  publie        boolean not null default false,

  constraint telephone_ok check (telephone is null or telephone ~ '^[0-9 +().-]{6,20}$'),
  constraint siret_ok     check (siret is null or siret ~ '^[0-9]{14}$'),
  constraint cp_ok        check (code_postal is null or code_postal ~ '^[0-9]{5}$'),
  -- Choisir « un autre metier » sans dire lequel ne sert a rien.
  constraint metier_libre_si_autre check (
    metier is not null or metier_libre is null or char_length(btrim(metier_libre)) >= 2)
);

create index if not exists artisans_metier_idx  on public.artisans (metier) where publie;
create index if not exists artisans_cp_idx      on public.artisans (code_postal) where publie;
create index if not exists artisans_publie_idx  on public.artisans (publie);

-- Les competences, l'outillage, les permis et le materiel : des lignes et non
-- des colonnes. Un artisan en a zero ou quinze, et une colonne par cas obligerait
-- a migrer la table a chaque ajout.
create table if not exists public.artisan_atouts (
  id         bigserial primary key,
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  genre      text not null check (genre in ('competence','outillage','permis','materiel')),
  libelle    text not null check (char_length(btrim(libelle)) between 2 and 80),
  detail     text,
  unique (artisan_id, genre, libelle)
);
create index if not exists atouts_artisan_idx on public.artisan_atouts (artisan_id);
create index if not exists atouts_genre_idx   on public.artisan_atouts (genre, libelle);

-- --------------------------------------------------------------- les agendas
--
-- L'ETAT du branchement, lisible par son proprietaire. Rien de secret ici.

create table if not exists public.agendas (
  id           bigserial primary key,
  artisan_id   uuid not null references public.artisans(id) on delete cascade,
  fournisseur  text not null check (fournisseur in ('google','microsoft','apple','ics')),
  libelle      text,
  branche_le   timestamptz not null default now(),
  synchro_le   timestamptz,
  erreur       text,
  actif        boolean not null default true,
  unique (artisan_id, fournisseur, libelle)
);
create index if not exists agendas_artisan_idx on public.agendas (artisan_id);

-- LES JETONS. Table separee, AUCUNE politique de lecture, pour personne.
-- Meme le proprietaire du compte ne peut pas relire son propre jeton depuis un
-- navigateur : il n'a aucune raison d'en avoir besoin, et chaque endroit ou un
-- jeton peut apparaitre est un endroit ou il peut fuiter.
create table if not exists public.agenda_secrets (
  agenda_id    bigint primary key references public.agendas(id) on delete cascade,
  jeton        text not null,
  rafraichir   text,
  expire_le    timestamptz
);
alter table public.agenda_secrets enable row level security;
-- Aucune politique. Donc aucun acces, ni en lecture ni en ecriture, depuis une
-- cle publique ou une session. Les fonctions serveur passent par la cle de
-- service, qui ne quitte jamais le serveur.

-- LES CRENEAUX OCCUPES. Pas de colonne pour un titre, un lieu ou un
-- participant : la promesse faite a l'artisan est qu'on ne lit que le libre et
-- l'occupe, et elle se tient dans le schema. Ce qui n'existe pas ne fuite pas.
create table if not exists public.occupations (
  id         bigserial primary key,
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  agenda_id  bigint references public.agendas(id) on delete cascade,
  debut      timestamptz not null,
  fin        timestamptz not null,
  -- `saisie` distingue ce que l'artisan a pose a la main de ce qui vient de son
  -- agenda : au debranchement, on efface le second sans toucher au premier.
  saisie     boolean not null default false,
  constraint fin_apres_debut check (fin > debut)
);
create index if not exists occupations_artisan_idx on public.occupations (artisan_id, debut);
create index if not exists occupations_agenda_idx  on public.occupations (agenda_id);

-- ------------------------------------------------------- les autorisations
--
-- LA REGLE, PARTOUT : un artisan ne voit et ne modifie QUE ses propres lignes.

alter table public.artisans       enable row level security;
alter table public.artisan_atouts enable row level security;
alter table public.agendas        enable row level security;
alter table public.occupations    enable row level security;

drop policy if exists "sa fiche" on public.artisans;
create policy "sa fiche" on public.artisans
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "ses atouts" on public.artisan_atouts;
create policy "ses atouts" on public.artisan_atouts
  for all to authenticated
  using (artisan_id = auth.uid()) with check (artisan_id = auth.uid());

drop policy if exists "ses agendas" on public.agendas;
create policy "ses agendas" on public.agendas
  for all to authenticated
  using (artisan_id = auth.uid()) with check (artisan_id = auth.uid());

drop policy if exists "ses occupations" on public.occupations;
create policy "ses occupations" on public.occupations
  for all to authenticated
  using (artisan_id = auth.uid()) with check (artisan_id = auth.uid());

-- --------------------------------------------------- la fiche vue des autres
--
-- CE QUE LES AUTRES VOIENT, ET RIEN DE PLUS. Une vue plutot qu'une politique
-- de lecture sur la table : une politique ouvrirait TOUTES les colonnes, donc
-- le telephone et le SIRET. La vue choisit les colonnes une par une, et ce qui
-- n'y figure pas ne peut pas sortir.
--
-- `security_invoker = off` : la vue s'execute avec les droits de son
-- proprietaire, ce qui lui permet de lire la table malgre la politique
-- restrictive. C'est exactement l'usage prevu, et c'est ce qui rend la
-- selection de colonnes efficace.

create or replace view public.fiches_publiques
with (security_invoker = off) as
  select a.id,
         a.prenom,
         -- Le nom de famille n'est pas public : le prenom et l'entreprise
         -- suffisent a se reconnaitre entre pros, et le nom complet d'une
         -- personne physique n'a pas a etre indexe par un moteur.
         a.denomination,
         coalesce(m.libelle, a.metier_libre) as metier,
         a.presentation,
         a.photo_url,
         a.commune,
         left(a.code_postal, 2) as departement,
         a.rayon_km
    from public.artisans a
    left join public.metiers m on m.code = a.metier
   where a.publie
     and a.etape = 'fini';

grant select on public.fiches_publiques to anon, authenticated;

-- ------------------------------------------------- la fiche a la connexion
--
-- Cree la fiche au premier passage, et la rend. Sans ca, le navigateur devrait
-- faire un `insert` puis un `select`, et gerer le cas ou deux onglets ouverts
-- tentent la creation en meme temps. Ici, c'est la base qui tranche.

create or replace function public.ma_fiche()
returns public.artisans
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.artisans;
begin
  if auth.uid() is null then
    raise exception 'aucune session';
  end if;
  insert into public.artisans (id) values (auth.uid())
    on conflict (id) do nothing;
  select * into f from public.artisans where id = auth.uid();
  return f;
end;
$$;

revoke all on function public.ma_fiche() from public;
grant execute on function public.ma_fiche() to authenticated;

-- `maj_le` se tient tout seul : un champ de date tenu par le code finit
-- toujours par etre oublie dans une branche.
create or replace function public.artisans_touche() returns trigger
language plpgsql as $$
begin new.maj_le = now(); return new; end;
$$;
drop trigger if exists artisans_maj on public.artisans;
create trigger artisans_maj before update on public.artisans
  for each row execute function public.artisans_touche();

-- ============================================================
-- CE QUI RESTE A FAIRE HORS DE CE FICHIER :
--
--   1. Activer les fournisseurs de connexion dans Supabase : Google, et
--      l'adresse mail avec mot de passe. Deux interrupteurs, plus les
--      identifiants Google a creer.
--   2. Les fonctions serveur des agendas : ce sont elles, et elles seules,
--      qui touchent `agenda_secrets`.
--   3. Verifier depuis un navigateur connecte qu'un artisan ne peut lire
--      AUCUNE ligne d'un autre : c'est le controle qui compte, et il se fait
--      avec deux comptes d'essai, pas par lecture du code.
-- ============================================================
