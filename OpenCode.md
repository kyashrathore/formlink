# OpenCode Guidance

## Build & Lint Commands

- Build: pnpm run build
- Lint: pnpm run lint
- Test: pnpm run test
- Single Test: pnpm run test --filter <test-name>

## Code Style Guidelines

- Use clear, descriptive names; camelCase for variables, PascalCase for React components.
- Use explicit imports; avoid deep relative paths.
- Format with Prettier and enforce with ESLint.
- Use TypeScript with strict typing.
- Handle errors with try/catch and provide meaningful messages.
- Keep components small and separate logic from UI.

## Tool Integration Rules

- Follow existing CLAUDE.md guidelines.
- No specific Cursor or Copilot rules found.
- Use pnpm for all package management.
