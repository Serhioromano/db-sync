# Contributing to db-sync

Thank you for your interest in the project! This document outlines the process for contributing changes.

## Core Rules

### 1. All Pull Requests target the `develop` branch

**This is the most important rule.** All changes are accepted exclusively through Pull Requests targeting the `develop` branch. Pull Requests targeting `main` will not be accepted.

The `main` branch contains only stable releases and is updated by the project maintainers.

### 2. Minimal changes — meaningful description

Each Pull Request must contain the **minimum necessary set of changes** to solve a single, well-defined task. Do not mix a bug fix with a refactor, or a new feature with code formatting.

Always fill in the PR description:
- **What** — a brief summary of the changes
- **Why** — the problem being solved
- **How to test** — steps to verify (if applicable)

### 3. One functional concern — one Pull Request

Changes that touch **different functional areas** must be submitted as **separate Pull Requests**:

| ✅ Correct | ❌ Incorrect |
|---|---|
| PR #1: Add PostgreSQL support | Single PR: PostgreSQL support + refactor + bug fix |
| PR #2: Refactor DBML parser | |
| PR #3: Fix SQL generator bug | |

If you discover a bug while working on a feature — create a separate PR for the bug fix, and a separate one for the feature.

## Contribution Workflow

### 1. Fork and clone

```bash
# Fork the repository on GitHub, then:
git clone git@github.com:YOUR_USERNAME/db-sync.git
cd db-sync
```

### 2. Create a branch

Always branch off `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

Branch naming conventions:
- `feature/` — new functionality
- `fix/` — bug fix
- `docs/` — documentation changes
- `refactor/` — refactoring without behavioral changes

### 3. Commits

Write meaningful commit messages:

```
feat: add SQLite support

- implement SQLite driver
- add tests for core operations
- update README.md
```

Format: `type: short description`, where `type` is one of: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

### 4. Pull Request

1. Push the branch: `git push origin feature/my-feature`
2. Open a Pull Request **against the `develop` branch** (not `main`!)
3. Fill in the PR description using the template:

```
## Description
A brief summary of what has been done.

## Motivation
Why is this change needed?

## Testing
How to verify that the changes work correctly?

## Related Issues
Links to related issues (if any).
```

### 5. Checks

- Ensure the code passes linting and tests
- Ensure your changes do not break existing functionality
- If adding new functionality — write tests

## Code Style

- Follow the code style established in the project
- Use TypeScript
- Format code with Prettier (config is in the project)
- Avoid `any` — use strict typing

## Questions and Discussion

Before starting work on a large change, create an [Issue](https://github.com/sergey-romanov/db-sync/issues) to discuss the approach — this saves time for both you and the maintainers.

## License

By contributing, you agree that your code will be distributed under the [MIT](LICENSE) license.
