"""
db_init.py — SQLite database initialization for Geo-Attendance System
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'attendance.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS faculty (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, roll_number TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
            section TEXT, year INTEGER,
            registered_face_data TEXT, face_registered INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_name TEXT NOT NULL, subject_code TEXT,
            section TEXT, year INTEGER, semester INTEGER,
            faculty_assigned INTEGER REFERENCES faculty(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS attendance_sessions (
            session_id INTEGER PRIMARY KEY AUTOINCREMENT,
            faculty_id INTEGER NOT NULL REFERENCES faculty(id),
            subject_id INTEGER NOT NULL REFERENCES subjects(id),
            date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT,
            geo_fence_lat REAL, geo_fence_lng REAL,
            geo_fence_radius REAL DEFAULT 100,
            status TEXT DEFAULT 'active' CHECK(status IN ('active','stopped','completed'))
        );
        CREATE TABLE IF NOT EXISTS attendance_records (
            record_id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES attendance_sessions(session_id),
            student_id INTEGER NOT NULL REFERENCES students(id),
            time_marked TEXT NOT NULL,
            face_verification_status TEXT DEFAULT 'pending',
            marked_by TEXT DEFAULT 'auto' CHECK(marked_by IN ('auto','manual')),
            notes TEXT, student_lat REAL, student_lng REAL
        );
    """)
    conn.commit()
    conn.close()
    print("[OK] Database initialised - all 5 tables ready")

if __name__ == "__main__":
    init_db()
