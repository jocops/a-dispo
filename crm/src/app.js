/* ===================================================================
   CRM À dispo : application
   Un seul fichier, aucune dépendance. Données : base Pipedrive inlinée
   (window.CRM_CONTACTS) + couche « travail » (statuts, notes, historique)
   persistée en local ou dans Supabase selon CRM_CONFIG.
   Conventions : aucune valeur inventée ; tout texte utilisateur passe par esc().
=================================================================== */
(function () {
  "use strict";
  const CFG = window.CRM_CONFIG;
  const BASE = window.CRM_CONTACTS || [];
  const STATUTS = CFG.statuts;
  const ST = Object.fromEntries(STATUTS.map(s => [s.key, s]));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const now = () => new Date().toISOString();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const fmtDate = d => { if (!d) return ""; const [y, m, j] = d.slice(0, 10).split("-"); return `${j}/${m}/${y}`; };
  const fmtDT = d => { if (!d) return ""; const x = new Date(d); return x.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " + x.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const FIAB = { fiable: "Fiable", a_controler: "À contrôler", inexploitable: "Inexploitable" };

  /* ------------------------------------------------------------------ état */
  let OVER = {};              // id -> couche travail
  let USER = "";              // prénom courant
  let MERGED = null;          // cache des fiches fusionnées
  let openId = null;          // fiche ouverte
  let view = "dash";
  let sortKey = "id", sortDir = 1;
  let shown = 300;
  const F = { q: "", statut: null, fiab: null, resp: null, relance: null, metier: "", dept: "", autres: null };
  const SEL = new Set();      // sélection multiple (tableau)
  let dragId = null;

  /* ------------------------------------------------------------------ préférences (toujours locales) */
  const PREF_KEY = CFG.cleStockage + ".pref";
  const pref = (() => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); } catch (e) { return {}; } })();
  const savePref = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch (e) { } };

  /* ------------------------------------------------------------------ authentification (Supabase Auth, REST) */
  const Auth = {
    session: null,      // { access_token, refresh_token, expires_at, user }
    profil: null,       // { id, prenom, email }
    key() { return CFG.cleStockage + ".session"; },
    base() { return CFG.supabase.url.replace(/\/$/, "") + "/auth/v1"; },
    headers(extra) { return Object.assign({ apikey: CFG.supabase.anonKey, "Content-Type": "application/json" }, extra || {}); },
    load() { try { this.session = JSON.parse(localStorage.getItem(this.key()) || "null"); } catch (e) { this.session = null; } },
    save(s) {
      if (s && s.access_token) { s.expires_at = Date.now() + ((s.expires_in || 3600) - 60) * 1000; this.session = s; try { localStorage.setItem(this.key(), JSON.stringify(s)); } catch (e) { } }
      else { this.session = null; localStorage.removeItem(this.key()); }
    },
    /* jeton arrivé par lien magique : #access_token=...&refresh_token=... */
    /* Le lien recu par e-mail depose soit un jeton, soit une erreur, dans le
       fragment de l'adresse. Sans lire l'erreur, un lien perime ramenait l'ecran
       de connexion sans un mot d'explication, et on croyait le CRM casse.
       Cas vecu le 5 septembre 2026. */
    erreurDuLien() {
      const h = location.hash.slice(1);
      if (!h || !/error/.test(h)) return "";
      const p = new URLSearchParams(h);
      const code = p.get("error_code") || p.get("error") || "";
      history.replaceState(null, "", location.pathname + location.search);
      if (/expired/.test(code)) return "Ce lien de connexion a expiré ou a déjà servi. Redemande-en un ci-dessous : chaque lien ne vaut qu'une fois, et une heure au plus.";
      if (/access_denied|otp/.test(code)) return "Ce lien de connexion n'est plus valable. Redemande-en un ci-dessous.";
      return "La connexion a échoué : " + (p.get("error_description") || code).replace(/\+/g, " ") + ". Redemande un lien ci-dessous.";
    },
    fromHash() {
      const h = location.hash.slice(1); if (!h || !/access_token=/.test(h)) return false;
      const p = new URLSearchParams(h);
      this.save({ access_token: p.get("access_token"), refresh_token: p.get("refresh_token"), expires_in: Number(p.get("expires_in") || 3600) });
      history.replaceState(null, "", location.pathname + location.search);
      return true;
    },
    async login(email, password) {
      const r = await fetch(this.base() + "/token?grant_type=password", { method: "POST", headers: this.headers(), body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(this.msg(j));
      this.save(j); return j;
    },
    async magicLink(email) {
      const r = await fetch(this.base() + "/otp", { method: "POST", headers: this.headers(), body: JSON.stringify({ email, create_user: false, options: { email_redirect_to: location.href.split("#")[0] } }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(this.msg(j)); }
    },
    async refresh() {
      if (!this.session || !this.session.refresh_token) return false;
      const r = await fetch(this.base() + "/token?grant_type=refresh_token", { method: "POST", headers: this.headers(), body: JSON.stringify({ refresh_token: this.session.refresh_token }) });
      if (!r.ok) { this.save(null); return false; }
      this.save(await r.json()); return true;
    },
    async ensure() {
      if (!this.session) return false;
      if (Date.now() > (this.session.expires_at || 0)) return this.refresh();
      return true;
    },
    async user() {
      const r = await fetch(this.base() + "/user", { headers: this.headers({ Authorization: "Bearer " + this.session.access_token }) });
      if (!r.ok) throw new Error("session invalide");
      return r.json();
    },
    async logout() {
      try { if (this.session) await fetch(this.base() + "/logout", { method: "POST", headers: this.headers({ Authorization: "Bearer " + this.session.access_token }) }); } catch (e) { }
      this.save(null); location.reload();
    },
    msg(j) {
      const m = (j && (j.error_description || j.msg || j.message || j.error)) || "";
      if (/invalid login|invalid_credentials|Invalid login/i.test(m)) return "E-mail ou mot de passe incorrect.";
      if (/rate limit|too many/i.test(m)) return "Trop d'essais, attends une minute.";
      if (/Signups not allowed|not allowed/i.test(m)) return "Cet e-mail n'a pas de compte. Demande à Joan de l'ajouter.";
      if (/Email not confirmed/i.test(m)) return "E-mail non confirmé : ouvre le message reçu de Supabase.";
      return m || "Connexion impossible.";
    },
    /* écran de connexion : résout quand une session valide existe */
    ask(message) {
      return new Promise(res => {
        const ov = $("#ovLogin"), err = $("#loginErr"), mail = $("#loginEmail"), pwd = $("#loginPwd");
        ov.classList.add("open"); err.style.color = ""; err.textContent = message || ""; mail.focus();
        const done = () => { ov.classList.remove("open"); res(); };
        $("#loginOk").onclick = async () => {
          err.textContent = ""; const e = mail.value.trim(), p = pwd.value;
          if (!e || !p) { err.textContent = "E-mail et mot de passe, s'il te plaît."; return; }
          $("#loginOk").disabled = true;
          try { await this.login(e, p); done(); } catch (x) { err.textContent = /fetch/i.test(x.message) ? "Base en ligne injoignable. Vérifie ta connexion internet et réessaie." : x.message; } finally { $("#loginOk").disabled = false; }
        };
        $("#loginMagic").onclick = async () => {
          err.textContent = ""; const e = mail.value.trim();
          if (!e) { err.textContent = "Entre d'abord ton e-mail."; return; }
          try { await this.magicLink(e); err.style.color = "var(--vert)"; err.textContent = "Si un compte existe pour " + e + ", le lien vient de partir. Ouvre ta boîte mail, regarde aussi les indésirables, et clique : tu reviens ici connectée. Le lien ne sert qu'une fois."; }
          catch (x) { err.style.color = ""; err.textContent = x.message; }
        };
        pwd.onkeydown = e => { if (e.key === "Enter") $("#loginOk").click(); };
        mail.onkeydown = e => { if (e.key === "Enter") pwd.focus(); };
      });
    }
  };

  /* ------------------------------------------------------------------ couche de données */
  const Store = {
    mode: "local",
    lastSync: null,
    profils: [],
    async init() {
      const sb = CFG.supabase || {};
      if (sb.url && sb.anonKey) {
        this.mode = "supabase";
        Auth.load();
        const souci = Auth.erreurDuLien();
        Auth.fromHash();
        if (!(await Auth.ensure())) await Auth.ask(souci);
        await this.sbProfil();
        await this.sbLoad();
      }
      else { this.mode = "local"; this.localLoad(); }
    },
    /* ---- local */
    localLoad() {
      try { OVER = JSON.parse(localStorage.getItem(CFG.cleStockage + ".data") || "{}"); } catch (e) { OVER = {}; }
    },
    localSave() {
      try { localStorage.setItem(CFG.cleStockage + ".data", JSON.stringify(OVER)); }
      catch (e) { toast("Sauvegarde locale impossible (navigateur plein ?)", true); }
    },
    /* ---- supabase (REST PostgREST, sans SDK) */
    sbHeaders(extra) {
      return Object.assign({ apikey: CFG.supabase.anonKey, Authorization: "Bearer " + (Auth.session ? Auth.session.access_token : CFG.supabase.anonKey), "Content-Type": "application/json" }, extra || {});
    },
    sbUrl(q, table) { return CFG.supabase.url.replace(/\/$/, "") + "/rest/v1/" + (table || CFG.supabase.table) + (q || ""); },
    /* fetch avec jeton à jour ; sur 401, rafraîchit puis réessaie, sinon redemande la connexion */
    async sbFetch(url, opts) {
      await Auth.ensure();
      let r = await fetch(url, Object.assign({}, opts, { headers: this.sbHeaders(opts && opts.headers) }));
      if (r.status === 401) {
        const ok = await Auth.refresh();
        if (!ok) { await Auth.ask(); await this.sbProfil(); }
        r = await fetch(url, Object.assign({}, opts, { headers: this.sbHeaders(opts && opts.headers) }));
      }
      return r;
    },
    async sbProfil() {
      const u = await Auth.user();
      /* `admin` peut ne pas exister si la migration n'a pas encore ete jouee :
         PostgREST renverrait alors une 400. On tente avec, on retombe sans. */
      let r = await this.sbFetch(this.sbUrl("?select=id,prenom,email,actif,admin,vu_le,presence&order=prenom", "profils"));
      if (!r.ok) r = await this.sbFetch(this.sbUrl("?select=id,prenom,email,actif,vu_le&order=prenom", "profils"));
      this.tous = r.ok ? await r.json() : [];
      this.profils = this.tous.filter(p => p.actif !== false);
      const mien = this.tous.find(p => p.id === u.id);
      Auth.profil = mien || { id: u.id, prenom: (u.user_metadata && u.user_metadata.prenom) || (u.email || "").split("@")[0], email: u.email };
      setUser(Auth.profil.prenom);
    },
    /* Modifier un profil : prenom ou acces. Le droit vient des regles de la base
       (politique « profils maj admin »), pas de ce fichier : une personne qui
       n'est pas admin recoit un refus meme si elle bricole la page. */
    async sbMajProfil(id, patch) {
      const r = await this.sbFetch(this.sbUrl(`?id=eq.${encodeURIComponent(id)}`, "profils"),
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error("La base a refusé la modification (" + r.status + ")");
      const j = await r.json();
      if (!j.length) throw new Error("Aucun profil modifié : ton compte n'a pas le droit d'administrer.");
      await this.sbProfil();
      return j[0];
    },
    /* ---- presence
       Chaque personne connectee signale ou elle est, toutes les 30 secondes et a
       chaque changement de vue ou de fiche. « En ligne » veut dire : vue il y a
       moins de 90 secondes, soit trois battements manques. On ne tient pas une
       connexion ouverte, on laisse une trace datee : c'est suffisant pour savoir
       qui travaille, et cela coute deux requetes par minute et par personne. */
    async battre() {
      if (this.mode !== "supabase" || !Auth.profil) return;
      const c = openId != null ? byId(openId) : null;
      const p = { vue: view, fiche: openId, libelle: c ? (c.orgAff || c.nomAff || "") : "" };
      try {
        await this.sbFetch(this.sbUrl(`?id=eq.${encodeURIComponent(Auth.profil.id)}`, "profils"),
          { method: "PATCH", body: JSON.stringify({ vu_le: new Date().toISOString(), presence: p }) });
      } catch (e) { /* un battement manque n'est pas une panne, le suivant repassera */ }
    },
    async relirePresence() {
      if (this.mode !== "supabase") return;
      let r = await this.sbFetch(this.sbUrl("?select=id,prenom,email,actif,admin,vu_le,presence&order=prenom", "profils"));
      if (!r.ok) return;
      this.tous = await r.json();
      this.profils = this.tous.filter(p => p.actif !== false);
      renderPresence();
    },
    lancerPresence() {
      if (this.mode !== "supabase") return;
      this.battre();
      setInterval(() => { this.battre(); this.relirePresence().catch(() => { }); }, 30000);
    },
    async sbLoad() {
      const rows = [];
      let from = 0, page = 1000;
      for (;;) {
        const r = await this.sbFetch(this.sbUrl("?select=id,base,crm,updated_at&order=id"), { headers: { Range: `${from}-${from + page - 1}` } });
        if (!r.ok) throw new Error("Supabase " + r.status);
        const j = await r.json(); rows.push(...j);
        if (j.length < page) break; from += page;
      }
      OVER = {};
      rows.forEach(row => this.sbApplyRow(row));
      this.lastSync = now();
      setInterval(() => this.sbPoll().catch(e => setSync("err", e.message)), CFG.supabase.pollMs || 20000);
      this.lancerPresence();
    },
    sbApplyRow(row) {
      const o = Object.assign({}, row.crm || {});
      if (row.base) o.base = row.base;
      if (Object.keys(o).length) OVER[row.id] = o; else delete OVER[row.id];
    },
    async sbPoll() {
      const r = await this.sbFetch(this.sbUrl(`?select=id,base,crm,updated_at&updated_at=gt.${encodeURIComponent(this.lastSync)}`));
      if (!r.ok) throw new Error("Supabase " + r.status);
      const j = await r.json();
      if (j.length) {
        j.forEach(row => this.sbApplyRow(row));
        this.lastSync = now(); MERGED = null; renderAll();
        toast(j.length + " fiche(s) mise(s) à jour par l'équipe");
      }
      setSync("ok");
    },
    async sbPut(id, o) {
      const body = { id: Number(id), crm: stripBase(o), updated_at: now(), updated_by: USER };
      if (o && o.base) body.base = o.base;
      const r = await this.sbFetch(this.sbUrl(), { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([body]) });
      if (!r.ok) throw new Error("Supabase " + r.status);
      this.lastSync = body.updated_at;
    },
    /* ---- api commune */
    async put(id, o) {
      if (this.mode === "local") { this.localSave(); return; }
      try { await this.sbPut(id, o); setSync("ok"); }
      catch (e) { setSync("err", e.message); toast("Enregistrement en ligne impossible : " + e.message, true); }
    },
    async putMany(ids) {
      if (this.mode === "local") { this.localSave(); return; }
      for (const id of ids) await this.put(id, OVER[id]);
    }
  };
  const stripBase = o => { const c = Object.assign({}, o); delete c.base; return c; };

  function setSync(state, msg) {
    const el = $("#sync"); if (!el) return;
    el.className = "sync " + (Store.mode === "local" ? "local" : state === "err" ? "err" : "");
    el.title = Store.mode === "local" ? "Mode local : données dans ce navigateur" : state === "err" ? "Erreur de synchronisation : " + (msg || "") : "Synchronisé avec la base partagée";
  }

  /* ------------------------------------------------------------------ fusion base + travail */
  function ov(id) { return OVER[id] || (OVER[id] = {}); }
  function merged() {
    if (MERGED) return MERGED;
    const out = [];
    const seen = new Set();
    BASE.forEach(b => { seen.add(b.id); out.push(mergeOne(b, OVER[b.id] || {})); });
    Object.keys(OVER).forEach(id => { const o = OVER[id]; if (o.base && !seen.has(Number(id))) out.push(mergeOne(Object.assign({ id: Number(id) }, o.base), o)); });
    MERGED = out.filter(c => !c.crm.supprime);
    return MERGED;
  }
  /* ------------------------------------------------------------------ noms et site web
     Deux harmonisations d'AFFICHAGE. Les valeurs d'origine ne sont jamais
     modifiees : elles restent dans c.organisation et c.nom, se relisent dans la
     fiche et partent telles quelles dans les corrections. Rien n'est invente.

     1. La casse. Mesure sur la base : 686 des 1 288 raisons sociales (53 %) sont
     ecrites entierement en capitales par l'extraction Pipedrive. On les remet en
     casse de titre. Un nom deja saisi en casse mixte a ete ecrit par un humain :
     on n'y touche pas. La regle preserve ce qui doit l'etre, releve dans la base :
     formes juridiques (SARL 34, SAS 11, EURL 10, ETS 7, SA 3) en capitales,
     particules francaises en minuscules sauf en tete (et 14, de 9, du 5, la 4),
     initiales pointees (J.C.) et lettres seules en capitales, mots contenant un
     chiffre laisses tels quels (ALU 2000), chaque partie d'un mot compose
     capitalisee (SAINT-MARTIN devient Saint-Martin).

     2. Le site web. La base n'a aucun champ site web : le seul indice fiable est
     le domaine d'une adresse professionnelle. 392 contacts sur 1 374 en ont une,
     372 domaines distincts. Les 625 boites generiques (gmail 229, orange 158,
     wanadoo 76, free 24...) n'en donnent aucun : la place reste vide plutot que
     d'afficher un lien qui n'existe pas. Le lien est signale comme deduit. */
  const FORMES_JURIDIQUES = new Set(["SARL", "SARLU", "SAS", "SASU", "EURL", "EI", "EIRL", "SA", "SCI", "SNC", "SCOP", "GIE", "SCM", "SELARL", "SCP", "GAEC"]);
  const PARTICULES = new Set(["et", "de", "des", "du", "la", "le", "les", "aux", "au", "en", "sur", "sous", "pour", "par", "chez"]);
  const BOITES_GENERIQUES = new Set(["gmail.com", "googlemail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr",
    "yahoo.fr", "yahoo.com", "yahoo.es", "orange.fr", "orange.com", "wanadoo.fr", "free.fr", "sfr.fr", "neuf.fr",
    "laposte.net", "live.fr", "live.com", "icloud.com", "me.com", "mac.com", "aol.com", "bbox.fr", "numericable.fr",
    "club-internet.fr", "voila.fr", "msn.com", "gmx.fr", "gmx.com", "protonmail.com", "proton.me", "alice.fr",
    "cegetel.net", "noos.fr", "libertysurf.fr", "aliceadsl.fr", "9online.fr", "tiscali.fr"]);
  const APOS = /['’]/;

  function motHarmonise(mot, premier) {
    if (/\d/.test(mot)) return mot;                                      /* ALU 2000, 3D */
    const nu = mot.replace(/[^A-Za-zÀ-ÿ'’]/g, "");
    if (FORMES_JURIDIQUES.has(nu.toUpperCase())) return mot.toUpperCase();
    if (/^(?:[A-Za-zÀ-ÿ]\.){2,}$/.test(mot)) return mot.toUpperCase();   /* J.C. */
    if (nu.length === 1) return mot.toUpperCase();
    /* Un mot court sans voyelle est un sigle, pas un mot : DPS, ADX, MP, DG, TS.
       On le laisse en capitales. Le discriminant est la voyelle et non la longueur,
       sinon SUD, ALU, FER et ELEC, qui sont des mots, resteraient en capitales. */
    if (nu.length <= 4 && !/[AEIOUYÀ-ÿ]/i.test(nu)) return mot.toUpperCase();
    let m = mot.split("-").map(p => p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p).join("-");
    m = m.replace(/(['’])(.)/g, (t, a, b) => a + b.toUpperCase());  /* L'Atelier */
    if (!premier && /^[DL]['’]/.test(m)) m = m.charAt(0).toLowerCase() + m.slice(1);  /* Cote d'Azur */
    return m;
  }
  function harmoniserNom(texte) {
    const s = String(texte || "").trim().replace(/\s+/g, " ");
    if (!s) return "";
    /* Mot a mot, et non chaine entiere : Pipedrive ecrit « LANDRU Jean-Charles »,
       ou seul le patronyme est en capitales. Un mot deja en casse mixte a ete
       ecrit par un humain, on n'y touche pas. */
    return s.split(" ").map((mot, i) => {
      if (mot !== mot.toUpperCase()) return mot;
      const bas = mot.toLowerCase().replace(/[.,;:]+$/, "");
      if (i > 0 && PARTICULES.has(bas) && !APOS.test(mot)) return mot.toLowerCase();
      return motHarmonise(mot, i === 0);
    }).join(" ");
  }
  /* Le bouton du site, sur chaque ligne. Quand le domaine est connu il ouvre le
     site ; quand il ne l'est pas, il ouvre une recherche sur le nom de
     l'entreprise et sa ville. On n'invente jamais une adresse : soit on l'a, soit
     on va la chercher. Mesure du 3 septembre 2026 : 391 fiches sur 1 374 ont un
     domaine deductible, les 983 autres ont une boite generique. */
  function lienSite(c) {
    const nom = c.orgAff || c.nomAff || "";
    if (c.site) return { href: "https://" + c.site, icone: "↗", titre: "Ouvrir " + c.site + (c.siteDeduit ? " (déduit de l'adresse e-mail)" : ""), connu: true };
    const q = [nom, c.ville || c.deptNom || ""].filter(Boolean).join(" ");
    return { href: "https://www.google.com/search?q=" + encodeURIComponent(q), icone: "⌕", titre: "Chercher le site de " + nom + " sur le web", connu: false };
  }

  function siteDepuisMail(email) {
    const m = /@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(String(email || "").trim());
    if (!m) return "";
    const d = m[1].toLowerCase();
    return BOITES_GENERIQUES.has(d) ? "" : d;
  }

  function mergeOne(b, o) {
    const fix = o.fix || {};
    const c = Object.assign({}, b, fix);
    c.crm = o;
    c.statut = o.statut || "a_contacter";
    c.metier = o.metier || "";
    c.metierAff = o.metier || b.metierSuggere || "";
    c.resp = o.resp || "";
    c.relance = o.relance || "";
    c.tels = Array.isArray(c.tels) ? c.tels : [];
    c.telsTxt = c.tels.map(t => t.num).join(" ");
    c.orgAff = harmoniserNom(c.organisation);
    c.nomAff = harmoniserNom(c.nom);
    c.site = fix.site || siteDepuisMail(c.email);
    c.siteDeduit = !fix.site && !!c.site;
    c.search = norm([c.organisation, c.nom, c.email, c.site, c.telsTxt, c.tels.map(t => t.num.replace(/\s/g, "")).join(" "), c.ville, c.cp, c.dept, c.deptNom, c.metierAff, o.notes, o.action].join(" "));
    c.exploitable = c.fiabilite !== "inexploitable" && (c.email || c.tels.length);
    return c;
  }
  const byId = id => merged().find(c => c.id === Number(id));
  function relState(c) {
    if (!c.relance) return "";
    const t = today();
    if (c.relance < t) return "retard";
    if (c.relance === t) return "today";
    return "futur";
  }
  const stTermine = k => ST[k] && (ST[k].type === "gagne" || ST[k].type === "perdu");

  /* ------------------------------------------------------------------ écriture */
  function touch(id, patch, hist) {
    const o = ov(id);
    Object.assign(o, patch);
    o.maj = now(); o.par = USER;
    if (hist) { o.hist = o.hist || []; o.hist.unshift(Object.assign({ d: now(), par: USER }, hist)); }
    MERGED = null;
    Store.put(id, o);
  }
  function setStatut(id, k, silent) {
    const c = byId(id); if (!c || c.statut === k) return;
    const patch = { statut: k, dernierContact: c.crm.dernierContact };
    if (k !== "a_contacter") patch.dernierContact = today();
    if (stTermine(k)) patch.relance = "";
    touch(id, patch, { type: "statut", txt: `${ST[c.statut].label} → ${ST[k].label}` });
    if (!silent) { renderAll(); toast(`${c.orgAff || c.nomAff} : ${ST[k].label}`); }
  }

  /* ------------------------------------------------------------------ utilisateurs */
  function users() {
    const set = new Set();
    if (Store.mode === "supabase") Store.profils.forEach(p => set.add(p.prenom));
    else { (CFG.utilisateurs || []).forEach(u => set.add(u)); (pref.users || []).forEach(u => set.add(u)); }
    if (USER) set.add(USER);
    merged().forEach(c => { if (c.resp) set.add(c.resp); });
    return Array.from(set);
  }
  function setUser(u) {
    USER = u.trim();
    if (Store.mode === "local") {
      pref.user = USER;
      if (USER && !(CFG.utilisateurs || []).includes(USER)) { pref.users = Array.from(new Set([...(pref.users || []), USER])); }
      savePref();
    }
    $("#userName").textContent = USER; $("#userAv").textContent = USER.slice(0, 1).toUpperCase();
    $("#userBtn").title = Store.mode === "supabase" ? "Connectée en tant que " + (Auth.profil ? Auth.profil.email : USER) + " · cliquer pour se déconnecter" : "Changer d'utilisateur (mode test)";
  }
  function askUser() {
    const box = $("#userChoices"); box.innerHTML = users().map(u => `<button class="btn" data-u="${esc(u)}">${esc(u)}</button>`).join("");
    box.onclick = e => { const b = e.target.closest("[data-u]"); if (b) { setUser(b.dataset.u); $("#ovUser").classList.remove("open"); renderAll(); } };
    $("#userOk").onclick = () => { const v = $("#userInput").value.trim(); if (!v) return; setUser(v); $("#ovUser").classList.remove("open"); renderAll(); };
    $("#userInput").onkeydown = e => { if (e.key === "Enter") $("#userOk").click(); };
    $("#ovUser").classList.add("open"); $("#userInput").value = "";
  }

  /* ------------------------------------------------------------------ rendu : commun */
  function stVars(k) { const s = ST[k] || { fond: "rgba(247,240,228,.08)", texte: "#C9BFB0", bord: "rgba(247,240,228,.14)" }; return `--st-fond:${s.fond};--st-texte:${s.texte};--st-bord:${s.bord}`; }
  const pillSt = k => `<span class="pill st" style="${stVars(k)}"><span class="dot"></span>${esc((ST[k] || { label: k }).label)}</span>`;
  const pillFiab = f => `<span class="pill ${esc(f)}">${esc(FIAB[f] || f)}</span>`;
  const pillRel = c => { const s = relState(c); return s === "retard" ? `<span class="pill retard">Retard ${esc(fmtDate(c.relance))}</span>` : s === "today" ? `<span class="pill today">Aujourd'hui</span>` : s ? `<span class="pill">${esc(fmtDate(c.relance))}</span>` : ""; };
  function toast(msg, err) { const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : ""); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2600); }
  function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); }

  function renderAll() {
    $("#nContacts").textContent = merged().length;
    const nR = merged().filter(c => ["retard", "today"].includes(relState(c)) && !c.crm.opposition).length;
    $("#nRelances").textContent = nR || "";
    if (view === "dash") renderDash();
    if (view === "contacts") { renderRail(); renderTable(); if (openId != null) renderFiche(openId); }
    if (view === "pipeline") renderKanban();
    if (view === "relances") renderRelances();
    insCompteur();
    if (view === "inscrits") renderInscrits();
    if (view === "reglages") renderReglages();
    else renderPresence();   /* le bandeau des presents, meme hors des reglages */
  }
  function switchView(v) {
    view = v;
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === v));
    $$(".view").forEach(s => s.classList.toggle("active", s.id === "view-" + v));
    document.body.classList.toggle("v-contacts", v === "contacts");
    document.body.classList.toggle("v-inscrits", v === "inscrits");
    /* La liste des inscrits se lit a la premiere ouverture de l'onglet, pas au
       demarrage : trois requetes de plus a chaque ouverture du CRM pour un
       ecran que l'on ne regarde pas tous les jours, ce serait payer pour rien. */
    if (v === "inscrits") insCharger();
    Store.battre();
    renderAll();
  }

  /* ------------------------------------------------------------------ tableau de bord */
  function renderDash() {
    const all = merged(), actifs = all.filter(c => !c.crm.opposition);
    const n = k => actifs.filter(c => c.statut === k).length;
    const touches = actifs.filter(c => c.statut !== "a_contacter").length;
    const inscrits = n("inscrit"), interesses = n("interesse") + n("echange");
    const retard = actifs.filter(c => relState(c) === "retard").length, auj = actifs.filter(c => relState(c) === "today").length;
    const exploitables = actifs.filter(c => c.exploitable).length;
    $("#dashIntro").textContent = `${all.length} installateurs dans la base, ${exploitables} joignables. ${touches} déjà contactés, ${inscrits} inscrits.`;
    const kpis = [
      { v: all.length, l: "Contacts", s: `${exploitables} joignables`, f: () => { clearF(); switchView("contacts"); } },
      { v: n("a_contacter"), l: "À contacter", s: "jamais appelés", f: () => { clearF(); F.statut = "a_contacter"; switchView("contacts"); } },
      { v: touches, l: "Contactés", s: `${all.length ? Math.round(touches / all.length * 100) : 0} % de la base`, f: () => { clearF(); F.autres = "touches"; switchView("contacts"); } },
      { v: interesses, l: "En discussion", s: "échange ou intéressé", cls: "accent", f: () => { clearF(); F.autres = "discussion"; switchView("contacts"); } },
      { v: inscrits, l: "Inscrits", s: touches ? `${Math.round(inscrits / touches * 100)} % des contactés` : "", cls: "ok", f: () => { clearF(); F.statut = "inscrit"; switchView("contacts"); } },
      { v: retard + auj, l: "À rappeler", s: `${retard} en retard · ${auj} aujourd'hui`, cls: retard ? "warn" : "", f: () => switchView("relances") }
    ];
    $("#kpis").innerHTML = kpis.map((k, i) => `<div class="kpi ${k.cls || ""}" data-i="${i}"><div class="v">${k.v}</div><div class="l">${esc(k.l)}</div><div class="s">${esc(k.s)}</div></div>`).join("");
    $$("#kpis .kpi").forEach(el => el.onclick = () => kpis[+el.dataset.i].f());
    /* pipeline */
    const max = Math.max(1, ...STATUTS.map(s => n(s.key)));
    $("#funnelSub").textContent = `${actifs.length} fiches actives`;
    $("#funnel").innerHTML = STATUTS.map(s => `<div class="frow" data-k="${s.key}" style="${stVars(s.key)}"><div class="fl"><span class="dot"></span>${esc(s.label)}</div><div class="fbar"><i style="width:${n(s.key) / max * 100}%"></i></div><div class="fn">${n(s.key)}</div></div>`).join("");
    $$("#funnel .frow").forEach(el => el.onclick = () => { clearF(); F.statut = el.dataset.k; switchView("contacts"); });
    /* relances */
    const rel = actifs.filter(c => ["retard", "today"].includes(relState(c))).sort((a, b) => a.relance.localeCompare(b.relance)).slice(0, 8);
    $("#dashRelances").innerHTML = rel.length ? rel.map(c => miniItem(c, `${esc(c.crm.action || "")}`, pillRel(c))).join("") : `<div class="empty">Rien à rappeler. Ouvrez « À contacter » et attaquez la liste.</div>`;
    bindMini("#dashRelances");
    /* départements */
    const depts = {};
    all.forEach(c => { const k = c.deptNom || (c.dept ? "Dépt " + c.dept : "Inconnu"); depts[k] = depts[k] || { t: 0, c: 0, key: c.dept }; depts[k].t++; if (c.statut !== "a_contacter") depts[k].c++; });
    const dl = Object.entries(depts).sort((a, b) => b[1].t - a[1].t).slice(0, 10);
    const dmax = Math.max(1, ...dl.map(x => x[1].t));
    $("#barsDept").innerHTML = dl.map(([k, v]) => `<div class="brow" data-d="${esc(v.key)}"><div class="bl">${esc(k)}</div><div class="bb"><i style="width:${v.t / dmax * 100}%"></i></div><div class="bn">${v.c}/${v.t}</div></div>`).join("");
    $$("#barsDept .brow").forEach(el => el.onclick = () => { clearF(); F.dept = el.dataset.d; switchView("contacts"); });
    /* métiers */
    const met = {}; all.forEach(c => { const k = c.metierAff || "Non renseigné"; met[k] = (met[k] || 0) + 1; });
    const ml = Object.entries(met).sort((a, b) => b[1] - a[1]).slice(0, 8); const mmax = Math.max(1, ...ml.map(x => x[1]));
    $("#barsMetier").innerHTML = ml.map(([k, v]) => `<div class="brow" data-m="${esc(k)}"><div class="bl">${esc(k)}</div><div class="bb"><i style="width:${v / mmax * 100}%"></i></div><div class="bn">${v}</div></div>`).join("");
    $$("#barsMetier .brow").forEach(el => el.onclick = () => { clearF(); F.metier = el.dataset.m === "Non renseigné" ? "__none" : el.dataset.m; switchView("contacts"); });
    /* responsables */
    const rs = {}; all.forEach(c => { if (c.resp) rs[c.resp] = (rs[c.resp] || 0) + 1; });
    const rl = Object.entries(rs).sort((a, b) => b[1] - a[1]); const rmax = Math.max(1, ...rl.map(x => x[1]));
    $("#barsResp").innerHTML = rl.length ? rl.map(([k, v]) => `<div class="brow" data-r="${esc(k)}"><div class="bl">${esc(k)}</div><div class="bb"><i class="v" style="width:${v / rmax * 100}%"></i></div><div class="bn">${v}</div></div>`).join("") : `<div class="empty">Aucune fiche attribuée. Sélectionnez des lignes dans Contacts pour répartir le travail.</div>`;
    $$("#barsResp .brow").forEach(el => el.onclick = () => { clearF(); F.resp = el.dataset.r; switchView("contacts"); });
    const md = {}; actifs.forEach(c => { if (c.crm.mode) md[c.crm.mode] = (md[c.crm.mode] || 0) + 1; });
    const mdl = CFG.modes.filter(m => md[m.key]); const mdmax = Math.max(1, ...mdl.map(m => md[m.key]));
    $("#barsMode").innerHTML = mdl.length ? mdl.map(m => `<div class="brow"><div class="bl">${m.icone} ${esc(m.label)}</div><div class="bb"><i style="width:${md[m.key] / mdmax * 100}%"></i></div><div class="bn">${md[m.key]}</div></div>`).join("") : `<div class="empty">Se remplit au fil des échanges.</div>`;
    /* activité */
    const acts = [];
    all.forEach(c => (c.crm.hist || []).forEach(h => acts.push({ c, h })));
    acts.sort((a, b) => b.h.d.localeCompare(a.h.d));
    $("#dashActivite").innerHTML = acts.length ? acts.slice(0, 10).map(({ c, h }) => miniItem(c, `${esc(typeH(h.type).icone)} ${esc(h.txt || typeH(h.type).label)}`, `<span class="dim">${esc(h.par || "")} · ${esc(fmtDT(h.d))}</span>`)).join("") : `<div class="empty">Aucune action pour l'instant.</div>`;
    bindMini("#dashActivite");
    /* qualité */
    const q = { fiable: 0, a_controler: 0, inexploitable: 0, verifie: 0 };
    all.forEach(c => { q[c.fiabilite] = (q[c.fiabilite] || 0) + 1; if (c.crm.verifie) q.verifie++; });
    const rows = [["Fiables", q.fiable, "v"], ["À contrôler", q.a_controler, ""], ["Inexploitables", q.inexploitable, ""], ["Vérifiées par l'équipe", q.verifie, "v"]];
    $("#barsQualite").innerHTML = rows.map(([l, v, cls]) => `<div class="brow"><div class="bl">${l}</div><div class="bb"><i class="${cls}" style="width:${v / Math.max(1, all.length) * 100}%"></i></div><div class="bn">${v}</div></div>`).join("");
  }
  const typeH = k => CFG.typesHistorique.find(t => t.key === k) || { icone: "•", label: k };
  const miniItem = (c, sub, right) => `<div class="it" data-id="${c.id}"><div><div class="nm">${esc(c.orgAff || c.nomAff)}</div><div class="sb">${sub}</div></div><div class="rt">${right}</div></div>`;
  function bindMini(sel) { $$(sel + " .it").forEach(el => el.onclick = () => openFiche(+el.dataset.id, true)); }

  /* ------------------------------------------------------------------ contacts : filtres */
  function clearF() { F.q = ""; F.statut = F.fiab = F.resp = F.relance = F.autres = null; F.metier = F.dept = ""; $("#q").value = ""; shown = 300; }
  function filtered() {
    const q = norm(F.q);
    return merged().filter(c => {
      if (F.statut && c.statut !== F.statut) return false;
      if (F.fiab && c.fiabilite !== F.fiab) return false;
      if (F.resp === "__none" ? c.resp : (F.resp && c.resp !== F.resp)) return false;
      if (F.metier === "__none" ? c.metierAff : (F.metier && c.metierAff !== F.metier)) return false;
      if (F.dept && c.dept !== F.dept) return false;
      if (F.relance) { const s = relState(c); if (F.relance === "retard" && s !== "retard") return false; if (F.relance === "today" && s !== "today") return false; if (F.relance === "semaine" && !(s && c.relance <= addDays(7))) return false; if (F.relance === "sans" && (c.relance || stTermine(c.statut) || c.statut === "a_contacter")) return false; }
      if (F.autres) {
        if (F.autres === "sansEmail" && c.email) return false;
        if (F.autres === "sansTel" && c.tels.length) return false;
        if (F.autres === "opposition" && !c.crm.opposition) return false;
        if (F.autres === "touches" && c.statut === "a_contacter") return false;
        if (F.autres === "discussion" && !["echange", "interesse"].includes(c.statut)) return false;
        if (F.autres === "averifier" && (c.fiabilite !== "a_controler" || c.crm.verifie)) return false;
        if (F.autres === "moi" && c.resp !== USER) return false;
      }
      if (q && !q.split(/\s+/).every(t => c.search.includes(t))) return false;
      return true;
    });
  }
  function sorted(list) {
    const dir = sortDir;
    const val = c => ({ id: c.id, org: norm(c.organisation || c.nom), dept: c.dept || "99", statut: STATUTS.findIndex(s => s.key === c.statut), relance: c.relance || "9999", resp: c.resp || "zzz", maj: c.crm.maj || "", fiab: ["fiable", "a_controler", "inexploitable"].indexOf(c.fiabilite) })[sortKey];
    return list.slice().sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  }
  function renderRail() {
    const all = merged();
    const cnt = (fn) => all.filter(fn).length;
    const chips = (items, key) => items.map(it => `<button class="chip ${F[key] === it.k ? "on" : ""}" data-f="${key}" data-v="${esc(it.k)}" style="${it.st || ""}">${it.dot ? `<span class="dot" style="background:${it.dot}"></span>` : ""}<span class="lbl">${esc(it.l)}</span><span class="n">${it.n}</span></button>`).join("");
    $("#fStatut").innerHTML = chips(STATUTS.map(s => ({ k: s.key, l: s.label, n: cnt(c => c.statut === s.key), dot: s.texte })), "statut");
    $("#fRelance").innerHTML = chips([
      { k: "retard", l: "En retard", n: cnt(c => relState(c) === "retard"), dot: "var(--rouge)" },
      { k: "today", l: "Aujourd'hui", n: cnt(c => relState(c) === "today"), dot: "var(--orange)" },
      { k: "semaine", l: "Cette semaine", n: cnt(c => relState(c) && c.relance <= addDays(7)) },
      { k: "sans", l: "En cours sans date", n: cnt(c => !c.relance && !stTermine(c.statut) && c.statut !== "a_contacter") }
    ], "relance");
    $("#fResp").innerHTML = chips([...users().map(u => ({ k: u, l: u, n: cnt(c => c.resp === u), dot: "var(--bleu)" })), { k: "__none", l: "Non attribué", n: cnt(c => !c.resp) }], "resp");
    $("#fFiab").innerHTML = chips([{ k: "fiable", l: "Fiable", n: cnt(c => c.fiabilite === "fiable"), dot: "var(--vert)" }, { k: "a_controler", l: "À contrôler", n: cnt(c => c.fiabilite === "a_controler"), dot: "var(--jaune)" }, { k: "inexploitable", l: "Inexploitable", n: cnt(c => c.fiabilite === "inexploitable"), dot: "var(--rouge)" }], "fiab");
    $("#fAutres").innerHTML = chips([
      { k: "moi", l: "Mes fiches", n: cnt(c => c.resp === USER) },
      { k: "averifier", l: "Coordonnées à vérifier", n: cnt(c => c.fiabilite === "a_controler" && !c.crm.verifie) },
      { k: "sansEmail", l: "Sans e-mail", n: cnt(c => !c.email) },
      { k: "sansTel", l: "Sans téléphone", n: cnt(c => !c.tels.length) },
      { k: "opposition", l: "Opposition", n: cnt(c => c.crm.opposition) }
    ], "autres");
    /* selects */
    const met = {}; all.forEach(c => { if (c.metierAff) met[c.metierAff] = (met[c.metierAff] || 0) + 1; });
    const fm = $("#fMetier"); fm.innerHTML = `<option value="">Tous les métiers</option><option value="__none">Non renseigné (${cnt(c => !c.metierAff)})</option>` + Object.entries(met).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<option value="${esc(k)}">${esc(k)} (${v})</option>`).join(""); fm.value = F.metier;
    const dp = {}; all.forEach(c => { const k = c.dept || ""; dp[k] = dp[k] || { n: 0, l: c.deptNom }; dp[k].n++; });
    const fd = $("#fDept"); fd.innerHTML = `<option value="">Tous les départements</option>` + Object.entries(dp).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `<option value="${esc(k)}">${k ? k + " · " + esc(v.l || "") : "Sans département"} (${v.n})</option>`).join(""); fd.value = F.dept;
  }
  function renderTable() {
    const list = sorted(filtered());
    const cols = [["org", "Société / contact"], ["dept", "Dépt"], ["tel", "Téléphone"], ["email", "E-mail et site"], ["statut", "Statut"], ["relance", "Relance"], ["resp", "Suivi par"], ["fiab", "Fiche"]];
    $("#thead").innerHTML = `<th class="ck"><input type="checkbox" id="ckAll" ${list.length && list.every(c => SEL.has(c.id)) ? "checked" : ""}></th><th class="callcell" aria-label="Appeler"></th>` + cols.map(([k, l]) => `<th data-k="${k}" class="${sortKey === k ? "sorted" : ""}">${l}${sortKey === k ? `<span class="ar">${sortDir > 0 ? "▲" : "▼"}</span>` : ""}</th>`).join("");
    $("#count").innerHTML = `<b>${list.length}</b> fiche${list.length > 1 ? "s" : ""}${list.length !== merged().length ? ` sur ${merged().length}` : ""}`;
    /* chips actifs */
    const chips = [];
    if (F.q) chips.push(["q", `« ${F.q} »`]);
    if (F.statut) chips.push(["statut", ST[F.statut].label]);
    if (F.fiab) chips.push(["fiab", FIAB[F.fiab]]);
    if (F.resp) chips.push(["resp", F.resp === "__none" ? "Non attribué" : F.resp]);
    if (F.relance) chips.push(["relance", { retard: "En retard", today: "Aujourd'hui", semaine: "Cette semaine", sans: "Sans date" }[F.relance]]);
    if (F.metier) chips.push(["metier", F.metier === "__none" ? "Métier non renseigné" : F.metier]);
    if (F.dept) chips.push(["dept", "Dépt " + F.dept]);
    if (F.autres) chips.push(["autres", { moi: "Mes fiches", averifier: "À vérifier", sansEmail: "Sans e-mail", sansTel: "Sans téléphone", opposition: "Opposition", touches: "Contactés", discussion: "En discussion" }[F.autres]]);
    $("#chips").innerHTML = chips.map(([k, l]) => `<span class="af">${esc(l)}<button data-clear="${k}" aria-label="Retirer">×</button></span>`).join("");
    /* lignes */
    const rows = list.slice(0, shown);
    $("#rows").innerHTML = rows.map(c => `<tr class="row ${c.id === openId ? "sel" : ""} ${c.crm.opposition ? "opp" : ""}" data-id="${c.id}">
      <td class="ck"><input type="checkbox" data-ck="${c.id}" ${SEL.has(c.id) ? "checked" : ""}></td>
      <td class="callcell">${c.tels.length ? `<a class="callbtn" href="tel:${esc(c.tels[0].num.replace(/\s/g, ""))}" aria-label="Appeler ${esc(c.tels[0].num)}">☎</a>` : ""}</td>
      <td><div class="org">${esc(c.orgAff || c.nomAff || "(sans nom)")}${c.site ? "" : (l => ` <a class="site" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer" title="${esc(l.titre)}" aria-label="${esc(l.titre)}">${l.icone}</a>`)(lienSite(c))}</div><div class="nm">${esc(c.organisation ? c.nomAff : "")}${c.metierAff ? ` · ${esc(c.metierAff)}${!c.metier ? " ?" : ""}` : ""}</div></td>
      <td>${esc(c.dept || "")}<div class="nm">${esc(c.ville || "")}</div></td>
      <td class="tel">${c.tels.length ? `<a href="tel:${esc(c.tels[0].num.replace(/\s/g, ""))}" title="Appeler ${esc(c.tels[0].num)}">${esc(c.tels[0].num)}</a>` : "<span class='dim'>·</span>"}</td>
      <td>${c.email ? esc(c.email) : "<span class='dim'>·</span>"}${c.site ? `<div class="nm"><a class="siteurl" href="https://${esc(c.site)}" target="_blank" rel="noopener noreferrer" title="Ouvrir ${esc(c.site)}${c.siteDeduit ? " (deduit de l'adresse e-mail)" : ""}">${esc(c.site)}</a></div>` : ""}</td>
      <td>${pillSt(c.statut)}${c.crm.opposition ? ` <span class="pill opp">Opp.</span>` : ""}</td>
      <td>${pillRel(c)}${c.crm.action ? `<div class="nm">${esc(c.crm.action)}</div>` : ""}</td>
      <td>${c.resp ? `<span class="pill resp">${esc(c.resp)}</span>` : ""}</td>
      <td>${c.fiabilite === "fiable" && !c.crm.verifie ? "" : pillFiab(c.fiabilite)}${c.crm.verifie ? ` <span class="pill fiable">✓ vérifiée</span>` : ""}</td></tr>`).join("");
    /* Le fichier deploye ne contient aucune fiche : elles viennent de Supabase
       apres connexion. Ouvert sans base, il n'est pas casse, il est vide : on le
       dit, plutot que de laisser croire a une panne. */
    if (!merged().length) {
      $("#rows").innerHTML = `<tr><td colspan="10" style="padding:36px 20px">
        <b style="font-family:var(--font-titre);font-size:16px">Aucune fiche dans ce fichier</b>
        <div class="muted" style="margin-top:8px;max-width:64ch">${Store.mode === "supabase"
          ? "La base en ligne n'a renvoyé aucune fiche. Si le point à côté de ton prénom est rouge, la liaison a échoué : recharge la page."
          : "Les 1 374 fiches sont dans la base en ligne et se chargent après connexion. Ce fichier a été construit sans données : c'est voulu, aucun nom d'artisan ne dort dans un fichier statique. Pour une démonstration hors ligne, reconstruire avec <code>--avec-donnees</code>."}</div>
      </td></tr>`;
    }
    $("#moreRows").innerHTML = list.length > shown ? `<button class="btn" id="moreBtn">Afficher ${Math.min(300, list.length - shown)} fiches de plus (${list.length - shown} restantes)</button>` : "";
    const mb = $("#moreBtn"); if (mb) mb.onclick = () => { shown += 300; renderTable(); };
    updateBulk();
  }
  function updateBulk() {
    $("#bulk").classList.toggle("hidden", !SEL.size);
    $("#bulkN").textContent = SEL.size + " sélectionnée" + (SEL.size > 1 ? "s" : "");
    const all = $("#ckAll"); if (all) { const vis = $$("#rows [data-ck]"); all.checked = vis.length > 0 && vis.every(c => SEL.has(+c.dataset.ck)); }
  }

  /* ------------------------------------------------------------------ fiche */
  function openFiche(id, go) {
    openId = id;
    if (go && view !== "contacts") switchView("contacts");
    $("#wrap").classList.add("detail-open");
    renderFiche(id);
    if (view === "contacts") $$("#rows tr").forEach(tr => tr.classList.toggle("sel", +tr.dataset.id === id));
    Store.battre();
  }
  function closeFiche() { openId = null; $("#wrap").classList.remove("detail-open"); $("#detail").innerHTML = `<div class="placeholder"><b>Aucune fiche ouverte</b>Choisissez un contact dans la liste.</div>`; $$("#rows tr.sel").forEach(t => t.classList.remove("sel")); }
  function renderFiche(id) {
    const c = byId(id); if (!c) { closeFiche(); return; }
    const o = c.crm;
    const alerts = (c.signalements || "").split("|").map(s => s.trim()).filter(Boolean);
    const tel0 = c.tels[0] ? c.tels[0].num.replace(/\s/g, "") : "";
    const opt = (list, v, vide) => (vide ? `<option value="">${vide}</option>` : "") + list.map(x => `<option value="${esc(x.k)}" ${x.k === v ? "selected" : ""}>${esc(x.l)}</option>`).join("");
    $("#detail").innerHTML = `<div class="fiche">
      <div class="fiche-top">
        <div class="row1"><div style="flex:1"><h2>${esc(c.orgAff || c.nomAff || "(sans nom)")}</h2><div class="who">${esc(c.organisation ? c.nomAff : "")}${c.metierAff ? ` · ${esc(c.metierAff)}` : ""}${c.deptNom ? ` · ${esc(c.deptNom)}` : ""}</div></div><button class="close" id="fClose" aria-label="Fermer">✕</button></div>
        <div class="badges">${pillSt(c.statut)}${pillFiab(c.fiabilite)}${o.verifie ? `<span class="pill fiable">Coordonnées vérifiées</span>` : ""}${o.opposition ? `<span class="pill opp">Opposition</span>` : ""}${c.resp ? `<span class="pill resp">${esc(c.resp)}</span>` : ""}${pillRel(c)}${o.mode ? `<span class="pill mode">${CFG.modes.find(m => m.key === o.mode).icone} ${esc(CFG.modes.find(m => m.key === o.mode).label)}</span>` : ""}</div>
      </div>
      ${(a => a.length ? `<div class="oppbox" style="background:var(--jaune-soft);border-color:rgba(124,90,14,.26)"><b>${esc(a.map(p => p.prenom).join(", "))} ${a.length > 1 ? "regardent" : "regarde"} aussi cette fiche en ce moment.</b> Mettez-vous d'accord avant d'appeler, pour ne pas appeler deux fois.</div>` : "")(autresSurLaFiche(id))}
      ${o.opposition ? `<div class="oppbox"><b>Cette personne a demandé à ne plus être contactée.</b> La fiche reste pour mémoire, elle sort des listes d'appel et des exports.</div>` : ""}
      <div class="quick">
        <a class="btn primary sm" ${tel0 ? `href="tel:${esc(tel0)}"` : 'aria-disabled="true"'} id="fCall">☎ Appeler</a>
        <a class="btn sm" ${c.email ? `href="mailto:${esc(c.email)}?subject=${encodeURIComponent("À dispo, l'agenda partagé des artisans")}"` : 'aria-disabled="true"'}>✉ Écrire</a>
        ${(l => `<a class="btn sm" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer" title="${esc(l.titre)}">${l.icone} ${l.connu ? "Site" : "Chercher le site"}</a>`)(lienSite(c))}
        <button class="btn sm" data-quick="contacte">Message laissé</button>
        <button class="btn sm" data-quick="rappel">Rappeler dans 3 j</button>
      </div>
      ${alerts.length && !o.verifie ? `<div class="warn"><h5>À vérifier avant d'utiliser cette fiche</h5><ul>${alerts.map(a => `<li>${esc(a)}</li>`).join("")}</ul>${c.aVerifier ? `<p class="dim" style="margin-top:6px">Champs concernés : ${esc(c.aVerifier)}</p>` : ""}<div class="act"><button class="btn sm" id="fVerif">Coordonnées vérifiées</button></div></div>` : ""}
      <div class="fs"><h4>Coordonnées <button id="fEditCoord">${o.fix ? "Corrigées ✓ · modifier" : "Corriger"}</button></h4>
        <dl>
          <div class="f"><dt>E-mail</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a><button class="copy" data-copy="${esc(c.email)}">copier</button>` : "<span class='dim'>non renseigné</span>"}</dd></div>
          <div class="f"><dt>Téléphone</dt><dd class="mono">${c.tels.length ? c.tels.map(t => `<a href="tel:${esc(t.num.replace(/\s/g, ""))}">${esc(t.num)}</a>${t.type ? ` <span class="dim">${esc(t.type)}</span>` : ""}<button class="copy" data-copy="${esc(t.num.replace(/\s/g, ""))}">copier</button>`).join("<br>") : "<span class='dim'>non renseigné</span>"}</dd></div>
          <div class="f"><dt>Site web</dt><dd>${c.site
            ? `<a href="https://${esc(c.site)}" target="_blank" rel="noopener noreferrer">${esc(c.site)}</a>${c.siteDeduit ? ` <span class="dim" title="Deduit du domaine de l'adresse e-mail, jamais verifie">déduit de l'e-mail</span>` : ""}`
            : `<span class="dim">non renseigné</span> <a href="${esc(lienSite(c).href)}" target="_blank" rel="noopener noreferrer">chercher sur le web</a>`}</dd></div>
          <div class="f"><dt>Adresse</dt><dd>${esc([c.cp, c.ville].filter(Boolean).join(" ")) || "<span class='dim'>·</span>"}${c.cpBrut ? ` <span class="dim">(brut : ${esc(c.cpBrut)})</span>` : ""}<br><span class="dim">${esc(c.deptNom || "")}${c.dept ? ` (${esc(c.dept)})` : ""}</span></dd></div>
        </dl>
        <div class="frm hidden" id="coordForm" style="margin-top:10px">
          <label class="full">Société<input data-fix="organisation" value="${esc(c.organisation)}"></label>
          <label class="full">Contact<input data-fix="nom" value="${esc(c.nom)}"></label>
          <label class="full">E-mail<input data-fix="email" value="${esc(c.email)}"></label>
          <label class="full">Site web <span class="hint">(domaine seul, sans https)</span><input data-fix="site" value="${esc(c.crm.fix && c.crm.fix.site ? c.crm.fix.site : "")}" placeholder="${esc(c.site || "exemple.fr")}"></label>
          <label class="full">Téléphones <span class="hint">(séparés par une virgule)</span><input data-fix="tels" value="${esc(c.tels.map(t => t.num).join(", "))}"></label>
          <label>Code postal<input data-fix="cp" value="${esc(c.cp)}" maxlength="5"></label>
          <label>Ville<input data-fix="ville" value="${esc(c.ville)}"></label>
          <div class="full" style="display:flex;gap:6px;justify-content:flex-end"><button class="btn sm" id="coordCancel">Annuler</button><button class="btn sm primary" id="coordSave">Enregistrer</button></div>
        </div>
      </div>
      <div class="fs"><h4>Suivi</h4>
        <div class="frm">
          <label>Statut<select data-crm="statut">${opt(STATUTS.map(s => ({ k: s.key, l: s.label })), c.statut)}</select></label>
          <label>Suivi par<select data-crm="resp">${opt(users().map(u => ({ k: u, l: u })), c.resp, "Personne")}</select></label>
          <label>Métier<select data-crm="metier">${opt(CFG.metiers.map(m => ({ k: m, l: m })), c.metier, "Non renseigné")}</select>${!c.metier && c.metierSuggere ? `<span class="hint">Déduit du nom : <b data-suggest="${esc(c.metierSuggere)}">${esc(c.metierSuggere)}</b> (cliquer pour confirmer)</span>` : ""}</label>
          <label>Formule envisagée<select data-crm="formule">${opt(CFG.formules.map(f => ({ k: f.key, l: f.label })), o.formule || "", "Pas encore")}</select></label>
          <label class="full">Mode souhaité<div class="seg">${CFG.modes.map(m => `<button data-mode="${m.key}" class="${o.mode === m.key ? "on " + m.key : ""}">${m.icone} ${esc(m.label)}</button>`).join("")}</div></label>
          <label>Prochaine relance<input type="date" data-crm="relance" value="${esc(c.relance)}"><span class="hint"><b data-rel="1">demain</b> · <b data-rel="3">3 j</b> · <b data-rel="7">1 sem.</b> · <b data-rel="30">1 mois</b></span></label>
          <label>Prochaine action<input data-crm="action" value="${esc(o.action || "")}" placeholder="ex. Rappeler, envoyer la présentation…"></label>
          <label class="full">Notes<textarea data-crm="notes" placeholder="Ce qu'il faut retenir : taille de l'équipe, saisonnalité, objections…">${esc(o.notes || "")}</textarea></label>
          <label class="full chk" style="flex-direction:row"><input type="checkbox" data-crm="opposition" ${o.opposition ? "checked" : ""}> Opposition : ne plus contacter cette personne</label>
        </div>
      </div>
      <div class="fs"><h4>Historique <span class="dim" style="letter-spacing:0;text-transform:none">${(o.hist || []).length} action${(o.hist || []).length > 1 ? "s" : ""}</span></h4>
        <div class="addh"><select id="hType">${CFG.typesHistorique.filter(t => t.key !== "statut").map(t => `<option value="${t.key}">${t.icone} ${esc(t.label)}</option>`).join("")}</select><input id="hTxt" placeholder="Ce qui s'est dit… (Entrée pour ajouter)"><button class="btn sm primary" id="hAdd">Ajouter</button></div>
        <div class="hist" style="margin-top:10px">${(o.hist || []).length ? o.hist.map(h => `<div class="h"><div class="ic">${esc(typeH(h.type).icone)}</div><div><div class="t">${esc(h.txt || typeH(h.type).label)}</div><div class="m">${esc(h.par || "")} · ${esc(fmtDT(h.d))}</div></div></div>`).join("") : `<div class="empty">Aucune action pour l'instant. Le premier appel s'enregistre ici.</div>`}</div>
      </div>
      <div class="src">${c.crm.base ? `Fiche ajoutée à la main${c.crm.base.source ? " · source : " + esc(c.crm.base.source) : ""}` : `Source : ${esc(CFG.sourceBase)}, photo ${esc(c.photo || "?")}, fiche n° ${c.id}.`}${o.maj ? ` Dernière modification ${esc(fmtDT(o.maj))}${o.par ? " par " + esc(o.par) : ""}.` : ""}</div>
      <div class="fiche-foot"><button class="btn sm ghost" id="fPrev">‹ Précédente</button>${c.crm.base ? `<button class="btn sm danger" id="fDel">Supprimer la fiche</button>` : ""}<button class="btn sm ghost" id="fNext">Suivante ›</button></div>
    </div>`;
    bindFiche(c);
  }
  function bindFiche(c) {
    const id = c.id, d = $("#detail");
    $("#fClose").onclick = closeFiche;
    d.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy); b.textContent = "copié"; setTimeout(() => b.textContent = "copier", 1200); });
    d.querySelectorAll("[data-quick]").forEach(b => b.onclick = () => {
      if (b.dataset.quick === "contacte") { touch(id, { statut: c.statut === "a_contacter" ? "contacte" : c.statut, dernierContact: today(), relance: c.relance || addDays(3) }, { type: "appel", txt: "Message laissé" }); renderAll(); toast("Message laissé, relance dans 3 jours"); }
      if (b.dataset.quick === "rappel") { touch(id, { relance: addDays(3) }); renderAll(); toast("Relance posée dans 3 jours"); }
    });
    const v = $("#fVerif"); if (v) v.onclick = () => { touch(id, { verifie: true }, { type: "note", txt: "Coordonnées vérifiées" }); renderAll(); };
    $("#fEditCoord").onclick = () => $("#coordForm").classList.toggle("hidden");
    $("#coordCancel").onclick = () => $("#coordForm").classList.add("hidden");
    $("#coordSave").onclick = () => {
      const fix = Object.assign({}, c.crm.fix || {});
      d.querySelectorAll("[data-fix]").forEach(i => {
        const k = i.dataset.fix, val = i.value.trim();
        if (k === "tels") fix.tels = val.split(",").map(s => s.trim()).filter(Boolean).map(num => ({ num, type: (c.tels.find(t => t.num === num) || {}).type || "" }));
        /* Le site est stocke en domaine nu : elle peut coller une URL complete,
           on retire le protocole, le www et le chemin. Le lien les remet. */
        else if (k === "site") fix.site = val.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[\/?#].*$/, "");
        else fix[k] = k === "email" ? val.toLowerCase() : val;
      });
      touch(id, { fix }, { type: "note", txt: "Coordonnées corrigées" }); renderAll(); toast("Coordonnées enregistrées");
    };
    d.querySelectorAll("[data-crm]").forEach(i => {
      const k = i.dataset.crm;
      const isText = (i.tagName === "INPUT" && i.type === "text") || i.tagName === "TEXTAREA";
      const save = (final) => {
        if (k === "statut") { setStatut(id, i.value); return; }
        const val = i.type === "checkbox" ? i.checked : i.value;
        if (k === "opposition" && val) { touch(id, { opposition: true, relance: "" }, { type: "note", txt: "Opposition enregistrée" }); renderAll(); return; }
        touch(id, { [k]: val });
        if (!isText) renderAll();           /* selects, date, case : la fiche se redessine */
        else if (final) renderTable();       /* texte : on attend la sortie du champ pour rafraîchir la liste */
      };
      i.addEventListener("change", () => save(true));
      if (isText) { let t; i.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => save(false), 600); }); }
    });
    const sg = d.querySelector("[data-suggest]"); if (sg) sg.onclick = () => { touch(id, { metier: sg.dataset.suggest }); renderAll(); };
    d.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { touch(id, { mode: c.crm.mode === b.dataset.mode ? "" : b.dataset.mode }); renderFiche(id); });
    d.querySelectorAll("[data-rel]").forEach(b => b.onclick = () => { touch(id, { relance: addDays(+b.dataset.rel) }); renderAll(); });
    const add = () => { const txt = $("#hTxt").value.trim(); const type = $("#hType").value; if (!txt && type === "note") return; touch(id, { dernierContact: ["appel", "mail", "sms", "rdv"].includes(type) ? today() : c.crm.dernierContact }, { type, txt }); renderAll(); };
    $("#hAdd").onclick = add; $("#hTxt").onkeydown = e => { if (e.key === "Enter") add(); };
    const nav = dir => { const list = sorted(filtered()); const i = list.findIndex(x => x.id === id); const n = list[i + dir]; if (n) { openFiche(n.id); const tr = $(`#rows tr[data-id="${n.id}"]`); if (tr) tr.scrollIntoView({ block: "nearest" }); } };
    $("#fPrev").onclick = () => nav(-1); $("#fNext").onclick = () => nav(1);
    const del = $("#fDel"); if (del) del.onclick = () => { if (confirm("Supprimer définitivement cette fiche ajoutée à la main ?")) { touch(id, { supprime: true }); closeFiche(); renderAll(); } };
  }

  /* ------------------------------------------------------------------ kanban */
  function renderKanban() {
    const resp = $("#kbResp"), dept = $("#kbDept");
    if (!resp.dataset.ok) {
      resp.innerHTML = `<option value="">Tout le monde</option>` + users().map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join("") + `<option value="__none">Non attribué</option>`;
      const dp = {}; merged().forEach(c => { if (c.dept) dp[c.dept] = c.deptNom; });
      dept.innerHTML = `<option value="">Tous les départements</option>` + Object.entries(dp).sort().map(([k, l]) => `<option value="${k}">${k} · ${esc(l || "")}</option>`).join("");
      resp.dataset.ok = 1;
    }
    const hide = $("#kbHideEntree").checked;
    const list = merged().filter(c => !c.crm.opposition && (!resp.value || (resp.value === "__none" ? !c.resp : c.resp === resp.value)) && (!dept.value || c.dept === dept.value));
    $("#kanban").innerHTML = STATUTS.filter(s => !(hide && s.type === "entree")).map(s => {
      const cards = list.filter(c => c.statut === s.key).sort((a, b) => (a.relance || "9999").localeCompare(b.relance || "9999") || (b.crm.maj || "").localeCompare(a.crm.maj || ""));
      const cap = s.type === "entree" ? 40 : 200;
      return `<div class="col" style="${stVars(s.key)}"><div class="col-head"><span class="dot"></span><b>${esc(s.label)}</b><span class="n">${cards.length}</span></div>
        <div class="col-body" data-st="${s.key}">${cards.slice(0, cap).map(c => `<div class="kcard" draggable="true" data-id="${c.id}"><div class="o">${esc(c.orgAff || c.nomAff)}</div><div class="m">${esc([c.metierAff, c.deptNom || (c.dept ? "Dépt " + c.dept : "")].filter(Boolean).join(" · "))}</div><div class="b">${c.resp ? `<span class="pill resp">${esc(c.resp)}</span>` : ""}${pillRel(c)}${c.crm.mode ? `<span class="pill mode">${CFG.modes.find(m => m.key === c.crm.mode).icone}</span>` : ""}</div></div>`).join("")}${cards.length > cap ? `<div class="more">${cards.length - cap} autres fiches. Filtrez par département ou personne.</div>` : ""}</div></div>`;
    }).join("");
    $$("#kanban .kcard").forEach(k => {
      k.addEventListener("dragstart", e => { dragId = +k.dataset.id; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", k.dataset.id); } catch (x) { } });
      k.addEventListener("dragend", () => $$(".col-body.drag-over").forEach(c => c.classList.remove("drag-over")));
      k.addEventListener("click", () => openFiche(+k.dataset.id, true));
    });
    $$("#kanban .col-body").forEach(col => {
      col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drag-over"); e.dataTransfer.dropEffect = "move"; });
      col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
      col.addEventListener("drop", e => { e.preventDefault(); col.classList.remove("drag-over"); if (dragId != null) { setStatut(dragId, col.dataset.st); dragId = null; } });
    });
  }

  /* ------------------------------------------------------------------ relances */
  function renderRelances() {
    const list = merged().filter(c => !c.crm.opposition && (c.relance || (c.crm.action && !stTermine(c.statut))));
    const t = today(), s7 = addDays(7);
    const groups = [
      ["En retard", list.filter(c => c.relance && c.relance < t), "retard"],
      ["Aujourd'hui", list.filter(c => c.relance === t), "today"],
      ["Cette semaine", list.filter(c => c.relance > t && c.relance <= s7), ""],
      ["Plus tard", list.filter(c => c.relance > s7), ""],
      ["Action notée sans date", list.filter(c => !c.relance), ""]
    ];
    $("#relGroups").innerHTML = groups.map(([l, arr, cls]) => `<div class="card rel"><h3>${l} <span class="muted">${arr.length}</span></h3>${arr.length ? arr.sort((a, b) => (a.relance || "").localeCompare(b.relance || "")).map(c => `<div class="it" data-id="${c.id}"><div class="d ${cls}">${c.relance ? esc(fmtDate(c.relance)) : "·"}</div><div><div class="nm">${esc(c.orgAff || c.nomAff)}</div><div class="sb">${esc(c.crm.action || "")}${c.crm.action && c.deptNom ? " · " : ""}${esc(c.deptNom || "")}</div></div><div style="display:flex;gap:6px;align-items:center">${pillSt(c.statut)}${c.resp ? `<span class="pill resp">${esc(c.resp)}</span>` : ""}</div></div>`).join("") : `<div class="empty">Rien ici.</div>`}</div>`).join("");
    $$("#relGroups .it").forEach(el => el.onclick = () => openFiche(+el.dataset.id, true));
  }

  /* ------------------------------------------------------------------ réglages */
  function renderReglages() {
    const local = Store.mode === "local";
    $("#modeLabel").textContent = local ? "mode test, ce navigateur seulement" : "base en ligne";
    $("#modeExpl").textContent = local
      ? "Mode test : le fichier est ouvert sans base en ligne. Les statuts et notes restent dans ce navigateur, sur ce poste, et ne suivent pas sur un autre appareil. La version en ligne (adresse /crm du site) enregistre tout dans la base et le retrouve partout après connexion."
      : "Tout ce que tu fais est enregistré dans la base en ligne au moment où tu le fais, signé de ton prénom, et se retrouve sur n'importe quel ordinateur ou téléphone après connexion. Le point vert à côté de ton prénom indique que la liaison fonctionne ; s'il passe au rouge, la dernière modification est à refaire.";
    $("#modeCode").textContent = local
      ? `CRM_CONFIG.supabase.url = "" (vide)\nstockage : localStorage["${CFG.cleStockage}.data"]\nfiches travaillées : ${Object.keys(OVER).length}`
      : `base : ${CFG.supabase.url}\ntable : ${CFG.supabase.table}\nconnectée : ${Auth.profil ? Auth.profil.email : ""}\ndernière synchro : ${Store.lastSync || "jamais"}`;

    $("#sessionQui").textContent = local ? "" : (Auth.profil ? Auth.profil.email : "");
    $("#usersExpl").textContent = local
      ? "En mode test, le prénom est choisi à l'ouverture et ne sert qu'à signer les essais."
      : "Tes appels, tes notes et tes changements de statut sont signés de ton prénom. La déconnexion ne retire que cet appareil : ton travail reste dans la base.";
    $("#usersList").innerHTML = (local ? users().map(u => `<span class="pill resp" style="font-size:13px;padding:6px 12px">${esc(u)}</span>`).join("") : "")
      + `<button class="btn sm" id="chgUser">${local ? "Changer d'utilisateur" : "Se déconnecter"}</button>`;
    $("#chgUser").onclick = local ? askUser : () => { if (confirm("Se déconnecter de cet appareil ?")) Auth.logout(); };

    renderPresence();
    renderAdmin();
  }

  /* ------------------------------------------------------------------ qui est connecte
     Une personne est « en ligne » si son dernier battement a moins de 90 secondes,
     soit trois battements manques. On affiche aussi ou elle se trouve : c'est ce
     qui evite d'appeler deux fois le meme artisan. */
  const EN_LIGNE_MS = 90 * 1000;

  function depuis(iso) {
    if (!iso) return "jamais venue";
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < EN_LIGNE_MS / 1000) return "en ligne";
    if (s < 3600) return "vue il y a " + Math.max(1, Math.round(s / 60)) + " min";
    if (s < 86400) return "vue il y a " + Math.round(s / 3600) + " h";
    return "vue le " + fmtDate(String(iso).slice(0, 10));
  }
  const enLigne = p => p.vu_le && (Date.now() - new Date(p.vu_le).getTime()) < EN_LIGNE_MS;
  /* Les cles sont celles de `view`, sans quoi le libelle affiche la cle brute.
     « dashboard » ne correspondait a rien : la vue s'appelle « dash ». */
  const NOM_VUE = { dash: "le tableau de bord", dashboard: "le tableau de bord", contacts: "les contacts", inscrits: "les inscrits", pipeline: "le pipeline", relances: "les relances", reglages: "les réglages" };

  function ouEst(p) {
    const pr = p.presence || {};
    if (pr.libelle) return "sur la fiche " + pr.libelle;
    if (pr.vue) return "sur " + (NOM_VUE[pr.vue] || pr.vue);
    return "";
  }

  function renderPresence() {
    const carte = $("#cardPresence"), bandeau = $("#presents");
    const actif = Store.mode === "supabase" && Store.tous && Store.tous.length;
    if (carte) carte.classList.toggle("hidden", !actif);
    if (!actif) { if (bandeau) bandeau.innerHTML = ""; return; }

    const moi = Auth.profil ? Auth.profil.id : null;
    const gens = Store.tous.filter(p => p.actif !== false)
      .sort((a, b) => (b.vu_le || "").localeCompare(a.vu_le || ""));
    const presents = gens.filter(enLigne);

    if (bandeau) bandeau.innerHTML = presents.map(p =>
      `<span class="p ${p.id === moi ? "moi" : ""}" title="${esc(p.prenom)}${ouEst(p) ? " " + esc(ouEst(p)) : ""}">${esc((p.prenom || "?").charAt(0).toUpperCase())}</span>`).join("");

    if (!$("#presenceListe")) return;
    $("#presenceCompte").textContent = presents.length
      ? `${presents.length} en ligne sur ${gens.length}`
      : "personne en ligne";
    $("#presenceExpl").textContent = "Chaque personne signale sa présence toutes les 30 secondes. « En ligne » veut dire vue il y a moins de 90 secondes.";
    $("#presenceListe").innerHTML = gens.map(p => {
      const ici = enLigne(p), ou = ouEst(p);
      return `<div class="it" style="cursor:default">
        <span class="p ${p.id === moi ? "moi" : ""}" style="${ici ? "" : "background:var(--surface-hi);color:var(--encre-mut)"}">${esc((p.prenom || "?").charAt(0).toUpperCase())}</span>
        <div style="flex:1;margin-left:10px">
          <div class="nm">${esc(p.prenom)}${p.id === moi ? ` <span class="pill resp" style="font-size:10.5px">toi</span>` : ""}</div>
          <div class="sb">${ici && ou ? esc(ou) : esc(p.email || "")}</div>
        </div>
        <div class="rt"><span class="pill ${ici ? "fiable" : ""}">${esc(depuis(p.vu_le))}</span></div>
      </div>`;
    }).join("");
  }

  /* Deux personnes sur la meme fiche : on le dit, plutot que de laisser passer
     deux appels au meme artisan a cinq minutes d'intervalle. */
  function autresSurLaFiche(id) {
    if (Store.mode !== "supabase" || !Store.tous) return [];
    const moi = Auth.profil ? Auth.profil.id : null;
    return Store.tous.filter(p => p.id !== moi && p.actif !== false && enLigne(p)
      && p.presence && Number(p.presence.fiche) === Number(id));
  }

  /* ------------------------------------------------------------------ administration
     Visible seulement pour un compte porteur du drapeau `admin` dans la table
     profils. Ce n'est pas ce fichier qui accorde le droit : la page ne fait
     qu'afficher ou masquer. Ce sont les regles d'acces de la base qui refusent
     l'ecriture a tout autre compte, y compris a quelqu'un qui trafiquerait la page.

     Creer un compte ne se fait pas ici, et ne s'y fera pas : la cle capable de
     creer un utilisateur contourne toutes les regles d'acces, elle n'a rien a
     faire dans une page web publique. Les deux boutons ouvrent donc l'ecran
     Supabase deja pret, ce qui prend le meme temps qu'un formulaire local. */
  function renderAdmin() {
    const carte = $("#cardAdmin");
    const admin = Store.mode === "supabase" && Auth.profil && Auth.profil.admin === true;
    carte.classList.toggle("hidden", !admin);
    if (!admin) return;

    const ref = (CFG.supabase.url.match(/\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || "";
    const tableau = "https://supabase.com/dashboard/project/" + ref + "/auth/users";
    const fiches = merged();
    const compte = p => fiches.filter(c => c.resp === p.prenom).length;

    $("#adminExpl").textContent = `${Store.tous.length} compte${Store.tous.length > 1 ? "s" : ""} sur cette base. Retirer l'accès coupe la lecture et l'écriture à la requête suivante : la personne reste connectée mais ne voit plus rien, et son travail passé garde sa signature.`;

    $("#adminListe").innerHTML = Store.tous.map(p => {
      const moi = Auth.profil && p.id === Auth.profil.id;
      const n = compte(p);
      return `<div class="it" style="cursor:default">
        <div style="flex:1">
          <div class="nm">${esc(p.prenom)}${p.admin ? ` <span class="pill" style="font-size:10.5px">admin</span>` : ""}${moi ? ` <span class="pill resp" style="font-size:10.5px">toi</span>` : ""}</div>
          <div class="sb">${esc(p.email || "")}</div>
        </div>
        <div class="rt" style="display:flex;gap:6px;align-items:center">
          <span class="pill ${p.actif === false ? "inexploitable" : "fiable"}">${p.actif === false ? "accès retiré" : "actif"}</span>
          <span class="muted">${n} fiche${n > 1 ? "s" : ""}</span>
          <button class="btn sm" data-renommer="${p.id}">Renommer</button>
          ${moi ? "" : `<button class="btn sm ${p.actif === false ? "" : "danger"}" data-acces="${p.id}">${p.actif === false ? "Rendre l'accès" : "Retirer l'accès"}</button>`}
        </div></div>`;
    }).join("");

    $$("#adminListe [data-renommer]").forEach(b => b.onclick = async () => {
      const p = Store.tous.find(x => x.id === b.dataset.renommer);
      const v = prompt(`Prénom affiché pour ${p.email} :`, p.prenom);
      if (v == null || !v.trim() || v.trim() === p.prenom) return;
      try { await Store.sbMajProfil(p.id, { prenom: v.trim() }); renderAll(); toast("Prénom modifié"); }
      catch (e) { toast(e.message, true); }
    });
    $$("#adminListe [data-acces]").forEach(b => b.onclick = async () => {
      const p = Store.tous.find(x => x.id === b.dataset.acces);
      const couper = p.actif !== false;
      if (!confirm(couper
        ? `Retirer l'accès de ${p.prenom} (${p.email}) ? Elle ne pourra plus rien lire ni modifier. Son travail passé reste en base, signé de son prénom.`
        : `Rendre l'accès à ${p.prenom} (${p.email}) ?`)) return;
      try { await Store.sbMajProfil(p.id, { actif: !couper }); renderAll(); toast(couper ? "Accès retiré" : "Accès rendu"); }
      catch (e) { toast(e.message, true); }
    });

    $("#adminActions").innerHTML = `
      <a class="btn primary sm" href="${tableau}?new=true" target="_blank" rel="noopener noreferrer">Créer un compte</a>
      <a class="btn sm" href="${tableau}?invite=true" target="_blank" rel="noopener noreferrer">Inviter par e-mail</a>
      <a class="btn sm" href="${tableau}" target="_blank" rel="noopener noreferrer">Tous les comptes dans Supabase</a>`;
    $("#adminNote").textContent = "Créer un compte ouvre l'écran Supabase, avec « Auto confirm user » déjà coché : e-mail, mot de passe, et la personne apparaît ici. L'invitation, elle, envoie un lien et la personne choisit son mot de passe : personne d'autre ne le connaît. La création reste dans Supabase parce que la clé qui en a le droit contourne toutes les règles de sécurité, et qu'une page web ne doit jamais la porter.";
  }

  /* ==================================================================
     LES INSCRITS DE LA PLATEFORME

     LE MANQUE QUE CET ECRAN COMBLE. Le CRM ne montrait que `public.contacts`,
     c'est-a-dire les 1 374 fiches de prospection importees de Pipedrive. Un
     artisan qui s'inscrit tout seul sur la plateforme arrive dans une AUTRE
     table, `public.artisans`, que rien n'affichait : personne ne le voyait
     arriver, personne ne savait ou il s'arretait dans son parcours.

     DEUX TABLES, DEUX POPULATIONS, ET ON NE LES MELANGE PAS. Un prospect
     demarche et un inscrit sont deux choses differentes : les additionner
     donnerait un compteur flatteur et faux, et c'est sur ce compteur qu'on
     decidera d'ouvrir une ville. Les deux ecrans restent separes.

     CE QUE LE CRM A LE DROIT DE LIRE, ET COMMENT ON LE SAIT. La lecture se
     fait avec la session de la personne connectee, jamais avec une cle de
     service. Sur `artisans`, deux politiques coexistent :
       · « sa fiche »                        -> id = auth.uid()
       · « artisans lus par l administration » -> public.est_admin()
     Un compte qui n'est pas administrateur lit donc ZERO ligne, et la base ne
     renvoie pas d'erreur : elle renvoie une liste vide. Une liste vide ne dit
     pas si la plateforme n'a aucun inscrit ou si le compte n'a pas le droit
     de les voir. C'est pourquoi on appelle D'ABORD `chiffres_back_office()`,
     qui, elle, REFUSE explicitement (code 42501) quand le compte n'est pas
     administrateur, et qui n'existe pas du tout si la migration back office
     n'a pas ete jouee (404). Trois reponses distinctes, trois messages
     distincts a l'ecran.

     Verifie le 14/09/2026 sur la base de production, avec la cle publique et
     sans session : la table `artisans` repond 200 avec une liste vide, et
     `rpc/chiffres_back_office` repond 401 avec « Reserve a l'administration ».
     Les deux chemins existent donc bien en ligne.
     ================================================================== */
  const INS_MAX = 500;
  const INS_CHAMPS = "id,cree_le,maj_le,etape,prenom,nom,telephone,photo_url,siret,siret_etat,"
    + "denomination,activite,commune,code_postal,siret_verifie_le,metier,metier_libre,presentation,"
    + "rayon_km,formule,essai_jusqu_au,abonne_jusqu_au,publie,suspendu_le,suspendu_par,"
    + "motif_suspension,supprime_le";
  const INS_CHAMPS_ABO = "id,artisan_id,cree_le,maj_le,formule,etat,essai_du,essai_au,periode_du,"
    + "periode_au,prochain_prelevement_le,resilie_le,resilie_effet_au,motif_resiliation,prestataire";
  const INS_CHAMPS_DEM = "id,cree_le,maj_le,demandeur_id,destinataire_id,metier,chantier_commune,"
    + "debut,fin,etat,vue_le,repondu_le,motif,expire_le";

  /* Les six etapes du parcours, dans l'ordre de la contrainte `etape` de la
     table `artisans`. L'ordre EST l'information : c'est lui qui dit ou la
     personne s'est arretee. */
  const ETAPES = [
    { k: "identite", l: "Identité", d: "Prénom, nom, téléphone" },
    { k: "entreprise", l: "Entreprise", d: "Numéro de SIRET vérifié" },
    { k: "metier", l: "Métier", d: "Métier, présentation, rayon" },
    { k: "abonnement", l: "Abonnement", d: "Formule et essai" },
    { k: "agenda", l: "Agenda", d: "Disponibilités" },
    { k: "fini", l: "Terminé", d: "Parcours complet" }
  ];
  const iEtape = k => { const i = ETAPES.findIndex(e => e.k === k); return i < 0 ? 0 : i; };

  /* Le vocabulaire est celui de la sous-traitance entre entreprises
     independantes (article L8241-1), jamais celui de l'emploi. */
  const DEM_ETATS = {
    envoyee: { l: "Envoyée", c: "info" }, vue: { l: "Vue", c: "att" },
    acceptee: { l: "Acceptée", c: "ok" }, refusee: { l: "Refusée", c: "non" },
    annulee: { l: "Annulée", c: "" }, expiree: { l: "Expirée", c: "" }
  };

  const INS_FILTRES = [
    { k: "tous", l: "Tous", f: () => true },
    { k: "encours", l: "Parcours en cours", f: a => a.etape !== "fini" },
    { k: "fini", l: "Parcours terminé", f: a => a.etape === "fini" },
    { k: "publie", l: "Fiche en ligne", f: a => a.publie === true },
    { k: "suspendu", l: "Suspendus", f: a => !!a.suspendu_le },
    { k: "sanssiret", l: "Sans SIRET", f: a => !a.siret }
  ];

  const INS = {
    etat: "jamais",   // jamais | chargement | pret | local | absent | refus | erreur
    erreur: "",
    lignes: [],
    tronque: false,
    metiers: {},
    etatsAbo: {},
    chiffres: [],
    detail: {},       // id -> { etat, erreur, abo, envoyees, recues, noms }
    ouvert: null,
    q: "",
    filtre: "tous",
    ordre: -1         // -1 : le plus recent en tete
  };

  /* ---------------------------------------------------------------- lecture */
  async function insCharger(force) {
    if (Store.mode !== "supabase") { INS.etat = "local"; renderInscrits(); return; }
    if (INS.etat === "chargement") return;
    if (INS.etat === "pret" && !force) { renderInscrits(); return; }
    /* « Relire » relit TOUT, y compris l'abonnement et les demandes des fiches
       deja ouvertes : un bouton qui relit la moitie des donnees ferait croire
       que le reste est a jour. */
    if (force) INS.detail = {};
    INS.etat = "chargement"; INS.erreur = ""; renderInscrits();
    try {
      /* Le diagnostic AVANT la liste : lui seul distingue « aucun inscrit » de
         « ce compte n'a pas le droit de lire les inscrits ». */
      const rc = await Store.sbFetch(Store.sbUrl("", "rpc/chiffres_back_office"), { method: "POST", body: "{}" });
      if (rc.status === 404) { INS.etat = "absent"; renderInscrits(); return; }
      if (rc.status === 401 || rc.status === 403) {
        const j = await rc.json().catch(() => ({}));
        INS.etat = "refus"; INS.erreur = j.message || "Réservé à l'administration.";
        renderInscrits(); return;
      }
      if (!rc.ok) throw new Error("chiffres_back_office : la base a répondu " + rc.status);
      INS.chiffres = await rc.json();

      const [ra, rm, re] = await Promise.all([
        Store.sbFetch(Store.sbUrl(`?select=${INS_CHAMPS}&order=cree_le.desc&limit=${INS_MAX + 1}`, "artisans")),
        Store.sbFetch(Store.sbUrl("?select=code,libelle&order=ordre", "metiers")),
        Store.sbFetch(Store.sbUrl("?select=code,libelle,acces,fiche_publiee,message", "abonnement_etats"))
      ]);
      if (!ra.ok) throw new Error("artisans : la base a répondu " + ra.status);
      const lignes = await ra.json();
      INS.tronque = lignes.length > INS_MAX;
      INS.lignes = lignes.slice(0, INS_MAX);
      INS.metiers = {}; if (rm.ok) (await rm.json()).forEach(m => { INS.metiers[m.code] = m.libelle; });
      INS.etatsAbo = {}; if (re.ok) (await re.json()).forEach(e => { INS.etatsAbo[e.code] = e; });
      INS.etat = "pret";
    } catch (e) {
      INS.etat = "erreur";
      INS.erreur = /fetch|network/i.test(e.message)
        ? "Base en ligne injoignable. Vérifie la connexion internet, puis relis."
        : e.message;
    }
    renderInscrits();
  }

  /* Abonnement et demandes : lus fiche par fiche, et non en bloc au demarrage.
     Deux raisons. La table `demandes` grossira sans limite, alors que la fiche
     n'en montre que celles d'une personne. Et une fiche qui charge ses propres
     donnees peut dire elle-meme ce qui a echoue, la ou un chargement global
     ferait echouer tout l'ecran pour une table absente. */
  async function insChargerFiche(id) {
    const d = INS.detail[id] || (INS.detail[id] = { etat: "jamais" });
    if (d.etat === "chargement" || d.etat === "pret") return;
    d.etat = "chargement"; d.erreur = ""; renderInscritFiche();
    const e = encodeURIComponent(id);
    try {
      const [rb, rd] = await Promise.all([
        Store.sbFetch(Store.sbUrl(`?select=${INS_CHAMPS_ABO}&artisan_id=eq.${e}&order=cree_le.desc`, "abonnements")),
        Store.sbFetch(Store.sbUrl(`?select=${INS_CHAMPS_DEM}&or=(demandeur_id.eq.${e},destinataire_id.eq.${e})&order=cree_le.desc&limit=200`, "demandes"))
      ]);
      d.abo = rb.ok ? (await rb.json())[0] || null : null;
      d.aboSouci = rb.ok ? "" : "abonnements : la base a répondu " + rb.status;
      const dem = rd.ok ? await rd.json() : [];
      d.demSouci = rd.ok ? "" : "demandes : la base a répondu " + rd.status;
      d.envoyees = dem.filter(x => x.demandeur_id === id);
      d.recues = dem.filter(x => x.destinataire_id === id);
      /* Le nom du confrere : il est peut-etre hors des 500 fiches chargees.
         On va le chercher plutot que d'afficher un identifiant technique. */
      d.noms = {};
      const connus = new Set(INS.lignes.map(a => a.id));
      const manque = Array.from(new Set(dem.map(x => x.demandeur_id === id ? x.destinataire_id : x.demandeur_id)))
        .filter(x => x && !connus.has(x));
      if (manque.length) {
        const rn = await Store.sbFetch(Store.sbUrl(
          `?select=id,prenom,nom,denomination&id=in.(${manque.map(encodeURIComponent).join(",")})`, "artisans"));
        if (rn.ok) (await rn.json()).forEach(a => { d.noms[a.id] = insNom(a); });
      }
      d.etat = "pret";
    } catch (x) {
      d.etat = "erreur";
      d.erreur = /fetch|network/i.test(x.message) ? "Base en ligne injoignable." : x.message;
    }
    renderInscritFiche();
  }

  /* ---------------------------------------------------------------- mise en forme */
  const insNom = a => a.denomination || [a.prenom, a.nom].filter(Boolean).join(" ") || "Compte sans nom";
  const insPersonne = a => [a.prenom, a.nom].filter(Boolean).join(" ");
  const insMetier = a => INS.metiers[a.metier] || a.metier_libre || "";
  const insLieu = a => [a.commune, a.code_postal ? "(" + a.code_postal.slice(0, 2) + ")" : ""].filter(Boolean).join(" ");
  const fmtSiret = s => { const n = String(s || "").replace(/\D/g, ""); return n.length === 14 ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}` : (s || ""); };
  function ilYA(iso) {
    if (!iso) return "";
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 0) return "à venir";
    if (s < 60) return "à l'instant";
    if (s < 3600) return "il y a " + Math.max(1, Math.round(s / 60)) + " min";
    if (s < 86400) return "il y a " + Math.round(s / 3600) + " h";
    const j = Math.round(s / 86400);
    if (j === 1) return "hier";
    if (j < 31) return "il y a " + j + " j";
    if (j < 365) return "il y a " + Math.round(j / 30) + " mois";
    return "il y a " + Math.round(j / 365) + " an" + (j >= 730 ? "s" : "");
  }
  /* Nombre de jours pleins entre aujourd'hui et une date « AAAA-MM-JJ ». Les
     deux bornes sont posees a minuit local : sans cela, le decalage horaire
     fait gagner ou perdre un jour selon l'heure a laquelle on regarde. */
  function joursJusqua(d) {
    if (!d) return null;
    const a = new Date(String(d).slice(0, 10) + "T00:00:00");
    const b = new Date(today() + "T00:00:00");
    return Math.round((a - b) / 86400000);
  }
  const insVide = t => `<span class="vide">${esc(t)}</span>`;

  function insCherche(a) {
    return norm([a.denomination, a.prenom, a.nom, a.commune, a.code_postal, a.siret,
      a.activite, insMetier(a), a.telephone].filter(Boolean).join(" "));
  }
  function insFiltrees() {
    const q = norm(INS.q).split(/\s+/).filter(Boolean);
    const f = (INS_FILTRES.find(x => x.k === INS.filtre) || INS_FILTRES[0]).f;
    return INS.lignes
      .filter(a => f(a) && (!q.length || (h => q.every(t => h.includes(t)))(insCherche(a))))
      .sort((a, b) => String(a.cree_le || "").localeCompare(String(b.cree_le || "")) * INS.ordre);
  }
  function insCompteur() {
    const el = $("#nInscrits"); if (!el) return;
    el.textContent = INS.etat === "pret" ? String(INS.lignes.length) : "";
  }

  /* ---------------------------------------------------------------- la liste */
  function renderInscrits() {
    insCompteur();
    const rows = $("#insRows"), sous = $("#insSous"), filtres = $("#insFiltres"), ordre = $("#insOrdre");
    if (!rows) return;
    $("#ins").classList.toggle("ouvert", !!INS.ouvert);
    ordre.textContent = INS.ordre === -1 ? "Plus récents" : "Plus anciens";
    ordre.title = "Inverser l'ordre des dates d'inscription";

    if (INS.etat !== "pret") {
      filtres.innerHTML = ""; sous.textContent = "";
      rows.innerHTML = INS.etat === "chargement"
        ? Array.from({ length: 6 }, () => `<div class="ins-squelette"></div>`).join("")
        : `<div class="ins-vide">${esc({
          jamais: "Liste non encore lue.",
          local: "Mode test : aucune base en ligne.",
          absent: "Le back office n'est pas installé sur cette base.",
          refus: "Ton compte ne lit pas les inscrits.",
          erreur: "Lecture impossible."
        }[INS.etat] || "")}</div>`;
      renderInscritFiche();
      return;
    }

    const total = INS.lignes.length;
    sous.innerHTML = `<b>${total}</b> compte${total > 1 ? "s" : ""} ouvert${total > 1 ? "s" : ""} sur la plateforme`
      + (INS.tronque ? `, les ${INS_MAX} plus récents affichés` : "")
      + `. Table <span class="mono">public.artisans</span>, distincte des fiches de prospection.`;

    /* Pas de rangee de filtres quand il n'y a rien a filtrer : six pastilles a
       zero ne sont pas un outil, ce sont six zeros. */
    filtres.innerHTML = total ? INS_FILTRES.map(f => {
      const n = INS.lignes.filter(f.f).length;
      return `<button class="ins-f" data-f="${f.k}" aria-pressed="${INS.filtre === f.k}">${esc(f.l)}<span class="n">${n}</span></button>`;
    }).join("") : "";

    const list = insFiltrees();
    /* Deux vides differents, deux phrases differentes : personne ne s'est
       encore inscrit, ou bien le filtre est trop etroit. Les confondre
       ferait chercher un bug la ou il n'y a qu'un filtre. */
    if (!total) {
      rows.innerHTML = `<div class="ins-vide">Aucun compte ouvert sur la plateforme pour l'instant.<br>
        Les inscriptions arrivent ici dès qu'une première personne crée son compte.</div>`;
      renderInscritFiche();
      return;
    }
    rows.innerHTML = list.length ? list.map(a => {
      const i = iEtape(a.etape), fini = a.etape === "fini";
      const jauge = ETAPES.map((e, k) => `<i class="${k <= i ? (fini ? "fin" : "on") : ""}"></i>`).join("");
      const second = [insMetier(a), insLieu(a)].filter(Boolean).join(" · ") || "Parcours à peine commencé";
      /* L'etape est ecrite EN CHIFFRES a cote de la jauge. Mesure du 14/09/2026 :
         un segment vide vaut 1,11 : 1 sur le sol de la liste, autrement dit il ne
         se voit pas. Une jauge a deux points se lirait alors « 2 sur 2 » au lieu
         de « 2 sur 6 ». Le chiffre tranche, la jauge accompagne. */
      const ou = "Étape " + (i + 1) + " sur 6 : " + ETAPES[i].l;
      return `<button class="ins-ligne" data-id="${esc(a.id)}" aria-current="${INS.ouvert === a.id}" title="${esc(insNom(a))}">
        <span class="o">${esc(insNom(a))}</span>
        <span class="q">${esc(ilYA(a.cree_le))}</span>
        <span class="m">${esc(second)}</span>
        <span class="e" aria-label="${esc(ou)}"><span class="f">${i + 1}/6</span>${jauge}</span>
      </button>`;
    }).join("")
      : `<div class="ins-vide">Aucun inscrit ne correspond${INS.q ? " à « " + esc(INS.q) + " »" : ""}.<br>Retire un filtre pour élargir.</div>`;

    renderInscritFiche();
  }

  function insOuvrir(id) {
    INS.ouvert = id;
    $("#ins").classList.add("ouvert");
    $$("#insRows .ins-ligne").forEach(b => b.setAttribute("aria-current", String(b.dataset.id === id)));
    renderInscritFiche();
    insChargerFiche(id);
    const f = $("#insFiche"); if (f) f.scrollTop = 0;
    /* Le focus suit l'ouverture : sans lui, le clavier resterait dans la liste
       et le lecteur d'ecran ne dirait rien du contenu qui vient de changer. */
    const t = $("#insTitre"); if (t) t.focus({ preventScroll: true });
  }
  function insFermer() {
    INS.ouvert = null;
    $("#ins").classList.remove("ouvert");
    $$("#insRows .ins-ligne").forEach(b => b.setAttribute("aria-current", "false"));
    renderInscritFiche();
  }

  /* ---------------------------------------------------------------- la fiche */
  function renderInscritFiche() {
    const box = $("#insFiche"); if (!box) return;

    if (INS.etat !== "pret") { box.innerHTML = insEcranEtat(); return; }
    if (!INS.ouvert) { box.innerHTML = insEcranAccueil(); return; }
    const a = INS.lignes.find(x => x.id === INS.ouvert);
    if (!a) { INS.ouvert = null; box.innerHTML = insEcranAccueil(); return; }

    const d = INS.detail[a.id] || { etat: "jamais" };
    const i = iEtape(a.etape), fini = a.etape === "fini";
    const jauge = ETAPES.map((e, k) => `<i class="${k <= i ? (fini ? "fin" : "on") : ""}"></i>`).join("");
    const parQui = (Store.tous || []).find(p => p.id === a.suspendu_par);

    const badges = [
      a.supprime_le ? `<span class="pill non">Compte supprimé</span>` : "",
      a.suspendu_le ? `<span class="pill non">Fiche suspendue</span>`
        : a.publie ? `<span class="pill ok">Fiche en ligne</span>`
          : `<span class="pill">Fiche non publiée</span>`,
      a.siret ? `<span class="pill ${a.siret_etat === "valide" ? "ok" : "att"}">${a.siret_etat === "valide" ? "SIRET vérifié" : "SIRET non diffusible"}</span>`
        : `<span class="pill att">Sans SIRET</span>`,
      fini ? `<span class="pill ok">Parcours terminé</span>` : `<span class="pill att">Parcours en cours</span>`
    ].filter(Boolean).join("");

    box.innerHTML = `<div class="ins-corps">
      <button class="btn sm ins-retour" id="insRetour">‹ Retour à la liste</button>
      <span class="ins-etiq">Inscrit le ${esc(fmtDate(a.cree_le))} · ${esc(ilYA(a.cree_le))}</span>
      <h2 class="ins-nom" id="insTitre" tabindex="-1">${esc(insNom(a))}</h2>
      <p class="ins-qui">${esc([insPersonne(a) && a.denomination ? insPersonne(a) : "", insMetier(a), insLieu(a)].filter(Boolean).join(" · ") || "Rien de renseigné pour l'instant")}</p>
      <div class="ins-badges">${badges}</div>

      <div class="ins-parcours">
        <div class="ins-jauge" role="img" aria-label="${esc("Étape " + (i + 1) + " sur 6 : " + ETAPES[i].l)}">${jauge}</div>
        <div class="t">Étape ${i + 1} sur 6 · ${esc(ETAPES[i].l)}</div>
        <div class="s">${esc((reste => fini
          ? "Le parcours est complet. L'essai s'est ouvert à ce moment-là, pas à la création du compte."
          : reste.length
            ? "Reste à faire : " + reste.join(", ") + ", puis la validation du parcours."
            : "Il ne reste que la validation du parcours.")(
              ETAPES.slice(i + 1).filter(e => e.k !== "fini").map(e => e.l.toLowerCase())))}</div>
        <div class="etapes">${ETAPES.map((e, k) => k <= i ? `<b>${esc(e.l)}</b>` : `<span>${esc(e.l)}</span>`).join("")}</div>
      </div>

      ${a.suspendu_le ? `<div class="ins-alerte"><b>Fiche suspendue le ${esc(fmtDate(a.suspendu_le))}${parQui ? " par " + esc(parQui.prenom) : ""}</b>
        Motif : ${esc(a.motif_suspension || "non renseigné")}<br>
        Tant qu'elle tient, l'artisan ne peut pas republier sa fiche.
        La levée passe par <span class="mono">moderer_fiche()</span>, hors de ce CRM.</div>` : ""}
      ${a.supprime_le ? `<div class="ins-alerte"><b>Compte supprimé le ${esc(fmtDate(a.supprime_le))}</b>
        La ligne reste en base pour la traçabilité. Ne pas rappeler cette personne.</div>` : ""}

      <div class="ins-grille">
        <div class="ins-bloc">
          <h4>L'entreprise <span class="muted">${a.siret_verifie_le ? "vérifiée le " + esc(fmtDate(a.siret_verifie_le)) : "non vérifiée"}</span></h4>
          <dl>
            <div class="ins-l"><dt>SIRET</dt><dd>${a.siret ? `<span class="mono">${esc(fmtSiret(a.siret))}</span>` : insVide("pas encore saisi")}</dd></div>
            <div class="ins-l"><dt>État</dt><dd>${a.siret_etat === "valide" ? "Valide et diffusible"
              : a.siret_etat === "non_diffusible" ? "Valide, mais l'entreprise s'oppose à la diffusion de ses données"
                : insVide("non vérifié")}</dd></div>
            <div class="ins-l"><dt>Dénomination</dt><dd>${a.denomination ? esc(a.denomination) : insVide("non renseignée")}</dd></div>
            <div class="ins-l"><dt>Activité</dt><dd>${a.activite ? esc(a.activite) : insVide("non renseignée")}</dd></div>
            <div class="ins-l"><dt>Commune</dt><dd>${a.commune || a.code_postal ? esc([a.code_postal, a.commune].filter(Boolean).join(" ")) : insVide("non renseignée")}</dd></div>
          </dl>
        </div>

        <div class="ins-bloc">
          <h4>Contact</h4>
          <dl>
            <div class="ins-l"><dt>Personne</dt><dd>${insPersonne(a) ? esc(insPersonne(a)) : insVide("non renseignée")}</dd></div>
            <div class="ins-l"><dt>Téléphone</dt><dd>${a.telephone
              ? `<a class="mono" href="tel:${esc(String(a.telephone).replace(/[^0-9+]/g, ""))}">${esc(a.telephone)}</a>`
              : insVide("non renseigné")}</dd></div>
            <div class="ins-l"><dt>E-mail</dt><dd class="vide">non lisible : l'adresse vit dans <span class="mono">auth.users</span>, qu'aucune politique n'ouvre à une session</dd></div>
            <div class="ins-l"><dt>Inscrit le</dt><dd>${esc(fmtDT(a.cree_le))}</dd></div>
            <div class="ins-l"><dt>Dernière modif.</dt><dd>${a.maj_le ? esc(fmtDT(a.maj_le)) + " · " + esc(ilYA(a.maj_le)) : insVide("jamais")}</dd></div>
          </dl>
        </div>

        <div class="ins-bloc">
          <h4>Métier et zone</h4>
          <dl>
            <div class="ins-l"><dt>Métier</dt><dd>${insMetier(a) ? esc(insMetier(a)) + (a.metier ? "" : " <span class=\"vide\">(saisi à la main)</span>") : insVide("non choisi")}</dd></div>
            <div class="ins-l"><dt>Rayon</dt><dd><span class="mono">${esc(String(a.rayon_km == null ? "" : a.rayon_km))}</span> km autour de sa commune</dd></div>
            <div class="ins-l"><dt>Présentation</dt><dd>${a.presentation ? esc(a.presentation) : insVide("non écrite")}</dd></div>
          </dl>
        </div>

        <div class="ins-bloc">${insBlocAbonnement(a, d)}</div>

        <div class="ins-bloc large">${insBlocDemandes(a, d)}</div>

        <div class="ins-bloc large">
          <h4>Notes <span class="muted">non branché</span></h4>
          <div class="ins-notes">
            <b>La place est réservée, rien ne peut encore être enregistré.</b>
            Aucune table ne porte de note d'équipe sur un inscrit : <code>artisans</code> n'a pas de colonne pour ça,
            et <code>contacts.crm</code> est indexée sur les identifiants Pipedrive, pas sur les comptes de la plateforme.
            Il manque une table <code>notes_artisan</code> (colonnes : artisan_id, auteur, texte, date) avec une politique
            réservée à <code>est_admin()</code>. Tant qu'elle n'existe pas, un champ de saisie ici perdrait le texte
            au rechargement : c'est pour ça qu'il n'y en a pas.
          </div>
        </div>
      </div>

      <div class="ins-limites">
        <h5>Ce que ce CRM ne lit pas, et pourquoi</h5>
        <ul>
          <li>L'adresse e-mail de l'artisan : elle est dans <span class="mono">auth.users</span>, hors de portée d'une session.</li>
          <li>Les jetons d'agenda : la table <span class="mono">agenda_secrets</span> n'a aucune politique de lecture, pour personne.</li>
          <li>Le contenu des messages échangés : réservé aux deux parties de la conversation.</li>
          <li>Les créneaux d'occupation : lisibles par l'administration, mais non affichés ici, pour ne pas déplier l'agenda de quelqu'un.</li>
        </ul>
      </div>
    </div>`;
  }

  function insBlocAbonnement(a, d) {
    const h = `<h4>Abonnement et essai</h4>`;
    if (d.etat === "chargement") return h + `<div class="ins-vide">Lecture de l'abonnement…</div>`;
    if (d.etat === "erreur") return h + `<div class="ins-vide">Lecture impossible : ${esc(d.erreur || "")}</div>`;
    if (d.etat !== "pret") return h + `<div class="ins-vide">Non lu.</div>`;
    if (d.aboSouci) return h + `<div class="ins-vide">${esc(d.aboSouci)}</div>`;
    const b = d.abo;
    if (!b) {
      return h + `<div class="ins-vide" style="text-align:left">Aucune ligne d'abonnement.
        L'essai s'ouvre automatiquement quand l'étape passe à « Terminé », pas à la création du compte
        ${a.essai_jusqu_au ? `.<br>La colonne <span class="mono">artisans.essai_jusqu_au</span> porte pourtant le ${esc(fmtDate(a.essai_jusqu_au))} : les deux ne s'accordent pas, à vérifier.` : "."}</div>`;
    }
    const et = INS.etatsAbo[b.etat] || { libelle: b.etat, acces: "", message: "" };
    const jr = joursJusqua(b.essai_au);
    const cls = { essai: "att", actif: "ok", impaye: "non", suspendu: "non", resilie: "att", expire: "" }[b.etat] || "";
    return h + `<dl>
      <div class="ins-l"><dt>État</dt><dd><span class="pill ${cls}">${esc(et.libelle)}</span></dd></div>
      <div class="ins-l"><dt>Accès</dt><dd>${esc({ complet: "Complet", lecture: "Lecture seule", ferme: "Fermé" }[et.acces] || et.acces || "inconnu")}</dd></div>
      <div class="ins-l"><dt>Essai</dt><dd>${b.essai_au
        ? esc(fmtDate(b.essai_du) + " → " + fmtDate(b.essai_au)) + (jr == null ? "" : jr >= 0
          ? ` · <b>${jr} jour${jr > 1 ? "s" : ""}</b> restant${jr > 1 ? "s" : ""}`
          : ` · terminé depuis ${-jr} jour${-jr > 1 ? "s" : ""}`)
        : insVide("aucun essai ouvert")}</dd></div>
      <div class="ins-l"><dt>Période réglée</dt><dd>${b.periode_au ? esc(fmtDate(b.periode_du) + " → " + fmtDate(b.periode_au)) : insVide("aucune")}</dd></div>
      <div class="ins-l"><dt>Formule</dt><dd>${b.formule || a.formule ? esc(b.formule || a.formule) : insVide("pas encore choisie")}</dd></div>
      <div class="ins-l"><dt>Prestataire</dt><dd>${b.prestataire ? esc(b.prestataire) : insVide("aucun prestataire de paiement raccordé")}</dd></div>
      ${b.resilie_le ? `<div class="ins-l"><dt>Résiliation</dt><dd>demandée le ${esc(fmtDate(b.resilie_le))}${b.resilie_effet_au ? ", effet au " + esc(fmtDate(b.resilie_effet_au)) : ""}${b.motif_resiliation ? `<br><span class="vide">${esc(b.motif_resiliation)}</span>` : ""}</dd></div>` : ""}
    </dl>`;
  }

  function insBlocDemandes(a, d) {
    const n = d.etat === "pret" ? (d.envoyees || []).length + (d.recues || []).length : null;
    const h = `<h4>Demandes de sous-traitance <span class="muted">${n == null ? "" : n + " au total"}</span></h4>`;
    if (d.etat === "chargement") return h + `<div class="ins-vide">Lecture des demandes…</div>`;
    if (d.etat === "erreur") return h + `<div class="ins-vide">Lecture impossible : ${esc(d.erreur || "")}</div>`;
    if (d.etat !== "pret") return h + `<div class="ins-vide">Non lu.</div>`;
    if (d.demSouci) return h + `<div class="ins-vide">${esc(d.demSouci)}</div>`;

    const nom = id => d.noms[id] || (x => x ? insNom(x) : "Confrère inconnu")(INS.lignes.find(y => y.id === id));
    const ligne = (x, sortante) => {
      const autre = sortante ? x.destinataire_id : x.demandeur_id;
      const e = DEM_ETATS[x.etat] || { l: x.etat, c: "" };
      return `<div class="ins-dem">
        <span class="sens" aria-hidden="true">${sortante ? "↗" : "↘"}</span>
        <span>
          <span class="qui">${esc(sortante ? "Vers " + nom(autre) : "De " + nom(autre))}</span>
          <span class="quoi">${esc([INS.metiers[x.metier] || x.metier || "", x.chantier_commune || ""].filter(Boolean).join(" · ") || "chantier non précisé")}</span>
          <span class="quand">Chantier du ${esc(fmtDate(x.debut))} au ${esc(fmtDate(x.fin))} · envoyée ${esc(ilYA(x.cree_le))}${x.motif ? " · motif : " + esc(x.motif) : ""}</span>
        </span>
        <span class="rt"><span class="pill ${e.c}">${esc(e.l)}</span></span>
      </div>`;
    };
    const bloc = (titre, arr, sortante) => `<div style="margin-top:14px">
      <div class="ins-etiq">${esc(titre)} · ${arr.length}</div>
      ${arr.length ? arr.map(x => ligne(x, sortante)).join("") : `<div class="ins-vide" style="text-align:left">Aucune.</div>`}
    </div>`;
    return h + bloc("Envoyées par cette entreprise", d.envoyees || [], true)
      + bloc("Reçues par cette entreprise", d.recues || [], false);
  }

  /* L'ecran de droite quand aucune fiche n'est ouverte : il sert a dire ou en
     est la plateforme, plutot qu'a repeter « rien de selectionne ». */
  function insEcranAccueil() {
    const c = INS.chiffres || [];
    return `<div class="ins-corps">
      <span class="ins-etiq">Vue d'ensemble</span>
      <h2 class="ins-nom">La plateforme, en chiffres</h2>
      <p class="ins-qui">Comptés par <span class="mono">chiffres_back_office()</span>, à l'instant, dans la base.
      Choisis un inscrit à gauche pour ouvrir sa fiche complète.</p>
      ${c.length ? `<div class="ins-chiffres">${c.map(x => `<div class="ins-c">
        <div class="v ${x.valeur == null ? "nul" : ""}">${x.valeur == null ? "non mesurable" : esc(String(x.valeur))}</div>
        <div class="l">${esc(x.libelle)}</div>
        ${x.pourquoi ? `<div class="p">${esc(x.pourquoi)}</div>` : ""}
      </div>`).join("")}</div>`
        : `<div class="ins-vide" style="text-align:left">Aucun compteur renvoyé par la base.</div>`}
      <div class="ins-limites">
        <h5>Deux populations à ne pas confondre</h5>
        <ul>
          <li><b>Inscrits</b> : les artisans qui ont ouvert un compte eux-mêmes, table <span class="mono">public.artisans</span>. C'est cet écran.</li>
          <li><b>Contacts</b> : les fiches de prospection importées de Pipedrive, table <span class="mono">public.contacts</span>. C'est l'onglet Contacts.</li>
          <li>Les additionner donnerait un chiffre faux : un prospect démarché n'est pas un inscrit.</li>
        </ul>
      </div>
    </div>`;
  }

  /* Chargement, vide, refus, absence, erreur : chaque etat a son ecran, et
     aucun n'est blanc. Un ecran qui ne dit rien laisse croire a une panne. */
  function insEcranEtat() {
    const ref = (CFG.supabase && CFG.supabase.url || "").match(/\/\/([a-z0-9]+)\.supabase\.co/);
    const textes = {
      jamais: { t: "Liste non encore lue", p: "Clique sur « Relire » pour interroger la base.", b: true },
      chargement: { t: "Lecture en cours…", p: "Le CRM interroge la base avec ta session, jamais avec une clé d'administration." },
      local: {
        t: "Mode test : aucun inscrit à montrer",
        p: "Ce fichier a été ouvert sans base en ligne. Les inscrits de la plateforme vivent dans Supabase et ne peuvent pas être lus depuis un fichier local. Ouvre le CRM à son adresse en ligne."
      },
      absent: {
        t: "Le back office n'est pas installé sur cette base",
        p: "La fonction <span class=\"mono\">chiffres_back_office()</span> n'existe pas ici, donc aucune politique n'autorise un administrateur à lire les inscrits. Il faut jouer <span class=\"mono\">crm/supabase/migration-back-office.sql</span> dans l'éditeur SQL de Supabase, une fois.",
        b: true
      },
      refus: {
        t: "Ton compte ne lit pas les inscrits",
        p: "La base a répondu : « " + esc(INS.erreur) + " ». La lecture de <span class=\"mono\">public.artisans</span> est réservée aux comptes que <span class=\"mono\">est_admin()</span> reconnaît. Ce n'est pas la page qui décide, c'est la règle d'accès : cacher un bouton ne changerait rien. Le drapeau se pose dans le tableau de bord Supabase, jamais depuis une page web.",
        b: true
      },
      erreur: { t: "Lecture impossible", p: esc(INS.erreur || "Raison inconnue."), b: true }
    };
    const e = textes[INS.etat] || textes.erreur;
    const lien = ref ? `https://supabase.com/dashboard/project/${ref[1]}/sql/new` : "";
    return `<div class="ins-etat">
      <b tabindex="-1">${esc(e.t)}</b>
      <p>${e.p}</p>
      ${INS.etat === "refus" || INS.etat === "absent"
        ? `<div class="code">select * from public.profils order by cree_le;</div>` : ""}
      <div class="actions">
        ${e.b ? `<button class="btn primary" id="insReessayer">Relire la base</button>` : ""}
        ${(INS.etat === "refus" || INS.etat === "absent") && lien
        ? `<a class="btn" href="${esc(lien)}" target="_blank" rel="noopener noreferrer">Ouvrir l'éditeur SQL</a>` : ""}
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ export / import */
  function exportJSON() {
    const data = { app: "adispo-crm", version: CFG.version, exporte: now(), par: USER, mode: Store.mode, travail: OVER };
    download(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }), `adispo-crm-sauvegarde-${today()}.json`);
    toast("Sauvegarde téléchargée");
  }
  function importJSON(file) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const j = JSON.parse(r.result);
        const t = j.travail || j;
        if (typeof t !== "object") throw new Error("format inconnu");
        const n = Object.keys(t).length;
        if (!confirm(`Importer ${n} fiche(s) travaillée(s) ? Les fiches présentes dans le fichier remplacent celles en cours.`)) return;
        Object.keys(t).forEach(id => { OVER[id] = t[id]; });
        MERGED = null;
        await Store.putMany(Object.keys(t));
        renderAll(); toast(`${n} fiches importées`);
      } catch (e) { toast("Fichier illisible : " + e.message, true); }
    };
    r.readAsText(file);
  }
  function exportCSV(list, name) {
    const head = ["Fiche", "Société", "Contact", "Métier", "E-mail", "Site web", "Tél 1", "Tél 2", "Code postal", "Ville", "Dépt", "Département", "Statut", "Suivi par", "Mode", "Formule", "Relance", "Prochaine action", "Dernier contact", "Fiabilité", "Vérifiée", "Notes", "Signalements"];
    const q = s => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
    const rows = list.filter(c => !c.crm.opposition).map(c => [c.id, c.orgAff, c.nomAff, c.metierAff, c.email, c.site ? "https://" + c.site : "", (c.tels[0] || {}).num, (c.tels[1] || {}).num, c.cp, c.ville, c.dept, c.deptNom, ST[c.statut].label, c.resp, c.crm.mode ? CFG.modes.find(m => m.key === c.crm.mode).label : "", c.crm.formule ? CFG.formules.find(f => f.key === c.crm.formule).label : "", c.relance, c.crm.action, c.crm.dernierContact, FIAB[c.fiabilite], c.crm.verifie ? "oui" : "", c.crm.notes, c.signalements].map(q).join(";"));
    download(new Blob(["\uFEFF" + [head.map(q).join(";"), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }), name);
    toast(`${rows.length} fiches exportées (oppositions exclues)`);
  }

  /* ------------------------------------------------------------------ nouveau contact */
  function openAdd() {
    $("#aMetier").innerHTML = `<option value="">Non renseigné</option>` + CFG.metiers.map(m => `<option>${esc(m)}</option>`).join("");
    ["aOrg", "aNom", "aEmail", "aTel", "aCp", "aVille", "aSource"].forEach(i => $("#" + i).value = "");
    $("#ovAdd").classList.add("open"); $("#aOrg").focus();
  }
  function createContact() {
    const org = $("#aOrg").value.trim(); if (!org) { toast("La société est obligatoire", true); return; }
    const cp = $("#aCp").value.trim();
    const id = 100000 + Math.floor(Date.now() / 1000) % 100000000;
    const base = { nom: $("#aNom").value.trim(), organisation: org, email: $("#aEmail").value.trim().toLowerCase(), tels: $("#aTel").value.trim() ? [{ num: $("#aTel").value.trim(), type: "" }] : [], cp, ville: $("#aVille").value.trim(), dept: cp.length >= 2 ? cp.slice(0, 2) : "", deptNom: "", fiabilite: "fiable", aVerifier: "", signalements: "", cpBrut: "", photo: "", metierSuggere: "", source: $("#aSource").value.trim() };
    OVER[id] = { base, metier: $("#aMetier").value, resp: USER, maj: now(), par: USER, hist: [{ d: now(), par: USER, type: "note", txt: "Fiche créée" + (base.source ? " · " + base.source : "") }] };
    MERGED = null; Store.put(id, OVER[id]);
    $("#ovAdd").classList.remove("open"); switchView("contacts"); openFiche(id); toast("Fiche créée");
  }

  /* ------------------------------------------------------------------ prochaine fiche à appeler */
  function nextToCall() {
    const list = merged().filter(c => !c.crm.opposition && c.statut === "a_contacter" && c.tels.length && (!c.resp || c.resp === USER));
    const order = { fiable: 0, a_controler: 1, inexploitable: 2 };
    list.sort((a, b) => (a.resp ? 0 : 1) - (b.resp ? 0 : 1) || order[a.fiabilite] - order[b.fiabilite] || a.id - b.id);
    if (!list.length) { toast("Plus rien à appeler dans « À contacter » avec un téléphone."); return; }
    clearF(); F.statut = "a_contacter"; switchView("contacts"); openFiche(list[0].id);
  }

  /* ------------------------------------------------------------------ événements globaux */
  function bind() {
    $("#tabs").onclick = e => { const t = e.target.closest(".tab"); if (t) switchView(t.dataset.view); };
    $("#brandLink").onclick = e => { e.preventDefault(); switchView("dash"); };
    $("#q").addEventListener("input", e => { F.q = e.target.value; shown = 300; if (view !== "contacts") switchView("contacts"); else renderTable(); });
    $("#dashGoRelances").onclick = () => switchView("relances");
    $("#dashGoNext").onclick = nextToCall;
    $("#addBtn").onclick = openAdd; $("#addCancel").onclick = () => $("#ovAdd").classList.remove("open"); $("#addOk").onclick = createContact;
    $("#userBtn").onclick = () => { if (Store.mode === "supabase") { if (confirm("Se déconnecter de cet appareil ?")) Auth.logout(); } else askUser(); };
    $("#menuBtn").onclick = () => $("#rail").classList.toggle("open");
    $("#clearFilters").onclick = () => { clearF(); renderAll(); };
    $("#rail").onclick = e => {
      const ch = e.target.closest(".chip[data-f]"); if (!ch) return;
      const k = ch.dataset.f, v = ch.dataset.v; F[k] = F[k] === v ? null : v; shown = 300; renderAll();
    };
    $("#fMetier").onchange = e => { F.metier = e.target.value; renderAll(); };
    $("#fDept").onchange = e => { F.dept = e.target.value; renderAll(); };
    $("#chips").onclick = e => { const b = e.target.closest("[data-clear]"); if (!b) return; const k = b.dataset.clear; if (k === "q") { F.q = ""; $("#q").value = ""; } else if (k === "metier" || k === "dept") F[k] = ""; else F[k] = null; renderAll(); };
    $("#thead").onclick = e => { const th = e.target.closest("th[data-k]"); if (th) { if (sortKey === th.dataset.k) sortDir *= -1; else { sortKey = th.dataset.k; sortDir = 1; } renderTable(); return; } if (e.target.id === "ckAll") { const list = filtered(); if (e.target.checked) list.forEach(c => SEL.add(c.id)); else list.forEach(c => SEL.delete(c.id)); renderTable(); } };
    $("#rows").onclick = e => {
      const ck = e.target.closest("[data-ck]"); if (ck) { const id = +ck.dataset.ck; if (ck.checked) SEL.add(id); else SEL.delete(id); updateBulk(); return; }
      if (e.target.closest("a[href]")) return;   /* le numero appelle, il n'ouvre pas la fiche */
      const tr = e.target.closest("tr.row"); if (tr) openFiche(+tr.dataset.id);
    };
    $("#bulkStatut").innerHTML = `<option value="">Statut…</option>` + STATUTS.map(s => `<option value="${s.key}">${esc(s.label)}</option>`).join("");
    $("#bulkStatut").onchange = e => { const k = e.target.value; if (!k) return; if (!confirm(`Passer ${SEL.size} fiche(s) en « ${ST[k].label} » ?`)) { e.target.value = ""; return; } SEL.forEach(id => setStatut(id, k, true)); e.target.value = ""; renderAll(); toast("Statut appliqué"); };
    $("#bulkResp").onfocus = () => { $("#bulkResp").innerHTML = `<option value="">Suivi par…</option>` + users().map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join("") + `<option value="__none">Personne</option>`; };
    $("#bulkResp").onchange = e => { const v = e.target.value; if (!v) return; SEL.forEach(id => touch(id, { resp: v === "__none" ? "" : v })); e.target.value = ""; renderAll(); toast(`${SEL.size} fiche(s) attribuée(s)`); };
    $("#bulkClear").onclick = () => { SEL.clear(); renderTable(); };
    $("#csvBtn").onclick = () => exportCSV(sorted(filtered()), `adispo-contacts-${today()}.csv`);
    $("#expJson").onclick = exportJSON; $("#expCsvAll").onclick = () => exportCSV(merged(), `adispo-base-complete-${today()}.csv`);
    $("#impJson").onclick = () => $("#impFile").click(); $("#impFile").onchange = e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; };
    ["kbResp", "kbDept", "kbHideEntree"].forEach(i => $("#" + i).onchange = renderKanban);

    /* ---- inscrits. Les gestionnaires sont poses une fois sur les conteneurs :
       le contenu est redessine a chaque rendu, un gestionnaire pose sur une
       ligne disparaitrait avec elle. */
    $("#insRelire").onclick = () => insCharger(true);
    $("#insOrdre").onclick = () => { INS.ordre *= -1; renderInscrits(); };
    $("#insQ").addEventListener("input", e => { INS.q = e.target.value; renderInscrits(); });
    $("#insFiltres").onclick = e => { const b = e.target.closest("[data-f]"); if (!b) return; INS.filtre = b.dataset.f; renderInscrits(); };
    $("#insRows").onclick = e => { const b = e.target.closest(".ins-ligne"); if (b) insOuvrir(b.dataset.id); };
    $("#insFiche").onclick = e => {
      if (e.target.closest("#insRetour")) { insFermer(); return; }
      if (e.target.closest("#insReessayer")) insCharger(true);
    };

    document.addEventListener("keydown", e => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        (view === "inscrits" ? $("#insQ") : $("#q")).focus();
      }
      if (e.key === "Escape") {
        if ($(".overlay.open") && !$("#ovUser").classList.contains("open") && !$("#ovCode").classList.contains("open") && !$("#ovLogin").classList.contains("open")) $$(".overlay.open").forEach(o => o.classList.remove("open"));
        else if (view === "inscrits" && INS.ouvert) insFermer();
        else if (openId != null) closeFiche();
        $("#rail").classList.remove("open");
      }
    });
    document.addEventListener("click", e => { if (window.innerWidth <= 860 && !e.target.closest("#rail") && !e.target.closest("#menuBtn")) $("#rail").classList.remove("open"); });
  }

  /* ------------------------------------------------------------------ démarrage */
  async function start() {
    bind();
    if (CFG.codeAcces) {
      const ok = sessionStorage.getItem(CFG.cleStockage + ".code") === CFG.codeAcces;
      if (!ok) {
        await new Promise(res => {
          $("#ovCode").classList.add("open");
          const go = () => { if ($("#codeInput").value === CFG.codeAcces) { sessionStorage.setItem(CFG.cleStockage + ".code", CFG.codeAcces); $("#ovCode").classList.remove("open"); res(); } else { toast("Code incorrect", true); } };
          $("#codeOk").onclick = go; $("#codeInput").onkeydown = e => { if (e.key === "Enter") go(); };
        });
      }
    }
    try { await Store.init(); setSync("ok"); }
    catch (e) {
      setSync("err", e.message);
      toast("Base en ligne injoignable : " + e.message + ". Recharge la page dans un instant.", true);
      /* on n'ouvre pas de mode local de secours en production : on n'écrirait nulle part d'utile */
      if (Store.mode === "supabase") return;
    }
    if (Store.mode === "local") { if (pref.user) setUser(pref.user); else askUser(); }
    renderAll();
  }
  start();
})();
