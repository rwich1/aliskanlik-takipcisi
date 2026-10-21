/* Alışkanlık Takipçisi — Electron main process (Windows / desktop).
 * The web app in ../www is served through the privileged app:// scheme instead of file://, so it gets a real,
 * stable origin (app://bundle): localStorage, IndexedDB (Firestore offline cache, Firebase Auth) and the page's
 * CSP 'self' all behave as on a website. Do not change SCHEME/HOST later: the origin owns the saved data.
 *
 * Test hooks (inert unless set):
 *   ALISKANLIK_SMOKE=/path/shot.png   load, optionally run ALISKANLIK_SMOKE_JS, screenshot, print renderer errors, quit
 *   ALISKANLIK_USER_DATA=/some/dir    use another profile folder (tests, side-by-side runs)
 */
"use strict";

const { app, BrowserWindow, Menu, nativeTheme, protocol, screen, session, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const APP_ID = "app.aliskanlik.takipci";
const APP_NAME = "Alışkanlık Takipçisi";
const SCHEME = "app";
const HOST = "bundle";
const ORIGIN = `${SCHEME}://${HOST}`;
const START_URL = `${ORIGIN}/index.html`;
const WWW = path.join(__dirname, "..", "www");
const BG_LIGHT = "#E9E5DF";
const BG_DARK = "#171513";
const DEFAULT_SIZE = { width: 1360, height: 900 };
const MIN_SIZE = { width: 380, height: 600 };

const SMOKE = process.env.ALISKANLIK_SMOKE || "";
const smokeErrors = [];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

// Must run before "ready".
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

app.setName(APP_NAME);
// The default user agent embeds the app name; protocol.handle rejects non-Latin-1 header values (ı, ş, ç),
// which would make every app:// request fail. Keep the UA ASCII (it still contains "Electron/", used by app.js).
app.userAgentFallback = app.userAgentFallback
  .replace(/[ıİşŞçÇğĞüÜöÖ]/g, (c) => ({ ı: "i", İ: "I", ş: "s", Ş: "S", ç: "c", Ç: "C", ğ: "g", Ğ: "G", ü: "u", Ü: "U", ö: "o", Ö: "O" }[c]))
  .replace(/[^\x20-\x7E]/g, "")
  .replace(/Aliskanlik Takipcisi\//, "AliskanlikTakipcisi/");
// Fixed ASCII profile folder (%APPDATA%\aliskanlik-takipcisi on Windows), independent of productName changes.
app.setPath("userData", process.env.ALISKANLIK_USER_DATA || path.join(app.getPath("appData"), "aliskanlik-takipcisi"));
if (process.platform === "win32") app.setAppUserModelId(APP_ID);

let win = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.on("web-contents-created", (_e, contents) => hardenContents(contents));
  app.whenReady().then(() => {
    registerAppProtocol();
    setPermissions();
    setDownloads();
    setMenu();
    createWindow();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}

/* ---------------- app:// file server ---------------- */
function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const fail = (status, text) => {
      if (SMOKE) smokeErrors.push(`app:// ${status} ${request.url}`);
      return new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
    };
    let url;
    try { url = new URL(request.url); } catch { return fail(400, "Bad request"); }
    if (url.host !== HOST) return fail(404, "Not found");
    if (request.method !== "GET" && request.method !== "HEAD") return fail(405, "Method not allowed");

    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { return fail(400, "Bad request"); }
    if (rel.includes("\0")) return fail(400, "Bad request");
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(WWW, "." + path.posix.normalize("/" + rel));
    if (file !== WWW && !file.startsWith(WWW + path.sep)) return fail(403, "Forbidden");

    try {
      const body = await fs.promises.readFile(file);
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers: {
          "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
          "content-length": String(body.length),
          "cache-control": "no-cache",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return fail(404, "Not found");
    }
  });
}

/* ---------------- security ---------------- */
function isAppUrl(u) {
  return typeof u === "string" && (u === ORIGIN || u.startsWith(ORIGIN + "/"));
}

function openExternal(u) {
  try {
    const p = new URL(u).protocol;
    if (p === "https:" || p === "http:" || p === "mailto:") shell.openExternal(u).catch(() => {});
  } catch {}
}

function hardenContents(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (e, url) => {
    if (isAppUrl(url)) return;
    e.preventDefault();
    openExternal(url);
  });
  contents.on("will-redirect", (e, url) => { if (!isAppUrl(url)) e.preventDefault(); });
  contents.on("will-attach-webview", (e) => e.preventDefault());
}

function setPermissions() {
  const allowed = new Set(["clipboard-sanitized-write", "fullscreen", "notifications"]);
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    cb(allowed.has(permission) && isAppUrl(details.requestingUrl || wc.getURL()));
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => allowed.has(permission) && isAppUrl(origin));
}

// The backup export (Ayarlar > Yedeği al) is a blob download: offer a Turkish save dialog that starts in Downloads.
function setDownloads() {
  session.defaultSession.on("will-download", (_e, item) => {
    const name = item.getFilename() || "aliskanlik-yedek.json";
    if (SMOKE) {
      const f = path.join(path.dirname(SMOKE), name);
      item.setSavePath(f);
      item.once("done", (_ev, state) => console.log(`SMOKE_DOWNLOAD ${state} ${f}`));
      return;
    }
    const opts = { title: "Yedeği kaydet", buttonLabel: "Kaydet", defaultPath: path.join(app.getPath("downloads"), name) };
    if (/\.json$/i.test(name)) opts.filters = [{ name: "Yedek dosyası (JSON)", extensions: ["json"] }];
    item.setSaveDialogOptions(opts);
  });
}

/* ---------------- menu, shortcuts, context menu ---------------- */
function setMenu() {
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" }]));
  } else {
    Menu.setApplicationMenu(null);
  }
}

// Without a menu, Windows/Linux lose the default accelerators; bring back the useful ones.
function addShortcuts(w) {
  const wc = w.webContents;
  wc.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    const mod = input.control || input.meta;
    const key = input.key;
    const zoom = (d) => wc.setZoomLevel(d === 0 ? 0 : Math.max(-3, Math.min(4, wc.getZoomLevel() + d)));
    let handled = true;
    if (mod && (key === "+" || key === "=")) zoom(0.5);
    else if (mod && key === "-") zoom(-0.5);
    else if (mod && key === "0") zoom(0);
    else if (key === "F5" || (mod && !input.shift && key.toLowerCase() === "r")) wc.reload();
    else if (key === "F11") w.setFullScreen(!w.isFullScreen());
    else if (key === "F12" || (mod && input.shift && key.toLowerCase() === "i")) wc.toggleDevTools();
    else handled = false;
    if (handled) e.preventDefault();
  });
}

function addContextMenu(w) {
  w.webContents.on("context-menu", (_e, p) => {
    let items = null;
    if (p.isEditable) {
      const f = p.editFlags;
      items = [
        { label: "Geri al", role: "undo", enabled: f.canUndo },
        { label: "Yinele", role: "redo", enabled: f.canRedo },
        { type: "separator" },
        { label: "Kes", role: "cut", enabled: f.canCut },
        { label: "Kopyala", role: "copy", enabled: f.canCopy },
        { label: "Yapıştır", role: "paste", enabled: f.canPaste },
        { type: "separator" },
        { label: "Tümünü seç", role: "selectAll", enabled: f.canSelectAll },
      ];
    } else if (p.selectionText && p.selectionText.trim()) {
      items = [{ label: "Kopyala", role: "copy" }];
    }
    if (items) Menu.buildFromTemplate(items).popup({ window: w });
  });
}

/* ---------------- window state ---------------- */
const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    const num = (v) => Number.isFinite(v) ? Math.round(v) : undefined;
    const out = {
      x: num(s.x), y: num(s.y),
      width: Math.max(MIN_SIZE.width, num(s.width) || DEFAULT_SIZE.width),
      height: Math.max(MIN_SIZE.height, num(s.height) || DEFAULT_SIZE.height),
      maximized: s.maximized === true,
    };
    if (out.x === undefined || out.y === undefined || !isVisible(out)) { delete out.x; delete out.y; }
    return out;
  } catch {
    return null;
  }
}

// True when the title bar area is on some connected display (monitor may have been unplugged).
function isVisible(b) {
  return screen.getAllDisplays().some(({ workArea: a }) =>
    b.x + b.width - 60 > a.x && b.x + 60 < a.x + a.width && b.y + 20 > a.y && b.y + 20 < a.y + a.height);
}

function trackWindowState(w) {
  let t = null;
  const save = () => {
    clearTimeout(t);
    if (w.isDestroyed() || w.isMinimized() || w.isFullScreen()) return;
    const b = w.getNormalBounds();
    const data = JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height, maximized: w.isMaximized() });
    try {
      const f = stateFile(), tmp = f + ".tmp";
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, f);
    } catch {}
  };
  const later = () => { clearTimeout(t); t = setTimeout(save, 600); };
  ["resize", "move", "maximize", "unmaximize"].forEach((ev) => w.on(ev, later));
  w.on("close", save);
}

/* ---------------- main window ---------------- */
function windowIcon() {
  const candidates = [path.join(__dirname, "..", "build", "icon.png"), path.join(WWW, "icons", "icon-512.png")];
  return candidates.find((f) => { try { return fs.statSync(f).isFile(); } catch { return false; } });
}

function createWindow() {
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const saved = SMOKE ? null : loadWindowState();
  const bounds = saved || {
    width: Math.max(MIN_SIZE.width, Math.min(DEFAULT_SIZE.width, wa.width)),
    height: Math.max(MIN_SIZE.height, Math.min(DEFAULT_SIZE.height, wa.height)),
  };

  win = new BrowserWindow({
    title: APP_NAME,
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    minWidth: MIN_SIZE.width, minHeight: MIN_SIZE.height,
    center: bounds.x === undefined,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? BG_DARK : BG_LIGHT,
    icon: windowIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  win.removeMenu();

  win.once("ready-to-show", () => {
    if (saved && saved.maximized) win.maximize();
    win.show();
  });
  win.on("closed", () => { win = null; });

  if (!SMOKE) trackWindowState(win);
  addShortcuts(win);
  addContextMenu(win);
  if (SMOKE) runSmoke(win, SMOKE);

  win.loadURL(START_URL);
}

/* ---------------- smoke test hook ---------------- */
function runSmoke(w, pngPath) {
  const wc = w.webContents;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const levels = ["verbose", "info", "warning", "error"];
  const origError = console.error;
  console.error = (...a) => { smokeErrors.push("main: " + a.map(String).join(" ").slice(0, 300)); origError(...a); };
  const guard = setTimeout(() => { console.log("SMOKE: FAIL (zaman aşımı)"); app.exit(2); }, 60000);

  // Electron <=31 passes (event, level, message, line, sourceId); newer versions pass the details on the event.
  wc.on("console-message", (e, level, message, line, sourceId) => {
    if (e && typeof e.message === "string") ({ level, message, lineNumber: line, sourceId } = e);
    const lv = typeof level === "number" ? levels[level] || String(level) : String(level);
    console.log(`[renderer:${lv}] ${message} (${sourceId}:${line})`);
    if (lv === "error") smokeErrors.push(message);
  });
  wc.on("did-fail-load", (_e, code, desc, url) => smokeErrors.push(`did-fail-load ${code} ${desc} ${url}`));
  wc.on("render-process-gone", (_e, d) => smokeErrors.push(`render-process-gone ${d.reason}`));

  wc.once("did-finish-load", async () => {
    try {
      await delay(1500);
      if (process.env.ALISKANLIK_SMOKE_JS) {
        const r = await wc.executeJavaScript(process.env.ALISKANLIK_SMOKE_JS, true);
        console.log("SMOKE_JS_RESULT " + JSON.stringify(r));
        await delay(800);
      }
      const img = await wc.capturePage();
      fs.writeFileSync(pngPath, img.toPNG());
      const sz = img.getSize();
      console.log(`SMOKE_SCREENSHOT ${pngPath} ${sz.width}x${sz.height}`);
      wc.session.flushStorageData();
    } catch (err) {
      smokeErrors.push(String(err && err.stack || err));
    }
    clearTimeout(guard);
    console.log(smokeErrors.length ? `SMOKE: FAIL (${smokeErrors.length} hata)\n  ${smokeErrors.join("\n  ")}` : "SMOKE: OK");
    // Graceful quit on success (flushes the profile to disk); Electron ignores process.exitCode, so force 1 on failure.
    if (smokeErrors.length) app.once("quit", () => app.exit(1));
    setTimeout(() => w.close(), 300);
  });
}
