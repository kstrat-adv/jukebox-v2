/* Jukebox Catalog: the how-to guides.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

/* =========================================================
   How-to guides (each prints on one letter-size page)
   ========================================================= */
const GUIDES = [
  { id: 'swap', title: 'Swap a disc in the Rowe', start: true,
    note: 'The tablet shows each step on screen while you swap. On the disc holder, only every other slot has a number: even numbers on one half, odd numbers on the other.',
    steps: [
      "On the tablet, tap Manage and enter your PIN. Tap Swap a disc or record, tap the Rowe, tap the slot you're changing, then tap the album that's going in.",
      'At the jukebox, unlock and open the top door. Move the SERVICE switch to SERVICE.',
      'Press the SCAN button (it may be labeled CANCEL/SCAN) to move the disc space to the left or right of the transfer arm.',
      'Slide the old CD out of the slot. Slide the new CD in with the label facing right. Check that it sits in the same numbered slot at the front and the back.',
      'With SERVICE MODE on the display, type 3 1. The display shows PROGRAM INIT. Type the two-digit disc number, then press POPULAR.',
      'Move the SERVICE switch back to NORMAL and close the door. The jukebox reads the new disc, and you can play music while it does.',
      'Back at the tablet, tap Make the swap.',
      'Print the pages and the title card it lists. File the pages in the binder, then change the title card (see Change a title card).',
    ] },
  { id: 'card', title: 'Change a title card',
    note: 'Never turn the title pages by hand. Use the handwheel on top of the title page assembly. If you have several new cards, change them all while the assembly is out.',
    steps: [
      'Open the jukebox door.',
      'Lift the latching lever and slide the CBA-2 back toward you until it locks in place.',
      "Unplug the title page assembly's cable (the harness).",
      'Steady the top of the title page assembly with your index fingers, and release the two catches with your thumbs.',
      'Let the assembly tip back until it rests on its support brackets. Lift it off the brackets and out of the jukebox.',
      'Turn the handwheel to the page with that disc number. Slide the new card under the top left and right tabs, then down until it locks in place.',
      'Put the assembly back by reversing steps 2 to 5, then close the door.',
    ] },
  // The Seeburg's steps are the Select-O-Matic routine, written 11/5 and still to be read against the machine
  // (the lid, the magazine, the carriage, and the strip holder are named from memory of the model, not its manual).
  { id: 'sswap', title: 'Swap a record in the Seeburg', start: true,
    note: 'The Seeburg plays both sides of every record. Record 1 is selections A1 and A2, record 2 is A3 and A4, and so on through K10 (there is no letter I). The jukebox does not need to be told about a new record; only the title strip changes.',
    steps: [
      "On the tablet, tap Manage and enter your PIN. Tap Swap a disc or record, tap the Seeburg, tap the slot you're changing, then tap the record that's going in.",
      'Wait until the jukebox finishes playing and the mechanism is still. Unlock and lift the lid.',
      'Find the numbered slot in the record magazine. Make sure the carriage is clear of it.',
      'Lift the old record straight up and out of the slot.',
      'Slide the new record straight down into the same slot, facing the same way as the records next to it, until it rests on the bottom.',
      'Close the lid and lock it.',
      'Back at the tablet, tap Make the swap.',
      'Print the pages and the title strip it lists. File the pages in the binder, then change the title strip (see Change a title strip).',
    ] },
  { id: 'strip', title: 'Change a title strip',
    note: 'One strip covers one record: the odd selection on the left and the even one on the right, A1 and A2 for record 1. If you have several new strips, change them all while the lid is open.',
    steps: [
      'Print the strip: tap Manage, then Pages to print. The strips print last, on plain paper, 18 to a sheet. Cut them apart along the lines.',
      'Unlock and lift the lid.',
      'Find the old strip for that record in the title display. Slide it out of its holder.',
      'Slide the new strip into the same holder, with the odd selection (A1, A3, and so on) on the left.',
      'Close the lid and lock it.',
    ] },
  { id: 'add', title: 'Add a new album',
    steps: [
      'Scan the new CD with the Discogs app on your phone, the way you do now.',
      'The tablet checks Discogs every night, so the album shows up the next morning with a red New badge. To bring it in right away, tap Manage, then Check Discogs.',
      'Print its binder page: tap Manage, then Pages to print.',
      'File the page in the binder under the letter printed in its top corner.',
      'If you like, open the album and add your tags while Manage is unlocked.',
    ] },
  { id: 'print', title: 'Print binder pages and title cards',
    steps: [
      'Tap Manage and enter your PIN.',
      'Tap Pages to print. The number shows how many pages changed.',
      "Tap Print everything, or tap Print this page under one page. Tap Skip for a page you don't need.",
      'The print screen opens. Check that it shows your printer, then tap the round Print button.',
      'Title cards print after the binder pages, 3 to a sheet. When the app asks, put card stock in the manual feed slot and tap Print the cards. Cut them apart on the paper cutter along the thin border around each card.',
      'Seeburg title strips print last, on plain paper, 18 to a sheet. When the app asks, tap Print the strips. Cut them apart along the lines.',
      'Each page says in its top corner where it goes. Put it in the binder and throw away the old page.',
      'Back at the tablet, answer whether everything printed. Then tap Clear printed.',
    ] },
  { id: 'clear', title: 'Clear the play queue',
    note: 'Use this to skip the songs that are lined up. It clears every song waiting to play.',
    steps: [
      'Unlock and open the jukebox.',
      'Move the SERVICE switch to SERVICE.',
      'Type 8 3, then press POPULAR. The display says CLEAR SELECTIONS.',
      'Move the SERVICE switch back to NORMAL.',
      'Close the jukebox.',
    ] },
  { id: 'find', title: 'Find a song to play',
    steps: [
      'Tap Find music.',
      'Type part of a song, album, or artist name. You can also tap a decade, genre, or tag.',
      'Songs in the Rowe show a number like 22 06. Songs in the Seeburg show a code like A1.',
      'Punch that number or code into that jukebox.',
    ] },
];
function renderHelp() {
  $('#helpBody').innerHTML = `
    <header class="view-head"><h1 id="helpTitle">How to</h1>
      <p>Each guide prints on one page, so you can keep a copy at the front of the binder and follow it at the jukebox.</p></header>
    <div class="frow"><button class="btn btn-secondary" data-print-guide="all">Print all ${GUIDES.length} guides</button></div>
    <div class="guides">${GUIDES.map(g => `
      <section class="guide-card" aria-labelledby="g-${g.id}">
        <h2 id="g-${g.id}">${esc(g.title)}</h2>
        <ol class="steps">${g.steps.map(s => `<li><span>${esc(s)}</span></li>`).join('')}</ol>
        ${g.note ? `<p class="guide-note">${esc(g.note)}</p>` : ''}
        <div class="frow"><button class="btn btn-secondary" data-print-guide="${g.id}">Print these steps</button>
          ${g.start ? '<button class="btn btn-primary" data-help-start>Start a swap</button>' : ''}</div>
      </section>`).join('')}</div>`;
}
function openHelp() { renderHelp(); $('#helpWrap').hidden = false; $('#helpClose').focus(); $('#helpWrap .sheet').scrollTop = 0; }
function closeHelp() { $('#helpWrap').hidden = true; }
