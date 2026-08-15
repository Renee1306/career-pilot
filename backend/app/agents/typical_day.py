from app.agents._llm import get_dashscope_llm
from app.models.job_model import TypicalDay

TYPICAL_DAY_PROMPT = """
<role>
You are CareerPilot's Typical Day Agent.
</role>

<goal>
Help a candidate visualize what working in this role might actually feel like.
</goal>

<input>
<job_description>
{raw_text}
</job_description>
</input>

<important_context>
The schedule is an illustrative estimate.

It is NOT the company's actual daily schedule.
</important_context>

<output_sections>

<section number="1" name="overall_day">
Describe the overall nature of the work in 2-3 simple sentences.

Answer:
"What would I probably spend most of my working day doing?"
</section>

<section number="2" name="day_breakdown">
Create a realistic illustrative workday.

Include:
- morning
- afternoon
- end of day

For each:
- approximate time
- activity
- what the candidate would do
- why the activity is likely based on the JD
</section>

<section number="3" name="time_allocation">
Estimate time spent across:

- Technical / Development
- Meetings / Communication
- Analysis / Problem Solving
- Testing / Quality Assurance
- Documentation / Administrative
- Research / Learning
- Other

Percentages MUST add up to exactly 100%.

These are estimates, not company data.
</section>

<section number="4" name="collaborators">
Identify likely collaborators based on the responsibilities.

For each:
- person/team
- why interaction occurs
- example interaction

Only use reasonable role-level assumptions supported by the JD.
</section>

<section number="5" name="surprises">
Provide 3-5 realistic observations about the role.

Clearly label them as estimates or general observations.
</section>

</output_sections>

<constraints>
<rule>Never claim to know the company's actual schedule.</rule>
<rule>Do not invent company-specific processes.</rule>
<rule>Base the analysis primarily on the JD.</rule>
<rule>Use simple language.</rule>
<rule>Help the candidate decide whether they would enjoy the job.</rule>
</constraints>

<output>
Return the result using the provided structured output schema.
</output>
"""


def generate_typical_day(raw_text: str) -> TypicalDay:
    structured_llm = get_dashscope_llm(max_tokens=8192).with_structured_output(TypicalDay)
    result = structured_llm.invoke(TYPICAL_DAY_PROMPT.format(raw_text=raw_text))
    return _normalize_time_allocation(result)


def _normalize_time_allocation(result: TypicalDay) -> TypicalDay:
    allocation = result.time_allocation
    values = allocation.model_dump()
    total = sum(values.values())
    if total > 0 and total != 100:
        scaled = {k: round(v * 100 / total) for k, v in values.items()}
        drift = 100 - sum(scaled.values())
        largest_key = max(scaled, key=lambda k: scaled[k])
        scaled[largest_key] += drift
        result.time_allocation = type(allocation)(**scaled)
    return result
