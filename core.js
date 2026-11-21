/* Jukebox Catalog: config, helpers, storage, and screen state. Everything else reads from here.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   Config
   ========================================================= */
const USER = window.JUKEBOX_CONFIG || {};
const API_KEY = 'jukebox-catalog-api';
// Only a Google Apps Script address is accepted from a link, so a crafted link can't send the PIN elsewhere.
const GOOGLE_API = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
function findApiUrl() {
  const fromConfig = String(USER.apiUrl || '').trim();
  if (fromConfig) return fromConfig;
  const m = /[#&]api=([^&]*)/.exec(location.hash || '');
  let fromPage = null;
  try { fromPage = m ? decodeURIComponent(m[1]).trim() : null; } catch (e) { fromPage = null; }
  try {
    if (fromPage === 'off') { localStorage.removeItem(API_KEY); return ''; }
    if (fromPage && GOOGLE_API.test(fromPage)) { localStorage.setItem(API_KEY, fromPage); return fromPage; }
    const saved = localStorage.getItem(API_KEY) || '';
    return GOOGLE_API.test(saved) ? saved : '';
  } catch (e) {
    return fromPage && GOOGLE_API.test(fromPage) ? fromPage : '';   // storage blocked: use the link only
  }
}
const API_URL = findApiUrl();
const LIVE = !!API_URL;
const CONFIG = {
  apiUrl: API_URL,
  printing: USER.printing !== false,
  // The jukebox itself (name, slots, selection codes, card size) is described in jukeboxes.js.
  idleMinutes: 2,
  newDays: 14,
  paper: 'letter',      // binder page size; A5 would need its own entry in PAPER
  demoKey: 'jukebox-catalog-demo-v3',
  cacheKey: 'jukebox-catalog-cache-v1',
  refreshMs: 10 * 60 * 1000,
};
const PAPER = {
  letter: { ratio: '8.5 / 11', twoColAfter: 16 },
};

function pad2(n) { return String(n).padStart(2, '0'); }

// Discogs genre names, shortened for the filter chips.
const GENRE_LABELS = { 'Funk / Soul': 'Funk & Soul', 'Folk, World, & Country': 'Folk & Country' };
const GENRE_ORDER = ['Rock', 'Pop', 'Funk & Soul', 'Jazz', 'Blues', 'Folk & Country', 'Country', 'Folk', 'Reggae', 'Latin', 'World', 'Electronic', 'Hip Hop', 'Classical', 'Stage & Screen'];

const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }


/* =========================================================
   Helpers
   ========================================================= */
const $ = sel => document.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const decadeOf = y => Math.floor(y / 10) * 10;
const decadeLabel = d => (d >= 2000 ? d + 's' : String(d).slice(2) + 's');
const fileLetter = a => { const c = String(a.sortName).replace(/^[^A-Za-z0-9]+/, '').charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const when = ts => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const clock = ts => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const byArtist = (a, b) => String(a.sortName).localeCompare(String(b.sortName)) || String(a.title).localeCompare(String(b.title));
const discLabel = (a, disc) => (a.discs.length > 1 ? ` (disc ${disc} of ${a.discs.length})` : '');
const byCardNo = (x, y) => +x.split(':')[1] - +y.split(':')[1];

function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const SCHEMES = [
  ['#b8432f', '#f2c14e', '#fff7e8'], ['#1f3a5f', '#e98a3c', '#f7efe2'], ['#2f6f64', '#e9d8a6', '#fdf8ec'],
  ['#e3b23c', '#2b2118', '#2b2118'], ['#5b2a4a', '#e7a1b0', '#fbeef2'], ['#24452f', '#b6d369', '#f3f8e6'],
  ['#3c4a57', '#9cc9e3', '#eef6fb'], ['#efe3cf', '#c2412d', '#2a1a12'], ['#7a3b1d', '#f0a35e', '#fff1e2'],
  ['#14213d', '#fca311', '#f5f5f5'], ['#6d597a', '#eaac8b', '#fff4ec'], ['#d9d4c7', '#355070', '#1e2a38'],
];
const PATTERNS = [
  (b, a) => `repeating-radial-gradient(circle at 72% 28%, ${a} 0 5%, ${b} 5% 11%)`,
  (b, a) => `repeating-linear-gradient(180deg, ${b} 0 14%, ${a} 14% 20%)`,
  (b, a) => `linear-gradient(135deg, ${b} 0 52%, ${a} 52% 100%)`,
  (b, a) => `radial-gradient(circle at 50% 108%, ${a} 0 46%, ${b} 46.5% 100%)`,
  (b, a) => `radial-gradient(circle, ${a} 0 22%, transparent 23%) 0 0 / 25% 25%, ${b}`,
  (b, a) => `linear-gradient(90deg, ${b} 0 64%, ${a} 64% 70%, ${b} 70% 78%, ${a} 78% 80%, ${b} 80%)`,
];
// The album's Discogs cover when there is one, over a generated pattern that shows if the image fails.
function coverHTML(a) {
  const h = hash(a.id + a.title);
  const [bg, ac, fg] = SCHEMES[h % SCHEMES.length];
  const pat = PATTERNS[(h >>> 8) % PATTERNS.length](bg, ac);
  const img = a.cover ? `<img src="${esc(a.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
  return `<span class="cover" style="background:${pat};--cv-bg:${bg};--cv-fg:${fg}" aria-hidden="true">${img}<span class="cv-text"><span class="cv-artist">${esc(a.artist)}</span><span class="cv-title">${esc(a.title)}</span></span></span>`;
}
function plateHTML(jb, slot, track) {
  const c = jb && jb.selection(slot, track);
  if (!c) return '';
  return `<span class="plate" title="Selection ${c.join('')}"><span class="sr-only">Selection </span><b>${c[0]}</b><b>${c[1]}</b></span>`;
}
function badgesHTML(a) {
  const slots = Store.slotsOf(a.id);
  const jb = jukeboxFor(a);
  let h = Store.isNew(a.id) ? '<span class="badge badge-new">New</span>' : '';
  if (a.format !== 'CD') h += `<span class="badge badge-shelf">${esc(a.format)}</span>`;
  if (jb) h += slots.length
    ? `<span class="badge badge-juke">${esc(jukeboxName(jb))} ${slots.map(s => jb.label(s.slot)).join(' + ')}</span>`
    : '<span class="badge badge-shelf">Shelf</span>';
  return h;
}
let toastTimer;
function toast(msg, sticky) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
}
// An in-page yes/no question (browser pop-ups don't suit a kiosk).
function ask(message, yesLabel, noLabel) {
  return new Promise(resolve => {
    $('#askText').textContent = message;
    $('#askYes').textContent = yesLabel;
    $('#askNo').textContent = noLabel;
    $('#askWrap').hidden = false;
    const done = v => { $('#askWrap').hidden = true; $('#askYes').onclick = $('#askNo').onclick = null; resolve(v); };
    $('#askYes').onclick = () => done(true);
    $('#askNo').onclick = () => done(false);
    $('#askYes').focus();
  });
}
const ICON = {
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.8"/></svg>',
  disc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
};

/* =========================================================
   UI state
   ========================================================= */
const ui = {
  view: 'find',
  q: '',
  decades: new Set(), genres: new Set(), tags: new Set(), formats: new Set(), onlyJuke: false,
  sort: 'artist',
  printPick: false,   // the slot grid under Pages to print, open or closed
  printPickAlbums: false, printQ: '',   // the album list under Pages to print, and its search text
  allSongs: false,
  unlocked: false, pin: '', pinError: '', pinValue: '', checkingPin: false,
  manage: 'home',            // home | swap-slot | swap-pick | swap-confirm | swap-done | print | history
  swap: { slot: null, incoming: null, fromAlbum: false, q: '' },
  sheet: null,               // { id, disc, track }
  resetArmed: false,
  lastSwap: null,            // { text, added } for the "Swap saved" screen
  busy: false,
};
