# Add a provider

1. Confirm that the official API supports bearer authentication and streaming chat completions. Check a current model ID and its account eligibility in the provider console.
2. Add an entry to packages/providers/providers.json. Include the official HTTPS API base, signup URL, auth types, models, quota metadata, status and last verification date. Use null for an unpublished or account-specific quantity. Include a source for verified numeric limits.
3. The generic adapter appends /chat/completions and /models. A compatible provider needs no router changes. For another protocol, implement ProviderAdapter from packages/core and select it in apps/web/lib/adapter.ts.
4. Test with an authorized key using Test connection. Test one streamed reply, a quota error and an interrupted stream. Use synthetic fixtures in commits and CI.

Custom connections use an operator-approved HTTPS host from CUSTOM_PROVIDER_HOSTS. Each user chooses the path, model and credential. Only approve domains controlled by providers you trust.
