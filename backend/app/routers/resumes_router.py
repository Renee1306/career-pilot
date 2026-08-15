from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.middleware.auth import AuthedUser, get_current_user
from app.models.resume_model import ResumeCreate, ResumeOut
from app.services import resume_service

router = APIRouter(prefix="/resumes", tags=["resumes"])

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


@router.get("", response_model=list[ResumeOut])
def list_resumes(user: AuthedUser = Depends(get_current_user)):
    return resume_service.list_resumes(user.client, user.id)


@router.post("", response_model=ResumeOut)
def create_resume(payload: ResumeCreate, user: AuthedUser = Depends(get_current_user)):
    return resume_service.create_resume(user.client, user.id, payload)


@router.post("/upload", response_model=ResumeOut)
def upload_resume(
    file: UploadFile = File(...),
    label: str | None = Form(None),
    user: AuthedUser = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported file type: {file.content_type}. Allowed: PDF, PNG, JPEG, WEBP.",
        )

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File exceeds 10MB limit.")

    return resume_service.upload_and_parse_resume(
        user.client, user.id, file.filename or "resume", file_bytes, file.content_type, label
    )


@router.get("/{resume_id}", response_model=ResumeOut)
def get_resume(resume_id: str, user: AuthedUser = Depends(get_current_user)):
    resume = resume_service.get_resume(user.client, user.id, resume_id)
    if resume is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return resume


