from functools import lru_cache

from supabase import Client, ClientOptions, create_client

from app.core.config import settings


@lru_cache
def get_anon_client() -> Client:
    """Base client using the anon key, for auth verification only."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache(maxsize=256)
def get_client_for_user(access_token: str) -> Client:
    """Client scoped to a user's access token for every sub-client (postgrest,
    storage, functions), so RLS and storage object policies apply consistently.

    Cached per token: building a fresh supabase.Client here means fresh httpx transports
    for postgrest/storage/auth, so every request paid a new TCP+TLS handshake to Supabase
    instead of reusing a connection - measured as multiple seconds of pure connection
    overhead per request. Caching by token is safe (same token -> identical client config,
    every request still carries the caller's own token so RLS scoping is unaffected) and
    self-expiring in practice: token refreshes mint a new access_token string, which is a
    new cache key, so stale entries just age out via LRU eviction rather than needing
    explicit invalidation."""
    options = ClientOptions(headers={"Authorization": f"Bearer {access_token}"})
    return create_client(settings.supabase_url, settings.supabase_anon_key, options)


@lru_cache
def get_service_client() -> Client:
    """Bypasses RLS with the service-role key. Only for contexts with no user JWT
    available, e.g. the Gmail OAuth callback, which Google redirects to directly."""
    if not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not configured")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
