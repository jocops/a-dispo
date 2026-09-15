#!/usr/bin/env python3
"""Resout les villes tronquees de contacts.json a partir du code postal officiel.

Pourquoi cet outil existe : la base vient de photos d'un ecran Pipedrive, et
Pipedrive tronque lui-meme la colonne « CODE POSTAL » avec des points de
suspension. La ville arrive donc coupee (« 26600 Chante… »), et l'information
manquante n'est PAS dans les pixels : la reprendre sur la photo ne servirait a
rien. En revanche le code postal, lui, est entier. Croise avec la base officielle
des codes postaux, il designe une commune, et souvent une seule.

Ce n'est donc pas une devinette : c'est une deduction a partir de deux sources
publiques et datees, et chaque fiche corrigee porte la trace de cette source
dans le champ `villeSource`. La valeur tronquee d'origine est conservee dans
`villeBrut` : rien n'est perdu.

Sources, telechargees a la premiere execution puis mises en cache :
  - Base officielle des codes postaux (La Poste, via datanova) : CP -> commune INSEE
  - API Geo (etalab) : code INSEE -> nom correctement orthographie et accentue

Regle de decision, dans cet ordre :
  1. un seul CP a un seul nom de commune          -> resolu
  2. plusieurs communes, une seule dont le nom commence par le fragment visible
     (« Chante… » pour 26600) -> resolu
  3. le fragment visible correspond exactement a une commune du CP -> deja bon
  4. sinon -> laisse tel quel, signale en fin d'execution. On ne tranche pas.

L'equivalence SAINT / ST est traitee : La Poste ecrit « ST PERAY » la ou
Pipedrive affiche « Saint-P… ». Sans cela 27 fiches restaient indecidables.

Quand la ville est resolue, le fragment « ville tronquee » ou « CP tronque » est
retire des signalements de la fiche, les autres signalements sont conserves
intacts, et la fiche redevient « fiable » s'il ne reste plus rien a controler.

Idempotent : relancable sans effet sur les fiches deja resolues.
Non destructif : ecrit une sauvegarde horodatee a cote de contacts.json.

Usage :  python3 crm/outils/resoudre-villes.py [--essai]
         --essai : mesure et affiche, sans rien ecrire.
"""

from __future__ import annotations

import collections
import csv
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(RACINE, "contacts.json")
CACHE = os.path.join(RACINE, "outils", ".cache-communes")
CP_URL = "https://datanova.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/raw"
GEO_URL = "https://geo.api.gouv.fr/communes?fields=code,nom&format=json"


def telecharger(url: str, cible: str, quoi: str) -> str:
    """Telecharge par curl, et non par urllib.

    Mesure du 3 septembre 2026 sur cette machine : urllib echoue en
    CERTIFICATE_VERIFY_FAILED (« self-signed certificate in certificate chain »),
    le Python du framework n'ayant pas de magasin d'autorites et la connexion
    passant par un intermediaire TLS. curl utilise le magasin du systeme, qui
    lui fait confiance, et il est toujours present sur un Mac. On ne desactive
    jamais la verification : on prend l'outil qui verifie correctement.
    """
    if os.path.exists(cible) and os.path.getsize(cible) > 10000:
        return cible
    os.makedirs(os.path.dirname(cible), exist_ok=True)
    print(f"telechargement de {quoi}...")
    r = subprocess.run(["curl", "-sSL", "--fail", "-m", "180", "-o", cible, url],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(cible) or os.path.getsize(cible) < 10000:
        sys.exit(f"telechargement impossible ({quoi}) : {r.stderr.strip() or 'reponse trop courte'}")
    print(f"  {os.path.getsize(cible) // 1024} Ko")
    return cible


def cle(s) -> str:
    """Forme comparable : sans accent, sans ponctuation, SAINT ramene a ST."""
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().upper()
    s = re.sub(r"[^A-Z0-9]", "", s)
    s = re.sub(r"^SAINTE", "STE", s)
    s = re.sub(r"^SAINT", "ST", s)
    return s


def nettoyer_signalements(sig: str) -> str:
    """Retire ce qui parle de la ville ou du code postal, garde le reste mot pour mot."""
    parts = []
    for p in [q.strip() for q in (sig or "").split(";") if q.strip()]:
        frags = [f.strip() for f in p.split("|") if f.strip()]
        gardes = [
            f for f in frags
            if "ville tronqu" not in f.lower()
            and "cp tronqu" not in f.lower()
            and "cp et organisation" not in f.lower()
        ]
        # « CP et organisation tronques » : la moitie « organisation » doit survivre.
        if any("cp et organisation" in f.lower() for f in frags):
            gardes.append("organisation tronquée")
        if gardes:
            parts.append(" | ".join(gardes))
    return " ; ".join(parts)


def main() -> None:
    essai = "--essai" in sys.argv
    cp_csv = telecharger(CP_URL, os.path.join(CACHE, "codes-postaux.csv"), "la base des codes postaux (La Poste)")
    geo = telecharger(GEO_URL, os.path.join(CACHE, "communes.json"), "les noms de communes (API Geo)")

    # CP -> { nom comparable : (code INSEE, libelle) }. Un seul enregistrement par
    # commune reelle : la base La Poste repete un couple CP/commune une fois par
    # lieu-dit, et sans cette deduplication 84 fiches paraissaient ambigues.
    par_cp: dict[str, dict[str, tuple[str, str]]] = collections.defaultdict(dict)
    with open(cp_csv, encoding="latin-1") as f:
        for r in csv.DictReader(f, delimiter=";"):
            cp = (r.get("Code_postal") or "").strip()
            com = (r.get("Nom_de_la_commune") or "").strip()
            insee = (r.get("#Code_commune_INSEE") or "").strip()
            if cp and com:
                par_cp[cp].setdefault(cle(com), (insee, com))
    orthographe = {x["code"]: x["nom"] for x in json.load(open(geo, encoding="utf-8"))}
    print(f"sources : {len(par_cp)} codes postaux, {len(orthographe)} communes")

    contacts = json.load(open(BASE, encoding="utf-8"))
    resolues, indecidables = 0, []
    for x in contacts:
        sig = x.get("signalements") or ""
        if "ville tronqu" not in sig and "cp tronqu" not in sig.lower():
            continue
        cp = (x.get("cp") or "").strip()
        vue = (x.get("ville") or "").strip()
        communes = par_cp.get(cp, {})
        if len(cp) != 5 or not communes:
            indecidables.append((x, cp, vue, []))
            continue
        valeurs = list(communes.values())
        if len(valeurs) == 1:
            choix = valeurs[0]
        else:
            candidates = [v for k, v in communes.items() if vue and k.startswith(cle(vue))]
            if len(candidates) == 1:
                choix = candidates[0]
            elif cle(vue) in communes:
                choix = communes[cle(vue)]
            else:
                indecidables.append((x, cp, vue, [v[1] for v in (candidates or valeurs)]))
                continue
        nom = orthographe.get(choix[0], choix[1].title())
        if not essai:
            if vue and vue != nom:
                x["villeBrut"] = vue
            x["ville"] = nom
            x["villeSource"] = "code postal officiel (La Poste + INSEE)"
            x["signalements"] = nettoyer_signalements(sig)
            reste = [a.strip() for a in (x.get("aVerifier") or "").split(",")
                     if a.strip() and a.strip().lower() not in ("code postal", "ville")]
            x["aVerifier"] = ", ".join(reste)
            if not x["signalements"]:
                x["fiabilite"] = "fiable"
                x.pop("aVerifier", None)
        resolues += 1

    if not essai and resolues:
        horo = datetime.datetime.now().strftime("%Y-%m-%d-%H%M%S")
        sauvegarde = os.path.join(RACINE, f"contacts.avant-villes-{horo}.json")
        shutil.copy(BASE, sauvegarde)
        json.dump(contacts, open(BASE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"sauvegarde : {os.path.basename(sauvegarde)}")

    print(f"\nvilles resolues : {resolues}{' (essai, rien ecrit)' if essai else ''}")
    print(f"total de fiches portant villeSource : {sum(1 for x in contacts if x.get('villeSource'))}")
    print(f"\n{len(indecidables)} fiches que le code postal ne tranche pas, a confirmer autrement :")
    for x, cp, vue, cands in indecidables:
        print(f"  id {x['id']:5} {cp or '(vide)':6} « {vue} »  {cands[:4] if cands else 'code postal hors base'}")
    print("\nrepartition de la fiabilite :")
    for k, v in collections.Counter(x["fiabilite"] for x in contacts).most_common():
        print(f"  {k:16} {v}")
    print("\nRelancer python3 crm/outils/construire.py --sql pour reporter dans le CRM.")


if __name__ == "__main__":
    main()
