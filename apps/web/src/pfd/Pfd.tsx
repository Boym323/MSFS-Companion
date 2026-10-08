import { useEffect, useRef, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import {
  blend, blendAngle, normalizeHeading, pitchUpFromSimConnect,
  bankHorizonRotation,
} from './math';

type FlightNumbers = {
  speed: number;
  altitude: number;
  vs: number;
  heading: number;
  pitch: number;
  bank: number;
};

const convert = (flight: TelemetrySnapshot): FlightNumbers => ({
  speed: flight.airspeedKnots,
  altitude: flight.altitudeFeet,
  vs: flight.verticalSpeedFeetPerMinute,
  heading: normalizeHeading(flight.headingDegrees),
  pitch: pitchUpFromSimConnect(flight.pitchDegrees),
  bank: flight.bankDegrees,
});

function useSmoothFlight(telemetry: TelemetrySnapshot | null) {
  const latest = useRef<FlightNumbers | null>(telemetry ? convert(telemetry) : null);
  const [display, setDisplay] = useState<FlightNumbers | null>(latest.current);

  useEffect(() => {
    latest.current = telemetry ? convert(telemetry) : null;
    if (!telemetry) setDisplay(null);
  }, [telemetry]);

  useEffect(() => {
    let frameId = 0;
    let lastTime: number | null = null;
    const render = (time: number) => {
      const elapsed = lastTime === null ? 16 : Math.max(0, Math.min(100, time - lastTime));
      lastTime = time;
      const target = latest.current;
      setDisplay((before) => {
        if (!target) return null;
        if (!before) return target;
        return {
          speed: blend(before.speed, target.speed, elapsed),
          altitude: blend(before.altitude, target.altitude, elapsed),
          vs: blend(before.vs, target.vs, elapsed),
          heading: blendAngle(before.heading, target.heading, elapsed),
          pitch: blend(before.pitch, target.pitch, elapsed),
          bank: blendAngle(before.bank, target.bank, elapsed) > 180
            ? blendAngle(before.bank, target.bank, elapsed) - 360
            : blendAngle(before.bank, target.bank, elapsed),
        };
      });
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return display;
}

const font = { fontFamily: 'Inter, system-ui, sans-serif' };
const white = '#f0f8ff';
const ticks = Array.from({ length: 15 }, (_, index) => index - 7);
const ladder = Array.from({ length: 13 }, (_, index) => (index - 6) * 5);

export default function Pfd({ telemetry }: { telemetry: TelemetrySnapshot | null }) {
  const smoothed = useSmoothFlight(telemetry);
  const flight: FlightNumbers = smoothed ?? {
    speed: 0, altitude: 0, vs: 0, heading: 0, pitch: 0, bank: 0,
  };
  const speedMarks = ticks.map((n) => Math.max(0, Math.round(flight.speed / 10) * 10 + n * 10));
  const altMarks = ticks.map((n) => Math.round(flight.altitude / 100) * 100 + n * 100);
  const headingMarks = ticks.map((n) => normalizeHeading(Math.round(flight.heading / 10) * 10 + n * 10));

  return (
    <section className="pfd-panel" aria-label="Primární letový displej">
      <div className="pfd-panel-head">
        <div>
          <span className="eyebrow">B3 · PRIMARY FLIGHT DISPLAY</span>
          <h2>Letové přístroje</h2>
        </div>
        <span className={telemetry ? 'pfd-indicator pfd-indicator--live' : 'pfd-indicator'}>
          {telemetry ? 'ŽIVÁ TELEMETRIE' : 'DATA NEDOSTUPNÁ'}
        </span>
      </div>

      <div className="pfd-stage">
        <svg viewBox="0 0 900 560" role="img"
          aria-label={telemetry
            ? `Umělý horizont: rychlost ${Math.round(flight.speed)} uzlů, výška ${Math.round(flight.altitude)} stop, klopení ${flight.pitch.toFixed(1)} stupně, náklon ${flight.bank.toFixed(1)} stupně.`
            : 'PFD bez platných dat. Čekám na telemetrii.'}>
          <defs>
            <clipPath id="pfd-horizon"><rect x="205" y="23" width="490" height="402" rx="6" /></clipPath>
            <clipPath id="pfd-ias"><rect x="32" y="70" width="166" height="310" /></clipPath>
            <clipPath id="pfd-alt"><rect x="704" y="70" width="162" height="310" /></clipPath>
            <linearGradient id="pfd-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#153c79" />
              <stop offset="1" stopColor="#397bab" />
            </linearGradient>
            <linearGradient id="pfd-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a26f40" />
              <stop offset="1" stopColor="#55351e" />
            </linearGradient>
          </defs>
          <rect width="900" height="560" rx="12" fill="#090f1b" />
          <g clipPath="url(#pfd-horizon)">
            {/* Horizont zůstává v globálním souřadném systému a otáčí se proti letadlu. */}
            <g transform={`translate(450 224) rotate(${bankHorizonRotation(flight.bank)})`}>
              <g transform={`translate(0 ${Math.max(-450, Math.min(450, flight.pitch * 5.5))})`}>
                <rect x="-1000" y="-1200" width="2000" height="1200" fill="url(#pfd-sky)" />
                <rect x="-1000" y="0" width="2000" height="1200" fill="url(#pfd-ground)" />
                <line x1="-1000" y1="0" x2="1000" y2="0" stroke={white} strokeWidth="3" />
                {ladder.filter((n) => n !== 0).map((angle) => {
                  const positive = angle > 0;
                  const y = -angle * 5.5;
                  const major = angle % 10 === 0;
                  const width = major ? 58 : 32;
                  return (
                    <g key={angle} stroke={white} strokeWidth="2" fill={white} style={font}>
                      <line x1={-width} x2={width} y1={y} y2={y}
                        strokeDasharray={positive ? undefined : '9 6'} />
                      {major && <>
                        <text x={-width - 16} y={y + 5} fontSize="14" textAnchor="end" stroke="none">{Math.abs(angle)}</text>
                        <text x={width + 16} y={y + 5} fontSize="14" stroke="none">{Math.abs(angle)}</text>
                      </>}
                    </g>
                  );
                })}
              </g>
            </g>
          </g>

          <rect x="205" y="23" width="490" height="402" rx="6" fill="none" stroke="#405a76" strokeWidth="2" />
          {/* Pevný symbol letadla – nezávislý na rotujícím horizontu. */}
          <g transform="translate(450 224)" stroke="#f9d052" fill="none" strokeWidth="5" strokeLinejoin="round">
            <path d="M -137 -2 L -76 -2 L -57 13 L -22 13 M 22 13 L 57 13 L 76 -2 L 137 -2" />
            <line x1="-15" y1="0" x2="15" y2="0" />
            <circle cx="0" cy="0" r="4" fill="#f9d052" stroke="none" />
          </g>
          {/* Bank stupnice s indexem pro náklon. */}
          <g stroke="#f0f8ff" strokeWidth="2" fill="none">
            {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = 450 + Math.sin(rad) * 183;
              const y1 = 224 - Math.cos(rad) * 183;
              const r2 = Math.abs(deg) % 30 === 0 ? 198 : 192;
              return <line key={deg} x1={x1} y1={y1}
                x2={450 + Math.sin(rad) * r2} y2={224 - Math.cos(rad) * r2} />;
            })}
          </g>
          <g transform={`translate(450 224) rotate(${-flight.bank})`} fill="#f9d052">
            <path d="M 0 -203 L -9 -184 L 9 -184 Z" />
          </g>

          {/* Indikovaná rychlost – levá páska. */}
          <rect x="30" y="70" width="170" height="310" fill="#0e2033" stroke="#55718a" />
          <g clipPath="url(#pfd-ias)" fill={white} style={font}>
            {speedMarks.filter((v) => v >= 0).map((v, i) => {
              const y = 225 - (v - flight.speed) * 3.8;
              return <g key={`${v}-${i}`}><line x1="158" x2="198" y1={y} y2={y} stroke="#c8d9ee" strokeWidth="2" />
                <text x="147" y={y + 6} textAnchor="end" fontSize="21">{v}</text></g>;
            })}
          </g>
          <path d="M 26 202 L 177 202 L 199 225 L 177 248 L 26 248 Z"
            fill="#040b13" stroke="#f1f6ff" strokeWidth="3" />
          <text x="104" y="233" fill={white} fontSize="28" fontWeight="700" textAnchor="middle"
            style={font}>{flight.speed.toFixed(0)}</text>
          <text x="100" y="57" fill="#8dd0fd" fontSize="16" textAnchor="middle" style={font}>IAS · KT</text>

          {/* Indikovaná výška – pravá páska. */}
          <rect x="703" y="70" width="165" height="310" fill="#0e2033" stroke="#55718a" />
          <g clipPath="url(#pfd-alt)" fill={white} style={font}>
            {altMarks.map((v, i) => {
              const y = 225 - (v - flight.altitude) * 0.55;
              return <g key={`${v}-${i}`}><line x1="704" x2="741" y1={y} y2={y} stroke="#c8d9ee" strokeWidth="2" />
                <text x="751" y={y + 6} fontSize="20">{v.toLocaleString('cs-CZ')}</text></g>;
            })}
          </g>
          <path d="M 725 202 L 868 202 L 868 248 L 725 248 L 704 225 Z"
            fill="#040b13" stroke="#f1f6ff" strokeWidth="3" />
          <text x="802" y="233" fill={white} fontSize="27" fontWeight="700" textAnchor="middle"
            style={font}>{Math.round(flight.altitude).toLocaleString('cs-CZ')}</text>
          <text x="786" y="57" fill="#8dd0fd" fontSize="16" textAnchor="middle" style={font}>ALT · FT</text>
          <text x="786" y="403" fill="#9ab7cf" fontSize="14" textAnchor="middle" style={font}>
            VS {flight.vs >= 0 ? '+' : ''}{Math.round(flight.vs)} FT/MIN
          </text>

          {/* Kompasová páska: heading modulo 360 a správný průchod severem. */}
          <rect x="204" y="440" width="492" height="95" fill="#0e2033" stroke="#55718a" />
          <g stroke="#d7e8fa" fill={white} style={font}>
            {headingMarks.map((heading, index) => {
              const relative = (index - 7) * 10 + (Math.round(flight.heading / 10) * 10 - flight.heading);
              const x = 450 + relative * 5;
              return <g key={index}>
                <line x1={x} x2={x} y1="440" y2="459" strokeWidth="2" />
                <text x={x} y="484" textAnchor="middle" fontSize="17" stroke="none">
                  {heading === 0 ? 'N' : heading === 90 ? 'E' : heading === 180 ? 'S' : heading === 270 ? 'W' : heading.toFixed(0)}
                </text>
              </g>;
            })}
          </g>
          <path d="M 436 441 L 464 441 L 450 457 Z" fill="#f9d052" />
          <rect x="392" y="491" width="116" height="36" rx="5" fill="#040b13" stroke="#f1f6ff" strokeWidth="2" />
          <text x="450" y="517" fill={white} fontSize="24" fontWeight="700" textAnchor="middle"
            style={font}>{normalizeHeading(Math.round(flight.heading)).toString().padStart(3, '0')}°</text>
          <text x="112" y="488" fill="#8dd0fd" fontSize="15" textAnchor="middle" style={font}>MAGNETICKÝ KURZ</text>
          <text x="793" y="488" fill="#8dd0fd" fontSize="15" textAnchor="middle" style={font}>VÝŠKA · RYCHLOST</text>
          <text x="793" y="516" fill="#cbdced" fontSize="16" textAnchor="middle" style={font}>
            {flight.altitude.toFixed(0)} FT
          </text>
        </svg>
        {!telemetry && (
          <div className="pfd-cover" role="status">
            <strong>ŽÁDNÁ ŽIVÁ TELEMETRIE</strong>
            <span>Spusťte MSFS 2020 a vyčkejte na spojení SimConnect.</span>
          </div>
        )}
      </div>
      <p className="pfd-note">
        PFD je vývojová pomůcka pro simulátor, nikoli certifikovaný letový přístroj.
        Vyhlazování ovlivňuje pouze obraz, nikoli skutečná data MSFS.
      </p>
    </section>
  );
}
