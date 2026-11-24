<script>
    // Home page Team Value table: FantasyCalc dynasty values for each team (from
    // static/data/team_values.json, exported by the current-season notebook), with each
    // team's live record and standing from Sleeper.
    import Button, { Group, Label } from '@smui/button';
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import LinearProgress from '@smui/linear-progress';
    import { getLeagueRosters, getLeagueTeamManagers, waitForAll } from '$lib/utils/helper';
    import { gotoManager } from '$lib/utils/helperFunctions/universalFunctions';

    // value columns: [key in the JSON, label]
    const COLUMNS = [
        ['total', 'Team'],
        ['players', 'Players Only'],
        ['starters', 'Starters'],
        ['QB', 'QB'],
        ['RB', 'RB'],
        ['WR', 'WR'],
        ['TE', 'TE'],
        ['picks', 'Picks'],
    ];

    // sort buttons, in two rows: overall first, then positions
    const BUTTON_ROWS = [
        [['record', 'Record'], ['total', 'Team'], ['players', 'Players Only'], ['starters', 'Starters'], ['picks', 'Picks']],
        [['QB', 'QB'], ['RB', 'RB'], ['WR', 'WR'], ['TE', 'TE']],
    ];

    let valueData = $state(null);
    let rostersData = $state(null);
    let leagueTeamManagers = $state(null);
    let loadError = $state(false);
    let sortKey = $state('record');

    $effect(() => {
        waitForAll(
            fetch('/data/team_values.json', { cache: 'no-cache' }).then(res => {
                if(!res.ok) throw new Error(res.status);
                return res.json();
            }),
            getLeagueRosters(),
            getLeagueTeamManagers(),
        )
            .then(([values, rosters, managers]) => {
                valueData = values;
                rostersData = rosters;
                leagueTeamManagers = managers;
            })
            .catch(() => loadError = true);
    });

    // live record + standing (wins, then points for) from Sleeper
    let standings = $derived.by(() => {
        if(!rostersData) return {};
        const list = Object.values(rostersData.rosters).map(r => {
            const s = r.settings || {};
            return {
                rosterID: r.roster_id,
                wins: s.wins || 0,
                losses: s.losses || 0,
                ties: s.ties || 0,
                fpts: (s.fpts || 0) + (s.fpts_decimal || 0) / 100,
            };
        });
        list.sort((a, b) => (b.wins + b.ties / 2) - (a.wins + a.ties / 2) || b.fpts - a.fpts);
        return Object.fromEntries(list.map((r, ix) => [r.rosterID, {...r, standing: ix + 1}]));
    });

    // Record sorts by standing (#1 first); every other option sorts highest value first
    let rows = $derived(
        (valueData?.teams || []).slice().sort((a, b) => {
            if(sortKey == 'record') {
                return (standings[a.rosterID]?.standing ?? 99) - (standings[b.rosterID]?.standing ?? 99);
            }
            return b[sortKey] - a[sortKey];
        })
    );

    // each team's rank within every value column, e.g. ranks.RB[rosterID] = 7
    let ranks = $derived(Object.fromEntries(COLUMNS.map(([key]) => {
        const order = (valueData?.teams || []).slice().sort((a, b) => b[key] - a[key]);
        return [key, Object.fromEntries(order.map((r, ix) => [r.rosterID, ix + 1]))];
    })));

    // best and worst at each column (for the cell colors)
    let ranges = $derived(Object.fromEntries(COLUMNS.map(([key]) => {
        const vals = rows.map(r => r[key]);
        return [key, {min: Math.min(...vals), max: Math.max(...vals)}];
    })));

    // red (worst) -> yellow -> green (best), within each column
    const cellColor = (key, value) => {
        const {min, max} = ranges[key];
        const t = max > min ? (value - min) / (max - min) : 0.5;
        return `hsla(${Math.round(t * 120)}, 65%, 50%, 0.35)`;
    };

    const recordFor = (row) => {
        const s = standings[row.rosterID];
        return s ? `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ''}` : '';
    };

    const userFor = (row) => leagueTeamManagers?.users?.[row.managerID];
    const nameFor = (row) => userFor(row)?.display_name || row.team || '';
    const avatarFor = (row) => {
        const user = userFor(row);
        return user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null;
    };
    const goto = (row) => gotoManager({leagueTeamManagers, managerID: row.managerID, rosterID: row.rosterID});

    const fmt = (n) => Math.round(n).toLocaleString();
</script>

<style>
    .teamValue {
        width: 100%;
        margin: 2em auto;
    }

    .buttonHolder {
        text-align: center;
        margin: 0 0 1.2em;
    }

    .buttonRow + .buttonRow {
        margin-top: 0.5em;
    }

    .tableScroll {
        overflow-x: auto;
    }

    :global(.valueTable) {
        width: 100%;
        box-shadow: 0px 3px 3px -2px var(--boxShadowOne), 0px 3px 4px 0px var(--boxShadowTwo), 0px 1px 8px 0px var(--boxShadowThree);
    }

    :global(.valueTable .valueHeader) {
        background-color: var(--headerPrimary);
        text-align: center;
    }

    .subTitle {
        display: block;
        font-style: italic;
        font-size: 0.8em;
        color: var(--g999);
    }

    .managerCell {
        display: flex;
        align-items: center;
        cursor: pointer;
        white-space: nowrap;
    }

    .avatar {
        height: 30px;
        width: 30px;
        border-radius: 50%;
        margin-right: 10px;
        border: 0.25px solid #777;
    }

    /* value on top, its rank underneath, both centered */
    :global(.valueTable .valueCell) {
        white-space: nowrap;
        text-align: center;
        line-height: 1.2;
    }

    /* rank within the column, 2pt smaller */
    .standing {
        font-size: calc(1em - 2pt);
        color: var(--g999);
    }

    .selected {
        font-weight: 700;
    }

    .selectedHeader {
        font-weight: 700;
        text-decoration: underline;
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
        :global(.buttonHolder .selectionButtons) {
            font-size: 0.6em;
            padding: 0 6px;
        }
    }

    /* shrink the table on smaller screens (it has 10 columns, so it starts sooner) */
    @media (max-width: 800px) {
        :global(.valueTable th),
        :global(.valueTable td) {
            font-size: 0.85em;
            padding: 1px 10px;
        }
    }

    @media (max-width: 650px) {
        :global(.valueTable th),
        :global(.valueTable td) {
            font-size: 0.7em;
            padding: 1px 8px;
        }
    }

    @media (max-width: 510px) {
        :global(.valueTable th),
        :global(.valueTable td) {
            font-size: 0.6em;
            padding: 1px 6px;
        }
    }

    @media (max-width: 400px) {
        :global(.valueTable th),
        :global(.valueTable td) {
            font-size: 0.5em;
            padding: 1px 4px;
        }
    }

    @media (max-width: 300px) {
        :global(.valueTable th),
        :global(.valueTable td) {
            font-size: 0.4em;
            padding: 1px 3px;
        }
    }
</style>

<div class="teamValue">
    {#if loadError}
        <p class="message">No team value data uploaded yet.</p>
    {:else if !valueData}
        <div class="loading">
            <p>Loading team values...</p>
            <LinearProgress indeterminate />
        </div>
    {:else}
        <div class="buttonHolder">
            {#each BUTTON_ROWS as buttonRow}
                <div class="buttonRow">
                    <Group variant="outlined">
                        {#each buttonRow as [key, label]}
                            <Button class="selectionButtons" onclick={() => sortKey = key} variant="{sortKey == key ? 'raised' : 'outlined'}">
                                <Label>{label}</Label>
                            </Button>
                        {/each}
                    </Group>
                </div>
            {/each}
        </div>

        <div class="tableScroll">
            <DataTable class="valueTable">
                <Head>
                    <Row>
                        <Cell class="header valueHeader" colspan={COLUMNS.length + 3}>
                            Team Value (Week {valueData.week})
                            <span class="subTitle">FantasyCalc values as of {valueData.snapshotDate}</span>
                        </Cell>
                    </Row>
                    <Row>
                        <Cell class="header"></Cell>
                        <Cell class="header">Manager</Cell>
                        <Cell class="header"><span class={sortKey == 'record' ? 'selectedHeader' : ''}>Record</span></Cell>
                        {#each COLUMNS as [key, label]}
                            <Cell class="header">
                                <span class={sortKey == key ? 'selectedHeader' : ''}>
                                    {#if key == 'players'}Players<br />Only{:else}{label}{/if}
                                </span>
                            </Cell>
                        {/each}
                    </Row>
                </Head>
                <Body>
                    {#each rows as row, ix}
                        <Row>
                            <Cell>{ix + 1}</Cell>
                            <Cell>
                                <div class="managerCell" onclick={() => goto(row)}>
                                    {#if avatarFor(row)}
                                        <img class="avatar" alt="manager avatar" src={avatarFor(row)} />
                                    {/if}
                                    <span>{nameFor(row)}</span>
                                </div>
                            </Cell>
                            <Cell><span class={sortKey == 'record' ? 'selected' : ''}>{recordFor(row)}</span></Cell>
                            {#each COLUMNS as [key]}
                                <Cell class="valueCell" style="background-color: {cellColor(key, row[key])};">
                                    <span class={sortKey == key ? 'selected' : ''}>{fmt(row[key])}</span><br /><span class="standing">(#{ranks[key][row.rosterID]})</span>
                                </Cell>
                            {/each}
                        </Row>
                    {/each}
                </Body>
            </DataTable>
        </div>
    {/if}
</div>
