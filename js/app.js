/**
 * CubeSat AOCS Flight Simulator - Main Application Orchestrator
 * Integrates Space Physics Engine, AOCS Flight Computer FSM, Three.js 3D Graphics, and Mission Control HUD.
 */

import { Vector3, Quaternion } from './physics/quaternion.js';
import { OrbitPropagator } from './physics/orbit.js';
import { MagneticFieldModel } from './physics/magnetic-field.js';
import { DisturbanceTorques } from './physics/disturbances.js';
import { SpacecraftDynamics } from './physics/dynamics.js';

import { BDotController } from './aocs/bdot.js';
import { NadirPointingController } from './aocs/nadir-pointing.js';
import { SunTrackingController } from './aocs/sun-tracking.js';
import { GroundStationTracker } from './aocs/ground-station.js';
import { MomentumDesaturationController } from './aocs/desaturation.js';

import { SpaceScene } from './graphics/scene.js';
import { EarthVisualizer } from './graphics/earth.js';
import { CubeSatModel } from './graphics/cubesat-model.js';
import { VectorVisualizer } from './graphics/vectors.js';

import { TelemetryHUD } from './ui/telemetry-hud.js';
import { TelemetryLogger } from './ui/data-export.js';

class CubeSatApp {
  constructor() {
    // 1. Initialize Subsystems
    this.orbit = new OrbitPropagator({ altitude: 500e3, inclinationDeg: 97.4 });
    this.mag = new MagneticFieldModel();
    this.disturbances = new DisturbanceTorques();
    this.dynamics = new SpacecraftDynamics();

    // 2. AOCS Flight Controllers
    this.bdot = new BDotController();
    this.nadir = new NadirPointingController();
    this.sunTrack = new SunTrackingController();
    this.gsTrack = new GroundStationTracker();
    this.desat = new MomentumDesaturationController();

    // 3. UI & Logging
    this.hud = new TelemetryHUD();
    this.logger = new TelemetryLogger();

    // 4. 3D Graphics Setup
    const container = document.getElementById('three-canvas-container');
    this.scene = new SpaceScene(container);
    this.earth = new EarthVisualizer(this.scene.scene);
    this.satMesh = new CubeSatModel(this.scene.scene);
    this.vectors = new VectorVisualizer(this.scene.scene);

    // Simulation State
    this.simTime = 0;
    this.timeWarp = 1.0; // 1x realtime
    this.isPaused = false;
    this.lastFrameTime = performance.now();

    // Active AOCS Flight Mode: 'DETUMBLE', 'NADIR', 'SUN_TRACK', 'GS_TRACK', 'DESAT', 'IDLE'
    this.flightMode = 'DETUMBLE';

    // Start with realistic initial tip-off spin (e.g. 20 deg/s around Y, 15 deg/s around Z)
    this.dynamics.setTipOffRates(5, 20, 15);

    // Setup event handlers
    // Initialize real 3D orbit track and camera
    this.earth.generateOrbitTrack(this.orbit);
    this.scene.setViewMode('ORBITAL');

    this.setupUIBindings();
    this.setupFloatingHUDBindings();

    // Start Main Simulation Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  setupUIBindings() {
    // Flight Mode Buttons
    const modeButtons = document.querySelectorAll('[data-mode]');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        this.setFlightMode(mode);
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Tip-off Spin Button
    document.getElementById('btn-tumble')?.addEventListener('click', () => {
      const rx = (Math.random() - 0.5) * 40;
      const ry = (Math.random() - 0.5) * 40;
      const rz = (Math.random() - 0.5) * 40;
      this.dynamics.setTipOffRates(rx, ry, rz);
      this.bdot.reset();
    });

    // Reset Wheels Button
    document.getElementById('btn-reset-wheels')?.addEventListener('click', () => {
      this.dynamics.resetWheels();
    });

    document.getElementById('select-view')?.addEventListener('change', (e) => {
      this.scene.setViewMode(e.target.value, this.currentSat3DPos);
    });

    // Orbit Presets
    document.getElementById('select-orbit')?.addEventListener('change', (e) => {
      const preset = e.target.value;
      this.orbit.setPreset(preset);
      this.earth.generateOrbitTrack(this.orbit);
    });

    // Vector & Warp popover menus
    const vecBtn = document.getElementById('btn-toggle-vectors');
    const vecPopover = document.getElementById('vector-popover');
    const warpBtn = document.getElementById('btn-toggle-warp');
    const warpPopover = document.getElementById('warp-popover');

    vecBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      vecPopover?.classList.toggle('open');
      warpPopover?.classList.remove('open');
    });

    warpBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      warpPopover?.classList.toggle('open');
      vecPopover?.classList.remove('open');
    });

    document.addEventListener('click', (e) => {
      if (!vecPopover?.contains(e.target) && e.target !== vecBtn) {
        vecPopover?.classList.remove('open');
      }
      if (!warpPopover?.contains(e.target) && e.target !== warpBtn) {
        warpPopover?.classList.remove('open');
      }
    });

    // Collapsible drawer accordions
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const isCollapsed = header.classList.toggle('is-collapsed');
        const arrow = header.querySelector('.accordion-arrow');
        if (arrow) arrow.textContent = isCollapsed ? '▸' : '▾';
        const targetId = header.getAttribute('data-target');
        const sec = targetId ? document.getElementById(targetId) : header.nextElementSibling;
        if (sec) sec.classList.toggle('is-collapsed', isCollapsed);
      });
    });

    // Synchronized Time Warp Sliders (drawer + HUD quick popover)
    const warpSliders = document.querySelectorAll('.slider-timewarp-input');
    const warpVals = document.querySelectorAll('.val-timewarp-text');
    const warpBadges = document.querySelectorAll('.val-timewarp-badge');
    warpSliders.forEach(slider => {
      slider.addEventListener('input', (e) => {
        this.timeWarp = parseFloat(e.target.value);
        warpSliders.forEach(s => { s.value = this.timeWarp; });
        warpVals.forEach(v => { v.textContent = `${this.timeWarp}x`; });
        warpBadges.forEach(b => { b.textContent = `${this.timeWarp}x`; });
      });
    });

    // Synchronized Pause/Play buttons
    const pauseBtns = document.querySelectorAll('.btn-pause-toggle');
    pauseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.isPaused = !this.isPaused;
        pauseBtns.forEach(b => {
          b.textContent = this.isPaused ? '▶ RESUME' : '⏸ PAUSE';
        });
      });
    });

    // Tumble Satellite triggers
    const tumbleBtns = document.querySelectorAll('.btn-tumble-trigger');
    tumbleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.physics.tumble();
      });
    });

    // Vector Toggles
    const setupVectorToggle = (id, key) => {
      document.getElementById(id)?.addEventListener('change', (e) => {
        this.vectors.toggle(key, e.target.checked);
      });
    };
    setupVectorToggle('chk-bfield', 'bField');
    setupVectorToggle('chk-sun', 'sun');
    setupVectorToggle('chk-nadir', 'nadir');
    setupVectorToggle('chk-torque', 'torque');
    setupVectorToggle('chk-mtq', 'mtq');

    // Telemetry Export
    document.getElementById('btn-export-csv')?.addEventListener('click', () => this.logger.exportCSV());
    document.getElementById('btn-export-json')?.addEventListener('click', () => this.logger.exportJSON());

    // Help Modal
    const modal = document.getElementById('help-modal');
    document.getElementById('btn-help')?.addEventListener('click', () => modal?.classList.add('open'));
    document.getElementById('btn-close-modal')?.addEventListener('click', () => modal?.classList.remove('open'));
  }

  setFlightMode(mode) {
    this.flightMode = mode;
    if (mode === 'DETUMBLE') {
      this.bdot.reset();
    }
    // Desaturate reaction wheels on mode transition for maximum agility
    this.dynamics.resetWheels();
  }


  setupFloatingHUDBindings() {
    this.isScrubbingTime = false;

    // 1. Synchronized Speed Slider (Rail + Track drag + Input)
    const speedInput = document.getElementById('slider-speed-vertical');
    const speedContainer = document.getElementById('speed-rail-container');
    const speedFill = document.getElementById('speed-rail-fill');
    const speedThumb = document.getElementById('speed-rail-thumb');
    const speedPill = document.getElementById('val-speed-pill');
    const warpBadge = document.getElementById('hud-warp-pill-val');

    const updateSpeedUI = (val) => {
      this.timeWarp = Math.max(1, Math.min(30, Math.round(val)));
      document.querySelectorAll('.slider-timewarp-input').forEach(s => { s.value = this.timeWarp; });
      document.querySelectorAll('.val-timewarp-text').forEach(v => { v.textContent = `${this.timeWarp}x`; });
      document.querySelectorAll('.val-timewarp-badge').forEach(b => { b.textContent = `${this.timeWarp}x`; });
      if (warpBadge) warpBadge.textContent = `${this.timeWarp}x WARP`;
      const pct = ((this.timeWarp - 1) / (30 - 1)) * 100;
      if (speedFill) speedFill.style.height = `${pct}%`;
      if (speedThumb) speedThumb.style.bottom = `${pct}%`;
      const warpBtn = document.getElementById('btn-toggle-warp');
      if (warpBtn) warpBtn.classList.toggle('active', this.timeWarp > 1);
    };

    speedInput?.addEventListener('input', (e) => updateSpeedUI(parseFloat(e.target.value)));

    // Track dragging for speed
    let draggingSpeed = false;
    const handleSpeedPointer = (e) => {
      const rect = speedContainer.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
      updateSpeedUI(1 + frac * 29);
    };
    speedContainer?.addEventListener('pointerdown', (e) => {
      draggingSpeed = true;
      speedContainer.classList.add('active');
      speedContainer.setPointerCapture?.(e.pointerId);
      handleSpeedPointer(e);
    });
    speedContainer?.addEventListener('pointermove', (e) => {
      if (draggingSpeed) handleSpeedPointer(e);
    });
    const stopSpeedDrag = (e) => {
      if (draggingSpeed) {
        draggingSpeed = false;
        speedContainer.classList.remove('active');
        try { speedContainer.releasePointerCapture?.(e.pointerId); } catch (_) {}
      }
    };
    speedContainer?.addEventListener('pointerup', stopSpeedDrag);
    speedContainer?.addEventListener('pointercancel', stopSpeedDrag);

    // 2. Orbital Time Scrubber Slider
    const timeInput = document.getElementById('slider-time-vertical');
    const timeContainer = document.getElementById('time-rail-container');
    const timeFill = document.getElementById('time-rail-fill');
    const timeThumb = document.getElementById('time-rail-thumb');
    const timePill = document.getElementById('val-time-pill');

    const updateOrbitalScrub = (degVal) => {
      const targetDeg = Math.max(0, Math.min(360, degVal));
      if (timeInput) timeInput.value = targetDeg;
      const pct = (targetDeg / 360) * 100;
      if (timeFill) timeFill.style.height = `${pct}%`;
      if (timeThumb) timeThumb.style.bottom = `${pct}%`;
      if (timePill) timePill.textContent = `${Math.round(targetDeg)}°`;

      const targetRad = targetDeg * (Math.PI / 180);
      let dNu = (targetRad - this.orbit.trueAnomaly0) % (2 * Math.PI);
      if (dNu < 0) dNu += 2 * Math.PI;
      const completedOrbits = Math.floor(this.simTime / this.orbit.period);
      this.simTime = completedOrbits * this.orbit.period + (dNu / this.orbit.meanMotion);

      if (this.isPaused) {
        const orbState = this.orbit.getState(this.simTime);
        this.currentSat3DPos = this.earth.updateSatellitePosition(orbState.positionECI);
        this.scene.render();
      }
    };

    timeInput?.addEventListener('input', (e) => {
      this.isScrubbingTime = true;
      updateOrbitalScrub(parseFloat(e.target.value));
    });
    timeInput?.addEventListener('change', () => {
      this.isScrubbingTime = false;
    });

    let draggingTime = false;
    const handleTimePointer = (e) => {
      const rect = timeContainer.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
      updateOrbitalScrub(frac * 360);
    };
    timeContainer?.addEventListener('pointerdown', (e) => {
      draggingTime = true;
      this.isScrubbingTime = true;
      timeContainer.classList.add('active');
      timeContainer.setPointerCapture?.(e.pointerId);
      handleTimePointer(e);
    });
    timeContainer?.addEventListener('pointermove', (e) => {
      if (draggingTime) handleTimePointer(e);
    });
    const stopTimeDrag = (e) => {
      if (draggingTime) {
        draggingTime = false;
        this.isScrubbingTime = false;
        timeContainer.classList.remove('active');
        try { timeContainer.releasePointerCapture?.(e.pointerId); } catch (_) {}
      }
    };
    timeContainer?.addEventListener('pointerup', stopTimeDrag);
    timeContainer?.addEventListener('pointercancel', stopTimeDrag);

    // 3. Pause Button Handlers (Rail & Transport)
    const updatePauseButtons = () => {
      const pText = this.isPaused ? '▶ RESUME' : '⏸ PAUSE';
      document.querySelectorAll('.btn-pause-toggle').forEach(b => {
        if (b.id !== 'btn-rail-pause' && b.id !== 'btn-transport-pause') {
          b.textContent = pText;
        }
      });
      const railIcon = document.getElementById('rail-pause-icon');
      if (railIcon) railIcon.textContent = this.isPaused ? '▶' : '⏸';

      const hudIcon = document.getElementById('hud-pause-icon');
      const hudLabel = document.getElementById('hud-pause-label');
      const transportBtn = document.getElementById('btn-transport-pause');
      if (hudIcon) hudIcon.textContent = this.isPaused ? '▶' : '⏸';
      if (hudLabel) hudLabel.textContent = this.isPaused ? 'RESUME' : 'PAUSE';
      if (transportBtn) transportBtn.classList.toggle('is-paused', this.isPaused);
      if (timePill) {
        timePill.classList.toggle('is-paused', this.isPaused);
        timePill.classList.toggle('is-live', !this.isPaused);
      }
    };

    document.getElementById('btn-rail-pause')?.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      updatePauseButtons();
    });
    document.getElementById('btn-transport-pause')?.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      updatePauseButtons();
    });

    // 4. Transport Step Buttons
    document.getElementById('btn-transport-step-back')?.addEventListener('click', () => {
      this.simTime = Math.max(0, this.simTime - 10);
      const orbState = this.orbit.getState(this.simTime);
      this.currentSat3DPos = this.earth.updateSatellitePosition(orbState.positionECI);
      updateOrbitalScrub(orbState.trueAnomalyDeg);
      this.scene.render();
    });
    document.getElementById('btn-transport-step-fwd')?.addEventListener('click', () => {
      this.simTime += 10;
      const orbState = this.orbit.getState(this.simTime);
      this.currentSat3DPos = this.earth.updateSatellitePosition(orbState.positionECI);
      updateOrbitalScrub(orbState.trueAnomalyDeg);
      this.scene.render();
    });

    // 5. Top-Right Cluster Buttons
    const modal = document.getElementById('help-modal');
    document.getElementById('btn-hud-menu')?.addEventListener('click', () => {
      modal?.classList.add('open');
    });

    const drawer = document.getElementById('telemetry-drawer');
    const backdrop = document.getElementById('telemetry-backdrop');
    const openDrawer = () => {
      drawer?.classList.add('open');
      backdrop?.classList.add('active');
    };
    const closeDrawer = () => {
      drawer?.classList.remove('open');
      backdrop?.classList.remove('active');
    };

    document.getElementById('btn-hud-settings')?.addEventListener('click', openDrawer);
    document.getElementById('btn-close-telemetry')?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);

    // Fullscreen Toggle
    // Robust Cross-Platform Fullscreen & iOS Safari Immersive Mode
    const fsBtn = document.getElementById('btn-hud-fullscreen');
    const updateFsIcon = (isFull) => {
      if (!fsBtn) return;
      if (isFull) {
        fsBtn.innerHTML = '<svg fill="none" height="16" stroke="currentColor" stroke-width="2.2" viewbox="0 0 24 24" width="16"><path d="M4 14h6v6m10-10h-6V4M14 10l7-7M10 14l-7 7"></path></svg>';
        fsBtn.title = 'Exit Fullscreen';
        fsBtn.classList.add('active');
      } else {
        fsBtn.innerHTML = '<svg fill="none" height="16" stroke="currentColor" stroke-width="2.2" viewbox="0 0 24 24" width="16"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
        fsBtn.title = 'Toggle Fullscreen';
        fsBtn.classList.remove('active');
      }
    };

    const toggleFullscreen = () => {
      const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.body.classList.contains('immersive-fullscreen'));
      if (isFull) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
        document.body.classList.remove('immersive-fullscreen');
        updateFsIcon(false);
      } else {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {
            document.body.classList.add('immersive-fullscreen');
            updateFsIcon(true);
          });
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        } else {
          // iOS Safari fallback: Immersive Fullscreen Mode
          document.body.classList.add('immersive-fullscreen');
          window.scrollTo(0, 1);
        }
        updateFsIcon(true);
      }
    };
    fsBtn?.addEventListener('click', toggleFullscreen);

    document.addEventListener('fullscreenchange', () => {
      const isFull = !!document.fullscreenElement;
      document.body.classList.toggle('immersive-fullscreen', isFull);
      updateFsIcon(isFull);
    });
    document.addEventListener('webkitfullscreenchange', () => {
      const isFull = !!document.webkitFullscreenElement;
      document.body.classList.toggle('immersive-fullscreen', isFull);
      updateFsIcon(isFull);
    });

    // 6. Select Dropdown Text Sync
    const selView = document.getElementById('select-view');
    const lblCam = document.getElementById('hud-cam-label');
    selView?.addEventListener('change', () => {
      if (lblCam) lblCam.textContent = selView.options[selView.selectedIndex].text;
    });

    const selOrbit = document.getElementById('select-orbit');
    const lblOrbit = document.getElementById('hud-orbit-label');
    selOrbit?.addEventListener('change', () => {
      if (lblOrbit) lblOrbit.textContent = selOrbit.options[selOrbit.selectedIndex].text;
    });

    // 7. Flight Mode Buttons Sync across HUD & Sidebar
    const allModeBtns = document.querySelectorAll('[data-mode]');
    allModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        this.setFlightMode(mode);
        allModeBtns.forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-mode') === mode);
        });
      });
    });
  }

  updateFloatingHUD(orbState) {
    if (!orbState) return;

    // Update orbital position rail if not scrubbing
    if (!this.isScrubbingTime) {
      const nuDeg = orbState.trueAnomalyDeg;
      const pct = (nuDeg / 360) * 100;
      const timeFill = document.getElementById('time-rail-fill');
      const timeThumb = document.getElementById('time-rail-thumb');
      const timeInput = document.getElementById('slider-time-vertical');
      const timePill = document.getElementById('val-time-pill');

      if (timeInput) timeInput.value = Math.round(nuDeg);
      if (timeFill) timeFill.style.height = `${pct}%`;
      if (timeThumb) timeThumb.style.bottom = `${pct}%`;
      if (timePill) {
        if (this.isPaused) {
          timePill.textContent = `${Math.round(nuDeg)}°`;
          timePill.classList.add('is-paused');
          timePill.classList.remove('is-live');
        } else {
          timePill.textContent = 'LIVE';
          timePill.classList.add('is-live');
          timePill.classList.remove('is-paused');
        }
      }
    }
  }

  loop(timestamp) {
    requestAnimationFrame((t) => this.loop(t));

    const dtWall = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000);
    this.lastFrameTime = timestamp;

    if (this.isPaused) {
      this.scene.render();
      return;
    }

    // Advance simulation by dtSim with sub-stepping for numerical precision
    const dtSim = dtWall * this.timeWarp;
    const subSteps = Math.max(1, Math.min(20, Math.ceil(dtSim / 0.05)));
    const dtSub = dtSim / subSteps;

    let orbState, bFieldBody, sunECI, isEclipse, gsInfo;
    let cmdTorqueRW = new Vector3(0, 0, 0);
    let cmdDipoleMTQ = new Vector3(0, 0, 0);
    let dynState;

    for (let s = 0; s < subSteps; s++) {
      this.simTime += dtSub;

      // 1. Orbital state & environment
      orbState = this.orbit.getState(this.simTime);
      sunECI = this.orbit.getSunVectorECI(this.simTime);
      isEclipse = this.orbit.isEclipse(orbState.positionECI, sunECI);
      gsInfo = this.orbit.getGroundStationPass(orbState.positionECI, this.simTime);
      bFieldBody = this.mag.getFieldBody(orbState.positionECI, this.dynamics.q, this.simTime);

      // 2. Environmental disturbance torques
      const tauDist = this.disturbances.computeTotalDisturbance(
        orbState.positionECI,
        orbState.velocityECI,
        this.dynamics.q,
        sunECI,
        isEclipse,
        this.dynamics.getInertia()
      );

      // 3. AOCS Flight Control Finite State Machine
      cmdTorqueRW.set(0, 0, 0);
      cmdDipoleMTQ.set(0, 0, 0);

      if (this.flightMode === 'DETUMBLE') {
        cmdDipoleMTQ = this.bdot.computeCommand(bFieldBody, this.simTime);
      } else if (this.flightMode === 'NADIR') {
        const nadirRes = this.nadir.computeCommand(this.dynamics.q, this.dynamics.omega, orbState.positionECI, orbState.velocityECI);
        cmdTorqueRW = nadirRes.cmdTorque;
      } else if (this.flightMode === 'SUN_TRACK') {
        const sunRes = this.sunTrack.computeCommand(this.dynamics.q, this.dynamics.omega, sunECI, isEclipse);
        cmdTorqueRW = sunRes.cmdTorque;
      } else if (this.flightMode === 'GS_TRACK') {
        const gsRes = this.gsTrack.computeCommand(this.dynamics.q, this.dynamics.omega, gsInfo, orbState.positionECI);
        cmdTorqueRW = gsRes.cmdTorque;
      } else if (this.flightMode === 'DESAT') {
        const desatRes = this.desat.computeCommand(this.dynamics.wheelOmega, this.dynamics.Irw, bFieldBody);
        cmdDipoleMTQ = desatRes.cmdDipole;
      }

      // 4. Step Spacecraft Dynamics (RK4)
      dynState = this.dynamics.step(dtSub, tauDist, cmdTorqueRW, cmdDipoleMTQ, bFieldBody);
    }

    // 5. Update 3D Graphics
    // Position satellite at visual orbit radius (3.8 units) with 0.8 units clearance
    const dir = new THREE.Vector3(
      orbState.positionECI.x,
      orbState.positionECI.z,
      -orbState.positionECI.y
    ).normalize();
    const sat3DPos = dir.clone().multiplyScalar(this.earth.orbitBaseRadius);
    this.currentSat3DPos = sat3DPos;

    this.scene.updateCamera(sat3DPos);
    this.satMesh.update(dynState.q, dynState.wheelRPM, sat3DPos, this.scene.viewMode);
    this.earth.update(this.simTime, sat3DPos, gsInfo.hasLOS, this.orbit.getAalborgGSECI(this.simTime));
    this.scene.updateSunPosition(sunECI);

    const bECI = this.mag.getFieldECI(orbState.positionECI, this.simTime);
    this.vectors.update(sat3DPos, bECI, sunECI, orbState.nadirECI, cmdTorqueRW, cmdDipoleMTQ, this.satMesh.group.quaternion);

    // 6. Update HUD & Telemetry Logging
    this.hud.update(
      dynState,
      orbState,
      bFieldBody,
      { isEclipse },
      gsInfo,
      cmdDipoleMTQ,
      cmdTorqueRW
    );

    this.logger.log(
      this.simTime,
      this.flightMode,
      dynState,
      orbState,
      bFieldBody,
      { isEclipse },
      gsInfo,
      cmdDipoleMTQ,
      cmdTorqueRW
    );

    this.updateFloatingHUD(orbState);

    // Render Scene
    this.scene.render();
  }
}

// Bootstrap once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.aocsApp = new CubeSatApp();
});
