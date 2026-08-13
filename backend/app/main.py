from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import applications, chat, gmail, interviews, jobs, resume_documents, resumes

app = FastAPI(title="CareerPilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resumes.router)
app.include_router(resume_documents.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(interviews.router)
app.include_router(gmail.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "ok"}
