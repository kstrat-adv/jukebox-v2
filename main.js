/* Jukebox Catalog: the rail, events, and start-up. Loads last.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   Rail
   ========================================================= */
function renderRail() {
  $('#navManage').innerHTML = `${pinRequired() ? (ui.unlocked ? ICON.unlock : ICON.lock) : ICON.sliders}<span>Manage</span>`;
  let sync = '';
  const waiting = Saver.pending();
  if (LIVE && waiting) {
    const what = `${waiting} change${waiting > 1 ? 's' : ''}`;
    sync = remote.offline ? `<span class="rail-sync offline">Offline · ${what} waiting to save</span>`
      : Saver.needPin ? `<span class="rail-sync offline">${what} waiting for the PIN</span>`
      : `<span class="rail-sync">Saving ${what}…</span>`;
  } else if (LIVE) {
    sync = remote.offline
      ? `<span class="rail-sync offline">Offline${remote.loadedAt ? ` · saved copy from ${clock(remote.loadedAt)}` : ''}</span>`
      : remote.loadedAt ? `<span class="rail-sync">Updated ${clock(remote.loadedAt)}</span>` : '';
  }
  const filled = Object.values(JUKEBOXES).map(jb => `<span>${Store.filledCount(jb)} of ${jb.slots.count} in the ${esc(jukeboxName(jb))}</span>`).join('');
  $('#railStats').innerHTML = `<span>${Store.albums().length} albums</span>${filled}${sync}`;
  document.querySelectorAll('.nav-btn').forEach(b => {
    const on = b.dataset.view === ui.view && (!b.dataset.jukebox || b.dataset.jukebox === JUKEBOX.id);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

function setView(v, jukebox) {
  if (jukebox) setJukebox(jukebox);
  ui.view = v;
  ['find', 'jukebox', 'manage'].forEach(name => { $('#view-' + name).hidden = name !== v; });
  if (v === 'manage') { ui.manage = 'home'; ui.resetArmed = false; }
  renderRail();
  if (v === 'find') renderFind();
  if (v === 'jukebox') renderJukebox();
  if (v === 'manage') renderManage();
  $('#main').scrollTop = 0;
}


/* =========================================================
   Events
   ========================================================= */
function rerenderAfterChange() {
  renderRail();
  if (ui.view === 'find') renderFind();
  if (ui.view === 'jukebox') renderJukebox();
  if (ui.view === 'manage') renderManage();
  if (ui.sheet) renderSheet();
}
const fresh = () => ({ slot: null, incoming: null, fromAlbum: false, q: '' });

async function onClick(e) {
  const t = e.target.closest('button, [data-close-sheet], [data-help-close]');
  if (!t || t.id === 'askYes' || t.id === 'askNo') return;
  const d = t.dataset;

  if ('goIdle' in d) { goIdle(); return; }
  if ('helpOpen' in d) { openHelp(); return; }
  if ('helpClose' in d) { closeHelp(); return; }
  if (d.printGuide) { await printGuides(d.printGuide); return; }
  if ('helpStart' in d) {
    closeHelp(); closeSheet(); setView('manage');
    if (unlocked()) { ui.swap = fresh(); ui.manage = 'swap-slot'; renderManage(); }
    return;
  }
  if (d.view) { closeSheet(); setView(d.view, d.jukebox); return; }
  if ('closeSheet' in d) { closeSheet(); return; }
  if (d.open) { openAlbum(d.open, +d.disc || null, +d.track || null); return; }

  if (d.chip) {
    const set = { decade: ui.decades, genre: ui.genres, tag: ui.tags, format: ui.formats }[d.chip];
    const val = d.chip === 'decade' ? +d.value : d.value;
    if (set.has(val)) set.delete(val); else set.add(val);
    ui.allSongs = false;
    renderFind();
    return;
  }
  if (t.id === 'onlyJuke') { ui.onlyJuke = !ui.onlyJuke; renderFind(); return; }
  if (t.id === 'clearAll') { clearFilters(); renderFind(); return; }
  if (t.id === 'clearEverything') { clearFilters(); ui.q = ''; $('#q').value = ''; renderFind(); return; }
  if (t.id === 'qClear') { ui.q = ''; $('#q').value = ''; ui.allSongs = false; renderResults(); $('#q').focus(); return; }
  if (t.id === 'allSongs') { ui.allSongs = true; renderResults(); return; }
  if (d.sort) { ui.sort = d.sort; renderResults(); return; }

  if (d.slot && d.mode === 'open') { const v = (state[JUKEBOX.stateKey] || {})[+d.slot]; if (v) openAlbum(v.id, v.disc, null); return; }
  if (d.slot && d.mode === 'card') {
    // One title card or strip at a time (Pages to print → Add one), for a sheet that would otherwise print part empty.
    const jb = JUKEBOX, key = slotKeys(jb, +d.slot)[1], k = +key.split(':')[1];
    const covers = cardSlots(jb, k).map(s => jb.label(s));
    const what = covers.length > 1 ? `slots ${covers.join(' and ')}` : `record ${covers[0]} (${jb.selection(k, 1).join('')} and ${jb.selection(k, 2).join('')})`;
    await Actions.queue([key], `Added the ${jb.cardNoun} for ${what} to Pages to print.`);
    renderManage();
    return;
  }
  if (d.slot && d.mode === 'pick') {
    ui.swap.slot = +d.slot;
    ui.manage = ui.swap.fromAlbum ? 'swap-confirm' : 'swap-pick';
    ui.swap.q = '';
    renderManage(); $('#main').scrollTop = 0;
    return;
  }

  // Manage: keypad
  if (d.key) {
    if (ui.checkingPin) return;
    if (d.key === 'clear') ui.pin = '';
    else if (d.key === 'del') ui.pin = ui.pin.slice(0, -1);
    else if (ui.pin.length < 4) ui.pin += d.key;
    ui.pinError = '';
    if (ui.pin.length === 4) {
      const pin = ui.pin;
      ui.checkingPin = true; renderManage();
      const r = await Actions.verifyPin(pin);
      ui.checkingPin = false; ui.pin = '';
      if (r.ok) { ui.unlocked = true; ui.pinValue = pin; ui.manage = 'home'; toast('Manage is unlocked.'); Saver.kick(0); }
      else ui.pinError = r.net ? "Couldn't check the PIN. Check the Wi-Fi and try again." : (r.message || "That PIN didn't match. Try again.");
    }
    renderRail(); renderManage();
    return;
  }
  if (!unlocked() && !('closeSheet' in d)) {
    // Everything below needs Manage unlocked.
    if (d.manage || d.loadAlbum || d.tagAdd || d.tagRemove || d.queueAlbum) return;
  }
  if (d.pickJukebox) { setJukebox(d.pickJukebox); ui.swap = fresh(); renderRail(); renderManage(); return; }
  if (d.pickCard) { setJukebox(d.pickCard); ui.swap = fresh(); ui.manage = 'pick-card'; renderRail(); renderManage(); $('#main').scrollTop = 0; return; }
  if (d.manage) {
    if (d.manage === 'swap-slot' && !ui.swap.fromAlbum) ui.swap = fresh();
    if (d.manage === 'home') ui.swap = fresh();
    ui.manage = d.manage; ui.resetArmed = false;
    renderManage(); $('#main').scrollTop = 0;
    return;
  }
  if (('incoming' in d && t.classList.contains('pick')) || d.incoming === '') {
    if (d.incoming) { const i = d.incoming.lastIndexOf(':'); ui.swap.incoming = { id: d.incoming.slice(0, i), disc: +d.incoming.slice(i + 1) }; }
    else ui.swap.incoming = null;
    ui.manage = 'swap-confirm';
    renderManage(); $('#main').scrollTop = 0;
    return;
  }
  if ('swapConfirm' in d) {
    const slot = ui.swap.slot;
    const inc = ui.swap.incoming;
    const inA = inc && BY_ID[inc.id];
    const jb = JUKEBOX;
    const r = await Actions.swap(slot, inc, jb);
    if (!r.ok) return;
    ui.lastSwap = {
      text: inA ? `${jukeboxName(jb)} slot ${jb.label(slot)} now holds ${inA.title}${discLabel(inA, inc.disc)}.` : `${jukeboxName(jb)} slot ${jb.label(slot)} is now empty.`,
      added: 1 + (r.out ? 1 : 0) + (inc ? 1 : 0), cardNoun: jb.cardNoun,
    };
    ui.swap = fresh();
    ui.manage = 'swap-done';
    rerenderAfterChange();
    $('#main').scrollTop = 0;
    return;
  }
  if (d.loadAlbum) {
    const a = BY_ID[d.loadAlbum];
    const jb = jukeboxFor(a);
    if (!jb) return;
    setJukebox(jb.id);
    const disc = a.discs.map((_, i) => i + 1).find(x => Store.slotFor(a.id, x) === null);
    ui.swap = { slot: null, incoming: { id: a.id, disc }, fromAlbum: true, q: '' };
    closeSheet();
    ui.view = 'manage';
    ['find', 'jukebox', 'manage'].forEach(name => { $('#view-' + name).hidden = name !== 'manage'; });
    ui.manage = 'swap-slot';
    renderRail(); renderManage(); $('#main').scrollTop = 0;
    return;
  }
  if (d.printPage) { await printKeys([d.printPage]); return; }
  if ('printAll' in d) { await printKeys(state.reprint.slice()); return; }
  if ('clearPrinted' in d) { await Actions.clearPrinted(); renderManage(); return; }
  if ('skipAll' in d) {
    const keys = state.reprint.filter(k => !state.printed[k]);
    if (!keys.length) return;
    const ok = await ask(`Skip all ${keys.length} unprinted item${keys.length === 1 ? '' : 's'}? Each comes back only when a swap or a new album needs it.`, 'Skip them all', 'Keep the list');
    if (ok) await Actions.skipAll(keys);
    renderManage();
    return;
  }
  if (d.skipPage) {
    const kind = d.skipPage.split(':')[0], kjb = jukeboxByKey(kind);
    await Actions.skip(d.skipPage, kjb && kind === kjb.keys.card
      ? `Skipped. The ${jukeboxName(kjb)} keeps its old ${kjb.cardNoun}.`
      : kjb
      ? 'Skipped. The binder keeps its old index page.'
      : 'Skipped. The binder keeps its old page. You can reprint it from the album any time.');
    renderManage();
    return;
  }
  if (d.queueCards) {
    const jb = JUKEBOXES[d.queueCards];
    const cards = Math.ceil(jb.slots.count / jb.print.slotsPerCard);
    await Actions.queue(Array.from({ length: cards }, (_, i) => jb.keys.card + ':' + (jb.slots.first + i)), `Added all ${cards} ${jb.cardNoun}s to Pages to print.`);
    renderManage();
    return;
  }
  if (d.queueIndex) {
    const jb = JUKEBOXES[d.queueIndex];
    const pages = Math.ceil(jb.slots.count / jb.print.indexPerPage);
    await Actions.queue(Array.from({ length: pages }, (_, i) => jb.keys.index + ':' + (i + 1)), `Added ${pages} ${jukeboxName(jb)} index page${pages > 1 ? 's' : ''} to Pages to print.`);
    renderManage();
    return;
  }
  if ('queueAlbums' in d) {
    // The whole binder, in shelf order. For the first print or a fresh binder.
    const keys = Store.albums().slice().sort(byArtist).map(a => 'album:' + a.id);
    await Actions.queue(keys, `Added ${keys.length} album pages to Pages to print.`);
    renderManage();
    return;
  }
  if (d.queueAlbum) {
    await Actions.queue(['album:' + d.queueAlbum], "Added this album's page to Pages to print.");
    if (ui.view === 'manage') renderManage();
    return;
  }
  if ('sync' in d) { await Actions.sync(); rerenderAfterChange(); return; }
  if ('motion' in d) { await Actions.setMotion(!motionOn()); renderManage(); return; }
  if ('lock' in d) { lockManage(); toast('Manage is locked.'); rerenderAfterChange(); return; }
  if ('reset' in d) {
    if (!ui.resetArmed) { ui.resetArmed = true; renderManage(); return; }
    Actions.reset(); ui.resetArmed = false; clearFilters(); toast('Sample data reset.'); rerenderAfterChange();
    return;
  }
  if ('idlePreview' in d) { showIdle(); return; }

  if (d.tagAdd && ui.sheet) { await Actions.addTag(ui.sheet.id, d.tagAdd); renderSheet(); if (ui.view === 'find') renderFind(); return; }
  if (d.tagRemove && ui.sheet) { await Actions.removeTag(ui.sheet.id, d.tagRemove); renderSheet(); if (ui.view === 'find') renderFind(); return; }
}

document.addEventListener('click', e => {
  onClick(e).catch(err => { ui.busy = false; toast('Something went wrong: ' + (err && err.message ? err.message : err)); });
});

document.addEventListener('submit', e => {
  if (e.target.id !== 'tagForm') return;
  e.preventDefault();
  const input = $('#tagNew');
  if (!ui.sheet || !unlocked() || !input.value.trim()) return;
  Actions.addTag(ui.sheet.id, input.value);
  renderSheet();
  if (ui.view === 'find') renderFind();
});

document.addEventListener('input', e => {
  if (e.target.id === 'q') { ui.q = e.target.value; ui.allSongs = false; renderResults(); }
  if (e.target.id === 'pickQ') { ui.swap.q = e.target.value; renderPickList(); }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('#askWrap').hidden) return;
    if (!$('#idle').hidden) { $('#idle').hidden = true; return; }
    if (!$('#helpWrap').hidden) { closeHelp(); return; }
    if (ui.sheet) closeSheet();
  }
});

// A cover image that fails to load is removed, so the pattern and title show instead.
document.addEventListener('error', e => {
  const el = e.target;
  if (el && el.tagName === 'IMG' && el.parentNode && el.parentNode.classList && el.parentNode.classList.contains('cover')) el.remove();
}, true);

$('#idle').addEventListener('click', () => { $('#idle').hidden = true; bump(); if (quietMoment()) refresh(true); });
// A new #api= address typed into the page address takes effect right away.
window.addEventListener('hashchange', () => { if (/[#&]api=/.test(location.hash)) location.reload(); });
['pointerdown', 'keydown', 'input'].forEach(ev => document.addEventListener(ev, bump, { passive: true }));

/* =========================================================
   Start
   ========================================================= */
if (LIVE) {
  const cached = readJSON(CONFIG.cacheKey);
  if (cached && cached.ok) {
    try { applyCatalog(cached); Saver.applied.forEach(op => applyLocal(op, true)); Saver.queue.forEach(op => applyLocal(op, true)); } catch (e) { /* stale cache: ignore */ }
  }
  renderRail(); renderFind();
  if (Saver.pending()) Saver.kick(0); else refresh(true);   // unsaved changes from last time go first
  setInterval(() => { if (quietMoment()) refresh(true); }, CONFIG.refreshMs);
} else {
  $('#demoNote').hidden = false;
  state = demoLoad();
  setAlbums(demoAlbums());
  reindex();
  renderRail(); renderFind();
}
bump();
