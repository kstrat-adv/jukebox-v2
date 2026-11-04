/* Jukebox Catalog: In the jukebox: the slots grid.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   In the jukebox
   ========================================================= */
function slotsGridHTML(mode) {
  let h = '';
  for (let s = 0; s < JUKEBOX.slots.count; s++) {
    const v = state.slots[s];
    const a = v && BY_ID[v.id];
    const sel = mode === 'pick' && ui.swap.slot === s ? ' is-selected' : '';
    if (a) {
      const extra = a.discs.length > 1 ? ` · disc ${v.disc}` : '';
      h += `<button class="slot${sel}" data-slot="${s}" data-mode="${mode}"><span class="slot-no">${pad2(s)}</span>${coverHTML(a)}
        <span class="slot-title">${esc(a.title)}</span><span class="slot-artist">${esc(a.artist)}${extra}</span></button>`;
    } else if (mode === 'pick') {
      h += `<button class="slot empty${sel}" data-slot="${s}" data-mode="pick"><span class="slot-no">${pad2(s)}</span><span class="slot-hole">Empty</span></button>`;
    } else {
      h += `<div class="slot empty"><span class="slot-no">${pad2(s)}</span><span class="slot-hole">Empty</span></div>`;
    }
  }
  return h;
}
function renderJukebox() {
  const filled = Store.filledCount();
  $('#view-jukebox').innerHTML = `
    <header class="view-head"><h1>Now in the Jukebox</h1>
      <p>${filled} of ${JUKEBOX.slots.count} slots are filled${LIVE ? '' : ' in this sample'}. Tap a slot to see its songs and selection numbers.</p></header>
    <div class="slots">${slotsGridHTML('open')}</div>`;
}
