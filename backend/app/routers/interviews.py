from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import AuthedUser, get_current_user
from app.models.interview import InterviewRoundCreate, InterviewRoundOut, InterviewRoundUpdate
from app.services import interview_service

router = APIRouter(prefix="/interview-rounds", tags=["interviews"])


@router.get("", response_model=list[InterviewRoundOut])
def list_rounds(application_id: str, user: AuthedUser = Depends(get_current_user)):
    return interview_service.list_rounds_for_application(user.client, user.id, application_id)


@router.post("", response_model=InterviewRoundOut)
def create_round(payload: InterviewRoundCreate, user: AuthedUser = Depends(get_current_user)):
    return interview_service.create_round(user.client, user.id, payload)


@router.patch("/{round_id}", response_model=InterviewRoundOut)
def update_round(round_id: str, payload: InterviewRoundUpdate, user: AuthedUser = Depends(get_current_user)):
    updated = interview_service.update_round(user.client, user.id, round_id, payload)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interview round not found")
    return updated


@router.post("/{round_id}/generate-qna", response_model=InterviewRoundOut)
def generate_qna(round_id: str, user: AuthedUser = Depends(get_current_user)):
    try:
        return interview_service.generate_qna_for_round(user.client, user.id, round_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
