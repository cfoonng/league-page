<script>
    // Ranked horizontal bar chart of lineup efficiency (points scored / max possible points).
    // Uses Sleeper's own season totals (fpts and potential points), so no extra data is needed.
    // Styled to match the home page's Rest of Season Power Rankings chart.
    import { getAvatarFromTeamManagers, getTeamNameFromTeamManagers, gotoManager } from '$lib/utils/helperFunctions/universalFunctions';

    let { lineupIQs = [], leagueTeamManagers, year = null } = $props();

    const colors = [
        "--barChartOne",
        "--barChartTwo",
        "--barChartThree",
        "--barChartFour",
        "--barChartFive",
        "--barChartSix",
    ];

    // One entry per manager (all-time) or roster (single season), best efficiency first
    let rows = $derived(
        lineupIQs
            .filter(l => l.potentialPoints)
            .map(l => ({
                ...l,
                efficiency: l.fpts / l.potentialPoints * 100,
                benchPoints: Math.round(l.potentialPoints - l.fpts),
            }))
            .sort((a, b) => b.efficiency - a.efficiency)
    );

    // Axis range: like the home page chart, bars don't start at 0 so differences are visible.
    // The worst team's bar still gets some length, and the best team's bar nearly fills the row.
    let xMax = $derived(rows.length ? Math.min(100, Math.ceil(Math.max(...rows.map(r => r.efficiency)) / 5) * 5) : 100);
    let xMin = $derived(rows.length ? Math.max(0, Math.floor(Math.min(...rows.map(r => r.efficiency)) / 10) * 10 - 10) : 0);

    const barWidth = (eff) => (eff - xMin) / (xMax - xMin || 1) * 100;

    const userFor = (row) => row.managerID ? leagueTeamManagers.users[row.managerID] : null;

    const avatarFor = (row) => {
        const user = userFor(row);
        return user ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : getAvatarFromTeamManagers(leagueTeamManagers, row.rosterID, year);
    };

    const nameFor = (row) => {
        const user = userFor(row);
        if(user) return user.display_name;
        if(row.rosterID) return getTeamNameFromTeamManagers(leagueTeamManagers, row.rosterID, year);
        return '';
    };

    const goto = (row) => gotoManager({year, leagueTeamManagers, managerID: row.managerID, rosterID: row.rosterID});
</script>

<style>
    h6 {
        font-weight: 400;
        width: 100%;
        text-align: center;
        margin: 0 0 1em;
    }

    .chartWrapper {
        background-color: var(--fff);
        padding: 1em 0 0.5em;
        margin: 0 auto;
        box-shadow: 0px 3px 3px -2px var(--boxShadowOne), 0px 3px 4px 0px var(--boxShadowTwo), 0px 1px 8px 0px var(--boxShadowThree);
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
    }

    .leftSpacer {
        width: 40px;
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
    }

    .bar {
        height: 1.8em;
        border-radius: 0 0.9em 0.9em 0;
        z-index: 10;
        white-space: nowrap;
    }

    .barLabel {
        z-index: 12;
        vertical-align: text-top;
        margin-left: 40px;
    }

    .benchNote {
        font-size: 0.75em;
        opacity: 0.85;
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
        .barLabel {
            margin-left: 30px;
            vertical-align: middle;
            font-size: 0.8em;
        }
        .leftSpacer {
            width: 30px;
        }
        .rightSpacer {
            width: 10px;
        }
        .bar {
            height: 1.2em;
            border-radius: 0 0.6em 0.6em 0;
        }
        .vCenter {
            height: 1.2em;
        }
    }
</style>

<h6>Manager Lineup Efficiency</h6>
<div class="chartWrapper">
    {#each rows as row, ix}
        <div class="barParent">
            <img alt="team avatar" onclick={() => goto(row)} style="border-color: var({colors[ix % colors.length]});" class="teamAvatar clickable" src={avatarFor(row)} />
            <span class="managerName clickable" onclick={() => goto(row)}>{nameFor(row)}</span>
            <div class="vCenter">
                <div class="statBars">
                    <div class="leftSpacer"></div>
                    <div class="bars">
                        <div class="bar" style="background-color: var({colors[ix % colors.length]}); width: {barWidth(row.efficiency)}%;">
                            <span class="barLabel">
                                {row.efficiency.toFixed(1)}%
                                <span class="benchNote">({row.benchPoints} pts left on bench)</span>
                            </span>
                        </div>
                    </div>
                    <div class="rightSpacer"></div>
                </div>
            </div>
        </div>
    {/each}
</div>
