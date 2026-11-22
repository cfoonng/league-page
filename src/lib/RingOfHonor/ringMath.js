// Ring of Honor: a manager's all-time team.
// Each player's points = the points he scored in that manager's starting lineups
// (regular season; bench points and points for other managers don't count).
// The best lineup fills the real positions first, then the flex spots, then 4 subs. No defenses.

const SLOT_ELIGIBILITY = {
    FLEX: ['RB', 'WR', 'TE'],
    WRRB_FLEX: ['RB', 'WR'],
    REC_FLEX: ['WR', 'TE'],
    SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};
const SLOT_LABELS = {FLEX: 'FLEX', WRRB_FLEX: 'W/R', REC_FLEX: 'W/T', SUPER_FLEX: 'SFLX'};
const EXCLUDED = new Set(['DEF', 'BN', 'IR', 'TAXI']);
const SUBS = 4;

// every manager who has started a lineup (user IDs)
export const managersInHistory = (lineupWeeks) => {
    const ids = new Set();
    for(const entry of lineupWeeks || []) for(const id of entry.managers || []) ids.add(id);
    return [...ids];
};

// points, starts and seasons for each player in one manager's starting lineups
export const managerTotals = (lineupWeeks, managerID, positionOf) => {
    const totals = {};
    for(const entry of lineupWeeks || []) {
        if(!(entry.managers || []).includes(managerID)) continue;
        (entry.starters || []).forEach((pid, i) => {
            if(!pid || pid == '0' || positionOf(pid) == 'DEF') return;
            const pts = Number(entry.startersPoints?.[i]) || 0;
            const t = totals[pid] || (totals[pid] = {pid, pts: 0, games: 0, years: new Set()});
            t.pts += pts;
            t.games += 1;
            t.years.add(Number(entry.year));
        });
    }
    return Object.values(totals);
};

// "'16-'18, '20"
export const formatYears = (years) => {
    const list = [...years].sort((a, b) => a - b);
    const short = (y) => `'${String(y).slice(-2)}`;
    const parts = [];
    let start = list[0], prev = list[0];
    for(let i = 1; i <= list.length; i++) {
        const y = list[i];
        if(y == prev + 1) { prev = y; continue; }
        parts.push(start == prev ? short(start) : `${short(start)}-${short(prev)}`);
        start = prev = y;
    }
    return list.length ? parts.join(', ') : '';
};

// slots: the league's lineup slots (e.g. ['QB','RB','RB','WR','WR','WR','TE','FLEX','FLEX','SUPER_FLEX'])
export const allTimeTeam = (totals, slots, positionOf) => {
    const pool = totals.slice().sort((a, b) => b.pts - a.pts);
    const used = new Set();
    const lineup = slots.filter(s => !EXCLUDED.has(s)).map(slot => ({slot, player: null}));

    const take = (eligible) => {
        const p = pool.find(t => !used.has(t.pid) && eligible.includes(positionOf(t.pid)));
        if(p) used.add(p.pid);
        return p || null;
    };

    // real positions first
    for(const spot of lineup) {
        if(!SLOT_ELIGIBILITY[spot.slot]) spot.player = take([spot.slot]);
    }
    // then the flex spots, narrowest first (so the superflex gets the best leftover)
    const flexSpots = lineup.filter(s => SLOT_ELIGIBILITY[s.slot])
        .sort((a, b) => SLOT_ELIGIBILITY[a.slot].length - SLOT_ELIGIBILITY[b.slot].length);
    for(const spot of flexSpots) spot.player = take(SLOT_ELIGIBILITY[spot.slot]);

    const starters = lineup.map(s => ({label: SLOT_LABELS[s.slot] || s.slot, player: s.player}));
    const subs = pool.filter(t => !used.has(t.pid)).slice(0, SUBS).map(p => ({label: 'BN', player: p}));
    return {starters, subs};
};
