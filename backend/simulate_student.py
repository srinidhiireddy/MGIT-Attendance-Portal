import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'attendance.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

student_id = 2
student = cur.execute("SELECT * FROM students WHERE id=?", (student_id,)).fetchone()
print(f"Student: {student['name']} | Section: {student['section']} | Year: {student['year']}")

section = student['section']
year = student['year']

q = """
    SELECT s.*, sub.subject_name, sub.subject_code, f.name AS faculty_name
    FROM attendance_sessions s
    JOIN subjects sub ON sub.id=s.subject_id
    JOIN faculty f ON f.id=s.faculty_id
    WHERE s.status='active'
"""
params = []

if section:
    q += " AND (sub.section IS NULL OR LOWER(sub.section)=LOWER(?))"
    params.append(section)
if year:
    q += " AND (sub.year IS NULL OR sub.year=?)"
    params.append(year)

print(f"\nQuery: {q}")
print(f"Params: {params}")

rows = cur.execute(q, params).fetchall()
print(f"\nFound {len(rows)} active sessions for this student.")
for r in rows:
    print(dict(r))

conn.close()
