/**
 * Low Earth Orbit (LEO) Orbital Mechanics & Ground Station Tracking
 * Implements Keplerian two-body propagation, Earth rotation (WGS84 spherical approx),
 * Solar vector calculation, Eclipse detection, and Ground Station (Aalborg) Line-Of-Sight.
 */

import { Vector3 } from './quaternion.js';

export const CONSTANTS = {
  EARTH_RADIUS: 6371.0e3,           // meters (6371 km)
  MU_EARTH: 3.986004418e14,         // m^3 / s^2 (Standard gravitational parameter)
  EARTH_ROTATION_RATE: 7.292115e-5, // rad/s (Earth sidereal rotation)
  SOLAR_FLUX_1AU: 1361.0,           // W/m^2 (Solar constant)
  SPEED_OF_LIGHT: 299792458.0,      // m/s
  AALBORG_LAT: 57.0488 * (Math.PI / 180), // 57.0488 deg N in radians
  AALBORG_LON: 9.9217 * (Math.PI / 180),  // 9.9217 deg E in radians
};

export class OrbitPropagator {
  constructor(options = {}) {
    this.altitude = options.altitude ?? 500.0e3; // 500 km default LEO
    this.semiMajorAxis = CONSTANTS.EARTH_RADIUS + this.altitude;
    this.eccentricity = options.eccentricity ?? 0.0; // nearly circular
    this.inclination = (options.inclinationDeg ?? 97.4) * (Math.PI / 180); // Sun-Synchronous Orbit
    this.raan = (options.raanDeg ?? 45.0) * (Math.PI / 180); // Right Ascension of Ascending Node
    this.argPerigee = (options.argPerigeeDeg ?? 0.0) * (Math.PI / 180);
    this.trueAnomaly0 = (options.trueAnomalyDeg ?? 0.0) * (Math.PI / 180);

    // Derived Keplerian quantities
    this.meanMotion = Math.sqrt(CONSTANTS.MU_EARTH / Math.pow(this.semiMajorAxis, 3)); // rad/s
    this.period = (2 * Math.PI) / this.meanMotion; // seconds (~94.5 minutes)
    this.orbitalSpeed = Math.sqrt(CONSTANTS.MU_EARTH / this.semiMajorAxis); // ~7.61 km/s

    this.simTime = 0; // Mission elapsed time (seconds)
  }

  /**
   * Set orbital inclination preset
   */
  setPreset(preset) {
    if (preset === 'SSO') {
      this.inclination = 97.4 * (Math.PI / 180);
      this.altitude = 500.0e3;
    } else if (preset === 'ISS') {
      this.inclination = 51.6 * (Math.PI / 180);
      this.altitude = 420.0e3;
    } else if (preset === 'POLAR') {
      this.inclination = 90.0 * (Math.PI / 180);
      this.altitude = 600.0e3;
    } else if (preset === 'EQUATORIAL') {
      this.inclination = 0.0;
      this.altitude = 500.0e3;
    }
    this.semiMajorAxis = CONSTANTS.EARTH_RADIUS + this.altitude;
    this.meanMotion = Math.sqrt(CONSTANTS.MU_EARTH / Math.pow(this.semiMajorAxis, 3));
    this.period = (2 * Math.PI) / this.meanMotion;
    this.orbitalSpeed = Math.sqrt(CONSTANTS.MU_EARTH / this.semiMajorAxis);
  }

  /**
   * Propagate orbit to elapsed time t (seconds)
   * Returns state in ECI (Earth-Centered Inertial) frame
   */
  getState(t) {
    this.simTime = t;
    const nu = this.trueAnomaly0 + this.meanMotion * t; // True anomaly for circular orbit
    const rMag = this.semiMajorAxis * (1 - this.eccentricity * this.eccentricity) / (1 + this.eccentricity * Math.cos(nu));
    const vMag = Math.sqrt(CONSTANTS.MU_EARTH * (2 / rMag - 1 / this.semiMajorAxis));

    // Perifocal coordinates
    const rPQW = new Vector3(rMag * Math.cos(nu), rMag * Math.sin(nu), 0);
    const vPQW = new Vector3(-vMag * Math.sin(nu), vMag * Math.cos(nu), 0);

    // Transform from PQW to ECI frame using RAAN, inclination, and Arg of Perigee
    const rECI = this.transformPQWtoECI(rPQW);
    const vECI = this.transformPQWtoECI(vPQW);

    // Nadir vector pointing from satellite to Earth center
    const nadirECI = rECI.clone().scale(-1).normalize();

    // Velocity direction (along-track)
    const velocityDirECI = vECI.clone().normalize();

    // Orbit normal (cross track)
    const orbitNormalECI = rECI.cross(vECI).normalize();

    return {
      time: t,
      positionECI: rECI,
      velocityECI: vECI,
      altitudeKm: (rMag - CONSTANTS.EARTH_RADIUS) / 1000,
      orbitalSpeedKms: vMag / 1000,
      trueAnomalyRad: nu % (2 * Math.PI),
      trueAnomalyDeg: ((nu % (2 * Math.PI)) * 180 / Math.PI + 360) % 360,
      nadirECI,
      velocityDirECI,
      orbitNormalECI
    };
  }

  transformPQWtoECI(vPQW) {
    const cosO = Math.cos(this.raan), sinO = Math.sin(this.raan);
    const cosi = Math.cos(this.inclination), sini = Math.sin(this.inclination);
    const cosw = Math.cos(this.argPerigee), sinw = Math.sin(this.argPerigee);

    // Combined rotation matrix P_x, P_y, P_z
    const px = (cosO * cosw - sinO * sinw * cosi) * vPQW.x + (-cosO * sinw - sinO * cosw * cosi) * vPQW.y;
    const py = (sinO * cosw + cosO * sinw * cosi) * vPQW.x + (-sinO * sinw + cosO * cosw * cosi) * vPQW.y;
    const pz = (sinw * sini) * vPQW.x + (cosw * sini) * vPQW.y;

    return new Vector3(px, py, pz);
  }

  /**
   * Sun vector in ECI frame (approximate seasonal motion)
   */
  getSunVectorECI(t) {
    const obliquity = 23.44 * (Math.PI / 180); // Earth axial tilt
    // Year progress (approx 365.25 days)
    const dayOfYear = (t / 86400) % 365.25;
    const solarLon = (2 * Math.PI * dayOfYear) / 365.25;

    const sX = Math.cos(solarLon);
    const sY = Math.sin(solarLon) * Math.cos(obliquity);
    const sZ = Math.sin(solarLon) * Math.sin(obliquity);

    return new Vector3(sX, sY, sZ).normalize();
  }

  /**
   * Check if satellite is in Earth eclipse (cylindrical/conical shadow model)
   */
  isEclipse(rECI, sECI) {
    const rDotS = rECI.dot(sECI);
    if (rDotS >= 0) {
      return false; // Facing Sun side of Earth
    }
    // Perpendicular distance to Sun-Earth centerline
    const perpSq = rECI.lengthSq() - (rDotS * rDotS);
    return perpSq < (CONSTANTS.EARTH_RADIUS * CONSTANTS.EARTH_RADIUS);
  }

  /**
   * Get Aalborg Ground Station position in ECI at elapsed time t
   */
  getAalborgGSECI(t) {
    // Current Greenwich Mean Sidereal Time (GMST) angle
    const gmst = CONSTANTS.EARTH_ROTATION_RATE * t;
    const currentLon = CONSTANTS.AALBORG_LON + gmst;

    const x = CONSTANTS.EARTH_RADIUS * Math.cos(CONSTANTS.AALBORG_LAT) * Math.cos(currentLon);
    const y = CONSTANTS.EARTH_RADIUS * Math.cos(CONSTANTS.AALBORG_LAT) * Math.sin(currentLon);
    const z = CONSTANTS.EARTH_RADIUS * Math.sin(CONSTANTS.AALBORG_LAT);

    return new Vector3(x, y, z);
  }

  /**
   * Compute contact geometry between Satellite and Aalborg Ground Station
   */
  getGroundStationPass(rECI, t) {
    const gsECI = this.getAalborgGSECI(t);
    const rho = rECI.clone().sub(gsECI); // Vector from Ground Station to Satellite
    const distMeters = rho.length();
    const upGS = gsECI.clone().normalize(); // Local Zenith vector at Aalborg

    // Elevation angle above local horizon
    const sinElevation = rho.dot(upGS) / distMeters;
    const elevationRad = Math.asin(Math.max(-1, Math.min(1, sinElevation)));
    const elevationDeg = elevationRad * (180 / Math.PI);

    const hasLOS = elevationDeg >= 5.0; // 5 degree minimum elevation mask

    return {
      distanceKm: distMeters / 1000,
      elevationDeg,
      hasLOS,
      losVectorECI: rho.normalize()
    };
  }
}
