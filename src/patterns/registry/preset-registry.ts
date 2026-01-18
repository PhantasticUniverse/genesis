/**
 * Unified Preset Registry
 * Central registry for managing presets across all simulation modes
 */

import type {
  PresetData,
  PresetMetadata,
  PresetConfig,
  PresetMode,
  PresetCategory,
  PresetQueryOptions,
  PresetCollection,
  UserPresetStore,
  GenesisPresetFile,
  ImportResult,
  ValidationResult,
} from "./preset-types";
import { validatePresetConfig, createDefaultMetadata } from "./preset-types";
import { ALL_BUILTIN_PRESETS } from "./builtin-presets";

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  USER_PRESETS: "genesis:user_presets",
  FAVORITES: "genesis:favorites",
  RECENT: "genesis:recent",
  COLLECTIONS: "genesis:collections",
} as const;

const MAX_RECENT = 20;

// ============================================================================
// Preset Registry Implementation
// ============================================================================

/**
 * Preset Registry - manages all presets in the system
 */
export class PresetRegistry {
  private builtinPresets: Map<string, PresetData> = new Map();
  private userPresets: Map<string, PresetData> = new Map();
  private favorites: Set<string> = new Set();
  private recent: string[] = [];
  private collections: Map<string, PresetCollection> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Load builtin presets
    this.registerBuiltins(ALL_BUILTIN_PRESETS);
    // Load user data from storage
    this.loadFromStorage();
  }

  // ==========================================================================
  // Builtin Preset Management
  // ==========================================================================

  /**
   * Register a builtin preset
   */
  registerBuiltin(preset: PresetData): void {
    this.builtinPresets.set(preset.metadata.id, preset);
  }

  /**
   * Register multiple builtin presets
   */
  registerBuiltins(presets: PresetData[]): void {
    for (const preset of presets) {
      this.registerBuiltin(preset);
    }
  }

  /**
   * Unregister a builtin preset
   */
  unregisterBuiltin(id: string): boolean {
    return this.builtinPresets.delete(id);
  }

  // ==========================================================================
  // User Preset Management
  // ==========================================================================

  /**
   * Create a new user preset
   */
  createPreset(
    name: string,
    mode: PresetMode,
    category: PresetCategory,
    config: PresetConfig,
    options: { description?: string; tags?: string[]; author?: string } = {},
  ): PresetData {
    const metadata = createDefaultMetadata(
      name,
      mode,
      category,
      options.author,
    );
    metadata.description = options.description ?? "";
    metadata.tags = options.tags ?? [];

    const preset: PresetData = {
      metadata,
      config,
    };

    this.userPresets.set(preset.metadata.id, preset);
    this.saveToStorage();
    this.notifyListeners();

    return preset;
  }

  /**
   * Update an existing user preset
   */
  updatePreset(
    id: string,
    updates: Partial<Omit<PresetData, "metadata">> & {
      metadata?: Partial<Omit<PresetMetadata, "id" | "createdAt">>;
    },
  ): boolean {
    const preset = this.userPresets.get(id);
    if (!preset) return false;

    if (updates.metadata) {
      Object.assign(preset.metadata, updates.metadata);
      preset.metadata.updatedAt = Date.now();
    }
    if (updates.config) {
      preset.config = updates.config;
    }
    if (updates.initialPattern !== undefined) {
      preset.initialPattern = updates.initialPattern;
    }
    if (updates.genome !== undefined) {
      preset.genome = updates.genome;
    }

    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  /**
   * Delete a user preset
   */
  deletePreset(id: string): boolean {
    if (!this.userPresets.has(id)) return false;

    this.userPresets.delete(id);
    this.favorites.delete(id);
    this.recent = this.recent.filter((r) => r !== id);

    // Remove from collections
    for (const collection of this.collections.values()) {
      collection.presetIds = collection.presetIds.filter((pid) => pid !== id);
    }

    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  // ==========================================================================
  // Preset Retrieval
  // ==========================================================================

  /**
   * Get a preset by ID
   */
  getPreset(id: string): PresetData | null {
    return this.builtinPresets.get(id) ?? this.userPresets.get(id) ?? null;
  }

  /**
   * Get all presets (builtin + user)
   */
  getAllPresets(): PresetData[] {
    return [
      ...Array.from(this.builtinPresets.values()),
      ...Array.from(this.userPresets.values()),
    ];
  }

  /**
   * Get builtin presets only
   */
  getBuiltinPresets(): PresetData[] {
    return Array.from(this.builtinPresets.values());
  }

  /**
   * Get user presets only
   */
  getUserPresets(): PresetData[] {
    return Array.from(this.userPresets.values());
  }

  /**
   * Query presets with filters
   */
  queryPresets(options: PresetQueryOptions): PresetData[] {
    let presets = this.getAllPresets();

    // Filter by mode
    if (options.mode) {
      presets = presets.filter((p) => p.metadata.mode === options.mode);
    }

    // Filter by category
    if (options.category) {
      presets = presets.filter((p) => p.metadata.category === options.category);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      presets = presets.filter((p) =>
        options.tags!.some((tag) => p.metadata.tags.includes(tag)),
      );
    }

    // Filter by difficulty
    if (options.minDifficulty !== undefined) {
      presets = presets.filter(
        (p) => p.metadata.difficulty >= options.minDifficulty!,
      );
    }
    if (options.maxDifficulty !== undefined) {
      presets = presets.filter(
        (p) => p.metadata.difficulty <= options.maxDifficulty!,
      );
    }

    // Filter by behavior
    if (options.behavior) {
      const behaviorFilters = Object.entries(options.behavior);
      presets = presets.filter((p) =>
        behaviorFilters.every(
          ([key, value]) =>
            p.metadata.behavior[key as keyof typeof p.metadata.behavior] ===
            value,
        ),
      );
    }

    // Filter by verified
    if (options.verified !== undefined) {
      presets = presets.filter((p) => p.metadata.verified === options.verified);
    }

    // Search
    if (options.search) {
      const search = options.search.toLowerCase();
      presets = presets.filter(
        (p) =>
          p.metadata.name.toLowerCase().includes(search) ||
          p.metadata.description.toLowerCase().includes(search) ||
          p.metadata.tags.some((t) => t.toLowerCase().includes(search)),
      );
    }

    // Sort
    const sortBy = options.sortBy ?? "name";
    const sortOrder = options.sortOrder ?? "asc";
    presets.sort((a, b) => {
      let cmp: number;
      switch (sortBy) {
        case "name":
          cmp = a.metadata.name.localeCompare(b.metadata.name);
          break;
        case "popularity":
          cmp = a.metadata.popularity - b.metadata.popularity;
          break;
        case "rating":
          cmp = a.metadata.rating - b.metadata.rating;
          break;
        case "createdAt":
          cmp = a.metadata.createdAt - b.metadata.createdAt;
          break;
        case "updatedAt":
          cmp = a.metadata.updatedAt - b.metadata.updatedAt;
          break;
        default:
          cmp = 0;
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });

    // Pagination
    if (options.offset) {
      presets = presets.slice(options.offset);
    }
    if (options.limit) {
      presets = presets.slice(0, options.limit);
    }

    return presets;
  }

  /**
   * Get presets by mode
   */
  getPresetsByMode(mode: PresetMode): PresetData[] {
    return this.queryPresets({ mode });
  }

  /**
   * Get preset count by mode
   */
  getPresetCountByMode(): Record<PresetMode, number> {
    const counts: Record<PresetMode, number> = {
      discrete: 0,
      continuous: 0,
      multikernel: 0,
      "3d": 0,
      particle: 0,
      ecology: 0,
    };

    for (const preset of this.getAllPresets()) {
      counts[preset.metadata.mode]++;
    }

    return counts;
  }

  // ==========================================================================
  // Favorites
  // ==========================================================================

  /**
   * Add to favorites
   */
  addFavorite(id: string): boolean {
    if (!this.getPreset(id)) return false;
    this.favorites.add(id);
    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  /**
   * Remove from favorites
   */
  removeFavorite(id: string): boolean {
    const removed = this.favorites.delete(id);
    if (removed) {
      this.saveToStorage();
      this.notifyListeners();
    }
    return removed;
  }

  /**
   * Toggle favorite status
   */
  toggleFavorite(id: string): boolean {
    if (this.favorites.has(id)) {
      this.removeFavorite(id);
      return false;
    } else {
      this.addFavorite(id);
      return true;
    }
  }

  /**
   * Check if preset is favorite
   */
  isFavorite(id: string): boolean {
    return this.favorites.has(id);
  }

  /**
   * Get all favorites
   */
  getFavorites(): PresetData[] {
    return Array.from(this.favorites)
      .map((id) => this.getPreset(id))
      .filter((p): p is PresetData => p !== null);
  }

  // ==========================================================================
  // Recent
  // ==========================================================================

  /**
   * Add to recent
   */
  addRecent(id: string): void {
    // Remove if already exists
    this.recent = this.recent.filter((r) => r !== id);
    // Add to front
    this.recent.unshift(id);
    // Trim to max
    if (this.recent.length > MAX_RECENT) {
      this.recent = this.recent.slice(0, MAX_RECENT);
    }
    this.saveToStorage();
  }

  /**
   * Get recent presets
   */
  getRecent(limit = 10): PresetData[] {
    return this.recent
      .slice(0, limit)
      .map((id) => this.getPreset(id))
      .filter((p): p is PresetData => p !== null);
  }

  // ==========================================================================
  // Collections
  // ==========================================================================

  /**
   * Create a collection
   */
  createCollection(name: string, description = ""): PresetCollection {
    const collection: PresetCollection = {
      id: `coll_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      description,
      presetIds: [],
      isPublic: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.collections.set(collection.id, collection);
    this.saveToStorage();
    this.notifyListeners();
    return collection;
  }

  /**
   * Get a collection by ID
   */
  getCollection(id: string): PresetCollection | null {
    return this.collections.get(id) ?? null;
  }

  /**
   * Get all collections
   */
  getCollections(): PresetCollection[] {
    return Array.from(this.collections.values());
  }

  /**
   * Add preset to collection
   */
  addToCollection(collectionId: string, presetId: string): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection || !this.getPreset(presetId)) return false;

    if (!collection.presetIds.includes(presetId)) {
      collection.presetIds.push(presetId);
      collection.updatedAt = Date.now();
      this.saveToStorage();
      this.notifyListeners();
    }
    return true;
  }

  /**
   * Remove preset from collection
   */
  removeFromCollection(collectionId: string, presetId: string): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;

    const index = collection.presetIds.indexOf(presetId);
    if (index === -1) return false;

    collection.presetIds.splice(index, 1);
    collection.updatedAt = Date.now();
    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  /**
   * Delete a collection
   */
  deleteCollection(id: string): boolean {
    const deleted = this.collections.delete(id);
    if (deleted) {
      this.saveToStorage();
      this.notifyListeners();
    }
    return deleted;
  }

  /**
   * Get presets in a collection
   */
  getCollectionPresets(id: string): PresetData[] {
    const collection = this.collections.get(id);
    if (!collection) return [];

    return collection.presetIds
      .map((pid) => this.getPreset(pid))
      .filter((p): p is PresetData => p !== null);
  }

  // ==========================================================================
  // Import/Export
  // ==========================================================================

  /**
   * Export presets as GenesisPresetFile
   */
  exportPresets(ids: string[]): GenesisPresetFile {
    const presets = ids
      .map((id) => this.getPreset(id))
      .filter((p): p is PresetData => p !== null);

    return {
      version: "1.0",
      type: "preset",
      presets,
      metadata: {
        exportedAt: Date.now(),
        exportedBy: "User",
        genesisVersion: "1.0.0",
      },
    };
  }

  /**
   * Export all user presets
   */
  exportAllUserPresets(): GenesisPresetFile {
    return this.exportPresets(Array.from(this.userPresets.keys()));
  }

  /**
   * Import presets from GenesisPresetFile
   */
  importPresets(file: GenesisPresetFile): ImportResult {
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: [],
      presetIds: [],
    };

    if (file.version !== "1.0") {
      result.success = false;
      result.errors.push(`Unsupported version: ${file.version}`);
      return result;
    }

    for (const preset of file.presets) {
      // Validate
      const validation = this.validatePreset(preset);
      if (!validation.valid) {
        result.errors.push(
          `${preset.metadata.name}: ${validation.errors.join(", ")}`,
        );
        result.skipped++;
        continue;
      }

      // Check for duplicate ID
      if (this.getPreset(preset.metadata.id)) {
        // Generate new ID
        preset.metadata.id = `preset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      }

      this.userPresets.set(preset.metadata.id, preset);
      result.presetIds.push(preset.metadata.id);
      result.imported++;
    }

    if (result.imported > 0) {
      this.saveToStorage();
      this.notifyListeners();
    }

    return result;
  }

  /**
   * Validate a preset
   */
  validatePreset(preset: PresetData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate metadata
    if (!preset.metadata.id) {
      errors.push("Missing preset ID");
    }
    if (!preset.metadata.name) {
      errors.push("Missing preset name");
    }
    if (!preset.metadata.mode) {
      errors.push("Missing preset mode");
    }

    // Validate config
    const configValidation = validatePresetConfig(preset.config);
    errors.push(...configValidation.errors);
    warnings.push(...configValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==========================================================================
  // Storage
  // ==========================================================================

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      // User presets
      const presetsData = localStorage.getItem(STORAGE_KEYS.USER_PRESETS);
      if (presetsData) {
        const presets = JSON.parse(presetsData) as PresetData[];
        for (const preset of presets) {
          this.userPresets.set(preset.metadata.id, preset);
        }
      }

      // Favorites
      const favoritesData = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (favoritesData) {
        const favorites = JSON.parse(favoritesData) as string[];
        this.favorites = new Set(favorites);
      }

      // Recent
      const recentData = localStorage.getItem(STORAGE_KEYS.RECENT);
      if (recentData) {
        this.recent = JSON.parse(recentData) as string[];
      }

      // Collections
      const collectionsData = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
      if (collectionsData) {
        const collections = JSON.parse(collectionsData) as PresetCollection[];
        for (const coll of collections) {
          this.collections.set(coll.id, coll);
        }
      }
    } catch (error) {
      console.error("Failed to load preset registry from storage:", error);
    }
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.USER_PRESETS,
        JSON.stringify(Array.from(this.userPresets.values())),
      );
      localStorage.setItem(
        STORAGE_KEYS.FAVORITES,
        JSON.stringify(Array.from(this.favorites)),
      );
      localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(this.recent));
      localStorage.setItem(
        STORAGE_KEYS.COLLECTIONS,
        JSON.stringify(Array.from(this.collections.values())),
      );
    } catch (error) {
      console.error("Failed to save preset registry to storage:", error);
    }
  }

  // ==========================================================================
  // Listeners
  // ==========================================================================

  /**
   * Subscribe to changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error("Preset registry listener error:", error);
      }
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get registry statistics
   */
  getStats(): {
    totalPresets: number;
    builtinPresets: number;
    userPresets: number;
    favorites: number;
    collections: number;
    byMode: Record<PresetMode, number>;
  } {
    return {
      totalPresets: this.builtinPresets.size + this.userPresets.size,
      builtinPresets: this.builtinPresets.size,
      userPresets: this.userPresets.size,
      favorites: this.favorites.size,
      collections: this.collections.size,
      byMode: this.getPresetCountByMode(),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let registryInstance: PresetRegistry | null = null;

/**
 * Get the singleton preset registry instance
 */
export function getPresetRegistry(): PresetRegistry {
  if (!registryInstance) {
    registryInstance = new PresetRegistry();
  }
  return registryInstance;
}

/**
 * Reset the registry (for testing)
 */
export function resetPresetRegistry(): void {
  registryInstance = null;
}

/**
 * Default preset registry instance
 * Use this for direct access to the registry
 */
export const presetRegistry = getPresetRegistry();
