/**
 * Detailed Procedural 3U CubeSat 3D Model
 * Dimensions: 10cm x 10cm x 34cm (scaled to 0.1 x 0.1 x 0.34 in 3D units)
 * Features: Space-grade aluminum chassis, gold MLI insulation, solar arrays,
 * 3 orthogonal reaction wheel flywheels, magnetorquer coil rods, payload camera,
 * body axes triad, and orbital locator beacon.
 */

export class CubeSatModel {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.setupChassis();
    this.setupSolarPanels();
    this.setupPayloadAperture();
    this.setupInternalActuators();
    this.setupAntennas();
    this.setupBodyAxes();
    this.setupBeacon();
  }

  setupChassis() {
    // 3U CubeSat dimensions: 0.1m x 0.1m x 0.34m
    const w = 0.1, h = 0.1, d = 0.34;

    // Dark space-grade anodized aluminum frame rails
    const frameGeom = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(frameGeom);
    const railMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 2 });
    this.chassisWire = new THREE.LineSegments(edges, railMat);
    this.group.add(this.chassisWire);

    // Multi-Layer Insulation (MLI) gold reflective foil facets
    const mliMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Metallic gold
      metalness: 0.85,
      roughness: 0.25
    });
    const mliMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.96, d * 0.96), mliMat);
    this.group.add(mliMesh);
  }

  setupSolarPanels() {
    // Dark blue silicon photovoltaic cell texture canvas
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#081c3b'; // Deep silicon blue
    ctx.fillRect(0, 0, 128, 256);

    // Solar cell grid subdivisions & silver bus bars
    ctx.strokeStyle = '#c0d0e0';
    ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
    // Vertical bus bars
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, 0); ctx.lineTo(42, 256);
    ctx.moveTo(85, 0); ctx.lineTo(85, 256);
    ctx.stroke();

    const solarTex = new THREE.CanvasTexture(canvas);
    const solarMat = new THREE.MeshStandardMaterial({
      map: solarTex,
      metalness: 0.7,
      roughness: 0.3
    });

    // Side panel (+X face)
    const panelX1 = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.32), solarMat);
    panelX1.position.set(0.051, 0, 0);
    panelX1.rotation.y = Math.PI / 2;
    this.group.add(panelX1);

    // Side panel (-X face)
    const panelX2 = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.32), solarMat);
    panelX2.position.set(-0.051, 0, 0);
    panelX2.rotation.y = -Math.PI / 2;
    this.group.add(panelX2);

    // Deployable solar wings (+Y and -Y)
    const wingGeom = new THREE.BoxGeometry(0.004, 0.18, 0.32);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0a2244, metalness: 0.8, roughness: 0.3 });

    this.solarWingPos = new THREE.Mesh(wingGeom, wingMat);
    this.solarWingPos.position.set(0, 0.14, 0);
    this.group.add(this.solarWingPos);

    this.solarWingNeg = new THREE.Mesh(wingGeom, wingMat);
    this.solarWingNeg.position.set(0, -0.14, 0);
    this.group.add(this.solarWingNeg);
  }

  setupPayloadAperture() {
    // Earth Observation camera lens on +Z face
    const lensGeom = new THREE.CylinderGeometry(0.025, 0.028, 0.015, 24);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
    const lens = new THREE.Mesh(lensGeom, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.171);
    this.group.add(lens);

    // Glass optic aperture
    const glassGeom = new THREE.CircleGeometry(0.022, 24);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const glass = new THREE.Mesh(glassGeom, glassMat);
    glass.position.set(0, 0, 0.179);
    this.group.add(glass);
  }

  setupInternalActuators() {
    // 3 Reaction Wheel Flywheels (X, Y, Z)
    const wheelGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.008, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, metalness: 0.9, roughness: 0.2 });

    // Wheel X
    this.wheelMeshX = new THREE.Mesh(wheelGeom, wheelMat);
    this.wheelMeshX.position.set(0.03, 0, -0.05);
    this.wheelMeshX.rotation.z = Math.PI / 2;
    this.group.add(this.wheelMeshX);

    // Wheel Y
    this.wheelMeshY = new THREE.Mesh(wheelGeom, wheelMat);
    this.wheelMeshY.position.set(0, 0.03, -0.05);
    this.group.add(this.wheelMeshY);

    // Wheel Z
    this.wheelMeshZ = new THREE.Mesh(wheelGeom, wheelMat);
    this.wheelMeshZ.position.set(0, 0, -0.08);
    this.wheelMeshZ.rotation.x = Math.PI / 2;
    this.group.add(this.wheelMeshZ);

    // 3 Magnetorquer Rods (copper coil windings)
    const rodGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.07, 12);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.4 }); // Copper

    const rodX = new THREE.Mesh(rodGeom, rodMat);
    rodX.rotation.z = Math.PI / 2;
    rodX.position.set(0, -0.035, 0.05);
    this.group.add(rodX);

    const rodY = new THREE.Mesh(rodGeom, rodMat);
    rodY.position.set(-0.035, 0, 0.05);
    this.group.add(rodY);

    const rodZ = new THREE.Mesh(rodGeom, rodMat);
    rodZ.rotation.x = Math.PI / 2;
    rodZ.position.set(-0.035, -0.035, 0);
    this.group.add(rodZ);
  }

  setupAntennas() {
    // 4 Deployable tape-spring UHF dipole antennas on -Z face
    const antGeom = new THREE.CylinderGeometry(0.001, 0.001, 0.16, 8);
    const antMat = new THREE.MeshBasicMaterial({ color: 0xffab00 });

    const ant1 = new THREE.Mesh(antGeom, antMat);
    ant1.position.set(0.08, 0, -0.17);
    ant1.rotation.z = Math.PI / 3;
    this.group.add(ant1);

    const ant2 = new THREE.Mesh(antGeom, antMat);
    ant2.position.set(-0.08, 0, -0.17);
    ant2.rotation.z = -Math.PI / 3;
    this.group.add(ant2);
  }

  setupBodyAxes() {
    // Axes triad: X=Red, Y=Green, Z=Blue
    this.axesHelper = new THREE.AxesHelper(0.25);
    this.group.add(this.axesHelper);
  }

  setupBeacon() {
    // Glowing beacon billboard sprite for orbital view
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0, 229, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(0, 200, 255, 0.7)');
    grad.addColorStop(0.7, 'rgba(0, 100, 255, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      color: 0x00e5ff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.beaconSprite = new THREE.Sprite(spriteMat);
    this.beaconSprite.scale.set(0.85, 0.85, 1.0);
    this.group.add(this.beaconSprite);

    // Orbit locator ring
    const ringGeom = new THREE.RingGeometry(0.18, 0.22, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    this.locatorRing = new THREE.Mesh(ringGeom, ringMat);
    this.group.add(this.locatorRing);
  }

  /**
   * Update satellite orientation from attitude quaternion [q0, q1, q2, q3]
   * and position in 3D orbit around the Earth
   */
  update(qAttitude, wheelRPM, sat3DPos = new THREE.Vector3(0,0,0), viewMode = 'ORBITAL') {
    // Astrodynamics ECI to Three.js coordinates:
    // Rotate around X by -90 deg so that +Z_ECI (North) maps to +Y_3D (North)
    const q_ECI_to_3D = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const qSat = new THREE.Quaternion(qAttitude.q1, qAttitude.q2, qAttitude.q3, qAttitude.q0);
    this.group.quaternion.copy(q_ECI_to_3D).multiply(qSat);
    this.group.position.copy(sat3DPos);

    // Dynamic visual scale & beacon based on camera view mode
    if (viewMode === 'ORBITAL') {
      this.group.scale.setScalar(2.5); // Clearly visible spacecraft structure in global Earth view
      if (this.beaconSprite) this.beaconSprite.visible = true;
      if (this.locatorRing) this.locatorRing.visible = true;
    } else {
      this.group.scale.setScalar(1.0); // 1:1 true scale in close-up chaser camera
      if (this.beaconSprite) this.beaconSprite.visible = false;
      if (this.locatorRing) this.locatorRing.visible = false;
    }

    // Spin reaction wheel meshes
    if (this.wheelMeshX) this.wheelMeshX.rotation.y += (wheelRPM.x * 0.001);
    if (this.wheelMeshY) this.wheelMeshY.rotation.y += (wheelRPM.y * 0.001);
    if (this.wheelMeshZ) this.wheelMeshZ.rotation.y += (wheelRPM.z * 0.001);
  }
}
