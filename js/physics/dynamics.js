/**
 * Spacecraft Rigid Body Dynamics & RK4 Numerical Integrator
 * Solves coupled Euler's equations of motion with Reaction Wheels and Magnetorquers:
 * I * w_dot = tau_ext + tau_mtq - tau_rw - w x (I * w + h_rw)
 * q_dot = 0.5 * Omega(w) * q
 * h_rw_dot = tau_rw
 */

import { Vector3, Quaternion } from './quaternion.js';

export class SpacecraftDynamics {
  constructor(options = {}) {
    // 3U CubeSat standard mass & principal moments of inertia (kg * m^2)
    this.mass = options.mass ?? 4.0; // kg
    this.Ixx = options.Ixx ?? 0.0419;
    this.Iyy = options.Iyy ?? 0.0419;
    this.Izz = options.Izz ?? 0.0067;

    // Reaction wheels (3-axis orthogonal)
    this.Irw = options.Irw ?? 2.0e-5; // kg * m^2 per wheel
    this.maxWheelTorque = options.maxWheelTorque ?? 0.005; // 5 mN*m max torque
    this.maxWheelRPM = options.maxWheelRPM ?? 6500; // 6500 RPM max speed
    this.maxWheelOmega = (this.maxWheelRPM * 2 * Math.PI) / 60; // rad/s

    // Magnetorquers (3-axis orthogonal)
    this.maxDipole = options.maxDipole ?? 0.2; // 0.2 A * m^2

    // State Variables
    this.q = new Quaternion(1, 0, 0, 0); // Attitude quaternion (Inertial -> Body)
    this.omega = new Vector3(0, 0, 0);   // Angular velocity in Body frame (rad/s)
    this.wheelOmega = new Vector3(0, 0, 0); // Wheel rotational speeds (rad/s)

    // Applied Actuator Commands
    this.cmdWheelTorque = new Vector3(0, 0, 0); // Torque commanded TO wheels (N*m)
    this.cmdDipole = new Vector3(0, 0, 0);      // Magnetic dipole commanded (A*m^2)
    this.tauMTQ = new Vector3(0, 0, 0);         // MTQ torque = m x B (N*m)
    this.tauDist = new Vector3(0, 0, 0);        // Environmental disturbance (N*m)
  }

  getInertia() {
    return { Ixx: this.Ixx, Iyy: this.Iyy, Izz: this.Izz };
  }

  /**
   * Set satellite tip-off angular velocity (e.g. after P-POD dispenser deploy)
   */
  setTipOffRates(degX, degY, degZ) {
    const deg2rad = Math.PI / 180;
    this.omega.set(degX * deg2rad, degY * deg2rad, degZ * deg2rad);
  }

  /**
   * Reset reaction wheel speeds to 0 RPM
   */
  resetWheels() {
    this.wheelOmega.set(0, 0, 0);
  }

  /**
   * Compute derivative of state vector: d/dt [q, omega, wheelOmega]
   */
  computeDerivatives(q, omega, wheelOmega, tauExt, cmdTorqueRW, cmdDipoleMTQ, bFieldBody) {
    // 1. Actuator Saturations
    const tauRW = new Vector3(
      Math.max(-this.maxWheelTorque, Math.min(this.maxWheelTorque, cmdTorqueRW.x)),
      Math.max(-this.maxWheelTorque, Math.min(this.maxWheelTorque, cmdTorqueRW.y)),
      Math.max(-this.maxWheelTorque, Math.min(this.maxWheelTorque, cmdTorqueRW.z))
    );

    // If wheel is saturated in speed and torque would accelerate it further, clamp torque to 0
    if ((wheelOmega.x >= this.maxWheelOmega && tauRW.x > 0) || (wheelOmega.x <= -this.maxWheelOmega && tauRW.x < 0)) tauRW.x = 0;
    if ((wheelOmega.y >= this.maxWheelOmega && tauRW.y > 0) || (wheelOmega.y <= -this.maxWheelOmega && tauRW.y < 0)) tauRW.y = 0;
    if ((wheelOmega.z >= this.maxWheelOmega && tauRW.z > 0) || (wheelOmega.z <= -this.maxWheelOmega && tauRW.z < 0)) tauRW.z = 0;

    const dipole = new Vector3(
      Math.max(-this.maxDipole, Math.min(this.maxDipole, cmdDipoleMTQ.x)),
      Math.max(-this.maxDipole, Math.min(this.maxDipole, cmdDipoleMTQ.y)),
      Math.max(-this.maxDipole, Math.min(this.maxDipole, cmdDipoleMTQ.z))
    );

    // MTQ Torque: tau_mtq = m x B
    const tauMTQ = dipole.cross(bFieldBody);

    // 2. Total angular momentum H = I * w + h_rw
    const hRW = wheelOmega.clone().scale(this.Irw);
    const H = new Vector3(
      this.Ixx * omega.x + hRW.x,
      this.Iyy * omega.y + hRW.y,
      this.Izz * omega.z + hRW.z
    );

    // 3. Gyroscopic cross-coupling term: w x H
    const wCrossH = omega.cross(H);

    // 4. Net torque on satellite body: tau_net = tauExt + tauMTQ - tauRW - (w x H)
    const netTorque = new Vector3(
      tauExt.x + tauMTQ.x - tauRW.x - wCrossH.x,
      tauExt.y + tauMTQ.y - tauRW.y - wCrossH.y,
      tauExt.z + tauMTQ.z - tauRW.z - wCrossH.z
    );

    // Angular acceleration: w_dot = I^-1 * netTorque
    const omegaDot = new Vector3(
      netTorque.x / this.Ixx,
      netTorque.y / this.Iyy,
      netTorque.z / this.Izz
    );

    // Wheel angular acceleration: wheelOmegaDot = tauRW / Irw
    const wheelOmegaDot = tauRW.clone().scale(1 / this.Irw);

    // Quaternion derivative: q_dot = 0.5 * Omega(omega) * q
    const q0 = q.q0, q1 = q.q1, q2 = q.q2, q3 = q.q3;
    const wx = omega.x, wy = omega.y, wz = omega.z;

    const qDot = [
      0.5 * (-wx * q1 - wy * q2 - wz * q3),
      0.5 * ( wx * q0 + wz * q2 - wy * q3),
      0.5 * ( wy * q0 - wz * q1 + wx * q3),
      0.5 * ( wz * q0 + wy * q1 - wx * q2)
    ];

    return {
      qDot,
      omegaDot,
      wheelOmegaDot,
      actualTauRW: tauRW,
      actualTauMTQ: tauMTQ,
      actualDipole: dipole
    };
  }

  /**
   * 4th-Order Runge-Kutta (RK4) Numerical Integration step
   * Advanced state by dt seconds.
   */
  step(dt, tauExt, cmdTorqueRW, cmdDipoleMTQ, bFieldBody) {
    this.tauDist.copy(tauExt);
    this.cmdWheelTorque.copy(cmdTorqueRW);
    this.cmdDipole.copy(cmdDipoleMTQ);

    // State helper
    const stateK1 = this.computeDerivatives(this.q, this.omega, this.wheelOmega, tauExt, cmdTorqueRW, cmdDipoleMTQ, bFieldBody);
    this.tauMTQ.copy(stateK1.actualTauMTQ);

    // K2 step
    const qK2 = new Quaternion(
      this.q.q0 + 0.5 * dt * stateK1.qDot[0],
      this.q.q1 + 0.5 * dt * stateK1.qDot[1],
      this.q.q2 + 0.5 * dt * stateK1.qDot[2],
      this.q.q3 + 0.5 * dt * stateK1.qDot[3]
    ).normalize();
    const wK2 = this.omega.clone().add(stateK1.omegaDot.clone().scale(0.5 * dt));
    const rwK2 = this.wheelOmega.clone().add(stateK1.wheelOmegaDot.clone().scale(0.5 * dt));
    const stateK2 = this.computeDerivatives(qK2, wK2, rwK2, tauExt, cmdTorqueRW, cmdDipoleMTQ, bFieldBody);

    // K3 step
    const qK3 = new Quaternion(
      this.q.q0 + 0.5 * dt * stateK2.qDot[0],
      this.q.q1 + 0.5 * dt * stateK2.qDot[1],
      this.q.q2 + 0.5 * dt * stateK2.qDot[2],
      this.q.q3 + 0.5 * dt * stateK2.qDot[3]
    ).normalize();
    const wK3 = this.omega.clone().add(stateK2.omegaDot.clone().scale(0.5 * dt));
    const rwK3 = this.wheelOmega.clone().add(stateK2.wheelOmegaDot.clone().scale(0.5 * dt));
    const stateK3 = this.computeDerivatives(qK3, wK3, rwK3, tauExt, cmdTorqueRW, cmdDipoleMTQ, bFieldBody);

    // K4 step
    const qK4 = new Quaternion(
      this.q.q0 + dt * stateK3.qDot[0],
      this.q.q1 + dt * stateK3.qDot[1],
      this.q.q2 + dt * stateK3.qDot[2],
      this.q.q3 + dt * stateK3.qDot[3]
    ).normalize();
    const wK4 = this.omega.clone().add(stateK3.omegaDot.clone().scale(dt));
    const rwK4 = this.wheelOmega.clone().add(stateK3.wheelOmegaDot.clone().scale(dt));
    const stateK4 = this.computeDerivatives(qK4, wK4, rwK4, tauExt, cmdTorqueRW, cmdDipoleMTQ, bFieldBody);

    // Final RK4 weighted sum
    const dQ0 = (stateK1.qDot[0] + 2 * stateK2.qDot[0] + 2 * stateK3.qDot[0] + stateK4.qDot[0]) / 6;
    const dQ1 = (stateK1.qDot[1] + 2 * stateK2.qDot[1] + 2 * stateK3.qDot[1] + stateK4.qDot[1]) / 6;
    const dQ2 = (stateK1.qDot[2] + 2 * stateK2.qDot[2] + 2 * stateK3.qDot[2] + stateK4.qDot[2]) / 6;
    const dQ3 = (stateK1.qDot[3] + 2 * stateK2.qDot[3] + 2 * stateK3.qDot[3] + stateK4.qDot[3]) / 6;

    this.q.set(
      this.q.q0 + dt * dQ0,
      this.q.q1 + dt * dQ1,
      this.q.q2 + dt * dQ2,
      this.q.q3 + dt * dQ3
    ).normalize();

    const dW = stateK1.omegaDot.clone()
      .add(stateK2.omegaDot.clone().scale(2))
      .add(stateK3.omegaDot.clone().scale(2))
      .add(stateK4.omegaDot)
      .scale(1 / 6);
    this.omega.add(dW.scale(dt));

    const dRW = stateK1.wheelOmegaDot.clone()
      .add(stateK2.wheelOmegaDot.clone().scale(2))
      .add(stateK3.wheelOmegaDot.clone().scale(2))
      .add(stateK4.wheelOmegaDot)
      .scale(1 / 6);
    this.wheelOmega.add(dRW.scale(dt));

    // Clamp wheel speeds to limits and apply small bearing viscous dissipation
    const wheelDecay = Math.exp(-0.015 * dt);
    this.wheelOmega.scale(wheelDecay);
    this.wheelOmega.x = Math.max(-this.maxWheelOmega, Math.min(this.maxWheelOmega, this.wheelOmega.x));
    this.wheelOmega.y = Math.max(-this.maxWheelOmega, Math.min(this.maxWheelOmega, this.wheelOmega.y));
    this.wheelOmega.z = Math.max(-this.maxWheelOmega, Math.min(this.maxWheelOmega, this.wheelOmega.z));

    return {
      q: this.q.clone(),
      omega: this.omega.clone(),
      wheelOmega: this.wheelOmega.clone(),
      wheelRPM: new Vector3(
        (this.wheelOmega.x * 60) / (2 * Math.PI),
        (this.wheelOmega.y * 60) / (2 * Math.PI),
        (this.wheelOmega.z * 60) / (2 * Math.PI)
      ),
      kineticEnergyJoules: 0.5 * (this.Ixx * this.omega.x**2 + this.Iyy * this.omega.y**2 + this.Izz * this.omega.z**2)
    };
  }
}
