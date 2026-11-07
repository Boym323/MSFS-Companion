/** URL of the official remote MCDU, with a same-host LAN fallback. */
export function isLocalHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (/^[a-z0-9][a-z0-9.-]*\.local$/.test(host)) return true;
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const octets = host.split('.').map(Number);
  if (octets.some(octet => octet > 255)) return false;
  return octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168) || octets[0] === 127;
}
export function simbridgeUrls(companionHostname: string, port: number) {
  const safePort = Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : 8380;
  const primary = 'http://simbridge.local:' + safePort + '/interfaces/mcdu';
  const alternate = isLocalHost(companionHostname)
    ? 'http://' + companionHostname.toLowerCase() + ':' + safePort + '/interfaces/mcdu'
    : null;
  return {primary, alternate: alternate === primary ? null : alternate};
}
