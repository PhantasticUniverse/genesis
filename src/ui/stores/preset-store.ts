/**
 * Preset Store
 * Zustand store for managing preset browser state
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  PresetMode,
  PresetCategory,
  PresetData,
  PresetQueryOptions,
  DifficultyLevel,
} from "../../patterns/registry/preset-types";
import { presetRegistry } from "../../patterns/registry/preset-registry";

// ============================================================================
// Types
// ============================================================================

type SortBy = "name" | "popularity" | "rating" | "createdAt" | "updatedAt";
type SortOrder = "asc" | "desc";

interface PresetStoreState {
  // Browse state
  selectedMode: PresetMode | "all";
  selectedCategory: PresetCategory | "all";
  searchQuery: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  minDifficulty: DifficultyLevel;
  maxDifficulty: DifficultyLevel;
  verifiedOnly: boolean;

  // Selection
  selectedPresetId: string | null;
  previewingPresetId: string | null;

  // User data (persisted)
  favorites: string[];
  recentPresets: string[];

  // Cached data
  filteredPresets: PresetData[];
  modeCounts: Record<PresetMode | "all", number>;

  // Actions - Browse
  setSelectedMode: (mode: PresetMode | "all") => void;
  setSelectedCategory: (category: PresetCategory | "all") => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
  setDifficultyRange: (min: DifficultyLevel, max: DifficultyLevel) => void;
  setVerifiedOnly: (verified: boolean) => void;
  clearFilters: () => void;

  // Actions - Selection
  selectPreset: (id: string | null) => void;
  startPreview: (id: string) => void;
  stopPreview: () => void;

  // Actions - User data
  toggleFavorite: (id: string) => void;
  addToRecent: (id: string) => void;
  clearRecent: () => void;

  // Actions - Refresh
  refreshPresets: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const usePresetStore = create<PresetStoreState>()(
  persist(
    (set, get) => ({
      // Initial browse state
      selectedMode: "all",
      selectedCategory: "all",
      searchQuery: "",
      sortBy: "name",
      sortOrder: "asc",
      minDifficulty: 1,
      maxDifficulty: 5,
      verifiedOnly: false,

      // Selection
      selectedPresetId: null,
      previewingPresetId: null,

      // User data
      favorites: [],
      recentPresets: [],

      // Cached data
      filteredPresets: [],
      modeCounts: {
        all: 0,
        discrete: 0,
        continuous: 0,
        multikernel: 0,
        "3d": 0,
        particle: 0,
        ecology: 0,
      },

      // Browse actions
      setSelectedMode: (mode) => {
        set({ selectedMode: mode, selectedPresetId: null });
        get().refreshPresets();
      },

      setSelectedCategory: (category) => {
        set({ selectedCategory: category, selectedPresetId: null });
        get().refreshPresets();
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
        get().refreshPresets();
      },

      setSortBy: (sortBy) => {
        set({ sortBy });
        get().refreshPresets();
      },

      setSortOrder: (order) => {
        set({ sortOrder: order });
        get().refreshPresets();
      },

      setDifficultyRange: (min, max) => {
        set({ minDifficulty: min, maxDifficulty: max });
        get().refreshPresets();
      },

      setVerifiedOnly: (verified) => {
        set({ verifiedOnly: verified });
        get().refreshPresets();
      },

      clearFilters: () => {
        set({
          selectedCategory: "all",
          searchQuery: "",
          minDifficulty: 1,
          maxDifficulty: 5,
          verifiedOnly: false,
          sortBy: "name",
          sortOrder: "asc",
        });
        get().refreshPresets();
      },

      // Selection actions
      selectPreset: (id) => {
        set({ selectedPresetId: id });
      },

      startPreview: (id) => {
        set({ previewingPresetId: id });
      },

      stopPreview: () => {
        set({ previewingPresetId: null });
      },

      // User data actions
      toggleFavorite: (id) => {
        set((state) => {
          const favorites = state.favorites.includes(id)
            ? state.favorites.filter((f) => f !== id)
            : [...state.favorites, id];
          return { favorites };
        });
      },

      addToRecent: (id) => {
        set((state) => {
          const filtered = state.recentPresets.filter((r) => r !== id);
          const recentPresets = [id, ...filtered].slice(0, 20); // Keep last 20
          return { recentPresets };
        });
      },

      clearRecent: () => {
        set({ recentPresets: [] });
      },

      // Refresh presets based on current filters
      refreshPresets: () => {
        const state = get();

        // Build query options
        const options: PresetQueryOptions = {
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          minDifficulty: state.minDifficulty,
          maxDifficulty: state.maxDifficulty,
          verified: state.verifiedOnly ? true : undefined,
          search: state.searchQuery || undefined,
        };

        // Add mode filter
        if (state.selectedMode !== "all") {
          options.mode = state.selectedMode;
        }

        // Add category filter
        if (state.selectedCategory !== "all") {
          options.category = state.selectedCategory;
        }

        // Query registry
        const filteredPresets = presetRegistry.queryPresets(options);

        // Calculate mode counts
        const modeCounts: Record<PresetMode | "all", number> = {
          all: presetRegistry.getAllPresets().length,
          discrete: presetRegistry.queryPresets({ mode: "discrete" }).length,
          continuous: presetRegistry.queryPresets({ mode: "continuous" })
            .length,
          multikernel: presetRegistry.queryPresets({ mode: "multikernel" })
            .length,
          "3d": presetRegistry.queryPresets({ mode: "3d" }).length,
          particle: presetRegistry.queryPresets({ mode: "particle" }).length,
          ecology: presetRegistry.queryPresets({ mode: "ecology" }).length,
        };

        set({ filteredPresets, modeCounts });
      },
    }),
    {
      name: "genesis-preset-store",
      partialize: (state) => ({
        favorites: state.favorites,
        recentPresets: state.recentPresets,
      }),
    },
  ),
);

// Initialize presets on load
if (typeof window !== "undefined") {
  setTimeout(() => {
    usePresetStore.getState().refreshPresets();
  }, 0);
}
