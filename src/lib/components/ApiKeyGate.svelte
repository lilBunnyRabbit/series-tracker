<script lang="ts">
  import { base } from "$app/paths";
  import { store } from "$lib/store.svelte";

  let { children } = $props();
</script>

{#if !store.loaded}
  <div class="flex justify-center py-12 text-sm text-muted">Loading library...</div>
{:else if store.apiKey}
  {@render children()}
{:else}
  <div class="mx-auto max-w-xl rounded-lg border border-border bg-surface p-6 text-center">
    <h2 class="mb-2 text-lg font-semibold">No TMDB API key set</h2>
    <p class="mb-4 text-sm text-muted">
      Get a free key from
      <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" class="text-accent underline">themoviedb.org</a>
      and paste it in settings. It stays in your browser.
    </p>
    <a
      href="{base}/settings/"
      class="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
    >
      Open settings
    </a>
  </div>
{/if}
