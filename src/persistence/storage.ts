/**
 * Persistence Module
 * Save/load organisms and settings to localStorage
 */

import type { LeniaGenome } from '../discovery/genome';

const STORAGE_KEYS = {
  SAVED_ORGANISMS: 'genesis:saved_organisms',
  SETTINGS: 'genesis:settings',
  GA_ARCHIVE: 'genesis:ga_archive',
} as const;

export interface SavedOrganism {
  id: string;
  name: string;
  genome: LeniaGenome;
  savedAt: number;
  description?: string;
  thumbnail?: string; // Base64 image
}

export interface Settings {
  colormap: string;
  autoStart: boolean;
  lastParadigm: string;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `org_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Save an organism to localStorage
 */
export function saveOrganism(
  genome: LeniaGenome,
  name: string,
  description?: string
): SavedOrganism {
  const organisms = getSavedOrganisms();

  const organism: SavedOrganism = {
    id: generateId(),
    name,
    genome,
    savedAt: Date.now(),
    description,
  };

  organisms.push(organism);
  localStorage.setItem(STORAGE_KEYS.SAVED_ORGANISMS, JSON.stringify(organisms));

  return organism;
}

/**
 * Get all saved organisms
 */
export function getSavedOrganisms(): SavedOrganism[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SAVED_ORGANISMS);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Get a single organism by ID
 */
export function getOrganism(id: string): SavedOrganism | null {
  const organisms = getSavedOrganisms();
  return organisms.find(o => o.id === id) || null;
}

/**
 * Delete an organism by ID
 */
export function deleteOrganism(id: string): boolean {
  const organisms = getSavedOrganisms();
  const filtered = organisms.filter(o => o.id !== id);

  if (filtered.length === organisms.length) return false;

  localStorage.setItem(STORAGE_KEYS.SAVED_ORGANISMS, JSON.stringify(filtered));
  return true;
}

/**
 * Update an organism
 */
export function updateOrganism(id: string, updates: Partial<Omit<SavedOrganism, 'id' | 'savedAt'>>): boolean {
  const organisms = getSavedOrganisms();
  const index = organisms.findIndex(o => o.id === id);

  if (index === -1) return false;

  organisms[index] = { ...organisms[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.SAVED_ORGANISMS, JSON.stringify(organisms));
  return true;
}

/**
 * Export organism as JSON string
 */
export function exportOrganismJSON(organism: SavedOrganism): string {
  return JSON.stringify(organism, null, 2);
}

/**
 * Export genome only as JSON
 */
export function exportGenomeJSON(genome: LeniaGenome): string {
  return JSON.stringify(genome, null, 2);
}

/**
 * Import organism from JSON string
 */
export function importOrganismJSON(json: string): SavedOrganism | null {
  try {
    const data = JSON.parse(json);

    // Validate required fields
    if (!data.genome || !data.name) {
      console.error('Invalid organism JSON: missing genome or name');
      return null;
    }

    // Validate genome structure
    const { genome } = data;
    if (
      typeof genome.R !== 'number' ||
      typeof genome.T !== 'number' ||
      !Array.isArray(genome.b) ||
      typeof genome.m !== 'number' ||
      typeof genome.s !== 'number'
    ) {
      console.error('Invalid genome structure');
      return null;
    }

    // Create new organism with fresh ID
    return {
      id: generateId(),
      name: data.name,
      genome: data.genome,
      savedAt: Date.now(),
      description: data.description,
    };
  } catch (e) {
    console.error('Failed to parse organism JSON:', e);
    return null;
  }
}

/**
 * Import genome only from JSON string
 */
export function importGenomeJSON(json: string): LeniaGenome | null {
  try {
    const genome = JSON.parse(json);

    // Validate genome structure
    if (
      typeof genome.R !== 'number' ||
      typeof genome.T !== 'number' ||
      !Array.isArray(genome.b) ||
      typeof genome.m !== 'number' ||
      typeof genome.s !== 'number'
    ) {
      console.error('Invalid genome structure');
      return null;
    }

    return genome;
  } catch (e) {
    console.error('Failed to parse genome JSON:', e);
    return null;
  }
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: Partial<Settings>): void {
  const current = getSettings();
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
}

/**
 * Get settings from localStorage
 */
export function getSettings(): Settings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      return {
        colormap: 'viridis',
        autoStart: false,
        lastParadigm: 'discrete',
      };
    }
    return JSON.parse(data);
  } catch {
    return {
      colormap: 'viridis',
      autoStart: false,
      lastParadigm: 'discrete',
    };
  }
}

/**
 * Save GA archive to localStorage
 */
export function saveGAArchive(archive: LeniaGenome[]): void {
  localStorage.setItem(STORAGE_KEYS.GA_ARCHIVE, JSON.stringify(archive));
}

/**
 * Get GA archive from localStorage
 */
export function getGAArchive(): LeniaGenome[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GA_ARCHIVE);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Clear all saved data
 */
export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.SAVED_ORGANISMS);
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  localStorage.removeItem(STORAGE_KEYS.GA_ARCHIVE);
}

/**
 * Download data as a file
 */
export function downloadJSON(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
