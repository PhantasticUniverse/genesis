/**
 * Spatial Hash Tests
 * Tests for spatial indexing used in creature tracking
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SpatialHash,
  createSpatialHash,
  type Positioned,
} from "../../agency/spatial-hash";

interface TestEntity extends Positioned {
  id: number;
  centroidX: number;
  centroidY: number;
}

function createEntity(id: number, x: number, y: number): TestEntity {
  return { id, centroidX: x, centroidY: y };
}

describe("spatial-hash", () => {
  describe("SpatialHash", () => {
    let hash: SpatialHash<TestEntity>;

    beforeEach(() => {
      hash = createSpatialHash(1000, 1000, 100);
    });

    describe("insert", () => {
      it("inserts entity", () => {
        const entity = createEntity(1, 50, 50);
        hash.insert(entity);

        expect(hash.getSize()).toBe(1);
      });

      it("does not duplicate same entity", () => {
        const entity = createEntity(1, 50, 50);
        hash.insert(entity);
        hash.insert(entity);

        expect(hash.getSize()).toBe(1);
      });

      it("handles multiple entities", () => {
        hash.insert(createEntity(1, 50, 50));
        hash.insert(createEntity(2, 150, 150));
        hash.insert(createEntity(3, 250, 250));

        expect(hash.getSize()).toBe(3);
      });

      it("handles entities at world boundaries", () => {
        hash.insert(createEntity(1, 0, 0));
        hash.insert(createEntity(2, 999, 999));
        hash.insert(createEntity(3, 0, 999));

        expect(hash.getSize()).toBe(3);
      });

      it("clamps out-of-bounds positions", () => {
        const entity = createEntity(1, -50, 1500);
        hash.insert(entity);

        expect(hash.getSize()).toBe(1);
        // Should still be retrievable
        const all = hash.getAll();
        expect(all).toContain(entity);
      });
    });

    describe("remove", () => {
      it("removes entity", () => {
        const entity = createEntity(1, 50, 50);
        hash.insert(entity);
        hash.remove(entity);

        expect(hash.getSize()).toBe(0);
      });

      it("returns true when entity removed", () => {
        const entity = createEntity(1, 50, 50);
        hash.insert(entity);

        expect(hash.remove(entity)).toBe(true);
      });

      it("returns false when entity not found", () => {
        const entity = createEntity(1, 50, 50);

        expect(hash.remove(entity)).toBe(false);
      });

      it("only removes specified entity", () => {
        const entity1 = createEntity(1, 50, 50);
        const entity2 = createEntity(2, 50, 50);
        hash.insert(entity1);
        hash.insert(entity2);
        hash.remove(entity1);

        expect(hash.getSize()).toBe(1);
        expect(hash.getAll()).toContain(entity2);
      });
    });

    describe("clear", () => {
      it("removes all entities", () => {
        hash.insert(createEntity(1, 50, 50));
        hash.insert(createEntity(2, 150, 150));
        hash.clear();

        expect(hash.getSize()).toBe(0);
        expect(hash.getAll()).toHaveLength(0);
      });
    });

    describe("rebuild", () => {
      it("replaces all entities", () => {
        hash.insert(createEntity(1, 50, 50));
        hash.insert(createEntity(2, 150, 150));

        const newEntities = [
          createEntity(3, 300, 300),
          createEntity(4, 400, 400),
          createEntity(5, 500, 500),
        ];

        hash.rebuild(newEntities);

        expect(hash.getSize()).toBe(3);
        expect(
          hash
            .getAll()
            .map((e) => e.id)
            .sort(),
        ).toEqual([3, 4, 5]);
      });
    });

    describe("queryRadius", () => {
      it("finds entities within radius", () => {
        hash.insert(createEntity(1, 100, 100));
        hash.insert(createEntity(2, 110, 110));
        hash.insert(createEntity(3, 500, 500));

        const results = hash.queryRadius(100, 100, 50);

        expect(results).toHaveLength(2);
        expect(results.map((e) => e.id).sort()).toEqual([1, 2]);
      });

      it("returns empty array when no entities in range", () => {
        hash.insert(createEntity(1, 100, 100));

        const results = hash.queryRadius(500, 500, 50);

        expect(results).toHaveLength(0);
      });

      it("handles entities at exact radius", () => {
        hash.insert(createEntity(1, 100, 100));
        hash.insert(createEntity(2, 150, 100)); // Exactly 50 units away

        const results = hash.queryRadius(100, 100, 50);

        expect(results).toHaveLength(2);
      });

      it("handles large radius spanning multiple cells", () => {
        hash.insert(createEntity(1, 100, 100));
        hash.insert(createEntity(2, 300, 300));
        hash.insert(createEntity(3, 500, 500));

        const results = hash.queryRadius(300, 300, 300);

        expect(results).toHaveLength(3);
      });
    });

    describe("queryRect", () => {
      it("finds entities in rectangle", () => {
        hash.insert(createEntity(1, 100, 100));
        hash.insert(createEntity(2, 150, 150));
        hash.insert(createEntity(3, 500, 500));

        const results = hash.queryRect(50, 50, 200, 200);

        expect(results).toHaveLength(2);
        expect(results.map((e) => e.id).sort()).toEqual([1, 2]);
      });

      it("handles entities on boundary", () => {
        hash.insert(createEntity(1, 100, 100));

        const results = hash.queryRect(100, 100, 200, 200);

        expect(results).toHaveLength(1);
      });
    });

    describe("findNearest", () => {
      it("finds nearest entity", () => {
        hash.insert(createEntity(1, 100, 100));
        hash.insert(createEntity(2, 200, 200));
        hash.insert(createEntity(3, 150, 150));

        const nearest = hash.findNearest(145, 145);

        expect(nearest?.id).toBe(3);
      });

      it("returns null when no entities", () => {
        const nearest = hash.findNearest(100, 100);

        expect(nearest).toBeNull();
      });

      it("respects maxDistance", () => {
        hash.insert(createEntity(1, 100, 100));
        hash.insert(createEntity(2, 500, 500));

        const nearest = hash.findNearest(450, 450, 100);

        expect(nearest?.id).toBe(2);
      });

      it("returns null when all entities outside maxDistance", () => {
        hash.insert(createEntity(1, 100, 100));

        const nearest = hash.findNearest(500, 500, 50);

        expect(nearest).toBeNull();
      });
    });

    describe("findKNearest", () => {
      it("finds k nearest entities", () => {
        hash.insert(createEntity(1, 100, 100));
        hash.insert(createEntity(2, 110, 110));
        hash.insert(createEntity(3, 200, 200));
        hash.insert(createEntity(4, 500, 500));

        const nearest = hash.findKNearest(100, 100, 2);

        expect(nearest).toHaveLength(2);
        expect(nearest[0].id).toBe(1); // Closest
        expect(nearest[1].id).toBe(2); // Second closest
      });

      it("returns all when k > size", () => {
        hash.insert(createEntity(1, 100, 100));
        hash.insert(createEntity(2, 200, 200));

        const nearest = hash.findKNearest(100, 100, 10);

        expect(nearest).toHaveLength(2);
      });

      it("returns empty array when no entities", () => {
        const nearest = hash.findKNearest(100, 100, 5);

        expect(nearest).toHaveLength(0);
      });
    });

    describe("getAll", () => {
      it("returns all entities", () => {
        hash.insert(createEntity(1, 100, 100));
        hash.insert(createEntity(2, 200, 200));
        hash.insert(createEntity(3, 300, 300));

        const all = hash.getAll();

        expect(all).toHaveLength(3);
        expect(all.map((e) => e.id).sort()).toEqual([1, 2, 3]);
      });

      it("returns empty array when no entities", () => {
        expect(hash.getAll()).toHaveLength(0);
      });
    });
  });

  describe("createSpatialHash", () => {
    it("creates hash with default cell size", () => {
      const hash = createSpatialHash<TestEntity>(1000, 1000);
      expect(hash).toBeInstanceOf(SpatialHash);
    });

    it("creates hash with custom cell size", () => {
      const hash = createSpatialHash<TestEntity>(1000, 1000, 25);
      expect(hash).toBeInstanceOf(SpatialHash);
    });
  });

  describe("performance characteristics", () => {
    it("handles large number of entities", () => {
      const hash = createSpatialHash<TestEntity>(10000, 10000, 100);

      // Insert 10000 entities
      for (let i = 0; i < 10000; i++) {
        hash.insert(
          createEntity(i, Math.random() * 10000, Math.random() * 10000),
        );
      }

      expect(hash.getSize()).toBe(10000);

      // Query should still be fast
      const results = hash.queryRadius(5000, 5000, 500);
      expect(results.length).toBeGreaterThan(0);
    });

    it("provides better than O(n) for localized queries", () => {
      const hash = createSpatialHash<TestEntity>(1000, 1000, 50);

      // Create 1000 entities spread across the world
      for (let i = 0; i < 1000; i++) {
        hash.insert(
          createEntity(i, Math.random() * 1000, Math.random() * 1000),
        );
      }

      // Small radius query should not return all entities
      const results = hash.queryRadius(500, 500, 50);

      // With uniform distribution, expect roughly (π * 50² / 1000²) * 1000 ≈ 7.85 entities
      // Allow for variance, but should definitely be << 1000
      expect(results.length).toBeLessThan(100);
    });
  });
});
