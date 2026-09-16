#!/usr/bin/env python3
"""
La recette du site : le banc d'essai qui dit si le produit tient debout.

POURQUOI CE SCRIPT EXISTE. Avant chaque livraison, huit choses doivent etre
vraies en meme temps, et aucune ne se voit a la lecture d'une page :

  1. chaque page declaree dans construire.mjs existe et se construit vraiment ;
  2. aucune page ne contient de tiret cadratin ni demi-cadratin ;
  3. aucun montant d'abonnement n'apparait, tant que le prix n'est pas arrete ;
  4. aucun vocabulaire d'emploi ni d'interim (article L8241-1 du Code du
     travail : le pret de main d'oeuvre a but lucratif est interdit) ;
  5. aucune cle secrete ne traine dans une page : seule la cle publique a le
     droit d'y etre, et on le VERIFIE en decodant le jeton, on ne le suppose pas ;
  6. chaque page qui parle a la base montre un chargement, un vide, une erreur
     et un succes : jamais d'ecran blanc ;
  7. chaque bouton mene quelque part : un bouton sans gestionnaire, sans lien
     et sans formulaire est un bouton mort ;
  8. aucun lien interne ne pointe vers une page inexistante.

  Un neuvieme controle, informatif : chaque champ de saisie a un libelle relie.

CE QU'IL NE FAIT PAS, ET QUI SE MESURE AILLEURS. Le debordement lateral se
mesure avec `outils/check-mobile.py` (Chrome sans fenetre, largeur par
largeur), les contrastes WCAG avec `outils/contrastes.py`, la concordance des
chiffres entre documents avec `outils/verifier-coherence.py`, et le
deploiement reel avec `outils/verifier-en-ligne.sh`. Ce script-ci ne double
aucun des quatre : il regarde les SOURCES, sans navigateur.

IL NE MODIFIE RIEN. Il lit. Il ne construit pas dist/, il compare a dist/ si
dist/ existe, et il dit quand dist/ est perime.

POURQUOI DES MONTANTS FIGURENT DANS CE FICHIER. La liste MONTANTS_ABANDONNES
nomme les prix ecartes le 06/09/2026. Un detecteur doit nommer ce qu'il
chasse. Ce fichier ne part jamais en ligne : construire.mjs exclut `*.py` du
deploiement (voir la constante IGNORE de construire.mjs).

Usage :
    python3 outils/recette.py                # tout le depot
    python3 outils/recette.py site espace    # seulement ces pages

Sortie : 0 si aucun controle bloquant n'echoue, 1 sinon.
"""

import base64
import html
import json
import re
import sys
import textwrap
import unicodedata
from collections import namedtuple
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
BUILD = RACINE / "outils" / "construire.mjs"

# Les tirets interdits, ecrits en echappement pour que ce fichier ne les
# contienne pas lui-meme : un detecteur qui porte la faute qu'il cherche
# finirait par se signaler tout seul.
CADRATIN = "\u2014"       # tiret cadratin
DEMI_CADRATIN = "\u2013"  # tiret demi-cadratin

# Le projet Supabase du site. Une cle qui pointe ailleurs est une erreur de
# copie, et une cle dont le role n'est pas `anon` est une fuite.
PROJET_SUPABASE = "ucnyvsocoxenxbuakluo"

# Qui lit la page. Une etude juridique destinee a la porteuse a le droit de
# prononcer le mot « salarie » : elle parle du droit. Une page que l'artisan
# lit, non : elle parle de l'offre. La severite suit le lecteur.
PAGES_PRODUIT = {
    "site", "espace", "connexion", "inscription", "aide", "telecharger",
    # Le chantier voisin construit ces deux-la en ce moment meme. Des qu'elles
    # seront declarees dans construire.mjs, elles seront controlees comme les autres.
    "recherche", "demandes",
}

# Les pages annoncees par le chantier voisin. Tant qu'elles ne sont pas dans
# construire.mjs, il n'y a rien a controler : on le dit, on ne l'invente pas.
PAGES_DU_CHANTIER_VOISIN = ("recherche", "demandes", "admin")

# Les prix d'abonnement ecartes le 06/09/2026, et le panier moyen qui en
# derivait. Tant que le prix n'est pas arrete, aucun des quatre ne doit
# apparaitre autrement que presente comme abandonne.
MONTANTS_ABANDONNES = ("19,90", "29,90", "34,90", "27,65")

# Ce qui autorise a citer un montant ecarte : le presenter comme passe.
# Meme principe que `verifier-coherence.py`, qui tolere une valeur perimee
# quand la phrase dit qu'elle a change.
MARQUEURS_PASSE = (
    "abandonn", "ecartee", "ecartees", "n'existe plus", "n'est plus",
    "ne sont plus", "n'a plus", "n'ont plus", "ancienne", "anciennes",
    "perime", "remplace", "etait calcule", "etaient a", "au lieu de",
    "avant le 06/09", "sans fixer le prix", "plus de base",
)

# Un montant colle a un rythme mensuel : le gabarit d'un prix d'abonnement.
MONTANT_MENSUEL = re.compile(
    r"(\d{1,3}(?:[   ]\d{3})*(?:,\d{1,2})?)\s*(?:€|euros?)?\s*"
    r"(?:ht|ttc)?\s*(?:/|par)\s*mois"
)

# Le vocabulaire de l'emploi. Chaque motif est ecrit sans accent : le texte
# est normalise avant la recherche.
MOTS_EMPLOI = (
    (r"\bembauch\w*", "embaucher"),
    (r"\brecrut\w*", "recruter"),
    (r"\bemploy(?:er|eur|eurs|e|es|ee|ees)\b", "employer"),
    (r"(?:\bdu|\ble|\bles|\bson|\bses|\bleur|\bleurs|\bnotre|\bnos|\bvotre|\bvos|\bde|\bd')\s+personnels?\b",
     "personnel (nom)"),
    (r"\binterim\w*", "interim"),
    (r"\bsalari(?:e|es|ee|ees)\b", "salarie"),
    (r"mise a disposition\W{0,40}?(?:de |du |d')?(?:personnel|salari|main d'oeuvre|travailleur|ouvrier)",
     "mise a disposition de personnel"),
)

# Ce qui transforme une occurrence en citation : le mot est la POUR ETRE
# ECARTE. « interdit hors interim par l'article L8241-1 » est la bonne phrase,
# pas une faute.
MARQUEURS_ECART = (
    "interdit", "jamais", "n'est pas", "ne sont pas", "pas de pret",
    "hors interim", "l8241", "l 8241", "code du travail", "contrairement",
    "au lieu de", "requalification", "risque", "reste l'employeur",
    "sous-traitance", "sous traitance", "aucune", "aucun lien",
    "sans lien de subordination", "ce n'est pas", "n'y est pas",
    "independant", "independantes", "entre entreprises",
)

# Les traces de secret. La cle publique est publique par nature : sa presence
# est normale. Tout le reste est une fuite.
MOTIFS_SECRET = (
    (r"service_role", "role de service Supabase"),
    (r"sb_secret_[A-Za-z0-9_-]{6,}", "cle secrete Supabase (format sb_secret_)"),
    (r"SUPABASE_SERVICE[A-Z_]*", "variable de service Supabase"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "cle privee"),
    (r"\bsk_live_[A-Za-z0-9]{10,}", "cle Stripe de production"),
    (r"\bsk-[A-Za-z0-9]{20,}", "cle d'API secrete (format sk-)"),
    (r"\bxox[baprs]-[A-Za-z0-9-]{10,}", "jeton Slack"),
    (r"\bghp_[A-Za-z0-9]{20,}", "jeton GitHub"),
    (r"\bAKIA[0-9A-Z]{16}\b", "cle AWS"),
    (r"\bAIza[0-9A-Za-z_\-]{35}\b", "cle Google"),
    (r"(?:mot_de_passe|motdepasse|password|passwd)\s*[:=]\s*[\"'][^\"']{4,}[\"']",
     "mot de passe en clair"),
)

JETON = re.compile(r"eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}")

# Les quatre etats obligatoires, et ce qui prouve qu'ils existent dans la page.
ETATS = (
    ("chargement", (r"class=\"chargement\"", r"Un instant", r"On regarde",
                    r"aria-busy", r"\.disabled\s*=\s*true", r"disabled\s*=\s*true",
                    r"Un instant…", r"patiente")),
    ("vide", (r"\baucun\b", r"\baucune\b", r"pas encore", r"rien a ",
              r"rien à ", r"\bvide\b", r"personne n", r"0 résultat")),
    ("erreur", (r"class=\"err", r"s-ko", r"etat ko", r"aria-invalid",
                r"dire\(\"ko\"", r"montrer\('ko'", r"\bImpossible\b",
                r"n'a pas march", r"Pas de réseau")),
    ("succes", (r"s-ok", r"etat ok", r"dire\(\"ok\"", r"montrer\('ok'",
                r"C'est noté", r"enregistr", r"\bC'est fait\b")),
)

# Un bouton pose dans une maquette n'appelle rien, et c'est parfois voulu : il
# montre a quoi ressemblera l'application. Il n'est pardonne que s'il est
# MARQUE inerte, c'est-a-dire si le visiteur ne peut ni le cliquer ni
# l'atteindre au clavier. « Il est dans un bloc de demonstration » ne se
# verifie pas depuis le code et ne protege personne : la souris, elle, ne lit
# pas le nom du conteneur.
MARQUEURS_INERTE = re.compile(
    r"\bdisabled\b|aria-disabled\s*=\s*[\"']true|aria-hidden\s*=\s*[\"']true"
    r"|tabindex\s*=\s*[\"']-1|role\s*=\s*[\"'](?:presentation|img|none)", re.I)

# Une balise ecrite par un script : `href="' + lien + '"`. On ne peut pas
# juger sa destination depuis le source, et pretendre le contraire serait
# inventer. On la compte a part.
ATTRIBUT_DYNAMIQUE = re.compile(r"[\"']\s*\+|\+\s*[\"']|\$\{")

# Les adresses qui ne sont pas des pages du site : ce sont les points d'entree
# de la base, pas des liens internes.
PREFIXES_API = ("/rest/", "/auth/", "/storage/", "/functions/", "/realtime/")

Constat = namedtuple("Constat", "controle page gravite message")


# --------------------------------------------------------------- lectures

def sans_accent(s):
    """Texte normalise : minuscules, sans accent. Pour chercher un mot."""
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn").lower()


def texte_lu(brut):
    """Ce qu'un lecteur voit, plus ce que le script ecrit a l'ecran.

    On retire le style et les commentaires HTML (personne ne les lit), on
    retire les balises, mais ON GARDE LE CONTENU DES SCRIPTS : sur `espace/`
    et `site/`, une bonne partie des phrases affichees vit dans des chaines
    JavaScript. Les retirer reviendrait a ne rien controler sur la page la
    plus importante.
    """
    t = re.sub(r"<style.*?</style>", " ", brut, flags=re.S)
    t = re.sub(r"<!--.*?-->", " ", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    return re.sub(r"[ \t]+", " ", t)


def sans_commentaires(brut):
    """Le balisage, commentaires neutralises, positions conservees.

    POURQUOI. Le controle des boutons cherchait « <button » dans le fichier
    brut, et le trouvait dans un COMMENTAIRE qui explique justement pourquoi
    ce geste est un lien et non un bouton. Un controle qui signale sa propre
    documentation est un controle qu'on cesse de croire, et qu'on finit par
    ignorer le jour ou il a raison.

    On remplace chaque commentaire par des espaces de MEME LONGUEUR : les
    numeros de ligne et les positions restent exacts, donc les messages
    continuent de pointer au bon endroit.
    """
    def blanchir(m):
        return re.sub(r"[^\n]", " ", m.group(0))
    t = re.sub(r"<!--.*?-->", blanchir, brut, flags=re.S)
    t = re.sub(r"/\*.*?\*/", blanchir, t, flags=re.S)
    return t


def ligne_de(brut, position):
    return brut.count("\n", 0, position) + 1


def extrait(texte, debut, fin, avant=42, apres=30):
    """Une citation d'une seule ligne, pour montrer sans noyer.

    Elle tient dans un terminal de cent colonnes : au-dela, la ligne se replie
    et le compte rendu devient illisible, ce qui est exactement ce qu'on ne
    veut pas avant une livraison.
    """
    bout = texte[max(0, debut - avant):fin + apres]
    return re.sub(r"\s+", " ", bout).strip()[:62]


def lire_build():
    """Lit la table ECRANS de construire.mjs, sans l'executer.

    POURQUOI LIRE PLUTOT QU'IMPORTER. Une liste recopiee a la main prend du
    retard ; une liste lue ne peut pas diverger. Lire evite en plus tout effet
    de bord : ce script ne doit rien ecrire.

    La table a change de langue avec le depot : elle etait en Python dans
    construire.mjs, elle est en JavaScript dans construire.mjs, parce que Cloudflare
    reconstruit a chaque push et que Node est la seule chose dont son
    environnement dispose a coup sur. On rend la meme forme qu'avant, pour que
    les neuf controles n'aient pas a changer d'une ligne.
    """
    texte = BUILD.read_text(encoding="utf-8")
    debut = texte.index("const ECRANS = [")
    fin = texte.index("\n]", debut)
    corps = texte[debut:fin]
    pages = []
    for bloc in re.finditer(r"\{(?P<b>[^{}]*?)\}", corps, re.S):
        champs = dict(re.findall(r"(\w+):\s*\"([^\"]*)\"", bloc.group("b")))
        if "dossier" not in champs or "url" not in champs:
            continue
        url = champs["url"]
        pages.append({
            "source": "app/%s/index.html" % champs["dossier"],
            "sortie": "dist/index.html" if url == "/" else "dist%s/index.html" % url,
            "titre": champs.get("titre", ""),
        })
    # Le gabarit est une fonction a gabarit de chaine dans construire.mjs.
    g = re.search(r"const enveloppe = \(titre, corps\) => `(.*?)`;", texte, re.S)
    return pages, (g.group(1) if g else None)


def nom_court(page):
    """« espace/index.html » -> « espace ». C'est le nom qu'on affiche."""
    return str(Path(page["source"]).parent)


def route_de(page):
    """L'adresse servie : dist/espace/index.html -> /espace, dist/index.html -> /."""
    rel = page["sortie"]
    rel = rel[len("dist/"):] if rel.startswith("dist/") else rel
    if rel == "index.html":
        return "/"
    rel = rel[:-len("/index.html")] if rel.endswith("/index.html") else rel
    return "/" + rel.strip("/")


# ------------------------------------------------------- 1. les pages

def controle_pages(pages, gabarit, constats, complet=True):
    print("\n  1. LES PAGES DECLAREES DANS construire.mjs\n")
    sources = {}
    for page in pages:
        nom = nom_court(page)
        src = RACINE / page["source"]
        if not src.exists():
            constats.append(Constat("pages", nom, "bloquant",
                                    f"{page['source']} declaree dans construire.mjs mais absente du disque"))
            print(f"    {nom:26} ABSENTE   {page['source']}")
            continue

        brut = src.read_text(encoding="utf-8")
        sources[nom] = (page, brut)

        if gabarit is None:
            constats.append(Constat("pages", nom, "bloquant",
                                    "le gabarit de construire.mjs est illisible : construction non verifiable"))
            continue

        # La meme operation que build.construire(), mais en memoire : on ne
        # touche pas a dist/.
        corps = re.sub(r"<title>.*?</title>\s*", "", brut, count=1, flags=re.S)
        # Le gabarit vient d un gabarit de chaine JavaScript : ses trous
        # s ecrivent ${titre} et ${corps}, pas {titre} et {corps}. Une
        # substitution naive marquerait les douze pages « perimees »
        # alors que dist est a jour, et on cesserait de croire la recette.
        document = (gabarit.replace("${titre}", page["titre"])
                           .replace("${corps}", corps.strip()))

        manques = []
        if not document.lstrip().startswith("<!doctype html>"):
            manques.append("pas de doctype")
        if "name=\"viewport\"" not in document:
            manques.append("pas de meta viewport")
        if not re.search(r"<title>\S", document):
            manques.append("titre vide")
        if re.search(r"<meta\s+name=\"description\"", document, re.I):
            manques.append("meta description presente : la marque n'est pas deposee")
        if len(corps.strip()) < 400:
            manques.append(f"corps de {len(corps.strip())} octets, trop court pour une page")

        # L'etat de dist/. Si le dossier n'existe pas du tout, on le dit une
        # seule fois, plus bas : vingt lignes identiques ne renseignent personne.
        ko = RACINE / page["sortie"]
        etat_dist = "dist absent"
        if ko.exists():
            etat_dist = "dist a jour" if ko.read_text(encoding="utf-8") == document else "dist PERIME"
            if etat_dist == "dist PERIME":
                constats.append(Constat("pages", nom, "signale",
                                        "dist/ ne correspond plus a la source : relancer npm run build"))
        elif (RACINE / "dist").exists():
            constats.append(Constat("pages", nom, "signale",
                                    f"{page['sortie']} absent : relancer npm run build"))

        if manques:
            for m in manques:
                constats.append(Constat("pages", nom, "bloquant", m))
        etat = "construit" if not manques else "ECHEC"
        print(f"    {nom:26} {etat:10} {len(document)//1024:>4} Ko   {route_de(page):<32} {etat_dist}")
        for m in manques:
            print(f"      !  {m}")

    if not (RACINE / "dist").exists():
        print("\n    dist/ n'existe pas : la construction a ete verifiee en memoire, page par "
              "page,\n    mais rien n'a ete compare au resultat reel. Pour cela : "
              "npm run build")
        constats.append(Constat("pages", "dist/", "signale",
                                "dist/ absent : construction verifiee en memoire seulement"))

    # Ce qui existe sur le disque mais que construire.mjs ne construit pas. Sans
    # objet quand on ne controle qu'une partie des pages : tout le reste du
    # depot passerait pour orphelin.
    if not complet:
        return sources
    declarees = {nom_court(p) for p in pages}
    sur_disque = {str(p.relative_to(RACINE).parent) for p in RACINE.glob("*/index.html")}
    sur_disque |= {str(p.relative_to(RACINE).parent) for p in RACINE.glob("*/*/index.html")}
    orphelines = sorted(d for d in sur_disque - declarees
                        if not d.startswith((".", "dist", "outils", "crm", "assets")))
    if orphelines:
        print("\n    Sur le disque mais jamais construites (donc jamais servies) :")
        for o in orphelines:
            print(f"      .  {o}/index.html")
            constats.append(Constat("pages", o, "signale",
                                    "sur le disque, absente de la table PAGES de construire.mjs"))

    absentes_voisines = [n for n in PAGES_DU_CHANTIER_VOISIN if n not in declarees]
    if absentes_voisines:
        print("\n    Annoncees par le chantier voisin, pas encore dans construire.mjs, "
              "donc rien a controler :")
        print("      .  " + ", ".join(absentes_voisines))

    return sources


# ------------------------------------------------------- 2. les tirets

def controle_tirets(sources, constats):
    print("\n  2. TIRET CADRATIN ET DEMI-CADRATIN (trait d'union uniquement)\n")
    total = 0
    for nom, (page, brut) in sources.items():
        trouves = [(m.start(), m.group()) for m in re.finditer(f"[{CADRATIN}{DEMI_CADRATIN}]", brut)]
        total += len(trouves)
        etat = "ok" if not trouves else f"{len(trouves)} A CORRIGER"
        print(f"    {nom:26} {etat}")
        for pos, car in trouves[:6]:
            quel = "cadratin" if car == CADRATIN else "demi-cadratin"
            print(f"      !  ligne {ligne_de(brut, pos):>5}  {quel:<14}: {extrait(brut, pos, pos + 1)}")
        if len(trouves) > 6:
            print(f"      .  et {len(trouves) - 6} autre(s)")
        if trouves:
            constats.append(Constat("tirets", nom, "bloquant",
                                    f"{len(trouves)} tiret(s) cadratin ou demi-cadratin"))
    print(f"\n    Total : {total} tiret(s) interdit(s) sur {len(sources)} page(s)")


# --------------------------------------------- 3. les montants d'abonnement

def controle_prix(sources, constats):
    print("\n  3. MONTANTS D'ABONNEMENT (le prix n'est pas arrete)\n")
    total = 0
    for nom, (page, brut) in sources.items():
        lu = texte_lu(brut)
        norme = sans_accent(lu)
        produit = nom in PAGES_PRODUIT
        fautes, cites = [], []

        # a. les quatre montants ecartes le 06/09/2026. On cherche dans le
        #    texte normalise : les chiffres n'ont pas d'accent, et la
        #    normalisation conserve les positions, donc la citation tiree de
        #    `lu` tombe bien en face.
        for montant in MONTANTS_ABANDONNES:
            for m in re.finditer(re.escape(montant), norme):
                fenetre = norme[max(0, m.start() - 180):m.end() + 120]
                if any(marq in fenetre for marq in MARQUEURS_PASSE):
                    cites.append(montant)
                else:
                    fautes.append((m.start(), montant, extrait(lu, m.start(), m.end())))

        # b. le gabarit d'un prix mensuel. Sur une page que l'artisan lit, tout
        #    montant mensuel est suspect : le seul prix qu'on y montrerait est
        #    le notre. Ailleurs, il faut un signe qu'il s'agit bien d'un prix
        #    affiche (le « HT » d'une grille tarifaire) ou que la phrase parle
        #    d'abonnement : sans quoi on signalerait le budget publicitaire et
        #    les charges fixes du dossier de presentation, qui sont mensuels
        #    eux aussi et ne sont pas des prix.
        for m in MONTANT_MENSUEL.finditer(norme):
            proche = norme[max(0, m.start() - 80):m.end() + 80]
            if not (produit or re.search(r"\b(?:ht|ttc)\b", m.group(0))
                    or "abonnement" in proche):
                continue
            if any(marq in norme[max(0, m.start() - 180):m.end() + 120]
                   for marq in MARQUEURS_PASSE):
                cites.append(m.group(0).strip())
                continue
            if any(f[1] in m.group(0) for f in fautes):
                continue
            fautes.append((m.start(), m.group(0).strip(),
                           extrait(lu, m.start(), m.end())))

        vus = set()
        uniques = []
        for pos, montant, citation in fautes:
            if citation in vus:
                continue
            vus.add(citation)
            uniques.append((pos, montant, citation))

        total += len(uniques)
        marque = "PRODUIT" if produit else "dossier"
        etat = "ok" if not uniques else f"{len(uniques)} A RETIRER"
        suite = f"  ({len(set(cites))} cite(s) comme abandonne(s), toleres)" if cites else ""
        print(f"    {nom:26} {marque:8} {etat}{suite}")
        for pos, montant, citation in uniques[:5]:
            print(f"      !  {montant:>12}  : {citation}")
        if len(uniques) > 5:
            print(f"      .  et {len(uniques) - 5} autre(s)")
        if uniques and produit:
            constats.append(Constat("prix", nom, "bloquant",
                                    f"{len(uniques)} montant(s) d'abonnement sur une page que l'artisan lit"))
        elif uniques:
            constats.append(Constat("prix", nom, "signale",
                                    f"{len(uniques)} montant(s) (dossier : fait releve ou hypothese de modele)"))
    print(f"\n    Total : {total} montant(s) d'abonnement a retirer")


# ----------------------------------------------- 4. le vocabulaire d'emploi

def controle_emploi(sources, constats):
    print("\n  4. VOCABULAIRE D'EMPLOI ET D'INTERIM (article L8241-1)\n")
    total_bloquant = 0
    for nom, (page, brut) in sources.items():
        lu = texte_lu(brut)
        norme = sans_accent(lu)
        produit = nom in PAGES_PRODUIT
        fautes, tolerees = [], 0
        for motif, etiquette in MOTS_EMPLOI:
            for m in re.finditer(motif, norme):
                fenetre = norme[max(0, m.start() - 140):m.end() + 140]
                if any(marq in fenetre for marq in MARQUEURS_ECART):
                    tolerees += 1
                    continue
                fautes.append((etiquette, extrait(lu, m.start(), m.end())))

        marque = "PRODUIT" if produit else "dossier"
        # Une page peut declarer une exception, avec sa raison, en clair dans sa
        # source. Elle n'est pas effacee : elle est comptee a part et redite a
        # chaque passage, pour qu'on la revoie au lieu de l'oublier.
        exception = re.search(r"recette:emploi-declare\s*:\s*([^\n>]{10,200})", brut)
        if produit and fautes and exception:
            constats.append(Constat("emploi", nom, "signale",
                                    f"{len(fautes)} mot(s), exception declaree : "
                                    + exception.group(1).strip()))
            fautes = []
        if produit and fautes:
            total_bloquant += len(fautes)
            constats.append(Constat("emploi", nom, "bloquant",
                                    f"{len(fautes)} mot(s) d'emploi sur une page que l'artisan lit"))
        elif fautes:
            constats.append(Constat("emploi", nom, "signale",
                                    f"{len(fautes)} mot(s) d'emploi (dossier : le mot y decrit le droit)"))
        etat = "ok" if not fautes else (f"{len(fautes)} A REECRIRE" if produit else f"{len(fautes)} a relire")
        suite = f"  ({tolerees} cite(s) pour etre ecarte(s))" if tolerees else ""
        print(f"    {nom:26} {marque:8} {etat}{suite}")
        for etiquette, citation in fautes[:4]:
            print(f"      !  {etiquette:<24} : {citation}")
        if len(fautes) > 4:
            print(f"      .  et {len(fautes) - 4} autre(s)")
    print(f"\n    Total bloquant : {total_bloquant} mot(s) sur les pages produit")


# --------------------------------------------------------- 5. les cles

def decoder_jeton(jeton):
    """Decode la charge utile d'un JWT. On verifie le role, on ne le suppose pas."""
    try:
        charge = jeton.split(".")[1]
        charge += "=" * (-len(charge) % 4)
        return json.loads(base64.urlsafe_b64decode(charge).decode("utf-8"))
    except Exception as exc:  # un jeton illisible est un fait, pas une exception
        return {"_illisible": str(exc)}


def controle_cles(sources, constats):
    print("\n  5. CLES ET SECRETS (seule la cle publique a le droit d'etre la)")
    print(f"     Projet attendu : {PROJET_SUPABASE}\n")
    total_jetons = 0
    for nom, (page, brut) in sources.items():
        lignes = []
        for m in JETON.finditer(brut):
            total_jetons += 1
            charge = decoder_jeton(m.group())
            role = charge.get("role", "?")
            ref = charge.get("ref", "?")
            exp = charge.get("exp")
            fin = (datetime.fromtimestamp(exp, timezone.utc).strftime("%d/%m/%Y")
                   if isinstance(exp, int) else "?")
            if role != "anon":
                constats.append(Constat("cles", nom, "bloquant",
                                        f"jeton de role « {role} » dans la page : a retirer immediatement"))
                lignes.append(f"!  ligne {ligne_de(brut, m.start()):>5}  role {role}  <<< PAS PUBLIQUE")
            elif ref != PROJET_SUPABASE:
                constats.append(Constat("cles", nom, "bloquant",
                                        f"cle publique d'un autre projet Supabase ({ref})"))
                lignes.append(f"!  ligne {ligne_de(brut, m.start()):>5}  projet {ref}  <<< AUTRE PROJET")
            else:
                lignes.append(f"ok cle anon du bon projet, valable jusqu'au {fin}")

        for motif, quoi in MOTIFS_SECRET:
            for m in re.finditer(motif, brut):
                constats.append(Constat("cles", nom, "bloquant", f"{quoi} dans la page"))
                lignes.append(f"!  ligne {ligne_de(brut, m.start()):>5}  {quoi} : "
                              f"{extrait(brut, m.start(), m.end(), 20, 20)[:70]}")

        etat = "ok" if not any(l.startswith("!") for l in lignes) else "A CORRIGER"
        print(f"    {nom:26} {etat:10} {lignes[0] if lignes else 'aucune cle'}")
        for l in lignes[1:]:
            print(f"      {l}")
    print(f"\n    Total : {total_jetons} jeton(s) trouve(s), tous decodes et verifies")


# ------------------------------------------------------- 6. les etats

def controle_etats(sources, constats):
    """Les quatre etats, demandes seulement la ou quelque chose peut echouer.

    Une page qui parle a la base doit les quatre : le reseau peut etre lent,
    vide, en panne, ou repondre. Une page qui ne fait que filtrer une liste
    deja presente ne peut echouer que d'une facon : ne rien trouver. C'est le
    seul etat qu'on lui demande. Un document avec trois boutons radio ne peut
    echouer d'aucune facon : lui reclamer un ecran d'erreur serait du bruit.
    """
    print("\n  6. ETATS OBLIGATOIRES : chargement, vide, erreur, succes\n")
    for nom, (page, brut) in sources.items():
        a_des_champs = bool(re.search(r"<form\b|<(?:input|select|textarea)\b", brut, re.I))
        parle_a_la_base = bool(re.search(r"\bfetch\s*\(|supabase|\bsb\.from\(|\bsb\.auth\b", brut))
        filtre_local = a_des_champs and bool(re.search(r"\.filter\(|toLowerCase\(\)", brut))
        if not a_des_champs and not parle_a_la_base:
            continue

        if parle_a_la_base:
            # L'etat vide n'a de sens que si la page affiche une collection.
            affiche_une_liste = bool(re.search(r"\.forEach\(|\.map\(|querySelectorAll", brut))
            attendus = [e for e, _ in ETATS if e != "vide" or affiche_une_liste]
            gravite, quoi = "bloquant", "parle a la base"
        elif filtre_local:
            attendus, gravite, quoi = ["vide"], "signale", "filtre une liste"
        else:
            print(f"    {nom:26} {'saisie locale':16} sans objet : rien ne peut echouer")
            continue

        presents, manquants = [], []
        for etat, motifs in ETATS:
            if etat not in attendus:
                continue
            (presents if any(re.search(mo, brut) for mo in motifs) else manquants).append(etat)

        if manquants:
            constats.append(Constat("etats", nom, gravite,
                                    "etat(s) absent(s) : " + ", ".join(manquants)))
        etat = "ok" if not manquants else "MANQUE " + ", ".join(manquants)
        print(f"    {nom:26} {quoi:16} {len(presents)}/{len(attendus)}  {etat}")


# ------------------------------------------------------ 7. les boutons

def gestionnaire_trouve(brut, attributs):
    """Un bouton mene quelque part si, quelque part dans la page, on l'ecoute.

    Quatre facons, toutes en usage dans le depot :
      · un `onclick` pose sur la balise ;
      · un identifiant repris dans `$("id")`, `getElementById("id")` ou `#id` ;
      · un attribut `data-...` relu par `dataset.x` ou `[data-x]` ;
      · une classe interrogee par `querySelector`, `closest` ou `matches`.
    """
    if re.search(r"\bonclick\s*=", attributs):
        return "onclick"

    ident = re.search(r"\bid\s*=\s*[\"']([^\"']+)[\"']", attributs)
    if ident:
        i = re.escape(ident.group(1))
        if re.search(r"(?:getElementById|\$)\(\s*[\"']" + i + r"[\"']", brut) or \
           re.search(r"querySelector\w*\(\s*[\"']#" + i, brut):
            return "id " + ident.group(1)

    for attribut in re.findall(r"data-([a-z0-9-]+)\s*=", attributs):
        camel = re.sub(r"-(\w)", lambda m: m.group(1).upper(), attribut)
        if re.search(r"dataset\." + camel + r"\b", brut) or \
           re.search(r"\[data-" + re.escape(attribut) + r"\]", brut) or \
           re.search(r"getAttribute\(\s*[\"']data-" + re.escape(attribut), brut):
            return "data-" + attribut

    classes = re.search(r"\bclass\s*=\s*[\"']([^\"']*)[\"']", attributs)
    if classes:
        for c in classes.group(1).split():
            c = c.strip("'\" ")
            if not c:
                continue
            e = re.escape(c)
            if re.search(r"querySelector\w*\(\s*[\"'][^\"']*\." + e + r"\b", brut) or \
               re.search(r"closest\(\s*[\"']\." + e + r"\b", brut) or \
               re.search(r"matches\(\s*[\"']\." + e + r"\b", brut) or \
               re.search(r"classList\.contains\(\s*[\"']" + e + r"[\"']", brut):
                return "classe ." + c

    # Un bouton de soumission ne vaut que s'il y a quelque chose au bout :
    # un gestionnaire de soumission, ou un `action` sur le formulaire. Sans
    # ni l'un ni l'autre, le clic recharge la page et rien ne se passe.
    if re.search(r"type\s*=\s*[\"']submit", attributs) and \
       (re.search(r"addEventListener\(\s*[\"']submit[\"']", brut)
            or re.search(r"<form\b[^>]*\baction\s*=", brut, re.I)
            or re.search(r"\bonsubmit\s*=", brut, re.I)):
        return "soumission du formulaire"

    return None


def dans_un_lien(brut, position):
    """Le bouton est-il enveloppe par un lien qui, lui, mene quelque part ?

    `<a href="/inscription"><button>S'inscrire</button></a>` fonctionne : le
    bouton n'a pas besoin de gestionnaire, c'est le lien qui travaille.
    """
    ouvre = brut.rfind("<a ", 0, position)
    if ouvre == -1 or "</a>" in brut[ouvre:position]:
        return False
    balise = brut[ouvre:brut.find(">", ouvre) + 1]
    href = re.search(r"href\s*=\s*[\"']([^\"']*)[\"']", balise)
    return bool(href and href.group(1).strip() not in ("", "#"))


def etiquette_de(brut, fin, balise="button"):
    """Le texte du bouton, pour qu'on sache duquel on parle a l'ecran.

    On s'arrete a la balise fermante : sans cela, l'etiquette d'un bouton
    deborde sur le suivant et on ne sait plus lequel est mort.
    """
    fenetre = brut[fin:fin + 300]
    coupe = fenetre.lower().find("</" + balise)
    if coupe != -1:
        fenetre = fenetre[:coupe]
    texte = re.sub(r"<[^>]*>", " ", fenetre).split("<")[0]
    texte = re.sub(r"\s+", " ", html.unescape(texte)).strip()
    return texte[:44] if texte else "(sans texte)"


def controle_boutons(sources, constats):
    print("\n  7. BOUTONS MORTS (sans gestionnaire, sans lien, sans formulaire)\n")
    total_boutons = total_morts = total_inertes = total_dynamiques = 0
    for nom, (page, brut_source) in sources.items():
        brut = sans_commentaires(brut_source)
        morts, inertes, dynamiques = [], [], 0
        boutons = list(re.finditer(r"<button\b([^>]*)>", brut, re.I))
        total_boutons += len(boutons)
        for m in boutons:
            attributs = m.group(1)
            if gestionnaire_trouve(brut, attributs) or dans_un_lien(brut, m.start()):
                continue
            etiquette = etiquette_de(brut, m.end())
            if MARQUEURS_INERTE.search(attributs):
                inertes.append((ligne_de(brut, m.start()), etiquette))
            elif ATTRIBUT_DYNAMIQUE.search(attributs):
                dynamiques += 1
            else:
                morts.append((ligne_de(brut, m.start()), "button", attributs.strip(), etiquette))

        # Un lien sans destination est le meme defaut sous une autre balise.
        for m in re.finditer(r"<a\b([^>]*)>", brut, re.I):
            a = m.group(1)
            if ATTRIBUT_DYNAMIQUE.search(a):
                dynamiques += 1
                continue
            href = re.search(r"href\s*=\s*[\"']([^\"']*)[\"']", a)
            if href is None or href.group(1).strip() in ("", "#"):
                if gestionnaire_trouve(brut, a) or MARQUEURS_INERTE.search(a):
                    continue
                morts.append((ligne_de(brut, m.start()), "a",
                              re.sub(r"\s+", " ", a.strip())[:44],
                              etiquette_de(brut, m.end(), "a")))

        total_morts += len(morts)
        total_inertes += len(inertes)
        total_dynamiques += dynamiques
        etat = "ok" if not morts else f"{len(morts)} MORT(S)"
        suite = ""
        if inertes:
            suite += f"  ({len(inertes)} marque(s) inerte(s))"
        if dynamiques:
            suite += f"  ({dynamiques} ecrit(s) par un script)"
        print(f"    {nom:26} {len(boutons):>3} bouton(s)  {etat}{suite}")
        for ligne, balise, attributs, etiquette in morts[:5]:
            print(f"      !  ligne {ligne:>5}  <{balise} {attributs[:42]}>  « {etiquette} »")
        if len(morts) > 5:
            print(f"      .  et {len(morts) - 5} autre(s)")
        if morts:
            constats.append(Constat("boutons", nom, "bloquant",
                                    f"{len(morts)} bouton(s) ou lien(s) sans destination"))
    print(f"\n    Total : {total_boutons} bouton(s), {total_morts} mort(s), "
          f"{total_inertes} marque(s) inerte(s), {total_dynamiques} ecrit(s) par un script")
    if total_morts:
        print("    Le geste : leur donner une destination, les passer en <span>, ou les")
        print("    marquer inertes (disabled, ou aria-hidden avec tabindex=-1).")


# -------------------------------------------------------- 8. les liens

def controle_liens(pages, sources, constats):
    print("\n  8. LIENS INTERNES (aucun ne doit mener nulle part)\n")
    routes = {route_de(p) for p in pages}
    routes |= {"/", "/crm", "/favicon.svg", "/icone-app.svg", "/robots.txt", "/404"}
    # Les renvois des QR codes, ecrits par construire.mjs dans dist/i/<canal>/.
    canaux = re.search(r"CANAUX_QR = \[(.*?)\]", BUILD.read_text(encoding="utf-8"), re.S)
    if canaux:
        routes |= {"/i/" + c for c in re.findall(r"\"(\w+)\"", canaux.group(1))}
    dist = RACINE / "dist"
    if dist.exists():
        routes |= {"/" + str(f.relative_to(dist)) for f in dist.rglob("*") if f.is_file()}

    total = morts = 0
    for nom, (page, brut) in sources.items():
        cibles = []
        for m in re.finditer(r"href\s*=\s*[\"']([^\"']+)[\"']", brut):
            cibles.append((m.group(1), "href", m.start()))
        for m in re.finditer(r"location\.(?:href|replace|assign)\s*\(?\s*=?\s*[\"']([^\"']+)[\"']", brut):
            cibles.append((m.group(1), "location", m.start()))
        for m in re.finditer(r"window\.open\(\s*[\"']([^\"']+)[\"']", brut):
            cibles.append((m.group(1), "window.open", m.start()))
        # Une adresse rangee dans une constante : `const APRES = "/espace";`
        for m in re.finditer(r"(?:const|let|var)\s+\w+\s*=\s*[\"'](/[^\"']*)[\"']", brut):
            cibles.append((m.group(1), "constante", m.start()))

        casses = []
        for cible, origine, pos in cibles:
            c = cible.strip()
            if c.startswith(("http://", "https://", "mailto:", "tel:", "data:", "#", "//")):
                continue
            if c.startswith(PREFIXES_API):
                continue
            route = "/" + c.split("?")[0].split("#")[0].strip("/")
            route = route if route != "//" else "/"
            total += 1
            if route not in routes and (route + ".html") not in routes \
                    and (route.rstrip("/") + "/index.html") not in routes:
                casses.append((ligne_de(brut, pos), c, origine))

        morts += len(casses)
        etat = "ok" if not casses else f"{len(casses)} CASSE(S)"
        print(f"    {nom:26} {etat}")
        for ligne, cible, origine in casses:
            print(f"      !  ligne {ligne:>5}  {origine:<12} {cible}")
        if casses:
            constats.append(Constat("liens", nom, "bloquant",
                                    f"{len(casses)} lien(s) interne(s) vers une page inexistante"))
    print(f"\n    Total : {total} lien(s) interne(s) controle(s), {morts} casse(s)")
    connues = ", ".join(sorted(r for r in routes if r.count("/") == 1))
    for bout in textwrap.wrap(connues, 86, initial_indent="    Adresses connues : ",
                              subsequent_indent="                       "):
        print(bout)


# ----------------------------------------------------- 9. les libelles

def dans_un_label(brut, position):
    """Le champ est-il enveloppe par son libelle ?

    `<label>Panier <input type="range" id="pan"></label>` est correct et
    n'a pas besoin d'attribut `for`. Sans ce controle, les quinze curseurs du
    simulateur ressortaient comme autant de defauts : quinze faux.
    """
    ouvre = brut.rfind("<label", 0, position)
    if ouvre == -1:
        return False
    return "</label>" not in brut[ouvre:position]


def controle_libelles(sources, constats):
    print("\n  9. CHAMPS ET LIBELLES (accessibilite, informatif)\n")
    for nom, (page, brut) in sources.items():
        champs = list(re.finditer(r"<(?:input|select|textarea)\b([^>]*)>", brut, re.I))
        if not champs:
            continue
        pour = set(re.findall(r"\bfor\s*=\s*[\"']([^\"']+)[\"']", brut))
        sans = []
        for m in champs:
            a = m.group(1)
            if re.search(r"type\s*=\s*[\"'](?:hidden|submit|button)", a, re.I):
                continue
            if re.search(r"aria-label|aria-labelledby|title\s*=", a):
                continue
            if dans_un_label(brut, m.start()) or ATTRIBUT_DYNAMIQUE.search(a):
                continue
            ident = re.search(r"\bid\s*=\s*[\"']([^\"']+)[\"']", a)
            if not ident or ident.group(1) not in pour:
                sans.append((ligne_de(brut, m.start()), re.sub(r"\s+", " ", a.strip())[:62]))
        etat = "ok" if not sans else f"{len(sans)} sans libelle relie"
        print(f"    {nom:26} {len(champs):>3} champ(s)  {etat}")
        for ligne, a in sans[:4]:
            print(f"      .  ligne {ligne:>5}  <input {a}>")
        if len(sans) > 4:
            print(f"      .  et {len(sans) - 4} autre(s), meme defaut")
        if sans:
            constats.append(Constat("libelles", nom, "signale",
                                    f"{len(sans)} champ(s) sans libelle relie"))


# ------------------------------------------------------------ le compte

def main(argv):
    demandees = [a for a in argv[1:] if not a.startswith("-")]
    toutes, gabarit = lire_build()
    pages = toutes
    if demandees:
        # La selection reduit les pages CONTROLEES, jamais les adresses
        # CONNUES : sinon un lien vers une page non selectionnee passerait
        # pour casse, et le banc d'essai mentirait.
        pages = [p for p in toutes if nom_court(p) in demandees
                 or Path(p["source"]).parts[0] in demandees]
        if not pages:
            print("Aucune page de construire.mjs ne porte ce nom. Noms connus : "
                  + ", ".join(sorted({nom_court(p) for p in toutes})))
            return 1

    print()
    print("  RECETTE DU SITE a dispo, le " + datetime.now().strftime("%d/%m/%Y a %H:%M"))
    print(f"  Depot : {RACINE}")
    print(f"  {len(pages)} page(s) declaree(s) dans outils/construire.mjs"
          + ("  (selection : " + ", ".join(demandees) + ")" if demandees else ""))

    constats = []
    sources = controle_pages(pages, gabarit, constats, complet=not demandees)
    controle_tirets(sources, constats)
    controle_prix(sources, constats)
    controle_emploi(sources, constats)
    controle_cles(sources, constats)
    controle_etats(sources, constats)
    controle_boutons(sources, constats)
    controle_liens(toutes, sources, constats)
    controle_libelles(sources, constats)

    bloquants = [c for c in constats if c.gravite == "bloquant"]
    signales = [c for c in constats if c.gravite == "signale"]

    print("\n  SYNTHESE\n")
    noms = ("pages", "tirets", "prix", "emploi", "cles", "etats", "boutons", "liens", "libelles")
    for c in noms:
        b = len([x for x in bloquants if x.controle == c])
        s = len([x for x in signales if x.controle == c])
        verdict = "ok" if b == 0 and s == 0 else ("ECHEC" if b else "a relire")
        print(f"    {c:12} {verdict:10} {b} bloquant(s), {s} signale(s)")

    print(f"\n    {len(sources)} page(s) controlee(s), 9 controles, "
          f"{len(bloquants)} bloquant(s), {len(signales)} signale(s)")

    if bloquants:
        print("\n  CE QUI BLOQUE LA LIVRAISON\n")
        for c in bloquants:
            print(f"    x  {c.page:24} [{c.controle}] {c.message}")
    if signales:
        print("\n  CE QUI EST SIGNALE, SANS BLOQUER\n")
        for c in signales:
            print(f"    .  {c.page:24} [{c.controle}] {c.message}")

    print("\n  A MESURER AILLEURS, CE SCRIPT N'Y TOUCHE PAS :")
    print("    debordement lateral  python3 outils/check-mobile.py dist/index.html")
    print("    contrastes WCAG      python3 outils/contrastes.py")
    print("    concordance chiffres python3 outils/verifier-coherence.py")
    print("    deploiement reel     ./outils/verifier-en-ligne.sh projet-dispo.pages.dev")
    print()
    if bloquants:
        print(f"  Verdict : {len(bloquants)} controle(s) bloquant(s) en echec. "
              "Le produit n'est pas livrable en l'etat.\n")
        return 1
    print("  Verdict : aucun controle bloquant en echec.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
