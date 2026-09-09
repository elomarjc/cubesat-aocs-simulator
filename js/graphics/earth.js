/**
 * 3D Earth Globe with Procedural Continents, Atmosphere Glow, Orbit Path & Aalborg Ground Station
 */

import { CONSTANTS } from '../physics/orbit.js';

export class EarthVisualizer {
  constructor(scene) {
    this.scene = scene;
    // Scale factor for 3D visualization: Earth radius R_E = 3.0 units in 3D scene
    this.earthScale = 3.0; // 3.0 units = 6371 km -> 1 unit = 2123.67 km
    this.satScaleRatio = this.earthScale / CONSTANTS.EARTH_RADIUS;

    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);

    this.setupEarthMesh();
    this.setupAtmosphere();
    this.setupOrbitTrack();
    this.setupAalborgGroundStation();
  }

  setupEarthMesh() {
    // High-resolution procedural texture canvas for Earth continents and oceans
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Ocean deep blue gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
    oceanGrad.addColorStop(0, '#0a2342');
    oceanGrad.addColorStop(0.5, '#05192d');
    oceanGrad.addColorStop(1, '#0a2342');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // Draw stylized continental landmasses (Europe, Africa, Americas, Asia, Australia, Greenland)
    ctx.fillStyle = '#1e3f20'; // Continental green
    // Eurasia & Africa
    ctx.beginPath();
    ctx.ellipse(540, 200, 180, 100, 0.2, 0, Math.PI * 2); // Eurasia
    ctx.fill();
    ctx.fillStyle = '#3a5323';
    ctx.beginPath();
    ctx.ellipse(510, 310, 80, 110, -0.1, 0, Math.PI * 2); // Africa
    ctx.fill();
    // North & South America
    ctx.fillStyle = '#2d4a22';
    ctx.beginPath();
    ctx.ellipse(250, 180, 90, 80, -0.2, 0, Math.PI * 2); // North America
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(310, 330, 60, 90, 0.2, 0, Math.PI * 2); // South America
    ctx.fill();
    // Australia
    ctx.beginPath();
    ctx.ellipse(800, 340, 45, 35, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Polar ice caps
    ctx.fillStyle = '#e0f0ff';
    ctx.fillRect(0, 0, 1024, 30); // Arctic
    ctx.fillRect(0, 480, 1024, 32); // Antarctic

    // Latitude & Longitude grid lines (subtle cyan)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1024; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Aalborg pinpoint on canvas texture (approx lon 9.9E -> x=540, lat 57N -> y=93)
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.arc(540, 93, 4, 0, Math.PI * 2);
    ctx.fill();

    const earthTexture = new THREE.CanvasTexture(canvas);

    const earthGeom = new THREE.SphereGeometry(this.earthScale, 48, 48);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.8,
      metalness: 0.1
    });

    this.earthSphere = new THREE.Mesh(earthGeom, earthMat);
    this.earthGroup.add(this.earthSphere);
  }

  setupAtmosphere() {
    // Glowing atmospheric rim
    const atmoGeom = new THREE.SphereGeometry(this.earthScale * 1.025, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x00b0ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    });
    this.atmosphere = new THREE.Mesh(atmoGeom, atmoMat);
    this.earthGroup.add(this.atmosphere);
  }

  setupOrbitTrack() {
    // Visual circle/ellipse representing orbit path
    const orbitRadius = this.earthScale * (CONSTANTS.EARTH_RADIUS + 500e3) / CONSTANTS.EARTH_RADIUS;
    const curvePoints = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      curvePoints.push(new THREE.Vector3(orbitRadius * Math.cos(theta), 0, orbitRadius * Math.sin(theta)));
    }

    const orbitGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.4,
      linewidth: 1
    });

    this.orbitLine = new THREE.Line(orbitGeom, orbitMat);
    this.scene.add(this.orbitLine);
  }

  setupAalborgGroundStation() {
    // 3D Pin / Beacon at Aalborg coordinates (Lat 57.05 N, Lon 9.92 E)
    this.gsGroup = new THREE.Group();
    this.earthGroup.add(this.gsGroup);

    // Marker beacon
    const pinGeom = new THREE.ConeGeometry(0.04, 0.12, 16);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const pinMesh = new THREE.Mesh(pinGeom, pinMat);
    pinMesh.rotation.x = Math.PI;
    this.gsGroup.add(pinMesh);

    // Radar elevation cone (5 degree mask)
    const coneGeom = new THREE.ConeGeometry(0.35, 0.45, 24, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x00e676,
      transparent: true,
      opacity: 0.12,
      wireframe: true
    });
    this.radarCone = new THREE.Mesh(coneGeom, coneMat);
    this.radarCone.position.set(0, 0.22, 0);
    this.gsGroup.add(this.radarCone);

    // Dynamic ground station communication beam to satellite
    const beamGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0)
    ]);
    const beamMat = new THREE.LineBasicMaterial({
      color: 0x00e676,
      transparent: true,
      opacity: 0.9,
      linewidth: 2
    });
    this.commBeam = new THREE.Line(beamGeom, beamMat);
    this.commBeam.visible = false;
    this.scene.add(this.commBeam);
  }

  /**
   * Update Earth spin and Aalborg GS position in 3D scene
   */
  update(simTime, sat3DPos, hasLOS, gsECI) {
    // Rotate Earth around Y-axis based on sidereal rate
    const earthAngle = CONSTANTS.EARTH_ROTATION_RATE * simTime;
    this.earthSphere.rotation.y = earthAngle;

    // Position Aalborg 3D beacon
    const lat = CONSTANTS.AALBORG_LAT;
    const lon = CONSTANTS.AALBORG_LON + earthAngle;

    const r = this.earthScale;
    const gx = r * Math.cos(lat) * Math.cos(lon);
    const gy = r * Math.sin(lat);
    const gz = -r * Math.cos(lat) * Math.sin(lon);

    this.gsGroup.position.set(gx, gy, gz);
    this.gsGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(gx, gy, gz).normalize());

    // Update comm beam
    if (hasLOS) {
      this.commBeam.visible = true;
      const positions = this.commBeam.geometry.attributes.position.array;
      positions[0] = gx; positions[1] = gy; positions[2] = gz;
      positions[3] = sat3DPos.x; positions[4] = sat3DPos.y; positions[5] = sat3DPos.z;
      this.commBeam.geometry.attributes.position.needsUpdate = true;
    } else {
      this.commBeam.visible = false;
    }
  }

  updateOrbitTrack(inclinationRad, altitudeMeters) {
    const r3D = this.earthScale * (CONSTANTS.EARTH_RADIUS + altitudeMeters) / CONSTANTS.EARTH_RADIUS;
    this.orbitLine.rotation.x = inclinationRad - Math.PI / 2;
    this.orbitLine.scale.set(r3D / (this.earthScale * 1.078), r3D / (this.earthScale * 1.078), r3D / (this.earthScale * 1.078));
  }
}
