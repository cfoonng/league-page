<script>
    // Home page Power Rankings: week N = going into week N's games. Power score = a team's MaxPF
    // for the fantasy playoff weeks (15, 16, 17), averaged (actual for weeks already played,
    // projected for the rest). Comes from static/data/power_rankings.json (made by the Sleeper
    // Website Updater notebook), which also applies the playoff ordering from week 15 on.
    // If the JSON has no entry for the current regular-season week yet, the site works that
    // week out itself from Sleeper's projections and today's rosters.
    import Button, { Group, Label } from '@smui/button';
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import LinearProgress from '@smui/linear-progress';
    import { getLeagueRosters, getLeagueTeamManagers, getLeagueData, getNflState, loadPlayers, waitForAll } from '$lib/utils/helper';
    import { gotoManager } from '$lib/utils/helperFunctions/universalFunctions';
    import { bestLineup } from '$lib/PlayerStats/startBenchMath';

    const SCORE_WEEKS = [15, 16, 17];
    const LAST_REG_WEEK = 14;           // the site's own backup only covers the regular season
    const FINAL_WEEK = 18;              // "Final" entry once the championship is over
    const VIEWS = [['rank', 'Power Rank'], ['score', 'Power Score']];

    let view = $state('rank');          // Power Rank / Power Score (the Week 1 column follows it)
    let powerData = $state(null);       // power_rankings.json (null if it isn't uploaded)
    let rostersData = $state(null);
    let leagueTeamManagers = $state(null);
    let leagueData = $state(null);
    let nflState = $state(null);
    let players = $state(null);
    let loadError = $state(false);

    $effect(() => {
        waitForAll(
            fetch('/data/power_rankings.json', { cache: 'no-cache' })
                .then(res => res.ok ? res.json() : null)
                .catch(() => null),
            getLeagueRosters(),
            getLeagueTeamManagers(),
            getLeagueData(),
            getNflState(),
        )
            .then(([power, rosters, managers, league, state]) => {
                powerData = power;
                rostersData = rosters;
                leagueTeamManagers = managers;
                leagueData = league;
                nflState = state;
            })
            .catch(() => loadError = true);
    });

    // the week being ranked right now (going into that week's games): 1 before the season,
    // 17 at the latest, Final once the season is over
    let currentWeek = $derived.by(() => {
        if(!nflState || !leagueData) return null;
        if(leagueData.status == 'complete') return FINAL_WEEK;
        if(nflState.season_type == 'regular') return Math.min(Math.max(Number(nflState.week) || 1, 1), SCORE_WEEKS[SCORE_WEEKS.length - 1]);
        if(nflState.season_type == 'post') return SCORE_WEEKS[SCORE_WEEKS.length - 1];
        return 1;
    });

    // weeks from the JSON (only if it's for this season)
    let weeks = $derived(powerData && leagueData && Number(powerData.season) == Number(leagueData.season)
        ? (powerData.weeks || []).slice().sort((a, b) => a.week - b.week)
        : []);
    // this week's entry; in the playoffs (no backup there) fall back to the newest one uploaded
    let jsonCurrent = $derived.by(() => {
        if(currentWeek === null) return null;
        const exact = weeks.find(w => w.week == currentWeek);
        if(exact || currentWeek <= LAST_REG_WEEK) return exact || null;
        return weeks.length ? weeks[weeks.length - 1] : null;
    });

    // ---- backup: work out this week on the site if the JSON doesn't have it yet (regular season only) ----
    let needLive = $derived(leagueData && currentWeek !== null && currentWeek <= LAST_REG_WEEK && !jsonCurrent);
    $effect(() => {
        if(needLive && !players) {
            loadPlayers(null).then(info => players = info.players).catch(() => players = {});
        }
    });

    let liveCurrent = $derived.by(() => {
        if(!needLive || !players || !rostersData || !leagueData) return null;
        const slots = (leagueData.roster_positions || []).filter(s => !['BN', 'IR', 'TAXI'].includes(s));
        const positionOf = (pid) => players[pid]?.pos;
        const teams = Object.values(rostersData.rosters).map(r => {
            const taxi = new Set(r.taxi || []);
            const roster = (r.players || []).filter(p => !taxi.has(p));
            const weekly = SCORE_WEEKS.map(week => {
                const points = {};
                for(const pid of roster) points[pid] = players[pid]?.wi?.[week]?.p || 0;
                return bestLineup(points, slots, positionOf).total;
            });
            return {
                rosterID: r.roster_id,
                managerID: r.owner_id,
                score: Math.round(weekly.reduce((a, b) => a + b, 0) / weekly.length * 100) / 100,
            };
        });
        teams.sort((a, b) => b.score - a.score);
        teams.forEach((t, ix) => t.rank = ix + 1);
        return {week: currentWeek, label: `Week ${currentWeek}`, teams, live: true};
    });

    let current = $derived(jsonCurrent || liveCurrent);
    // the most recent JSON week before this one (for the arrows), and week 1
    let previous = $derived(current ? [...weeks].reverse().find(w => w.week < current.week) || null : null);
    let firstWeek = $derived(weeks.find(w => w.week == 1) || (current?.week == 1 ? current : null));

    const byRoster = (entry) => Object.fromEntries((entry?.teams || []).map(t => [t.rosterID, t]));
    let previousByRoster = $derived(byRoster(previous));
    let firstWeekByRoster = $derived(byRoster(firstWeek));

    let rows = $derived((current?.teams || []).slice().sort((a, b) => a.rank - b.rank).map(t => ({
        ...t,
        // spots moved since the last ranking (positive = moved up); none in week 1
        change: current.week > 1 && previousByRoster[t.rosterID] ? previousByRoster[t.rosterID].rank - t.rank : null,
        pre: firstWeekByRoster[t.rosterID] || null,
    })));

    // live record from Sleeper
    const recordFor = (row) => {
        const s = rostersData?.rosters?.[row.rosterID]?.settings;
        return s ? `${s.wins || 0}-${s.losses || 0}${s.ties ? `-${s.ties}` : ''}` : '';
    };

    const userFor = (row) => leagueTeamManagers?.users?.[row.managerID];
    const nameFor = (row) => userFor(row)?.display_name || row.team || '';
    const avatarFor = (row) => {
        const user = userFor(row);
        return user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null;
    };
    const goto = (row) => gotoManager({leagueTeamManagers, managerID: row.managerID, rosterID: row.rosterID});

    const fmt = (n) => (n == null ? '–' : Number(n).toFixed(2));
</script>

<style>
    .powerRank {
        width: 100%;
        max-width: 560px;
        margin: 2em auto;
    }

    .buttonHolder {
        text-align: center;
        margin: 0 0 1.2em;
    }

    .tableScroll {
        overflow-x: auto;
    }

    :global(.powerTable) {
        width: 100%;
        box-shadow: 0px 3px 3px -2px var(--boxShadowOne), 0px 3px 4px 0px var(--boxShadowTwo), 0px 1px 8px 0px var(--boxShadowThree);
    }

    :global(.powerTable .powerHeader) {
        background-color: var(--headerPrimary);
        text-align: center;
    }

    :global(.powerTable td),
    :global(.powerTable th) {
        text-align: center;
        /* tight columns so the table fits next to the graph */
        padding: 4px 8px;
    }

    .subTitle {
        display: block;
        font-style: italic;
        font-size: 0.8em;
        color: var(--g999);
    }

    .rankCell {
        white-space: nowrap;
    }

    .move {
        font-size: 0.8em;
        margin-left: 6px;
    }

    .up { color: #2e9e44; }
    .down { color: #d23f3f; }
    .same { color: var(--g999); }

    .managerCell {
        display: flex;
        align-items: center;
        cursor: pointer;
        white-space: nowrap;
        text-align: left;
    }

    .avatar {
        height: 30px;
        width: 30px;
        border-radius: 50%;
        margin-right: 8px;
        border: 0.25px solid #777;
    }

    .message {
        text-align: center;
        color: var(--g999);
        margin: 2em 0;
    }

    .loading {
        width: 85%;
        max-width: 500px;
        margin: 80px auto;
    }

    @media (max-width: 600px) {
        .avatar {
            display: none;
        }
    }

    /* shrink the table on phones */
    @media (max-width: 510px) {
        :global(.powerTable th),
        :global(.powerTable td) {
            font-size: 0.8em;
            padding: 1px 10px;
        }
    }

    @media (max-width: 400px) {
        :global(.powerTable th),
        :global(.powerTable td) {
            font-size: 0.65em;
            padding: 1px 6px;
        }
    }

    @media (max-width: 300px) {
        :global(.powerTable th),
        :global(.powerTable td) {
            font-size: 0.5em;
            padding: 1px 3px;
        }
    }
</style>

<div class="powerRank">
    {#if loadError}
        <p class="message">Couldn't load the power rankings.</p>
    {:else if !current}
        <div class="loading">
            <p>Loading power rankings...</p>
            <LinearProgress indeterminate />
        </div>
    {:else}
        <div class="buttonHolder">
            <Group variant="outlined">
                {#each VIEWS as [key, label]}
                    <Button class="selectionButtons" onclick={() => view = key} variant={view == key ? 'raised' : 'outlined'}>
                        <Label>{label}</Label>
                    </Button>
                {/each}
            </Group>
        </div>

        <div class="tableScroll">
            <DataTable class="powerTable">
                <Head>
                    <Row>
                        <Cell class="header powerHeader" colspan=5>
                            Power Rankings
                            <span class="subTitle">{current.label}{current.live ? ' (live estimate)' : ''}</span>
                        </Cell>
                    </Row>
                    <Row>
                        <Cell class="header"></Cell>
                        <Cell class="header">Manager</Cell>
                        <Cell class="header">Record</Cell>
                        <Cell class="header">Power<br />Score</Cell>
                        <Cell class="header">Week 1<br />{view == 'rank' ? 'Rank' : 'Score'}</Cell>
                    </Row>
                </Head>
                <Body>
                    {#each rows as row}
                        <Row>
                            <Cell>
                                <span class="rankCell">
                                    {row.rank}
                                    {#if row.change > 0}
                                        <span class="move up" title="Up {row.change} since {previous.label}">▲{row.change}</span>
                                    {:else if row.change < 0}
                                        <span class="move down" title="Down {-row.change} since {previous.label}">▼{-row.change}</span>
                                    {:else if row.change === 0}
                                        <span class="move same">–</span>
                                    {/if}
                                </span>
                            </Cell>
                            <Cell>
                                <div class="managerCell" onclick={() => goto(row)}>
                                    {#if avatarFor(row)}
                                        <img class="avatar" alt="manager avatar" src={avatarFor(row)} />
                                    {/if}
                                    <span>{nameFor(row)}</span>
                                </div>
                            </Cell>
                            <Cell>{recordFor(row)}</Cell>
                            <Cell>{fmt(row.score)}</Cell>
                            <Cell>{row.pre ? (view == 'rank' ? row.pre.rank : fmt(row.pre.score)) : '–'}</Cell>
                        </Row>
                    {/each}
                </Body>
            </DataTable>
        </div>
    {/if}
</div>
