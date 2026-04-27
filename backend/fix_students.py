import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'attendance.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

print("Updating all students to Section 'A', Year 2...")
cur.execute("UPDATE students SET section='A', year=2")
conn.commit()

# Verify
student = cur.execute("SELECT name, section, year FROM students LIMIT 1").fetchone()
print(f"Verified: {student[0]} is now in Section {student[1]}, Year {student[2]}")

conn.close()
