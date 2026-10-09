export type PanelId = 'pfd' | 'map' | 'aircraft' | 'controls' | 'g1000' | 'avionics' | 'a320';
const allowed = new Set<PanelId>(['pfd','map','aircraft','controls','g1000','avionics','a320']);
export type Layout = { columns: 1 | 2; visible: PanelId[] };

export function normalizeWorkspace(input: unknown): Layout {
  if (typeof input !== 'object' || !input) return { columns:1, visible:['pfd','map'] };
  const value = input as Partial<Layout>;
  const columns = value.columns === 2 ? 2 : 1;
  const visible: PanelId[] = [];
  if (Array.isArray(value.visible)) {
    for (const item of value.visible) {
      if (allowed.has(item) && !visible.includes(item)) visible.push(item);
      if (visible.length === 3) break;
    }
  }
  return { columns, visible: visible.length ? visible : ['pfd','map'] };
}
