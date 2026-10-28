# Legacy Supabase RLS migrations (reference only, not applied)

These files were the original Supabase-targeted schema, including the row-level security
policies (`auth.uid()`, `has_role()`, `service_role` grants). They were replaced by the Prisma
schema in `prisma/`, which runs on any PostgreSQL.

The application enforces tenancy in code (every query is scoped by the caller's client id).
When the project moves to its new Supabase account, port the policies from these files as
defence-in-depth. Do not apply the files as-is: the `apply_credit_transaction` trigger and
`0002` status checks are now handled by the Prisma migrations and the application.
