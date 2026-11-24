# Security

Report vulnerabilities privately to the repository owner. Use GitHub private vulnerability reporting when available. Describe the affected version and impact. Remove keys, OAuth codes, conversation text and database backups from reports.

Protect the data directory, ENCRYPTION_SECRET and AUTH_SECRET. Whoever controls the running server can access provider credentials. Rotate a compromised provider key at the issuer and reconnect it. Changing the encryption secret requires reconnecting every credential. Keep single-user mode on a trusted, loopback-only deployment. Use HTTPS for shared deployments and set AUTH_URL to the public origin.
