import os
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "desktop_app"))
os.environ["STI_LOCATOR_ENV"] = "local"
os.environ["STI_LOCATOR_DESKTOP_CLIENT"] = "device"

from firebase_config import get_current_environment, get_data  # noqa: E402


def main():
    room = get_data("rooms/local_room_101") or {}

    if get_current_environment() != "local":
        raise RuntimeError("Python desktop adapter did not select local mode.")
    if room.get("room_name") != "Local Room 101":
        raise RuntimeError("Expected the seeded local room.")

    print(f"Authenticated Python local database check passed: {room['room_name']}.")


if __name__ == "__main__":
    main()
