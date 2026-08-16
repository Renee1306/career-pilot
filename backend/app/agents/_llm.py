from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from app.core.config import settings

DASHSCOPE_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"


def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(model="gemini-flash-lite-latest", api_key=settings.gemini_api_key)


def get_dashscope_llm(model: str = "deepseek-v4-flash-0731", max_tokens: int = 1024) -> ChatOpenAI:
    """Alibaba Model Studio (DashScope) is an OpenAI-compatible endpoint - point base_url at it
    and use its model slug."""
    return ChatOpenAI(
        model=model,
        api_key=settings.alibaba_api_key,
        base_url=DASHSCOPE_BASE_URL,
        max_tokens=max_tokens,
    )
