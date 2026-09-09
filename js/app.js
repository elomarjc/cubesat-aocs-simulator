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
    this.setupUIBindings();

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

    // Camera View Modes
    document.getElementById('select-view')?.addEventListener('change', (e) => {
      this.scene.setViewMode(e.target.value);
    });

    // Orbit Presets
    document.getElementById('select-orbit')?.addEventListener('change', (e) => {
      const preset = e.target.value;
      this.orbit.setPreset(preset);
      this.earth.updateOrbitTrack(this.orbit.inclination, this.orbit.altitude);
    });

    // Time Warp Slider
    const warpSlider = document.getElementById('slider-timewarp');
    const warpVal = document.getElementById('val-timewarp');
    warpSlider?.addEventListener('input', (e) => {
      this.timeWarp = parseFloat(e.target.value);
      if (warpVal) warpVal.textContent = `${this.timeWarp}x`;
    });

    // Pause/Play
    document.getElementById('btn-pause')?.addEventListener('click', (e) => {
      this.isPaused = !this.isPaused;
      e.target.textContent = this.isPaused ? '▶ RESUME' : '⏸ PAUSE';
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
    const sat3DPos = new THREE.Vector3(0, 0, 0); // In chaser mode, satellite stays centered
    this.satMesh.update(dynState.q, dynState.wheelRPM, sat3DPos);
    this.earth.update(this.simTime, sat3DPos, gsInfo.hasLOS, this.orbit.getAalborgGSECI(this.simTime));
    this.scene.updateSunPosition(sunECI);

    const bECI = this.mag.getFieldECI(orbState.positionECI, this.simTime);
    this.vectors.update(sat3DPos, bECI, sunECI, orbState.nadirECI, cmdTorqueRW, cmdDipoleMTQ);

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

    // Render Scene
    this.scene.render();
  }
}

// Bootstrap once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.aocsApp = new CubeSatApp();
});
