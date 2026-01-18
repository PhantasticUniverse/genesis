/**
 * Evaluate all reference organisms and output baseline fitness scores
 */
import { REFERENCE_ORGANISMS } from "../src/patterns/reference-organisms";
import { encodeGenome, type LeniaGenome } from "../src/discovery/genome";

// Parse b string (e.g., "1" -> [1.0], "1,1/3" -> [1.0, 0.333])
function parsePeaks(bString: string): number[] {
  return bString.split(",").map((peak) => {
    if (peak.includes("/")) {
      const [num, denom] = peak.split("/").map(Number);
      return num / denom;
    }
    return parseFloat(peak);
  });
}

// Convert reference organism to LeniaGenome
function toGenome(organism: (typeof REFERENCE_ORGANISMS)[0]): LeniaGenome {
  return {
    R: organism.params.R,
    T: organism.params.T,
    b: parsePeaks(organism.params.b),
    m: organism.params.m,
    s: organism.params.s,
    kn: organism.params.kn as 1 | 2 | 3 | 4,
    gn: organism.params.gn as 1 | 2 | 3,
  };
}

// Output all organisms with encoded genomes
console.log("=== Reference Organisms with Encoded Genomes ===\n");

for (const org of REFERENCE_ORGANISMS) {
  const genome = toGenome(org);
  const encoded = encodeGenome(genome);
  console.log(
    `${org.code.padEnd(6)} | ${org.name.padEnd(28)} | R=${genome.R.toString().padStart(2)} | m=${genome.m.toFixed(4)} | s=${genome.s.toFixed(4)} | encoded=${encoded}`,
  );
}

// Output JSON array of genomes for batch evaluation
console.log("\n\n=== JSON for batch evaluation ===\n");
const genomes = REFERENCE_ORGANISMS.map((org) => ({
  code: org.code,
  name: org.name,
  R: org.params.R,
  m: org.params.m,
  s: org.params.s,
  encoded: encodeGenome(toGenome(org)),
}));
console.log(JSON.stringify(genomes, null, 2));
