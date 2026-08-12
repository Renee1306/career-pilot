from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import AuthedUser, get_current_user
from app.models.job import (
    JobAnalysisOut,
    JobDescriptionCreate,
    JobDescriptionOut,
    TranslateRequest,
)
from app.services import job_service

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobDescriptionOut])
def list_job_descriptions(user: AuthedUser = Depends(get_current_user)):
    return job_service.list_job_descriptions(user.client, user.id)


@router.post("", response_model=JobDescriptionOut)
def create_job_description(payload: JobDescriptionCreate, user: AuthedUser = Depends(get_current_user)):
    return job_service.create_job_description(user.client, user.id, payload)


@router.get("/{job_id}", response_model=JobDescriptionOut)
def get_job_description(job_id: str, user: AuthedUser = Depends(get_current_user)):
    job = job_service.get_job_description(user.client, user.id, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job description not found")
    return job


@router.get("/{job_id}/analysis", response_model=JobAnalysisOut | None)
def get_analysis(job_id: str, user: AuthedUser = Depends(get_current_user)):
    return job_service.get_analysis(user.client, user.id, job_id)


def _run(fn, *args):
    try:
        return fn(*args)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/{job_id}/explanation", response_model=JobAnalysisOut)
def generate_explanation(job_id: str, user: AuthedUser = Depends(get_current_user)):
    return _run(job_service.generate_explanation, user.client, user.id, job_id)


@router.post("/{job_id}/typical-day", response_model=JobAnalysisOut)
def generate_typical_day(job_id: str, user: AuthedUser = Depends(get_current_user)):
    return _run(job_service.generate_typical_day_analysis, user.client, user.id, job_id)


@router.post("/{job_id}/analyze-all", response_model=JobAnalysisOut)
def generate_full_analysis(job_id: str, user: AuthedUser = Depends(get_current_user)):
    """Runs explanation and typical-day concurrently (see app/agents/orchestrator.py) instead of
    two separate sequential calls. Takes no body - neither analysis depends on a resume."""
    return _run(job_service.generate_full_analysis, user.client, user.id, job_id)


@router.post("/{job_id}/explanation/translate", response_model=JobAnalysisOut)
def translate_explanation(
    job_id: str, payload: TranslateRequest, user: AuthedUser = Depends(get_current_user)
):
    return _run(job_service.translate_explanation, user.client, user.id, job_id, payload.language)


@router.post("/{job_id}/typical-day/translate", response_model=JobAnalysisOut)
def translate_typical_day(
    job_id: str, payload: TranslateRequest, user: AuthedUser = Depends(get_current_user)
):
    return _run(job_service.translate_typical_day, user.client, user.id, job_id, payload.language)
