# Business service boundary

Add domain services here only when their phase is authorized. Service modules must import `server-only`, authorize every operation using trusted identity and membership, validate inputs, and keep data access separate from UI components. Use the shared validation and safe-error modules at request boundaries.

Phase 1 has no database, authentication, business actions, in-memory records, or simulated service success. Profiles arrive in Phase 2; opportunities/applications in Phase 3; collaboration delivery in Phase 4. No service stubs are callable as working features.
