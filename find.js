/* Jukebox Catalog: Find music: search, filters, results.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   Find music
   ========================================================= */
function anyFilter() { return ui.decades.size || ui.genres.size || ui.tags.size || ui.formats.size || ui.onlyJuke; }
function clearFilters() { ui.decades.clear(); ui.genres.clear(); ui.tags.clear(); ui.formats.clear(); ui.onlyJuke = false; ui.allSongs = false; }
function matchesFilters(a) {
  if (ui.decades.size && !(a.origYear && ui.decades.has(decadeOf(a.origYear)))) return false;
  if (ui.genres.size && !a.genres.some(g => ui.genres.has(g))) return false;
  if (ui.tags.size && !Store.tagsOf(a.id).some(t => ui.tags.has(t))) return false;
  if (ui.formats.size && !ui.formats.has(a.format)) return false;
  if (ui.onlyJuke && !Store.slotsOf(a.id).length) return false;
  return true;
}
function chipHTML(group, value, label, on) {
  return `<button class="chip" data-chip="${group}" data-value="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`;
}
function renderFilters() {
  const albums = Store.albums();
  const decades = [...new Set(albums.filter(a => a.origYear).map(a => decadeOf(a.origYear)))].sort((x, y) => x - y);
  const present = new Set(albums.flatMap(a => a.genres));
  const genres = GENRE_ORDER.filter(g => present.has(g)).concat([...present].filter(g => !GENRE_ORDER.includes(g)).sort());
  const formats = [...new Set(albums.map(a => a.format))].sort();
  const n = ui.decades.size + ui.genres.size + ui.tags.size + ui.formats.size + (ui.onlyJuke ? 1 : 0);
  $('#filters').innerHTML = `
    <div class="fgroup"><span class="flabel">Decade</span><div class="chips">${decades.map(d => chipHTML('decade', d, decadeLabel(d), ui.decades.has(d))).join('')}</div></div>
    <div class="fgroup"><span class="flabel">Genre</span><div class="chips">${genres.map(g => chipHTML('genre', g, g, ui.genres.has(g))).join('')}</div></div>
    <div class="fgroup"><span class="flabel">Your tags</span><div class="chips">${state.vocab.map(t => chipHTML('tag', t, t, ui.tags.has(t))).join('')}</div></div>
    ${formats.length > 1 ? `<div class="fgroup"><span class="flabel">Format</span><div class="chips">${formats.map(f => chipHTML('format', f, f, ui.formats.has(f))).join('')}</div></div>` : ''}
    <div class="frow">
      <button class="toggle" id="onlyJuke" aria-pressed="${ui.onlyJuke}">${ICON.disc}Only what's in the jukebox</button>
      ${n ? `<button class="btn-quiet" id="clearAll">Clear ${n} filter${n > 1 ? 's' : ''}</button>` : ''}
    </div>`;
}
function songRowHTML(s) {
  const slot = Store.slotFor(s.a.id, s.disc);
  const where = slot !== null
    ? `${plateHTML(slot, s.track)}<span>Slot ${pad2(slot)}, track ${pad2(s.track)}</span>`
    : `<span class="badge badge-shelf">${s.a.format === 'CD' ? 'Shelf' : esc(s.a.format)}</span>`;
  return `<button class="song" data-open="${esc(s.a.id)}" data-disc="${s.disc}" data-track="${s.track}">
    ${coverHTML(s.a)}
    <span class="song-text"><span class="song-title">${esc(s.title)}</span><span class="song-sub">${esc(s.a.artist)} · ${esc(s.a.title)}</span></span>
    <span class="song-where">${where}</span></button>`;
}
function cardHTML(a) {
  return `<button class="card" data-open="${esc(a.id)}">
    ${coverHTML(a)}
    <span class="card-text"><span class="card-title">${esc(a.title)}</span><span class="card-artist">${esc(a.artist)}</span></span>
    <span class="card-foot"><span class="year">${a.origYear || ''}</span>${badgesHTML(a)}</span></button>`;
}
function renderResults() {
  const all = Store.albums();
  if (!all.length) {
    $('#results').innerHTML = LIVE
      ? `<div class="empty-state"><h2>${remote.loaded ? 'The catalog is empty.' : 'The catalog hasn\'t loaded yet.'}</h2>
         <p class="muted">${remote.loaded ? 'Run a Discogs sync from the Sheet (Jukebox → Sync with Discogs now).' : 'Check the Wi-Fi. The tablet tries again every few minutes.'}</p></div>`
      : '<div class="empty-state"><h2>No sample albums.</h2></div>';
    $('#qClear').hidden = !ui.q;
    return;
  }
  const q = norm(ui.q);
  const words = q ? q.split(' ') : [];
  const pool = all.filter(matchesFilters);
  const albums = words.length ? pool.filter(a => words.every(w => a._hay.includes(w))) : pool.slice();
  albums.sort(ui.sort === 'year' ? (a, b) => (a.origYear || 9999) - (b.origYear || 9999) || byArtist(a, b) : byArtist);

  const songs = [];
  if (q.length >= 2) {
    pool.slice().sort(byArtist).forEach(a => a._tracks.forEach((disc, di) => disc.forEach((t, ti) => {
      if (t.includes(q)) songs.push({ a, disc: di + 1, track: ti + 1, title: a.discs[di][ti] });
    })));
  }

  let h = '';
  if (!albums.length && !songs.length) {
    const what = ui.q ? `Nothing matches “${esc(ui.q)}”` : 'No albums match these filters';
    h = `<div class="empty-state"><h2>${what}.</h2><p class="muted">Check the spelling, or take off a filter.</p>
      <button class="btn btn-secondary" id="clearEverything">Start over</button></div>`;
  } else {
    if (albums.length) {
      const label = (ui.q || anyFilter()) ? `${albums.length} album${albums.length > 1 ? 's' : ''} match` : `All ${albums.length} albums`;
      h += `<div class="results-head"><h2 class="results-count">${label}</h2>
        <div class="seg" role="group" aria-label="Sort albums">
          <button data-sort="artist" aria-pressed="${ui.sort === 'artist'}">Artist A–Z</button>
          <button data-sort="year" aria-pressed="${ui.sort === 'year'}">Year</button>
        </div></div>
        <div class="grid">${albums.map(cardHTML).join('')}</div>`;
    }
    if (songs.length) {
      const shown = ui.allSongs ? songs : songs.slice(0, 10);
      h += `<section class="songs" aria-label="Songs"><h2 class="section-title">${songs.length} song${songs.length > 1 ? 's' : ''} match “${esc(ui.q)}”</h2>
        ${shown.map(songRowHTML).join('')}
        ${songs.length > shown.length ? `<button class="btn btn-secondary" id="allSongs">Show all ${songs.length} songs</button>` : ''}</section>`;
    }
  }
  $('#results').innerHTML = h;
  $('#qClear').hidden = !ui.q;
}
function renderFind() { renderFilters(); renderResults(); }
