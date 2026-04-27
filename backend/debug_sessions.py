import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'attendance.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("--- ACTIVE SESSIONS ---")
rows = cur.execute("SELECT * FROM attendance_sessions WHERE status='active'").fetchall()
for r in rows:
    print(dict(r))

print("\n--- SUBJECTS ---")
rows = cur.execute("SELECT id, subject_name, section, year FROM subjects").fetchall()
for r in rows:
    print(dict(r))

conn.close()
