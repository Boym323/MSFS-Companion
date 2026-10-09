/** Jediná mapa všech dostupných stránek; každá cesta má jedno místo v nabídce. */
export type NavigationItem = { readonly href: string; readonly label: string };
export type NavigationGroup = {
  readonly label: string;
  readonly href: string;
  readonly items: readonly NavigationItem[];
};

export const navigationGroups: readonly NavigationGroup[] = [
  { label: 'Přehled', href: '/admin', items: [
    { href: '/admin', label: 'Přehled systému' },
    { href: '/pilot', label: 'Letový asistent' },
  ] },
  { label: 'Let', href: '/pfd', items: [
    { href: '/pfd', label: 'PFD' },
    { href: '/progress', label: 'Průběh letu' },
    { href: '/fuel', label: 'Palivo' },
    { href: '/radio-assistant', label: 'Rádio' },
    { href: '/checklists', label: 'Checklisty' },
    { href: '/workspace', label: 'Moje panely' },
  ] },
  { label: 'Mapa', href: '/map', items: [
    { href: '/map', label: 'Mapa letu' },
    { href: '/weather', label: 'Počasí' },
    { href: '/vatsim', label: 'VATSIM' },
  ] },
  { label: 'Navigace', href: '/flight-plan', items: [
    { href: '/flight-plan', label: 'Plán letu' },
    { href: '/briefing', label: 'Letištní briefing' },
  ] },
  { label: 'Letadlo', href: '/aircraft', items: [
    { href: '/aircraft', label: 'Systémy letadla' },
    { href: '/a320', label: 'Airbus A320' },
    { href: '/capabilities', label: 'Profily' },
    { href: '/controls', label: 'Ovládání' },
    { href: '/g1000', label: 'G1000' },
    { href: '/avionics', label: 'Avionika' },
  ] },
  { label: 'Historie', href: '/flights', items: [
    { href: '/flights', label: 'Historie letů' },
  ] },
  { label: 'Nastavení', href: '/health', items: [
    { href: '/health', label: 'Diagnostika' },
    { href: '/validation', label: 'Ověření MSFS' },
  ] },
];

export function normalizeNavigationPath(pathname: string): string {
  return pathname === '/' ? '/admin' : pathname;
}

export function activeNavigationGroup(pathname: string): NavigationGroup {
  const path = normalizeNavigationPath(pathname);
  return navigationGroups.find(group => group.items.some(item => item.href === path))
    ?? navigationGroups[0];
}
