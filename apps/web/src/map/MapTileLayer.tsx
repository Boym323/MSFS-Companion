import type { WorldPoint } from './geo.ts';
import { TILE_SIZE, visibleTiles } from './geo.ts';
import './MapTileLayer.css';

export default function MapTileLayer({
  center, zoom, width, height, enabled,
}: {
  center: WorldPoint | null; zoom: number; width: number; height: number; enabled: boolean;
}) {
  if (!enabled || !center) return null;
  const tiles = visibleTiles(center, zoom, width, height);
  return (
    <>
      {tiles.map((tile) => (
        <img key={tile.key} className="map-tile" src={tile.url}
          alt="" width={TILE_SIZE} height={TILE_SIZE} loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ left: tile.left, top: tile.top }}
          onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
      ))}
      <div className="map-attribution">
        © <a href="https://www.openstreetmap.org/copyright"
          target="_blank" rel="noopener noreferrer">OpenStreetMap</a> přispěvatelé
      </div>
    </>
  );
}
