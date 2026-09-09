/**
 * Reaction Wheel Magnetic Momentum Desaturation Controller
 * Dumps excess wheel angular momentum (h_rw) via magnetorquers:
 * m_cmd = -k_dump * (B x h_rw) / |B|^2
 */

import { Vector3 } from '../physics/quaternion.js';

export class MomentumDesaturationController {
  constructor(options = {}) {
    this.dumpGain = options.dumpGain ?? 2.5; // Desaturation gain
    this.maxDipole = options.maxDipole ?? 0.2; // A*m^2
  }

  computeCommand(wheelOmega, Irw, bFieldBody) {
    // Total wheel momentum: h_rw = Irw * wheelOmega
    const hRW = wheelOmega.clone().scale(Irw);
    const hMag = hRW.length();

    const bSq = bFieldBody.lengthSq();
    if (bSq < 1e-16 || hMag < 1e-7) {
      return {
        cmdDipole: new Vector3(0, 0, 0),
        momentumTotalNms: hMag,
        isDumping: false
      };
    }

    // m_cmd = -dumpGain * (B x h_rw) / |B|^2
    const bCrossH = bFieldBody.cross(hRW);
    const mCmd = bCrossH.scale(-this.dumpGain / bSq);

    // Saturation clamp
    mCmd.x = Math.max(-this.maxDipole, Math.min(this.maxDipole, mCmd.x));
    mCmd.y = Math.max(-this.maxDipole, Math.min(this.maxDipole, mCmd.y));
    mCmd.z = Math.max(-this.maxDipole, Math.min(this.maxDipole, mCmd.z));

    return {
      cmdDipole: mCmd,
      momentumTotalNms: hMag,
      isDumping: true
    };
  }
}
