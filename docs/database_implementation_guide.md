# Database Implementation Guide for Faculty Locator System

## Overview
This guide provides a complete implementation roadmap for migrating the current JSON-based faculty locator system to a robust database-driven architecture.

## Migration Strategy

### Phase 1: Database Setup and Schema Creation

#### 1.1 Database Installation
```bash
# For MySQL
sudo apt-get install mysql-server mysql-client
sudo mysql_secure_installation

# For PostgreSQL
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres createuser --interactive
sudo -u postgres createdb faculty_locator
```

#### 1.2 Schema Creation Script
```sql
-- Create database
CREATE DATABASE faculty_locator_db;
USE faculty_locator_db;

-- Execute all table creation scripts from faculty_locator_erd.md
-- (Include all 10 table definitions here)
```

### Phase 2: Python Database Integration

#### 2.1 Required Dependencies
```bash
pip install mysql-connector-python  # For MySQL
# OR
pip install psycopg2-binary         # For PostgreSQL
pip install sqlalchemy             # ORM (optional but recommended)
pip install alembic                # Database migrations
```

#### 2.2 Database Connection Module
```python
# database_config.py
import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime

class DatabaseManager:
    def __init__(self):
        self.connection = None
        self.cursor = None
        
    def connect(self):
        """Establish database connection"""
        try:
            self.connection = mysql.connector.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                database=os.getenv('DB_NAME', 'faculty_locator_db'),
                user=os.getenv('DB_USER', 'root'),
                password=os.getenv('DB_PASSWORD', '')
            )
            self.cursor = self.connection.cursor(dictionary=True)
            return True
        except Error as e:
            print(f"Database connection error: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
    
    def execute_query(self, query, params=None):
        """Execute SELECT query"""
        try:
            self.cursor.execute(query, params or ())
            return self.cursor.fetchall()
        except Error as e:
            print(f"Query execution error: {e}")
            return None
    
    def execute_update(self, query, params=None):
        """Execute INSERT/UPDATE/DELETE query"""
        try:
            self.cursor.execute(query, params or ())
            self.connection.commit()
            return self.cursor.rowcount
        except Error as e:
            print(f"Update execution error: {e}")
            self.connection.rollback()
            return 0
```

#### 2.3 Enhanced Device Manager with Database Support
```python
# enhanced_device_utils.py
import socket
import subprocess
import platform
from database_config import DatabaseManager
from datetime import datetime

class EnhancedDeviceManager:
    def __init__(self):
        self.db = DatabaseManager()
        
    def get_device_info(self):
        """Get current device information"""
        try:
            computer_name = socket.gethostname()
            ip_address = socket.gethostbyname(computer_name)
            mac_address = self.get_mac_address()
            
            device_info = {
                'computer_name': computer_name,
                'ip_address': ip_address,
                'mac_address': mac_address,
                'platform': platform.system(),
                'processor': platform.processor(),
                'machine_type': platform.machine()
            }
            
            # Update device in database
            self.update_device_info(device_info)
            
            return device_info
        except Exception as e:
            print(f"Error getting device info: {e}")
            return None
    
    def update_device_info(self, device_info):
        """Update or insert device information in database"""
        if not self.db.connect():
            return False
            
        try:
            # Check if device exists
            query = "SELECT device_id FROM device WHERE mac_address = %s"
            result = self.db.execute_query(query, (device_info['mac_address'],))
            
            if result:
                # Update existing device
                update_query = """
                UPDATE device SET 
                    computer_name = %s,
                    ip_address = %s,
                    platform = %s,
                    processor = %s,
                    machine_type = %s,
                    last_seen = %s,
                    updated_at = %s
                WHERE mac_address = %s
                """
                params = (
                    device_info['computer_name'],
                    device_info['ip_address'],
                    device_info['platform'],
                    device_info['processor'],
                    device_info['machine_type'],
                    datetime.now(),
                    datetime.now(),
                    device_info['mac_address']
                )
                self.db.execute_update(update_query, params)
            else:
                # Insert new device
                insert_query = """
                INSERT INTO device (computer_name, ip_address, mac_address, 
                                  platform, processor, machine_type, last_seen)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """
                params = (
                    device_info['computer_name'],
                    device_info['ip_address'],
                    device_info['mac_address'],
                    device_info['platform'],
                    device_info['processor'],
                    device_info['machine_type'],
                    datetime.now()
                )
                self.db.execute_update(insert_query, params)
                
            return True
        finally:
            self.db.disconnect()
    
    def get_assigned_room(self):
        """Get room assigned to current device"""
        device_info = self.get_device_info()
        if not device_info or not self.db.connect():
            return None
            
        try:
            query = """
            SELECT r.room_number, r.room_name, b.building_name
            FROM room_device_assignment rda
            JOIN device d ON rda.device_id = d.device_id
            JOIN room r ON rda.room_id = r.room_id
            JOIN building b ON r.building_id = b.building_id
            WHERE d.mac_address = %s 
            AND rda.assignment_status = 'active'
            AND (rda.effective_to IS NULL OR rda.effective_to > NOW())
            ORDER BY rda.assigned_date DESC
            LIMIT 1
            """
            
            result = self.db.execute_query(query, (device_info['mac_address'],))
            
            if result:
                room_info = result[0]
                return f"{room_info['room_number']} - {room_info['room_name']}"
            
            return None
        finally:
            self.db.disconnect()
```

### Phase 3: Enhanced Login System

#### 3.1 Database-Driven Authentication
```python
# enhanced_login.py
import tkinter as tk
from tkinter import messagebox
from enhanced_device_utils import EnhancedDeviceManager
from database_config import DatabaseManager
from datetime import datetime
import hashlib

class EnhancedLoginSystem:
    def __init__(self):
        self.device_manager = EnhancedDeviceManager()
        self.db = DatabaseManager()
        self.setup_gui()
        
    def authenticate_faculty(self, employee_number):
        """Authenticate faculty against database"""
        if not self.db.connect():
            return None
            
        try:
            query = """
            SELECT faculty_id, employee_number, first_name, last_name, 
                   email, department, status
            FROM faculty 
            WHERE employee_number = %s AND status = 'active'
            """
            
            result = self.db.execute_query(query, (employee_number,))
            return result[0] if result else None
        finally:
            self.db.disconnect()
    
    def log_login_session(self, faculty_id, device_info, room_info):
        """Log login session to database"""
        if not self.db.connect():
            return False
            
        try:
            # Get device_id
            device_query = "SELECT device_id FROM device WHERE mac_address = %s"
            device_result = self.db.execute_query(device_query, (device_info['mac_address'],))
            
            if not device_result:
                return False
                
            device_id = device_result[0]['device_id']
            
            # Get room_id if room is assigned
            room_id = None
            if room_info:
                room_query = """
                SELECT r.room_id FROM room r
                JOIN building b ON r.building_id = b.building_id
                WHERE CONCAT(r.room_number, ' - ', r.room_name) = %s
                """
                room_result = self.db.execute_query(room_query, (room_info,))
                if room_result:
                    room_id = room_result[0]['room_id']
            
            # Insert login session
            session_query = """
            INSERT INTO login_session (faculty_id, device_id, room_id, 
                                     login_time, ip_address)
            VALUES (%s, %s, %s, %s, %s)
            """
            
            params = (
                faculty_id,
                device_id,
                room_id,
                datetime.now(),
                device_info['ip_address']
            )
            
            return self.db.execute_update(session_query, params) > 0
        finally:
            self.db.disconnect()
```

### Phase 4: Enhanced Admin Panel

#### 4.1 Database-Driven Room Assignment
```python
# enhanced_admin.py
import tkinter as tk
from tkinter import messagebox, ttk
from enhanced_device_utils import EnhancedDeviceManager
from database_config import DatabaseManager
from datetime import datetime

class EnhancedAdminPanel:
    def __init__(self):
        self.device_manager = EnhancedDeviceManager()
        self.db = DatabaseManager()
        self.setup_gui()
        
    def load_buildings_and_rooms(self):
        """Load buildings and rooms from database"""
        if not self.db.connect():
            return []
            
        try:
            query = """
            SELECT r.room_id, r.room_number, r.room_name, 
                   b.building_name, r.room_type
            FROM room r
            JOIN building b ON r.building_id = b.building_id
            WHERE r.is_active = TRUE
            ORDER BY b.building_name, r.room_number
            """
            
            return self.db.execute_query(query)
        finally:
            self.db.disconnect()
    
    def assign_room_to_device(self, room_id, device_info, admin_id=1):
        """Assign room to device in database"""
        if not self.db.connect():
            return False
            
        try:
            # Get or create device
            device_query = "SELECT device_id FROM device WHERE mac_address = %s"
            device_result = self.db.execute_query(device_query, (device_info['mac_address'],))
            
            if not device_result:
                # Create device first
                self.device_manager.update_device_info(device_info)
                device_result = self.db.execute_query(device_query, (device_info['mac_address'],))
            
            device_id = device_result[0]['device_id']
            
            # Deactivate existing assignments
            deactivate_query = """
            UPDATE room_device_assignment 
            SET assignment_status = 'inactive', effective_to = %s
            WHERE device_id = %s AND assignment_status = 'active'
            """
            self.db.execute_update(deactivate_query, (datetime.now(), device_id))
            
            # Create new assignment
            assign_query = """
            INSERT INTO room_device_assignment 
            (room_id, device_id, assigned_by, assigned_date, effective_from)
            VALUES (%s, %s, %s, %s, %s)
            """
            
            params = (room_id, device_id, admin_id, datetime.now(), datetime.now())
            return self.db.execute_update(assign_query, params) > 0
            
        finally:
            self.db.disconnect()
```

## Migration Steps

### Step 1: Data Migration from JSON to Database
```python
# migrate_json_to_db.py
import json
from database_config import DatabaseManager
from datetime import datetime

def migrate_json_data():
    """Migrate existing JSON data to database"""
    db = DatabaseManager()
    
    # Load existing JSON data
    try:
        with open('room_config.json', 'r') as f:
            json_data = json.load(f)
    except FileNotFoundError:
        print("No existing JSON data found")
        return
    
    if not db.connect():
        print("Failed to connect to database")
        return
    
    try:
        for device_key, assignment in json_data.items():
            # Insert/update device
            device_query = """
            INSERT INTO device (computer_name, ip_address, mac_address, last_seen)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            computer_name = VALUES(computer_name),
            ip_address = VALUES(ip_address),
            last_seen = VALUES(last_seen)
            """
            
            device_params = (
                assignment['computer_name'],
                assignment['ip_address'],
                assignment['mac_address'],
                datetime.now()
            )
            
            db.execute_update(device_query, device_params)
            
            # Get device_id
            device_id_query = "SELECT device_id FROM device WHERE mac_address = %s"
            device_result = db.execute_query(device_id_query, (assignment['mac_address'],))
            
            if device_result:
                device_id = device_result[0]['device_id']
                
                # Find room_id (assuming room exists)
                room_query = "SELECT room_id FROM room WHERE room_number = %s"
                room_result = db.execute_query(room_query, (assignment['room'],))
                
                if room_result:
                    room_id = room_result[0]['room_id']
                    
                    # Create assignment
                    assignment_query = """
                    INSERT INTO room_device_assignment 
                    (room_id, device_id, assigned_by, assigned_date, effective_from)
                    VALUES (%s, %s, 1, %s, %s)
                    """
                    
                    assignment_params = (
                        room_id,
                        device_id,
                        assignment.get('assigned_date', datetime.now()),
                        assignment.get('assigned_date', datetime.now())
                    )
                    
                    db.execute_update(assignment_query, assignment_params)
        
        print("Migration completed successfully")
        
    finally:
        db.disconnect()

if __name__ == "__main__":
    migrate_json_data()
```

### Step 2: Environment Configuration
```bash
# .env file
DB_HOST=localhost
DB_NAME=faculty_locator_db
DB_USER=faculty_user
DB_PASSWORD=secure_password
DB_PORT=3306
```

### Step 3: Testing and Validation
```python
# test_database_integration.py
import unittest
from enhanced_device_utils import EnhancedDeviceManager
from database_config import DatabaseManager

class TestDatabaseIntegration(unittest.TestCase):
    def setUp(self):
        self.device_manager = EnhancedDeviceManager()
        self.db = DatabaseManager()
    
    def test_device_detection(self):
        """Test device information detection"""
        device_info = self.device_manager.get_device_info()
        self.assertIsNotNone(device_info)
        self.assertIn('computer_name', device_info)
        self.assertIn('mac_address', device_info)
    
    def test_room_assignment(self):
        """Test room assignment functionality"""
        assigned_room = self.device_manager.get_assigned_room()
        # Should return room info or None
        self.assertTrue(assigned_room is None or isinstance(assigned_room, str))
    
    def test_database_connection(self):
        """Test database connectivity"""
        self.assertTrue(self.db.connect())
        self.db.disconnect()

if __name__ == '__main__':
    unittest.main()
```

## Deployment Checklist

### Pre-Deployment
- [ ] Database server installed and configured
- [ ] Database schema created
- [ ] Python dependencies installed
- [ ] Environment variables configured
- [ ] JSON data migrated to database
- [ ] Unit tests passing

### Deployment
- [ ] Backup existing JSON configuration
- [ ] Deploy new Python modules
- [ ] Update application entry points
- [ ] Test admin panel functionality
- [ ] Test login system functionality
- [ ] Verify device detection accuracy

### Post-Deployment
- [ ] Monitor system performance
- [ ] Verify data integrity
- [ ] Test backup and recovery procedures
- [ ] Document any issues or improvements
- [ ] Train administrators on new features

## Performance Optimization

### Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX idx_device_mac_active ON device(mac_address, device_status);
CREATE INDEX idx_assignment_active ON room_device_assignment(assignment_status, effective_from, effective_to);
CREATE INDEX idx_login_session_faculty ON login_session(faculty_id, login_time);
CREATE INDEX idx_location_history_faculty_time ON location_history(faculty_id, check_in_time);
```

### Application Optimization
- Implement connection pooling for database connections
- Add caching for frequently accessed room assignments
- Use prepared statements for better performance
- Implement lazy loading for large datasets

This implementation guide provides a complete roadmap for migrating your faculty locator system from JSON-based storage to a robust database-driven architecture while maintaining all existing functionality and adding new capabilities.