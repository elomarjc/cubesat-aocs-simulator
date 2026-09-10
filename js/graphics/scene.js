/**
 * Three.js 3D Scene, Camera, Lighting & Viewport Management
 * Places incandescent Sun with coronal flare in upper-right sky directly inside camera FOV.
 */

export class SpaceScene {
  constructor(containerElement) {
    this.container = containerElement;
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera - Global Orbital default viewing Earth and orbiting CubeSat
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.05, 10000);
    const isMobileAspect = (this.width / this.height) < 1.0;
    // On mobile portrait, set distance to 13.8 so Earth + Orbit fit completely without zooming out
    const initDist = isMobileAspect ? 13.8 : 8.6;
    const initY = isMobileAspect ? 4.5 : 3.2;
    this.camera.position.set(0, initY, initDist);

    this.viewMode = 'ORBITAL';
    this.lastSatPos = new THREE.Vector3(0, 0, 0);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.target.set(0, 0, 0);
      this.controls.minDistance = 3.25;
      this.controls.maxDistance = 50.0;
      this.controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
      };
    }

    // 5. Lighting & Visual Sun
    this.setupSunAndLighting();

    // 6. Deep Space Starfield
    this.setupStarfield();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupSunAndLighting() {
    // Ambient starlight / Earthshine - boosted for crisp visibility everywhere
    this.ambientLight = new THREE.AmbientLight(0x354d72, 2.2);
    this.scene.add(this.ambientLight);

    // Primary Sun directional light
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 3.2);
    this.scene.add(this.sunLight);

    // Satellite tracking beacon light (illuminates satellite even on Earth dark side)
    this.satFillLight = new THREE.PointLight(0x00e5ff, 2.5, 15);
    this.scene.add(this.satFillLight);

    // Secondary earthshine bounce
    this.earthshineLight = new THREE.DirectionalLight(0x2266aa, 0.35);
    this.earthshineLight.position.set(0, -100, 0);
    this.scene.add(this.earthshineLight);

    // 3D Visual Sun Group (Placed in upper-right sky inside FOV)
    this.sunGroup = new THREE.Group();
    this.scene.add(this.sunGroup);

    // 1. Incandescent White Sun Core
    const sunGeom = new THREE.SphereGeometry(1.6, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sunCore = new THREE.Mesh(sunGeom, sunMat);
    this.sunGroup.add(sunCore);

    // 2. Photosphere Glow Layer
    const photoGeom = new THREE.SphereGeometry(2.1, 32, 32);
    const photoMat = new THREE.MeshBasicMaterial({
      color: 0xffd54f,
      transparent: true,
      opacity: 0.88
    });
    const photosphere = new THREE.Mesh(photoGeom, photoMat);
    this.sunGroup.add(photosphere);

    // 3. Coronal Flare Billboard Sprite
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.15, 'rgba(255, 250, 210, 0.95)');
    grad.addColorStop(0.35, 'rgba(255, 235, 59, 0.8)');
    grad.addColorStop(0.65, 'rgba(255, 152, 0, 0.35)');
    grad.addColorStop(0.85, 'rgba(255, 87, 34, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const coronaTex = new THREE.CanvasTexture(canvas);
    const coronaMat = new THREE.SpriteMaterial({
      map: coronaTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.coronaSprite = new THREE.Sprite(coronaMat);
    this.coronaSprite.scale.set(14.0, 14.0, 1.0);
    this.sunGroup.add(this.coronaSprite);

    // Default position in upper-right sky (visible inside mobile FOV)
    const defaultSunPos = new THREE.Vector3(12, 7, -6);
    this.sunGroup.position.copy(defaultSunPos);
    this.sunLight.position.copy(defaultSunPos);
  }

  setupStarfield() {
    const starCount = 2200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 700 + Math.random() * 200;

      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);

      const colorType = Math.random();
      if (colorType > 0.8) {
        colors[i] = 1.0; colors[i + 1] = 0.88; colors[i + 2] = 0.72;
      } else if (colorType > 0.3) {
        colors[i] = 0.92; colors[i + 1] = 0.96; colors[i + 2] = 1.0;
      } else {
        colors[i] = 0.75; colors[i + 1] = 0.88; colors[i + 2] = 1.0;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  setViewMode(mode, sat3DPos = null) {
    this.viewMode = mode;
    if (!this.controls) return;

    if (mode === 'ORBITAL') {
      this.controls.target.set(0, 0, 0);
      const isMobileAspect = (this.width / this.height) < 1.0;
      const targetDist = isMobileAspect ? 13.8 : 8.6;
      const targetY = isMobileAspect ? 4.5 : 3.2;
      this.camera.position.set(0, targetY, targetDist);
      this.controls.minDistance = 3.25;
      this.controls.maxDistance = 50.0;
    } else if (mode === 'CHASER') {
      this.controls.minDistance = 0.15;
      this.controls.maxDistance = 8.0;
      if (sat3DPos) {
        this.controls.target.copy(sat3DPos);
        const toEarth = sat3DPos.clone().normalize();
        const camOffset = toEarth.clone().multiplyScalar(0.4).add(new THREE.Vector3(0.35, 0.25, 0.45));
        this.camera.position.copy(sat3DPos).add(camOffset);
        this.lastSatPos.copy(sat3DPos);
      }
    }
  }

  updateCamera(sat3DPos) {
    if (!this.controls || !sat3DPos) return;
    if (this.satFillLight) {
      this.satFillLight.position.copy(sat3DPos).add(new THREE.Vector3(0.5, 0.5, 0.8));
    }

    if (this.viewMode === 'CHASER') {
      if (this.lastSatPos.lengthSq() > 0) {
        const delta = sat3DPos.clone().sub(this.lastSatPos);
        this.camera.position.add(delta);
      }
      this.controls.target.copy(sat3DPos);
      this.lastSatPos.copy(sat3DPos);
    } else {
      this.controls.target.set(0, 0, 0);
    }
  }

  updateSunPosition(sECI) {
    if (!sECI) return;
    // Map astrodynamics ECI to Three.js coordinates: (x, z, -y)
    const s3D = new THREE.Vector3(sECI.x, sECI.z, -sECI.y).normalize();

    // Position Sun in upper-right sky at distance ~18 (inside mobile camera FOV)
    const sunDist = 18.0;
    const sunPos = new THREE.Vector3(
      s3D.x * sunDist,
      Math.max(4.0, s3D.y * sunDist + 4.0),
      s3D.z * sunDist - 4.0
    );

    this.sunGroup.position.copy(sunPos);
    this.sunLight.position.copy(sunPos);
  }

  onWindowResize() {
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  render() {
    if (this.controls) {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
