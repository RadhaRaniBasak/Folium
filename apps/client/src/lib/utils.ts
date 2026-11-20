export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = isMac ? '⌘' : 'Ctrl';
export const ALT = isMac ? '⌥' : 'Alt';
export const SHIFT = isMac ? '⇧' : 'Shift';

/** Snappy spring used across menus, dialogs and lists. */
export const spring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } as const;
/** Bouncier spring for small playful details (icons, stars). */
export const bouncy = { type: 'spring', stiffness: 400, damping: 14 } as const;

export function pageTitle(page: { title: string } | undefined | null): string {
  return page?.title.trim() || 'Untitled';
}

export function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 45) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.round(days)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const PALETTE = [
  '#f97316',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#eab308',
  '#ef4444',
];

/** Stable colour for a user (cursor, avatar). */
export function colorFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase());
  return letters.join('') || '?';
}

/** Gradient covers. Stored on the page as `gradient:<key>`. */
export const COVERS: Record<string, string> = {
  dusk: 'linear-gradient(120deg, #fbc2eb 0%, #a6c1ee 100%)',
  ocean: 'linear-gradient(120deg, #0099cc 0%, #0066ff 100%)',
  ember: 'linear-gradient(120deg, #f15d00 0%, #ff006d 100%)',
  forest: 'linear-gradient(120deg, #00a300 0%, #00781f 100%)',
  citrus: 'linear-gradient(120deg, #fddb92 0%, #d1fdff 100%)',
  lilac: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  sand: 'linear-gradient(120deg, #fdfcfb 0%, #e2d1c3 100%)',
  graphite: 'linear-gradient(120deg, #52525b 0%, #18181b 100%)',
};

export function coverStyle(cover: string): string {
  if (cover.startsWith('gradient:')) return COVERS[cover.slice(9)] ?? COVERS['dusk']!;
  return `center / cover no-repeat url("${cover.replace(/["\\]/g, '')}")`;
}

export const RANDOM_ICONS = [
  '📝',
  '🚀',
  '🌿',
  '📚',
  '💡',
  '🎯',
  '🧠',
  '🗂️',
  '✨',
  '🧪',
  '🛠️',
  '📌',
  '🌙',
  '🎨',
  '📈',
  '🪴',
];

export function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/** Downloads text as a file. */
export function downloadText(filename: string, text: string, type = 'text/markdown'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Last opened page, so the app reopens where you left off. */
export const LAST_PAGE_KEY = 'folium:last-page';
