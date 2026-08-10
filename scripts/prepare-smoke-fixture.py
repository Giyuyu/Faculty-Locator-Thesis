import os
import sys
import threading
from datetime import datetime, timedelta
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DESKTOP_APP = PROJECT_ROOT / "desktop_app"
os.environ["STI_LOCATOR_ENV"] = "local"
sys.path.insert(0, str(DESKTOP_APP))

from firebase_config import get_data, set_data  # noqa: E402
from login import LoginSystem  # noqa: E402


FACULTY_ID = "NVSLOCALF"
UPLOAD_ID = "smoke_upload_active"
SCHEDULE_ID = "smoke_schedule_active"
SUBJECT_ID = "smoke_subject"
SCHEDULED_ROOM_ID = "smoke_room_202"
LOGIN_ROOM_ID = "local_room_101"
SESSION_ID = "smoke_session_active"


def iso_now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def main():
    now = datetime.now()
    start_time = (now - timedelta(minutes=10)).strftime("%I:%M %p").lstrip("0")
    end_time = (now + timedelta(minutes=50)).strftime("%I:%M %p").lstrip("0")
    uploaded_at = iso_now()

    faculty = get_data(f"faculties/{FACULTY_ID}")
    if not faculty:
        raise RuntimeError("Local faculty account was not seeded.")

    set_data(
        f"subjects/{SUBJECT_ID}",
        {
            "subject_id": SUBJECT_ID,
            "subject_code": "AUTO101",
            "subject_name": "Automation Systems",
        },
    )
    set_data(
        f"rooms/{SCHEDULED_ROOM_ID}",
        {
            "room_id": SCHEDULED_ROOM_ID,
            "room_name": "Scheduled Room 202",
            "building": "Local Campus",
            "floor": "2nd Floor",
            "room_status": "Available",
        },
    )
    set_data(
        f"schedule_uploads/{UPLOAD_ID}",
        {
            "upload_id": UPLOAD_ID,
            "school_year": "2026-2027",
            "term": "1st Term",
            "schedule_count": 1,
            "status": "active",
            "uploaded_at": uploaded_at,
            "uploaded_by": "local-smoke-test",
        },
    )
    set_data(
        f"schedule_upload_index/{UPLOAD_ID}",
        {
            "upload_id": UPLOAD_ID,
            "status": "active",
            "uploaded_at": uploaded_at,
        },
    )
    schedule = {
        "schedule_id": SCHEDULE_ID,
        "faculty_id": FACULTY_ID,
        "subject_id": SUBJECT_ID,
        "room_id": SCHEDULED_ROOM_ID,
        "room_name": "Scheduled Room 202",
        "day": now.strftime("%A"),
        "start_time": start_time,
        "end_time": end_time,
        "section": "SMOKE-01",
        "term": "1st Term",
        "school_year": "2026-2027",
        "status": "active",
        "import_batch_id": UPLOAD_ID,
        "original_import_batch_id": UPLOAD_ID,
        "imported_at": uploaded_at,
    }
    set_data(f"schedules/{SCHEDULE_ID}", schedule)

    desktop = LoginSystem.__new__(LoginSystem)
    desktop.cache_lock = threading.Lock()
    desktop.data_cache = {"schedules": {SCHEDULE_ID: schedule}}
    matched_schedule = desktop.get_current_schedule(FACULTY_ID, LOGIN_ROOM_ID)
    if not matched_schedule or matched_schedule.get("schedule_id") != SCHEDULE_ID:
        raise AssertionError("Desktop login did not resolve the active faculty schedule.")

    set_data(
        f"faculty_login_sessions/{SESSION_ID}",
        {
            "session_id": SESSION_ID,
            "faculty_id": FACULTY_ID,
            "device_id": "smoke_device",
            "room_id": LOGIN_ROOM_ID,
            "schedule_id": SCHEDULE_ID,
            "login_time": uploaded_at,
            "logout_time": "",
            "session_status": "In-Class",
        },
    )
    set_data(
        f"faculty_status/{FACULTY_ID}",
        {
            "status_id": FACULTY_ID,
            "faculty_id": FACULTY_ID,
            "current_status": "In-Class",
            "current_room_id": LOGIN_ROOM_ID,
            "current_subject_id": SUBJECT_ID,
            "schedule_id": SCHEDULE_ID,
            "previous_room_id": "",
            "previous_subject_id": "",
            "last_login_time": uploaded_at,
            "last_logout_time": "",
            "updated_date": uploaded_at,
        },
    )

    print(
        "Desktop fixture passed: active class resolved by faculty/time; "
        "live room overridden to Local Room 101."
    )


if __name__ == "__main__":
    main()
