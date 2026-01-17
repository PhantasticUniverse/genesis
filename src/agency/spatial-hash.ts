/**
 * Spatial Hash Grid
 * Efficient spatial indexing for creature tracking and collision detection
 *
 * Features:
 * - O(1) average insertion/removal
 * - O(1) average query for nearby entities
 * - Configurable cell size for different use cases
 */

export interface Positioned {
  centroidX: number;
  centroidY: number;
}

export interface SpatialHashConfig {
  /** Width of the world */
  worldWidth: number;
  /** Height of the world */
  worldHeight: number;
  /** Size of each grid cell */
  cellSize: number;
}

/**
 * Spatial Hash Grid for efficient spatial queries
 */
export class SpatialHash<T extends Positioned> {
  private readonly cellSize: number;
  private readonly numCellsX: number;
  private readonly numCellsY: number;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly cells: Map<number, Set<T>>;
  private size = 0;

  constructor(config: SpatialHashConfig) {
    this.worldWidth = config.worldWidth;
    this.worldHeight = config.worldHeight;
    this.cellSize = config.cellSize;
    this.numCellsX = Math.ceil(config.worldWidth / config.cellSize);
    this.numCellsY = Math.ceil(config.worldHeight / config.cellSize);
    this.cells = new Map();
  }

  /**
   * Get the cell key for a position
   */
  private getCellKey(x: number, y: number): number {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    // Clamp to valid range
    const clampedX = Math.max(0, Math.min(this.numCellsX - 1, cellX));
    const clampedY = Math.max(0, Math.min(this.numCellsY - 1, cellY));
    return clampedY * this.numCellsX + clampedX;
  }

  /**
   * Insert an entity into the hash
   */
  insert(entity: T): void {
    const key = this.getCellKey(entity.centroidX, entity.centroidY);
    let cell = this.cells.get(key);

    if (!cell) {
      cell = new Set();
      this.cells.set(key, cell);
    }

    if (!cell.has(entity)) {
      cell.add(entity);
      this.size++;
    }
  }

  /**
   * Remove an entity from the hash
   */
  remove(entity: T): boolean {
    const key = this.getCellKey(entity.centroidX, entity.centroidY);
    const cell = this.cells.get(key);

    if (cell && cell.delete(entity)) {
      this.size--;
      if (cell.size === 0) {
        this.cells.delete(key);
      }
      return true;
    }

    return false;
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.cells.clear();
    this.size = 0;
  }

  /**
   * Rebuild the hash from an array of entities
   */
  rebuild(entities: Iterable<T>): void {
    this.clear();
    for (const entity of entities) {
      this.insert(entity);
    }
  }

  /**
   * Get number of entities in the hash
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Query entities within a radius of a point
   */
  queryRadius(x: number, y: number, radius: number): T[] {
    const results: T[] = [];
    const radiusSq = radius * radius;

    // Calculate cell range to check
    const minCellX = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCellX = Math.min(
      this.numCellsX - 1,
      Math.floor((x + radius) / this.cellSize),
    );
    const minCellY = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxCellY = Math.min(
      this.numCellsY - 1,
      Math.floor((y + radius) / this.cellSize),
    );

    // Check all cells in range
    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const key = cellY * this.numCellsX + cellX;
        const cell = this.cells.get(key);

        if (cell) {
          for (const entity of cell) {
            const dx = entity.centroidX - x;
            const dy = entity.centroidY - y;
            const distSq = dx * dx + dy * dy;

            if (distSq <= radiusSq) {
              results.push(entity);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Query entities in a rectangular region
   */
  queryRect(minX: number, minY: number, maxX: number, maxY: number): T[] {
    const results: T[] = [];

    // Calculate cell range to check
    const minCellX = Math.max(0, Math.floor(minX / this.cellSize));
    const maxCellX = Math.min(
      this.numCellsX - 1,
      Math.floor(maxX / this.cellSize),
    );
    const minCellY = Math.max(0, Math.floor(minY / this.cellSize));
    const maxCellY = Math.min(
      this.numCellsY - 1,
      Math.floor(maxY / this.cellSize),
    );

    // Check all cells in range
    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const key = cellY * this.numCellsX + cellX;
        const cell = this.cells.get(key);

        if (cell) {
          for (const entity of cell) {
            if (
              entity.centroidX >= minX &&
              entity.centroidX <= maxX &&
              entity.centroidY >= minY &&
              entity.centroidY <= maxY
            ) {
              results.push(entity);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Find the nearest entity to a point
   */
  findNearest(x: number, y: number, maxDistance?: number): T | null {
    const searchRadius =
      maxDistance ?? Math.max(this.worldWidth, this.worldHeight);
    let nearest: T | null = null;
    let minDistSq = searchRadius * searchRadius;

    // Start with nearby cells and expand if needed
    let currentRadius = this.cellSize;

    while (currentRadius <= searchRadius) {
      const candidates = this.queryRadius(x, y, currentRadius);

      for (const entity of candidates) {
        const dx = entity.centroidX - x;
        const dy = entity.centroidY - y;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistSq) {
          minDistSq = distSq;
          nearest = entity;
        }
      }

      // If we found something in this radius, we're done
      if (nearest !== null) {
        break;
      }

      // Expand search radius
      currentRadius *= 2;
    }

    return nearest;
  }

  /**
   * Find k nearest entities to a point
   */
  findKNearest(x: number, y: number, k: number, maxDistance?: number): T[] {
    const searchRadius =
      maxDistance ?? Math.max(this.worldWidth, this.worldHeight);
    const candidates = this.queryRadius(x, y, searchRadius);

    // Sort by distance
    const sorted = candidates
      .map((entity) => {
        const dx = entity.centroidX - x;
        const dy = entity.centroidY - y;
        return { entity, distSq: dx * dx + dy * dy };
      })
      .sort((a, b) => a.distSq - b.distSq);

    return sorted.slice(0, k).map((item) => item.entity);
  }

  /**
   * Get all entities in the hash
   */
  getAll(): T[] {
    const results: T[] = [];
    for (const cell of this.cells.values()) {
      for (const entity of cell) {
        results.push(entity);
      }
    }
    return results;
  }
}

/**
 * Create a spatial hash grid
 */
export function createSpatialHash<T extends Positioned>(
  worldWidth: number,
  worldHeight: number,
  cellSize: number = 50,
): SpatialHash<T> {
  return new SpatialHash({ worldWidth, worldHeight, cellSize });
}
