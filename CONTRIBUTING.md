# Contributing

Thanks for your interest in contributing to COPM.

## Development Workflow

1. Fork the repository and create a feature branch.
2. Keep changes focused and atomic.
3. Run quality checks locally:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
4. Open a Pull Request with a clear summary and test evidence.

## Commit Guidelines

- Use clear, imperative commit messages.
- Reference affected areas (UI, API, lifecycle, worker, setup).
- Avoid mixing unrelated refactors and features in one commit.

## Security and Privacy

- Never commit secrets (`.env`, tokens, private keys, dumps).
- Do not commit runtime workspace data (`workspaces/`).
- Follow repository `.gitignore` and `SECURITY.md`.

## Pull Request Checklist

- [ ] Feature/bug scope is clearly described.
- [ ] Tests added/updated when needed.
- [ ] Documentation updated.
- [ ] No secrets or local artifacts included.
