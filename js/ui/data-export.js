/**
 * GomSpace CSP / CAN Bus Packet Telemetry Logger & Exporter
 * Formats telemetry into CSV and structured JSON datasets for mission verification.
 */

export class TelemetryLogger {
  constructor() {
    this.records = [];
    this.isRecording = true;
    this.maxRecords = 5000;
  }

  log(simTime, mode, dynState, orbState, bFieldBody, sunInfo, gsInfo, cmdMTQ, cmdRW) {
    if (!this.isRecording) return;

    const rad2deg = 180 / Math.PI;
    const euler = dynState.q.toEulerDegrees();

    const record = {
      timestamp_sec: Number(simTime.toFixed(2)),
      flight_mode: mode,
      q0: Number(dynState.q.q0.toFixed(4)),
      q1: Number(dynState.q.q1.toFixed(4)),
      q2: Number(dynState.q.q2.toFixed(4)),
      q3: Number(dynState.q.q3.toFixed(4)),
      roll_deg: Number(euler.roll.toFixed(2)),
      pitch_deg: Number(euler.pitch.toFixed(2)),
      yaw_deg: Number(euler.yaw.toFixed(2)),
      omega_mag_deg_s: Number((dynState.omega.length() * rad2deg).toFixed(3)),
      omega_x_deg_s: Number((dynState.omega.x * rad2deg).toFixed(3)),
      omega_y_deg_s: Number((dynState.omega.y * rad2deg).toFixed(3)),
      omega_z_deg_s: Number((dynState.omega.z * rad2deg).toFixed(3)),
      rw_rpm_x: Math.round(dynState.wheelRPM.x),
      rw_rpm_y: Math.round(dynState.wheelRPM.y),
      rw_rpm_z: Math.round(dynState.wheelRPM.z),
      mtq_dipole_x_Am2: Number(cmdMTQ.x.toFixed(4)),
      mtq_dipole_y_Am2: Number(cmdMTQ.y.toFixed(4)),
      mtq_dipole_z_Am2: Number(cmdMTQ.z.toFixed(4)),
      b_field_nT: Number((bFieldBody.length() * 1e9).toFixed(1)),
      sun_eclipse: sunInfo.isEclipse ? 1 : 0,
      gs_contact_los: gsInfo.hasLOS ? 1 : 0,
      gs_elevation_deg: Number(gsInfo.elevationDeg.toFixed(1))
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }
  }

  exportCSV() {
    if (this.records.length === 0) {
      alert("No telemetry records logged yet!");
      return;
    }

    const headers = Object.keys(this.records[0]);
    const csvLines = [headers.join(',')];

    for (const rec of this.records) {
      csvLines.push(headers.map(k => rec[k]).join(','));
    }

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gomspace_cubesat_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportJSON() {
    if (this.records.length === 0) {
      alert("No telemetry records logged yet!");
      return;
    }

    const payload = {
      mission: "CubeSat AOCS Flight Simulation",
      spacecraft: "3U NanoMind / AAU CubeSat Heritage",
      ground_station: "Aalborg (57.05°N, 9.92°E)",
      exported_at: new Date().toISOString(),
      sample_count: this.records.length,
      telemetry: this.records
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gomspace_cubesat_telemetry_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  clear() {
    this.records = [];
  }
}
