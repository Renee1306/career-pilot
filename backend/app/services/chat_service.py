import json

from supabase import Client

from app.agents.chat_assistant import answer_chat_message
from app.models.chat import ChatMessage
from app.services import job_service, resume_service


def _build_context(client: Client, user_id: str, job_id: str | None, resume_id: str | None) -> str:
    parts: list[str] = []

    job = job_service.get_job_description(client, user_id, job_id) if job_id else None
    if job:
        parts.append(f"Job description:\n{job['raw_text']}")

    resume = resume_service.get_resume(client, user_id, resume_id) if resume_id else None
    if resume:
        parts.append(f"Candidate's resume:\n{resume.get('parsed_text') or ''}")

    if job_id:
        analysis = job_service.get_analysis(client, user_id, job_id)
        if analysis:
            if analysis.get("explanation"):
                parts.append(f"Already-generated job explanation:\n{json.dumps(analysis['explanation'])}")
            if analysis.get("typical_day"):
                parts.append(f"Already-generated typical day:\n{json.dumps(analysis['typical_day'])}")

    return "\n\n".join(parts)


def send_chat_message(
    client: Client,
    user_id: str,
    message: str,
    history: list[ChatMessage],
    job_id: str | None,
    resume_id: str | None,
) -> str:
    context = _build_context(client, user_id, job_id, resume_id)
    return answer_chat_message(context, history, message)
