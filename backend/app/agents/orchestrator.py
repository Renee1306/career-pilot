from langchain_core.runnables import RunnableLambda, RunnableParallel

from app.agents.job_explainer import explain_job
from app.agents.typical_day import generate_typical_day
from app.models.job import JobExplanation, TypicalDay


class FullAnalysis:
    def __init__(self, explanation: JobExplanation, typical_day: TypicalDay):
        self.explanation = explanation
        self.typical_day = typical_day


def run_full_analysis(job_text: str) -> FullAnalysis:
    """Runs the two independent analysis agents concurrently via LangChain's
    RunnableParallel, which executes each branch in a thread pool - since each
    branch is a blocking Gemini HTTP call, this cuts wall-clock time roughly to
    that of the single slowest branch instead of the sum of both.

    Resume-match used to be a third parallel branch here. It is gone entirely -
    the Job Analysis page's Resume Match tab, its agent, its endpoint and its
    job_analyses columns were all removed; JD-based matching now lives only in
    Resume Builder, against the builder's structured document, via
    app/agents/resume_customizer.py."""
    parallel = RunnableParallel(
        explanation=RunnableLambda(lambda _: explain_job(job_text)),
        typical_day=RunnableLambda(lambda _: generate_typical_day(job_text)),
    )
    results = parallel.invoke({})
    return FullAnalysis(
        explanation=results["explanation"],
        typical_day=results["typical_day"],
    )
