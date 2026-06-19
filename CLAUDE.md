# Project guidelines

## Always work in a git worktree

For any change — a feature, a bugfix, a refactor, a spike, or whatever else —
do the work in a dedicated git worktree, not directly in the main checkout.
This keeps the main working tree clean, isolates each line of work, and lets
multiple agents work the repo at the same time without colliding.

**Before writing any code:**

1. Create an isolated worktree on a new branch (use the native worktree tool
   if one is available, e.g. `EnterWorktree`; otherwise `git worktree add`).
2. Do all edits, commits, and testing inside that worktree.
3. When the work is done, integrate it (PR or merge) and remove the worktree.

**Do not** make feature or fix commits on `main` or in the primary working
directory. `main` is for integrating finished work, and the site deploys from
it via GitHub Actions.

Assume another agent may be working in this repository at the same time, so
never touch files outside the worktree you created.
