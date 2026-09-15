#!/usr/bin/env python3
"""Assemble le CRM en un seul fichier : crm/index.html

    python3 outils/construire.py                  # version en ligne, SANS les contacts
    python3 outils/construire.py --avec-donnees   # version de démonstration, contacts inclus
    python3 outils/construire.py --sql            # + supabase/seed.sql

Par défaut le fichier construit ne contient AUCUNE donnée personnelle. Les
1 374 fiches sont lues dans Supabase après connexion : le CRM sait le faire, la
couche de fusion accepte une fiche qui n'existe que dans la base (vérifié le
4 septembre 2026, une fiche présente uniquement en ligne s'affiche entièrement).

Pourquoi ce défaut : le fichier construit est déployé publiquement à l'adresse
/crm, et il pesait 573 Ko dont l'essentiel était les noms, téléphones et adresses
de 1 374 artisans. Ils ne sortent plus du fichier. Trois consequences : le nom
d'un artisan ne dort plus dans un fichier statique, le dépôt git devient
constructible en entier (donc déployable depuis GitHub), et la base se corrige
sans redéployer.

`--avec-donnees` reste utile pour une démonstration hors ligne, sans base : le
fichier produit contient alors les contacts et ne doit pas être publié.

Entrées : src/index.html (gabarit), src/styles.css, src/config.js, src/app.js
          et contacts.json avec --avec-donnees ou --sql
Sortie  : index.html
"""
import json, os, sys, datetime

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RACINE, 'src')

def lire(nom):
    with open(os.path.join(SRC, nom), encoding='utf-8') as f:
        return f.read()

AVEC = '--avec-donnees' in sys.argv or '--sql' in sys.argv
contacts = json.load(open(os.path.join(RACINE, 'contacts.json'), encoding='utf-8')) if AVEC else []

if '--avec-donnees' in sys.argv:
    data_js = ('/* Contacts inlinés : fichier de DÉMONSTRATION hors ligne, à ne pas publier. */\n'
               'window.CRM_CONTACTS = '
               + json.dumps(contacts, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';')
else:
    data_js = ('/* Aucune donnée personnelle dans ce fichier : les fiches sont lues dans\n'
               '   Supabase après connexion. Voir l\'en-tête de outils/construire.py. */\n'
               'window.CRM_CONTACTS = [];')

html = lire('index.html')
html = html.replace('/*__STYLES__*/', lire('styles.css'))
html = html.replace('/*__CONFIG__*/', lire('config.js'))
html = html.replace('/*__DATA__*/', data_js)
html = html.replace('/*__APP__*/', lire('app.js'))
html = html.replace('<title>', f'<!-- construit le {datetime.date.today().isoformat()} par outils/construire.py, ne pas éditer à la main : modifier src/ puis reconstruire -->\n<title>', 1)

dst = os.path.join(RACINE, 'index.html')
with open(dst, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'index.html : {os.path.getsize(dst)//1024} Ko, '
      + (f'{len(contacts)} contacts inlinés (fichier de démonstration, ne pas publier)'
         if '--avec-donnees' in sys.argv else 'aucune donnée personnelle, fiches lues dans Supabase'))

if '--sql' in sys.argv:
    def lit(v):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'"
    lignes = []
    for c in contacts:
        base = {k: v for k, v in c.items() if k != 'id'}
        lignes.append(f"({c['id']}, {lit(base)}::jsonb, '{{}}'::jsonb)")
    sql = ["-- Seed de la base de contacts À dispo (généré par outils/construire.py --sql)",
           "-- À exécuter APRÈS schema.sql. Rejouable : ne touche pas au travail déjà saisi (crm).",
           "insert into public.contacts (id, base, crm) values"]
    sql.append(",\n".join(lignes) + "\non conflict (id) do update set base = excluded.base;")
    os.makedirs(os.path.join(RACINE, 'supabase'), exist_ok=True)
    p = os.path.join(RACINE, 'supabase', 'seed.sql')
    with open(p, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql) + "\n")
    print(f'supabase/seed.sql : {os.path.getsize(p)//1024} Ko')
