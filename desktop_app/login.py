import tkinter as tk
from tkinter import messagebox
from tkinter import ttk
import base64
from device_utils import DeviceManager
from firebase_config import get_current_environment, get_data, set_data, update_data
from rfid_utils import SerialRfidListener, load_reader_config, normalize_rfid_value, reader_label
import datetime
from pathlib import Path
import re
import time
import threading

def sanitize_id(value):
    safe = re.sub(r'[^a-zA-Z0-9]+', '_', str(value or '').strip().lower()).strip('_')
    return safe or f'id_{int(datetime.datetime.now().timestamp())}'

def normalize_key(value):
    return re.sub(r'[^a-zA-Z0-9]+', '', str(value or '').strip().lower())

def normalize_day_name(day_str):
    """Normalize day abbreviations to full day names, handling multiple days"""
    days = []
    day_map = {
        'MONDAY': 'Monday', 'MON': 'Monday', 'M': 'Monday',
        'TUESDAY': 'Tuesday', 'TUE': 'Tuesday', 'TU': 'Tuesday', 'T': 'Tuesday',
        'WEDNESDAY': 'Wednesday', 'WED': 'Wednesday', 'W': 'Wednesday',
        'THURSDAY': 'Thursday', 'THU': 'Thursday', 'THUR': 'Thursday', 'TH': 'Thursday',
        'FRIDAY': 'Friday', 'FRI': 'Friday', 'F': 'Friday',
        'SATURDAY': 'Saturday', 'SAT': 'Saturday', 'SA': 'Saturday',
        'SUNDAY': 'Sunday', 'SUN': 'Sunday', 'SU': 'Sunday'
    }
    compact = re.sub(r'[^A-Z]+', '', str(day_str or '').upper())
    compact_map = {
        'TTH': ['Tuesday', 'Thursday'],
        'TUTH': ['Tuesday', 'Thursday'],
        'TUESTHURS': ['Tuesday', 'Thursday'],
        'MWF': ['Monday', 'Wednesday', 'Friday'],
        'MW': ['Monday', 'Wednesday'],
    }
    if compact in compact_map:
        return compact_map[compact]

    # Split by common separators
    normalized_day_str = re.sub(r'\band\b', ',', str(day_str or ''), flags=re.IGNORECASE)
    for part in re.split(r'[,/&+\-]+|\s{2,}', normalized_day_str):
        part = part.strip().upper()
        normalized = day_map.get(part, day_map.get(part[:3], part))
        if normalized:
            days.append(normalized)
    return days if days else [day_str.strip()]

class LoginSystem:
    def __init__(self):
        self.device_manager = DeviceManager()
        self.current_device_info = self.device_manager.get_device_info()
        self.current_device_id = self.device_manager.build_device_id(self.current_device_info) if self.current_device_info else None
        self.current_faculty_id = None
        self.current_session_id = None
        self.input_mode = None
        self.rfid_reader_config = load_reader_config()
        self.rfid_listener = None
        self.rfid_key_timer = None
        self.login_in_progress = False
        self.last_scan_value = ''
        self.last_scan_time = 0
        self.data_cache = {
            'faculties': {},
            'devices': {},
            'rooms': {},
            'schedules': {},
            'faculty_status': {},
            'faculty_login_sessions': {},
        }
        self.cache_ready = False
        self.cache_refresh_in_progress = False
        self.cache_lock = threading.Lock()
        self.setup_gui()
        self.load_room_assignment()
        self.start_rfid_listener()
        self.refresh_login_cache_async(initial=True)
        self.root.after(3000, self.periodic_login_cache_refresh)
        self.root.after(3000, self.refresh_rfid_detection)
    
    def setup_gui(self):
        """Build the modern faculty terminal interface."""
        self.root = tk.Tk()
        environment = get_current_environment().upper()
        self.root.title(f"STI Locator - Faculty Access [{environment}]")
        self.root.geometry("720x680")
        self.root.minsize(640, 620)
        self.root.configure(bg='#f3f6fc')
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        self.root.grid_columnconfigure(0, weight=1)
        self.root.grid_rowconfigure(1, weight=1)

        header = tk.Frame(self.root, bg='#102a56', height=120)
        header.grid(row=0, column=0, sticky='ew')
        header.grid_propagate(False)
        header.grid_columnconfigure(1, weight=1)

        logo_path = Path(__file__).resolve().parent.parent / 'public' / 'sti_logo.png'
        logo_data = base64.b64encode(logo_path.read_bytes())
        self.sti_logo_image = tk.PhotoImage(data=logo_data).subsample(18, 18)
        tk.Label(
            header, image=self.sti_logo_image, bg='#102a56', borderwidth=0,
        ).grid(row=0, column=0, rowspan=2, padx=(34, 20), pady=22)
        tk.Label(
            header, text="Faculty Access", font=('Arial', 22, 'bold'),
            bg='#102a56', fg='white',
        ).grid(row=0, column=1, sticky='sw', pady=(23, 0))
        tk.Label(
            header, text="STI Locator desktop terminal", font=('Arial', 10),
            bg='#102a56', fg='#c9d7ee',
        ).grid(row=1, column=1, sticky='nw', pady=(2, 23))
        tk.Label(
            header, text=environment, font=('Arial', 9, 'bold'), bg='#214675',
            fg='white', padx=14, pady=7,
        ).grid(row=0, column=2, rowspan=2, padx=(10, 34))

        content = tk.Frame(self.root, bg='#f3f6fc')
        content.grid(row=1, column=0, sticky='nsew', padx=34, pady=22)
        content.grid_columnconfigure(0, weight=1)

        room_card = tk.Frame(content, bg='white', highlightbackground='#dce3ef', highlightthickness=1)
        room_card.grid(row=0, column=0, sticky='ew', pady=(0, 16))
        room_card.grid_columnconfigure(1, weight=1)
        tk.Label(
            room_card, text="ASSIGNED ROOM", font=('Arial', 9, 'bold'),
            bg='white', fg='#667085',
        ).grid(row=0, column=0, sticky='w', padx=22, pady=(17, 4))

        self.room_var = tk.StringVar(self.root)
        self.room_display = tk.Label(
            room_card, textvariable=self.room_var, font=('Arial', 19, 'bold'),
            bg='white', fg='#101828', anchor='w', padx=8, pady=3,
        )
        self.room_display.grid(row=1, column=0, sticky='w', padx=14)
        refresh_button = tk.Button(
            room_card, text="Refresh", command=self.refresh_room_assignment,
            bg='#eef4ff', fg='#175cd3', activebackground='#dbe8ff',
            activeforeground='#175cd3', font=('Arial', 9, 'bold'), relief='flat',
            cursor='hand2', padx=16, pady=8,
        )
        refresh_button.grid(row=0, column=2, rowspan=2, padx=22)
        self.create_tooltip(refresh_button, "Refresh room assignment from database")

        self.status_var = tk.StringVar(self.root)
        self.status_label = tk.Label(
            room_card, textvariable=self.status_var, font=('Arial', 9),
            bg='white', fg='#667085',
        )
        self.status_label.grid(row=2, column=0, columnspan=3, sticky='w', padx=22, pady=(3, 17))

        access_card = tk.Frame(content, bg='white', highlightbackground='#dce3ef', highlightthickness=1)
        access_card.grid(row=1, column=0, sticky='ew')
        access_card.grid_columnconfigure(0, weight=1)
        tk.Label(
            access_card, text="Sign in to this room", font=('Arial', 17, 'bold'),
            bg='white', fg='#101828',
        ).grid(row=0, column=0, sticky='w', padx=24, pady=(20, 4))
        tk.Label(
            access_card, text="Scan your RFID card or enter your assigned Faculty ID.",
            font=('Arial', 10), bg='white', fg='#667085',
        ).grid(row=1, column=0, sticky='w', padx=24, pady=(0, 16))

        self.input_mode = tk.StringVar(self.root, value='rfid')
        self.input_label_var = tk.StringVar(self.root, value="RFID SCANNER")
        self.input_help_var = tk.StringVar(self.root, value=self.get_rfid_help_text())
        tk.Label(
            access_card, textvariable=self.input_label_var, font=('Arial', 9, 'bold'),
            bg='white', fg='#344054',
        ).grid(row=2, column=0, sticky='w', padx=24, pady=(0, 7))

        entry_style = {
            'font': ('Arial', 13), 'relief': 'flat', 'highlightbackground': '#cfd8e6',
            'highlightcolor': '#246bfe', 'highlightthickness': 1,
        }
        self.faculty_id_entry = tk.Entry(
            access_card, bg='#f9fafb', fg='#101828', insertbackground='#101828', **entry_style,
        )
        self.faculty_id_entry.grid(row=3, column=0, sticky='ew', padx=24, ipady=11)
        self.faculty_id_entry.bind('<Return>', self.handle_identifier_submit)
        self.faculty_id_entry.bind('<KeyRelease>', self.handle_identifier_key_release)
        self.faculty_id_entry.grid_remove()

        self.scan_status_entry = tk.Entry(
            access_card, textvariable=self.input_help_var, justify='center', state='readonly',
            readonlybackground='#f2f7ff', fg='#175cd3', **entry_style,
        )
        self.scan_status_entry.grid(row=3, column=0, sticky='ew', padx=24, ipady=11)
        self.input_help_label = tk.Label(
            access_card, textvariable=self.input_help_var, font=('Arial', 9),
            bg='white', fg='#667085', wraplength=570, justify='left',
        )
        self.input_help_label.grid(row=4, column=0, sticky='w', padx=24, pady=(7, 0))
        self.input_help_label.grid_remove()

        self.manual_mode_button = tk.Button(
            access_card, text="Enter Faculty ID manually", command=self.enable_manual_input,
            bg='white', fg='#175cd3', activebackground='white', activeforeground='#004eeb',
            font=('Arial', 9, 'bold'), relief='flat', cursor='hand2',
        )
        self.manual_mode_button.grid(row=5, column=0, sticky='w', padx=18, pady=(7, 13))

        button_frame = tk.Frame(access_card, bg='white')
        button_frame.grid(row=6, column=0, sticky='ew', padx=24, pady=(0, 11))
        button_frame.grid_columnconfigure((0, 1), weight=1)
        self.login_button = tk.Button(
            button_frame, text="Log In", command=self.login, bg='#1769ff', fg='white',
            activebackground='#0756df', activeforeground='white', font=('Arial', 11, 'bold'),
            relief='flat', cursor='hand2', pady=11,
        )
        self.login_button.grid(row=0, column=0, sticky='ew', padx=(0, 6))
        self.logout_button = tk.Button(
            button_frame, text="Log Out", command=self.logout, bg='#fff1f0', fg='#b42318',
            activebackground='#fee4e2', activeforeground='#b42318', font=('Arial', 11, 'bold'),
            relief='flat', cursor='hand2', pady=11,
        )
        self.logout_button.grid(row=0, column=1, sticky='ew', padx=(6, 0))

        self.current_user_label = tk.Label(
            access_card, text="", font=('Arial', 10, 'bold'), bg='white', fg='#067647',
        )
        self.current_user_label.grid(row=7, column=0, pady=(0, 18))
        self.root.after(300, self.focus_identifier_input)

    def setup_gui_legacy(self):
        """Setup the login GUI"""
        self.root = tk.Tk()
        environment = get_current_environment().upper()
        self.root.title(f"Faculty Login System [{environment}]")
        self.root.geometry("540x500")
        self.root.configure(bg='#e0f7fa')
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        
        self.root.grid_rowconfigure(0, weight=1)
        self.root.grid_rowconfigure(8, weight=1)
        self.root.grid_columnconfigure(0, weight=1)
        self.root.grid_columnconfigure(1, weight=1)
        
        # Title
        title_label = tk.Label(self.root, text="Faculty Login System",
                              font=('Arial', 16, 'bold'), bg='#e0f7fa')
        title_label.grid(row=0, column=0, columnspan=2, pady=(30,20))
        env_label = tk.Label(self.root, text=f"Environment: {environment}",
                             font=('Arial', 9, 'bold'), bg='#e0f7fa', fg='#607d8b')
        env_label.grid(row=0, column=0, columnspan=2, sticky='s', pady=(0, 4))
        
        # Device Info Section
        device_info_frame = tk.Frame(self.root, bg='#e0f7fa')
        device_info_frame.grid(row=1, column=0, columnspan=2, pady=(0,15))
        
        device_info = self.current_device_info
        if device_info:
            info_text = f"Device: {device_info['computer_name']} | IP: {device_info['ip_address']}"
            device_label = tk.Label(device_info_frame, text=info_text,
                                   font=('Arial', 9), bg='#e0f7fa', fg='#666')
            device_label.pack()
        
        # Room Assignment Section
        self.room_var = tk.StringVar(self.root)
        room_label = tk.Label(self.root, text="Assigned Room:",
                             font=('Arial', 12, 'bold'), bg='#e0f7fa')
        room_label.grid(row=2, column=0, sticky='e', padx=(20,10), pady=(10,5))

        # Room display frame with refresh button
        room_frame = tk.Frame(self.root, bg='#e0f7fa')
        room_frame.grid(row=2, column=1, padx=(10,20), pady=(10,5))

        self.room_display = tk.Label(room_frame, textvariable=self.room_var,
                                    font=('Arial', 12, 'bold'), bg='#ffffff',
                                    relief='sunken', width=15, anchor='center')
        self.room_display.pack(side=tk.LEFT)

        refresh_button = tk.Button(room_frame, text="🔄", command=self.refresh_room_assignment,
                                  width=3, height=1, bg='#FF9800', fg='white',
                                  font=('Arial', 10, 'bold'), relief='raised')
        refresh_button.pack(side=tk.LEFT, padx=(5,0))
        # Add tooltip
        self.create_tooltip(refresh_button, "Refresh room assignment from database")
        
        # Status indicator
        self.status_var = tk.StringVar(self.root)
        self.status_label = tk.Label(self.root, textvariable=self.status_var,
                                    font=('Arial', 10), bg='#e0f7fa')
        self.status_label.grid(row=3, column=0, columnspan=2, pady=(5,15))
        
        # RFID / Faculty ID Section
        self.input_mode = tk.StringVar(self.root, value='rfid')
        self.input_label_var = tk.StringVar(self.root, value="Scan RFID / ID:")
        self.input_help_var = tk.StringVar(
            self.root,
            value=self.get_rfid_help_text()
        )

        faculty_id_label = tk.Label(self.root, textvariable=self.input_label_var,
                                   font=('Arial', 12, 'bold'), bg='#e0f7fa')
        faculty_id_label.grid(row=4, column=0, sticky='e', padx=(20,10), pady=(10,5))
        
        self.faculty_id_entry = tk.Entry(self.root, width=25, font=('Arial', 12))
        self.faculty_id_entry.grid(row=4, column=1, padx=(10,20), pady=(10,5))
        self.faculty_id_entry.bind('<Return>', self.handle_identifier_submit)
        self.faculty_id_entry.bind('<KeyRelease>', self.handle_identifier_key_release)
        self.faculty_id_entry.grid_remove()

        self.scan_status_entry = tk.Entry(
            self.root,
            width=25,
            font=('Arial', 12, 'bold'),
            textvariable=self.input_help_var,
            justify='center',
            state='readonly',
            readonlybackground='#ffffff'
        )
        self.scan_status_entry.grid(row=4, column=1, padx=(10,20), pady=(10,5))

        self.input_help_label = tk.Label(self.root, textvariable=self.input_help_var,
                                         font=('Arial', 9), bg='#e0f7fa', fg='#666',
                                         wraplength=420, justify='center')
        self.input_help_label.grid(row=5, column=0, columnspan=2, padx=20, pady=(0,5))
        self.input_help_label.grid_remove()

        self.manual_mode_button = tk.Button(
            self.root,
            text="No ID card? Enter Faculty ID manually",
            command=self.enable_manual_input,
            width=30,
            height=1,
            bg='#607D8B',
            fg='white',
            font=('Arial', 9, 'bold')
        )
        self.manual_mode_button.grid(row=6, column=0, columnspan=2, pady=(0,10))
        
        # Login/Logout Button Frame
        button_frame = tk.Frame(self.root, bg='#e0f7fa')
        button_frame.grid(row=7, column=0, columnspan=2, pady=(10,10))

        # Login Button
        self.login_button = tk.Button(button_frame, text="Login", command=self.login,
                                     width=15, height=2, bg='#4CAF50', fg='white',
                                     font=('Arial', 12, 'bold'))
        self.login_button.pack(side=tk.LEFT, padx=(0,10))

        # Logout Button
        self.logout_button = tk.Button(button_frame, text="Logout", command=self.logout,
                                      width=15, height=2, bg='#f44336', fg='white',
                                      font=('Arial', 12, 'bold'))
        self.logout_button.pack(side=tk.LEFT)

        # Current User Label
        self.current_user_label = tk.Label(self.root, text="", font=('Arial', 10, 'bold'),
                                          bg='#e0f7fa', fg='#4CAF50')
        self.current_user_label.grid(row=8, column=0, columnspan=2, pady=(5,5))

        self.root.after(300, self.focus_identifier_input)
    
    def load_room_assignment(self):
        """Load and display room assignment for current device"""
        _, device_record = self.get_current_device_record()
        assigned_room = None
        if device_record and device_record.get('room_id'):
            assigned_room = self.get_room_name(device_record.get('room_id'))
        elif not self.cache_ready:
            assigned_room = self.device_manager.get_assigned_room()

        if assigned_room:
            self.room_var.set(assigned_room)
            self.status_var.set("Room assigned to this device")
            self.status_label.config(fg='#067647')
            self.room_display.config(bg='#ecfdf3', fg='#067647')
        else:
            self.room_var.set("Not assigned to a room")
            self.status_var.set("Contact an administrator to assign this device")
            self.status_label.config(fg='#b42318')
            self.room_display.config(bg='#fff1f0', fg='#b42318')

    def get_rfid_help_text(self):
        if self.rfid_reader_config.get('mode') == 'serial':
            return "Ready. Scan your ID."
        return "Ready. Scan your ID or enter Faculty ID manually."

    def start_rfid_listener(self):
        """Start background listener when the selected RFID reader is serial."""
        if self.rfid_listener:
            self.rfid_listener.stop()
            self.rfid_listener = None

        if self.rfid_reader_config.get('mode') != 'serial':
            return

        self.rfid_listener = SerialRfidListener(
            self.rfid_reader_config,
            on_scan=lambda value: self.root.after(0, lambda: self.receive_rfid_scan(value)),
            on_error=lambda message: self.root.after(0, lambda: self.show_rfid_error(message)),
        )
        self.rfid_listener.start()

    def show_rfid_error(self, message):
        self.input_help_var.set("Reader not ready. Check setup, then scan again.")

    def refresh_rfid_detection(self):
        """Auto-detect newly plugged RFID readers."""
        detected_config = load_reader_config()
        changed = (
            detected_config.get('mode') != self.rfid_reader_config.get('mode') or
            detected_config.get('device_id') != self.rfid_reader_config.get('device_id') or
            (detected_config.get('mode') == 'serial' and not (self.rfid_listener and self.rfid_listener.is_running()))
        )
        self.rfid_reader_config = detected_config
        if changed:
            self.input_help_var.set(self.get_rfid_help_text())
            self.start_rfid_listener()
        self.root.after(3000, self.refresh_rfid_detection)

    def refresh_login_cache_async(self, initial=False):
        """Refresh Firebase data in the background so scans stay fast."""
        if self.cache_refresh_in_progress:
            return
        self.cache_refresh_in_progress = True
        if initial:
            self.input_help_var.set("Loading login data...")

        thread = threading.Thread(target=self.refresh_login_cache, args=(initial,), daemon=True)
        thread.start()

    def refresh_login_cache(self, initial=False):
        try:
            refreshed = {
                'faculties': get_data("faculties") or {},
                'devices': get_data("devices") or {},
                'rooms': get_data("rooms") or {},
                'schedules': get_data("schedules") or {},
                'faculty_status': get_data("faculty_status") or {},
                'faculty_login_sessions': get_data("faculty_login_sessions") or {},
            }
            with self.cache_lock:
                self.data_cache.update(refreshed)
                self.cache_ready = True

            if initial:
                self.root.after(0, self.after_initial_cache_loaded)
            elif self.current_faculty_id:
                self.root.after(0, self.reconcile_current_session)
        except Exception:
            if initial:
                self.root.after(0, lambda: self.input_help_var.set("Unable to load login data. Check connection."))
        finally:
            self.cache_refresh_in_progress = False

    def periodic_login_cache_refresh(self):
        """Keep schedule/status data fresh without adding work to RFID scans."""
        self.refresh_login_cache_async()
        self.root.after(3000, self.periodic_login_cache_refresh)

    def cached_node(self, name):
        with self.cache_lock:
            return self.data_cache.get(name, {}) or {}

    def after_initial_cache_loaded(self):
        self.load_room_assignment()
        self.check_login_status()
        self.input_help_var.set(self.get_rfid_help_text())

    def receive_rfid_scan(self, identifier):
        """Use an RFID scan to log in or toggle the current faculty logout."""
        scan_started = time.monotonic()
        if not self.cache_ready:
            self.input_help_var.set("Loading login data. Scan again shortly.")
            return
        normalized_identifier = normalize_rfid_value(identifier)
        if not self.should_accept_scan(normalized_identifier):
            return

        if self.current_faculty_id:
            scanned_faculty = self.get_faculty_record(normalized_identifier) or {}
            scanned_faculty_id = str(scanned_faculty.get('faculty_id', '')).strip()
            if normalize_key(scanned_faculty_id) == normalize_key(self.current_faculty_id):
                self.input_help_var.set("Logging out...")
                self.root.update_idletasks()
                self.logout()
            else:
                self.input_help_var.set("Another faculty member is logged in. Scan their card to log out.")
            return

        self.input_help_var.set("Reading...")
        self.root.update_idletasks()
        self.login(normalized_identifier, scan_started=scan_started)

    def reconcile_current_session(self):
        """Clear this terminal when its session was ended from another device."""
        if not self.current_faculty_id or not self.current_session_id:
            return
        session = self.cached_node("faculty_login_sessions").get(self.current_session_id, {}) or {}
        if str(session.get('session_status', '')).strip().lower() != 'logged-out':
            return

        self.current_faculty_id = None
        self.current_session_id = None
        self.update_ui_for_logged_out()
        self.input_help_var.set("Session moved to another device. Ready for next scan.")

    def should_accept_scan(self, identifier):
        """Suppress duplicate events from the same physical RFID scan."""
        now = time.monotonic()
        if self.login_in_progress:
            return False
        if identifier == self.last_scan_value and now - self.last_scan_time < 2.0:
            return False
        self.last_scan_value = identifier
        self.last_scan_time = now
        return True

    def refresh_room_assignment(self):
        """Refresh room assignment from Firebase database"""
        try:
            # Show refreshing status
            self.status_var.set("Refreshing room assignment...")
            self.status_label.config(fg='#b54708')
            self.room_display.config(bg='#fffaeb', fg='#b54708')
            self.root.update()

            # Reload room assignment
            self.load_room_assignment()

            # Show success message briefly
            self.status_var.set("Room assignment refreshed")
            self.status_label.config(fg='#067647')
            self.root.after(2000, lambda: self.update_status_after_refresh())

        except Exception as e:
            self.status_var.set("Refresh failed")
            self.status_label.config(fg='#b42318')
            messagebox.showerror("Refresh Error", f"Failed to refresh room assignment: {str(e)}")
            self.root.after(3000, lambda: self.update_status_after_refresh())

    def update_status_after_refresh(self):
        """Update status back to normal after refresh"""
        assigned_room = self.device_manager.get_assigned_room()
        if assigned_room:
            self.status_var.set("Room assigned to this device")
            self.status_label.config(fg='#067647')
        else:
            self.status_var.set("Contact an administrator to assign this device")
            self.status_label.config(fg='#b42318')

    def focus_identifier_input(self):
        """Keep the scanner/manual input ready when the user is logged out."""
        if not self.current_faculty_id and self.input_mode.get() == 'manual':
            self.faculty_id_entry.focus_set()

    def enable_manual_input(self):
        """Switch from scan-first mode to manual Faculty ID entry."""
        self.input_mode.set('manual')
        self.input_label_var.set("FACULTY ID")
        self.input_help_var.set("Faculty IDs are entered in uppercase automatically.")
        self.manual_mode_button.config(text="Use RFID scan instead", command=self.enable_rfid_input)
        self.scan_status_entry.grid_remove()
        self.input_help_label.grid()
        self.faculty_id_entry.grid()
        self.faculty_id_entry.delete(0, tk.END)
        self.faculty_id_entry.focus_set()

    def enable_rfid_input(self):
        """Switch back to RFID scan mode."""
        self.input_mode.set('rfid')
        self.input_label_var.set("RFID SCANNER")
        self.input_help_var.set(self.get_rfid_help_text())
        self.manual_mode_button.config(
            text="Enter Faculty ID manually",
            command=self.enable_manual_input
        )
        self.faculty_id_entry.delete(0, tk.END)
        self.faculty_id_entry.grid_remove()
        self.input_help_label.grid_remove()
        self.scan_status_entry.grid()

    def handle_identifier_submit(self, event=None):
        """Handle Enter from either an RFID scanner or manual keyboard entry."""
        if self.current_faculty_id:
            return "break"
        if self.rfid_key_timer:
            self.root.after_cancel(self.rfid_key_timer)
            self.rfid_key_timer = None

        identifier = (
            normalize_rfid_value(self.faculty_id_entry.get())
            if self.input_mode.get() == 'rfid'
            else self.faculty_id_entry.get().strip().upper()
        )
        if not identifier:
            messagebox.showerror("Error", "Please scan your ID card or enter your Faculty ID")
            self.focus_identifier_input()
            return "break"

        if self.input_mode.get() == 'rfid':
            if not self.should_accept_scan(identifier):
                return "break"
            self.faculty_id_entry.delete(0, tk.END)
            self.faculty_id_entry.insert(0, identifier)

        self.login(identifier)
        return "break"

    def handle_identifier_key_release(self, event=None):
        """Auto-submit keyboard/HID RFID scans that do not send Enter."""
        if self.input_mode.get() == 'manual':
            self.uppercase_manual_identifier()
            return
        if self.input_mode.get() != 'rfid' or self.current_faculty_id:
            return
        if self.rfid_key_timer:
            self.root.after_cancel(self.rfid_key_timer)
        self.rfid_key_timer = self.root.after(180, self.capture_keyboard_rfid_login)

    def uppercase_manual_identifier(self):
        """Uppercase a manually typed Faculty ID without moving the caret."""
        current_value = self.faculty_id_entry.get()
        uppercase_value = current_value.upper()
        if current_value == uppercase_value:
            return
        cursor_position = self.faculty_id_entry.index(tk.INSERT)
        self.faculty_id_entry.delete(0, tk.END)
        self.faculty_id_entry.insert(0, uppercase_value)
        self.faculty_id_entry.icursor(min(cursor_position, len(uppercase_value)))

    def capture_keyboard_rfid_login(self):
        if self.input_mode.get() != 'rfid' or self.current_faculty_id:
            return
        identifier = normalize_rfid_value(self.faculty_id_entry.get())
        if len(identifier) < 3:
            return
        if not self.should_accept_scan(identifier):
            return
        self.faculty_id_entry.delete(0, tk.END)
        self.faculty_id_entry.insert(0, identifier)
        self.login(identifier)

    def check_login_status(self):
        """Check if any faculty is currently logged in on this device"""
        try:
            device_id, device_record = self.get_current_device_record()
            if not device_id:
                return

            sessions = self.cached_node("faculty_login_sessions")
            for session_id, session in sessions.items():
                if session.get('device_id') == device_id and session.get('session_status') != 'Logged-Out':
                    self.current_faculty_id = session.get('faculty_id')
                    self.current_session_id = session_id
                    faculty_data = self.get_faculty_record(self.current_faculty_id) or {}
                    self.update_ui_for_logged_in(self.get_faculty_name(faculty_data))
                    return
        except Exception as e:
            print(f"Error checking login status: {str(e)}")

        # No one logged in
        self.current_faculty_id = None
        self.current_session_id = None
        self.update_ui_for_logged_out()

    def update_ui_for_logged_in(self, faculty_name):
        """Update UI when faculty is logged in"""
        self.login_button.config(state='disabled')
        self.logout_button.config(state='normal')
        self.manual_mode_button.config(state='disabled')
        self.current_user_label.config(text=f"Logged in as: {faculty_name}")
        self.faculty_id_entry.delete(0, tk.END)
        self.faculty_id_entry.config(state='disabled')

    def update_ui_for_logged_out(self):
        """Update UI when no faculty is logged in"""
        self.login_button.config(state='normal')
        self.logout_button.config(state='disabled')
        self.manual_mode_button.config(state='normal')
        self.current_user_label.config(text="")
        self.faculty_id_entry.config(state='normal')
        if self.input_mode.get() == 'rfid':
            self.faculty_id_entry.grid_remove()
            self.input_help_label.grid_remove()
            self.scan_status_entry.grid()
        else:
            self.scan_status_entry.grid_remove()
            self.input_help_label.grid()
            self.faculty_id_entry.grid()
            self.root.after(100, self.focus_identifier_input)

    def create_tooltip(self, widget, text):
        """Create a tooltip for a widget"""
        def enter(event):
            self.tooltip = tk.Toplevel()
            self.tooltip.wm_overrideredirect(True)
            self.tooltip.wm_geometry(f"+{event.x_root+10}+{event.y_root+10}")

            label = tk.Label(self.tooltip, text=text, background="#ffffe0",
                           relief='solid', borderwidth=1, font=('Arial', 9))
            label.pack()

        def leave(event):
            if hasattr(self, 'tooltip'):
                self.tooltip.destroy()

        widget.bind('<Enter>', enter)
        widget.bind('<Leave>', leave)

    def get_faculty_record(self, faculty_id):
        """Get faculty record from the schema-compliant faculties node."""
        faculties = self.cached_node("faculties")
        if faculty_id in faculties:
            return faculties[faculty_id]

        normalized_input = faculty_id.strip().lower()
        normalized_scan = normalize_key(faculty_id)
        normalized_rfid = normalize_rfid_value(faculty_id)
        lookup_fields = ('faculty_id', 'rfid_id', 'rfid_uid', 'rfid', 'card_id', 'id_rfid')
        for record in faculties.values():
            for field in lookup_fields:
                record_value = str(record.get(field, '')).strip()
                if (
                    record_value.lower() == normalized_input or
                    normalize_key(record_value) == normalized_scan or
                    normalize_rfid_value(record_value) == normalized_rfid
                ):
                    return record
        return None

    def get_faculty_name(self, faculty_data):
        """Build faculty display name."""
        return " ".join(
            part for part in [
                faculty_data.get('first_name'),
                faculty_data.get('middle_name'),
                faculty_data.get('last_name')
            ] if part
        ) or faculty_data.get('email', 'Unknown')

    def get_current_device_record(self):
        """Get the current device record and assigned room ID."""
        if not self.current_device_info or not self.current_device_id:
            return None, None

        devices = self.cached_node("devices")
        device_record = devices.get(self.current_device_id)
        return self.current_device_id, device_record

    def get_room_name(self, room_id):
        rooms = self.cached_node("rooms")
        room = rooms.get(room_id) or {}
        return room.get('room_name') or room_id

    def get_status_id(self, faculty_id):
        return sanitize_id(f"status_{faculty_id}")

    def get_session_id(self, faculty_id, device_id):
        return sanitize_id(f"session_{faculty_id}_{device_id}_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}")

    def close_existing_faculty_sessions(self, faculty_id, now):
        """Prepare logout updates for active sessions on other terminals."""
        session_updates = {}
        for session_id, session in self.cached_node("faculty_login_sessions").items():
            if normalize_key(session.get('faculty_id')) != normalize_key(faculty_id):
                continue
            if str(session.get('session_status', '')).strip().lower() == 'logged-out':
                continue
            session_updates[session_id] = {
                'logout_time': now,
                'session_status': 'Logged-Out',
                'logout_reason': 'Logged in on another device',
            }
        return session_updates
    
    def login(self, identifier=None, scan_started=None):
        """Handle login process"""
        if self.login_in_progress or self.current_faculty_id:
            return

        if not self.cache_ready:
            self.input_help_var.set("Loading login data. Scan again shortly.")
            return

        self.login_in_progress = True
        faculty_id = (
            normalize_rfid_value(identifier)
            if identifier is not None
            else self.faculty_id_entry.get().strip().upper()
        )
        if identifier is not None:
            self.input_help_var.set("Reading...")
            self.root.update_idletasks()

        if not faculty_id:
            messagebox.showerror("Error", "Please scan your ID card or enter your Faculty ID")
            self.focus_identifier_input()
            self.login_in_progress = False
            return

        device_id, device_record = self.get_current_device_record()
        if not device_record or not device_record.get('room_id'):
            messagebox.showerror("Login Failed",
                               "No room assigned to this device.\n"
                               "Please contact the administrator to assign a room.")
            self.login_in_progress = False
            return
        room_id = device_record.get('room_id')
        room_name = self.get_room_name(room_id)

        try:
            faculty_data = self.get_faculty_record(faculty_id)
            if faculty_data:
                faculty_id = faculty_data.get('faculty_id', faculty_id)
                faculty_name = self.get_faculty_name(faculty_data)
                now = datetime.datetime.now().isoformat()
                current_schedule = self.get_current_schedule(faculty_id, room_id)
                session_status = 'In-Class' if current_schedule else 'Available'
                schedule_id = current_schedule.get('schedule_id', '') if current_schedule else ''
                subject_id = current_schedule.get('subject_id', '') if current_schedule else ''
                previous_status = self.cached_node("faculty_status").get(self.get_status_id(faculty_id), {}) or {}
                session_id = self.get_session_id(faculty_id, device_id)
                previous_session_updates = self.close_existing_faculty_sessions(faculty_id, now)

                session_data = {
                    'session_id': session_id,
                'faculty_id': faculty_id,
                'device_id': device_id,
                'room_id': room_id,
                'schedule_id': schedule_id,
                'subject_id': subject_id,
                'login_time': now,
                'logout_time': '',
                'session_status': session_status
                }
                status_data = {
                    'status_id': self.get_status_id(faculty_id),
                    'faculty_id': faculty_id,
                    'current_status': session_status,
                    'current_room_id': room_id,
                    'current_subject_id': subject_id,
                    'schedule_id': schedule_id,
                    'previous_room_id': previous_status.get('current_room_id', ''),
                    'previous_subject_id': previous_status.get('current_subject_id', ''),
                    'last_login_time': now,
                    'last_logout_time': previous_status.get('last_logout_time', ''),
                    'updated_date': now
                }

                self.current_faculty_id = faculty_id
                self.current_session_id = session_id
                self.update_ui_for_logged_in(faculty_name)
                self.input_help_var.set("Logged in.")
                self.root.update_idletasks()
                if scan_started is not None:
                    print(f"RFID login UI updated in {time.monotonic() - scan_started:.3f}s")

                with self.cache_lock:
                    for previous_session_id, previous_session_update in previous_session_updates.items():
                        previous_session = self.data_cache.setdefault(
                            'faculty_login_sessions', {}
                        ).setdefault(previous_session_id, {})
                        previous_session.update(previous_session_update)
                    self.data_cache.setdefault('faculty_login_sessions', {})[session_id] = session_data
                    self.data_cache.setdefault('faculty_status', {})[status_data['status_id']] = status_data

                self.sync_login_to_firebase(
                    session_id,
                    session_data,
                    status_data,
                    previous_session_updates,
                )
            else:
                if identifier is not None and self.input_mode.get() == 'rfid':
                    self.input_help_var.set("User not found. Scan again.")
                    self.faculty_id_entry.delete(0, tk.END)
                    self.focus_identifier_input()
                else:
                    messagebox.showerror("Login Failed", "Faculty ID not found in database")
        except Exception as e:
            if identifier is not None and self.input_mode.get() == 'rfid':
                self.input_help_var.set("Login failed. Scan again.")
            else:
                messagebox.showerror("Login Failed", f"Database error: {str(e)}")
        finally:
            self.login_in_progress = False

    def sync_login_to_firebase(self, session_id, session_data, status_data, previous_session_updates=None):
        def worker():
            for previous_session_id, previous_session_update in (previous_session_updates or {}).items():
                update_data(
                    f"faculty_login_sessions/{previous_session_id}",
                    previous_session_update,
                )
            set_data(f"faculty_login_sessions/{session_id}", session_data)
            set_data(f"faculty_status/{status_data['status_id']}", status_data)

        threading.Thread(target=worker, daemon=True).start()

    def get_current_schedule(self, faculty_id, room_id):
        """Get the current schedule by faculty/day/time, regardless of logged-in room."""
        try:
            now = datetime.datetime.now()
            current_day = now.strftime('%A')
            current_time = now.time()

            all_schedules_data = self.cached_node("schedules")
            if not all_schedules_data:
                return None

            for schedule in all_schedules_data.values():
                if schedule.get('faculty_id') != faculty_id:
                    continue
                schedule_days = normalize_day_name(schedule.get('day', ''))
                time_str = f"{schedule.get('start_time', '')} - {schedule.get('end_time', '')}"

                if current_day in schedule_days and self.is_current_time_in_schedule(current_time, time_str):
                    return schedule
            return None

        except Exception as e:
            return None

    def is_current_time_in_schedule(self, current_time, schedule_time_str):
        """Check if current time falls within the schedule time range"""
        try:
            # Parse time range like "8:00 AM - 10:00 AM" or single time
            if ' - ' in schedule_time_str:
                start_str, end_str = schedule_time_str.split(' - ')

                # Convert to 24-hour format for comparison
                start_time = self.parse_time_string(start_str.strip())
                end_time = self.parse_time_string(end_str.strip())

                if start_time and end_time:
                    if end_time < start_time:
                        # Spanning midnight
                        result = current_time >= start_time or current_time <= end_time
                    else:
                        result = start_time <= current_time <= end_time
                    return result

            # Check for single time (treat as end time)
            single_time = self.parse_time_string(schedule_time_str.strip())
            if single_time:
                return current_time <= single_time
            return False
        except Exception as e:
            return False

    def parse_time_string(self, time_str):
        """Parse time string like '8:00 AM' or '1:00 PM' to time object"""
        try:
            cleaned = re.sub(r'\s+', ' ', str(time_str or '').strip().upper())
            cleaned = re.sub(r'(\d)(AM|PM)$', r'\1 \2', cleaned)

            for fmt in ('%I:%M %p', '%I %p', '%H:%M', '%H'):
                try:
                    return datetime.datetime.strptime(cleaned, fmt).time()
                except ValueError:
                    continue
            return None
        except:
            return None

    def logout(self):
        """Handle logout process"""
        if not self.current_faculty_id:
            self.input_help_var.set("No active login.")
            return

        try:
            now = datetime.datetime.now().isoformat()
            session_id = self.current_session_id
            if not session_id:
                sessions = self.cached_node("faculty_login_sessions")
                for candidate_id, session in sessions.items():
                    if session.get('faculty_id') == self.current_faculty_id and session.get('session_status') != 'Logged-Out':
                        session_id = candidate_id
                        break

            if session_id:
                session_update = {
                    'logout_time': now,
                    'session_status': 'Logged-Out'
                }
                with self.cache_lock:
                    cached_session = self.data_cache.setdefault('faculty_login_sessions', {}).setdefault(session_id, {})
                    cached_session.update(session_update)

            status_id = self.get_status_id(self.current_faculty_id)
            previous_status = self.cached_node("faculty_status").get(status_id, {}) or {}
            status_update = {
                'status_id': self.get_status_id(self.current_faculty_id),
                'faculty_id': self.current_faculty_id,
                'current_status': 'Offline',
                'current_room_id': '',
                'current_subject_id': '',
                'previous_room_id': previous_status.get('current_room_id', ''),
                'previous_subject_id': previous_status.get('current_subject_id', ''),
                'last_login_time': previous_status.get('last_login_time', ''),
                'last_logout_time': now,
                'updated_date': now
            }
            with self.cache_lock:
                self.data_cache.setdefault('faculty_status', {})[status_id] = status_update

            faculty_data = self.get_faculty_record(self.current_faculty_id) or {}
            faculty_name = self.get_faculty_name(faculty_data)

            # Update UI
            self.current_faculty_id = None
            self.current_session_id = None
            self.update_ui_for_logged_out()
            self.input_help_var.set("Ready. Scan your ID.")
            self.root.update_idletasks()

            self.sync_logout_to_firebase(session_id, session_update if session_id else None, status_id, status_update)

        except Exception as e:
            self.input_help_var.set("Logout failed. Try again.")

    def sync_logout_to_firebase(self, session_id, session_update, status_id, status_update):
        def worker():
            if session_id and session_update:
                update_data(f"faculty_login_sessions/{session_id}", session_update)
            update_data(f"faculty_status/{status_id}", status_update)

        threading.Thread(target=worker, daemon=True).start()
    
    def run(self):
        """Start the login system"""
        self.root.mainloop()

    def on_close(self):
        if self.rfid_listener:
            self.rfid_listener.stop()
        self.root.destroy()

def main():
    """Main function to run the login system"""
    login_system = LoginSystem()
    login_system.run()

if __name__ == "__main__":
    main()
