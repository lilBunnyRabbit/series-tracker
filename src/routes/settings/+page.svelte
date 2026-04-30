<script lang="ts">
  import { base } from "$app/paths";
  import { store } from "$lib/store.svelte";
  import { ping } from "$lib/tmdb";

  let keyDraft = $state(store.apiKey ?? "");
  let savedNote = $state<string | null>(null);
  let testStatus = $state<"idle" | "testing" | "ok" | "fail">("idle");
  let testMessage = $state<string | null>(null);
  let importMessage = $state<string | null>(null);

  function save() {
    store.setApiKey(keyDraft);
    savedNote = "Saved.";
    setTimeout(() => (savedNote = null), 1500);
  }

  function clear() {
    if (!confirm("Forget the saved API key?")) return;
    store.setApiKey(null);
    keyDraft = "";
  }

  async function test() {
    if (!keyDraft.trim()) return;
    testStatus = "testing";
    testMessage = null;
    try {
      await ping(keyDraft.trim());
      testStatus = "ok";
      testMessage = "Connection works.";
    } catch (e) {
      testStatus = "fail";
      testMessage = e instanceof Error ? e.message : String(e);
    }
  }

  function exportData() {
    const json = store.exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `series-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    importMessage = null;
    try {
      const text = await file.text();
      store.importJson(text);
      keyDraft = store.apiKey ?? "";
      importMessage = `Imported ${Object.keys(store.library).length} item(s).`;
    } catch (err) {
      importMessage = err instanceof Error ? err.message : String(err);
    }
    (e.currentTarget as HTMLInputElement).value = "";
  }

  function wipe() {
    if (!confirm("This will delete your entire library. Continue?")) return;
    store.importJson(JSON.stringify({ apiKey: store.apiKey, library: {} }));
  }
</script>

<section class="mx-auto max-w-2xl space-y-8">
  <h1 class="text-xl font-semibold">Settings</h1>

  <div class="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
    <h2 class="font-medium">TMDB API key</h2>
    <p class="text-sm text-[var(--color-muted)]">
      Stored only in your browser's localStorage. Get one from
      <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" class="text-[var(--color-accent)] underline"
        >themoviedb.org/settings/api</a
      >.
    </p>
    <input
      type="password"
      bind:value={keyDraft}
      placeholder="Paste your v3 API key"
      class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
    />
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onclick={save}
        disabled={!keyDraft.trim() || keyDraft.trim() === store.apiKey}
        class="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-accent-fg)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save
      </button>
      <button
        type="button"
        onclick={test}
        disabled={!keyDraft.trim() || testStatus === "testing"}
        class="rounded-md border border-[var(--color-border)] px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
      >
        {testStatus === "testing" ? "Testing..." : "Test connection"}
      </button>
      {#if store.apiKey}
        <button
          type="button"
          onclick={clear}
          class="ml-auto rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:border-red-700 hover:text-red-400"
        >
          Forget key
        </button>
      {/if}
    </div>
    {#if savedNote}
      <p class="text-xs text-[var(--color-accent)]">{savedNote}</p>
    {/if}
    {#if testMessage}
      <p class="text-xs {testStatus === 'ok' ? 'text-emerald-400' : 'text-red-400'}">{testMessage}</p>
    {/if}
  </div>

  <div class="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
    <h2 class="font-medium">Backup</h2>
    <p class="text-sm text-[var(--color-muted)]">Export your library as JSON, or restore from a previous export.</p>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onclick={exportData}
        class="rounded-md border border-[var(--color-border)] px-4 py-1.5 text-sm hover:border-[var(--color-accent)]"
      >
        Export JSON
      </button>
      <label class="cursor-pointer rounded-md border border-[var(--color-border)] px-4 py-1.5 text-sm hover:border-[var(--color-accent)]">
        Import JSON
        <input type="file" accept="application/json" onchange={importData} class="hidden" />
      </label>
      <button
        type="button"
        onclick={wipe}
        class="ml-auto rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:border-red-700 hover:text-red-400"
      >
        Wipe library
      </button>
    </div>
    {#if importMessage}
      <p class="text-xs text-[var(--color-muted)]">{importMessage}</p>
    {/if}
  </div>

  <p class="text-xs text-[var(--color-muted)]">
    <a href="{base}/" class="underline">← Back to library</a>
  </p>
</section>
