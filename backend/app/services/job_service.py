from supabase import Client

from app.agents.job_explainer import explain_job
from app.agents.orchestrator import run_full_analysis
from app.agents.resume_matcher import match_resume
from app.agents.translator import translate_job_explanation
from app.agents.typical_day import generate_typical_day
from app.models.job import JobDescriptionCreate, JobExplanation
from app.services import resume_service

JOBS_TABLE = "job_descriptions"
ANALYSES_TABLE = "job_analyses"


def list_job_descriptions(client: Client, user_id: str) -> list[dict]:
    res = (
        client.table(JOBS_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


def create_job_description(client: Client, user_id: str, payload: JobDescriptionCreate) -> dict:
    row = {"user_id": user_id, **payload.model_dump(exclude_none=True)}
    res = client.table(JOBS_TABLE).insert(row).execute()
    return res.data[0]


def get_job_description(client: Client, user_id: str, job_id: str) -> dict | None:
    res = (
        client.table(JOBS_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("id", job_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def get_analysis(client: Client, user_id: str, job_id: str) -> dict | None:
    res = (
        client.table(ANALYSES_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("job_description_id", job_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def _get_or_create_analysis(client: Client, user_id: str, job_id: str) -> dict:
    existing = get_analysis(client, user_id, job_id)
    if existing is not None:
        return existing
    row = {"user_id": user_id, "job_description_id": job_id}
    res = client.table(ANALYSES_TABLE).insert(row).execute()
    return res.data[0]


def generate_explanation(client: Client, user_id: str, job_id: str) -> dict:
    job = get_job_description(client, user_id, job_id)
    if job is None:
        raise ValueError("Job description not found")

    explanation = explain_job(job["raw_text"])
    analysis = _get_or_create_analysis(client, user_id, job_id)
    res = (
        client.table(ANALYSES_TABLE)
        .update({"explanation": explanation.model_dump()})
        .eq("id", analysis["id"])
        .execute()
    )
    return res.data[0]


def generate_typical_day_analysis(client: Client, user_id: str, job_id: str) -> dict:
    job = get_job_description(client, user_id, job_id)
    if job is None:
        raise ValueError("Job description not found")

    typical_day = generate_typical_day(job["raw_text"])
    analysis = _get_or_create_analysis(client, user_id, job_id)
    res = (
        client.table(ANALYSES_TABLE)
        .update({"typical_day": typical_day.model_dump()})
        .eq("id", analysis["id"])
        .execute()
    )
    return res.data[0]


def generate_resume_match(client: Client, user_id: str, job_id: str, resume_id: str) -> dict:
    job = get_job_description(client, user_id, job_id)
    if job is None:
        raise ValueError("Job description not found")
    resume = resume_service.get_resume(client, user_id, resume_id)
    if resume is None:
        raise ValueError("Resume not found")

    match = match_resume(job["raw_text"], resume.get("parsed_text") or "")
    analysis = _get_or_create_analysis(client, user_id, job_id)
    res = (
        client.table(ANALYSES_TABLE)
        .update({"resume_id": resume_id, "match_suggestions": match.model_dump()})
        .eq("id", analysis["id"])
        .execute()
    )
    return res.data[0]


def generate_full_analysis(client: Client, user_id: str, job_id: str, resume_id: str) -> dict:
    job = get_job_description(client, user_id, job_id)
    if job is None:
        raise ValueError("Job description not found")
    resume = resume_service.get_resume(client, user_id, resume_id)
    if resume is None:
        raise ValueError("Resume not found")

    results = run_full_analysis(job["raw_text"], resume.get("parsed_text") or "")

    analysis = _get_or_create_analysis(client, user_id, job_id)
    res = (
        client.table(ANALYSES_TABLE)
        .update(
            {
                "explanation": results.explanation.model_dump(),
                "typical_day": results.typical_day.model_dump(),
                "resume_id": resume_id,
                "match_suggestions": results.resume_match.model_dump(),
            }
        )
        .eq("id", analysis["id"])
        .execute()
    )
    return res.data[0]


def translate_explanation(client: Client, user_id: str, job_id: str, language: str) -> dict:
    analysis = get_analysis(client, user_id, job_id)
    if analysis is None or not analysis.get("explanation"):
        raise ValueError("Generate the job explanation before translating it")

    explanation = JobExplanation.model_validate(analysis["explanation"])
    translated = translate_job_explanation(explanation, language)

    translations = {**(analysis.get("translations") or {}), language: translated.model_dump()}
    res = (
        client.table(ANALYSES_TABLE)
        .update({"translations": translations})
        .eq("id", analysis["id"])
        .execute()
    )
    return res.data[0]
