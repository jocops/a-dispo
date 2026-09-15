#!/usr/bin/env python3
"""Controle les 1 374 fiches : e-mail, telephone, site web, nom et societe.

Ce que cet outil verifie VRAIMENT, et ce qu'il ne verifie pas.

Il verifie la forme et la coherence interne : une adresse mal ecrite, un numero
qui n'a pas dix chiffres, un indicatif regional qui ne colle pas au departement,
un domaine impossible, un nom vide ou identique a la societe, un doublon. Avec
--reseau il verifie en plus que les domaines des sites existent reellement (DNS)
et repondent (HTTP).

Il ne verifie PAS que l'adresse appartient a cette entreprise, ni que le numero
est le bon. Cela ne se sait qu'en appelant ou en ecrivant. Un controle de forme
ne remplace pas un appel, il evite d'en gaspiller.

Chaque anomalie porte un niveau :
  bloquant  la fiche est inutilisable telle quelle (ni mail ni telephone valide)
  serieux   la donnee est probablement fausse (indicatif incoherent, faute de
            frappe sur un domaine connu, domaine qui n'existe pas)
  a voir    c'est peut-etre normal (boite generique, numero partage, nom en un mot)

Usage :
    python3 crm/outils/verifier-contacts.py               # controle hors ligne
    python3 crm/outils/verifier-contacts.py --reseau      # + DNS et HTTP des sites
    python3 crm/outils/verifier-contacts.py --lot 50      # sortie par lots de 50
    python3 crm/outils/verifier-contacts.py --csv         # ecrit le rapport en CSV
"""

from __future__ import annotations

import collections
import csv
import json
import os
import re
import socket
import subprocess
import sys
import unicodedata

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(RACINE, "contacts.json")

# Domaines de messagerie grand public : une adresse chez eux n'est pas une erreur,
# mais elle ne dit rien de l'entreprise et aucun site ne s'en deduit.
GENERIQUES = {
    "gmail.com", "googlemail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr",
    "yahoo.fr", "yahoo.com", "yahoo.es", "orange.fr", "orange.com", "wanadoo.fr", "free.fr",
    "sfr.fr", "neuf.fr", "laposte.net", "live.fr", "live.com", "icloud.com", "me.com",
    "mac.com", "aol.com", "bbox.fr", "numericable.fr", "club-internet.fr", "voila.fr",
    "msn.com", "gmx.fr", "gmx.com", "protonmail.com", "proton.me", "alice.fr",
    "cegetel.net", "noos.fr", "libertysurf.fr", "aliceadsl.fr", "9online.fr", "tiscali.fr",
}

# Fautes de frappe frequentes sur les domaines grand public. La cle est la faute,
# la valeur la forme correcte. Releve sur des bases de prospection reelles.
FAUTES = {
    "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.fr": "gmail.com",
    "gmail.co": "gmail.com", "gamil.com": "gmail.com", "gmaill.com": "gmail.com",
    "hotmial.fr": "hotmail.fr", "hotmai.fr": "hotmail.fr", "hotmail.f": "hotmail.fr",
    "orange.f": "orange.fr", "oranges.fr": "orange.fr", "orenge.fr": "orange.fr",
    "wanadoo.f": "wanadoo.fr", "wanadooo.fr": "wanadoo.fr", "wandoo.fr": "wanadoo.fr",
    "yahoo.f": "yahoo.fr", "laposte.fr": "laposte.net", "outlook.f": "outlook.fr",
    "free.f": "free.fr", "sfr.f": "sfr.fr",
}

# Indicatif fixe attendu par departement. En France metropolitaine le premier
# chiffre apres le 0 depend de la zone : 1 Ile-de-France, 2 Nord-Ouest,
# 3 Nord-Est, 4 Sud-Est, 5 Sud-Ouest. Un 04 sur un departement breton est une
# anomalie reelle, pas une coquetterie.
ZONES = {
    "1": {"75", "77", "78", "91", "92", "93", "94", "95"},
    "2": {"14", "18", "22", "27", "28", "29", "35", "36", "37", "41", "44", "45", "49",
          "50", "53", "56", "61", "72", "76", "85"},
    "3": {"02", "08", "10", "21", "25", "39", "51", "52", "54", "55", "57", "58", "59",
          "60", "62", "67", "68", "70", "80", "88", "89", "90"},
    # 03 Allier (Montlucon 04 70) et 15 Cantal (Aurillac 04 71) sont en zone 04,
    # pas 05 : l'Auvergne telephone au Sud-Est. Corrige apres 56 fausses alertes.
    # Le Languedoc telephone au Sud-Est : Aude 11 (Carcassonne 04 68) et
    # Pyrenees-Orientales 66 (Perpignan 04 68) sont en zone 04. Corrige apres
    # 14 fausses alertes sur les seules fiches de Carcassonne.
    "4": {"01", "03", "04", "05", "06", "07", "11", "13", "15", "20", "26", "2A", "2B",
          "30", "34", "38", "42", "43", "48", "63", "66", "69", "71", "73", "74", "83", "84"},
    # Deux-Sevres 79 (Niort) et Vienne 86 (Poitiers) telephonent en 05 49.
    "5": {"09", "12", "16", "17", "19", "23", "24", "31", "32", "33", "40", "46", "47",
          "64", "65", "79", "81", "82", "86", "87"},
}

RE_EMAIL = re.compile(r"^[A-Za-z0-9._%+\-']+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
RE_DOMAINE = re.compile(r"^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$")
TRONQUE = ("…", "...", "..")


def sans_accent(s: str) -> str:
    return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode()


def chiffres(s) -> str:
    return re.sub(r"\D", "", str(s or ""))


def site_de(c: dict) -> str:
    """Le domaine du site, comme le CRM le calcule a l'affichage.

    Il n'est PAS stocke dans contacts.json : il se deduit du domaine de l'adresse
    professionnelle, et seulement de celle-la. Sans ce calcul, le controle reseau
    ne trouvait aucun domaine a verifier, et l'annoncait fierement.
    """
    fix = (c.get("crm") or {}).get("fix") or {}
    if fix.get("site"):
        return str(fix["site"]).strip().lower()
    m = re.search(r"@([a-z0-9.\-]+\.[a-z]{2,})$", str(c.get("email") or "").strip(), re.I)
    if not m:
        return ""
    d = m.group(1).lower()
    return "" if d in GENERIQUES else d


def controler(contacts: list[dict]) -> list[dict]:
    """Retourne une anomalie par ligne : {id, champ, niveau, quoi, valeur}."""
    anomalies = []
    par_email = collections.defaultdict(list)
    par_tel = collections.defaultdict(list)
    for c in contacts:
        if c.get("email"):
            par_email[c["email"].strip().lower()].append(c["id"])
        for t in c.get("tels") or []:
            n = chiffres(t.get("num"))
            if len(n) >= 9:
                par_tel[n[-9:]].append(c["id"])

    for c in contacts:
        cid = c["id"]
        def note(champ, niveau, quoi, valeur=""):
            anomalies.append({"id": cid, "champ": champ, "niveau": niveau,
                              "quoi": quoi, "valeur": str(valeur)[:80],
                              "societe": (c.get("organisation") or c.get("nom") or "")[:40]})

        # ---------------------------------------------------------------- e-mail
        mail = (c.get("email") or "").strip()
        if not mail:
            note("e-mail", "a voir", "aucune adresse")
        else:
            if any(t in mail for t in TRONQUE):
                note("e-mail", "bloquant", "adresse coupee a l'ecran", mail)
            elif not RE_EMAIL.match(mail):
                note("e-mail", "bloquant", "adresse mal formee", mail)
            else:
                dom = mail.split("@")[1].lower()
                if dom in FAUTES:
                    note("e-mail", "serieux", f"faute de frappe probable, lire {FAUTES[dom]}", mail)
                if mail != mail.lower():
                    note("e-mail", "a voir", "majuscules dans l'adresse", mail)
                if dom in GENERIQUES:
                    note("e-mail", "a voir", "boite grand public, aucun site deductible", dom)
                if len(par_email[mail.lower()]) > 1:
                    note("e-mail", "serieux", f"adresse partagee avec {len(par_email[mail.lower()]) - 1} autre(s) fiche(s)", mail)

        # ------------------------------------------------------------ telephones
        tels = c.get("tels") or []
        if not tels:
            note("telephone", "a voir", "aucun numero")
        for t in tels:
            brut = str(t.get("num") or "")
            n = chiffres(brut)
            if any(x in brut for x in TRONQUE):
                note("telephone", "bloquant", "numero coupe a l'ecran", brut)
                continue
            if len(n) == 11 and n.startswith("33"):
                n = "0" + n[2:]
            if len(n) != 10:
                note("telephone", "bloquant", f"{len(n)} chiffres au lieu de 10", brut)
                continue
            if not n.startswith("0") or n[1] not in "123456789":
                note("telephone", "bloquant", "indicatif impossible", brut)
                continue
            dep = (c.get("dept") or "").strip()
            if n[1] in ZONES and dep and dep not in ZONES[n[1]]:
                zone = {"1": "Ile-de-France", "2": "Nord-Ouest", "3": "Nord-Est",
                        "4": "Sud-Est", "5": "Sud-Ouest"}[n[1]]
                note("telephone", "serieux",
                     f"fixe en 0{n[1]} ({zone}) alors que la fiche est en {dep}", brut)
            if len(par_tel[n[-9:]]) > 1:
                note("telephone", "serieux",
                     f"numero partage avec {len(par_tel[n[-9:]]) - 1} autre(s) fiche(s)", brut)

        # ---------------------------------------------------------------- societe
        org = (c.get("organisation") or "").strip()
        nom = (c.get("nom") or "").strip()
        if not org and not nom:
            note("societe", "bloquant", "ni societe ni personne")
        if org and any(t in org for t in TRONQUE):
            note("societe", "serieux", "raison sociale coupee a l'ecran", org)
        if org and re.search(r"\b(hors activit|ne pas|ferme|retraite|doublon|test)\b", sans_accent(org).lower()):
            note("societe", "serieux", "ce n'est pas une raison sociale mais une note", org)

        # ---------------------------------------------------------------- personne
        if nom:
            if any(t in nom for t in TRONQUE):
                note("personne", "serieux", "nom coupe a l'ecran", nom)
            if re.search(r"\d", nom):
                note("personne", "a voir", "chiffre dans le nom", nom)
            if org and sans_accent(nom).lower() == sans_accent(org).lower():
                note("personne", "a voir", "le nom repete la societe", nom)
            if len(nom.split()) == 1 and not re.match(r"^(M\.|Mme|Mr)", nom):
                note("personne", "a voir", "un seul mot, prenom ou nom manquant", nom)
        elif org:
            note("personne", "a voir", "aucune personne, seulement la societe", org)

        # ---------------------------------------------------------------- site web
        site = site_de(c)
        if site:
            if not RE_DOMAINE.match(site):
                note("site", "serieux", "domaine mal forme", site)
            elif site.split(".")[-1] in ("f", "co", "fr1"):
                note("site", "serieux", "extension suspecte", site)
    return anomalies


def doublons(contacts: list[dict]) -> list[list[dict]]:
    """Regroupe les fiches qui designent probablement la meme entreprise.

    Trois liens, du plus sur au moins sur : le meme numero de telephone, la meme
    adresse e-mail non generique, ou la meme raison sociale comparee sans accents,
    sans ponctuation et sans forme juridique. Les groupes sont fusionnes de proche
    en proche : deux fiches liees par un telephone et deux autres par un nom
    forment un seul groupe si elles se recoupent.
    """
    def cle_nom(s):
        s = sans_accent(s).upper()
        s = re.sub(r"\b(SARL|SAS|SASU|EURL|SA|SCI|SNC|EI|EIRL|ETS|ETABLISSEMENTS|STE|SOCIETE|GROUPE|MONSIEUR|MADAME)\b", " ", s)
        s = re.sub(r"[^A-Z0-9]", "", s)
        return s

    liens = {}          # cle -> [ids]
    for c in contacts:
        org = (c.get("organisation") or "").strip()
        if org and len(cle_nom(org)) >= 4:
            liens.setdefault("n:" + cle_nom(org), []).append(c["id"])
        mail = (c.get("email") or "").strip().lower()
        if mail and "@" in mail and mail.split("@")[1] not in GENERIQUES:
            liens.setdefault("m:" + mail, []).append(c["id"])
        for t in c.get("tels") or []:
            n = chiffres(t.get("num"))
            if len(n) == 10:
                liens.setdefault("t:" + n, []).append(c["id"])

    # union-find : deux fiches reliees par n'importe quel lien vont ensemble
    parent = {c["id"]: c["id"] for c in contacts}
    def racine(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    for ids in liens.values():
        if len(ids) < 2:
            continue
        a = racine(ids[0])
        for b in ids[1:]:
            parent[racine(b)] = a

    groupes = collections.defaultdict(list)
    par_id = {c["id"]: c for c in contacts}
    for cid in parent:
        groupes[racine(cid)].append(par_id[cid])
    return sorted([g for g in groupes.values() if len(g) > 1],
                  key=lambda g: (-len(g), g[0]["id"]))


def controle_reseau(contacts: list[dict]) -> list[dict]:
    """Le domaine existe-t-il, et repond-il ? C'est la seule verification de ce
    fichier qui interroge le monde exterieur. curl et non urllib : sur cette
    machine Python n'a pas de magasin d'autorites (voir resoudre-villes.py)."""
    anomalies = []
    domaines = {}
    for c in contacts:
        s = site_de(c)
        if s:
            domaines.setdefault(s, []).append(c)
    print(f"controle reseau de {len(domaines)} domaines...")
    for i, (dom, fiches) in enumerate(sorted(domaines.items()), 1):
        if i % 50 == 0:
            print(f"  {i}/{len(domaines)}")
        try:
            socket.setdefaulttimeout(6)
            socket.gethostbyname(dom)
        except Exception:
            for c in fiches:
                anomalies.append({"id": c["id"], "champ": "site", "niveau": "serieux",
                                  "quoi": "ce domaine n'existe pas (aucune adresse DNS)",
                                  "valeur": dom, "societe": (c.get("organisation") or "")[:40]})
            continue
        r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-m", "12", "-L",
                            "-w", "%{http_code}", f"https://{dom}"],
                           capture_output=True, text=True)
        code = (r.stdout or "").strip()
        if code in ("000", ""):
            for c in fiches:
                anomalies.append({"id": c["id"], "champ": "site", "niveau": "a voir",
                                  "quoi": "le domaine existe mais le site ne repond pas",
                                  "valeur": dom, "societe": (c.get("organisation") or "")[:40]})
        elif code.startswith(("4", "5")) and code != "403":
            for c in fiches:
                anomalies.append({"id": c["id"], "champ": "site", "niveau": "a voir",
                                  "quoi": f"le site repond {code}", "valeur": dom,
                                  "societe": (c.get("organisation") or "")[:40]})
    return anomalies


def ecrire_etat_des_sites(contacts: list[dict], anomalies: list[dict]) -> int:
    """Inscrit dans chaque fiche l'etat reel de son domaine.

    Le CRM affichait un lien vers le site des qu'un domaine se deduisait de
    l'adresse e-mail. Mesure du 5 septembre 2026 : sur 371 domaines ainsi
    deduits, 67 n'existent pas du tout et 90 ne repondent pas. Un lien mort dans
    une liste d'appel fait perdre du temps et donne l'air amateur. Le champ
    `siteEtat` permet au CRM de ne proposer le lien que lorsqu'il mene quelque
    part, et d'offrir une recherche sinon.

      repond   le site a repondu, le lien est bon
      muet     le domaine existe mais rien ne repond
      absent   le domaine n'existe pas (aucune adresse DNS)
    """
    etat = {}
    for a in anomalies:
        if a["champ"] != "site":
            continue
        if "n'existe pas" in a["quoi"]:
            etat[a["id"]] = "absent"
        elif "ne repond pas" in a["quoi"] or "repond" in a["quoi"]:
            etat.setdefault(a["id"], "muet")
    n = 0
    for c in contacts:
        d = site_de(c)
        if not d:
            c.pop("siteEtat", None)
            continue
        nouveau = etat.get(c["id"], "repond")
        if c.get("siteEtat") != nouveau:
            c["siteEtat"] = nouveau
            n += 1
    json.dump(contacts, open(BASE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return n


def main() -> None:
    contacts = json.load(open(BASE, encoding="utf-8"))
    print(f"{len(contacts)} fiches lues\n")
    anomalies = controler(contacts)
    if "--reseau" in sys.argv:
        anomalies += controle_reseau(contacts)

    grp = doublons(contacts)
    fiches_en_double = sum(len(g) for g in grp)
    print(f"DOUBLONS : {len(grp)} groupes, {fiches_en_double} fiches, "
          f"soit {fiches_en_double - len(grp)} fiches en trop si on ne garde qu'une par entreprise\n")
    for g in grp[:12]:
        print(f"  groupe de {len(g)} :")
        for c in g:
            t = ", ".join(x["num"] for x in (c.get("tels") or []))[:34]
            print(f"    {c['id']:5} {str(c.get('organisation') or '')[:30]:32} {str(c.get('nom') or '')[:20]:22} {str(c.get('email') or '')[:30]:32} {t}")
    if len(grp) > 12:
        print(f"  ... et {len(grp) - 12} autres groupes\n")

    par_niveau = collections.Counter(a["niveau"] for a in anomalies)
    touchees = len({a["id"] for a in anomalies})
    bloquantes = len({a["id"] for a in anomalies if a["niveau"] == "bloquant"})
    print("=" * 66)
    print(f"{len(anomalies)} anomalies sur {touchees} fiches ({len(contacts) - touchees} fiches sans reproche)")
    for n in ("bloquant", "serieux", "a voir"):
        print(f"  {n:10} {par_niveau.get(n, 0)}")
    print(f"\nfiches inutilisables telles quelles : {bloquantes}")
    print("=" * 66)

    print("\nPar type d'anomalie :")
    for (champ, quoi, niveau), n in collections.Counter(
            (a["champ"], re.sub(r"\d+", "N", a["quoi"]), a["niveau"]) for a in anomalies).most_common():
        print(f"  {n:5}  [{niveau:9}] {champ:11} {quoi}")

    lot = 0
    for arg in sys.argv:
        if arg.startswith("--lot"):
            lot = int(sys.argv[sys.argv.index(arg) + 1]) if arg == "--lot" else int(arg.split("=")[1])
    if lot:
        graves = [a for a in anomalies if a["niveau"] in ("bloquant", "serieux")]
        graves.sort(key=lambda a: (a["niveau"] != "bloquant", a["id"]))
        print(f"\n{len(graves)} anomalies bloquantes ou serieuses, par lots de {lot} :")
        for d in range(0, len(graves), lot):
            print(f"\n--- lot {d // lot + 1} : fiches {d + 1} a {min(d + lot, len(graves))} ---")
            for a in graves[d:d + lot]:
                print(f"  {a['id']:5} [{a['niveau']:9}] {a['champ']:11} {a['societe'][:26]:28} {a['quoi']}  {a['valeur']}")

    if "--corriger" in sys.argv:
        if "--reseau" not in sys.argv:
            sys.exit("--corriger exige --reseau : sans le controle reseau, l'etat des sites n'est pas connu.")
        n = ecrire_etat_des_sites(contacts, anomalies)
        etats = collections.Counter(c.get("siteEtat") for c in contacts if c.get("siteEtat"))
        print(f"\netat des sites inscrit dans {n} fiches : " + ", ".join(f"{k} {v}" for k, v in etats.most_common()))

    if "--csv" in sys.argv:
        chemin = os.path.join(RACINE, "controle-contacts.csv")
        with open(chemin, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["id", "societe", "champ", "niveau", "quoi", "valeur"], delimiter=";")
            w.writeheader()
            for a in sorted(anomalies, key=lambda a: (a["niveau"] != "bloquant", a["id"])):
                w.writerow(a)
        print(f"\nrapport ecrit : {chemin}")


if __name__ == "__main__":
    main()
