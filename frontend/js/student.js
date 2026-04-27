/* ═══════════════════════════════════════════════
   student.js — Student Dashboard Logic
   ═══════════════════════════════════════════════ */

// ── Guard ─────────────────────────────────────────────────────────────────────
if (!requireStudent()) throw new Error('Blocked');

// ── State ─────────────────────────────────────────────────────────────────────
const student       = getUser();
let faceCapture     = null;
let pendingSessionId = null;
let capturedImage   = null;
let refreshTimer    = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  populateStudentInfo();
  await loadActiveSessions();
  await loadMyAttendance();
  startAutoRefresh();
});

function populateStudentInfo() {
  const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('studentNameDisplay').textContent    = student.name;
  document.getElementById('studentRollDisplay').textContent    = student.roll_number;
  document.getElementById('studentAvatar').textContent         = initials;
  document.getElementById('faceRegistered').textContent        = student.face_registered ? '✅ Registered' : '⚠️ Not Registered';
  document.getElementById('faceRegistered').className         += student.face_registered ? ' badge-success' : ' badge-warning';
}

// ── Geolocation Watch (Removed) ────────────────────────────────────────────────

// ── Active Sessions ────────────────────────────────────────────────────────────
async function loadActiveSessions() {
  const grid = document.getElementById('sessionsGrid');
  grid.innerHTML = '<div class="no-sessions"><span class="emoji">⏳</span>Loading sessions…</div>';

  const { data } = await apiRequest('/student/sessions');
  if (!data.success) {
    grid.innerHTML = '<div class="no-sessions"><span class="emoji">❌</span>Could not load sessions</div>';
    return;
  }



  if (!data.sessions.length) {
    grid.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding:24px">
          <span class="emoji">📭</span> No active attendance sessions right now.
        </td>
      </tr>`;
    return;
  }

  grid.innerHTML = data.sessions.map(s => `
    <tr class="${s.already_marked ? 'marked' : ''}" style="${s.already_marked ? 'opacity:0.7;background:#f9fafb;' : ''}">
      <td>
        <strong>${s.subject_name}</strong>
        <div class="text-muted text-sm">${s.subject_code}</div>
      </td>
      <td class="hide-on-mobile">${s.faculty_name}</td>
      <td class="hide-on-mobile">${s.time_window || 'Any'}</td>
      <td class="hide-on-mobile">${s.geo_fence_radius}m</td>
      <td>
        ${s.already_marked
          ? `<span class="badge badge-success">✅ Marked</span>`
          : `<button class="btn btn-primary btn-sm" onclick="initiateMarkAttendance(${s.id}, '${s.subject_name}')">📲 Mark</button>`
        }
      </td>
    </tr>
  `).join('');
}

// ── Attendance History ─────────────────────────────────────────────────────────
async function loadMyAttendance() {
  const { data } = await apiRequest('/student/history');
  if (!data.success) return;



  const tbody = document.getElementById('myAttendanceBody');
  if (!data.records.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:24px">No attendance records yet</td></tr>';
    return;
  }
  tbody.innerHTML = data.records.map((r, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${fmtDateTime(r.time_marked)}</td>
      <td>${statusBadge(r.face_verification_status)}</td>
      <td class="hide-on-mobile">${statusBadge(r.marked_by)}</td>
    </tr>
  `).join('');
}

// ── Auto refresh ───────────────────────────────────────────────────────────────
function startAutoRefresh() {
  refreshTimer = setInterval(async () => {
    await loadActiveSessions();
    await loadMyAttendance();
  }, 5000);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK ATTENDANCE FLOW
// ══════════════════════════════════════════════════════════════════════════════

async function initiateMarkAttendance(sessionId, subjectName) {
  pendingSessionId = sessionId;

  // Check face registration
  if (!student.face_registered) {
    showToast('You must register your face first. Go to Profile.', 'error');
    return;
  }

  // Update modal heading
  document.getElementById('attendanceSubjectName').textContent = subjectName;

  // Reset steps
  setStep('stepLive', 'pending');
  setStep('stepFace', 'pending');
  document.getElementById('captureBtn').disabled = true;
  document.getElementById('submitAttendanceBtn').style.display = 'none';
  capturedImage = null;

  openModal('attendanceModal');

  // Step 1: Start webcam and liveness
  setStep('stepLive', 'active');
  await startWebcam();
}

async function startWebcam() {
  faceCapture = new FaceCapture('webcamVideo', 'webcamCanvas');

  faceCapture.onLivenessUpdate = (score, message) => {
    const pct = Math.round(score * 100);
    const fill = document.getElementById('livenessFill');
    fill.style.width  = pct + '%';
    fill.className    = 'liveness-fill ' + (pct > 70 ? 'good' : pct > 35 ? 'mid' : 'bad');
    document.getElementById('livenessLabel').textContent = message;

    const chip = document.getElementById('faceStatusChip');
    chip.textContent  = pct > 70 ? '✅ Liveness OK' : '⏳ Analysing…';
    chip.style.background = pct > 70 ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.15)';
    chip.style.color      = pct > 70 ? 'var(--success)' : 'var(--warning)';

    if (score >= 0.65) {
      setStep('stepLive', 'done');
      setStep('stepFace', 'active');
      document.getElementById('captureBtn').disabled = false;
    }
  };

  try {
    await faceCapture.start();
  } catch (err) {
    showToast(err.message, 'error');
    setStep('stepLive', 'fail');
    closeModal('attendanceModal');
  }
}

function captureFrame() {
  if (!faceCapture) return;
  capturedImage = faceCapture.capture();
  document.getElementById('captureBtn').textContent = '🔄 Retake';
  document.getElementById('submitAttendanceBtn').style.display = 'block';
  setStep('stepFace', 'done');
  showToast('Frame captured! Submit when ready.', 'info');
}

async function submitAttendance() {
  if (!capturedImage || !pendingSessionId) {
    showToast('Missing data. Please try again.', 'error');
    return;
  }

  const btn = document.getElementById('submitAttendanceBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Verifying…';

  try {
    const payload = {
      session_id: pendingSessionId,
      face_image: capturedImage
    };

    const { data } = await apiRequest('/student/attendance', {
      method: 'POST',
      body:   JSON.stringify(payload)
    });

    if (data.success) {
      showToast('🎉 Attendance marked successfully!', 'success', 5000);
      closeAttendanceModal();
      await loadActiveSessions();
      await loadMyAttendance();
    } else {
      showToast(`❌ ${data.message}`, 'error', 6000);
      btn.disabled = false;
      btn.textContent = '✅ Submit Attendance';
    }
  } catch (err) {
    showToast('Network error. Please retry.', 'error');
    btn.disabled = false;
    btn.textContent = '✅ Submit Attendance';
  }
}

function closeAttendanceModal() {
  if (faceCapture) { faceCapture.stop(); faceCapture = null; }
  closeModal('attendanceModal');
  pendingSessionId = null;
  capturedImage    = null;
  document.getElementById('captureBtn').textContent = '📸 Capture';
  document.getElementById('submitAttendanceBtn').style.display = 'none';
}

// ── Step indicator helper ──────────────────────────────────────────────────────
function setStep(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `face-step ${state}`;
  const icons = { done: '✅', active: '⏳', fail: '❌', pending: '⬜' };
  el.querySelector('.face-step-icon').textContent = icons[state] || '⬜';
}

// ── Face Registration Modal ────────────────────────────────────────────────────
let regCapture = null;

async function openFaceRegModal() {
  openModal('faceRegModal');
  regCapture = new FaceCapture('regVideo', 'regCanvas');
  regCapture.onLivenessUpdate = (score, msg) => {
    document.getElementById('regLivenessMsg').textContent = msg;
    document.getElementById('regCaptureBtn').disabled = score < 0.6;
  };
  try {
    await regCapture.start();
  } catch (err) {
    showToast(err.message, 'error');
    closeModal('faceRegModal');
  }
}

async function captureAndRegisterFace() {
  if (!regCapture) return;
  const b64 = regCapture.capture();
  const btn = document.getElementById('regCaptureBtn');
  btn.disabled = true; btn.textContent = '⏳ Registering…';

  const { data } = await apiRequest('/student/face', { method: 'POST', body: JSON.stringify({ face_data: b64 }) });
  if (data && data.success) {
    showToast('Face registered successfully!', 'success');
    student.face_registered = true;
    localStorage.setItem('ga_user', JSON.stringify(student));
    populateStudentInfo();
    closeFaceRegModal();
  } else {
    showToast(data ? data.message : 'Face registration failed', 'error');
    btn.disabled = false; btn.textContent = '📸 Capture & Register';
  }
}

function closeFaceRegModal() {
  if (regCapture) { regCapture.stop(); regCapture = null; }
  closeModal('faceRegModal');
}

// ── Modals ─────────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('active');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    const id = e.target.id;
    if (id === 'attendanceModal') closeAttendanceModal();
    else if (id === 'faceRegModal') closeFaceRegModal();
    else e.target.classList.remove('active');
  }
});

// Cleanup on page leave
window.addEventListener('beforeunload', () => {
  if (faceCapture) faceCapture.stop();
  if (regCapture)  regCapture.stop();
  if (refreshTimer) clearInterval(refreshTimer);
});
