"""Every resume already in the database predates skill categories and is stored as a flat list of
strings. `SkillsSection` upgrades that shape on read, so these cases are what stands between a
saved resume and its skills section silently emptying out.
"""

from app.models.resume_document_model import ResumeContent, SkillsSection


class TestLegacyUpgrade:
    def test_splits_a_category_prefixed_string_into_a_real_group(self):
        section = SkillsSection.model_validate({"items": ["Programming Languages: Python, C, Java"]})
        assert len(section.groups) == 1
        assert section.groups[0].category == "Programming Languages"
        assert section.groups[0].items == ["Python", "C", "Java"]

    def test_collects_uncategorised_skills_into_one_group(self):
        section = SkillsSection.model_validate({"items": ["Python", "SQL", "Docker"]})
        assert len(section.groups) == 1
        assert section.groups[0].category == ""
        assert section.groups[0].items == ["Python", "SQL", "Docker"]

    def test_handles_a_mix_of_both(self):
        section = SkillsSection.model_validate({"items": ["Cloud: Azure, AWS", "Figma"]})
        assert [(g.category, g.items) for g in section.groups] == [
            ("Cloud", ["Azure", "AWS"]),
            ("", ["Figma"]),
        ]

    def test_leaves_a_long_prefix_alone(self):
        # A sentence that happens to contain a colon is a skill, not a category label.
        long_prefix = "Built a thing that does X and Y and Z and several other things: done"
        section = SkillsSection.model_validate({"items": [long_prefix]})
        assert section.groups[0].category == ""
        assert section.groups[0].items == [long_prefix]

    def test_ignores_blank_and_non_string_entries(self):
        section = SkillsSection.model_validate({"items": ["Python", "", "   ", None, 7]})
        assert section.groups[0].items == ["Python"]

    def test_empty_legacy_list_produces_no_groups(self):
        assert SkillsSection.model_validate({"items": []}).groups == []

    def test_category_with_no_items_is_not_a_group(self):
        section = SkillsSection.model_validate({"items": ["Cloud:"]})
        assert [(g.category, g.items) for g in section.groups] == [("", ["Cloud:"])]

    def test_gives_every_upgraded_group_a_distinct_id(self):
        section = SkillsSection.model_validate({"items": ["Cloud: Azure", "Design: Figma"]})
        ids = [g.id for g in section.groups]
        assert len(set(ids)) == len(ids)
        assert all(ids)


class TestNewShapePassesThrough:
    def test_groups_are_left_untouched(self):
        payload = {"groups": [{"id": "s1", "category": "Cloud", "items": ["Azure"]}]}
        section = SkillsSection.model_validate(payload)
        assert section.groups[0].id == "s1"
        assert section.groups[0].items == ["Azure"]

    def test_groups_win_when_both_shapes_are_present(self):
        # A document mid-migration must not get its upgraded groups clobbered by the stale list.
        payload = {"groups": [{"id": "s1", "category": "Cloud", "items": ["Azure"]}], "items": ["Old"]}
        section = SkillsSection.model_validate(payload)
        assert [g.category for g in section.groups] == ["Cloud"]

    def test_missing_skills_section_defaults_to_empty(self):
        assert ResumeContent().skills.groups == []


class TestWholeDocumentUpgrade:
    def test_a_legacy_document_round_trips_through_resume_content(self):
        content = ResumeContent.model_validate(
            {"basic_info": {"full_name": "Jane"}, "skills": {"items": ["Cloud: Azure, AWS"]}}
        )
        assert [(g.category, g.items) for g in content.skills.groups] == [("Cloud", ["Azure", "AWS"])]
        # And serialises in the new shape, so the next save persists the upgrade.
        assert "groups" in content.model_dump()["skills"]
        assert "items" not in content.model_dump()["skills"]
