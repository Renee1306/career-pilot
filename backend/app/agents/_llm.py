from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from app.core.config import settings

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DASHSCOPE_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"


def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(model="gemini-flash-lite-latest", api_key=settings.gemini_api_key)


def get_openrouter_llm(model: str = "nvidia/nemotron-3-ultra-550b-a55b:free", max_tokens: int = 1024) -> ChatOpenAI:
    """OpenRouter is an OpenAI-compatible endpoint, so this reuses ChatOpenAI rather than a
    dedicated OpenRouter integration - just point base_url at OpenRouter and use its model slug.
    """
    return ChatOpenAI(
        model=model,
        api_key=settings.openrouter_api_key,
        base_url=OPENROUTER_BASE_URL,
        max_tokens=max_tokens,
    )


def get_dashscope_llm(model: str = "deepseek-v4-flash-0731", max_tokens: int = 1024) -> ChatOpenAI:
    """Alibaba Model Studio (DashScope) is also an OpenAI-compatible endpoint - same pattern as
    get_openrouter_llm() above, just a different base_url/key/model slug.
    """
    return ChatOpenAI(
        model=model,
        api_key=settings.alibaba_api_key,
        base_url=DASHSCOPE_BASE_URL,
        max_tokens=max_tokens,
    )
