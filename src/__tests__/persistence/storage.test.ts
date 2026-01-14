/**
 * Storage Tests
 * Tests for persistence module (localStorage save/load)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveOrganism,
  getSavedOrganisms,
  getOrganism,
  deleteOrganism,
  updateOrganism,
  exportOrganismJSON,
  exportGenomeJSON,
  importOrganismJSON,
  importGenomeJSON,
  saveSettings,
  getSettings,
  saveGAArchive,
  getGAArchive,
  clearAllData,
  downloadJSON,
  readFileAsText,
  type SavedOrganism,
} from '../../persistence/storage';
import type { LeniaGenome } from '../../discovery/genome';

// Helper to create mock genome
function mockGenome(): LeniaGenome {
  return {
    R: 13,
    T: 10,
    m: 0.12,
    s: 0.04,
    b: [0.5],
    kn: 1,
    gn: 2,
  };
}

describe('storage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('saveOrganism / getSavedOrganisms', () => {
    it('saves organism to localStorage', () => {
      const genome = mockGenome();
      const organism = saveOrganism(genome, 'Test Organism');

      expect(organism.id).toBeDefined();
      expect(organism.name).toBe('Test Organism');
      expect(organism.genome).toEqual(genome);
      expect(organism.savedAt).toBeDefined();
    });

    it('retrieves saved organisms', () => {
      saveOrganism(mockGenome(), 'Organism 1');
      saveOrganism(mockGenome(), 'Organism 2');

      const organisms = getSavedOrganisms();

      expect(organisms.length).toBe(2);
      expect(organisms[0].name).toBe('Organism 1');
      expect(organisms[1].name).toBe('Organism 2');
    });

    it('saves optional description', () => {
      const organism = saveOrganism(mockGenome(), 'Named', 'A description');

      expect(organism.description).toBe('A description');
    });

    it('generates unique IDs', () => {
      const org1 = saveOrganism(mockGenome(), 'Org 1');
      const org2 = saveOrganism(mockGenome(), 'Org 2');

      expect(org1.id).not.toBe(org2.id);
    });

    it('returns empty array when no organisms saved', () => {
      const organisms = getSavedOrganisms();

      expect(organisms).toEqual([]);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('genesis:saved_organisms', 'invalid json');

      const organisms = getSavedOrganisms();

      expect(organisms).toEqual([]);
    });
  });

  describe('getOrganism', () => {
    it('retrieves organism by ID', () => {
      const saved = saveOrganism(mockGenome(), 'Target');

      const retrieved = getOrganism(saved.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('Target');
    });

    it('returns null for non-existent ID', () => {
      saveOrganism(mockGenome(), 'Exists');

      const result = getOrganism('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('deleteOrganism', () => {
    it('deletes organism by ID', () => {
      const org1 = saveOrganism(mockGenome(), 'Keep');
      const org2 = saveOrganism(mockGenome(), 'Delete');

      const result = deleteOrganism(org2.id);

      expect(result).toBe(true);
      expect(getSavedOrganisms().length).toBe(1);
      expect(getOrganism(org1.id)).not.toBeNull();
      expect(getOrganism(org2.id)).toBeNull();
    });

    it('returns false for non-existent ID', () => {
      saveOrganism(mockGenome(), 'Exists');

      const result = deleteOrganism('non-existent-id');

      expect(result).toBe(false);
      expect(getSavedOrganisms().length).toBe(1);
    });
  });

  describe('updateOrganism', () => {
    it('updates organism fields', () => {
      const saved = saveOrganism(mockGenome(), 'Original Name');

      const result = updateOrganism(saved.id, {
        name: 'Updated Name',
        description: 'New description',
      });

      expect(result).toBe(true);

      const updated = getOrganism(saved.id);
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.description).toBe('New description');
    });

    it('preserves unchanged fields', () => {
      const genome = mockGenome();
      const saved = saveOrganism(genome, 'Name', 'Original description');

      updateOrganism(saved.id, { name: 'New Name' });

      const updated = getOrganism(saved.id);
      expect(updated!.description).toBe('Original description');
      expect(updated!.genome).toEqual(genome);
    });

    it('returns false for non-existent ID', () => {
      const result = updateOrganism('non-existent', { name: 'New' });

      expect(result).toBe(false);
    });
  });

  describe('exportOrganismJSON', () => {
    it('exports organism as JSON string', () => {
      const organism: SavedOrganism = {
        id: 'test-id',
        name: 'Test',
        genome: mockGenome(),
        savedAt: 1234567890,
        description: 'Description',
      };

      const json = exportOrganismJSON(organism);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe('test-id');
      expect(parsed.name).toBe('Test');
      expect(parsed.genome.R).toBe(13);
    });

    it('produces formatted JSON', () => {
      const organism: SavedOrganism = {
        id: 'test-id',
        name: 'Test',
        genome: mockGenome(),
        savedAt: 1234567890,
      };

      const json = exportOrganismJSON(organism);

      // Should have newlines (formatted)
      expect(json.includes('\n')).toBe(true);
    });
  });

  describe('exportGenomeJSON', () => {
    it('exports genome as JSON string', () => {
      const genome = mockGenome();
      genome.R = 15;

      const json = exportGenomeJSON(genome);
      const parsed = JSON.parse(json);

      expect(parsed.R).toBe(15);
      expect(parsed.T).toBe(10);
      expect(parsed.b).toEqual([0.5]);
    });
  });

  describe('importOrganismJSON', () => {
    it('imports valid organism JSON', () => {
      const json = JSON.stringify({
        name: 'Imported',
        genome: mockGenome(),
        description: 'An imported organism',
      });

      const organism = importOrganismJSON(json);

      expect(organism).not.toBeNull();
      expect(organism!.name).toBe('Imported');
      expect(organism!.genome.R).toBe(13);
      expect(organism!.description).toBe('An imported organism');
    });

    it('generates new ID on import', () => {
      const json = JSON.stringify({
        id: 'original-id',
        name: 'Test',
        genome: mockGenome(),
      });

      const organism = importOrganismJSON(json);

      expect(organism!.id).not.toBe('original-id');
      expect(organism!.id.startsWith('org_')).toBe(true);
    });

    it('sets new savedAt timestamp', () => {
      const json = JSON.stringify({
        name: 'Test',
        genome: mockGenome(),
        savedAt: 1000,
      });

      const before = Date.now();
      const organism = importOrganismJSON(json);
      const after = Date.now();

      expect(organism!.savedAt).toBeGreaterThanOrEqual(before);
      expect(organism!.savedAt).toBeLessThanOrEqual(after);
    });

    it('returns null for invalid JSON', () => {
      const result = importOrganismJSON('not valid json');

      expect(result).toBeNull();
    });

    it('returns null for missing genome', () => {
      const json = JSON.stringify({ name: 'No Genome' });

      const result = importOrganismJSON(json);

      expect(result).toBeNull();
    });

    it('returns null for missing name', () => {
      const json = JSON.stringify({ genome: mockGenome() });

      const result = importOrganismJSON(json);

      expect(result).toBeNull();
    });

    it('returns null for invalid genome structure', () => {
      const json = JSON.stringify({
        name: 'Invalid',
        genome: { R: 'not a number' },
      });

      const result = importOrganismJSON(json);

      expect(result).toBeNull();
    });
  });

  describe('importGenomeJSON', () => {
    it('imports valid genome JSON', () => {
      const json = JSON.stringify({
        R: 15,
        T: 12,
        m: 0.15,
        s: 0.05,
        b: [0.3, 0.7],
        kn: 2,
        gn: 3,
      });

      const genome = importGenomeJSON(json);

      expect(genome).not.toBeNull();
      expect(genome!.R).toBe(15);
      expect(genome!.T).toBe(12);
      expect(genome!.b).toEqual([0.3, 0.7]);
    });

    it('returns null for invalid JSON', () => {
      const result = importGenomeJSON('invalid');

      expect(result).toBeNull();
    });

    it('returns null for invalid genome structure', () => {
      const json = JSON.stringify({ R: 'string', T: 10 });

      const result = importGenomeJSON(json);

      expect(result).toBeNull();
    });

    it('returns null for missing required fields', () => {
      const json = JSON.stringify({ R: 10, T: 10 }); // Missing m, s, b

      const result = importGenomeJSON(json);

      expect(result).toBeNull();
    });
  });

  describe('saveSettings / getSettings', () => {
    it('saves and retrieves settings', () => {
      saveSettings({ colormap: 'plasma', autoStart: true });

      const settings = getSettings();

      expect(settings.colormap).toBe('plasma');
      expect(settings.autoStart).toBe(true);
    });

    it('returns defaults when no settings saved', () => {
      const settings = getSettings();

      expect(settings.colormap).toBe('viridis');
      expect(settings.autoStart).toBe(false);
      expect(settings.lastParadigm).toBe('discrete');
    });

    it('merges partial updates with existing settings', () => {
      saveSettings({ colormap: 'plasma', autoStart: false });
      saveSettings({ autoStart: true });

      const settings = getSettings();

      expect(settings.colormap).toBe('plasma');
      expect(settings.autoStart).toBe(true);
    });

    it('handles corrupted settings gracefully', () => {
      localStorage.setItem('genesis:settings', 'invalid json');

      const settings = getSettings();

      expect(settings.colormap).toBe('viridis');
    });
  });

  describe('saveGAArchive / getGAArchive', () => {
    it('saves and retrieves GA archive', () => {
      const archive = [mockGenome(), mockGenome()];

      saveGAArchive(archive);
      const retrieved = getGAArchive();

      expect(retrieved.length).toBe(2);
      expect(retrieved[0].R).toBe(13);
    });

    it('returns empty array when no archive saved', () => {
      const archive = getGAArchive();

      expect(archive).toEqual([]);
    });

    it('handles corrupted archive gracefully', () => {
      localStorage.setItem('genesis:ga_archive', 'invalid');

      const archive = getGAArchive();

      expect(archive).toEqual([]);
    });
  });

  describe('clearAllData', () => {
    it('clears all storage keys', () => {
      saveOrganism(mockGenome(), 'Test');
      saveSettings({ colormap: 'plasma' });
      saveGAArchive([mockGenome()]);

      clearAllData();

      expect(getSavedOrganisms()).toEqual([]);
      expect(getSettings().colormap).toBe('viridis'); // Default
      expect(getGAArchive()).toEqual([]);
    });
  });

  describe('downloadJSON', () => {
    it('creates and clicks download link', () => {
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      downloadJSON('{"test": true}', 'test.json');

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:url');
    });
  });

  describe('readFileAsText', () => {
    it('reads file content', async () => {
      const content = '{"test": true}';
      const file = new File([content], 'test.json', { type: 'application/json' });

      const result = await readFileAsText(file);

      expect(result).toBe(content);
    });

    it('handles empty file', async () => {
      const file = new File([''], 'empty.json', { type: 'application/json' });

      const result = await readFileAsText(file);

      expect(result).toBe('');
    });
  });
});
