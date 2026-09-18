import json, io, html

D = json.load(io.open('/tmp/point-data.json', encoding='utf-8'))
lignes, ordre, jalons, bloque, bonus = D['lignes'], D['ordre'], D['jalons'], D['bloque'], D['bonus']

VENDU_LOT = {}
for l in lignes:
    VENDU_LOT[l['lot']] = l['vendu']

def poids(e):  # part d'avancement d'une ligne
    return {'fait': 1.0, 'partiel': 0.45, 'absent': 0.0}[e]

cartes = []
for lot in ordre:
    ls = [l for l in lignes if l['lot'] == lot]
    if not ls: continue
    avance = sum(poids(l['etat']) for l in ls) / len(ls)
    cartes.append({
        'nom': ls[0]['lot_beau'], 'vendu': VENDU_LOT[lot],
        'avance': round(avance * 100),
        'lignes': ls,
    })

nb = {'fait': 0, 'partiel': 0, 'absent': 0}
for l in lignes: nb[l['etat']] += 1

DATA = json.dumps({'cartes': cartes}, ensure_ascii=False)

def esc(s): return html.escape(str(s), quote=True)

jalons_html = "\n".join(
    f'''<li class="jal j-{e}"><span class="jn">{n}</span>
        <div><b>{esc(t)}</b><span>{esc(d)}</span></div></li>''' for n, t, d, e in jalons)

bloque_html = "\n".join(
    f'''<li><b>{esc(q)}</b><span class="chez">{esc(c)}</span><span>{esc(p)}</span></li>'''
    for q, c, p in bloque)

bonus_html = "\n".join(
    f'''<a class="bonus" href="{esc(u)}" target="_blank" rel="noopener">
        <b>{esc(t)}</b><span>{esc(d)}</span><em>{esc(s)}</em></a>''' for t, s, d, u in bonus)

PAGE = f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex, nofollow">
<title>a dispo : point du 18 septembre 2026</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
:root{{
  --bg:#F8F4EC; --bg-2:#FEFCF8; --surface:#EEEBE3; --surface-2:#EAE6DC;
  --cream:#191512; --cream-mut:#5E5A56; --cream-dim:#686561;
  --accent:#E12154; --accent-2:#C41A47; --accent-soft:rgba(225,33,84,.13);
  --accent-texte:#890026; --vert:#116B40; --vert-voile:rgba(17,107,64,.12);
  --alerte:#9A3208; --alerte-voile:rgba(154,50,8,.12);
  --line:#D8D4CC; --r:14px; --ombre:0 1px 2px rgba(25,21,18,.05),0 8px 24px -12px rgba(25,21,18,.16);
}}
*{{box-sizing:border-box}}
html{{-webkit-text-size-adjust:100%}}
body{{margin:0;background:var(--bg);color:var(--cream);
  font-family:"DM Sans",system-ui,sans-serif;font-size:16px;line-height:1.55;
  -webkit-font-smoothing:antialiased}}
h1,h2,h3{{font-family:"Space Grotesk",sans-serif;font-weight:700;margin:0;line-height:1.1}}
a{{color:inherit}}
.wrap{{max-width:1080px;margin:0 auto;padding:0 20px}}

/* ---------- en-tete ---------- */
header{{padding:clamp(34px,6vw,64px) 0 26px}}
.kt{{font-family:"JetBrains Mono",monospace;font-size:11.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--accent-texte);margin:0 0 14px}}
h1{{font-size:clamp(30px,5.4vw,50px);letter-spacing:-.025em}}
.sous{{color:var(--cream-mut);margin:14px 0 0;max-width:60ch;font-size:clamp(15px,1.8vw,17px)}}

/* ---------- les trois chiffres ---------- */
.chiffres{{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:30px 0 8px}}
@media(max-width:720px){{.chiffres{{grid-template-columns:1fr}}}}
.ch{{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r);
  padding:20px 22px;box-shadow:var(--ombre)}}
.ch b{{display:block;font-family:"Space Grotesk",sans-serif;font-size:clamp(28px,4.4vw,40px);
  line-height:1;letter-spacing:-.02em}}
.ch span{{display:block;color:var(--cream-mut);font-size:13.5px;margin-top:8px}}
.ch em{{font-style:normal;font-size:.5em;color:var(--cream-dim);font-weight:500}}

/* ---------- barre d avancement globale ---------- */
.global{{margin:26px 0 0;background:var(--bg-2);border:1px solid var(--line);
  border-radius:var(--r);padding:20px 22px;box-shadow:var(--ombre)}}
.gtitre{{display:flex;justify-content:space-between;align-items:baseline;gap:14px;flex-wrap:wrap}}
.gtitre b{{font-family:"Space Grotesk",sans-serif;font-size:16px}}
.gtitre span{{font-size:13px;color:var(--cream-mut)}}
.piste{{height:12px;border-radius:99px;background:var(--surface-2);overflow:hidden;
  display:flex;margin-top:14px}}
.piste i{{display:block;height:100%}}
.i-fait{{background:var(--vert)}} .i-part{{background:var(--alerte);opacity:.55}}
.legende{{display:flex;gap:20px;flex-wrap:wrap;margin-top:14px;font-size:13px;color:var(--cream-mut)}}
.legende b{{color:var(--cream);font-weight:700}}
.pt{{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px;
  vertical-align:middle}}
.p-fait{{background:var(--vert)}} .p-part{{background:var(--alerte)}}
.p-abs{{background:transparent;border:1.5px solid var(--cream-dim)}}

/* ---------- jalons ---------- */
section{{padding:40px 0 0}}
h2{{font-size:clamp(20px,2.6vw,25px);letter-spacing:-.015em}}
.h2sous{{color:var(--cream-mut);font-size:14px;margin:8px 0 20px}}
.jalons{{list-style:none;padding:0;margin:0;display:grid;
  grid-template-columns:repeat(5,1fr);gap:10px}}
@media(max-width:860px){{.jalons{{grid-template-columns:repeat(2,1fr)}}}}
@media(max-width:460px){{.jalons{{grid-template-columns:1fr}}}}
.jal{{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r);
  padding:16px 15px;display:flex;gap:11px;align-items:flex-start}}
.jal .jn{{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:grid;
  place-items:center;font-family:"JetBrains Mono",monospace;font-size:12px;
  background:var(--surface-2);color:var(--cream-mut)}}
.jal b{{display:block;font-family:"Space Grotesk",sans-serif;font-size:14.5px}}
.jal span{{display:block;color:var(--cream-dim);font-size:12.5px;margin-top:4px;line-height:1.4}}
.j-encours{{border-color:var(--alerte);background:var(--alerte-voile)}}
.j-encours .jn{{background:var(--alerte);color:#fff}}

/* ---------- les lots ---------- */
.lots{{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}}
@media(max-width:820px){{.lots{{grid-template-columns:1fr}}}}
.lot{{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r);
  padding:20px;box-shadow:var(--ombre)}}
.lot h3{{font-size:17px}}
.lot .vendu{{font-family:"JetBrains Mono",monospace;font-size:11.5px;color:var(--cream-dim);
  margin-top:5px;display:block}}
.mini{{height:6px;border-radius:99px;background:var(--surface-2);margin:13px 0 4px;overflow:hidden}}
.mini i{{display:block;height:100%;background:var(--vert)}}
.pc{{font-size:12px;color:var(--cream-mut);font-family:"JetBrains Mono",monospace}}
.rangs{{list-style:none;padding:0;margin:14px 0 0;display:flex;flex-direction:column;gap:2px}}
.rang{{width:100%;text-align:left;background:none;border:none;cursor:pointer;font:inherit;
  color:inherit;padding:9px 8px;border-radius:9px;display:flex;align-items:center;gap:10px;
  min-height:44px;transition:background .15s}}
.rang:hover,.rang:focus-visible{{background:var(--surface)}}
.rang:focus-visible{{outline:2px solid var(--accent-texte);outline-offset:1px}}
.rang .nom{{flex:1;font-size:14.2px;line-height:1.35}}
.rang .fl{{color:var(--cream-dim);font-size:15px;flex:0 0 auto}}

/* ---------- ce qui bloque ---------- */
.bloque{{list-style:none;padding:0;margin:0;display:grid;
  grid-template-columns:repeat(2,1fr);gap:12px}}
@media(max-width:760px){{.bloque{{grid-template-columns:1fr}}}}
.bloque li{{background:var(--bg-2);border:1px solid var(--line);
  border-left:4px solid var(--accent);border-radius:var(--r);padding:16px 18px}}
.bloque b{{font-family:"Space Grotesk",sans-serif;font-size:15px;display:block}}
.bloque .chez{{display:inline-block;background:var(--accent);color:#fff;font-weight:700;
  font-size:11px;letter-spacing:.04em;text-transform:uppercase;border-radius:99px;
  padding:3px 10px;margin:8px 0 7px}}
.bloque span{{display:block;color:var(--cream-mut);font-size:13.5px;line-height:1.45}}

/* ---------- offert ---------- */
.bonus-l{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}}
@media(max-width:760px){{.bonus-l{{grid-template-columns:1fr}}}}
.bonus{{background:var(--vert-voile);border:1px solid rgba(17,107,64,.3);border-radius:var(--r);
  padding:16px 18px;text-decoration:none;display:block;transition:transform .15s}}
.bonus:hover{{transform:translateY(-2px)}}
.bonus b{{font-family:"Space Grotesk",sans-serif;font-size:15px;display:block}}
.bonus em{{font-style:normal;display:block;font-size:11px;font-weight:700;color:var(--vert);
  text-transform:uppercase;letter-spacing:.06em;margin-top:9px}}
.bonus span{{display:block;color:var(--cream-mut);font-size:13.2px;margin-top:5px}}

/* ---------- la fiche ---------- */
dialog{{border:none;border-radius:18px;padding:0;max-width:560px;width:calc(100% - 32px);
  background:var(--bg-2);color:var(--cream);box-shadow:0 30px 70px -20px rgba(25,21,18,.4)}}
dialog::backdrop{{background:rgba(25,21,18,.45)}}
.fiche{{padding:26px 26px 22px}}
.fiche .etiq{{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;
  letter-spacing:.07em;border-radius:99px;padding:4px 11px;margin-bottom:12px}}
.e-fait{{background:var(--vert);color:#fff}}
.e-partiel{{background:var(--alerte);color:#fff}}
.e-absent{{background:var(--surface-2);color:var(--cream-mut)}}
.fiche h3{{font-size:20px;letter-spacing:-.01em}}
.fiche .promis{{color:var(--cream-mut);font-size:14px;margin:10px 0 0;line-height:1.5}}
.bloc{{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}}
.bloc h4{{font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--cream-dim);margin:0 0 7px;font-weight:500}}
.bloc p{{margin:0;font-size:14.4px;line-height:1.5}}
.lien{{display:inline-flex;align-items:center;gap:7px;margin-top:11px;background:var(--cream);
  color:var(--bg-2);text-decoration:none;font-weight:700;font-size:13.5px;
  border-radius:99px;padding:9px 17px;min-height:40px}}
.eff{{font-family:"JetBrains Mono",monospace;font-size:12.5px;color:var(--accent-texte);
  margin-top:9px;display:block}}
.fermer{{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;
  border:1px solid var(--line);background:var(--bg-2);cursor:pointer;font-size:17px;
  color:var(--cream);line-height:1;display:grid;place-items:center}}
.fermer:hover{{background:var(--surface)}}
dialog{{position:relative}}

footer{{margin-top:48px;padding:26px 0 40px;border-top:1px solid var(--line);
  color:var(--cream-dim);font-size:12.5px}}
@media print{{
  .rang{{cursor:default}} dialog{{display:none}}
  body{{background:#fff}} .lot,.ch,.global{{box-shadow:none}}
}}
</style>
</head>
<body>

<div class="wrap">

<header>
  <p class="kt">Point d'étape &middot; 18 septembre 2026</p>
  <h1>Où en est &laquo;&nbsp;à dispo&nbsp;&raquo;.</h1>
  <p class="sous">Devis N&deg;20260910-1, signé le 10 septembre. Chaque ligne ci-dessous a été
     mesurée contre le code réel, puis relue par un second contrôle chargé de la contredire.
     <b>Clique sur une ligne</b> pour voir ce qui est fait, ce qui manque, et le livrable.</p>

  <div class="chiffres">
    <div class="ch"><b>6 060 <em>&euro; HT</em></b>
      <span>37,5 jours vendus &middot; acompte de 3&nbsp;030&nbsp;&euro; encaissé le 13/09</span></div>
    <div class="ch"><b>34 <em>jours</em></b>
      <span>restent à produire, mesurés ligne par ligne</span></div>
    <div class="ch"><b>5 nov. <em>&rarr; 23 déc.</em></b>
      <span>livraison selon le rythme tenu, plein temps ou mi-temps</span></div>
  </div>

  <div class="global">
    <div class="gtitre"><b>Les 27 lignes du devis</b>
      <span>{nb['partiel']} entamées &middot; {nb['absent']} pas commencées</span></div>
    <div class="piste">
      <i class="i-part" style="width:{round(nb['partiel']*0.45/27*100)}%"></i>
    </div>
    <div class="legende">
      <span><i class="pt p-fait"></i><b>Fini</b> et vérifié</span>
      <span><i class="pt p-part"></i><b>Entamé</b>, il manque une part nommée</span>
      <span><i class="pt p-abs"></i><b>Pas commencé</b></span>
    </div>
  </div>
</header>

<section>
  <h2>Les cinq jalons</h2>
  <p class="h2sous">L'ordre suit les dépendances, pas l'ordre du devis. Le solde est dû au jalon 5.</p>
  <ul class="jalons">{jalons_html}</ul>
</section>

<section>
  <h2>Lot par lot</h2>
  <p class="h2sous">Clique une ligne pour la fiche : ce qui est fait, le livrable, ce qui manque.</p>
  <div class="lots" id="lots"></div>
</section>

<section>
  <h2>Ce qui bloque, et chez qui</h2>
  <p class="h2sous">Aucun de ces quatre points ne se débloque en écrivant du code.</p>
  <ul class="bloque">{bloque_html}</ul>
</section>

<section>
  <h2>Livré en plus, offert</h2>
  <p class="h2sous">Hors devis, déjà entre les mains de Claire-Marie.</p>
  <div class="bonus-l">{bonus_html}</div>
</section>

<footer>
  Relevé du 17/09/2026 sur le dépôt et sur la production. Les états sont mesurés, pas estimés :
  chaque ligne porte sa preuve. Les jours restants sont une estimation de production.
</footer>

</div>

<dialog id="fiche"><button class="fermer" id="x" aria-label="Fermer">&times;</button>
  <div class="fiche" id="corps"></div></dialog>

<script>
const D = {DATA};
const MOT = {{fait:"Fini", partiel:"Entamé", absent:"Pas commencé"}};
const PASTILLE = {{fait:"p-fait", partiel:"p-part", absent:"p-abs"}};

const ech = s => String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// --- les cartes de lot ---
document.getElementById("lots").innerHTML = D.cartes.map((c, ci) => `
  <article class="lot">
    <h3>${{ech(c.nom)}}</h3>
    <span class="vendu">${{ech(c.vendu)}}</span>
    <div class="mini"><i style="width:${{c.avance}}%"></i></div>
    <span class="pc">${{c.avance}} % du chemin</span>
    <ul class="rangs">${{c.lignes.map((l, li) => `
      <li><button class="rang" data-c="${{ci}}" data-l="${{li}}">
        <i class="pt ${{PASTILLE[l.etat]}}"></i>
        <span class="nom">${{ech(l.titre)}}</span>
        <span class="fl">&rsaquo;</span>
      </button></li>`).join("")}}</ul>
  </article>`).join("");

// --- la fiche ---
const dlg = document.getElementById("fiche");
const corps = document.getElementById("corps");
let rendeur = null;

function ouvrir(l, bouton) {{
  rendeur = bouton;
  corps.innerHTML = `
    <span class="etiq e-${{l.etat}}">${{MOT[l.etat]}}</span>
    <h3>${{ech(l.titre)}}</h3>
    ${{l.quoi ? `<p class="promis">Le devis promet : ${{ech(l.quoi)}}</p>` : ""}}
    ${{l.fait ? `<div class="bloc"><h4>Ce qui est fait</h4><p>${{ech(l.fait)}}</p>
        ${{l.lien ? `<a class="lien" href="${{ech(l.lien)}}" target="_blank" rel="noopener">
             ${{ech(l.lien_nom)}} &nearr;</a>` : ""}}</div>` : ""}}
    ${{l.manque && l.etat !== "fait"
        ? `<div class="bloc"><h4>Ce qui manque</h4><p>${{ech(l.manque)}}</p>
           <span class="eff">Reste ${{ech(l.effort)}}</span></div>` : ""}}`;
  dlg.showModal();
}}

document.getElementById("lots").addEventListener("click", e => {{
  const b = e.target.closest(".rang");
  if (!b) return;
  ouvrir(D.cartes[+b.dataset.c].lignes[+b.dataset.l], b);
}});

document.getElementById("x").addEventListener("click", () => dlg.close());
// Cliquer le voile ferme aussi : le reflexe est universel.
dlg.addEventListener("click", e => {{ if (e.target === dlg) dlg.close(); }});
// Le focus revient d'ou il venait, sinon on repart en haut de page a chaque fermeture.
dlg.addEventListener("close", () => {{ if (rendeur) rendeur.focus(); }});
</script>
</body>
</html>
'''

io.open('/Users/joanaglave/a-dispo/points/2026-09-18.html', 'w', encoding='utf-8').write(PAGE)
print("écrit :", len(PAGE), "caractères")
