<script>
    import Button, { Group, Label } from '@smui/button';
    import { getLeagueRecords, getLeagueTransactions } from '$lib/utils/helper';
    import AllTimeRecords from './AllTimeRecords.svelte';
    import PerSeasonRecords from './PerSeasonRecords.svelte';
    import LastUpdated from './LastUpdated.svelte';

    let {leagueData, totals, stale, leagueTeamManagers} = $props();;

    const refreshTransactions = async () => {
        const newTransactions = await getLeagueTransactions(false, true);
        totals = newTransactions.totals;
    }

    let leagueManagerRecords = $state();
    let leagueRosterRecords = $state();
    let leagueWeekHighs = $state();
    let leagueWeekLows = $state();
    let allTimeClosestMatchups = $state();
    let allTimeBiggestBlowouts = $state();
    let allTimeMostCombined = $state();
    let mostSeasonLongMaxPF = $state([]);
    let leastSeasonLongMaxPF = $state([]);
    let incompleteYears = $state([]);
    let lineupWeeks = $state([]);
    let lineupSlots = $state({});
    let allTimeLeastCombined = $state();
    let mostSeasonLongPoints = $state();
    let leastSeasonLongPoints = $state();
    let seasonWeekRecords = $state();
    let currentYear = $state();
    let lastYear = $state();

    const refreshRecords = async () => {
        const newRecords = await getLeagueRecords(true);

        // update values with new data
        leagueData = newRecords;
    }

    // Regular season only (the Playoffs option was removed)
    const key = "regularSeasonData";

    $effect(() => {
        if(!leagueData || !leagueData[key]) return;

        const selectedLeagueData = leagueData[key];

        leagueManagerRecords = selectedLeagueData.leagueManagerRecords;
        leagueRosterRecords = selectedLeagueData.leagueRosterRecords;
        leagueWeekHighs = selectedLeagueData.leagueWeekHighs;
        leagueWeekLows = selectedLeagueData.leagueWeekLows;
        allTimeClosestMatchups = selectedLeagueData.allTimeClosestMatchups;
        allTimeBiggestBlowouts = selectedLeagueData.allTimeBiggestBlowouts;
        allTimeMostCombined = selectedLeagueData.allTimeMostCombined;
        mostSeasonLongMaxPF = selectedLeagueData.mostSeasonLongMaxPF || [];
        leastSeasonLongMaxPF = selectedLeagueData.leastSeasonLongMaxPF || [];
        incompleteYears = selectedLeagueData.incompleteYears || [];
        lineupWeeks = selectedLeagueData.lineupWeeks || [];
        lineupSlots = selectedLeagueData.lineupSlots || {};
        allTimeLeastCombined = selectedLeagueData.allTimeLeastCombined;
        mostSeasonLongPoints = selectedLeagueData.mostSeasonLongPoints;
        leastSeasonLongPoints = selectedLeagueData.leastSeasonLongPoints;
        seasonWeekRecords = selectedLeagueData.seasonWeekRecords;
        currentYear = selectedLeagueData.currentYear;
        lastYear = selectedLeagueData.lastYear;
    });

    if(stale) {
        refreshTransactions();
    }

    if(leagueData.stale) {
        refreshRecords();
    }

    // every section has its own All-Time / year choice
    // color: the blue boxes' color for that section (the first keeps the normal color)
    const SECTIONS = [
        {id: 'lineups', title: 'Setting Lineups', color: null},
        {id: 'positions', title: 'Position Contributions', color: 'var(--sectionTwo)'},
        {id: 'seasons', title: 'Best/Worst Seasons', color: 'var(--sectionThree)'},
        {id: 'scoring', title: 'Scoring Records', color: 'var(--sectionFour)'},
    ];
    // null = the newest season (the default); 'allTime' or a year once a button is clicked
    let views = $state({lineups: null, positions: null, seasons: null, scoring: null});
    const viewOf = (id) => views[id] ?? Number(currentYear);

    let years = $derived.by(() => {
        const list = [];
        for(let y = Number(currentYear); y >= Number(lastYear); y--) list.push(y);
        return list;
    });

</script>

<style>
    .rankingsWrapper {
        margin: 0 auto;
        width: 100%;
        max-width: 1200px;
    }

    h4 {
        text-align: center;
        margin: 2em 0 1em;
    }

    /* each section wraps its blue boxes so it can set their color */
    .section {
        display: contents;
    }

    .empty {
        margin: 10em 0 4em;
        text-align: center;
    }

    /* Button Styling */
    .buttonHolder {
        text-align: center;
        margin: 0 0 1em;
    }

    /* Start button resizing */

    @media (max-width: 540px) {
        :global(.buttonHolder .selectionButtons) {
            font-size: 0.6em;
        }
    }

    @media (max-width: 415px) {
        :global(.buttonHolder .selectionButtons) {
            font-size: 0.5em;
            padding: 0 6px;
        }
    }

    @media (max-width: 315px) {
        :global(.buttonHolder .selectionButtons) {
            font-size: 0.45em;
            padding: 0 3px;
        }
    }

    /* End button resizing */
</style>

<div class="rankingsWrapper">
    <!-- wait until the records are in before drawing a season (default view) -->
    {#if currentYear && leagueRosterRecords && seasonWeekRecords}
    {#each SECTIONS as sec}
    <div class="section" style={sec.color ? `--headerPrimary: ${sec.color}` : ''}>
        <h4>{sec.title}</h4>
        {#if sec.id == 'lineups'}
            <LastUpdated />
        {/if}

        <div class="buttonHolder">
            <Group variant="outlined">
                {#each years as year}
                    <Button class="selectionButtons" onclick={() => views[sec.id] = year} variant="{viewOf(sec.id) == year ? "raised" : "outlined"}">
                        <Label>{year}</Label>
                    </Button>
                {/each}
                <Button class="selectionButtons" onclick={() => views[sec.id] = "allTime"} variant="{viewOf(sec.id) == "allTime" ? "raised" : "outlined"}">
                    <Label>All-Time</Label>
                </Button>
            </Group>
        </div>

        {#key viewOf(sec.id)}
            {#if viewOf(sec.id) == "allTime"}
                {#if leagueWeekHighs?.length}
                    <AllTimeRecords section={sec.id} transactionTotals={totals} {allTimeClosestMatchups} {allTimeBiggestBlowouts} {allTimeMostCombined} {allTimeLeastCombined} {mostSeasonLongMaxPF} {leastSeasonLongMaxPF} {incompleteYears} {lineupWeeks} {lineupSlots} {leagueManagerRecords} {leagueWeekHighs} {leagueWeekLows} {leagueTeamManagers} {mostSeasonLongPoints} {leastSeasonLongPoints} {key} />
                {:else}
                    <p class="empty">No records <i>yet</i>...</p>
                {/if}
            {:else}
                <PerSeasonRecords section={sec.id} year={viewOf(sec.id)} transactionTotals={totals} {incompleteYears} {lineupWeeks} {lineupSlots} {leagueRosterRecords} {seasonWeekRecords} {leagueTeamManagers} {currentYear} {lastYear} {key} />
            {/if}
        {/key}
    </div>
    {/each}
    {/if}
</div>
