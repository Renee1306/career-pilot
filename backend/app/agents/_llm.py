from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from app.core.config import settings

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(model="gemini-flash-lite-latest", api_key=settings.gemini_api_key)


def get_openrouter_llm(model: str = "nvidia/nemotron-3-ultra-550b-a55b", max_tokens: int = 1024) -> ChatOpenAI:
    """OpenRouter is an OpenAI-compatible endpoint, so this reuses ChatOpenAI rather than a
    dedicated OpenRouter integration - just point base_url at OpenRouter and use its model slug.

    max_tokens is capped explicitly: left unset, ChatOpenAI requests this model's full 65536-token
    output ceiling on every call, which OpenRouter's 402 "requires more credits" error will reject
    outright on a low remaining balance even for a two-sentence reply - the request never partially
    succeeds and falls back, it just fails. Callers whose structured output is bigger than a short
    chat reply (e.g. a full resume rewrite) should pass a higher max_tokens explicitly.
    """
    return ChatOpenAI(
        model=model,
        api_key=settings.openrouter_api_key,
        base_url=OPENROUTER_BASE_URL,
        max_tokens=max_tokens,
    )
