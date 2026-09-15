-- ============================================================
-- LE COEUR DU PRODUIT : trouver un confrere libre, et le contacter.
--
-- A jouer APRES schema.sql, migration-admin.sql, migration-presence.sql et
-- migration-espace-artisan.sql. Ce fichier appelle `public.est_admin()`, qui
-- vient de migration-admin.sql : sans elle, les politiques d'administration
-- d'ici refusent de se creer.
--
-- PERIMETRE, ET IL FAUT LE SAVOIR AVANT DE LIRE. Ce fichier ne couvre AUCUNE
-- ligne du devis-facture N°20260910-1, le seul signe. Il couvre cinq lignes du
-- devis 2027-02, NON SIGNE a ce jour :
--   · « Recherche : qui est libre, dans quel métier, à quelles dates, à
--     combien de km » (2,5 j) ;
--   · « Recherche fine : spécialité, outillage, permis et CACES, pas juste le
--     métier » (1,5 j) ;
--   · « Demande envoyée, acceptée ou refusée, avec notification des deux
--     côtés » (1,5 j) ;
--   · « Chacun note l'autre : la qualité du travail, et les délais de
--     paiement » (1,5 j) ;
--   · « Ton interface d'administration : voir, corriger, suspendre, modérer »
--     (2,5 j), dont ce fichier ne pose que le journal d'audit.
-- Ecrire ces tables ne les facture pas. Le rattachement contractuel reste a
-- trancher, et il est rappele dans le bloc final.
--
-- LES QUATRE REGLES QUI GOUVERNENT TOUT LE FICHIER.
--
--   1. UN ARTISAN NE LIT QUE CE QUI LE CONCERNE. Chaque table nouvelle porte
--      la securite par ligne et des politiques qui comparent `auth.uid()` aux
--      deux bouts de la relation. La cle publique est lisible dans le code
--      source de chaque page : une table sans politique juste est une table
--      publique.
--
--   2. AUCUNE COLONNE NE PERMET DE RECONSTITUER L'AGENDA D'UN CONFRERE. La
--      recherche rend des PERSONNES, jamais des creneaux. Le croisement avec
--      `occupations` se fait a l'interieur d'une fonction `security definer`,
--      et cette fonction ne rend pas une seule date. Le navigateur ne recoit
--      jamais l'occupation d'un autre, meme agregee, meme anonymisee.
--      La faille qui reste, et qu'il faut connaitre : en relancant la meme
--      recherche sur des periodes successives, on finit par deviner un
--      agenda. C'est pour cela que toute recherche est journalisee (table
--      `recherches`) : la cadence anormale se voit, et se traite.
--
--   3. LES COORDONNEES NE S'OUVRENT QU'APRES ACCEPTATION, ET C'EST LA BASE
--      QUI LE DIT. Le telephone, le nom de famille et le SIRET ne sortent
--      d'aucune vue publique et d'aucune politique : ils ne sortent que de
--      `coordonnees_confrere(demande)`, qui verifie que la demande est
--      acceptee et que l'appelant est l'une des deux parties. Une page qui
--      voudrait tricher n'aurait rien a lire.
--
--   4. AUCUN MONTANT NULLE PART. Le tarif est en cours d'arbitrage. Le droit
--      d'envoyer une demande ne se mesure donc pas en euros mais en DATES :
--      `essai_jusqu_au` et `abonne_jusqu_au`, deja presentes sur `artisans`.
--      Aucune colonne de prix, aucune table de tarifs, aucun exemple chiffre.
--
-- CE QUE LA GEOGRAPHIE A COUTE, ET POURQUOI ELLE EST FAITE AINSI.
-- Mesure du 13/09/2026, appels reels a recherche-entreprises.api.gouv.fr :
--   · SIRET 55208131766522 (statut_diffusion = O) : latitude '48.876235098',
--     longitude '2.2979350788', commune '75108'. Tout est la.
--   · SIRET 97770958300024 (statut_diffusion = P) : latitude, longitude,
--     coordonnees, code_postal et adresse valent litteralement la chaine
--     « [NON-DIFFUSIBLE] ». Seuls commune ('73008'), libelle_commune
--     ('AIX-LES-BAINS') et departement ('73') restent reels.
-- Or le statut P est frequent chez les personnes physiques, donc chez les
-- auto-entrepreneurs, donc chez EXACTEMENT la cible d'« a dispo » : le SIRET
-- de l'emetteur du devis signe est lui-meme dans ce cas.
-- Conclusion, et c'est le seul dessin qui tient : on stocke la position quand
-- l'annuaire la donne, et on retombe sur le CENTRE DE LA COMMUNE quand il la
-- masque. Le code commune INSEE est la seule donnee geographique qui survit
-- au masquage. Il faut donc une table de communes, la plus legere possible :
-- code, nom, departement, latitude, longitude. Rien d'autre.
-- Consequence a dire a l'ecran, pas a cacher : la precision n'est pas la meme
-- pour tout le monde. La colonne `position_source` le dit ligne par ligne.
--
-- POURQUOI AUCUNE EXTENSION POSTGIS NI EARTHDISTANCE. On ne sait pas, depuis
-- le depot, ce qui est active sur le projet Supabase. Une migration qui exige
-- une extension absente echoue en entier. La distance est donc calculee par
-- une formule de haversine ecrite ici, en SQL pur, precedee d'un filtre par
-- boite englobante qui fait le travail d'un index geographique avec un simple
-- index btree. Cela suffit tres largement a l'echelle d'un departement.
--
-- POURQUOI LA NOTE NE SE VOIT PAS TOUT DE SUITE. Si une note devient visible
-- des qu'elle est posee, deux choses arrivent, et elles sont mesurables sur
-- toutes les places de marche : le premier qui note s'expose aux represailles
-- du second, et le second ne note plus, il repond. On obtient alors des notes
-- moyennes hautes et muettes. Ici, les deux notes restent invisibles jusqu'a
-- ce que les DEUX soient posees, ou jusqu'a ce que le delai soit passe. Ni
-- l'un ni l'autre ne peut donc adapter sa note a celle qu'il a recue, et
-- aucune note ne se modifie apres coup : il n'existe pas de politique de mise
-- a jour sur `evaluations`.
--
-- Rejouable sans risque : tout est en `if not exists` / `or replace`, les
-- politiques et les declencheurs sont precedes d'un `drop ... if exists`, et
-- les contraintes ajoutees a une table existante passent par un test sur
-- `pg_constraint` (un `alter table add constraint` n'est pas rejouable).
-- Aucun `drop table`, aucun `delete`, aucun `truncate`.
-- ============================================================


-- ============================================================
-- 1. LA GEOGRAPHIE : de quoi calculer un rayon en kilometres.
-- ============================================================

-- ------------------------------------------------------- la table communes
--
-- La table de reference la plus legere qui rende le service : cinq colonnes.
-- Pas de codes postaux (une commune en a parfois plusieurs, et le code postal
-- ne sert a rien pour un rayon), pas de population, pas de geometrie de
-- contour. Le centre de la commune suffit, et c'est aussi tout ce qu'on peut
-- honnetement afficher pour un artisan non diffusible.
--
-- Ce sont des donnees publiques et non personnelles : la table est lisible par
-- tout le monde, y compris un visiteur non connecte, parce que le champ
-- « commune du chantier » d'un formulaire doit pouvoir proposer des noms avant
-- toute connexion.

create table if not exists public.communes (
  code_insee  text primary key,
  nom         text not null,
  -- `nom_norme` est rempli par le script de chargement : minuscules, sans
  -- accents, tirets remplaces par des espaces. On ne peut pas en faire une
  -- colonne calculee : `unaccent` n'est pas immuable, Postgres la refuse.
  -- Tant qu'elle est vide, la recherche retombe sur `lower(nom)`.
  nom_norme   text,
  departement text not null,
  latitude    double precision not null,
  longitude   double precision not null,
  constraint commune_insee_ok check (code_insee ~ '^([0-9]{2}|2[AB])[0-9]{3}$'),
  constraint commune_lat_ok   check (latitude between -90 and 90),
  constraint commune_lon_ok   check (longitude between -180 and 180)
);

create index if not exists communes_nom_idx  on public.communes (nom_norme);
create index if not exists communes_dept_idx on public.communes (departement);

alter table public.communes enable row level security;
drop policy if exists "communes lisibles par tous" on public.communes;
create policy "communes lisibles par tous"
  on public.communes for select to anon, authenticated using (true);
-- Aucune politique d'ecriture : la table se charge avec la cle de service, une
-- fois, et se rejoue au meme endroit. Voir le bloc final pour la commande
-- exacte et le poids mesure.

-- --------------------------------------------- la position sur l'artisan
--
-- Trois colonnes ajoutees a `artisans`, plus la trace de leur origine.
-- `commune_insee` est la plus importante des trois : c'est la seule que
-- l'annuaire rend encore quand l'entreprise n'est pas diffusible.

alter table public.artisans add column if not exists commune_insee   text;
alter table public.artisans add column if not exists latitude        double precision;
alter table public.artisans add column if not exists longitude       double precision;
alter table public.artisans add column if not exists position_source text;
alter table public.artisans add column if not exists position_le     timestamptz;

comment on column public.artisans.commune_insee is
  'Code commune INSEE. Seule donnee geographique que l annuaire rend encore quand statut_diffusion = P.';
comment on column public.artisans.position_source is
  'annuaire (adresse exacte), commune (centre de la commune), saisie (pose a la main). Dit la precision reelle.';

-- Les contraintes d'une colonne ajoutee apres coup : `alter table add
-- constraint` echoue au deuxieme passage. On teste donc leur presence, sinon
-- ce fichier ne serait rejouable qu'une fois, ce qui n'est pas rejouable.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'artisans_commune_insee_ok') then
    alter table public.artisans add constraint artisans_commune_insee_ok
      check (commune_insee is null or commune_insee ~ '^([0-9]{2}|2[AB])[0-9]{3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artisans_latitude_ok') then
    alter table public.artisans add constraint artisans_latitude_ok
      check (latitude is null or latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artisans_longitude_ok') then
    alter table public.artisans add constraint artisans_longitude_ok
      check (longitude is null or longitude between -180 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artisans_position_source_ok') then
    alter table public.artisans add constraint artisans_position_source_ok
      check (position_source is null or position_source in ('annuaire','commune','saisie'));
  end if;
end $$;

-- L'index qui porte la boite englobante de la recherche. Partiel sur `publie`,
-- comme les deux index existants : un artisan non publie n'est jamais cherche.
create index if not exists artisans_position_idx
  on public.artisans (latitude, longitude) where publie;
create index if not exists artisans_commune_idx
  on public.artisans (commune_insee) where publie;

-- La position se tient toute seule, comme `maj_le`. Une position calculee par
-- le code finit toujours par etre oubliee dans une branche.
--
-- La regle, dans l'ordre :
--   · une latitude et une longitude ecrites explicitement gagnent toujours :
--     c'est l'adresse exacte rendue par l'annuaire, on ne la remplace pas par
--     un centre de commune ;
--   · sinon, si un code commune est connu, on prend le centre de la commune ;
--   · sinon, l'artisan n'a pas de position, et il n'apparait dans aucune
--     recherche par rayon. C'est le cas franc : ni position inventee, ni
--     position par defaut au milieu de la France.
create or replace function public.artisans_position() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Un changement de commune invalide une position qui venait de la commune.
  if tg_op = 'UPDATE'
     and coalesce(new.position_source, '') = 'commune'
     and new.commune_insee is distinct from old.commune_insee then
    new.latitude := null;
    new.longitude := null;
  end if;

  if new.latitude is not null and new.longitude is not null then
    if tg_op = 'INSERT'
       or new.latitude  is distinct from old.latitude
       or new.longitude is distinct from old.longitude then
      new.position_source := coalesce(nullif(new.position_source, ''), 'annuaire');
      new.position_le := now();
    end if;
    return new;
  end if;

  if new.commune_insee is not null then
    select c.latitude, c.longitude into new.latitude, new.longitude
      from public.communes c
     where c.code_insee = new.commune_insee;
    if new.latitude is not null then
      new.position_source := 'commune';
      new.position_le := now();
      return new;
    end if;
  end if;

  new.position_source := null;
  new.position_le := null;
  return new;
end $$;

drop trigger if exists artisans_position on public.artisans;
create trigger artisans_position before insert or update on public.artisans
  for each row execute function public.artisans_position();

-- ------------------------------------------------------------ la distance
--
-- Haversine, en kilometres. Rayon moyen de la Terre : 6371 km.
-- `immutable` pour que Postgres puisse la calculer une fois par ligne et la
-- reutiliser dans le tri sans la recalculer.
create or replace function public.distance_km(
  p_lat1 double precision, p_lon1 double precision,
  p_lat2 double precision, p_lon2 double precision)
returns double precision
language sql
immutable
parallel safe
as $$
  select 6371.0 * 2 * asin(sqrt(
           power(sin(radians(p_lat2 - p_lat1) / 2), 2)
         + cos(radians(p_lat1)) * cos(radians(p_lat2))
         * power(sin(radians(p_lon2 - p_lon1) / 2), 2)))
$$;
-- Volontairement laissee ouverte a tous, sans `revoke` : elle ne lit aucune
-- table et ne rend que de la trigonometrie. C'est la seule fonction de ce
-- fichier dans ce cas, et c'est pour cela que la remarque est ecrite.

-- ------------------------------------------------ choisir une commune
--
-- Alimente le champ « commune du chantier ». Rend au plus 25 lignes de donnees
-- publiques : aucune raison de le reserver aux comptes connectes.
-- Limite connue : sans `nom_norme` chargee, taper « etienne » ne trouve pas
-- « Saint-Étienne ». C'est le script de chargement qui leve cette limite, pas
-- une extension : `unaccent` n'etant pas immuable, il ne peut pas etre indexe.
create or replace function public.chercher_commune(p_texte text, p_limite integer default 10)
returns table (
  code_insee  text,
  nom         text,
  departement text,
  latitude    double precision,
  longitude   double precision)
language sql
stable
as $$
  select c.code_insee, c.nom, c.departement, c.latitude, c.longitude
    from public.communes c
   where char_length(btrim(coalesce(p_texte, ''))) >= 2
     and coalesce(c.nom_norme, lower(c.nom)) like
         -- On neutralise les jokers du motif : sinon un seul caractere « % »
         -- rendrait la table entiere, au rythme de 25 lignes par appel.
         replace(replace(lower(btrim(p_texte)), '%', '\%'), '_', '\_') || '%'
   order by c.nom
   limit least(coalesce(p_limite, 10), 25)
$$;

revoke all on function public.chercher_commune(text, integer) from public;
grant execute on function public.chercher_commune(text, integer) to anon, authenticated;


-- ============================================================
-- 2. LA RECHERCHE : qui est libre, dans quel metier, ou.
-- ============================================================

-- L'index qui manquait. `occupations_artisan_idx` porte (artisan_id, debut) :
-- il trouve le debut, pas le chevauchement. Le test de chevauchement lit les
-- deux bornes ; sans `fin` dans l'index, chaque artisan candidat coute une
-- visite de table. Le poser maintenant coute une seconde, le poser quand la
-- table est pleine coute un verrou.
create index if not exists occupations_periode_idx
  on public.occupations (artisan_id, debut, fin);

-- ------------------------------------------------- le journal des recherches
--
-- Deux raisons, et la seconde n'est pas la moins importante :
--   · une recherche qui ne rend AUCUN resultat est exactement la donnee qui
--     dit ou ouvrir le service ensuite. Un metier demande cinquante fois dans
--     un departement ou personne n'est inscrit vaut mieux qu'une intuition ;
--   · c'est le seul endroit ou se voit la lecture d'agenda par balayage, celle
--     qui relance la meme recherche sur des periodes successives. On ne peut
--     pas l'empecher au niveau de la base, on peut la voir.
--
-- Ce journal ne contient AUCUN resultat : ni qui a ete trouve, ni ses dates.
-- Il ne contient que la question posee et le nombre de reponses.

create table if not exists public.recherches (
  id            bigserial primary key,
  cree_le       timestamptz not null default now(),
  -- La cle etrangere pointe `auth.users` et NON `artisans` : un compte
  -- d'equipe qui verifie le service n'a pas de fiche d'artisan, et une cle
  -- vers `artisans` ferait echouer sa recherche au moment de la journaliser.
  -- `set null` plutot que `cascade` : la question posee reste utile quand le
  -- compte qui l'a posee a disparu.
  chercheur_id  uuid references auth.users(id) on delete set null,
  metier        text,
  debut         date,
  fin           date,
  commune_insee text,
  latitude      double precision,
  longitude     double precision,
  rayon_km      integer,
  nb_resultats  integer not null default 0
);
create index if not exists recherches_cree_idx     on public.recherches (cree_le desc);
create index if not exists recherches_vides_idx    on public.recherches (metier, commune_insee) where nb_resultats = 0;
create index if not exists recherches_chercheur_idx on public.recherches (chercheur_id, cree_le desc);

alter table public.recherches enable row level security;

drop policy if exists "ses recherches" on public.recherches;
create policy "ses recherches" on public.recherches for select to authenticated
  using (chercheur_id = auth.uid() or public.est_admin());
-- Aucune politique d'ecriture : seule la fonction de recherche ecrit ici, et
-- elle est `security definer`. Un artisan ne peut donc pas effacer la trace de
-- ses propres recherches.

-- ----------------------------------------------------------- la recherche
--
-- LA FONCTION CENTRALE DU PRODUIT.
--
-- Ce qu'elle prend : un metier (ou null pour tous), une periode en dates, un
-- point, un rayon en kilometres.
-- Ce qu'elle rend : des artisans PUBLIES, LIBRES sur TOUTE la periode, tries
-- par distance. Jamais une date, jamais un creneau, jamais un telephone.
--
-- ETRE LIBRE, C'EST N'AVOIR AUCUNE OCCUPATION QUI CHEVAUCHE LA PERIODE. Deux
-- intervalles se chevauchent quand chacun commence avant que l'autre finisse :
-- `o.debut < fin_demandee and o.fin > debut_demandee`. Une occupation qui
-- finit pile au debut demande ne chevauche pas.
--
-- POURQUOI `security definer`. `occupations` est strictement privee : sa seule
-- politique compare `artisan_id` a `auth.uid()`. Croiser les fiches publiques
-- avec les occupations est donc impossible depuis un navigateur, et c'est tres
-- bien ainsi. La fonction fait le croisement a l'interieur de la base et ne
-- rend que le resultat : une liste de personnes.
--
-- POURQUOI ELLE EXIGE UNE SESSION. Une recherche ouverte a tout le monde
-- permettrait de cartographier qui est libre et ou, sans compte et sans
-- trace. C'est a la fois une donnee personnelle et le fonds de commerce.
--
-- La vue `notes_publiques` qu'elle lit est creee plus bas dans ce fichier :
-- le corps d'une fonction plpgsql n'est resolu qu'au premier appel, donc
-- l'ordre d'ecriture n'a pas d'importance a la creation. Il en a a l'usage :
-- ne jouez jamais ce fichier a moitie.

-- Un `drop` prealable parce que `create or replace` refuse de changer le type
-- rendu par une fonction existante : sans lui, la premiere evolution de la
-- liste des colonnes rendues ferait echouer le rejeu.
drop function if exists public.rechercher_confreres(text, date, date, double precision, double precision, integer, integer);

create or replace function public.rechercher_confreres(
  p_metier    text,
  p_debut     date,
  p_fin       date,
  p_latitude  double precision,
  p_longitude double precision,
  p_rayon_km  integer default 30,
  p_limite    integer default 50)
returns table (
  artisan_id      uuid,
  prenom          text,
  denomination    text,
  metier          text,
  presentation    text,
  photo_url       text,
  commune         text,
  departement     text,
  rayon_km        integer,
  distance_km     double precision,
  dans_son_rayon  boolean,
  position_source text,
  note_moyenne    numeric,
  nb_notes        bigint)
language plpgsql
security definer
-- Surtout pas `stable` : la fonction ecrit le journal des recherches, et
-- Postgres refuse toute ecriture dans une fonction non volatile. La marquer
-- stable la ferait echouer au premier appel, pas a la creation.
set search_path = public
as $$
declare
  v_debut  timestamptz;
  v_fin    timestamptz;
  v_rayon  integer := least(greatest(coalesce(p_rayon_km, 30), 1), 200);
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_dlat   double precision;
  v_dlon   double precision;
  v_n      integer;
begin
  if auth.uid() is null then
    raise exception 'aucune session';
  end if;
  if p_debut is null or p_fin is null or p_fin < p_debut then
    raise exception 'periode invalide';
  end if;

  -- Les dates deviennent des instants a l'heure de Paris. Sans le fuseau
  -- explicite, la conversion suivrait le reglage de la session, qui vaut UTC
  -- sur Supabase : une disponibilite du 20 septembre commencerait a 2 h du
  -- matin le 20 pour les uns et a minuit pour les autres.
  v_debut := (p_debut::timestamp) at time zone 'Europe/Paris';
  v_fin   := ((p_fin + 1)::timestamp) at time zone 'Europe/Paris';

  -- La boite englobante : elle elimine par un index btree tout ce qui est
  -- manifestement trop loin, avant le moindre calcul de distance. 111 km par
  -- degre de latitude est volontairement minore (la valeur exacte est
  -- d'environ 111,2) : une boite un peu large coute quelques calculs, une
  -- boite trop etroite perd un confrere, ce qui ne se voit jamais.
  if p_latitude is not null and p_longitude is not null then
    v_dlat := v_rayon / 111.0;
    v_dlon := v_rayon / (111.0 * greatest(cos(radians(p_latitude)), 0.01));
  end if;

  -- LE PIEGE DE PLPGSQL, ET C'EST POURQUOI IL Y A UNE SOUS-REQUETE.
  -- Les colonnes rendues par un `returns table` sont aussi des VARIABLES de la
  -- fonction. Un `order by distance_km` ne trierait donc pas sur la colonne
  -- calculee mais sur la variable, vide : le tri par distance disparaitrait en
  -- silence, sans la moindre erreur. Toutes les colonnes sont donc nommees
  -- autrement a l'interieur (`dist`), et toutes les references sont qualifiees.
  return query
    with candidats as (
      select a.id           as a_id,
             a.prenom       as a_prenom,
             a.denomination as a_denomination,
             coalesce(m.libelle, a.metier_libre) as a_metier,
             a.presentation as a_presentation,
             a.photo_url    as a_photo,
             a.commune      as a_commune,
             -- Le departement vient d'abord de la commune INSEE : `code_postal`
             -- est mis a null pour tout artisan non diffusible, et un
             -- `left(code_postal, 2)` seul rendrait ces artisans invisibles.
             coalesce(c.departement, left(a.code_postal, 2)) as a_departement,
             a.rayon_km        as a_rayon,
             a.position_source as a_source,
             case when p_latitude is null or p_longitude is null then null
                  else public.distance_km(p_latitude, p_longitude, a.latitude, a.longitude)
             end as dist,
             n.moyenne as a_moyenne,
             n.nombre  as a_nombre
        from public.artisans a
        left join public.metiers m         on m.code = a.metier
        left join public.communes c        on c.code_insee = a.commune_insee
        left join public.notes_publiques n on n.cible_id = a.id
       where a.publie
         and a.etape = 'fini'
         -- On ne se rend jamais dans ses propres resultats.
         and a.id <> auth.uid()
         and (p_metier is null or a.metier = p_metier)
         -- Le filtre geographique ne s'applique que si un point est donne.
         -- Sans point, la recherche reste possible mais la distance vaut
         -- null : la page doit alors dire qu'elle ne classe pas par distance.
         and (p_latitude is null or p_longitude is null or (
               a.latitude  is not null
           and a.longitude is not null
           and a.latitude  between p_latitude  - v_dlat and p_latitude  + v_dlat
           and a.longitude between p_longitude - v_dlon and p_longitude + v_dlon
           and public.distance_km(p_latitude, p_longitude, a.latitude, a.longitude) <= v_rayon))
         -- LIBRE SUR TOUTE LA PERIODE : aucune occupation qui chevauche.
         and not exists (
               select 1 from public.occupations o
                where o.artisan_id = a.id
                  and o.debut < v_fin
                  and o.fin   > v_debut)
    )
    select k.a_id,
           k.a_prenom,
           k.a_denomination,
           k.a_metier,
           k.a_presentation,
           k.a_photo,
           k.a_commune,
           k.a_departement,
           k.a_rayon,
           round(k.dist::numeric, 1)::double precision,
           (k.dist <= k.a_rayon),
           k.a_source,
           k.a_moyenne,
           k.a_nombre
      from candidats k
     order by k.dist nulls last, k.a_prenom
     limit v_limite;

  get diagnostics v_n = row_count;

  insert into public.recherches
        (chercheur_id, metier, debut, fin, latitude, longitude, rayon_km, nb_resultats)
  values (auth.uid(), p_metier, p_debut, p_fin, p_latitude, p_longitude, v_rayon, v_n);

  return;
end $$;

revoke all on function public.rechercher_confreres(text, date, date, double precision, double precision, integer, integer) from public;
grant execute on function public.rechercher_confreres(text, date, date, double precision, double precision, integer, integer) to authenticated;

-- ---------------------------------------------- de quoi ne rien inventer
--
-- Ce que la page doit pouvoir dire honnetement quand une recherche ne rend
-- personne : combien de confreres sont publies, combien d'entre eux ont une
-- position exploitable, et si la table des communes est chargee. Sans ces
-- trois nombres, un ecran vide laisse croire a une panne, ou pire, a un
-- service sans inscrits alors qu'il en a.
-- Aucun de ces nombres n'est une donnee personnelle.
create or replace function public.etat_recherche()
returns table (
  publies           bigint,
  positionnes       bigint,
  sans_position     bigint,
  communes_chargees bigint)
language sql
security definer
stable
set search_path = public
as $$
  select count(*) filter (where a.publie and a.etape = 'fini'),
         count(*) filter (where a.publie and a.etape = 'fini' and a.latitude is not null),
         count(*) filter (where a.publie and a.etape = 'fini' and a.latitude is null),
         (select count(*) from public.communes)
    from public.artisans a
$$;

revoke all on function public.etat_recherche() from public;
grant execute on function public.etat_recherche() to authenticated;


-- ============================================================
-- 3. LA DEMANDE DE MISE EN RELATION.
-- ============================================================

-- ----------------------------------------------------- les deux gardes
--
-- QUI A LE DROIT D'ENVOYER UNE DEMANDE. Une date, jamais un montant : le
-- tarif est en cours d'arbitrage, et il n'a pas a etre connu de la base pour
-- que la regle fonctionne. Un essai en cours ouvre le meme droit qu'un
-- abonnement en cours, ce qui permet d'ouvrir le service avant d'avoir un
-- prestataire de paiement.
--
-- CONSEQUENCE A DIRE A L'ECRAN, ET MESUREE : aujourd'hui, aucune page
-- n'ecrit `essai_jusqu_au` ni `abonne_jusqu_au` (zero occurrence dans
-- espace/index.html au 13/09/2026). Cette fonction rend donc `false` pour
-- tout le monde, et aucune demande ne peut partir. C'est voulu : mieux vaut
-- un bouton eteint qui dit pourquoi qu'un bouton qui envoie dans le vide. La
-- page doit afficher que l'abonnement n'est pas encore ouvert, exactement
-- comme l'ecran d'abonnement le fait deja pour le paiement.
--
-- POURQUOI ELLE INTERROGE D'ABORD UNE AUTRE FONCTION. Le chantier des
-- abonnements (crm/supabase/migration-abonnement-pieces.sql) pose sa propre
-- garde, `acces_artisan(uuid)`, qui rend « complet », « lecture » ou
-- « ferme » a partir de sa table `abonnements`. Elle fait autorite : c'est
-- elle qui connait l'essai, l'impaye et la resiliation.
-- Le defaut mesure le 13/09/2026 si on l'ignore : ce fichier-la ne reecrit sur
-- `artisans` que `abonne_jusqu_au` et `formule` (ligne 1375), jamais
-- `essai_jusqu_au`. Un artisan en essai aurait donc « complet » d'un cote et
-- un bouton mort de l'autre. On lui demande donc directement, quand il existe,
-- et on retombe sur les deux dates sinon. « lecture » ne suffit pas : c'est un
-- acces en consultation, et envoyer une demande est une ecriture.
create or replace function public.peut_demander(p_artisan uuid default auth.uid())
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_acces text;
  v_dates boolean;
begin
  if p_artisan is null then
    return false;
  end if;

  if to_regprocedure('public.acces_artisan(uuid)') is not null then
    execute 'select public.acces_artisan($1)' into v_acces using p_artisan;
    return coalesce(v_acces, 'ferme') = 'complet';
  end if;

  select coalesce((a.essai_jusqu_au  >= current_date)
               or (a.abonne_jusqu_au >= current_date), false)
    into v_dates
    from public.artisans a
   where a.id = p_artisan;
  return coalesce(v_dates, false);
end $$;

revoke all on function public.peut_demander(uuid) from public;
grant execute on function public.peut_demander(uuid) to authenticated;

-- Une politique ne peut pas interroger `artisans` directement : la politique
-- « sa fiche » s'appliquerait a cette lecture, et le destinataire vise n'est
-- pas l'appelant. Cette garde lit la seule chose dont la politique a besoin,
-- et rien d'autre.
create or replace function public.est_publie(p_artisan uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select a.publie and a.etape = 'fini'
                    from public.artisans a where a.id = p_artisan), false)
$$;

revoke all on function public.est_publie(uuid) from public;
grant execute on function public.est_publie(uuid) to authenticated;

-- ------------------------------------------------------------ la table
--
-- UNE DEMANDE EST UNE TRACE, PAS UN MESSAGE. Elle dit qui demande a qui, pour
-- quel chantier et quelles dates, et ou en est la reponse. Elle ne se supprime
-- jamais : aucune politique de suppression n'existe. Une demande refusee
-- reste refusee.
--
-- LE VOCABULAIRE EST CELUI DE LA SOUS-TRAITANCE, y compris dans les valeurs
-- de contrainte : « demandeur », « destinataire », « chantier ». Le
-- vocabulaire de l'emploi est proscrit, ici comme a l'ecran : l'article
-- L8241-1 sanctionne le pret a but lucratif entre entreprises, alors qu'« a
-- dispo » met en relation des entreprises independantes en sous-traitance.
-- Et le schema d'une base finit toujours par remonter a l'ecran.

create table if not exists public.demandes (
  id              uuid primary key default gen_random_uuid(),
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now(),

  demandeur_id    uuid not null references public.artisans(id) on delete cascade,
  destinataire_id uuid not null references public.artisans(id) on delete cascade,

  -- Le chantier : quel metier, ou, et quand.
  metier          text references public.metiers(code),
  chantier_commune       text,
  -- Le code commune n'a volontairement PAS de cle etrangere vers `communes` :
  -- cette table peut etre vide tant qu'elle n'est pas chargee, et une cle
  -- etrangere ferait alors echouer toute demande. Le format est verifie plus
  -- bas par une contrainte, l'existence ne l'est pas.
  chantier_commune_insee text,
  debut           date not null,
  fin             date not null,
  message         text,

  -- L'etat, en liste fermee. Les transitions sont dans le declencheur, pas
  -- dans la page : une regle d'etat qui vit dans le navigateur se contourne.
  etat            text not null default 'envoyee'
                  check (etat in ('envoyee','vue','acceptee','refusee','annulee','expiree')),
  vue_le          timestamptz,
  repondu_le      timestamptz,
  -- Le motif d'un refus, ecrit par un confrere. Donnee libre : toute page qui
  -- l'affiche doit l'echapper.
  motif           text,
  -- LA DATE D'EXPIRATION N'EST PAS UN DELAI INVENTE. Une demande pour un
  -- chantier qui commence le 20 n'a plus aucun sens le 21 : elle expire au
  -- debut du chantier, et ce nombre-la n'est pas a trancher, il est dans la
  -- demande elle-meme.
  expire_le       timestamptz,

  constraint demande_pas_soi_meme check (demandeur_id <> destinataire_id),
  constraint demande_dates_ok     check (fin >= debut),
  constraint demande_message_ok   check (message is null or char_length(btrim(message)) <= 2000),
  constraint demande_motif_ok     check (motif is null or char_length(btrim(motif)) <= 500),
  constraint demande_commune_ok   check (chantier_commune_insee is null
                                      or chantier_commune_insee ~ '^([0-9]{2}|2[AB])[0-9]{3}$')
);

create index if not exists demandes_destinataire_idx on public.demandes (destinataire_id, cree_le desc);
create index if not exists demandes_demandeur_idx    on public.demandes (demandeur_id, cree_le desc);
create index if not exists demandes_etat_idx         on public.demandes (etat, expire_le);

-- ON NE HARCELE PAS. Deux demandes en cours vers le meme confrere pour la
-- meme periode sont une seule demande envoyee deux fois. L'unicite est
-- partielle : une fois la demande close, une nouvelle demande redevient
-- possible, parce qu'un chantier peut effectivement revenir.
create unique index if not exists demandes_en_cours_idx
  on public.demandes (demandeur_id, destinataire_id, debut, fin)
  where etat in ('envoyee','vue');

-- ------------------------------------------------------- les autorisations
--
-- LA REGLE : on ne voit que les demandes dont on est l'un des deux bouts.
-- Aucune lecture croisee, aucun annuaire des demandes des autres.

alter table public.demandes enable row level security;

drop policy if exists "ses demandes" on public.demandes;
create policy "ses demandes" on public.demandes for select to authenticated
  using (demandeur_id = auth.uid()
      or destinataire_id = auth.uid()
      or public.est_admin());

-- L'ENVOI : trois conditions, toutes portees par la base.
--   · on n'envoie qu'en son propre nom ;
--   · il faut un abonnement en cours ou un essai en cours ;
--   · le destinataire doit avoir une fiche publiee : on ne demande pas a
--     quelqu'un qui ne s'est pas encore montre.
drop policy if exists "envoyer une demande" on public.demandes;
create policy "envoyer une demande" on public.demandes for insert to authenticated
  with check (demandeur_id = auth.uid()
          and public.peut_demander()
          and public.est_publie(destinataire_id));

-- LA REPONSE : les deux parties peuvent ecrire, mais le declencheur decide
-- qui a le droit de quelle transition. La politique ouvre la porte, le
-- declencheur tient la regle.
drop policy if exists "repondre a une demande" on public.demandes;
create policy "repondre a une demande" on public.demandes for update to authenticated
  using (demandeur_id = auth.uid() or destinataire_id = auth.uid())
  with check (demandeur_id = auth.uid() or destinataire_id = auth.uid());

-- Aucune politique de suppression, pour personne. Une demande disparait avec
-- le compte de l'un des deux (cascade), et c'est le journal d'audit qui garde
-- la trace : lui ne porte aucune cle etrangere vers `artisans`.

-- ------------------------------------------------- les transitions d'etat
--
-- CE QUI EST FIGE A L'ENVOI. Les dates, le metier, la commune et le message ne
-- changent plus : une demande dont on peut reecrire les dates apres coup n'est
-- pas une trace, c'est un brouillon.
create or replace function public.demandes_avant_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.etat := 'envoyee';
  new.vue_le := null;
  new.repondu_le := null;
  new.motif := null;
  new.cree_le := now();
  new.maj_le := now();
  new.expire_le := (new.debut::timestamp) at time zone 'Europe/Paris';
  return new;
end $$;

drop trigger if exists demandes_avant_insert on public.demandes;
create trigger demandes_avant_insert before insert on public.demandes
  for each row execute function public.demandes_avant_insert();

-- LES TRANSITIONS, EN TOUTES LETTRES. Elles sont volontairement peu
-- nombreuses, et chacune dit QUI peut la faire :
--
--   envoyee -> vue       destinataire
--   envoyee -> acceptee  destinataire        vue -> acceptee  destinataire
--   envoyee -> refusee   destinataire        vue -> refusee   destinataire
--   envoyee -> annulee   demandeur           vue -> annulee   demandeur
--   envoyee -> expiree   personne            vue -> expiree   personne
--
-- « personne » veut dire : aucune session, donc la fonction d'entretien qui
-- tourne avec la cle de service. Un artisan ne peut pas declarer sa propre
-- demande expiree pour en renvoyer une autre aussitot.
-- acceptee, refusee, annulee et expiree sont terminaux.
create or replace function public.demandes_avant_maj() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qui text;
begin
  -- Ce qui dit QUOI ne bouge plus.
  new.id := old.id;
  new.cree_le := old.cree_le;
  new.demandeur_id := old.demandeur_id;
  new.destinataire_id := old.destinataire_id;
  new.metier := old.metier;
  new.chantier_commune := old.chantier_commune;
  new.chantier_commune_insee := old.chantier_commune_insee;
  new.debut := old.debut;
  new.fin := old.fin;
  new.message := old.message;
  new.expire_le := old.expire_le;

  if new.etat is not distinct from old.etat then
    new.maj_le := now();
    return new;
  end if;

  if old.etat in ('acceptee','refusee','annulee','expiree') then
    raise exception 'cette demande est close, son etat ne change plus';
  end if;

  if auth.uid() is null then
    v_qui := 'systeme';
  elsif auth.uid() = old.destinataire_id then
    v_qui := 'destinataire';
  elsif auth.uid() = old.demandeur_id then
    v_qui := 'demandeur';
  else
    raise exception 'cette demande ne vous concerne pas';
  end if;

  if not ((new.etat = 'vue'      and v_qui = 'destinataire')
       or (new.etat = 'acceptee' and v_qui = 'destinataire')
       or (new.etat = 'refusee'  and v_qui = 'destinataire')
       or (new.etat = 'annulee'  and v_qui = 'demandeur')
       or (new.etat = 'expiree'  and v_qui = 'systeme')) then
    raise exception 'transition refusee : % vers % par le %', old.etat, new.etat, v_qui;
  end if;

  if new.etat = 'vue' then
    new.vue_le := coalesce(old.vue_le, now());
  end if;
  if new.etat in ('acceptee','refusee') then
    new.vue_le := coalesce(old.vue_le, now());
    new.repondu_le := now();
  end if;
  new.maj_le := now();
  return new;
end $$;

drop trigger if exists demandes_avant_maj on public.demandes;
create trigger demandes_avant_maj before update on public.demandes
  for each row execute function public.demandes_avant_maj();

-- ------------------------------------------------ l'expiration, en entretien
--
-- Non accordee a qui que ce soit : elle s'appelle avec la cle de service,
-- depuis une tache planifiee. Tant que cette tache n'existe pas, rien
-- n'expire, et c'est visible plutot que faux.
create or replace function public.expirer_demandes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.demandes
     set etat = 'expiree'
   where etat in ('envoyee','vue')
     and expire_le is not null
     and expire_le < now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.expirer_demandes() from public;

-- ------------------------------------ les coordonnees, apres acceptation
--
-- LE POINT LE PLUS SENSIBLE DU FICHIER, ET LA RAISON POUR LAQUELLE IL EXISTE.
-- Le telephone, le nom de famille et le SIRET ne figurent dans aucune vue
-- publique et dans aucune politique de lecture. Ils ne sortent que d'ici, et
-- seulement si la demande est ACCEPTEE et si l'appelant est l'une des deux
-- parties. Une page qui voudrait les afficher plus tot n'aurait rien a lire :
-- la regle est dans la base, pas dans l'ecran.
--
-- Elle rend les coordonnees de L'AUTRE : chacun voit celles de son confrere,
-- pas les siennes propres, qu'il connait deja.
create or replace function public.coordonnees_confrere(p_demande uuid)
returns table (
  artisan_id   uuid,
  prenom       text,
  nom          text,
  telephone    text,
  denomination text,
  commune      text)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  d public.demandes;
  v_autre uuid;
begin
  if auth.uid() is null then
    raise exception 'aucune session';
  end if;

  select * into d from public.demandes where id = p_demande;
  if d.id is null then
    raise exception 'demande inconnue';
  end if;

  if auth.uid() = d.demandeur_id then
    v_autre := d.destinataire_id;
  elsif auth.uid() = d.destinataire_id then
    v_autre := d.demandeur_id;
  else
    raise exception 'cette demande ne vous concerne pas';
  end if;

  if d.etat <> 'acceptee' then
    raise exception 'les coordonnees ne s ouvrent qu apres acceptation';
  end if;

  return query
    select a.id, a.prenom, a.nom, a.telephone, a.denomination, a.commune
      from public.artisans a
     where a.id = v_autre;
end $$;

revoke all on function public.coordonnees_confrere(uuid) from public;
grant execute on function public.coordonnees_confrere(uuid) to authenticated;


-- ============================================================
-- 4. LES NOTIFICATIONS : une ligne par evenement.
-- ============================================================

-- CE QUE CETTE TABLE EST, ET CE QU'ELLE N'EST PAS. C'est une file d'evenements
-- lue par son seul destinataire, avec un etat lu ou non lu. Ce n'est pas un
-- envoi : aucun service d'envoi d'emails n'est choisi a ce jour, et Supabase
-- n'envoie pas de message arbitraire. La notification existe donc en base et
-- s'affiche dans l'espace ; l'ecran doit dire que le mail ne part pas encore,
-- plutot que de laisser croire le contraire.
--
-- AUCUNE NOTIFICATION NE PORTE DE CRENEAU D'AGENDA. Elles ne parlent que de la
-- demande : ses dates sont celles du chantier propose, connues des deux bouts.

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  cree_le         timestamptz not null default now(),
  destinataire_id uuid not null references public.artisans(id) on delete cascade,
  genre           text not null check (genre in (
                    'demande_recue','demande_acceptee','demande_refusee',
                    'demande_annulee','demande_expiree',
                    'evaluation_a_deposer','evaluation_publiee')),
  demande_id      uuid references public.demandes(id) on delete cascade,
  titre           text not null,
  corps           text,
  lu_le           timestamptz
);

create index if not exists notifications_dest_idx
  on public.notifications (destinataire_id, cree_le desc);
create index if not exists notifications_non_lues_idx
  on public.notifications (destinataire_id, cree_le desc) where lu_le is null;

-- Un evenement ne se notifie qu'une fois par demande et par genre. Sans cet
-- index, une tache d'entretien rejouee deux fois enverrait deux fois la meme
-- invitation, et le compteur de non-lues mentirait.
create unique index if not exists notifications_unicite_idx
  on public.notifications (destinataire_id, genre, demande_id)
  where demande_id is not null;

alter table public.notifications enable row level security;

drop policy if exists "ses notifications" on public.notifications;
create policy "ses notifications" on public.notifications for select to authenticated
  using (destinataire_id = auth.uid());

-- On peut marquer lu, et rien d'autre. Le declencheur ci-dessous gele toutes
-- les autres colonnes : sans lui, cette politique permettrait de reecrire le
-- titre et le corps de sa propre notification, donc de fabriquer une trace.
drop policy if exists "marquer lu" on public.notifications;
create policy "marquer lu" on public.notifications for update to authenticated
  using (destinataire_id = auth.uid())
  with check (destinataire_id = auth.uid());

-- Aucune politique d'insertion ni de suppression : seules les fonctions
-- `security definer` de ce fichier ecrivent ici.

create or replace function public.notifications_avant_maj() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.id := old.id;
  new.cree_le := old.cree_le;
  new.destinataire_id := old.destinataire_id;
  new.genre := old.genre;
  new.demande_id := old.demande_id;
  new.titre := old.titre;
  new.corps := old.corps;
  return new;
end $$;

drop trigger if exists notifications_avant_maj on public.notifications;
create trigger notifications_avant_maj before update on public.notifications
  for each row execute function public.notifications_avant_maj();

-- La porte unique par laquelle une notification entre. Accordee a personne :
-- seules les fonctions declencheuses, qui appartiennent au meme proprietaire,
-- l'appellent.
create or replace function public.notifier(
  p_destinataire uuid, p_genre text, p_demande uuid, p_titre text, p_corps text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (destinataire_id, genre, demande_id, titre, corps)
  values (p_destinataire, p_genre, p_demande, p_titre, p_corps)
  on conflict do nothing;
end $$;

revoke all on function public.notifier(uuid, text, uuid, text, text) from public;

-- --------------------------------- les deux cotes, a chaque changement d'etat
--
-- « Demande envoyée, acceptée ou refusée, avec notification des deux côtés » :
-- le destinataire est prevenu de la demande, le demandeur de la reponse.
create or replace function public.demandes_notifier() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demandeur    text;
  v_destinataire text;
  v_ou           text;
  v_quand        text;
begin
  select coalesce(nullif(btrim(a.prenom), ''), 'Un confrère') into v_demandeur
    from public.artisans a where a.id = new.demandeur_id;
  select coalesce(nullif(btrim(a.prenom), ''), 'Ton confrère') into v_destinataire
    from public.artisans a where a.id = new.destinataire_id;

  v_ou := coalesce(' à ' || nullif(btrim(new.chantier_commune), ''), '');
  v_quand := 'du ' || to_char(new.debut, 'DD/MM/YYYY') || ' au ' || to_char(new.fin, 'DD/MM/YYYY');

  if tg_op = 'INSERT' then
    perform public.notifier(new.destinataire_id, 'demande_recue', new.id,
      'Nouvelle demande de chantier',
      v_demandeur || ' cherche un confrère ' || v_quand || v_ou || '.');
    return null;
  end if;

  if new.etat = old.etat then
    return null;
  end if;

  if new.etat = 'acceptee' then
    perform public.notifier(new.demandeur_id, 'demande_acceptee', new.id,
      'Ta demande est acceptée',
      v_destinataire || ' est partant ' || v_quand || v_ou || '. Ses coordonnées sont maintenant visibles.');
  elsif new.etat = 'refusee' then
    perform public.notifier(new.demandeur_id, 'demande_refusee', new.id,
      'Ta demande est refusée',
      v_destinataire || ' ne peut pas ' || v_quand || '.');
  elsif new.etat = 'annulee' then
    perform public.notifier(new.destinataire_id, 'demande_annulee', new.id,
      'Demande annulée',
      v_demandeur || ' a annulé sa demande ' || v_quand || '.');
  elsif new.etat = 'expiree' then
    perform public.notifier(new.demandeur_id, 'demande_expiree', new.id,
      'Demande sans réponse',
      'Ta demande ' || v_quand || ' est arrivée au début du chantier sans réponse.');
  end if;
  return null;
end $$;

drop trigger if exists demandes_notifier_insert on public.demandes;
create trigger demandes_notifier_insert after insert on public.demandes
  for each row execute function public.demandes_notifier();

drop trigger if exists demandes_notifier_maj on public.demandes;
create trigger demandes_notifier_maj after update of etat on public.demandes
  for each row execute function public.demandes_notifier();

-- ------------------------------------------- l'invitation a noter, en entretien
--
-- POURQUOI LES DEUX SONT INVITES EN MEME TEMPS, ET JAMAIS L'UN A CAUSE DE
-- L'AUTRE. Si l'invitation partait quand le premier a note, le second saurait
-- qu'il a ete note avant de noter : c'est exactement la sequence qu'on veut
-- eviter. L'invitation depend donc de la seule fin du chantier.
-- Non accordee : tache d'entretien, cle de service.
create or replace function public.inviter_evaluations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  v_n integer := 0;
begin
  for d in
    select id, demandeur_id, destinataire_id, fin
      from public.demandes
     where etat = 'acceptee'
       and fin < current_date
  loop
    perform public.notifier(d.demandeur_id, 'evaluation_a_deposer', d.id,
      'Note ton confrère',
      'Le chantier est passé. Ta note porte sur la qualité du travail et le sérieux.');
    perform public.notifier(d.destinataire_id, 'evaluation_a_deposer', d.id,
      'Note ton confrère',
      'Le chantier est passé. Ta note porte sur les délais de paiement et la clarté du chantier.');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke all on function public.inviter_evaluations() from public;


-- ============================================================
-- 5. LA NOTATION A DOUBLE SENS.
-- ============================================================

-- « Chacun note l'autre : la qualité du travail, et les délais de paiement ».
-- La promesse publique est deja ecrite dans aide/index.html : « Un donneur
-- d'ordre qui paie à 90 jours, ça se saura. » Elle impose trois choses au
-- schema, et elles sont ici :
--
--   1. AUCUNE NOTE SANS MISE EN RELATION ACCEPTEE. La note se rattache a une
--      demande, et le declencheur refuse si cette demande n'est pas acceptee.
--      Sans ce lien, n'importe qui note n'importe qui, et la note ne vaut
--      plus rien.
--   2. UNE SEULE NOTE PAR PERSONNE ET PAR MISE EN RELATION : l'unicite est
--      dans la base, pas dans l'ecran.
--   3. LA NOTE NE SE REECRIT PAS. Aucune politique de mise a jour pour les
--      artisans : ni l'auteur ni la cible ne peuvent y revenir. Seul un
--      administrateur peut MASQUER une note, et le masquage est journalise.
--
-- LES DEUX AXES NE SONT PAS LES MEMES DANS LES DEUX SENS, et c'est tout
-- l'interet : celui qui est venu travailler est note sur la qualite, celui
-- qui a fait venir est note sur ses delais de paiement. La contrainte lie
-- l'axe rempli au role de l'auteur : on ne peut pas noter la qualite du
-- travail d'un donneur d'ordre qui n'a pas travaille.

-- Le delai au bout duquel une note se publie meme si l'autre n'a pas repondu.
-- VALEUR A TRANCHER : elle est ici, en un seul endroit, pour qu'un arbitrage
-- coute une ligne et non une migration. 14 jours est une proposition, pas une
-- mesure : aucune source du depot ne la fonde.
create or replace function public.delai_avis() returns interval
language sql immutable as $$ select interval '14 days' $$;

create table if not exists public.evaluations (
  id           uuid primary key default gen_random_uuid(),
  cree_le      timestamptz not null default now(),
  demande_id   uuid not null references public.demandes(id) on delete cascade,
  auteur_id    uuid not null references public.artisans(id) on delete cascade,
  cible_id     uuid not null references public.artisans(id) on delete cascade,
  -- Le role de l'AUTEUR dans la mise en relation, pose par le declencheur a
  -- partir de la demande. Jamais envoye par la page : il se deduit, il ne se
  -- declare pas.
  role_auteur  text not null check (role_auteur in ('demandeur','destinataire')),

  note         integer not null check (note between 1 and 5),
  -- Rempli quand on note celui qui est VENU travailler.
  qualite      integer check (qualite between 1 and 5),
  -- Rempli quand on note celui qui a FAIT VENIR.
  delais_paiement integer check (delais_paiement between 1 and 5),
  commentaire  text,

  -- La date de publication. Tant qu'elle est nulle, la cible ne voit rien.
  publie_le    timestamptz,
  -- La moderation. Une note masquee sort des moyennes publiques sans etre
  -- effacee : effacer, c'est perdre la trace de ce qui a ete modere.
  masquee_le   timestamptz,
  masquee_par  uuid,
  motif_masquage text,

  constraint evaluation_pas_soi_meme check (auteur_id <> cible_id),
  constraint evaluation_commentaire_ok check (commentaire is null or char_length(btrim(commentaire)) <= 1000),
  constraint evaluation_axe_selon_role check (
       (role_auteur = 'demandeur'    and qualite is not null and delais_paiement is null)
    or (role_auteur = 'destinataire' and delais_paiement is not null and qualite is null)),
  unique (demande_id, auteur_id)
);

create index if not exists evaluations_cible_idx  on public.evaluations (cible_id) where publie_le is not null and masquee_le is null;
create index if not exists evaluations_demande_idx on public.evaluations (demande_id);
create index if not exists evaluations_attente_idx on public.evaluations (cree_le) where publie_le is null;

alter table public.evaluations enable row level security;

-- LA LECTURE, ET C'EST LA QUE LE DOUBLE AVEUGLE SE JOUE. L'auteur voit
-- toujours sa propre note. La cible ne la voit QU'UNE FOIS PUBLIEE. Tant que
-- la note n'est pas publiee, elle n'existe pas pour celui qu'elle vise : il ne
-- peut donc ni la lire, ni deviner qu'elle a ete posee.
drop policy if exists "ses evaluations" on public.evaluations;
create policy "ses evaluations" on public.evaluations for select to authenticated
  using (auteur_id = auth.uid()
      or (cible_id = auth.uid() and publie_le is not null and masquee_le is null)
      or public.est_admin());

-- L'ECRITURE : en son propre nom. Le declencheur, qui passe avant ce controle,
-- a deja rempli `auteur_id`, `cible_id` et `role_auteur` a partir de la
-- demande, et refuse si la demande n'est pas acceptee.
drop policy if exists "noter son confrere" on public.evaluations;
create policy "noter son confrere" on public.evaluations for insert to authenticated
  with check (auteur_id = auth.uid());

-- LA MODERATION : un administrateur, et lui seul, peut masquer. Le declencheur
-- de mise a jour gele la note et le commentaire : moderer n'est pas reecrire.
drop policy if exists "moderer une evaluation" on public.evaluations;
create policy "moderer une evaluation" on public.evaluations for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- Aucune politique de suppression : une note ne s'efface pas, elle se masque.

create or replace function public.evaluations_avant_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandes;
begin
  if auth.uid() is null then
    raise exception 'aucune session';
  end if;

  select * into d from public.demandes where id = new.demande_id;
  if d.id is null then
    raise exception 'demande inconnue';
  end if;
  if d.etat <> 'acceptee' then
    raise exception 'une note exige une mise en relation acceptee';
  end if;

  -- LA DERNIERE PORTE DU DOUBLE AVEUGLE, ET ELLE EST INDISPENSABLE.
  -- Tant que les deux n'ont pas note, aucune note n'est publiee : ce test est
  -- donc faux dans le deroulement normal, et il ne gene personne. Il n'est
  -- vrai que dans un seul cas : le delai est passe, la note du premier a ete
  -- publiee, et l'autre la decouvre. S'il pouvait encore noter a ce
  -- moment-la, il ne noterait pas, il repondrait. Le silence ferme donc la
  -- porte : qui n'a pas note dans le delai ne note plus.
  if exists (select 1 from public.evaluations e
              where e.demande_id = new.demande_id
                and e.publie_le is not null) then
    raise exception 'le delai pour noter cette mise en relation est passe';
  end if;

  if auth.uid() = d.demandeur_id then
    new.auteur_id := d.demandeur_id;
    new.cible_id  := d.destinataire_id;
    new.role_auteur := 'demandeur';
  elsif auth.uid() = d.destinataire_id then
    new.auteur_id := d.destinataire_id;
    new.cible_id  := d.demandeur_id;
    new.role_auteur := 'destinataire';
  else
    raise exception 'cette mise en relation ne vous concerne pas';
  end if;

  new.cree_le := now();
  new.publie_le := null;
  new.masquee_le := null;
  new.masquee_par := null;
  new.motif_masquage := null;
  return new;
end $$;

drop trigger if exists evaluations_avant_insert on public.evaluations;
create trigger evaluations_avant_insert before insert on public.evaluations
  for each row execute function public.evaluations_avant_insert();

-- Moderer n'est pas reecrire : tout est gele sauf la publication et le
-- masquage. `masquee_par` est pose par la base, pas par la page.
create or replace function public.evaluations_avant_maj() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.id := old.id;
  new.cree_le := old.cree_le;
  new.demande_id := old.demande_id;
  new.auteur_id := old.auteur_id;
  new.cible_id := old.cible_id;
  new.role_auteur := old.role_auteur;
  new.note := old.note;
  new.qualite := old.qualite;
  new.delais_paiement := old.delais_paiement;
  new.commentaire := old.commentaire;

  if new.masquee_le is distinct from old.masquee_le then
    new.masquee_par := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists evaluations_avant_maj on public.evaluations;
create trigger evaluations_avant_maj before update on public.evaluations
  for each row execute function public.evaluations_avant_maj();

-- LA PUBLICATION QUAND LES DEUX ONT NOTE. Elle publie les DEUX lignes en meme
-- temps : publier d'abord celle qui vient d'arriver donnerait une longueur
-- d'avance a son auteur.
create or replace function public.evaluations_apres_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.evaluations where demande_id = new.demande_id) >= 2 then
    update public.evaluations
       set publie_le = now()
     where demande_id = new.demande_id
       and publie_le is null;
  end if;
  return null;
end $$;

drop trigger if exists evaluations_apres_insert on public.evaluations;
create trigger evaluations_apres_insert after insert on public.evaluations
  for each row execute function public.evaluations_apres_insert();

-- LA PUBLICATION AU BOUT DU DELAI, pour le cas ou l'autre ne note jamais.
-- Sans elle, il suffirait de ne pas noter pour qu'aucune note ne sorte : le
-- silence deviendrait une defense. Tache d'entretien, cle de service.
create or replace function public.publier_evaluations_echues()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.evaluations
     set publie_le = now()
   where publie_le is null
     and masquee_le is null
     and cree_le < now() - public.delai_avis();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.publier_evaluations_echues() from public;

-- La notification de publication part vers la cible, une fois la note figee et
-- donc a l'abri de toute represaille : elle ne peut plus etre modifiee par
-- personne.
create or replace function public.evaluations_publiee() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.publie_le is null and new.publie_le is not null then
    perform public.notifier(new.cible_id, 'evaluation_publiee', new.demande_id,
      'Tu as reçu une note',
      'La note de ton confrère est visible sur ta fiche.');
  end if;
  return null;
end $$;

drop trigger if exists evaluations_publiee on public.evaluations;
create trigger evaluations_publiee after update of publie_le on public.evaluations
  for each row execute function public.evaluations_publiee();

-- ------------------------------------------------- ce que le public voit
--
-- Des moyennes et un compte, jamais un commentaire. Le commentaire libre d'un
-- artisan sur un autre peut contenir n'importe quoi, y compris un numero de
-- telephone ou une mise en cause nominative : il reste lisible par la cible et
-- par l'administration, il n'est pas rendu public par cette migration. C'est
-- un arbitrage, pas une fatalite : l'ouvrir demandera une regle de moderation
-- ecrite, et elle n'existe pas encore.
--
-- Avec une seule note publiee, la moyenne EST la note. C'est assume : c'est le
-- principe meme d'une note publique.
create or replace view public.notes_publiques
with (security_invoker = off) as
  select e.cible_id,
         round(avg(e.note)::numeric, 1)            as moyenne,
         count(*)                                  as nombre,
         round(avg(e.qualite)::numeric, 1)         as moyenne_qualite,
         round(avg(e.delais_paiement)::numeric, 1) as moyenne_delais
    from public.evaluations e
   where e.publie_le is not null
     and e.masquee_le is null
   group by e.cible_id;

grant select on public.notes_publiques to anon, authenticated;


-- ============================================================
-- 6. LE JOURNAL D'AUDIT.
-- ============================================================

-- CE QU'IL GARDE, ET POURQUOI IL N'A PAS DE CLE ETRANGERE.
-- Les demandes et les notes disparaissent avec le compte de l'un des deux
-- bouts (cascade sur `artisans`). C'est necessaire, et c'est aussi une porte :
-- supprimer son compte efface les notes recues. Le journal, lui, ne porte
-- AUCUNE cle etrangere vers `artisans` : `acteur_id` est un simple uuid. Il
-- survit donc a la suppression, et c'est le seul endroit ou la trace reste.
--
-- IL NE SE LIT QUE PAR UN ADMINISTRATEUR, et il ne s'ecrit que par les
-- declencheurs de ce fichier : aucune politique d'insertion, de mise a jour ni
-- de suppression n'existe. Un journal qu'on peut reecrire n'est pas un journal.

create table if not exists public.journal (
  id          bigserial primary key,
  quand       timestamptz not null default now(),
  acteur_id   uuid,
  action      text not null,
  table_cible text not null,
  ligne_cible text,
  avant       jsonb,
  apres       jsonb
);
create index if not exists journal_quand_idx  on public.journal (quand desc);
create index if not exists journal_acteur_idx on public.journal (acteur_id, quand desc);
create index if not exists journal_cible_idx  on public.journal (table_cible, ligne_cible);

alter table public.journal enable row level security;

drop policy if exists "journal lisible par admin" on public.journal;
create policy "journal lisible par admin" on public.journal for select to authenticated
  using (public.est_admin());

create or replace function public.journaliser(
  p_action text, p_table text, p_ligne text, p_avant jsonb, p_apres jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.journal (acteur_id, action, table_cible, ligne_cible, avant, apres)
  values (auth.uid(), p_action, p_table, p_ligne, p_avant, p_apres);
end $$;

revoke all on function public.journaliser(text, text, text, jsonb, jsonb) from public;

-- Les demandes : l'envoi et chaque changement d'etat. On ne journalise que les
-- colonnes d'etat, pas le message : le journal n'a pas a redoubler le contenu.
create or replace function public.demandes_journal() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.journaliser('demande.envoi', 'demandes', new.id::text, null,
      jsonb_build_object('demandeur', new.demandeur_id, 'destinataire', new.destinataire_id,
                         'debut', new.debut, 'fin', new.fin, 'etat', new.etat));
  elsif new.etat is distinct from old.etat then
    perform public.journaliser('demande.' || new.etat, 'demandes', new.id::text,
      jsonb_build_object('etat', old.etat),
      jsonb_build_object('etat', new.etat, 'motif', new.motif));
  end if;
  return null;
end $$;

drop trigger if exists demandes_journal_insert on public.demandes;
create trigger demandes_journal_insert after insert on public.demandes
  for each row execute function public.demandes_journal();

drop trigger if exists demandes_journal_maj on public.demandes;
create trigger demandes_journal_maj after update of etat on public.demandes
  for each row execute function public.demandes_journal();

-- Les notes : le depot, la publication et le masquage. Le masquage est l'acte
-- d'administration le plus sensible du produit : il retire une note publique.
create or replace function public.evaluations_journal() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.journaliser('evaluation.depot', 'evaluations', new.id::text, null,
      jsonb_build_object('demande', new.demande_id, 'cible', new.cible_id, 'role', new.role_auteur));
  elsif old.masquee_le is null and new.masquee_le is not null then
    perform public.journaliser('evaluation.masquage', 'evaluations', new.id::text,
      jsonb_build_object('publie_le', old.publie_le),
      jsonb_build_object('masquee_par', new.masquee_par, 'motif', new.motif_masquage));
  elsif old.publie_le is null and new.publie_le is not null then
    perform public.journaliser('evaluation.publication', 'evaluations', new.id::text, null,
      jsonb_build_object('cible', new.cible_id));
  end if;
  return null;
end $$;

drop trigger if exists evaluations_journal_insert on public.evaluations;
create trigger evaluations_journal_insert after insert on public.evaluations
  for each row execute function public.evaluations_journal();

drop trigger if exists evaluations_journal_maj on public.evaluations;
create trigger evaluations_journal_maj after update on public.evaluations
  for each row execute function public.evaluations_journal();

-- La publication et le retrait d'une fiche : c'est ce qu'un back office aura a
-- retrouver quand un artisan dira « je n'ai jamais retire ma fiche ». Aucune
-- donnee personnelle n'entre dans le journal : seulement le drapeau.
create or replace function public.artisans_journal() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.journaliser(
    case when new.publie then 'fiche.publication' else 'fiche.retrait' end,
    'artisans', new.id::text,
    jsonb_build_object('publie', old.publie),
    jsonb_build_object('publie', new.publie));
  return null;
end $$;

drop trigger if exists artisans_journal on public.artisans;
create trigger artisans_journal after update on public.artisans
  for each row when (old.publie is distinct from new.publie)
  execute function public.artisans_journal();


-- ============================================================
-- CE QUI RESTE A FAIRE HORS DE CE FICHIER :
--
--   1. CHARGER LA TABLE `communes`. Sans elle, tout artisan dont l'annuaire
--      masque l'adresse (statut_diffusion = P, le cas de la cible) n'a aucune
--      position, et n'apparait dans AUCUNE recherche par rayon. La source est
--      ouverte, sans compte ni cle :
--        https://geo.api.gouv.fr/communes?fields=code,nom,centre,codeDepartement&format=json
--      Mesure du 13/09/2026 : 34 969 lignes, 4 125 546 octets, zero commune
--      sans centre. Le chargement ecrit code_insee, nom, nom_norme (minuscules
--      sans accents, tirets en espaces), departement, latitude (centre[1]),
--      longitude (centre[0]), en `on conflict (code_insee) do update`.
--      ATTENTION : centre.coordinates est [longitude, latitude], dans cet
--      ordre. L'inverser met tous les artisans en Somalie sans aucune erreur.
--
--   2. ECRIRE `commune_insee` DEPUIS espace/index.html. La page ne stocke
--      aujourd'hui que `commune` (le libelle) et `code_postal`. Le code INSEE
--      est dans la reponse de l'annuaire : `matching_etablissements[0].commune`,
--      repli sur `siege.commune`. Et quand `statut_diffusion` vaut O, ecrire
--      aussi latitude et longitude. Ne JAMAIS envoyer la chaine
--      « [NON-DIFFUSIBLE] » : les colonnes sont en double precision, elles la
--      refusent, mais le message d'erreur ne sera pas comprehensible.
--
--   3. OUVRIR LE DROIT D'ENVOYER UNE DEMANDE, ET TRANCHER QUELLE GARDE FAIT
--      FOI. `peut_demander()` interroge `acces_artisan(uuid)` si le chantier
--      des abonnements est joue, sinon les deux dates de `artisans`. Dans les
--      deux cas, elle rend false pour tout le monde aujourd'hui : mesure du
--      13/09/2026, aucune page n'ecrit `essai_jusqu_au` ni `abonne_jusqu_au`,
--      et aucune n'ouvre d'abonnement. La duree de l'essai est un arbitrage
--      commercial, pas un prix : elle se pose sans attendre le tarif. Tant
--      qu'elle n'est pas posee, l'ecran doit dire que l'envoi n'est pas encore
--      ouvert, et le bouton rester eteint. Deux gardes pour une meme question,
--      c'est une de trop : a supprimer des que l'une des deux est retenue.
--
--   4. CHOISIR LE SERVICE D'ENVOI D'EMAILS. Les notifications existent en
--      base, l'envoi n'existe pas. C'est le meme blocage que la double
--      confirmation de la liste d'attente. L'ecran doit dire que rien ne part
--      encore par mail.
--
--   5. PROGRAMMER LES TROIS TACHES D'ENTRETIEN, avec la cle de service (pg_cron
--      ou un appel planifie) : `expirer_demandes()`, `inviter_evaluations()`,
--      `publier_evaluations_echues()`. Aucune n'est accordee a un compte
--      artisan. Tant qu'elles ne tournent pas, rien n'expire et aucune note ne
--      se publie au bout du delai : c'est visible, ce n'est pas faux.
--
--   6. TRANCHER `delai_avis()` (14 jours proposes, sans source) et decider si
--      les commentaires libres deviennent publics, ce qui suppose une regle de
--      moderation ecrite.
--
--   7. LES POLITIQUES D'ADMINISTRATION SUR LES QUATRE TABLES DE L'ESPACE
--      ARTISAN (`artisans`, `artisan_atouts`, `agendas`, `occupations`) :
--      elles n'existent pas, la seule politique posee est « sa fiche » en
--      id = auth.uid(). Un administrateur ne peut donc lire aucune fiche. Ce
--      fichier n'y touche pas volontairement : c'est une migration a part,
--      celle du back office, et elle devra reutiliser `est_admin()`.
--
--   8. LA FUITE MESUREE, ET ELLE EST PRIORITAIRE. Le declencheur `creer_profil`
--      cree un `profils` actif pour CHAQUE compte `auth.users`, y compris un
--      compte artisan. Or les politiques de `contacts` (est_actif()) et de
--      `inscriptions` (lecture par les comptes, using true) ne distinguent pas
--      un artisan d'un membre de l'equipe. Le jour ou les inscriptions sont
--      ouvertes, un artisan lit le CRM et la liste d'attente en entier. A
--      regler AVANT l'ouverture, et hors de ce fichier.
--
--   9. VERIFIER AVEC DEUX COMPTES REELS, jamais par lecture du code :
--      qu'un artisan ne voit pas les demandes des autres, que les coordonnees
--      restent fermees tant que la demande n'est pas acceptee, et qu'une note
--      posee reste invisible pour celui qu'elle vise tant que l'autre n'a pas
--      note.
-- ============================================================

-- ------------------------------------------------------------ controles
-- select * from public.etat_recherche();
-- select count(*) as communes from public.communes;
-- select id, prenom, commune, commune_insee, latitude, longitude, position_source
--   from public.artisans where publie;
-- select public.distance_km(45.6943, 5.9035, 48.8732, 2.3111) as aix_paris_km;
-- select etat, count(*) from public.demandes group by etat order by 2 desc;
-- select metier, commune_insee, count(*) as recherches_sans_resultat
--   from public.recherches where nb_resultats = 0 group by 1, 2 order by 3 desc;
-- select cible_id, moyenne, nombre from public.notes_publiques order by nombre desc;
-- select quand, action, table_cible, ligne_cible from public.journal order by quand desc limit 50;
