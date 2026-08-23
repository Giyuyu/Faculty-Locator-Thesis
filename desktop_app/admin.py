import tkinter as tk
from tkinter import messagebox, ttk
import base64
import socket
import subprocess
import platform
import json
import os
import sys
from pathlib import Path
from datetime import datetime
from device_utils import DeviceManager
from firebase_config import get_current_environment, get_data, update_data
from rfid_utils import (
    SerialRfidListener,
    load_reader_config,
    normalize_rfid_value,
    reader_label,
)

def normalize_rfid(value):
    return normalize_rfid_value(value)

class AdminPanel:
    def __init__(self):
        self.device_manager = DeviceManager()
        self.pending_rfid = ''
        self.rfid_listener = None
        self.rfid_reader_config = load_reader_config()
        self.rfid_key_timer = None
        self.load_config()
        self.setup_gui()
        
    def load_config(self):
        """Load devices and rooms from Firebase/database."""
        self.devices = self.device_manager.get_all_devices()
        self.rooms = self.device_manager.get_all_available_rooms()
        self.faculties = get_data('faculties') or {}
    
    def get_device_info(self):
        """Get current device information"""
        try:
            # Get computer name
            computer_name = socket.gethostname()
            
            # Get IP address
            ip_address = socket.gethostbyname(computer_name)
            
            # Get MAC address
            mac_address = self.get_mac_address()
            
            # Get system info
            system_info = {
                'platform': platform.system(),
                'processor': platform.processor(),
                'machine': platform.machine()
            }
            
            return {
                'computer_name': computer_name,
                'ip_address': ip_address,
                'mac_address': mac_address,
                'system_info': system_info,
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        except Exception as e:
            messagebox.showerror("Error", f"Failed to get device info: {str(e)}")
            return None
    
    def get_mac_address(self):
        """Get MAC address of the device"""
        try:
            if platform.system() == "Windows":
                result = subprocess.run(['getmac'], capture_output=True, text=True)
                if result.returncode == 0:
                    lines = result.stdout.strip().split('\n')
                    for line in lines:
                        if 'Physical Address' not in line and '-' in line:
                            return line.split()[0]
            else:
                # For Linux/Mac
                result = subprocess.run(['ifconfig'], capture_output=True, text=True)
                if result.returncode == 0:
                    lines = result.stdout.split('\n')
                    for line in lines:
                        if 'ether' in line or 'HWaddr' in line:
                            parts = line.split()
                            for part in parts:
                                if ':' in part and len(part) == 17:
                                    return part
            return "Unknown"
        except:
            return "Unknown"
    
    def setup_gui(self):
        """Build the modern device administration interface."""
        self.root = tk.Tk()
        environment = get_current_environment().upper()
        self.root.title(f"STI Locator - Device Administration [{environment}]")
        self.root.geometry("1080x820")
        self.root.minsize(920, 720)
        self.root.configure(bg='#f3f6fc')
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        self.root.grid_columnconfigure(0, weight=1)
        self.root.grid_rowconfigure(1, weight=1)

        style = ttk.Style(self.root)
        try:
            style.theme_use('clam')
        except tk.TclError:
            pass
        style.configure(
            'Admin.TCombobox', fieldbackground='white', background='white',
            foreground='#101828', bordercolor='#cfd8e6', padding=8,
        )
        style.configure(
            'Admin.Treeview', background='white', fieldbackground='white',
            foreground='#344054', rowheight=34, borderwidth=0,
        )
        style.configure(
            'Admin.Treeview.Heading', background='#eef4ff', foreground='#344054',
            font=('Arial', 9, 'bold'), padding=9, relief='flat',
        )
        style.map('Admin.Treeview', background=[('selected', '#dbe8ff')], foreground=[('selected', '#101828')])

        header = tk.Frame(self.root, bg='#102a56', height=112)
        header.grid(row=0, column=0, sticky='ew')
        header.grid_propagate(False)
        header.grid_columnconfigure(1, weight=1)

        logo_path = Path(__file__).resolve().parent.parent / 'public' / 'sti_logo.png'
        logo_data = base64.b64encode(logo_path.read_bytes())
        self.sti_logo_image = tk.PhotoImage(data=logo_data).subsample(18, 18)
        tk.Label(header, image=self.sti_logo_image, bg='#102a56', borderwidth=0).grid(
            row=0, column=0, rowspan=2, padx=(30, 18), pady=20,
        )
        tk.Label(
            header, text="Device Administration", font=('Arial', 21, 'bold'),
            bg='#102a56', fg='white',
        ).grid(row=0, column=1, sticky='sw', pady=(20, 0))
        tk.Label(
            header, text="Manage room terminals and faculty RFID assignments",
            font=('Arial', 10), bg='#102a56', fg='#c9d7ee',
        ).grid(row=1, column=1, sticky='nw', pady=(2, 20))
        tk.Button(
            header, text="Launch Login", command=self.open_login,
            bg='#ffdd00', fg='#0755a4', activebackground='#ffe84d',
            activeforeground='#0755a4', font=('Arial', 9, 'bold'), relief='flat',
            cursor='hand2', padx=15, pady=8,
        ).grid(row=0, column=2, rowspan=2, padx=(10, 8))
        tk.Label(
            header, text=environment, font=('Arial', 9, 'bold'), bg='#214675',
            fg='white', padx=14, pady=7,
        ).grid(row=0, column=3, rowspan=2, padx=(8, 30))

        content = tk.Frame(self.root, bg='#f3f6fc')
        content.grid(row=1, column=0, sticky='nsew', padx=26, pady=20)
        content.grid_columnconfigure(0, weight=1)
        content.grid_columnconfigure(1, weight=1)
        content.grid_rowconfigure(2, weight=1)

        device_card = self.create_admin_card(content, "Current Device", "Review this terminal before assigning it to a room.")
        device_card.grid(row=0, column=0, sticky='nsew', padx=(0, 8), pady=(0, 14))
        device_card.grid_columnconfigure(0, weight=1)
        self.device_info_text = tk.Text(
            device_card, height=4, font=('Consolas', 9), state=tk.DISABLED,
            bg='#f8fafc', fg='#475467', relief='flat', padx=12, pady=9,
            highlightbackground='#e4e7ec', highlightthickness=1,
        )
        self.device_info_text.grid(row=2, column=0, sticky='ew', padx=18, pady=(8, 10))
        self.make_button(
            device_card, "Refresh device info", self.refresh_device_info,
            '#eef4ff', '#175cd3',
        ).grid(row=3, column=0, sticky='w', padx=18, pady=(0, 16))

        assignment_card = self.create_admin_card(content, "Room Assignment", "Connect this desktop terminal to its physical room.")
        assignment_card.grid(row=0, column=1, sticky='nsew', padx=(8, 0), pady=(0, 14))
        assignment_card.grid_columnconfigure(0, weight=1)
        tk.Label(
            assignment_card, text="ROOM", font=('Arial', 9, 'bold'),
            bg='white', fg='#344054',
        ).grid(row=2, column=0, sticky='w', padx=18, pady=(10, 6))
        self.room_var = tk.StringVar()
        self.room_combo = ttk.Combobox(
            assignment_card, textvariable=self.room_var, values=[],
            font=('Arial', 10), state='readonly', style='Admin.TCombobox',
        )
        self.room_combo.grid(row=3, column=0, sticky='ew', padx=18)
        self.make_button(
            assignment_card, "Save room assignment", self.assign_room,
            '#1769ff', 'white',
        ).grid(row=4, column=0, sticky='ew', padx=18, pady=(13, 16))

        rfid_card = self.create_admin_card(
            content, "Faculty RFID Registration",
            "Select a faculty member, scan a card, then save the assignment.",
        )
        rfid_card.grid(row=1, column=0, columnspan=2, sticky='ew', pady=(0, 14))
        rfid_card.grid_columnconfigure(1, weight=1)
        rfid_card.grid_columnconfigure(3, weight=1)

        tk.Label(rfid_card, text="FACULTY", font=('Arial', 9, 'bold'), bg='white', fg='#344054').grid(
            row=2, column=0, sticky='w', padx=(18, 8), pady=(12, 6),
        )
        self.faculty_var = tk.StringVar()
        self.faculty_combo = ttk.Combobox(
            rfid_card, textvariable=self.faculty_var, values=[], font=('Arial', 10),
            state='readonly', style='Admin.TCombobox',
        )
        self.faculty_combo.grid(row=2, column=1, sticky='ew', padx=(0, 18), pady=(12, 6))
        self.faculty_combo.bind('<<ComboboxSelected>>', self.on_faculty_selected)

        tk.Label(rfid_card, text="RFID SCAN", font=('Arial', 9, 'bold'), bg='white', fg='#344054').grid(
            row=2, column=2, sticky='w', padx=(0, 8), pady=(12, 6),
        )
        self.rfid_var = tk.StringVar()
        self.rfid_entry = tk.Entry(
            rfid_card, textvariable=self.rfid_var, font=('Arial', 11), bg='#f9fafb',
            fg='#101828', insertbackground='#101828', relief='flat',
            highlightbackground='#cfd8e6', highlightcolor='#246bfe', highlightthickness=1,
        )
        self.rfid_entry.grid(row=2, column=3, sticky='ew', padx=(0, 18), pady=(12, 6), ipady=8)
        self.rfid_entry.bind('<Return>', self.handle_rfid_scan)
        self.rfid_entry.bind('<KeyRelease>', self.handle_rfid_key_release)

        self.reader_status_var = tk.StringVar()
        tk.Label(
            rfid_card, textvariable=self.reader_status_var, font=('Arial', 9),
            bg='white', fg='#667085', wraplength=680, justify='left',
        ).grid(row=3, column=0, columnspan=3, sticky='w', padx=18, pady=(5, 3))

        action_frame = tk.Frame(rfid_card, bg='white')
        action_frame.grid(row=3, column=3, rowspan=2, sticky='e', padx=18, pady=(5, 14))
        self.make_button(
            action_frame, "Save RFID", self.save_rfid_assignment, '#1769ff', 'white',
        ).pack(side=tk.LEFT, padx=(0, 8))
        self.make_button(
            action_frame, "Clear RFID", self.clear_selected_faculty_rfid, '#fff1f0', '#b42318',
        ).pack(side=tk.LEFT)

        self.rfid_status_var = tk.StringVar(value="Select a faculty member, then scan their RFID card.")
        tk.Label(
            rfid_card, textvariable=self.rfid_status_var, font=('Arial', 9, 'bold'),
            bg='white', fg='#175cd3', wraplength=680, justify='left',
        ).grid(row=4, column=0, columnspan=3, sticky='w', padx=18, pady=(3, 14))

        devices_card = self.create_admin_card(
            content, "Registered Devices", "Devices currently configured for room access.",
        )
        devices_card.grid(row=2, column=0, columnspan=2, sticky='nsew')
        devices_card.grid_columnconfigure(0, weight=1)
        devices_card.grid_rowconfigure(2, weight=1)

        table_frame = tk.Frame(devices_card, bg='white')
        table_frame.grid(row=2, column=0, sticky='nsew', padx=18, pady=(10, 8))
        table_frame.grid_columnconfigure(0, weight=1)
        table_frame.grid_rowconfigure(0, weight=1)
        columns = ('Device ID', 'Device Name', 'IP Address', 'MAC Address', 'Room ID', 'Status')
        self.tree = ttk.Treeview(
            table_frame, columns=columns, show='headings', height=7, style='Admin.Treeview',
        )
        widths = (170, 150, 120, 145, 110, 90)
        for column, width in zip(columns, widths):
            self.tree.heading(column, text=column.upper())
            self.tree.column(column, width=width, minwidth=80, anchor='w')
        scrollbar = ttk.Scrollbar(table_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.grid(row=0, column=0, sticky='nsew')
        scrollbar.grid(row=0, column=1, sticky='ns')

        controls = tk.Frame(devices_card, bg='white')
        controls.grid(row=3, column=0, sticky='ew', padx=18, pady=(0, 16))
        self.make_button(
            controls, "Delete selected", self.remove_assignment, '#fff1f0', '#b42318',
        ).pack(side=tk.LEFT)
        self.make_button(
            controls, "Clear all", self.clear_all_assignments, '#fffaeb', '#b54708',
        ).pack(side=tk.LEFT, padx=8)
        self.make_button(
            controls, "Export configuration", self.export_config, '#eef4ff', '#175cd3',
        ).pack(side=tk.RIGHT)

        self.refresh_device_info()
        self.refresh_assignments()
        self.update_room_options()
        self.update_faculty_options()
        self.refresh_rfid_detection()
        self.start_rfid_listener()

    def create_admin_card(self, parent, title, description):
        card = tk.Frame(parent, bg='white', highlightbackground='#dce3ef', highlightthickness=1)
        tk.Label(
            card, text=title, font=('Arial', 13, 'bold'), bg='white', fg='#101828',
        ).grid(row=0, column=0, columnspan=4, sticky='w', padx=18, pady=(15, 2))
        tk.Label(
            card, text=description, font=('Arial', 9), bg='white', fg='#667085',
        ).grid(row=1, column=0, columnspan=4, sticky='w', padx=18)
        return card

    def make_button(self, parent, text, command, background, foreground):
        return tk.Button(
            parent, text=text, command=command, bg=background, fg=foreground,
            activebackground=background, activeforeground=foreground,
            font=('Arial', 9, 'bold'), relief='flat', cursor='hand2', padx=15, pady=8,
        )

    def open_login(self):
        """Launch the faculty login terminal in the current environment."""
        try:
            login_path = Path(__file__).resolve().parent / 'login.py'
            subprocess.Popen([sys.executable, str(login_path)])
        except Exception as error:
            messagebox.showerror("Launch Failed", f"Could not open the login terminal: {error}")

    def setup_gui_legacy(self):
        """Setup the admin GUI"""
        self.root = tk.Tk()
        environment = get_current_environment().upper()
        self.root.title(f"Device Assignment Admin Panel [{environment}]")
        self.root.geometry("900x760")
        self.root.configure(bg='#f0f0f0')
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        
        # Main frame
        main_frame = tk.Frame(self.root, bg='#f0f0f0')
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Title
        title_label = tk.Label(main_frame, text="Device Assignment Admin Panel", 
                              font=('Arial', 18, 'bold'), bg='#f0f0f0')
        title_label.pack(pady=(0, 4))
        env_label = tk.Label(main_frame, text=f"Environment: {environment}",
                             font=('Arial', 9, 'bold'), bg='#f0f0f0', fg='#607d8b')
        env_label.pack(pady=(0, 16))
        
        # Device Info Section
        device_frame = tk.LabelFrame(main_frame, text="Current Device Information", 
                                   font=('Arial', 12, 'bold'), bg='#f0f0f0')
        device_frame.pack(fill=tk.X, pady=(0, 20))
        
        self.device_info_text = tk.Text(device_frame, height=6, width=70, 
                                       font=('Courier', 10), state=tk.DISABLED)
        self.device_info_text.pack(padx=10, pady=10)
        
        refresh_btn = tk.Button(device_frame, text="Refresh Device Info", 
                               command=self.refresh_device_info, bg='#4CAF50', 
                               fg='white', font=('Arial', 10, 'bold'))
        refresh_btn.pack(pady=(0, 10))
        
        # Room Assignment Section
        assignment_frame = tk.LabelFrame(main_frame, text="Device Room Assignment", 
                                       font=('Arial', 12, 'bold'), bg='#f0f0f0')
        assignment_frame.pack(fill=tk.X, pady=(0, 20))
        
        # Room selection
        room_assign_frame = tk.Frame(assignment_frame, bg='#f0f0f0')
        room_assign_frame.pack(fill=tk.X, padx=10, pady=10)
        
        tk.Label(room_assign_frame, text="Room:", font=('Arial', 11, 'bold'),
                bg='#f0f0f0').pack(side=tk.LEFT)

        self.room_var = tk.StringVar()
        self.room_combo = ttk.Combobox(room_assign_frame, textvariable=self.room_var,
                                      values=[],
                                      font=('Arial', 11))
        self.room_combo.pack(side=tk.LEFT, padx=(10, 0))
        
        assign_btn = tk.Button(room_assign_frame, text="Save Current Device", 
                              command=self.assign_room, bg='#2196F3', fg='white', 
                              font=('Arial', 10, 'bold'))
        assign_btn.pack(side=tk.LEFT, padx=(20, 0))

        # Faculty RFID Registration Section
        rfid_frame = tk.LabelFrame(main_frame, text="Faculty RFID Registration",
                                   font=('Arial', 12, 'bold'), bg='#f0f0f0')
        rfid_frame.pack(fill=tk.X, pady=(0, 20))

        rfid_form_frame = tk.Frame(rfid_frame, bg='#f0f0f0')
        rfid_form_frame.pack(fill=tk.X, padx=10, pady=10)

        tk.Label(rfid_form_frame, text="Faculty:", font=('Arial', 11, 'bold'),
                 bg='#f0f0f0').grid(row=0, column=0, sticky='w', padx=(0, 10), pady=(0, 8))

        self.faculty_var = tk.StringVar()
        self.faculty_combo = ttk.Combobox(rfid_form_frame, textvariable=self.faculty_var,
                                          values=[], font=('Arial', 11), width=42)
        self.faculty_combo.grid(row=0, column=1, sticky='w', pady=(0, 8))
        self.faculty_combo.bind('<<ComboboxSelected>>', self.on_faculty_selected)

        tk.Label(rfid_form_frame, text="RFID Reader:", font=('Arial', 11, 'bold'),
                 bg='#f0f0f0').grid(row=1, column=0, sticky='w', padx=(0, 10), pady=(0, 8))

        self.reader_status_var = tk.StringVar()
        reader_status_label = tk.Label(rfid_form_frame, textvariable=self.reader_status_var,
                                       font=('Arial', 10), bg='#f0f0f0', fg='#333',
                                       wraplength=460, justify='left')
        reader_status_label.grid(row=1, column=1, columnspan=2, sticky='w', pady=(0, 8))

        tk.Label(rfid_form_frame, text="RFID Scan:", font=('Arial', 11, 'bold'),
                 bg='#f0f0f0').grid(row=2, column=0, sticky='w', padx=(0, 10))

        self.rfid_var = tk.StringVar()
        self.rfid_entry = tk.Entry(rfid_form_frame, textvariable=self.rfid_var,
                                   width=45, font=('Arial', 11))
        self.rfid_entry.grid(row=2, column=1, sticky='w')
        self.rfid_entry.bind('<Return>', self.handle_rfid_scan)
        self.rfid_entry.bind('<KeyRelease>', self.handle_rfid_key_release)

        rfid_btn_frame = tk.Frame(rfid_form_frame, bg='#f0f0f0')
        rfid_btn_frame.grid(row=2, column=2, sticky='w', padx=(15, 0))

        save_rfid_btn = tk.Button(rfid_btn_frame, text="Save RFID to Faculty",
                                  command=self.save_rfid_assignment,
                                  bg='#673AB7', fg='white',
                                  font=('Arial', 10, 'bold'))
        save_rfid_btn.pack(side=tk.LEFT)

        clear_rfid_btn = tk.Button(rfid_btn_frame, text="Clear RFID",
                                   command=self.clear_selected_faculty_rfid,
                                   bg='#795548', fg='white',
                                   font=('Arial', 10, 'bold'))
        clear_rfid_btn.pack(side=tk.LEFT, padx=(10, 0))

        self.rfid_status_var = tk.StringVar(value="Select a faculty, then scan their RFID card.")
        rfid_status_label = tk.Label(rfid_frame, textvariable=self.rfid_status_var,
                                     font=('Arial', 9), bg='#f0f0f0', fg='#555')
        rfid_status_label.pack(anchor='w', padx=10, pady=(0, 10))
        
        # Current Assignments Section
        current_frame = tk.LabelFrame(main_frame, text="Registered Devices", 
                                    font=('Arial', 12, 'bold'), bg='#f0f0f0')
        current_frame.pack(fill=tk.BOTH, expand=True)
        
        # Treeview for assignments
        columns = ('Device ID', 'Device Name', 'IP Address', 'MAC Address', 'Room ID', 'Status')
        self.tree = ttk.Treeview(current_frame, columns=columns, show='headings', height=10)
        
        for col in columns:
            self.tree.heading(col, text=col)
            self.tree.column(col, width=150)
        
        scrollbar = ttk.Scrollbar(current_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(10, 0), pady=10)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y, pady=10, padx=(0, 10))
        
        # Control buttons
        button_frame = tk.Frame(main_frame, bg='#f0f0f0')
        button_frame.pack(fill=tk.X, pady=(10, 0))
        
        remove_btn = tk.Button(button_frame, text="Delete Selected Device", 
                              command=self.remove_assignment, bg='#f44336', fg='white', 
                              font=('Arial', 10, 'bold'))
        remove_btn.pack(side=tk.LEFT)
        
        clear_all_btn = tk.Button(button_frame, text="Clear All Devices", 
                                 command=self.clear_all_assignments, bg='#ff9800', 
                                 fg='white', font=('Arial', 10, 'bold'))
        clear_all_btn.pack(side=tk.LEFT, padx=(10, 0))
        
        export_btn = tk.Button(button_frame, text="Export Config", 
                              command=self.export_config, bg='#9c27b0', fg='white', 
                              font=('Arial', 10, 'bold'))
        export_btn.pack(side=tk.RIGHT)
        
        # Initialize display
        self.refresh_device_info()
        self.refresh_assignments()
        self.update_room_options()
        self.update_faculty_options()
        self.refresh_rfid_detection()
        self.start_rfid_listener()
    
    def get_room_label(self, room):
        room_name = room.get('room_name') or room.get('room_id')
        room_id = room.get('room_id') or ''
        return f"{room_name} ({room_id})"

    def selected_room_id(self):
        selected = self.room_var.get()
        if '(' in selected and selected.endswith(')'):
            return selected.rsplit('(', 1)[1].rstrip(')').strip()
        for room_id, room in self.rooms.items():
            if selected == self.get_room_label(room) or selected == room.get('room_name'):
                return room.get('room_id') or room_id
        return selected

    def update_room_options(self, event=None):
        """Update room options from room records."""
        rooms = list(self.rooms.values())
        room_values = [self.get_room_label(room) for room in sorted(rooms, key=lambda item: item.get('room_name', ''))]
        self.room_combo['values'] = room_values
        self.room_var.set(room_values[0] if room_values else '')

    def refresh_rfid_detection(self):
        """Auto-detect a plugged RFID reader."""
        detected_config = load_reader_config()
        previous_id = self.rfid_reader_config.get('device_id')
        previous_mode = self.rfid_reader_config.get('mode')
        self.rfid_reader_config = detected_config

        if detected_config.get('mode') == 'serial':
            self.reader_status_var.set(f"Auto-detected serial RFID reader: {reader_label(detected_config)}")
        else:
            self.reader_status_var.set("No serial RFID reader detected. Using keyboard/HID scan mode.")

        if (
            detected_config.get('device_id') != previous_id or
            detected_config.get('mode') != previous_mode or
            (detected_config.get('mode') == 'serial' and not (self.rfid_listener and self.rfid_listener.is_running()))
        ):
            self.start_rfid_listener()

        self.root.after(3000, self.refresh_rfid_detection)

    def start_rfid_listener(self):
        """Start listener for serial RFID readers; keyboard readers use the focused entry."""
        if self.rfid_listener:
            self.rfid_listener.stop()
            self.rfid_listener = None

        if self.rfid_reader_config.get('mode') != 'serial':
            return

        self.rfid_listener = SerialRfidListener(
            self.rfid_reader_config,
            on_scan=lambda value: self.root.after(0, lambda: self.receive_rfid_scan(value)),
            on_error=lambda message: self.root.after(0, lambda: self.rfid_status_var.set(message)),
        )
        self.rfid_listener.start()

    def receive_rfid_scan(self, scanned_rfid):
        """Receive a scan from the selected reader and place it in the registration field."""
        normalized_rfid = normalize_rfid(scanned_rfid)
        self.rfid_var.set(normalized_rfid)
        self.pending_rfid = normalized_rfid
        self.rfid_status_var.set(
            f"Detected RFID: {normalized_rfid}. Select/confirm the faculty, then click Save RFID to Faculty."
        )

    def get_faculty_name(self, faculty):
        return " ".join(
            part for part in [
                faculty.get('first_name'),
                faculty.get('middle_name'),
                faculty.get('last_name')
            ] if part
        ).strip() or faculty.get('email') or faculty.get('faculty_id') or 'Unnamed Faculty'

    def get_faculty_label(self, faculty):
        faculty_id = faculty.get('faculty_id') or ''
        rfid_id = faculty.get('rfid_id') or ''
        rfid_note = f" | RFID: {rfid_id}" if rfid_id else " | No RFID"
        return f"{self.get_faculty_name(faculty)} ({faculty_id}){rfid_note}"

    def selected_faculty_id(self):
        selected = self.faculty_var.get()
        if '(' in selected and ')' in selected:
            return selected.rsplit('(', 1)[1].split(')', 1)[0].strip()

        for faculty_id, faculty in self.faculties.items():
            if selected == self.get_faculty_label(faculty) or selected == faculty.get('faculty_id'):
                return faculty.get('faculty_id') or faculty_id
        return ''

    def update_faculty_options(self, event=None, selected_faculty_id=None):
        """Update faculty dropdown from faculty records."""
        selected_faculty_id = selected_faculty_id or self.selected_faculty_id()
        self.faculties = get_data('faculties') or {}
        faculties = sorted(
            self.faculties.values(),
            key=lambda item: self.get_faculty_name(item).lower()
        )
        faculty_values = [self.get_faculty_label(faculty) for faculty in faculties]
        self.faculty_combo['values'] = faculty_values
        selected_label = ''
        if selected_faculty_id:
            for faculty in faculties:
                if faculty.get('faculty_id') == selected_faculty_id:
                    selected_label = self.get_faculty_label(faculty)
                    break
        if selected_label:
            self.faculty_var.set(selected_label)
        elif faculty_values and not self.faculty_var.get():
            self.faculty_var.set(faculty_values[0])
            self.on_faculty_selected()

    def get_selected_faculty_record(self):
        faculty_id = self.selected_faculty_id()
        if not faculty_id:
            return '', None
        if faculty_id in self.faculties:
            return faculty_id, self.faculties[faculty_id]
        for key, faculty in self.faculties.items():
            if faculty.get('faculty_id') == faculty_id:
                return key, faculty
        return faculty_id, None

    def on_faculty_selected(self, event=None):
        """Show the current RFID assignment for the selected faculty."""
        _, faculty = self.get_selected_faculty_record()
        if not faculty:
            self.rfid_status_var.set("Selected faculty was not found.")
            return

        if self.pending_rfid:
            self.rfid_var.set(self.pending_rfid)
            self.rfid_status_var.set(
                f"Detected RFID {self.pending_rfid}. Click Save RFID to Faculty to link it to {self.get_faculty_name(faculty)}."
            )
            self.rfid_entry.focus_set()
            return

        current_rfid = faculty.get('rfid_id') or ''
        self.rfid_var.set(current_rfid)
        if current_rfid:
            self.rfid_status_var.set(f"{self.get_faculty_name(faculty)} is linked to RFID {current_rfid}.")
        else:
            self.rfid_status_var.set(f"{self.get_faculty_name(faculty)} has no RFID yet. Scan a card to register.")
        self.rfid_entry.focus_set()

    def handle_rfid_scan(self, event=None):
        """Capture RFID reader input and wait for admin confirmation."""
        if self.rfid_key_timer:
            self.root.after_cancel(self.rfid_key_timer)
            self.rfid_key_timer = None
        scanned_rfid = normalize_rfid(self.rfid_var.get())
        if not scanned_rfid:
            messagebox.showerror("Error", "Please scan an RFID card first")
            self.rfid_entry.focus_set()
            return "break"

        self.rfid_var.set(scanned_rfid)
        self.pending_rfid = scanned_rfid
        self.rfid_status_var.set(f"Detected RFID: {scanned_rfid}. Select/confirm the faculty, then click Save RFID to Faculty.")
        return "break"

    def handle_rfid_key_release(self, event=None):
        """Detect keyboard/HID scans that do not send Enter."""
        if self.rfid_key_timer:
            self.root.after_cancel(self.rfid_key_timer)
        self.rfid_key_timer = self.root.after(650, self.capture_keyboard_rfid)

    def capture_keyboard_rfid(self):
        scanned_rfid = normalize_rfid(self.rfid_var.get())
        if len(scanned_rfid) < 3:
            return
        self.rfid_var.set(scanned_rfid)
        self.pending_rfid = scanned_rfid
        self.rfid_status_var.set(
            f"Detected RFID: {scanned_rfid}. Select/confirm the faculty, then click Save RFID to Faculty."
        )

    def find_faculty_by_rfid(self, rfid_id):
        normalized_rfid = normalize_rfid(rfid_id)
        for faculty in self.faculties.values():
            if normalize_rfid(faculty.get('rfid_id', '')) == normalized_rfid:
                return faculty
        return None

    def save_rfid_assignment(self):
        """Save scanned RFID value to the selected faculty record."""
        faculty_key, faculty = self.get_selected_faculty_record()
        scanned_rfid = normalize_rfid(self.rfid_var.get())

        if not faculty_key or not faculty:
            messagebox.showerror("Error", "Please select a faculty")
            return
        if not scanned_rfid:
            messagebox.showerror("Error", "Please scan or enter an RFID value")
            self.rfid_entry.focus_set()
            return

        existing_faculty = self.find_faculty_by_rfid(scanned_rfid)
        if existing_faculty and existing_faculty.get('faculty_id') != faculty.get('faculty_id'):
            messagebox.showerror(
                "RFID Already Assigned",
                f"This RFID is already assigned to {self.get_faculty_name(existing_faculty)}."
            )
            return

        updates = {
            'rfid_id': scanned_rfid,
            'updated_date': datetime.now().isoformat()
        }

        if update_data(f'faculties/{faculty_key}', updates):
            messagebox.showinfo("Success", f"RFID saved for {self.get_faculty_name(faculty)}.")
            self.rfid_status_var.set(f"RFID {scanned_rfid} is now linked to {self.get_faculty_name(faculty)}.")
            self.pending_rfid = ''
            self.faculties[faculty_key]['rfid_id'] = scanned_rfid
            self.update_faculty_options(selected_faculty_id=faculty.get('faculty_id'))
        else:
            messagebox.showerror("Error", "Failed to save RFID to database")

    def clear_selected_faculty_rfid(self):
        """Remove RFID assignment from the selected faculty."""
        faculty_key, faculty = self.get_selected_faculty_record()
        if not faculty_key or not faculty:
            messagebox.showerror("Error", "Please select a faculty")
            return

        if not messagebox.askyesno("Confirm", f"Clear RFID for {self.get_faculty_name(faculty)}?"):
            return

        updates = {
            'rfid_id': None,
            'updated_date': datetime.now().isoformat()
        }

        if update_data(f'faculties/{faculty_key}', updates):
            self.rfid_var.set('')
            self.pending_rfid = ''
            self.rfid_status_var.set(f"RFID cleared for {self.get_faculty_name(faculty)}.")
            self.faculties[faculty_key].pop('rfid_id', None)
            self.update_faculty_options(selected_faculty_id=faculty.get('faculty_id'))
        else:
            messagebox.showerror("Error", "Failed to clear RFID from database")

    def refresh_device_info(self):
        """Refresh and display current device information"""
        device_info = self.get_device_info()
        if device_info:
            self.current_device_info = device_info
            info_text = f"Computer Name: {device_info['computer_name']}\n"
            info_text += f"IP Address: {device_info['ip_address']}\n"
            info_text += f"MAC Address: {device_info['mac_address']}\n"
            info_text += f"Platform: {device_info['system_info']['platform']}\n"
            info_text += f"Machine: {device_info['system_info']['machine']}\n"
            info_text += f"Last Updated: {device_info['timestamp']}"

            self.device_info_text.config(state=tk.NORMAL)
            self.device_info_text.delete(1.0, tk.END)
            self.device_info_text.insert(1.0, info_text)
            self.device_info_text.config(state=tk.DISABLED)
    
    def assign_room(self):
        """Assign current device to a room using the Devices schema."""
        if not hasattr(self, 'current_device_info'):
            messagebox.showerror("Error", "Please refresh device info first")
            return

        room_id = self.selected_room_id()
        if not room_id:
            messagebox.showerror("Error", "Please select a room")
            return

        device_id = self.device_manager.build_device_id(self.current_device_info)

        device_data = {
            'device_id': device_id,
            'device_name': self.current_device_info['computer_name'],
            'ip_address': self.current_device_info['ip_address'],
            'mac_address': self.current_device_info['mac_address'],
            'room_id': room_id,
            'device_status': 'Active'
        }

        if self.device_manager.save_device(device_data):
            self.devices[device_id] = device_data
            messagebox.showinfo("Success", f"Device saved and assigned to {room_id} successfully!")
            self.refresh_assignments()
        else:
            detail = self.device_manager.last_error or "Firebase rejected the device write."
            messagebox.showerror(
                "Device Save Failed",
                f"Could not save this device to the {get_current_environment()} database.\n\n"
                f"{detail}"
            )
    
    def refresh_assignments(self):
        """Refresh the assignments display"""
        self.devices = self.device_manager.get_all_devices()

        # Clear existing items
        for item in self.tree.get_children():
            self.tree.delete(item)

        # Add current devices
        for device_id, device in self.devices.items():
            self.tree.insert('', tk.END, values=(
                device.get('device_id', device_id),
                device.get('device_name', ''),
                device.get('ip_address', ''),
                device.get('mac_address', ''),
                device.get('room_id', ''),
                device.get('device_status', '')
            ))
    
    def remove_assignment(self):
        """Remove selected device."""
        selected_item = self.tree.selection()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select an assignment to remove")
            return

        item = self.tree.item(selected_item)
        device_id = item['values'][0]

        if self.device_manager.remove_device(device_id):
            if device_id in self.devices:
                del self.devices[device_id]
            messagebox.showinfo("Success", "Device removed successfully!")
            self.refresh_assignments()
        else:
            messagebox.showerror("Error", "Failed to remove device from database")
    
    def clear_all_assignments(self):
        """Clear all device records."""
        result = messagebox.askyesno("Confirm", "Are you sure you want to clear all device records?")
        if result:
            if self.device_manager.clear_all_devices():
                self.devices = {}
                messagebox.showinfo("Success", "All devices cleared successfully!")
                self.refresh_assignments()
            else:
                messagebox.showerror("Error", "Failed to clear devices from database")
    
    def export_config(self):
        """Export configuration to a backup file"""
        try:
            self.devices = self.device_manager.get_all_devices()
            backup_file = f"devices_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(backup_file, 'w') as f:
                json.dump(self.devices, f, indent=4)
            messagebox.showinfo("Success", f"Configuration exported to {backup_file}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to export configuration: {str(e)}")
    
    def run(self):
        """Start the admin panel"""
        self.root.mainloop()

    def on_close(self):
        if self.rfid_listener:
            self.rfid_listener.stop()
        self.root.destroy()

def main():
    """Main function to run the admin panel"""
    admin = AdminPanel()
    admin.run()

if __name__ == "__main__":
    main()
