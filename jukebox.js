/* Jukebox Catalog: In the jukebox: the slots grid, for whichever jukebox is active.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   In the jukebox
   ========================================================= */
function slotsGridHTML(mode) {
  const jb = JUKEBOX;
  const map = state[jb.stateKey] || {};
  let h = '';
  for (let s = jb.slots.first; s < jb.slots.first + jb.slots.count; s++) {
    const v = map[s];
    const a = v && BY_ID[v.id];
    const sel = mode === 'pick' && ui.swap.slot === s ? ' is-selected' : '';
    // The Seeburg's slots show their two selections, since that's what gets punched in.
    const no = `<span class="slot-no">${jb.label(s)}</span>${jb.showCodes ? `<span class="slot-sel">${jb.selection(s, 1).join('')} · ${jb.selection(s, 2).join('')}</span>` : ''}`;
    if (a) {
      const extra = a.discs.length > 1 ? ` · disc ${v.disc}` : '';
      h += `<button class="slot${sel}" data-slot="${s}" data-mode="${mode}">${no}${coverHTML(a)}
        <span class="slot-title">${esc(a.title)}</span><span class="slot-artist">${esc(a.artist)}${extra}</span></button>`;
    } else if (mode === 'pick') {
      h += `<button class="slot empty${sel}" data-slot="${s}" data-mode="pick">${no}<span class="slot-hole">Empty</span></button>`;
    } else {
      h += `<div class="slot empty">${no}<span class="slot-hole">Empty</span></div>`;
    }
  }
  return h;
}
function renderJukebox() {
  const jb = JUKEBOX;
  const filled = Store.filledCount(jb);
  $('#view-jukebox').innerHTML = `
    <header class="view-head"><h1>Now in the ${esc(jukeboxName(jb))}</h1>
      <p>${filled} of ${jb.slots.count} slots are filled${LIVE ? '' : ' in this sample'}. Tap a slot to see its songs and selection numbers.</p></header>
    <div class="slots">${slotsGridHTML('open')}</div>`;
}
