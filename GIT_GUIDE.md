# Git Command Guide

This guide covers common Git commands for version control, including basic workflow, undoing changes, and managing commit history.

## 1. Basic Git Workflow

Use these commands for your daily development cycle.

### `git status`
Displays the state of the working directory and the staging area. It shows which changes have been staged, which haven't, and which files aren't being tracked by Git.
```bash
git status
```

### `git add`
Adds file changes in your working directory to your staging area.
* To add a specific file: `git add <file>`
* To add all changes: `git add .`
```bash
git add .
```

### `git commit`
Captures a snapshot of the project's currently staged changes.
```bash
git commit -m "Your descriptive commit message"
```

### `git push`
Updates the remote repository with your local commits.
```bash
git push origin main
```

### `git pull`
Fetches and merges changes from the remote server to your local repository.
```bash
git pull origin main
```

---

## 2. Undoing Commits & Changes

If you've made a mistake in a commit, use these commands to revert.

### `git reset --soft HEAD~1` (Undo Commit, Keep Changes)
Use this if you want to pull back the last commit but **keep all your code changes** staged in your workspace. This is great for fixing a typo in a message or adding one more file to the commit.
```bash
git reset --soft HEAD~1
```

### `git reset --hard HEAD~1` (The Nuclear Option)
Use this to **completely erase the last commit and all associated changes**. Your code will revert to exactly how it was before that commit. **Warning: You will lose any unsaved work in those files.**
```bash
git reset --hard HEAD~1
```

### `git push origin <branch> --force` (Updating Remote after Reset)
If you have already pushed a "bad" commit to GitHub/Render and then performed a `git reset` locally, Git will prevent a normal push. You must force the remote to match your local history.
```bash
git push origin main --force
```
*Note: Use with caution, especially on shared branches.*

---

## 3. Navigating History

### `git log --oneline`
Shows a condensed version of your commit history. Each commit is displayed with its 7-character hash and its message.
```bash
git log --oneline
```

### `git reset --hard <hash>` (Go Back Multiple Commits)
If you need to go back several steps, find the hash of the "clean" commit using `git log` and reset to it.
```bash
git reset --hard a1b2c3d
```

---

## 4. Branching & Merging

### `git branch`
Lists all local branches. Use `-a` to see remote branches.
```bash
git branch
```

### `git checkout -b <branch-name>`
Creates a new branch and switches to it immediately.
```bash
git checkout -b feature/new-authentication
```

### `git checkout <branch-name>`
Switches from the current branch to another one.
```bash
git checkout main
```

### `git merge <branch-name>`
Merges the specified branch's history into the current branch.
```bash
git merge feature/new-authentication
```
