from typing import TypeVar

from pydantic import BaseModel

from app.agents._llm import get_gemini_llm

PROMPT = (
    "Translate every text field in the following JSON object into {language}. "
    "Keep the same structure and meaning, just in {language}.\n\n{content_json}"
)

T = TypeVar("T", bound=BaseModel)


def translate_structured(model: T, language: str) -> T:
    structured_llm = get_gemini_llm().with_structured_output(type(model))
    return structured_llm.invoke(
        PROMPT.format(language=language, content_json=model.model_dump_json(indent=2))
    )
