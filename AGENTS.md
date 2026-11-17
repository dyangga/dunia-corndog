# Dunia Corndog workspace

- `apps/owner-web`: Next.js dashboard only; read `node_modules/next/dist/docs` for the installed version before changing framework behavior.
- `apps/api`: Express business API. Only this application and database scripts/tests may access `@dc/db` or database credentials.
- `apps/cashier-mobile`: Expo / React Native. Do not import DOM/shadcn web components into native code.
- Shared contracts and design tokens live in `packages/`. Menu categories are Gurih pedas/Manis; sizes Small/Medium/Jumbo. Panir is the included base; Kentang and Mie are paid extras.
- The user prohibited `design-taste-frontend` for subsequent changes. Preserve the reviewed frontend design.
- Credentials are managed by the owner. Never return password hashes or log plaintext passwords. Resetting credentials must revoke sessions.
- Critical monetary and stock operations must be transactional and idempotent; integration tests use a separate *_test PostgreSQL database.
