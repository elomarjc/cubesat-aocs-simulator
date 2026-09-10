/**
 * 3D Photorealistic Earth Globe with Real NASA Textures, Specular Ocean Glint,
 * Dynamic Cloud Layer, Rayleigh Atmosphere, Real Geographic Coordinate Graticule,
 * Aalborg Ground Station (57.05°N, 9.92°E), and Real-Time Sub-Satellite Point (SSP) Reticle.
 */

import { CONSTANTS } from '../physics/orbit.js';

export class EarthVisualizer {
  constructor(scene) {
    this.scene = scene;
    // Earth physical visual radius (3.0 units)
    this.earthScale = 3.0;
    // Orbit radius with 0.8 units visual clearance (3.8 units) - zero clipping
    this.orbitBaseRadius = 3.8;
    this.satScaleRatio = (this.orbitBaseRadius - this.earthScale) / 500e3;

    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);

    this.setupEarthMesh();
    this.setupClouds();
    this.setupAtmosphere();
    this.setupCoordinateGraticule();
    this.setupOrbitTrack();
    this.setupAalborgGroundStation();
    this.setupSubSatelliteNadir();
  }

  /**
   * 1. Photorealistic NASA Blue Marble Earth Sphere with Normal & Specular Maps
   */
  setupEarthMesh() {
    const loader = new THREE.TextureLoader();

    // High-resolution NASA planetary maps
    const dayTex = loader.load('assets/textures/earth_day_2048.jpg');
    const specTex = loader.load('assets/textures/earth_specular_2048.jpg');
    const normTex = loader.load('assets/textures/earth_normal_2048.jpg');

    if (dayTex.anisotropy !== undefined) {
      dayTex.anisotropy = 8;
    }

    const earthGeom = new THREE.SphereGeometry(this.earthScale, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayTex,
      specularMap: specTex,
      specular: new THREE.Color(0x335577), // Deep ocean specular sun glint
      shininess: 24,
      normalMap: normTex,
      normalScale: new THREE.Vector2(0.85, 0.85),
      emissive: new THREE.Color(0x060c18), // Faint space ambient fill
      emissiveIntensity: 0.12
    });

    this.earthSphere = new THREE.Mesh(earthGeom, earthMat);
    this.earthGroup.add(this.earthSphere);
  }

  /**
   * 2. Independent Rotating Atmospheric Cloud Sphere
   */
  setupClouds() {
    const loader = new THREE.TextureLoader();
    const cloudTex = loader.load('assets/textures/earth_clouds_1024.png');

    // Float 0.02 units above Earth surface
    const cloudGeom = new THREE.SphereGeometry(this.earthScale * 1.007, 64, 64);
    const cloudMat = new THREE.MeshPhongMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.82,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.cloudSphere = new THREE.Mesh(cloudGeom, cloudMat);
    this.earthGroup.add(this.cloudSphere);
  }

  /**
   * 3. Atmospheric Rayleigh Scattering Rim (Cyan/Azure Horizon Halo)
   */
  setupAtmosphere() {
    const atmoGeom = new THREE.SphereGeometry(this.earthScale * 1.022, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.20,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    this.atmosphere = new THREE.Mesh(atmoGeom, atmoMat);
    this.earthGroup.add(this.atmosphere);
  }

  /**
   * 4. Real Geographic Coordinate Graticule (Equator, Prime Meridian, Tropics, Parallels)
   */
  setupCoordinateGraticule() {
    this.graticuleGroup = new THREE.Group();
    const r = this.earthScale * 1.0025; // Float barely above surface to avoid Z-fighting
    const segments = 96;

    // Helper: Build a latitude circle parallel
    const createLatitudeRing = (latDeg, colorHex, opacityVal, isDashed = false) => {
      const latRad = latDeg * (Math.PI / 180);
      const y = r * Math.sin(latRad);
      const ringRadius = r * Math.cos(latRad);
      const pts = [];

      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * (2 * Math.PI);
        pts.push(new THREE.Vector3(
          ringRadius * Math.cos(theta),
          y,
          -ringRadius * Math.sin(theta)
        ));
      }

      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: opacityVal,
        linewidth: 1
      });
      return new THREE.Line(geom, mat);
    };

    // Helper: Build a longitude meridian half-circle
    const createLongitudeMeridian = (lonDeg, colorHex, opacityVal) => {
      const lonRad = lonDeg * (Math.PI / 180);
      const pts = [];
      const latSegments = 48;

      for (let i = 0; i <= latSegments; i++) {
        const latRad = -Math.PI / 2 + (i / latSegments) * Math.PI;
        const x = r * Math.cos(latRad) * Math.cos(lonRad);
        const y = r * Math.sin(latRad);
        const z = -r * Math.cos(latRad) * Math.sin(lonRad);
        pts.push(new THREE.Vector3(x, y, z));
      }

      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: opacityVal,
        linewidth: 1
      });
      return new THREE.Line(geom, mat);
    };

    // A. Equator (0° Lat) - Crisp Cyan
    this.graticuleGroup.add(createLatitudeRing(0, 0x00e5ff, 0.45));

    // B. Prime Meridian (0° Lon Greenwich) - Amber/Gold
    this.graticuleGroup.add(createLongitudeMeridian(0, 0xffd600, 0.55));

    // C. Tropics (±23.44°) & Polar Circles (±66.5°)
    this.graticuleGroup.add(createLatitudeRing(23.44, 0x00e5ff, 0.25));
    this.graticuleGroup.add(createLatitudeRing(-23.44, 0x00e5ff, 0.25));
    this.graticuleGroup.add(createLatitudeRing(66.5, 0x80d8ff, 0.25));
    this.graticuleGroup.add(createLatitudeRing(-66.5, 0x80d8ff, 0.25));

    // D. Intermediate Parallels (±30°, ±60°)
    this.graticuleGroup.add(createLatitudeRing(30, 0x00e5ff, 0.15));
    this.graticuleGroup.add(createLatitudeRing(-30, 0x00e5ff, 0.15));
    this.graticuleGroup.add(createLatitudeRing(60, 0x00e5ff, 0.15));
    this.graticuleGroup.add(createLatitudeRing(-60, 0x00e5ff, 0.15));

    // E. Meridians every 30° of longitude
    for (let lon = 30; lon < 360; lon += 30) {
      const is90or180 = (lon % 90 === 0);
      this.graticuleGroup.add(createLongitudeMeridian(
        lon,
        is90or180 ? 0x00e5ff : 0x00e5ff,
        is90or180 ? 0.25 : 0.12
      ));
    }

    // Attach to earthSphere so the coordinate grid rotates in lockstep with the globe!
    this.earthSphere.add(this.graticuleGroup);
  }

  /**
   * 5. Aalborg Ground Station (57.0488° N, 9.9217° E) with Radar Cone & Comm Beam
   */
  setupAalborgGroundStation() {
    this.gsGroup = new THREE.Group();

    // Calculate Aalborg position in local sphere frame
    const r = this.earthScale;
    const lat = CONSTANTS.AALBORG_LAT;
    const lon = CONSTANTS.AALBORG_LON;

    const gx = r * Math.cos(lat) * Math.cos(lon);
    const gy = r * Math.sin(lat);
    const gz = -r * Math.cos(lat) * Math.sin(lon);

    this.gsGroup.position.set(gx, gy, gz);
    const normal = new THREE.Vector3(gx, gy, gz).normalize();
    this.gsGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

    // Aalborg Ground Station Hardware Visuals:
    // A. Pedestal Base Disk
    const baseGeom = new THREE.CylinderGeometry(0.045, 0.05, 0.015, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.5 });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = 0.007;
    this.gsGroup.add(baseMesh);

    // B. Parabolic Dish Antenna
    const dishGeom = new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      side: THREE.DoubleSide
    });
    const dishMesh = new THREE.Mesh(dishGeom, dishMat);
    dishMesh.rotation.x = Math.PI; // Face outwards toward sky
    dishMesh.position.y = 0.045;
    this.gsGroup.add(dishMesh);

    // C. Glowing Red Beacon Pin
    const pinGeom = new THREE.SphereGeometry(0.015, 12, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const pinMesh = new THREE.Mesh(pinGeom, pinMat);
    pinMesh.position.y = 0.055;
    this.gsGroup.add(pinMesh);

    // D. Ground Radar Elevation Cone (5° Horizon Mask)
    const coneGeom = new THREE.ConeGeometry(0.35, 0.45, 24, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x00e676,
      transparent: true,
      opacity: 0.16,
      wireframe: true
    });
    this.radarCone = new THREE.Mesh(coneGeom, coneMat);
    this.radarCone.position.set(0, 0.23, 0);
    this.gsGroup.add(this.radarCone);

    // E. Communication Line/Beam (connects Aalborg to CubeSat on AOS)
    const beamGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0)
    ]);
    const beamMat = new THREE.LineBasicMaterial({
      color: 0x00e676,
      transparent: true,
      opacity: 0.95,
      linewidth: 2.5
    });
    this.commBeam = new THREE.Line(beamGeom, beamMat);
    this.commBeam.visible = false;
    this.scene.add(this.commBeam);

    // Attach to earthSphere so Aalborg stays permanently pinned to Denmark!
    this.earthSphere.add(this.gsGroup);
  }

  /**
   * 6. Sub-Satellite Point (SSP) Ground Reticle on Earth Surface
   */
  setupSubSatelliteNadir() {
    this.sspGroup = new THREE.Group();

    // A. Outer Glowing Cyan Reticle Ring
    const ringGeom = new THREE.RingGeometry(0.04, 0.06, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    this.sspGroup.add(ringMesh);

    // B. Center Target Pinpoint Dot
    const dotGeom = new THREE.CircleGeometry(0.015, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide
    });
    const dotMesh = new THREE.Mesh(dotGeom, dotMat);
    this.sspGroup.add(dotMesh);

    this.scene.add(this.sspGroup);

    // C. Faint Nadir Ground Track Ray (Satellite down to SSP)
    const rayGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0)
    ]);
    const rayMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.25,
      linewidth: 1
    });
    this.nadirRay = new THREE.Line(rayGeom, rayMat);
    this.scene.add(this.nadirRay);
  }

  /**
   * 7. 3D Orbit Track Geometry
   */
  setupOrbitTrack() {
    const orbitGeom = new THREE.BufferGeometry();
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.75,
      linewidth: 2
    });
    this.orbitLine = new THREE.Line(orbitGeom, orbitMat);
    this.scene.add(this.orbitLine);
  }

  generateOrbitTrack(orbitPropagator) {
    if (!orbitPropagator) return;
    const segments = 256;
    const period = orbitPropagator.period;
    const positions = new Float32Array((segments + 1) * 3);
    const r3D = this.orbitBaseRadius;

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * period;
      const st = orbitPropagator.getState(t);
      const dir = new THREE.Vector3(st.positionECI.x, st.positionECI.z, -st.positionECI.y).normalize();

      positions[i * 3 + 0] = dir.x * r3D;
      positions[i * 3 + 1] = dir.y * r3D;
      positions[i * 3 + 2] = dir.z * r3D;
    }
    this.orbitLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.orbitLine.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * 8. Per-Frame Real-Time Animation & Coordinate Tracking Update
   */
  update(simTime, sat3DPos, hasLOS, gsECI) {
    // Real Earth sidereal rotation: 7.292115e-5 rad/s
    const earthAngle = CONSTANTS.EARTH_ROTATION_RATE * simTime;
    this.earthSphere.rotation.y = earthAngle;

    // Atmospheric cloud differential drift (westerly winds)
    this.cloudSphere.rotation.y = earthAngle + (simTime * 0.00006);

    // Aalborg Ground Station World Position for Comm Beam
    if (this.gsGroup) {
      const gsWorldPos = new THREE.Vector3();
      this.gsGroup.getWorldPosition(gsWorldPos);

      if (hasLOS && sat3DPos) {
        this.commBeam.visible = true;
        const positions = this.commBeam.geometry.attributes.position.array;
        positions[0] = gsWorldPos.x;
        positions[1] = gsWorldPos.y;
        positions[2] = gsWorldPos.z;
        positions[3] = sat3DPos.x;
        positions[4] = sat3DPos.y;
        positions[5] = sat3DPos.z;
        this.commBeam.geometry.attributes.position.needsUpdate = true;
      } else {
        this.commBeam.visible = false;
      }
    }

    // Sub-Satellite Point (SSP) Nadir Reticle on Earth Surface
    if (sat3DPos && this.sspGroup && this.nadirRay) {
      const satDir = sat3DPos.clone().normalize();
      const sspSurfacePos = satDir.clone().multiplyScalar(this.earthScale + 0.008);

      this.sspGroup.position.copy(sspSurfacePos);
      this.sspGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), satDir);

      // Connect Nadir Ray from Satellite down to ground surface
      const rayPositions = this.nadirRay.geometry.attributes.position.array;
      rayPositions[0] = sspSurfacePos.x;
      rayPositions[1] = sspSurfacePos.y;
      rayPositions[2] = sspSurfacePos.z;
      rayPositions[3] = sat3DPos.x;
      rayPositions[4] = sat3DPos.y;
      rayPositions[5] = sat3DPos.z;
      this.nadirRay.geometry.attributes.position.needsUpdate = true;
    }
  }

  updateOrbitTrack(inclinationRad, altitudeMeters) {
    this.generateOrbitTrack(null);
  }
}
