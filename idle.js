/* Jukebox Catalog: the idle screen and auto-lock.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   Idle screen + auto-lock
   ========================================================= */
let idleTimer;
function bump() { clearTimeout(idleTimer); idleTimer = setTimeout(goIdle, idleMs()); }
function lockManage() { ui.unlocked = false; ui.pin = ''; ui.pinValue = ''; ui.pinError = ''; ui.manage = 'home'; ui.resetArmed = false; }
function goIdle() {
  if (!$('#askWrap').hidden) { bump(); return; }   // don't interrupt a print question
  lockManage();
  closeSheet();
  closeHelp();
  clearFilters(); ui.q = ''; $('#q').value = '';
  setView('find');
  showIdle();
}
// Two rows of covers drifting in opposite directions. Each row holds enough covers to fill a wide
// screen and repeats once, so the loop is seamless. With only a few discs loaded, covers from the
// rest of the collection fill in, and the heading changes to match.
const IDLE_MIN = 12;          // covers per row before it repeats
const IDLE_SPEED = 20;        // pixels per second
const IDLE_STEP = 168;        // one cover (150px) plus the gap (18px)
function showIdle() {
  // What's loaded in either jukebox.
  const inJukeboxes = Object.values(JUKEBOXES).flatMap(jb => Object.values(state[jb.stateKey] || {}).map(v => v.id));
  const loaded = [...new Set(inJukeboxes)].filter(id => BY_ID[id]);
  let ids = loaded.slice();
  if (ids.length < IDLE_MIN) {
    const rest = Store.albums().map(a => a.id).filter(id => !ids.includes(id)).sort((x, y) => hash(x) - hash(y));
    ids = ids.concat(rest.slice(0, IDLE_MIN - ids.length));
  }
  const list = ids.map(id => BY_ID[id]);
  if (!list.length) return;
  $('#idle h2').textContent = ids.length === loaded.length ? 'Now in the Jukebox' : 'Jukebox Catalog';
  // Enough covers for two different rows: split them. Otherwise both rows show all of them, the second one shifted.
  const half = Math.ceil(list.length / 2);
  const rowA = list.length >= IDLE_MIN * 2 ? list.slice(0, half) : list;
  const rowB = list.length >= IDLE_MIN * 2 ? list.slice(half) : list.slice(half).concat(list.slice(0, half));
  const fill = items => { let out = items.slice(); while (out.length < IDLE_MIN) out = out.concat(items); return out; };
  const row = (items, cls) => {
    const seq = fill(items);
    const secs = Math.round(seq.length * IDLE_STEP / IDLE_SPEED);   // same speed however many covers
    return `<div class="idle-row ${cls}" style="animation-duration:${secs}s">${seq.concat(seq).map(coverHTML).join('')}</div>`;
  };
  $('#idleRows').innerHTML = row(rowA, '') + row(rowB, 'rev');
  $('#idle').classList.toggle('still', !motionOn());
  $('#idle').hidden = false;
}
