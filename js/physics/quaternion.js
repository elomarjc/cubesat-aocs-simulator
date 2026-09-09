/**
 * Spacecraft Attitude Quaternion & 3D Vector Math Library
 * Unit quaternion convention: q = [q0, q1, q2, q3] where q0 is the scalar part (cos theta/2)
 * and [q1, q2, q3] is the vector part (u * sin theta/2).
 */

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  scale(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    return new Vector3(x, y, z);
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  normalize() {
    const len = this.length();
    if (len > 1e-12) {
      this.scale(1 / len);
    } else {
      this.set(0, 0, 0);
    }
    return this;
  }

  toArray() {
    return [this.x, this.y, this.z];
  }

  static fromArray(arr) {
    return new Vector3(arr[0] || 0, arr[1] || 0, arr[2] || 0);
  }
}

export class Quaternion {
  constructor(q0 = 1, q1 = 0, q2 = 0, q3 = 0) {
    this.q0 = q0; // Scalar part
    this.q1 = q1; // Vector x
    this.q2 = q2; // Vector y
    this.q3 = q3; // Vector z
  }

  set(q0, q1, q2, q3) {
    this.q0 = q0;
    this.q1 = q1;
    this.q2 = q2;
    this.q3 = q3;
    return this;
  }

  clone() {
    return new Quaternion(this.q0, this.q1, this.q2, this.q3);
  }

  copy(q) {
    this.q0 = q.q0;
    this.q1 = q.q1;
    this.q2 = q.q2;
    this.q3 = q.q3;
    return this;
  }

  identity() {
    return this.set(1, 0, 0, 0);
  }

  norm() {
    return Math.hypot(this.q0, this.q1, this.q2, this.q3);
  }

  normalize() {
    const n = this.norm();
    if (n > 1e-12) {
      const inv = 1 / n;
      this.q0 *= inv;
      this.q1 *= inv;
      this.q2 *= inv;
      this.q3 *= inv;
    } else {
      this.identity();
    }
    return this;
  }

  conjugate() {
    return new Quaternion(this.q0, -this.q1, -this.q2, -this.q3);
  }

  multiply(b) {
    // Hamilton product: this * b
    const a0 = this.q0, a1 = this.q1, a2 = this.q2, a3 = this.q3;
    const b0 = b.q0, b1 = b.q1, b2 = b.q2, b3 = b.q3;

    return new Quaternion(
      a0 * b0 - a1 * b1 - a2 * b2 - a3 * b3,
      a0 * b1 + a1 * b0 + a2 * b3 - a3 * b2,
      a0 * b2 - a1 * b3 + a2 * b0 + a3 * b1,
      a0 * b3 + a1 * b2 - a2 * b1 + a3 * b0
    );
  }

  /**
   * Active rotation of a 3D vector v: v' = q * v * q^*
   */
  rotateVector(v) {
    // Using Rodrigues vector formula: v' = v + 2*q_v x (q_v x v + q0*v)
    const qv = new Vector3(this.q1, this.q2, this.q3);
    const t = qv.cross(v).scale(2);
    const term2 = qv.cross(t);
    const term1 = t.scale(this.q0);
    return v.clone().add(term1).add(term2);
  }

  /**
   * Transform vector from Inertial frame to Body frame: v_body = R(q) * v_inertial
   * where q represents orientation of Body with respect to Inertial.
   */
  inertialToBody(vInertial) {
    return this.conjugate().rotateVector(vInertial);
  }

  /**
   * Transform vector from Body frame to Inertial frame: v_inertial = R^T(q) * v_body
   */
  bodyToInertial(vBody) {
    return this.rotateVector(vBody);
  }

  /**
   * 3x3 Direction Cosine Matrix (DCM) transforming Inertial -> Body
   */
  toRotationMatrix() {
    const q0 = this.q0, q1 = this.q1, q2 = this.q2, q3 = this.q3;
    return [
      [
        1 - 2 * (q2 * q2 + q3 * q3),
        2 * (q1 * q2 + q0 * q3),
        2 * (q1 * q3 - q0 * q2)
      ],
      [
        2 * (q1 * q2 - q0 * q3),
        1 - 2 * (q1 * q1 + q3 * q3),
        2 * (q2 * q3 + q0 * q1)
      ],
      [
        2 * (q1 * q3 + q0 * q2),
        2 * (q2 * q3 - q0 * q1),
        1 - 2 * (q1 * q1 + q2 * q2)
      ]
    ];
  }

  /**
   * Euler Angles (Roll, Pitch, Yaw in degrees) in 3-2-1 Aerospace sequence
   */
  toEulerDegrees() {
    const q0 = this.q0, q1 = this.q1, q2 = this.q2, q3 = this.q3;

    // Roll (x-axis)
    const sinr_cosp = 2 * (q0 * q1 + q2 * q3);
    const cosr_cosp = 1 - 2 * (q1 * q1 + q2 * q2);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    // Pitch (y-axis)
    const sinp = 2 * (q0 * q2 - q3 * q1);
    let pitch;
    if (Math.abs(sinp) >= 1) {
      pitch = Math.sign(sinp) * (Math.PI / 2); // 90 deg gimbal lock edge
    } else {
      pitch = Math.asin(sinp);
    }

    // Yaw (z-axis)
    const siny_cosp = 2 * (q0 * q3 + q1 * q2);
    const cosy_cosp = 1 - 2 * (q2 * q2 + q3 * q3);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    const rad2deg = 180 / Math.PI;
    return {
      roll: roll * rad2deg,
      pitch: pitch * rad2deg,
      yaw: yaw * rad2deg
    };
  }

  /**
   * Create quaternion from Axis-Angle representation
   */
  static fromAxisAngle(axis, angleRad) {
    const normAxis = axis.clone().normalize();
    const halfAngle = angleRad * 0.5;
    const sinHalf = Math.sin(halfAngle);
    return new Quaternion(
      Math.cos(halfAngle),
      normAxis.x * sinHalf,
      normAxis.y * sinHalf,
      normAxis.z * sinHalf
    ).normalize();
  }

  /**
   * Create quaternion from two vectors (rotates vFrom -> vTo)
   */
  static fromTwoVectors(vFrom, vTo) {
    const v1 = vFrom.clone().normalize();
    const v2 = vTo.clone().normalize();
    const dot = v1.dot(v2);

    if (dot >= 0.999999) {
      return new Quaternion(1, 0, 0, 0);
    }
    if (dot <= -0.999999) {
      // 180 degree rotation: pick an orthogonal axis
      let axis = new Vector3(1, 0, 0).cross(v1);
      if (axis.length() < 0.1) {
        axis = new Vector3(0, 1, 0).cross(v1);
      }
      axis.normalize();
      return new Quaternion(0, axis.x, axis.y, axis.z);
    }

    const cross = v1.cross(v2);
    const q = new Quaternion(1 + dot, cross.x, cross.y, cross.z);
    return q.normalize();
  }

  toArray() {
    return [this.q0, this.q1, this.q2, this.q3];
  }

  static fromArray(arr) {
    return new Quaternion(arr[0] ?? 1, arr[1] ?? 0, arr[2] ?? 0, arr[3] ?? 0);
  }
}
