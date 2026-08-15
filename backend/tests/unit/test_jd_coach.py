"""The pure helpers around jd_coach's LLM calls (review/gap_turn are left to real E2E testing,
per the "mock the agent boundary" scope).

The slot machinery is what makes per-bullet hints addressable at all: if `_build_slots` and the
frontend's bullet splitting ever disagree about what counts as one bullet, an accepted hint
silently rewrites the wrong line - so its edge cases are pinned here.
"""

from app.agents.jd_coach import (
    _build_entry_refs,
    _build_slots,
    _entry_label,
    flatten_resume_content,
    _format_entry_refs,
    _format_slots,
    _format_transcript,
    _split_bullets,
)
from app.models.resume_document_model import CoachMessage


class TestSplitBullets:
    def test_splits_on_newlines_and_trims(self):
        assert _split_bullets("  first \n second  ") == ["first", "second"]

    def test_drops_blank_lines(self):
        # Blank lines are invisible in the rendered template, so counting them would push every
        # later bullet_index out by one against what the user actually sees.
        assert _split_bullets("first\n\n\nsecond\n") == ["first", "second"]

    def test_single_line_is_one_bullet(self):
        assert _split_bullets("just the one") == ["just the one"]

    def test_empty_description_has_no_bullets(self):
        assert _split_bullets("") == []
        assert _split_bullets("   \n  ") == []


class TestEntryLabel:
    def test_joins_both_parts(self):
        entry = {"position": "Backend Engineer", "company": "Acme"}
        assert _entry_label(entry, "position", "company", "Work experience") == "Backend Engineer at Acme"

    def test_falls_back_to_either_part_alone(self):
        assert _entry_label({"position": "Engineer"}, "position", "company", "x") == "Engineer"
        assert _entry_label({"company": "Acme"}, "position", "company", "x") == "Acme"

    def test_falls_back_to_generic_label(self):
        assert _entry_label({}, "position", "company", "Work experience") == "Work experience"

    def test_strips_whitespace(self):
        entry = {"position": "  Engineer  ", "company": "  Acme  "}
        assert _entry_label(entry, "position", "company", "x") == "Engineer at Acme"


class TestBuildSlots:
    def test_one_slot_per_bullet_not_per_entry(self):
        content = {
            "work_experience": [
                {"id": "w1", "position": "Engineer", "company": "Acme", "description": "Did A.\nDid B."}
            ]
        }
        slots = _build_slots(content)
        assert [s.text for s in slots] == ["Did A.", "Did B."]
        assert [s.bullet_index for s in slots] == [0, 1]
        assert all(s.entry_id == "w1" for s in slots)

    def test_summary_is_a_single_slot(self):
        slots = _build_slots({"summary": {"text": "A statement."}})
        assert len(slots) == 1
        assert slots[0].target == "summary"
        assert slots[0].entry_id is None

    def test_skips_empty_summary(self):
        assert _build_slots({"summary": {"text": "   "}}) == []

    def test_one_slot_per_skill_group_not_per_skill(self):
        # A group renders as a single bullet, so it must be a single reviewable unit.
        content = {
            "skills": {
                "groups": [
                    {"id": "s1", "category": "Languages", "items": ["Python", "SQL"]},
                    {"id": "s2", "category": "", "items": ["Docker"]},
                ]
            }
        }
        slots = _build_slots(content)
        assert [s.text for s in slots] == ["Languages: Python, SQL", "Docker"]
        assert [s.bullet_index for s in slots] == [0, 1]

    def test_empty_skill_groups_keep_later_indices_aligned(self):
        content = {
            "skills": {
                "groups": [
                    {"id": "s1", "category": "Languages", "items": ["Python"]},
                    {"id": "s2", "category": "Empty", "items": []},
                    {"id": "s3", "category": "Cloud", "items": ["Azure"]},
                ]
            }
        }
        slots = _build_slots(content)
        # The empty group renders nothing, but the group after it must still report index 2 -
        # the frontend addresses a hint by its position in the stored array.
        assert [s.bullet_index for s in slots] == [0, 2]

    def test_covers_projects(self):
        content = {"projects": [{"id": "p1", "name": "Kerry", "description": "Built it."}]}
        slots = _build_slots(content)
        assert slots[0].target == "projects"
        assert slots[0].entry_label == "Kerry"

    def test_empty_resume_yields_no_slots(self):
        assert _build_slots({}) == []

    def test_tolerates_missing_optional_fields(self):
        content = {"work_experience": [{"id": "w1", "position": None, "company": None, "description": None}]}
        assert _build_slots(content) == []


class TestBuildEntryRefs:
    def test_lists_work_experience_then_projects(self):
        content = {
            "work_experience": [{"id": "w1", "position": "Engineer", "company": "Acme"}],
            "projects": [{"id": "p1", "name": "Kerry"}],
        }
        refs = _build_entry_refs(content)
        assert [r.target for r in refs] == ["work_experience", "projects"]
        assert [r.entry_id for r in refs] == ["w1", "p1"]

    def test_format_always_offers_the_summary_fallback(self):
        # -1 is what the model picks when nothing on the resume fits; without it in the list a
        # confirmed answer would have nowhere to attach and would be dropped.
        assert "[-1]" in _format_entry_refs([])


class TestFormatSlots:
    def test_numbers_slots_and_labels_bullets_from_one(self):
        content = {"work_experience": [{"id": "w1", "position": "Engineer", "description": "A.\nB."}]}
        text = _format_slots(_build_slots(content))
        assert "[0] (work_experience) Engineer · bullet 1: A." in text
        assert "[1] (work_experience) Engineer · bullet 2: B." in text

    def test_has_a_placeholder_for_an_empty_resume(self):
        assert _format_slots([]) != ""


class TestFormatTranscript:
    def test_marks_an_empty_history(self):
        assert _format_transcript([]) == "(no messages yet)"

    def test_labels_each_speaker(self):
        history = [
            CoachMessage(role="assistant", content="Have you used AWS?"),
            CoachMessage(role="user", content="Yes, at my internship."),
        ]
        assert _format_transcript(history) == "You: Have you used AWS?\nCandidate: Yes, at my internship."


class TestFlattenContent:
    def test_includes_name_summary_and_skills(self):
        content = {
            "basic_info": {"full_name": "Jane Doe"},
            "summary": {"text": "A summary."},
            "skills": {"groups": [{"id": "s1", "category": "Languages", "items": ["Python", "SQL"]}]},
        }
        flat = flatten_resume_content(content)
        assert "Name: Jane Doe" in flat
        assert "Summary:\nA summary." in flat
        assert "- Languages: Python, SQL" in flat

    def test_formats_work_experience_entries(self):
        content = {
            "basic_info": {},
            "work_experience": [
                {
                    "position": "Engineer",
                    "company": "Acme",
                    "start_date": "2020",
                    "end_date": "2022",
                    "description": "Built things.",
                }
            ],
        }
        assert "- Engineer at Acme (2020 - 2022): Built things." in flatten_resume_content(content)

    def test_omits_empty_sections_entirely(self):
        # An empty resume shouldn't produce dangling "Work Experience:" / "Skills:" headers with
        # nothing under them - the model would have nothing to ground a response in.
        flat = flatten_resume_content({"basic_info": {}})
        assert "Work Experience" not in flat
        assert "Skills" not in flat
        assert "Education" not in flat
        assert "Projects" not in flat

    def test_tolerates_missing_optional_fields(self):
        content = {
            "basic_info": {},
            "work_experience": [{"position": None, "company": None, "description": None}],
        }
        assert "at" in flatten_resume_content(content)
