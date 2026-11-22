<script>
    // Player Stats page: player scoring records from the league's own weekly Sleeper data
    // (regular season, every rostered player, league scoring). Nothing needs uploading.
    import Button, { Group, Label } from '@smui/button';
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import LinearProgress from '@smui/linear-progress';
    import { getLeagueRecords, getLeagueTeamManagers, loadPlayers, waitForAll } from '$lib/utils/helper';
    import { renderManagerNames } from '$lib/utils/helperFunctions/universalFunctions';
    import { POSITIONS, allPlayerGames, seasonTotals, filterBy, topN } from './playerStatsMath';
    import { findMoves, summarizeMoves } from './startBenchMath';

    const TOP_N = 10;

    let lineupWeeks = $state(null);
    let lineupSlots = $state({});
    let players = $state(null);
    let leagueTeamManagers = $state(null);
    let loadError = $state(null);

    let display = $state('allTime');   // 'allTime' or a year
    let position = $state('ALL');

    const hasPlayerPoints = (records) =>
        records?.regularSeasonData?.lineupWeeks?.some(w => w.playersPoints);

    $effect(() => {
        waitForAll(getLeagueRecords(false), loadPlayers(null), getLeagueTeamManagers())
            .then(async ([records, playersInfo, managers]) => {
                players = playersInfo.players;
                leagueTeamManagers = managers;
                // older saved records don't have every player's points yet: rebuild them
                if(records.stale || !hasPlayerPoints(records)) {
                    if(hasPlayerPoints(records)) lineupWeeks = records.regularSeasonData.lineupWeeks;
                    records = await getLeagueRecords(true);
                }
                lineupSlots = records.regularSeasonData?.lineupSlots || {};
                lineupWeeks = records.regularSeasonData?.lineupWeeks || [];
            })
            .catch(err => loadError = err?.message || 'Something went wrong');
    });

    let games = $derived(lineupWeeks ? allPlayerGames(lineupWeeks) : []);
    let seasons = $derived(seasonTotals(games));
    let years = $derived([...new Set(games.map(g => g.year))].sort((a, b) => b - a));

    const positionOf = (pid) => players?.[pid]?.pos;

    let selectedYear = $derived(display == 'allTime' ? null : display);
    let seasonRows = $derived(topN(filterBy(seasons, {year: selectedYear, position, positionOf}), TOP_N));
    let gameRows = $derived(topN(filterBy(games, {year: selectedYear, position, positionOf}), TOP_N));


    const playerName = (pid) => {
        const p = players?.[pid];
        if(!p) return pid;
        return [p.fn, p.ln].filter(Boolean).join(' ') || pid;
    };

    // manager username(s) for a roster in a given season (current season if year is null)
    const teamName = (rosterID, year = null) => {
        if(!rosterID || !leagueTeamManagers) return 'FA';
        try {
            return renderManagerNames(leagueTeamManagers, rosterID, year);
        } catch(e) {
            return '';
        }
    };

    // the manager he played for that season; null if he was on more than one roster
    const seasonManager = (row) => row.rosterIDs.length == 1 ? teamName(row.rosterIDs[0], row.year) : null;

    // Sleeper headshot (team logo for defenses), same images the Rosters page uses
    const playerPhoto = (pid) => positionOf(pid) == 'DEF'
        ? `background-image: url(https://sleepercdn.com/images/team_logos/nfl/${String(pid).toLowerCase()}.png)`
        : `background-image: url(https://sleepercdn.com/content/nfl/players/thumb/${pid}.jpg), url(https://sleepercdn.com/images/v2/icons/player_default.webp)`;

    // split at the first space, e.g. "Ja'Marr Chase" -> ["Ja'Marr", "Chase"], "Amon-Ra St. Brown" -> ["Amon-Ra", "St. Brown"]
    const splitName = (text) => {
        const i = (text || '').indexOf(' ');
        return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
    };

    const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);

    // ---- Start/Bench This MF (season / all-time only, no position filter) ----
    let moves = $derived(lineupWeeks && players ? findMoves(lineupWeeks, lineupSlots, positionOf) : {starts: [], benches: []});
    let startRows = $derived(summarizeMoves(moves.starts, {allTime: display == 'allTime', year: selectedYear}).slice(0, TOP_N));
    let benchRows = $derived(summarizeMoves(moves.benches, {allTime: display == 'allTime', year: selectedYear}).slice(0, TOP_N));

    // all-time rows are per manager; season rows are per roster
    const moveManager = (row) => row.managerID
        ? (leagueTeamManagers?.users?.[row.managerID]?.display_name || '')
        : teamName(row.rosterID, row.year);

    let seasonTitle = $derived(display == 'allTime' ? 'All-Time Single Season Scoring Records' : `${display} Season Leaders`);
    let gameTitle = $derived(display == 'allTime' ? 'All-Time Single Game Performances' : `${display} Single Game Performances`);
    let posLabel = $derived(position == 'ALL' ? '' : ` (${position})`);
</script>

<style>
    .playerStats {
        margin: 0 auto;
        width: 95%;
        max-width: 1200px;
    }

    h4 {
        text-align: center;
        margin: 2em 0 1em;
    }

    .buttonHolder {
        text-align: center;
        margin: 0 0 0.6em;
    }

    .tables {
        display: flex;
        flex-wrap: wrap;
        gap: 2em;
        justify-content: center;
        margin: 2em auto 4em;
    }

    /* two tables side by side; they only stack on narrow screens */
    .panel {
        flex: 1 1 380px;
        min-width: 0;
        max-width: 600px;
    }

    .tableScroll {
        overflow-x: auto;
    }

    .multiple {
        color: var(--g999);
    }

    :global(.playerTable) {
        width: 100%;
        box-shadow: 0px 3px 3px -2px var(--boxShadowOne), 0px 3px 4px 0px var(--boxShadowTwo), 0px 1px 8px 0px var(--boxShadowThree);
    }

    :global(.playerTable .tableHeader) {
        background-color: var(--headerPrimary);
        text-align: center;
    }

    .sectionNote {
        text-align: center;
        font-style: italic;
        color: var(--g999);
        margin: -0.5em 0 1em;
    }

    .subTitle {
        display: block;
        font-style: italic;
        font-size: 0.8em;
        color: var(--g999);
    }

    .playerCell {
        display: flex;
        align-items: center;
    }

    .playerPhoto {
        flex: 0 0 auto;
        width: 36px;
        height: 36px;
        margin-right: 10px;
        border-radius: 50%;
        background-color: var(--fff);
        background-size: cover;
        background-position: center;
        border: 0.25px solid #777;
    }

    .pos {
        font-size: 0.8em;
        color: var(--g999);
        margin-left: 0.4em;
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

    @media (max-width: 540px) {
        :global(.buttonHolder .selectionButtons) {
            font-size: 0.6em;
            padding: 0 6px;
        }
    }
</style>

<div class="playerStats">
    <h4>Player Stats</h4>

    {#if loadError}
        <p class="message">Something went wrong: {loadError}</p>
    {:else if !lineupWeeks || !players}
        <div class="loading">
            <p>Loading player stats...</p>
            <LinearProgress indeterminate />
        </div>
    {:else}
        <!-- All-Time or a single season -->
        <div class="buttonHolder">
            <Group variant="outlined">
                <Button class="selectionButtons" onclick={() => display = 'allTime'} variant="{display == 'allTime' ? 'raised' : 'outlined'}">
                    <Label>All-Time</Label>
                </Button>
                {#each years as year}
                    <Button class="selectionButtons" onclick={() => display = year} variant="{display == year ? 'raised' : 'outlined'}">
                        <Label>{year}</Label>
                    </Button>
                {/each}
            </Group>
        </div>

        <!-- position filter -->
        <div class="buttonHolder">
            <Group variant="outlined">
                {#each POSITIONS as pos}
                    <Button class="selectionButtons" onclick={() => position = pos} variant="{position == pos ? 'raised' : 'outlined'}">
                        <Label>{pos}</Label>
                    </Button>
                {/each}
            </Group>
        </div>

        <div class="tables">
            <!-- left: best seasons (All-Time) or season leaders -->
            <div class="panel">
                <div class="tableScroll">
                <DataTable class="playerTable">
                    <Head>
                        <Row>
                            <Cell class="header tableHeader" colspan={display == 'allTime' ? 5 : 4}>
                                {seasonTitle}{posLabel}
                                <span class="subTitle">Regular season, points scored while on a roster in the league</span>
                            </Cell>
                        </Row>
                        <Row>
                            <Cell class="header"></Cell>
                            <Cell class="header">Player</Cell>
                            <Cell class="header">Manager</Cell>
                            {#if display == 'allTime'}
                                <Cell class="header">Year</Cell>
                            {/if}
                            <Cell class="header">Total<br />Points</Cell>
                        </Row>
                    </Head>
                    <Body>
                        {#each seasonRows as row, ix}
                            <Row>
                                <Cell>{ix + 1}</Cell>
                                <Cell>
                                    <div class="playerCell">
                                        <div class="playerPhoto" style={playerPhoto(row.pid)}></div>
                                        <span>{splitName(playerName(row.pid))[0]}{#if splitName(playerName(row.pid))[1]}<br />{splitName(playerName(row.pid))[1]}{/if}<span class="pos">{positionOf(row.pid) || ''}</span></span>
                                    </div>
                                </Cell>
                                <Cell>
                                    {#if seasonManager(row) !== null}
                                        {seasonManager(row)}
                                    {:else}
                                        <i class="multiple">multiple</i>
                                    {/if}
                                </Cell>
                                {#if display == 'allTime'}
                                    <Cell>{row.year}</Cell>
                                {/if}
                                <Cell>{fmt(row.pts)}</Cell>
                            </Row>
                        {:else}
                            <Row><Cell colspan={display == 'allTime' ? 5 : 4}>No players yet.</Cell></Row>
                        {/each}
                    </Body>
                </DataTable>
                </div>
            </div>

            <!-- right: best single games -->
            <div class="panel">
                <div class="tableScroll">
                <DataTable class="playerTable">
                    <Head>
                        <Row>
                            <Cell class="header tableHeader" colspan=5>
                                {gameTitle}{posLabel}
                                <span class="subTitle">Regular season, starters and bench</span>
                            </Cell>
                        </Row>
                        <Row>
                            <Cell class="header"></Cell>
                            <Cell class="header">Player</Cell>
                            <Cell class="header">Manager</Cell>
                            <Cell class="header">Year &amp;<br />Week</Cell>
                            <Cell class="header">Points</Cell>
                        </Row>
                    </Head>
                    <Body>
                        {#each gameRows as row, ix}
                            <Row>
                                <Cell>{ix + 1}</Cell>
                                <Cell>
                                    <div class="playerCell">
                                        <div class="playerPhoto" style={playerPhoto(row.pid)}></div>
                                        <span>{splitName(playerName(row.pid))[0]}{#if splitName(playerName(row.pid))[1]}<br />{splitName(playerName(row.pid))[1]}{/if}<span class="pos">{positionOf(row.pid) || ''}</span></span>
                                    </div>
                                </Cell>
                                <Cell>{teamName(row.rosterID, row.year)}</Cell>
                                <Cell>{row.year} Week {row.week}</Cell>
                                <Cell>{fmt(row.pts)}</Cell>
                            </Row>
                        {:else}
                            <Row><Cell colspan=5>No games yet.</Cell></Row>
                        {/each}
                    </Body>
                </DataTable>
                </div>
            </div>
        </div>

        <h4>Start/Bench This MF</h4>
        <p class="sectionNote">Starters who are frequently outscored by bench players, and bench players who frequently outscore starters</p>

        <div class="tables">
            {#each [['Start this MF', startRows, 'Games Benched'], ['Bench this MF', benchRows, 'Games Started']] as [title, moveRows, gamesLabel]}
                <div class="panel">
                    <div class="tableScroll">
                    <DataTable class="playerTable">
                        <Head>
                            <Row>
                                <Cell class="header tableHeader" colspan=6>
                                    {title} ({display == 'allTime' ? 'All-Time' : display})
                                </Cell>
                            </Row>
                            <Row>
                                <Cell class="header"></Cell>
                                <Cell class="header">Player</Cell>
                                <Cell class="header">Manager</Cell>
                                <Cell class="header">Pts<br />Missed</Cell>
                                <Cell class="header">PPG<br />Missed</Cell>
                                <Cell class="header">{splitName(gamesLabel)[0]}<br />{splitName(gamesLabel)[1]}</Cell>
                            </Row>
                        </Head>
                        <Body>
                            {#each moveRows as row, ix}
                                <Row>
                                    <Cell>{ix + 1}</Cell>
                                    <Cell>
                                    <div class="playerCell">
                                        <div class="playerPhoto" style={playerPhoto(row.pid)}></div>
                                        <span>{splitName(playerName(row.pid))[0]}{#if splitName(playerName(row.pid))[1]}<br />{splitName(playerName(row.pid))[1]}{/if}<span class="pos">{positionOf(row.pid) || ''}</span></span>
                                    </div>
                                </Cell>
                                    <Cell>{moveManager(row)}</Cell>
                                    <Cell>{fmt(row.ptsMissed)}</Cell>
                                    <Cell>{fmt(row.ppgMissed)}</Cell>
                                    <Cell>{row.games}</Cell>
                                </Row>
                            {:else}
                                <Row><Cell colspan=6>None yet.</Cell></Row>
                            {/each}
                        </Body>
                    </DataTable>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
