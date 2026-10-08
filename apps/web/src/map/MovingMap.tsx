import { useEffect, useRef, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import {
  metersBetween, project, shortestWorldDistance,
} from './geo';
import MapTileLayer from './MapTileLayer';
import { useMapBackground } from './useMapBackground';
import './MovingMap.css';

type TrackPoint = {
  latitude: number;
  longitude: number;
  receivedAt: number;
  aircraft: string;
};

const MAX_POINTS = 3600; // ~1h při 1 bodu/s; žádná neomezená paměť

export default function MovingMap({ telemetry }: { telemetry: TelemetrySnapshot | null }) {
  const [zoom, setZoom] = useState(11);
  const [tilesEnabled, setTilesEnabled] = useMapBackground();
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [size, setSize] = useState({ width: 920, height: 500 });
  const viewport = useRef<HTMLDivElement>(null);
  const lastPoint = useRef<TrackPoint | null>(null);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: Math.max(320, Math.round(rect.width)), height: Math.max(260, Math.round(rect.height)) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!telemetry) return;
    const timestamp = Date.parse(telemetry.timestampUtc);
    if (!Number.isFinite(timestamp) || Math.abs(telemetry.latitude) > 85.05
      || Math.abs(telemetry.longitude) > 180) return;
    const point = {
      latitude: telemetry.latitude,
      longitude: telemetry.longitude,
      receivedAt: timestamp,
      aircraft: telemetry.aircraft,
    };
    const last = lastPoint.current;
    if (last && timestamp <= last.receivedAt) return;
    // Neukládat všech 20 Hz: trasa nepotřebuje jemnější stopu než 1 Hz.
    if (last && last.aircraft === point.aircraft
      && timestamp - last.receivedAt < 1000) return;
    if (last && last.aircraft !== point.aircraft) {
      setTrack([point]);
    } else if (last && metersBetween(last, point) > 100000) {
      // Skok přes polovinu země po přesunu letadla nespojuj čarou.
      setTrack([point]);
    } else {
      setTrack((before) => [...before.slice(-(MAX_POINTS - 1)), point]);
    }
    lastPoint.current = point;
  }, [telemetry]);

  const center = telemetry ?? track[track.length - 1];
  const validCenter = center && Math.abs(center.latitude) <= 85.05
    && Math.abs(center.longitude) <= 180;
  const world = validCenter ? project(center, zoom) : null;
  const { width, height } = size;
  const trackPath = world && track.length >= 2
    ? track.map((point, index) => {
        const p = project(point, zoom);
        const x = shortestWorldDistance(p.x, world.x, zoom) + width / 2;
        const y = p.y - world.y + height / 2;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ')
    : '';
  const distance = track.reduce((total, point, index) => {
    if (index === 0) return total;
    return total + metersBetween(track[index - 1], point);
  }, 0);

  return (
    <section className="moving-map" aria-label="Pohyblivá mapa letu">
      <div className="moving-map-header">
        <div>
          <span className="eyebrow">B4 · MOVING MAP</span>
          <h2>Poloha a proletěná trasa</h2>
          <p>Letadlo je uprostřed, mapa zůstává orientovaná na sever.</p>
        </div>
        <div className="moving-map-controls">
          <button type="button" onClick={() => setZoom((z) => Math.max(6, z - 1))}
            aria-label="Oddálit mapu">−</button>
          <strong>ZOOM {zoom}</strong>
          <button type="button" onClick={() => setZoom((z) => Math.min(15, z + 1))}
            aria-label="Přiblížit mapu">+</button>
          <button type="button" className="moving-map-clear" onClick={() => {
            setTrack([]);
            lastPoint.current = null;
          }}>Smazat stopu</button>
        </div>
      </div>

      <label className="moving-map-background">
        <input type="checkbox" checked={tilesEnabled}
          onChange={(event) => setTilesEnabled(event.target.checked)} />
        Podklad OpenStreetMap (automaticky zapnutý, lze vypnout)
      </label>

      <div ref={viewport} className="moving-map-canvas" aria-label="Mapa centrovaná na aktuální GPS polohu">
        <MapTileLayer center={world} zoom={zoom} width={width} height={height} enabled={tilesEnabled} />
        <svg className="moving-map-track" viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none" aria-hidden="true">
          <path d={trackPath} stroke="#79e6f8" fill="none"
            strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {world && track.length > 0 && (() => {
            const first = project(track[0], zoom);
            const x = shortestWorldDistance(first.x, world.x, zoom) + width / 2;
            const y = first.y - world.y + height / 2;
            return <circle cx={x} cy={y} r="5" fill="#9cf5c1" stroke="#092033" strokeWidth="2" />;
          })()}
        </svg>
        {telemetry && validCenter && (
          <div className="moving-map-plane" style={{ transform: `translate(-50%, -50%) rotate(${telemetry.headingDegrees}deg)` }}>
            <svg width="54" height="58" viewBox="0 0 54 58" aria-hidden="true">
              <path d="M 27 2 L 32 22 L 50 34 L 50 40 L 31 35 L 31 49 L 39 54 L 39 57 L 27 53 L 15 57 L 15 54 L 23 49 L 23 35 L 4 40 L 4 34 L 22 22 Z"
                fill="#f8d478" stroke="#101c2b" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <div className="moving-map-compass" aria-hidden="true">N ↑</div>
        {!telemetry && (
          <div className="moving-map-offline" role="status">
            <strong>Čekám na aktuální polohu letadla</strong>
            <span>Proletěná trasa zůstane zachována po dobu otevření této stránky.</span>
          </div>
        )}

      </div>
      <div className="moving-map-stats">
        <span><strong>GPS:</strong> {telemetry
          ? `${telemetry.latitude.toFixed(5)}°, ${telemetry.longitude.toFixed(5)}°`
          : 'čekám'}</span>
        <span><strong>Směr:</strong> {telemetry ? `${telemetry.headingDegrees.toFixed(0)}°` : '—'}</span>
        <span><strong>Délka stopy:</strong> {(distance / 1000).toFixed(1)} km</span>
        <span><strong>Uložené body:</strong> {track.length} / {MAX_POINTS}</span>
      </div>
      <p className="moving-map-note">
        Podklad OpenStreetMap se načítá automaticky, pokud je dostupný internet.
        Bez internetu zůstane viditelná souřadnicová mřížka a stopa letu. Mapový server
        může odvodit přibližnou zobrazenou oblast z požadovaných dlaždic.
        Podklad lze vypnout; volba platí i pro historii letů.
      </p>
    </section>
  );
}
