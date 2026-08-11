import base64

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings
from app.models.resume import ResumeParsed

EXTRACTION_PROMPT = (
    "You are given a resume as a file. Extract its contents into the structured "
    "format. Also include a `raw_text` field with the full plain-text transcription "
    "of the resume, in reading order. Leave fields null/empty if not present in the "
    "resume - do not invent information."
)


def parse_resume(file_bytes: bytes, mime_type: str) -> ResumeParsed:
    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", api_key=settings.gemini_api_key)
    structured_llm = llm.with_structured_output(ResumeParsed)

    encoded = base64.b64encode(file_bytes).decode("utf-8")
    message = HumanMessage(
        content=[
            {"type": "text", "text": EXTRACTION_PROMPT},
            {"type": "media", "mime_type": mime_type, "data": encoded},
        ]
    )
    return structured_llm.invoke([message])
