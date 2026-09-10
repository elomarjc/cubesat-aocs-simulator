# 🛰️ CubeSat AOCS Flight Simulator
### Interactive 3D LEO Orbit & Spacecraft Attitude Determination and Control System (AOCS)

[![Live WebApp](https://img.shields.io/badge/Live_WebApp-GitHub_Pages-00e5ff?style=for-the-badge&logo=google-chrome&logoColor=white)](https://elomarjc.github.io/cubesat-aocs-simulator/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Physics: RK4](https://img.shields.io/badge/Integrator-RK4_Runge_Kutta-brightgreen?style=for-the-badge)](js/physics/dynamics.js)
[![AAU Heritage](https://img.shields.io/badge/Heritage-AAUSAT_GomSpace_NanoMind-blue?style=for-the-badge)](https://gomspace.com/)

**CubeSat AOCS Flight Simulator** is a high-fidelity, interactive 3D spacecraft Attitude Determination & Control System (AOCS) and Low Earth Orbit (LEO) simulator running in the browser. 

Engineered with aerospace-grade mathematical modeling, it reproduces the flight software behavior of 3U/6U nanosatellites (such as **GomSpace NanoMind** and **Aalborg University AAUSAT6**), featuring quaternion kinematics, 4th-order Runge-Kutta numerical integration, magnetic B-dot detumbling, reaction wheel nadir pointing, Sun tracking, and dynamic ground station target slewing to **Aalborg Ground Station (57.05°N, 9.92°E)**.

---

## 🚀 [Launch Interactive Live Simulator →](https://elomarjc.github.io/cubesat-aocs-simulator/)

```
       +-----------------------------------------------------------+
       |           GOMSPACE AOCS FLIGHT SIMULATOR v2.4             |
       +-----------------------------------------------------------+
          /\                                                  /\
         /  \               [ 3D SPACE VIEWPORT ]            /  \
        /    \             Photorealistic Earth             /    \
       / 3U   \           Rotating Geomagnetic B            / AAL  \
      | CUBESAT|        3-Axis Reaction Wheels (RPM)       | GROUND|
      | MODEL  |         Magnetorquer Dipoles (A*m²)       |STATION|
       \      /         Nadir Payload Line-of-Sight         \ LINK /
        \    /                                               \    /
         \  /               [ MISSION CONTROL ]               \  /
          \/          Live Telemetry • Strip Chart Damping     \/
```

---

## 🌌 Key Capabilities & Aerospace Highlights

### 1. 3D WebGL Visualization & Space Environment
* **Procedural 3U CubeSat Mesh**: High-detail model with anodized aluminum rails, gold Multi-Layer Insulation (MLI), photovoltaic solar cells, deployable solar wings, Earth observation camera lens aperture, and internal rotating reaction wheel flywheels.
* **Geocentric Orbit Visualization**: True-to-scale Earth globe with atmospheric Fresnel rim glow, day/night illumination terminator, sidereal Earth rotation, and inclined orbit tracks (500 km SSO, 420 km ISS, 600 km Polar, 500 km Equatorial).
* **Dynamic 3D Vector Overlays**: Real-time visual vectors for Geomagnetic field $\mathbf{B}$ (Magenta), Sun vector $\mathbf{s}$ (Yellow), Nadir target $-\hat{\mathbf{r}}$ (Cyan), Net Reaction Wheel Torque $\boldsymbol{\tau}_{rw}$ (Blue), and Magnetorquer Dipole Moment $\mathbf{m}$ (Orange).
* **Aalborg Ground Station Link**: 3D beacon at Aalborg ($57.05^\circ\text{N}, 9.92^\circ\text{E}$) with a $5^\circ$ minimum elevation radar cone and dynamic Acquisition of Signal (AOS) communication beam during orbital passes.

### 2. Spacecraft Kinematics & Rigid Body Dynamics
* **Unit Quaternion Kinematics**: Parametrized via $\mathbf{q} = [q_0, q_1, q_2, q_3]^T$ satisfying $\Vert \mathbf{q} \Vert = 1$ to completely eliminate Euler angle gimbal lock.
* **Coupled Euler Rotational Equations**:

$$
\mathbf{I} \dot{\boldsymbol{\omega}} + \boldsymbol{\omega} \times (\mathbf{I}\boldsymbol{\omega} + \mathbf{h}_{rw}) = \boldsymbol{\tau}_{dist} + \boldsymbol{\tau}_{mtq} - \boldsymbol{\tau}_{rw}
$$
* **4th-Order Runge-Kutta (RK4) Solver**: Solves the 10-state differential vector $[\mathbf{q}, \boldsymbol{\omega}, \boldsymbol{\omega}_{rw}]$ with adaptive sub-stepping to guarantee numerical stability across $1\times$ to $30\times$ time warp speeds.
* **Space Environment Disturbances**: Real-time models for Gravity Gradient torque ($\boldsymbol{\tau}_{gg}$), Aerodynamic drag in free molecular flow ($\boldsymbol{\tau}_{aero}$), and Solar Radiation Pressure ($\boldsymbol{\tau}_{srp}$).

### 3. AOCS Flight Control Finite State Machine (FSM)

| Flight Mode | Target Objective | Primary Actuators | Mathematical Formulation |
|---|---|---|---|
| **B-Dot Detumble** | Damp launch tip-off spin rates ($40^\circ/\text{s} \to <0.5^\circ/\text{s}$) | 3-axis Magnetorquers | $\mathbf{m}_{cmd} = -k \frac{d\mathbf{B}_{body}}{dt}$ |
| **Nadir Pointing** | Lock payload camera to Earth center in LVLH frame | 3-axis Reaction Wheels | $\boldsymbol{\tau}_{rw} = K_p \mathbf{q}_{err,v} + K_d \boldsymbol{\omega}_{rel}$ |
| **Sun Tracking** | Maximize solar array charging when outside eclipse | 3-axis Reaction Wheels | $\boldsymbol{\tau}_{rw} = K_p (\hat{\mathbf{n}}_{solar} \times \hat{\mathbf{s}}_{body}) + K_d \boldsymbol{\omega}$ |
| **Aalborg GS Slew** | Dynamically slew antenna boresight to track ground station | 3-axis Reaction Wheels | $\boldsymbol{\tau}_{rw} = K_p (\hat{\mathbf{n}}_{ant} \times \hat{\boldsymbol{\rho}}_{LOS}) + K_d \boldsymbol{\omega}$ |
| **Desaturation** | Dump accumulated reaction wheel momentum without fuel | 3-axis Magnetorquers | $\mathbf{m}_{desat} = -k_{dump} \frac{\mathbf{B}_{body} \times \mathbf{h}_{rw}}{\Vert\mathbf{B}_{body}\Vert^2}$ |

### 4. Telemetry Stream & GomSpace CSP/CAN Export
* **Mission Telemetry Strip**: Live Canvas chart graphing total angular velocity damping $\Vert \boldsymbol{\omega} \Vert$ ($^\circ/\text{s}$) over time.
* **Digital Gauges**: Reaction Wheel RPM meters (clamped to $\pm 6500\text{ RPM}$), Magnetorquer dipole meters (clamped to $\pm 0.2\text{ A}\cdot\text{m}^2$), attitude Euler angles, orbital parameters, and ground station slant range.
* **One-Click Telemetry Export**: Download full mission flight logs in CSV or structured JSON formatted for **GomSpace CSP (CubeSat Space Protocol)** and CAN bus telemetry analysis.

---

## 📐 Mathematical Formulation

### 1. Quaternion Kinematic Equation
The attitude kinematics are propagated using the skew-symmetric quaternion rate matrix:

$$
\dot{\mathbf{q}} = \frac{1}{2} \boldsymbol{\Omega}(\boldsymbol{\omega}) \mathbf{q} = \frac{1}{2} \begin{bmatrix} 0 & -\omega_x & -\omega_y & -\omega_z \\ \omega_x & 0 & \omega_z & -\omega_y \\ \omega_y & -\omega_z & 0 & \omega_x \\ \omega_z & \omega_y & -\omega_x & 0 \end{bmatrix} \begin{bmatrix} q_0 \\ q_1 \\ q_2 \\ q_3 \end{bmatrix}
$$

### 2. Earth Tilted Geomagnetic Dipole
The geomagnetic field in Earth-Centered Inertial (ECI) coordinates is computed via the tilted dipole model:

$$
\mathbf{B}_{ECI}(\mathbf{r}) = \frac{B_0 R_E^3}{r^3} \left[ 3 (\hat{\mathbf{m}}_E \cdot \hat{\mathbf{r}}) \hat{\mathbf{r}} - \hat{\mathbf{m}}_E \right]
$$

where $B_0 = 31.2\text{ }\mu\text{T}$, $R_E = 6371\text{ km}$, and $\hat{\mathbf{m}}_E(t)$ is the dipole unit vector tilted by $11.5^\circ$ rotating at the Earth sidereal rate $\omega_E = 7.292115 \times 10^{-5}\text{ rad/s}$.

### 3. B-Dot Detumbling Law
Magnetorquers generate magnetic dipole moments proportional to the rate of change of the geomagnetic field vector measured in the spacecraft body frame:

$$
\mathbf{m}_{cmd} = -k \frac{d\mathbf{B}_{body}}{dt}
$$

generating a mechanical control torque $\boldsymbol{\tau}_{mtq} = \mathbf{m} \times \mathbf{B}_{body}$ that strictly guarantees negative rate of change for the spacecraft rotational kinetic energy:

$$
\frac{dE_{rot}}{dt} = \boldsymbol{\omega} \cdot \boldsymbol{\tau}_{mtq} = \boldsymbol{\omega} \cdot (\mathbf{m} \times \mathbf{B}) = -k \left\Vert \frac{d\mathbf{B}}{dt} \right\Vert^2 \le 0
$$

## 🛠️ Codebase Architecture

```
cubesat-aocs-simulator/
├── index.html                     # Space mission control console & 3D viewport
├── css/
│   └── aocs.css                   # GomSpace aerospace dark theme
├── js/
│   ├── app.js                     # Main application orchestrator & animation loop
│   ├── physics/
│   │   ├── quaternion.js          # Quaternion kinematics & 3D vector algebra
│   │   ├── orbit.js               # Keplerian LEO propagation & Earth sidereal rotation
│   │   ├── magnetic-field.js      # Tilted geomagnetic dipole model
│   │   ├── disturbances.js        # Gravity gradient, aero, SRP disturbance torques
│   │   └── dynamics.js            # Rigid body dynamics, reaction wheels, RK4 solver
│   ├── aocs/
│   │   ├── bdot.js                # B-dot magnetic detumbling controller
│   │   ├── nadir-pointing.js      # LVLH Earth-observation quaternion feedback PD
│   │   ├── sun-tracking.js        # Solar array Sun vector alignment controller
│   │   ├── ground-station.js      # Aalborg GS tracking & LOS calculation
│   │   └── desaturation.js        # Magnetic momentum dumping algorithm
│   ├── graphics/
│   │   ├── scene.js               # Three.js scene, lighting, starfield, chaser cam
│   │   ├── earth.js               # 3D Earth globe, atmosphere glow, Aalborg pin
│   │   ├── cubesat-model.js       # Procedural 3U mesh (MLI, solar cells, wheels, coils)
│   │   └── vectors.js             # Dynamic 3D vector arrows (B-field, Sun, torque)
│   └── ui/
│       ├── telemetry-hud.js       # Real-time instrumentation dials & strip charts
│       └── data-export.js         # GomSpace CSP/CAN telemetry CSV/JSON logger
├── test/
│   └── test_aocs_physics.mjs      # Headless Node.js unit tests (20/20 passing)
├── LICENSE                        # MIT License
└── README.md                      # Engineering Whitepaper & Documentation
```

---

## 🧪 Local Testing & Verification

The repository includes a headless physics test suite verifying quaternion algebra, orbital propagation, magnetic field decay, RK4 energy conservation, and AOCS convergence.

```bash
# Run test suite
node test/test_aocs_physics.mjs
```

### Test Suite Output:
```
=== 1. Testing Quaternion & Vector3 Library ===
  ✓ Vector3 cross product correct
  ✓ Vector3 dot product correct
  ✓ Identity quaternion norm is 1.0
  ✓ Rotate vector 90 deg around Z produces [0, 1, 0]
  ✓ Euler yaw corresponds to 90 deg (got 89.99999999999999)

=== 2. Testing Orbit Propagator & Ground Station ===
  ✓ Orbital period for 500km LEO is ~94.6 min (~5677s) (got 5668.1s)
  ✓ Initial altitude is 500 km
  ✓ Orbital velocity is ~7.61 km/s
  ✓ Sun unit vector has norm 1.0
  ✓ Aalborg ground station elevation computed

=== 3. Testing Magnetic Field & Disturbances ===
  ✓ Magnetic field magnitude at 500km is within 15-60 uT (got 25.14 uT)
  ✓ Disturbance torques are appropriately micro-Newton-meter scale

=== 4. Testing Spacecraft Rigid Body Dynamics (RK4) ===
  ✓ Tip-off rate set correctly
  ✓ Quaternion remains normalized after RK4 integration
  ✓ Free rotation without external torque conserves spin rate

=== 5. Testing B-Dot Magnetic Detumbling Control ===
  ✓ B-dot damping strictly dissipates kinetic energy: 0.0044 J -> 0.0042 J

=== 6. Testing Nadir Pointing PD Controller ===
  ✓ Initial pointing error detected (90.4 deg)
  ✓ Nadir closed-loop PD reduces pointing error (90.4° -> 66.5°)

=== 7. Testing Sun Tracking & Desaturation Controllers ===
  ✓ Sun tracking computes solar angle and torque
  ✓ Momentum desaturation commands non-zero MTQ dipole to dump momentum

Total Suite: 20 passed, 0 failed
```

---

## 👨‍🎓 Heritage & Author

**Jacob El-Omar**  
*M.Sc. in Electronic Systems, Aalborg University (Denmark)*  
Specialization in Control Engineering, Embedded Systems & Space Systems  
* Project Heritage: AAUSAT6 CubeSat ADCS, System of Systems (Semester 8, AAU)
* Connect: [LinkedIn](https://www.linkedin.com/in/jacob-el-omar/) | [GitHub Profile](https://github.com/elomarjc) | [Email](mailto:elomarjc@gmail.com)
