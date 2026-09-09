/**
 * Nadir Pointing Reaction Wheel Controller (LVLH Earth Observation)
 * Targets: +Z body points Nadir (-r), +X body points along Velocity (v), +Y points Orbit Normal
 * Quaternion error feedback PD controller.
 */

import { Vector3, Quaternion } from '../physics/quaternion.js';

export class NadirPointingController {
  constructor(options = {}) {
    // Proportional & Derivative gains for 3-axis reaction wheel torque
    this.kp = options.kp ?? 0.0035; // N*m / rad
    this.kd = options.kd ?? 0.022;  // N*m / (rad/s)
    this.maxTorque = options.maxTorque ?? 0.005; // 5 mN*m max wheel torque
  }

  /**
   * Compute desired LVLH orientation quaternion relative to ECI frame
   */
  computeTargetQuaternion(rECI, vECI) {
    const zLVLH = rECI.clone().scale(-1).normalize(); // Nadir (-r)
    const yLVLH = rECI.cross(vECI).scale(-1).normalize(); // Orbit normal
    const xLVLH = yLVLH.cross(zLVLH).normalize(); // Along velocity

    // Construct rotation matrix [x, y, z] from LVLH to ECI
    const R = [
      [xLVLH.x, yLVLH.x, zLVLH.x],
      [xLVLH.y, yLVLH.y, zLVLH.y],
      [xLVLH.z, yLVLH.z, zLVLH.z]
    ];

    // Convert DCM to Quaternion
    const trace = R[0][0] + R[1][1] + R[2][2];
    let q0, q1, q2, q3;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      q0 = 0.25 / s;
      q1 = (R[2][1] - R[1][2]) * s;
      q2 = (R[0][2] - R[2][0]) * s;
      q3 = (R[1][0] - R[0][1]) * s;
    } else if (R[0][0] > R[1][1] && R[0][0] > R[2][2]) {
      const s = 2.0 * Math.sqrt(1.0 + R[0][0] - R[1][1] - R[2][2]);
      q0 = (R[2][1] - R[1][2]) / s;
      q1 = 0.25 * s;
      q2 = (R[0][1] + R[1][0]) / s;
      q3 = (R[0][2] + R[2][0]) / s;
    } else if (R[1][1] > R[2][2]) {
      const s = 2.0 * Math.sqrt(1.0 + R[1][1] - R[0][0] - R[2][2]);
      q0 = (R[0][2] - R[2][0]) / s;
      q1 = (R[0][1] + R[1][0]) / s;
      q2 = 0.25 * s;
      q3 = (R[1][2] + R[2][1]) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + R[2][2] - R[0][0] - R[1][1]);
      q0 = (R[1][0] - R[0][1]) / s;
      q1 = (R[0][2] + R[2][0]) / s;
      q2 = (R[1][2] + R[2][1]) / s;
      q3 = 0.25 * s;
    }

    return new Quaternion(q0, q1, q2, q3).normalize();
  }

  /**
   * Compute reaction wheel torque commands (N*m)
   */
  computeCommand(currQ, currOmega, rECI, vECI) {
    const qTgt = this.computeTargetQuaternion(rECI, vECI);

    // Error quaternion: q_err = q_tgt^* * q_curr
    let qErr = qTgt.conjugate().multiply(currQ).normalize();

    // Shortest rotational path: ensure scalar part q0 is positive
    if (qErr.q0 < 0) {
      qErr = new Quaternion(-qErr.q0, -qErr.q1, -qErr.q2, -qErr.q3);
    }

    // Vector error
    const errVector = new Vector3(qErr.q1, qErr.q2, qErr.q3);

    // Desired orbital angular rate in LVLH frame: w_orbit around -Y axis
    const rMag = rECI.length();
    const vMag = vECI.length();
    const wOrbit = vMag / rMag; // ~0.0011 rad/s
    const wRefBody = currQ.inertialToBody(rECI.cross(vECI).normalize().scale(-wOrbit));
    const omegaErr = currOmega.clone().sub(wRefBody);

    // PD Control: tau_rw = Kp * q_err_v + Kd * w_err
    const tauX = this.kp * errVector.x + this.kd * omegaErr.x;
    const tauY = this.kp * errVector.y + this.kd * omegaErr.y;
    const tauZ = this.kp * errVector.z + this.kd * omegaErr.z;

    const cmdTorque = new Vector3(
      Math.max(-this.maxTorque, Math.min(this.maxTorque, tauX)),
      Math.max(-this.maxTorque, Math.min(this.maxTorque, tauY)),
      Math.max(-this.maxTorque, Math.min(this.maxTorque, tauZ))
    );

    // Pointing error in degrees (angle = 2 * acos(q0))
    const pointingErrorDeg = 2 * Math.acos(Math.max(-1, Math.min(1, qErr.q0))) * (180 / Math.PI);

    return {
      cmdTorque,
      pointingErrorDeg,
      qTarget: qTgt,
      qError: qErr
    };
  }
}
