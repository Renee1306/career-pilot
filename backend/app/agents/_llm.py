from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings


def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(model="gemini-flash-latest", api_key=settings.gemini_api_key)
