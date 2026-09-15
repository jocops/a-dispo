-- ============================================================
-- LISTE D'ATTENTE : la table, et ce qui la protege.
--
-- Ligne du devis N°20260910-1 : « Inscription avant l'ouverture et email de
-- confirmation automatique », 1 j, OFFERT.
--
-- A QUOI SERT CETTE TABLE. Elle porte la seule chose que le projet a besoin
-- de savoir avant d'ouvrir : COMBIEN d'artisans, DANS QUEL METIER, et OU. La
-- decision de lancement, deux ou trois metiers sur une zone definie, se prend
-- sur ces trois colonnes. Sans elles, on ouvre a l'aveugle.
--
-- LE PROBLEME PARTICULIER DE CETTE TABLE. Le site est statique : le formulaire
-- ecrit DIRECTEMENT ici, depuis le navigateur, avec la cle publique. Toute
-- personne qui lit le code source peut donc appeler cette table. C'est un choix
-- assume, parce que l'alternative, un serveur intermediaire, coute un jour de
-- travail et une piece a maintenir. Mais il impose trois regles strictes :
--
--   1. ON PEUT ECRIRE, ON NE PEUT PAS LIRE. Sans politique de lecture, la
--      liste ne peut pas etre aspiree. C'est le point le plus important :
--      cette table contient des adresses mail d'artisans demarches.
--   2. UNE ADRESSE NE PEUT ENTRER QU'UNE FOIS. L'unicite est portee par la
--      base et non par le formulaire : un controle cote navigateur se
--      contourne en dix secondes.
--   3. LE JETON DE CONFIRMATION NE REVIENT JAMAIS AU NAVIGATEUR. S'il
--      revenait, n'importe qui confirmerait sa propre inscription, et la
--      double confirmation ne servirait plus a rien.
--
-- POURQUOI LA DOUBLE CONFIRMATION. Sans elle, la liste se remplit d'adresses
-- fausses ou saisies de travers, et le compteur ment. Or c'est precisement ce
-- compteur qui sert a decider ou lancer. Une liste de 300 inscrits dont 80
-- d'adresses mortes n'est pas une liste de 300 inscrits.
--
-- Rejouable sans risque : tout est en `if not exists` / `or replace`.
-- ============================================================

-- ------------------------------------------------------------ la table

create table if not exists public.inscriptions (
  id            uuid primary key default gen_random_uuid(),
  cree_le       timestamptz not null default now(),

  email         text not null,
  -- Colonne calculee par la base : c'est elle qui porte l'unicite. Un artisan
  -- qui tape « Jean@Exemple.fr » puis « jean@exemple.fr  » ne doit pas creer
  -- deux lignes, et normaliser cote navigateur ne protege de rien.
  email_norme   text generated always as (lower(btrim(email))) stored,

  metier        text not null,
  -- Le metier ecrit a la main quand la liste ne le contient pas. C'est LA
  -- donnee du formulaire « votre metier n'est pas dans la liste ? » : elle
  -- vit dans la meme table que le reste, parce qu'une demande de metier est
  -- une inscription comme une autre. Deux tables auraient donne deux
  -- comptages, et deux comptages finissent toujours par diverger.
  metier_libre  text,
  departement   text not null,
  telephone     text,

  -- Le jeton de confirmation. Il ne sort JAMAIS vers le navigateur : seul
  -- l'envoi de l'email, cote serveur, le connait.
  jeton         uuid not null default gen_random_uuid(),
  confirme_le   timestamptz,

  -- D'ou vient l'inscrit : salon, QR code d'un t-shirt, journal local, bouche
  -- a oreille. C'est ce qui dira quel canal merite qu'on y remette de l'argent.
  provenance    text,

  constraint email_plausible check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
  constraint metier_court    check (char_length(metier) between 2 and 60),
  -- Choisir « un autre metier » sans dire lequel ne sert a rien : c'est
  -- precisement le metier qu'on cherche a connaitre.
  constraint metier_libre_si_autre check (
    (metier <> 'Un autre métier') or
    (metier_libre is not null and char_length(btrim(metier_libre)) between 2 and 60)),
  constraint departement_ok  check (departement ~ '^(0[1-9]|[1-8][0-9]|9[0-5]|2[AB]|97[1-6])$'),
  constraint telephone_ok    check (telephone is null or telephone ~ '^[0-9 +().-]{6,20}$')
);

-- L'unicite est un INDEX et non une contrainte de colonne, pour pouvoir la
-- poser sur la colonne calculee.
create unique index if not exists inscriptions_email_unique
  on public.inscriptions (email_norme);

-- Les deux lectures qu'on fera vraiment : combien par metier, combien par
-- departement. Les poser maintenant coute une seconde ; les poser quand la
-- table est pleine coute un verrou.
create index if not exists inscriptions_metier_idx      on public.inscriptions (metier);
create index if not exists inscriptions_departement_idx on public.inscriptions (departement);
create index if not exists inscriptions_confirme_idx    on public.inscriptions (confirme_le);

-- ------------------------------------------------------- les autorisations

alter table public.inscriptions enable row level security;

-- ECRITURE : ouverte au public non connecte. C'est un formulaire d'inscription,
-- il ne peut pas en etre autrement.
drop policy if exists "inscription publique" on public.inscriptions;
create policy "inscription publique"
  on public.inscriptions for insert
  to anon, authenticated
  with check (true);

-- LECTURE : rien pour le public. Aucune politique de select pour `anon`, donc
-- aucune ligne ne sort. C'est ce qui empeche d'aspirer la liste avec la cle
-- publique, qui est lisible dans le code source de la page.
drop policy if exists "lecture par les comptes" on public.inscriptions;
create policy "lecture par les comptes"
  on public.inscriptions for select
  to authenticated
  using (true);

-- MODIFICATION et SUPPRESSION : aucune politique, donc personne. La
-- confirmation passe par la fonction ci-dessous, et elle seule.

-- --------------------------------------------------------- la confirmation

-- Confirme une inscription a partir de son jeton.
--
-- `security definer` : la fonction s'execute avec les droits de son
-- proprietaire, ce qui lui permet d'ecrire dans une table que l'appelant n'a
-- pas le droit de modifier. C'est exactement l'usage prevu : une porte
-- etroite et unique, au lieu d'ouvrir la table en modification.
--
-- Elle ne rend qu'un booleen. Elle ne dit ni l'adresse, ni le metier, ni si le
-- jeton existait : un jeton inconnu et un jeton deja utilise donnent la meme
-- reponse. Repondre differemment permettrait de deviner des jetons valides.
create or replace function public.confirmer_inscription(p_jeton uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  touche integer;
begin
  update public.inscriptions
     set confirme_le = now()
   where jeton = p_jeton
     and confirme_le is null;
  get diagnostics touche = row_count;
  return touche > 0;
end;
$$;

revoke all on function public.confirmer_inscription(uuid) from public;
grant execute on function public.confirmer_inscription(uuid) to anon, authenticated;

-- ------------------------------------------------------------ le comptage

-- Ce que Claire-Marie regardera : combien d'inscrits CONFIRMES par metier et
-- par departement. Les non confirmes sont comptes a part, parce que melanger
-- les deux donnerait un chiffre flatteur et faux.
-- Le metier EFFECTIF : celui saisi a la main quand il y en a un, celui du menu
-- sinon. Compter « Un autre metier » comme un metier donnerait une ligne
-- fourre-tout en tete du classement, qui ne dirait rien.
create or replace view public.inscriptions_par_metier as
  select coalesce(nullif(btrim(metier_libre), ''), metier) as metier,
         count(*) filter (where confirme_le is not null) as confirmes,
         count(*) filter (where confirme_le is null)     as en_attente,
         count(*)                                        as total
    from public.inscriptions
   group by 1
   order by confirmes desc, total desc;

create or replace view public.inscriptions_par_departement as
  select departement,
         count(*) filter (where confirme_le is not null) as confirmes,
         count(*) filter (where confirme_le is null)     as en_attente,
         count(*)                                        as total
    from public.inscriptions
   group by departement
   order by confirmes desc, total desc;

-- Les vues heritent de la securite de la table : un visiteur non connecte n'en
-- tire rien.
revoke all on public.inscriptions_par_metier      from anon;
revoke all on public.inscriptions_par_departement from anon;
grant select on public.inscriptions_par_metier      to authenticated;
grant select on public.inscriptions_par_departement to authenticated;

-- ============================================================
-- CE QU'IL RESTE A FAIRE APRES AVOIR JOUE CE FICHIER :
--
--   1. Choisir un service d'envoi d'emails. Supabase n'envoie pas d'email
--      arbitraire : il faut une fonction serveur et un fournisseur. C'est la
--      SEULE piece manquante pour que la double confirmation tourne.
--   2. Ecrire cette fonction : elle lit le jeton, envoie l'email, et l'appelle
--      au moment de l'insertion. Le jeton ne doit jamais transiter par le
--      navigateur.
--   3. Verifier depuis un navigateur non connecte que `select * from
--      inscriptions` ne rend RIEN. C'est le controle qui compte.
-- ============================================================
