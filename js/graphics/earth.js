/**
 * 3D Earth Globe with Procedural Continents, Atmosphere Glow, Orbit Path & Aalborg Ground Station
 * Generates smooth, realistic planetary surface with zero polar distortion or keyholes.
 */

import { CONSTANTS } from '../physics/orbit.js';

export class EarthVisualizer {
  constructor(scene) {
    this.scene = scene;
    // Earth physical visual radius
    this.earthScale = 3.0; // 3.0 units in 3D scene
    // Visual clearance for orbit so satellite and orbit ring float comfortably above globe
    this.orbitBaseRadius = 3.8; // 0.8 units clearance above Earth surface (never clips!)
    this.satScaleRatio = (this.orbitBaseRadius - this.earthScale) / 500e3; // Scales relative to 500km altitude

    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);

    this.setupEarthMesh();
    this.setupAtmosphere();
    this.setupOrbitTrack();
    this.setupAalborgGroundStation();
  }

  setupEarthMesh() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 1. Deep Ocean Gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
    oceanGrad.addColorStop(0, '#06162d');
    oceanGrad.addColorStop(0.3, '#0b264d');
    oceanGrad.addColorStop(0.5, '#071d3d');
    oceanGrad.addColorStop(0.7, '#0b264d');
    oceanGrad.addColorStop(1, '#06162d');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // Helper: equirectangular map coords (lon -180..180 -> x 0..1024, lat -90..90 -> y 512..0)
    const mapPt = (lon, lat) => [((lon + 180) / 360) * 1024, ((90 - lat) / 180) * 512];

    const drawPoly = (pts, fillStyle, strokeStyle = null) => {
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = mapPt(pts[i][0], pts[i][1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    // 2. Continents with realistic polygon coastlines
    // Europe & Scandinavia
    drawPoly([
      [-10, 36], [0, 37], [10, 38], [15, 40], [28, 41], [30, 46], [40, 47],
      [45, 55], [35, 65], [25, 71], [15, 68], [8, 58], [12, 55], [5, 53],
      [-5, 48], [-9, 43], [-10, 36]
    ], '#1e4823', 'rgba(0, 229, 255, 0.2)');

    // British Isles
    drawPoly([[-10, 51], [-2, 50], [1, 53], [-2, 58], [-6, 58], [-10, 54]], '#23532a');

    // Africa
    drawPoly([
      [-17, 15], [-12, 28], [-5, 36], [10, 37], [25, 32], [32, 31], [43, 12],
      [51, 11], [42, -5], [35, -20], [28, -34], [18, -34], [12, -18], [9, 4],
      [-5, 5], [-17, 15]
    ], '#254e22', 'rgba(0, 229, 255, 0.15)');

    // Sahara Desert overlay
    drawPoly([
      [-16, 16], [-10, 30], [0, 35], [25, 32], [35, 28], [35, 15],
      [20, 15], [0, 15], [-16, 16]
    ], '#8c7744');

    // Arabian Peninsula
    drawPoly([[35, 29], [48, 30], [59, 24], [54, 16], [44, 13], [36, 22]], '#94804c');

    // Asia & Siberia
    drawPoly([
      [40, 47], [50, 46], [60, 40], [70, 38], [75, 28], [80, 15], [90, 22],
      [100, 18], [105, 10], [115, 22], [122, 30], [122, 40], [130, 43],
      [142, 50], [170, 65], [175, 72], [100, 78], [60, 74], [45, 55]
    ], '#244d23', 'rgba(0, 229, 255, 0.15)');

    // India
    drawPoly([[70, 24], [78, 8], [85, 20], [75, 28]], '#295b28');

    // North America & Canada
    drawPoly([
      [-168, 65], [-140, 70], [-100, 70], [-80, 72], [-65, 60], [-60, 46],
      [-75, 35], [-80, 25], [-97, 26], [-105, 20], [-105, 30], [-120, 35],
      [-125, 48], [-140, 58], [-165, 60]
    ], '#234a22', 'rgba(0, 229, 255, 0.15)');

    // Central & South America
    drawPoly([[-105, 20], [-87, 13], [-77, 8], [-83, 10], [-97, 18]], '#295b28');
    drawPoly([
      [-77, 8], [-60, 10], [-35, -5], [-38, -18], [-50, -32], [-65, -54],
      [-75, -45], [-72, -20], [-81, -4], [-77, 8]
    ], '#1e4823', 'rgba(0, 229, 255, 0.15)');

    // Australia
    drawPoly([
      [114, -22], [122, -15], [136, -12], [148, -18], [152, -28], [150, -37],
      [138, -35], [128, -32], [115, -34], [114, -22]
    ], '#7d6a3e');

    // 3. Smooth Polar Ice Caps (Gradient fading so NO sharp edges or polar singularities)
    const arcticGrad = ctx.createLinearGradient(0, 0, 0, 40);
    arcticGrad.addColorStop(0, '#e8f4fc');
    arcticGrad.addColorStop(0.6, '#d0e5f5');
    arcticGrad.addColorStop(1, 'rgba(208, 229, 245, 0)');
    ctx.fillStyle = arcticGrad;
    ctx.fillRect(0, 0, 1024, 40);

    const antarcticGrad = ctx.createLinearGradient(0, 470, 0, 512);
    antarcticGrad.addColorStop(0, 'rgba(208, 229, 245, 0)');
    antarcticGrad.addColorStop(0.4, '#d0e5f5');
    antarcticGrad.addColorStop(1, '#e8f4fc');
    ctx.fillStyle = antarcticGrad;
    ctx.fillRect(0, 470, 1024, 42);

    // 4. Subtle Night-Side City Lights (Golden speckles on populated continents)
    ctx.fillStyle = 'rgba(255, 225, 130, 0.8)';
    const cities = [
      [540, 93], [520, 115], [512, 118], [518, 125], [530, 130], [550, 140],
      [575, 110], [590, 135], [260, 140], [280, 150], [290, 160], [240, 165],
      [820, 145], [840, 160], [860, 175], [890, 160], [740, 200], [780, 330]
    ];
    for (const [cx, cy] of cities) {
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Latitude & Longitude navigation grid lines
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1024; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Aalborg pinpoint beacon (9.92 E, 57.05 N -> x=540, y=93)
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.arc(540, 93, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(540, 93, 6.5, 0, Math.PI * 2);
    ctx.stroke();

    const earthTexture = new THREE.CanvasTexture(canvas);

    const earthGeom = new THREE.SphereGeometry(this.earthScale, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.82,
      metalness: 0.08
    });

    this.earthSphere = new THREE.Mesh(earthGeom, earthMat);
    this.earthGroup.add(this.earthSphere);
  }

  setupAtmosphere() {
    const atmoGeom = new THREE.SphereGeometry(this.earthScale * 1.025, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide
    });
    this.atmosphere = new THREE.Mesh(atmoGeom, atmoMat);
    this.earthGroup.add(this.atmosphere);
  }

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

  /**
   * Dynamically generate 3D orbit ring with clean clearance above Earth surface
   */
  generateOrbitTrack(orbitPropagator) {
    if (!orbitPropagator) return;
    const segments = 256;
    const period = orbitPropagator.period;
    const positions = new Float32Array((segments + 1) * 3);

    // Orbit radius with 0.8 units visual clearance
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

  setupAalborgGroundStation() {
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
      opacity: 0.15,
      wireframe: true
    });
    this.radarCone = new THREE.Mesh(coneGeom, coneMat);
    this.radarCone.position.set(0, 0.22, 0);
    this.gsGroup.add(this.radarCone);

    // Ground station communication beam
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
  }

  update(simTime, sat3DPos, hasLOS, gsECI) {
    const earthAngle = CONSTANTS.EARTH_ROTATION_RATE * simTime;
    this.earthSphere.rotation.y = earthAngle;

    const lat = CONSTANTS.AALBORG_LAT;
    const lon = CONSTANTS.AALBORG_LON + earthAngle;

    const r = this.earthScale;
    const gx = r * Math.cos(lat) * Math.cos(lon);
    const gy = r * Math.sin(lat);
    const gz = -r * Math.cos(lat) * Math.sin(lon);

    this.gsGroup.position.set(gx, gy, gz);
    this.gsGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(gx, gy, gz).normalize());

    if (hasLOS && sat3DPos) {
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
    this.generateOrbitTrack(null);
  }
}
