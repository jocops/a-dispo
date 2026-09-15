-- ============================================================
-- CLOISONNER LE CRM AVANT D'OUVRIR LES INSCRIPTIONS
--
-- LE PROBLEME, MESURE ET NON SUPPOSE. Le 14/09/2026, sur un PostgreSQL 18 ou
-- les neuf migrations du projet ont ete rejouees, un compte d'artisan ordinaire
-- a lu la totalite de la table `contacts`. Le chemin est court et n'a rien
-- d'exotique :
--
--   1. `creer_profil()` (schema.sql) insere une ligne dans `profils` pour TOUT
--      nouveau compte de `auth.users`, sans preciser `actif`, qui vaut donc
--      vrai par defaut ;
--   2. la politique « contacts lecture actifs » (migration-admin.sql) ouvre la
--      lecture de `contacts` a tout profil actif ;
--   3. donc tout nouveau compte lit les fiches de prospection.
--
-- Mesure du banc : profil cree {"actif": true, "admin": false}, 3 fiches posees,
-- 3 fiches lues. En production, ce sont les 1 374 contacts demarches.
--
-- POURQUOI CE N'EST PAS ENCORE ARRIVE, ET POURQUOI CA VA ARRIVER. L'inscription
-- libre est desactivee dans le tableau de bord (`disable_signup: true`), donc
-- personne ne se cree un compte seul aujourd'hui. Mais l'espace artisan ne peut
-- pas ouvrir sans activer cette inscription : `migration-espace-artisan.sql` le
-- demande noir sur blanc dans son pied de page. Le jour ou l'interrupteur
-- bascule, la fuite s'ouvre avec lui, sans qu'aucun code ne change.
--
-- LE CHOIX RETENU, ET POURQUOI CELUI-LA. On ne touche NI a la politique du CRM,
-- NI aux profils existants. On change une seule chose : un profil nouvellement
-- cree naît INACTIF. C'est le moindre privilege, et c'est deja le modele du
-- projet, qui a mesure le 04/09 que « profil actif, 1 374 fiches lisibles ;
-- profil inactif, 0 fiche ». L'acces au CRM devient un geste explicite d'un
-- administrateur au lieu d'un effet de bord de la creation de compte.
--
-- CE QUE CA CHANGE POUR L'EQUIPE. Rien pour Joan et Claire-Marie : leurs lignes
-- existent deja et restent actives, cette migration ne les touche pas. Un
-- nouveau membre de l'equipe devra etre active une fois, dans Reglages >
-- Administration. Une seconde de travail contre un fichier de prospection.
--
-- Rejouable sans risque : `or replace` sur la fonction, aucun `update` sur les
-- lignes existantes.
-- ============================================================

-- ------------------------------------------------- le profil naît inactif
--
-- Meme corps que la version de schema.sql, a un mot pres : `actif` est pose
-- explicitement a faux. L'ecrire plutot que de s'en remettre au defaut de la
-- colonne rend l'intention lisible, et survit a un changement de ce defaut.
--
-- `on conflict do update set email` est conserve tel quel : il rafraichit
-- l'adresse d'un profil qui existe deja, et ne doit surtout PAS retoucher
-- `actif`, sinon rejouer ce fichier desactiverait toute l'equipe.

create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, prenom, email, actif)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'prenom', ''), split_part(new.email, '@', 1)),
    new.email,
    false
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists creer_profil on auth.users;
create trigger creer_profil after insert on auth.users
  for each row execute function public.creer_profil();

-- ------------------------------------------------- le controle, en une requete
--
-- A jouer APRES avoir cree un compte d'essai d'artisan, et avant d'ouvrir les
-- inscriptions. Il repond par oui ou non, sans interpretation.

create or replace function public.controle_cloison_crm()
returns table (compte uuid, adresse text, profil_actif boolean, verdict text)
language sql
security definer
set search_path = public
as $$
  select p.id,
         p.email,
         p.actif,
         case when p.actif then 'LIT LE CRM : a desactiver si ce n est pas un membre de l equipe'
              else 'cloisonne' end
    from public.profils p
   order by p.actif desc, p.email
$$;

revoke all on function public.controle_cloison_crm() from public, anon, authenticated;
grant execute on function public.controle_cloison_crm() to service_role;

-- ============================================================
-- CE QUI RESTE A FAIRE A LA MAIN, ET QUI NE S'ECRIT PAS EN SQL :
--
--   1. Jouer ce fichier AVANT d'activer l'inscription libre dans
--      Authentication > Sign In / Up.
--   2. Verifier la liste des profils actifs : dans l'editeur SQL,
--      select * from public.controle_cloison_crm();
--      Tout profil actif qui n'est pas un membre de l'equipe lit le fichier
--      de prospection.
--   3. Refaire le controle en vrai : creer un compte d'essai d'artisan, se
--      connecter avec, et tenter select count(*) from contacts. Attendu : 0.
-- ============================================================
