from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.middleware.auth import AuthedUser, get_current_user
from app.models.resume_document_model import (
    EnhanceTextRequest,
    EnhanceTextResponse,
    GapTurnRequest,
    GapTurnResponse,
    JDMatchRequest,
    JDReview,
    ResumeDocumentCreate,
    ResumeDocumentListItem,
    ResumeDocumentOut,
    ResumeDocumentUpdate,
)
from app.services import resume_document_service

router = APIRouter(prefix="/resume-documents", tags=["resume-documents"])

ALLOWED_PHOTO_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_IMPORT_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/webp"}
MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024


@router.get("", response_model=list[ResumeDocumentListItem])
def list_resume_documents(user: AuthedUser = Depends(get_current_user)):
    return resume_document_service.list_resume_documents(user.client, user.id)


@router.post("", response_model=ResumeDocumentOut)
def create_resume_document(payload: ResumeDocumentCreate, user: AuthedUser = Depends(get_current_user)):
    return resume_document_service.create_resume_document(user.client, user.id, payload)


@router.post("/enhance-text", response_model=EnhanceTextResponse)
def enhance_text(payload: EnhanceTextRequest, user: AuthedUser = Depends(get_current_user)):
    return EnhanceTextResponse(text=resume_document_service.enhance_text(payload.text, payload.context))


@router.post("/import", response_model=ResumeDocumentOut)
def import_resume_document(file: UploadFile = File(...), user: AuthedUser = Depends(get_current_user)):
    if file.content_type not in ALLOWED_IMPORT_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported file type: {file.content_type}. Allowed: PDF, PNG, JPEG, WEBP.",
        )

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_IMPORT_SIZE_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File exceeds 10MB limit.")

    return resume_document_service.import_resume_document(
        user.client, user.id, file.filename or "Imported Resume", file_bytes, file.content_type
    )


@router.get("/{doc_id}", response_model=ResumeDocumentOut)
def get_resume_document(doc_id: str, user: AuthedUser = Depends(get_current_user)):
    doc = resume_document_service.get_resume_document(user.client, user.id, doc_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return doc


@router.patch("/{doc_id}", response_model=ResumeDocumentOut)
def update_resume_document(
    doc_id: str, payload: ResumeDocumentUpdate, user: AuthedUser = Depends(get_current_user)
):
    doc = resume_document_service.update_resume_document(user.client, user.id, doc_id, payload)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return doc


@router.delete("/{doc_id}")
def delete_resume_document(doc_id: str, user: AuthedUser = Depends(get_current_user)):
    if not resume_document_service.delete_resume_document(user.client, user.id, doc_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return {"deleted": True}


@router.post("/{doc_id}/duplicate", response_model=ResumeDocumentOut)
def duplicate_resume_document(doc_id: str, user: AuthedUser = Depends(get_current_user)):
    doc = resume_document_service.duplicate_resume_document(user.client, user.id, doc_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return doc


@router.post("/{doc_id}/photo", response_model=ResumeDocumentOut)
def upload_photo(doc_id: str, file: UploadFile = File(...), user: AuthedUser = Depends(get_current_user)):
    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported file type: {file.content_type}. Allowed: PNG, JPEG, WEBP.",
        )

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_PHOTO_SIZE_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Photo exceeds 5MB limit.")

    doc = resume_document_service.upload_photo(
        user.client, user.id, doc_id, file.filename or "photo", file_bytes, file.content_type
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return doc


@router.delete("/{doc_id}/photo", response_model=ResumeDocumentOut)
def remove_photo(doc_id: str, user: AuthedUser = Depends(get_current_user)):
    doc = resume_document_service.remove_photo(user.client, user.id, doc_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return doc


@router.post("/{doc_id}/jd-review", response_model=JDReview)
def review_jd_match(doc_id: str, payload: JDMatchRequest, user: AuthedUser = Depends(get_current_user)):
    result = resume_document_service.review_jd_match(user.client, user.id, doc_id, payload.jd_text)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return result


@router.post("/{doc_id}/jd-gap-turn", response_model=GapTurnResponse)
def run_gap_turn(doc_id: str, payload: GapTurnRequest, user: AuthedUser = Depends(get_current_user)):
    result = resume_document_service.run_gap_turn(
        user.client, user.id, doc_id, payload.jd_text, payload.gap, payload.strengths, payload.history
    )
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return result
