// JIT Tracker: young players (rookie / 2nd year / 3rd year) with their league draft
// slot and how their manager got them. Draft picks and transactions come straight from
// Sleeper for every season in the league's history (saved in the browser for 6 hours).
import { getLeagueData } from '$lib/utils/helperFunctions/leagueData';

export const JIT_GROUPS = [
    {label: 'Rookie', exp: 0},
    {label: '2nd Year', exp: 1},
    {label: '3rd Year', exp: 2},
];

const CACHE_KEY = 'jitAcquisitions';
const CACHE_HOURS = 6;

const getJSON = async (url) => {
    const res = await fetch(url, {compress: true});
    if(!res.ok) return null;
    return res.json();
};

// every draft pick and every completed add (trade / waiver / free agent) in league history
export const loadAcquisitions = async (leagueID) => {
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if(cached && cached.leagueID == leagueID && Date.now() - cached.ts < CACHE_HOURS * 3600 * 1000) {
            return cached.data;
        }
    } catch(e) { /* no saved copy */ }

    // walk back through previous seasons
    const leagues = [];
    let id = leagueID;
    while(id && id != 0) {
        const league = await getLeagueData(id);
        if(!league) break;
        leagues.push({id, season: Number(league.season)});
        id = league.previous_league_id;
    }

    const picks = [];
    const adds = [];
    const allDrafts = [];

    await Promise.all(leagues.map(async ({id, season}) => {
        const drafts = await getJSON(`https://api.sleeper.app/v1/league/${id}/drafts`) || [];
        await Promise.all(drafts.map(async (draft) => {
            if(draft.status != 'complete') return;
            const draftPicks = await getJSON(`https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`) || [];
            const teams = draft.settings?.teams || 10;
            allDrafts.push({draftID: draft.draft_id, time: draft.start_time || draft.last_picked || 0});
            for(const pick of draftPicks) {
                if(!pick.player_id) continue;
                picks.push({
                    pid: String(pick.player_id),
                    rosterID: Number(pick.roster_id),
                    season: Number(draft.season) || season,
                    round: pick.round,
                    pickInRound: ((pick.pick_no - 1) % teams) + 1,
                    draftID: draft.draft_id,
                    time: draft.last_picked || draft.start_time || 0,
                });
            }
        }));

        // week 0 holds some offseason moves; 1-18 covers the season
        const weeks = Array.from({length: 19}, (_, i) => i);
        const weekData = await Promise.all(weeks.map(w =>
            getJSON(`https://api.sleeper.app/v1/league/${id}/transactions/${w}`).catch(() => null)));
        for(const transactions of weekData) {
            for(const t of transactions || []) {
                if(t.status != 'complete' || !t.adds) continue;
                const type = t.type == 'trade' ? 'Trade'
                    : (t.type == 'waiver' || t.type == 'free_agent') ? 'Waivers'
                    : null;
                if(!type) continue;
                for(const [pid, rosterID] of Object.entries(t.adds)) {
                    adds.push({pid: String(pid), rosterID: Number(rosterID), season, type, time: t.status_updated || t.created || 0});
                }
            }
        }
    }));

    // the league's first draft is the startup; every later one is a rookie draft
    allDrafts.sort((a, b) => a.time - b.time);
    const startupID = allDrafts[0]?.draftID;
    for(const pick of picks) pick.startup = pick.draftID == startupID;

    const data = {picks, adds};
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({leagueID, ts: Date.now(), data}));
    } catch(e) { /* storage full or blocked: just don't save */ }
    return data;
};

const pad = (n) => String(n).padStart(2, '0');

// "R1-03" (rookie draft), "R8-07 (startup)" or "UDFA" (never drafted in this league)
export const draftLabel = (pid, season, acquisitions) => {
    const pick = (acquisitions?.picks || [])
        .filter(p => p.pid == pid && p.season <= season)
        .sort((a, b) => b.time - a.time)[0];
    if(!pick) return 'UDFA';
    return `R${pick.round}-${pad(pick.pickInRound)}${pick.startup ? ' (startup)' : ''}`;
};

// how this roster got him: its most recent draft pick / trade / waiver add of him, up to that season
export const acquisitionLabel = (pid, rosterID, season, acquisitions) => {
    if(!rosterID || !acquisitions) return '—';
    const events = [
        ...acquisitions.picks.filter(p => p.pid == pid && p.rosterID == rosterID && p.season <= season)
            .map(p => ({time: p.time, season: p.season, type: 'Drafted'})),
        ...acquisitions.adds.filter(a => a.pid == pid && a.rosterID == rosterID && a.season <= season),
    ];
    if(!events.length) return '—';
    events.sort((a, b) => (b.season - a.season) || (b.time - a.time));
    return events[0].type;
};

// top players in one experience group for a season.
// seasons: rows from seasonTotals; games: rows from allPlayerGames
// refSeason: the season the players' years of experience (ye) refer to
export const jitRows = ({seasons, games, players, season, exp, refSeason, currentRosters, isCurrentSeason, limit = 10}) => {
    // the roster he was on most recently that season
    const lastRoster = {};
    for(const g of games) {
        if(g.year != season) continue;
        const prev = lastRoster[g.pid];
        if(!prev || g.week > prev.week) lastRoster[g.pid] = {week: g.week, rosterID: g.rosterID};
    }
    // who has him right now (current season only)
    const currentOwner = {};
    if(isCurrentSeason && currentRosters) {
        for(const roster of Object.values(currentRosters)) {
            for(const pid of roster.players || []) currentOwner[pid] = Number(roster.roster_id);
        }
    }

    // overall and position ranks among every player's points that season
    const ranked = seasons.filter(r => r.year == season).sort((a, b) => b.pts - a.pts);
    const overallRank = {};
    const posRank = {};
    const posCount = {};
    ranked.forEach((r, i) => {
        overallRank[r.pid] = i + 1;
        const pos = players?.[r.pid]?.pos || '';
        posCount[pos] = (posCount[pos] || 0) + 1;
        posRank[r.pid] = `${pos}${posCount[pos]}`;
    });

    return seasons
        .filter(r => r.year == season)
        .filter(r => {
            const p = players?.[r.pid];
            if(!p || p.ye === undefined || p.pos == 'DEF') return false;
            return p.ye - (refSeason - season) == exp;
        })
        .sort((a, b) => b.pts - a.pts)
        .slice(0, limit)
        .map(r => ({
            ...r,
            rosterID: currentOwner[r.pid] ?? lastRoster[r.pid]?.rosterID ?? null,
            posRank: posRank[r.pid],
            overallRank: overallRank[r.pid],
        }));
};
