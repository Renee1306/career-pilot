from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import AuthedUser, get_current_user
from app.models.application import ApplicationCreate, ApplicationOut, ApplicationUpdate, TimelineEntryCreate
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


@router.post("/{application_id}/timeline", response_model=ApplicationOut)
def add_timeline_entry(
    application_id: str, payload: TimelineEntryCreate, user: AuthedUser = Depends(get_current_user)
):
    updated = application_service.add_timeline_entry(user.client, user.id, application_id, payload.note)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return updated
