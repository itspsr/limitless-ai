# Contributing

Use Node 24 and the pnpm version pinned in package.json. Run pnpm install, pnpm db:setup, pnpm lint, pnpm typecheck, pnpm test and pnpm build before opening a pull request. For browser tests run pnpm --filter @limitless/web exec playwright install chromium followed by pnpm --filter @limitless/web exec playwright test.

Use small Conventional Commits. Describe what changed, how you tested it and any database effects. For registry changes follow [Adding a provider](docs/adding-a-provider.md).
