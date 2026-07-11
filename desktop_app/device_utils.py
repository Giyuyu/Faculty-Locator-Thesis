import socket
import subprocess
import platform
import json
import os
import base64
from firebase_config import get_database_ref, initialize_firebase

APP_DIR = os.path.dirname(os.path.abspath(__file__))

def sanitize_id(value):
    safe = ''.join(ch.lower() if ch.isalnum() else '_' for ch in str(value or '').strip())
    safe = '_'.join(part for part in safe.split('_') if part)
    return safe or 'unknown_device'

class DeviceManager:
    def __init__(self, config_file="room_config.json"):
        self.config_file = config_file if os.path.isabs(config_file) else os.path.join(APP_DIR, config_file)
        # Initialize Firebase
        self.firebase_initialized = initialize_firebase()
        if not self.firebase_initialized:
            print("Warning: Firebase not initialized. Falling back to local storage.")

    def encode_device_key(self, device_key):
        """Encode device key to be safe for Firebase paths"""
        # Use base64 encoding to handle special characters
        return base64.b64encode(device_key.encode()).decode().replace('/', '_').replace('+', '-')

    def decode_device_key(self, encoded_key):
        """Decode device key from Firebase-safe format"""
        try:
            return base64.b64decode(encoded_key.replace('_', '/').replace('-', '+')).decode()
        except:
            return encoded_key
    
    def get_device_info(self):
        """Get current device information"""
        try:
            # Get computer name
            computer_name = socket.gethostname()
            
            # Get IP address
            ip_address = socket.gethostbyname(computer_name)
            
            # Get MAC address
            mac_address = self.get_mac_address()
            
            return {
                'computer_name': computer_name,
                'ip_address': ip_address,
                'mac_address': mac_address
            }
        except Exception as e:
            print(f"Error getting device info: {str(e)}")
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
    
    def get_assigned_room(self):
        """Get the room assigned to current device"""
        device_info = self.get_device_info()
        if not device_info:
            return None

        device_id = self.build_device_id(device_info)

        # Try Firebase first
        if self.firebase_initialized:
            try:
                from firebase_config import get_data
                devices = get_data('devices')
                rooms = get_data('rooms') or {}
                if devices and device_id in devices:
                    room_id = devices[device_id].get('room_id')
                    if room_id in rooms:
                        return rooms[room_id].get('room_name') or room_id
                    return room_id
            except Exception as e:
                print(f"Error reading from Firebase: {str(e)}")

        # Fallback to local file
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    local_devices = json.load(f)

                if device_id in local_devices:
                    return local_devices[device_id].get('room_id') or local_devices[device_id].get('room')
        except Exception as e:
            print(f"Error reading devices from file: {str(e)}")

        return None

    def build_device_id(self, device_info):
        """Build a stable device ID from MAC address, falling back to name and IP."""
        mac_address = device_info.get('mac_address') or ''
        if mac_address and mac_address != 'Unknown':
            return sanitize_id(mac_address)
        return sanitize_id(f"{device_info.get('computer_name')}_{device_info.get('ip_address')}")
    
    def get_all_available_rooms(self):
        """Get room records from Firebase, falling back to a small local list."""
        if self.firebase_initialized:
            try:
                from firebase_config import get_data
                rooms = get_data('rooms')
                if rooms:
                    return rooms
            except Exception as e:
                print(f"Error reading rooms from Firebase: {str(e)}")

        return {
            "room_101": {
                "room_id": "room_101",
                "room_name": "Room 101",
                "building": "",
                "floor": "Ground Floor",
                "room_status": "Available"
            }
        }

    def save_device(self, device_data):
        """Save a device record using the Devices schema."""
        if self.firebase_initialized:
            try:
                from firebase_config import set_data
                path = f"devices/{device_data['device_id']}"
                return set_data(path, device_data)
            except Exception as e:
                print(f"Error saving to Firebase: {str(e)}")
        return False

    def get_all_devices(self):
        """Get all devices from Firebase."""
        if self.firebase_initialized:
            try:
                from firebase_config import get_data
                devices = get_data('devices')
                if devices:
                    return devices
            except Exception as e:
                print(f"Error reading from Firebase: {str(e)}")

        # Fallback to local file
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error reading from file: {str(e)}")

        return {}

    def remove_device(self, device_id):
        """Remove a device from Firebase."""
        if self.firebase_initialized:
            try:
                from firebase_config import delete_data
                path = f'devices/{device_id}'
                return delete_data(path)
            except Exception as e:
                print(f"Error deleting from Firebase: {str(e)}")
        return False

    def clear_all_devices(self):
        """Clear all device records from Firebase."""
        if self.firebase_initialized:
            try:
                from firebase_config import delete_data
                return delete_data('devices')
            except Exception as e:
                print(f"Error clearing Firebase data: {str(e)}")
        return False

    # Backward-compatible wrappers for older desktop code paths.
    def save_room_assignment(self, device_key, assignment_data):
        device_data = {
            'device_id': sanitize_id(assignment_data.get('mac_address') or device_key),
            'device_name': assignment_data.get('computer_name', 'Unknown Device'),
            'ip_address': assignment_data.get('ip_address', ''),
            'mac_address': assignment_data.get('mac_address', ''),
            'room_id': assignment_data.get('room_id') or sanitize_id(assignment_data.get('room')),
            'device_status': assignment_data.get('device_status', 'Active'),
        }
        return self.save_device(device_data)

    def get_all_room_assignments(self):
        return self.get_all_devices()

    def remove_room_assignment(self, device_key):
        return self.remove_device(sanitize_id(device_key))

    def clear_all_room_assignments(self):
        return self.clear_all_devices()
