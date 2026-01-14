/**
 * Save/Load Panel Component
 * UI for saving and loading organisms
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Engine } from '../../core/engine';
import type { LeniaGenome } from '../../discovery/genome';
import {
  saveOrganism,
  getSavedOrganisms,
  deleteOrganism,
  exportGenomeJSON,
  importGenomeJSON,
  downloadJSON,
  readFileAsText,
  type SavedOrganism,
} from '../../persistence/storage';
import { genomeToParams } from '../../discovery/genome';

interface SaveLoadPanelProps {
  engine: Engine | null;
  currentGenome?: LeniaGenome | null;
  onLoadGenome?: (genome: LeniaGenome) => void;
}

export function SaveLoadPanel({ engine, currentGenome, onLoadGenome }: SaveLoadPanelProps) {
  const [savedOrganisms, setSavedOrganisms] = useState<SavedOrganism[]>([]);
  const [saveName, setSaveName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved organisms on mount
  useEffect(() => {
    setSavedOrganisms(getSavedOrganisms());
  }, []);

  const handleSave = useCallback(() => {
    if (!currentGenome || !saveName.trim()) return;

    const organism = saveOrganism(currentGenome, saveName.trim());
    setSavedOrganisms(prev => [...prev, organism]);
    setSaveName('');
    setShowSaveForm(false);
  }, [currentGenome, saveName]);

  const handleLoad = useCallback((organism: SavedOrganism) => {
    if (!engine) return;

    engine.setParadigm('continuous');
    const params = genomeToParams(organism.genome);
    engine.setContinuousParams({
      kernelRadius: params.kernelRadius,
      growthCenter: params.growthCenter,
      growthWidth: params.growthWidth,
      dt: params.dt,
      growthType: params.growthType,
    });
    engine.reset('lenia-seed');

    onLoadGenome?.(organism.genome);
  }, [engine, onLoadGenome]);

  const handleDelete = useCallback((id: string) => {
    if (deleteOrganism(id)) {
      setSavedOrganisms(prev => prev.filter(o => o.id !== id));
    }
  }, []);

  const handleExport = useCallback((organism: SavedOrganism) => {
    const json = exportGenomeJSON(organism.genome);
    downloadJSON(json, `${organism.name.replace(/\s+/g, '_')}.json`);
  }, []);

  const handleExportCurrent = useCallback(() => {
    if (!currentGenome) return;
    const json = exportGenomeJSON(currentGenome);
    downloadJSON(json, `organism_${Date.now()}.json`);
  }, [currentGenome]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const genome = importGenomeJSON(text);

      if (genome && engine) {
        engine.setParadigm('continuous');
        const params = genomeToParams(genome);
        engine.setContinuousParams({
          kernelRadius: params.kernelRadius,
          growthCenter: params.growthCenter,
          growthWidth: params.growthWidth,
          dt: params.dt,
          growthType: params.growthType,
        });
        engine.reset('lenia-seed');
        onLoadGenome?.(genome);
      }
    } catch (e) {
      console.error('Failed to import file:', e);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [engine, onLoadGenome]);

  return (
    <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="font-medium text-zinc-300">Organism Library</h3>
        <span className="text-xs text-zinc-500">
          {savedOrganisms.length} saved • {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isExpanded && (
        <div className="mt-4">
          {/* Actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setShowSaveForm(!showSaveForm)}
              disabled={!currentGenome}
              className="px-3 py-1.5 text-sm rounded bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
            >
              Save Current
            </button>
            <button
              onClick={handleExportCurrent}
              disabled={!currentGenome}
              className="px-3 py-1.5 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-50"
            >
              Export JSON
            </button>
            <button
              onClick={handleImportClick}
              className="px-3 py-1.5 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
            >
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Save Form */}
          {showSaveForm && (
            <div className="mb-4 p-3 bg-zinc-800 rounded">
              <label className="text-xs text-zinc-500 block mb-1">Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="My Organism"
                  className="flex-1 px-2 py-1 text-sm bg-zinc-700 border border-zinc-600 rounded text-zinc-300"
                />
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim()}
                  className="px-3 py-1 text-sm rounded bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Saved Organisms List */}
          {savedOrganisms.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {savedOrganisms.map((organism) => (
                <div
                  key={organism.id}
                  className="flex items-center justify-between p-2 bg-zinc-800 rounded hover:bg-zinc-750"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-300 truncate">{organism.name}</div>
                    <div className="text-xs text-zinc-500">
                      R={organism.genome.R} μ={organism.genome.m.toFixed(3)}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => handleLoad(organism)}
                      className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleExport(organism)}
                      className="px-2 py-1 text-xs rounded bg-zinc-600 hover:bg-zinc-500 text-white transition-colors"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleDelete(organism.id)}
                      className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-500 text-center py-4">
              No saved organisms yet. Discover or configure an organism and save it here.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
