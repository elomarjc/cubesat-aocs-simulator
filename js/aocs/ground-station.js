/**
 * Aalborg Ground Station Target Tracking Controller
 * Dynamically slews satellite antenna (+Z body) to track Aalborg GS during an orbital pass.
 */

import { Vector3, Quaternion } from '../physics/quaternion.js';

export class GroundStationTracker {
  constructor(options = {}) {
    this.kp = options.kp ?? 0.004;
    this.kd = options.kd ?? 0.025;
    this.maxTorque = options.maxTorque ?? 0.005;
  }

  computeCommand(currQ, currOmega, passInfo, rECI) {
    // Vector from satellite pointing directly TO the Aalborg Ground Station in ECI
    const losSatToGSECI = passInfo.losVectorECI.clone().scale(-1).normalize();

    // Transform into satellite body coordinates
    const losBody = currQ.inertialToBody(losSatToGSECI).normalize();

    // Antenna boresight is aligned along +Z body (Earth-facing aperture)
    const antennaBoresight = new Vector3(0, 0, 1);

    // Pointing error vector: with netTorque = -tauRW, losBody x antennaBoresight
    // commands reaction wheel torque that rotates antennaBoresight directly towards losBody
    const errorVector = losBody.cross(antennaBoresight);
    const dot = Math.max(-1, Math.min(1, antennaBoresight.dot(losBody)));
    const pointingErrorDeg = Math.acos(dot) * (180 / Math.PI);

    // Closed loop PD reaction wheel command
    const tauX = this.kp * errorVector.x + this.kd * currOmega.x;
    const tauY = this.kp * errorVector.y + this.kd * currOmega.y;
    const tauZ = this.kp * errorVector.z + this.kd * currOmega.z;

    const cmdTorque = new Vector3(
      Math.max(-this.maxTorque, Math.min(this.maxTorque, tauX)),
      Math.max(-this.maxTorque, Math.min(this.maxTorque, tauY)),
      Math.max(-this.maxTorque, Math.min(this.maxTorque, tauZ))
    );

    // Realistic UHF/S-band link budget margin calculation (active pass when elevation >= 5 deg)
    const distanceKm = Math.max(1, passInfo.distanceKm);
    const pathLossDb = 20 * Math.log10(distanceKm) + 20 * Math.log10(437.5) + 32.44;
    const linkMarginDb = passInfo.hasLOS ? Math.max(0, 140.0 - pathLossDb - (pointingErrorDeg * 0.5)) : 0.0;

    return {
      cmdTorque,
      pointingErrorDeg,
      linkMarginDb,
      activePass: !!passInfo.hasLOS
    };
  }
}
