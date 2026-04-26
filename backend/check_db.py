import sqlite3
conn = sqlite3.connect(r'c:\Geo-Attendance\backend\attendance.db')
conn.row_factory = sqlite3.Row

print('=== FACULTY TABLE ===')
for r in conn.execute('SELECT id, name, email, created_at FROM faculty'):
    print(f'  ID:{r[0]} | {r[1]} | {r[2]} | {r[3]}')

print()
print('=== STUDENTS TABLE ===')
for r in conn.execute('SELECT id, name, roll_number, email, section, year FROM students'):
    print(f'  ID:{r[0]} | {r[1]} | {r[2]} | {r[3]} | Sec:{r[4]} | Year:{r[5]}')

print()
print('=== ALL TABLES ===')
for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
    print(f'  - {r[0]}')

conn.close()
