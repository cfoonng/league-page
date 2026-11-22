<script>
    // "If Everyone Set Perfect Lineups": hypothetical standings if every team had played its
    // best possible lineup every week, next to the real record.
    // Data comes from static/data/bestball.json, exported from the historical notebook
    // (ranks and the PF tiebreaker are worked out there).
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import { gotoManager } from '$lib/utils/helperFunctions/universalFunctions';

    let { leagueTeamManagers, allTime = false, year = null, prefix = '' } = $props();

    let bestBallData = $state(null);
    let loadError = $state(false);

    $effect(() => {
        fetch('/data/bestball.json', { cache: 'no-cache' })
            .then(res => {
                if(!res.ok) throw new Error(res.status);
                return res.json();
            })
            .then(data => bestBallData = data)
            .catch(() => loadError = true);
    });

    let rows = $derived(
        (bestBallData ? (allTime ? bestBallData.allTime : bestBallData.seasons?.[String(year)]) || [] : [])
            .slice()
            .sort((a, b) => a.rank - b.rank)
    );

    const userFor = (row) => leagueTeamManagers.users[row.managerID];
    const nameFor = (row) => userFor(row)?.display_name || row.team || '';
    const avatarFor = (row) => {
        const user = userFor(row);
        return user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null;
    };
    const goto = (row) => gotoManager({year, leagueTeamManagers, managerID: row.managerID});
</script>

<style>
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

    /* rank number with the up/down marker next to it */
    .rankCell {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
    }

    .move {
        display: inline-block;
        min-width: 1.8em;
        margin-left: 0.4em;
        font-size: 0.8em;
        text-align: left;
    }

    /* standing next to each record, 2pt smaller */
    .standing {
        font-size: calc(1em - 2pt);
        color: var(--g999);
    }

    .up {
        color: #3a9d4f;
    }

    .down {
        color: #d9534f;
    }

    .same {
        color: var(--g999);
    }

    .message {
        text-align: center;
        color: var(--g999);
        margin: 2em 0;
    }
</style>

{#if loadError}
    <p class="message">No perfect-lineup data uploaded yet.</p>
{:else if bestBallData && !rows.length}
    <p class="message">No perfect-lineup data for this season.</p>
{:else if rows.length}
    <DataTable class="recordTable" style="width: 100%; margin: 0;">
        <Head>
            <Row>
                <Cell class="header headerPrimary" colspan=4>If Everyone Set Perfect Lineups ({prefix})</Cell>
            </Row>
            <Row>
                <Cell class="header rank"></Cell>
                <Cell class="header">Manager</Cell>
                <Cell class="header">Hypothetical Record</Cell>
                <Cell class="header">Actual Record</Cell>
            </Row>
        </Head>
        <Body>
            {#each rows as row}
                <Row>
                    <Cell class="rank">
                        <span class="rankCell">
                            <span>{row.rank}</span>
                            {#if row.change > 0}
                                <span class="move up" title="Would have finished {row.change} spot{row.change == 1 ? '' : 's'} higher">▲{row.change}</span>
                            {:else if row.change < 0}
                                <span class="move down" title="Would have finished {-row.change} spot{row.change == -1 ? '' : 's'} lower">▼{-row.change}</span>
                            {:else}
                                <span class="move same" title="Same finish">–</span>
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
                    <Cell>{row.record}&nbsp;&nbsp;<span class="standing">(#{row.rank})</span></Cell>
                    <Cell>{row.actualRecord}&nbsp;&nbsp;<span class="standing">(#{row.actualRank})</span></Cell>
                </Row>
            {/each}
        </Body>
    </DataTable>
{/if}
