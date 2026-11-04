/* Jukebox Catalog: the catalog, its state, the Sheet connection, and background saving.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   Data
   ========================================================= */
let ALBUMS = [];
let BY_ID = {};
let state = { slots: {}, tags: {}, vocab: [], swapLog: [], reprint: [], printed: {}, arrived: [], newIds: [] };
const remote = { settings: {}, lastSync: {}, loadedAt: 0, offline: false, loaded: false, pinRequired: false };

function prepAlbum(a) {
  a.genres = (a.genres || []).map(g => GENRE_LABELS[g] || g);
  a.styles = a.styles || [];
  a.format = a.format || 'CD';
  a.discs = a.discs && a.discs.length ? a.discs : [[]];
  a._hay = norm([a.artist, a.sortName, a.title].join(' '));
  a._tracks = a.discs.map(d => d.map(t => norm(t || '')));
  return a;
}
function setAlbums(list) {
  ALBUMS = list.map(prepAlbum);
  BY_ID = Object.fromEntries(ALBUMS.map(a => [a.id, a]));
}

let LOC = {};          // "id:disc" -> slot
let SLOTS_BY_ID = {};  // id -> [{slot, disc}]
function reindex() {
  LOC = {}; SLOTS_BY_ID = {};
  Object.entries(state.slots).forEach(([s, v]) => {
    LOC[v.id + ':' + v.disc] = +s;
    (SLOTS_BY_ID[v.id] = SLOTS_BY_ID[v.id] || []).push({ slot: +s, disc: v.disc });
  });
  Object.values(SLOTS_BY_ID).forEach(list => list.sort((a, b) => a.disc - b.disc));
}

// ---- Live: the catalog from the Sheet ----
function validKey(k) {
  const [kind, ref] = String(k).split(':');
  return kind === 'album' ? !!BY_ID[ref] : (kind === 'index' || kind === 'card') && /^\d+$/.test(ref || '');
}
function applyCatalog(cat) {
  setAlbums(cat.albums.map(a => {
    const discs = (cat.tracks[a.releaseId] || []).map(d => Array.from(d, t => t || ''));
    while (discs.length < (a.discs || 1)) discs.push([]);
    return {
      id: a.id, artist: a.artist, sortName: a.sortName || a.artist, title: a.title, origYear: a.origYear || 0,
      pressYear: a.pressYear || 0, format: a.format, genres: a.genres, styles: a.styles, label: a.label,
      cover: a.cover, added: a.added, removed: !!a.removed, discs,
    };
  }));
  state.slots = {};
  Object.keys(cat.slots || {}).forEach(k => {
    const v = cat.slots[k];
    if (BY_ID[v.id] && +k >= 0 && +k < JUKEBOX.slots.count) state.slots[+k] = { id: v.id, disc: Number(v.disc) || 1 };
  });
  state.tags = Object.fromEntries(cat.albums.map(a => [a.id, a.tags || []]));
  state.vocab = cat.tags || [];
  const list = (cat.printList || []).filter(p => validKey(p.key)).sort((x, y) => x.queued - y.queued);
  state.reprint = list.map(p => p.key);
  state.printed = {};
  list.forEach(p => { if (p.printed) state.printed[p.key] = p.printed; });
  state.swapLog = cat.swapLog || [];
  remote.settings = cat.settings || {};
  remote.pinRequired = cat.pinRequired !== false;   // an older script that doesn't say still wants its PIN
  remote.lastSync = cat.lastSync || {};
  remote.loadedAt = cat.generatedAt || Date.now();
  remote.loaded = true;
  reindex();
}

// ---- Demo: sample albums, changes kept on this device ----
const SAMPLE = window.JUKEBOX_SAMPLE || { raw: '', pending: [], tagVocab: [], tags: {}, slots: [] };
function demoAlbums() {
  const split = s => s.split(',').map(x => x.trim()).filter(Boolean);
  return SAMPLE.raw.trim().split('\n').filter(Boolean).map(line => {
    const f = line.split('|').map(s => s.trim());
    return {
      id: f[0], artist: f[1], sortName: f[2], title: f[3], origYear: +f[4], pressYear: +f[5], format: 'CD',
      genres: split(f[6]), styles: split(f[7]), label: f[8], cover: '', added: '',
      discs: f[9].split('##').map(d => d.split(';').map(t => t.trim()).filter(Boolean)),
    };
  });
}
function demoFresh() {
  const slots = {};
  SAMPLE.slots.forEach(([s, id, d]) => { slots[s] = { id, disc: d }; });
  return { v: 3, slots, tags: JSON.parse(JSON.stringify(SAMPLE.tags)), vocab: SAMPLE.tagVocab.slice(),
    arrived: [], newIds: [], swapLog: [], reprint: [], printed: {} };
}
function demoLoad() { const s = readJSON(CONFIG.demoKey); return s && s.v === 3 ? s : demoFresh(); }
function demoSave() { writeJSON(CONFIG.demoKey, state); reindex(); }

/* =========================================================
   Settings
   ========================================================= */
const LOCAL_SETTINGS_KEY = CONFIG.demoKey + '-settings';
let localSettings = readJSON(LOCAL_SETTINGS_KEY) || {};
function setting(key) { return LIVE ? remote.settings[key] : localSettings[key]; }
// The PIN is optional: it's only asked for when the Sheet's Settings tab has one. The demo never asks.
function pinRequired() { return LIVE && remote.pinRequired; }
function unlocked() { return !pinRequired() || ui.unlocked; }
function idleMs() { return (Number(setting('idle_minutes')) || CONFIG.idleMinutes) * 60000; }
function jukeboxName() { return setting('jukebox_name') || JUKEBOX.name; }
function deviceReducesMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
function motionSetting() { const m = String(setting('idle_motion') || 'auto').toLowerCase(); return m === 'on' || m === 'off' ? m : 'auto'; }
function motionOn() { const m = motionSetting(); return m === 'on' ? true : m === 'off' ? false : !deviceReducesMotion(); }

/* =========================================================
   Reading the catalog
   ========================================================= */
const Store = {
  albums() {
    return LIVE ? ALBUMS.filter(a => !a.removed)
      : ALBUMS.filter(a => !SAMPLE.pending.includes(a.id) || state.arrived.includes(a.id));
  },
  slotsOf(id) { return SLOTS_BY_ID[id] || []; },
  slotFor(id, disc) { const k = id + ':' + disc; return k in LOC ? LOC[k] : null; },   // slot 00 is a real slot, so check for null
  tagsOf(id) { return state.tags[id] || []; },
  filledCount() { return Object.keys(state.slots).length; },
  isNew(id) {
    if (!LIVE) return (state.newIds || []).includes(id);
    const a = BY_ID[id];
    const t = a && a.added ? Date.parse(a.added) : 0;
    return t > 0 && Date.now() - t < (Number(setting('new_days')) || CONFIG.newDays) * 86400000;
  },
  unprintedCount() { return state.reprint.filter(k => !state.printed[k]).length; },
};

/* =========================================================
   Saving changes
   A change shows on screen right away. In live mode it also joins a save list that goes to the Sheet
   in the background, several changes per trip. The list is kept on this device, so a Wi-Fi drop or a
   reload doesn't lose anything: it's sent as soon as the Sheet can be reached again.
   ========================================================= */
const Api = {
  async load() {
    const url = CONFIG.apiUrl + (CONFIG.apiUrl.indexOf('?') >= 0 ? '&' : '?') + 'action=catalog&t=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    const cat = await res.json();
    if (!cat.ok) throw new Error(cat.error || 'The catalog did not load.');
    return cat;
  },
  async post(action, body) {
    // text/plain keeps this a "simple" request, which Apps Script accepts from another site.
    const res = await fetch(CONFIG.apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action, pin: ui.pinValue }, body || {})),
    });
    return res.json();
  },
};

const PENDING_KEY = 'jukebox-catalog-pending-v1';
const Saver = {
  queue: LIVE ? (readJSON(PENDING_KEY) || []) : [],
  sending: false,
  gen: 0,          // goes up after each save, so a catalog load that started before it is ignored
  retryMs: 0,
  timer: null,
  needPin: false,  // a PIN was set or changed in the Sheet: changes wait until it's entered
  pending() { return this.queue.length; },
  push(op) { this.queue.push(op); this.persist(); renderRail(); this.kick(300); },   // a short wait lets quick taps share a trip
  persist() { writeJSON(PENDING_KEY, this.queue); },
  kick(ms) { this.needPin = false; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), ms || 0); },
  async flush() {
    if (this.sending || !this.queue.length) return;
    this.sending = true;
    renderRail();
    const batch = this.queue.slice(0, 50);
    let reload = false, waitForPin = false;
    try {
      const r = await Api.post('batch', { ops: batch });
      remote.offline = false;
      if (r.ok) {
        this.queue.splice(0, batch.length);
        this.gen++;
        this.retryMs = 0;
        const bad = (r.results || []).filter(x => !x.ok);
        if (bad.length) { toast(bad[0].message || "Some changes didn't save."); reload = true; }
      } else if (r.error === 'pin' || r.error === 'locked') {
        waitForPin = this.needPin = true;      // the changes wait until the PIN is entered again
        lockManage();
        ui.pinError = r.message || '';
        rerenderAfterChange();
        toast(r.message || 'Enter the PIN to save your changes.');
      } else if (r.error === 'busy') {
        this.retryMs = 30000;                  // the nightly Discogs sync is running
      } else {
        this.queue.splice(0, batch.length);    // refused: drop it and show what the Sheet has
        toast(r.message || "That change didn't save.");
        reload = true;
      }
    } catch (e) {
      remote.offline = true;
      this.retryMs = Math.min(Math.max(this.retryMs * 2, 5000), 60000);   // try again in 5 s, 10 s, … up to a minute
    } finally {
      this.sending = false;
      this.persist();
      renderRail();
    }
    if (this.queue.length) { if (!waitForPin) this.kick(this.retryMs); }
    else scheduleRefresh(reload ? 0 : 15000);    // then check the Sheet once things are quiet
  },
};

let refreshTimer;
// Waits for a quiet moment, so a fresh copy never redraws the screen in the middle of a swap.
function scheduleRefresh(ms) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { if (quietMoment()) refresh(true); else scheduleRefresh(15000); }, ms);
}
// Safe moments to redraw from the Sheet: nothing waiting to save, and nobody mid-swap or mid-print.
function quietMoment() {
  return !Saver.pending() && !Saver.sending && !ui.sheet && $('#askWrap').hidden &&
    !(ui.view === 'manage' && ui.manage !== 'home' && ui.manage !== 'history');
}

async function refresh(quiet) {
  if (!LIVE) return true;
  const gen = Saver.gen;
  try {
    const cat = await Api.load();
    if (gen !== Saver.gen || Saver.sending) return false;   // a save landed meanwhile; the next load includes it
    applyCatalog(cat);
    Saver.queue.forEach(op => applyLocal(op, true));        // changes still waiting to save stay on screen
    remote.offline = false;
    writeJSON(CONFIG.cacheKey, cat);
    rerenderAfterChange();
    return true;
  } catch (e) {
    remote.offline = true;
    renderRail();
    if (!remote.loaded) renderFind();
    if (!quiet) toast("Couldn't reach the catalog. Check the Wi-Fi.");
    return false;
  }
}

function queueLocal(key) {
  if (!state.reprint.includes(key)) state.reprint.push(key);
  delete state.printed[key];   // changed again since it was printed, so it needs a fresh print
}
// Same clean-up the Sheet's script does: no semicolons (they separate tags), at most 30 characters.
function cleanTag(tag) {
  return String(tag).replace(/[;\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30).trim();
}
function tagName(t) { return state.vocab.find(v => v.toLowerCase() === t.toLowerCase()) || t; }

// One change, applied to what's on screen. The Sheet's script makes the same change when it gets it.
// replay is true when a change still waiting to save is laid back over a fresh copy of the catalog.
function applyLocal(op, replay) {
  switch (op.action) {
    case 'swap': {
      const out = state.slots[op.slot] || null;
      if (op.incoming) state.slots[op.slot] = { id: op.incoming.id, disc: op.incoming.disc }; else delete state.slots[op.slot];
      if (!replay) state.swapLog.unshift({ at: Date.now(), slot: op.slot, out, in: op.incoming || null });
      queueLocal('index:' + (Math.floor(op.slot / JUKEBOX.print.indexPerPage) + 1));
      queueLocal('card:' + Math.floor(op.slot / JUKEBOX.print.slotsPerCard));
      if (out && !(op.incoming && out.id === op.incoming.id && out.disc === op.incoming.disc)) queueLocal('album:' + out.id);
      if (op.incoming) queueLocal('album:' + op.incoming.id);
      break;
    }
    case 'tagAdd': {
      const name = tagName(op.tag);
      if (!state.vocab.includes(name)) state.vocab.push(name);
      const list = state.tags[op.id] = state.tags[op.id] || [];
      if (!list.includes(name)) list.push(name);
      break;
    }
    case 'tagRemove': state.tags[op.id] = (state.tags[op.id] || []).filter(x => x !== op.tag); break;
    case 'queue': op.keys.forEach(queueLocal); break;
    case 'printed': { const now = Date.now(); op.keys.forEach(k => { if (state.reprint.includes(k)) state.printed[k] = state.printed[k] || now; }); break; }
    case 'skip': state.reprint = state.reprint.filter(k => k !== op.key); delete state.printed[op.key]; break;
    case 'clearPrinted': state.reprint = state.reprint.filter(k => !state.printed[k]); state.printed = {}; break;
    case 'setting':
      if (LIVE) remote.settings[op.key] = op.value;
      else { localSettings = Object.assign({}, localSettings, { [op.key]: op.value }); writeJSON(LOCAL_SETTINGS_KEY, localSettings); }
      break;
    default: break;
  }
  reindex();
}
// Show the change now; in live mode, also send it to the Sheet.
function change(op, msg) {
  applyLocal(op);
  if (LIVE) Saver.push(op); else demoSave();
  if (msg) toast(msg);
  return { ok: true };
}

const Actions = {
  // Only used when a PIN is set in the Sheet. Returns { ok, message }, or { net: true } when the Sheet can't be reached.
  async verifyPin(pin) {
    try {
      const r = await Api.post('verifyPin', { pin });
      return { ok: !!r.ok, message: r.message };
    } catch (e) {
      return { ok: false, net: true };
    }
  },
  swap(slot, incoming) {
    const out = state.slots[slot] || null;
    change({ action: 'swap', slot, incoming: incoming ? { id: incoming.id, disc: incoming.disc } : null });
    return { ok: true, out };
  },
  addTag(id, tag) {
    const t = cleanTag(tag);
    if (!t) return { ok: false };
    const name = tagName(t);
    if (Store.tagsOf(id).includes(name)) { toast('That tag is already on this album.'); return { ok: true }; }
    return change({ action: 'tagAdd', id, tag: t }, `Added ${name}.`);
  },
  removeTag(id, tag) { return change({ action: 'tagRemove', id, tag }, `Removed ${tag}.`); },
  queue(keys, msg) { return change({ action: 'queue', keys }, msg); },
  printed(keys) { return change({ action: 'printed', keys }); },
  skip(key, msg) { return change({ action: 'skip', key }, msg); },
  clearPrinted() { return change({ action: 'clearPrinted' }, 'Printed items cleared from the list.'); },
  setMotion(on) {
    return change({ action: 'setting', key: 'idle_motion', value: on ? 'on' : 'off' }, on ? 'Moving covers are on.' : 'Moving covers are off.');
  },
  // Checking Discogs is the one change that waits for the Sheet, since the new albums come back with the answer.
  async sync() {
    if (!LIVE) {
      const incoming = SAMPLE.pending.filter(id => !state.arrived.includes(id));
      incoming.forEach(id => { state.arrived.push(id); state.newIds.push(id); queueLocal('album:' + id); });
      demoSave();
      toast(incoming.length ? `${incoming.length} new album from Discogs: ${incoming.map(id => BY_ID[id].title).join(', ')}.` : 'No new albums since the last check.');
      return { ok: true };
    }
    if (ui.busy) return { ok: false };
    ui.busy = true;
    toast('Checking Discogs. This can take up to half a minute…', true);
    try {
      const r = await Api.post('sync', {});
      if (!r.ok) {
        if (r.error === 'pin' || r.error === 'locked') { lockManage(); ui.pinError = r.message || ''; rerenderAfterChange(); }
        toast(r.message || "Discogs didn't answer. Try again in a few minutes.");
        return r;
      }
      const s = r.result || {};
      let m = s.added ? `${s.added} new album${s.added > 1 ? 's' : ''} from Discogs.` : 'No new albums since the last check.';
      if (s.remaining) m += ` Details for ${s.remaining} more are still coming in.`;
      toast(m);
      if (!Saver.pending()) refresh(true);
      return r;
    } catch (e) {
      toast("Couldn't reach the catalog. Check the Wi-Fi and try again.");
      return { ok: false };
    } finally {
      ui.busy = false;
    }
  },
  reset() { state = demoFresh(); demoSave(); },
};
