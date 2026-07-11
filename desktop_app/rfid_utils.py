import os
import subprocess
import threading
import time

def default_reader_config():
    return {
        "mode": "keyboard",
        "device_id": "keyboard",
        "label": "Keyboard / HID RFID reader",
        "baudrate": 9600,
    }


def load_reader_config():
    return auto_detect_reader()


def _list_serial_ports():
    try:
        from serial.tools import list_ports
    except Exception:
        return _list_windows_serial_ports()

    readers = []
    for port in list_ports.comports():
        label = f"{port.device} - {port.description}"
        readers.append({
            "mode": "serial",
            "device_id": port.device,
            "label": label,
            "baudrate": 9600,
        })
    return readers


def _list_windows_serial_ports():
    if os.name != "nt":
        return []

    command = (
        "Get-CimInstance Win32_SerialPort | "
        "Select-Object DeviceID,Name | "
        "ForEach-Object { \"$($_.DeviceID)|$($_.Name)\" }"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", command],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except Exception:
        return []

    readers = []
    for line in result.stdout.splitlines():
        if "|" not in line:
            continue
        device_id, name = [part.strip() for part in line.split("|", 1)]
        if not device_id:
            continue
        readers.append({
            "mode": "serial",
            "device_id": device_id,
            "label": f"{device_id} - {name or 'Serial RFID reader'}",
            "baudrate": 9600,
        })
    return readers or _list_windows_mode_ports()


def _list_windows_mode_ports():
    if os.name != "nt":
        return []

    try:
        result = subprocess.run(["cmd", "/c", "mode"], capture_output=True, text=True, timeout=5)
    except Exception:
        return []

    readers = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line.upper().startswith("STATUS FOR DEVICE COM"):
            continue
        device_id = line.replace("Status for device", "").replace(":", "").strip().upper()
        if device_id:
            readers.append({
                "mode": "serial",
                "device_id": device_id,
                "label": f"{device_id} - Serial RFID reader",
                "baudrate": 9600,
            })
    return readers


def _list_windows_hid_devices():
    if os.name != "nt":
        return []

    command = (
        "Get-PnpDevice -PresentOnly | "
        "Where-Object { $_.Class -in @('Keyboard','HIDClass') -and "
        "($_.FriendlyName -match 'RFID|Reader|Keyboard|HID|USB') } | "
        "Select-Object -First 20 -ExpandProperty FriendlyName"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", command],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except Exception:
        return []

    readers = []
    for index, name in enumerate(result.stdout.splitlines()):
        name = name.strip()
        if not name:
            continue
        readers.append({
            "mode": "keyboard",
            "device_id": f"hid_{index}",
            "label": f"{name} (keyboard mode)",
            "baudrate": 9600,
        })
    return readers


def list_rfid_readers():
    readers = [default_reader_config()]
    readers.extend(_list_serial_ports())
    readers.extend(_list_windows_hid_devices())

    unique = {}
    for reader in readers:
        unique[(reader["mode"], reader["device_id"])] = reader
    return list(unique.values())


def auto_detect_reader():
    readers = list_rfid_readers()
    serial_reader = next((reader for reader in readers if reader.get("mode") == "serial"), None)
    return serial_reader or default_reader_config()


def reader_label(reader):
    if not reader:
        return default_reader_config()["label"]
    return reader.get("label") or reader.get("device_id") or default_reader_config()["label"]


def is_probable_rfid_scan(value):
    scan = str(value or "").strip()
    if len(scan) < 3:
        return False

    lowered = scan.lower()
    ignored_words = ("demo", "reader", "gizmo", "rfid reader", "ready")
    if any(word in lowered for word in ignored_words):
        return False

    compact = "".join(ch for ch in scan if ch.isalnum())
    return len(compact) >= 3


def normalize_rfid_value(value):
    scan = str(value or "").strip()
    if ":" in scan:
        scan = scan.rsplit(":", 1)[1].strip()

    parts = ["".join(ch for ch in part if ch.isalnum()) for part in scan.split()]
    parts = [part for part in parts if part]
    if parts:
        numeric_parts = [part for part in parts if any(ch.isdigit() for ch in part)]
        selected = max(numeric_parts or parts, key=len)
    else:
        selected = "".join(ch for ch in scan if ch.isalnum())

    return selected.lower()


class SerialRfidListener:
    def __init__(self, config, on_scan, on_error=None):
        self.config = config or {}
        self.on_scan = on_scan
        self.on_error = on_error
        self._stop_event = threading.Event()
        self._thread = None
        self._serial = None
        self._last_scan = ""
        self._last_scan_time = 0

    def start(self):
        if self.config.get("mode") != "serial":
            return
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._listen, daemon=True)
        self._thread.start()

    def is_running(self):
        return bool(self._thread and self._thread.is_alive())

    def stop(self):
        self._stop_event.set()
        try:
            if self._serial:
                self._serial.close()
        except Exception:
            pass

    def _listen(self):
        try:
            import serial
        except Exception:
            if self.on_error:
                self.on_error("Serial RFID mode requires pyserial. Install it with: python -m pip install pyserial")
            return

        port = self.config.get("device_id")
        baudrate = int(self.config.get("baudrate") or 9600)
        if not port:
            if self.on_error:
                self.on_error("No serial RFID port selected.")
            return

        try:
            self._serial = serial.Serial(port, baudrate=baudrate, timeout=0.05)
            buffer = ""
            last_data_time = None
            while not self._stop_event.is_set():
                raw = self._serial.read(64)
                if not raw:
                    if buffer and last_data_time and time.time() - last_data_time >= 0.08:
                        self._emit_scan(buffer)
                        buffer = ""
                        last_data_time = None
                    time.sleep(0.05)
                    continue
                text = raw.decode("utf-8", errors="ignore")
                buffer += text
                last_data_time = time.time()
                if "\n" in buffer or "\r" in buffer:
                    parts = buffer.replace("\r", "\n").split("\n")
                    buffer = parts.pop()
                    for part in parts:
                        self._emit_scan(part)
        except Exception as error:
            if self.on_error:
                self.on_error(f"RFID reader error: {error}")

    def _emit_scan(self, value):
        scan = str(value or "").strip()
        normalized_scan = normalize_rfid_value(scan)
        now = time.monotonic()
        if not is_probable_rfid_scan(scan):
            return
        if normalized_scan == self._last_scan and now - self._last_scan_time < 2.0:
            return
        self._last_scan = normalized_scan
        self._last_scan_time = now
        self.on_scan(scan)
