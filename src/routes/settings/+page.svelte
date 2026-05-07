<script lang="ts">
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { PACING_PRESETS } from "$lib/temptation";
  import { clearCache, defaultLanguage, LANGUAGE_OPTIONS, ping } from "$lib/tmdb";
  import { STATUS_LABEL } from "$lib/types";
  import type { Status, TemptationPacing } from "$lib/types";
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

  let changelogHtml = $state<string | null>(null);
  let changelogLoading = $state(false);
  let changelogError = $state<string | null>(null);
  let changelogLoaded = false;

  let cacheCleared = $state(false);

  // navigator.storage.estimate is async and only resolves in the browser. We
  // keep both fields nullable so the row can render a "—" placeholder during
  // the first paint without a layout shift when the values land.
  let storageUsage = $state<number | null>(null);
  let storageQuota = $state<number | null>(null);
  let storageError = $state<string | null>(null);

  async function refreshStorage(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
      storageError = "Not supported";
      return;
    }
    try {
      const est = await navigator.storage.estimate();
      storageUsage = typeof est.usage === "number" ? est.usage : null;
      storageQuota = typeof est.quota === "number" ? est.quota : null;
      storageError = null;
    } catch (e) {
      storageError = e instanceof Error ? e.message : String(e);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(kb < 10 ? 2 : 1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  const storagePct = $derived.by(() => {
    if (storageUsage === null || storageQuota === null || storageQuota === 0) return null;
    return (storageUsage / storageQuota) * 100;
  });

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
  const languagePref = $derived(store.preferences.language ?? "");
  const pacingPref = $derived<TemptationPacing>(store.preferences.temptationPacing ?? "balanced");
  const detectedLanguage = defaultLanguage();

  // Display names rendered in the user's UI locale so the picker reads
  // naturally regardless of which entries the user is browsing.
  const languageDisplay = $derived.by(() => {
    try {
      return new Intl.DisplayNames([detectedLanguage], { type: "language" });
    } catch {
      return null;
    }
  });

  function localeLabel(code: string): string {
    const name = languageDisplay?.of(code);
    return name ? `${name} (${code})` : code;
  }

  async function handleCheckForUpdate(): Promise<void> {
    if (checkStatus === "checking") return;
    checkStatus = "checking";
    const result = await checkForUpdate();
    checkStatus = result;
  }

  const updating = $derived(version.stage !== "idle");

  async function handleApplyUpdate(): Promise<void> {
    if (updating) return;
    await applyUpdate();
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

  // Kick off the first storage read in the browser. Runs once on mount; the
  // user can re-poll via the row's refresh button if they just imported or
  // wiped data and want to see the number move.
  $effect(() => {
    void refreshStorage();
  });

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

  function clearActivity(): void {
    if (store.actions.length === 0) return;
    if (!confirm("Clear the entire activity log? This can't be undone — your library and progress are not affected.")) return;
    store.clearActions();
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
    // Confirmation pulse — `success` on enable, `warn` on disable. Forced so
    // the disable case still fires once even though haptics are now muted.
    vibrate(checked ? "success" : "warn", { force: true });
  }

  function setDefaultStatus(e: Event): void {
    const val = (e.currentTarget as HTMLSelectElement).value;
    if (!val) {
      store.setPreference("defaultAddStatus", null);
    } else {
      store.setPreference("defaultAddStatus", val as Status);
    }
  }

  function setLanguage(e: Event): void {
    const val = (e.currentTarget as HTMLSelectElement).value;
    if (!val) store.setPreference("language", null);
    else store.setPreference("language", val);
  }

  function setPacing(value: TemptationPacing): void {
    store.setPreference("temptationPacing", value);
  }

  const ADD_STATUSES: Status[] = ["plan", "watching", "tuned", "completed", "dropped"];
</script>

<div class="mx-auto max-w-2xl">
  {#snippet headerActions()}
    <a
      href="{base}/settings/guide/"
      use:tactile={{ haptic: false }}
      class="tap-target tap-target--btn flex items-center gap-1.5 whitespace-nowrap rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm text-primary hover-border-primary"
    >
      <Icon name="sparkles" size={14} />
      <span>Guide</span>
    </a>
    <a
      href="{base}/settings/roadmap/"
      use:tactile={{ haptic: false }}
      class="tap-target tap-target--btn flex items-center gap-1.5 whitespace-nowrap rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-accent hover-border-accent"
    >
      <Icon name="trending-up" size={14} />
      <span>Roadmap</span>
    </a>
    <a
      href="{base}/activity/"
      use:tactile={{ haptic: false }}
      class="tap-target tap-target--btn flex items-center gap-1.5 whitespace-nowrap rounded-md border border-secondary/40 bg-secondary/10 px-3 py-1.5 text-sm text-secondary hover-border-secondary"
    >
      <Icon name="list" size={14} />
      <span>Activity</span>
    </a>
    <a
      href="{base}/style-guide/"
      use:tactile={{ haptic: false }}
      class="tap-target tap-target--btn flex items-center gap-1.5 whitespace-nowrap rounded-md border border-tertiary/40 bg-tertiary/10 px-3 py-1.5 text-sm text-tertiary hover-border-tertiary"
    >
      <Icon name="grid" size={14} />
      <span>Style guide</span>
    </a>
  {/snippet}

  <PageHeader title="Settings" actions={headerActions} />
</div>

<section class="mx-auto max-w-2xl space-y-8">
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
          use:tactile
          onclick={save}
          disabled={!keyDraft.trim() || keyDraft.trim() === store.apiKey}
          class="tap-target tap-target--btn rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          use:tactile
          onclick={test}
          disabled={!keyDraft.trim() || testStatus === "testing"}
          class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {testStatus === "testing" ? "Testing..." : "Test connection"}
        </button>
        {#if store.apiKey}
          <button
            type="button"
            use:tactile={{ haptic: "warn" }}
            onclick={clear}
            class="tap-target tap-target--btn ml-auto rounded-md border border-border px-3 py-2 text-xs text-muted hover-border-error hover-text-error"
          >
            Forget key
          </button>
        {/if}
      </div>
      {#if savedNote}
        <p class="text-xs text-primary">{savedNote}</p>
      {/if}
      {#if testMessage}
        <p class="text-xs {testStatus === 'ok' ? 'text-primary' : 'text-error'}">{testMessage}</p>
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
        use:tactile={{ haptic: "success" }}
        onclick={handleClearCache}
        class="tap-target tap-target--btn rounded-md border border-border px-3 py-2 text-xs hover-border-accent"
      >
        {cacheCleared ? "Cleared ✓" : "Clear cache"}
      </button>
    </div>

    <hr class="border-border" />

    <div class="space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-sm font-medium">Storage</h3>
          <p class="mt-0.5 text-xs text-muted">
            Library, diary, and preferences live in IndexedDB. Browsers usually allow tens of MB
            before warning.
          </p>
        </div>
        <button
          type="button"
          use:tactile
          onclick={refreshStorage}
          class="tap-target tap-target--btn rounded-md border border-border px-3 py-2 text-xs hover-border-accent"
        >
          Refresh
        </button>
      </div>
      {#if storageError}
        <p class="text-xs text-muted">Couldn't read: {storageError}.</p>
      {:else if storageUsage === null}
        <p class="text-xs text-muted">Reading…</p>
      {:else}
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span class="font-medium tabular-nums">{formatBytes(storageUsage)}</span>
          {#if storageQuota !== null}
            <span class="text-xs text-muted">used of {formatBytes(storageQuota)}</span>
          {/if}
          {#if storagePct !== null}
            <span class="text-xs tabular-nums text-muted">· {storagePct < 0.1 ? "<0.1" : storagePct.toFixed(1)}%</span>
          {/if}
        </div>
        {#if storagePct !== null}
          <div class="h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              class="h-full bg-accent transition-all"
              style="width: {Math.max(0.5, Math.min(storagePct, 100))}%"
            ></div>
          </div>
        {/if}
      {/if}
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
        use:tactile
        onclick={exportData}
        class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-accent"
      >
        Export JSON
      </button>
      <label
        use:tactile
        class="tap-target tap-target--btn cursor-pointer rounded-md border border-border px-4 py-2 text-sm hover-border-accent"
      >
        Import JSON ({importMode})
        <input type="file" accept="application/json" onchange={importData} class="hidden" />
      </label>
    </div>
    {#if importMessage}
      <p class="text-xs text-muted">{importMessage}</p>
    {/if}
  </div>

  <!-- Activity -->
  <div class="space-y-3 rounded-lg border border-border bg-surface p-5">
    <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Activity</h2>
    <div class="flex items-center justify-between gap-3">
      <p class="min-w-0 text-sm text-muted">
        Recent changes to your library — adds, status flips, progress, ratings.
      </p>
      <a
        href="{base}/activity/"
        use:tactile={{ haptic: false }}
        class="tap-target tap-target--btn shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover-border-accent"
      >
        View {store.actions.length} {store.actions.length === 1 ? "entry" : "entries"} →
      </a>
    </div>
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

    <!-- Stacks on mobile because the option labels (e.g. "Português (Brasil)
         (pt-BR)") force the browser-sized select wider than the row's right
         column on narrow viewports, which pushed the select into the title /
         description area. On sm+ the row layout matches the others. -->
    <label class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span class="min-w-0">
        <span class="block text-sm font-medium">Locale</span>
        <span class="mt-0.5 block text-xs text-muted">
          Language for TMDB titles & default region. Detected: <span class="font-mono">{detectedLanguage}</span>.
        </span>
      </span>
      <select
        value={languagePref}
        onchange={setLanguage}
        class="w-full rounded-md border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent sm:w-auto sm:max-w-[12rem]"
      >
        <option value="">Auto ({detectedLanguage})</option>
        {#each LANGUAGE_OPTIONS as code (code)}
          <option value={code}>{localeLabel(code)}</option>
        {/each}
      </select>
    </label>

    <hr class="border-border" />

    <div class="space-y-2">
      <div>
        <h3 class="text-sm font-medium">Temptation pacing</h3>
        <p class="mt-0.5 text-xs text-muted">
          How fast a title's temptation score fades when you stop engaging. Picks the
          decay half-life — pick a faster preset if you want only this week's
          activity to dominate, slower if you want things to stay warm for weeks.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {#each PACING_PRESETS as preset (preset.value)}
          {@const active = pacingPref === preset.value}
          <button
            type="button"
            use:tactile
            onclick={() => setPacing(preset.value)}
            aria-pressed={active}
            class="tap-target tap-target--btn flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors duration-150 {active
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover-text-text'}"
          >
            <span class="text-sm font-semibold">{preset.label}</span>
            <span class="text-[11px] {active ? 'opacity-90' : 'opacity-70'}">
              {preset.hint}
            </span>
          </button>
        {/each}
      </div>
    </div>
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
        use:tactile
        onclick={handleCheckForUpdate}
        disabled={checkStatus === "checking"}
        class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {checkStatus === "checking" ? "Checking..." : "Check for updates"}
      </button>
      {#if updateAvailable}
        <button
          type="button"
          use:tactile
          onclick={handleApplyUpdate}
          disabled={updating}
          class="tap-target tap-target--btn rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
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
      <p class="text-xs text-error">Couldn't check for updates. Try again.</p>
    {/if}

    <details class="group" ontoggle={onChangelogToggle}>
      <summary class="tap-target cursor-pointer rounded-md py-1 text-sm text-muted hover-text-text">
        <span class="group-open:hidden">View changelog</span>
        <span class="hidden group-open:inline">Hide changelog</span>
      </summary>
      <div class="mt-3 rounded-md border border-border bg-surface-2 p-3 text-sm">
        {#if changelogLoading}
          <p class="text-xs text-muted">Loading changelog...</p>
        {:else if changelogError}
          <p class="text-xs text-error">Couldn't load changelog: {changelogError}</p>
        {:else if changelogHtml}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <div class="changelog-prose">{@html changelogHtml}</div>
        {/if}
      </div>
    </details>
  </div>

  <!-- Danger zone -->
  <div class="space-y-3 rounded-lg border border-error/40 bg-surface p-5">
    <h2 class="text-sm font-medium uppercase tracking-wider text-error">Danger zone</h2>
    <div class="space-y-2">
      <p class="text-sm text-muted">
        Clear the activity log. The library, ratings and progress are untouched — only the timeline of recent changes goes away.
      </p>
      <button
        type="button"
        use:tactile={{ haptic: "warn" }}
        onclick={clearActivity}
        disabled={store.actions.length === 0}
        class="tap-target tap-target--btn rounded-md border border-error/60 px-4 py-2 text-sm text-error transition-colors duration-150 active:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Clear activity log{store.actions.length > 0 ? ` (${store.actions.length})` : ""}
      </button>
    </div>
    <hr class="border-error/20" />
    <div class="space-y-2">
      <p class="text-sm text-muted">Wipes the API key, library, search history, and preferences. There is no undo.</p>
      <button
        type="button"
        use:tactile={{ haptic: "warn" }}
        onclick={wipe}
        class="tap-target tap-target--btn rounded-md border border-error/60 px-4 py-2 text-sm text-error transition-colors duration-150 active:bg-error/10"
      >
        Wipe everything
      </button>
    </div>
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
