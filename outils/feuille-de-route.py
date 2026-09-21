#!/usr/bin/env python3
"""
Feuille de route « à dispo » : rend le Markdown a partir de etat.json.

POURQUOI DEUX FICHIERS. Le Markdown est pour les humains, le JSON pour la
comparaison. Sans le JSON, la section « ce qui a change » oblige a relire et
interpreter du texte, ce qui produit des faux ecarts.

POURQUOI UN IDENTIFIANT DERIVE DE L'URL. Le prompt impose un identifiant stable
et deterministe, de la forme <chantier>-<numero>. Le rang se calcule sur l'URL
Notion de la tache, qui ne change jamais, et jamais sur son intitule, qui se
reformule. Une tache renommee garde donc son identifiant, et l'historique tient.

  python3 outils/feuille-de-route.py            # rend le Markdown du jour
  python3 outils/feuille-de-route.py --diff     # compare au releve precedent
"""
import json, sys, os, glob
from datetime import date

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOSSIER = os.path.join(RACINE, "feuille-de-route")

SLUGS = {
    "Avant tout développement": "avant",
    "Compte rendu": "cr",
    "Devis et facturation": "devis",
    "Dossier de financement": "financement",
    "Marque et domaines": "marque",
    "Produit et technique": "produit",
    "Prospection": "prospection",
}
ORDRE_CHANTIER = ["avant", "marque", "financement", "produit", "devis", "prospection", "cr"]
ORDRE_ETAT = {"⛔ Bloquée": 0, "🔵 En cours": 1, "⬜ À faire": 2, "✅ Fait": 3}
ORDRE_PRIO = {"🔴 Bloquant": 0, "🟠 Important": 1, "🟢 Confort": 2}


def fr(x, dec=0):
    """Un nombre a la francaise : virgule decimale, espace insecable fin pour
    les milliers. « 37.5 jours » et « 6060 EUR » dans un document remis a une
    cliente sont des fautes, pas des details."""
    s = f"{x:,.{dec}f}".replace(",", "\u202f").replace(".", ",")
    return s


def charger(chemin):
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def precedent(courant):
    """Le releve anterieur le plus recent, ou None au premier passage."""
    fichiers = sorted(glob.glob(os.path.join(DOSSIER, "etat-*.json")))
    fichiers = [f for f in fichiers if os.path.basename(f) != os.path.basename(courant)]
    return charger(fichiers[-1]) if fichiers else None


def rendre(e, avant=None):
    """Le Markdown, section par section, dans l'ordre impose par le prompt."""
    m = e["meta"]
    t = e["taches"]
    par_id = {x["id"]: x for x in t}
    o = []
    A = o.append

    ouvertes = [x for x in t if x["etat"] != "✅ Fait"]
    bloquants = [x for x in ouvertes if x["priorite"] == "🔴 Bloquant"]

    # ---- A. L'en-tete -------------------------------------------------
    A(f"# Feuille de route « à dispo » · {m['releve']}")
    A("")
    A(f"> Relevé du {m['releve']} à {m['heure']}. "
      f"**{m['jours_calendaires']} jours** avant le {m['livraison']}, dont "
      f"**{m['jours_ouvres']} ouvrés**.")
    A("")
    A("## A. Où en est le contrat")
    A("")
    A(f"Devis {m['devis']['numero']}, signé le {m['devis']['signe_le']}. "
      f"{fr(m['devis']['jours_vendus'], 1)} jours, {fr(m['devis']['montant_ht'])} € HT. "
      f"Acompte de {fr(m['devis']['acompte'])} € encaissé le {m['devis']['acompte_le']}.")
    A("")
    A("| Sur les 27 lignes du devis | Lignes |")
    A("|---|---:|")
    A(f"| Terminées | **{m['devis']['fait']}** |")
    A(f"| Entamées | **{m['devis']['partiel']}** |")
    A(f"| Non commencées | **{m['devis']['absent']}** |")
    A("")
    A(f"**{m['devis']['refutees']} lignes** portaient un état annoncé que la mesure contredit. "
      "L'audit du 17/09/2026 les a toutes rouvertes : les trois chiffres ci-dessus sont "
      "ceux de la mesure, pas ceux de l'annonce.")
    A("")

    # ---- B. Le chemin critique ----------------------------------------
    A("## B. Le chemin critique")
    A("")
    A(f"**{fr(m['reste_jours'], 2)} jours restent à produire** sur {fr(m['devis']['jours_vendus'], 1)} vendus. "
      f"Il reste **{m['jours_ouvres']} jours ouvrés**. "
      f"Le déficit est de **{m['deficit_jours']} jours ouvrés**.")
    A("")
    A(f"### Le 20 octobre est-il tenable ? {m['verdict']}")
    A("")
    for p in m["verdict_motifs"]:
        A(f"- {p}")
    A("")
    A("L'ordre des maillons, chacun débloquant le suivant :")
    A("")
    for i, maillon in enumerate(m["chemin_critique"], 1):
        A(f"{i}. **{maillon['quoi']}** · {maillon['chez']}")
        A(f"   - débloqué par : {maillon['debloque_par']}")
        A(f"   - débloque : {maillon['debloque']}")
    A("")

    # ---- C. Les decisions en attente -----------------------------------
    A("## C. Les décisions en attente")
    A("")
    A("Aucune ne demande du travail. Chacune demande un arbitrage. "
      "Triées par ce qu'elles retiennent.")
    A("")
    A("| Décision | Chez | Attend depuis | Ce qu'elle bloque | Coût d'une semaine de plus |")
    A("|---|---|---|---|---|")
    for d in m["decisions"]:
        A(f"| {d['quoi']} | {d['chez']} | {d['depuis']} | {d['bloque']} | {d['cout_semaine']} |")
    A("")

    # ---- D. Les chantiers ----------------------------------------------
    A("## D. Les chantiers")
    A("")
    A("| Chantier | Tâches | Bloquantes | Ce qui bloque |")
    A("|---|---:|---:|---|")
    for slug in ORDRE_CHANTIER:
        lot = [x for x in t if x["chantier_slug"] == slug]
        if not lot:
            continue
        bl = [x for x in lot if x["priorite"] == "🔴 Bloquant" and x["etat"] != "✅ Fait"]
        nom = lot[0]["chantier"]
        A(f"| {nom} | {len(lot)} | {len(bl)} | {m['chantiers'].get(slug, 'non relevé')} |")
    A("")
    A("Les lots du devis, jours vendus contre jours restant à produire :")
    A("")
    A("| Lot | Vendu | Reste | Écart |")
    A("|---|---:|---:|---:|")
    for l in m["lots"]:
        marque = " **dépassé**" if l["ecart"] > 0 else ""
        A(f"| {l['nom']} | {fr(l['vendu'], 2)} | {fr(l['reste'], 2)} | "
          f"{'+' if l['ecart'] > 0 else ''}{fr(l['ecart'], 2)}{marque} |")
    tv = sum(x['vendu'] for x in m['lots']); tr = sum(x['reste'] for x in m['lots'])
    A(f"| **Total** | **{fr(tv, 2)}** | **{fr(tr, 2)}** | **{fr(tr - tv, 2)}** |")
    A("")

    # ---- E. Les taches, par porteur ------------------------------------
    A("## E. Les tâches")
    A("")
    A(f"{len(t)} tâches. "
      + ", ".join(f"{n} {etat}" for etat, n in sorted(m["par_etat"].items(), key=lambda kv: -kv[1]))
      + ".")
    A("")
    porteurs = sorted({x["porteur"] for x in t},
                      key=lambda p: (p == "à attribuer", p or ""))
    for p in porteurs:
        lot = [x for x in t if x["porteur"] == p]
        lot.sort(key=lambda x: (ORDRE_PRIO.get(x["priorite"], 9),
                                ORDRE_ETAT.get(x["etat"], 9), x["id"]))
        bl = len([x for x in lot if x["priorite"] == "🔴 Bloquant" and x["etat"] != "✅ Fait"])
        A(f"### {p} · {len(lot)} tâches, dont {bl} bloquantes")
        A("")
        A("| Id | Tâche | État | Priorité | Échéance | Ce qu'elle débloque |")
        A("|---|---|---|---|---|---|")
        for x in lot:
            ech = x["echeance"] or "non dite"
            deb = (x["debloque"] or "non relevé").replace("|", "/").replace("\n", " ")
            A(f"| `{x['id']}` | [{x['intitule']}]({x['preuve']}) | {x['etat']} | "
              f"{x['priorite']} | {ech} | {deb} |")
        A("")

    # ---- F. Ce qui a change --------------------------------------------
    A("## F. Ce qui a changé depuis le dernier relevé")
    A("")
    if not avant:
        A("Premier relevé : il n'existe aucune version antérieure dans `feuille-de-route/`. "
          "Cette section se remplit à partir du deuxième passage.")
        A("")
    else:
        vieux = {x["id"]: x for x in avant["taches"]}
        finies = [par_id[i] for i in par_id
                  if i in vieux and vieux[i]["etat"] != "✅ Fait" and par_id[i]["etat"] == "✅ Fait"]
        neuves = [par_id[i] for i in par_id if i not in vieux]
        parties = [vieux[i] for i in vieux if i not in par_id]
        bouge = [(vieux[i], par_id[i]) for i in par_id
                 if i in vieux and vieux[i]["etat"] != par_id[i]["etat"]
                 and par_id[i]["etat"] != "✅ Fait"]
        for titre, lot in (("Terminées", finies), ("Nouvelles", neuves),
                           ("Disparues, passées en abandonnées", parties)):
            A(f"**{titre} : {len(lot)}**")
            A("")
            for x in lot:
                A(f"- `{x['id']}` {x['intitule']}")
            A("")
        A(f"**État changé : {len(bouge)}**")
        A("")
        for a, b in bouge:
            A(f"- `{b['id']}` {b['intitule']} : {a['etat']} vers {b['etat']}")
        A("")

    # ---- G. Les risques -------------------------------------------------
    A("## G. Les risques")
    A("")
    A("Par probabilité décroissante. Un risque sans parade n'est qu'un constat.")
    A("")
    A("| Risque | Parade |")
    A("|---|---|")
    for r in m["risques"]:
        A(f"| {r['quoi']} | {r['parade']} |")
    A("")

    # ---- pied ------------------------------------------------------------
    A("---")
    A("")
    A("## D'où viennent ces chiffres")
    A("")
    for s in m["sources"]:
        A(f"- {s}")
    A("")
    A("## Relancer ce relevé")
    A("")
    A("```bash")
    A("cd /Users/joanaglave/a-dispo && python3 outils/feuille-de-route.py")
    A("```")
    A("")
    A("Le rendu lit `feuille-de-route/etat.json`. Pour remesurer la réalité et "
      "régénérer ce fichier, rejouer le prompt de `outils/PROMPT-FEUILLE-DE-ROUTE.md` "
      "dans une session ouverte sur ce dépôt.")
    A("")
    return "\n".join(o)


def main():
    chemin = os.path.join(DOSSIER, "etat.json")
    if not os.path.exists(chemin):
        sys.exit("etat.json absent : rejouer le prompt de relevé d'abord.")
    e = charger(chemin)
    avant = precedent(chemin)
    md = rendre(e, avant)
    sortie = os.path.join(DOSSIER, f"{e['meta']['releve']}.md")
    with open(sortie, "w", encoding="utf-8") as f:
        f.write(md)
    # L'instantane date, pour que le prochain passage ait un point de comparaison.
    fige = os.path.join(DOSSIER, f"etat-{e['meta']['releve']}.json")
    with open(fige, "w", encoding="utf-8") as f:
        json.dump(e, f, ensure_ascii=False, indent=1)
    assert "—" not in md and "–" not in md, "tiret cadratin dans le rendu"
    print(f"{os.path.relpath(sortie, RACINE)} : {len(md.splitlines())} lignes, "
          f"{len(e['taches'])} taches")
    print(f"{os.path.relpath(fige, RACINE)} : instantane fige pour la comparaison")
    if not avant:
        print("premier passage : la section F est vide, c'est normal")


if __name__ == "__main__":
    main()
