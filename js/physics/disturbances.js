/**
 * Spacecraft Environmental Disturbance Torques in Low Earth Orbit
 * 1. Gravity Gradient Torque: tau_gg = (3*mu / r^3) * (r_hat_body x (I * r_hat_body))
 * 2. Aerodynamic Drag Torque: tau_aero = (r_cp - r_cg) x F_drag
 * 3. Solar Radiation Pressure Torque: tau_srp = (r_cp - r_cg) x F_srp
 */

import { Vector3 } from './quaternion.js';
import { CONSTANTS } from './orbit.js';

export class DisturbanceTorques {
  constructor(options = {}) {
    this.enabledGG = options.enabledGG ?? true;
    this.enabledAero = options.enabledAero ?? true;
    this.enabledSRP = options.enabledSRP ?? true;

    // CubeSat Center of Pressure vs Center of Gravity offset (meters)
    this.cpOffset = new Vector3(0.01, 0.01, 0.02); // 1-2 cm typical offset
    this.cd = 2.2; // Aerodynamic drag coefficient in free molecular flow
    this.crossSectionArea = 0.034; // m^2 (0.1m x 0.34m 3U side)
    this.atmosDensity500km = 1.2e-12; // kg/m^3 at 500 km LEO
    this.solarReflectivity = 0.6; // Reflectivity coefficient
  }

  /**
   * Compute total environmental disturbance torque in Body Frame (N*m)
   */
  computeTotalDisturbance(rECI, vECI, qAttitude, sECI, isEclipse, inertia) {
    let totalTorque = new Vector3(0, 0, 0);

    if (this.enabledGG) {
      totalTorque.add(this.computeGravityGradient(rECI, qAttitude, inertia));
    }
    if (this.enabledAero) {
      totalTorque.add(this.computeAeroDrag(vECI, qAttitude));
    }
    if (this.enabledSRP && !isEclipse) {
      totalTorque.add(this.computeSolarPressure(sECI, qAttitude));
    }

    return totalTorque;
  }

  /**
   * Gravity Gradient Torque:
   * tau_gg = (3 * mu / r^5) * (r_body x (I * r_body))
   */
  computeGravityGradient(rECI, qAttitude, inertia) {
    const rMag = rECI.length();
    const rBody = qAttitude.inertialToBody(rECI);

    // I * r_body (assuming diagonal inertia tensor)
    const Ir = new Vector3(
      inertia.Ixx * rBody.x,
      inertia.Iyy * rBody.y,
      inertia.Izz * rBody.z
    );

    const rCrossIr = rBody.cross(Ir);
    const coeff = (3 * CONSTANTS.MU_EARTH) / Math.pow(rMag, 5);

    return rCrossIr.scale(coeff);
  }

  /**
   * Aerodynamic Drag Torque in body frame
   */
  computeAeroDrag(vECI, qAttitude) {
    const vBody = qAttitude.inertialToBody(vECI);
    const vMag = vBody.length();
    if (vMag < 1.0) return new Vector3(0, 0, 0);

    // F_drag = -0.5 * rho * Cd * A * |v| * v
    const fDragMag = 0.5 * this.atmosDensity500km * this.cd * this.crossSectionArea * vMag * vMag;
    const fDragBody = vBody.clone().normalize().scale(-fDragMag);

    return this.cpOffset.cross(fDragBody);
  }

  /**
   * Solar Radiation Pressure Torque in body frame
   */
  computeSolarPressure(sECI, qAttitude) {
    const sBody = qAttitude.inertialToBody(sECI);
    const sMag = sBody.length();
    if (sMag < 0.1) return new Vector3(0, 0, 0);

    // Radiation pressure P = SolarConstant / c ~ 4.54e-6 N/m^2
    const pSRP = CONSTANTS.SOLAR_FLUX_1AU / CONSTANTS.SPEED_OF_LIGHT;
    const fSRPMag = pSRP * (1 + this.solarReflectivity) * this.crossSectionArea;
    const fSRPBody = sBody.clone().normalize().scale(-fSRPMag);

    return this.cpOffset.cross(fSRPBody);
  }
}
