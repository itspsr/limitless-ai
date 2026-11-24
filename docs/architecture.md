# Architecture

The Next.js server authenticates each request, scopes database operations to the session owner and decrypts provider credentials immediately before outbound API calls. The browser receives a reduced connection projection. Raw upstream error bodies stay on the server.

The core async generator accepts an ordered list of candidates, a read-only conversation and a cancellation signal. It yields switch, chunk, done and exhausted events. The web handler serializes them as SSE frames. On a failed stream the next provider regenerates the answer from the original history. The client discards the interrupted draft. Only completed assistant messages are persisted.

Usage rows aggregate by connection and UTC minute. Local daily totals sum these rows. Successful responses can supply remaining capacity and reset headers. Rate-limit responses set a cooldown. The fallback when no reset is reported is 60 seconds. Token counts depend on upstream usage reporting. Local estimates can lag under concurrent requests. The provider remains authoritative.

Prisma has a build-time datasource provider. The setup script selects SQLite or PostgreSQL from DATABASE_URL, generates the client for that dialect and applies the schema without destructive migration flags. Back up data before upgrades. Switching databases starts a separate dataset and requires a separate data migration to move existing history.

Local startup creates persistent random secrets in the data directory. Back up both the database and this directory. On ephemeral hosts configure stable secrets externally and use PostgreSQL.
