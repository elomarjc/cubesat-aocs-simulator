/**
 * Earth Geomagnetic Tilted Dipole Model
 * Computes magnetic field vector B in ECI and transforms to Satellite Body frame.
 * Models field decay as 1/r^3 and field doubling at magnetic poles.
 */

import { Vector3, Quaternion } from './quaternion.js';
import { CONSTANTS } from './orbit.js';

export class MagneticFieldModel {
  constructor() {
    // Earth magnetic dipole moment parameter (approx 3.12e-5 Tesla at equator surface)
    this.B0 = 3.12e-5; // Tesla
    this.dipoleTilt = 11.5 * (Math.PI / 180); // ~11.5 degree tilt from spin axis
    this.dipoleLon0 = -70.0 * (Math.PI / 180); // Near Canadian Arctic
  }

  /**
   * Earth magnetic dipole unit vector in ECI at time t
   */
  getDipoleAxisECI(t) {
    const gmst = CONSTANTS.EARTH_ROTATION_RATE * t;
    const lon = this.dipoleLon0 + gmst;

    const mx = Math.sin(this.dipoleTilt) * Math.cos(lon);
    const my = Math.sin(this.dipoleTilt) * Math.sin(lon);
    const mz = Math.cos(this.dipoleTilt);

    return new Vector3(mx, my, mz).normalize();
  }

  /**
   * Compute magnetic field B vector in ECI frame (Tesla)
   * Formula: B(r) = (B0 * Re^3 / r^3) * [3 (m_hat . r_hat) r_hat - m_hat]
   */
  getFieldECI(rECI, t) {
    const rMag = rECI.length();
    if (rMag < 1e3) return new Vector3(0, 0, 0);

    const rHat = rECI.clone().normalize();
    const mHat = this.getDipoleAxisECI(t);

    const mDotR = mHat.dot(rHat);
    const rRatio = CONSTANTS.EARTH_RADIUS / rMag;
    const scale = this.B0 * Math.pow(rRatio, 3);

    const term1 = rHat.clone().scale(3 * mDotR);
    const bVec = term1.sub(mHat).scale(scale);

    return bVec;
  }

  /**
   * Compute magnetic field B vector in Satellite Body Frame (Tesla)
   * B_body = R(q) * B_ECI
   */
  getFieldBody(rECI, qAttitude, t) {
    const bECI = this.getFieldECI(rECI, t);
    return qAttitude.inertialToBody(bECI);
  }
}
