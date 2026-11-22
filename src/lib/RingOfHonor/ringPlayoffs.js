// Playoff starting lineups for the Ring of Honor, straight from Sleeper.
// Counts winners bracket games only (including the 3rd place game), every season.
// Returns entries shaped like the records loader's lineupWeeks:
//   {year, week, rosterID, managers, starters, startersPoints, playersPoints, playoff: true}
import { getLeagueData } from '$lib/utils/helperFunctions/leagueData';
import { getNflState } from '$lib/utils/helperFunctions/nflState';
import { getManagers } from '$lib/utils/helperFunctions/universalFunctions';

const CACHE_KEY = 'ringPlayoffWeeks2';
const CACHE_HOURS = 6;

const getJSON = async (url) => {
    const res = await fetch(url, {compress: true});
    return res.ok ? res.json() : null;
};

// weeks a playoff round is played in
// type 0: 1 week per round; 1: 1 week per round + 2-week championship; 2: 2 weeks per round
const roundWeeks = (round, lastRound, start, type) => {
    if(type == 2) return [start + 2 * (round - 1), start + 2 * (round - 1) + 1];
    if(type == 1 && round == lastRound) return [start + round - 1, start + round];
    return [start + round - 1];
};

export const loadPlayoffWeeks = async (leagueID) => {
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if(cached && cached.leagueID == leagueID && Date.now() - cached.ts < CACHE_HOURS * 3600 * 1000) {
            return cached.entries;
        }
    } catch(e) { /* nothing saved */ }

    const nflState = await getNflState().catch(() => ({}));

    const leagues = [];
    let id = leagueID;
    while(id && id != 0) {
        const league = await getLeagueData(id);
        if(!league) break;
        leagues.push(league);
        id = league.previous_league_id;
    }

    const entries = [];
    await Promise.all(leagues.map(async (league) => {
        const year = Number(league.season);
        const start = Number(league.settings?.playoff_week_start);
        if(!start) return;
        let type = year > 2019 ? Number(league.settings?.playoff_round_type || 0) : 0;
        if(year == 2020 && type == 1) type = 2;

        const [bracket, rosters] = await Promise.all([
            getJSON(`https://api.sleeper.app/v1/league/${league.league_id}/winners_bracket`),
            getJSON(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`),
        ]);
        if(!bracket?.length) return;

        const managersByRoster = {};
        for(const roster of rosters || []) managersByRoster[roster.roster_id] = getManagers(roster);

        // which rosters played in which weeks
        const lastRound = Math.max(...bracket.map(m => m.r));
        const playing = {};   // week -> Set(rosterID)
        for(const m of bracket) {
            if(typeof m.t1 != 'number' || typeof m.t2 != 'number') continue;
            if(m.p && m.p > 3) continue;   // skip 5th place games
            for(const week of roundWeeks(m.r, lastRound, start, type)) {
                // skip weeks that haven't finished yet
                if(year == Number(nflState.season) && league.status != 'complete' && week >= Number(nflState.week)) continue;
                (playing[week] = playing[week] || new Set()).add(m.t1).add(m.t2);
            }
        }

        await Promise.all(Object.keys(playing).map(async (week) => {
            const matchups = await getJSON(`https://api.sleeper.app/v1/league/${league.league_id}/matchups/${week}`) || [];
            for(const m of matchups) {
                if(!playing[week].has(m.roster_id)) continue;
                entries.push({
                    year,
                    week: Number(week),
                    rosterID: m.roster_id,
                    managers: managersByRoster[m.roster_id] || [],
                    starters: m.starters || [],
                    startersPoints: m.starters_points || [],
                    playersPoints: m.players_points || {},   // starters and bench (Player Stats single games)
                    playoff: true,
                });
            }
        }));
    }));

    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({leagueID, ts: Date.now(), entries}));
    } catch(e) { /* storage full or blocked */ }
    return entries;
};
