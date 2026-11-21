/* Jukebox Catalog: Manage: swaps, printing, history, settings.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   Manage
   ========================================================= */
function shelfDiscs() {
  const list = [];
  Store.albums().filter(a => JUKEBOX.formats.includes(a.format)).sort(byArtist).forEach(a => a.discs.forEach((_, i) => {
    if (Store.slotFor(a.id, i + 1) === null) list.push({ a, disc: i + 1 });
  }));
  return list;
}
function backbar(target, step, title) {
  return `<div class="backbar"><button class="btn btn-secondary" data-manage="${target}">${ICON.back}Back</button>
    <div class="view-head">${step ? `<span class="step">${step}</span>` : ''}<h2>${title}</h2></div></div>`;
}
function renderPickList() {
  const box = document.getElementById('pickList');
  if (!box) return;
  const q = norm(ui.swap.q);
  const items = shelfDiscs().filter(x => !q || x.a._hay.includes(q));
  box.innerHTML = items.length
    ? items.slice(0, 60).map(x => `<button class="pick" data-incoming="${esc(x.a.id)}:${x.disc}">${coverHTML(x.a)}
        <span class="song-text"><span class="song-title">${esc(x.a.title)}${discLabel(x.a, x.disc)}</span><span class="song-sub">${esc(x.a.artist)}${x.a.origYear ? ' · ' + x.a.origYear : ''}</span></span>
        <span class="badge badge-shelf">Shelf</span></button>`).join('')
      + (items.length > 60 ? `<p class="muted">Showing 60 of ${items.length}. Type part of a name to narrow the list.</p>` : '')
    : '<p class="muted">Nothing on the shelf matches. Try another name.</p>';
}
// The album list under Pages to print: every album, searchable; the ones whose page is on the list are marked.
function renderAlbumPickList() {
  const box = document.getElementById('albumPickList');
  if (!box) return;
  const q = norm(ui.printQ);
  const items = Store.albums().filter(a => !q || a._hay.includes(q)).sort(byArtist);
  box.innerHTML = items.length
    ? items.slice(0, 60).map(a => {
      const key = 'album:' + a.id, on = state.reprint.includes(key) && !state.printed[key];
      return `<button class="pick${on ? ' is-on' : ''}" data-toggle-album="${esc(a.id)}" aria-pressed="${on}">${coverHTML(a)}
        <span class="song-text"><span class="song-title">${esc(a.title)}</span><span class="song-sub">${esc(a.artist)}${a.origYear ? ' · ' + a.origYear : ''}</span></span>
        <span class="badge ${on ? 'badge-on' : 'badge-shelf'}">${on ? 'On the list' : 'Add'}</span></button>`;
    }).join('') + (items.length > 60 ? `<p class="muted">Showing 60 of ${items.length}. Type part of a name to narrow the list.</p>` : '')
    : '<p class="muted">No album matches. Try another name.</p>';
}
function renderManage() {
  const el = $('#view-manage');
  if (!unlocked()) {
    const msg = ui.checkingPin ? 'Checking…' : ui.pinError || '';
    el.innerHTML = `<div class="lock">
      <header class="view-head"><h1>Manage</h1><p>Enter the PIN to swap discs, change tags, and print.</p></header>
      <div class="pin-dots" aria-label="${ui.pin.length} of 4 digits entered">${[0, 1, 2, 3].map(i => `<span class="${i < ui.pin.length ? 'on' : ''}"></span>`).join('')}</div>
      <p class="pin-msg${ui.pinError ? ' err' : ''}" role="status">${esc(msg)}</p>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-key="${n}">${n}</button>`).join('')}
        <button class="key key-sm" data-key="clear">Clear</button><button class="key" data-key="0">0</button><button class="key key-sm" data-key="del">Delete</button></div>
    </div>`;
    return;
  }
  const n = Store.unprintedCount();
  const sw = ui.swap;
  switch (ui.manage) {
    case 'swap-slot': {
      const inc = sw.incoming && BY_ID[sw.incoming.id];
      // Which jukebox, unless the album already decided (it came from its own page).
      const which = inc ? '' : `<div class="seg jukebox-seg" role="group" aria-label="Which jukebox">${Object.values(JUKEBOXES).map(j =>
        `<button data-pick-jukebox="${j.id}" aria-pressed="${j === JUKEBOX}">${esc(jukeboxName(j))}</button>`).join('')}</div>`;
      el.innerHTML = `${backbar('home', 'Step 1 of 3', `Pick the ${esc(jukeboxName(JUKEBOX))} slot to change`)}
        ${which}
        <div class="do-now"><span class="section-title">What to do</span>
          <p>${inc ? `You're putting in <strong>${esc(inc.title)}${discLabel(inc, sw.incoming.disc)}</strong>. Tap an empty slot, or the slot of the disc that's coming out.` : 'Tap the slot you want to change. Dashed slots are empty.'}</p></div>
        <div class="slots">${slotsGridHTML('pick')}</div>`;
      break;
    }
    case 'swap-pick': {
      const jb = JUKEBOX, L = jb.label(sw.slot);
      const cur = (state[jb.stateKey] || {})[sw.slot];
      const curA = cur && BY_ID[cur.id];
      el.innerHTML = `${backbar('swap-slot', 'Step 2 of 3', `Pick what goes into ${esc(jukeboxName(jb))} slot ${L}`)}
        <div class="do-now"><span class="section-title">What to do</span><p>Tap the ${jb.unit === 'record' ? 'record' : 'album'} that's going into slot ${L}. Type part of its name in the search box to find it faster.</p></div>
        ${curA
          ? `<div class="current">${coverHTML(curA)}<span class="song-text"><span class="song-sub">Now in slot ${L}</span><span class="song-title">${esc(curA.title)}${discLabel(curA, cur.disc)}</span><span class="song-sub">${esc(curA.artist)}</span></span></div>`
          : `<p class="detail-meta">Slot ${L} is empty right now.</p>`}
        <div class="search search-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
          <label for="pickQ" class="sr-only">Search the shelf</label>
          <input id="pickQ" type="search" placeholder="Search the shelf by artist or album" autocomplete="off" value="${esc(sw.q)}">
        </div>
        <div class="pick-list" id="pickList"></div>
        ${curA ? `<div><button class="btn btn-secondary" data-incoming="">Leave slot ${L} empty</button></div>` : ''}`;
      renderPickList();
      break;
    }
    case 'swap-confirm': {
      const jb = JUKEBOX, L = jb.label(sw.slot);
      const cur = (state[jb.stateKey] || {})[sw.slot];
      const outA = cur && BY_ID[cur.id];
      const inA = sw.incoming && BY_ID[sw.incoming.id];
      const pages = 1 + (outA ? 1 : 0) + (inA ? 1 : 0);
      const side = (label, a, disc, cls, none) => `<div class="swap-side ${cls}"><span class="section-title">${label}</span>
        ${a ? `${coverHTML(a)}<span class="song-title">${esc(a.title)}${discLabel(a, disc)}</span><span class="song-sub">${esc(a.artist)}</span>` : `<span class="muted">${none}</span>`}</div>`;
      // The Rowe's steps come from its service manual. The Seeburg's are the Select-O-Matic routine (guides.js), still to be
      // read against the machine.
      const steps = jb.id === 'rowe' ? `
            <li><span>Unlock and open the top door. Move the SERVICE switch to SERVICE.</span></li>
            <li><span>Press the SCAN button (it may be labeled CANCEL/SCAN) to move the disc space to the left or right of the transfer arm.</span></li>
            ${outA ? `<li><span>Slide ${esc(outA.title)}${discLabel(outA, cur.disc)} out of slot ${L}.</span></li>` : ''}
            ${inA ? `<li><span>Slide ${esc(inA.title)}${discLabel(inA, sw.incoming.disc)} into slot ${L}, label facing right. Check it sits in slot ${L} at the front and the back.</span></li>` : ''}
            <li><span>With SERVICE MODE on the display, type 3 1, then ${L}, then press POPULAR.</span></li>
            <li><span>Move the SERVICE switch back to NORMAL and close the door.</span></li>` : `
            <li><span>Wait until the jukebox finishes playing and the mechanism is still. Unlock and lift the lid.</span></li>
            <li><span>Find slot ${L} in the record magazine. Make sure the carriage is clear of it.</span></li>
            ${outA ? `<li><span>Lift ${esc(outA.title)} straight up and out of slot ${L}.</span></li>` : ''}
            ${inA ? `<li><span>Slide ${esc(inA.title)} straight down into slot ${L}, facing the same way as the records next to it.</span></li>` : ''}
            <li><span>Close the lid and lock it. The new strip for selections ${jb.selection(sw.slot, 1).join('')} and ${jb.selection(sw.slot, 2).join('')} goes on the print list.</span></li>`;
      el.innerHTML = `${backbar(sw.fromAlbum ? 'swap-slot' : 'swap-pick', 'Step 3 of 3', `Check the swap for ${esc(jukeboxName(jb))} slot ${L}`)}
        <div class="swap-confirm">
          ${side(`Take out of slot ${L}`, outA, cur && cur.disc, 'out', 'Nothing. The slot is empty.')}
          ${side(`Put into slot ${L}`, inA, sw.incoming && sw.incoming.disc, 'in', 'Nothing. Leave the slot empty.')}
        </div>
        <div class="do-now"><span class="section-title">Now, at the ${esc(jukeboxName(jb))}</span>
          <ol class="steps">${steps}
          </ol></div>
        <p class="detail-meta">When the ${jb.unit}s are switched, tap Make the swap. ${pages} binder page${pages > 1 ? 's' : ''} and 1 ${jb.cardNoun} will go on the print list.</p>
        <div class="frow"><button class="btn btn-primary" data-swap-confirm>Make the swap</button>
          <button class="btn btn-secondary" data-manage="home">Cancel</button></div>`;
      break;
    }
    case 'print': {
      const total = state.reprint.length;
      const printedCount = total - n;
      const actions = (key, noun) => (state.printed[key]
        ? `<div class="page-actions"><span class="badge badge-printed">Printed ${when(state.printed[key])}</span><button class="btn-quiet" data-print-page="${key}">Print again</button></div>`
        : `<div class="page-actions"><button class="btn btn-secondary" data-print-page="${key}">Print this ${noun}</button><button class="btn-quiet" data-skip-page="${key}">Skip</button></div>`);
      const rowe = JUKEBOXES.rowe, seeburg = JUKEBOXES.seeburg;
      const pageKeys = state.reprint.filter(k => !k.startsWith('card:') && !k.startsWith('strip:'));
      const cardKeys = state.reprint.filter(k => k.startsWith('card:')).sort(byCardNo);
      const stripKeys = state.reprint.filter(k => k.startsWith('strip:')).sort(byCardNo);
      const sheets = Math.ceil(cardKeys.length / rowe.print.card.perSheet);
      const stripSheets = Math.ceil(stripKeys.length / seeburg.print.card.perSheet);
      // Adding to the list: one block, for the jukebox chosen in the segment. The slot grid opens in place,
      // and a tap puts that slot's title card on the list (a second tap takes it off), so a short sheet can be filled.
      const jb = JUKEBOX;
      const idxPages = Math.ceil(jb.slots.count / jb.print.indexPerPage), allCards = Math.ceil(jb.slots.count / jb.print.slotsPerCard);
      const which = `<div class="seg jukebox-seg" role="group" aria-label="Which jukebox">${Object.values(JUKEBOXES).map(j =>
        `<button data-pick-jukebox="${j.id}" aria-pressed="${j === jb}">${esc(jukeboxName(j))}</button>`).join('')}</div>`;
      const how = jb.print.slotsPerCard > 1 ? `Tap a slot to add its ${jb.cardNoun} (one card covers two slots). Tap again to take it off.` : `Tap a record to add its ${jb.cardNoun}. Tap again to take it off.`;
      const extras = `<section class="add-list"><h2 class="section-title">Add to the list</h2>
        ${which}
        <div class="frow"><button class="btn-quiet" data-toggle-pick aria-expanded="${ui.printPick}">${ui.printPick ? 'Hide the slots' : `Choose ${esc(jukeboxName(jb))} ${jb.cardNoun}s`}</button>
          <button class="btn-quiet" data-toggle-pick-albums aria-expanded="${ui.printPickAlbums}">${ui.printPickAlbums ? 'Hide the albums' : 'Choose album pages'}</button>
          <button class="btn-quiet" data-queue-cards="${jb.id}">Add all ${allCards} ${jb.cardNoun}s</button>
          <button class="btn-quiet" data-queue-index="${jb.id}">Add the ${esc(jukeboxName(jb))} index (${idxPages} page${idxPages > 1 ? 's' : ''})</button>
          <button class="btn-quiet" data-queue-albums>Add every album page (${Store.albums().length})</button></div>
        ${ui.printPick ? `<p class="muted small">${how} Slots with an amber edge are on the list.</p><div class="slots">${slotsGridHTML('card')}</div>` : ''}
        ${ui.printPickAlbums ? `<p class="muted small">Tap an album to add its binder page. Tap again to take it off.</p>
          <div class="search search-sm add-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
            <label for="albumQ" class="sr-only">Search the albums</label>
            <input id="albumQ" type="search" placeholder="Search by artist or album" autocomplete="off" value="${esc(ui.printQ)}">
          </div>
          <div class="pick-list" id="albumPickList"></div>` : ''}
        <p class="muted small">Need a fresh copy of one album's page? Open the album while Manage is unlocked and tap Reprint this album's page.</p></section>`;
      el.innerHTML = `${backbar('home', '', 'Pages to print')}
        ${total
          ? `${CONFIG.printing ? '' : '<p class="detail-meta">In this preview, Print only marks an item as printed. On the kiosk it opens the tablet\'s print screen.</p>'}
             <div class="frow"><button class="btn btn-primary" data-print-all>Print everything (${total})</button>
               ${n && scriptAtLeast(NEEDS_SCRIPT.skipAll) ? `<button class="btn btn-secondary" data-skip-all>Skip everything (${n})</button>` : ''}
               ${printedCount ? `<button class="btn btn-secondary" data-clear-printed>Clear ${printedCount} printed</button>` : ''}</div>
             ${n && !scriptAtLeast(NEEDS_SCRIPT.skipAll) ? `<p class="muted small">Skip everything needs the Sheet's script updated: this address runs script ${esc(remote.version)}, and it takes ${NEEDS_SCRIPT.skipAll} (in Apps Script: Deploy → Manage deployments → New version).</p>` : ''}
             ${pageKeys.length ? `<h2 class="section-title">Binder pages (${pageKeys.length})</h2>
               <p class="muted small">Plain letter paper. Each page says in its top corner where it goes in the binder.</p>
               <div class="frow"><button class="btn btn-secondary" data-print-keys="${pageKeys.join(',')}">Print the binder pages (${pageKeys.length})</button></div>
               <div class="pages">${pageKeys.map(k => pageHTML(k, actions(k, 'page'))).join('')}</div>` : ''}
             ${cardKeys.length ? `<h2 class="section-title">Jukebox title cards (${cardKeys.length})</h2>
               <p class="muted small">Cards print 3 side by side on a landscape letter sheet of heavy paper, front side only (${sheets} sheet${sheets > 1 ? 's' : ''} here). Each card has a thin border to line up on the paper cutter, with a small gap between cards to trim away. Cards print after the binder pages, and the app tells you when to load the card stock. A sheet with fewer than 3 cards prints with the other spaces blank; Choose title cards, below, fills them.</p>
               <div class="sheet-preview">${sheetPreviewHTML(cardKeys.slice(0, rowe.print.card.perSheet))}
                 <span class="page-cap">How the first sheet prints${sheets > 1 ? ` (1 of ${sheets})` : ''}.</span></div>
               <div class="frow"><button class="btn btn-secondary" data-print-keys="${cardKeys.slice(0, rowe.print.card.perSheet).join(',')}">Print this sheet (${Math.min(cardKeys.length, rowe.print.card.perSheet)} card${Math.min(cardKeys.length, rowe.print.card.perSheet) > 1 ? 's' : ''})</button>
                 ${sheets > 1 ? `<button class="btn-quiet" data-print-keys="${cardKeys.join(',')}">Print all ${sheets} card sheets</button>` : ''}</div>
               <div class="cards-list">${cardKeys.map(k => pageHTML(k, actions(k, 'card'))).join('')}</div>` : ''}
             ${stripKeys.length ? `<h2 class="section-title">Seeburg title strips (${stripKeys.length})</h2>
               <p class="muted small">Strips are 3 × 1 in and print 18 to a landscape letter sheet of plain paper (${stripSheets} sheet${stripSheets > 1 ? 's' : ''} here), each with a thin border to cut along. They print as their own job after the cards.</p>
               <div class="frow"><button class="btn btn-secondary" data-print-keys="${stripKeys.join(',')}">Print the strips (${stripKeys.length})</button></div>
               <div class="strips-list">${stripKeys.map(k => pageHTML(k, actions(k, 'strip'))).join('')}</div>` : ''}`
          : `<div class="empty-state"><h2>Nothing to print.</h2><p class="muted">The binder, the title cards, and the title strips match the catalog. Swaps and new albums add items here.</p></div>`}
        ${extras}`;
      fitCardsSoon(el);
      renderAlbumPickList();
      break;
    }
    case 'swap-done': {
      const ls = ui.lastSwap || { text: '', added: 0 };
      el.innerHTML = `<header class="view-head"><h1>Swap saved</h1>
          <p>${esc(ls.text)} ${ls.added} binder page${ls.added === 1 ? '' : 's'} and 1 ${ls.cardNoun || 'title card'} need reprinting. Print them, then change the ${ls.cardNoun || 'title card'}. The ? button has the steps.</p></header>
        <div class="frow"><button class="btn btn-primary" data-manage="print">Print the pages</button>
          <button class="btn btn-secondary" data-manage="swap-slot">Swap another ${JUKEBOX.unit}</button>
          <button class="btn btn-secondary" data-manage="home">Back to Manage</button></div>`;
      break;
    }
    case 'history': {
      const rows = state.swapLog.map(e => {
        const o = e.out && BY_ID[e.out.id];
        const i = e.in && BY_ID[e.in.id];
        const outTxt = o ? `took out ${esc(o.title)}${discLabel(o, e.out.disc)}` : e.out ? 'took out an album no longer in the catalog' : 'slot was empty';
        const inTxt = i ? `put in ${esc(i.title)}${discLabel(i, e.in.disc)}` : 'left it empty';
        const jb = JUKEBOXES[e.jukebox] || JUKEBOXES.rowe;
        return `<div class="history-row"><span class="song-title">${esc(jukeboxName(jb))} slot ${jb.label(e.slot)}: ${outTxt}, ${inTxt}</span><span class="song-sub">${when(e.at)}</span></div>`;
      }).join('');
      el.innerHTML = `${backbar('home', '', 'Swap history')}
        ${rows ? `<div class="history">${rows}</div>` : `<div class="empty-state"><h2>No swaps yet.</h2><p class="muted">Every swap shows up here with the date and time.</p></div>`}`;
      break;
    }
    default: {
      const ls = remote.lastSync || {};
      const syncNote = LIVE && ls.when
        ? `<p class="sync-note">Last Discogs check: ${when(ls.when)}${ls.remaining ? `. Details for ${Number(ls.remaining) || 0} albums are still coming in.` : '.'}${ls.error ? ` It stopped with this message: ${esc(ls.error)}` : ''} Sheet script ${esc(remote.version || '1')}.</p>` : '';
      const intro = pinRequired()
        ? `Unlocked. It locks again by itself after ${Number(setting('idle_minutes')) || CONFIG.idleMinutes} minutes without a touch.`
        : 'Swap discs and records, print pages, cards, and strips, and bring in new albums from Discogs.';
      el.innerHTML = `<header class="view-head"><h1>Manage</h1><p>${intro}</p></header>
        <div class="tiles">
          <button class="tile" data-manage="swap-slot"><span class="tile-title">Swap a disc or record</span><span class="tile-desc">Change what's in a slot of either jukebox.</span></button>
          <button class="tile" data-manage="print"><span class="tile-title">Pages to print${n ? ` <span class="count">${n}</span>` : ''}</span><span class="tile-desc">${n ? `${n} item${n > 1 ? 's' : ''} waiting to print.` : 'The binder and the jukebox cards are up to date.'}</span></button>
          <button class="tile" data-sync><span class="tile-title">Check Discogs</span><span class="tile-desc">Bring in albums you've scanned since the last check. This also runs every night.</span></button>
          <button class="tile" data-manage="history"><span class="tile-title">Swap history</span><span class="tile-desc">${state.swapLog.length ? `${state.swapLog.length} swap${state.swapLog.length > 1 ? 's' : ''} recorded.` : 'No swaps yet.'}</span></button>
        </div>
        ${syncNote}
        <section class="detail-sec"><h2 class="section-title">Idle screen</h2>
          <div class="frow"><button class="toggle" data-motion aria-pressed="${motionOn()}">${ICON.disc}Moving covers: ${motionOn() ? 'On' : 'Off'}</button>
            <button class="btn btn-secondary" data-idle-preview>Show it now</button></div>
          ${motionSetting() === 'auto' ? `<p class="muted small">This follows the device's own animation setting until you change it here.</p>` : ''}
        </section>
        <p class="muted">To change an album's tags, open it from Find music${pinRequired() ? ' while Manage is unlocked' : ''}.</p>
        <div class="frow">${pinRequired() ? `<button class="btn btn-secondary" data-lock>${ICON.lock}Lock</button>` : ''}
          ${LIVE ? '' : `<button class="btn btn-warn" data-reset>${ui.resetArmed ? 'Tap again to reset' : 'Reset sample data'}</button>`}</div>`;
    }
  }
}
