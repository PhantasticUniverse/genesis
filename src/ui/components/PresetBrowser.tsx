/**
 * Preset Browser Component
 * Full-featured browser for exploring and loading presets across all simulation modes
 */

import { useState, useCallback, useEffect, useMemo, memo } from "react";
import { usePresetStore } from "../stores/preset-store";
import { presetRegistry } from "../../patterns/registry/preset-registry";
import type {
  PresetMode,
  PresetCategory,
  PresetData,
  DifficultyLevel,
} from "../../patterns/registry/preset-types";
import {
  getModeDisplayName,
  getCategoryDisplayName,
} from "../../patterns/registry/preset-types";
import { ExpandablePanel } from "./common/ExpandablePanel";

// ============================================================================
// Sub-components
// ============================================================================

interface ModeTabsProps {
  selectedMode: PresetMode | "all";
  modeCounts: Record<PresetMode | "all", number>;
  onModeChange: (mode: PresetMode | "all") => void;
}

function ModeTabs({ selectedMode, modeCounts, onModeChange }: ModeTabsProps) {
  const modes: (PresetMode | "all")[] = [
    "all",
    "discrete",
    "continuous",
    "multikernel",
    "3d",
    "particle",
    "ecology",
    "sensorimotor",
  ];

  const modeLabels: Record<PresetMode | "all", string> = {
    all: "All",
    discrete: "Discrete",
    continuous: "Lenia",
    multikernel: "Multi-K",
    "3d": "3D",
    particle: "Particle",
    ecology: "Ecology",
    sensorimotor: "Agency",
  };

  return (
    <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-200 whitespace-nowrap
            ${
              selectedMode === mode
                ? "bg-bio-cyan/20 text-bio-cyan border border-bio-cyan/40"
                : "bg-genesis-surface/50 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300"
            }
          `}
        >
          {modeLabels[mode]}
          {modeCounts[mode] > 0 && (
            <span
              className={`
                px-1.5 py-0.5 rounded-full text-[10px]
                ${selectedMode === mode ? "bg-bio-cyan/30" : "bg-zinc-700/50"}
              `}
            >
              {modeCounts[mode]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface SearchFilterBarProps {
  searchQuery: string;
  selectedCategory: PresetCategory | "all";
  sortBy: "name" | "popularity" | "rating" | "createdAt" | "updatedAt";
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: PresetCategory | "all") => void;
  onSortChange: (
    sortBy: "name" | "popularity" | "rating" | "createdAt" | "updatedAt",
  ) => void;
  onClearFilters: () => void;
}

function SearchFilterBar({
  searchQuery,
  selectedCategory,
  sortBy,
  onSearchChange,
  onCategoryChange,
  onSortChange,
  onClearFilters,
}: SearchFilterBarProps) {
  const categories: (PresetCategory | "all")[] = [
    "all",
    "glider",
    "oscillator",
    "still",
    "chaotic",
    "replicator",
    "ecosystem",
    "gun",
    "spaceship",
    "classic",
    "experimental",
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search presets..."
          className="w-full bg-genesis-surface/50 border border-zinc-700/50 rounded-lg
            px-3 py-2 pl-9 text-sm text-zinc-200 placeholder:text-zinc-500
            focus:outline-none focus:border-bio-cyan/50 focus:ring-1 focus:ring-bio-cyan/20
            transition-all"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="flex gap-2 items-center">
        <select
          value={selectedCategory}
          onChange={(e) =>
            onCategoryChange(e.target.value as PresetCategory | "all")
          }
          className="genesis-select text-xs flex-1"
        >
          <option value="all">All Categories</option>
          {categories.slice(1).map((cat) => (
            <option key={cat} value={cat}>
              {getCategoryDisplayName(cat as PresetCategory)}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as typeof sortBy)}
          className="genesis-select text-xs flex-1"
        >
          <option value="name">Name</option>
          <option value="popularity">Popular</option>
          <option value="rating">Rating</option>
          <option value="createdAt">Newest</option>
        </select>

        <button
          onClick={onClearFilters}
          className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Clear filters"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface PresetCardProps {
  preset: PresetData;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onLoad: () => void;
}

const PresetCard = memo(function PresetCard({
  preset,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onLoad,
}: PresetCardProps) {
  const { metadata } = preset;

  // Behavior icons
  const behaviorIcons = useMemo(() => {
    const icons: { icon: string; label: string }[] = [];
    if (metadata.behavior.mobile) icons.push({ icon: "🏃", label: "Mobile" });
    if (metadata.behavior.oscillating)
      icons.push({ icon: "💫", label: "Oscillating" });
    if (metadata.behavior.replicating)
      icons.push({ icon: "🔄", label: "Replicating" });
    if (metadata.behavior.chaotic) icons.push({ icon: "🌀", label: "Chaotic" });
    if (metadata.behavior.symmetric)
      icons.push({ icon: "📐", label: "Symmetric" });
    return icons;
  }, [metadata.behavior]);

  // Difficulty stars
  const stars = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => i < metadata.difficulty);
  }, [metadata.difficulty]);

  return (
    <div
      onClick={onSelect}
      className={`
        relative group cursor-pointer rounded-lg overflow-hidden
        border transition-all duration-200
        ${
          isSelected
            ? "border-bio-cyan/60 bg-bio-cyan/10 shadow-lg shadow-bio-cyan/10"
            : "border-zinc-700/50 bg-genesis-surface/50 hover:border-zinc-600 hover:bg-genesis-surface/70"
        }
      `}
    >
      {/* Thumbnail area */}
      <div className="aspect-square bg-genesis-depth/50 relative overflow-hidden">
        {metadata.thumbnail ? (
          <img
            src={metadata.thumbnail}
            alt={metadata.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-bio-cyan/30 to-bio-magenta/30 animate-pulse" />
          </div>
        )}

        {/* Verified badge */}
        {metadata.verified && (
          <div className="absolute top-2 left-2 z-10 bg-bio-green/20 text-bio-green text-[10px] px-1.5 py-0.5 rounded-full border border-bio-green/30">
            ✓ Verified
          </div>
        )}

        {/* Favorite button - always slightly visible */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`
            absolute top-2 right-2 z-20 p-1.5 rounded-full transition-all
            ${
              isFavorite
                ? "opacity-100 bg-bio-amber/30 text-bio-amber"
                : "opacity-40 group-hover:opacity-100 bg-genesis-depth/80 text-zinc-500 hover:text-bio-amber"
            }
          `}
        >
          <svg
            className="w-4 h-4"
            fill={isFavorite ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>

        {/* Quick load button - always slightly visible */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLoad();
          }}
          className="absolute bottom-2 right-2 z-20 p-2 rounded-lg bg-bio-cyan/20 text-bio-cyan
            opacity-40 group-hover:opacity-100 transition-all hover:bg-bio-cyan/30"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        {/* Mode badge */}
        <div className="absolute bottom-2 left-2 z-10 text-[10px] px-1.5 py-0.5 rounded bg-genesis-depth/80 text-zinc-400">
          {getModeDisplayName(metadata.mode)}
        </div>
      </div>

      {/* Info section */}
      <div className="p-2">
        <h4
          className="text-xs font-medium text-zinc-200 truncate"
          title={metadata.name}
        >
          {metadata.name}
        </h4>
        <div className="flex items-center justify-between mt-1">
          {/* Behavior icons */}
          <div className="flex gap-0.5">
            {behaviorIcons.slice(0, 3).map((b, i) => (
              <span key={i} className="text-[10px]" title={b.label}>
                {b.icon}
              </span>
            ))}
          </div>
          {/* Difficulty */}
          <div className="flex gap-px">
            {stars.map((filled, i) => (
              <span
                key={i}
                className={`text-[8px] ${filled ? "text-bio-amber" : "text-zinc-700"}`}
              >
                ★
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

interface PresetDetailPanelProps {
  preset: PresetData;
  isFavorite: boolean;
  onLoad: () => void;
  onToggleFavorite: () => void;
  onClose: () => void;
}

function PresetDetailPanel({
  preset,
  isFavorite,
  onLoad,
  onToggleFavorite,
  onClose,
}: PresetDetailPanelProps) {
  const { metadata, config } = preset;

  return (
    <div className="glass-panel p-4 mt-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-display text-bio-cyan">
            {metadata.name}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">by {metadata.author}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-zinc-500 hover:text-zinc-300"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-400 mb-3">
        {metadata.description || "No description available."}
      </p>

      {/* Tags */}
      {metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {metadata.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-genesis-surface border border-zinc-700/50 text-zinc-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded bg-genesis-surface/50">
          <div className="text-xs text-zinc-500">Mode</div>
          <div className="text-xs text-zinc-200">
            {getModeDisplayName(metadata.mode)}
          </div>
        </div>
        <div className="text-center p-2 rounded bg-genesis-surface/50">
          <div className="text-xs text-zinc-500">Category</div>
          <div className="text-xs text-zinc-200">
            {getCategoryDisplayName(metadata.category)}
          </div>
        </div>
        <div className="text-center p-2 rounded bg-genesis-surface/50">
          <div className="text-xs text-zinc-500">Rating</div>
          <div className="text-xs text-bio-amber">
            {"★".repeat(Math.round(metadata.rating))}
            {"☆".repeat(5 - Math.round(metadata.rating))}
          </div>
        </div>
      </div>

      {/* Config preview */}
      <details className="mb-3">
        <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
          View Configuration
        </summary>
        <pre className="mt-2 p-2 rounded bg-genesis-depth/50 text-[10px] text-zinc-400 overflow-x-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
      </details>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onLoad}
          className="flex-1 btn-glow bg-bio-cyan/20 text-bio-cyan hover:bg-bio-cyan/30
            px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
          </svg>
          Load
        </button>
        <button
          onClick={onToggleFavorite}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2
            ${
              isFavorite
                ? "bg-bio-amber/20 text-bio-amber"
                : "bg-genesis-surface text-zinc-400 hover:text-bio-amber"
            }
          `}
        >
          <svg
            className="w-4 h-4"
            fill={isFavorite ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
          {isFavorite ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface PresetBrowserProps {
  onLoadPreset?: (preset: PresetData) => void;
  defaultExpanded?: boolean;
}

export function PresetBrowser({
  onLoadPreset,
  defaultExpanded = false,
}: PresetBrowserProps) {
  const {
    selectedMode,
    selectedCategory,
    searchQuery,
    sortBy,
    sortOrder,
    filteredPresets,
    modeCounts,
    favorites,
    selectedPresetId,
    setSelectedMode,
    setSelectedCategory,
    setSearchQuery,
    setSortBy,
    clearFilters,
    selectPreset,
    toggleFavorite,
    addToRecent,
    refreshPresets,
  } = usePresetStore();

  // Refresh on mount
  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);

  // Get selected preset
  const selectedPreset = useMemo(() => {
    if (!selectedPresetId) return null;
    return presetRegistry.getPreset(selectedPresetId);
  }, [selectedPresetId]);

  // Handle load preset
  const handleLoadPreset = useCallback(
    (preset: PresetData) => {
      addToRecent(preset.metadata.id);
      onLoadPreset?.(preset);
    },
    [addToRecent, onLoadPreset],
  );

  return (
    <ExpandablePanel
      title="PRESET LIBRARY"
      titleColor="text-bio-cyan"
      defaultExpanded={defaultExpanded}
      accent="cyan"
      statusBadge={
        filteredPresets.length > 0
          ? {
              text: `${filteredPresets.length}`,
              color: "text-bio-cyan border-bio-cyan/30",
            }
          : undefined
      }
    >
      {/* Mode tabs */}
      <ModeTabs
        selectedMode={selectedMode}
        modeCounts={modeCounts}
        onModeChange={setSelectedMode}
      />

      {/* Search and filters */}
      <div className="mt-3">
        <SearchFilterBar
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          sortBy={sortBy}
          onSearchChange={setSearchQuery}
          onCategoryChange={setSelectedCategory}
          onSortChange={setSortBy}
          onClearFilters={clearFilters}
        />
      </div>

      {/* Preset grid */}
      <div className="mt-3">
        {filteredPresets.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-sm">
            No presets found
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="block mx-auto mt-2 text-bio-cyan hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="scrollable-grid grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
            {filteredPresets.map((preset) => (
              <PresetCard
                key={preset.metadata.id}
                preset={preset}
                isSelected={selectedPresetId === preset.metadata.id}
                isFavorite={favorites.includes(preset.metadata.id)}
                onSelect={() => selectPreset(preset.metadata.id)}
                onToggleFavorite={() => toggleFavorite(preset.metadata.id)}
                onLoad={() => handleLoadPreset(preset)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedPreset && (
        <PresetDetailPanel
          preset={selectedPreset}
          isFavorite={favorites.includes(selectedPreset.metadata.id)}
          onLoad={() => handleLoadPreset(selectedPreset)}
          onToggleFavorite={() => toggleFavorite(selectedPreset.metadata.id)}
          onClose={() => selectPreset(null)}
        />
      )}
    </ExpandablePanel>
  );
}

export default PresetBrowser;
