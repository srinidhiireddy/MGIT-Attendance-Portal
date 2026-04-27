import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'attendance.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Get all faculty IDs
faculties = cur.execute("SELECT id FROM faculty").fetchall()

default_subjects = [
    ("Mathematics", "MATH101", "A", 1, 1),
    ("Physics", "PHYS101", "A", 1, 1),
    ("Computer Science", "CS101", "A", 1, 1),
    ("Database Management", "DBMS201", "B", 2, 4),
    ("Operating Systems", "OS202", "B", 2, 4)
]

for f_id in faculties:
    f_id = f_id[0]
    # Check if faculty already has subjects
    count = cur.execute("SELECT COUNT(*) FROM subjects WHERE faculty_assigned=?", (f_id,)).fetchone()[0]
    if count == 0:
        print(f"Adding subjects for faculty ID {f_id}...")
        for name, code, sec, year, sem in default_subjects:
            cur.execute(
                "INSERT INTO subjects(subject_name, subject_code, section, year, semester, faculty_assigned) VALUES(?,?,?,?,?,?)",
                (name, code, sec, year, sem, f_id)
            )

conn.commit()
conn.close()
print("Done!")
