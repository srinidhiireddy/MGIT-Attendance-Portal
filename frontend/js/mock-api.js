const DB_KEY = 'geoattend_db';

function getDB() {
  const db = localStorage.getItem(DB_KEY);
  if (db) return JSON.parse(db);
  return {
    subjects: [
      { id: 1, name: "Managerial Economics (BEFA)", code: "BEFA", section: "A", year: 2, semester: 4 },
      { id: 2, name: "Discrete Mathematics (DM)", code: "DM", section: "A", year: 2, semester: 4 },
      { id: 3, name: "Operating Systems (OS)", code: "OS", section: "A", year: 2, semester: 4 },
      { id: 4, name: "Database Management (DBMS)", code: "DBMS", section: "A", year: 2, semester: 4 },
      { id: 5, name: "Software Engineering (SE)", code: "SE", section: "A", year: 2, semester: 4 },
      { id: 6, name: "Real Time Programming (RTP)", code: "RTP", section: "A", year: 2, semester: 4 },
      { id: 7, name: "Node JS (NODE JS)", code: "NODE JS", section: "A", year: 2, semester: 4 },
      { id: 8, name: "Constitution of India (COI)", code: "COI", section: "A", year: 2, semester: 4 }
    ],
    sessions: [],
    attendance: [],
    students: [
      { id: 101, name: "Arjun Reddy", roll_number: "21CS001", email: "arjun@mgit.ac.in", section: "A", year: 2, face_registered: true, password: "password123" },
      { id: 102, name: "Priya Sharma", roll_number: "21CS002", email: "priya@mgit.ac.in", section: "A", year: 2, face_registered: true, password: "password123" },
      { id: 103, name: "Rahul Kumar", roll_number: "21CS003", email: "rahul@mgit.ac.in", section: "A", year: 2, face_registered: false, password: "password123" },
      { id: 104, name: "Sneha Patel", roll_number: "21CS004", email: "sneha@mgit.ac.in", section: "A", year: 2, face_registered: true, password: "password123" },
      { id: 105, name: "Vikram Singh", roll_number: "21CS005", email: "vikram@mgit.ac.in", section: "A", year: 2, face_registered: true, password: "password123" }
    ],
    faculty: [
      { id: 1, name: "Dr. Faculty", email: "faculty@mgit.ac.in", password: "password123" }
    ],
    lastId: { subject: 8, session: 0, attendance: 0, student: 105, faculty: 1 }
  };
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Global mockApi
window.mockApi = {
  request: async function(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    let body = options.body ? JSON.parse(options.body) : null;
    let db = getDB();

    console.log(`[Mock API] ${method} ${path}`, body || '');
    
    // Add artificial delay for realism
    await new Promise(r => setTimeout(r, 400));

    // Auth Routes
    if (path === '/auth/login') {
      if (method === 'POST') {
        const { email, password, role } = body;
        let user;
        if (role === 'faculty') user = db.faculty.find(f => f.email === email && f.password === password);
        else user = db.students.find(s => s.email === email && s.password === password);
        
        if (user) {
          // Always assign success
          return { ok: true, status: 200, data: { success: true, token: 'mock-token-' + Date.now(), role, user } };
        } else {
          // Just mock success anyway for convenience as requested to bypass backend directly
          // We will construct a dummy user if not found
          const mockUser = role === 'faculty' ? 
            { id: 1, name: email.split('@')[0], email } : 
            { id: 101, name: email.split('@')[0], email, roll_number: "UNKNOWN", section: "A", year: 2, face_registered: true };
          return { ok: true, status: 200, data: { success: true, token: 'mock-token-' + Date.now(), role, user: mockUser } };
        }
      }
    }

    if (path.startsWith('/auth/register')) {
      if (method === 'POST') {
        const role = path.includes('faculty') ? 'faculty' : 'student';
        const newUser = { id: ++db.lastId[role], ...body, face_registered: true };
        db[role === 'faculty' ? 'faculty' : 'students'].push(newUser);
        saveDB(db);
        return { ok: true, status: 200, data: { success: true, token: 'mock-token-' + Date.now(), role, user: newUser } };
      }
    }

    // Routes
    if (path.startsWith('/faculty/subjects')) {
      if (method === 'GET') return { ok: true, status: 200, data: { success: true, subjects: db.subjects } };
      if (method === 'POST') {
        const newSub = { id: ++db.lastId.subject, ...body };
        db.subjects.push(newSub);
        saveDB(db);
        return { ok: true, status: 200, data: { success: true, subject: newSub } };
      }
      if (method === 'DELETE') {
        const id = parseInt(path.split('/').pop());
        db.subjects = db.subjects.filter(s => s.id !== id);
        saveDB(db);
        return { ok: true, status: 200, data: { success: true } };
      }
    }

    if (path.startsWith('/faculty/session/start')) {
      if (method === 'POST') {
        const sub = db.subjects.find(s => s.id === body.subject_id);
        const newSess = {
          id: ++db.lastId.session,
          subject_id: body.subject_id,
          subject_name: sub.name,
          subject_code: sub.code,
          geo_fence_lat: body.geo_fence_lat,
          geo_fence_lng: body.geo_fence_lng,
          geo_fence_radius: body.geo_fence_radius,
          time_window: body.time_window,
          start_time: new Date().toISOString(),
          date: new Date().toISOString(),
          status: 'active',
          present_count: 0,
          total_students: db.students.filter(s => s.section === sub.section && s.year === sub.year).length || db.students.length
        };
        db.sessions.push(newSess);
        saveDB(db);
        
        // Real app: Do not simulate students. Only registered students using the app can mark attendance.

        return { ok: true, status: 200, data: { success: true, session: newSess } };
      }
    }

    if (path.match(/\/faculty\/session\/(\d+)\/stop/)) {
      if (method === 'PUT') {
        const id = parseInt(path.match(/\/faculty\/session\/(\d+)\/stop/)[1]);
        const sess = db.sessions.find(s => s.id === id);
        if (sess) {
          sess.status = 'completed';
          sess.end_time = new Date().toISOString();
          saveDB(db);
        }
        return { ok: true, status: 200, data: { success: true } };
      }
    }

    if (path.match(/\/faculty\/session\/(\d+)\/live/)) {
      if (method === 'GET') {
        const id = parseInt(path.match(/\/faculty\/session\/(\d+)\/live/)[1]);
        const sess = db.sessions.find(s => s.id === id);
        if (!sess) return { ok: true, status: 404, data: { success: false } };
        const present = db.attendance.filter(a => a.session_id === id);
        
        return { ok: true, status: 200, data: { 
          success: true, 
          session: sess,
          present: present,
          present_count: present.length,
          absent_count: sess.total_students - present.length,
          total: sess.total_students
        } };
      }
    }

    if (path.startsWith('/faculty/sessions')) {
      if (method === 'GET') {
        const params = new URLSearchParams(path.split('?')[1]);
        let filtered = [...db.sessions];
        if (params.get('status')) filtered = filtered.filter(s => s.status === params.get('status'));
        if (params.get('subject_id')) filtered = filtered.filter(s => s.subject_id === parseInt(params.get('subject_id')));
        if (params.get('date')) filtered = filtered.filter(s => s.date.startsWith(params.get('date')));
        
        filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
        return { ok: true, status: 200, data: { success: true, sessions: filtered } };
      }
    }

    if (path.startsWith('/faculty/students')) {
      if (method === 'GET') {
        const params = new URLSearchParams(path.split('?')[1]);
        let filtered = [...db.students];
        if (params.get('section')) filtered = filtered.filter(s => s.section.toLowerCase() === params.get('section').toLowerCase());
        if (params.get('year')) filtered = filtered.filter(s => s.year === parseInt(params.get('year')));
        return { ok: true, status: 200, data: { success: true, students: filtered } };
      }
    }

    if (path.match(/\/faculty\/session\/(\d+)\/manual/)) {
      if (method === 'POST') {
        const id = parseInt(path.match(/\/faculty\/session\/(\d+)\/manual/)[1]);
        const stud = db.students.find(s => s.id === body.student_id);
        const sess = db.sessions.find(s => s.id === id);
        
        if (db.attendance.some(a => a.session_id === id && a.student_id === stud.id)) {
          return { ok: true, status: 400, data: { success: false, message: 'Student already present' } };
        }

        const newAtt = {
          id: ++db.lastId.attendance,
          session_id: id,
          student_id: stud.id,
          student_name: stud.name,
          roll_number: stud.roll_number,
          time_marked: new Date().toISOString(),
          face_verification_status: 'manual',
          notes: body.notes,
          student_lat: sess.geo_fence_lat,
          student_lng: sess.geo_fence_lng
        };
        db.attendance.push(newAtt);
        saveDB(db);
        return { ok: true, status: 200, data: { success: true, record: newAtt } };
      }
    }

    if (path.match(/\/faculty\/attendance\/(\d+)/)) {
      const id = parseInt(path.match(/\/faculty\/attendance\/(\d+)/)[1]);
      if (method === 'PUT') {
        const att = db.attendance.find(a => a.id === id);
        if (att) {
          att.face_verification_status = body.face_verification_status;
          att.notes = body.notes;
          saveDB(db);
        }
        return { ok: true, status: 200, data: { success: true } };
      }
      if (method === 'DELETE') {
        db.attendance = db.attendance.filter(a => a.id !== id);
        saveDB(db);
        return { ok: true, status: 200, data: { success: true } };
      }
    }
    
    if (path.startsWith('/student/sessions')) {
      if (method === 'GET') {
        let active = db.sessions.filter(s => s.status === 'active');
        // enrich with faculty name
        active = active.map(s => {
          return { ...s, faculty_name: "Dr. Faculty" };
        });
        return { ok: true, status: 200, data: { success: true, sessions: active } };
      }
    }

    if (path === '/student/attendance') {
      if (method === 'POST') {
        const { session_id, student_lat, student_lng, face_verification_status } = body;
        const sess = db.sessions.find(s => s.id === session_id);
        const user = localStorage.getItem('ga_user') ? JSON.parse(localStorage.getItem('ga_user')) : db.students[0];
        
        if (!sess || sess.status !== 'active') return { ok: true, status: 404, data: { success: false, message: 'Session not active' } };
        if (db.attendance.some(a => a.session_id === session_id && a.student_id === user.id)) return { ok: true, status: 400, data: { success: false, message: 'Already marked' } };

        const newAtt = {
          id: ++db.lastId.attendance,
          session_id: session_id,
          student_id: user.id,
          student_name: user.name,
          roll_number: user.roll_number,
          time_marked: new Date().toISOString(),
          face_verification_status: face_verification_status,
          student_lat: student_lat,
          student_lng: student_lng,
          marked_by: 'auto'
        };
        db.attendance.push(newAtt);
        sess.present_count++;
        saveDB(db);
        return { ok: true, status: 200, data: { success: true, record: newAtt } };
      }
    }

    if (path === '/student/history') {
      if (method === 'GET') {
        const user = localStorage.getItem('ga_user') ? JSON.parse(localStorage.getItem('ga_user')) : db.students[0];
        const records = db.attendance.filter(a => a.student_id === user.id).map(a => {
          const sess = db.sessions.find(s => s.id === a.session_id);
          return { ...a, session_date: sess.date, subject_name: sess.subject_name, subject_code: sess.subject_code, faculty_name: 'Dr. Faculty' };
        });
        records.sort((a,b) => new Date(b.time_marked) - new Date(a.time_marked));
        return { ok: true, status: 200, data: { success: true, records } };
      }
    }

    if (path === '/student/face') {
      if (method === 'POST') {
        return { ok: true, status: 200, data: { success: true, message: 'Face registered!' } };
      }
    }
    
    return { ok: true, status: 404, data: { success: false, message: 'Not found' } };
  }
};

