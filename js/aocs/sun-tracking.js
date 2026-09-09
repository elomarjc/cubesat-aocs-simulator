/**
 * Sun Tracking Reaction Wheel Controller (Maximum Solar Array Power)
 * Rotates satellite to align solar array normal vector (+Y body) with Sun vector.
 */

import { Vector3, Quaternion } from '../physics/quaternion.js';

export class SunTrackingController {
  constructor(options = {}) {
    this.kp = options.kp ?? 0.003;
    this.kd = options.kd ?? 0.02;
    this.maxTorque = options.maxTorque ?? 0.005;
  }

  computeCommand(currQ, currOmega, sECI, isEclipse) {
    if (isEclipse) {
      // In eclipse, maintain zero spin rate
      const tauX = -this.kd * currOmega.x;
      const tauY = -this.kd * currOmega.y;
      const tauZ = -this.kd * currOmega.z;
      return {
        cmdTorque: new Vector3(
          Math.max(-this.maxTorque, Math.min(this.maxTorque, tauX)),
          Math.max(-this.maxTorque, Math.min(this.maxTorque, tauY)),
          Math.max(-this.maxTorque, Math.min(this.maxTorque, tauZ))
        ),
        sunAngleDeg: 180.0,
        inSunlight: false
      };
    }

    // Sun vector in body coordinates
    const sBody = currQ.inertialToBody(sECI).normalize();

    // Solar panels normal axis (+Y body)
    const panelNormal = new Vector3(0, 1, 0);

    // Cross product error: e = panelNormal x sBody
    const errorVector = panelNormal.cross(sBody);
    const dot = Math.max(-1, Math.min(1, panelNormal.dot(sBody)));
    const sunAngleDeg = Math.acos(dot) * (180 / Math.PI);

    // PD feedback
    const tauX = this.kp * errorVector.x + this.kd * currOmega.x;
    const tauY = this.kp * errorVector.y + this.kd * currOmega.y;
    const tauZ = this.kp * errorVector.z + this.kd * currOmega.z;

    const cmdTorque = new Vector3(
      Math.max(-this.maxTorque, Math.min(this.maxTorque, tauX)),
      Math.max(-this.maxTorque, Math.min(this.maxTorque, tauY)),
      Math.max(-this.maxTorque, Math.min(this.maxTorque, tauZ))
    );

    return {
      cmdTorque,
      sunAngleDeg,
      inSunlight: true
    };
  }
}
