from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import AuthedUser, get_current_user
from app.models.job import JobAnalysisOut, JobDescriptionCreate, JobDescriptionOut
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


@router.get("/{job_id}/analyses", response_model=list[JobAnalysisOut])
def list_analyses(job_id: str, user: AuthedUser = Depends(get_current_user)):
    return job_service.list_analyses_for_job(user.client, user.id, job_id)
