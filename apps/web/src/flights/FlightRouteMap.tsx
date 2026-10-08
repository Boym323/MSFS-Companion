import { useEffect, useMemo, useRef, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import { metersBetween } from '../map/geo.ts';
import MapTileLayer from '../map/MapTileLayer';
import { fitRoute, pointOnRouteMap } from '../map/routeMap.ts';
import { useMapBackground } from '../map/useMapBackground';
import './FlightRouteMap.css';

export default function FlightRouteMap({
  samples, selectedIndex,
}: {
  samples: TelemetrySnapshot[];
  selectedIndex: number;
}) {
  const [enabled, setEnabled] = useMapBackground();
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 620, height: 340 });

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => setSize({
      width: Math.max(280, Math.round(node.getBoundingClientRect().width)),
      height: Math.max(260, Math.round(node.getBoundingClientRect().height)),
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const { width, height } = size;
  const view = useMemo(() => fitRoute(samples, width, height), [samples, width, height]);
  const { path, positions } = useMemo(() => {
    const positions = samples.map(point => view ? pointOnRouteMap(point, view, width, height) : null);
    const path = positions.map((position, i) => {
      if (!position) return '';
      const previous = i > 0 ? positions[i - 1] : null;
      // Teleport nebo skok při změně letu nespojujeme dlouhou úhlopříčkou.
      const continuous = previous !== null && i > 0
        && metersBetween(samples[i - 1], samples[i]) <= 100_000;
      return `${continuous ? 'L' : 'M'} ${position.x.toFixed(1)} ${position.y.toFixed(1)}`;
    }).join(' ');
    return { path, positions };
  }, [samples, view, width, height]);

  const marker = positions[Math.min(selectedIndex, positions.length - 1)];
  const start = positions.find(Boolean);
  const end = [...positions].reverse().find(Boolean);

  return (
    <div className="flight-route-map-section">
      <label className="flight-route-map-toggle">
        <input type="checkbox" checked={enabled}
          onChange={event => setEnabled(event.target.checked)} />
        Podklad OpenStreetMap (automaticky zapnutý)
      </label>
      <div ref={viewport} className="flight-route-map" role="img"
        aria-label="Proletěná trasa nad podkladovou mapou, sever nahoře, aktuální pozice přehrávání">
        <MapTileLayer center={view?.center ?? null} zoom={view?.zoom ?? 2}
          width={width} height={height} enabled={enabled} />
        <svg className="flight-route-overlay" viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none" aria-hidden="true">
          <path d={path} fill="none" stroke="#0c2d46" strokeWidth="6"
            strokeLinejoin="round" strokeLinecap="round" />
          <path d={path} fill="none" stroke="#52e3f3" strokeWidth="3"
            strokeLinejoin="round" strokeLinecap="round" />
          {start && <circle cx={start.x} cy={start.y} r="5" fill="#99f2ba" stroke="#113141" strokeWidth="2" />}
          {end && <circle cx={end.x} cy={end.y} r="5" fill="#ffffff" stroke="#113141" strokeWidth="2" />}
          {marker && <circle cx={marker.x} cy={marker.y} r="8" fill="#f6d982" stroke="#0c2d46" strokeWidth="3" />}
        </svg>
        <span className="flight-route-north" aria-hidden="true">N ↑</span>
        {!view && <div className="flight-route-empty">V záznamu není platná GPS poloha.</div>}
      </div>
      <div className="flight-route-legend">
        <span><i className="flight-route-legend-start" /> Začátek</span>
        <span><i className="flight-route-legend-end" /> Konec</span>
        <span><i className="flight-route-legend-position" /> Aktuální bod přehrávání</span>
      </div>
      <p className="flight-route-privacy">
        Podklad se načítá přímo z OpenStreetMap. Poskytovatel uvidí přibližnou
        oblast zobrazených mapových dlaždic, nikoli kompletní záznam GPS.
        Bez internetu zůstane viditelná trasa na mřížce.
      </p>
    </div>
  );
}
