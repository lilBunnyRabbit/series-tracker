<script lang="ts">
  import { base } from "$app/paths";
  import { store } from "$lib/store.svelte";
  import { clearCache, defaultRegion, ping, REGION_OPTIONS } from "$lib/tmdb";
  import { STATUS_LABEL } from "$lib/types";
  import type { Status } from "$lib/types";
  import {
    applyUpdate,
    checkForUpdate,
    isUpdateAvailable,
    version,
  } from "$lib/version.svelte";

  let keyDraft = $state(store.apiKey ?? "");
  let savedNote = $state<string | null>(null);
  let savedTimer: ReturnType<typeof setTimeout> | null = null;
  let testStatus = $state<"idle" | "testing" | "ok" | "fail">("idle");
  let testMessage = $state<string | null>(null);

  let checkStatus = $state<"idle" | "checking" | "current" | "updated" | "error">("idle");
  let updating = $state(false);

  let changelogHtml = $state<string | null>(null);
  let changelogLoading = $state(false);
  let changelogError = $state<string | null>(null);
  let changelogLoaded = false;

  let cacheCleared = $state(false);

  const updateAvailable = $derived(isUpdateAvailable());
  const buildTimeFmt = $derived.by(() => {
    if (!version.current.buildTime) return null;
    const d = new Date(version.current.buildTime);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  });

  // Preferences-bound bindings. Mirroring into local $state lets bindings work
  // with the store helper without each control reaching back into setPreference.
  const hapticsMuted = $derived(store.preferences.hapticsMuted ?? false);
  const defaultAddStatus = $derived<Status | "">(store.preferences.defaultAddStatus ?? "");
  const regionPref = $derived(store.preferences.region ?? "");
  const detectedRegion = defaultRegion();

  async function handleCheckForUpdate(): Promise<void> {
    if (checkStatus === "checking") return;
    checkStatus = "checking";
    const result = await checkForUpdate();
    checkStatus = result;
  }

  async function handleApplyUpdate(): Promise<void> {
    if (updating) return;
    updating = true;
    try {
      await applyUpdate();
    } catch {
      updating = false;
    }
  }

  async function loadChangelog(): Promise<void> {
    if (changelogLoaded || changelogLoading) return;
    changelogLoading = true;
    changelogError = null;
    try {
      const [{ marked }, res] = await Promise.all([
        import("marked"),
        fetch(`${base}/CHANGELOG.md?t=${Date.now()}`, { cache: "no-store" }),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const md = await res.text();
      changelogHtml = await marked.parse(md, { async: true });
      changelogLoaded = true;
    } catch (e) {
      changelogError = e instanceof Error ? e.message : String(e);
    } finally {
      changelogLoading = false;
    }
  }

  function onChangelogToggle(e: Event): void {
    const el = e.currentTarget as HTMLDetailsElement;
    if (el.open) void loadChangelog();
  }
  let importMessage = $state<string | null>(null);
  let importMode = $state<"replace" | "merge">("merge");
  let exportApiKey = $state(false);

  function flashSaved(msg: string): void {
    savedNote = msg;
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      savedNote = null;
      savedTimer = null;
    }, 1500);
  }

  function save(): void {
    store.setApiKey(keyDraft);
    flashSaved("Saved.");
  }

  function clear(): void {
    if (!confirm("Forget the saved API key?")) return;
    store.setApiKey(null);
    keyDraft = "";
  }

  async function test(): Promise<void> {
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

  function exportData(): void {
    const json = store.exportJson({ includeApiKey: exportApiKey });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `series-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importData(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importMessage = null;
    try {
      const text = await file.text();
      const result = store.importJson(text, importMode);
      keyDraft = store.apiKey ?? "";
      importMessage =
        importMode === "replace"
          ? `Replaced library with ${result.added} item(s).`
          : `Merged: ${result.added} added, ${result.merged} updated. Total: ${result.total}.`;
    } catch (err) {
      importMessage = err instanceof Error ? err.message : String(err);
    }
    input.value = "";
  }

  async function wipe(): Promise<void> {
    if (!confirm("This will delete your entire library. Continue?")) return;
    await store.wipeAll();
    keyDraft = "";
  }

  function handleClearCache(): void {
    clearCache();
    cacheCleared = true;
    setTimeout(() => (cacheCleared = false), 1500);
  }

  function setHaptics(e: Event): void {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    // Stored as muted=true when the toggle is OFF (haptics disabled).
    store.setPreference("hapticsMuted", !checked || undefined);
  }

  function setDefaultStatus(e: Event): void {
    const val = (e.currentTarget as HTMLSelectElement).value;
    if (!val) {
      store.setPreference("defaultAddStatus", null);
    } else {
      store.setPreference("defaultAddStatus", val as Status);
    }
  }

  function setRegion(e: Event): void {
    const val = (e.currentTarget as HTMLSelectElement).value;
    if (!val) store.setPreference("region", null);
    else store.setPreference("region", val);
  }

  const ADD_STATUSES: Status[] = ["plan", "watching", "completed", "dropped"];
</script>

<section class="mx-auto max-w-2xl space-y-8">
  <h1 class="text-xl font-semibold">Settings</h1>

  <!-- API -->
  <div class="space-y-3 rounded-lg border border-border bg-surface p-5">
    <h2 class="text-sm font-medium uppercase tracking-wider text-muted">API</h2>
    <div class="space-y-3">
      <div>
        <h3 class="text-sm font-medium">TMDB API key</h3>
        <p class="mt-1 text-xs text-muted">
          Stored only in your browser (IndexedDB). Get a free key from
          <a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noopener"
            class="text-accent underline">themoviedb.org/settings/api</a
          >.
        </p>
      </div>
      <input
        type="password"
        bind:value={keyDraft}
        placeholder="Paste your v3 API key"
        autocomplete="off"
        spellcheck="false"
        class="w-full rounded-md border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
      />
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onclick={save}
          disabled={!keyDraft.trim() || keyDraft.trim() === store.apiKey}
          class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onclick={test}
          disabled={!keyDraft.trim() || testStatus === "testing"}
          class="rounded-md border border-border px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {testStatus === "testing" ? "Testing..." : "Test connection"}
        </button>
        {#if store.apiKey}
          <button
            type="button"
            onclick={clear}
            class="ml-auto rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:border-danger hover:text-danger"
          >
            Forget key
          </button>
        {/if}
      </div>
      {#if savedNote}
        <p class="text-xs text-primary">{savedNote}</p>
      {/if}
      {#if testMessage}
        <p class="text-xs {testStatus === 'ok' ? 'text-primary' : 'text-danger'}">{testMessage}</p>
      {/if}
    </div>

    <hr class="border-border" />

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-medium">Cache</h3>
        <p class="mt-0.5 text-xs text-muted">
          In-memory TMDB responses. Drop them if results look stale.
        </p>
      </div>
      <button
        type="button"
        onclick={handleClearCache}
        class="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent"
      >
        {cacheCleared ? "Cleared ✓" : "Clear cache"}
      </button>
    </div>
  </div>

  <!-- Backup -->
  <div class="space-y-3 rounded-lg border border-border bg-surface p-5">
    <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Backup</h2>
    <p class="text-sm text-muted">
      Export your library as JSON, or restore from a previous export. <strong>Merge</strong> combines two backups (max season progress wins,
      newer metadata wins). <strong>Replace</strong> overwrites your current library.
    </p>

    <fieldset class="flex flex-wrap gap-4 text-sm">
      <legend class="sr-only">Import mode</legend>
      <label class="flex items-center gap-2">
        <input type="radio" bind:group={importMode} value="merge" />
        Merge
      </label>
      <label class="flex items-center gap-2">
        <input type="radio" bind:group={importMode} value="replace" />
        Replace
      </label>
      <label class="ml-auto flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" bind:checked={exportApiKey} />
        Include API key in export
      </label>
    </fieldset>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onclick={exportData}
        class="rounded-md border border-border px-4 py-1.5 text-sm hover:border-accent"
      >
        Export JSON
      </button>
      <label class="cursor-pointer rounded-md border border-border px-4 py-1.5 text-sm hover:border-accent">
        Import JSON ({importMode})
        <input type="file" accept="application/json" onchange={importData} class="hidden" />
      </label>
    </div>
    {#if importMessage}
      <p class="text-xs text-muted">{importMessage}</p>
    {/if}
  </div>

  <!-- Preferences -->
  <div class="space-y-4 rounded-lg border border-border bg-surface p-5">
    <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Preferences</h2>

    <label class="flex items-start justify-between gap-4">
      <span class="min-w-0">
        <span class="block text-sm font-medium">Haptics</span>
        <span class="mt-0.5 block text-xs text-muted">
          Vibrate on add / tab change. Browsers without the Vibration API ignore this.
        </span>
      </span>
      <input
        type="checkbox"
        checked={!hapticsMuted}
        onchange={setHaptics}
        class="mt-1 h-5 w-5 cursor-pointer accent-primary"
      />
    </label>

    <hr class="border-border" />

    <label class="flex items-start justify-between gap-4">
      <span class="min-w-0">
        <span class="block text-sm font-medium">Default add status</span>
        <span class="mt-0.5 block text-xs text-muted">
          Skip the picker — tapping "+ Add" goes straight to this status. Pick "Always ask" to keep the dialog.
        </span>
      </span>
      <select
        value={defaultAddStatus}
        onchange={setDefaultStatus}
        class="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent"
      >
        <option value="">Always ask</option>
        {#each ADD_STATUSES as s (s)}
          <option value={s}>{STATUS_LABEL[s]}</option>
        {/each}
      </select>
    </label>

    <hr class="border-border" />

    <label class="flex items-start justify-between gap-4">
      <span class="min-w-0">
        <span class="block text-sm font-medium">Where to Watch region</span>
        <span class="mt-0.5 block text-xs text-muted">
          Country used for streaming-provider lookups. Detected: <span class="font-mono">{detectedRegion}</span>.
        </span>
      </span>
      <select
        value={regionPref}
        onchange={setRegion}
        class="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent"
      >
        <option value="">Auto ({detectedRegion})</option>
        {#each REGION_OPTIONS as r (r.code)}
          <option value={r.code}>{r.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <!-- About -->
  <div class="space-y-3 rounded-lg border border-border bg-surface p-5">
    <h2 class="text-sm font-medium uppercase tracking-wider text-muted">About</h2>

    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt class="text-muted">Version</dt>
      <dd class="font-mono tabular-nums">v{version.current.version}</dd>
      <dt class="text-muted">Commit</dt>
      <dd class="font-mono">
        {version.current.commit}
        {#if version.current.branch && version.current.branch !== "master"}
          <span class="text-muted">· {version.current.branch}</span>
        {/if}
      </dd>
      {#if buildTimeFmt}
        <dt class="text-muted">Built</dt>
        <dd>{buildTimeFmt}</dd>
      {/if}
    </dl>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onclick={handleCheckForUpdate}
        disabled={checkStatus === "checking"}
        class="rounded-md border border-border px-4 py-1.5 text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {checkStatus === "checking" ? "Checking..." : "Check for updates"}
      </button>
      {#if updateAvailable}
        <button
          type="button"
          onclick={handleApplyUpdate}
          disabled={updating}
          class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-60"
        >
          {updating ? "Updating..." : `Update to v${version.latest?.version ?? "latest"}`}
        </button>
      {/if}
    </div>

    {#if checkStatus === "current" && !updateAvailable}
      <p class="text-xs text-primary">You're on the latest version.</p>
    {:else if checkStatus === "updated" || updateAvailable}
      <p class="text-xs text-accent">A new version is available.</p>
    {:else if checkStatus === "error"}
      <p class="text-xs text-danger">Couldn't check for updates. Try again.</p>
    {/if}

    <details class="group" ontoggle={onChangelogToggle}>
      <summary class="cursor-pointer text-sm text-muted hover:text-text">
        <span class="group-open:hidden">View changelog</span>
        <span class="hidden group-open:inline">Hide changelog</span>
      </summary>
      <div class="mt-3 rounded-md border border-border bg-surface-2 p-3 text-sm">
        {#if changelogLoading}
          <p class="text-xs text-muted">Loading changelog...</p>
        {:else if changelogError}
          <p class="text-xs text-danger">Couldn't load changelog: {changelogError}</p>
        {:else if changelogHtml}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <div class="changelog-prose">{@html changelogHtml}</div>
        {/if}
      </div>
    </details>
  </div>

  <!-- Danger zone -->
  <div class="space-y-3 rounded-lg border border-danger/40 bg-surface p-5">
    <h2 class="text-sm font-medium uppercase tracking-wider text-danger">Danger zone</h2>
    <p class="text-sm text-muted">Wipes the API key, library, search history, and preferences. There is no undo.</p>
    <button
      type="button"
      onclick={wipe}
      class="rounded-md border border-danger/60 px-4 py-1.5 text-sm text-danger hover:bg-danger/10"
    >
      Wipe everything
    </button>
  </div>
</section>

<style>
  .changelog-prose :global(h1) {
    font-size: 1rem;
    font-weight: 600;
    margin: 0.25rem 0 0.5rem;
  }
  .changelog-prose :global(h2) {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
    color: var(--color-text);
  }
  .changelog-prose :global(h3) {
    font-size: 0.8rem;
    font-weight: 600;
    margin: 0.75rem 0 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-muted);
  }
  .changelog-prose :global(ul) {
    list-style: disc;
    padding-left: 1.25rem;
    margin: 0.25rem 0;
  }
  .changelog-prose :global(li) {
    margin: 0.25rem 0;
  }
  .changelog-prose :global(a) {
    color: var(--color-accent);
    text-decoration: underline;
  }
  .changelog-prose :global(p) {
    margin: 0.5rem 0;
  }
  .changelog-prose :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85em;
    background: var(--color-surface);
    padding: 0.05em 0.3em;
    border-radius: 0.25rem;
  }
</style>
