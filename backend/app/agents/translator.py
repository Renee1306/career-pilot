from app.agents._llm import get_llm
from app.models.job import JobExplanation

PROMPT = (
    "Translate every text field in the following job explanation into {language}. "
    "Keep the same structure and meaning, just in {language}.\n\n{content_json}"
)


def translate_job_explanation(explanation: JobExplanation, language: str) -> JobExplanation:
    structured_llm = get_llm().with_structured_output(JobExplanation)
    return structured_llm.invoke(
        PROMPT.format(language=language, content_json=explanation.model_dump_json(indent=2))
    )
