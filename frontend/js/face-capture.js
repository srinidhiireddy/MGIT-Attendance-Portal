/* ═══════════════════════════════════════════════════════════
   face-capture.js — Webcam, liveness detection (client-side
   feedback), and face image capture for submission.
   Real liveness & identity verification is done SERVER-SIDE.
   ═══════════════════════════════════════════════════════════ */

class FaceCapture {
  constructor(videoId, canvasId) {
    this.video    = document.getElementById(videoId);
    this.canvas   = document.getElementById(canvasId);
    this.stream   = null;
    this.running  = false;
    this.frameReq = null;

    // State
    this.blinkCount   = 0;
    this.eyeWasClosed = false;
    this.frameCount   = 0;
    this.livenessOk   = false;
    this.capturedB64  = null;

    // Callbacks
    this.onLivenessUpdate = null;   // (score: 0-1, message: string) => void
    this.onStatusChange   = null;   // (step: string, state: 'active'|'done'|'fail') => void
    this.onReady          = null;   // () => void  — ready to capture
  }

  // ── Start webcam ─────────────────────────────────────────────────────────
  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.running = true;
      this._analyzeLoop();
      return true;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access.'
        : 'Could not access camera: ' + err.message;
      throw new Error(msg);
    }
  }

  // ── Stop webcam ───────────────────────────────────────────────────────────
  stop() {
    this.running = false;
    if (this.frameReq) cancelAnimationFrame(this.frameReq);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  // ── Capture current frame as base64 ──────────────────────────────────────
  capture(quality = 0.88) {
    const ctx = this.canvas.getContext('2d');
    this.canvas.width  = this.video.videoWidth  || 640;
    this.canvas.height = this.video.videoHeight || 480;
    ctx.drawImage(this.video, 0, 0);
    this.capturedB64 = this.canvas.toDataURL('image/jpeg', quality);
    return this.capturedB64;
  }

  // ── Client-side liveness analysis loop ───────────────────────────────────
  // This provides real-time visual feedback; definitive check is server-side.
  _analyzeLoop() {
    if (!this.running) return;

    this.frameCount++;
    // Only analyze every 6th frame for performance
    if (this.frameCount % 6 === 0 && this.video.readyState >= 2) {
      this._analyzeFrame();
    }

    this.frameReq = requestAnimationFrame(() => this._analyzeLoop());
  }

  _analyzeFrame() {
    const ctx = this.canvas.getContext('2d');
    this.canvas.width  = this.video.videoWidth  || 640;
    this.canvas.height = this.video.videoHeight || 480;

    // Mirror effect for natural selfie feel
    ctx.save();
    ctx.translate(this.canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.video, 0, 0);
    ctx.restore();

    // Extract pixel data for brightness/texture analysis
    const imageData = ctx.getImageData(
      this.canvas.width * 0.25, this.canvas.height * 0.15,
      this.canvas.width * 0.5,  this.canvas.height * 0.7
    );

    const analysis = this._analyzePixels(imageData);
    this._updateFeedback(analysis);
  }

  _analyzePixels(imageData) {
    const d = imageData.data;
    let r = 0, g = 0, b = 0, variance = 0;
    const count = d.length / 4;

    for (let i = 0; i < d.length; i += 4) {
      r += d[i]; g += d[i+1]; b += d[i+2];
    }
    const avgR = r / count, avgG = g / count, avgB = b / count;
    const brightness = (avgR + avgG + avgB) / 3;

    // Texture variance (Laplacian-like)
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
      variance += (gray - brightness) ** 2;
    }
    variance = Math.sqrt(variance / count);

    // Skin tone detection (very rough heuristic)
    const skinLike = avgR > 95 && avgG > 40 && avgB > 20
                  && avgR > avgG && avgR > avgB
                  && (avgR - avgG) > 10
                  && avgR < 240;

    return { brightness, variance, skinLike };
  }

  _updateFeedback({ brightness, variance, skinLike }) {
    let score   = 0;
    let message = '';
    let ready   = false;

    if (brightness < 30) {
      message = '🌑 Too dark — find better lighting';
      score   = 0.05;
    } else if (brightness > 240) {
      message = '☀️ Overexposed — reduce light source';
      score   = 0.1;
    } else if (variance < 8) {
      // Very flat image — likely a photo on screen
      message = '🖼️ Flat image detected — show your real face';
      score   = 0.1;
    } else if (!skinLike) {
      message = '🔍 Centre your face in the frame';
      score   = 0.3;
    } else if (variance < 18) {
      message = '🔄 Hold still… analysing';
      score   = 0.55;
    } else {
      message = '✅ Face detected — click Capture';
      score   = 0.85 + Math.min(0.15, variance / 300);
      ready   = true;
    }

    this.livenessOk = ready;
    if (this.onLivenessUpdate) this.onLivenessUpdate(score, message);
    if (ready && this.onReady)  this.onReady();
  }
}


/* ═══════════════════════════════════════════════════════════
   Face Registration helper
   ═══════════════════════════════════════════════════════════ */
async function registerFace(imageB64) {
  const res = await apiRequest('/auth/register/face', {
    method: 'POST',
    body: JSON.stringify({ image: imageB64 })
  });
  return res.data;
}
