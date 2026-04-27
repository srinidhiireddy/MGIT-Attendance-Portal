import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'attendance.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("--- STUDENTS ---")
rows = cur.execute("SELECT id, name, email, roll_number FROM students").fetchall()
for r in rows:
    print(dict(r))

print("\n--- FACULTY ---")
rows = cur.execute("SELECT id, name, email FROM faculty").fetchall()
for r in rows:
    print(dict(r))

print("\n--- SUBJECTS ---")
rows = cur.execute("SELECT * FROM subjects").fetchall()
for r in rows:
    print(dict(r))

conn.close()
