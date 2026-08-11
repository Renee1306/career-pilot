from functools import lru_cache

from supabase import Client, create_client

from app.core.config import settings


@lru_cache
def get_anon_client() -> Client:
    """Base client using the anon key. Callers must call .postgrest.auth(jwt)
    with the requesting user's access token before querying, so RLS applies."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_client_for_user(access_token: str) -> Client:
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client
