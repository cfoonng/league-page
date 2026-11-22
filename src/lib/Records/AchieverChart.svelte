<script>
    // Overachiever / Underachiever: a centered (diverging) bar chart of how many points per game
    // each manager scored above or below their starters' projections.
    // Data comes from static/data/achiever.json, exported from the notebook.
    import { getAvatarFromTeamManagers, getTeamNameFromTeamManagers, gotoManager } from '$lib/utils/helperFunctions/universalFunctions';

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

    // Bars grow out from the center; the biggest gap (either way) reaches the edge
    let maxAbs = $derived(rows.length ? Math.max(...rows.map(r => Math.abs(r.ppg))) || 1 : 1);
    const halfWidth = (v) => Math.abs(v) / maxAbs * 50;

    const userFor = (row) => row.managerID ? leagueTeamManagers.users[row.managerID] : null;

    const avatarFor = (row) => {
        const user = userFor(row);
        if(user) return `https://sleepercdn.com/avatars/thumbs/${user.avatar}`;
        return row.rosterID ? getAvatarFromTeamManagers(leagueTeamManagers, row.rosterID, year) : '';
    };

    const nameFor = (row) => {
        const user = userFor(row);
        if(user) return user.display_name;
        if(row.rosterID) return getTeamNameFromTeamManagers(leagueTeamManagers, row.rosterID, year);
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

    .barParent {
        position: relative;
        margin-bottom: -10px;
        height: 76px;
    }

    .managerName {
        position: absolute;
        top: 0;
        left: 80px;
    }

    .teamAvatar {
        position: absolute;
        left: 20px;
        top: 0;
        bottom: 0;
        height: 40px;
        margin: auto;
        border-radius: 50%;
        border: 2px solid;
        z-index: 14;
        background-color: #fff;
    }

    .vCenter {
        display: block;
        height: 1.8em;
        position: absolute;
        width: 100%;
        top: 0;
        bottom: 0;
        margin: auto 0;
    }

    .statBars {
        display: flex;
        margin: 0 auto;
        height: 100%;
    }

    .leftSpacer {
        width: 70px;
        height: 1px;
        display: inline-block;
    }

    .rightSpacer {
        width: 20px;
        height: 1px;
        display: inline-block;
    }

    .bars {
        flex-grow: 2;
        position: relative;
        height: 100%;
    }

    /* the zero line down the middle */
    .centerLine {
        position: absolute;
        left: 50%;
        top: -0.4em;
        bottom: -0.4em;
        width: 1px;
        background-color: var(--g999);
        opacity: 0.6;
    }

    .bar {
        position: absolute;
        top: 0;
        height: 100%;
    }

    .bar.over {
        left: 50%;
        border-radius: 0 0.9em 0.9em 0;
        background-color: var(--achieverOver, #7cc68a);
    }

    .bar.under {
        right: 50%;
        border-radius: 0.9em 0 0 0.9em;
        background-color: var(--achieverUnder, #ef8f8f);
    }

    /* label starts at the zero line and reads outward over the bar */
    .barLabel {
        position: absolute;
        top: 0;
        line-height: 1.8em;
        white-space: nowrap;
        z-index: 12;
        font-size: 0.9em;
    }

    .barLabel.over {
        left: calc(50% + 8px);
    }

    .barLabel.under {
        right: calc(50% + 8px);
    }

    .clickable {
        cursor: pointer;
    }

    @media (max-width: 600px) {
        .barParent {
            height: 57px;
        }
        .managerName {
            left: 60px;
            font-size: 0.8em;
        }
        .teamAvatar {
            left: 10px;
            height: 30px;
        }
        .leftSpacer {
            width: 50px;
        }
        .rightSpacer {
            width: 10px;
        }
        .vCenter {
            height: 1.2em;
        }
        .barLabel {
            line-height: 1.2em;
            font-size: 0.7em;
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
                <img alt="team avatar" onclick={() => goto(row)} style="border-color: {row.ppg >= 0 ? 'var(--achieverOver, #7cc68a)' : 'var(--achieverUnder, #ef8f8f)'};" class="teamAvatar clickable" src={avatarFor(row)} />
                <span class="managerName clickable" onclick={() => goto(row)}>{nameFor(row)}</span>
                <div class="vCenter">
                    <div class="statBars">
                        <div class="leftSpacer"></div>
                        <div class="bars">
                            <div class="centerLine"></div>
                            <div class="bar {row.ppg >= 0 ? 'over' : 'under'}" style="width: {halfWidth(row.ppg)}%;"></div>
                            <span class="barLabel {row.ppg >= 0 ? 'over' : 'under'}">{labelFor(row.ppg)}</span>
                        </div>
                        <div class="rightSpacer"></div>
                    </div>
                </div>
            </div>
        {/each}
    {/if}
</div>
