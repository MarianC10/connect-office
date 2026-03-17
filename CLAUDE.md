## Project development rules

### Trunk-based development
- **`main` is the trunk** and should stay releasable.
- **Work happens on short-lived branches** created from `main`.
- **Pushing directly to `main` is prohibited**. Use pull requests.

### Merging
- **Use squash merge** when merging PRs into `main`.
- **Squash commit messages must be meaningful**, describing what the feature/change does (not just “WIP” or a ticket number).

### Feature flags
- **Experimental or incomplete features must be guarded by feature flags** so they can merge safely without impacting users.
- Prefer flags that default to **off**, with clear enable/disable instructions documented in the PR.
