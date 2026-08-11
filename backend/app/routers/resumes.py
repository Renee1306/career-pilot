from fastapi import APIRouter, Depends

from app.middleware.auth import AuthedUser, get_current_user
from app.models.resume import ResumeCreate, ResumeOut
from app.services import resume_service

router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.get("", response_model=list[ResumeOut])
def list_resumes(user: AuthedUser = Depends(get_current_user)):
    return resume_service.list_resumes(user.client, user.id)


@router.post("", response_model=ResumeOut)
def create_resume(payload: ResumeCreate, user: AuthedUser = Depends(get_current_user)):
    return resume_service.create_resume(user.client, user.id, payload)
