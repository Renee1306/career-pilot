import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

# LangChain/LangSmith read LANGCHAIN_* tracing env vars straight from os.environ (not from our
# Settings object), so they need to actually land in the process environment - pydantic-settings
# alone doesn't do that.
load_dotenv(BACKEND_DIR / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str | None = None
    gemini_api_key: str | None = None
    openrouter_api_key: str | None = None
    alibaba_api_key: str | None = None
    cors_origins: str = "http://localhost:5173"

    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "http://localhost:8000/gmail/callback"
    frontend_url: str = "http://localhost:5173"

    langchain_tracing_v2: bool = False
    langchain_api_key: str | None = None
    langchain_project: str = "career-pilot"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

# LangSmith's own auto-instrumentation (wired into every langchain-core Runnable, which is what
# get_llm()/.with_structured_output()/RunnableParallel all are) looks for these directly in
# os.environ. Setting them here - rather than relying on .env alone - means tracing turns on
# for every agent call with zero code changes in app/agents/*, as long as the two env vars below
# are set in backend/.env.
if settings.langchain_tracing_v2 and settings.langchain_api_key:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.langchain_api_key
    os.environ["LANGCHAIN_PROJECT"] = settings.langchain_project
