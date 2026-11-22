// Start / Bench This MF, same logic as the notebook:
//   Start this MF: add one benched player to the manager's lineup, find the best lineup,
//     and compare with what the manager actually scored. The gain is points missed.
//   Bench this MF: fill any empty starting slots from the bench first, then add one bench
//     player and find the best lineup; the starter who gets dropped was wrongfully started.
// Regular season only. Uses lineupWeeks saved by the records loader.

const SLOT_ELIGIBILITY = {
    FLEX: ['RB', 'WR', 'TE'],
    WRRB_FLEX: ['RB', 'WR'],
    REC_FLEX: ['WR', 'TE'],
    SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
    IDP_FLEX: ['DL', 'LB', 'DB'],
};
const eligibility = (slot) => SLOT_ELIGIBILITY[slot] || [slot];
const FILL_BONUS = 1000;

/**
 * Maximum-weight assignment (Hungarian algorithm). W is rows x cols (any shape).
 * Returns an array: for each row, the assigned column (or -1).
 */
export const maxAssignment = (W) => {
    const n = W.length, m = n ? W[0].length : 0;
    const N = Math.max(n, m);
    if(!N) return [];
    let maxW = 0;
    for(const row of W) for(const v of row) if(v > maxW) maxW = v;
    // square cost matrix (minimize maxW - weight; padding cells cost maxW)
    const cost = Array.from({length: N}, (_, i) => Array.from({length: N}, (_, j) =>
        (i < n && j < m) ? maxW - W[i][j] : maxW));

    const u = new Array(N + 1).fill(0), v = new Array(N + 1).fill(0);
    const p = new Array(N + 1).fill(0), way = new Array(N + 1).fill(0);
    for(let i = 1; i <= N; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = new Array(N + 1).fill(Infinity);
        const used = new Array(N + 1).fill(false);
        do {
            used[j0] = true;
            const i0 = p[j0];
            let delta = Infinity, j1 = 0;
            for(let j = 1; j <= N; j++) {
                if(used[j]) continue;
                const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
                if(cur < minv[j]) { minv[j] = cur; way[j] = j0; }
                if(minv[j] < delta) { delta = minv[j]; j1 = j; }
            }
            for(let j = 0; j <= N; j++) {
                if(used[j]) { u[p[j]] += delta; v[j] -= delta; }
                else minv[j] -= delta;
            }
            j0 = j1;
        } while(p[j0] != 0);
        do {
            const j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        } while(j0);
    }
    const result = new Array(n).fill(-1);
    for(let j = 1; j <= N; j++) {
        const i = p[j] - 1;
        if(i >= 0 && i < n && j - 1 < m) result[i] = j - 1;
    }
    return result;
};

/**
 * Best legal lineup from a set of players.
 * points: {pid: pts}, slots: slot types, mustUse: players that have to stay in.
 * Bonuses: fill as many slots as possible, keep mustUse players, then maximize points.
 * @returns {{total: number, filled: number, used: Set}}
 */
export const bestLineup = (points, slots, positionOf, mustUse = new Set()) => {
    const pids = Object.keys(points);
    if(!pids.length || !slots.length) return {total: 0, filled: 0, used: new Set()};
    const W = pids.map(pid => {
        const pos = positionOf(pid);
        const bonus = mustUse.has(pid) ? 2 * FILL_BONUS : FILL_BONUS;
        return slots.map(slot => eligibility(slot).includes(pos) ? points[pid] + bonus : 0);
    });
    const assign = maxAssignment(W);
    const used = new Set();
    assign.forEach((col, j) => { if(col >= 0 && W[j][col] > 0) used.add(pids[j]); });
    let total = 0;
    for(const pid of used) total += points[pid];
    return {total, filled: used.size, used};
};

const r2 = (x) => Math.round(x * 100) / 100;

/**
 * Every Start / Bench offense in every team-week.
 * @returns {{starts: Object[], benches: Object[]}} one row per offense:
 *   {year, week, rosterID, managerID, pid, pts, otherPid, otherPts, gain}
 */
export const findMoves = (lineupWeeks, lineupSlots, positionOf) => {
    const starts = [], benches = [];

    for(const entry of lineupWeeks || []) {
        const slots = lineupSlots[entry.year];
        if(!slots || !slots.length || !entry.playersPoints) continue;
        const base = {year: entry.year, week: entry.week, rosterID: entry.rosterID,
                      managerID: (entry.managers || [])[0] || null};

        // starters (an empty slot is '0' and is skipped) and bench
        const starters = {};
        (entry.starters || []).forEach((pid, i) => {
            if(pid && pid != '0') starters[pid] = Number(entry.startersPoints?.[i]) || 0;
        });
        const bench = {};
        for(const [pid, pts] of Object.entries(entry.playersPoints)) {
            if(!(pid in starters) && pts !== null && pts !== undefined) bench[pid] = Number(pts) || 0;
        }
        const actual = Object.values(starters).reduce((a, b) => a + b, 0);

        // ---- Start this MF ----
        for(const [b, bPts] of Object.entries(bench)) {
            const {total, used} = bestLineup({...starters, [b]: bPts}, slots, positionOf);
            const gain = r2(total - actual);
            if(gain > 0.01 && used.has(b)) {
                const replaced = Object.keys(starters).find(s => !used.has(s)) || null;
                starts.push({...base, pid: b, pts: bPts, otherPid: replaced,
                             otherPts: replaced ? starters[replaced] : 0, gain});
            }
        }

        // ---- Bench this MF ----
        const all = {...starters, ...bench};
        const baseLine = bestLineup(all, slots, positionOf, new Set(Object.keys(starters)));
        const baseline = Object.fromEntries([...baseLine.used].map(p => [p, all[p]]));
        const remaining = Object.fromEntries(Object.entries(bench).filter(([p]) => !baseLine.used.has(p)));

        const worst = {};  // starter -> {gain, by}
        for(const [b, bPts] of Object.entries(remaining)) {
            const {total, used} = bestLineup({...baseline, [b]: bPts}, slots, positionOf);
            const gain = total - baseLine.total;
            if(gain <= 0.01 || !used.has(b)) continue;
            for(const s of Object.keys(baseline)) {
                if(!used.has(s) && s in starters && gain > (worst[s]?.gain ?? 0)) worst[s] = {gain, by: b};
            }
        }
        for(const [s, {gain, by}] of Object.entries(worst)) {
            benches.push({...base, pid: s, pts: starters[s], otherPid: by, otherPts: remaining[by], gain: r2(gain)});
        }
    }
    return {starts, benches};
};

/**
 * Totals per player per manager (all-time: by manager; a season: by roster).
 * @returns {Object[]} {pid, managerID, rosterID, year, ptsMissed, games, ppgMissed}
 */
export const summarizeMoves = (moves, {allTime = false, year = null} = {}) => {
    const totals = {};
    for(const m of moves) {
        if(!allTime && String(m.year) != String(year)) continue;
        const who = allTime ? (m.managerID || `r${m.rosterID}`) : m.rosterID;
        const key = `${m.pid}|${who}`;
        if(!totals[key]) totals[key] = {pid: m.pid, managerID: allTime ? m.managerID : null,
                                        rosterID: m.rosterID, year: allTime ? null : m.year,
                                        ptsMissed: 0, games: 0};
        totals[key].ptsMissed += m.gain;
        totals[key].games++;
    }
    return Object.values(totals)
        .map(t => ({...t, ptsMissed: r2(t.ptsMissed), ppgMissed: r2(t.ptsMissed / t.games)}))
        .sort((a, b) => b.ptsMissed - a.ptsMissed);
};
