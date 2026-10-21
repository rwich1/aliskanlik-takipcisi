/* Storage back-ends for the habit tracker.
 * Both stores share one shape: watch(key, cb) -> unsubscribe, set(key, value), patch(key, deepPartial),
 * listAll() -> {key: doc}. Keys are "settings" and "m-YYYY-MM".
 *  - local: localStorage on this device (also syncs between tabs/windows of the same browser).
 *  - cloud: Firestore at users/<uid>/data/<key>, with an offline cache so the app keeps working without internet.
 */
(function () {
  "use strict";

  const PREFIX = "habit:";
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  function deepMerge(base, patch) {
    const out = isObj(base) ? { ...base } : {};
    if (!isObj(patch)) return out;
    for (const k of Object.keys(patch)) out[k] = isObj(patch[k]) ? deepMerge(out[k], patch[k]) : patch[k];
    return out;
  }

  function createLocal() {
    const mem = {}, subs = {};
    const read = (k) => {
      try {
        const s = localStorage.getItem(PREFIX + k);
        return s ? JSON.parse(s) : mem[k] ?? null;
      } catch {
        return mem[k] ?? null;
      }
    };
    const write = (k, v) => {
      mem[k] = v;
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch {}
    };
    const emit = (k, v) => (subs[k] || new Set()).forEach((cb) => cb(v));
    const onStorage = (e) => {
      if (e.key && e.key.startsWith(PREFIX)) {
        const k = e.key.slice(PREFIX.length);
        emit(k, read(k));
      }
    };
    addEventListener("storage", onStorage);
    return {
      kind: "local",
      watch(k, cb) {
        (subs[k] ||= new Set()).add(cb);
        cb(read(k));
        return () => subs[k] && subs[k].delete(cb);
      },
      async set(k, v) { write(k, v); emit(k, v); },
      async patch(k, p) { const n = deepMerge(read(k) || {}, p); write(k, n); emit(k, n); },
      async listAll() {
        const out = { ...mem };
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(PREFIX)) out[key.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(key));
          }
        } catch {}
        return out;
      },
      dispose() { removeEventListener("storage", onStorage); },
    };
  }

  let fb = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Yüklenemedi: " + src));
      document.head.appendChild(s);
    });
  }

  async function initFirebase(config) {
    if (fb) return fb;
    if (!window.FB) await loadScript("vendor/firebase.js");
    const FB = window.FB;
    const app = FB.initializeApp(config);
    // initializeAuth (not getAuth) avoids the popup/redirect helper, which Android WebView and Electron cannot use.
    const auth = FB.initializeAuth(app, { persistence: [FB.indexedDBLocalPersistence, FB.browserLocalPersistence] });
    let db;
    try {
      db = FB.initializeFirestore(app, { localCache: FB.persistentLocalCache({ tabManager: FB.persistentMultipleTabManager() }) });
    } catch {
      db = FB.initializeFirestore(app, { localCache: FB.memoryLocalCache() });
    }
    fb = { FB, app, auth, db };
    return fb;
  }

  /* hooks: onWrite() when a write starts, onSynced() once every queued write reached the server, onError(err). */
  function createCloud(uid, hooks = {}) {
    if (!fb) throw new Error("Firebase başlatılmadı");
    const { FB, db } = fb;
    const col = FB.collection(db, "users", uid, "data");
    const ref = (k) => FB.doc(col, k);
    let unsynced = 0;
    // setDoc applies to the local cache at once (snapshots fire immediately) and resolves when the server
    // acknowledges; offline it stays queued in IndexedDB and is sent on reconnect, so callers never wait on it.
    const track = (p) => {
      unsynced++;
      hooks.onWrite && hooks.onWrite();
      p.then(
        () => { if (--unsynced === 0) hooks.onSynced && hooks.onSynced(); },
        (e) => { unsynced--; hooks.onError && hooks.onError(e); },
      );
    };
    // Writes queued in IndexedDB by an earlier session (app closed while offline) count as unsynced too.
    track(FB.waitForPendingWrites(db));
    return {
      kind: "cloud",
      uid,
      // Firestore listener errors are final, so re-subscribe with a growing delay until it works again.
      // opts.includeMetadataChanges also delivers "the server confirmed this" events that change no data.
      watch(k, cb, opts) {
        let unsub = null, timer = null, stopped = false, delay = 5000, failed = false;
        const start = () => {
          unsub = FB.onSnapshot(
            ref(k),
            opts || {},
            (s) => {
              delay = 5000;
              if (failed) { failed = false; hooks.onRecovered && hooks.onRecovered(); }
              cb(s.exists() ? s.data() : null, s.metadata);
            },
            (e) => {
              failed = true;
              hooks.onError && hooks.onError(e);
              if (stopped) return;
              timer = setTimeout(start, delay);
              delay = Math.min(delay * 3, 120000);
            },
          );
        };
        start();
        return () => { stopped = true; clearTimeout(timer); if (unsub) unsub(); };
      },
      async set(k, v) { track(FB.setDoc(ref(k), v)); },
      async patch(k, p) { track(FB.setDoc(ref(k), p, { merge: true })); },
      async listAll() {
        const snap = await FB.getDocs(col);
        const out = {};
        snap.forEach((d) => { out[d.id] = d.data(); });
        return out;
      },
      async isEmpty() { return (await FB.getDocs(col)).empty; },
      get unsynced() { return unsynced; },
      dispose() {},
    };
  }

  window.HabitStore = { createLocal, initFirebase, createCloud, deepMerge, get firebase() { return fb; } };
})();
