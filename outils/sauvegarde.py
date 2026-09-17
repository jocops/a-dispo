#!/usr/bin/env python3
"""Sauvegarde de la base a dispo, avec un chemin de retour PROUVE.

POURQUOI CET OUTIL EXISTE
=========================
Le devis signe N 20260910-1 vend, ligne 1 du lot « Mise en route » :

    « sauvegarde quotidienne conservee 30 jours, et restauration verifiee une
      fois. Une sauvegarde qu'on n'a jamais restauree n'est pas une sauvegarde. »

Releve du 17/09/2026 sur la production :

  - l'API de Supabase ne liste AUCUNE sauvegarde, et la restauration dans le
    temps (PITR) est desactivee ;
  - le seul fichier produit chaque soir est `~/Sauvegardes/adispo-crm/*.json`,
    par `sauvegarde-crm.py`, et il ne contient QU'UNE table sur 33 : `contacts` ;
  - ce fichier n'a aucun chemin de retour. Le seul importateur du produit,
    crm/src/app.js:1520-1533, lit une clef `travail` que le fichier ne porte
    pas : la restauration annonce « 7 fiches » (les 7 clefs de metadonnees),
    fabrique des identifiants NaN, et se fait refuser ligne par ligne sans
    qu'aucune erreur ne remonte.

Autrement dit : 33 tables sur 33 sont sans filet, et la seule qui est copiee
ne peut pas revenir. Ce script remplace cet etat.

CE QU'IL GARANTIT
=================
1. Il copie TOUTES les tables du schema `public`, pas une.
2. Il ecrit une empreinte SHA-256 a cote de chaque fichier : une sauvegarde
   silencieusement tronquee se voit.
3. Il sait PROUVER qu'elle revient (`--eprouver`), et il le prouve sans jamais
   ecrire dans `public` : il restaure dans un schema jetable, relit, compare
   les empreintes table par table, puis supprime le schema.
4. Il garde 30 fichiers et supprime les plus vieux.
5. Il sort en code 1 quand quelque chose a rate, pour qu'un planificateur le
   voie. Un echec ecrit dans un journal que personne n'ouvre n'est pas un echec
   signale.

NON DESTRUCTIF
==============
`--sauver`, `--verifier` et `--eprouver` n'ecrivent JAMAIS dans `public`.
`--restaurer` est un blanc par defaut : il dit ce qu'il ecrirait et s'arrete.
Il faut `--vraiment` ET une table nommee pour qu'une ligne de production bouge.

USAGE
=====
    python3 outils/sauvegarde.py --sauver
    python3 outils/sauvegarde.py --verifier
    python3 outils/sauvegarde.py --eprouver            # la preuve du retour
    python3 outils/sauvegarde.py --restaurer <fichier> --table reglages
    python3 outils/sauvegarde.py --restaurer <fichier> --table reglages --vraiment

Les accès sont lus dans ~/.config/adispo/supabase.env (chmod 600, hors dépôt) :
SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_PAT.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
import re
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Il manque `requests` : python3 -m pip install requests")

CONFIG = Path.home() / ".config" / "adispo" / "supabase.env"
DESTINATION = Path.home() / "Sauvegardes" / "adispo"
GARDER = 30
SCHEMA_ESSAI = "verif_restauration"
PAQUET = 200  # lignes par instruction d'insertion, pour ne pas depasser l'API

# Ces tables sont des dependances de Supabase ou des vues materialisees : on ne
# les recopie pas, elles se reconstruisent. La liste est VIDE pour l'instant et
# existe pour que l'exclusion soit un choix ecrit, pas un oubli silencieux.
HORS_SAUVEGARDE: tuple[str, ...] = ()


# ----------------------------------------------------------------- les accès

def lire_config() -> dict:
    """Lit le fichier d'accès sans jamais afficher une valeur."""
    if not CONFIG.exists():
        sys.exit(f"Fichier d'accès introuvable : {CONFIG}")
    mode = oct(CONFIG.stat().st_mode)[-3:]
    if mode != "600":
        print(f"  ATTENTION : {CONFIG} est en {mode}, il devrait être en 600.")
    valeurs = {}
    for ligne in CONFIG.read_text(encoding="utf-8").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        cle, _, val = ligne.partition("=")
        valeurs[cle.strip()] = val.strip().strip('"').strip("'")
    for oblige in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_PAT"):
        if not valeurs.get(oblige):
            sys.exit(f"{oblige} manque dans {CONFIG}")
    valeurs["REF"] = valeurs["SUPABASE_URL"].split("//")[1].split(".")[0]
    return valeurs


def sql(cfg: dict, requete: str) -> list:
    """Exécute du SQL par l'API de gestion. Lève si la base répond une erreur."""
    r = requests.post(
        f"https://api.supabase.com/v1/projects/{cfg['REF']}/database/query",
        headers={"Authorization": "Bearer " + cfg["SUPABASE_PAT"],
                 "Content-Type": "application/json"},
        json={"query": requete}, timeout=180)
    if r.status_code >= 400:
        # Le corps porte la VRAIE cause ; le code HTTP seul ne dit rien.
        try:
            detail = r.json().get("message", r.text)
        except Exception:
            detail = r.text
        raise RuntimeError(re.sub(r"\s+", " ", str(detail))[:220])
    rep = r.json()
    if isinstance(rep, dict) and "message" in rep:
        raise RuntimeError(rep["message"])
    return rep


# ------------------------------------------------------- lire ce qu'il y a

def inventaire(cfg: dict) -> list[dict]:
    """Les tables du schéma public, avec leur clé de tri stable.

    Le tri est ce qui rend une empreinte comparable d'une fois sur l'autre :
    sans lui, PostgreSQL peut rendre les mêmes lignes dans un autre ordre et
    deux sauvegardes identiques auraient deux empreintes différentes.
    """
    lignes = sql(cfg, """
        select c.relname as table_, c.reltuples::bigint as estimation,
               coalesce((
                 select string_agg(a.attname, ',' order by k.n)
                 from pg_index i
                 join lateral unnest(i.indkey) with ordinality as k(attnum, n) on true
                 join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
                 where i.indrelid = c.oid and i.indisprimary
               ), '') as cle
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by c.relname""")
    return [t for t in lignes if t["table_"] not in HORS_SAUVEGARDE]


def colonnes_insertables(cfg: dict) -> dict[str, list[str]]:
    """Les colonnes de chaque table où l'on a le droit d'écrire.

    POURQUOI CE DETOUR. La première version insérait par `select *`, et une
    table sur 33 refusait de revenir : `inscriptions.email_norme` est une
    colonne GENEREE (`lower(btrim(email))`), et PostgreSQL interdit d'y écrire
    une valeur, même la bonne. Nommer les colonnes règle le cas à la racine :
    la colonne générée se recalcule toute seule à l'insertion, et comme elle se
    recalcule à l'identique, l'empreinte relue colle toujours.
    """
    lignes = sql(cfg, """
        select table_name as table_, column_name as colonne
        from information_schema.columns
        where table_schema = 'public' and is_generated <> 'ALWAYS'
        order by table_name, ordinal_position""")
    par_table: dict[str, list[str]] = {}
    for l in lignes:
        par_table.setdefault(l["table_"], []).append(l["colonne"])
    return par_table


def lire_table(cfg: dict, nom: str, cle: str) -> list[dict]:
    """Lit toutes les lignes d'une table, page par page, avec la clé de service.

    On passe par PostgREST et non par l'API de gestion : c'est le chemin de
    données, il pagine proprement et il ne tronque pas les gros contenus.
    La clé de service contourne les règles d'accès par ligne, ce qui est
    exactement ce qu'une sauvegarde doit faire.
    """
    tri = "&order=" + ",".join(f"{c}.asc" for c in cle.split(",")) if cle else ""
    entetes = {"apikey": cfg["SUPABASE_SERVICE_KEY"],
               "Authorization": "Bearer " + cfg["SUPABASE_SERVICE_KEY"],
               "Accept-Profile": "public"}
    tout, pas, depart = [], 1000, 0
    while True:
        url = f"{cfg['SUPABASE_URL']}/rest/v1/{nom}?select=*{tri}&limit={pas}&offset={depart}"
        r = requests.get(url, headers=entetes, timeout=180)
        if r.status_code != 200:
            raise RuntimeError(f"{nom} : HTTP {r.status_code} {r.text[:160]}")
        page = r.json()
        tout.extend(page)
        if len(page) < pas:
            return tout
        depart += pas


def dollar(valeur) -> str:
    """Encadre du JSON en guillemets-dollar, avec une étiquette qu'il ne contient pas.

    Sans cela, un apostrophe dans une raison sociale casserait la requête, et un
    contenu bien choisi pourrait en écrire une autre.
    """
    charge = json.dumps(valeur, ensure_ascii=False, default=str)
    tag = "sv"
    while f"${tag}$" in charge:
        tag += "x"
    return f"${tag}${charge}${tag}$"


def empreinte(donnees) -> str:
    """SHA-256 d'une représentation canonique : même contenu, même empreinte."""
    brut = json.dumps(donnees, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), default=str)
    return hashlib.sha256(brut.encode("utf-8")).hexdigest()


# ------------------------------------------------------------------ sauver

def sauver(cfg: dict) -> int:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    tables = inventaire(cfg)
    print(f"\n  SAUVEGARDE a dispo, le {dt.datetime.now():%d/%m/%Y à %H:%M}")
    print(f"  {len(tables)} table(s) dans le schéma public\n")

    contenu, empreintes, rates, total = {}, {}, [], 0
    for t in tables:
        nom = t["table_"]
        try:
            lignes = lire_table(cfg, nom, t["cle"])
        except Exception as e:  # une table illisible ne doit pas tuer le reste
            rates.append((nom, str(e)[:90]))
            print(f"    {nom:32} ECHEC  {str(e)[:60]}")
            continue
        contenu[nom] = lignes
        empreintes[nom] = empreinte(lignes)
        total += len(lignes)
        print(f"    {nom:32} {len(lignes):6d} ligne(s)  {empreintes[nom][:12]}")

    jour = dt.date.today().isoformat()
    fichier = DESTINATION / f"adispo-{jour}.json.gz"
    paquet = {
        "projet": "a dispo",
        "base": cfg["REF"],
        "date": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "format": 2,
        "tables": sorted(contenu),
        "cles": {t["table_"]: t["cle"] for t in tables if t["table_"] in contenu},
        "empreintes": empreintes,
        "lignes_par_table": {n: len(v) for n, v in contenu.items()},
        "tables_en_echec": dict(rates),
        "donnees": contenu,
    }
    brut = json.dumps(paquet, ensure_ascii=False, default=str).encode("utf-8")
    with gzip.open(fichier, "wb") as f:
        f.write(brut)
    sceau = hashlib.sha256(fichier.read_bytes()).hexdigest()
    (DESTINATION / f"adispo-{jour}.sha256").write_text(
        f"{sceau}  {fichier.name}\n", encoding="utf-8")
    os.chmod(fichier, 0o600)

    print(f"\n    fichier    {fichier}")
    print(f"    poids      {fichier.stat().st_size/1024:.0f} Ko")
    print(f"    empreinte  {sceau[:24]}…")
    print(f"    total      {total} ligne(s) sur {len(contenu)} table(s)")

    retires = rotation()
    if retires:
        print(f"    rotation   {retires} fichier(s) de plus de {GARDER} jours retiré(s)")

    if rates:
        print(f"\n  ECHEC : {len(rates)} table(s) n'ont pas pu être lues :")
        for nom, err in rates:
            print(f"    x  {nom} : {err}")
        print("\n  La sauvegarde est INCOMPLÈTE.\n")
        return 1
    print("\n  Toutes les tables sont dans le fichier.")
    print("  Il reste à PROUVER le retour : python3 outils/sauvegarde.py --eprouver\n")
    return 0


def rotation() -> int:
    """Ne garde que les GARDER derniers jours. Les deux fichiers vont ensemble."""
    fichiers = sorted(DESTINATION.glob("adispo-*.json.gz"))
    retires = 0
    for vieux in fichiers[:-GARDER] if len(fichiers) > GARDER else []:
        sidecar = vieux.with_name(vieux.name.replace(".json.gz", ".sha256"))
        vieux.unlink(missing_ok=True)
        sidecar.unlink(missing_ok=True)
        retires += 1
    return retires


# --------------------------------------------------------------- vérifier

def dernier() -> Path | None:
    f = sorted(DESTINATION.glob("adispo-*.json.gz"))
    return f[-1] if f else None


def ouvrir(fichier: Path) -> dict:
    with gzip.open(fichier, "rb") as f:
        return json.loads(f.read().decode("utf-8"))


def verifier(cfg: dict, fichier: Path | None = None) -> int:
    fichier = fichier or dernier()
    if not fichier:
        print(f"\n  Aucune sauvegarde dans {DESTINATION}.\n")
        return 1
    print(f"\n  VERIFICATION de {fichier.name}\n")

    sidecar = fichier.with_name(fichier.name.replace(".json.gz", ".sha256"))
    reel = hashlib.sha256(fichier.read_bytes()).hexdigest()
    if sidecar.exists():
        attendu = sidecar.read_text(encoding="utf-8").split()[0]
        ok = reel == attendu
        print(f"    sceau du fichier           {'ok' if ok else 'ALTERE'}")
        if not ok:
            print(f"      attendu {attendu[:24]}…\n      lu      {reel[:24]}…")
            return 1
    else:
        print("    sceau du fichier           ABSENT (fichier non scellé)")

    p = ouvrir(fichier)
    print(f"    écrit le                   {p['date']}")
    print(f"    tables dans le fichier     {len(p['tables'])}\n")

    ecarts = 0
    vivant = {t["table_"]: t for t in inventaire(cfg)}
    comptes = {r["table_"]: r["n"] for r in sql(cfg, " union all ".join(
        f"select '{n}' as table_, count(*)::bigint as n from public.{n}"
        for n in p["tables"]))}

    for nom in p["tables"]:
        dans = p["lignes_par_table"][nom]
        e = empreinte(p["donnees"][nom])
        integre = e == p["empreintes"][nom]
        maintenant = comptes.get(nom)
        if not integre:
            print(f"    {nom:30} CONTENU ALTERE dans le fichier")
            ecarts += 1
            continue
        if nom not in vivant:
            print(f"    {nom:30} {dans:6d} sauvées, table DISPARUE de la base")
            ecarts += 1
            continue
        drift = "" if maintenant == dans else f"  (la base en a {maintenant} aujourd'hui)"
        print(f"    {nom:30} {dans:6d} ligne(s)  intègre{drift}")

    nouvelles = sorted(set(vivant) - set(p["tables"]))
    if nouvelles:
        print(f"\n    {len(nouvelles)} table(s) créée(s) depuis : {', '.join(nouvelles)}")
        print("    Elles ne sont pas dans ce fichier : relancer --sauver.")
        ecarts += len(nouvelles)

    if ecarts:
        print(f"\n  {ecarts} écart(s). Le fichier ne reflète plus la base.\n")
        return 1
    print("\n  Le fichier est intègre et complet.\n")
    return 0


# ---------------------------------------------------------------- éprouver

def eprouver(cfg: dict, fichier: Path | None = None) -> int:
    """LA PREUVE DU RETOUR, sans toucher à la production.

    On recrée chaque table dans un schéma jetable, on y réinjecte les lignes
    sauvées, on les relit, et on compare l'empreinte à celle du fichier. Si
    elles collent, la sauvegarde revient VRAIMENT. Puis on supprime le schéma.

    Le schéma jetable est la raison d'être de cette fonction : prouver une
    restauration en écrasant `public` ferait courir au projet exactement le
    risque contre lequel la sauvegarde existe.
    """
    fichier = fichier or dernier()
    if not fichier:
        print(f"\n  Aucune sauvegarde dans {DESTINATION}.\n")
        return 1
    p = ouvrir(fichier)
    print(f"\n  EPREUVE DE RESTAURATION, depuis {fichier.name}")
    print(f"  Schéma jetable : {SCHEMA_ESSAI}. `public` n'est jamais touché.\n")

    try:
        sql(cfg, f"drop schema if exists {SCHEMA_ESSAI} cascade;"
                 f" create schema {SCHEMA_ESSAI};")
    except Exception as e:
        print(f"  Impossible de créer le schéma d'essai : {e}\n")
        return 1

    colonnes = colonnes_insertables(cfg)
    reussites, echecs = [], []
    try:
        for nom in p["tables"]:
            lignes = p["donnees"][nom]
            try:
                # `including all` reprend types, valeurs par défaut et contraintes.
                sql(cfg, f"create table {SCHEMA_ESSAI}.{nom} "
                         f"(like public.{nom} including defaults including generated);")
                cols = ", ".join(colonnes.get(nom, []))
                for i in range(0, len(lignes), PAQUET):
                    bloc = lignes[i:i + PAQUET]
                    sql(cfg, f"insert into {SCHEMA_ESSAI}.{nom} ({cols}) "
                             f"select {cols} from json_populate_recordset("
                             f"null::public.{nom}, {dollar(bloc)});")

                cle = p["cles"].get(nom) or ""
                tri = ("order by " + cle) if cle else ""
                relu = sql(cfg, f"select coalesce(json_agg(t{' '+tri if tri else ''}), "
                                f"'[]'::json) as j from {SCHEMA_ESSAI}.{nom} t")
                rendu = relu[0]["j"] if relu else []
                if isinstance(rendu, str):
                    rendu = json.loads(rendu)

                if empreinte(rendu) == p["empreintes"][nom]:
                    reussites.append(nom)
                    print(f"    {nom:30} {len(lignes):6d} ligne(s)  RESTAUREE, empreinte identique")
                else:
                    echecs.append((nom, f"{len(rendu)} ligne(s) relues sur {len(lignes)}, empreinte differente"))
                    print(f"    {nom:30} {len(lignes):6d} ligne(s)  ECART : l'empreinte ne colle pas")
            except Exception as e:
                echecs.append((nom, str(e)[:110]))
                print(f"    {nom:30} ECHEC  {str(e)[:60]}")
    finally:
        try:
            sql(cfg, f"drop schema if exists {SCHEMA_ESSAI} cascade;")
            print(f"\n    schéma d'essai supprimé")
        except Exception as e:
            print(f"\n    ATTENTION : le schéma {SCHEMA_ESSAI} n'a pas pu être supprimé : {e}")

    print(f"\n  {len(reussites)} table(s) reviennent à l'identique, {len(echecs)} en échec.")
    if echecs:
        print("\n  CE QUI NE REVIENT PAS :\n")
        for nom, err in echecs:
            print(f"    x  {nom} : {err}")
        print("\n  La restauration N'EST PAS prouvée. La ligne du devis n'est pas tenue.\n")
        return 1
    print("\n  Restauration prouvée sur l'intégralité du fichier, ce jour.")
    print("  C'est ce que le devis appelle « une restauration vérifiée ».\n")
    return 0


# --------------------------------------------------------------- restaurer

def restaurer(cfg: dict, fichier: Path, table: str, vraiment: bool) -> int:
    p = ouvrir(fichier)
    if table not in p["donnees"]:
        print(f"\n  `{table}` n'est pas dans {fichier.name}.")
        print(f"  Tables disponibles : {', '.join(p['tables'])}\n")
        return 1
    lignes = p["donnees"][table]
    actuel = sql(cfg, f"select count(*)::bigint as n from public.{table}")[0]["n"]

    print(f"\n  RESTAURATION de public.{table}, depuis {fichier.name}")
    print(f"    sauvegardé le              {p['date']}")
    print(f"    lignes dans la sauvegarde  {len(lignes)}")
    print(f"    lignes dans la base        {actuel}")

    if not vraiment:
        print("\n  BLANC : rien n'a été écrit.")
        print(f"  Ce geste EFFACERAIT les {actuel} ligne(s) actuelles pour y remettre"
              f" les {len(lignes)} sauvegardées.")
        print("  Pour l'exécuter vraiment, ajouter --vraiment.\n")
        return 0

    print(f"\n  ECRITURE REELLE sur public.{table}…")
    cols = ", ".join(colonnes_insertables(cfg).get(table, []))
    sql(cfg, f"delete from public.{table};")
    for i in range(0, len(lignes), PAQUET):
        bloc = lignes[i:i + PAQUET]
        sql(cfg, f"insert into public.{table} ({cols}) select {cols} from "
                 f"json_populate_recordset(null::public.{table}, {dollar(bloc)});")
    apres = sql(cfg, f"select count(*)::bigint as n from public.{table}")[0]["n"]
    print(f"    lignes après               {apres}")
    if apres != len(lignes):
        print("\n  ECHEC : le compte ne tombe pas juste.\n")
        return 1
    print("\n  Restauration faite.\n")
    return 0


# -------------------------------------------------------------------- main

def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description="Sauvegarde de la base a dispo, avec un chemin de retour prouvé.")
    ap.add_argument("--sauver", action="store_true", help="copier toutes les tables")
    ap.add_argument("--verifier", action="store_true", help="intégrité du dernier fichier")
    ap.add_argument("--eprouver", action="store_true",
                    help="prouver le retour dans un schéma jetable (ne touche pas public)")
    ap.add_argument("--restaurer", metavar="FICHIER", help="restaurer une table depuis un fichier")
    ap.add_argument("--table", help="la table à restaurer")
    ap.add_argument("--vraiment", action="store_true",
                    help="exécuter vraiment la restauration au lieu d'un blanc")
    a = ap.parse_args(argv[1:])
    cfg = lire_config()

    if a.sauver:
        return sauver(cfg)
    if a.verifier:
        return verifier(cfg)
    if a.eprouver:
        return eprouver(cfg)
    if a.restaurer:
        if not a.table:
            print("\n  --restaurer demande --table. On ne restaure pas 33 tables"
                  " d'un geste : chaque table est une décision.\n")
            return 1
        return restaurer(cfg, Path(a.restaurer), a.table, a.vraiment)

    ap.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
