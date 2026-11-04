/* Jukebox Catalog: the jukebox definitions. Everything that differs between the two jukeboxes lives here;
   the screens read the active one (JUKEBOX) or the one that plays an album's format (jukeboxFor).
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

//   slots:     numbered from `first` for `count` slots
//   label:     how a slot number is written (the Rowe's 00–99, the Seeburg's 1–50)
//   selection: what to punch in for a track: disc and track on the Rowe, a letter and number per side on the Seeburg
//   keys:      the print-list key families for the index pages and for the cards or strips (same as the Sheet's script)
//   stateKey:  where the app keeps what's loaded in it
const SEEBURG_LETTERS = 'ABCDEFGHJK';   // no I, as on the machine
const JUKEBOXES = {
  rowe: {
    id: 'rowe', name: 'Rowe AMI', nameSetting: 'jukebox_name', formats: ['CD'], unit: 'disc', cardNoun: 'title card',
    slots: { count: 100, first: 0 }, tab: 'Slots', stateKey: 'slots', showCodes: false,
    label(slot) { return pad2(slot); },
    // Confirmed at the jukebox (11/1): disc number 00–99 first, then the two-digit track.
    selection(slot, track) { return [pad2(slot), pad2(track)]; },
    keys: { index: 'index', card: 'card' },
    // Title cards: 2 discs per card, 3 × 5 5/8 in (measured 11/2), 3 upright cards side by side on a landscape letter sheet.
    print: { slotsPerCard: 2, indexPerPage: 25, card: { w: 3, h: 5.625, gap: 0.25, across: 3, down: 1, perSheet: 3, sheetW: 11, sheetH: 8.5 } },
  },
  seeburg: {
    id: 'seeburg', name: 'Seeburg 100C', nameSetting: 'seeburg_name', formats: ['45'], unit: 'record', cardNoun: 'title strip',
    slots: { count: 50, first: 1 }, tab: 'SeeburgSlots', stateKey: 'seeburgSlots', showCodes: true,
    label(slot) { return String(slot); },
    // Confirmed 11/4: A1 and A2 are the two sides of record 1, A3 and A4 of record 2, and so on, five records to a
    // letter. Only a record's two sides have a selection; a longer track list gets no code past side 2.
    selection(slot, track) {
      if (track > 2) return null;
      const i = slot - 1;
      return [SEEBURG_LETTERS[Math.floor(i / 5)], String(2 * (i % 5) + track)];
    },
    keys: { index: 'sindex', card: 'strip' },
    // Title strips: one record per strip, 3 × 1 in (confirmed 11/4), 3 across and 6 down on a landscape letter sheet.
    print: { slotsPerCard: 1, indexPerPage: 25, card: { w: 3, h: 1, gap: 0.25, across: 3, down: 6, perSheet: 18, sheetW: 11, sheetH: 8.5 } },
  },
};
// The jukebox the screens show. The rail entries and the swap screen switch it.
let JUKEBOX = JUKEBOXES.rowe;
function setJukebox(id) { JUKEBOX = JUKEBOXES[id] || JUKEBOXES.rowe; }
// The jukebox that plays an album's format, or null for formats no jukebox plays (LPs, 78s).
function jukeboxFor(a) { return Object.values(JUKEBOXES).find(j => a && j.formats.includes(a.format)) || null; }
// The jukebox a print key belongs to, from its family ("index", "card", "sindex", "strip"); null for album pages.
function jukeboxByKey(kind) { return Object.values(JUKEBOXES).find(j => j.keys.index === kind || j.keys.card === kind) || null; }
// The print keys a swap in a slot reprints: its index page and its card or strip. Same arithmetic as the Sheet's script.
function slotKeys(jb, slot) {
  return [jb.keys.index + ':' + (Math.floor((slot - jb.slots.first) / jb.print.indexPerPage) + 1),
    jb.keys.card + ':' + (Math.floor((slot - jb.slots.first) / jb.print.slotsPerCard) + jb.slots.first)];
}
// The slots one card or strip covers: the Rowe's card k holds slots 2k and 2k+1; the Seeburg's strip n holds record n.
function cardSlots(jb, k) {
  const first = jb.slots.first + (k - jb.slots.first) * jb.print.slotsPerCard;
  return Array.from({ length: jb.print.slotsPerCard }, (_, i) => first + i);
}
