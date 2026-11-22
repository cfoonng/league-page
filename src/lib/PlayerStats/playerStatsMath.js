// Player Stats helpers: turn the weekly matchup data saved by the records loader
// (lineupWeeks, regular season only) into player season totals and single games.

export const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

/**
 * Every rostered player's game in every regular season week (starters and bench).
 * @returns {Object[]} {pid, pts, year, week, rosterID, started}
 */
export const allPlayerGames = (lineupWeeks) => {
    const games = [];
    for(const entry of lineupWeeks || []) {
        const starters = new Set(entry.starters || []);
        for(const [pid, pts] of Object.entries(entry.playersPoints || {})) {
            if(pts === null || pts === undefined) continue;
            games.push({pid, pts: Number(pts) || 0, year: entry.year, week: entry.week, rosterID: entry.rosterID, started: starters.has(pid)});
        }
    }
    return games;
};

/**
 * Season totals per player: points scored while on a roster in the league that season.
 * rosterIDs lists every roster he was on that season, in the order he was on them
 * (more than one if he was traded or dropped and picked up).
 * @returns {Object[]} {pid, year, pts, games, rosterIDs}
 */
export const seasonTotals = (games) => {
    const totals = {};
    for(const g of games) {
        const key = `${g.year}-${g.pid}`;
        if(!totals[key]) totals[key] = {pid: g.pid, year: g.year, pts: 0, games: 0, firstWeek: {}};
        totals[key].pts += g.pts;
        totals[key].games++;
        const fw = totals[key].firstWeek;
        if(fw[g.rosterID] === undefined || g.week < fw[g.rosterID]) fw[g.rosterID] = g.week;
    }
    return Object.values(totals).map(({firstWeek, ...t}) => ({
        ...t,
        rosterIDs: Object.keys(firstWeek).sort((a, b) => firstWeek[a] - firstWeek[b]).map(Number),
    }));
};

/** Keep entries for one season (or every season when year is null) and one position (or ALL). */
export const filterBy = (rows, {year = null, position = 'ALL', positionOf}) =>
    rows.filter(r => (year === null || String(r.year) == String(year))
        && (position == 'ALL' || positionOf(r.pid) == position));

export const topN = (rows, n = 10) => rows.slice().sort((a, b) => b.pts - a.pts).slice(0, n);
