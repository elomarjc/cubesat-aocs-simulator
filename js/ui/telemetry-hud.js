/**
 * Real-Time Spacecraft Mission Telemetry HUD & Strip Chart
 */

export class TelemetryHUD {
  constructor() {
    // Elements
    this.elEuler = document.getElementById('val-euler');
    this.elRates = document.getElementById('val-rates');
    this.elQuat = document.getElementById('val-quat');
    this.elKinetic = document.getElementById('val-kinetic');
    this.elAlt = document.getElementById('val-alt');
    this.elSpeed = document.getElementById('val-speed');
    this.elAnomaly = document.getElementById('val-anomaly');
    this.elEclipse = document.getElementById('val-eclipse');
    this.elBField = document.getElementById('val-bfield');
    this.elGSElev = document.getElementById('val-gs-elev');
    this.elGSDist = document.getElementById('val-gs-dist');
    this.elGSLink = document.getElementById('val-gs-link');
    this.badgeGS = document.getElementById('badge-gs');
    this.elSSP = document.getElementById('val-ssp');
    this.hudSSPVal = document.getElementById('hud-ssp-val');
    this.hudSSPLink = document.getElementById('hud-ssp-link');

    // Reaction wheels bars
    this.barRWX = document.getElementById('rw-bar-x');
    this.barRWY = document.getElementById('rw-bar-y');
    this.barRWZ = document.getElementById('rw-bar-z');
    this.valRWX = document.getElementById('rw-val-x');
    this.valRWY = document.getElementById('rw-val-y');
    this.valRWZ = document.getElementById('rw-val-z');

    // Magnetorquer meters
    this.barMTQX = document.getElementById('mtq-bar-x');
    this.barMTQY = document.getElementById('mtq-bar-y');
    this.barMTQZ = document.getElementById('mtq-bar-z');
    this.valMTQX = document.getElementById('mtq-val-x');
    this.valMTQY = document.getElementById('mtq-val-y');
    this.valMTQZ = document.getElementById('mtq-val-z');

    // Strip Chart Canvas setup
    this.canvas = document.getElementById('chart-canvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.chartHistory = []; // Array of { time, rateDegS }
      this.maxHistoryPoints = 200;
    }
  }

  update(dynState, orbState, bFieldBody, sunInfo, gsInfo, cmdMTQ, cmdRW) {
    const rad2deg = 180 / Math.PI;

    // 1. Attitude & Rates
    const euler = dynState.q.toEulerDegrees();
    if (this.elEuler) {
      this.elEuler.textContent = `R:${euler.roll.toFixed(1)}° P:${euler.pitch.toFixed(1)}° Y:${euler.yaw.toFixed(1)}°`;
    }

    const rateDeg = dynState.omega.length() * rad2deg;
    if (this.elRates) {
      this.elRates.textContent = `${rateDeg.toFixed(2)}°/s [X:${(dynState.omega.x*rad2deg).toFixed(1)} Y:${(dynState.omega.y*rad2deg).toFixed(1)} Z:${(dynState.omega.z*rad2deg).toFixed(1)}]`;
    }

    if (this.elQuat) {
      this.elQuat.textContent = `[${dynState.q.q0.toFixed(3)}, ${dynState.q.q1.toFixed(3)}, ${dynState.q.q2.toFixed(3)}, ${dynState.q.q3.toFixed(3)}]`;
    }

    if (this.elKinetic) {
      this.elKinetic.textContent = `${(dynState.kineticEnergyJoules * 1000).toFixed(2)} mJ`;
    }

    // 2. Orbital State
    if (orbState.ssp) {
      if (this.elSSP) this.elSSP.textContent = orbState.ssp.coordStr;
      if (this.hudSSPVal) this.hudSSPVal.textContent = orbState.ssp.coordStr;
    }
    if (this.hudSSPLink) {
      if (gsInfo.hasLOS) {
        this.hudSSPLink.innerHTML = '<span style="color: var(--accent-green); font-weight: 700;">AOS (CONNECTED)</span>';
      } else {
        this.hudSSPLink.innerHTML = '<span style="color: var(--text-dim);">LOS (STANDBY)</span>';
      }
    }
    if (this.elAlt) this.elAlt.textContent = `${orbState.altitudeKm.toFixed(1)} km`;
    if (this.elSpeed) this.elSpeed.textContent = `${orbState.orbitalSpeedKms.toFixed(2)} km/s`;
    if (this.elAnomaly) this.elAnomaly.textContent = `${orbState.trueAnomalyDeg.toFixed(1)}°`;

    if (this.elEclipse) {
      if (sunInfo.isEclipse) {
        this.elEclipse.innerHTML = '<span style="color: #ff3d00;">🌑 ECLIPSE (UMBRA)</span>';
      } else {
        this.elEclipse.innerHTML = '<span style="color: #ffd600;">☀️ SUNLIGHT (1361 W/m²)</span>';
      }
    }

    if (this.elBField) {
      const bMagNano = bFieldBody.length() * 1e9;
      this.elBField.textContent = `${bMagNano.toFixed(0)} nT`;
    }

    // 3. Aalborg Ground Station
    if (this.elGSElev) this.elGSElev.textContent = `${gsInfo.elevationDeg.toFixed(1)}°`;
    if (this.elGSDist) this.elGSDist.textContent = `${gsInfo.distanceKm.toFixed(0)} km`;
    if (this.elGSLink) {
      if (gsInfo.hasLOS) {
        this.elGSLink.innerHTML = `<span style="color: var(--accent-green); font-weight: 700;">AOS (LINK MARGIN +${gsInfo.linkMarginDb?.toFixed(1) || '12.4'} dB)</span>`;
      } else {
        this.elGSLink.innerHTML = `<span style="color: var(--text-dim);">LOS (OUT OF SIGHT)</span>`;
      }
    }

    if (this.badgeGS) {
      if (gsInfo.hasLOS) {
        this.badgeGS.classList.add('active-gs');
        this.badgeGS.textContent = 'AALBORG GS: CONNECTED (AOS)';
      } else {
        this.badgeGS.classList.remove('active-gs');
        this.badgeGS.textContent = 'AALBORG GS: STANDBY';
      }
    }

    // 4. Reaction Wheels Bars (6500 RPM max)
    const maxRPM = 6500;
    const updateBar = (barEl, valEl, rpm) => {
      if (!barEl || !valEl) return;
      valEl.textContent = `${Math.round(rpm)} RPM`;
      const pct = Math.min(100, (Math.abs(rpm) / maxRPM) * 100);
      barEl.style.width = `${pct}%`;
      if (pct > 95) {
        barEl.classList.add('saturated');
      } else {
        barEl.classList.remove('saturated');
      }
    };
    updateBar(this.barRWX, this.valRWX, dynState.wheelRPM.x);
    updateBar(this.barRWY, this.valRWY, dynState.wheelRPM.y);
    updateBar(this.barRWZ, this.valRWZ, dynState.wheelRPM.z);

    // 5. Magnetorquers (0.2 A*m^2 max)
    const maxDipole = 0.2;
    const updateMTQ = (barEl, valEl, dipole) => {
      if (!barEl || !valEl) return;
      valEl.textContent = `${dipole.toFixed(3)} A·m²`;
      const pct = Math.min(100, (Math.abs(dipole) / maxDipole) * 100);
      barEl.style.width = `${pct}%`;
    };
    updateMTQ(this.barMTQX, this.valMTQX, cmdMTQ.x);
    updateMTQ(this.barMTQY, this.valMTQY, cmdMTQ.y);
    updateMTQ(this.barMTQZ, this.valMTQZ, cmdMTQ.z);

    // 6. Update Strip Chart
    this.updateChart(orbState.time, rateDeg);
  }

  updateChart(time, rateDeg) {
    if (!this.canvas || !this.ctx) return;
    this.chartHistory.push({ time, rate: rateDeg });
    if (this.chartHistory.length > this.maxHistoryPoints) {
      this.chartHistory.shift();
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 80;

    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(24, 40, 72, 0.6)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Chart label
    ctx.fillStyle = '#798da3';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText('ANGULAR VELOCITY DAMPING |ω| (°/s) vs TIME', 8, 14);

    if (this.chartHistory.length < 2) return;

    // Find max rate for scaling
    let maxRate = 5.0;
    for (const pt of this.chartHistory) {
      if (pt.rate > maxRate) maxRate = pt.rate;
    }
    maxRate = Math.ceil(maxRate * 1.2);

    // Plot line
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const dx = w / (this.maxHistoryPoints - 1);
    const startIdx = this.maxHistoryPoints - this.chartHistory.length;

    for (let i = 0; i < this.chartHistory.length; i++) {
      const pt = this.chartHistory[i];
      const x = (startIdx + i) * dx;
      const y = h - 6 - (pt.rate / maxRate) * (h - 24);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Latest value readout on chart
    const latest = this.chartHistory[this.chartHistory.length - 1];
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(`${latest.rate.toFixed(2)} °/s`, w - 70, 14);
    ctx.restore();
  }
}
