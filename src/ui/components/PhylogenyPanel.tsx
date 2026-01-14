/**
 * Phylogeny Panel Component
 * Visualizes evolutionary tree from genetic algorithm
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { GAController } from '../../discovery/genetic-algorithm';
import type { PhyloTree, PhyloNode } from '../../discovery/phylogeny';
import { genomeToParams, type LeniaGenome } from '../../discovery/genome';

interface PhylogenyPanelProps {
  gaController: GAController | null;
  onSelectOrganism?: (params: ReturnType<typeof genomeToParams>, genome: LeniaGenome) => void;
}

export function PhylogenyPanel({ gaController, onSelectOrganism }: PhylogenyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ x: -200, y: -20, w: 400, h: 300 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Get tree data
  const tree = gaController?.getPhyloTree();
  const stats = gaController?.getPhyloStats();

  // Calculate view bounds when tree changes
  useEffect(() => {
    if (!tree || tree.nodes.size === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const node of tree.nodes.values()) {
      if (node.x !== undefined && node.y !== undefined) {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      }
    }

    if (minX !== Infinity) {
      const padding = 50;
      setViewBox({
        x: minX - padding,
        y: minY - padding,
        w: Math.max(400, maxX - minX + padding * 2),
        h: Math.max(200, maxY - minY + padding * 2),
      });
    }
  }, [tree?.generations, tree?.totalNodes]);

  // Handle node click
  const handleNodeClick = useCallback((node: PhyloNode) => {
    setSelectedNodeId(node.id);

    if (onSelectOrganism) {
      const params = genomeToParams(node.genome);
      onSelectOrganism(params, node.genome);
    }
  }, [onSelectOrganism]);

  // Pan handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const dx = (e.clientX - dragStart.x) * (viewBox.w / 400);
      const dy = (e.clientY - dragStart.y) * (viewBox.h / 300);
      setViewBox(v => ({ ...v, x: v.x - dx, y: v.y - dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, dragStart, viewBox]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Zoom handling
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(v => ({
      x: v.x + v.w * (1 - scale) / 2,
      y: v.y + v.h * (1 - scale) / 2,
      w: v.w * scale,
      h: v.h * scale,
    }));
  }, []);

  // Get node color based on fitness/novelty
  const getNodeColor = useCallback((node: PhyloNode) => {
    if (node.isArchived) return '#a855f7'; // Purple for archived
    if (node.isAlive) {
      // Color by fitness (green gradient)
      const f = Math.min(1, node.fitness / (tree?.maxFitness || 1));
      const r = Math.round(50 + (1 - f) * 150);
      const g = Math.round(100 + f * 155);
      const b = Math.round(50 + (1 - f) * 100);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return '#52525b'; // Zinc for dead
  }, [tree?.maxFitness]);

  // Get edge color
  const getEdgeColor = useCallback((type: string) => {
    switch (type) {
      case 'elite': return '#fbbf24'; // Amber
      case 'crossover': return '#3b82f6'; // Blue
      default: return '#6b7280'; // Gray
    }
  }, []);

  // Render nodes
  const nodeElements = useMemo(() => {
    if (!tree) return null;

    return Array.from(tree.nodes.values()).map(node => {
      if (node.x === undefined || node.y === undefined) return null;

      const isSelected = node.id === selectedNodeId;
      const radius = isSelected ? 8 : node.isAlive ? 6 : 4;

      return (
        <g key={node.id} onClick={() => handleNodeClick(node)} style={{ cursor: 'pointer' }}>
          <circle
            cx={node.x}
            cy={node.y}
            r={radius}
            fill={getNodeColor(node)}
            stroke={isSelected ? '#fff' : 'none'}
            strokeWidth={2}
          />
          {isSelected && (
            <text
              x={node.x}
              y={node.y - 12}
              textAnchor="middle"
              fill="#fff"
              fontSize="8"
            >
              Gen {node.generation}
            </text>
          )}
        </g>
      );
    });
  }, [tree, selectedNodeId, handleNodeClick, getNodeColor]);

  // Render edges
  const edgeElements = useMemo(() => {
    if (!tree) return null;

    return tree.edges.map((edge, idx) => {
      const source = tree.nodes.get(edge.sourceId);
      const target = tree.nodes.get(edge.targetId);

      if (!source || !target) return null;
      if (source.x === undefined || source.y === undefined) return null;
      if (target.x === undefined || target.y === undefined) return null;

      return (
        <line
          key={idx}
          x1={source.x}
          y1={source.y}
          x2={target.x}
          y2={target.y}
          stroke={getEdgeColor(edge.type)}
          strokeWidth={1}
          strokeOpacity={0.5}
        />
      );
    });
  }, [tree, getEdgeColor]);

  // Selected node info
  const selectedNode = selectedNodeId && tree ? tree.nodes.get(selectedNodeId) : null;

  if (!gaController) return null;

  return (
    <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-purple-400">Phylogenetic Tree</h3>
          {stats && (
            <span className="px-1.5 py-0.5 text-xs bg-purple-600/30 text-purple-300 rounded">
              {stats.totalNodes} nodes
            </span>
          )}
        </div>
        <span className="text-zinc-500">{isExpanded ? '−' : '+'}</span>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Description */}
          <p className="text-xs text-zinc-500">
            Visualize evolutionary lineage. Click on nodes to load organisms.
            Scroll to zoom, drag to pan.
          </p>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-zinc-800 rounded">
                <div className="text-zinc-500">Generations</div>
                <div className="text-zinc-300 font-mono">{stats.generations}</div>
              </div>
              <div className="p-2 bg-zinc-800 rounded">
                <div className="text-zinc-500">Alive</div>
                <div className="text-green-400 font-mono">{stats.aliveCount}</div>
              </div>
              <div className="p-2 bg-zinc-800 rounded">
                <div className="text-zinc-500">Archived</div>
                <div className="text-purple-400 font-mono">{stats.archivedCount}</div>
              </div>
            </div>
          )}

          {/* Tree visualization */}
          <div className="relative bg-zinc-950 rounded-lg overflow-hidden" style={{ height: 250 }}>
            {tree && tree.nodes.size > 0 ? (
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                {/* Edges first (behind nodes) */}
                <g>{edgeElements}</g>
                {/* Nodes on top */}
                <g>{nodeElements}</g>
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                Run the genetic algorithm to see the phylogenetic tree
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-zinc-500">High fitness</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-zinc-500">Archived</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-zinc-500" />
              <span className="text-zinc-500">Dead</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5 bg-amber-500" />
              <span className="text-zinc-500">Elite</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5 bg-blue-500" />
              <span className="text-zinc-500">Crossover</span>
            </div>
          </div>

          {/* Selected node info */}
          {selectedNode && (
            <div className="p-3 bg-zinc-800 rounded text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Node ID</span>
                <span className="font-mono text-zinc-300">{selectedNode.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Generation</span>
                <span className="font-mono text-zinc-300">{selectedNode.generation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Fitness</span>
                <span className="font-mono text-green-400">{selectedNode.fitness.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Novelty</span>
                <span className="font-mono text-purple-400">{selectedNode.novelty.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Parents</span>
                <span className="font-mono text-zinc-300">
                  {selectedNode.parentIds.length > 0 ? selectedNode.parentIds.join(', ') : 'None (root)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Children</span>
                <span className="font-mono text-zinc-300">{selectedNode.childIds.length}</span>
              </div>

              {/* Genome params */}
              <div className="pt-2 border-t border-zinc-700">
                <div className="text-zinc-400 mb-1">Genome Parameters</div>
                <div className="grid grid-cols-2 gap-1 text-zinc-500">
                  <span>R: {selectedNode.genome.R}</span>
                  <span>T: {selectedNode.genome.T}</span>
                  <span>m: {selectedNode.genome.m.toFixed(3)}</span>
                  <span>s: {selectedNode.genome.s.toFixed(3)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-zinc-600">
            <p>The tree shows evolutionary relationships between organisms.</p>
            <p className="mt-1">Vertical axis = generations, horizontal = diversity.</p>
          </div>
        </div>
      )}
    </div>
  );
}
