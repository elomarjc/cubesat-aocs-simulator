/**
 * Three.js 3D Scene, Camera, Lighting & Viewport Management
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
    this.camera.position.set(0, 3.5, 7.8); // Panoramic orbital view of Earth (radius 3.0) and orbit ring

    // Camera target modes: 'ORBITAL' (Earth centered), 'CHASER' (satellite tracking)
    this.viewMode = 'ORBITAL';
    this.lastSatPos = new THREE.Vector3(0, 0, 0);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.target.set(0, 0, 0);
      this.controls.minDistance = 3.25; // Prevents entering inside Earth (radius 3.0)
      this.controls.maxDistance = 40.0;
      this.controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
      };
    }

    // 5. Lighting
    this.setupLighting();

    // 6. Deep Space Starfield
    this.setupStarfield();

    // Handle Window Resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupLighting() {
    // Ambient starlight / Earthshine
    this.ambientLight = new THREE.AmbientLight(0x101b33, 0.9);
    this.scene.add(this.ambientLight);

    // Primary Sun directional light
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.4);
    this.sunLight.position.set(100, 20, 50);
    this.scene.add(this.sunLight);

    // Secondary earthshine bounce
    this.earthshineLight = new THREE.DirectionalLight(0x2266aa, 0.5);
    this.earthshineLight.position.set(0, -100, 0);
    this.scene.add(this.earthshineLight);
  }

  setupStarfield() {
    const starCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 800 + Math.random() * 200;

      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);

      const colorType = Math.random();
      if (colorType > 0.8) {
        colors[i] = 1.0; colors[i + 1] = 0.85; colors[i + 2] = 0.7; // Warm gold
      } else if (colorType > 0.3) {
        colors[i] = 0.9; colors[i + 1] = 0.95; colors[i + 2] = 1.0; // Pure white
      } else {
        colors[i] = 0.7; colors[i + 1] = 0.85; colors[i + 2] = 1.0; // Blue giant
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
      this.camera.position.set(0, 3.5, 7.8);
      this.controls.minDistance = 3.25;
      this.controls.maxDistance = 40.0;
    } else if (mode === 'CHASER') {
      this.controls.minDistance = 0.15;
      this.controls.maxDistance = 8.0;
      if (sat3DPos) {
        this.controls.target.copy(sat3DPos);
        const toEarth = sat3DPos.clone().normalize();
        const camOffset = toEarth.clone().multiplyScalar(0.4).add(new THREE.Vector3(0.4, 0.3, 0.5));
        this.camera.position.copy(sat3DPos).add(camOffset);
        this.lastSatPos.copy(sat3DPos);
      }
    }
  }

  updateCamera(sat3DPos) {
    if (!this.controls || !sat3DPos) return;

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
    // ECI to Three.js: (x, z, -y)
    this.sunLight.position.set(sECI.x * 100, sECI.z * 100, -sECI.y * 100);
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
