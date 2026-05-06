import type { Snippet } from "svelte";

// Page-actions store: a page registers its "external actions" snippet here
// and the layout renders it as a rail above the floating island on mobile.
// Each PageHeader instance owns the slot for as long as it's mounted; only
// its own snippet is cleared on unmount (the `=== mine` guard) so a fast
// route change where the new page mounts before the old one unmounts can't
// accidentally null out the new actions.
export const pageActions = $state<{ current: Snippet | null }>({ current: null });
