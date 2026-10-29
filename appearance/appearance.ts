import { useSyncExternalStore } from 'react';

export type Design = 'classic' | 'fantasy' | 'scifi' | 'noir';
export const DESIGN_KEY = 'lumina-visual-design';
export const DESIGNS: { id: Design; name: string; subtitle: string; description: string; sample: string; typography: string }[] = [
  { id: 'classic', name: 'Klasyczny', subtitle: 'Lumina Original', description: 'Znany interfejs, miękkie kształty i spokojne powierzchnie.', sample: 'Przestrzeń dla słów', typography: 'Inter · Merriweather' },
  { id: 'fantasy', name: 'Fantasy', subtitle: 'Iluminowane archiwum', description: 'Pergamin, złocone ramy, ornamenty i szlachetna typografia księgi.', sample: 'Opowieści zapisane w świetle', typography: 'Cormorant Garamond · Alegreya' },
  { id: 'scifi', name: 'Sci-fi', subtitle: 'Orbital Studio', description: 'Precyzyjna siatka, orbitalne diagramy, świetlne linie i techniczne detale.', sample: 'Nowy horyzont tekstu', typography: 'Space Grotesk · Manrope' },
  { id: 'noir', name: 'Noir', subtitle: 'The Midnight Edition', description: 'Redakcyjna elegancja, ślady druku, ostre ramy i światło przechodzące przez żaluzje.', sample: 'Każde słowo ma swoją historię.', typography: 'Bodoni Moda · Manrope' },
];

const isDesign = (value: unknown): value is Design => DESIGNS.some(item => item.id === value);
const validDesign = (value: unknown): Design => isDesign(value) ? value : 'classic';
export const APPEARANCE_COOKIE = 'lumina-appearance-v1';
const MODE_KEY = 'theme';
type Mode = 'light' | 'dark';
let currentDesign: Design = 'classic';
let currentMode: Mode = 'light';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const readLocal = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeLocal = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* In-memory fallback. */ } };

const applyAppearance = (design: Design, mode: Mode) => {
  currentDesign = design;
  currentMode = mode;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.design = design;
    document.documentElement.toggleAttribute('data-custom-design', design !== 'classic');
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }
};

const readShared = (): { design: Design; mode: Mode } | null => {
  try {
    const raw = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${APPEARANCE_COOKIE}=`));
    if (!raw) return null;
    const value = JSON.parse(decodeURIComponent(raw.slice(APPEARANCE_COOKIE.length + 1)));
    return isDesign(value.design) && (value.mode === 'light' || value.mode === 'dark') ? value : null;
  } catch { return null; }
};

const persistShared = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  // Cookies span ports locally and the explicitly owned Lumina subdomains in production.
  const hostname = window.location.hostname.toLowerCase();
  const domain = hostname === 'lumina-suite.tech' || hostname.endsWith('.lumina-suite.tech') ? '; Domain=lumina-suite.tech' : '';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const value = encodeURIComponent(JSON.stringify({ design: currentDesign, mode: currentMode }));
  try { document.cookie = `${APPEARANCE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${secure}`; } catch { /* Local preferences still work. */ }
};

const persist = () => {
  writeLocal(DESIGN_KEY, currentDesign);
  writeLocal(MODE_KEY, currentMode);
  persistShared();
};

export const setDesign = (design: Design) => {
  // Pick up the latest lighting choice from another app before changing only the design.
  const shared = readShared();
  applyAppearance(validDesign(design), shared?.mode ?? currentMode);
  persist();
  notify();
};
export const setColorMode = (dark: boolean | ((previous: boolean) => boolean)) => {
  const shared = readShared();
  const previous = (shared?.mode ?? currentMode) === 'dark';
  applyAppearance(shared?.design ?? currentDesign, (typeof dark === 'function' ? dark(previous) : dark) ? 'dark' : 'light');
  persist();
  notify();
};

const syncShared = () => {
  const shared = readShared();
  if (shared && (shared.design !== currentDesign || shared.mode !== currentMode)) {
    applyAppearance(shared.design, shared.mode);
    writeLocal(DESIGN_KEY, currentDesign);
    writeLocal(MODE_KEY, currentMode);
    notify();
  }
};

if (typeof window !== 'undefined') {
  const shared = readShared();
  const savedMode = readLocal(MODE_KEY);
  const mode = savedMode === 'light' || savedMode === 'dark' ? savedMode : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyAppearance(shared?.design ?? validDesign(readLocal(DESIGN_KEY)), shared?.mode ?? mode);
  if (shared) {
    writeLocal(DESIGN_KEY, currentDesign);
    writeLocal(MODE_KEY, currentMode);
  } else {
    persistShared();
  }
  window.addEventListener('storage', event => {
    if (event.key === DESIGN_KEY || event.key === MODE_KEY || event.key === null) {
      if (event.key === DESIGN_KEY) applyAppearance(validDesign(event.newValue), currentMode);
      else if (event.key === MODE_KEY && (event.newValue === 'light' || event.newValue === 'dark')) applyAppearance(currentDesign, event.newValue);
      else if (event.key === null) applyAppearance('classic', 'light');
      persistShared();
      notify();
    }
  });
  window.addEventListener('focus', syncShared);
  window.addEventListener('pageshow', syncShared);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncShared(); });
  // Different origins do not receive each other's storage events. Keep visible windows in sync too.
  window.setInterval(() => { if (document.visibilityState === 'visible') syncShared(); }, 1500);
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useDesign = (): Design => useSyncExternalStore(subscribe, () => currentDesign, () => 'classic');
export const useColorMode = (): [boolean, typeof setColorMode] => [
  useSyncExternalStore(subscribe, () => currentMode === 'dark', () => false),
  setColorMode,
];
