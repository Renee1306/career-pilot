from functools import lru_cache

from supabase import Client, ClientOptions, create_client

from app.core.config import settings


@lru_cache
def get_anon_client() -> Client:
    """Base client using the anon key, for auth verification only."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_client_for_user(access_token: str) -> Client:
    """Client scoped to a user's access token for every sub-client (postgrest,
    storage, functions), so RLS and storage object policies apply consistently."""
    options = ClientOptions(headers={"Authorization": f"Bearer {access_token}"})
    return create_client(settings.supabase_url, settings.supabase_anon_key, options)


@lru_cache
def get_service_client() -> Client:
    """Bypasses RLS with the service-role key. Only for contexts with no user JWT
    available, e.g. the Gmail OAuth callback, which Google redirects to directly."""
    if not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not configured")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
