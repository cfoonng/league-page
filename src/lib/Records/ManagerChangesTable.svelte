<script>
    // "Total Lineup Changes Made": how many times each manager swapped a starter out
    // from one week to the next. Data comes from static/data/manager_changes.json,
    // exported from the historical notebook.
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import { gotoManager } from '$lib/utils/helperFunctions/universalFunctions';

    let { leagueTeamManagers, allTime = false, year = null, prefix = '' } = $props();

    let changesData = $state(null);
    let loadError = $state(false);

    $effect(() => {
        fetch('/data/manager_changes.json', { cache: 'no-cache' })
            .then(res => {
                if(!res.ok) throw new Error(res.status);
                return res.json();
            })
            .then(data => changesData = data)
            .catch(() => loadError = true);
    });

    // most changes first
    let rows = $derived(
        (changesData ? (allTime ? changesData.allTime : changesData.seasons?.[String(year)]) || [] : [])
            .slice()
            .sort((a, b) => b.changes - a.changes)
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

    .message {
        text-align: center;
        color: var(--g999);
        margin: 2em 0;
    }
</style>

{#if loadError}
    <p class="message">No lineup-change data uploaded yet.</p>
{:else if changesData && !rows.length}
    <p class="message">No lineup-change data for this season.</p>
{:else if rows.length}
    <DataTable class="recordTable" style="width: 100%; margin: 0;">
        <Head>
            <Row>
                <Cell class="header headerPrimary" colspan=3>Total Lineup Changes Made ({prefix})</Cell>
            </Row>
            <Row>
                <Cell class="header rank"></Cell>
                <Cell class="header">Manager</Cell>
                <Cell class="header">Changes</Cell>
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
                    <Cell>{row.changes}</Cell>
                </Row>
            {/each}
        </Body>
    </DataTable>
{/if}
