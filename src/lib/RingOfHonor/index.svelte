<script>
    // Ring of Honor: pick a manager and see their all-time team, built from the points each
    // player scored in that manager's starting lineups (regular season + playoffs). Nothing to upload.
    import Button, { Group, Label } from '@smui/button';
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import LinearProgress from '@smui/linear-progress';
    import { getLeagueRecords, getLeagueTeamManagers, loadPlayers, waitForAll, leagueID } from '$lib/utils/helper';
    import { managersInHistory, managerTotals, formatYears, allTimeTeam } from './ringMath';
    import { loadPlayoffWeeks } from './ringPlayoffs';

    let lineupWeeks = $state(null);
    let lineupSlots = $state({});
    let players = $state(null);
    let leagueTeamManagers = $state(null);
    let loadError = $state(null);
    let managerID = $state(null);

    $effect(() => {
        waitForAll(getLeagueRecords(false), loadPlayers(null), getLeagueTeamManagers(), loadPlayoffWeeks(leagueID).catch(() => []))
            .then(async ([records, playersInfo, managers, playoffWeeks]) => {
                players = playersInfo.players;
                leagueTeamManagers = managers;
                if(records.stale) records = await getLeagueRecords(true);
                lineupSlots = records.regularSeasonData?.lineupSlots || {};
                // regular season + playoff starting lineups
                lineupWeeks = [...(records.regularSeasonData?.lineupWeeks || []), ...(playoffWeeks || [])];
            })
            .catch(err => loadError = err?.message || 'Something went wrong');
    });

    const positionOf = (pid) => players?.[pid]?.pos;
    const userName = (id) => leagueTeamManagers?.users?.[id]?.display_name || 'Unknown';
    const userAvatar = (id) => {
        const avatar = leagueTeamManagers?.users?.[id]?.avatar;
        return avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : 'https://sleepercdn.com/images/v2/icons/player_default.webp';
    };

    let managerIDs = $derived(lineupWeeks && leagueTeamManagers
        ? managersInHistory(lineupWeeks).filter(id => leagueTeamManagers.users?.[id])
            .sort((a, b) => userName(a).localeCompare(userName(b)))
        : []);

    $effect(() => {
        if(!managerID && managerIDs.length) managerID = managerIDs[0];
    });

    // lineup slots from the most recent season
    let slots = $derived.by(() => {
        const years = Object.keys(lineupSlots || {}).map(Number).sort((a, b) => b - a);
        return years.length ? lineupSlots[years[0]] : [];
    });

    let team = $derived(players && lineupWeeks && managerID
        ? allTimeTeam(managerTotals(lineupWeeks, managerID, positionOf), slots, positionOf)
        : {starters: [], subs: []});

    let starterTotal = $derived(team.starters.reduce((sum, s) => sum + (s.player?.pts || 0), 0));
    let starterPlayoffTotal = $derived(team.starters.reduce((sum, s) => sum + (s.player?.playoffPts || 0), 0));

    const playerName = (pid) => {
        const p = players?.[pid];
        if(!p) return pid;
        return [p.fn, p.ln].filter(Boolean).join(' ') || pid;
    };
    const splitName = (text) => {
        const i = (text || '').indexOf(' ');
        return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
    };
    const playerPhoto = (pid) =>
        `background-image: url(https://sleepercdn.com/content/nfl/players/thumb/${pid}.jpg), url(https://sleepercdn.com/images/v2/icons/player_default.webp)`;
    const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);
</script>

<style>
    .ring {
        margin: 0 auto;
        width: 95%;
        max-width: 800px;
    }

    h4 {
        text-align: center;
        margin: 2em 0 1em;
    }

    .buttonHolder {
        text-align: center;
        margin: 0 0 1.5em;
    }

    .managerButtons {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.5em;
    }

    .avatar {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        margin-right: 6px;
    }

    .tableScroll {
        overflow-x: auto;
        margin-bottom: 4em;
    }

    :global(.ringTable) {
        width: 100%;
        box-shadow: 0px 3px 3px -2px var(--boxShadowOne), 0px 3px 4px 0px var(--boxShadowTwo), 0px 1px 8px 0px var(--boxShadowThree);
    }

    :global(.ringTable .tableHeader) {
        background-color: var(--headerPrimary);
        text-align: center;
    }

    :global(.ringTable .subsRow td) {
        font-style: italic;
        color: var(--g999);
        text-align: center;
        background-color: var(--f3f3f3, rgba(0,0,0,0.03));
    }

    :global(.ringTable .totalRow td) {
        font-weight: 600;
    }

    .subTitle {
        display: block;
        font-style: italic;
        font-size: 0.8em;
        color: var(--g999);
    }

    .slot {
        font-weight: 600;
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
</style>

{#snippet playerRow(spot)}
    <Row>
        <Cell><span class="slot">{spot.label}</span></Cell>
        {#if spot.player}
            <Cell>
                <div class="playerCell">
                    <div class="playerPhoto" style={playerPhoto(spot.player.pid)}></div>
                    <span>{splitName(playerName(spot.player.pid))[0]}{#if splitName(playerName(spot.player.pid))[1]}<br />{splitName(playerName(spot.player.pid))[1]}{/if}<span class="pos">{positionOf(spot.player.pid) || ''}</span></span>
                </div>
            </Cell>
            <Cell>{fmt(spot.player.pts)}</Cell>
            <Cell>{fmt(spot.player.pts / spot.player.games)}</Cell>
            <Cell>{spot.player.games}</Cell>
            <Cell>{fmt(spot.player.playoffPts)}</Cell>
            <Cell>{spot.player.playoffGames}</Cell>
            <Cell>{formatYears(spot.player.years)}</Cell>
        {:else}
            <Cell colspan=7><i class="pos">empty</i></Cell>
        {/if}
    </Row>
{/snippet}

<div class="ring">
    <h4>Ring of Honor</h4>

    {#if loadError}
        <p class="message">Something went wrong: {loadError}</p>
    {:else if !lineupWeeks || !players || !leagueTeamManagers}
        <div class="loading">
            <p>Loading the Ring of Honor...</p>
            <LinearProgress indeterminate />
        </div>
    {:else}
        <div class="buttonHolder managerButtons">
            {#each managerIDs as id}
                <Button onclick={() => managerID = id} variant="{managerID == id ? 'raised' : 'outlined'}">
                    <img class="avatar" src={userAvatar(id)} alt="" />
                    <Label>{userName(id)}</Label>
                </Button>
            {/each}
        </div>

        {#if managerID}
            <div class="tableScroll">
                <DataTable class="ringTable">
                    <Head>
                        <Row>
                            <Cell class="header tableHeader" colspan=8>
                                {userName(managerID)}'s All-Time Team
                                <span class="subTitle">Regular season and playoff points scored in {userName(managerID)}'s starting lineups</span>
                            </Cell>
                        </Row>
                        <Row>
                            <Cell class="header">Position</Cell>
                            <Cell class="header">Player</Cell>
                            <Cell class="header">Points</Cell>
                            <Cell class="header">Points<br />Per Game</Cell>
                            <Cell class="header">Games</Cell>
                            <Cell class="header">Playoff<br />Points</Cell>
                            <Cell class="header">Playoff<br />Games</Cell>
                            <Cell class="header">Years</Cell>
                        </Row>
                    </Head>
                    <Body>
                        {#each team.starters as spot}
                            {@render playerRow(spot)}
                        {/each}
                        <Row class="totalRow">
                            <Cell></Cell>
                            <Cell>Starters Total</Cell>
                            <Cell>{fmt(starterTotal)}</Cell>
                            <Cell></Cell>
                            <Cell></Cell>
                            <Cell>{fmt(starterPlayoffTotal)}</Cell>
                            <Cell colspan=2></Cell>
                        </Row>
                        {#if team.subs.length}
                            <Row class="subsRow"><Cell colspan=8>Substitutes</Cell></Row>
                            {#each team.subs as spot}
                                {@render playerRow(spot)}
                            {/each}
                        {/if}
                    </Body>
                </DataTable>
            </div>
        {/if}
    {/if}
</div>
