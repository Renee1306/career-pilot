from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import AuthedUser, get_current_user
from app.models.application_model import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationUpdate,
    InterviewQuestionsRequest,
    TimelineEntryCreate,
    TimelineEntryUpdate,
)
from app.services import application_service

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("", response_model=list[ApplicationOut])
def list_applications(user: AuthedUser = Depends(get_current_user)):
    return application_service.list_applications(user.client, user.id)


@router.post("", response_model=ApplicationOut)
def create_application(payload: ApplicationCreate, user: AuthedUser = Depends(get_current_user)):
    return application_service.create_application(user.client, user.id, payload)


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(application_id: str, user: AuthedUser = Depends(get_current_user)):
    application = application_service.get_application(user.client, user.id, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return application


@router.patch("/{application_id}", response_model=ApplicationOut)
def update_application(
    application_id: str, payload: ApplicationUpdate, user: AuthedUser = Depends(get_current_user)
):
    updated = application_service.update_application(user.client, user.id, application_id, payload)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return updated


@router.delete("/{application_id}")
def delete_application(application_id: str, user: AuthedUser = Depends(get_current_user)):
    if not application_service.delete_application(user.client, user.id, application_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return {"deleted": True}


@router.post("/{application_id}/company-snapshot", response_model=ApplicationOut)
def generate_company_snapshot(application_id: str, user: AuthedUser = Depends(get_current_user)):
    updated = application_service.generate_company_snapshot(user.client, user.id, application_id)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return updated


@router.post("/{application_id}/interview-questions", response_model=ApplicationOut)
def generate_interview_questions(
    application_id: str,
    payload: InterviewQuestionsRequest,
    user: AuthedUser = Depends(get_current_user),
):
    updated = application_service.generate_interview_questions(
        user.client,
        user.id,
        application_id,
        payload.round_type,
        payload.jd_text,
        payload.resume_document_id,
    )
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return updated


@router.post("/{application_id}/timeline", response_model=ApplicationOut)
def create_timeline_entry(
    application_id: str, payload: TimelineEntryCreate, user: AuthedUser = Depends(get_current_user)
):
    updated = application_service.create_timeline_entry(user.client, user.id, application_id, payload)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return updated


@router.patch("/{application_id}/timeline/{entry_id}", response_model=ApplicationOut)
def update_timeline_entry(
    application_id: str,
    entry_id: str,
    payload: TimelineEntryUpdate,
    user: AuthedUser = Depends(get_current_user),
):
    updated = application_service.update_timeline_entry(user.client, user.id, application_id, entry_id, payload)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Timeline entry not found")
    return updated


@router.delete("/{application_id}/timeline/{entry_id}", response_model=ApplicationOut)
def delete_timeline_entry(
    application_id: str, entry_id: str, user: AuthedUser = Depends(get_current_user)
):
    updated = application_service.delete_timeline_entry(user.client, user.id, application_id, entry_id)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Timeline entry not found")
    return updated
