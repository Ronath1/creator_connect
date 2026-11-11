# Business service boundary

Add domain services here only when their phase is authorized. Service modules must import `server-only`, authorize every operation using trusted identity and membership, validate inputs, and keep data access separate from UI components. Use the shared validation and safe-error modules at request boundaries.

Phase 2 introduces trusted membership and own-profile services using Clerk session tokens with user-scoped Supabase requests. Membership/roles are owner-controlled records, never form fields. No service-role client, mock identity or in-memory record fallback exists. Missing configuration blocks account features. Opportunities/applications belong to Phase 3; collaboration delivery belongs to Phase 4.
