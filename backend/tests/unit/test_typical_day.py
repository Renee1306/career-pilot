"""_normalize_time_allocation is the one piece of typical_day.py that isn't an LLM call - the
model doesn't reliably return percentages that sum to exactly 100, so this rescales server-side.
Per the "mock the agent boundary, test everything around it" scope, generate_typical_day itself
(the actual Gemini call) is left to real E2E verification, same as before."""

from app.agents.typical_day import _normalize_time_allocation
from app.models.job import (
    Collaborator,
    DayBreakdown,
    DayPeriod,
    TimeAllocation,
    TypicalDay,
)


def _day_period() -> DayPeriod:
    return DayPeriod(approximate_time="9am", activity="Standup", description="...", rationale="...")


def _typical_day(**allocation_kwargs) -> TypicalDay:
    return TypicalDay(
        overview="...",
        day_breakdown=DayBreakdown(morning=_day_period(), afternoon=_day_period(), end_of_day=_day_period()),
        time_allocation=TimeAllocation(**allocation_kwargs),
        collaborators=[Collaborator(who="Manager", why="...", example_interaction="...")],
        surprises=["..."],
    )


def test_leaves_allocation_untouched_when_it_already_sums_to_100():
    result = _typical_day(
        technical_development=40,
        meetings_communication=20,
        analysis_problem_solving=20,
        testing_qa=10,
        documentation_administrative=5,
        research_learning=5,
        other=0,
    )

    normalized = _normalize_time_allocation(result)

    assert sum(normalized.time_allocation.model_dump().values()) == 100
    assert normalized.time_allocation.technical_development == 40


def test_rescales_when_total_is_under_100():
    # Sums to 80 - a common model failure mode (see the docstring on the real function).
    result = _typical_day(
        technical_development=32,
        meetings_communication=16,
        analysis_problem_solving=16,
        testing_qa=8,
        documentation_administrative=4,
        research_learning=4,
        other=0,
    )

    normalized = _normalize_time_allocation(result)

    assert sum(normalized.time_allocation.model_dump().values()) == 100


def test_rescales_when_total_is_over_100():
    result = _typical_day(
        technical_development=50,
        meetings_communication=30,
        analysis_problem_solving=30,
        testing_qa=10,
        documentation_administrative=10,
        research_learning=10,
        other=10,
    )

    normalized = _normalize_time_allocation(result)

    assert sum(normalized.time_allocation.model_dump().values()) == 100


def test_rounding_drift_is_absorbed_by_the_largest_bucket():
    # 33/33/34 over 3 real buckets (others 0) - rescaling from a total that isn't a clean
    # divisor of 100 is exactly where naive per-field rounding drifts off 100.
    result = _typical_day(
        technical_development=33,
        meetings_communication=33,
        analysis_problem_solving=34,
        testing_qa=0,
        documentation_administrative=0,
        research_learning=0,
        other=0,
    )

    normalized = _normalize_time_allocation(result)
    values = normalized.time_allocation.model_dump()

    assert sum(values.values()) == 100
    # The largest original bucket (analysis_problem_solving) is the one that absorbs any
    # rounding drift, per _normalize_time_allocation's own comment.
    assert values["analysis_problem_solving"] >= values["technical_development"]
    assert values["analysis_problem_solving"] >= values["meetings_communication"]


def test_all_zero_allocation_is_left_alone_rather_than_dividing_by_zero():
    result = _typical_day(
        technical_development=0,
        meetings_communication=0,
        analysis_problem_solving=0,
        testing_qa=0,
        documentation_administrative=0,
        research_learning=0,
        other=0,
    )

    normalized = _normalize_time_allocation(result)

    assert sum(normalized.time_allocation.model_dump().values()) == 0
