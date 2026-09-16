// Banc d'essai des migrations SQL, sur un vrai PostgreSQL, hors production.
//
// POURQUOI CET OUTIL EXISTE. Le 13/09/2026, quatre migrations ont ete ecrites
// sans jamais etre executees : leur syntaxe etait relue, pas eprouvee. Or un
// « create policy » qui reference une colonne inexistante, une fonction qui
// appelle une autre fonction absente, une cle etrangere posee dans le mauvais
// ordre : rien de tout cela ne se voit a la lecture. Ca se voit a l'execution,
// et l'execution se faisait jusque-la sur la base de production, en direct.
//
// CE QU'IL FAIT. Il monte un PostgreSQL complet en memoire (PGlite, le moteur
// compile en WebAssembly), y pose les objets que Supabase fournit et que
// PostgreSQL nu n'a pas, rejoue TOUTES les migrations dans l'ordre, puis pose
// les questions qui comptent :
//
//   1. est-ce que chaque fichier passe ?
//   2. est-ce qu'il passe une SECONDE fois, comme il le promet ?
//   3. est-ce qu'un artisan lit ce qui appartient a un autre artisan ?
//   4. est-ce qu'un artisan lit le fichier de prospection du CRM ?
//
// CE QU'IL NE FAIT PAS. Il ne touche jamais a la base de production, il ne
// demande aucun identifiant, et il ne remplace pas le controle final avec deux
// vrais comptes dans Supabase. Il attrape ce qui est attrapable avant.
//
// INSTALLATION, une fois :   npm install @electric-sql/pglite
// USAGE :                    node outils/banc-sql.mjs
// Sortie en erreur si un controle echoue, pour pouvoir servir de garde-fou.

let PGlite
try {
  ({ PGlite } = await import('@electric-sql/pglite'))
} catch {
  // PGlite est un PostgreSQL complet compile en WebAssembly : il pese lourd, et
  // Cloudflare reinstalle les dependances a chaque construction. Il n'est donc
  // PAS dans package.json. On le dit plutot que de planter sur une trace.
  console.error("\n  PGlite n'est pas installe. Une seule fois :\n")
  console.error("      npm install --no-save @electric-sql/pglite\n")
  process.exit(2)
}
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SQL = (f) => readFileSync(`${RACINE}/supabase/migrations/${f}`, 'utf8')

// L'ordre est le contrat : chaque fichier s'appuie sur les precedents.
const MIGRATIONS = [
  'schema.sql',
  'migration-admin.sql',
  'migration-presence.sql',
  'migration-inscriptions.sql',
  'migration-espace-artisan.sql',
  'migration-recherche-relations.sql',
  'migration-abonnement-pieces.sql',
  'migration-messagerie-rgpd.sql',
  'migration-back-office.sql',
  'migration-cloison-crm.sql',
  'migration-essai-30-jours.sql',
  'migration-roles-evenements.sql',
]

// Les doublures de Supabase. Fideles en STRUCTURE, ce qui suffit a valider le
// SQL : les roles, le schema auth avec sa table users et sa fonction uid(), le
// schema storage avec les trois fonctions dont se servent les politiques de
// fichiers. Sans elles, le banc refuserait tout pour la mauvaise raison, et on
// croirait la base sure.
const AMONT = `
  create role anon;
  create role authenticated;
  create role service_role;
  create schema if not exists auth;
  create schema if not exists storage;
  create schema if not exists extensions;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
  );

  -- Une variable de session tient lieu de jeton : c'est ce qui permet de se
  -- faire passer pour un artisan donne et de verifier que les politiques mordent.
  create or replace function auth.uid() returns uuid language sql stable as $fn$
    select nullif(current_setting('banc.uid', true), '')::uuid $fn$;
  create or replace function auth.role() returns text language sql stable as $fn$
    select coalesce(nullif(current_setting('banc.role', true), ''), 'anon') $fn$;
  create or replace function auth.jwt() returns jsonb language sql stable as $fn$
    select '{}'::jsonb $fn$;

  create table storage.buckets (
    id text primary key, name text not null, public boolean not null default false,
    file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text not null, owner uuid, metadata jsonb,
    created_at timestamptz default now(), updated_at timestamptz default now());
  alter table storage.objects enable row level security;

  create or replace function storage.foldername(name text) returns text[]
    language sql immutable as $fn$ select string_to_array(name, '/') $fn$;
  create or replace function storage.filename(name text) returns text
    language sql immutable as $fn$
      select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $fn$;
  create or replace function storage.extension(name text) returns text
    language sql immutable as $fn$
      select nullif(split_part(storage.filename(name), '.', 2), '') $fn$;

  grant usage on schema public, auth, storage to anon, authenticated, service_role;
`

const db = await PGlite.create()
await db.exec(AMONT)

let echecs = 0
const dire = (bon, quoi, detail = '') => {
  if (!bon) echecs++
  console.log(`  ${bon ? 'ok   ' : 'ECHEC'} ${quoi}${detail ? '\n           ' + detail : ''}`)
}

console.log('\n1. EXECUTION DES MIGRATIONS, DANS L ORDRE\n')
for (const f of MIGRATIONS) {
  try { await db.exec(SQL(f)); dire(true, f) }
  catch (e) { dire(false, f, String(e.message).split('\n')[0]) }
}

console.log('\n2. REJEU : elles se disent rejouables\n')
for (const f of MIGRATIONS.slice(5)) {
  try { await db.exec(SQL(f)); dire(true, f + ' (2e passage)') }
  catch (e) { dire(false, f + ' (2e passage)', String(e.message).split('\n')[0]) }
}

// Les droits par defaut que Supabase accorde sur le schema public.
await db.exec(`
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant usage, select on all sequences in schema public to anon, authenticated;
  grant execute on all functions in schema public to anon, authenticated;`)

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
await db.exec(`insert into auth.users (id, email) values
  ('${A}','alice@exemple.fr'), ('${B}','bruno@exemple.fr')`)

const comme = async (uid, sql) => {
  await db.exec(`set role authenticated; set banc.uid='${uid}'; set banc.role='authenticated';`)
  try { return await db.query(sql) } finally { await db.exec('reset role') }
}
const compte = async (uid, sql) => {
  try { return (await comme(uid, sql)).rows[0].n } catch { return 0 }
}

await comme(A, 'select public.ma_fiche()')
await comme(A, `update public.artisans set prenom='Alice', nom='Martin',
  telephone='0600000000', siret='97770958300024', denomination='Alice Plomberie',
  commune='Annecy', code_postal='74000', metier='plombier', etape='fini', publie=true
  where id='${A}' returning id`)
await comme(A, `insert into public.occupations (artisan_id, debut, fin, saisie)
  values ('${A}', now(), now() + interval '2 days', true) returning id`)
await comme(B, 'select public.ma_fiche()')

console.log('\n3. CLOISON ENTRE DEUX ARTISANS : Bruno tente de lire chez Alice\n')
dire(await compte(B, 'select count(*)::int n from public.artisans') === 1,
     'il ne voit que sa propre fiche')
dire(await compte(B, `select count(*)::int n from public.artisans where id='${A}'`) === 0,
     'les coordonnees d Alice lui sont fermees')
dire(await compte(B, `select count(*)::int n from public.occupations where artisan_id='${A}'`) === 0,
     'l agenda d Alice lui est ferme')
dire(await compte(B, 'select count(*)::int n from public.pieces') === 0,
     'les pieces justificatives lui sont fermees')
dire(await compte(B, `select count(*)::int n from public.fiches_publiques where id='${A}'`) === 1,
     'la fiche PUBLIQUE d Alice reste visible, c est le produit')

const cols = (await db.query(`select string_agg(column_name, ', ' order by ordinal_position) c
  from information_schema.columns where table_name='fiches_publiques'`)).rows[0].c
const sensibles = ['telephone', 'siret', 'nom', 'code_postal'].filter(x => new RegExp(`\\b${x}\\b`).test(cols))
dire(sensibles.length === 0, 'la fiche publique n expose aucune colonne sensible',
     sensibles.length ? 'exposees : ' + sensibles.join(', ') : '')

console.log('\n4. CLOISON DU CRM : un artisan lit-il le fichier de prospection ?\n')
await db.exec(`insert into public.contacts (id, base) values
  (1,'{"nom":"Dupont"}'::jsonb),(2,'{"nom":"Martin"}'::jsonb),(3,'{"nom":"Bernard"}'::jsonb)`)
dire(await compte(B, 'select count(*)::int n from public.contacts') === 0,
     'un artisan ne lit aucune fiche de prospection')

console.log('\n5. L ESSAI DE 30 JOURS S OUVRE-T-IL A LA FIN DU PARCOURS ?\n')
const q = async (sql) => (await db.query(sql)).rows[0]

// Alice a termine son parcours a la section precedente : l essai doit exister.
const ab = await q(`select etat, essai_du, essai_au, (essai_au - essai_du) as jours
                      from public.abonnements where artisan_id = '${A}'`)
dire(!!ab, 'un abonnement existe pour l artisan qui a fini', ab ? '' : 'aucune ligne creee')
if (ab) {
  dire(ab.etat === 'essai', `il est en etat « essai » (lu : ${ab.etat})`)
  dire(Number(ab.jours) === 30, `il dure 30 jours (lu : ${ab.jours})`)
}
const acces = await q(`select public.acces_artisan('${A}') as a`)
dire(acces.a === 'complet', `l acces vaut « complet » (lu : ${acces.a})`)
const peut = await comme(A, 'select public.peut_demander() as p')
dire(peut.rows[0].p === true, 'peut_demander() rend vrai')

// Bruno n a PAS fini : il ne doit rien avoir.
const abB = await q(`select count(*)::int n from public.abonnements where artisan_id = '${B}'`)
dire(abB.n === 0, 'l artisan qui n a pas fini n a aucun abonnement')

// La garde anti-double-essai : on repasse l etape a « fini ».
await comme(A, `update public.artisans set etape='metier' where id='${A}'`)
await comme(A, `update public.artisans set etape='fini' where id='${A}'`)
const n2 = await q(`select count(*)::int n from public.abonnements where artisan_id='${A}'`)
dire(n2.n === 1, `repasser par la fin du parcours n ouvre pas un second essai (lu : ${n2.n})`)

// La colonne historique ne ment plus.
const col = await q(`select a.essai_jusqu_au = b.essai_au as accord
                       from public.artisans a join public.abonnements b on b.artisan_id = a.id
                      where a.id = '${A}'`)
dire(col.accord === true, 'artisans.essai_jusqu_au dit la meme chose que la table abonnements')

const sansRls = (await db.query(`
  select tablename from pg_tables t where schemaname='public'
   and not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                    where n.nspname='public' and c.relname=t.tablename and c.relrowsecurity)
   order by 1`)).rows.map(r => r.tablename)
dire(sansRls.length === 0, 'toutes les tables portent la securite par ligne',
     sansRls.length ? 'sans protection : ' + sansRls.join(', ') : '')

const n = async (q) => (await db.query(q)).rows[0].n
console.log(`\n  Etat final : ${await n(`select count(*)::int n from pg_tables where schemaname='public'`)} tables, ` +
  `${await n(`select count(*)::int n from pg_views where schemaname='public'`)} vues, ` +
  `${await n(`select count(*)::int n from pg_policies where schemaname='public'`)} politiques.`)

console.log(echecs ? `\nVERDICT : ${echecs} controle(s) en echec.\n`
                   : '\nVERDICT : tout passe. Les migrations sont jouables.\n')
process.exit(echecs ? 1 : 0)
