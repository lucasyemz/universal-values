# Stack

- Next.js
- React
- TypeScript
- Supabase
- PostgreSQL
- Zod
- Tailwind

# Architecture

Platform integrations must live in:

`/src/connectors`

Business logic must not be implemented inside React components.

# Safety

AI must never directly modify a customer website.

All mutations must support:

1. preview
2. validation
3. explicit confirmation
4. audit log

# Sync

Every write operation must be idempotent.

# Code quality

- TypeScript strict mode
- Avoid `any`
- Validate API payloads with Zod
- Add tests for important business logic
