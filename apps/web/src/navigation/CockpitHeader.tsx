import type { ConnectionState, TelemetryStatus } from '../telemetry/types';
import { activeNavigationGroup, navigationGroups, normalizeNavigationPath } from './navigation';

type HeaderProps = {
  pathname: string;
  connection: ConnectionState;
  sourceStatus: TelemetryStatus | null;
  sourceIsLive: boolean;
  aircraft: string | null;
};

export default function CockpitHeader({
  pathname, connection, sourceStatus, sourceIsLive, aircraft,
}: HeaderProps) {
  const group = activeNavigationGroup(pathname);
  const path = normalizeNavigationPath(pathname);
  const simulatorLive = sourceIsLive && sourceStatus?.mode === 'simconnect';
  const simulatorMock = sourceIsLive && sourceStatus?.mode === 'mock';
  const simulatorText = simulatorMock ? 'Ukázková data'
    : simulatorLive ? 'MSFS připojen'
    : 'MSFS offline';

  return <>
    <header className="topbar cockpit-topbar">
      <div className="brand">
        <span className="brand-icon" aria-hidden="true">✈</span>
        <div className="brand-copy">
          <strong>Kokpit</strong>
          <small title={simulatorLive ? aircraft ?? undefined : undefined}>
            {simulatorLive && aircraft ? `MSFS 2020 · ${aircraft}` : 'Flight deck · MSFS 2020'}
          </small>
        </div>
      </div>
      <div className="cockpit-statuses" aria-label="Stav spojení">
        <div className={`connection connection--${connection}`} title="Spojení prohlížeče s bridge">
          <span className="connection-dot" aria-hidden="true" />
          {connection === 'connected' ? 'Bridge připojen' : connection === 'connecting' ? 'Bridge se připojuje' : 'Bridge odpojen'}
        </div>
        <div className={`simulator-connection ${simulatorLive ? 'simulator-connection--live' : simulatorMock ? 'simulator-connection--mock' : 'simulator-connection--offline'}`}>
          <span className="connection-dot" aria-hidden="true" />
          {simulatorText}
        </div>
      </div>
    </header>
    <div className="cockpit-navigation">
      <nav className="cockpit-primary-nav" aria-label="Hlavní navigace">
        {navigationGroups.map(item => (
          <a key={item.href} href={item.href}
             className={item === group ? 'selected' : undefined}
             aria-current={item === group ? 'location' : undefined}>
            {item.label}
          </a>
        ))}
      </nav>
      <nav className="cockpit-secondary-nav" aria-label={`Nástroje v sekci ${group.label}`}>
        {group.items.map(item => (
          <a key={item.href} href={item.href}
             className={path === item.href ? 'selected' : undefined}
             aria-current={path === item.href ? 'page' : undefined}>
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  </>;
}
