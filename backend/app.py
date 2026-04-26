"""
app.py — Flask backend for Geo-Attendance System
Provides auth (register/login), faculty, and student API endpoints.
"""
import os, math, re
from datetime import datetime, timezone, timedelta
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import bcrypt, jwt

from db_init import get_db, init_db

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

JWT_SECRET = os.environ.get('JWT_SECRET', 'mgit-geo-attendance-secret-2026')

# ── Helpers ────────────────────────────────────────────────────────────────────

def dict_row(row):
    if row is None:
        return None
    return dict(row)

def hash_pw(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def check_pw(password, hashed):
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id, role, email):
    payload = {
        'id': user_id, 'role': role, 'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
        if not token:
            return jsonify(success=False, message='No token provided'), 401
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            request.user = data
        except jwt.ExpiredSignatureError:
            return jsonify(success=False, message='Token expired'), 401
        except jwt.InvalidTokenError:
            return jsonify(success=False, message='Invalid token'), 401
        return f(*args, **kwargs)
    return decorated

def require_role(role):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if request.user.get('role') != role:
                return jsonify(success=False, message=f'{role} role required'), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def now_iso():
    return datetime.now(timezone.utc).isoformat()

# Email format: faculty = no digits  |  student = contains digits
FACULTY_EMAIL_RE = re.compile(r'^[^@\d]+@mgit\.ac\.in$')
STUDENT_EMAIL_RE = re.compile(r'^[^@]*\d[^@]*@mgit\.ac\.in$')

def is_faculty_email(email):
    return bool(FACULTY_EMAIL_RE.match(email))

def is_student_email(email):
    return bool(STUDENT_EMAIL_RE.match(email))

def haversine(lat1, lng1, lat2, lng2):
    R = 6371000
    r = math.pi / 180
    dlat = (lat2 - lat1) * r
    dlng = (lng2 - lng1) * r
    a = math.sin(dlat/2)**2 + math.cos(lat1*r)*math.cos(lat2*r)*math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

# ── Health ─────────────────────────────────────────────────────────────────────

@app.route('/api/health')
def health():
    return jsonify(status='ok', time=now_iso())

# ══════════════════════════════════════════════════════════════════════════════
#  AUTH ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/auth/register/faculty', methods=['POST'])
def register_faculty():
    d = request.json or {}
    name, email, pw = d.get('name'), d.get('email'), d.get('password')
    if not all([name, email, pw]):
        return jsonify(success=False, message='Name, email and password required'), 400
    if not is_faculty_email(email):
        return jsonify(success=False, message='Invalid faculty email. Faculty emails must end in @mgit.ac.in and contain NO numbers.'), 400
    if is_student_email(email):
        return jsonify(success=False, message='This looks like a student email because it contains numbers. Faculty emails cannot contain numbers.'), 400
    db = get_db()
    if db.execute('SELECT id FROM faculty WHERE email=?', (email,)).fetchone():
        db.close()
        return jsonify(success=False, message='Email already registered'), 409
    cur = db.execute('INSERT INTO faculty(name,email,password_hash) VALUES(?,?,?)',
                     (name, email, hash_pw(pw)))
    db.commit()
    uid = cur.lastrowid
    db.close()
    token = create_token(uid, 'faculty', email)
    return jsonify(success=True, message='Faculty registered!', token=token,
                   role='faculty', user={'id':uid,'name':name,'email':email}), 201

@app.route('/api/auth/register/student', methods=['POST'])
def register_student():
    d = request.json or {}
    name = d.get('name'); email = d.get('email')
    roll = d.get('roll_number'); pw = d.get('password')
    section = d.get('section'); year = d.get('year')
    if not all([name, roll, email, pw]):
        return jsonify(success=False, message='Name, roll, email, password required'), 400
    if not is_student_email(email):
        return jsonify(success=False, message='Invalid student email. Student emails must end in @mgit.ac.in and contain your unique numbers (e.g. arjun_cse2405@mgit.ac.in).'), 400
    if is_faculty_email(email):
        return jsonify(success=False, message='This looks like a faculty email because it has no numbers. Student emails must contain numbers.'), 400
    db = get_db()
    if db.execute('SELECT id FROM students WHERE email=?', (email,)).fetchone():
        db.close()
        return jsonify(success=False, message='Email already registered'), 409
    if db.execute('SELECT id FROM students WHERE roll_number=?', (roll,)).fetchone():
        db.close()
        return jsonify(success=False, message='Roll number already registered'), 409
    cur = db.execute(
        'INSERT INTO students(name,roll_number,email,password_hash,section,year) VALUES(?,?,?,?,?,?)',
        (name, roll, email, hash_pw(pw), section, year))
    db.commit()
    uid = cur.lastrowid
    db.close()
    token = create_token(uid, 'student', email)
    return jsonify(success=True, message='Student registered!', token=token,
                   role='student',
                   user={'id':uid,'name':name,'email':email,'roll_number':roll,
                         'section':section,'year':year}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    d = request.json or {}
    email, pw, role = d.get('email'), d.get('password'), d.get('role')
    if not all([email, pw, role]):
        return jsonify(success=False, message='Email, password, role required'), 400
    # Validate email matches role
    if role == 'faculty' and not is_faculty_email(email):
        return jsonify(success=False, message='This is not a faculty email. Faculty emails cannot contain numbers.'), 400
    if role == 'student' and not is_student_email(email):
        return jsonify(success=False, message='This is not a student email. Student emails must contain numbers.'), 400
    db = get_db()
    if role == 'faculty':
        user = dict_row(db.execute('SELECT * FROM faculty WHERE email=?', (email,)).fetchone())
    elif role == 'student':
        user = dict_row(db.execute('SELECT * FROM students WHERE email=?', (email,)).fetchone())
    else:
        db.close()
        return jsonify(success=False, message='Invalid role'), 400
    db.close()
    if not user:
        return jsonify(success=False, message='No account found. Please register first.'), 401
    if not check_pw(pw, user['password_hash']):
        return jsonify(success=False, message='Incorrect password.'), 401
    token = create_token(user['id'], role, user['email'])
    u = {'id':user['id'],'name':user['name'],'email':user['email']}
    if role == 'student':
        u.update(roll_number=user['roll_number'], section=user['section'],
                 year=user['year'], face_registered=bool(user['face_registered']))
    return jsonify(success=True, message=f"Welcome back, {user['name']}!",
                   token=token, role=role, user=u)

# ══════════════════════════════════════════════════════════════════════════════
#  FACULTY ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/faculty/subjects', methods=['GET'])
@token_required
@require_role('faculty')
def get_subjects():
    db = get_db()
    rows = db.execute(
        'SELECT id, subject_name AS name, subject_code AS code, section, year, semester '
        'FROM subjects WHERE faculty_assigned=?', (request.user['id'],)).fetchall()
    db.close()
    return jsonify(success=True, subjects=[dict(r) for r in rows])

@app.route('/api/faculty/subjects', methods=['POST'])
@token_required
@require_role('faculty')
def add_subject():
    d = request.json or {}
    db = get_db()
    cur = db.execute(
        'INSERT INTO subjects(subject_name,subject_code,section,year,semester,faculty_assigned) '
        'VALUES(?,?,?,?,?,?)',
        (d.get('name'), d.get('code'), d.get('section'), d.get('year'),
         d.get('semester'), request.user['id']))
    db.commit()
    sub = {'id':cur.lastrowid,'name':d.get('name'),'code':d.get('code'),
           'section':d.get('section'),'year':d.get('year'),'semester':d.get('semester')}
    db.close()
    return jsonify(success=True, subject=sub)

@app.route('/api/faculty/subjects/<int:sid>', methods=['DELETE'])
@token_required
@require_role('faculty')
def del_subject(sid):
    db = get_db()
    db.execute('DELETE FROM subjects WHERE id=? AND faculty_assigned=?', (sid, request.user['id']))
    db.commit(); db.close()
    return jsonify(success=True)

@app.route('/api/faculty/session/start', methods=['POST'])
@token_required
@require_role('faculty')
def start_session():
    d = request.json or {}
    db = get_db()
    sub = dict_row(db.execute('SELECT * FROM subjects WHERE id=? AND faculty_assigned=?',
                              (d.get('subject_id'), request.user['id'])).fetchone())
    if not sub:
        db.close()
        return jsonify(success=False, message='Subject not found'), 404
    now = now_iso()
    cur = db.execute(
        "INSERT INTO attendance_sessions(faculty_id,subject_id,date,start_time,"
        "geo_fence_lat,geo_fence_lng,geo_fence_radius,status) VALUES(?,?,?,?,?,?,?,'active')",
        (request.user['id'], d['subject_id'], now, now,
         d.get('geo_fence_lat'), d.get('geo_fence_lng'), d.get('geo_fence_radius', 100)))
    db.commit()
    total = db.execute('SELECT COUNT(*) AS c FROM students').fetchone()['c']
    sess = {'id':cur.lastrowid,'subject_id':d['subject_id'],
            'subject_name':sub['subject_name'],'subject_code':sub['subject_code'],
            'geo_fence_lat':d.get('geo_fence_lat'),'geo_fence_lng':d.get('geo_fence_lng'),
            'geo_fence_radius':d.get('geo_fence_radius',100),
            'start_time':now,'date':now,'status':'active','present_count':0,'total_students':total}
    db.close()
    return jsonify(success=True, session=sess)

@app.route('/api/faculty/session/<int:sid>/stop', methods=['PUT'])
@token_required
@require_role('faculty')
def stop_session(sid):
    db = get_db()
    db.execute("UPDATE attendance_sessions SET status='completed', end_time=? "
               "WHERE session_id=? AND faculty_id=?", (now_iso(), sid, request.user['id']))
    db.commit(); db.close()
    return jsonify(success=True)

@app.route('/api/faculty/session/<int:sid>/live', methods=['GET'])
@token_required
@require_role('faculty')
def live_session(sid):
    db = get_db()
    sess = dict_row(db.execute('SELECT * FROM attendance_sessions WHERE session_id=? AND faculty_id=?',
                               (sid, request.user['id'])).fetchone())
    if not sess:
        db.close()
        return jsonify(success=False), 404
    sub = dict_row(db.execute('SELECT * FROM subjects WHERE id=?', (sess['subject_id'],)).fetchone())
    present = [dict(r) for r in db.execute(
        'SELECT ar.*, s.name AS student_name, s.roll_number '
        'FROM attendance_records ar JOIN students s ON s.id=ar.student_id '
        'WHERE ar.session_id=?', (sid,)).fetchall()]
        
    # Get all students for this subject's section and year
    q = 'SELECT id, name AS student_name, roll_number FROM students WHERE 1=1'
    params = []
    if sub and sub.get('section'):
        q += ' AND section=?'
        params.append(sub['section'])
    if sub and sub.get('year'):
        q += ' AND year=?'
        params.append(sub['year'])
        
    all_students = [dict(r) for r in db.execute(q, params).fetchall()]
    total = len(all_students) if all_students else db.execute('SELECT COUNT(*) AS c FROM students').fetchone()['c']
    
    present_ids = {r['student_id'] for r in present}
    absent = [s for s in all_students if s['id'] not in present_ids]
    
    db.close()
    sd = {'id':sess['session_id'],'subject_id':sess['subject_id'],
          'subject_name':sub['subject_name'] if sub else '',
          'subject_code':sub['subject_code'] if sub else '',
          'geo_fence_lat':sess['geo_fence_lat'],'geo_fence_lng':sess['geo_fence_lng'],
          'geo_fence_radius':sess['geo_fence_radius'],
          'start_time':sess['start_time'],'end_time':sess['end_time'],
          'date':sess['date'],'status':sess['status'],
          'present_count':len(present),'total_students':total}
    return jsonify(success=True, session=sd, present=present, absent=absent,
                   present_count=len(present), absent_count=len(absent), total=total)

@app.route('/api/faculty/sessions', methods=['GET'])
@token_required
@require_role('faculty')
def list_sessions():
    db = get_db()
    q = ('SELECT s.*, sub.subject_name, sub.subject_code '
         'FROM attendance_sessions s JOIN subjects sub ON sub.id=s.subject_id '
         'WHERE s.faculty_id=?')
    params = [request.user['id']]
    if request.args.get('status'):
        q += ' AND s.status=?'; params.append(request.args['status'])
    if request.args.get('subject_id'):
        q += ' AND s.subject_id=?'; params.append(request.args['subject_id'])
    if request.args.get('date'):
        q += ' AND s.date LIKE ?'; params.append(request.args['date']+'%')
    q += ' ORDER BY s.date DESC'
    rows = db.execute(q, params).fetchall()
    db.close()
    sessions = [{'id':r['session_id'],'subject_id':r['subject_id'],
                 'subject_name':r['subject_name'],'subject_code':r['subject_code'],
                 'geo_fence_lat':r['geo_fence_lat'],'geo_fence_lng':r['geo_fence_lng'],
                 'geo_fence_radius':r['geo_fence_radius'],
                 'start_time':r['start_time'],'end_time':r['end_time'],
                 'date':r['date'],'status':r['status']} for r in rows]
    return jsonify(success=True, sessions=sessions)

@app.route('/api/faculty/students', methods=['GET'])
@token_required
@require_role('faculty')
def list_students():
    db = get_db()
    q = 'SELECT id,name,roll_number,email,section,year,face_registered FROM students WHERE 1=1'
    params = []
    if request.args.get('section'):
        q += ' AND LOWER(section)=LOWER(?)'; params.append(request.args['section'])
    if request.args.get('year'):
        q += ' AND year=?'; params.append(int(request.args['year']))
    rows = db.execute(q, params).fetchall()
    db.close()
    return jsonify(success=True, students=[dict(r) for r in rows])

@app.route('/api/faculty/session/<int:sid>/manual', methods=['POST'])
@token_required
@require_role('faculty')
def manual_mark(sid):
    d = request.json or {}
    db = get_db()
    sess = dict_row(db.execute('SELECT * FROM attendance_sessions WHERE session_id=?', (sid,)).fetchone())
    stud = dict_row(db.execute('SELECT * FROM students WHERE id=?', (d.get('student_id'),)).fetchone())
    if not sess or not stud:
        db.close()
        return jsonify(success=False, message='Not found'), 404
    if db.execute('SELECT record_id FROM attendance_records WHERE session_id=? AND student_id=?',
                  (sid, stud['id'])).fetchone():
        db.close()
        return jsonify(success=False, message='Already marked present'), 400
    now = now_iso()
    cur = db.execute(
        "INSERT INTO attendance_records(session_id,student_id,time_marked,"
        "face_verification_status,marked_by,notes,student_lat,student_lng) "
        "VALUES(?,?,?,'manual','manual',?,?,?)",
        (sid, stud['id'], now, d.get('notes'), sess['geo_fence_lat'], sess['geo_fence_lng']))
    db.commit()
    rec = {'id':cur.lastrowid,'session_id':sid,'student_id':stud['id'],
           'student_name':stud['name'],'roll_number':stud['roll_number'],
           'time_marked':now,'face_verification_status':'manual','marked_by':'manual'}
    db.close()
    return jsonify(success=True, record=rec)

@app.route('/api/faculty/attendance/<int:aid>', methods=['PUT'])
@token_required
@require_role('faculty')
def edit_attendance(aid):
    d = request.json or {}
    db = get_db()
    db.execute('UPDATE attendance_records SET face_verification_status=?, notes=? WHERE record_id=?',
               (d.get('face_verification_status'), d.get('notes'), aid))
    db.commit(); db.close()
    return jsonify(success=True)

@app.route('/api/faculty/attendance/<int:aid>', methods=['DELETE'])
@token_required
@require_role('faculty')
def delete_attendance(aid):
    db = get_db()
    db.execute('DELETE FROM attendance_records WHERE record_id=?', (aid,))
    db.commit(); db.close()
    return jsonify(success=True)

# ══════════════════════════════════════════════════════════════════════════════
#  STUDENT ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/student/sessions', methods=['GET'])
@token_required
@require_role('student')
def student_sessions():
    db = get_db()
    rows = db.execute(
        "SELECT s.*, sub.subject_name, sub.subject_code, f.name AS faculty_name "
        "FROM attendance_sessions s "
        "JOIN subjects sub ON sub.id=s.subject_id "
        "JOIN faculty f ON f.id=s.faculty_id "
        "WHERE s.status='active' ORDER BY s.start_time DESC").fetchall()
    db.close()
    sessions = [{'id':r['session_id'],'subject_name':r['subject_name'],
                 'subject_code':r['subject_code'],'faculty_name':r['faculty_name'],
                 'geo_fence_lat':r['geo_fence_lat'],'geo_fence_lng':r['geo_fence_lng'],
                 'geo_fence_radius':r['geo_fence_radius'],
                 'start_time':r['start_time'],'date':r['date'],'status':r['status']} for r in rows]
    return jsonify(success=True, sessions=sessions)

@app.route('/api/student/attendance', methods=['POST'])
@token_required
@require_role('student')
def mark_attendance():
    d = request.json or {}
    sid = d.get('session_id')
    uid = request.user['id']
    db = get_db()
    sess = dict_row(db.execute(
        "SELECT * FROM attendance_sessions WHERE session_id=? AND status='active'", (sid,)).fetchone())
    if not sess:
        db.close()
        return jsonify(success=False, message='Session not found or stopped'), 404
    if db.execute('SELECT record_id FROM attendance_records WHERE session_id=? AND student_id=?',
                  (sid, uid)).fetchone():
        db.close()
        return jsonify(success=False, message='Already marked'), 400
    slat, slng = d.get('student_lat'), d.get('student_lng')
    if sess['geo_fence_lat'] and slat and slng:
        dist = haversine(sess['geo_fence_lat'], sess['geo_fence_lng'], slat, slng)
        radius = sess['geo_fence_radius'] or 100
        if dist > radius:
            db.close()
            return jsonify(success=False,
                           message=f'Too far: {int(dist)}m away, must be within {int(radius)}m'), 403
    now = now_iso()
    cur = db.execute(
        "INSERT INTO attendance_records(session_id,student_id,time_marked,"
        "face_verification_status,marked_by,student_lat,student_lng) VALUES(?,?,?,?,'auto',?,?)",
        (sid, uid, now, d.get('face_verification_status','pending'), slat, slng))
    db.commit()
    db.close()
    return jsonify(success=True, message='Attendance marked!',
                   record={'id':cur.lastrowid,'session_id':sid,'student_id':uid,
                           'time_marked':now,'marked_by':'auto'})

@app.route('/api/student/history', methods=['GET'])
@token_required
@require_role('student')
def student_history():
    db = get_db()
    rows = db.execute(
        'SELECT ar.*, s.date AS session_date, sub.subject_name, sub.subject_code, f.name AS faculty_name '
        'FROM attendance_records ar '
        'JOIN attendance_sessions s ON s.session_id=ar.session_id '
        'JOIN subjects sub ON sub.id=s.subject_id '
        'JOIN faculty f ON f.id=s.faculty_id '
        'WHERE ar.student_id=? ORDER BY ar.time_marked DESC', (request.user['id'],)).fetchall()
    db.close()
    return jsonify(success=True, records=[dict(r) for r in rows])

@app.route('/api/student/face', methods=['POST'])
@token_required
@require_role('student')
def register_face():
    d = request.json or {}
    if not d.get('face_data'):
        return jsonify(success=False, message='Face data required'), 400
    db = get_db()
    db.execute('UPDATE students SET registered_face_data=?, face_registered=1 WHERE id=?',
               (d['face_data'], request.user['id']))
    db.commit(); db.close()
    return jsonify(success=True, message='Face registered!')

# ── Serve frontend ─────────────────────────────────────────────────────────────

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    print("\n[START] Geo-Attendance API running at http://127.0.0.1:5000")
    print("  Health check: http://127.0.0.1:5000/api/health\n")
    app.run(host='0.0.0.0', port=5000, debug=True)
