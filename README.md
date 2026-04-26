# 🌍 MGIT Attendance Portal — Geo-Fenced Attendance System

A fully-featured web-based attendance system that requires students to be:
- **Physically inside a geo-fence** (validated server-side via Haversine formula)
- **Verified with real-time face recognition** + liveness detection (anti-spoofing)

---

## 📁 Project Structure

```
Geo-Attendance/
├── backend/
│   ├── app.py              # Flask entry point + seeder
│   ├── config.py           # App configuration
│   ├── models.py           # SQLAlchemy DB models
│   ├── auth.py             # Login, register, face registration APIs
│   ├── faculty.py          # Faculty API (sessions, subjects, export)
│   ├── student.py          # Student API (mark attendance)
│   ├── face_utils.py       # Face recognition + liveness detection
│   ├── geo_utils.py        # Haversine geo-fence validation
│   ├── export_utils.py     # Excel + PDF export
│   ├── requirements.txt
│   └── uploads/faces/      # Registered face images
└── frontend/
    ├── index.html              # Login page
    ├── faculty-dashboard.html  # Faculty portal
    ├── student-dashboard.html  # Student portal
    ├── css/
    │   ├── style.css       # Global design system
    │   ├── login.css       # Login page styles
    │   ├── faculty.css     # Faculty dashboard styles
    │   └── student.css     # Student dashboard styles
    └── js/
        ├── auth.js         # Token management, login, toast, helpers
        ├── geo.js          # Geolocation utilities
        ├── face-capture.js # Webcam + liveness feedback
        ├── faculty.js      # Faculty dashboard logic
        └── student.js      # Student dashboard logic
```

---

## ⚙️ Setup Instructions

### 1. Prerequisites

- **Python 3.9+**
- **pip**
- **Windows**: Install [CMake](https://cmake.org/download/) and [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (required by `dlib` / `face_recognition`)
- A working webcam
- Modern browser (Chrome/Edge recommended for WebRTC)

---

### 2. Install Backend Dependencies

```bash
cd Geo-Attendance\backend

# Create virtual environment (recommended)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

> **Note on `face_recognition`:** This library requires `dlib` which needs CMake.  
> On Windows, install `cmake` via pip first:
> ```bash
> pip install cmake
> pip install dlib
> pip install face_recognition
> ```
> If `dlib` fails, the system will still run — face verification will use a **dev bypass** (auto-match). All other features (geo-fence, sessions, export) work fully.

---

### 3. Run the Backend

```bash
cd Geo-Attendance\backend
python app.py
```

The server starts at **http://127.0.0.1:5000**

On first run it will:
- Create `attendance.db` (SQLite database)
- Seed demo faculty, students, and subjects automatically

**Demo credentials (auto-seeded):**

| Role    | Login                      | Password     |
|---------|----------------------------|--------------|
| Faculty | `priya@college.edu`        | `faculty123` |
| Faculty | `rahul@college.edu`        | `faculty123` |
| Faculty | `priya.sharma` (username)  | `faculty123` |
| Student | `21CS001`                  | `student123` |
| Student | `21CS002`                  | `student123` |
| Student | `arjun@students.college.edu` | `student123` |

---

### 4. Serve the Frontend

**Option A — VS Code Live Server (recommended):**
1. Open `Geo-Attendance/frontend/` in VS Code
2. Right-click `index.html` → **Open with Live Server**

**Option B — Python simple server:**
```bash
cd Geo-Attendance\frontend
python -m http.server 5500
```
Then open `http://localhost:5500`

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (faculty or student) |
| POST | `/api/auth/register/faculty` | Register faculty |
| POST | `/api/auth/register/student` | Register student |
| POST | `/api/auth/register/face` | Register student face (JWT required) |
| GET  | `/api/auth/me` | Get current user |
| GET  | `/api/faculty/subjects` | List faculty subjects |
| POST | `/api/faculty/subjects` | Create subject |
| POST | `/api/faculty/session/start` | Start attendance session |
| PUT  | `/api/faculty/session/:id/stop` | Stop session |
| GET  | `/api/faculty/session/:id/live` | Live attendance feed |
| GET  | `/api/faculty/sessions` | All sessions (filterable) |
| POST | `/api/faculty/session/:id/manual` | Add manual attendance |
| PUT  | `/api/faculty/attendance/:id` | Edit attendance record |
| DELETE | `/api/faculty/attendance/:id` | Delete record |
| GET  | `/api/faculty/session/:id/export?format=excel\|pdf` | Export report |
| GET  | `/api/student/active-sessions` | Active sessions for student |
| POST | `/api/student/mark-attendance` | Mark attendance (geo+face) |
| GET  | `/api/student/my-attendance` | Student's own history |

---

## 🔒 Security Features

| Feature | Implementation |
|---------|----------------|
| Password hashing | `bcrypt` |
| Authentication | JWT (8-hour access tokens) |
| Role-based access control | JWT claims (`role: faculty/student`) |
| Geo-fence validation | Server-side Haversine formula — client cannot spoof |
| Face liveness detection | MediaPipe Eye Aspect Ratio + texture variance |
| Anti-spoofing | Detects flat images (photos/screens), multiple faces, masked faces |
| Duplicate prevention | Unique DB constraint per `(session_id, student_id)` |
| Session ownership | Only the creating faculty can stop/edit their session |

---

## 🗄️ Database Schema

```
Faculty:             id, name, email, username, password_hash, department
Students:            id, name, roll_number, email, password_hash, section, year, face_encoding
Subjects:            id, name, code, faculty_id, section, year, semester
AttendanceSessions:  id, faculty_id, subject_id, date, start_time, end_time,
                     geo_fence_lat, geo_fence_lng, geo_fence_radius, status
AttendanceRecords:   id, session_id, student_id, time_marked, face_verification_status,
                     marked_by, student_lat, student_lng, distance_from_fence, liveness_score
```

---

## 🖥️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Python Flask + Flask-JWT-Extended |
| Database | SQLite (dev) / MySQL (prod via SQLAlchemy) |
| Face Recognition | `face_recognition` (dlib) + MediaPipe |
| Geo-Validation | Haversine formula (server-side) |
| Map | Leaflet.js (OpenStreetMap) |
| Export | openpyxl (Excel), reportlab (PDF) |

---

## 🚀 Switching to MySQL (Production)

1. Install MySQL and create a database:
   ```sql
   CREATE DATABASE geoattend CHARACTER SET utf8mb4;
   ```

2. Set environment variable before running:
   ```bash
   set DATABASE_URL=mysql+pymysql://user:password@localhost/geoattend
   python app.py
   ```

---

## ⚠️ Browser Requirements

- **HTTPS or localhost** is required for camera and geolocation APIs
- Allow camera permission when prompted
- Allow location permission when prompted
- Tested on Chrome 120+, Edge 120+, Firefox 121+
