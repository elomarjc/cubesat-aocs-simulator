/**
 * B-Dot Magnetic Detumbling Controller
 * Law: m_cmd = -k * dB/dt
 * Dissipates kinetic rotational energy after launch vehicle separation / tip-off.
 */

import { Vector3 } from '../physics/quaternion.js';

export class BDotController {
  constructor(options = {}) {
    // Gain k in A*m^2*s/Tesla (typical 3U CubeSat value: 1.0e5 - 2.5e5)
    this.gain = options.gain ?? 1.8e5;
    this.maxDipole = options.maxDipole ?? 0.2; // A*m^2

    this.prevB = null;
    this.prevTime = null;
    this.filteredBDot = new Vector3(0, 0, 0);
    this.filterAlpha = 0.6; // Low-pass filter smoothing
  }

  reset() {
    this.prevB = null;
    this.prevTime = null;
    this.filteredBDot.set(0, 0, 0);
  }

  /**
   * Compute commanded magnetic dipole moment (A*m^2) in body frame
   */
  computeCommand(bFieldBody, simTime) {
    if (!this.prevB || this.prevTime === null) {
      this.prevB = bFieldBody.clone();
      this.prevTime = simTime;
      return new Vector3(0, 0, 0);
    }

    const dt = simTime - this.prevTime;
    if (dt <= 1e-6) {
      return new Vector3(0, 0, 0);
    }

    // Discrete derivative: dB/dt = (B_k - B_{k-1}) / dt
    const rawBDot = bFieldBody.clone().sub(this.prevB).scale(1 / dt);

    // Apply low-pass filter
    this.filteredBDot.x = this.filterAlpha * rawBDot.x + (1 - this.filterAlpha) * this.filteredBDot.x;
    this.filteredBDot.y = this.filterAlpha * rawBDot.y + (1 - this.filterAlpha) * this.filteredBDot.y;
    this.filteredBDot.z = this.filterAlpha * rawBDot.z + (1 - this.filterAlpha) * this.filteredBDot.z;

    this.prevB.copy(bFieldBody);
    this.prevTime = simTime;

    // Control law: m = -k * (dB/dt)
    let mCmd = this.filteredBDot.clone().scale(-this.gain);

    // Actuator saturation clamp
    mCmd.x = Math.max(-this.maxDipole, Math.min(this.maxDipole, mCmd.x));
    mCmd.y = Math.max(-this.maxDipole, Math.min(this.maxDipole, mCmd.y));
    mCmd.z = Math.max(-this.maxDipole, Math.min(this.maxDipole, mCmd.z));

    return mCmd;
  }
}
