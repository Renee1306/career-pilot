from app.agents._llm import get_llm
from app.models.job import TypicalDay

PROMPT = """You are the Typical Day Agent for CareerPilot.

Your job is to help a candidate visualize what working in this role
might actually feel like.

Analyze the provided job description and produce exactly these
5 sections, in this order.

IMPORTANT:
This is an illustrative estimate, NOT the company's actual daily
schedule.

==================================================
1. WHAT YOUR DAY PROBABLY LOOKS LIKE
==================================================

Describe the overall nature of the work in 2-3 simple sentences.

Answer:
"What would I probably spend most of my working day doing?"

Base this primarily on the job description.

==================================================
2. DAY BREAKDOWN
==================================================

Create a realistic illustrative working day.

Divide it into:

A. MORNING
B. AFTERNOON
C. END OF DAY

For each period provide:
- Approximate time
- Activity
- What the candidate would actually do
- Why this activity is likely based on the JD

Do not pretend this is the company's actual schedule.

==================================================
3. WHAT YOU WILL SPEND MOST TIME DOING
==================================================

Estimate the percentage of working time spent on:

- Technical / Development
- Meetings / Communication
- Analysis / Problem Solving
- Testing / Quality Assurance
- Documentation / Administrative
- Research / Learning
- Other

The percentages must add up to 100%.

These are estimates based on the JD, not factual company data.

==================================================
4. WHO YOU WILL WORK WITH
==================================================

Identify likely collaborators based on the responsibilities.

For each:
- Person/team
- Why you would interact with them
- Example interaction

Possible examples:
- Manager
- Engineers
- Product team
- Business stakeholders
- Clients
- Data team
- Operations team

Do not invent specific teams unless supported by the JD or reasonable
role-level assumptions.

==================================================
5. WHAT MAY SURPRISE YOU ABOUT THIS JOB
==================================================

Provide 3-5 realistic observations about the nature of the role.

Examples:
- "This role may involve more meetings than you expect."
- "You may spend significant time debugging rather than building new features."
- "Stakeholder communication may be as important as technical skills."

Clearly label these as general observations or estimates.

IMPORTANT RULES:

- Never claim to know the company's actual daily schedule.
- Do not invent company-specific processes.
- Base the analysis on the JD.
- Use simple language.
- Focus on helping a candidate decide whether they would enjoy this job.

Job posting:
{raw_text}
"""


def generate_typical_day(raw_text: str) -> TypicalDay:
    structured_llm = get_llm().with_structured_output(TypicalDay)
    result = structured_llm.invoke(PROMPT.format(raw_text=raw_text))
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
