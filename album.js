/* Jukebox Catalog: the album detail sheet.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   Album detail
   ========================================================= */
function openAlbum(id, disc, track) {
  if (!BY_ID[id]) return;
  ui.sheet = { id, disc: disc || null, track: track || null };
  $('#sheetWrap').hidden = false;
  renderSheet();
  $('#sheetClose').focus();
  const hit = document.getElementById('hit');
  if (hit) hit.scrollIntoView({ block: 'center' });
  else $('.sheet').scrollTop = 0;
}
function closeSheet() { ui.sheet = null; $('#sheetWrap').hidden = true; }
function renderSheet() {
  if (!ui.sheet) return;
  const a = BY_ID[ui.sheet.id];
  if (!a) { closeSheet(); return; }
  const slots = Store.slotsOf(a.id);
  const multi = a.discs.length > 1;
  const isCD = a.format === 'CD';
  const unloaded = a.discs.map((_, i) => i + 1).filter(d => Store.slotFor(a.id, d) === null);

  let where;
  if (slots.length) {
    const label = slots.map(s => (multi ? `Disc ${s.disc} in slot ${pad2(s.slot)}` : `Slot ${pad2(s.slot)}`)).join(' · ');
    where = `<div class="where where-juke"><span class="where-label"><span>In the jukebox</span><strong>${label}</strong></span>
      <span>Punch in the number next to a song to play it.</span></div>`;
  } else {
    where = `<div class="where where-shelf"><span class="where-label"><span class="muted">${isCD ? 'Not in the jukebox' : esc(a.format)}</span><strong>On the shelf</strong></span>
      ${unlocked() && isCD ? `<button class="btn btn-primary" data-load-album="${esc(a.id)}">Put it in the jukebox</button>` : ''}</div>`;
  }
  if (slots.length && unloaded.length && unlocked()) {
    where += `<div class="where where-shelf"><span class="where-label"><span class="muted">Still on the shelf</span><strong>Disc ${unloaded.join(', ')}</strong></span>
      <button class="btn btn-primary" data-load-album="${esc(a.id)}">Put it in the jukebox</button></div>`;
  }

  const tags = Store.tagsOf(a.id);
  const tagChips = tags.length
    ? tags.map(t => unlocked()
      ? `<span class="tag">${esc(t)}<button class="tag-x" data-tag-remove="${esc(t)}" aria-label="Remove ${esc(t)}">×</button></span>`
      : `<span class="tag">${esc(t)}</span>`).join('')
    : '<span class="muted">No tags yet.</span>';
  const suggestions = state.vocab.filter(t => !tags.includes(t));
  const tagTools = unlocked()
    ? `${suggestions.length ? `<div class="tagrow">${suggestions.map(t => `<button class="tag tag-add" data-tag-add="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>` : ''}
       <form class="tag-new" id="tagForm"><label for="tagNew" class="sr-only">New tag name</label>
         <input id="tagNew" placeholder="Make a new tag" maxlength="24" autocomplete="off"><button class="btn btn-secondary" type="submit">Add tag</button></form>`
    : '<p class="muted small">Unlock Manage to add or change tags.</p>';

  const trackHTML = a.discs.map((tracks, di) => {
    const d = di + 1;
    const slot = Store.slotFor(a.id, d);
    const head = multi ? `<div class="disc-head"><span>Disc ${d}</span><span>${slot !== null ? `Slot ${pad2(slot)}` : 'On the shelf'}</span></div>` : '';
    const rows = tracks.map((t, ti) => {
      const hit = ui.sheet.disc === d && ui.sheet.track === ti + 1;
      return `<div class="track${hit ? ' is-hit' : ''}"${hit ? ' id="hit"' : ''}><span class="track-no">${ti + 1}</span>
        <span class="track-title">${esc(t)}</span>${slot !== null ? plateHTML(slot, ti + 1) : '<span></span>'}</div>`;
    }).join('');
    return head + (rows || '<p class="muted small">No track list on Discogs.</p>');
  }).join('');

  const meta = [a.origYear ? `First released ${a.origYear}` : '', a.pressYear ? `This ${isCD ? 'CD' : esc(a.format)} pressed ${a.pressYear}` : '', esc(a.label)].filter(Boolean).join(' · ');
  $('#sheetBody').innerHTML = `
    <div class="detail-top">${coverHTML(a)}
      <div class="detail-info">
        ${Store.isNew(a.id) ? '<span><span class="badge badge-new">New from Discogs</span></span>' : ''}
        <h2 class="detail-title" id="sheetTitle">${esc(a.title)}</h2>
        <p class="detail-artist">${esc(a.artist)}</p>
        <p class="detail-meta">${meta}</p>
        <p class="detail-meta">${esc(a.genres.concat(a.styles).join(', '))}</p>
      </div>
    </div>
    ${where}
    ${unlocked() ? `<div class="frow"><button class="btn btn-secondary" data-queue-album="${esc(a.id)}">Reprint this album's page</button></div>` : ''}
    <section class="detail-sec"><h3 class="section-title">Your tags</h3><div class="tagrow">${tagChips}</div>${tagTools}</section>
    <section class="detail-sec"><h3 class="section-title">Songs${multi ? ` · ${a.discs.length} discs` : ''}</h3><div class="tracks">${trackHTML}</div></section>`;
}
