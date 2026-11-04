/* Jukebox Catalog: binder pages, title cards, and the print runner.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   Binder pages and title cards
   ========================================================= */
// Title card for the jukebox's flip display, printed front only.
// Card k holds slot 2k on the top half and slot 2k+1 on the bottom half.
const ARROW_DOWN = '<svg class="tc-arrow" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 1h10L5 9z"/></svg>';
const ARROW_LEFT = '<svg class="tc-arrow" viewBox="0 0 10 10" aria-hidden="true"><path d="M9 0v10L1 5z"/></svg>';
function cardHalfHTML(slot, withHints) {
  const v = state.slots[slot];
  const a = v && BY_ID[v.id];
  const labels = `<div class="tc-labels">
      <span class="tc-hint">${withHints ? `Track no.<br>next 2 digits ${ARROW_DOWN}` : ''}</span>
      <span class="tc-box">${pad2(slot)}</span>
      <span class="tc-hint right">${withHints ? `${ARROW_LEFT} Disc no.<br>first 2 digits` : ''}</span></div>`;
  if (!a) return `<div class="tc-half">${labels}<div class="tc-empty">Empty</div></div>`;
  const list = a.discs[v.disc - 1] || [];
  const MAX = 34;                                 // longer discs list the first 33 songs
  const tooMany = list.length > MAX;
  const shown = tooMany ? list.slice(0, MAX - 1) : list;
  const rows = shown.map((t, i) => `<div class="tc-track"><span>${pad2(i + 1)}</span><span>${esc(t)}</span></div>`).join('')
    + (tooMany ? `<div class="tc-track"><span></span><span>+ ${list.length - (MAX - 1)} more songs</span></div>` : '');
  return `<div class="tc-half">${labels}
      <div class="tc-artist">${esc(a.artist)}</div>
      <div class="tc-title">${esc(a.title)}${a.discs.length > 1 ? ` (disc ${v.disc})` : ''}</div>
      <div class="tc-tracks">${rows}</div></div>`;
}
function titleCardBodyHTML(k) {
  const first = k * JUKEBOX.print.slotsPerCard;
  return `<div class="tcard"><div class="tc-in">${cardHalfHTML(first, true)}${cardHalfHTML(first + 1, false)}</div></div>`;
}
function titleCardHTML(k, actions = '') {
  const first = k * JUKEBOX.print.slotsPerCard;
  const cards = Math.ceil(JUKEBOX.slots.count / JUKEBOX.print.slotsPerCard);
  return `<div class="card-item">${titleCardBodyHTML(k)}
    <span class="page-cap">Discs ${pad2(first)} and ${pad2(first + 1)} (card ${k + 1} of ${cards}). It replaces that card in the jukebox's display.</span>${actions}</div>`;
}
// How up to 3 cards sit on one letter sheet in landscape: upright, side by side, centered,
// with a gap between them to trim.
function sheetPreviewHTML(keys) {
  const c = JUKEBOX.print.card;
  const left0 = (c.sheetW - (c.perSheet * c.w + (c.perSheet - 1) * c.gap)) / 2;
  const top0 = (c.sheetH - c.h) / 2;
  const pct = (v, of) => (v / of * 100).toFixed(3) + '%';
  let h = '';
  for (let i = 0; i < c.perSheet; i++) {
    const pos = `left:${pct(left0 + i * (c.w + c.gap), c.sheetW)};top:${pct(top0, c.sheetH)};width:${pct(c.w, c.sheetW)};height:${pct(c.h, c.sheetH)}`;
    h += keys[i]
      ? `<div class="sheet-slot" style="${pos}">${titleCardBodyHTML(+keys[i].split(':')[1])}</div>`
      : `<div class="sheet-slot unused" style="${pos}"></div>`;
  }
  return `<div class="sheet-page">${h}</div>`;
}
// Fits each card's song list: 9 pt in one column if it fits, then 8.5 and 8 pt, then two columns
// from 9 pt down to 6 pt. The cards must be laid out (on screen, or in the print area while it's
// being measured) for this to work.
const FIT_STEPS = [[9, 1], [8.5, 1], [8, 1], [9, 2], [8.5, 2], [8, 2], [7.5, 2], [7, 2], [6.5, 2], [6, 2]];
function fitCards(root) {
  root.querySelectorAll('.tc-half').forEach(half => {
    const box = half.querySelector('.tc-tracks');
    if (!box) return;
    const n = box.children.length;
    let i = n > 15 ? FIT_STEPS.findIndex(s => s[1] === 2) : 0;   // long discs skip straight to two columns
    for (; i < FIT_STEPS.length; i++) {
      const [size, cols] = FIT_STEPS[i];
      half.style.setProperty('--tk', size);
      box.classList.toggle('two-col', cols === 2);
      if (box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1) return;
    }
  });
}
function fitCardsSoon(root) {
  fitCards(root);
  // Fonts can arrive a moment later and change the measurements, so fit once more when they're in.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitCards(root));
}

// One binder page (index or album), without the caption around it.
function pageBodyHTML(key) {
  const [kind, ref] = key.split(':');
  const pageOpen = `<div class="page page-${CONFIG.paper}" style="aspect-ratio:${PAPER[CONFIG.paper].ratio}"><div class="pg-in">`;
  if (kind === 'index') {
    const n = +ref;
    const start = (n - 1) * JUKEBOX.print.indexPerPage;
    const end = Math.min(n * JUKEBOX.print.indexPerPage, JUKEBOX.slots.count) - 1;
    const pages = Math.ceil(JUKEBOX.slots.count / JUKEBOX.print.indexPerPage);
    let rows = '';
    for (let s = start; s <= end; s++) {
      const v = state.slots[s];
      const a = v && BY_ID[v.id];
      rows += `<div class="pg-irow"><span>${pad2(s)}</span><span>${a ? esc(a.artist) : '—'}</span><span>${a ? esc(a.title) + (a.discs.length > 1 ? ` (disc ${v.disc})` : '') : ''}</span></div>`;
    }
    return `${pageOpen}
        <div class="pg-top"><span>Jukebox index · p. ${n}</span><span>Slots ${pad2(start)}–${pad2(end)}</span></div>
        <div class="pg-title">Now in the Jukebox</div>
        <div class="pg-index">${rows}</div>
        <div class="pg-foot"><span>Page ${n} of ${pages}</span><span>Printed ${today()}</span></div></div></div>`;
  }
  const a = BY_ID[ref];
  const slots = Store.slotsOf(a.id);
  const multi = a.discs.length > 1;
  const right = slots.length ? `${esc(jukeboxName())} ${slots.map(s => pad2(s.slot)).join(' + ')}` : 'On the shelf';
  const tracks = a.discs.map((list, di) => {
    const d = di + 1;
    const slot = Store.slotFor(a.id, d);
    const head = multi ? `<div class="pg-disc">Disc ${d}${slot !== null ? ` · slot ${pad2(slot)}` : ''}</div>` : '';
    return head + list.map((t, ti) => `<div class="pg-track"><span>${ti + 1}</span><span>${esc(t)}</span>${slot !== null ? `<span class="pg-code">${JUKEBOX.selection(slot, ti + 1).join('')}</span>` : '<span></span>'}</div>`).join('');
  }).join('');
  const whereTxt = slots.length
    ? 'In the jukebox: ' + slots.map(s => (multi ? `disc ${s.disc} in slot ${pad2(s.slot)}` : `slot ${pad2(s.slot)}`)).join(', ')
    : 'On the shelf';
  // Long albums switch to two columns so every song fits on one page.
  const rows = a.discs.reduce((n, d) => n + d.length, 0) + (multi ? a.discs.length : 0);
  const meta = [a.origYear || '', esc(a.genres.join(', ')), a.pressYear ? `${esc(a.format)} ${a.pressYear}` : esc(a.format), esc(a.label)].filter(Boolean).join(' · ');
  return `${pageOpen}
      <div class="pg-top"><span>Collection · ${fileLetter(a)}</span><span>${right}</span></div>
      <div class="pg-head">${coverHTML(a)}
        <div class="pg-headtext">
          <div class="pg-artist">${esc(a.artist)}</div>
          <div class="pg-title">${esc(a.title)}</div>
          <div class="pg-meta">${meta}</div>
          <div class="pg-where${slots.length ? '' : ' shelf'}">${whereTxt}</div>
        </div></div>
      <div class="pg-colhead"><span>Songs</span><span>${slots.length ? 'Selection' : ''}</span></div>
      <div class="pg-tracks${rows > PAPER[CONFIG.paper].twoColAfter ? ' two-col' : ''}">${tracks}</div>
      <div class="pg-foot"><span>Jukebox Catalog</span><span>Printed ${today()}</span></div></div></div>`;
}
function pageHTML(key, actions = '') {
  const [kind, ref] = key.split(':');
  if (kind === 'card') return titleCardHTML(+ref, actions);
  const cap = kind === 'index'
    ? `Replaces: Jukebox index, page ${ref}`
    : `Goes in: Collection, letter ${fileLetter(BY_ID[ref])} (replaces the old page)`;
  return `<div class="page-wrap">${pageBodyHTML(key)}<span class="page-cap">${cap}</span>${actions}</div>`;
}

/* =========================================================
   Printing
   ========================================================= */
// Binder pages print in filing order: index pages first, then albums in shelf order.
function pageOrder(x, y) {
  const [kx, rx] = x.split(':'), [ky, ry] = y.split(':');
  if (kx !== ky) return kx === 'index' ? -1 : 1;
  return kx === 'index' ? +rx - +ry : byArtist(BY_ID[rx], BY_ID[ry]);
}
// Binder pages (portrait) and title card sheets (landscape) print as separate jobs, so each job has
// one page shape, and there's a pause to load the card stock between them.
function pagesHTML(keys) { return keys.slice().sort(pageOrder).map(k => `<div class="print-page">${pageBodyHTML(k)}</div>`).join(''); }
function cardSheetsHTML(keys) {
  const cards = keys.slice().sort(byCardNo);
  let h = '';
  for (let i = 0; i < cards.length; i += JUKEBOX.print.card.perSheet) {
    h += `<div class="print-sheet">${sheetPreviewHTML(cards.slice(i, i + JUKEBOX.print.card.perSheet))}</div>`;
  }
  return h;
}
function guidePrintHTML(list) {
  return list.map(g => `<div class="print-page"><div class="guide-page">
      <div class="gp-top">Jukebox Catalog · How to</div>
      <h1>${esc(g.title)}</h1>
      <ol class="gp-steps">${g.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${g.note ? `<p class="gp-note">${esc(g.note)}</p>` : ''}</div></div>`).join('');
}
// Put the pages in the print area, wait for cover images, then open the print screen.
// On the kiosk, Fully Kiosk's own print call is used when it's there.
// Card sheets are landscape. A computer's browser takes that from the page itself. The kiosk
// (Fully Kiosk on Android) prints portrait unless someone changes it, so there the landscape sheet is
// turned a quarter turn onto a portrait page instead: the cards come out exactly the same size.
function setPageShape(landscape) {
  let tag = document.getElementById('pageShape');
  if (!tag) { tag = document.createElement('style'); tag.id = 'pageShape'; document.head.appendChild(tag); }
  const turn = landscape && !!(window.fully && typeof window.fully.print === 'function');
  $('#printArea').classList.toggle('turned', turn);
  tag.textContent = `@page { size: letter ${landscape && !turn ? 'landscape' : 'portrait'}; margin: 0; }`;
}
function runPrint(html, landscape) {
  return new Promise(resolve => {
    const area = $('#printArea');
    setPageShape(!!landscape);
    area.innerHTML = html;
    // Lay the pages out off screen at full size: covers start loading, and the song lists are fitted.
    area.classList.add('measuring');
    const imgs = Array.from(area.querySelectorAll('img'));
    imgs.forEach(i => { i.loading = 'eager'; });
    const loaded = Promise.all(imgs.map(i => (i.complete ? null : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))));
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([Promise.all([loaded, fonts]), new Promise(r => setTimeout(r, 4000))]).then(() => {
      fitCards(area);
      area.classList.remove('measuring');
      if (window.fully && typeof window.fully.print === 'function') {
        window.fully.print();
        setTimeout(resolve, 1500);
      } else {
        let done = false;
        const end = () => { if (!done) { done = true; resolve(); } };
        window.addEventListener('afterprint', end, { once: true });
        window.print();
        setTimeout(end, 600);
      }
    });
  });
}
async function printKeys(keys) {
  if (!keys.length) return;
  const n = keys.length;
  if (!CONFIG.printing) {
    await Actions.printed(keys);
    toast(`Preview only. On the kiosk, this opens the print screen for ${n === 1 ? 'this item' : `all ${n} items`}.`);
    renderManage();
    return;
  }
  const pages = keys.filter(k => !k.startsWith('card:'));
  const cards = keys.filter(k => k.startsWith('card:'));
  let done = 0;
  if (pages.length) {
    await runPrint(pagesHTML(pages), false);
    const ok = await ask(`Did the binder page${pages.length > 1 ? 's' : ''} come out of the printer?`, 'Yes, mark printed', 'No, keep on the list');
    if (ok) { Actions.printed(pages); done += pages.length; }
  }
  if (cards.length) {
    const sheets = Math.ceil(cards.length / JUKEBOX.print.card.perSheet);
    const go = !pages.length || await ask(`Next, the title cards (${sheets} sheet${sheets > 1 ? 's' : ''}). Put card stock in the manual feed slot, then tap Print the cards.`, 'Print the cards', 'Not now');
    if (go) {
      await runPrint(cardSheetsHTML(cards), true);
      const ok = await ask(`Did the title card sheet${sheets > 1 ? 's' : ''} come out of the printer?`, 'Yes, mark printed', 'No, keep on the list');
      if (ok) { Actions.printed(cards); done += cards.length; }
    }
  }
  if (done) toast('Marked as printed.');
  renderManage();
}
async function printGuides(ids) {
  const list = ids === 'all' ? GUIDES : GUIDES.filter(g => g.id === ids);
  if (!CONFIG.printing) {
    toast(list.length > 1 ? `Preview only. On the kiosk, this prints all ${list.length} guides, one page each.` : 'Preview only. On the kiosk, this prints these steps on one page.');
    return;
  }
  await runPrint(guidePrintHTML(list), false);
}
