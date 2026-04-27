/* ═══════════════════════════════════════════════
   faculty.js — Faculty Dashboard Logic
   ═══════════════════════════════════════════════ */

// ── Guard ─────────────────────────────────────────────────────────────────────
if (!requireFaculty()) throw new Error('Blocked');

// ── State ─────────────────────────────────────────────────────────────────────
const faculty       = getUser();
let subjects        = [];
let activeSession   = null;
let liveRefreshTimer = null;
let selectedFenceLat = null;
let selectedFenceLng = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  populateFacultyInfo();
  await loadSubjects();
  await checkActiveSession();
  showSection('overview');

  const radiusInput = document.getElementById('fenceRadius');
  if (radiusInput) {
    radiusInput.addEventListener('input', e => {
      document.getElementById('radiusDisplay').textContent = e.target.value + ' m';
    });
  }
});

function populateFacultyInfo() {
  document.getElementById('facultyName').textContent      = faculty.name;
  document.getElementById('sidebarFacultyName').textContent = faculty.name;
  document.getElementById('sidebarFacultyDept').textContent = faculty.department || 'Faculty';
  document.getElementById('facultyInitials').textContent  =
    faculty.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Navigation ─────────────────────────────────────────────────────────────────
function showSection(id) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  
  document.getElementById(`sec-${id}`).classList.add('active');
  document.getElementById(`nav-${id}`).classList.add('active');
  
  // Also close mobile sidebar if open
  document.querySelector('.sidebar').classList.remove('mobile-open');
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) overlay.classList.remove('active');

  // Lazy load section data
  if (id === 'overview')  refreshOverview();
  if (id === 'subjects')  renderSubjectsGrid();
  if (id === 'start')     populateSubjectSelect();
  if (id === 'live')      { if (activeSession) loadLiveAttendance(); }
  if (id === 'reports')   loadReports();
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('active');
}

// ── Subjects ──────────────────────────────────────────────────────────────────
async function loadSubjects() {
  const { data } = await apiRequest('/faculty/subjects');
  if (data.success) {
    subjects = data.subjects;
    populateSubjectSelect();
    renderSubjectsGrid();
    updateOverviewStats();
  }
}

function populateSubjectSelect() {
  const sel = document.getElementById('sessionSubjectSelect');
  const rpt = document.getElementById('reportSubjectFilter');
  [sel, rpt].forEach(el => {
    if (!el) return;
    el.innerHTML = '<option value="">— Select Subject —</option>';
    subjects.forEach(s => {
      el.innerHTML += `<option value="${s.id}">${s.name} (${s.code})</option>`;
    });
  });
}

function renderSubjectsGrid() {
  const grid = document.getElementById('subjectsGrid');
  if (!grid) return;
  if (!subjects.length) {
    grid.innerHTML = `<div class="no-sessions"><span class="emoji">📚</span>No subjects assigned yet. Add one below.</div>`;
    return;
  }
  grid.innerHTML = subjects.map(s => `
    <div class="subject-card">
      <div>
        <div class="subject-card-code">${s.code}</div>
        <div class="subject-card-name">${s.name}</div>
      </div>
      <div class="subject-card-meta">
        <span>📅 Year ${s.year || '—'}</span>
        <span>🏫 Sec ${s.section || '—'}</span>
        <span>📖 Sem ${s.semester || '—'}</span>
      </div>
      <div class="subject-card-actions">
        <button class="btn btn-primary btn-sm" onclick="startSessionForSubject(${s.id})">▶ Start Session</button>
        <button class="btn btn-outline btn-sm" onclick="deleteSubject(${s.id})">🗑</button>
      </div>
    </div>
  `).join('');
}

async function addSubject(e) {
  e.preventDefault();
  const payload = {
    name:     document.getElementById('subjectName').value.trim(),
    code:     document.getElementById('subjectCode').value.trim(),
    section:  document.getElementById('subjectSection').value.trim(),
    year:     parseInt(document.getElementById('subjectYear').value),
    semester: parseInt(document.getElementById('subjectSemester').value)
  };
  const { data } = await apiRequest('/faculty/subjects', {
    method: 'POST', body: JSON.stringify(payload)
  });
  if (data.success) {
    showToast(`Subject "${payload.name}" added!`, 'success');
    e.target.reset();
    await loadSubjects();
  } else {
    showToast(data.message || 'Failed to add subject', 'error');
  }
}

async function deleteSubject(id) {
  if (!confirm('Delete this subject?')) return;
  const { data } = await apiRequest(`/faculty/subjects/${id}`, { method: 'DELETE' });
  if (data.success) { showToast('Subject deleted', 'info'); await loadSubjects(); }
  else showToast(data.message, 'error');
}

function startSessionForSubject(sid) {
  showSection('start');
  document.getElementById('sessionSubjectSelect').value = sid;
}

// ── Session Start / Stop ───────────────────────────────────────────────────────
async function startSession(e) {
  e.preventDefault();
  const subjectId = document.getElementById('sessionSubjectSelect').value;
  const timeWindow = document.getElementById('sessionTimeWindow').value;
  if (!subjectId) return showToast('Please select a subject', 'error');
  if (!timeWindow) return showToast('Please select a time window', 'error');

  const btn = document.getElementById('startSessionBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Acquiring Location...';
  }

  try {
    const pos = await getCurrentPosition();
    selectedFenceLat = pos.latitude;
    selectedFenceLng = pos.longitude;
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '▶ Start Attendance Session';
    }
    return showToast('Could not get your location. Please allow location access.', 'error');
  }

  const payload = {
    subject_id:       parseInt(subjectId),
    time_window:      timeWindow,
    geo_fence_lat:    selectedFenceLat,
    geo_fence_lng:    selectedFenceLng,
    geo_fence_radius: parseInt(document.getElementById('fenceRadius').value)
  };

  const { data } = await apiRequest('/faculty/session/start', {
    method: 'POST', body: JSON.stringify(payload)
  });
  if (data.success) {
    activeSession = data.session;
    showToast('Attendance session started!', 'success');
    updateActiveBanner();
    startLiveRefresh();
    showSection('live');
  } else {
    showToast(data.message || 'Failed to start session', 'error');
  }
  
  if (btn) {
    btn.disabled = false;
    btn.textContent = '▶ Start Attendance Session';
  }
}

async function stopSession() {
  if (!activeSession) return;
  if (!confirm('Stop this attendance session? Students will no longer be able to mark attendance.')) return;

  const { data } = await apiRequest(`/faculty/session/${activeSession.id}/stop`, { method: 'PUT' });
  if (data.success) {
    showToast('Session stopped', 'info');
    activeSession = null;
    stopLiveRefresh();
    updateActiveBanner();
    showSection('overview');
    await refreshOverview();
  } else {
    showToast(data.message, 'error');
  }
}

async function checkActiveSession() {
  const { data } = await apiRequest('/faculty/sessions?status=active');
  if (data.success && data.sessions.length) {
    activeSession = data.sessions[0];
    updateActiveBanner();
    startLiveRefresh();
  }
}

// ── Live Attendance ────────────────────────────────────────────────────────────
function startLiveRefresh() {
  if (liveRefreshTimer) clearInterval(liveRefreshTimer);
  liveRefreshTimer = setInterval(() => {
    if (activeSession && document.getElementById('sec-live').classList.contains('active')) {
      loadLiveAttendance();
    }
  }, 6000);
}
function stopLiveRefresh() {
  if (liveRefreshTimer) clearInterval(liveRefreshTimer);
}

async function loadLiveAttendance() {
  if (!activeSession) {
    document.getElementById('liveTableBody').innerHTML =
      '<tr><td colspan="7" class="text-center text-muted" style="padding:24px">No active session</td></tr>';
    return;
  }
  const { data } = await apiRequest(`/faculty/session/${activeSession.id}/live`);
  if (!data.success) return;

  // Stats
  document.getElementById('livePresentCount').textContent = data.present_count;
  document.getElementById('liveAbsentCount').textContent  = data.absent_count;
  document.getElementById('liveTotalCount').textContent   = data.total;

  // Present and Absent tables combined
  const tbody = document.getElementById('liveTableBody');
  
  const present = data.present || [];
  const absent = data.absent || [];
  
  if (!present.length && !absent.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px">⏳ Waiting for students…</td></tr>';
  } else {
    let html = '';
    
    // Render Present
    present.forEach((r, i) => {
      html += `
        <tr style="background-color: rgba(34, 197, 94, 0.05);">
          <td>${i+1}</td>
          <td><strong>${r.student_name || '—'}</strong></td>
          <td><code>${r.roll_number || '—'}</code></td>
          <td>${fmtDateTime(r.time_marked)}</td>
          <td>${statusBadge(r.face_verification_status)}</td>
          <td>${r.student_lat ? `${(+r.student_lat).toFixed(4)}, ${(+r.student_lng).toFixed(4)}` : '—'}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="openEditModal(${r.id}, '${r.student_name}')">✎ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteRecord(${r.id})">🗑</button>
          </td>
        </tr>
      `;
    });
    
    // Render Absent
    absent.forEach((r, i) => {
      html += `
        <tr style="background-color: rgba(239, 68, 68, 0.05); opacity: 0.8;">
          <td>${present.length + i + 1}</td>
          <td><strong>${r.student_name || '—'}</strong></td>
          <td><code>${r.roll_number || '—'}</code></td>
          <td>—</td>
          <td><span class="badge badge-danger">Absent</span></td>
          <td>—</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="openModal('manualModal'); document.getElementById('manualStudentSearch').value = '${r.student_name} (${r.roll_number})'; selectedManualStudentId = ${r.id};">Mark Present</button>
          </td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html;
  }
}

// ── Manual Attendance ─────────────────────────────────────────────────────────
let studentSearchResults = [];

async function searchStudents() {
  const q = document.getElementById('manualStudentSearch').value.trim();
  if (!q) return;
  const { data } = await apiRequest(`/faculty/students`);
  if (!data.success) return;

  studentSearchResults = data.students.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 8);

  const res = document.getElementById('studentSearchResults');
  if (!studentSearchResults.length) {
    res.innerHTML = '<div class="student-result-item text-muted">No students found</div>';
  } else {
    res.innerHTML = studentSearchResults.map(s => `
      <div class="student-result-item" onclick="selectStudent(${s.id}, '${s.name}', '${s.roll_number}')">
        <strong>${s.name}</strong> — <span class="text-muted">${s.roll_number}</span>
      </div>
    `).join('');
  }
}

let selectedManualStudentId = null;
function selectStudent(id, name, roll) {
  selectedManualStudentId = id;
  document.getElementById('manualStudentSearch').value = `${name} (${roll})`;
  document.getElementById('studentSearchResults').innerHTML = '';
}

async function addManualAttendance() {
  if (!activeSession) return showToast('No active session', 'error');
  if (!selectedManualStudentId) return showToast('Select a student first', 'error');

  const { data } = await apiRequest(`/faculty/session/${activeSession.id}/manual`, {
    method: 'POST',
    body: JSON.stringify({
      student_id: selectedManualStudentId,
      notes: document.getElementById('manualNotes').value
    })
  });

  if (data.success) {
    showToast('Manual attendance added!', 'success');
    closeModal('manualModal');
    loadLiveAttendance();
    selectedManualStudentId = null;
  } else {
    showToast(data.message, 'error');
  }
}

// ── Edit/Delete ────────────────────────────────────────────────────────────────
let editingRecordId = null;

function openEditModal(recordId, studentName) {
  editingRecordId = recordId;
  document.getElementById('editStudentName').textContent = studentName;
  document.getElementById('editNotes').value = '';
  openModal('editModal');
}

async function saveEditRecord() {
  if (!editingRecordId) return;
  const { data } = await apiRequest(`/faculty/attendance/${editingRecordId}`, {
    method: 'PUT',
    body: JSON.stringify({
      face_verification_status: document.getElementById('editStatus').value,
      notes: document.getElementById('editNotes').value
    })
  });
  if (data.success) {
    showToast('Record updated', 'success');
    closeModal('editModal');
    loadLiveAttendance();
  } else showToast(data.message, 'error');
}

async function deleteRecord(id) {
  if (!confirm('Delete this attendance record?')) return;
  const { data } = await apiRequest(`/faculty/attendance/${id}`, { method: 'DELETE' });
  if (data.success) { showToast('Record deleted', 'success'); loadLiveAttendance(); }
  else showToast(data.message, 'error');
}

// ── Reports ────────────────────────────────────────────────────────────────────
let reportSessions = [];

async function loadReports() {
  const subjectId = document.getElementById('reportSubjectFilter')?.value;
  const date      = document.getElementById('reportDateFilter')?.value;
  let url = '/faculty/sessions?';
  if (subjectId) url += `subject_id=${subjectId}&`;
  if (date)      url += `date=${date}&`;

  const { data } = await apiRequest(url);
  if (!data.success) return;
  reportSessions = data.sessions;

  const tbody = document.getElementById('reportsTableBody');
  if (!data.sessions.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px">No records found</td></tr>';
    return;
  }
  tbody.innerHTML = data.sessions.map(s => `
    <tr>
      <td>${fmtDate(s.date)}</td>
      <td><strong>${s.subject_name}</strong><br><span class="text-muted text-sm">${s.subject_code}</span></td>
      <td>${fmtTime(s.start_time)}</td>
      <td>${s.end_time ? fmtTime(s.end_time) : '<span class="badge badge-success">Active</span>'}</td>
      <td><strong>${s.present_count}</strong> / ${s.total_students}</td>
      <td>${statusBadge(s.status)}</td>
      <td class="export-btns">
        <button class="btn btn-outline btn-sm" onclick="downloadExport(${s.id}, 'excel')">📊 Excel</button>
        <button class="btn btn-outline btn-sm" onclick="downloadExport(${s.id}, 'pdf')">📄 PDF</button>
        <button class="btn btn-primary btn-sm" onclick="viewSessionLive(${s.id})">👁 View</button>
      </td>
    </tr>
  `).join('');
}

async function downloadExport(sessionId, format) {
  showToast(`Preparing ${format.toUpperCase()} download…`, 'info');
  const { data } = await apiRequest(`/faculty/session/${sessionId}/live`);
  if (!data || !data.success) { showToast('Export failed', 'error'); return; }
  const present = data.present || [];
  const absent = data.absent || [];
  
  let csvContent = "data:text/csv;charset=utf-8,Name,Roll Number,Time,Status\n";
  
  present.forEach(p => {
    csvContent += `"${p.student_name}","${p.roll_number}","${p.time_marked}","Present (${p.face_verification_status})"\n`;
  });
  
  absent.forEach(a => {
    csvContent += `"${a.student_name}","${a.roll_number}","-","Absent"\n`;
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `attendance_session_${sessionId}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function viewSessionLive(sessionId) {
  const { data } = await apiRequest(`/faculty/session/${sessionId}/live`);
  if (!data.success) return;
  // Temporarily show in live section
  activeSession = data.session;
  showSection('live');
  await loadLiveAttendance();
}

// ── Overview Stats ─────────────────────────────────────────────────────────────
async function refreshOverview() {
  const { data } = await apiRequest('/faculty/sessions');
  if (!data.success) return;
  const sessions = data.sessions;
  document.getElementById('statTotalSessions').textContent = sessions.length;
  document.getElementById('statActiveSessions').textContent = sessions.filter(s => s.status === 'active').length;
  document.getElementById('statTotalSubjects').textContent  = subjects.length;
  const totalPresent = sessions.reduce((a, s) => a + s.present_count, 0);
  document.getElementById('statTotalPresent').textContent   = totalPresent;

  // Recent sessions table
  const tbody = document.getElementById('recentSessionsBody');
  if (tbody) {
    tbody.innerHTML = sessions.slice(0, 5).map(s => `
      <tr>
        <td><strong>${s.subject_name}</strong></td>
        <td>${fmtDate(s.date)}</td>
        <td>${s.present_count} present</td>
        <td>${statusBadge(s.status)}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="viewSessionLive(${s.id})">View</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="text-center text-muted" style="padding:20px">No sessions yet</td></tr>';
  }
}

function updateOverviewStats() {
  document.getElementById('statTotalSubjects').textContent = subjects.length;
}

function updateActiveBanner() {
  const banner = document.getElementById('activeSessionBanner');
  const navLive = document.getElementById('nav-live');
  if (activeSession) {
    banner.style.display = 'flex';
    document.getElementById('bannerSubject').textContent = activeSession.subject_name + (activeSession.time_window ? ` (${activeSession.time_window})` : '');
    document.getElementById('bannerStartTime').textContent = fmtTime(activeSession.start_time);
    document.getElementById('bannerRadius').textContent = activeSession.geo_fence_radius + 'm';
    if (navLive) navLive.style.display = 'flex';
  } else {
    banner.style.display = 'none';
    if (navLive) navLive.style.display = 'none';
  }
}

// ── Modals ─────────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('active');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});
