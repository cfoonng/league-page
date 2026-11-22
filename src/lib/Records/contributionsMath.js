// Position contributions: average points per game each manager got from each position room.
//
// Rooms are based on lineup slots, after re-sorting each week's starters so the highest
// scorers sit in the named slots and the lowest in flex:
//   QB  = QB slot + SUPER_FLEX slot
//   RB / WR / TE = their named slots
//   FLX = FLEX slots (FLEX, WRRB_FLEX, REC_FLEX)
// If SUPER_FLEX ends up holding a non-QB, the best of the flex players (FLEX + SUPER_FLEX)
// is moved into SUPER_FLEX. An empty starting slot counts as 0 points. K and DEF are ignored.

export const ROOMS = ['QB', 'RB', 'WR', 'TE', 'FLX'];

const SLOT_ELIGIBILITY = {
    FLEX: ['RB', 'WR', 'TE'],
    WRRB_FLEX: ['RB', 'WR'],
    REC_FLEX: ['WR', 'TE'],
    SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
    IDP_FLEX: ['DL', 'LB', 'DB'],
};

const SLOT_ROOM = {
    QB: 'QB', SUPER_FLEX: 'QB',
    RB: 'RB', WR: 'WR', TE: 'TE',
    FLEX: 'FLX', WRRB_FLEX: 'FLX', REC_FLEX: 'FLX',
};

const eligibility = (slot) => SLOT_ELIGIBILITY[slot] || [slot];

/**
 * Re-sort one week's starters into the lineup slots.
 * Slots are filled from most specific (QB, RB, ...) to least (FLEX, then SUPER_FLEX),
 * each taking the highest-scoring remaining eligible starter.
 * @returns {Object[]} one entry per slot: {slot, pid, pts, pos} (pid null if the slot is empty)
 */
export const sortLineup = (slots, starters, startersPoints, positionOf) => {
    let pool = [];
    starters.forEach((pid, i) => {
        if(!pid || pid == '0') return;
        pool.push({pid, pts: Number(startersPoints[i]) || 0, pos: positionOf(pid)});
    });
    pool.sort((a, b) => b.pts - a.pts);

    const order = slots.map((slot, i) => ({slot, i})).sort((a, b) => eligibility(a.slot).length - eligibility(b.slot).length);
    const filled = slots.map(slot => ({slot, pid: null, pts: 0, pos: null}));

    for(const {slot, i} of order) {
        const idx = pool.findIndex(p => eligibility(slot).includes(p.pos));
        if(idx >= 0) {
            filled[i] = {slot, ...pool[idx]};
            pool.splice(idx, 1);
        }
    }

    // SUPER_FLEX rule: if it holds a non-QB, the best flex player (FLEX + SUPER_FLEX) goes there
    filled.forEach((s, i) => {
        if(s.slot != 'SUPER_FLEX' || !s.pid || s.pos == 'QB') return;
        const flexIdx = filled.map((f, j) => j).filter(j => SLOT_ROOM[filled[j].slot] == 'FLX' && filled[j].pid);
        const best = flexIdx.reduce((b, j) => (filled[j].pts > filled[b].pts ? j : b), i);
        if(best != i) {
            const tmp = {pid: filled[i].pid, pts: filled[i].pts, pos: filled[i].pos};
            filled[i] = {...filled[i], pid: filled[best].pid, pts: filled[best].pts, pos: filled[best].pos};
            filled[best] = {...filled[best], ...tmp};
        }
    });

    return filled;
};

/**
 * Average points per game from each room.
 * @param {Object[]} lineupWeeks {year, week, rosterID, managers, starters, startersPoints}
 * @param {Object} lineupSlots {year: [slots]}
 * @param {Function} positionOf pid -> position
 * @param {Object} options allTime: group by manager across seasons; otherwise only `year`, by roster
 * @returns {Object[]} {managerID?, rosterID?, games, QB, RB, WR, TE, FLX}
 */
export const computeContributions = (lineupWeeks, lineupSlots, positionOf, {allTime = false, year = null} = {}) => {
    const totals = {};

    for(const entry of lineupWeeks) {
        if(!allTime && String(entry.year) != String(year)) continue;
        const slots = lineupSlots[entry.year];
        if(!slots || !slots.length) continue;

        const key = allTime ? (entry.managers && entry.managers[0]) || `roster-${entry.rosterID}` : entry.rosterID;
        if(!totals[key]) {
            totals[key] = {games: 0, QB: 0, RB: 0, WR: 0, TE: 0, FLX: 0};
            if(allTime && entry.managers && entry.managers[0]) totals[key].managerID = entry.managers[0];
            else totals[key].rosterID = entry.rosterID;
        }

        totals[key].games++;
        for(const s of sortLineup(slots, entry.starters, entry.startersPoints, positionOf)) {
            const room = SLOT_ROOM[s.slot];
            if(room) totals[key][room] += s.pts;  // empty slot adds 0
        }
    }

    return Object.values(totals).map(t => {
        const row = {...t};
        for(const room of ROOMS) row[room] = t.games ? t[room] / t.games : 0;
        return row;
    });
};
