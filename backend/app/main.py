from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import (
    applications_router,
    gmail_router,
    jobs_router,
    resume_documents_router,
)

app = FastAPI(title="CareerPilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume_documents_router.router)
app.include_router(jobs_router.router)
app.include_router(applications_router.router)
app.include_router(gmail_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
