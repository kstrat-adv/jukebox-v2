/* Jukebox Catalog: the jukebox definitions. Everything that used to read a Rowe constant reads the active jukebox instead.
   One of the plain script files index.html loads in order (core.js, jukeboxes.js, data.js, find.js, jukebox.js, album.js, print.js, manage.js, guides.js, idle.js, main.js); no build step.
   Top-level names are shared across the files, so each file only declares its own. */
'use strict';

// One entry per jukebox. The Rowe AMI plays CDs from 100 slots numbered 00–99 and shows a selection as
// disc number then track number (confirmed at the jukebox 11/1). The Seeburg 100C joins in v2 step 4.
const JUKEBOXES = {
  rowe: {
    id: 'rowe',
    name: 'Rowe AMI',
    formats: ['CD'],                      // what this jukebox plays; the swap list offers only these
    slots: { count: 100, first: 0 },      // numbered 00–99
    selection(slot, track) { return [pad2(slot), pad2(track)]; },
    print: {
      slotsPerCard: 2,                    // each title card: one disc on the top half, the next on the bottom
      indexPerPage: 25,                   // binder index: slots per page
      // Title card size and sheet layout, in inches. The cards are 3 × 5 5/8 in (measured 11/2), so a
      // letter sheet turned landscape holds 3 upright cards side by side.
      card: { w: 3, h: 5.625, gap: 0.25, perSheet: 3, sheetW: 11, sheetH: 8.5 },
    },
    tab: 'Slots',                         // the Sheet tab that holds its slots
  },
};
// The jukebox the screens show. v2 step 4 switches it per view; until then it's the Rowe.
const JUKEBOX = JUKEBOXES.rowe;
