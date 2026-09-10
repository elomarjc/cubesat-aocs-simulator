/**
 * Detailed Procedural 3U CubeSat 3D Model
 * Dimensions: 10cm x 10cm x 34cm
 * Scaled cleanly so it never clips the Earth globe, featuring high-tech aerospace HUD reticle.
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
    this.setupTacticalReticle();
  }

  setupChassis() {
    const w = 0.1, h = 0.1, d = 0.34;

    // Dark space-grade anodized aluminum frame rails
    const frameGeom = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(frameGeom);
    const railMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 2 });
    this.chassisWire = new THREE.LineSegments(edges, railMat);
    this.group.add(this.chassisWire);

    // Multi-Layer Insulation (MLI) gold reflective foil facets with radiant space glow
    const mliMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffa000,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.2
    });
    const mliMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.96, d * 0.96), mliMat);
    this.group.add(mliMesh);
  }

  setupSolarPanels() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#081c3b';
    ctx.fillRect(0, 0, 128, 256);

    ctx.strokeStyle = '#c0d0e0';
    ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(128, y);
      ctx.stroke();
    }
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

    const panelX1 = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.32), solarMat);
    panelX1.position.set(0.051, 0, 0);
    panelX1.rotation.y = Math.PI / 2;
    this.group.add(panelX1);

    const panelX2 = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.32), solarMat);
    panelX2.position.set(-0.051, 0, 0);
    panelX2.rotation.y = -Math.PI / 2;
    this.group.add(panelX2);

    // Deployable solar wings (+Y and -Y)
    const wingGeom = new THREE.BoxGeometry(0.004, 0.16, 0.30);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0a2244, metalness: 0.8, roughness: 0.3 });

    this.solarWingPos = new THREE.Mesh(wingGeom, wingMat);
    this.solarWingPos.position.set(0, 0.13, 0);
    this.group.add(this.solarWingPos);

    this.solarWingNeg = new THREE.Mesh(wingGeom, wingMat);
    this.solarWingNeg.position.set(0, -0.13, 0);
    this.group.add(this.solarWingNeg);
  }

  setupPayloadAperture() {
    const lensGeom = new THREE.CylinderGeometry(0.025, 0.028, 0.015, 24);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
    const lens = new THREE.Mesh(lensGeom, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.171);
    this.group.add(lens);

    const glassGeom = new THREE.CircleGeometry(0.022, 24);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const glass = new THREE.Mesh(glassGeom, glassMat);
    glass.position.set(0, 0, 0.179);
    this.group.add(glass);
  }

  setupInternalActuators() {
    const wheelGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.008, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, metalness: 0.9, roughness: 0.2 });

    this.wheelMeshX = new THREE.Mesh(wheelGeom, wheelMat);
    this.wheelMeshX.position.set(0.03, 0, -0.05);
    this.wheelMeshX.rotation.z = Math.PI / 2;
    this.group.add(this.wheelMeshX);

    this.wheelMeshY = new THREE.Mesh(wheelGeom, wheelMat);
    this.wheelMeshY.position.set(0, 0.03, -0.05);
    this.group.add(this.wheelMeshY);

    this.wheelMeshZ = new THREE.Mesh(wheelGeom, wheelMat);
    this.wheelMeshZ.position.set(0, 0, -0.08);
    this.wheelMeshZ.rotation.x = Math.PI / 2;
    this.group.add(this.wheelMeshZ);

    const rodGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.07, 12);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.4 });

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
    this.axesHelper = new THREE.AxesHelper(0.25);
    this.group.add(this.axesHelper);
  }

  setupTacticalReticle() {
    // 1. Subtle glowing beacon dot
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 28);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, '#00e5ff');
    grad.addColorStop(0.6, 'rgba(0, 229, 255, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.beaconSprite = new THREE.Sprite(spriteMat);
    this.beaconSprite.scale.set(0.35, 0.35, 1.0);
    this.group.add(this.beaconSprite);

    // 2. Tactical Aerospace Corner Brackets (Non-intrusive HUD reticle)
    const lineGeom = new THREE.BufferGeometry();
    const b = 0.22, s = 0.06;
    const pts = [
      // Top-Left corner
      new THREE.Vector3(-b, b - s, 0), new THREE.Vector3(-b, b, 0),
      new THREE.Vector3(-b, b, 0), new THREE.Vector3(-b + s, b, 0),
      // Top-Right corner
      new THREE.Vector3(b - s, b, 0), new THREE.Vector3(b, b, 0),
      new THREE.Vector3(b, b, 0), new THREE.Vector3(b, b - s, 0),
      // Bottom-Right corner
      new THREE.Vector3(b, -b + s, 0), new THREE.Vector3(b, -b, 0),
      new THREE.Vector3(b, -b, 0), new THREE.Vector3(b - s, -b, 0),
      // Bottom-Left corner
      new THREE.Vector3(-b + s, -b, 0), new THREE.Vector3(-b, -b, 0),
      new THREE.Vector3(-b, -b, 0), new THREE.Vector3(-b, -b + s, 0)
    ];
    lineGeom.setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.75,
      linewidth: 1.5
    });
    this.hudReticle = new THREE.LineSegments(lineGeom, lineMat);
    this.group.add(this.hudReticle);
  }

  update(qAttitude, wheelRPM, sat3DPos = new THREE.Vector3(0,0,0), viewMode = 'ORBITAL') {
    const q_ECI_to_3D = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const qSat = new THREE.Quaternion(qAttitude.q1, qAttitude.q2, qAttitude.q3, qAttitude.q0);
    this.group.quaternion.copy(q_ECI_to_3D).multiply(qSat);
    this.group.position.copy(sat3DPos);

    // Keep reticle always facing camera
    if (this.hudReticle && this.scene && this.scene.camera) {
      this.hudReticle.quaternion.copy(this.scene.camera.quaternion);
    }

    if (viewMode === 'ORBITAL') {
      // Highly visible aerospace scale (1.8x) so satellite is clearly seen in orbit
      this.group.scale.setScalar(1.8);
      if (this.beaconSprite) {
        this.beaconSprite.visible = true;
        this.beaconSprite.scale.set(0.9, 0.9, 1.0);
      }
      if (this.hudReticle) this.hudReticle.visible = true;
    } else {
      // Full 1:1 true scale in close-up chaser camera
      this.group.scale.setScalar(1.0);
      if (this.beaconSprite) this.beaconSprite.visible = false;
      if (this.hudReticle) this.hudReticle.visible = false;
    }

    if (this.wheelMeshX) this.wheelMeshX.rotation.y += (wheelRPM.x * 0.001);
    if (this.wheelMeshY) this.wheelMeshY.rotation.y += (wheelRPM.y * 0.001);
    if (this.wheelMeshZ) this.wheelMeshZ.rotation.y += (wheelRPM.z * 0.001);
  }
}
