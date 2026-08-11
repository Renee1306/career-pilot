from langchain_core.runnables import RunnableLambda, RunnableParallel

from app.agents.job_explainer import explain_job
from app.agents.resume_matcher import match_resume
from app.agents.typical_day import generate_typical_day
from app.models.job import JobExplanation, ResumeMatch, TypicalDay


class FullAnalysis:
    def __init__(self, explanation: JobExplanation, typical_day: TypicalDay, resume_match: ResumeMatch):
        self.explanation = explanation
        self.typical_day = typical_day
        self.resume_match = resume_match


def run_full_analysis(job_text: str, resume_text: str) -> FullAnalysis:
    """Runs the three independent analysis agents concurrently via LangChain's
    RunnableParallel, which executes each branch in a thread pool - since each
    branch is a blocking Gemini HTTP call, this cuts wall-clock time roughly to
    that of the single slowest branch instead of the sum of all three."""
    parallel = RunnableParallel(
        explanation=RunnableLambda(lambda _: explain_job(job_text)),
        typical_day=RunnableLambda(lambda _: generate_typical_day(job_text)),
        resume_match=RunnableLambda(lambda _: match_resume(job_text, resume_text)),
    )
    results = parallel.invoke({})
    return FullAnalysis(
        explanation=results["explanation"],
        typical_day=results["typical_day"],
        resume_match=results["resume_match"],
    )
