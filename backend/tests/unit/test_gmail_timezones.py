"""Timezone handling for datetimes the email classifier extracts.

An email saying "your interview is at 3pm on Tuesday" carries no offset, so `event_at` comes back
naive. Storing that naive value in a `timestamptz` column made Postgres read it as UTC, which
shifted every Gmail-derived interview by the user's whole UTC offset - the "interview time is
wrong" bug. These pin the interpretation so it cannot regress.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.services.gmail_service import _parse_iso, _resolve_timezone

KL = ZoneInfo("Asia/Kuala_Lumpur")  # UTC+8, no DST - the reported case


class TestParseIso:
    def test_naive_value_is_read_in_the_supplied_zone(self):
        parsed = _parse_iso("2026-08-18T15:00:00", KL)
        assert parsed == datetime(2026, 8, 18, 15, 0, tzinfo=KL)
        # The whole point: 3pm in KL is 07:00 UTC, not 15:00 UTC.
        assert parsed.astimezone(timezone.utc).hour == 7

    def test_explicit_offset_is_respected_not_overridden(self):
        parsed = _parse_iso("2026-08-18T15:00:00+02:00", KL)
        assert parsed.utcoffset().total_seconds() == 2 * 3600

    def test_trailing_z_is_utc(self):
        parsed = _parse_iso("2026-08-18T15:00:00Z", KL)
        assert parsed == datetime(2026, 8, 18, 15, 0, tzinfo=timezone.utc)

    def test_defaults_to_utc_when_no_zone_is_supplied(self):
        assert _parse_iso("2026-08-18T15:00:00").utcoffset().total_seconds() == 0

    def test_returns_none_for_missing_or_unparseable_values(self):
        assert _parse_iso(None, KL) is None
        assert _parse_iso("", KL) is None
        assert _parse_iso("next Tuesday afternoon", KL) is None

    def test_date_only_values_still_land_in_the_local_zone(self):
        # The classifier returns a bare date for deadlines fairly often.
        parsed = _parse_iso("2026-08-18", KL)
        assert parsed == datetime(2026, 8, 18, 0, 0, tzinfo=KL)

    def test_always_returns_an_aware_datetime(self):
        # A naive value reaching the database is the actual defect; nothing may slip through.
        for value in ["2026-08-18T15:00:00", "2026-08-18", "2026-08-18T15:00:00Z"]:
            assert _parse_iso(value, KL).tzinfo is not None


class TestResolveTimezone:
    def test_resolves_a_valid_iana_name(self):
        assert _resolve_timezone("Asia/Kuala_Lumpur") == KL

    def test_falls_back_to_utc_for_unknown_or_missing_names(self):
        # A bad value from the client must never take a whole sync down.
        assert _resolve_timezone(None) is timezone.utc
        assert _resolve_timezone("") is timezone.utc
        assert _resolve_timezone("Mars/Olympus_Mons") is timezone.utc
        assert _resolve_timezone("not a zone at all") is timezone.utc
