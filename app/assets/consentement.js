/* ============================================================================
   LE BANDEAU DE CONSENTEMENT AUX TRACEURS, COMPOSANT REUTILISABLE.

   S'AJOUTE A N'IMPORTE QUELLE PAGE DU SITE PAR UNE SEULE LIGNE :
     <script src="/assets/consentement.js" defer></script>
   Il n'a aucune dependance, il n'ecrit rien dans la page tant qu'il n'a rien a
   demander, et il expose `window.Consentement` pour que /mes-donnees puisse
   rouvrir le reglage plus tard.

   ------------------------------------------------------------------
   MESURE DU 13/09/2026, ET C'EST ELLE QUI GOUVERNE TOUT CE FICHIER.

   Le depot ne charge AUCUN traceur. Recherche faite sur tout le depot, dossier
   `dist/` exclu, sur les noms de gtag, google-analytics, googletagmanager,
   plausible, matomo, umami, hotjar, posthog, fbq, clarity, mixpanel, segment,
   doubleclick : ZERO occurrence dans du code de page. Les seules ecritures
   locales mesurees sont :
     · `sb-<projet>-auth-token`, la session de connexion (Supabase). Strictement
       necessaire au service demande : exemptee de consentement par l'article
       82 de la loi n° 78-17 du 6 janvier 1978 et la recommandation « cookies »
       de la CNIL ;
     · `dispo-devis`, `dispo-simu`, `dispo-plan`, des preferences d'outils
       internes, posees a la demande de la personne, qui ne sortent jamais du
       navigateur et ne suivent personne.
   Aucune de ces trois-la n'appelle un bandeau.

   CONSEQUENCE TENUE DANS LE CODE : tant que `TRACEURS` est vide, ce fichier ne
   dessine RIEN. Pas de bandeau, pas de bouton, pas une ligne de memoire ecrite.
   Un bandeau qui demande le consentement pour rien fait fuir, habitue a
   cliquer sans lire, et n'a aucune valeur juridique le jour ou il en faudrait
   une. Le jour ou un traceur arrive, on l'ajoute a `TRACEURS` ci-dessous et le
   bandeau apparait tout seul, sur toutes les pages qui chargent ce fichier.

   LA REGLE QUI NE SE NEGOCIE PAS : rien de non essentiel ne se depose avant un
   choix. Ce n'est pas une politesse de l'interface, c'est la seule raison
   d'etre de ce fichier : un traceur ne s'installe que dans `poser()`, et
   `poser()` n'est appele que depuis `appliquer()`, qui n'appelle que ce qui a
   ete accepte explicitement. Le defaut est le refus, jamais le silence.

   TROIS CHOIX REELS, ET DE MEME POIDS. « Refuser » et « Accepter » ont la meme
   taille, la meme couleur, le meme nombre de clics. La CNIL demande que
   refuser soit aussi simple qu'accepter ; un bouton gris a cote d'un bouton
   dore ne remplit pas cette condition, et se sanctionne.

   CE QUE CE FICHIER NE FAIT PAS, ET POURQUOI.
     · Il n'ecrit rien dans la base. Le choix vit dans le navigateur : un
       visiteur non connecte n'a pas de compte ou l'inscrire, et le bandeau
       s'adresse d'abord a lui. La page /mes-donnees dit ce qu'il en est pour
       une personne connectee, et ce qui manque pour l'y inscrire.
     · Il ne mesure rien, n'envoie rien, ne rappelle personne.
   ============================================================================ */

(function (global, doc) {
  "use strict";

  /* --------------------------------------------------------------------
     1. LA DECLARATION DES TRACEURS.

     C'EST LE SEUL ENDROIT A MODIFIER le jour ou un traceur arrive. Chaque
     entree decrit ce qui sera depose, pour combien de temps, et par qui : ce
     sont exactement les mentions que l'article 82 impose d'afficher AVANT le
     depot. Une entree sans ces mentions est une entree illicite.

     Forme attendue :
       {
         cle:      "mesure",                      identifiant technique, stable
         finalite: "mesure_audience",             doit exister dans la table
                                                  public.consentement_textes
         nom:      "Mesure d'audience",           ce que la personne lit
         quoi:     "Compte les visites…",         en francais, sans jargon
         qui:      "[A COMPLETER : fournisseur]", qui recoit la donnee
         duree:    "[A COMPLETER : durée]",       duree de conservation
         poser:    function () { … },             installe le traceur
         retirer:  function () { … }              le coupe et efface ce qu'il a
                                                  pose. Facultatif : sans elle,
                                                  le composant demande un
                                                  rechargement de la page.
       }

     LA LISTE EST VIDE, ET C'EST UNE MESURE, PAS UN OUBLI. Voir l'en-tete. */
  var TRACEURS = [];

  /* --------------------------------------------------------------------
     2. LA MEMOIRE DU CHOIX.

     POURQUOI LE STOCKAGE LOCAL ET PAS UN COOKIE. Un cookie repart vers le
     serveur a chaque requete, y compris vers les images et les polices ; le
     choix de consentement n'a aucune raison de voyager. Le stockage local
     reste dans le navigateur.

     GARDER LE CHOIX EST LUI-MEME EXEMPTE DE CONSENTEMENT : c'est la preuve du
     choix, et ne pas la garder obligerait a redemander a chaque page.

     LA VERSION. Le jour ou la liste des traceurs change, un choix pris sur
     l'ancienne liste ne vaut plus pour la nouvelle. On incremente alors
     VERSION_CHOIX : les choix anterieurs sont ignores et la question est
     reposee, au lieu d'etendre en silence un accord a quelque chose qui
     n'existait pas quand il a ete donne. */
  var CLE_MEMOIRE = "dispo-traceurs";
  var VERSION_CHOIX = 1;

  /* Le repli quand le stockage local est refuse (navigation privee de certains
     navigateurs, reglage d'entreprise). Le composant ne doit jamais tomber :
     il perd la memoire entre deux pages, il ne perd pas le refus par defaut. */
  var enMemoire = null;
  var masqueCeChargement = false;
  var abonnes = [];

  function lire() {
    try {
      var brut = global.localStorage.getItem(CLE_MEMOIRE);
      if (!brut) return enMemoire;
      var o = JSON.parse(brut);
      if (!o || o.version !== VERSION_CHOIX) return null;
      return o;
    } catch (e) { return enMemoire; }
  }

  function ecrire(o) {
    enMemoire = o;
    try { global.localStorage.setItem(CLE_MEMOIRE, JSON.stringify(o)); }
    catch (e) { /* on garde en memoire, la page reste juste */ }
  }

  function oublier() {
    enMemoire = null;
    try { global.localStorage.removeItem(CLE_MEMOIRE); } catch (e) {}
  }

  /* --------------------------------------------------------------------
     3. CE QUI EST AUTORISE, ET CE QUI S'APPLIQUE.

     `autorise()` repond NON par defaut : pas de choix enregistre, pas de
     depot. C'est la ligne la plus importante du fichier. */
  function autorise(finalite) {
    var e = lire();
    return !!(e && e.choix && e.choix[finalite] === true);
  }

  var posesFaites = {};

  function appliquer() {
    var rechargerUtile = false;
    TRACEURS.forEach(function (t) {
      var veut = autorise(t.finalite);
      if (veut && !posesFaites[t.cle]) {
        try { if (typeof t.poser === "function") t.poser(); posesFaites[t.cle] = true; }
        catch (e) { /* un traceur qui tombe ne casse pas la page */ }
      } else if (!veut && posesFaites[t.cle]) {
        if (typeof t.retirer === "function") {
          try { t.retirer(); } catch (e) {}
          posesFaites[t.cle] = false;
        } else {
          /* Sans `retirer()`, on ne peut pas promettre que le traceur est
             coupe. On le DIT au lieu de laisser croire que c'est fait. */
          rechargerUtile = true;
        }
      }
    });
    abonnes.forEach(function (f) { try { f(lire(), rechargerUtile); } catch (e) {} });
    return rechargerUtile;
  }

  function enregistrer(choix, origine) {
    var propre = {};
    finalites().forEach(function (f) { propre[f] = choix && choix[f] === true; });
    ecrire({
      version: VERSION_CHOIX,
      date: new Date().toISOString(),
      origine: origine || "bandeau-traceurs",
      choix: propre
    });
    var recharger = appliquer();
    fermerBandeau();
    return recharger;
  }

  function finalites() {
    var vues = [], out = [];
    TRACEURS.forEach(function (t) {
      if (vues.indexOf(t.finalite) < 0) { vues.push(t.finalite); out.push(t.finalite); }
    });
    return out;
  }

  function tout(valeur) {
    var c = {};
    finalites().forEach(function (f) { c[f] = valeur; });
    return c;
  }

  /* --------------------------------------------------------------------
     4. LE STYLE.

     Pose une seule fois, et seulement si on a quelque chose a dessiner. Les
     variables de la charte sont reprises avec un repli en dur : le composant
     doit rester juste sur une page qui ne les definirait pas.

     Les cibles tactiles sont a 48 px de haut : l'artisan est debout, avec une
     main, au soleil. Aucun debordement lateral : le bandeau est en `100%` de
     large, jamais en largeur fixe. */
  var STYLE = [
    '.dcnst{position:fixed;left:0;right:0;bottom:0;z-index:9999;',
    '  background:var(--bg-2,#111C2E);color:var(--cream,#F2EAD8);',
    '  border-top:1px solid var(--line,rgba(242,234,216,.10));',
    '  font-family:"Karla",system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;',
    '  box-shadow:0 -18px 40px rgba(0,0,0,.35);max-height:86vh;overflow-y:auto}',
    '.dcnst-in{max-width:620px;margin:0 auto;padding:18px clamp(1.1rem,4.5vw,3rem) ',
    '  calc(18px + env(safe-area-inset-bottom,0px))}',
    '.dcnst h2{font-family:"Signika",sans-serif;font-weight:700;font-size:17px;margin:0 0 6px}',
    '.dcnst p{margin:0 0 12px;color:var(--cream-mut,rgba(242,234,216,.72));font-size:14.2px}',
    '.dcnst a{color:var(--accent,#E8B93E)}',
    '.dcnst-b{display:flex;gap:9px;flex-wrap:wrap}',
    /* REFUSER ET ACCEPTER SONT STRICTEMENT IDENTIQUES. Meme fond, meme bordure,
       meme graisse, meme largeur minimale. Un bouton d'acceptation mis en
       avant rendrait le refus plus difficile, ce qui est precisement ce que la
       CNIL sanctionne. */
    '.dcnst-b button{flex:1 1 148px;min-height:48px;font:inherit;font-family:"Signika",sans-serif;',
    '  font-weight:700;font-size:15px;border-radius:999px;cursor:pointer;padding:12px 18px;',
    '  background:var(--surface,#22344F);color:var(--cream,#F2EAD8);',
    '  border:1px solid var(--line,rgba(242,234,216,.10))}',
    '.dcnst-b button:hover{border-color:var(--accent,#E8B93E)}',
    '.dcnst-b button:focus-visible{outline:3px solid var(--cream,#F2EAD8);outline-offset:2px}',
    '.dcnst-b button[data-a="regler"]{flex:1 1 100%;background:transparent;',
    '  color:var(--cream-dim,#A9B6C6);font-weight:400;font-size:14px}',
    /* Le detail, finalite par finalite. */
    '.dcnst-l{margin:0 0 12px;padding:0;list-style:none}',
    '.dcnst-l li{border:1px solid var(--line,rgba(242,234,216,.10));border-radius:12px;',
    '  padding:12px 14px;margin:0 0 8px;background:var(--bg,#0C1421)}',
    '.dcnst-l label{display:flex;gap:11px;align-items:flex-start;cursor:pointer}',
    '.dcnst-l input{margin:3px 0 0;width:22px;height:22px;flex:none;accent-color:var(--accent,#E8B93E)}',
    '.dcnst-l b{font-family:"Signika",sans-serif;font-size:14.5px;display:block}',
    '.dcnst-l span{display:block;font-size:13.2px;color:var(--cream-mut,rgba(242,234,216,.72))}',
    '.dcnst-l code{font-family:"JetBrains Mono",monospace;font-size:11.5px;',
    '  color:var(--cream-dim,#A9B6C6);overflow-wrap:anywhere}',
    '.dcnst-vide{font-size:13.5px;color:var(--cream-dim,#A9B6C6);margin:0}',
    '@media (prefers-reduced-motion: reduce){.dcnst{transition:none}}'
  ].join("");

  var stylePose = false;
  function poserStyle() {
    if (stylePose) return;
    var s = doc.createElement("style");
    s.setAttribute("data-de", "consentement");
    s.textContent = STYLE;
    doc.head.appendChild(s);
    stylePose = true;
  }

  var ech = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  /* --------------------------------------------------------------------
     5. LE BANDEAU. */
  var bandeau = null, rendeurAvant = null;

  function fermerBandeau() {
    if (!bandeau) return;
    bandeau.remove();
    bandeau = null;
    if (rendeurAvant && doc.contains(rendeurAvant)) { try { rendeurAvant.focus(); } catch (e) {} }
  }

  function listeHtml(choix) {
    return '<ul class="dcnst-l">' + TRACEURS.map(function (t, i) {
      var coche = choix && choix[t.finalite] === true ? " checked" : "";
      return '<li><label for="dcnst-c' + i + '">'
        + '<input type="checkbox" id="dcnst-c' + i + '" data-f="' + ech(t.finalite) + '"' + coche + '>'
        + "<span><b>" + ech(t.nom) + "</b>"
        + "<span>" + ech(t.quoi) + "</span>"
        + '<span><code>Déposé par ' + ech(t.qui) + " · conservé " + ech(t.duree) + "</code></span>"
        + "</span></label></li>";
    }).join("") + "</ul>";
  }

  function dessinerBandeau(detaille) {
    poserStyle();
    var etat = lire();
    var choix = etat && etat.choix ? etat.choix : tout(false);
    if (!bandeau) {
      bandeau = doc.createElement("div");
      bandeau.className = "dcnst";
      bandeau.setAttribute("role", "dialog");
      bandeau.setAttribute("aria-modal", "false");
      bandeau.setAttribute("aria-labelledby", "dcnst-t");
      bandeau.setAttribute("aria-describedby", "dcnst-d");
      doc.body.appendChild(bandeau);
    }
    bandeau.innerHTML = '<div class="dcnst-in">'
      + '<h2 id="dcnst-t" tabindex="-1">Ce site peut déposer des traceurs</h2>'
      + '<p id="dcnst-d">Rien n\'est déposé tant que tu n\'as pas choisi. '
      + 'Tu peux revenir sur ce choix à tout moment depuis '
      + '<a href="/mes-donnees">mes données</a>.</p>'
      + (detaille ? listeHtml(choix) : "")
      + '<div class="dcnst-b">'
      +   '<button type="button" data-a="refuser">Tout refuser</button>'
      +   '<button type="button" data-a="' + (detaille ? "garder" : "accepter") + '">'
      +     (detaille ? "Enregistrer mes choix" : "Tout accepter") + "</button>"
      +   (detaille ? "" : '<button type="button" data-a="regler">Personnaliser mon choix</button>')
      + "</div></div>";

    bandeau.querySelectorAll("button[data-a]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = b.dataset.a;
        if (a === "regler") { dessinerBandeau(true); return; }
        if (a === "refuser") { enregistrer(tout(false), "bandeau-traceurs"); return; }
        if (a === "accepter") { enregistrer(tout(true), "bandeau-traceurs"); return; }
        var c = {};
        bandeau.querySelectorAll("input[data-f]").forEach(function (i) { c[i.dataset.f] = i.checked; });
        enregistrer(c, "bandeau-traceurs-personnalise");
      });
    });

    /* Le focus va sur le titre : un lecteur d'ecran annonce la question, et le
       clavier arrive directement sur les boutons au premier Tab. */
    var t = bandeau.querySelector("#dcnst-t");
    if (t) { try { t.focus(); } catch (e) {} }
  }

  /* Echap referme SANS RIEN ENREGISTRER : aucun choix, donc aucun depot, et la
     question revient au prochain chargement. Fermer n'est pas accepter. */
  doc.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && bandeau) { masqueCeChargement = true; fermerBandeau(); }
  });

  /* --------------------------------------------------------------------
     6. LE PANNEAU DE REGLAGE POSE DANS UNE PAGE.

     C'est par lui que /mes-donnees laisse modifier le choix plus tard. Il rend
     aussi, et surtout, l'etat VIDE : « aucun traceur declare », qui est la
     verite du 13/09/2026 et qui doit se lire a l'ecran plutot que de laisser
     un panneau vide sans explication. */
  function reglages(hote) {
    if (!hote) return;
    poserStyle();
    if (!TRACEURS.length) {
      hote.innerHTML = '<p class="dcnst-vide">Aucun traceur n\'est déclaré sur ce site '
        + "aujourd'hui : il n'y a donc rien à accepter ni à refuser, et aucun bandeau "
        + "ne s'affiche. Le jour où une mesure d'audience sera posée, elle sera déclarée "
        + "ici et le bandeau apparaîtra de lui-même, avant tout dépôt.</p>";
      return;
    }
    var etat = lire();
    var choix = etat && etat.choix ? etat.choix : tout(false);
    hote.innerHTML = listeHtml(choix)
      + '<div class="dcnst-b">'
      +   '<button type="button" data-a="refuser">Tout refuser</button>'
      +   '<button type="button" data-a="garder">Enregistrer mes choix</button>'
      + "</div>"
      + '<p class="dcnst-vide" id="dcnst-dit" role="status" aria-live="polite">'
      + (etat ? "Choix enregistré le " + ech(new Date(etat.date).toLocaleString("fr-FR")) + "."
              : "Aucun choix enregistré : rien n'est déposé.") + "</p>";

    hote.querySelectorAll("button[data-a]").forEach(function (b) {
      b.addEventListener("click", function () {
        var c;
        if (b.dataset.a === "refuser") c = tout(false);
        else {
          c = {};
          hote.querySelectorAll("input[data-f]").forEach(function (i) { c[i.dataset.f] = i.checked; });
        }
        var recharger = enregistrer(c, "mes-donnees");
        var dit = hote.querySelector("#dcnst-dit");
        if (dit) {
          dit.textContent = "Choix enregistré."
            + (recharger ? " Recharge la page pour que le retrait soit effectif." : "");
        }
        reglages(hote);
      });
    });
  }

  /* --------------------------------------------------------------------
     7. LE DEMARRAGE.

     RIEN NE S'AFFICHE S'IL N'Y A RIEN A DEMANDER. C'est la mesure du
     13/09/2026 tenue dans le code, et non seulement ecrite en commentaire. */
  function demarrer() {
    if (!TRACEURS.length) return;          /* aucun traceur : aucun bandeau */
    appliquer();                           /* re-pose ce qui a deja ete accepte */
    if (masqueCeChargement) return;
    var etat = lire();
    if (etat) return;                      /* un choix existe deja */
    rendeurAvant = doc.activeElement;
    dessinerBandeau(false);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();

  /* --------------------------------------------------------------------
     8. CE QUE LE COMPOSANT OFFRE AUX PAGES. */
  global.Consentement = {
    /* La liste declaree, en copie : une page ne modifie pas la declaration. */
    traceurs: function () { return TRACEURS.map(function (t) {
      return { cle: t.cle, finalite: t.finalite, nom: t.nom,
               quoi: t.quoi, qui: t.qui, duree: t.duree };
    }); },
    /* Vrai quand il y a quelque chose a gouverner. Faux au 13/09/2026. */
    actif: function () { return TRACEURS.length > 0; },
    finalites: finalites,
    /* Le choix enregistre, ou null. */
    etat: lire,
    /* La question qui compte avant de deposer quoi que ce soit. */
    autorise: autorise,
    /* Rouvrir le bandeau : « modifier mon choix », depuis /mes-donnees. */
    ouvrir: function (detaille) {
      if (!TRACEURS.length) return false;
      masqueCeChargement = false;
      rendeurAvant = doc.activeElement;
      dessinerBandeau(detaille !== false);
      return true;
    },
    /* Poser le panneau dans un element de la page. */
    reglages: reglages,
    /* Effacer le choix : la question sera reposee. Sert au bouton
       « revenir en arrière » et aux essais. */
    oublier: function () { oublier(); return true; },
    /* Etre prevenu quand le choix change : `fn(etat, rechargerUtile)`. */
    surChangement: function (fn) { if (typeof fn === "function") abonnes.push(fn); },
    /* La version de la declaration, pour qu'une page puisse la citer. */
    version: VERSION_CHOIX
  };

})(window, document);
