# connect-office

## Development guide

### Branching model (trunk-based development)
- **Trunk**: `main` is the trunk and must remain releasable.
- **Feature branches**: create **short-lived** branches off `main` (hours to a couple of days).
  - Naming examples: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`
- **No direct pushes to `main`**: all changes land via PR.

### Local workflow
- **Sync**: pull latest `main` before starting work.
- **Small slices**: keep changes small and merge frequently.
- **Rebase/merge from `main`**: keep your branch current if it lives longer than a day.

### Pull requests
- **PR required**: open a PR from your branch into `main`.
- **Definition of done**:
  - Tests pass (and new tests are added when appropriate).
  - No obvious lint/typecheck failures.
  - PR description explains the “why” and any rollout/flag instructions.

### Merging policy (squash merge)
- **Squash merge only** into `main`.
- **Squash commit message must be descriptive** and explain what the feature/change does.
  - Prefer a short title + helpful body, for example:
    - Title: `Add office check-in flow`
    - Body: what changed, user impact, and any follow-ups.

### Feature flags for risky/experimental work
Use **feature flags** for changes that are incomplete, risky, or experimental so `main` stays stable.
- **Guard**: new UI paths, endpoints, background jobs, or behavior changes that are not fully ready.
- **Default state**: flags should default to **off** unless the rollout plan says otherwise.
- **Rollout**: document how to enable/disable the flag in the PR and/or release notes.
- **Cleanup**: once stable, remove the flag and dead code.

### Repository rules (summary)
- **No direct pushes to `main`**
- **Short-lived branches**
- **Squash merges with meaningful messages**
- **Feature flags for experimental/incomplete features**