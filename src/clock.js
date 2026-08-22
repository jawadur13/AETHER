// Aether Chrono-Resonator Clock Renderer

export class ChronoClock {
  constructor(canvas, clockTextEl, dateTextEl, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.clockText = clockTextEl;
    this.dateText = dateTextEl;
    this.audio = audioEngine;
    
    this.animationId = null;
    
    // Scale Canvas
    this.resize();
    window.addEventListener("resize", () => this.resize());
    
    // Orbit angles for smoothing transitions
    this.angles = { hr: 0, min: 0, sec: 0 };
    
    this.lastHarmonySec = null;
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  start() {
    const tick = () => {
      this.updateTime();
      this.draw();
      this.animationId = requestAnimationFrame(tick);
    };
    this.animationId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  updateTime() {
    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();
    const secs = now.getSeconds();
    const ms = now.getMilliseconds();
    
    // Text readout
    const pad = (n) => String(n).padStart(2, '0');
    if (this.clockText) {
      this.clockText.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    
    if (this.dateText) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      this.dateText.textContent = now.toLocaleDateString('en-US', options).toUpperCase();
    }
    
    // Convert time to smooth radial angles (interpolated using sub-second precision)
    const smoothSec = secs + ms / 1000;
    const smoothMin = mins + smoothSec / 60;
    const smoothHr = (hrs % 12) + smoothMin / 60;
    
    this.angles.sec = (smoothSec / 60) * Math.PI * 2 - Math.PI / 2;
    this.angles.min = (smoothMin / 60) * Math.PI * 2 - Math.PI / 2;
    this.angles.hr = (smoothHr / 12) * Math.PI * 2 - Math.PI / 2;
    
    // Update synthesis chords reliably once per second
    if (this.audio && this.audio.initialized && this.audio.isPlaying && secs !== this.lastHarmonySec) {
      this.lastHarmonySec = secs;
      const telemetry = this.audio.updateClockHarmonies();
      if (telemetry) {
        this.updateDOMTelemetry(telemetry);
      }
    }
    
    // Continuous filter sweep driven by smooth sub-second progress
    if (this.audio && this.audio.initialized && this.audio.isPlaying) {
      this.audio.updateClockSweep(smoothSec / 60);
    }
  }

  updateDOMTelemetry(telemetry) {
    const rootEl = document.getElementById("val-root-freq");
    const chordEl = document.getElementById("val-chord-interval");
    
    if (rootEl) rootEl.textContent = telemetry.rootFreq;
    if (chordEl) chordEl.textContent = telemetry.chordName;
  }

  draw() {
    const w = this.canvas.width / window.devicePixelRatio;
    const h = this.canvas.height / window.devicePixelRatio;
    const cx = w / 2;
    const cy = h / 2;
    
    this.ctx.clearRect(0, 0, w, h);
    
    // Draw subtle digital radar grid
    this.drawRadarGrid(cx, cy, w, h);
    
    // Orbit Radii
    const maxRadius = Math.min(cx, cy) * 0.85;
    const hrRadius = maxRadius * 0.42;
    const minRadius = maxRadius * 0.70;
    const secRadius = maxRadius * 0.92;
    
    // Draw Orbits
    this.drawOrbitRing(cx, cy, hrRadius, "rgba(124, 58, 237, 0.15)", "HOUR LINE");
    this.drawOrbitRing(cx, cy, minRadius, "rgba(6, 182, 212, 0.15)", "MINUTE LINE");
    this.drawOrbitRing(cx, cy, secRadius, "rgba(236, 72, 153, 0.12)", "SECOND LINE");
    
    // Draw Orbit pointers (glowing satellite points)
    this.drawPointer(cx, cy, hrRadius, this.angles.hr, "#7c3aed", 8, "HR");
    this.drawPointer(cx, cy, minRadius, this.angles.min, "#06b6d4", 6, "MIN");
    this.drawPointer(cx, cy, secRadius, this.angles.sec, "#ec4899", 4, "SEC");
    
    // Draw vector geometric lines connecting pointers
    this.drawConnectingVectors(cx, cy, hrRadius, minRadius, secRadius);
  }

  drawRadarGrid(cx, cy, w, h) {
    this.ctx.strokeStyle = "rgba(124, 58, 237, 0.04)";
    this.ctx.lineWidth = 1;
    
    // Crosshair lines
    this.ctx.beginPath();
    this.ctx.moveTo(0, cy);
    this.ctx.lineTo(w, cy);
    this.ctx.moveTo(cx, 0);
    this.ctx.lineTo(cx, h);
    this.ctx.stroke();
    
    // Concentric grid circles
    for (let r = 30; r < Math.max(w, h); r += 60) {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  drawOrbitRing(cx, cy, radius, strokeColor, labelText) {
    // Solid ring
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Dotted markings
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    this.ctx.setLineDash([2, 10]);
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset
    
    // Small ticks label
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    this.ctx.font = "8px 'Share Tech Mono'";
    this.ctx.textAlign = "left";
    this.ctx.fillText(labelText, cx + 10, cy - radius + 4);
  }

  drawPointer(cx, cy, radius, angle, color, size, label) {
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    
    // Outer glow
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = color;
    
    // Inner fill
    this.ctx.fillStyle = "#ffffff";
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.arc(px, py, size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Reset shadow
    this.ctx.shadowBlur = 0;
    
    // Label tag
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    this.ctx.font = "9px 'Share Tech Mono'";
    this.ctx.textAlign = "center";
    this.ctx.fillText(label, px, py - size - 8);
  }

  drawConnectingVectors(cx, cy, r1, r2, r3) {
    // Extract points
    const p1x = cx + Math.cos(this.angles.hr) * r1;
    const p1y = cy + Math.sin(this.angles.hr) * r1;
    
    const p2x = cx + Math.cos(this.angles.min) * r2;
    const p2y = cy + Math.sin(this.angles.min) * r2;
    
    const p3x = cx + Math.cos(this.angles.sec) * r3;
    const p3y = cy + Math.sin(this.angles.sec) * r3;
    
    // Triangular link vectors
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(p1x, p1y);
    this.ctx.lineTo(p2x, p2y);
    this.ctx.lineTo(p3x, p3y);
    this.ctx.closePath();
    this.ctx.stroke();
    
    // Central radial connections
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy); this.ctx.lineTo(p1x, p1y);
    this.ctx.moveTo(cx, cy); this.ctx.lineTo(p2x, p2y);
    this.ctx.moveTo(cx, cy); this.ctx.lineTo(p3x, p3y);
    this.ctx.stroke();
  }
}
