/**
 * URL Parameter Utilities
 * Share simulation state via URL parameters
 */

import type { CAParadigm } from '../core/types';
import type { ColormapName } from '../core/engine';
import type { LeniaGenome } from '../discovery/genome';

export interface ShareableState {
  // Simulation mode
  paradigm: CAParadigm;

  // Lenia/Continuous parameters
  genome?: LeniaGenome;

  // Discrete CA rule
  birth?: number[];
  survival?: number[];

  // Display options
  colormap?: ColormapName;

  // Pattern data (base64 encoded)
  pattern?: string;
}

/**
 * Parse URL search parameters into shareable state
 */
export function parseURLParams(): Partial<ShareableState> {
  const params = new URLSearchParams(window.location.search);
  const state: Partial<ShareableState> = {};

  // Parse paradigm
  const paradigm = params.get('mode');
  if (paradigm === 'discrete' || paradigm === 'continuous') {
    state.paradigm = paradigm;
  }

  // Parse Lenia genome
  const R = params.get('R');
  const T = params.get('T');
  const m = params.get('m');
  const s = params.get('s');
  const b = params.get('b');

  if (R || T || m || s || b) {
    state.genome = {
      R: R ? parseInt(R, 10) : 13,
      T: T ? parseInt(T, 10) : 10,
      m: m ? parseFloat(m) : 0.15,
      s: s ? parseFloat(s) : 0.015,
      b: b ? b.split(',').map(Number) : [1],
      kn: 1,
      gn: 1,
    };
  }

  // Parse discrete rule
  const birth = params.get('birth');
  const survival = params.get('survival');
  if (birth || survival) {
    state.birth = birth ? birth.split('').map(Number) : [3];
    state.survival = survival ? survival.split('').map(Number) : [2, 3];
  }

  // Parse colormap
  const colormap = params.get('colormap');
  if (colormap) {
    state.colormap = colormap as ColormapName;
  }

  // Parse pattern
  const pattern = params.get('pattern');
  if (pattern) {
    state.pattern = pattern;
  }

  return state;
}

/**
 * Generate shareable URL from state
 */
export function generateShareURL(state: ShareableState): string {
  const url = new URL(window.location.href);
  url.search = '';

  // Add paradigm
  url.searchParams.set('mode', state.paradigm);

  // Add Lenia genome if continuous
  if (state.paradigm === 'continuous' && state.genome) {
    url.searchParams.set('R', state.genome.R.toString());
    url.searchParams.set('T', state.genome.T.toString());
    url.searchParams.set('m', state.genome.m.toFixed(3));
    url.searchParams.set('s', state.genome.s.toFixed(4));
    url.searchParams.set('b', state.genome.b.map(v => v.toFixed(2)).join(','));
  }

  // Add discrete rule if discrete
  if (state.paradigm === 'discrete' && (state.birth || state.survival)) {
    if (state.birth) {
      url.searchParams.set('birth', state.birth.join(''));
    }
    if (state.survival) {
      url.searchParams.set('survival', state.survival.join(''));
    }
  }

  // Add colormap
  if (state.colormap) {
    url.searchParams.set('colormap', state.colormap);
  }

  // Add pattern if present
  if (state.pattern) {
    url.searchParams.set('pattern', state.pattern);
  }

  return url.toString();
}

/**
 * Update URL without page reload
 */
export function updateURLParams(state: Partial<ShareableState>): void {
  const url = new URL(window.location.href);

  // Update paradigm
  if (state.paradigm) {
    url.searchParams.set('mode', state.paradigm);
  }

  // Update Lenia genome
  if (state.genome) {
    url.searchParams.set('R', state.genome.R.toString());
    url.searchParams.set('T', state.genome.T.toString());
    url.searchParams.set('m', state.genome.m.toFixed(3));
    url.searchParams.set('s', state.genome.s.toFixed(4));
    url.searchParams.set('b', state.genome.b.map(v => v.toFixed(2)).join(','));
  }

  // Update discrete rule
  if (state.birth !== undefined) {
    url.searchParams.set('birth', state.birth.join(''));
  }
  if (state.survival !== undefined) {
    url.searchParams.set('survival', state.survival.join(''));
  }

  // Update colormap
  if (state.colormap) {
    url.searchParams.set('colormap', state.colormap);
  }

  // Update pattern
  if (state.pattern !== undefined) {
    if (state.pattern) {
      url.searchParams.set('pattern', state.pattern);
    } else {
      url.searchParams.delete('pattern');
    }
  }

  // Update URL without reload
  window.history.replaceState({}, '', url.toString());
}

/**
 * Copy shareable URL to clipboard
 */
export async function copyShareURL(state: ShareableState): Promise<boolean> {
  const url = generateShareURL(state);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

/**
 * Generate short share link (using simple hash)
 */
export function generateShortLink(state: ShareableState): string {
  // Create a compact representation
  const data = {
    p: state.paradigm === 'continuous' ? 'c' : 'd',
    g: state.genome
      ? [state.genome.R, state.genome.T, state.genome.m, state.genome.s, ...state.genome.b]
      : null,
    r: state.birth && state.survival
      ? [state.birth.join(''), state.survival.join('')]
      : null,
    m: state.colormap,
  };

  // Base64 encode
  const encoded = btoa(JSON.stringify(data));

  // Create URL with hash
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('s', encoded);

  return url.toString();
}

/**
 * Parse short share link
 */
export function parseShortLink(): Partial<ShareableState> | null {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('s');

  if (!encoded) return null;

  try {
    const data = JSON.parse(atob(encoded));
    const state: Partial<ShareableState> = {};

    state.paradigm = data.p === 'c' ? 'continuous' : 'discrete';

    if (data.g && Array.isArray(data.g)) {
      state.genome = {
        R: data.g[0],
        T: data.g[1],
        m: data.g[2],
        s: data.g[3],
        b: data.g.slice(4),
        kn: 1,
        gn: 1,
      };
    }

    if (data.r && Array.isArray(data.r)) {
      state.birth = data.r[0].split('').map(Number);
      state.survival = data.r[1].split('').map(Number);
    }

    if (data.m) {
      state.colormap = data.m;
    }

    return state;
  } catch {
    return null;
  }
}
