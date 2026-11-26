<script>
    // Power ranking history graph: one line per team, one dot per week.
    // Hover (or tap) a dot or line to highlight that team and see its value.
    // weeks: [{week, label, live?, teams: [{rosterID, managerID, rank, score}]}], oldest first
    // view: 'rank' (1 at the top) or 'score'
    let { weeks = [], view = 'rank', nameFor = (t) => t.team || '' } = $props();

    // Colors are handed out in alphabetical order of team name, so each team keeps its color.
    // Up to 10 teams: matplotlib's default colors (tab10).
    const TAB10 = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
                   '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
    // 11-20 teams: matplotlib's tab20 (each tab10 color plus a lighter version)
    const TAB20 = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896',
                   '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7',
                   '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'];
    // more than 20: evenly spaced hues
    const paletteFor = (n) => n <= 10 ? TAB10
        : n <= 20 ? TAB20
        : Array.from({length: n}, (_, i) => `hsl(${Math.round(i * 360 / n)}, 65%, 50%)`);

    // drawing area (scaled to fit the width of its box)
    // the Power Score view is a bit taller so the scores have more room
    const W = 640;
    let H = $derived(view == 'score' ? 480 : 400);
    const PAD = { left: 44, right: 96, top: 18, bottom: 34 };
    const plotW = W - PAD.left - PAD.right;
    let plotH = $derived(H - PAD.top - PAD.bottom);

    let hovered = $state(null);      // {rosterID, ix} of the dot being pointed at
    let pinned = $state(null);       // rosterID kept highlighted by a tap/click

    // every team that shows up, in the order of the newest week
    let teams = $derived.by(() => {
        const last = weeks[weeks.length - 1];
        const seen = new Map();
        for(const t of (last?.teams || []).slice().sort((a, b) => a.rank - b.rank)) seen.set(t.rosterID, t);
        for(const w of weeks) for(const t of w.teams) if(!seen.has(t.rosterID)) seen.set(t.rosterID, t);
        const list = [...seen.values()].map(t => ({rosterID: t.rosterID, name: nameFor(t)}));
        const palette = paletteFor(list.length);
        const alphabetical = [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, {sensitivity: 'base'}));
        const colorOf = new Map(alphabetical.map((t, i) => [t.rosterID, palette[i]]));
        return list.map(t => ({...t, color: colorOf.get(t.rosterID)}));
    });

    const valueOf = (t) => view == 'rank' ? t.rank : t.score;

    // y scale
    let yDomain = $derived.by(() => {
        if(view == 'rank') return [1, Math.max(10, teams.length)];
        const vals = weeks.flatMap(w => w.teams.map(t => t.score)).filter(v => v != null);
        if(!vals.length) return [0, 1];
        const lo = Math.min(...vals), hi = Math.max(...vals);
        const pad = Math.max((hi - lo) * 0.08, 1);
        return [Math.floor((lo - pad) / 5) * 5, Math.ceil((hi + pad) / 5) * 5];
    });
    const x = (ix) => PAD.left + (weeks.length <= 1 ? plotW / 2 : (ix / (weeks.length - 1)) * plotW);
    const y = (v) => {
        const [lo, hi] = yDomain;
        const frac = (v - lo) / (hi - lo || 1);
        return view == 'rank' ? PAD.top + frac * plotH : PAD.top + (1 - frac) * plotH;   // rank 1 at the top
    };

    let yTicks = $derived.by(() => {
        const [lo, hi] = yDomain;
        if(view == 'rank') return Array.from({length: hi - lo + 1}, (_, i) => lo + i);
        const step = niceStep((hi - lo) / 5);
        const ticks = [];
        for(let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
        return ticks;
    });
    function niceStep(raw) {
        const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
        const n = raw / p;
        return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
    }

    // each team's dots
    let series = $derived(teams.map(team => ({
        ...team,
        points: weeks.map((w, ix) => {
            const t = w.teams.find(tt => tt.rosterID == team.rosterID);
            return t ? {ix, week: w, value: valueOf(t), cx: x(ix), cy: y(valueOf(t))} : null;
        }).filter(Boolean),
    })));

    const pathFor = (points) => points.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');

    // names at the right end of each line, nudged apart so they don't overlap
    let endLabels = $derived.by(() => {
        const labels = series.filter(s => s.points.length).map(s => {
            const p = s.points[s.points.length - 1];
            return {rosterID: s.rosterID, name: s.name, color: s.color, x: p.cx + 8, y: p.cy};
        }).sort((a, b) => a.y - b.y);
        const GAP = 13;
        for(let i = 1; i < labels.length; i++) {
            if(labels[i].y - labels[i - 1].y < GAP) labels[i].y = labels[i - 1].y + GAP;
        }
        const overflow = labels.length ? labels[labels.length - 1].y - (H - PAD.bottom) : 0;
        if(overflow > 0) labels.forEach(l => l.y -= overflow);
        return labels;
    });

    let active = $derived(hovered?.rosterID ?? pinned);
    const dim = (rosterID) => active != null && active != rosterID;

    // tooltip for the dot being pointed at
    let tip = $derived.by(() => {
        if(!hovered) return null;
        const s = series.find(ss => ss.rosterID == hovered.rosterID);
        const p = s?.points.find(pp => pp.ix == hovered.ix);
        if(!p) return null;
        const valueText = view == 'rank' ? `Rank ${p.value}` : `Score ${Number(p.value).toFixed(2)}`;
        const lines = [s.name, `${p.week.label}${p.week.live ? ' (live)' : ''}: ${valueText}`];
        const width = Math.max(...lines.map(l => l.length)) * 6.6 + 16;
        const height = 38;
        let tx = p.cx + 10, ty = p.cy - height - 8;
        if(tx + width > W - 4) tx = p.cx - width - 10;
        if(ty < 2) ty = p.cy + 10;
        return {lines, x: tx, y: ty, width, height, color: s.color};
    });

    const togglePin = (rosterID) => pinned = pinned == rosterID ? null : rosterID;
    const shortLabel = (w) => w.label == 'Final' ? 'Final' : w.label.replace('Week ', 'Wk ');
</script>

<style>
    .chart {
        width: 100%;
    }

    svg {
        width: 100%;
        height: auto;
        display: block;
        font-family: inherit;
        user-select: none;
    }

    .grid line {
        stroke: var(--g999);
        stroke-opacity: 0.25;
        stroke-width: 1;
    }

    .axis text {
        fill: var(--g999);
        font-size: 11px;
    }

    .line {
        fill: none;
        stroke-width: 2.2;
        stroke-linejoin: round;
        stroke-linecap: round;
        transition: stroke-width 0.15s, opacity 0.15s;
        cursor: pointer;
    }

    .hit {
        fill: none;
        stroke: transparent;
        stroke-width: 12;
        cursor: pointer;
    }

    .line.active {
        stroke-width: 4;
    }

    .faded {
        opacity: 0.15;
    }

    .dot {
        stroke: var(--fff);
        stroke-width: 1.5;
        cursor: pointer;
        transition: opacity 0.15s;
    }

    .live {
        stroke-dasharray: 3 2;
    }

    .endLabel {
        font-size: 11px;
        font-weight: 600;
        transition: opacity 0.15s;
        cursor: pointer;
    }

    .tip rect {
        fill: var(--fff);
        stroke-width: 1.5;
        filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.25));
    }

    .tip text {
        fill: var(--g111);
        font-size: 11px;
    }

    .tip .tipName {
        font-weight: 700;
    }

    .empty {
        text-align: center;
        color: var(--g999);
        margin: 2em 0;
    }
</style>

<div class="chart">
    {#if weeks.length}
        <svg viewBox="0 0 {W} {H}" role="img" aria-label="Power rankings by week" onmouseleave={() => hovered = null}>
            <!-- gridlines + y axis -->
            <g class="grid">
                {#each yTicks as t}
                    <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
                {/each}
            </g>
            <g class="axis">
                {#each yTicks as t}
                    <text x={PAD.left - 8} y={y(t) + 4} text-anchor="end">{view == 'rank' ? t : Math.round(t)}</text>
                {/each}
                {#each weeks as w, ix}
                    {#if weeks.length <= 10 || ix % 2 == 0 || ix == weeks.length - 1}
                        <text x={x(ix)} y={H - PAD.bottom + 18} text-anchor="middle">{shortLabel(w)}</text>
                    {/if}
                {/each}
            </g>

            <!-- lines (the highlighted one is drawn last so it sits on top) -->
            {#each [...series].sort((a, b) => (a.rosterID == active) - (b.rosterID == active)) as s (s.rosterID)}
                <g role="presentation" onclick={() => togglePin(s.rosterID)}>
                    <path class="hit" d={pathFor(s.points)}
                        onmouseenter={() => hovered = {rosterID: s.rosterID, ix: null}}
                        onmouseleave={() => hovered = null} />
                    <path class="line" class:active={active == s.rosterID} class:faded={dim(s.rosterID)}
                        d={pathFor(s.points.filter(p => !p.week.live))} stroke={s.color} />
                    {#if s.points.some(p => p.week.live) && s.points.length > 1}
                        <path class="line live" class:faded={dim(s.rosterID)}
                            d={pathFor(s.points.slice(-2))} stroke={s.color} />
                    {/if}
                    {#each s.points as p}
                        <circle class="dot" class:faded={dim(s.rosterID)}
                            cx={p.cx} cy={p.cy} r={active == s.rosterID ? 5 : 3.5} fill={s.color}
                            onmouseenter={() => hovered = {rosterID: s.rosterID, ix: p.ix}}
                            onmouseleave={() => hovered = null}
                            role="presentation" />
                    {/each}
                </g>
            {/each}

            <!-- team names at the end of each line -->
            {#each endLabels as l}
                <text class="endLabel" class:faded={dim(l.rosterID)} x={l.x} y={l.y + 4} fill={l.color}
                    role="presentation"
                    onmouseenter={() => hovered = {rosterID: l.rosterID, ix: null}}
                    onmouseleave={() => hovered = null}
                    onclick={() => togglePin(l.rosterID)}>{l.name.length > 13 ? l.name.slice(0, 12) + '…' : l.name}</text>
            {/each}

            <!-- tooltip -->
            {#if tip}
                <g class="tip" pointer-events="none">
                    <rect x={tip.x} y={tip.y} width={tip.width} height={tip.height} rx="5" stroke={tip.color} />
                    <text class="tipName" x={tip.x + 8} y={tip.y + 15}>{tip.lines[0]}</text>
                    <text x={tip.x + 8} y={tip.y + 30}>{tip.lines[1]}</text>
                </g>
            {/if}
        </svg>
    {:else}
        <p class="empty">No power ranking history yet.</p>
    {/if}
</div>
