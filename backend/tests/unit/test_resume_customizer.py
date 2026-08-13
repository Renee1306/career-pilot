"""The pure helpers around resume_customizer's two LLM calls (evaluate_match/customize_content -
left to real E2E testing, per the "mock the agent boundary" scope). These three specifically
guard against regressions in bugs PROJECT_CONTEXT.md documents as already having been hit once."""

from app.agents.resume_customizer import _entry_label, _flatten_content, _strip_echoed_header


class TestEntryLabel:
    def test_uses_position_and_company_when_both_present(self):
        entry = {"position": "Backend Engineer", "company": "Acme"}
        assert _entry_label(entry) == "Backend Engineer at Acme"

    def test_falls_back_to_position_only(self):
        assert _entry_label({"position": "Backend Engineer", "company": ""}) == "Backend Engineer"

    def test_falls_back_to_company_only(self):
        assert _entry_label({"position": "", "company": "Acme"}) == "Acme"

    def test_falls_back_to_generic_label_when_both_missing(self):
        assert _entry_label({"position": "", "company": ""}) == "Work experience"

    def test_strips_whitespace(self):
        entry = {"position": "  Engineer  ", "company": "  Acme  "}
        assert _entry_label(entry) == "Engineer at Acme"


class TestFlattenContent:
    def test_includes_name_summary_and_skills(self):
        content = {
            "basic_info": {"full_name": "Jane Doe"},
            "summary": {"text": "A summary."},
            "skills": {"items": ["Python", "SQL"]},
        }
        flat = _flatten_content(content)
        assert "Name: Jane Doe" in flat
        assert "Summary:\nA summary." in flat
        assert "Skills: Python, SQL" in flat

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
        flat = _flatten_content(content)
        assert "- Engineer at Acme (2020 - 2022): Built things." in flat

    def test_omits_empty_sections_entirely(self):
        # An empty resume shouldn't produce dangling "Work Experience:" / "Skills:" headers
        # with nothing under them - the model would have nothing to ground a response in.
        flat = _flatten_content({"basic_info": {}})
        assert "Work Experience" not in flat
        assert "Skills" not in flat
        assert "Education" not in flat
        assert "Projects" not in flat

    def test_tolerates_missing_optional_fields(self):
        content = {
            "basic_info": {},
            "work_experience": [{"position": None, "company": None, "description": None}],
        }
        # Should not raise on None values that a partially-filled-in document can have.
        flat = _flatten_content(content)
        assert "at" in flat


class TestStripEchoedHeader:
    def test_strips_a_genuinely_echoed_header(self):
        entry = {"position": "Engineer", "company": "Acme"}
        text = "Engineer at Acme (2020 - 2022): Built a thing and shipped it."
        assert _strip_echoed_header(text, entry) == "Built a thing and shipped it."

    def test_leaves_legitimate_colon_content_alone(self):
        # A real description containing a colon (e.g. "Key result: shipped X") must survive -
        # the function only strips when the leading segment really is this entry's own header.
        entry = {"position": "Engineer", "company": "Acme"}
        text = "Key result: reduced latency by 40%."
        assert _strip_echoed_header(text, entry) == text

    def test_leaves_text_alone_when_header_belongs_to_a_different_entry(self):
        entry = {"position": "Engineer", "company": "Acme"}
        text = "Product Manager at Globex: did other things."
        assert _strip_echoed_header(text, entry) == text

    def test_leaves_text_alone_when_entry_has_no_position_or_company(self):
        entry = {"position": "", "company": ""}
        text = "Something: happened."
        assert _strip_echoed_header(text, entry) == text

    def test_falls_back_to_original_text_if_stripped_result_is_empty(self):
        entry = {"position": "Engineer", "company": "Acme"}
        text = "Engineer at Acme: "
        assert _strip_echoed_header(text, entry) == text
