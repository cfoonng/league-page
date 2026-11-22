<script>
    // Position Contributions: points per game each manager got from each position room
    // (QB, RB, WR, TE, FLX), from their actual regular season starting lineups.
    // Built from Sleeper data the Records page already loads, so nothing needs uploading.
    import Button, { Group, Label } from '@smui/button';
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import { loadPlayers } from '$lib/utils/helper';
    import { getAvatarFromTeamManagers, renderManagerNames, gotoManager } from '$lib/utils/helperFunctions/universalFunctions';
    import { ROOMS, computeContributions } from './contributionsMath';

    let { lineupWeeks = [], lineupSlots = {}, leagueTeamManagers, allTime = false, year = null, prefix = '' } = $props();

    let players = $state(null);
    let selectedRoom = $state('QB');

    $effect(() => {
        loadPlayers(null)
            .then(info => players = info.players)
            .catch(() => players = {});
    });

    const positionOf = (pid) => players?.[pid]?.pos;

    let rows = $derived(
        players && lineupWeeks.length
            ? computeContributions(lineupWeeks, lineupSlots, positionOf, {allTime, year})
                .sort((a, b) => b[selectedRoom] - a[selectedRoom])
            : []
    );

    // best and worst room at each position (for the cell colors)
    let ranges = $derived(Object.fromEntries(ROOMS.map(room => {
        const vals = rows.map(r => r[room]);
        return [room, {min: Math.min(...vals), max: Math.max(...vals)}];
    })));

    // red (worst) -> yellow -> green (best), within each position
    const cellColor = (room, value) => {
        const {min, max} = ranges[room];
        const t = max > min ? (value - min) / (max - min) : 0.5;
        return `hsla(${Math.round(t * 120)}, 65%, 50%, 0.35)`;
    };

    const userFor = (row) => {
        if(row.managerID) return leagueTeamManagers.users[row.managerID];
        const managers = leagueTeamManagers.teamManagersMap?.[year]?.[row.rosterID]?.managers;
        return managers?.length ? leagueTeamManagers.users[managers[0]] : null;
    };

    const nameFor = (row) => {
        if(row.managerID) return leagueTeamManagers.users[row.managerID]?.display_name || '';
        return renderManagerNames(leagueTeamManagers, row.rosterID, year);
    };

    const avatarFor = (row) => {
        const user = userFor(row);
        if(user?.avatar) return `https://sleepercdn.com/avatars/thumbs/${user.avatar}`;
        return row.rosterID ? getAvatarFromTeamManagers(leagueTeamManagers, row.rosterID, year) : null;
    };

    const goto = (row) => gotoManager({year, leagueTeamManagers, managerID: row.managerID, rosterID: row.rosterID});
</script>

<style>
    .contributions {
        margin: 0 auto;
        width: 100%;
        max-width: 1200px;
    }

    .buttonHolder {
        text-align: center;
        margin: 0 0 1.5em;
    }

    .managerCell {
        display: flex;
        align-items: center;
        cursor: pointer;
    }

    .avatar {
        height: 30px;
        width: 30px;
        border-radius: 50%;
        margin-right: 12px;
        border: 0.25px solid #777;
    }

    .selectedHeader {
        font-weight: 700;
        text-decoration: underline;
    }

    .selectedCell {
        font-weight: 700;
    }

    .message {
        text-align: center;
        color: var(--g999);
        margin: 2em 0;
    }

    @media (max-width: 600px) {
        .avatar {
            display: none;
        }
    }
</style>

<div class="contributions">
    <div class="buttonHolder">
        <Group variant="outlined">
            {#each ROOMS as room}
                <Button class="selectionButtons" onclick={() => selectedRoom = room} variant="{selectedRoom == room ? 'raised' : 'outlined'}">
                    <Label>{room}</Label>
                </Button>
            {/each}
        </Group>
    </div>

    {#if !players || !lineupWeeks.length}
        <p class="message">Loading lineups...</p>
    {:else if !rows.length}
        <p class="message">No lineups for this season yet.</p>
    {:else}
        <DataTable class="recordTable" style="width: 100%; margin: 0;">
            <Head>
                <Row>
                    <Cell class="header headerPrimary" colspan={ROOMS.length + 2}>Points Per Game by Position Room ({prefix})</Cell>
                </Row>
                <Row>
                    <Cell class="header rank"></Cell>
                    <Cell class="header">Manager</Cell>
                    {#each ROOMS as room}
                        <Cell class="header"><span class={selectedRoom == room ? 'selectedHeader' : ''}>{room}<br />Room</span></Cell>
                    {/each}
                </Row>
            </Head>
            <Body>
                {#each rows as row, ix}
                    <Row>
                        <Cell class="rank">{ix + 1}</Cell>
                        <Cell>
                            <div class="managerCell" onclick={() => goto(row)}>
                                {#if avatarFor(row)}
                                    <img class="avatar" alt="manager avatar" src={avatarFor(row)} />
                                {/if}
                                <span>{nameFor(row)}</span>
                            </div>
                        </Cell>
                        {#each ROOMS as room}
                            <Cell style="background-color: {cellColor(room, row[room])};">
                                <span class={selectedRoom == room ? 'selectedCell' : ''}>{row[room].toFixed(2)}</span>
                            </Cell>
                        {/each}
                    </Row>
                {/each}
            </Body>
        </DataTable>
    {/if}
</div>
