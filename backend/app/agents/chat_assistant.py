from app.agents._llm import get_openrouter_llm
from app.models.chat import ChatMessage

SYSTEM_PROMPT = (
    "You are CareerPilot's in-app assistant. You help a job seeker understand a job posting, "
    "how their resume matches it, and how to prepare. Answer conversationally and concisely, "
    "grounded in the context below. If the context is missing something the user asks about, "
    "say so rather than inventing details.\n\nContext:\n{context}"
)


def _format_history(history: list[ChatMessage]) -> str:
    lines = []
    for msg in history:
        speaker = "User" if msg.role == "user" else "Assistant"
        lines.append(f"{speaker}: {msg.content}")
    return "\n".join(lines)


def _extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "".join(parts)
    return str(content)


def answer_chat_message(context: str, history: list[ChatMessage], message: str) -> str:
    prompt = (
        f"{SYSTEM_PROMPT.format(context=context or 'No job or resume is currently loaded.')}\n\n"
        f"Conversation so far:\n{_format_history(history)}\n\n"
        f"User: {message}\nAssistant:"
    )
    result = get_openrouter_llm().invoke(prompt)
    return _extract_text(result.content)
