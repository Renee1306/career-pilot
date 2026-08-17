from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from app.core.config import settings

DASHSCOPE_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"


def get_gemini_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model="gemini-3.5-flash-lite", 
        api_key=settings.gemini_api_key)

def get_dashscope_llm(model: str = "deepseek-v4-flash-0731", max_tokens: int = 1024) -> ChatOpenAI:
    """Alibaba Model Studio (DashScope) is an OpenAI-compatible endpoint - point base_url at it
    and use its model slug.
    """
    return ChatOpenAI(
        model=model,
        api_key=settings.alibaba_api_key,
        base_url=DASHSCOPE_BASE_URL,
        max_tokens=max_tokens,
        extra_body={"enable_thinking": False},
    )

def get_dashscope_llm_2(model: str = "deepseek-v4-pro-0813", max_tokens: int = 1024) -> ChatOpenAI:
    """Same DashScope connection as get_dashscope_llm, defaulted to the pro model instead of
    flash - for agents (currently just the JD coach) that need the stronger model.
    """
    return ChatOpenAI(
        model=model,
        api_key=settings.alibaba_api_key,
        base_url=DASHSCOPE_BASE_URL,
        max_tokens=max_tokens,
        extra_body={"enable_thinking": False},
    )
