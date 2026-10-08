import { useEffect, useRef, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import {
  blend, blendAngle, normalizeHeading, pitchUpFromSimConnect,
  bankHorizonRotation,
} from './math';
import {
  PFD_LAYOUT as L, tapeTicks, tapeY, tapeScaleClips,
  compassMarks, compassLabel, vsNeedleY,
} from './layout';

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
        const bank = blendAngle(before.bank, target.bank, elapsed);
        return {
          speed: blend(before.speed, target.speed, elapsed),
          altitude: blend(before.altitude, target.altitude, elapsed),
          vs: blend(before.vs, target.vs, elapsed),
          heading: blendAngle(before.heading, target.heading, elapsed),
          pitch: blend(before.pitch, target.pitch, elapsed),
          bank: bank > 180 ? bank - 360 : bank,
        };
      });
      frameId = window.requestAnimationFrame(render);
    };
    frameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return display;
}

const font = { fontFamily: 'Inter, system-ui, sans-serif' };
const white = '#f0f8ff';
const cyan = '#8ed6ff';
const amber = '#ffd15e';
const ladder = Array.from({ length: 15 }, (_, index) => (index - 7) * 5);
const speedClip = tapeScaleClips(L.speed);
const altitudeClip = tapeScaleClips(L.altitude);
const vsiTicks = [-3000, -2000, -1000, 0, 1000, 2000, 3000];

export default function Pfd({ telemetry }: { telemetry: TelemetrySnapshot | null }) {
  const smoothed = useSmoothFlight(telemetry);
  const flight: FlightNumbers = smoothed ?? {
    speed: 0, altitude: 0, vs: 0, heading: 0, pitch: 0, bank: 0,
  };

  const speedMarks = tapeTicks(flight.speed, 10, 8, 0);
  const altitudeMarks = tapeTicks(flight.altitude, 100, 7);
  const headingMarks = compassMarks(flight.heading);
  const compassNumber = normalizeHeading(Math.round(flight.heading)).toString().padStart(3, '0');
  const vsText = Math.round(flight.vs);
  const bankText = Math.abs(flight.bank) < 0.1
    ? '0°' : (flight.bank > 0 ? 'LEVÝ ' : 'PRAVÝ ') + Math.abs(flight.bank).toFixed(1) + '°';

  return (
    <section className="pfd-panel" aria-label="Primární letový displej">
      <div className="pfd-panel-head">
        <div>
          <span className="eyebrow">B3.1 · PRIMARY FLIGHT DISPLAY</span>
          <h2>Letové přístroje</h2>
        </div>
        <span className={telemetry ? 'pfd-indicator pfd-indicator--live' : 'pfd-indicator'}>
          {telemetry ? 'ŽIVÁ TELEMETRIE' : 'DATA NEDOSTUPNÁ'}
        </span>
      </div>

      <div className="pfd-stage" role="region" aria-label="Letový displej, na menší obrazovce vodorovně posuvný" tabIndex={0}>
        <svg viewBox="0 0 1000 590" role="img" aria-label={telemetry
          ? 'Umělý horizont. Rychlost ' + Math.round(flight.speed)
            + ' uzlů, výška ' + Math.round(flight.altitude)
            + ' stop, klopení ' + flight.pitch.toFixed(1)
            + ' stupně, náklon ' + flight.bank.toFixed(1) + ' stupně.'
          : 'PFD bez platných letových dat.'}>
          <defs>
            <clipPath id="pfd-horizon"><rect {...L.horizon} rx="7" /></clipPath>
            <clipPath id="pfd-speed-scale">
              {speedClip.map((region, i) => <rect key={i} {...region} />)}
            </clipPath>
            <clipPath id="pfd-altitude-scale">
              {altitudeClip.map((region, i) => <rect key={i} {...region} />)}
            </clipPath>
            <clipPath id="pfd-vsi-scale"><rect {...L.vsi} /></clipPath>
            <clipPath id="pfd-compass-scale"><rect {...L.compassTicks} /></clipPath>
            <linearGradient id="pfd-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#123e74" />
              <stop offset="1" stopColor="#397fa9" />
            </linearGradient>
            <linearGradient id="pfd-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a07343" />
              <stop offset="1" stopColor="#53351e" />
            </linearGradient>
          </defs>
          <rect width={L.width} height={L.height} rx="12" fill="#080f1b" />

          {/* Uzavřený horizont a pitch ladder: obsah se nedostane do pásek. */}
          <g clipPath="url(#pfd-horizon)">
            <g transform={'translate(' + L.centerX + ' ' + L.centerY + ') rotate('
              + bankHorizonRotation(flight.bank) + ')'}>
              <g transform={'translate(0 ' + Math.max(-450, Math.min(450, flight.pitch * 5.2)) + ')'}>
                <rect x="-1000" y="-1200" width="2000" height="1200" fill="url(#pfd-sky)" />
                <rect x="-1000" y="0" width="2000" height="1200" fill="url(#pfd-ground)" />
                <line x1="-1000" y1="0" x2="1000" y2="0" stroke={white} strokeWidth="3" />
                {ladder.filter((n) => n !== 0).map((angle) => {
                  const y = -angle * 5.2;
                  const major = angle % 10 === 0;
                  const halfWidth = major ? 51 : 29;
                  return (
                    <g key={angle} stroke={white} strokeWidth="2" fill={white} style={font}>
                      <line x1={-halfWidth} x2={halfWidth} y1={y} y2={y}
                        strokeDasharray={angle < 0 ? '8 6' : undefined} />
                      {major && <>
                        <text x={-halfWidth - 12} y={y + 5} fontSize="15" textAnchor="end" stroke="none">{Math.abs(angle)}</text>
                        <text x={halfWidth + 12} y={y + 5} fontSize="15" stroke="none">{Math.abs(angle)}</text>
                      </>}
                    </g>
                  );
                })}
              </g>
            </g>
          </g>
          <rect {...L.horizon} rx="7" fill="none" stroke="#4b6883" strokeWidth="2" />

          {/* Stupnice náklonu a pevná referenční silueta letadla. */}
          <g stroke="#f1f6ff" strokeWidth="2.4" fill="none">
            {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map((degrees) => {
              const angle = degrees * Math.PI / 180;
              const outer = Math.abs(degrees) % 30 === 0 ? 181 : 175;
              const inner = 164;
              return <line key={degrees}
                x1={L.centerX + Math.sin(angle) * inner}
                y1={L.centerY - Math.cos(angle) * inner}
                x2={L.centerX + Math.sin(angle) * outer}
                y2={L.centerY - Math.cos(angle) * outer} />;
            })}
          </g>
          <g transform={'translate(' + L.centerX + ' ' + L.centerY
            + ') rotate(' + (-flight.bank) + ')'} fill={amber}>
            <path d="M 0 -190 L -9 -170 L 9 -170 Z" />
          </g>
          <g transform={'translate(' + L.centerX + ' ' + L.centerY + ')'}
            stroke={amber} fill="none" strokeWidth="5" strokeLinejoin="round">
            <path d="M -125 0 L -70 0 L -49 12 L -24 12 M 24 12 L 49 12 L 70 0 L 125 0" />
            <line x1="-16" y1="0" x2="16" y2="0" />
            <circle cx="0" cy="0" r="4" fill={amber} stroke="none" />
          </g>

          {/* IAS: jen kladné a jedinečné tick hodnoty, maskované kolem kurzoru. */}
          <rect {...L.speed} rx="5" fill="#102339" stroke="#58748c" strokeWidth="2" />
          <text x="109" y="86" textAnchor="middle" fontSize="17" fill={cyan} style={font}>IAS · KT</text>
          <g clipPath="url(#pfd-speed-scale)" style={font} fill={white}>
            {speedMarks.map((mark) => {
              const y = tapeY(mark, flight.speed, 4.85);
              return (
                <g key={mark}>
                  <line x1="161" x2="199" y1={y} y2={y} stroke="#bfd6e8" strokeWidth="2" />
                  <text x="151" y={y + 6} textAnchor="end" fontSize="20">{mark}</text>
                </g>
              );
            })}
          </g>
          <path d="M 21 233 L 185 233 L 203 255 L 185 277 L 21 277 Z"
            fill="#040b16" stroke="#f1f7ff" strokeWidth="3" />
          <text x="106" y="265" fill={white} fontSize="30" fontWeight="700"
            textAnchor="middle" style={font}>{Math.max(0, flight.speed).toFixed(0)}</text>

          {/* Výškoměr: clippath má uprostřed mezeru přes celou šířku kurzoru. */}
          <rect {...L.altitude} rx="5" fill="#102339" stroke="#58748c" strokeWidth="2" />
          <text x="828" y="86" textAnchor="middle" fontSize="17" fill={cyan} style={font}>ALT · FT</text>
          <g clipPath="url(#pfd-altitude-scale)" style={font} fill={white}>
            {altitudeMarks.map((mark) => {
              const y = tapeY(mark, flight.altitude, 0.48);
              return (
                <g key={mark}>
                  <line x1="762" x2="791" y1={y} y2={y} stroke="#bfd6e8" strokeWidth="2" />
                  <text x="800" y={y + 6} fontSize="17">{Math.round(mark).toLocaleString('cs-CZ')}</text>
                </g>
              );
            })}
          </g>
          <path d="M 757 255 L 773 233 L 899 233 L 899 277 L 773 277 Z"
            fill="#040b16" stroke="#f1f7ff" strokeWidth="3" />
          <text x="833" y="265" fill={white} fontSize="25" fontWeight="700"
            textAnchor="middle" style={font}>
            {Math.round(flight.altitude).toLocaleString('cs-CZ')}
          </text>

          {/* Vlastní VSI: stupnice + ukazatel bez překryvu s výškoměrem. */}
          <rect {...L.vsi} rx="5" fill="#101f31" stroke="#58748c" strokeWidth="2" />
          <text x="946" y="86" textAnchor="middle" fontSize="15" fill={cyan} style={font}>VS · FT/MIN</text>
          <g clipPath="url(#pfd-vsi-scale)" style={font} fill="#d3e5f3">
            <line x1="919" y1="120" x2="919" y2="389" stroke="#44617b" strokeWidth="2" />
            {vsiTicks.map((rate) => {
              const y = vsNeedleY(rate);
              const major = rate % 2000 === 0;
              return <g key={rate}>
                <line x1="919" x2={major ? 937 : 931} y1={y} y2={y}
                  stroke="#c5dceb" strokeWidth={rate === 0 ? 3 : 1.6} />
                <text x="944" y={y + 4} fontSize="12">{rate === 0 ? '0' : (rate > 0 ? '+' : '−') + Math.abs(rate / 1000)}</text>
              </g>;
            })}
            <path d={'M 908 ' + (vsNeedleY(flight.vs) - 8)
              + ' L 935 ' + vsNeedleY(flight.vs)
              + ' L 908 ' + (vsNeedleY(flight.vs) + 8) + ' Z'}
              fill={amber} stroke="#0a1423" strokeWidth="1.4" />
          </g>
          <text x="946" y="448" textAnchor="middle" fontSize="14" fill={white} style={font}>
            {(vsText > 0 ? '+' : '') + vsText} FPM
          </text>

          {/* Kompas: VŠECHNY tick popisky i značky jsou ořezané v pásce. */}
          <rect {...L.compass} rx="6" fill="#102339" stroke="#55758f" strokeWidth="2" />
          <g clipPath="url(#pfd-compass-scale)" stroke="#d9ebfa" fill={white} style={font}>
            {headingMarks.map((mark) => (
              <g key={mark.key}>
                <line x1={mark.x} x2={mark.x} y1="484" y2="498" strokeWidth="2" />
                <text x={mark.x} y="521" textAnchor="middle" fontSize="18" stroke="none">
                  {compassLabel(mark.value)}
                </text>
              </g>
            ))}
          </g>
          <path d={'M ' + (L.centerX - 13) + ' 479 L ' + (L.centerX + 13)
            + ' 479 L ' + L.centerX + ' 498 Z'} fill={amber} />
          <rect x="421" y="537" width="116" height="33" rx="5"
            fill="#030b16" stroke="#f1f7ff" strokeWidth="2.3" />
          <text x={L.centerX} y="561" textAnchor="middle" fontSize="25"
            fontWeight="700" fill={white} style={font}>{compassNumber}°</text>
        </svg>
        {!telemetry && (
          <div className="pfd-cover" role="status">
            <strong>ŽÁDNÁ ŽIVÁ TELEMETRIE</strong>
            <span>Spusťte MSFS 2020 a vyčkejte na spojení SimConnect.</span>
          </div>
        )}
      </div>
      <div className="pfd-readouts" aria-label="Doplňující hodnoty letových přístrojů">
        <span><small>MAGNETICKÝ KURZ</small><strong>{telemetry ? compassNumber + '°' : '—'}</strong></span>
        <span><small>KLOPENÍ</small><strong>{telemetry ? flight.pitch.toFixed(1) + '°' : '—'}</strong></span>
        <span><small>NÁKLON</small><strong>{telemetry ? bankText : '—'}</strong></span>
        <span><small>VERTIKÁLNÍ RYCHLOST</small>
          <strong>{telemetry ? (vsText > 0 ? '+' : '') + vsText + ' FT/MIN' : '—'}</strong></span>
      </div>
      <p className="pfd-scroll-hint">Na užší obrazovce lze přístroje vodorovně posunout.</p>
      <p className="pfd-note">
        Vývojová pomůcka pro simulátor, nikoli certifikovaný letový přístroj.
        Vyhlazování ovlivňuje pouze vykreslení, nikoli data MSFS.
      </p>
    </section>
  );
}
