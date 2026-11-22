<script>
    // Single Week Worst MaxPFs: the lowest points a team could have scored in a week with
    // its best possible lineup (every player on the roster, league lineup slots).
    // Built from the weekly Sleeper data the Records page already loads; nothing to upload.
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import { loadPlayers, gotoManager, round } from '$lib/utils/helper';
    import RecordTeam from './RecordTeam.svelte';
    import { bestLineup } from '$lib/PlayerStats/startBenchMath';

    let { lineupWeeks = [], lineupSlots = {}, leagueTeamManagers, allTime = false, year = null, prefix = '', count = 10 } = $props();

    let players = $state(null);

    $effect(() => {
        loadPlayers(null)
            .then(info => players = info.players)
            .catch(() => players = {});
    });

    const positionOf = (pid) => players?.[pid]?.pos;

    let rows = $derived.by(() => {
        if(!players || !lineupWeeks?.length) return [];
        const out = [];
        for(const entry of lineupWeeks) {
            if(!allTime && year != null && entry.year != year) continue;
            const points = entry.playersPoints || {};
            const slots = lineupSlots?.[entry.year] || [];
            if(!Object.keys(points).length || !slots.length) continue;
            const {total} = bestLineup(points, slots, positionOf);
            out.push({year: entry.year, week: entry.week, rosterID: entry.rosterID, maxPF: total});
        }
        return out.sort((a, b) => a.maxPF - b.maxPF).slice(0, count);
    });
</script>

{#if rows.length}
    <DataTable class="recordTable">
        <Head>
            <Row>
                <Cell class="header headerPrimary" colspan=4>{prefix} Single Week Worst MaxPFs</Cell>
            </Row>
            <Row>
                <Cell class="header rank"></Cell>
                <Cell class="header">Manager</Cell>
                <Cell class="header">Week</Cell>
                <Cell class="header">MaxPF</Cell>
            </Row>
        </Head>
        <Body>
            {#each rows as row, ix}
                <Row>
                    <Cell class="rank">{ix + 1}</Cell>
                    <Cell class="cellName" onclick={() => gotoManager({year: row.year, leagueTeamManagers, rosterID: row.rosterID})}>
                        <RecordTeam {leagueTeamManagers} rosterID={row.rosterID} year={row.year} />
                    </Cell>
                    <Cell>{allTime ? row.year + " " : ""}Week {row.week}</Cell>
                    <Cell>{round(row.maxPF)}</Cell>
                </Row>
            {/each}
        </Body>
    </DataTable>
{/if}
