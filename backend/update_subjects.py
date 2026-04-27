import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'attendance.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Get all faculty IDs
faculties = cur.execute("SELECT id FROM faculty").fetchall()

# Specific subjects requested by user
requested_subjects = [
    ("Operating Systems", "OS"),
    ("Database Management (DBMD)", "DBMD"),
    ("Software Engineering", "SE"),
    ("Node JS", "NODEJS"),
    ("Constitution of India", "COI"),
    ("Real Time Programming", "RTP"),
    ("Managerial Economics (BEFA)", "BEFA")
]

# Clear existing subjects to avoid clutter, then add new ones
cur.execute("DELETE FROM subjects")

for f_id in faculties:
    f_id = f_id[0]
    print(f"Setting subjects for faculty ID {f_id}...")
    for name, code in requested_subjects:
        cur.execute(
            "INSERT INTO subjects(subject_name, subject_code, section, year, semester, faculty_assigned) VALUES(?,?,?,?,?,?)",
            (name, code, "A", 2, 4, f_id) # Assuming 2nd year, 4th sem based on previous context
        )

conn.commit()
conn.close()
print("Done! Subjects updated to: os, dbmd, se, node js, coi, rtp, befa")
