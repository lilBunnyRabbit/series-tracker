---
name: release
description: Run the full release flow for series-tracker. Bumps package.json, promotes CHANGELOG [Unreleased] to a dated section, syncs guide.ts and roadmap.ts to reflect what shipped, runs bun run check, and creates a commit with the version as the message. Use when the user says "ship", "release", "deploy", "let's release vX.Y.Z", "cut a build", or asks for a version bump.
---

# Release flow

Internal release flow for series-tracker. Run when the user asks to ship, release, or deploy a build. Deploy is automatic on push to `master`, so the goal of this skill is to land a single clean commit that makes the in-app version surface, the CHANGELOG, the Guide, and the Roadmap all honest.

## 1. Audit pending work

Read these in parallel before doing anything else:

- `CHANGELOG.md` — find the `[Unreleased]` section. Note every bullet under it. These describe what's about to ship.
- `package.json` — current `version`. The next version is computed from this plus the bump rule below.
- `git status` and `git log master..HEAD` — surface anything uncommitted or already-committed-but-not-released.
- `src/lib/roadmap.ts` — note any items currently `"in-progress"` or `"planned"` that the changelog notes correspond to.
- `src/lib/guide.ts` — note any sections whose body the changelog suggests changed.

If `[Unreleased]` is empty AND there's nothing committed since the last version bump, ask the user whether they actually want to release or whether more work is in flight. Don't release a no-op build.

## 2. Decide the bump

Per `CLAUDE.md`:

- **patch** (`0.x.Y` → `0.x.Y+1`) — bug fix, copy tweak, dep-only change
- **minor** (`0.X.y` → `0.X+1.0`) — new feature, new page, new TMDB integration
- **major** (`X.y.z` → `X+1.0.0`) — breaking IDB schema change, full UI overhaul, or the 0.x → 1.0 jump itself

Confirm the proposed version with the user when the bump isn't obvious from the `[Unreleased]` entries (e.g. mixed bug fixes + a new feature → minor wins). Don't ask for confirmation when the call is clear.

## 3. Update files

Edit in this order so a failure mid-flow leaves the files in a coherent state:

### 3a. `CHANGELOG.md`

Promote `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and start a fresh `## [Unreleased]` line above it. Use today's date in `YYYY-MM-DD` format. Don't reorder the existing bullets — they're the user's record of what landed.

### 3b. `package.json`

Bump the `version` field to `X.Y.Z`. Single-line change.

### 3c. `src/lib/guide.ts`

For any user-visible feature added or meaningfully reworded in this release:

- Add a new `GuideSection` (or update an existing one's `body` / `highlights`).
- Set the affected section's `version` to `X.Y.Z`. This is what triggers the post-update tour for existing users — without the bump they won't see the new content unless they manually open the guide.
- For renamed / removed features: update or delete the matching section so the guide stops promising something that no longer exists.
- For typo-only fixes: leave `version` alone.

If `[Unreleased]` mentions a user-visible feature but `guide.ts` is unchanged, surface this gap to the user before committing.

### 3d. `src/lib/roadmap.ts`

For each roadmap item that landed in this release:

- Find the item in `ROADMAP_MILESTONES` (likely under `must-ship`, `polish`, or `tactile` for v1.0 work).
- Flip its `status` from `"planned"` / `"in-progress"` to `"shipped"`.
- Set `shippedIn: "X.Y.Z"`.
- Move the item from its tier group into the milestone's `just-shipped` group so recent wins surface at the top.

If something was killed mid-flight (decided against), move it to `wont-ship` with a one-line summary update explaining *why*. Don't just delete it — the decision being visible is the point.

If the release scope grew (something not previously on the roadmap shipped), add a new item to `just-shipped` with `status: "shipped"` and `shippedIn: "X.Y.Z"`.

## 4. Verify

Run `bun run check` from the project root. Fix any TypeScript or Svelte errors before committing.

## 5. Commit

Match the existing commit style — recent commits look like `feat: 0.18.0`. Pass the message via HEREDOC so formatting is preserved:

```bash
git commit -m "$(cat <<'EOF'
feat: X.Y.Z

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Stage all the files touched in steps 3a–3d, plus anything else the user pointed at. Don't sneak in unrelated changes.

## 6. Stop

Don't push unless the user explicitly asks. They'll sanity-check the diff and push themselves. After committing, report:

- The new version
- The bullets that landed (from `[Unreleased]` → dated)
- Which roadmap items flipped to `shipped`
- Any guide sections whose `version` was bumped

## Things to avoid

- Don't commit `static/version.json` or `static/CHANGELOG.md` — they're build-generated and gitignored.
- Don't bump on internal-only commits (refactors, build tooling, types). Those don't get a CHANGELOG entry either.
- Don't amend an existing commit when a pre-commit hook fails — fix the issue and create a *new* commit. Hook failure means the original commit didn't happen.
- Don't switch to `--no-verify` to skip a hook. Investigate why it's failing.
- Don't push to `master` on the user's behalf. The user controls when the build goes live.
