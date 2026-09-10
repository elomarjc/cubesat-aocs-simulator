/**
 * 3D Force & Field Vector Visualizer Overlays
 * Draws dynamic 3D arrows for:
 * - Geomagnetic field vector B (Magenta)
 * - Sun direction vector (Yellow)
 * - Nadir Earth vector (Cyan)
 * - Reaction wheel torque tau_rw (Blue)
 * - Magnetorquer dipole moment m (Orange)
 */

export class VectorVisualizer {
  constructor(scene) {
    this.scene = scene;
    this.visible = {
      bField: true,
      sun: true,
      nadir: true,
      torque: true,
      mtq: true
    };

    const origin = new THREE.Vector3(0, 0, 0);

    // 1. Magnetic field B (Magenta)
    this.bArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, 0.35, 0xff00ff, 0.08, 0.04);
    this.scene.add(this.bArrow);

    // 2. Sun vector (Yellow/Gold)
    this.sunArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, 0.4, 0xffd600, 0.09, 0.05);
    this.scene.add(this.sunArrow);

    // 3. Nadir vector (Cyan)
    this.nadirArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, 0.38, 0x00e5ff, 0.08, 0.04);
    this.scene.add(this.nadirArrow);

    // 4. Net Wheel Torque (Neon Blue)
    this.torqueArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, 0.3, 0x2979ff, 0.06, 0.035);
    this.scene.add(this.torqueArrow);

    // 5. Magnetorquer dipole (Orange)
    this.mtqArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, 0.3, 0xff6d00, 0.06, 0.035);
    this.scene.add(this.mtqArrow);
  }

  update(sat3DPos, bVecECI, sunVecECI, nadirVecECI, cmdTorqueRW, cmdDipoleMTQ, satQuat) {
    this.bArrow.position.copy(sat3DPos);
    this.sunArrow.position.copy(sat3DPos);
    this.nadirArrow.position.copy(sat3DPos);
    this.torqueArrow.position.copy(sat3DPos);
    this.mtqArrow.position.copy(sat3DPos);

    // 1. B field (ECI to Three.js: x, z, -y)
    const bLen = Math.hypot(bVecECI.x, bVecECI.y, bVecECI.z);
    if (bLen > 1e-10 && this.visible.bField) {
      this.bArrow.visible = true;
      this.bArrow.setDirection(new THREE.Vector3(bVecECI.x / bLen, bVecECI.z / bLen, -bVecECI.y / bLen));
      this.bArrow.setLength(0.35, 0.08, 0.04);
    } else {
      this.bArrow.visible = false;
    }

    // 2. Sun vector (ECI to Three.js: x, z, -y)
    const sLen = Math.hypot(sunVecECI.x, sunVecECI.y, sunVecECI.z);
    if (sLen > 1e-10 && this.visible.sun) {
      this.sunArrow.visible = true;
      this.sunArrow.setDirection(new THREE.Vector3(sunVecECI.x / sLen, sunVecECI.z / sLen, -sunVecECI.y / sLen));
      this.sunArrow.setLength(0.4, 0.09, 0.05);
    } else {
      this.sunArrow.visible = false;
    }

    // 3. Nadir vector (points from sat to Earth center (0,0,0))
    if (this.visible.nadir) {
      this.nadirArrow.visible = true;
      const toCenter = sat3DPos.clone().negate().normalize();
      this.nadirArrow.setDirection(toCenter);
      this.nadirArrow.setLength(0.38, 0.08, 0.04);
    } else {
      this.nadirArrow.visible = false;
    }

    // 4. Reaction wheel torque (Body frame -> World frame via satQuat)
    const tLen = Math.hypot(cmdTorqueRW.x, cmdTorqueRW.y, cmdTorqueRW.z);
    if (tLen > 1e-6 && this.visible.torque && satQuat) {
      this.torqueArrow.visible = true;
      const tDir = new THREE.Vector3(cmdTorqueRW.x, cmdTorqueRW.y, cmdTorqueRW.z).normalize().applyQuaternion(satQuat);
      this.torqueArrow.setDirection(tDir);
      const len = Math.min(0.45, 0.1 + (tLen / 0.005) * 0.3);
      this.torqueArrow.setLength(len, 0.06, 0.035);
    } else {
      this.torqueArrow.visible = false;
    }

    // 5. Magnetorquer dipole (Body frame -> World frame via satQuat)
    const mLen = Math.hypot(cmdDipoleMTQ.x, cmdDipoleMTQ.y, cmdDipoleMTQ.z);
    if (mLen > 1e-4 && this.visible.mtq && satQuat) {
      this.mtqArrow.visible = true;
      const mDir = new THREE.Vector3(cmdDipoleMTQ.x, cmdDipoleMTQ.y, cmdDipoleMTQ.z).normalize().applyQuaternion(satQuat);
      this.mtqArrow.setDirection(mDir);
      const len = Math.min(0.42, 0.1 + (mLen / 0.2) * 0.25);
      this.mtqArrow.setLength(len, 0.06, 0.035);
    } else {
      this.mtqArrow.visible = false;
    }
  }

  toggle(name, isVisible) {
    if (name in this.visible) {
      this.visible[name] = isVisible;
    }
  }

  toggleVector(name, isVisible) {
    this.toggle(name, isVisible);
  }
}
