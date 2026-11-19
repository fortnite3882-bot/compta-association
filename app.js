"use strict";
/* Compta Asso — suivi budgétaire & trésorerie. 100% navigateur, données en localStorage. */

// ---------- Plan comptable (repris du modèle Excel) ----------
const CHARGES = [
  ["60", "60 - Achats", [["c-prest", "Prestations de services"], ["c-mat", "Achats de matières et fournitures"], ["c-fourn", "Fournitures d'activités"]]],
  ["61", "61 - Services extérieurs", [["c-loc", "Locations"], ["c-ent", "Entretien et réparation"], ["c-assur", "Assurance"], ["c-doc", "Documentation"]]],
  ["62", "62 - Autres services extérieurs", [["c-hono", "Rémunérations des intermédiaires et honoraires"], ["c-pub", "Publicité, publication"], ["c-depl", "Déplacements, missions"], ["c-banq", "Services bancaires, autres"]]],
  ["63", "63 - Impôts et taxes", [["c-impr", "Impôts et taxes sur rémunération"], ["c-impa", "Autres impôts et taxes"]]],
  ["64", "64 - Charges de personnel", [["c-rem", "Rémunération des personnels"], ["c-soc", "Charges sociales"], ["c-aperso", "Autres charges de personnel"]]],
  ["65", "65 à 68 - Autres charges", [["c-65", "65 - Autres charges de gestion courante"], ["c-66", "66 - Charges financières"], ["c-67", "67 - Charges exceptionnelles"], ["c-68", "68 - Dotation aux amortissements"]]],
  ["86", "86 - Contributions volontaires en nature", [["c-860", "860 - Secours en nature"], ["c-861", "861 - Mise à disposition gratuite de biens et services"], ["c-862", "862 - Prestations"], ["c-864", "864 - Personnel bénévole"]]],
];
const PRODUITS = [
  ["70", "70 - Ventes, prestations de services", [["p-70", "Vente de produits, marchandises, prestations"]]],
  ["74", "74 - Subventions d'exploitation", [["p-etat", "État (ministères, préfecture, DEETS…)"], ["p-reg", "Région(s)"], ["p-dep", "Département(s)"], ["p-epci", "Intercommunalité(s) / EPCI"], ["p-com", "Commune(s)"], ["p-caf", "Organismes sociaux (CAF…)"], ["p-eu", "Fonds européens"], ["p-asp", "ASP (emplois aidés)"], ["p-pub", "Autres établissements publics"], ["p-asso", "L'association (fonds propres)"]]],
  ["75", "75 - Autres produits de gestion courante", [["p-75", "Cotisations, dons manuels, legs"], ["p-priv", "Aides privées / mécénat"]]],
  ["76", "76 à 78 - Financiers, exceptionnels, reprises", [["p-76", "76 - Produits financiers"], ["p-77", "77 - Produits exceptionnels"], ["p-78", "78 - Reprises sur amortissements et provisions"]]],
  ["87", "87 - Contributions volontaires", [["p-870", "870 - Bénévolat"], ["p-871", "871 - Prestations en nature"], ["p-875", "875 - Dons en nature"]]],
];
const catLabel = {};
[...CHARGES, ...PRODUITS].forEach(g => g[2].forEach(c => catLabel[c[0]] = c[1]));
const SUBV_CATS = PRODUITS[1][2];
const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

// ---------- État ----------
const KEY = "compta-asso-v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const thisYear = new Date().getFullYear();

// Connexion en ligne (Supabase). Si config.js est vide, l'app marche en mode local.
const CFG = window.COMPTA_CONFIG || {};
const SB = (CFG.supabaseUrl && CFG.supabaseKey && window.supabase) ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;
let USER = null, saveTimer = null, lastRemote = "", syncState = "";
const storageKey = () => KEY + (USER ? ":" + USER.id : "");

let S = load();
let UI = { page: "dash", year: S.years.includes(thisYear) ? thisYear : S.years[0], action: "all", q: "", fcat: "", ffin: "", fstat: "" };

function blank() {
  return { assoc: "Mon association", years: [thisYear], actions: [], financeurs: [], conventions: [], budget: [], depenses: [], recettes: [] };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(storageKey())); if (s && s.years) return Object.assign(blank(), s); } catch (e) {}
  return blank();
}
function save() {
  try { localStorage.setItem(storageKey(), JSON.stringify(S)); } catch (e) {}
  if (SB && USER) { setSync("saving"); clearTimeout(saveTimer); saveTimer = setTimeout(push, 700); }
}
async function push() {
  clearTimeout(saveTimer); saveTimer = null;
  const at = new Date().toISOString();
  const { error } = await SB.from("comptes").upsert({ user_id: USER.id, data: S, updated_at: at });
  if (error) { console.error(error); setSync("error"); } else { lastRemote = at; setSync("ok"); }
}
async function pull() {
  const { data, error } = await SB.from("comptes").select("data,updated_at").eq("user_id", USER.id).maybeSingle();
  if (error) { console.error(error); setSync("error"); return null; }
  return data;
}
function setSync(st) {
  syncState = st;
  const el = document.getElementById("syncState");
  if (el) el.textContent = { saving: "⏳ Enregistrement…", ok: "☁️ Enregistré en ligne", error: "⚠️ Erreur de sauvegarde" }[st] || "";
}
function applyRemote(row) {
  S = Object.assign(blank(), row.data); lastRemote = row.updated_at;
  if (!S.years.includes(UI.year)) UI.year = S.years.includes(thisYear) ? thisYear : S.years[0];
}

// ---------- Connexion ----------
function authScreen(msg) {
  document.getElementById("app").style.display = "none";
  let a = document.getElementById("auth");
  if (!a) { a = document.createElement("div"); a.id = "auth"; document.body.appendChild(a); }
  a.innerHTML = `<form class="card authbox" id="authForm"><div class="brand"><span class="logo">€</span><div><b>Compta Asso</b><small>Connexion à ton espace</small></div></div>
    <label>Adresse e-mail<input type="email" name="email" required autocomplete="email"></label>
    <label>Mot de passe<input type="password" name="password" minlength="6" autocomplete="current-password"></label>
    <p class="authmsg" id="authMsg">${esc(msg || "")}</p>
    <button class="btn" data-mode="in">Se connecter</button>
    <button class="btn sec" type="button" data-mode="up">Créer mon compte</button>
    <a href="#" id="forgot">Mot de passe oublié ?</a></form>`;
  const f = document.getElementById("authForm"), m = t => document.getElementById("authMsg").textContent = t;
  let mode = "in";
  f.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; if (mode === "up") f.requestSubmit(); });
  f.onsubmit = async ev => {
    ev.preventDefault(); const { email, password } = Object.fromEntries(new FormData(f));
    m("…");
    const r = mode === "up" ? await SB.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split("#")[0] } }) : await SB.auth.signInWithPassword({ email, password });
    if (r.error) return m(r.error.message === "Invalid login credentials" ? "E-mail ou mot de passe incorrect." : r.error.message);
    if (mode === "up" && !r.data.session) return m("Compte créé. Clique sur le lien reçu par e-mail pour le valider, puis connecte-toi.");
    mode = "in"; start(r.data.session);
  };
  document.getElementById("forgot").onclick = async e => {
    e.preventDefault(); const email = f.elements.email.value;
    if (!email) return m("Écris d'abord ton e-mail ci-dessus.");
    const r = await SB.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
    m(r.error ? r.error.message : "E-mail envoyé : clique sur le lien pour choisir un nouveau mot de passe.");
  };
}
async function start(session) {
  USER = session.user;
  const a = document.getElementById("auth"); if (a) a.remove();
  document.getElementById("app").style.display = "";
  const local = load(), row = await pull();
  if (row) applyRemote(row);
  else {
    // premier passage : on reprend les données locales éventuelles
    S = local; await push();
  }
  render();
}
async function logout() { if (saveTimer) await push(); await SB.auth.signOut(); USER = null; S = blank(); authScreen(); }
async function refreshIfNewer() {
  if (!SB || !USER || saveTimer) return;
  const row = await pull();
  if (row && row.updated_at > lastRemote) { applyRemote(row); render(); }
}
async function boot() {
  if (!SB) return render();
  SB.auth.onAuthStateChange(async ev => {
    if (ev === "PASSWORD_RECOVERY") {
      const pw = prompt("Choisis ton nouveau mot de passe (6 caractères minimum) :");
      if (pw) { const r = await SB.auth.updateUser({ password: pw }); alert(r.error ? r.error.message : "Mot de passe changé."); }
    }
  });
  const { data } = await SB.auth.getSession();
  if (data.session) start(data.session); else authScreen();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshIfNewer(); else if (saveTimer) push(); });
  addEventListener("pagehide", () => { if (saveTimer) push(); });
}

// ---------- Utilitaires ----------
const eur = n => (n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => { const n = parseFloat(String(v).replace(",", ".").replace(/\s/g, "")); return isNaN(n) ? 0 : n; };
const sum = a => a.reduce((t, x) => t + x, 0);
const byId = (arr, id) => arr.find(x => x.id === id);
const actionName = id => byId(S.actions, id)?.name || "—";
const finName = id => byId(S.financeurs, id)?.name || "—";
const actionColor = id => byId(S.actions, id)?.color || "#999";
const yearOf = d => +String(d || "").slice(0, 4);
const fdate = d => (d ? d.split("-").reverse().join("/") : "");
const inScope = (rec, year, action) => (rec.year ?? yearOf(rec.date)) === year && (action === "all" || rec.actionId === action);

// ---------- Calculs ----------
function budgetPrev(year, action, cat) {
  return sum(S.budget.filter(b => b.year === year && b.cat === cat && (action === "all" || b.actionId === action)).map(b => b.prev));
}
const depPaid = (year, action) => S.depenses.filter(d => inScope(d, year, action) && d.paid);
const depDue = (year, action) => S.depenses.filter(d => inScope(d, year, action) && !d.paid);
const recs = (year, action) => S.recettes.filter(r => inScope(r, year, action));
const convs = (year, action) => S.conventions.filter(c => c.year === year && (action === "all" || c.actionId === action));
function chargeReel(year, action, cat) { return sum(depPaid(year, action).filter(d => d.cat === cat).map(d => d.amount)); }
function produitReel(year, action, cat) { return sum(recs(year, action).filter(r => r.cat === cat).map(r => r.amount)); }
function produitConv(year, action, cat) {
  return sum(convs(year, action).filter(c => (byId(S.financeurs, c.financeurId)?.cat) === cat).map(c => c.amount));
}
function convStats(c) {
  const verse = sum(S.recettes.filter(r => r.convId === c.id).map(r => r.amount));
  const depense = sum(S.depenses.filter(d => d.convId === c.id && d.paid).map(d => d.amount));
  return { verse, depense, resteVerser: c.amount - verse, resteDep: c.amount - depense };
}
function totals(year, action) {
  const chPrev = sum(CHARGES.flatMap(g => g[2]).map(c => budgetPrev(year, action, c[0])));
  const chReel = sum(depPaid(year, action).map(d => d.amount));
  const prPrev = sum(PRODUITS.flatMap(g => g[2]).map(c => budgetPrev(year, action, c[0])));
  const prReel = sum(recs(year, action).map(r => r.amount));
  const conv = sum(convs(year, action).map(c => c.amount));
  const due = sum(depDue(year, action).map(d => d.amount));
  return { chPrev, chReel, prPrev, prReel, conv, due };
}

// ---------- Navigation ----------
const PAGES = [
  ["dash", "📊", "Tableau de bord"], ["budget", "🧮", "Budget prév. / réel"], ["dep", "🧾", "Factures payées"],
  ["rec", "💶", "Recettes"], ["conv", "📑", "Conventions"], ["fin", "🏛️", "Financeurs"], ["act", "🎯", "Actions"], ["set", "⚙️", "Paramètres"],
];
function nav() {
  document.getElementById("nav").innerHTML = PAGES.map(p => `<a data-p="${p[0]}" class="${UI.page === p[0] ? "on" : ""}"><span>${p[1]}</span>${p[2]}</a>`).join("");
  document.getElementById("assocName").textContent = S.assoc;
  const sf = document.getElementById("sideFoot");
  sf.innerHTML = SB && USER ? `<small>${esc(USER.email)}</small><small id="syncState"></small><button class="btn sm sec" id="logout">Se déconnecter</button>` : `<small>Mode local : données enregistrées dans ce navigateur seulement. Exporte une sauvegarde (Paramètres).</small>`;
  if (SB && USER) { document.getElementById("logout").onclick = logout; setSync(syncState); }
  document.getElementById("title").textContent = PAGES.find(p => p[0] === UI.page)[2];
  const fy = document.getElementById("fYear");
  fy.innerHTML = [...S.years].sort().map(y => `<option ${y === UI.year ? "selected" : ""}>${y}</option>`).join("");
  const fa = document.getElementById("fAction");
  fa.innerHTML = `<option value="all">Toutes les actions</option>` + S.actions.map(a => `<option value="${a.id}" ${a.id === UI.action ? "selected" : ""}>${esc(a.name)}</option>`).join("");
}
document.getElementById("nav").onclick = e => { const a = e.target.closest("a"); if (a) { UI.page = a.dataset.p; render(); } };
document.getElementById("fYear").onchange = e => { UI.year = +e.target.value; render(); };
document.getElementById("fAction").onchange = e => { UI.action = e.target.value; render(); };

function render() {
  if (UI.action !== "all" && !byId(S.actions, UI.action)) UI.action = "all";
  nav();
  const v = document.getElementById("view");
  v.innerHTML = VIEWS[UI.page]();
  if (UI.page === "budget") bindBudget();
  bindCommon();
}

// ---------- Vues ----------
const VIEWS = { dash, budget, dep, rec, conv, fin, act, set };

function bar(v, max, cls) {
  const p = Math.min(100, pct(v, max));
  const c = cls || (v > max && max > 0 ? "bad" : p >= 85 ? "warn" : "ok");
  return `<div class="bar ${c}"><i style="width:${p}%"></i></div>`;
}
function emptyHelp() {
  return `<div class="card empty"><h2>Bienvenue 👋</h2><p>Commence par créer tes <b>actions</b> (projets) et tes <b>financeurs</b>, puis saisis le budget, les conventions et les factures.</p>
  <p><button class="btn" data-go="act">Créer une action</button> <button class="btn sec" data-demo>Charger des données d'exemple</button></p></div>`;
}

// ---------- Graphiques (palette validée : bleu = recettes, orange = dépenses) ----------
const VIZ = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const DONUT = [VIZ[2], VIZ[3], VIZ[4], VIZ[5], VIZ[6], VIZ[1], VIZ[0]]; // évite bleu/orange réservés recettes/dépenses
const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const kfmt = n => Math.abs(n) >= 1000 ? (n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " k€" : Math.round(n).toLocaleString("fr-FR") + " €";
function niceMax(v) { if (v <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
function topRound(x, y, w, h, r) { // barre arrondie en haut, carrée à la base
  if (h <= 0) return ""; r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function monthlyChart(y, a) {
  const dep = Array(12).fill(0), rec = Array(12).fill(0);
  depPaid(y, a).forEach(d => dep[+d.date.slice(5, 7) - 1] += d.amount);
  recs(y, a).forEach(r => rec[+r.date.slice(5, 7) - 1] += r.amount);
  const max = niceMax(Math.max(...dep, ...rec)), W = 640, H = 250, L = 54, B = 26, T = 12, ph = H - B - T, sw = (W - L - 8) / 12;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="svgc" role="img" aria-label="Dépenses et recettes par mois">`;
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, yy = T + ph - ph * i / 4;
    s += `<line x1="${L}" x2="${W - 8}" y1="${yy}" y2="${yy}" class="gl"/><text x="${L - 8}" y="${yy + 4}" text-anchor="end" class="ax">${kfmt(v)}</text>`;
  }
  for (let m = 0; m < 12; m++) {
    const x0 = L + m * sw + (sw - 34) / 2, hr = ph * rec[m] / max, hd = ph * dep[m] / max;
    s += `<path d="${topRound(x0, T + ph - hr, 16, hr, 4)}" fill="${VIZ[0]}"/><path d="${topRound(x0 + 18, T + ph - hd, 16, hd, 4)}" fill="${VIZ[1]}"/>`;
    s += `<text x="${L + m * sw + sw / 2}" y="${H - 8}" text-anchor="middle" class="ax">${MOIS[m]}</text>`;
    const tip = `<b>${MOIS[m]} ${y}</b><br><span class="sw" style="background:${VIZ[0]}"></span>Recettes : ${eur(rec[m])}<br><span class="sw" style="background:${VIZ[1]}"></span>Dépenses : ${eur(dep[m])}`;
    s += `<rect x="${L + m * sw}" y="${T}" width="${sw}" height="${ph + B}" fill="transparent" data-tip='${esc(tip)}'/>`;
  }
  return s + `</svg>`;
}
function donutChart(y, a) {
  const parts = CHARGES.map((g, i) => ({ name: g[1], v: sum(g[2].map(c => chargeReel(y, a, c[0]))), c: DONUT[i % DONUT.length] })).filter(p => p.v > 0);
  const tot = sum(parts.map(p => p.v));
  if (!tot) return `<p class="mute">Aucune dépense payée pour l'instant.</p>`;
  const R = 62, C = 2 * Math.PI * R, gap = parts.length > 1 ? 2 : 0;
  let off = 0, svg = `<svg viewBox="0 0 170 170" class="donut" role="img" aria-label="Répartition des dépenses"><g transform="rotate(-90 85 85)">`;
  parts.forEach(p => {
    const len = p.v / tot * C;
    svg += `<circle cx="85" cy="85" r="${R}" fill="none" stroke="${p.c}" stroke-width="22" stroke-dasharray="${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}" stroke-dashoffset="${-off}" data-tip='${esc(`<b>${p.name}</b><br>${eur(p.v)} · ${pct(p.v, tot)} %`)}'/>`;
    off += len;
  });
  svg += `</g><text x="85" y="82" text-anchor="middle" class="dn1">${kfmt(tot)}</text><text x="85" y="100" text-anchor="middle" class="ax">dépensé</text></svg>`;
  return `<div class="donutwrap">${svg}<ul class="legend">${parts.map(p => `<li><span class="sw" style="background:${p.c}"></span><span>${esc(p.name.replace(/^\d+( à \d+)? - /, ""))}</span><b>${pct(p.v, tot)} %</b></li>`).join("")}</ul></div>`;
}
const legend2 = `<div class="legend row"><span><i class="sw" style="background:${VIZ[0]}"></i>Recettes encaissées</span><span><i class="sw" style="background:${VIZ[1]}"></i>Dépenses payées</span></div>`;

function dash() {
  if (!S.actions.length && !S.depenses.length) return emptyHelp();
  const { year: y, action: a } = UI, t = totals(y, a), cs = convs(y, a);
  const verse = sum(cs.map(c => convStats(c).verse)), resultat = t.prReel - t.chReel;
  const kpi = (ico, l, v, s, b, cls = "") => `<div class="card kpi"><div class="kico">${ico}</div><small>${l}</small><b class="${cls}">${v}</b>${b || ""}<span>${s}</span></div>`;
  let h = `<div class="hero"><div><h2>${esc(S.assoc)} · ${y}</h2><p class="mute">${a === "all" ? "Toutes les actions" : esc(actionName(a))}</p></div>
    <div><button class="btn sec" data-new="rec">+ Recette</button> <button class="btn" data-new="dep">+ Facture</button></div></div>
  <div class="grid g4">
    ${kpi("🧾", "Dépenses payées", eur(t.chReel), t.chPrev ? `${pct(t.chReel, t.chPrev)} % du budget de ${eur(t.chPrev)}` : "Pas de budget saisi", t.chPrev ? bar(t.chReel, t.chPrev) : "")}
    ${kpi("💶", "Recettes encaissées", eur(t.prReel), t.prPrev ? `${pct(t.prReel, t.prPrev)} % des ${eur(t.prPrev)} prévus` : "Pas de budget saisi", t.prPrev ? bar(t.prReel, t.prPrev, "ok") : "")}
    ${kpi("📈", "Résultat réel", eur(resultat), "recettes − dépenses payées", "", resultat < 0 ? "neg" : "pos")}
    ${kpi("📑", "Reste à encaisser", eur(Math.max(0, t.conv - verse)), `${eur(t.conv)} conventionnés · ${eur(verse)} versés`, t.conv ? bar(verse, t.conv, "ok") : "")}
  </div>
  ${t.due ? `<div class="hint">🕒 ${depDue(y, a).length} facture(s) à payer pour <b>${eur(t.due)}</b>.</div>` : ""}
  <div class="grid g32"><div class="card"><h2>Dépenses et recettes par mois</h2>${legend2}${monthlyChart(y, a)}</div>
  <div class="card"><h2>Où part l'argent ?</h2>${donutChart(y, a)}</div></div>`;

  // cartes par action
  const acts = S.actions.filter(x => a === "all" || x.id === a);
  h += `<h2 class="sec">Par action</h2><div class="grid g3">` + acts.map(x => {
    const p = sum(CHARGES.flatMap(g => g[2]).map(c => budgetPrev(y, x.id, c[0]))), r = sum(depPaid(y, x.id).map(d => d.amount));
    const cc = convs(y, x.id), acc = sum(cc.map(c => c.amount)), ver = sum(cc.map(c => convStats(c).verse));
    return `<div class="card acard" style="border-top:4px solid ${x.color}"><b>${esc(x.name)}</b>
      <div class="arow"><span>Dépensé</span><b>${eur(r)}</b></div>${p ? bar(r, p) : ""}<small class="mute">${p ? `${pct(r, p)} % de ${eur(p)} prévus` : "pas de budget saisi"}</small>
      <div class="arow"><span>Subventions versées</span><b>${eur(ver)}</b></div>${acc ? bar(ver, acc, "ok") : ""}<small class="mute">${acc ? `${pct(ver, acc)} % de ${eur(acc)} accordés` : "aucune convention"}</small></div>`;
  }).join("") + `</div>`;

  // conventions + dernières factures
  const fins = [...new Set(cs.map(c => c.financeurId))];
  h += `<div class="grid g2"><div class="card"><h2>Conventions par financeur</h2>` + (fins.map(fid => {
    const l = cs.filter(c => c.financeurId === fid), acc = sum(l.map(c => c.amount)), s = l.map(convStats), ver = sum(s.map(x => x.verse)), dp = sum(s.map(x => x.depense));
    return `<div class="frow"><div class="arow"><b>${esc(finName(fid))}</b><span>${eur(acc)}</span></div>${bar(dp, acc)}<small class="mute">Versé ${eur(ver)} · dépensé ${eur(dp)} · reste à dépenser ${eur(acc - dp)}</small></div>`;
  }).join("") || `<p class="mute">Aucune convention pour ${y}.</p>`) + `</div>`;
  const last = S.depenses.filter(d => inScope(d, y, a)).sort((p, q) => q.date.localeCompare(p.date)).slice(0, 6);
  h += `<div class="card"><h2>Dernières factures</h2>` + (last.map(d => `<div class="lrow"><div><b>${esc(d.fournisseur)}</b><small class="mute">${fdate(d.date)} · ${esc(actionName(d.actionId))}${d.files?.length ? " · 📎" + d.files.length : ""}</small></div><b>${eur(d.amount)}</b></div>`).join("") || `<p class="mute">Aucune facture.</p>`) + `</div></div>`;

  // alertes
  const al = [];
  S.actions.filter(x => a === "all" || x.id === a).forEach(x => {
    const p = sum(CHARGES.flatMap(g => g[2]).map(c => budgetPrev(y, x.id, c[0]))), r = sum(depPaid(y, x.id).map(d => d.amount));
    if (p && r > p) al.push(`⚠️ <b>${esc(x.name)}</b> : dépenses (${eur(r)}) au-dessus du budget (${eur(p)}).`);
  });
  cs.forEach(c => { const s = convStats(c); if (s.depense > c.amount) al.push(`⚠️ Convention <b>${esc(finName(c.financeurId))}</b> / ${esc(actionName(c.actionId))} : dépensé imputé supérieur au montant accordé.`); });
  const sansImput = depPaid(y, a).filter(d => !d.convId).length, sansPJ = depPaid(y, a).filter(d => !d.files?.length).length;
  if (sansImput) al.push(`ℹ️ ${sansImput} facture(s) payée(s) pas encore imputée(s) à une convention.`);
  if (sansPJ) al.push(`📎 ${sansPJ} facture(s) payée(s) sans justificatif joint.`);
  if (al.length) h += `<div class="card"><h2>À surveiller</h2>${al.map(x => `<p class="alr">${x}</p>`).join("")}</div>`;
  return h;
}

function budget() {
  UI.btab ??= "c"; UI.collapsed ??= {}; UI.hideEmpty ??= false;
  const { year: y, action: a } = UI, all = a === "all", side = UI.btab, groups = side === "c" ? CHARGES : PRODUITS, t = totals(y, a);
  const sc = (ico, l, v, sub, b) => `<div class="card kpi"><div class="kico">${ico}</div><small>${l}</small><b>${v}</b>${b || ""}<span>${sub}</span></div>`;
  let h = (all ? `<div class="hint">Pour saisir le prévisionnel, choisis une <b>action</b> en haut à droite. Ici : total de toutes les actions (lecture seule).</div>` : "")
    + `<div class="grid g4">
    ${sc("🧾", "Charges", eur(t.chReel), `réalisé sur ${eur(t.chPrev)} prévus`, t.chPrev ? bar(t.chReel, t.chPrev) : "")}
    ${sc("💶", "Produits", eur(t.prReel), `encaissé sur ${eur(t.prPrev)} prévus`, t.prPrev ? bar(t.prReel, t.prPrev, "ok") : "")}
    ${sc("⚖️", "Équilibre prévisionnel", `<span class="${t.prPrev - t.chPrev < 0 ? "neg" : "pos"}">${eur(t.prPrev - t.chPrev)}</span>`, t.prPrev === t.chPrev ? "budget équilibré" : t.prPrev > t.chPrev ? "produits > charges" : "charges > produits : budget déséquilibré")}
    ${sc("📈", "Résultat réel", `<span class="${t.prReel - t.chReel < 0 ? "neg" : "pos"}">${eur(t.prReel - t.chReel)}</span>`, "recettes − dépenses payées")}
  </div>
  <div class="bar-top"><div class="seg"><button data-btab="c" class="${side === "c" ? "on" : ""}">Charges</button><button data-btab="p" class="${side === "p" ? "on" : ""}">Produits</button></div>
    <label class="chk"><input type="checkbox" data-hideempty ${UI.hideEmpty ? "checked" : ""}> Masquer les postes vides</label><span class="sp"></span>
    <button class="btn sec sm" data-expand="1">Tout déplier</button><button class="btn sec sm" data-expand="0">Tout replier</button></div>`;
  const isP = side === "p", ncol = isP ? 6 : 5;
  h += `<div class="card"><div class="scroll"><table class="btable"><tr><th>Poste</th><th class="num">Prévisionnel</th>${isP ? `<th class="num">Conventionné</th>` : ""}<th class="num">${isP ? "Encaissé" : "Réalisé"}</th><th class="num">Reste</th><th style="width:150px">Réalisation</th></tr>`;
  let tp = 0, tr = 0;
  groups.forEach(g => {
    const rows = g[2].map(c => ({ c: c[0], p: budgetPrev(y, a, c[0]), r: isP ? produitReel(y, a, c[0]) : chargeReel(y, a, c[0]) }));
    const gp = sum(rows.map(x => x.p)), gr = sum(rows.map(x => x.r)); tp += gp; tr += gr;
    if (UI.hideEmpty && !gp && !gr) return;
    const open = !UI.collapsed[g[0] + side];
    h += `<tr class="grp" data-g="${g[0] + side}"><td><span class="chev">${open ? "▾" : "▸"}</span> ${esc(g[1])}</td><td class="num">${eur(gp)}</td>${isP ? "<td></td>" : ""}<td class="num">${eur(gr)}</td><td class="num ${!isP && gp - gr < 0 ? "neg" : ""}">${gp || gr ? eur(gp - gr) : ""}</td><td>${gp ? bar(gr, gp, isP ? "ok" : "") : ""}</td></tr>`;
    if (!open) return;
    rows.forEach(x => {
      if (UI.hideEmpty && !x.p && !x.r) return;
      const conv = isP && SUBV_CATS.some(c => c[0] === x.c) ? produitConv(y, a, x.c) : null, reste = x.p - x.r;
      h += `<tr><td class="ind">${esc(catLabel[x.c])}</td>
        <td class="num">${all ? eur(x.p) : `<input class="cell" data-b="${x.c}" value="${x.p || ""}" placeholder="0" inputmode="decimal" aria-label="Prévisionnel ${esc(catLabel[x.c])}">`}</td>
        ${isP ? `<td class="num mute">${conv === null ? "" : eur(conv)}</td>` : ""}
        <td class="num">${x.r ? eur(x.r) : '<span class="mute">—</span>'}</td>
        <td class="num ${reste < 0 && !isP ? "neg" : reste < 0 ? "pos" : "mute"}">${x.p || x.r ? eur(reste) : ""}</td>
        <td>${x.p ? `<div class="pc">${bar(x.r, x.p, isP ? "ok" : "")}<small>${pct(x.r, x.p)} %</small></div>` : x.r ? `<small class="neg">hors budget</small>` : ""}</td></tr>`;
    });
  });
  h += `<tr class="tot"><td>TOTAL ${isP ? "PRODUITS" : "CHARGES"}</td><td class="num">${eur(tp)}</td>${isP ? "<td></td>" : ""}<td class="num">${eur(tr)}</td><td class="num">${eur(tp - tr)}</td><td>${tp ? bar(tr, tp, isP ? "ok" : "") : ""}</td></tr></table></div></div>`;
  return h;
}
function bindBudget() {
  const v = document.getElementById("view");
  v.querySelectorAll("[data-btab]").forEach(b => b.onclick = () => { UI.btab = b.dataset.btab; render(); });
  const he = v.querySelector("[data-hideempty]"); if (he) he.onchange = () => { UI.hideEmpty = he.checked; render(); };
  v.querySelectorAll("[data-g]").forEach(r => r.onclick = () => { UI.collapsed[r.dataset.g] = !UI.collapsed[r.dataset.g]; render(); });
  v.querySelectorAll("[data-expand]").forEach(b => b.onclick = () => {
    UI.collapsed = {}; if (b.dataset.expand === "0") (UI.btab === "c" ? CHARGES : PRODUITS).forEach(g => UI.collapsed[g[0] + UI.btab] = true); render();
  });
  v.querySelectorAll("input[data-b]").forEach(i => {
    i.onfocus = () => i.select();
    i.onchange = () => {
      const { year, action } = UI, cat = i.dataset.b;
      let b = S.budget.find(x => x.year === year && x.actionId === action && x.cat === cat);
      if (!b) { b = { id: uid(), year, actionId: action, cat, prev: 0 }; S.budget.push(b); }
      b.prev = num(i.value); save();
      setTimeout(() => { // garde le curseur sur la case suivante après le recalcul
        const nxt = document.activeElement?.dataset?.b; render();
        if (nxt) { const n = document.querySelector(`input[data-b="${nxt}"]`); if (n) { n.focus(); n.select(); } }
      }, 0);
    };
  });
}

function dep() {
  const { year: y, action: a } = UI;
  let l = S.depenses.filter(d => inScope(d, y, a));
  if (UI.q) l = l.filter(d => (d.fournisseur + d.label + d.ref).toLowerCase().includes(UI.q.toLowerCase()));
  if (UI.fcat) l = l.filter(d => d.cat === UI.fcat);
  if (UI.ffin) l = l.filter(d => (byId(S.conventions, d.convId)?.financeurId) === UI.ffin);
  if (UI.fstat) l = l.filter(d => (d.paid ? "p" : "n") === UI.fstat);
  l.sort((x, z) => z.date.localeCompare(x.date));
  const paid = sum(l.filter(d => d.paid).map(d => d.amount)), due = sum(l.filter(d => !d.paid).map(d => d.amount));
  return `<div class="bar-top">
    <input placeholder="🔍 Rechercher fournisseur, libellé, n°…" data-q value="${esc(UI.q)}">
    <select data-fcat><option value="">Toutes catégories</option>${CHARGES.flatMap(g => g[2]).map(c => `<option value="${c[0]}" ${UI.fcat === c[0] ? "selected" : ""}>${esc(c[1])}</option>`).join("")}</select>
    <select data-ffin><option value="">Tous financeurs</option>${S.financeurs.map(f => `<option value="${f.id}" ${UI.ffin === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select>
    <select data-fstat><option value="">Payées + à payer</option><option value="p" ${UI.fstat === "p" ? "selected" : ""}>Payées</option><option value="n" ${UI.fstat === "n" ? "selected" : ""}>À payer</option></select>
    <span class="sp"></span><button class="btn sec" data-csv="dep">⬇ CSV</button><button class="btn" data-new="dep">+ Facture</button></div>
  <div class="card"><div class="scroll"><table><tr><th>Date</th><th>Payé à</th><th>N° facture</th><th>Libellé</th><th>Catégorie</th><th>Action</th><th>Financeur imputé</th><th class="num">Montant</th><th></th></tr>
  ${l.map(d => { const cv = byId(S.conventions, d.convId); return `<tr><td>${fdate(d.date)}</td><td><b>${esc(d.fournisseur)}</b></td><td>${esc(d.ref)}</td><td>${esc(d.label)} ${d.files?.length ? `<button class="btn sm sec" data-files="${d.id}" title="Justificatifs">📎 ${d.files.length}</button>` : ""}</td><td><small>${esc(catLabel[d.cat] || "")}</small></td>
    <td><span class="dot" style="background:${actionColor(d.actionId)}"></span>${esc(actionName(d.actionId))}</td><td>${cv ? esc(finName(cv.financeurId)) : '<span class="mute">—</span>'}</td>
    <td class="num"><b>${eur(d.amount)}</b> ${d.paid ? "" : '<span class="pill warn">à payer</span>'}</td>
    <td class="num"><button class="btn sm sec" data-edit="dep:${d.id}">✎</button> <button class="btn sm red" data-del="dep:${d.id}">🗑</button></td></tr>`; }).join("") || `<tr><td colspan="9" class="empty">Aucune facture.</td></tr>`}
  <tr class="tot"><td colspan="7">Total payé (${l.filter(d => d.paid).length}) ${due ? `· à payer ${eur(due)}` : ""}</td><td class="num">${eur(paid)}</td><td></td></tr></table></div></div>`;
}

function rec() {
  const { year: y, action: a } = UI;
  const l = recs(y, a).sort((x, z) => z.date.localeCompare(x.date));
  return `<div class="bar-top"><span class="sp"></span><button class="btn sec" data-csv="rec">⬇ CSV</button><button class="btn" data-new="rec">+ Recette / versement</button></div>
  <div class="card"><div class="scroll"><table><tr><th>Date</th><th>Origine</th><th>Libellé</th><th>Catégorie</th><th>Action</th><th>Convention</th><th class="num">Montant</th><th></th></tr>
  ${l.map(r => { const cv = byId(S.conventions, r.convId); return `<tr><td>${fdate(r.date)}</td><td><b>${esc(r.financeurId ? finName(r.financeurId) : r.origine || "")}</b></td><td>${esc(r.label)}</td><td><small>${esc(catLabel[r.cat] || "")}</small></td>
    <td><span class="dot" style="background:${actionColor(r.actionId)}"></span>${esc(actionName(r.actionId))}</td><td>${cv ? esc(cv.ref || "oui") : '<span class="mute">—</span>'}</td><td class="num"><b>${eur(r.amount)}</b></td>
    <td class="num"><button class="btn sm sec" data-edit="rec:${r.id}">✎</button> <button class="btn sm red" data-del="rec:${r.id}">🗑</button></td></tr>`; }).join("") || `<tr><td colspan="8" class="empty">Aucune recette.</td></tr>`}
  <tr class="tot"><td colspan="6">Total encaissé</td><td class="num">${eur(sum(l.map(r => r.amount)))}</td><td></td></tr></table></div></div>`;
}

function conv() {
  const { year: y, action: a } = UI;
  const l = convs(y, a).sort((p, q) => finName(p.financeurId).localeCompare(finName(q.financeurId)));
  return `<div class="hint">Les conventions changent chaque année : une ligne par financeur, action et année. Utilise « Reconduire » pour copier celles de ${y} vers ${y + 1} puis ajuster les montants.</div>
  <div class="bar-top"><span class="sp"></span><button class="btn sec" data-roll>↪ Reconduire ${y} → ${y + 1}</button><button class="btn" data-new="conv">+ Convention</button></div>
  <div class="card"><div class="scroll"><table><tr><th>Financeur</th><th>Action</th><th>Réf. / signée le</th><th>Période</th><th class="num">Accordé</th><th class="num">Versé</th><th class="num">Dépensé imputé</th><th class="num">Reste à dépenser</th><th>Conso.</th><th></th></tr>
  ${l.map(c => { const s = convStats(c); return `<tr><td><b>${esc(finName(c.financeurId))}</b></td><td><span class="dot" style="background:${actionColor(c.actionId)}"></span>${esc(actionName(c.actionId))}</td>
    <td>${esc(c.ref)}<br><small class="mute">${c.signedOn ? fdate(c.signedOn) : "non signée"}</small></td><td><small>${fdate(c.start)} → ${fdate(c.end)}</small></td>
    <td class="num"><b>${eur(c.amount)}</b></td><td class="num">${eur(s.verse)}</td><td class="num">${eur(s.depense)}</td><td class="num ${s.resteDep < 0 ? "neg" : ""}">${eur(s.resteDep)}</td><td style="min-width:90px">${bar(s.depense, c.amount)}</td>
    <td class="num"><button class="btn sm sec" data-edit="conv:${c.id}">✎</button> <button class="btn sm red" data-del="conv:${c.id}">🗑</button></td></tr>`; }).join("") || `<tr><td colspan="10" class="empty">Aucune convention pour ${y}.</td></tr>`}
  </table></div></div>`;
}

function fin() {
  return `<div class="bar-top"><span class="sp"></span><button class="btn" data-new="fin">+ Financeur</button></div><div class="card"><table><tr><th>Nom</th><th>Type de subvention</th><th>Conventions</th><th></th></tr>
  ${S.financeurs.map(f => `<tr><td><b>${esc(f.name)}</b></td><td>${esc(catLabel[f.cat] || "")}</td><td>${S.conventions.filter(c => c.financeurId === f.id).length}</td>
  <td class="num"><button class="btn sm sec" data-edit="fin:${f.id}">✎</button> <button class="btn sm red" data-del="fin:${f.id}">🗑</button></td></tr>`).join("") || `<tr><td colspan="4" class="empty">Aucun financeur.</td></tr>`}</table></div>`;
}
function act() {
  return `<div class="bar-top"><span class="sp"></span><button class="btn" data-new="act">+ Action</button></div><div class="card"><table><tr><th>Action / projet</th><th>Description</th><th></th></tr>
  ${S.actions.map(x => `<tr><td><span class="dot" style="background:${x.color}"></span><b>${esc(x.name)}</b></td><td>${esc(x.desc)}</td>
  <td class="num"><button class="btn sm sec" data-edit="act:${x.id}">✎</button> <button class="btn sm red" data-del="act:${x.id}">🗑</button></td></tr>`).join("") || `<tr><td colspan="3" class="empty">Aucune action.</td></tr>`}</table></div>`;
}
function set() {
  return `<div class="card"><h2>Association</h2><div class="fg"><label>Nom<input id="sName" value="${esc(S.assoc)}"></label>
  <label>Ajouter une année<input id="sYear" type="number" placeholder="${Math.max(...S.years) + 1}"></label></div><div class="fa"><button class="btn" data-saveset>Enregistrer</button></div></div>
  <div class="card"><h2>Sauvegarde</h2><p class="mute">${SB ? 'Tes données sont enregistrées en ligne dans ton compte.' : 'Mode local : les données restent dans ce navigateur.'} Exporte de temps en temps un fichier de sauvegarde et garde-le hors de GitHub.</p>
  <button class="btn" data-export>⬇ Exporter (JSON)</button> <label class="btn sec" style="display:inline-block">⬆ Importer<input type="file" accept=".json" data-import hidden></label>
  <button class="btn sec" data-demo>Charger l'exemple</button> <button class="btn red" data-reset>Tout effacer</button></div>`;
}

// ---------- Pièces jointes (Supabase Storage si connecté, sinon IndexedDB local) ----------
const BUCKET = "justificatifs", MAX_FILE = 10 * 1024 * 1024;
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("compta-files", 1); r.onupgradeneeded = () => r.result.createObjectStore("f"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function idbDo(mode, fn) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction("f", mode), q = fn(t.objectStore("f")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); }
const online = () => SB && USER;
async function fileUpload(file, depId) {
  const path = `${online() ? USER.id : "local"}/${depId}/${uid()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  if (online()) { const { error } = await SB.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined }); if (error) throw error; }
  else await idbDo("readwrite", st => st.put(file, path));
  return { id: uid(), name: file.name, size: file.size, type: file.type, path };
}
async function fileUrl(f) {
  if (online()) { const { data, error } = await SB.storage.from(BUCKET).createSignedUrl(f.path, 3600); if (error) throw error; return data.signedUrl; }
  const b = await idbDo("readonly", st => st.get(f.path)); if (!b) throw new Error("Fichier introuvable sur cet appareil."); return URL.createObjectURL(b);
}
async function fileRemove(f) {
  try { if (online()) await SB.storage.from(BUCKET).remove([f.path]); else await idbDo("readwrite", st => st.delete(f.path)); } catch (e) { console.error(e); }
}
const fsize = n => n > 1048576 ? (n / 1048576).toFixed(1) + " Mo" : Math.max(1, Math.round(n / 1024)) + " Ko";
function openFiles(id) {
  const d = byId(S.depenses, id), dlg = document.getElementById("dlg"), form = document.getElementById("dlgForm");
  form.innerHTML = `<h2>Justificatifs — ${esc(d.fournisseur)}</h2>${(d.files || []).map(f => `<div class="lrow"><div><b>${esc(f.name)}</b><small class="mute">${fsize(f.size)}</small></div><button type="button" class="btn sm" data-open="${f.id}">Ouvrir</button></div>`).join("") || '<p class="mute">Aucun fichier.</p>'}<div class="fa"><button type="button" class="btn sec" data-close>Fermer</button></div>`;
  form.querySelector("[data-close]").onclick = () => dlg.close();
  form.onsubmit = e => e.preventDefault();
  form.querySelectorAll("[data-open]").forEach(b => b.onclick = async () => {
    const w = window.open("", "_blank"); try { const u = await fileUrl(d.files.find(x => x.id === b.dataset.open)); if (w) w.location = u; else location.href = u; } catch (e) { if (w) w.close(); alert("Impossible d'ouvrir le fichier : " + e.message); }
  });
  dlg.showModal();
}

// ---------- Formulaires ----------
const opt = (arr, sel, lab = x => x.name) => arr.map(x => `<option value="${x.id}" ${x.id === sel ? "selected" : ""}>${esc(lab(x))}</option>`).join("");
const catOpt = (groups, sel) => groups.map(g => `<optgroup label="${esc(g[1])}">${g[2].map(c => `<option value="${c[0]}" ${c[0] === sel ? "selected" : ""}>${esc(c[1])}</option>`).join("")}</optgroup>`).join("");
const convOpt = (sel, year) => `<option value="">— non imputée —</option>` + S.conventions.filter(c => !year || c.year === year).map(c => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(finName(c.financeurId))} · ${esc(actionName(c.actionId))} · ${c.year}</option>`).join("");

const FORMS = {
  dep: o => ({ title: o ? "Modifier la facture" : "Nouvelle facture", html: `
    <label>Date de paiement<input type="date" name="date" required value="${o?.date || new Date().toISOString().slice(0, 10)}"></label>
    <label>Montant payé (€)<input name="amount" required inputmode="decimal" value="${o?.amount ?? ""}"></label>
    <label>Payé à (fournisseur)<input name="fournisseur" required value="${esc(o?.fournisseur)}"></label>
    <label>N° facture<input name="ref" value="${esc(o?.ref)}"></label>
    <label class="full">Libellé<input name="label" value="${esc(o?.label)}"></label>
    <label>Catégorie<select name="cat">${catOpt(CHARGES, o?.cat)}</select></label>
    <label>Action<select name="actionId">${opt(S.actions, o?.actionId || (UI.action !== "all" ? UI.action : ""))}</select></label>
    <label class="full">Imputée sur la convention<select name="convId">${convOpt(o?.convId)}</select></label>
    <label class="full">Justificatifs (facture PDF, photo…) — 10 Mo max par fichier<input type="file" name="files" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"></label>
    ${(o?.files || []).length ? `<div class="full filelist"><small class="mute">Fichiers déjà joints (coche pour retirer) :</small>${o.files.map(f => `<label class="chk"><input type="checkbox" name="rmfile" value="${f.id}"> ${esc(f.name)} <small class="mute">${fsize(f.size)}</small></label>`).join("")}</div>` : ""}
    <label>Statut<select name="paid"><option value="1" ${o?.paid !== false ? "selected" : ""}>Payée</option><option value="0" ${o?.paid === false ? "selected" : ""}>À payer</option></select></label>` }),
  rec: o => ({ title: o ? "Modifier la recette" : "Nouvelle recette / versement", html: `
    <label>Date<input type="date" name="date" required value="${o?.date || new Date().toISOString().slice(0, 10)}"></label>
    <label>Montant (€)<input name="amount" required inputmode="decimal" value="${o?.amount ?? ""}"></label>
    <label>Financeur<select name="financeurId"><option value="">— autre origine —</option>${opt(S.financeurs, o?.financeurId)}</select></label>
    <label>Ou origine libre<input name="origine" value="${esc(o?.origine)}" placeholder="adhérents, vente…"></label>
    <label class="full">Libellé<input name="label" value="${esc(o?.label)}" placeholder="Acompte 1, solde…"></label>
    <label>Catégorie<select name="cat">${catOpt(PRODUITS, o?.cat)}</select></label>
    <label>Action<select name="actionId">${opt(S.actions, o?.actionId || (UI.action !== "all" ? UI.action : ""))}</select></label>
    <label class="full">Convention<select name="convId">${convOpt(o?.convId)}</select></label>` }),
  conv: o => ({ title: o ? "Modifier la convention" : "Nouvelle convention", html: `
    <label>Financeur<select name="financeurId" required>${opt(S.financeurs, o?.financeurId)}</select></label>
    <label>Action<select name="actionId" required>${opt(S.actions, o?.actionId || (UI.action !== "all" ? UI.action : ""))}</select></label>
    <label>Année<select name="year">${S.years.map(y => `<option ${y === (o?.year || UI.year) ? "selected" : ""}>${y}</option>`).join("")}</select></label>
    <label>Montant accordé (€)<input name="amount" required inputmode="decimal" value="${o?.amount ?? ""}"></label>
    <label>Référence<input name="ref" value="${esc(o?.ref)}"></label>
    <label>Signée le<input type="date" name="signedOn" value="${o?.signedOn || ""}"></label>
    <label>Début<input type="date" name="start" value="${o?.start || ""}"></label>
    <label>Fin<input type="date" name="end" value="${o?.end || ""}"></label>`, }),
  fin: o => ({ title: o ? "Modifier le financeur" : "Nouveau financeur", html: `
    <label class="full">Nom<input name="name" required value="${esc(o?.name)}" placeholder="DEETS, Région, CAF, Commune…"></label>
    <label class="full">Type de subvention<select name="cat">${SUBV_CATS.map(c => `<option value="${c[0]}" ${c[0] === (o?.cat || "p-etat") ? "selected" : ""}>${esc(c[1])}</option>`).join("")}</select></label>` }),
  act: o => ({ title: o ? "Modifier l'action" : "Nouvelle action", html: `
    <label class="full">Nom<input name="name" required value="${esc(o?.name)}"></label>
    <label class="full">Description<input name="desc" value="${esc(o?.desc)}"></label>
    <label>Couleur<input type="color" name="color" value="${o?.color || COLORS[S.actions.length % COLORS.length]}"></label>` }),
};
const COLL = { dep: "depenses", rec: "recettes", conv: "conventions", fin: "financeurs", act: "actions" };

function openForm(kind, id) {
  if (["dep", "rec", "conv"].includes(kind) && !S.actions.length) return alert("Crée d'abord une action.");
  if (["conv"].includes(kind) && !S.financeurs.length) return alert("Crée d'abord un financeur.");
  const o = id ? byId(S[COLL[kind]], id) : null, f = FORMS[kind](o);
  const dlg = document.getElementById("dlg"), form = document.getElementById("dlgForm");
  form.innerHTML = `<h2>${f.title}</h2><div class="fg">${f.html}</div><div class="fa"><button type="button" class="btn sec" data-close>Annuler</button><button class="btn">Enregistrer</button></div>`;
  form.querySelector("[data-close]").onclick = () => dlg.close();
  const fs = form.elements.financeurId, cs = form.elements.cat;
  if (kind === "rec" && fs && cs) fs.onchange = () => { const fo = byId(S.financeurs, fs.value); if (fo) cs.value = fo.cat; };
  form.onsubmit = async ev => {
    ev.preventDefault();
    const fd = new FormData(form), d = Object.fromEntries(fd), picked = [...(form.elements.files?.files || [])], rm = fd.getAll("rmfile");
    delete d.files; delete d.rmfile;
    if ("amount" in d) d.amount = num(d.amount);
    if ("paid" in d) d.paid = d.paid === "1";
    if ("year" in d) d.year = +d.year;
    if (kind === "rec" && d.convId && !d.financeurId) d.financeurId = byId(S.conventions, d.convId)?.financeurId || "";
    let r = o; if (o) Object.assign(o, d); else { r = Object.assign({ id: uid() }, d); S[COLL[kind]].push(r); }
    const errs = [];
    if (kind === "dep") {
      const btn = form.querySelector("button:not(.sec)"); btn.disabled = true; btn.textContent = picked.length ? "Envoi…" : "…";
      r.files = r.files || [];
      for (const id of rm) { const f = r.files.find(x => x.id === id); if (f) { await fileRemove(f); r.files = r.files.filter(x => x.id !== id); } }
      for (const f of picked) {
        if (f.size > MAX_FILE) { errs.push(`${f.name} : trop gros (10 Mo max)`); continue; }
        try { r.files.push(await fileUpload(f, r.id)); } catch (e) { errs.push(`${f.name} : ${e.message}`); }
      }
    }
    save(); dlg.close(); render();
    if (errs.length) alert("Certains fichiers n'ont pas été envoyés :\n" + errs.join("\n") + (online() ? "\n\nAs-tu lancé le fichier supabase-fichiers.sql dans Supabase ?" : ""));
  };
  dlg.showModal();
}

// ---------- Actions communes ----------
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
}
function csv(kind) {
  const { year, action } = UI, q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let rows;
  if (kind === "dep") rows = [["Date", "Fournisseur", "N° facture", "Libellé", "Catégorie", "Action", "Financeur", "Montant", "Statut"], ...S.depenses.filter(d => inScope(d, year, action)).map(d => [d.date, d.fournisseur, d.ref, d.label, catLabel[d.cat], actionName(d.actionId), finName(byId(S.conventions, d.convId)?.financeurId), String(d.amount).replace(".", ","), d.paid ? "Payée" : "À payer"])];
  else rows = [["Date", "Origine", "Libellé", "Catégorie", "Action", "Montant"], ...recs(year, action).map(r => [r.date, r.financeurId ? finName(r.financeurId) : r.origine, r.label, catLabel[r.cat], actionName(r.actionId), String(r.amount).replace(".", ",")])];
  download(`${kind === "dep" ? "factures" : "recettes"}-${year}.csv`, "﻿" + rows.map(r => r.map(q).join(";")).join("\n"), "text/csv");
}

function bindCommon() {
  const v = document.getElementById("view");
  v.querySelectorAll("[data-new]").forEach(b => b.onclick = () => openForm(b.dataset.new));
  v.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { const [k, i] = b.dataset.edit.split(":"); openForm(k, i); });
  v.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const [k, i] = b.dataset.del.split(":");
    if (!confirm("Supprimer cet élément ?")) return;
    if (k === "dep") (byId(S.depenses, i)?.files || []).forEach(fileRemove);
    S[COLL[k]] = S[COLL[k]].filter(x => x.id !== i);
    if (k === "conv") { S.depenses.forEach(d => d.convId === i && (d.convId = "")); S.recettes.forEach(r => r.convId === i && (r.convId = "")); }
    save(); render();
  });
  v.querySelectorAll("[data-files]").forEach(b => b.onclick = () => openFiles(b.dataset.files));
  v.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { UI.page = b.dataset.go; render(); });
  v.querySelectorAll("[data-csv]").forEach(b => b.onclick = () => csv(b.dataset.csv));
  v.querySelectorAll("[data-demo]").forEach(b => b.onclick = () => { if (!S.depenses.length || confirm("Remplacer les données par l'exemple ?")) { S = demo(); save(); UI.year = S.years.includes(thisYear) ? thisYear : S.years[0]; UI.page = "dash"; render(); } });
  const q = v.querySelector("[data-q]"); if (q) q.oninput = () => { UI.q = q.value; const p = q.selectionStart; render(); const n = document.querySelector("[data-q]"); n.focus(); n.setSelectionRange(p, p); };
  [["fcat", "fcat"], ["ffin", "ffin"], ["fstat", "fstat"]].forEach(([a, k]) => { const s = v.querySelector(`[data-${a}]`); if (s) s.onchange = () => { UI[k] = s.value; render(); }; });
  const roll = v.querySelector("[data-roll]");
  if (roll) roll.onclick = () => {
    const n = UI.year + 1; if (!S.years.includes(n)) S.years.push(n);
    const src = S.conventions.filter(c => c.year === UI.year);
    if (!src.length || !confirm(`Copier ${src.length} convention(s) vers ${n} ?`)) return;
    src.forEach(c => S.conventions.push({ ...c, id: uid(), year: n, signedOn: "", ref: "", start: "", end: "" }));
    UI.year = n; save(); render();
  };
  const ss = v.querySelector("[data-saveset]");
  if (ss) ss.onclick = () => { S.assoc = document.getElementById("sName").value || S.assoc; const y = +document.getElementById("sYear").value; if (y > 1990 && !S.years.includes(y)) S.years.push(y); save(); render(); };
  const ex = v.querySelector("[data-export]"); if (ex) ex.onclick = () => download(`compta-asso-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S, null, 2), "application/json");
  const im = v.querySelector("[data-import]");
  if (im) im.onchange = () => { const r = new FileReader(); r.onload = () => { try { S = Object.assign(blank(), JSON.parse(r.result)); save(); UI.year = S.years.includes(thisYear) ? thisYear : S.years[0]; render(); } catch (e) { alert("Fichier invalide."); } }; r.readAsText(im.files[0]); };
  const rs = v.querySelector("[data-reset]"); if (rs) rs.onclick = () => { if (confirm("Tout effacer définitivement ?")) { S = blank(); save(); UI.year = S.years.includes(thisYear) ? thisYear : S.years[0]; render(); } };
}

// ---------- Données d'exemple ----------
function demo() {
  const y = thisYear, d = {
    assoc: "Association Exemple", years: [y - 1, y],
    actions: [{ id: "a1", name: "Projet 1 — Aide aux devoirs", desc: "Soutien scolaire", color: COLORS[0] }, { id: "a2", name: "Projet 2 — Ateliers parents", desc: "", color: COLORS[2] }, { id: "a3", name: "Projet 3 — Sorties familles", desc: "", color: COLORS[3] }],
    financeurs: [{ id: "f1", name: "Préfecture / DEETS", cat: "p-etat" }, { id: "f2", name: "Région", cat: "p-reg" }, { id: "f3", name: "CAF", cat: "p-caf" }, { id: "f4", name: "Commune", cat: "p-com" }],
    conventions: [], budget: [], depenses: [], recettes: [],
  };
  const cv = (id, year, f, a, amount, ref) => d.conventions.push({ id, year, financeurId: f, actionId: a, amount, ref, signedOn: `${year}-02-10`, start: `${year}-01-01`, end: `${year}-12-31` });
  cv("k1", y, "f1", "a1", 12000, "CONV-DEETS-" + y); cv("k2", y, "f2", "a1", 6000, "REG-" + y); cv("k3", y, "f3", "a2", 8000, "CAF-" + y); cv("k4", y, "f4", "a3", 3000, "COM-" + y); cv("k0", y - 1, "f1", "a1", 10000, "CONV-DEETS-" + (y - 1));
  const bp = (a, cat, prev) => d.budget.push({ id: uid(), year: y, actionId: a, cat, prev });
  bp("a1", "c-rem", 9000); bp("a1", "c-soc", 3000); bp("a1", "c-fourn", 2500); bp("a1", "c-loc", 3500); bp("a1", "p-etat", 12000); bp("a1", "p-reg", 6000);
  bp("a2", "c-hono", 4000); bp("a2", "c-fourn", 2000); bp("a2", "c-pub", 1000); bp("a2", "c-depl", 1000); bp("a2", "p-caf", 8000);
  bp("a3", "c-depl", 1800); bp("a3", "c-prest", 1200); bp("a3", "p-com", 3000);
  const dp = (date, f, ref, label, cat, a, conv, amount, paid = true) => d.depenses.push({ id: uid(), date, fournisseur: f, ref, label, cat, actionId: a, convId: conv, amount, paid });
  dp(`${y}-03-05`, "Papeterie Océan", "F-0312", "Fournitures ateliers", "c-fourn", "a1", "k1", 412.5);
  dp(`${y}-03-18`, "Mairie — location salle", "L-88", "Location salle mars", "c-loc", "a1", "k2", 875);
  dp(`${y}-04-02`, "Cabinet Moreau", "H-204", "Intervention formation parents", "c-hono", "a2", "k3", 1500);
  dp(`${y}-04-20`, "Transports Bleu", "T-515", "Bus sortie plage", "c-depl", "a3", "k4", 640);
  dp(`${y}-05-06`, "Imprimerie Express", "I-77", "Flyers", "c-pub", "a2", "k3", 230.4);
  dp(`${y}-05-30`, "Salaire animatrice (mai)", "", "Rémunération", "c-rem", "a1", "k1", 1850);
  dp(`${y}-06-10`, "Papeterie Océan", "F-0399", "Réassort fournitures", "c-fourn", "a2", "k3", 310, false);
  const rc = (date, f, label, cat, a, conv, amount) => d.recettes.push({ id: uid(), date, financeurId: f, origine: "", label, cat, actionId: a, convId: conv, amount });
  rc(`${y}-03-01`, "f1", "Acompte 50 %", "p-etat", "a1", "k1", 6000); rc(`${y}-04-15`, "f2", "Acompte", "p-reg", "a1", "k2", 3000); rc(`${y}-04-30`, "f3", "Acompte 70 %", "p-caf", "a2", "k3", 5600);
  return d;
}

// infobulle des graphiques
const tipEl = document.createElement("div"); tipEl.id = "tip"; document.body.appendChild(tipEl);
document.addEventListener("mousemove", e => {
  const t = e.target.closest && e.target.closest("[data-tip]");
  if (!t) { tipEl.style.display = "none"; return; }
  tipEl.innerHTML = t.dataset.tip; tipEl.style.display = "block";
  tipEl.style.left = Math.min(e.clientX + 14, innerWidth - tipEl.offsetWidth - 8) + "px"; tipEl.style.top = (e.clientY + 14) + "px";
});
boot();
