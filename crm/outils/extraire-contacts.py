#!/usr/bin/env python3
"""Extrait la base Pipedrive (xlsx) vers crm/contacts.json.

Usage : python3 crm/outils/extraire-contacts.py sources/base_contacts_pipedrive.xlsx
Sortie : ../contacts.json (à côté de index.html)

Règle : aucune valeur inventée. Le seul champ déduit est `metierSuggere`,
calculé à partir de mots-clés du nom d'organisation et affiché comme
suggestion dans le CRM (l'utilisateur confirme ou corrige).
"""
import json, sys, os, collections
import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else 'base_contacts_pipedrive.xlsx'
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'contacts.json')

FIAB = {'Fiable': 'fiable', 'À contrôler': 'a_controler', 'Inexploitable': 'inexploitable'}

REGLES_METIER = [
    ('portail', 'Portails et automatismes'), ('automati', 'Portails et automatismes'),
    ('motoris', 'Portails et automatismes'), ('clotur', 'Portails et automatismes'), ('clôtur', 'Portails et automatismes'),
    ('menuis', 'Menuisier'), ('fenetr', 'Menuisier'), ('fenêtr', 'Menuisier'), ('veranda', 'Menuisier'), ('véranda', 'Menuisier'),
    ('alu', 'Menuisier'), ('pvc', 'Menuisier'), ('ouverture', 'Menuisier'),
    ('ferme', 'Fermetures'), ('volet', 'Fermetures'), ('store', 'Fermetures'), ('baie', 'Fermetures'),
    ('serrur', 'Serrurier métallier'), ('metal', 'Serrurier métallier'), ('métal', 'Serrurier métallier'),
    ('ferronn', 'Serrurier métallier'), ('forge', 'Serrurier métallier'),
    ('elec', 'Électricien'), ('élec', 'Électricien'), ('domot', 'Électricien'),
    ('isol', 'Isolation'), ('charpent', 'Charpentier'), ('couvert', 'Couvreur'), ('toit', 'Couvreur'),
    ('plomb', 'Plombier'), ('chauff', 'Chauffagiste'), ('maçon', 'Maçon'), ('macon', 'Maçon'), ('peint', 'Peintre'),
]

def metier(organisation, nom):
    s = (organisation + ' ' + nom).lower()
    for cle, val in REGLES_METIER:
        if cle in s:
            return val
    return ''

wb = openpyxl.load_workbook(SRC, read_only=True)
ws = wb['Contacts']
rows = list(ws.iter_rows(values_only=True))
H = {h: i for i, h in enumerate(rows[0])}

def g(r, k):
    v = r[H[k]]
    return '' if v is None else str(v).strip()

contacts = []
for r in rows[1:]:
    if not g(r, 'ID'):
        continue
    tels = []
    for a, b in (('Téléphone 1', 'Type 1'), ('Téléphone 2', 'Type 2'), ('Téléphone 3', None)):
        t = g(r, a)
        if t:
            tels.append({'num': t, 'type': g(r, b) if b else ''})
    o, n = g(r, 'Organisation'), g(r, 'Nom')
    contacts.append({
        'id': int(float(g(r, 'ID'))),
        'nom': n, 'organisation': o,
        'email': g(r, 'E-mail').lower(),
        'tels': tels,
        'cp': g(r, 'Code postal'), 'ville': g(r, 'Ville'),
        'dept': g(r, 'Dépt'), 'deptNom': g(r, 'Département'),
        'fiabilite': FIAB.get(g(r, 'Statut'), 'a_controler'),
        'aVerifier': g(r, 'Champs à contrôler'),
        'signalements': g(r, 'Signalements'),
        'cpBrut': g(r, 'CP brut (non conforme)'),
        'photo': g(r, 'Photo'),
        'metierSuggere': metier(o, n),
    })

with open(DST, 'w', encoding='utf-8') as f:
    json.dump(contacts, f, ensure_ascii=False, separators=(',', ':'))

print(len(contacts), 'contacts ->', os.path.abspath(DST))
print('metiers suggeres :', collections.Counter(c['metierSuggere'] for c in contacts).most_common())
print('fiabilite :', collections.Counter(c['fiabilite'] for c in contacts))
