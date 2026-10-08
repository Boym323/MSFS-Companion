import { useEffect, useState } from 'react';
import type { ConnectionState, TelemetrySnapshot, TelemetryStatus } from './types';

const isValid = (data: unknown): data is TelemetrySnapshot => {
  if (typeof data !== 'object' || data === null) return false;
  const value = data as Partial<TelemetrySnapshot>;
  return typeof value.timestampUtc === 'string'
    && typeof value.aircraft === 'string'
    && Number.isFinite(Date.parse(value.timestampUtc))
    && ['latitude', 'longitude', 'airspeedKnots', 'altitudeFeet',
      'verticalSpeedFeetPerMinute', 'headingDegrees', 'pitchDegrees', 'bankDegrees']
      .every((key) => Number.isFinite(value[key as keyof TelemetrySnapshot]));
};

// Jedno spojení a jeden pravidelný status dotaz pro všechny stránky.
// Žádná stránka už neotevírá vlastní WebSocket.
export function useTelemetry() {
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [sourceStatus, setSourceStatus] = useState<TelemetryStatus | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    const checkStatus = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) throw new Error('Stav bridge není dostupný');
        const status = (await response.json()) as TelemetryStatus;
        if (!disposed) setSourceStatus(status);
      } catch {
        if (!disposed) setSourceStatus(null);
      } finally {
        inFlight = false;
      }
    };
    void checkStatus();
    const poll = window.setInterval(() => { void checkStatus(); }, 1500);
    const clock = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      disposed = true;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let retry: number | undefined;
    let socket: WebSocket | undefined;
    const connect = () => {
      if (disposed) return;
      setConnection('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socket.onopen = () => { if (!disposed) setConnection('connected'); };
      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (!disposed && isValid(parsed)) setTelemetry(parsed);
        } catch {
          // Poškozený rámec se ignoruje, další vzorek spojení obnoví.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) return;
        setConnection('disconnected');
        setTelemetry(null);
        retry = window.setTimeout(connect, 1500);
      };
    };
    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, []);

  const lastUpdateAgeMs = telemetry
    ? Math.max(0, now - Date.parse(telemetry.timestampUtc))
    : null;
  const sourceIsLive = connection === 'connected'
    && sourceStatus?.connected === true
    && lastUpdateAgeMs !== null
    && lastUpdateAgeMs < 5000;
  return {
    telemetry,
    connection,
    sourceStatus,
    sourceIsLive,
    lastUpdateAgeMs,
    validTelemetry: sourceIsLive ? telemetry : null,
  };
}
