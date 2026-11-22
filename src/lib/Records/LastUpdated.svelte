<script>
    // Small italic "Last Update MM/DD/YYYY" line, read from static/data/meta.json
    // (written by the historical notebook's website export cell).
    let updated = $state(null);

    $effect(() => {
        fetch('/data/meta.json', { cache: 'no-cache' })
            .then(res => res.ok ? res.json() : null)
            .then(data => updated = data?.updated || null)
            .catch(() => updated = null);
    });
</script>

<style>
    .lastUpdated {
        text-align: center;
        font-style: italic;
        font-size: 0.8em;
        color: var(--g999);
        margin: -0.6em 0 1.2em;
    }
</style>

{#if updated}
    <p class="lastUpdated">Last Update {updated}</p>
{/if}
