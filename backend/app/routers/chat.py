from fastapi import APIRouter, Depends

from app.middleware.auth import AuthedUser, get_current_user
from app.models.chat import ChatRequest, ChatResponse
from app.services import chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def send_message(payload: ChatRequest, user: AuthedUser = Depends(get_current_user)):
    reply = chat_service.send_chat_message(
        user.client, user.id, payload.message, payload.history, payload.job_id, payload.resume_id
    )
    return ChatResponse(reply=reply)
