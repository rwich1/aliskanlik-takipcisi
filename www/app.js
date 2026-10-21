/* Alışkanlık Takipçisi — app logic. Same code runs as a PWA, inside Electron (Windows) and inside Capacitor (Android). */
(() => {
  "use strict";

  const APP_VERSION = "1.0.0";
  const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const MONTHS_SHORT = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const DOW = ["Pz","Pt","Sa","Ça","Pe","Cu","Ct"];
  const DOW_LONG = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];

  // Fixed ids so every device shows the same default list before anything is saved.
  const DEFAULT_HABITS = [
    { id: "meditasyon", name: "Meditasyon", icon: "🧘" },
    { id: "spor", name: "Spor", icon: "💪" },
    { id: "soguk-dus", name: "Soğuk duş", icon: "🚿" },
    { id: "oku", name: "10 sayfa oku", icon: "📖" },
    { id: "su", name: "2 litre su", icon: "💧" },
    { id: "ogren", name: "Yeni bir şey öğren", icon: "🧠" },
    { id: "sekersiz", name: "Şekersiz gün", icon: "🍫" },
    { id: "sosyal", name: "Sosyal medya ≤ 1 saat", icon: "📱" },
    { id: "planla", name: "Günü planla", icon: "🗒️" },
    { id: "uyku", name: "23:30'dan önce yat", icon: "🌙" },
  ];
  const PRESETS = [
    ...DEFAULT_HABITS,
    { id: "ertelemeden", name: "Alarmı ertelemeden kalk", icon: "⏰" },
    { id: "yuruyus", name: "8.000 adım yürü", icon: "🚶" },
    { id: "alkolsuz", name: "Alkolsüz gün", icon: "🥤" },
    { id: "gunluk", name: "Günlük yaz", icon: "✍️" },
    { id: "dil", name: "Dil çalış", icon: "🗣️" },
    { id: "is", name: "Odaklı çalışma (2 saat)", icon: "🎯" },
    { id: "vitamin", name: "Vitamin al", icon: "💊" },
    { id: "esneme", name: "10 dk esneme", icon: "🤸" },
    { id: "ekransiz", name: "Yatmadan 1 saat ekransız", icon: "📵" },
    { id: "tasarruf", name: "Gereksiz harcama yok", icon: "💰" },
  ];
  const DOC_KEY = /^(settings|m-\d{4}-\d{2})$/;
  const PREF = { theme: "habit-pref:theme", held: "habit-pref:held", migrated: "habit-pref:migrated" };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o ?? {}));
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const deepMerge = window.HabitStore.deepMerge;
  const isNative = () => !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  const pad2 = (n) => String(n).padStart(2, "0");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Habit ids become Firestore map keys: keep them plain and never "__x__" (reserved).
  const validId = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id) && !/^__.*__$/.test(id);
  const prefGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const prefSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };
  const firstGrapheme = (v) => {
    v = String(v || "").trim();
    if (!v) return "";
    try { if (window.Intl && Intl.Segmenter) return [...new Intl.Segmenter("tr", { granularity: "grapheme" }).segment(v)][0].segment; } catch {}
    return Array.from(v).slice(0, 2).join("");
  };

  let now = new Date();
  const state = {
    y: now.getFullYear(), m: now.getMonth(),
    habits: defaultHabits(), habitsReady: false, settingsShape: "none", // none | legacy | map
    server: {},
    pending: null, inflight: null, // {"m-YYYY-MM": patch} — keyed by month so navigation never mixes them up
    focusDay: now.getDate(),
  };
  const account = {
    configured: !!window.FIREBASE_CONFIG,
    status: window.FIREBASE_CONFIG ? "loading" : "off", // off | loading | failed | signedout | signedin
    user: null, busy: false, msg: null, emailDraft: "",
  };
  let store = null, unwatchMonth = null, unwatchSettings = null, flushTimer = null, flushing = false;
  let closeSheet = null;
  let migrating = false, closing = false;

  function defaultHabits() { return DEFAULT_HABITS.map((h, i) => ({ ...h, order: (i + 1) * 10 })); }
  const monthKey = (y, m) => `m-${y}-${pad2(m + 1)}`;
  const curKey = () => monthKey(state.y, state.m);
  const dim = () => new Date(state.y, state.m + 1, 0).getDate();
  const isThisMonth = () => state.y === now.getFullYear() && state.m === now.getMonth();
  const isPastMonth = () => state.y < now.getFullYear() || (state.y === now.getFullYear() && state.m < now.getMonth());
  const elapsedDays = () => (isThisMonth() ? now.getDate() : isPastMonth() ? dim() : 0);
  const dow = (d) => new Date(state.y, state.m, d).getDay();
  const view = () => deepMerge(deepMerge(state.server, (state.inflight || {})[curKey()]), (state.pending || {})[curKey()]);

  function stats() {
    const v = view(), n = dim(), hs = state.habits;
    const checks = isObj(v.checks) ? v.checks : {};
    const perHabit = hs.map((h) => {
      const c = checks[h.id] || {};
      let done = 0;
      for (let d = 1; d <= n; d++) if (c[d] === true) done++;
      return { h, done };
    });
    const perDay = [];
    for (let d = 1; d <= n; d++) {
      let c = 0;
      for (const h of hs) if ((checks[h.id] || {})[d] === true) c++;
      perDay.push(c);
    }
    const done = perHabit.reduce((s, x) => s + x.done, 0);
    const goal = hs.length * n;
    const weeks = [];
    for (let w = 0; w * 7 < n; w++) {
      const a = w * 7 + 1, b = Math.min(n, a + 6);
      let c = 0;
      for (let d = a; d <= b; d++) c += perDay[d - 1];
      weeks.push({ a, b, done: c, goal: hs.length * (b - a + 1) });
    }
    return { n, perHabit, perDay, done, goal, weeks, mood: isObj(v.mood) ? v.mood : {}, motiv: isObj(v.motivation) ? v.motivation : {}, checks };
  }

  /* ---------------- habit list (settings doc) ----------------
   * Stored as a map {habits: {<id>: {name, icon, order, removed}}} so two devices editing different habits merge cleanly.
   * Older data (and backups) may hold an array; it is read as-is and replaced by the map on the next edit. */
  function parseSettings(data) {
    const hs = data && data.habits;
    if (Array.isArray(hs)) {
      return { shape: "legacy", list: hs.filter((h) => h && validId(h.id) && typeof h.name === "string" && h.name.trim())
        .map((h, i) => ({ id: h.id, name: h.name.trim(), icon: typeof h.icon === "string" ? h.icon : "", order: (i + 1) * 10 })) };
    }
    if (isObj(hs)) {
      const list = Object.keys(hs).filter((id) => validId(id) && isObj(hs[id]) && !hs[id].removed && typeof hs[id].name === "string" && hs[id].name.trim())
        .map((id) => ({ id, name: hs[id].name.trim(), icon: typeof hs[id].icon === "string" ? hs[id].icon : "", order: Number(hs[id].order) || 0 }))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "tr"));
      return { shape: "map", list };
    }
    return { shape: "none", list: defaultHabits() };
  }
  const habitFields = (h) => ({ name: h.name, icon: h.icon || "", order: h.order, removed: false });
  // changes: {<id>: partial fields or {removed:true}}. The first edit of a legacy/absent list writes the whole map.
  function saveHabits(changes) {
    if (!store) return;
    const target = store;
    let p;
    if (state.settingsShape !== "map") {
      const habits = {};
      for (const h of state.habits) habits[h.id] = habitFields(h);
      for (const id of Object.keys(changes)) if (changes[id].removed) habits[id] = { removed: true };
      p = target.patch("settings", { habits });
      state.settingsShape = "map";
    } else {
      p = target.patch("settings", { habits: changes });
    }
    if (target.kind === "local") setSync("saving");
    p.then(
      () => { if (target === store && target.kind === "local") setSync("saved"); },
      (e) => { if (target === store) setSync("error", fbErrorText(e)); },
    );
  }
  const nextOrder = () => state.habits.reduce((m, h) => Math.max(m, h.order || 0), 0) + 10;
  function habitsLocked() {
    if (account.status === "loading" || !state.habitsReady) { toast("Alışkanlık listen yükleniyor, birazdan tekrar dene"); return true; }
    return false;
  }

  /* ---------------- sync status ---------------- */
  function setSync(s, text) {
    const el = $("sync");
    if (store && store.kind === "cloud" && !navigator.onLine && (s === "saving" || s === "saved" || s === "cloud")) s = "offline";
    el.dataset.s = s;
    const t = text || {
      cloud: "Hesabına kayıtlı · cihazlar eşit",
      saving: "Kaydediliyor…",
      saved: store && store.kind === "cloud" ? "Kaydedildi · tüm cihazlarda güncel" : "Kaydedildi · bu cihazda",
      offline: "Çevrimdışı · bağlanınca eşitlenecek",
      local: account.configured ? "Bu cihazda kayıtlı · eşitleme için giriş yap" : "Bu cihazda kayıtlı",
      loading: "Eşitleme başlatılıyor…",
      error: "Kaydedilemedi",
    }[s];
    el.querySelector("span").textContent = t;
    el.title = "Hesap ve eşitleme ayarları";
  }
  function baseSync() {
    if (account.status === "loading") return setSync("loading");
    if (store && store.kind === "cloud") return setSync(store.unsynced ? "saving" : "cloud");
    setSync("local");
  }
  function fbErrorText(e) {
    const code = (e && e.code) || "";
    if (code.includes("permission-denied")) return "Firestore kuralları erişime izin vermiyor (KURULUM.md, Firestore adımı)";
    if (code.includes("unavailable")) return "Sunucuya ulaşılamıyor · bağlanınca tekrar denenecek";
    if (code.includes("resource-exhausted")) return "Firebase ücretsiz kotası doldu";
    if (code.includes("invalid-argument")) return "Geçersiz kayıt atlandı";
    return "Kaydedilemedi" + (code ? ` (${code})` : "");
  }
  addEventListener("online", () => baseSync());
  addEventListener("offline", () => { if (store && store.kind === "cloud") setSync("offline"); });

  /* ---------------- writes ---------------- */
  function queuePatch(p) {
    state.pending = deepMerge(state.pending, { [curKey()]: p });
    if (account.status === "loading") prefSet(PREF.held, JSON.stringify(state.pending));
    renderAll();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 350);
  }
  async function flush() {
    if (flushing || !state.pending || !store) return;
    // While sign-in is being restored, hold edits (kept in localStorage too) so they land in the account, not on the device.
    if (account.status === "loading" || migrating) {
      prefSet(PREF.held, JSON.stringify(state.pending));
      clearTimeout(flushTimer); flushTimer = setTimeout(flush, 500);
      return;
    }
    flushing = true;
    const target = store, batch = state.pending;
    state.inflight = batch; state.pending = null;
    if (target.kind === "local") setSync("saving");
    let failed = null, lastErr = null;
    for (const k of Object.keys(batch)) {
      try {
        await target.patch(k, batch[k]);
        // Keep the write visible until the store's own snapshot replaces it.
        if (target === store && k === curKey()) state.server = deepMerge(state.server, batch[k]);
      } catch (e) {
        lastErr = e;
        // A rejected argument can never succeed; dropping it keeps later edits flowing.
        if (!(e && String(e.code || "").includes("invalid-argument"))) (failed ||= {})[k] = batch[k];
      }
    }
    state.inflight = null; flushing = false;
    if (failed) state.pending = deepMerge(failed, state.pending);
    if (!state.pending && !closing) prefSet(PREF.held, null);
    if (lastErr) setSync("error", fbErrorText(lastErr));
    else if (target.kind === "local" && target === store) setSync("saved");
    if (state.pending && !failed) flushTimer = setTimeout(flush, 350);
    renderAll();
  }
  async function settle() {
    clearTimeout(flushTimer);
    while (flushing) await sleep(30);
    if (state.pending) await flush();
  }

  /* ---------------- store switching ---------------- */
  function watchMonth() {
    if (unwatchMonth) unwatchMonth();
    unwatchMonth = null;
    state.server = {};
    if (!store) return;
    const key = curKey(), target = store;
    unwatchMonth = target.watch(key, (data) => {
      if (key !== curKey() || target !== store) return;
      state.server = isObj(data) ? clone(data) : {};
      renderAll();
    });
  }
  function useStore(next) {
    if (unwatchSettings) unwatchSettings();
    if (unwatchMonth) unwatchMonth();
    unwatchSettings = unwatchMonth = null;
    if (store && store !== next && store.dispose) store.dispose();
    store = next;
    state.habits = defaultHabits(); state.habitsReady = false; state.settingsShape = "none";
    state.server = {}; state.pending = null; state.inflight = null;
    const target = store;
    unwatchSettings = target.watch("settings", (data, meta) => {
      if (target !== store) return;
      // "No list" seen only in the offline cache is not proof: wait for the server (it arrives as a metadata change).
      if (data == null && meta && meta.fromCache) return;
      const parsed = parseSettings(data);
      state.habits = parsed.list; state.settingsShape = parsed.shape; state.habitsReady = true;
      drawEditor();
      renderAll();
    }, { includeMetadataChanges: true });
    watchMonth();
    baseSync();
    renderAll();
  }
  function makeCloud(uid) {
    let cloud = null;
    cloud = window.HabitStore.createCloud(uid, {
      onWrite: () => { if (store === cloud) setSync("saving"); },
      onSynced: () => { if (store === cloud) setSync("saved"); },
      onError: (e) => { if (store === cloud) setSync("error", fbErrorText(e)); },
      onRecovered: () => { if (store === cloud && $("sync").dataset.s === "error" && !state.pending) baseSync(); },
    });
    return cloud;
  }

  // First sign-in: copy what this device recorded before signing in into an empty account, once.
  async function migrateLocal(cloud) {
    const uid = cloud.uid;
    const local = window.HabitStore.createLocal();
    const raw = (() => { const o = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("habit:")) o[k.slice(6)] = JSON.parse(localStorage.getItem(k)); } } catch {} return o; })();
    local.dispose();
    // F10: copy only what the app understands (older versions could store reserved keys)
    const docs = {};
    for (const k of Object.keys(raw)) { if (!DOC_KEY.test(k) || !isObj(raw[k])) continue; const c = k === "settings" ? cleanSettings(raw[k]) : cleanMonth(raw[k]); if (c && Object.keys(c).length) docs[k] = c; }
    const keys = Object.keys(docs);
    if (!keys.length) return;
    const done = prefGet(PREF.migrated);
    if (done) return; // this device's data already went to an account (maybe another one) — never copy it twice
    const { FB, db } = window.HabitStore.firebase;
    let snap;
    migrating = true; // F2: no cloud write may be acknowledged before the emptiness check has its answer
    try { snap = await FB.getDocsFromServer(FB.collection(db, "users", uid, "data")); }
    catch { return; } // offline: try again on the next start
    finally { migrating = false; }
    if (store !== cloud) return;
    // getDocsFromServer also returns this client's own unsent writes; only acknowledged docs prove the account has data.
    const serverDocs = snap.docs.filter((d) => !d.metadata.hasPendingWrites);
    prefSet(PREF.migrated, uid);
    if (serverDocs.length) {
      toast("Bu cihazdaki eski kayıtlar hesabına aktarılmadı. İstersen Ayarlar › Yedek ile birleştirebilirsin.");
      return;
    }
    try {
      for (const k of keys) {
        if (k === "settings") { if (!snap.docs.some((d) => d.id === "settings")) await cloud.set(k, docs[k]); }
        else { const cur = snap.docs.find((d) => d.id === k); await cloud.patch(k, cur ? deepMerge(docs[k], cur.data()) : docs[k]); } // F9: edits made meanwhile win
      }
      toast("Bu cihazdaki kayıtlar hesabına aktarıldı");
    } catch (e) {
      prefSet(PREF.migrated, null);
      setSync("error", fbErrorText(e));
    }
  }

  async function startCloud() {
    if (!account.configured) return;
    account.status = "loading"; baseSync();
    try {
      await window.HabitStore.initFirebase(window.FIREBASE_CONFIG);
    } catch (e) {
      account.status = "failed";
      account.msg = { ok: false, text: "Eşitleme servisi yüklenemedi. firebase-config.js dosyasını ve internet bağlantını kontrol et." };
      baseSync(); drawSettings();
      if (state.pending) flush();
      return;
    }
    const { FB, auth } = window.HabitStore.firebase;
    FB.onAuthStateChanged(auth, async (user) => {
      const prev = account.status;
      let carry = null;
      if (prev === "signedin") await settle();
      else {
        clearTimeout(flushTimer);
        while (flushing) await sleep(30);
        carry = state.pending;
      }
      if (user) {
        account.status = "signedin";
        account.user = { email: user.email || "", uid: user.uid };
        const cloud = makeCloud(user.uid);
        useStore(cloud);
        migrateLocal(cloud);
      } else {
        account.status = "signedout";
        account.user = null;
        if (!store || store.kind !== "local") useStore(window.HabitStore.createLocal());
        else baseSync();
      }
      if (carry) {
        state.pending = deepMerge(state.pending, carry);
        renderAll();
        flush();
      } else prefSet(PREF.held, null);
      drawSettings();
    });
  }

  /* ---------------- actions ---------------- */
  function toggle(hid, d) {
    const cur = ((view().checks || {})[hid] || {})[d] === true;
    queuePatch({ checks: { [hid]: { [d]: !cur } } });
  }
  function setScore(kind, d, val) { queuePatch({ [kind]: { [d]: val } }); }
  async function goMonth(delta) {
    const fa = document.activeElement;
    if (fa && fa.matches && fa.matches("#grid input[data-k]")) fa.blur(); // F7: 'change' fires now, into the month it belongs to
    await settle();
    const dt = new Date(state.y, state.m + delta, 1);
    state.y = dt.getFullYear(); state.m = dt.getMonth();
    state.focusDay = isThisMonth() ? now.getDate() : 1;
    watchMonth();
    renderAll();
    scrollGridToFocus();
  }
  function goToday() {
    if (isThisMonth()) { state.focusDay = now.getDate(); renderAll(); scrollGridToFocus(); return; }
    goMonth((now.getFullYear() - state.y) * 12 + (now.getMonth() - state.m));
  }
  function scrollGridToFocus() {
    const wrap = $("gridwrap");
    const th = wrap.querySelector(`thead tr:last-child th[data-day="${isThisMonth() ? now.getDate() : 1}"]`);
    const name = wrap.querySelector("thead .hcol");
    if (!th || !name) return;
    wrap.scrollLeft = Math.max(0, th.offsetLeft - name.offsetWidth - 3 * th.offsetWidth);
  }
  // Keep "today" right when the app stays open past midnight (desktop window, phone in background).
  function refreshNow() {
    const n = new Date();
    if (n.toDateString() === now.toDateString()) { now = n; return; }
    const wasCurrent = isThisMonth();
    const prev = now;
    now = n;
    if (wasCurrent && (n.getMonth() !== prev.getMonth() || n.getFullYear() !== prev.getFullYear())) { goMonth((n.getFullYear() - state.y) * 12 + (n.getMonth() - state.m)); return; }
    if (wasCurrent && state.focusDay === prev.getDate()) state.focusDay = n.getDate();
    renderAll();
  }
  setInterval(refreshNow, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (state.pending) flush(); }
    else refreshNow();
  });
  addEventListener("pagehide", () => {
    const all = deepMerge(state.inflight || {}, state.pending || {});
    if (state.pending) flush();
    if (store && store.kind === "cloud" && Object.keys(all).length) { closing = true; prefSet(PREF.held, JSON.stringify(all)); }
  });
  addEventListener("pageshow", () => { closing = false; });

  /* ---------------- tooltip ---------------- */
  const tip = $("tip");
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.hidden = false;
    tip.style.left = Math.min(innerWidth - 100, Math.max(100, x)) + "px";
    tip.style.top = Math.max(y, tip.offsetHeight + 14) + "px";
  }
  function hideTip() { tip.hidden = true; }
  const tipFor = (t) => { const r = t.getBoundingClientRect(); showTip(t.dataset.tip, r.left + r.width / 2, Math.max(44, r.top)); };
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (t) tipFor(t);
    else if (!e.target.closest || !e.target.closest("#moodChart")) hideTip();
  });
  // Touch: a tap shows the bar's tooltip; tapping elsewhere hides it.
  document.addEventListener("pointerdown", (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (t) { tipFor(t); return; }
    if (!e.target.closest || !e.target.closest("#moodChart")) hideTip();
  });
  addEventListener("scroll", hideTip, { passive: true });

  /* ---------------- renderers ---------------- */
  const SVGNS = 'xmlns="http://www.w3.org/2000/svg"';
  function barPath(x, y, w, h, r) {
    if (h <= 0) return "";
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  const size = (el) => ({ W: Math.max(120, el.clientWidth - 16), H: Math.max(120, el.clientHeight - 10) });
  const showXLabel = (d, step, isT, nearT) => !nearT && (isT || d % step === 0 || (d === 1 && step !== 2));

  function renderDaily(s) {
    const el = $("dailyChart");
    const { W, H } = size(el);
    const L = 34, R = 4, T = 8, B = 22, pw = W - L - R, ph = H - T - B;
    const n = s.n, band = pw / n, bw = Math.max(3, Math.min(18, band * 0.62));
    const hc = state.habits.length || 1;
    let g = "";
    for (const p of [0, 25, 50, 75, 100]) {
      const y = T + ph - (p / 100) * ph;
      g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"${p ? ' stroke-dasharray="2 3"' : ""}/>`;
      g += `<text x="${L - 6}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="var(--font-data)">${p}%</text>`;
    }
    const step = band < 14 ? 5 : band < 22 ? 2 : 1;
    let bars = "", labels = "", hits = "";
    for (let d = 1; d <= n; d++) {
      const v = s.perDay[d - 1], pct = (v / hc) * 100;
      const cx = L + band * (d - 0.5), h = (pct / 100) * ph;
      const isT = isThisMonth() && d === now.getDate();
      bars += `<path d="${barPath(cx - bw / 2, T + ph - h, bw, h, 3)}" fill="${isT ? "var(--mood)" : "var(--bar)"}"/>`;
      const nearT = isThisMonth() && !isT && Math.abs(d - now.getDate()) <= (step > 1 ? 2 : 0);
      if (showXLabel(d, step, isT, nearT)) labels += `<text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="10" fill="${isT ? "var(--ink)" : "var(--muted)"}" font-weight="${isT ? 600 : 400}" font-family="var(--font-data)">${d}</text>`;
      hits += `<rect x="${L + band * (d - 1)}" y="${T}" width="${band}" height="${ph + B}" fill="transparent" data-tip="<b>${d} ${MONTHS_SHORT[state.m]} ${DOW[dow(d)]}</b><br>${v}/${state.habits.length} · %${Math.round(pct)}"/>`;
    }
    el.innerHTML = `<svg ${SVGNS} viewBox="0 0 ${W} ${H}" role="img" aria-label="Günlük ilerleme grafiği">${g}${bars}${labels}${hits}</svg>` +
      (s.done === 0 ? `<div class="empty">Kutucukları işaretledikçe burası dolar</div>` : "");
  }

  function renderWeekly(s) {
    const el = $("weeklyChart");
    const { W, H } = size(el);
    const L = 34, R = 4, T = 16, B = 22, pw = W - L - R, ph = H - T - B;
    const k = s.weeks.length, band = pw / k, bw = Math.min(44, band * 0.58);
    let g = "";
    for (const p of [0, 50, 100]) {
      const y = T + ph - (p / 100) * ph;
      g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--line)"${p ? ' stroke-dasharray="2 3"' : ""}/>`;
      g += `<text x="${L - 6}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="var(--font-data)">${p}%</text>`;
    }
    const short = band < 52, tight = band < 36;
    let bars = "";
    s.weeks.forEach((w, i) => {
      const pct = w.goal ? (w.done / w.goal) * 100 : 0, h = (pct / 100) * ph, cx = L + band * (i + 0.5);
      bars += `<path d="${barPath(cx - bw / 2, T + ph - h, bw, h, 4)}" fill="var(--bar)"/>`;
      if (w.done) bars += `<text x="${cx}" y="${T + ph - h - 5}" text-anchor="middle" font-size="${tight ? 9.5 : 10.5}" fill="var(--ink-2)" font-family="var(--font-data)">${tight ? "" : "%"}${Math.round(pct)}</text>`;
      bars += `<text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${i + 1}.${short ? " hf" : " hafta"}</text>`;
      bars += `<rect x="${L + band * i}" y="${T}" width="${band}" height="${ph + B}" fill="transparent" data-tip="<b>${i + 1}. hafta</b> (${w.a}–${w.b} ${MONTHS_SHORT[state.m]})<br>${w.done}/${w.goal} · %${Math.round(pct)}"/>`;
    });
    el.innerHTML = `<svg ${SVGNS} viewBox="0 0 ${W} ${H}" role="img" aria-label="Haftalık ilerleme grafiği">${g}${bars}</svg>`;
  }

  function renderKpi(s) {
    $("kGoal").textContent = s.goal;
    $("kDone").textContent = s.done;
    $("kLeft").textContent = Math.max(0, s.goal - s.done);
    const el = $("donutChart");
    const sz = Math.max(110, Math.min(160, el.clientWidth - 20, el.clientHeight - 20 || 160));
    const r = sz / 2 - 12, c = 2 * Math.PI * r, pct = s.goal ? s.done / s.goal : 0;
    el.innerHTML = `<svg ${SVGNS} viewBox="0 0 ${sz} ${sz}" style="width:${sz}px;height:${sz}px" role="img" aria-label="Aylık tamamlanma %${Math.round(pct * 100)}">
      <circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="18"/>
      <circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="var(--bar)" stroke-width="18" stroke-dasharray="${(c * pct).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 ${sz / 2} ${sz / 2})"/>
      <text x="50%" y="${sz / 2 + 2}" text-anchor="middle" font-family="var(--font-data)" font-size="24" fill="var(--ink)">%${Math.round(pct * 100)}</text>
      <text x="50%" y="${sz / 2 + 20}" text-anchor="middle" font-size="11" fill="var(--muted)">aylık hedef</text></svg>`;
    const ed = elapsedDays(), sofar = ed * state.habits.length;
    let doneSoFar = 0;
    for (let d = 1; d <= ed; d++) doneSoFar += s.perDay[d - 1];
    $("donutNote").textContent = !state.habits.length ? "Listende alışkanlık yok" : sofar ? `Geçen ${ed} güne göre %${Math.round((doneSoFar / sofar) * 100)}` : "Bu ay henüz başlamadı";
  }

  // The grid is rebuilt only when its structure changes (month, today, habit list). Data changes patch the existing
  // nodes, so a click that straddles a save is never lost and keyboard focus stays where it is.
  let gridSig = "";
  function renderGrid(s) {
    const sig = [curKey(), isThisMonth() ? now.getDate() : -1, ...state.habits.map((h) => `${h.id}\u0001${h.name}\u0001${h.icon}`)].join("|");
    if (sig === gridSig) { patchGrid(s); return; }
    gridSig = sig;
    const n = s.n, hs = state.habits, td = isThisMonth() ? now.getDate() : -1;
    const fut = (d) => (isThisMonth() && d > td) || (!isThisMonth() && !isPastMonth());
    const cls = (d) => `dc${d > 1 && (d - 1) % 7 === 0 ? " wkstart" : ""}${d === td ? " today" : ""}`;
    let h = '<thead><tr class="wk">';
    h += `<th class="hcol" rowspan="3"><div class="hc"><b>Alışkanlıklarım</b><button type="button" data-act="edit">Düzenle</button></div></th>`;
    s.weeks.forEach((w, i) => { h += `<th colspan="${w.b - w.a + 1}">${i + 1}. hafta</th>`; });
    h += `<th class="an first" colspan="5">Analiz</th></tr><tr>`;
    for (let d = 1; d <= n; d++) h += `<th class="${cls(d)}">${DOW[dow(d)]}</th>`;
    h += `<th class="an first" rowspan="2">Hedef</th><th class="an" rowspan="2">Yapılan</th><th class="an" rowspan="2">Kalan</th><th class="an pbar" rowspan="2">İlerleme</th><th class="an" rowspan="2">%</th></tr><tr>`;
    for (let d = 1; d <= n; d++) h += `<th class="${cls(d)} num" data-day="${d}">${d}</th>`;
    h += "</tr></thead><tbody>";
    hs.forEach((hb) => {
      h += `<tr><th class="hcol" scope="row"><span title="${esc(hb.name)}">${esc(hb.icon ? hb.icon + " " : "")}${esc(hb.name)}</span></th>`;
      for (let d = 1; d <= n; d++) {
        h += `<td class="${cls(d)}${fut(d) ? " future" : ""}"><button type="button" role="checkbox" aria-checked="false" data-h="${esc(hb.id)}" data-d="${d}" aria-label="${esc(hb.name)}, ${d} ${MONTHS[state.m]}"><span class="box"></span></button></td>`;
      }
      h += `<td class="an first">${n}</td><td class="an" data-a="done"></td><td class="an" data-a="left"></td><td class="an pbar"><div class="t"><i data-a="bar"></i></div></td><td class="an" data-a="pct"></td></tr>`;
    });
    if (!hs.length) h += `<tr class="emptyrow"><td colspan="${n + 6}">Listende alışkanlık yok. <button class="btn" data-act="edit" type="button">Alışkanlık ekle</button></td></tr>`;
    h += "</tbody><tfoot>";
    h += `<tr class="pct"><th class="hcol">Günlük %</th>`;
    for (let d = 1; d <= n; d++) h += `<td class="${cls(d)}" data-p="${d}"></td>`;
    h += `<td colspan="5"></td></tr>`;
    h += `<tr class="bandrow"><th class="hcol">Zihinsel durum</th><th colspan="${n + 5}">1–10 arası puan ver</th></tr>`;
    for (const [kind, label, color] of [["mood", "Ruh hali", "var(--mood)"], ["motivation", "Motivasyon", "var(--motiv)"]]) {
      h += `<tr><th class="hcol"><span class="sw" style="background:${color}"></span>${label}</th>`;
      for (let d = 1; d <= n; d++) {
        h += `<td class="${cls(d)}"><input id="${kind}-${d}" inputmode="numeric" maxlength="2" autocomplete="off" value="" data-k="${kind}" data-d="${d}" aria-label="${label}, ${d} ${MONTHS[state.m]}"></td>`;
      }
      h += `<td colspan="5"></td></tr>`;
    }
    h += "</tfoot>";
    // A structural rebuild (e.g. a habit renamed on another device) keeps focus on the same cell.
    const grid = $("grid"), active = document.activeElement;
    let restore = null;
    if (active && grid.contains(active)) {
      if (active.id) restore = { sel: "#" + CSS.escape(active.id), value: active.value };
      else if (active.dataset.h) restore = { sel: `button[data-h="${CSS.escape(active.dataset.h)}"][data-d="${active.dataset.d}"]` };
    }
    grid.innerHTML = h;
    setGridScrollPadding();
    patchGrid(s, true);
    if (restore) {
      const el = grid.querySelector(restore.sel);
      if (el) { if (restore.value != null) el.value = restore.value; el.focus({ preventScroll: true }); }
    }
  }
  // Day cells keep clear of the sticky habit column when they get keyboard focus.
  function setGridScrollPadding() {
    const wrap = $("gridwrap"), name = wrap.querySelector("thead .hcol"), th = wrap.querySelector("thead th[data-day]");
    if (name && th) wrap.style.setProperty("--sticky-w", (name.offsetWidth + th.offsetWidth) + "px");
  }
  function patchGrid(s, fresh) {
    const grid = $("grid"), n = s.n;
    grid.querySelectorAll("button[data-h]").forEach((b) => {
      const on = String(((s.checks[b.dataset.h] || {})[b.dataset.d]) === true);
      if (b.getAttribute("aria-checked") !== on) b.setAttribute("aria-checked", on);
    });
    const rows = grid.tBodies[0] ? grid.tBodies[0].rows : [];
    s.perHabit.forEach(({ done }, i) => {
      const row = rows[i];
      if (!row) return;
      const pct = n ? Math.round((done / n) * 100) : 0;
      row.querySelector('[data-a="done"]').textContent = done;
      row.querySelector('[data-a="left"]').textContent = n - done;
      row.querySelector('[data-a="bar"]').style.width = pct + "%";
      row.querySelector('[data-a="pct"]').textContent = "%" + pct;
    });
    const hc = state.habits.length || 1;
    grid.querySelectorAll("td[data-p]").forEach((td) => {
      const v = s.perDay[td.dataset.p - 1];
      const t = v ? String(Math.round((v / hc) * 100)) : "";
      if (td.textContent !== t) td.textContent = t;
    });
    grid.querySelectorAll("input[data-k]").forEach((inp) => {
      if (!fresh && inp === document.activeElement) return;
      const v = (inp.dataset.k === "mood" ? s.mood : s.motiv)[inp.dataset.d];
      const t = v == null ? "" : String(v);
      if (inp.value !== t) inp.value = t;
    });
  }

  function renderMood(s) {
    const el = $("moodChart");
    const { W, H } = size(el);
    const L = 28, R = 84, T = 12, B = 24, pw = W - L - R, ph = H - T - B, n = s.n;
    const x = (d) => L + (n > 1 ? ((d - 1) / (n - 1)) * pw : pw / 2);
    const y = (v) => T + ph - (v / 10) * ph;
    let g = "";
    for (const v of [0, 2, 4, 6, 8, 10]) {
      g += `<line x1="${L}" x2="${L + pw}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"${v ? ' stroke-dasharray="2 3"' : ""}/>`;
      g += `<text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="var(--font-data)">${v}</text>`;
    }
    const step = pw / n < 16 ? 5 : pw / n < 26 ? 2 : 1;
    for (let d = 1; d <= n; d++) if (showXLabel(d, step, false, false)) g += `<text x="${x(d)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="var(--font-data)">${d}</text>`;
    // Motivation is drawn first and mood on top, dashed, so identical values stay visible.
    const series = [["Motivasyon", s.motiv, "var(--motiv)", ""], ["Ruh hali", s.mood, "var(--mood)", ' stroke-dasharray="6 4"']];
    let lines = "", any = false;
    const ends = [];
    for (const [name, src, color, dash] of series) {
      const segs = [];
      let cur = [];
      for (let d = 1; d <= n; d++) {
        const v = Number(src[d]);
        if (src[d] != null && v >= 1 && v <= 10) cur.push({ x: x(d), y: y(v), d, v });
        else if (cur.length) { segs.push(cur); cur = []; }
      }
      if (cur.length) segs.push(cur);
      for (const seg of segs) {
        any = true;
        if (seg.length === 1) lines += `<circle cx="${seg[0].x}" cy="${seg[0].y}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`;
        else lines += `<path d="${monoPath(seg)}" fill="none" stroke="${color}" stroke-width="2"${dash} stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      const last = segs.length ? segs[segs.length - 1].slice(-1)[0] : null;
      if (last) {
        lines += `<circle cx="${last.x}" cy="${last.y}" r="4.5" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`;
        ends.push({ y: last.y, x: last.x, text: `${name} ${last.v}` });
      }
    }
    ends.sort((a, b) => a.y - b.y);
    if (ends.length === 2 && ends[1].y - ends[0].y < 14) { const mid = (ends[0].y + ends[1].y) / 2; ends[0].y = mid - 7; ends[1].y = mid + 7; }
    for (const e of ends) lines += `<text x="${e.x + 9}" y="${e.y + 4}" font-size="11" fill="var(--ink-2)">${esc(e.text)}</text>`;
    el.innerHTML = `<svg ${SVGNS} viewBox="0 0 ${W} ${H}" role="img" aria-label="Ruh hali ve motivasyon grafiği">${g}${lines}<line class="xh" y1="${T}" y2="${T + ph}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/><rect class="hit" x="${L}" y="${T}" width="${pw}" height="${ph}" fill="transparent"/></svg>` +
      (any ? "" : `<div class="empty">Tablonun altındaki Ruh hali ve Motivasyon satırlarına 1–10 arası puan gir</div>`);
    const svg = el.querySelector("svg"), hit = el.querySelector(".hit"), xh = el.querySelector(".xh");
    const move = (e) => {
      const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
      const d = Math.max(1, Math.min(n, Math.round(((px - L) / pw) * (n - 1)) + 1));
      xh.setAttribute("x1", x(d)); xh.setAttribute("x2", x(d)); xh.setAttribute("visibility", "visible");
      showTip(`<b>${d} ${MONTHS[state.m]} ${DOW_LONG[dow(d)]}</b><br>Ruh hali: ${esc(s.mood[d] ?? "—")} · Motivasyon: ${esc(s.motiv[d] ?? "—")}`, r.left + (x(d) / W) * r.width, r.top + (T / H) * r.height);
    };
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", (e) => { if (e.pointerType !== "mouse") return; xh.setAttribute("visibility", "hidden"); hideTip(); });
  }
  function monoPath(p) {
    const n = p.length, dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; m[i] = (p[i + 1].y - p[i].y) / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], q = a * a + b * b;
      if (q > 9) { const k = 3 / Math.sqrt(q); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${p[0].x},${p[0].y}`;
    for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += `C${p[i].x + h},${p[i].y + t[i] * h} ${p[i + 1].x - h},${p[i + 1].y - t[i + 1] * h} ${p[i + 1].x},${p[i + 1].y}`; }
    return d;
  }

  function renderRank(s) {
    const list = [...s.perHabit].sort((a, b) => b.done - a.done || a.h.name.localeCompare(b.h.name, "tr")).slice(0, 10);
    const ed = elapsedDays() || s.n;
    $("rank").innerHTML = list.length ? list.map((x, i) => {
      const pct = Math.round((x.done / ed) * 100);
      return `<li><span class="rk">${i + 1}</span><span class="n">${esc(x.h.icon ? x.h.icon + " " : "")}${esc(x.h.name)}</span><span class="pbar"><div class="t"><i style="width:${Math.min(100, pct)}%"></i></div></span><span class="c" title="${x.done} gün">${x.done}</span></li>`;
    }).join("") : `<li style="grid-template-columns:1fr;color:var(--muted)">Henüz alışkanlık eklenmedi</li>`;
  }

  let todaySig = "";
  function renderToday(s) {
    const n = s.n;
    state.focusDay = Math.max(1, Math.min(n, state.focusDay));
    const d = state.focusDay, isT = isThisMonth() && d === now.getDate();
    const sig = [curKey(), d, isT, ...state.habits.map((h) => `${h.id}\u0001${h.name}\u0001${h.icon}`)].join("|");
    if (sig !== todaySig) {
      todaySig = sig;
      $("todayTitle").textContent = isT ? "Bugün" : "Seçili gün";
      $("dayLabel").innerHTML = `<b>${d} ${MONTHS[state.m]}</b><span>${DOW_LONG[dow(d)]}${isT ? " · bugün" : ""}</span>`;
      const card = $("bugun"), active = document.activeElement;
      let fsel = null;
      if (active && card.contains(active)) {
        if (active.dataset.h) fsel = `#todo button[data-h="${CSS.escape(active.dataset.h)}"]`;
        else if (active.dataset.v) fsel = `#scale button[data-k="${active.dataset.k}"][data-v="${active.dataset.v}"]`;
      }
      $("todo").innerHTML = state.habits.length ? state.habits.map((h) => `<li><button type="button" role="checkbox" aria-checked="false" data-h="${esc(h.id)}" data-d="${d}"><span class="box"></span><span class="nm">${esc(h.icon ? h.icon + " " : "")}${esc(h.name)}</span></button></li>`).join("")
        : `<li class="empty-li">Listende alışkanlık yok. “Alışkanlıklarımı düzenle”den ekleyebilirsin.</li>`;
      const segs = (kind) => Array.from({ length: 10 }, (_, i) => `<button type="button" aria-pressed="false" data-k="${kind}" data-d="${d}" data-v="${i + 1}" aria-label="${kind === "mood" ? "Ruh hali" : "Motivasyon"} ${i + 1}">${i + 1}</button>`).join("");
      $("scale").innerHTML = `<div class="row"><span class="lbl"><i style="background:var(--mood)"></i>Ruh hali</span><div class="seg">${segs("mood")}</div></div>
        <div class="row"><span class="lbl"><i style="background:var(--motiv)"></i>Motivasyon</span><div class="seg">${segs("motivation")}</div></div>`;
      $("prevD").disabled = d <= 1; $("nextD").disabled = d >= n;
      if (fsel) { const el = card.querySelector(fsel); if (el) el.focus({ preventScroll: true }); }
    }
    let done = 0;
    $("todo").querySelectorAll("button[data-h]").forEach((b) => {
      const on = (s.checks[b.dataset.h] || {})[d] === true;
      if (on) done++;
      if (b.getAttribute("aria-checked") !== String(on)) b.setAttribute("aria-checked", String(on));
    });
    $("todayCount").textContent = `${done}/${state.habits.length}`;
    $("scale").querySelectorAll("button[data-v]").forEach((b) => {
      const on = Number((b.dataset.k === "mood" ? s.mood : s.motiv)[d]) === Number(b.dataset.v);
      if (b.getAttribute("aria-pressed") !== String(on)) b.setAttribute("aria-pressed", String(on));
    });
  }

  let labelSig = "";
  function renderAll() {
    if (labelSig !== curKey()) {
      labelSig = curKey();
      const hadFocus = document.activeElement && document.activeElement.id === "todayBtn";
      $("monthLabel").innerHTML = `<button type="button" id="todayBtn" title="Bugüne dön" aria-label="${MONTHS[state.m]} ${state.y}, bugüne dön">${MONTHS[state.m]} <span class="yr">${state.y}</span></button>`;
      if (hadFocus) $("todayBtn").focus({ preventScroll: true });
    }
    const s = stats();
    renderKpi(s); renderDaily(s); renderWeekly(s); renderGrid(s); renderMood(s); renderRank(s); renderToday(s);
  }

  /* ---------------- events ---------------- */
  document.addEventListener("click", (e) => {
    const cb = e.target.closest("button[role=checkbox][data-h]");
    if (cb) { toggle(cb.dataset.h, Number(cb.dataset.d)); return; }
    const seg = e.target.closest(".seg button");
    if (seg) {
      const cur = Number((view()[seg.dataset.k] || {})[seg.dataset.d]);
      const v = Number(seg.dataset.v);
      setScore(seg.dataset.k, Number(seg.dataset.d), cur === v ? null : v);
      return;
    }
    if (e.target.closest("[data-act=edit]")) { openEditor(); return; }
    if (e.target.closest("#todayBtn")) goToday();
  });
  $("grid").addEventListener("change", (e) => {
    const inp = e.target.closest("input[data-k]");
    if (!inp) return;
    const raw = inp.value.trim(), v = Number(raw);
    const val = raw === "" || !Number.isFinite(v) || v < 1 ? null : Math.min(10, Math.round(v));
    inp.value = val ?? "";
    setScore(inp.dataset.k, Number(inp.dataset.d), val);
  });
  // Only day cells get the sticky-column padding (applied just for this scroll), so focusing the sticky
  // column's own "Düzenle" button never jumps the table back to day 1.
  $("grid").addEventListener("focusin", (e) => {
    // keyboard focus only: scrolling under a mouse press would move the cell away before the click lands
    if (!e.target.closest("td.dc") || !e.target.matches(":focus-visible")) return;
    const wrap = $("gridwrap");
    wrap.style.scrollPaddingLeft = wrap.style.getPropertyValue("--sticky-w") || "0px";
    wrap.style.scrollPaddingRight = "6px";
    e.target.scrollIntoView({ block: "nearest", inline: "nearest" });
    wrap.style.scrollPaddingLeft = wrap.style.scrollPaddingRight = "";
  });
  // A remote change may arrive while a cell is focused (patchGrid skips it); repaint once focus leaves.
  $("grid").addEventListener("focusout", (e) => { if (e.target.matches("input[data-k]")) setTimeout(() => patchGrid(stats()), 0); });
  $("grid").addEventListener("keydown", (e) => {
    const inp = e.target.closest("input[data-k]");
    if (!inp || !["Enter", "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    if (e.key === "Enter") { e.preventDefault(); inp.blur(); return; }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const other = $(`${inp.dataset.k === "mood" ? "motivation" : "mood"}-${inp.dataset.d}`);
      if (other) { other.focus(); other.select(); }
      return;
    }
    const d = Number(inp.dataset.d) + (e.key === "ArrowRight" ? 1 : -1);
    const nx = $(`${inp.dataset.k}-${d}`);
    if (nx && inp.selectionStart === (e.key === "ArrowRight" ? inp.value.length : 0)) { e.preventDefault(); nx.focus(); nx.select(); }
  });
  $("prevM").onclick = () => goMonth(-1);
  $("nextM").onclick = () => goMonth(1);
  $("prevD").onclick = () => { state.focusDay--; renderToday(stats()); if ($("prevD").disabled) $("nextD").focus(); };
  $("nextD").onclick = () => { state.focusDay++; renderToday(stats()); if ($("nextD").disabled) $("prevD").focus(); };
  $("editBtn").onclick = openEditor;
  $("settingsBtn").onclick = openSettings;
  $("sync").onclick = () => {
    if ($("sync").dataset.s === "error" && state.pending) { flush(); return; }
    openSettings();
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && closeSheet) { e.preventDefault(); closeSheet(); }
  });

  let rT;
  new ResizeObserver(() => {
    clearTimeout(rT);
    rT = setTimeout(() => { const s = stats(); renderDaily(s); renderWeekly(s); renderKpi(s); renderMood(s); setGridScrollPadding(); }, 60);
  }).observe(document.querySelector(".wrap"));

  /* ---------------- sheets ---------------- */
  function openSheet(title, bodyHtml, onClose) {
    if (closeSheet) closeSheet();
    const root = $("sheetRoot"), page = document.querySelector(".wrap");
    const opener = document.activeElement;
    const openerSel = opener && opener.closest && opener.closest("#grid") ? "#grid [data-act=edit]" : null;
    root.innerHTML = `<div class="sheet-bg" id="sheetBg"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
      <div class="band" id="sheetTitle">${title}</div>${bodyHtml}
      <footer><button class="btn primary" id="sheetDone" type="button">Tamam</button></footer></div></div>`;
    page.inert = true; // keeps Tab inside the dialog
    document.documentElement.classList.add("sheet-open");
    const close = () => {
      page.inert = false;
      document.documentElement.classList.remove("sheet-open");
      root.innerHTML = "";
      closeSheet = null;
      if (onClose) onClose();
      const visible = (el) => el && el.isConnected && el.getClientRects().length > 0;
      const cand = openerSel && [...document.querySelectorAll(openerSel)].find(visible);
      const back = visible(opener) ? opener : cand || $("editBtn");
      if (back && back.focus) back.focus({ preventScroll: true });
    };
    closeSheet = close;
    $("sheetDone").onclick = close;
    $("sheetBg").addEventListener("click", (e) => { if (e.target.id === "sheetBg") close(); });
    setTimeout(() => $("sheetDone") && $("sheetDone").focus(), 0);
  }

  /* ---- habit editor ---- */
  function openEditor() {
    if (habitsLocked()) return;
    openSheet("Alışkanlıklarım", `
      <section><h3>Listem</h3><p class="hint">İsmi ya da simgeyi değiştirmek için üzerine yaz. Sıra tabloda da aynı olur.</p><ul class="mine" id="mine"></ul></section>
      <section><h3>Kendi alışkanlığını ekle</h3>
        <form class="addrow" id="addForm"><input class="ic" id="newIcon" maxlength="16" placeholder="✨" aria-label="Simge (emoji)"><input id="newName" maxlength="40" placeholder="Örn. 08:00'de kalk" aria-label="Alışkanlık adı"><button class="btn primary" type="submit">Ekle</button></form>
      </section>
      <section><h3>Hazır alışkanlıklar</h3><p class="hint">Dokunarak listene ekle ya da çıkar.</p><div class="chips" id="chips"></div></section>`);
    drawEditor(true);
    $("addForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("newName").value.trim();
      if (!name) { $("newName").focus(); return; }
      if (habitsLocked()) return;
      const h = { id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, icon: firstGrapheme($("newIcon").value), order: nextOrder() };
      state.habits.push(h);
      $("newName").value = ""; $("newIcon").value = "";
      saveHabits({ [h.id]: habitFields(h) }); drawEditor(true); renderAll();
      $("newName").focus();
    });
  }
  let editorSig = "";
  function drawEditor(force) {
    const mine = $("mine");
    if (!mine) return;
    const hs = state.habits;
    const sig = JSON.stringify(hs);
    // Snapshot echoes of our own edit must not replace the inputs the user is typing in.
    if (!force && sig === editorSig) return;
    const fa = document.activeElement;
    if (!force && fa && mine.contains(fa) && fa.tagName === "INPUT") { mine.dataset.stale = "1"; mine.onfocusout = () => setTimeout(() => { if (mine.dataset.stale && !mine.contains(document.activeElement)) { delete mine.dataset.stale; drawEditor(true); } }, 0); return; }
    editorSig = sig;
    const a = document.activeElement, li0 = a && a.closest && a.closest("#mine li[data-id]");
    const keep = li0 ? { id: li0.dataset.id, f: a.dataset.f, mv: a.dataset.mv, del: a.hasAttribute("data-del") } : null;
    mine.innerHTML = hs.length ? hs.map((h, i) => `<li data-id="${esc(h.id)}">
      <input class="ic" maxlength="16" value="${esc(h.icon)}" data-f="icon" aria-label="${esc(h.name)} simgesi">
      <input maxlength="40" value="${esc(h.name)}" data-f="name" aria-label="Alışkanlık adı">
      <button class="iconbtn" type="button" data-mv="-1" aria-label="${esc(h.name)}: yukarı taşı" ${i === 0 ? "disabled" : ""}>↑</button>
      <button class="iconbtn" type="button" data-mv="1" aria-label="${esc(h.name)}: aşağı taşı" ${i === hs.length - 1 ? "disabled" : ""}>↓</button>
      <button class="iconbtn del" type="button" data-del aria-label="${esc(h.name)}: sil">✕</button></li>`).join("")
      : `<li style="display:block;color:var(--muted);font-size:13px">Liste boş. Aşağıdan seç ya da kendin ekle.</li>`;
    if (keep) {
      const li = mine.querySelector(`li[data-id="${CSS.escape(keep.id)}"]`);
      const el = li && (keep.f ? li.querySelector(`[data-f="${keep.f}"]`) : keep.mv ? li.querySelector(`[data-mv="${keep.mv}"]`) : keep.del ? li.querySelector("[data-del]") : null);
      if (el && !el.disabled) el.focus();
    }
    const find = (li) => state.habits.findIndex((h) => h.id === li.dataset.id);
    mine.onchange = (e) => {
      const li = e.target.closest("li[data-id]"), f = e.target.dataset.f;
      if (!li || !f || habitsLocked()) return;
      const i = find(li);
      if (i < 0) return;
      const v = f === "icon" ? firstGrapheme(e.target.value) : e.target.value.trim();
      if (f === "name" && !v) { e.target.value = state.habits[i].name; return; }
      e.target.value = v;
      state.habits[i][f] = v;
      editorSig = JSON.stringify(state.habits);
      saveHabits({ [state.habits[i].id]: { [f]: v } }); renderAll();
    };
    mine.onclick = (e) => {
      const li = e.target.closest("li[data-id]");
      if (!li) return;
      const i = find(li);
      if (i < 0) return;
      const mv = e.target.closest("[data-mv]");
      if (mv) {
        if (habitsLocked()) return;
        const j = i + Number(mv.dataset.mv), list = state.habits;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        // re-number so the swap is unambiguous even if stored orders had gaps or ties
        const changes = {};
        list.forEach((h, k) => { const o = (k + 1) * 10; if (h.order !== o) { h.order = o; changes[h.id] = { order: o }; } });
        saveHabits(changes); drawEditor(true); renderAll();
        const b = mine.querySelector(`li[data-id="${CSS.escape(li.dataset.id)}"] [data-mv="${mv.dataset.mv}"]`);
        if (b && !b.disabled) b.focus();
        else { const other = mine.querySelector(`li[data-id="${CSS.escape(li.dataset.id)}"] [data-mv="${-Number(mv.dataset.mv)}"]`); if (other) other.focus(); }
      } else if (e.target.closest("[data-del]")) {
        if (e.detail > 1) return;
        removeHabit(i);
        const rows = mine.querySelectorAll("li[data-id] [data-del]");
        const next = rows[Math.min(i, rows.length - 1)];
        (next || $("newName")).focus();
      }
    };
    $("chips").innerHTML = PRESETS.map((p) => `<button type="button" aria-pressed="${hs.some((h) => h.id === p.id)}" data-p="${p.id}">${esc(p.icon)} ${esc(p.name)}</button>`).join("");
    $("chips").onclick = (e) => {
      const b = e.target.closest("[data-p]");
      if (!b || habitsLocked()) return;
      const i = state.habits.findIndex((h) => h.id === b.dataset.p);
      if (i >= 0) { removeHabit(i); const c = $("chips").querySelector(`[data-p="${CSS.escape(b.dataset.p)}"]`); if (c) c.focus(); return; }
      const h = { ...PRESETS.find((p) => p.id === b.dataset.p), order: nextOrder() };
      state.habits.push(h);
      saveHabits({ [h.id]: habitFields(h) }); drawEditor(true); renderAll();
      const again = $("chips").querySelector(`[data-p="${CSS.escape(h.id)}"]`); if (again) again.focus();
    };
  }
  let undoList = [];
  const clearUndo = () => { undoList = []; };
  function removeHabit(i) {
    if (habitsLocked()) return;
    const [gone] = state.habits.splice(i, 1);
    undoList = undoList.filter((g) => g.id !== gone.id);
    undoList.push(gone);
    saveHabits({ [gone.id]: { removed: true } }); drawEditor(true); renderAll();
    const label = undoList.length > 1 ? `${undoList.length} alışkanlık listeden çıkarıldı` : `“${gone.name}” listeden çıkarıldı`;
    toast(label, "Geri al", () => {
      const back = undoList.splice(0).filter((g) => !state.habits.some((h) => h.id === g.id));
      if (!back.length) return;
      const changes = {};
      for (const g of back) { state.habits.push(g); changes[g.id] = habitFields(g); }
      state.habits.sort((a, b) => a.order - b.order);
      saveHabits(changes); drawEditor(true); renderAll();
      const el = $("mine") ? $("mine").querySelector(`li[data-id="${CSS.escape(back[0].id)}"] [data-del]`) : $("editBtn");
      if (el) el.focus();
    }, clearUndo);
  }

  /* ---- settings: account, appearance, backup ---- */
  const AUTH_ERRORS = {
    "auth/invalid-email": "E-posta adresi geçersiz.",
    "auth/missing-email": "E-posta adresini yaz.",
    "auth/missing-password": "Şifreni yaz.",
    "auth/weak-password": "Şifre en az 6 karakter olmalı.",
    "auth/email-already-in-use": "Bu e-postayla zaten bir hesap var. “Giriş yap”ı dene.",
    "auth/invalid-credential": "E-posta ya da şifre hatalı.",
    "auth/invalid-login-credentials": "E-posta ya da şifre hatalı.",
    "auth/wrong-password": "E-posta ya da şifre hatalı.",
    "auth/user-not-found": "Bu e-postayla bir hesap bulunamadı.",
    "auth/user-disabled": "Bu hesap devre dışı bırakılmış.",
    "auth/too-many-requests": "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.",
    "auth/network-request-failed": "İnternet bağlantısı yok. Bağlanınca tekrar dene.",
    "auth/operation-not-allowed": "Firebase'de E-posta/Şifre girişi açık değil (KURULUM.md, Authentication adımı).",
    "auth/admin-restricted-operation": "Bu uygulamada yeni hesap açma kapatılmış. Var olan hesabınla giriş yap.",
    "auth/configuration-not-found": "Firebase'de Authentication açılmamış (KURULUM.md, Authentication adımı).",
    "auth/invalid-api-key": "firebase-config.js içindeki apiKey hatalı.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "firebase-config.js içindeki apiKey hatalı.",
  };
  const authMsg = (e) => AUTH_ERRORS[e && e.code] || `Bir sorun oldu${e && e.code ? ` (${e.code})` : ""}.`;

  function openSettings() {
    openSheet("Ayarlar", `<div id="settingsBody"></div>`, () => { backupState = null; });
    drawSettings();
  }
  let backupState = null; // null | {mode:"export", json} | {mode:"paste"} | {mode:"confirm", docs, months, hasSettings} | {mode:"error", text}
  function themePref() { return prefGet(PREF.theme) || "system"; }
  function applyTheme(t) {
    prefSet(PREF.theme, t === "system" ? null : t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      if (!m.dataset.orig) m.dataset.orig = m.content;
      m.content = t === "light" ? "#73675D" : t === "dark" ? "#2A2622" : m.dataset.orig;
    });
  }

  function drawSettings() {
    const body = $("settingsBody");
    if (!body) return;
    // remember focus across the redraw
    const a = document.activeElement;
    let fsel = null;
    if (a && body.contains(a)) {
      if (a.id) fsel = "#" + CSS.escape(a.id);
      else if (a.dataset.themeSet) fsel = `[data-theme-set="${a.dataset.themeSet}"]`;
      else if (a.dataset.auth) fsel = `[data-auth="${a.dataset.auth}"]`;
    }
    const acc = account;
    let html = "";
    if (!acc.configured) {
      html = `<p>Eşitleme henüz kurulmadı, kayıtların yalnızca bu cihazda duruyor. Telefonla bilgisayarı eşitlemek için proje klasöründeki <b>KURULUM.md</b> dosyasında “Eşitlemeyi aç” adımlarını izle.</p>
        <p class="hint">O zamana kadar verilerini aşağıdaki “Yedek” bölümüyle cihazlar arasında taşıyabilirsin.</p>`;
    } else if (acc.status === "loading") {
      html = `<p>Eşitleme servisi başlatılıyor…</p>`;
    } else if (acc.status === "failed") {
      html = `<div class="msg err">${esc(acc.msg ? acc.msg.text : "Eşitleme başlatılamadı.")}</div><div class="rowbtns"><button class="btn" type="button" id="acRetry">Tekrar dene</button></div>`;
    } else if (acc.status === "signedin") {
      html = `<p>Giriş yapıldı: <b>${esc(acc.user.email)}</b></p>
        <p class="hint">Aynı hesapla giriş yaptığın her cihaz (telefon, bilgisayar) aynı tabloyu görür ve değişiklikler anında eşitlenir. İnternet yokken de kullanabilirsin; bağlanınca gönderilir.</p>
        <div class="rowbtns"><button class="btn" type="button" id="acOut">Çıkış yap</button></div>`;
    } else {
      html = `<p>Telefonda ve bilgisayarda aynı e-posta ve şifreyle giriş yap; kayıtların ikisinde de eşitlensin. İlk kez kullanıyorsan “Hesap oluştur”a bas.</p>
        <form id="acForm" style="display:grid;gap:8px" novalidate>
          <label class="fld">E-posta<input class="txt" id="acEmail" type="email" autocomplete="username" inputmode="email" value="${esc(acc.emailDraft)}" required></label>
          <label class="fld">Şifre (en az 6 karakter)<input class="txt" id="acPass" type="password" autocomplete="current-password" required minlength="6"></label>
          <div class="rowbtns">
            <button class="btn primary" type="submit" data-auth="in" ${acc.busy ? "disabled" : ""}>Giriş yap</button>
            <button class="btn" type="button" data-auth="up" ${acc.busy ? "disabled" : ""}>Hesap oluştur</button>
            <button class="linkbtn" type="button" data-auth="reset" ${acc.busy ? "disabled" : ""}>Şifremi unuttum</button>
          </div>
        </form>`;
    }
    if (acc.msg && acc.status !== "failed") html += `<div class="msg ${acc.msg.ok ? "ok" : "err"}" role="status">${esc(acc.msg.text)}</div>`;

    const t = themePref();
    const seg = (v, l) => `<button type="button" data-theme-set="${v}" aria-pressed="${t === v}">${l}</button>`;

    const target = store && store.kind === "cloud" ? "hesabındaki" : "bu cihazdaki";
    let bk = `<p>Tüm alışkanlıklarını ve aylık kayıtlarını tek bir dosyaya al ya da yedekten geri yükle.</p>
      <div class="rowbtns">
        <button class="btn" type="button" id="bkExport">Yedeği al</button>
        <button class="btn" type="button" id="bkFileBtn">Yedekten geri yükle</button><input type="file" id="bkFile" accept="application/json,.json,text/plain" hidden>
        <button class="linkbtn" type="button" id="bkPasteBtn">Metni yapıştırarak yükle</button>
      </div>`;
    if (backupState && backupState.mode === "export") {
      bk += `<label class="fld">Yedek metni (kopyalayıp güvenli bir yere kaydet)<textarea id="bkText" readonly>${esc(backupState.json)}</textarea></label>
        <div class="rowbtns"><button class="btn primary" type="button" id="bkCopy">Panoya kopyala</button></div>`;
    } else if (backupState && backupState.mode === "paste") {
      bk += `<label class="fld">Yedek metnini buraya yapıştır<textarea id="bkPaste" placeholder='{"app":"aliskanlik-takipcisi", ...}'></textarea></label>
        <div class="rowbtns"><button class="btn primary" type="button" id="bkPasteGo">Kontrol et</button></div>`;
    } else if (backupState && backupState.mode === "confirm") {
      bk += `<div class="msg">Yedekte ${backupState.months} aylık kayıt${backupState.hasSettings ? " ve alışkanlık listesi" : ""} var. “Birleştir” ${target} kayıtlara ekler; “Üzerine yaz” aynı ayları yedektekiyle değiştirir.</div>
        <div class="rowbtns"><button class="btn primary" type="button" id="bkMerge">Birleştir</button><button class="btn" type="button" id="bkGo">Üzerine yaz</button><button class="btn ghost" type="button" id="bkCancel">Vazgeç</button></div>`;
    } else if (backupState && backupState.mode === "error") {
      bk += `<div class="msg err" role="status">${esc(backupState.text)}</div>`;
    }

    body.innerHTML = `
      <section><h3>Hesap ve eşitleme</h3>${html}</section>
      <section><h3>Görünüm</h3><div class="segctl" role="group" aria-label="Tema">${seg("system", "Sistem")}${seg("light", "Açık")}${seg("dark", "Koyu")}</div></section>
      <section><h3>Yedek</h3>${bk}</section>
      <section><p class="hint">Alışkanlık Takipçisi ${APP_VERSION} · ${isNative() ? "Android uygulaması" : navigator.userAgent.includes("Electron") ? "Bilgisayar uygulaması" : "Web uygulaması"}</p></section>`;

    const f = $("acForm");
    if (f) {
      $("acEmail").addEventListener("input", (e) => { account.emailDraft = e.target.value; });
      f.addEventListener("submit", (e) => { e.preventDefault(); doAuth("in"); });
      f.querySelectorAll("button[data-auth]").forEach((b) => { if (b.type !== "submit") b.onclick = () => doAuth(b.dataset.auth); });
    }
    if ($("acOut")) $("acOut").onclick = async () => {
      await settle();
      account.msg = null;
      window.HabitStore.firebase.FB.signOut(window.HabitStore.firebase.auth);
    };
    if ($("acRetry")) $("acRetry").onclick = () => { account.msg = null; startCloud(); drawSettings(); };
    body.querySelectorAll("[data-theme-set]").forEach((b) => { b.onclick = () => { applyTheme(b.dataset.themeSet); drawSettings(); }; });
    $("bkExport").onclick = exportBackup;
    $("bkFileBtn").onclick = () => $("bkFile").click();
    $("bkFile").onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      file.text().then(checkBackup, () => { backupState = { mode: "error", text: "Dosya okunamadı." }; drawSettings(); });
    };
    $("bkPasteBtn").onclick = () => { backupState = { mode: "paste" }; drawSettings(); $("bkPaste").focus(); };
    if ($("bkPasteGo")) $("bkPasteGo").onclick = () => checkBackup($("bkPaste").value);
    if ($("bkCopy")) $("bkCopy").onclick = async () => {
      const ta = $("bkText");
      try { await navigator.clipboard.writeText(ta.value); toast("Yedek panoya kopyalandı"); }
      catch { ta.focus(); ta.select(); toast("Metni seçtim, kopyala komutuyla al"); }
    };
    if ($("bkGo")) $("bkGo").onclick = () => importBackup(false);
    if ($("bkMerge")) $("bkMerge").onclick = () => importBackup(true);
    if ($("bkCancel")) $("bkCancel").onclick = () => { backupState = null; drawSettings(); };
    if (fsel) {
      const el = body.querySelector(fsel) || (fsel.startsWith("#bk") ? $("bkText") || $("bkPaste") || $("bkMerge") || $("bkFileBtn") : null);
      if (el && !el.disabled) el.focus();
    }
  }

  async function doAuth(kind) {
    const email = ($("acEmail") ? $("acEmail").value : account.emailDraft).trim();
    const pw = $("acPass") ? $("acPass").value : "";
    account.emailDraft = email;
    if (!email) { account.msg = { ok: false, text: "E-posta adresini yaz." }; drawSettings(); return; }
    if (kind !== "reset" && pw.length < 6) { account.msg = { ok: false, text: "Şifre en az 6 karakter olmalı." }; drawSettings(); return; }
    const { FB, auth } = window.HabitStore.firebase;
    account.busy = true; account.msg = null; drawSettings();
    try {
      if (kind === "in") await FB.signInWithEmailAndPassword(auth, email, pw);
      else if (kind === "up") await FB.createUserWithEmailAndPassword(auth, email, pw);
      else { await FB.sendPasswordResetEmail(auth, email); account.msg = { ok: true, text: "Şifre sıfırlama bağlantısı e-postana gönderildi." }; }
    } catch (e) {
      account.msg = { ok: false, text: authMsg(e) };
    }
    account.busy = false;
    drawSettings();
  }

  async function exportBackup() {
    if (account.status === "loading") { toast("Hesabın yükleniyor, birazdan tekrar dene"); return; }
    await settle();
    let docs;
    try { docs = await store.listAll(); }
    catch { backupState = { mode: "error", text: "Kayıtlar okunamadı. İnternet bağlantını kontrol et." }; drawSettings(); return; }
    const data = { app: "aliskanlik-takipcisi", version: 1, exportedAt: new Date().toISOString(), docs };
    const json = JSON.stringify(data, null, 2);
    const name = `aliskanlik-yedek-${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}.json`;
    if (isNative()) { backupState = { mode: "export", json }; drawSettings(); return; }
    try {
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(`Yedek hazır: ${name}`);
    } catch {
      backupState = { mode: "export", json }; drawSettings();
    }
  }
  // Keeps only data the app understands, so a damaged or hand-edited backup cannot poison later saves.
  function cleanMonth(doc) {
    const out = {};
    const days = (o, ok) => { const r = {}; if (isObj(o)) for (const d of Object.keys(o)) if (/^([1-9]|[12]\d|3[01])$/.test(d) && ok(o[d])) r[d] = o[d]; return r; };
    const nonEmpty = (o) => Object.keys(o).length > 0;
    if (isObj(doc.checks)) {
      const c = {};
      for (const id of Object.keys(doc.checks)) if (validId(id)) { const d = days(doc.checks[id], (v) => typeof v === "boolean"); if (nonEmpty(d)) c[id] = d; }
      if (nonEmpty(c)) out.checks = c;
    }
    for (const k of ["mood", "motivation"]) if (isObj(doc[k])) { const d = days(doc[k], (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 10)); if (nonEmpty(d)) out[k] = d; }
    return out;
  }
  function cleanSettings(doc) {
    if (Array.isArray(doc.habits)) return { habits: doc.habits.filter((h) => h && validId(h.id) && typeof h.name === "string" && h.name.trim()).map((h) => ({ id: h.id, name: h.name.trim().slice(0, 40), icon: typeof h.icon === "string" ? h.icon.slice(0, 16) : "" })) };
    if (isObj(doc.habits)) {
      const habits = {};
      for (const id of Object.keys(doc.habits)) {
        const h = doc.habits[id];
        if (!validId(id) || !isObj(h)) continue;
        if (h.removed) habits[id] = { removed: true };
        else if (typeof h.name === "string" && h.name.trim()) habits[id] = { name: h.name.trim().slice(0, 40), icon: typeof h.icon === "string" ? h.icon.slice(0, 16) : "", order: Number(h.order) || 0, removed: false };
      }
      return { habits };
    }
    return null;
  }
  function checkBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch { backupState = { mode: "error", text: "Bu dosya bir yedek dosyası değil (JSON okunamadı)." }; drawSettings(); return; }
    const docs = data && data.app === "aliskanlik-takipcisi" && isObj(data.docs) ? data.docs : null;
    if (!docs) { backupState = { mode: "error", text: "Bu dosya Alışkanlık Takipçisi yedeği değil." }; drawSettings(); return; }
    const clean = {};
    for (const k of Object.keys(docs)) {
      if (!DOC_KEY.test(k) || !isObj(docs[k])) continue;
      const c = k === "settings" ? cleanSettings(docs[k]) : cleanMonth(docs[k]);
      if (c && Object.keys(c).length) clean[k] = c;
    }
    const months = Object.keys(clean).filter((k) => k !== "settings").length;
    if (!months && !clean.settings) { backupState = { mode: "error", text: "Yedekte yüklenecek kayıt bulunamadı." }; drawSettings(); return; }
    backupState = { mode: "confirm", docs: clean, months, hasSettings: !!clean.settings };
    drawSettings();
  }
  // "Birleştir" for the habit list: add the backup's habits that are not in the list yet, keep everything else as it is.
  async function mergeSettings(doc) {
    const incoming = {};
    let o = nextOrder();
    const add = (id, h) => { if (!state.habits.some((x) => x.id === id) && !incoming[id]) { incoming[id] = { name: h.name, icon: h.icon || "", order: o, removed: false }; o += 10; } };
    if (Array.isArray(doc.habits)) doc.habits.forEach((h) => add(h.id, h));
    else if (isObj(doc.habits)) {
      Object.keys(doc.habits).filter((id) => !doc.habits[id].removed)
        .sort((a, b) => (Number(doc.habits[a].order) || 0) - (Number(doc.habits[b].order) || 0))
        .forEach((id) => add(id, doc.habits[id]));
    }
    if (!Object.keys(incoming).length) return;
    if (state.settingsShape === "map") { await store.patch("settings", { habits: incoming }); return; }
    // legacy array or no list yet: write the current list plus the new habits as one map
    const habits = {};
    for (const h of state.habits) habits[h.id] = habitFields(h);
    await store.patch("settings", { habits: { ...habits, ...incoming } });
    state.settingsShape = "map";
  }
  async function importBackup(merge) {
    const docs = backupState && backupState.docs;
    if (!docs) return;
    if (habitsLocked()) return;
    await settle();
    try {
      for (const k of Object.keys(docs)) {
        if (merge && k === "settings") await mergeSettings(docs[k]);
        else if (merge) {
          const addOnly = (o) => { const r = {}; for (const x of Object.keys(o)) { const v = o[x]; if (isObj(v)) { const c = addOnly(v); if (Object.keys(c).length) r[x] = c; } else if (v !== false && v !== null) r[x] = v; } return r; };
          const add = addOnly(docs[k]);
          if (Object.keys(add).length) await store.patch(k, add);
        } else await store.set(k, docs[k]);
      }
      backupState = null;
      drawSettings();
      toast(merge ? "Yedek birleştirildi" : "Yedek yüklendi");
    } catch (e) {
      backupState = { mode: "error", text: "Yedek yüklenemedi: " + fbErrorText(e) };
      drawSettings();
    }
  }

  /* ---------------- toast ---------------- */
  let toastT;
  let toastExpire = null;
  function toast(msg, actionLabel, action, onExpire) {
    const root = $("toastRoot");
    if (toastExpire) { const f = toastExpire; toastExpire = null; if (f !== onExpire) f(); }
    toastExpire = onExpire || null;
    root.innerHTML = `<div class="toast" role="status"><span></span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ""}</div>`;
    root.querySelector("span").textContent = msg;
    if (actionLabel) root.querySelector("button").onclick = () => { root.innerHTML = ""; toastExpire = null; action(); };
    clearTimeout(toastT);
    toastT = setTimeout(() => { root.innerHTML = ""; if (toastExpire) { const f = toastExpire; toastExpire = null; f(); } }, actionLabel ? 8000 : 5000);
  }

  /* ---------------- platform glue ---------------- */
  function setupNative() {
    if (!isNative()) return;
    const App = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App) return;
    App.addListener("backButton", () => {
      if (closeSheet) { closeSheet(); return; }
      if (App.minimizeApp) App.minimizeApp(); else App.exitApp();
    });
    App.addListener("resume", refreshNow);
    App.addListener("pause", () => { if (state.pending) flush(); });
  }
  function setupServiceWorker() {
    if (!("serviceWorker" in navigator) || isNative() || !/^https?:$/.test(location.protocol)) return;
    // Capacitor serves the APK's files from https://localhost; never cache them in a service worker there.
    if (location.hostname === "localhost" && location.protocol === "https:") return;
    let reloading = false, wantReload = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading || !wantReload) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.register("sw.js").then((reg) => {
      const offer = (w) => toast("Yeni sürüm hazır", "Güncelle", () => { wantReload = true; w.postMessage("skipWaiting"); });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(w); });
      });
    }).catch(() => {});
  }

  /* ---------------- boot ---------------- */
  applyTheme(themePref());
  useStore(window.HabitStore.createLocal());
  if (account.configured) {
    // edits made in the sign-in window of a previous session that was closed early
    try { const held = JSON.parse(prefGet(PREF.held) || "null"); if (isObj(held)) { state.pending = held; renderAll(); } } catch {}
    startCloud();
  } else prefSet(PREF.held, null);
  setupNative();
  setupServiceWorker();
  requestAnimationFrame(() => {
    scrollGridToFocus();
    if (location.hash === "#bugun") $("bugun").scrollIntoView({ block: "start" });
  });
})();
