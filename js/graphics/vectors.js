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

    // Create 3D ArrowHelpers
    const origin = new THREE.Vector3(0, 0, 0);

    // 1. Magnetic field B (Magenta)
    this.bArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, 0.22, 0xff00ff, 0.05, 0.03);
    this.scene.add(this.bArrow);

    // 2. Sun vector (Yellow/Gold)
    this.sunArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, 0.26, 0xffd600, 0.06, 0.04);
    this.scene.add(this.sunArrow);

    // 3. Nadir vector (Cyan)
    this.nadirArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, 0.24, 0x00e5ff, 0.05, 0.03);
    this.scene.add(this.nadirArrow);

    // 4. Net Wheel Torque (Neon Blue)
    this.torqueArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, 0.18, 0x2979ff, 0.04, 0.025);
    this.scene.add(this.torqueArrow);

    // 5. Magnetorquer dipole (Orange)
    this.mtqArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, 0.18, 0xff6d00, 0.04, 0.025);
    this.scene.add(this.mtqArrow);
  }

  update(sat3DPos, bVecECI, sunVecECI, nadirVecECI, cmdTorqueRW, cmdDipoleMTQ) {
    // Set origins to satellite position
    this.bArrow.position.copy(sat3DPos);
    this.sunArrow.position.copy(sat3DPos);
    this.nadirArrow.position.copy(sat3DPos);
    this.torqueArrow.position.copy(sat3DPos);
    this.mtqArrow.position.copy(sat3DPos);

    // 1. B field
    const bLen = Math.hypot(bVecECI.x, bVecECI.y, bVecECI.z);
    if (bLen > 1e-10 && this.visible.bField) {
      this.bArrow.visible = true;
      this.bArrow.setDirection(new THREE.Vector3(bVecECI.x / bLen, bVecECI.y / bLen, bVecECI.z / bLen));
      this.bArrow.setLength(0.24, 0.05, 0.03);
    } else {
      this.bArrow.visible = false;
    }

    // 2. Sun vector
    const sLen = Math.hypot(sunVecECI.x, sunVecECI.y, sunVecECI.z);
    if (sLen > 1e-10 && this.visible.sun) {
      this.sunArrow.visible = true;
      this.sunArrow.setDirection(new THREE.Vector3(sunVecECI.x / sLen, sunVecECI.y / sLen, sunVecECI.z / sLen));
      this.sunArrow.setLength(0.26, 0.06, 0.04);
    } else {
      this.sunArrow.visible = false;
    }

    // 3. Nadir vector
    const nLen = Math.hypot(nadirVecECI.x, nadirVecECI.y, nadirVecECI.z);
    if (nLen > 1e-10 && this.visible.nadir) {
      this.nadirArrow.visible = true;
      this.nadirArrow.setDirection(new THREE.Vector3(nadirVecECI.x / nLen, nadirVecECI.y / nLen, nadirVecECI.z / nLen));
      this.nadirArrow.setLength(0.24, 0.05, 0.03);
    } else {
      this.nadirArrow.visible = false;
    }

    // 4. Reaction wheel torque
    const tLen = Math.hypot(cmdTorqueRW.x, cmdTorqueRW.y, cmdTorqueRW.z);
    if (tLen > 1e-6 && this.visible.torque) {
      this.torqueArrow.visible = true;
      this.torqueArrow.setDirection(new THREE.Vector3(cmdTorqueRW.x / tLen, cmdTorqueRW.y / tLen, cmdTorqueRW.z / tLen));
      const len = Math.min(0.3, 0.05 + (tLen / 0.005) * 0.2);
      this.torqueArrow.setLength(len, 0.04, 0.025);
    } else {
      this.torqueArrow.visible = false;
    }

    // 5. Magnetorquer dipole
    const mLen = Math.hypot(cmdDipoleMTQ.x, cmdDipoleMTQ.y, cmdDipoleMTQ.z);
    if (mLen > 1e-4 && this.visible.mtq) {
      this.mtqArrow.visible = true;
      this.mtqArrow.setDirection(new THREE.Vector3(cmdDipoleMTQ.x / mLen, cmdDipoleMTQ.y / mLen, cmdDipoleMTQ.z / mLen));
      const len = Math.min(0.28, 0.05 + (mLen / 0.2) * 0.18);
      this.mtqArrow.setLength(len, 0.04, 0.025);
    } else {
      this.mtqArrow.visible = false;
    }
  }

  toggle(vectorName, isVisible) {
    if (vectorName in this.visible) {
      this.visible[vectorName] = isVisible;
    }
  }
}
