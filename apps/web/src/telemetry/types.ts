export type TelemetrySnapshot = {
  timestampUtc: string;
  aircraft: string;
  latitude: number;
  longitude: number;
  airspeedKnots: number;
  altitudeFeet: number;
  verticalSpeedFeetPerMinute: number;
  headingDegrees: number;
  pitchDegrees: number;
  bankDegrees: number;
};

export type TelemetryStatus = {
  mode: 'mock' | 'simconnect';
  connected: boolean;
  connectionState: string;
  lastTelemetryUtc: string | null;
  sampleAgeMs: number | null;
  sampleRateHz: number;
  samplesReceived: number;
  connectionAttempts: number;
  lastError: string | null;
  incomingRateHz: number;
  samplesPublished: number;
  framesSkipped: number;
  publicationLagMs: number | null;
};

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';
