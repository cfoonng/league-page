<script>
    // Overachiever / Underachiever: a centered (diverging) bar chart of how many points per game
    // each manager scored above or below their starters' projections.
    // Data comes from static/data/achiever.json, exported from the notebook.
    import { getAvatarFromTeamManagers, renderManagerNames, gotoManager } from '$lib/utils/helperFunctions/universalFunctions';

    let { leagueTeamManagers, allTime = false, year = null } = $props();

    let achieverData = $state(null);
    let loadError = $state(false);

    $effect(() => {
        fetch('/data/achiever.json', { cache: 'no-cache' })
            .then(res => {
                if(!res.ok) throw new Error(res.status);
                return res.json();
            })
            .then(data => achieverData = data)
            .catch(() => loadError = true);
    });

    // Rows for the selected view, best overachiever first
    let rows = $derived(
        (achieverData ? (allTime ? achieverData.allTime : achieverData.seasons?.[String(year)]) || [] : [])
            .filter(r => r.ppg !== null && r.ppg !== undefined)
            .slice()
            .sort((a, b) => b.ppg - a.ppg)
    );

    // Bars grow out from the avatar in the middle; the biggest gap (either way) reaches the edge
    let maxAbs = $derived(rows.length ? Math.max(...rows.map(r => Math.abs(r.ppg))) || 1 : 1);
    const sideWidth = (v) => Math.abs(v) / maxAbs * 100;

    const userFor = (row) => row.managerID ? leagueTeamManagers.users[row.managerID] : null;

    const avatarFor = (row) => {
        const user = userFor(row);
        if(user) return `https://sleepercdn.com/avatars/thumbs/${user.avatar}`;
        return row.rosterID ? getAvatarFromTeamManagers(leagueTeamManagers, row.rosterID, year) : '';
    };

    const nameFor = (row) => {
        const user = userFor(row);
        if(user) return user.display_name;
        if(row.rosterID) return renderManagerNames(leagueTeamManagers, row.rosterID, year);
        return row.team || '';
    };

    const goto = (row) => gotoManager({year, leagueTeamManagers, managerID: row.managerID, rosterID: row.rosterID});

    const labelFor = (v) => `${Math.abs(v).toFixed(2)} PPG ${v >= 0 ? 'above' : 'below'} proj`;
</script>

<style>
    /* blue title bar, matching the records tables' headers */
    .chartHeader {
        background-color: var(--headerPrimary);
        text-align: center;
        font-weight: 500;
        font-size: 0.875rem;
        padding: 1em 0.5em;
        margin-bottom: 1em;
    }

    .chartWrapper {
        background-color: var(--fff);
        padding: 0 0 0.5em;
        margin: 0 auto;
        box-shadow: 0px 3px 3px -2px var(--boxShadowOne), 0px 3px 4px 0px var(--boxShadowTwo), 0px 1px 8px 0px var(--boxShadowThree);
    }

    .message {
        text-align: center;
        padding: 2em 1em;
        color: var(--g999);
    }

    /* one row per manager, same height as the Lineup Efficiency rows:
       the avatar sits in the middle, bars grow out from it, and the name sits above the bar */
    .barParent {
        position: relative;
        margin-bottom: -10px;
        height: 76px;
    }

    .managerName {
        position: absolute;
        top: 0;
        white-space: nowrap;
    }

    .managerName.over {
        left: calc(50% + 28px);
    }

    .managerName.under {
        right: calc(50% + 28px);
    }

    .rowBars {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 12px;
        right: 12px;
        margin: auto 0;
        height: 1.8em;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
    }

    .side {
        position: relative;
        height: 100%;
        display: flex;
        align-items: center;
    }

    .side.left {
        justify-content: flex-end;
    }

    .side.right {
        justify-content: flex-start;
    }

    .teamAvatar {
        height: 40px;
        width: 40px;
        border-radius: 50%;
        border: 2px solid;
        background-color: #fff;
        margin: 0 4px;
        z-index: 14;
    }

    .bar {
        height: 100%;
    }

    .bar.over {
        border-radius: 0 0.9em 0.9em 0;
        background-color: var(--achieverOver, #7cc68a);
    }

    .bar.under {
        border-radius: 0.9em 0 0 0.9em;
        background-color: var(--achieverUnder, #ef8f8f);
    }

    /* label starts next to the avatar and reads outward over the bar */
    .barLabel {
        position: absolute;
        top: 0;
        line-height: 1.8em;
        white-space: nowrap;
        z-index: 12;
    }

    .side.right .barLabel {
        left: 8px;
    }

    .side.left .barLabel {
        right: 8px;
    }

    .clickable {
        cursor: pointer;
    }

    @media (max-width: 600px) {
        .barParent {
            height: 57px;
        }
        .managerName {
            font-size: 0.8em;
        }
        .managerName.over {
            left: calc(50% + 22px);
        }
        .managerName.under {
            right: calc(50% + 22px);
        }
        .teamAvatar {
            height: 30px;
            width: 30px;
        }
        .rowBars {
            left: 6px;
            right: 6px;
            height: 1.2em;
        }
        .barLabel {
            line-height: 1.2em;
            font-size: 0.8em;
        }
        .bar.over {
            border-radius: 0 0.6em 0.6em 0;
        }
        .bar.under {
            border-radius: 0.6em 0 0 0.6em;
        }
    }
</style>

<div class="chartWrapper">
    <div class="chartHeader">Overachiever/Underachiever</div>

    {#if loadError}
        <p class="message">No overachiever data uploaded yet.</p>
    {:else if !achieverData}
        <p class="message">Loading...</p>
    {:else if !rows.length}
        <p class="message">No overachiever data for this season.</p>
    {:else}
        {#each rows as row}
            <div class="barParent">
                <span class="managerName clickable {row.ppg >= 0 ? 'over' : 'under'}" onclick={() => goto(row)}>{nameFor(row)}</span>
                <div class="rowBars">
                    <div class="side left">
                        {#if row.ppg < 0}
                            <div class="bar under" style="width: {sideWidth(row.ppg)}%;"></div>
                            <span class="barLabel">{labelFor(row.ppg)}</span>
                        {/if}
                    </div>
                    <img alt="team avatar" onclick={() => goto(row)} style="border-color: {row.ppg >= 0 ? 'var(--achieverOver, #7cc68a)' : 'var(--achieverUnder, #ef8f8f)'};" class="teamAvatar clickable" src={avatarFor(row)} />
                    <div class="side right">
                        {#if row.ppg >= 0}
                            <div class="bar over" style="width: {sideWidth(row.ppg)}%;"></div>
                            <span class="barLabel">{labelFor(row.ppg)}</span>
                        {/if}
                    </div>
                </div>
            </div>
        {/each}
    {/if}
</div>
