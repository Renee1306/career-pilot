from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    job_id: str | None = None
    resume_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
