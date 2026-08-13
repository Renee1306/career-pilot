import os

# Dummy Supabase credentials so Settings() (SUPABASE_URL/SUPABASE_ANON_KEY are required fields)
# can construct without a real backend/.env present. setdefault means a real .env - or real
# exported env vars - still wins if present; these are only a floor so the suite is runnable on
# a fresh clone with zero setup. Router tests below mock the service layer entirely, and the
# service-level tests that do need a Supabase "client" use a fake one - nothing here ever makes
# a real network call, so the values just need to exist, not be valid.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.middleware.auth import AuthedUser, get_current_user  # noqa: E402

TEST_USER_ID = "user-123"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_override():
    """Overrides the get_current_user dependency so router tests exercise a router's own
    logic (request validation, response shape, 404 mapping) without needing a real bearer
    token or a real Supabase auth round trip. `client` on the yielded AuthedUser is a bare
    object, not a real Supabase Client - router tests patch the service-layer function each
    endpoint calls, so nothing ever actually calls a method on it."""
    user = AuthedUser(id=TEST_USER_ID, email="test@example.com", client=object())
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)
