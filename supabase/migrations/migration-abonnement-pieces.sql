-- ============================================================
-- L'ARGENT ET LES PIECES : abonnement, paiements, factures, relances,
-- parrainage, et les documents qui prouvent qu'une entreprise est en regle.
--
-- PERIMETRE, ET IL FAUT LE SAVOIR AVANT DE LIRE. Ce fichier couvre des lignes
-- des DEUX devis, comme migration-espace-artisan.sql avant lui :
--   . devis N°20260910-1 du 10/09/2026, SIGNE, lot « Les abonnements » :
--     le module de paiement en ligne avec essai gratuit et factures (1,5 j),
--     les relances en cas d'echec de paiement (0,5 j), le parrainage par codes
--     et mois offerts (1 j), et le changement de date de prelevement par
--     l'abonne lui-meme (0,5 j) ;
--   . devis 2027-02 du 13/09/2026, NON SIGNE, ligne « Fiche entreprise :
--     metiers, materiel, diplomes, depot des justificatifs » (2 j) : la moitie
--     « justificatifs », qui n'existait nulle part. Mesure du 13/09/2026 :
--     aucune occurrence de bucket ni de storage dans tout le depot, et
--     artisans.photo_url est la seule colonne de fichier, sans ecran qui
--     l'alimente.
--
-- AUCUN MONTANT N'EST ECRIT DANS CE FICHIER. Pas une valeur par defaut, pas un
-- exemple, pas un chiffre en commentaire. Le prix de l'abonnement n'est pas
-- arrete, il est attendu de Claire-Marie, et les deux ecrans deja en ligne le
-- disent deja (espace/index.html ligne 540 : « Le tarif est en cours
-- d'arbitrage », aide/index.html ligne 212). Les lignes de devis citees
-- ci-dessus sont reduites a leur nombre de jours pour la meme raison.
-- Consequence directe, et c'est volontaire : la table `reglages` ci-dessous
-- NE CONTIENT AUCUNE CLE DE PRIX, et il ne faut pas en ajouter une. Le prix
-- vivra chez le prestataire de paiement, seule source qui compte au moment de
-- debiter. Le doubler ici creerait deux verites, et deux verites divergent.
--
-- CE QUI GOUVERNE TOUT LE FICHIER : RIEN DE CE QUI TOUCHE A L'ARGENT N'EST
-- ECRIVABLE DEPUIS UN NAVIGATEUR. Ce n'est pas une convention, c'est le
-- schema. Les tables `abonnements`, `paiements`, `factures`,
-- `evenements_paiement`, `relances_paiement`, `facture_compteurs`,
-- `parrainages` et `codes_parrainage` portent la securite par ligne et AUCUNE
-- politique d'insertion, de modification ou de suppression pour `anon` ni pour
-- `authenticated`. En securite par ligne Postgres, l'absence de politique est
-- une porte fermee, exactement comme pour `agenda_secrets` : ce n'est pas un
-- oubli, c'est le procede. Seules les fonctions serveur, appelees avec la cle
-- de service qui ne quitte jamais le serveur, ecrivent ces tables.
--
-- LES TROIS SEULES PORTES OUVERTES AU NAVIGATEUR, et pourquoi elles ne
-- peuvent rien donner :
--   1. `ouvrir_mon_essai()` cree l'essai, une seule fois, pour soi, et refuse
--      si l'artisan a deja eu un abonnement : elle ne peut donc pas servir a
--      se rendre un essai deja consomme.
--   2. `demander_resiliation()` et `annuler_resiliation()` ne touchent que la
--      date de fin demandee, jamais l'etat, jamais la periode payee, jamais un
--      montant : elles ne peuvent que FERMER un acces, ou defaire cette
--      demande avant qu'elle prenne effet. Elles existent parce que l'ecran
--      promet deja « Tu peux arreter depuis ton espace, sans nous ecrire »
--      (espace/index.html ligne 534).
--   3. `enregistrer_parrainage(code)` ne cree qu'une ligne en attente : la
--      recompense n'est ecrite qu'a la validation, par le serveur.
--
-- L'ARGENT SE COMPTE EN CENTIMES ENTIERS, JAMAIS EN NOMBRE A VIRGULE. Un
-- `numeric` conviendrait, un `double precision` non, et melanger les deux dans
-- une meme chaine de calcul finit toujours par produire un centime d'ecart que
-- personne ne sait expliquer. Toutes les colonnes de montant sont des `bigint`
-- en centimes, et leur nom le dit : `montant_ht_cents`.
--
-- LES PRIX SONT HORS TAXES. C'est la colonne `montant_ht_cents` qui porte la
-- valeur de reference partout ; la TVA est une colonne separee, et le TTC est
-- une colonne calculee par la base pour qu'il ne puisse pas diverger. Le taux
-- et la mention legale ne sont ecrits nulle part en dur : le regime de TVA
-- applicable n'est pas tranche et releve du comptable, pas de nous.
--
-- Rejouable sans risque : tout est en `if not exists` / `or replace`, avec un
-- `drop policy if exists` devant chaque politique. Aucun `drop table`, aucun
-- `delete`, aucune colonne supprimee.
-- ============================================================


-- ============================================================
-- 1. LES REGLAGES
--
-- Les nombres qui relevent d'une decision commerciale et non du code. Ils
-- vivent en base plutot qu'en dur pour une raison simple : le jour ou ils
-- changent, on ne veut ni migration ni mise en ligne, et surtout on veut
-- qu'un ecran puisse DIRE qu'un reglage n'est pas encore arrete au lieu
-- d'afficher un nombre invente.
--
-- La ligne existe donc meme quand la valeur est inconnue : `valeur` est alors
-- nulle, et c'est exactement ce que la page doit montrer. C'est la meme regle
-- que les cartes eteintes de l'ecran agenda, qui nomment la piece manquante.
-- ============================================================

create table if not exists public.reglages (
  cle     text primary key,
  valeur  integer,
  qui     text,          -- qui tranche cette valeur, en clair
  note    text,          -- d'ou vient la valeur, ou pourquoi elle manque
  maj_le  timestamptz not null default now()
);

-- Seule cle deja tranchee : la duree de l'essai. Elle n'est pas inventee ici,
-- elle est relevee sur un ecran deja en ligne (espace/index.html ligne 534 :
-- « Le premier mois est offert, sans engagement »).
insert into public.reglages (cle, valeur, qui, note) values
  ('essai_mois', 1, 'Arrete',
   'Mesure du 13/09/2026 : espace/index.html ligne 534 annonce deja le premier mois offert.'),
  ('parrainage_mois_parrain', null, 'Claire-Marie',
   'Nombre de mois offerts au parrain. Non arrete : la recompense depend du prix, qui ne l''est pas.'),
  ('parrainage_mois_filleul', null, 'Claire-Marie',
   'Nombre de mois offerts au filleul. Non arrete, meme raison.')
on conflict (cle) do nothing;

comment on table public.reglages is
  'Parametres commerciaux. AUCUNE cle de prix ici : le prix vit chez le prestataire de paiement.';

alter table public.reglages enable row level security;

-- Lecture par les comptes connectes : c'est ce qui permet a l'espace d'ecrire
-- « le parrainage n'est pas encore ouvert » plutot que d'afficher un bouton
-- mort. Aucune ecriture, pour personne : ces valeurs se changent au tableau de
-- bord Supabase, avec la cle de service.
drop policy if exists "reglages lisibles par les comptes" on public.reglages;
create policy "reglages lisibles par les comptes"
  on public.reglages for select to authenticated using (true);

-- Lit un reglage. Renvoie null quand il n'est pas arrete, et c'est une
-- reponse, pas une panne : l'appelant doit le dire a l'ecran.
create or replace function public.reglage(p_cle text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select valeur from public.reglages where cle = p_cle
$$;

revoke all on function public.reglage(text) from public;
grant execute on function public.reglage(text) to authenticated, service_role;


-- ============================================================
-- 2. LES PIECES JUSTIFICATIVES
--
-- CE QUI EST EN JEU. Un extrait d'immatriculation, une attestation
-- d'assurance, une attestation de vigilance : ces documents portent le nom, le
-- numero de compte parfois, l'adresse du domicile souvent. Ils ne doivent
-- JAMAIS etre lisibles par un autre artisan, ni par un lien public, ni par un
-- moteur de recherche. Deux verrous, pas un :
--   . le FICHIER vit dans un bucket Supabase Storage PRIVE, ou chaque artisan
--     ne peut lire que le dossier qui porte son propre identifiant ;
--   . la LIGNE de cette table n'est lisible que par son proprietaire et par un
--     administrateur.
-- Perdre un des deux ne suffit pas a faire fuiter : le chemin sans le droit de
-- lecture ne donne rien, et le droit de lecture sans le chemin non plus.
--
-- UNE ASSURANCE EXPIREE N'EST PAS UNE ASSURANCE. C'est la raison d'etre de
-- `valide_au`. Une piece ne vaut que si elle est acceptee ET encore valable a
-- la date du jour. Ce calcul ne peut pas vivre dans une contrainte (`check` ne
-- supporte pas `current_date`, qui n'est pas immuable) : il vit dans la vue
-- `mes_pieces` et dans la fonction `marquer_pieces_expirees()`.
--
-- CE QUE L'ARTISAN PEUT FAIRE, ET CE QU'IL NE PEUT PAS. Il depose, il relit,
-- et il supprime tant que personne n'a encore regarde. Il ne peut PAS modifier
-- l'etat de verification : un controle qu'on s'accorde a soi-meme ne vaut
-- rien. Une date mal saisie se corrige en supprimant et en redeposant, ce qui
-- reste possible tant que la piece est a l'etat « deposee ».
--
-- ATTENTION, POINT DE DROIT NON TRANCHE. La liste `genre` ci-dessous est un
-- contenant, PAS la liste des documents legalement exigibles. Cette liste est
-- marquee « a valider par l'avocat » dans aide/index.html et n'est publiable
-- nulle part en l'etat. Ne la presentez pas a l'ecran comme une obligation.
-- ============================================================

create table if not exists public.pieces (
  id            uuid primary key default gen_random_uuid(),
  artisan_id    uuid not null references public.artisans(id) on delete cascade,

  genre         text not null check (genre in (
                  'immatriculation',       -- extrait d'immatriculation
                  'assurance_decennale',
                  'assurance_rc_pro',      -- responsabilite civile professionnelle
                  'vigilance_urssaf',      -- attestation de vigilance
                  'habilitation',          -- CACES, habilitation electrique, etc.
                  'autre')),

  -- Le chemin dans le bucket prive `pieces`. Il COMMENCE toujours par
  -- l'identifiant du compte, et la politique d'insertion l'exige : sans cette
  -- regle, une ligne pourrait pointer vers le fichier d'un autre.
  chemin        text not null unique,
  nom_origine   text,
  taille_octets bigint check (taille_octets is null or taille_octets > 0),
  type_mime     text,
  depose_le     timestamptz not null default now(),

  -- La periode de validite, declaree au depot puis confirmee au controle.
  valide_du     date,
  valide_au     date,

  etat          text not null default 'deposee'
                check (etat in ('deposee','en_controle','acceptee','refusee','expiree')),
  controle_par  uuid references auth.users(id) on delete set null,
  controle_le   timestamptz,
  motif_refus   text,

  constraint chemin_sous_son_dossier check (chemin like '%/%'),
  constraint validite_ordonnee check (
    valide_du is null or valide_au is null or valide_au >= valide_du),
  -- Un refus sans motif est un refus qu'on ne peut pas contester : l'artisan
  -- doit savoir quoi redeposer.
  constraint refus_motive check (etat <> 'refusee' or char_length(btrim(coalesce(motif_refus,''))) >= 3)
);

create index if not exists pieces_artisan_idx    on public.pieces (artisan_id, genre);
-- Les deux lectures reellement faites : ce qui attend un controle, et ce qui
-- va expirer. Les poser maintenant coute une seconde.
create index if not exists pieces_a_controler_idx on public.pieces (depose_le)
  where etat in ('deposee','en_controle');
create index if not exists pieces_expiration_idx  on public.pieces (valide_au)
  where etat = 'acceptee';

comment on column public.pieces.chemin is
  'Chemin dans le bucket prive `pieces`, toujours prefixe par l''identifiant du compte.';
comment on column public.pieces.valide_au is
  'Date d''expiration du document. Passee cette date, la piece ne prouve plus rien.';

-- ------------------------------------------------------- les autorisations

alter table public.pieces enable row level security;

drop policy if exists "ses pieces en lecture" on public.pieces;
create policy "ses pieces en lecture"
  on public.pieces for select to authenticated
  using (artisan_id = auth.uid());

-- DEPOT. La clause `with check` fait tout le travail de confiance : elle
-- impose le proprietaire, elle impose l'etat de depart, elle interdit de
-- s'attribuer un controle, et elle exige que le chemin soit dans le dossier de
-- l'appelant. Aucune de ces quatre regles ne depend du code de la page.
drop policy if exists "depot de ses pieces" on public.pieces;
create policy "depot de ses pieces"
  on public.pieces for insert to authenticated
  with check (
    artisan_id = auth.uid()
    and etat = 'deposee'
    and controle_par is null
    and controle_le is null
    and motif_refus is null
    and chemin like auth.uid()::text || '/%');

-- SUPPRESSION, uniquement tant que personne n'a regarde. Apres un controle, la
-- piece est une trace : elle ne s'efface plus depuis un navigateur.
drop policy if exists "retrait de ses pieces non controlees" on public.pieces;
create policy "retrait de ses pieces non controlees"
  on public.pieces for delete to authenticated
  using (artisan_id = auth.uid() and etat = 'deposee');

-- MODIFICATION : aucune politique pour l'artisan. Donc aucune. Seul un
-- administrateur controle, et `est_admin()` vient de migration-admin.sql : on
-- ne cree pas un second mecanisme de role.
--
-- NOTE IMPORTANTE SUR LE CHOIX DE LA GARDE. On utilise `est_admin()` et
-- surtout PAS `est_actif()`, qui vaut vrai pour n'importe quel compte, artisan
-- compris, des lors qu'un profil existe. `est_admin()` exige le drapeau
-- `admin`, qui ne se pose qu'au tableau de bord Supabase.
drop policy if exists "pieces lues par l administration" on public.pieces;
create policy "pieces lues par l administration"
  on public.pieces for select to authenticated
  using (public.est_admin());

drop policy if exists "pieces controlees par l administration" on public.pieces;
create policy "pieces controlees par l administration"
  on public.pieces for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- Qui a controle, et quand : pose par la base, pas par le code du back office.
-- Un champ d'audit tenu par le code finit toujours par etre oublie quelque
-- part, et c'est precisement le champ qu'on relira le jour d'un litige.
create or replace function public.pieces_controle() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.etat is distinct from old.etat then
    new.controle_le  := now();
    new.controle_par := auth.uid();
  end if;
  -- Le proprietaire et le fichier ne bougent jamais apres le depot : changer
  -- l'un des deux reviendrait a accepter un document et a le remplacer ensuite.
  new.artisan_id := old.artisan_id;
  new.chemin     := old.chemin;
  return new;
end $$;

drop trigger if exists pieces_controle on public.pieces;
create trigger pieces_controle before update on public.pieces
  for each row execute function public.pieces_controle();

-- ------------------------------------------------------- le rangement des fichiers
--
-- LE BUCKET. Prive, et le `do update` ci-dessous n'est pas une coquetterie :
-- si le bucket existait deja en public, un simple `do nothing` laisserait le
-- trou ouvert au rejeu. Ici, chaque rejeu REFERME. C'est le seul endroit du
-- fichier ou l'on s'ecarte du `do nothing`, et c'est pour une raison de
-- securite, pas de confort.
--
-- La taille limite n'est pas une mesure, c'est un garde-fou assume : un
-- document scanne ou photographie au telephone tient tres largement dessous,
-- et au-dela c'est presque toujours une erreur de depot ou une video.

insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
values ('pieces', 'pieces', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/heic','image/heif'])
on conflict (id) do update
  set "public"           = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bucket des factures au format PDF. Prive lui aussi, et en LECTURE SEULE pour
-- l'abonne : une facture ne se depose pas depuis un navigateur, elle est
-- ecrite par le serveur.
insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
values ('factures', 'factures', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set "public"           = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- LA REGLE DU DOSSIER. Le premier segment du chemin est l'identifiant du
-- compte : `<identifiant>/<nom du fichier>`. `storage.foldername(name)` rend
-- ce segment, et la comparaison avec `auth.uid()` fait tout le cloisonnement.
-- Un artisan qui devine le chemin d'un autre ne recoit rien.

drop policy if exists "pieces depot par son proprietaire" on storage.objects;
create policy "pieces depot par son proprietaire"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'pieces'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pieces lues par son proprietaire" on storage.objects;
create policy "pieces lues par son proprietaire"
  on storage.objects for select to authenticated
  using (bucket_id = 'pieces'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pieces retirees par son proprietaire" on storage.objects;
create policy "pieces retirees par son proprietaire"
  on storage.objects for delete to authenticated
  using (bucket_id = 'pieces'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pieces lues par l administration" on storage.objects;
create policy "pieces lues par l administration"
  on storage.objects for select to authenticated
  using (bucket_id = 'pieces' and public.est_admin());

drop policy if exists "factures lues par son proprietaire" on storage.objects;
create policy "factures lues par son proprietaire"
  on storage.objects for select to authenticated
  using (bucket_id = 'factures'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- Aucune politique d'insertion ni de suppression sur le bucket `factures` :
-- personne n'y ecrit depuis un navigateur.

-- ------------------------------------------------------- ce que l artisan voit
--
-- `security_invoker = on`, a l'inverse de `fiches_publiques` qui est en `off`.
-- La difference est voulue : `fiches_publiques` doit contourner la securite
-- par ligne pour exposer des colonnes choisies au public, alors que cette vue
-- ci doit au contraire l'appliquer, puisqu'elle ne sert qu'a montrer a chacun
-- ses propres pieces.

create or replace view public.mes_pieces
with (security_invoker = on) as
  select p.id,
         p.genre,
         p.nom_origine,
         p.taille_octets,
         p.depose_le,
         p.valide_du,
         p.valide_au,
         p.etat,
         p.motif_refus,
         -- Le seul booleen qui compte : cette piece prouve-t-elle quelque
         -- chose AUJOURD'HUI ?
         (p.etat = 'acceptee'
          and (p.valide_au is null or p.valide_au >= current_date)) as valable,
         case when p.valide_au is null then null
              else (p.valide_au - current_date) end as jours_restants,
         -- La piece en vigueur pour ce genre : la plus recemment acceptee.
         -- Sans ce rang, un ecran afficherait cote a cote l'assurance de
         -- l'an dernier et celle de cette annee, sans dire laquelle vaut.
         (row_number() over (
            partition by p.artisan_id, p.genre
            order by (p.etat = 'acceptee') desc, p.valide_au desc nulls last, p.depose_le desc)
          = 1) as en_vigueur
    from public.pieces p;

grant select on public.mes_pieces to authenticated;

-- Passe en « expiree » ce qui a cesse de prouver quelque chose. Idempotente :
-- une seconde execution le meme jour ne touche plus rien, puisque les lignes
-- ne sont plus a l'etat « acceptee ».
create or replace function public.marquer_pieces_expirees()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touche integer;
begin
  update public.pieces
     set etat = 'expiree'
   where etat = 'acceptee'
     and valide_au is not null
     and valide_au < current_date;
  get diagnostics touche = row_count;
  return touche;
end $$;

revoke all on function public.marquer_pieces_expirees() from public;
grant execute on function public.marquer_pieces_expirees() to service_role;


-- ============================================================
-- 3. L'ABONNEMENT
--
-- LA LISTE DES ETATS EST FERMEE DEUX FOIS. Une contrainte `check` la ferme
-- pour de bon : ajouter un etat demandera une migration, et c'est voulu, parce
-- qu'un etat nouveau change ce que l'application autorise. Une table de
-- reference porte a cote ce que chaque etat DONNE : le niveau d'acces, la
-- visibilite de la fiche, et la phrase montree a l'artisan. Le comportement
-- devient ainsi une donnee lisible par les pages, et non un `switch` recopie
-- dans chaque ecran, qui finirait par diverger d'un ecran a l'autre.
--
-- POURQUOI UNE TABLE SEPAREE ET PAS DES COLONNES SUR `artisans`. La table
-- `artisans` porte deja `formule`, `essai_jusqu_au` et `abonne_jusqu_au`.
-- Mesure du 13/09/2026 : AUCUNE page du depot ne lit ces trois colonnes (zero
-- occurrence dans les sources HTML). On ne les supprime pas, rien n'est
-- destructif ici, mais la verite passe dans `abonnements`, pour une raison de
-- fond : un abonnement a une histoire (un essai, une periode, une resiliation,
-- une reprise), et une histoire ne tient pas dans trois colonnes ecrasees a
-- chaque evenement. `appliquer_abonnement()` recopie malgre tout les deux
-- dates sur `artisans`, pour qu'un ecran qui les lirait un jour ne mente pas.
-- ============================================================

create table if not exists public.abonnement_etats (
  code          text primary key
                check (code in ('essai','actif','impaye','suspendu','resilie','expire')),
  libelle       text not null,
  -- Ce que l'application fait, en donnee et non en commentaire.
  acces         text not null check (acces in ('complet','lecture','ferme')),
  fiche_publiee boolean not null,
  message       text not null,
  ordre         integer not null default 100
);

insert into public.abonnement_etats (code, libelle, acces, fiche_publiee, message, ordre) values
  ('essai',    'Essai en cours',   'complet', true,
   'Tu es en essai. Rien ne t''est demandé et rien ne te sera prélevé.', 10),
  ('actif',    'Abonnement actif', 'complet', true,
   'Ton abonnement est en cours. Tu as accès à tout.', 20),
  ('impaye',   'Paiement en échec','complet', true,
   'Un paiement n''est pas passé. Ton accès reste ouvert le temps qu''on réessaie.', 30),
  ('suspendu', 'Accès suspendu',   'lecture', false,
   'Ton accès est suspendu. Ta fiche n''est plus visible des autres entreprises.', 40),
  ('resilie',  'Résilié',          'complet', true,
   'Ton abonnement est résilié. Tu gardes l''accès jusqu''à la fin de la période déjà réglée.', 50),
  ('expire',   'Terminé',          'ferme',   false,
   'Ton abonnement est terminé. Ta fiche n''est plus visible des autres entreprises.', 60)
on conflict (code) do update
  set libelle       = excluded.libelle,
      acces         = excluded.acces,
      fiche_publiee = excluded.fiche_publiee,
      message       = excluded.message,
      ordre         = excluded.ordre;

comment on table public.abonnement_etats is
  'Ce que chaque etat de l''abonnement autorise. Source unique pour toutes les pages.';

alter table public.abonnement_etats enable row level security;
drop policy if exists "etats lisibles par les comptes" on public.abonnement_etats;
create policy "etats lisibles par les comptes"
  on public.abonnement_etats for select to authenticated using (true);

create table if not exists public.abonnements (
  id            uuid primary key default gen_random_uuid(),
  artisan_id    uuid not null references public.artisans(id) on delete cascade,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),

  -- La formule reste un texte libre, exactement comme `artisans.formule` :
  -- tant que l'offre n'est pas arretee, une liste fermee serait fausse des la
  -- premiere semaine.
  formule       text,

  etat          text not null default 'essai'
                check (etat in ('essai','actif','impaye','suspendu','resilie','expire'))
                references public.abonnement_etats(code),

  -- L'essai. Aucune duree en dur : elle vient de `reglages.essai_mois`.
  essai_du      date,
  essai_au      date,

  -- LA PERIODE COUVERTE. C'est elle qui repond a la seule question qui compte
  -- pour l'acces : jusqu'a quand est-ce paye ?
  periode_du    timestamptz,
  periode_au    timestamptz,
  prochain_prelevement_le timestamptz,

  -- La resiliation. `resilie_le` est la DEMANDE, `resilie_effet_au` est la
  -- date a laquelle l'acces se ferme vraiment : on ne coupe pas un acces deja
  -- regle.
  resilie_le        timestamptz,
  resilie_effet_au  timestamptz,
  motif_resiliation text,

  -- Le rattachement au prestataire de paiement. Aucun prestataire n'est choisi
  -- a ce jour : la colonne existe, elle reste nulle, et l'ecran le dit.
  prestataire        text,
  reference_externe  text,

  -- L'HORODATAGE DU DERNIER EVENEMENT APPLIQUE. C'est la piece qui rend le
  -- traitement insensible au desordre : voir la section 5.
  evenement_horodatage timestamptz,

  constraint periode_ordonnee check (
    periode_du is null or periode_au is null or periode_au >= periode_du),
  constraint essai_ordonne check (
    essai_du is null or essai_au is null or essai_au >= essai_du)
);

create index if not exists abonnements_artisan_idx on public.abonnements (artisan_id);
create index if not exists abonnements_etat_idx    on public.abonnements (etat);
create index if not exists abonnements_periode_idx on public.abonnements (periode_au);

-- UN SEUL ABONNEMENT VIVANT PAR ARTISAN. L'unicite est partielle : les
-- abonnements termines restent en place, ce qui garde l'historique, mais un
-- artisan ne peut pas avoir deux abonnements en cours en meme temps. Porte par
-- la base, donc vrai meme si deux appels arrivent en meme temps.
create unique index if not exists abonnements_un_vivant_idx
  on public.abonnements (artisan_id)
  where etat in ('essai','actif','impaye','suspendu','resilie');

create unique index if not exists abonnements_reference_idx
  on public.abonnements (prestataire, reference_externe)
  where reference_externe is not null;

comment on column public.abonnements.periode_au is
  'Fin de la periode couverte. C''est elle, et pas l''etat seul, qui ferme l''acces.';

alter table public.abonnements enable row level security;

drop policy if exists "son abonnement" on public.abonnements;
create policy "son abonnement"
  on public.abonnements for select to authenticated
  using (artisan_id = auth.uid());

drop policy if exists "abonnements lus par l administration" on public.abonnements;
create policy "abonnements lus par l administration"
  on public.abonnements for select to authenticated
  using (public.est_admin());

-- AUCUNE politique d'insertion, de modification ni de suppression. Ni pour
-- l'artisan, ni pour l'administrateur. Un abonnement ne se decrete pas depuis
-- une interface : il est le reflet de ce que le prestataire de paiement a
-- constate, et les trois portes ouvertes au navigateur sont nommees en tete de
-- fichier.

create or replace function public.abonnements_touche() returns trigger
language plpgsql as $$
begin new.maj_le = now(); return new; end $$;

drop trigger if exists abonnements_maj on public.abonnements;
create trigger abonnements_maj before update on public.abonnements
  for each row execute function public.abonnements_touche();

-- ------------------------------------------------------- le niveau d acces
--
-- La seule question que les autres ecrans poseront : qu'est-ce que cet artisan
-- a le droit de faire aujourd'hui ? La reponse croise l'etat ET les dates, et
-- elle est ecrite une seule fois ici pour ne pas etre recopiee de travers dans
-- une page de recherche ou de mise en relation.

create or replace function public.acces_artisan(p_artisan uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
             -- La periode reglee est passee : plus rien, quel que soit l'etat.
             when a.periode_au is not null and a.periode_au < now() then 'ferme'
             when a.resilie_effet_au is not null and a.resilie_effet_au < now() then 'ferme'
             when a.etat = 'essai' and a.essai_au is not null and a.essai_au < current_date then 'ferme'
             else e.acces
           end
      from public.abonnements a
      join public.abonnement_etats e on e.code = a.etat
     where a.artisan_id = p_artisan
       and a.etat in ('essai','actif','impaye','suspendu','resilie')
     limit 1), 'ferme')
$$;

revoke all on function public.acces_artisan(uuid) from public;
grant execute on function public.acces_artisan(uuid) to authenticated, service_role;

comment on function public.acces_artisan(uuid) is
  'Rend complet, lecture ou ferme. Ne rend jamais ni montant ni date : seulement un droit.';

-- Ce que l'espace affiche. Vue en `security_invoker = on` : la politique
-- « son abonnement » fait le filtrage, la vue ne fait que joindre le
-- referentiel pour que la page n'ait pas a connaitre les etats.
create or replace view public.mon_abonnement
with (security_invoker = on) as
  select a.id,
         a.formule,
         a.etat,
         e.libelle,
         e.acces,
         e.fiche_publiee,
         e.message,
         a.essai_du,
         a.essai_au,
         a.periode_du,
         a.periode_au,
         a.prochain_prelevement_le,
         a.resilie_le,
         a.resilie_effet_au,
         a.cree_le
    from public.abonnements a
    join public.abonnement_etats e on e.code = a.etat;

grant select on public.mon_abonnement to authenticated;

-- ------------------------------------------------------- ouvrir son essai
--
-- PREMIERE DES TROIS PORTES OUVERTES AU NAVIGATEUR. Elle ne peut rien donner
-- d'autre qu'un essai, une seule fois dans la vie du compte : la condition
-- « aucun abonnement, meme termine » interdit de se refaire un essai apres une
-- resiliation. Meme esprit que `ma_fiche()` : c'est la base qui tranche, pas
-- deux onglets ouverts en meme temps.

create or replace function public.ouvrir_mon_essai()
returns public.abonnements
language plpgsql
security definer
set search_path = public
as $$
declare
  a    public.abonnements;
  mois integer;
begin
  if auth.uid() is null then
    raise exception 'aucune session';
  end if;

  -- On teste `a.id` et non `found` : `found` est remis a jour par la moindre
  -- instruction SQL qui suit, et un jour quelqu'un en glissera une ici.
  select * into a from public.abonnements where artisan_id = auth.uid() limit 1;
  if a.id is not null then
    return a;                       -- deja un abonnement, on rend celui-la
  end if;

  mois := public.reglage('essai_mois');
  if mois is null then
    raise exception 'la duree de l''essai n''est pas arretee';
  end if;

  insert into public.abonnements (artisan_id, etat, essai_du, essai_au)
  values (auth.uid(), 'essai', current_date, current_date + (mois || ' months')::interval)
  on conflict do nothing;

  select * into a from public.abonnements where artisan_id = auth.uid() limit 1;
  return a;
end $$;

revoke all on function public.ouvrir_mon_essai() from public;
grant execute on function public.ouvrir_mon_essai() to authenticated;

-- ------------------------------------------------------- resilier soi-meme
--
-- DEUXIEME ET TROISIEME PORTES. Elles ne touchent QUE la demande de
-- resiliation. Elles ne changent pas l'etat, ne prolongent aucune periode,
-- n'ecrivent aucun montant : elles ne peuvent que fermer un acces, ou defaire
-- cette fermeture tant qu'elle n'a pas pris effet. C'est la contrepartie
-- technique d'une promesse deja affichee : « Tu peux arreter depuis ton
-- espace, sans nous ecrire » (espace/index.html ligne 534).

create or replace function public.demander_resiliation(p_motif text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  touche integer;
begin
  if auth.uid() is null then
    raise exception 'aucune session';
  end if;
  update public.abonnements
     set resilie_le        = now(),
         -- L'acces court jusqu'au bout de ce qui est deja regle. A defaut de
         -- periode connue, jusqu'au bout de l'essai. A defaut des deux,
         -- tout de suite : on ne prolonge rien qu'on ne sait pas justifier.
         resilie_effet_au  = coalesce(periode_au, essai_au::timestamptz, now()),
         motif_resiliation = p_motif
   where artisan_id = auth.uid()
     and resilie_le is null
     and etat in ('essai','actif','impaye','suspendu');
  get diagnostics touche = row_count;
  return touche > 0;
end $$;

create or replace function public.annuler_resiliation()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  touche integer;
begin
  if auth.uid() is null then
    raise exception 'aucune session';
  end if;
  -- Uniquement AVANT la prise d'effet : apres, l'acces est ferme et seul le
  -- prestataire de paiement peut le rouvrir, en reglant. Rouvrir ici serait
  -- donner du service non paye.
  update public.abonnements
     set resilie_le = null, resilie_effet_au = null, motif_resiliation = null
   where artisan_id = auth.uid()
     and resilie_le is not null
     and (resilie_effet_au is null or resilie_effet_au > now());
  get diagnostics touche = row_count;
  return touche > 0;
end $$;

revoke all on function public.demander_resiliation(text) from public;
revoke all on function public.annuler_resiliation() from public;
grant execute on function public.demander_resiliation(text) to authenticated;
grant execute on function public.annuler_resiliation() to authenticated;


-- ============================================================
-- 4. LES PAIEMENTS ET LES FACTURES
--
-- CE QU'IL FAUT GARDER POUR QU'UNE FACTURE SOIT RECONSTITUABLE. Une facture
-- n'est pas une jointure : c'est une PHOTO, prise le jour de l'emission. Si
-- l'artisan change de denomination, demenage ou ferme son entreprise six mois
-- plus tard, la facture ne doit pas bouger d'un caractere. D'ou les colonnes
-- `client_*` recopiees a l'emission plutot que lues dans `artisans`, et d'ou
-- le declencheur qui refuse toute modification apres coup.
--
-- LA NUMEROTATION, ET POURQUOI PAS UNE SEQUENCE POSTGRES. Une sequence n'est
-- pas transactionnelle : elle avance meme quand la transaction echoue, et elle
-- laisse donc des trous. Une numerotation de factures doit etre continue. Le
-- compteur est donc une LIGNE, incrementee dans la meme transaction que la
-- facture : si la facture n'est pas ecrite, le numero est rendu. Le prix a
-- payer est que deux emissions simultanees se mettent en file l'une derriere
-- l'autre sur cette ligne, ce qui, au volume d'une plateforme d'abonnement
-- mensuel, ne se voit pas.
--
-- UNE FACTURE NE SE CORRIGE PAS, ELLE S'ANNULE. D'ou `genre` : une facture, ou
-- un avoir qui pointe vers elle et porte des montants negatifs. La contrainte
-- de signe l'impose.
--
-- JAMAIS DE DONNEE BANCAIRE ICI. Pas de numero de carte, meme partiel au-dela
-- des derniers chiffres rendus par le prestataire, pas de cryptogramme, pas
-- d'IBAN. La page legale l'ecrit deja : aucune donnee bancaire n'est saisie sur
-- le site. Une seule colonne de texte, `moyen`, recopie ce que le prestataire
-- affiche lui-meme sur son recu.
-- ============================================================

create table if not exists public.paiements (
  id              uuid primary key default gen_random_uuid(),
  artisan_id      uuid not null references public.artisans(id) on delete cascade,
  abonnement_id   uuid references public.abonnements(id) on delete set null,

  prestataire     text not null,
  -- L'identifiant du paiement CHEZ LE PRESTATAIRE. C'est la cle qui rend
  -- l'enregistrement rejouable : deux appels pour le meme paiement ne creent
  -- pas deux lignes.
  reference_externe text not null,

  montant_ht_cents  bigint not null check (montant_ht_cents >= 0),
  tva_cents         bigint not null default 0 check (tva_cents >= 0),
  montant_ttc_cents bigint generated always as (montant_ht_cents + tva_cents) stored,
  taux_tva          numeric(5,2) check (taux_tva is null or taux_tva >= 0),
  devise            text not null default 'EUR'
                    check (devise = upper(devise) and char_length(devise) = 3),

  etat            text not null default 'en_attente'
                  check (etat in ('en_attente','reussi','echoue','rembourse','annule')),
  paye_le         timestamptz,
  echec_code      text,
  echec_motif     text,

  -- Ce que le prestataire affiche sur son propre recu, recopie tel quel.
  moyen           text,

  -- La periode que ce paiement couvre : sans elle, une facture ne dit pas ce
  -- qu'elle paie.
  periode_du      timestamptz,
  periode_au      timestamptz,

  cree_le         timestamptz not null default now(),

  unique (prestataire, reference_externe),
  constraint paiement_periode_ordonnee check (
    periode_du is null or periode_au is null or periode_au >= periode_du)
);

create index if not exists paiements_artisan_idx on public.paiements (artisan_id, cree_le desc);
create index if not exists paiements_etat_idx    on public.paiements (etat);

comment on column public.paiements.montant_ht_cents is
  'Montant HORS TAXES, en centimes entiers. C''est la valeur de reference.';
comment on column public.paiements.moyen is
  'Libelle du moyen de paiement recopie du prestataire. Jamais de numero complet, jamais d''IBAN.';

create table if not exists public.factures (
  id              uuid primary key default gen_random_uuid(),

  -- La numerotation, decomposee pour que la continuite soit verifiable d'un
  -- coup d'oeil : un rang manquant se voit.
  serie           text not null,
  annee           integer not null check (annee between 2020 and 2100),
  rang            integer not null check (rang > 0),
  numero          text not null unique,

  genre           text not null default 'facture' check (genre in ('facture','avoir')),
  annule_facture_id uuid references public.factures(id),

  -- LE LIEN EST ROMPU A LA SUPPRESSION DU COMPTE, PAS LA FACTURE. C'est
  -- exactement a quoi sert la photo `client_*` plus bas : le document
  -- comptable survit intact au depart de la personne, et la ligne devient
  -- orpheline donc invisible de tous, sauf de l'administration. Un
  -- `on delete restrict` aurait fait echouer toute suppression de compte, ce
  -- qui contredirait la page legale. Combien de temps on garde ce document
  -- reste une decision d'avocat, deja marquee « A COMPLETER » dans
  -- legal/index.html section 2.4 : ce fichier ne la tranche pas.
  artisan_id      uuid references public.artisans(id) on delete set null,
  abonnement_id   uuid references public.abonnements(id) on delete set null,
  paiement_id     uuid references public.paiements(id) on delete set null,

  emise_le        date not null default current_date,
  periode_du      date,
  periode_au      date,
  libelle_ligne   text not null,

  montant_ht_cents  bigint not null,
  tva_cents         bigint not null default 0,
  montant_ttc_cents bigint generated always as (montant_ht_cents + tva_cents) stored,
  taux_tva          numeric(5,2) not null check (taux_tva >= 0),
  -- La mention legale de TVA. Aucune valeur par defaut : le regime applicable
  -- n'est pas tranche et releve du comptable. La contrainte ci-dessous force
  -- la question au lieu de la laisser passer.
  mention_tva     text,
  devise          text not null default 'EUR'
                  check (devise = upper(devise) and char_length(devise) = 3),

  -- LA PHOTO DU CLIENT AU JOUR DE L'EMISSION. Recopiee, jamais jointe.
  client_denomination text not null,
  client_siret        text check (client_siret is null or client_siret ~ '^[0-9]{14}$'),
  client_adresse      text,
  client_code_postal  text,
  client_commune      text,
  client_email        text,

  -- La photo de l'emetteur, au meme titre. En jsonb parce que l'emetteur n'est
  -- pas arrete : deux documents du depot portent deux emetteurs differents.
  emetteur        jsonb,

  pdf_chemin      text,
  envoyee_le      timestamptz,
  cree_le         timestamptz not null default now(),

  unique (serie, annee, rang),
  constraint avoir_pointe_une_facture check (
    (genre = 'facture' and annule_facture_id is null)
    or (genre = 'avoir' and annule_facture_id is not null)),
  -- Une facture porte des montants positifs, un avoir des montants negatifs.
  constraint signe_selon_le_genre check (
    (genre = 'facture' and montant_ht_cents >= 0 and tva_cents >= 0)
    or (genre = 'avoir' and montant_ht_cents <= 0 and tva_cents <= 0)),
  -- Un taux nul sans mention legale est une facture incomplete.
  constraint mention_si_taux_nul check (
    taux_tva > 0 or char_length(btrim(coalesce(mention_tva,''))) > 0)
);

create index if not exists factures_artisan_idx on public.factures (artisan_id, emise_le desc);
create index if not exists factures_numero_idx  on public.factures (serie, annee, rang);

comment on table public.factures is
  'Photo figee. Les colonnes client_* sont recopiees a l''emission, jamais jointes.';
comment on column public.factures.montant_ht_cents is
  'Montant HORS TAXES, en centimes entiers. Negatif pour un avoir.';

-- LE COMPTEUR DE NUMEROTATION. Aucune politique : personne ne le lit ni ne
-- l'ecrit depuis un navigateur.
create table if not exists public.facture_compteurs (
  serie        text not null,
  annee        integer not null,
  dernier_rang integer not null default 0 check (dernier_rang >= 0),
  primary key (serie, annee)
);

alter table public.paiements         enable row level security;
alter table public.factures          enable row level security;
alter table public.facture_compteurs enable row level security;

drop policy if exists "ses paiements" on public.paiements;
create policy "ses paiements"
  on public.paiements for select to authenticated
  using (artisan_id = auth.uid());

drop policy if exists "paiements lus par l administration" on public.paiements;
create policy "paiements lus par l administration"
  on public.paiements for select to authenticated
  using (public.est_admin());

drop policy if exists "ses factures" on public.factures;
create policy "ses factures"
  on public.factures for select to authenticated
  using (artisan_id = auth.uid());

drop policy if exists "factures lues par l administration" on public.factures;
create policy "factures lues par l administration"
  on public.factures for select to authenticated
  using (public.est_admin());

-- Aucune politique d'ecriture sur les trois tables. Aucune, pour personne.

-- L'IMMUABILITE, ET ELLE S'APPLIQUE AUSSI A LA CLE DE SERVICE. Une politique
-- ne protege pas d'un `update` passe avec la cle de service, qui contourne la
-- securite par ligne. Un DECLENCHEUR, lui, se declenche pour tout le monde.
-- C'est pour cela que la protection des factures est ici et pas dans une
-- politique : elle doit tenir meme contre notre propre code serveur.
create or replace function public.factures_figees() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'une facture ne se supprime pas : emettre un avoir';
  end if;
  if new.numero              is distinct from old.numero
     or new.serie            is distinct from old.serie
     or new.annee            is distinct from old.annee
     or new.rang             is distinct from old.rang
     or new.genre            is distinct from old.genre
     or new.artisan_id       is distinct from old.artisan_id
     or new.emise_le         is distinct from old.emise_le
     or new.libelle_ligne    is distinct from old.libelle_ligne
     or new.montant_ht_cents is distinct from old.montant_ht_cents
     or new.tva_cents        is distinct from old.tva_cents
     or new.taux_tva         is distinct from old.taux_tva
     or new.mention_tva      is distinct from old.mention_tva
     or new.devise           is distinct from old.devise
     or new.client_denomination is distinct from old.client_denomination
     or new.client_siret        is distinct from old.client_siret
     or new.emetteur           is distinct from old.emetteur then
    raise exception 'une facture emise ne se modifie pas : emettre un avoir';
  end if;
  -- Seuls `pdf_chemin` et `envoyee_le` restent mobiles : ils decrivent
  -- l'acheminement du document, pas son contenu.
  return new;
end $$;

drop trigger if exists factures_figees on public.factures;
create trigger factures_figees before update or delete on public.factures
  for each row execute function public.factures_figees();

-- ------------------------------------------------------- ecrire un paiement
--
-- Rejouable : `on conflict` sur la reference du prestataire. Deux appels pour
-- le meme paiement mettent a jour la meme ligne au lieu d'en creer deux.

create or replace function public.enregistrer_paiement(
  p_artisan_id        uuid,
  p_prestataire       text,
  p_reference_externe text,
  p_montant_ht_cents  bigint,
  p_etat              text,
  p_tva_cents         bigint      default 0,
  p_taux_tva          numeric     default null,
  p_abonnement_id     uuid        default null,
  p_paye_le           timestamptz default null,
  p_moyen             text        default null,
  p_periode_du        timestamptz default null,
  p_periode_au        timestamptz default null,
  p_echec_code        text        default null,
  p_echec_motif       text        default null)
returns public.paiements
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.paiements;
begin
  insert into public.paiements (
    artisan_id, abonnement_id, prestataire, reference_externe,
    montant_ht_cents, tva_cents, taux_tva, etat, paye_le, moyen,
    periode_du, periode_au, echec_code, echec_motif)
  values (
    p_artisan_id, p_abonnement_id, p_prestataire, p_reference_externe,
    p_montant_ht_cents, coalesce(p_tva_cents, 0), p_taux_tva, p_etat, p_paye_le, p_moyen,
    p_periode_du, p_periode_au, p_echec_code, p_echec_motif)
  on conflict (prestataire, reference_externe) do update
    set etat        = excluded.etat,
        paye_le     = coalesce(excluded.paye_le, public.paiements.paye_le),
        moyen       = coalesce(excluded.moyen, public.paiements.moyen),
        echec_code  = excluded.echec_code,
        echec_motif = excluded.echec_motif,
        abonnement_id = coalesce(excluded.abonnement_id, public.paiements.abonnement_id)
  returning * into p;
  return p;
end $$;

revoke all on function public.enregistrer_paiement(
  uuid, text, text, bigint, text, bigint, numeric, uuid, timestamptz, text,
  timestamptz, timestamptz, text, text) from public;
grant execute on function public.enregistrer_paiement(
  uuid, text, text, bigint, text, bigint, numeric, uuid, timestamptz, text,
  timestamptz, timestamptz, text, text) to service_role;

-- ------------------------------------------------------- numeroter et emettre

-- Rend le rang suivant de la serie, dans la transaction en cours. La ligne du
-- compteur est verrouillee par l'`update` : deux emissions simultanees passent
-- l'une apres l'autre, sans trou et sans doublon.
create or replace function public.prochain_rang_facture(p_serie text, p_annee integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r integer;
begin
  insert into public.facture_compteurs (serie, annee) values (p_serie, p_annee)
    on conflict (serie, annee) do nothing;
  update public.facture_compteurs
     set dernier_rang = dernier_rang + 1
   where serie = p_serie and annee = p_annee
  returning dernier_rang into r;
  return r;
end $$;

revoke all on function public.prochain_rang_facture(text, integer) from public;
grant execute on function public.prochain_rang_facture(text, integer) to service_role;

-- Emet la facture d'un paiement. Tout vient du paiement et de la fiche : rien
-- n'est saisi deux fois, donc rien ne peut diverger.
--
-- ELLE REFUSE PLUTOT QUE D'INVENTER, dans trois cas, et c'est le coeur du
-- travail :
--   . denomination inconnue. Mesure du 13/09/2026 : l'annuaire des entreprises
--     masque la denomination des entreprises non diffusibles, cas frequent
--     chez les entrepreneurs individuels, donc chez la cible. Le code de
--     l'espace ecrit alors `denomination` a null. Emettre une facture sans
--     client identifie serait emettre un faux document : on leve une erreur,
--     et `p_snapshot` permet de fournir le nom recueilli autrement.
--   . taux de TVA inconnu.
--   . taux nul sans mention legale : la contrainte de la table s'en charge.
create or replace function public.emettre_facture(
  p_paiement_id uuid,
  p_serie       text,
  p_taux_tva    numeric default null,
  p_mention_tva text    default null,
  p_libelle     text    default null,
  p_emetteur    jsonb   default null,
  p_snapshot    jsonb   default null)
returns public.factures
language plpgsql
security definer
set search_path = public
as $$
declare
  pa   public.paiements;
  ar   public.artisans;
  f    public.factures;
  an   integer;
  rg   integer;
  taux numeric;
  nom  text;
begin
  select * into pa from public.paiements where id = p_paiement_id;
  if not found then
    raise exception 'paiement introuvable';
  end if;
  select * into ar from public.artisans where id = pa.artisan_id;

  taux := coalesce(p_taux_tva, pa.taux_tva);
  if taux is null then
    raise exception 'taux de TVA inconnu : il ne sera pas invente ici';
  end if;

  nom := coalesce(p_snapshot->>'denomination', ar.denomination,
                  nullif(btrim(coalesce(ar.nom,'') || ' ' || coalesce(ar.prenom,'')), ''));
  if nom is null then
    raise exception 'denomination du client inconnue (SIRET non diffusible) : facture refusee';
  end if;

  an := extract(year from coalesce(pa.paye_le, now()))::integer;
  rg := public.prochain_rang_facture(p_serie, an);

  insert into public.factures (
    serie, annee, rang, numero, genre,
    artisan_id, abonnement_id, paiement_id,
    emise_le, periode_du, periode_au, libelle_ligne,
    montant_ht_cents, tva_cents, taux_tva, mention_tva, devise,
    client_denomination, client_siret, client_adresse, client_code_postal,
    client_commune, client_email, emetteur)
  values (
    p_serie, an, rg, p_serie || '-' || an::text || '-' || lpad(rg::text, 4, '0'), 'facture',
    pa.artisan_id, pa.abonnement_id, pa.id,
    coalesce(pa.paye_le::date, current_date), pa.periode_du::date, pa.periode_au::date,
    coalesce(p_libelle, 'Abonnement à dispo'),
    pa.montant_ht_cents, pa.tva_cents, taux, p_mention_tva, pa.devise,
    nom,
    coalesce(p_snapshot->>'siret', ar.siret),
    p_snapshot->>'adresse',
    coalesce(p_snapshot->>'code_postal', ar.code_postal),
    coalesce(p_snapshot->>'commune', ar.commune),
    p_snapshot->>'email',
    p_emetteur)
  returning * into f;

  return f;
end $$;

revoke all on function public.emettre_facture(uuid, text, numeric, text, text, jsonb, jsonb) from public;
grant execute on function public.emettre_facture(uuid, text, numeric, text, text, jsonb, jsonb) to service_role;

create or replace view public.mes_factures
with (security_invoker = on) as
  select f.id, f.numero, f.genre, f.emise_le, f.periode_du, f.periode_au,
         f.libelle_ligne, f.montant_ht_cents, f.tva_cents, f.montant_ttc_cents,
         f.taux_tva, f.mention_tva, f.devise, f.pdf_chemin
    from public.factures f
   order by f.emise_le desc, f.rang desc;

grant select on public.mes_factures to authenticated;


-- ============================================================
-- 5. LE JOURNAL DES EVENEMENTS DU PRESTATAIRE DE PAIEMENT
--
-- DEUX PROBLEMES DISTINCTS, ET IL FAUT LES SEPARER POUR LES RESOUDRE.
--
-- PROBLEME 1 : LE MEME EVENEMENT ARRIVE DEUX FOIS. Tous les prestataires
-- reemettent : si notre reponse se perd, si elle met trop de temps, si notre
-- serveur redemarre au mauvais moment. Recevoir deux fois « paiement reussi »
-- ne doit pas produire deux factures.
--   LA GARANTIE : la contrainte `unique (prestataire, reference_evenement)`.
--   L'identifiant d'evenement du prestataire est stable d'un renvoi a l'autre.
--   `enregistrer_evenement_paiement()` fait donc un `insert ... on conflict do
--   nothing returning id` : si rien n'est rendu, c'est que la ligne existait
--   deja, et la fonction repond « deja connu » SANS RIEN TOUCHER D'AUTRE. Ce
--   n'est pas le code qui compare, c'est l'index unique qui refuse. Un code
--   qui verifierait d'abord puis insererait ensuite laisserait passer deux
--   appels simultanes ; l'index unique, non.
--   Second verrou, au moment d'appliquer : `traite_le` non nul fait repondre
--   « deja traite » et sortir. Un evenement n'a donc d'effet qu'une fois, meme
--   si l'application est relancee a la main.
--
-- PROBLEME 2 : LES EVENEMENTS ARRIVENT DANS LE DESORDRE. Aucun prestataire ne
-- garantit l'ordre. « resilie » peut arriver avant « paye », et appliquer
-- betement le dernier arrive remettrait l'abonnement dans un etat perime.
--   LA GARANTIE : l'abonnement retient `evenement_horodatage`, l'heure
--   declaree par le prestataire du dernier evenement APPLIQUE. Tout evenement
--   plus ancien ou de meme age est enregistre, marque
--   « ignore_plus_ancien », et n'ecrit rien. L'etat converge donc vers
--   l'evenement le plus recent, quel que soit l'ordre d'arrivee.
--   On compare l'horodatage du PRESTATAIRE et non l'heure de reception : c'est
--   la seule horloge qui connaisse l'ordre reel des faits.
--
-- LA CHARGE BRUTE EST CONSERVEE TELLE QUELLE. C'est elle qui permettra de
-- rejouer un traitement rate, et de prouver ce que le prestataire a envoye le
-- jour d'un litige. Elle n'est lisible que par l'administration : elle peut
-- contenir des donnees du prestataire qui n'ont pas a circuler.
--
-- LA SIGNATURE. `signature_verifiee` est a faux par defaut, et c'est voulu :
-- un evenement dont la signature n'a pas ete verifiee est un evenement envoye
-- par n'importe qui. `appliquer_abonnement()` refuse d'appliquer une ligne non
-- signee.
-- ============================================================

create table if not exists public.evenements_paiement (
  id                  bigserial primary key,
  prestataire         text not null,
  -- L'identifiant de l'evenement CHEZ LE PRESTATAIRE. Stable d'un renvoi a
  -- l'autre : c'est ce qui fait de lui une cle d'unicite valable.
  reference_evenement text not null,
  genre               text not null,

  objet_type          text,
  objet_reference     text,
  artisan_id          uuid references public.artisans(id) on delete set null,

  -- L'heure du FAIT, declaree par le prestataire. Sert a ordonner.
  horodatage_prestataire timestamptz not null,
  -- L'heure de RECEPTION chez nous. Ne sert qu'a diagnostiquer.
  recu_le             timestamptz not null default now(),

  charge              jsonb not null,
  signature_verifiee  boolean not null default false,

  traite_le           timestamptz,
  traitement_resultat text check (traitement_resultat in (
                        'applique','ignore_plus_ancien','ignore_deja_traite',
                        'ignore_non_signe','erreur')),
  traitement_erreur   text,

  -- LA CLE D'IDEMPOTENCE. Tout repose dessus.
  unique (prestataire, reference_evenement)
);

create index if not exists evenements_a_traiter_idx on public.evenements_paiement (recu_le)
  where traite_le is null;
create index if not exists evenements_objet_idx on public.evenements_paiement (objet_reference);
create index if not exists evenements_artisan_idx on public.evenements_paiement (artisan_id);

comment on table public.evenements_paiement is
  'Journal brut. L''unicite (prestataire, reference_evenement) garantit qu''un renvoi ne refait rien.';

alter table public.evenements_paiement enable row level security;

-- Aucune lecture pour l'artisan : la charge brute peut porter des donnees du
-- prestataire qui n'ont pas a sortir. Aucune ecriture pour personne.
drop policy if exists "evenements lus par l administration" on public.evenements_paiement;
create policy "evenements lus par l administration"
  on public.evenements_paiement for select to authenticated
  using (public.est_admin());

-- Enregistre un evenement recu. Rend { nouveau: bool, id: bigint }.
-- `nouveau` a faux veut dire « deja recu » : l'appelant doit repondre 200 au
-- prestataire et s'arreter la.
create or replace function public.enregistrer_evenement_paiement(
  p_prestataire         text,
  p_reference_evenement text,
  p_genre               text,
  p_horodatage          timestamptz,
  p_charge              jsonb,
  p_signature_verifiee  boolean default false,
  p_objet_type          text    default null,
  p_objet_reference     text    default null,
  p_artisan_id          uuid    default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  nouvel_id bigint;
  ancien_id bigint;
begin
  insert into public.evenements_paiement (
    prestataire, reference_evenement, genre, horodatage_prestataire,
    charge, signature_verifiee, objet_type, objet_reference, artisan_id)
  values (
    p_prestataire, p_reference_evenement, p_genre, p_horodatage,
    p_charge, p_signature_verifiee, p_objet_type, p_objet_reference, p_artisan_id)
  on conflict (prestataire, reference_evenement) do nothing
  returning id into nouvel_id;

  if nouvel_id is not null then
    return jsonb_build_object('nouveau', true, 'id', nouvel_id);
  end if;

  -- Rien d'insere : la ligne existait. On ne la modifie PAS, sinon le second
  -- envoi effacerait la trace du premier.
  select id into ancien_id from public.evenements_paiement
   where prestataire = p_prestataire and reference_evenement = p_reference_evenement;
  return jsonb_build_object('nouveau', false, 'id', ancien_id);
end $$;

revoke all on function public.enregistrer_evenement_paiement(
  text, text, text, timestamptz, jsonb, boolean, text, text, uuid) from public;
grant execute on function public.enregistrer_evenement_paiement(
  text, text, text, timestamptz, jsonb, boolean, text, text, uuid) to service_role;

-- Applique un evenement a l'abonnement d'un artisan.
--
-- POURQUOI L'ETAT EST UN PARAMETRE ET N'EST PAS DEDUIT ICI. La correspondance
-- entre le vocabulaire d'un prestataire et nos six etats depend du prestataire,
-- et AUCUN prestataire n'est choisi a ce jour. L'ecrire maintenant reviendrait
-- a inventer. Cette fonction porte donc ce qui ne changera pas quel que soit
-- le prestataire : l'unicite du traitement et la resistance au desordre. La
-- traduction se fera dans la fonction serveur du prestataire retenu.
--
-- Rend : 'applique', 'ignore_plus_ancien', 'ignore_deja_traite',
--        'ignore_non_signe'.
create or replace function public.appliquer_abonnement(
  p_evenement_id      bigint,
  p_artisan_id        uuid,
  p_etat              text,
  p_formule           text        default null,
  p_periode_du        timestamptz default null,
  p_periode_au        timestamptz default null,
  p_prochain_prelevement_le timestamptz default null,
  p_prestataire       text        default null,
  p_reference_externe text        default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ev  public.evenements_paiement;
  ab  public.abonnements;
begin
  select * into ev from public.evenements_paiement where id = p_evenement_id;
  if not found then
    raise exception 'evenement introuvable';
  end if;

  -- Verrou 1 : deja traite. Rejouer a la main ne refait rien.
  if ev.traite_le is not null then
    return 'ignore_deja_traite';
  end if;

  -- Verrou 2 : signature non verifiee. Un evenement non signe peut venir de
  -- n'importe qui, et il ouvrirait un acces gratuit.
  if not ev.signature_verifiee then
    update public.evenements_paiement
       set traite_le = now(), traitement_resultat = 'ignore_non_signe'
     where id = p_evenement_id;
    return 'ignore_non_signe';
  end if;

  -- On verrouille la ligne d'abonnement : deux evenements traites en meme
  -- temps ne peuvent pas comparer le meme horodatage perime.
  select * into ab from public.abonnements
   where artisan_id = p_artisan_id
     and etat in ('essai','actif','impaye','suspendu','resilie')
   for update;

  -- Verrou 3 : le desordre. Un evenement plus ancien que le dernier applique
  -- est garde pour la trace, mais n'ecrit rien.
  -- On teste `ab.id` et non `found` : entre les deux tests ci-dessous il y a un
  -- `update`, et `found` aurait deja change de sens a ce moment-la.
  if ab.id is not null and ab.evenement_horodatage is not null
     and ev.horodatage_prestataire <= ab.evenement_horodatage then
    update public.evenements_paiement
       set traite_le = now(), traitement_resultat = 'ignore_plus_ancien'
     where id = p_evenement_id;
    return 'ignore_plus_ancien';
  end if;

  if ab.id is not null then
    update public.abonnements
       set etat        = p_etat,
           formule     = coalesce(p_formule, formule),
           periode_du  = coalesce(p_periode_du, periode_du),
           periode_au  = coalesce(p_periode_au, periode_au),
           prochain_prelevement_le = coalesce(p_prochain_prelevement_le, prochain_prelevement_le),
           prestataire = coalesce(p_prestataire, prestataire),
           reference_externe = coalesce(p_reference_externe, reference_externe),
           evenement_horodatage = ev.horodatage_prestataire
     where id = ab.id;
  else
    insert into public.abonnements (
      artisan_id, etat, formule, periode_du, periode_au,
      prochain_prelevement_le, prestataire, reference_externe, evenement_horodatage)
    values (
      p_artisan_id, p_etat, p_formule, p_periode_du, p_periode_au,
      p_prochain_prelevement_le, p_prestataire, p_reference_externe, ev.horodatage_prestataire);
  end if;

  -- Recopie sur `artisans` pour qu'un ecran qui lirait encore ces deux
  -- colonnes ne montre pas une date perimee. La verite reste `abonnements`.
  update public.artisans
     set abonne_jusqu_au = coalesce(p_periode_au::date, abonne_jusqu_au),
         formule         = coalesce(p_formule, formule)
   where id = p_artisan_id;

  update public.evenements_paiement
     set traite_le = now(), traitement_resultat = 'applique'
   where id = p_evenement_id;

  return 'applique';
end $$;

revoke all on function public.appliquer_abonnement(
  bigint, uuid, text, text, timestamptz, timestamptz, timestamptz, text, text) from public;
grant execute on function public.appliquer_abonnement(
  bigint, uuid, text, text, timestamptz, timestamptz, timestamptz, text, text) to service_role;


-- ============================================================
-- 6. LES RELANCES EN CAS D'ECHEC DE PAIEMENT
--
-- CE QU'IL FAUT EMPECHER : relancer deux fois. Une carte refusee et deux
-- courriels identiques a une heure d'intervalle, c'est un abonne qui se
-- demande si on sait ce qu'on fait.
--   LA GARANTIE : `unique (paiement_id, rang, canal)`. La deuxieme tentative
--   de programmer la meme relance est refusee par la base, pas par un `if`.
--
-- CE QU'IL FAUT EMPECHER AUSSI : que deux traitements simultanes prennent la
-- meme relance. D'ou l'etat `envoi_en_cours` et la fonction
-- `reserver_relances()`, qui pose la reservation avec `for update skip
-- locked`. Un second traitement lance en meme temps ne voit tout simplement
-- pas les lignes deja reservees.
--
-- AUCUNE RELANCE NE PART AUJOURD'HUI, et il faut le dire a l'ecran. Mesure du
-- 13/09/2026 : aucun service d'envoi de courriel n'existe dans le depot, et la
-- double confirmation des inscriptions attend deja la meme piece. Les lignes
-- restent donc a l'etat « prevue », ce qui est honnete et visible.
--
-- LE CALENDRIER DES RELANCES N'EST PAS ARRETE : combien, a quel rythme, sur
-- quel canal. Il n'est donc pas ecrit ici. `programmer_relance()` prend le rang
-- et la date en parametres, et c'est la fonction serveur du prestataire retenu
-- qui decidera de la sequence.
-- ============================================================

create table if not exists public.relances_paiement (
  id            bigserial primary key,
  artisan_id    uuid not null references public.artisans(id) on delete cascade,
  abonnement_id uuid references public.abonnements(id) on delete set null,
  paiement_id   uuid not null references public.paiements(id) on delete cascade,

  rang          integer not null check (rang between 1 and 10),
  canal         text not null check (canal in ('email','sms','dans_l_espace')),

  prevue_le     timestamptz not null,
  envoyee_le    timestamptz,
  etat          text not null default 'prevue'
                check (etat in ('prevue','envoi_en_cours','envoyee','echec','annulee')),
  erreur        text,
  cree_le       timestamptz not null default now(),

  -- LA CLE QUI EMPECHE DE RELANCER DEUX FOIS.
  unique (paiement_id, rang, canal)
);

create index if not exists relances_a_envoyer_idx on public.relances_paiement (prevue_le)
  where etat = 'prevue';
create index if not exists relances_artisan_idx on public.relances_paiement (artisan_id, cree_le desc);

alter table public.relances_paiement enable row level security;

-- L'abonne voit ce qu'on lui a envoye : c'est la moindre des choses quand on
-- lui reclame un paiement.
drop policy if exists "ses relances" on public.relances_paiement;
create policy "ses relances"
  on public.relances_paiement for select to authenticated
  using (artisan_id = auth.uid());

drop policy if exists "relances lues par l administration" on public.relances_paiement;
create policy "relances lues par l administration"
  on public.relances_paiement for select to authenticated
  using (public.est_admin());

-- Aucune ecriture depuis un navigateur.

-- Programme UNE relance. Rend son identifiant, ou null si elle existait deja :
-- c'est l'index unique qui tranche, et l'appelant n'a rien a verifier avant.
create or replace function public.programmer_relance(
  p_paiement_id uuid,
  p_rang        integer,
  p_canal       text,
  p_prevue_le   timestamptz)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  pa  public.paiements;
  ide bigint;
begin
  select * into pa from public.paiements where id = p_paiement_id;
  if not found then
    raise exception 'paiement introuvable';
  end if;

  insert into public.relances_paiement (
    artisan_id, abonnement_id, paiement_id, rang, canal, prevue_le)
  values (pa.artisan_id, pa.abonnement_id, pa.id, p_rang, p_canal, p_prevue_le)
  on conflict (paiement_id, rang, canal) do nothing
  returning id into ide;

  return ide;
end $$;

-- Reserve les relances a envoyer maintenant, et les passe en
-- « envoi_en_cours » dans la meme transaction. `skip locked` fait que deux
-- traitements simultanes se partagent le travail sans jamais prendre la meme
-- ligne. Sans cela, deux machines lancees en parallele enverraient chacune la
-- meme relance.
create or replace function public.reserver_relances(p_limite integer default 50)
returns setof public.relances_paiement
language sql
security definer
set search_path = public
as $$
  update public.relances_paiement r
     set etat = 'envoi_en_cours'
   where r.id in (
     select id from public.relances_paiement
      where etat = 'prevue' and prevue_le <= now()
      order by prevue_le
      limit p_limite
      for update skip locked)
  returning r.*
$$;

-- Clot une relance reservee. `p_ok` a faux garde la trace de l'echec d'envoi :
-- sans elle, on ne saurait pas distinguer « pas encore envoye » de « impossible
-- a envoyer ».
create or replace function public.marquer_relance_envoyee(
  p_id     bigint,
  p_ok     boolean,
  p_erreur text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  touche integer;
begin
  update public.relances_paiement
     set etat       = case when p_ok then 'envoyee' else 'echec' end,
         envoyee_le = case when p_ok then now() else envoyee_le end,
         erreur     = p_erreur
   where id = p_id and etat = 'envoi_en_cours';
  get diagnostics touche = row_count;
  return touche > 0;
end $$;

-- Annule ce qui reste a envoyer quand le paiement finit par passer. Sans
-- cette fonction, un abonne qui regularise recoit quand meme la relance
-- suivante, et c'est exactement le genre de detail qui fait resilier.
create or replace function public.annuler_relances(p_paiement_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touche integer;
begin
  update public.relances_paiement
     set etat = 'annulee'
   where paiement_id = p_paiement_id
     and etat in ('prevue','envoi_en_cours');
  get diagnostics touche = row_count;
  return touche;
end $$;

revoke all on function public.programmer_relance(uuid, integer, text, timestamptz) from public;
revoke all on function public.reserver_relances(integer) from public;
revoke all on function public.marquer_relance_envoyee(bigint, boolean, text) from public;
revoke all on function public.annuler_relances(uuid) from public;
grant execute on function public.programmer_relance(uuid, integer, text, timestamptz) to service_role;
grant execute on function public.reserver_relances(integer) to service_role;
grant execute on function public.marquer_relance_envoyee(bigint, boolean, text) to service_role;
grant execute on function public.annuler_relances(uuid) to service_role;


-- ============================================================
-- 7. LE PARRAINAGE
--
-- UN CODE PAR ARTISAN, et l'unicite sur `artisan_id` l'impose. Pas de code
-- choisi par l'artisan : un code lisible se devine, et un code devine se
-- reclame.
--
-- UN FILLEUL N'EST PARRAINE QU'UNE FOIS, et la aussi c'est l'unicite sur
-- `filleul_id` qui le garantit, pas un controle dans une page. Plus la
-- contrainte `parrain_id <> filleul_id` : on ne se parraine pas soi-meme.
--
-- CE QUE CA OUVRE : DES MOIS OFFERTS, DONT LE NOMBRE N'EST PAS ARRETE. Les
-- deux cles existent dans `reglages`, a valeur nulle, et `valider_parrainage()`
-- REFUSE tant qu'elles sont nulles. L'ecran doit donc dire que le parrainage
-- n'est pas encore ouvert, exactement comme les cartes eteintes de l'ecran
-- agenda. C'est la regle : aucun bouton mort, aucune donnee inventee.
--
-- LE NOMBRE DE MOIS EST RECOPIE SUR LA LIGNE A LA VALIDATION. Si le reglage
-- change ensuite, les parrainages deja valides gardent ce qui a ete promis :
-- une recompense annoncee ne se reecrit pas apres coup.
--
-- CE QUE LE PARRAIN NE VOIT PAS : qui a utilise son code. Il en voit le
-- nombre, par la fonction `mes_parrainages()`. La politique de lecture de la
-- table est limitee au filleul, qui a de toute facon saisi le code lui-meme.
-- ============================================================

create table if not exists public.codes_parrainage (
  code       text primary key check (code ~ '^[A-Z0-9]{6,12}$'),
  artisan_id uuid not null unique references public.artisans(id) on delete cascade,
  actif      boolean not null default true,
  cree_le    timestamptz not null default now()
);

create table if not exists public.parrainages (
  id         uuid primary key default gen_random_uuid(),
  code       text not null references public.codes_parrainage(code) on delete restrict,
  parrain_id uuid not null references public.artisans(id) on delete cascade,
  filleul_id uuid not null unique references public.artisans(id) on delete cascade,

  etat       text not null default 'en_attente'
             check (etat in ('en_attente','valide','refuse','annule')),
  cree_le    timestamptz not null default now(),
  valide_le  timestamptz,
  motif      text,

  -- Recopies du reglage en vigueur AU MOMENT de la validation. Nuls tant que
  -- le parrainage n'est pas valide.
  mois_offerts_parrain integer check (mois_offerts_parrain is null or mois_offerts_parrain >= 0),
  mois_offerts_filleul integer check (mois_offerts_filleul is null or mois_offerts_filleul >= 0),

  constraint pas_soi_meme check (parrain_id <> filleul_id)
);

create index if not exists parrainages_parrain_idx on public.parrainages (parrain_id, etat);

alter table public.codes_parrainage enable row level security;
alter table public.parrainages      enable row level security;

drop policy if exists "son code de parrainage" on public.codes_parrainage;
create policy "son code de parrainage"
  on public.codes_parrainage for select to authenticated
  using (artisan_id = auth.uid());

drop policy if exists "codes lus par l administration" on public.codes_parrainage;
create policy "codes lus par l administration"
  on public.codes_parrainage for select to authenticated
  using (public.est_admin());

drop policy if exists "son parrainage" on public.parrainages;
create policy "son parrainage"
  on public.parrainages for select to authenticated
  using (filleul_id = auth.uid());

drop policy if exists "parrainages lus par l administration" on public.parrainages;
create policy "parrainages lus par l administration"
  on public.parrainages for select to authenticated
  using (public.est_admin());

-- Aucune ecriture directe : les trois fonctions ci-dessous, et rien d'autre.

-- Rend le code de l'appelant, en le creant au premier appel. Meme procede que
-- `ma_fiche()` : la base tranche, y compris si deux onglets appellent en meme
-- temps. La boucle couvre la collision, qui est improbable mais pas
-- impossible.
create or replace function public.mon_code_parrainage()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
  i integer := 0;
begin
  if auth.uid() is null then
    raise exception 'aucune session';
  end if;

  select code into c from public.codes_parrainage where artisan_id = auth.uid();
  if c is not null then
    return c;
  end if;

  loop
    i := i + 1;
    c := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    begin
      insert into public.codes_parrainage (code, artisan_id) values (c, auth.uid());
      return c;
    exception
      when unique_violation then
        -- Soit le code existait, soit l'artisan a recu le sien entre-temps.
        select code into c from public.codes_parrainage where artisan_id = auth.uid();
        if c is not null then
          return c;
        end if;
        if i > 5 then
          raise exception 'impossible de generer un code de parrainage';
        end if;
    end;
  end loop;
end $$;

-- Enregistre l'appelant comme filleul du porteur du code.
--
-- TROISIEME PORTE OUVERTE AU NAVIGATEUR, et elle ne donne rien : elle cree une
-- ligne « en_attente », sans aucun mois offert. La recompense n'est ecrite
-- qu'a la validation, par le serveur, apres un vrai paiement.
--
-- Elle rend un booleen et rien d'autre. Elle ne dit pas si le code existe : un
-- code inconnu, un code eteint et un filleul deja parraine donnent la meme
-- reponse. Repondre differemment permettrait d'eprouver des codes un par un.
create or replace function public.enregistrer_parrainage(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  parrain uuid;
begin
  if auth.uid() is null then
    raise exception 'aucune session';
  end if;

  select artisan_id into parrain from public.codes_parrainage
   where code = upper(btrim(p_code)) and actif;
  if parrain is null or parrain = auth.uid() then
    return false;
  end if;

  insert into public.parrainages (code, parrain_id, filleul_id)
  values (upper(btrim(p_code)), parrain, auth.uid())
  on conflict (filleul_id) do nothing;

  return found;
end $$;

-- Valide un parrainage et inscrit la recompense promise. REFUSE tant que le
-- nombre de mois offerts n'est pas arrete : c'est ce refus qui empeche
-- d'inventer un chiffre, et il doit remonter jusqu'a l'ecran.
create or replace function public.valider_parrainage(p_filleul_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  mp integer;
  mf integer;
  touche integer;
begin
  mp := public.reglage('parrainage_mois_parrain');
  mf := public.reglage('parrainage_mois_filleul');
  if mp is null or mf is null then
    return 'refuse_reglage_absent';
  end if;

  update public.parrainages
     set etat = 'valide',
         valide_le = now(),
         mois_offerts_parrain = mp,
         mois_offerts_filleul = mf
   where filleul_id = p_filleul_id
     and etat = 'en_attente';
  get diagnostics touche = row_count;

  if touche = 0 then
    return 'rien_a_valider';
  end if;
  return 'valide';
end $$;

-- Ce que le parrain voit de ses filleuls : des nombres, jamais des
-- identifiants. En `security definer` parce que la politique de lecture de la
-- table ne lui ouvre volontairement rien.
create or replace function public.mes_parrainages()
returns table (etat text, nombre bigint, mois_offerts integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.etat, count(*) as nombre, max(p.mois_offerts_parrain) as mois_offerts
    from public.parrainages p
   where p.parrain_id = auth.uid()
   group by p.etat
$$;

revoke all on function public.mon_code_parrainage() from public;
revoke all on function public.enregistrer_parrainage(text) from public;
revoke all on function public.valider_parrainage(uuid) from public;
revoke all on function public.mes_parrainages() from public;
grant execute on function public.mon_code_parrainage() to authenticated;
grant execute on function public.enregistrer_parrainage(text) to authenticated;
grant execute on function public.mes_parrainages() to authenticated;
grant execute on function public.valider_parrainage(uuid) to service_role;


-- ============================================================
-- CONTROLE, a passer apres le rejeu (les resultats attendus sont indiques)
--
-- Aucune politique d'ecriture sur les tables d'argent : la requete doit rendre
-- ZERO ligne.
--   select tablename, policyname, cmd from pg_policies
--    where schemaname = 'public'
--      and tablename in ('abonnements','paiements','factures','facture_compteurs',
--                        'evenements_paiement','relances_paiement',
--                        'codes_parrainage','parrainages')
--      and cmd <> 'SELECT';
--
-- Securite par ligne active partout : la colonne rowsecurity doit valoir true
-- sur les onze lignes.
--   select relname, relrowsecurity from pg_class
--    where relnamespace = 'public'::regnamespace
--      and relname in ('reglages','abonnement_etats','pieces','abonnements',
--                      'paiements','factures','facture_compteurs',
--                      'evenements_paiement','relances_paiement',
--                      'codes_parrainage','parrainages');
--
-- Les deux buckets sont prives : public doit valoir false sur les deux.
--   select id, public, file_size_limit from storage.buckets
--    where id in ('pieces','factures');
--
-- Aucun montant n'est ecrit dans ce fichier : la recherche doit rendre ZERO.
-- Le motif cherche le signe monetaire par son code, pour ne pas l'ecrire ici.
--   grep -nE "$(printf '\\u20ac')|[0-9]+[ ,.][0-9]{2} ?(EUR|euros?)" \
--        crm/supabase/migration-abonnement-pieces.sql
-- ============================================================


-- ============================================================
-- CE QUI RESTE A FAIRE HORS DE CE FICHIER :
--
--   1. CHOISIR LE PRESTATAIRE DE PAIEMENT. Rien de ce fichier n'en depend,
--      c'est voulu, mais rien ne tourne sans lui : il faut ensuite une seule
--      fonction serveur, celle qui traduit son vocabulaire vers nos six etats
--      et appelle `appliquer_abonnement()`. Tant qu'il n'existe pas, l'ecran
--      d'abonnement doit continuer a dire ce qu'il dit deja : le prestataire
--      n'est pas raccorde, aucune carte n'est a saisir.
--
--   2. LE PRIX. Il n'est pas ici et il n'y sera jamais : il vit chez le
--      prestataire. Ce qui manque cote produit, c'est la decision, attendue de
--      Claire-Marie, ainsi que les deux valeurs de `reglages` laissees a nul
--      pour le parrainage.
--
--   3. LE SERVICE D'ENVOI DE COURRIELS. Il bloque les relances de ce fichier
--      ET la double confirmation des inscriptions, qui l'attend deja. Une
--      seule piece pour les deux.
--
--   4. LA SERIE ET LE FORMAT DES NUMEROS DE FACTURE, a confirmer avec le
--      comptable avant la premiere vraie facture. `emettre_facture()` exige la
--      serie en parametre, sans valeur par defaut, a dessein : personne ne doit
--      pouvoir en inventer une par inadvertance. Idem pour la mention de TVA.
--
--   5. L'EMETTEUR DES FACTURES. Deux documents du depot portent deux
--      emetteurs differents, et le devis signe porte une adresse electronique
--      contraire a la regle de signature des livrables. A trancher avant la
--      premiere facture, puis a passer en `p_emetteur`.
--
--   6. METTRE A JOUR legal/index.html. Son tableau des donnees (section 2.2)
--      ne connait ni les pieces justificatives, ni les paiements, ni les
--      factures. Trois categories de donnees nouvelles, dont une sensible.
--      La duree de conservation des pieces comptables y est deja marquee
--      « A COMPLETER » : c'est une decision d'avocat, pas la notre.
--
--   7. LA LISTE DES DOCUMENTS EXIGIBLES. La colonne `genre` de `pieces` est un
--      contenant, pas une obligation legale. La liste opposable est marquee
--      « a valider par l'avocat » dans aide/index.html et n'est publiable
--      nulle part en l'etat.
--
--   8. LES RELANCES D'EXPIRATION DE PIECE (une assurance qui arrive a terme)
--      relevent du lot « Les automatisations » du devis signe, pas d'ici :
--      `relances_paiement` ne couvre QUE l'echec de paiement. La donnee
--      necessaire existe deja : `pieces.valide_au` et son index.
--
--   9. PLANIFIER `marquer_pieces_expirees()` une fois par jour. Sans elle,
--      l'etat « expiree » ne se pose jamais tout seul. La vue `mes_pieces`
--      calcule `valable` a la volee et reste juste entre deux passages, mais
--      une recherche qui filtrerait sur `etat` serait fausse.
--
--  10. VERIFIER LES ISOLATIONS AVEC DEUX COMPTES REELS, pas par lecture du
--      code. Trois controles, dans cet ordre :
--      a. le compte A depose une piece ; le compte B ne la voit ni dans
--         `pieces`, ni dans `mes_pieces`, ni par une adresse de fichier ;
--      b. le compte A tente un `insert` et un `update` sur `abonnements`,
--         `paiements` et `factures` : les trois doivent echouer ;
--      c. le compte A tente de deposer une piece dont le chemin commence par
--         l'identifiant du compte B : la politique doit refuser.
--
--  11. LA FUITE MESUREE QUI N'EST PAS DANS CE FICHIER, et qui doit etre reglee
--      AVANT d'ouvrir les inscriptions. `creer_profil()` cree un profil a
--      `actif = true` pour tout compte cree, artisan compris, et `est_actif()`
--      ouvre alors la lecture de `contacts` et de `inscriptions`. Ce fichier
--      n'aggrave rien : il n'emploie QUE `est_admin()`, jamais `est_actif()`.
--      Mais la separation entre compte artisan et compte equipe reste a
--      trancher.
-- ============================================================
