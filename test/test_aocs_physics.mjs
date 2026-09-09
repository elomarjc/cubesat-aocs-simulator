import { Vector3, Quaternion } from '../js/physics/quaternion.js';
import { OrbitPropagator, CONSTANTS } from '../js/physics/orbit.js';
import { MagneticFieldModel } from '../js/physics/magnetic-field.js';
import { DisturbanceTorques } from '../js/physics/disturbances.js';
import { SpacecraftDynamics } from '../js/physics/dynamics.js';
import { BDotController } from '../js/aocs/bdot.js';
import { NadirPointingController } from '../js/aocs/nadir-pointing.js';
import { SunTrackingController } from '../js/aocs/sun-tracking.js';
import { GroundStationTracker } from '../js/aocs/ground-station.js';
import { MomentumDesaturationController } from '../js/aocs/desaturation.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n=== 1. Testing Quaternion & Vector3 Library ===');
{
  const v1 = new Vector3(1, 2, 3);
  const v2 = new Vector3(4, -5, 6);
  const vCross = v1.cross(v2);
  assert(vCross.x === 27 && vCross.y === 6 && vCross.z === -13, 'Vector3 cross product correct');
  assert(Math.abs(v1.dot(v2) - 12) < 1e-10, 'Vector3 dot product correct');

  const qIdent = new Quaternion(1, 0, 0, 0);
  assert(Math.abs(qIdent.norm() - 1.0) < 1e-12, 'Identity quaternion norm is 1.0');

  const qRot90Z = Quaternion.fromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
  const vX = new Vector3(1, 0, 0);
  const vRot = qRot90Z.rotateVector(vX);
  assert(Math.abs(vRot.x) < 1e-6 && Math.abs(vRot.y - 1.0) < 1e-6 && Math.abs(vRot.z) < 1e-6, 'Rotate vector 90 deg around Z produces [0, 1, 0]');

  const euler = qRot90Z.toEulerDegrees();
  assert(Math.abs(euler.yaw - 90.0) < 1e-4, `Euler yaw corresponds to 90 deg (got ${euler.yaw})`);
}

console.log('\n=== 2. Testing Orbit Propagator & Ground Station ===');
{
  const orbit = new OrbitPropagator({ altitude: 500e3, inclinationDeg: 97.4 });
  assert(Math.abs(orbit.period - 5677) < 30, `Orbital period for 500km LEO is ~94.6 min (~5677s) (got ${orbit.period.toFixed(1)}s)`);

  const state0 = orbit.getState(0);
  assert(Math.abs(state0.altitudeKm - 500.0) < 1.0, 'Initial altitude is 500 km');
  assert(Math.abs(state0.orbitalSpeedKms - 7.61) < 0.1, 'Orbital velocity is ~7.61 km/s');

  const sun = orbit.getSunVectorECI(0);
  assert(Math.abs(sun.length() - 1.0) < 1e-6, 'Sun unit vector has norm 1.0');

  const pass = orbit.getGroundStationPass(state0.positionECI, 0);
  assert(typeof pass.elevationDeg === 'number', 'Aalborg ground station elevation computed');
}

console.log('\n=== 3. Testing Magnetic Field & Disturbances ===');
{
  const magModel = new MagneticFieldModel();
  const orbit = new OrbitPropagator({ altitude: 500e3 });
  const state0 = orbit.getState(0);
  const bECI = magModel.getFieldECI(state0.positionECI, 0);
  const bMag = bECI.length();
  assert(bMag >= 1.5e-5 && bMag <= 6.0e-5, `Magnetic field magnitude at 500km is within 15-60 uT (got ${(bMag*1e6).toFixed(2)} uT)`);

  const distModel = new DisturbanceTorques();
  const q = new Quaternion(1, 0, 0, 0);
  const tauDist = distModel.computeTotalDisturbance(state0.positionECI, state0.velocityECI, q, orbit.getSunVectorECI(0), false, { Ixx: 0.042, Iyy: 0.042, Izz: 0.007 });
  assert(tauDist.length() < 1e-3, 'Disturbance torques are appropriately micro-Newton-meter scale');
}

console.log('\n=== 4. Testing Spacecraft Rigid Body Dynamics (RK4) ===');
{
  const dyn = new SpacecraftDynamics();
  dyn.setTipOffRates(10, 0, 0); // 10 deg/s around X
  assert(Math.abs(dyn.omega.x - 10 * Math.PI / 180) < 1e-6, 'Tip-off rate set correctly');

  const dt = 0.05;
  const bFieldBody = new Vector3(2e-5, 0, 3e-5);
  for (let i = 0; i < 20; i++) {
    dyn.step(dt, new Vector3(0,0,0), new Vector3(0,0,0), new Vector3(0,0,0), bFieldBody);
  }
  assert(Math.abs(dyn.q.norm() - 1.0) < 1e-6, 'Quaternion remains normalized after RK4 integration');
  assert(Math.abs(dyn.omega.x - 10 * Math.PI / 180) < 1e-4, 'Free rotation without external torque conserves spin rate');
}

console.log('\n=== 5. Testing B-Dot Magnetic Detumbling Control ===');
{
  const dyn = new SpacecraftDynamics();
  const bdot = new BDotController({ gain: 2.0e5, maxDipole: 0.2 });
  const orbit = new OrbitPropagator({ altitude: 500e3 });
  const mag = new MagneticFieldModel();

  // Inject initial tip-off spin: 25 deg/s around Y and 15 deg/s around Z
  dyn.setTipOffRates(5, 25, 15);
  const initialEnergy = 0.5 * (dyn.Ixx * dyn.omega.x**2 + dyn.Iyy * dyn.omega.y**2 + dyn.Izz * dyn.omega.z**2);

  const dt = 0.1; // 100 ms
  let t = 0;
  // Simulate 60 seconds of B-dot active damping
  for (let step = 0; step < 600; step++) {
    const orbState = orbit.getState(t);
    const bFieldBody = mag.getFieldBody(orbState.positionECI, dyn.q, t);
    const mCmd = bdot.computeCommand(bFieldBody, t);
    dyn.step(dt, new Vector3(0,0,0), new Vector3(0,0,0), mCmd, bFieldBody);
    t += dt;
  }

  const finalEnergy = 0.5 * (dyn.Ixx * dyn.omega.x**2 + dyn.Iyy * dyn.omega.y**2 + dyn.Izz * dyn.omega.z**2);
  assert(finalEnergy < initialEnergy, `B-dot damping strictly dissipates kinetic energy: ${initialEnergy.toFixed(4)} J -> ${finalEnergy.toFixed(4)} J`);
}

console.log('\n=== 6. Testing Nadir Pointing PD Controller ===');
{
  const dyn = new SpacecraftDynamics();
  const nadir = new NadirPointingController({ kp: 0.005, kd: 0.03 });
  const orbit = new OrbitPropagator({ altitude: 500e3 });
  const bFieldBody = new Vector3(2e-5, 0, 3e-5);

  const orbState = orbit.getState(0);
  // Satellite slightly misaligned
  dyn.q = Quaternion.fromAxisAngle(new Vector3(1, 0, 0), 15 * Math.PI / 180);
  const initialNadirRes = nadir.computeCommand(dyn.q, dyn.omega, orbState.positionECI, orbState.velocityECI);
  assert(initialNadirRes.pointingErrorDeg > 5.0, `Initial pointing error detected (${initialNadirRes.pointingErrorDeg.toFixed(1)} deg)`);

  const dt = 0.05;
  for (let step = 0; step < 100; step++) {
    const cmd = nadir.computeCommand(dyn.q, dyn.omega, orbState.positionECI, orbState.velocityECI);
    dyn.step(dt, new Vector3(0,0,0), cmd.cmdTorque, new Vector3(0,0,0), bFieldBody);
  }

  const finalNadirRes = nadir.computeCommand(dyn.q, dyn.omega, orbState.positionECI, orbState.velocityECI);
  assert(finalNadirRes.pointingErrorDeg < initialNadirRes.pointingErrorDeg, `Nadir closed-loop PD reduces pointing error (${initialNadirRes.pointingErrorDeg.toFixed(1)}° -> ${finalNadirRes.pointingErrorDeg.toFixed(1)}°)`);
}

console.log('\n=== 7. Testing Sun Tracking & Desaturation Controllers ===');
{
  const sunCtrl = new SunTrackingController();
  const desatCtrl = new MomentumDesaturationController();

  const q = new Quaternion(1, 0, 0, 0);
  const sECI = new Vector3(1, 0, 0);
  const sunRes = sunCtrl.computeCommand(q, new Vector3(0,0,0), sECI, false);
  assert(typeof sunRes.sunAngleDeg === 'number' && sunRes.inSunlight === true, 'Sun tracking computes solar angle and torque');

  // Reaction wheels saturated at 4000 RPM around X
  const wheelOmega = new Vector3(400, 0, 0);
  const bField = new Vector3(0, 3e-5, 2e-5);
  const desatRes = desatCtrl.computeCommand(wheelOmega, 2e-5, bField);
  assert(desatRes.isDumping && desatRes.cmdDipole.length() > 0, 'Momentum desaturation commands non-zero MTQ dipole to dump momentum');
}

console.log(`\nTotal Suite: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
