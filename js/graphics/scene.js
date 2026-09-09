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

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.01, 10000);
    this.camera.position.set(0.6, 0.5, 0.9); // Initial chaser position relative to CubeSat

    // Camera target modes: 'CHASER', 'ORBITAL', 'PAYLOAD'
    this.viewMode = 'CHASER';

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
      this.controls.minDistance = 0.2;
      this.controls.maxDistance = 50.0;
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
    this.ambientLight = new THREE.AmbientLight(0x101b33, 0.8);
    this.scene.add(this.ambientLight);

    // Primary Sun directional light
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    this.sunLight.position.set(100, 20, 50);
    this.scene.add(this.sunLight);

    // Secondary earthshine bounce
    this.earthshineLight = new THREE.DirectionalLight(0x2266aa, 0.4);
    this.earthshineLight.position.set(0, -100, 0);
    this.scene.add(this.earthshineLight);
  }

  setupStarfield() {
    const starCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      // Distribute stars on a large sphere radius 500
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 800 + Math.random() * 200;

      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);

      // Star color variation (cool blue, warm white, slight golden)
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

  setViewMode(mode, satWorldPos = new THREE.Vector3(0,0,0), earthWorldPos = new THREE.Vector3(0,-5,0)) {
    this.viewMode = mode;
    if (!this.controls) return;

    if (mode === 'CHASER') {
      this.controls.target.copy(satWorldPos);
      this.camera.position.set(satWorldPos.x + 0.6, satWorldPos.y + 0.4, satWorldPos.z + 0.8);
      this.controls.minDistance = 0.2;
      this.controls.maxDistance = 15.0;
    } else if (mode === 'ORBITAL') {
      this.controls.target.copy(earthWorldPos);
      this.camera.position.set(earthWorldPos.x + 10, earthWorldPos.y + 8, earthWorldPos.z + 15);
      this.controls.minDistance = 4.0;
      this.controls.maxDistance = 40.0;
    } else if (mode === 'PAYLOAD') {
      this.controls.target.copy(earthWorldPos);
      this.camera.position.copy(satWorldPos);
    }
  }

  updateSunPosition(sECI) {
    this.sunLight.position.set(sECI.x * 100, sECI.y * 100, sECI.z * 100);
  }

  onWindowResize() {
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  render() {
    if (this.controls && this.viewMode !== 'PAYLOAD') {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
