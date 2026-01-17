/**
 * Experiment Analysis Module
 * High-level statistical analysis for comparing experimental conditions
 */

import {
  mean,
  std,
  median,
  percentile,
  summarize,
  mannWhitneyU,
  kruskalWallis,
  cohensD,
  hedgesG,
  cliffsDelta,
  bootstrapCI,
  bootstrapBCaCI,
  bonferroniCorrection,
  holmCorrection,
  benjaminiHochbergCorrection,
  type ConfidenceInterval,
  type EffectSize,
  type TestResult,
} from "./statistics";

/**
 * Experimental condition with labeled samples
 */
export interface ExperimentCondition {
  name: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Pairwise comparison result
 */
export interface PairwiseComparison {
  condition1: string;
  condition2: string;
  test: TestResult;
  effectSize: EffectSize;
  meanDifference: number;
  meanDifferenceCI: ConfidenceInterval;
}

/**
 * Full experiment comparison result
 */
export interface ExperimentComparison {
  /** Omnibus test result (Kruskal-Wallis for 3+ groups, Mann-Whitney for 2) */
  omnibusTest: TestResult;

  /** Pairwise comparisons (if omnibus is significant) */
  pairwiseComparisons?: PairwiseComparison[];

  /** Corrected p-values for multiple comparisons */
  correctedPValues?: {
    bonferroni: number[];
    holm: number[];
    benjaminiHochberg: number[];
  };

  /** Condition summaries */
  conditionSummaries: Array<{
    name: string;
    n: number;
    mean: number;
    std: number;
    median: number;
    ci95: ConfidenceInterval;
  }>;

  /** Best performing condition(s) */
  bestConditions: string[];

  /** Effect size summary */
  overallEffectSize?: string;
}

/**
 * Compare multiple experimental conditions
 */
export function compareConditions(
  conditions: ExperimentCondition[],
  options: {
    alpha?: number;
    correctionMethod?: "bonferroni" | "holm" | "benjamini-hochberg";
    effectSizeMethod?: "cohens-d" | "hedges-g" | "cliffs-delta";
    higherIsBetter?: boolean;
  } = {},
): ExperimentComparison {
  const {
    alpha = 0.05,
    correctionMethod = "holm",
    effectSizeMethod = "hedges-g",
    higherIsBetter = true,
  } = options;

  // Compute condition summaries
  const conditionSummaries = conditions.map((c) => {
    const summary = summarize(c.values);
    return {
      name: c.name,
      n: summary.n,
      mean: summary.mean,
      std: summary.std,
      median: summary.median,
      ci95: summary.ci95,
    };
  });

  // Determine best conditions
  const sortedConditions = [...conditionSummaries].sort((a, b) =>
    higherIsBetter ? b.mean - a.mean : a.mean - b.mean,
  );
  const bestMean = sortedConditions[0].mean;
  const bestConditions = sortedConditions
    .filter((c) => {
      const tolerance = sortedConditions[0].std * 0.1;
      return Math.abs(c.mean - bestMean) <= tolerance;
    })
    .map((c) => c.name);

  // Omnibus test
  const groups = conditions.map((c) => c.values);
  const omnibusTest =
    groups.length === 2
      ? mannWhitneyU(groups[0], groups[1], alpha)
      : kruskalWallis(groups, alpha);

  // Early return if not significant
  if (!omnibusTest.significant) {
    return {
      omnibusTest,
      conditionSummaries,
      bestConditions,
      overallEffectSize: "No significant difference detected",
    };
  }

  // Pairwise comparisons
  const pairwiseComparisons: PairwiseComparison[] = [];
  const rawPValues: number[] = [];

  for (let i = 0; i < conditions.length; i++) {
    for (let j = i + 1; j < conditions.length; j++) {
      const c1 = conditions[i];
      const c2 = conditions[j];

      const test = mannWhitneyU(c1.values, c2.values, alpha);
      rawPValues.push(test.pValue);

      // Effect size
      let effectSize: EffectSize;
      switch (effectSizeMethod) {
        case "cohens-d":
          effectSize = cohensD(c1.values, c2.values);
          break;
        case "cliffs-delta":
          effectSize = cliffsDelta(c1.values, c2.values);
          break;
        default:
          effectSize = hedgesG(c1.values, c2.values);
      }

      // Mean difference with CI
      const diffs: number[] = [];
      for (const v1 of c1.values) {
        for (const v2 of c2.values) {
          diffs.push(v1 - v2);
        }
      }
      const meanDifference = mean(c1.values) - mean(c2.values);
      const meanDifferenceCI = bootstrapCI(diffs, mean, {
        nBootstrap: 2000,
        confidenceLevel: 0.95,
      });

      pairwiseComparisons.push({
        condition1: c1.name,
        condition2: c2.name,
        test,
        effectSize,
        meanDifference,
        meanDifferenceCI,
      });
    }
  }

  // Apply multiple comparison correction
  let correctedPValues;
  let correction: { corrected: number[]; significant: boolean[] };

  switch (correctionMethod) {
    case "bonferroni":
      correction = bonferroniCorrection(rawPValues);
      break;
    case "benjamini-hochberg":
      correction = benjaminiHochbergCorrection(rawPValues);
      break;
    default:
      correction = holmCorrection(rawPValues);
  }

  // Update pairwise comparisons with corrected significance
  for (let i = 0; i < pairwiseComparisons.length; i++) {
    pairwiseComparisons[i].test.pValue = correction.corrected[i];
    pairwiseComparisons[i].test.significant = correction.significant[i];
  }

  correctedPValues = {
    bonferroni: bonferroniCorrection(rawPValues).corrected,
    holm: holmCorrection(rawPValues).corrected,
    benjaminiHochberg: benjaminiHochbergCorrection(rawPValues).corrected,
  };

  // Summarize effect sizes
  const effectSizes = pairwiseComparisons.map((p) => p.effectSize.value);
  const maxEffect = Math.max(...effectSizes.map(Math.abs));
  let overallEffectSize: string;

  if (maxEffect < 0.2) {
    overallEffectSize = "Negligible effect sizes between conditions";
  } else if (maxEffect < 0.5) {
    overallEffectSize = "Small effect sizes detected";
  } else if (maxEffect < 0.8) {
    overallEffectSize = "Medium effect sizes detected";
  } else {
    overallEffectSize = "Large effect sizes detected";
  }

  return {
    omnibusTest,
    pairwiseComparisons,
    correctedPValues,
    conditionSummaries,
    bestConditions,
    overallEffectSize,
  };
}

/**
 * Format experiment comparison as a report
 */
export function formatComparisonReport(
  comparison: ExperimentComparison,
  metricName: string = "metric",
): string {
  const lines: string[] = [];

  lines.push(`# Experiment Comparison Report: ${metricName}`);
  lines.push("");

  // Condition summaries
  lines.push("## Condition Summaries");
  lines.push("");
  lines.push("| Condition | N | Mean | Std | Median | 95% CI |");
  lines.push("|-----------|---|------|-----|--------|--------|");

  for (const c of comparison.conditionSummaries) {
    lines.push(
      `| ${c.name} | ${c.n} | ${c.mean.toFixed(4)} | ${c.std.toFixed(4)} | ${c.median.toFixed(4)} | [${c.ci95.lower.toFixed(4)}, ${c.ci95.upper.toFixed(4)}] |`,
    );
  }
  lines.push("");

  // Best conditions
  lines.push("## Best Performing Conditions");
  lines.push(`- ${comparison.bestConditions.join(", ")}`);
  lines.push("");

  // Omnibus test
  lines.push("## Statistical Test Results");
  lines.push("");
  lines.push("### Omnibus Test");
  lines.push(`- Statistic: ${comparison.omnibusTest.statistic.toFixed(4)}`);
  lines.push(`- p-value: ${comparison.omnibusTest.pValue.toExponential(3)}`);
  lines.push(
    `- Significant at α=${comparison.omnibusTest.alpha}: ${comparison.omnibusTest.significant ? "Yes" : "No"}`,
  );
  lines.push("");

  // Pairwise comparisons
  if (comparison.pairwiseComparisons) {
    lines.push("### Pairwise Comparisons (with multiple comparison correction)");
    lines.push("");
    lines.push(
      "| Comparison | Mean Diff | Effect Size | p-value (corrected) | Significant |",
    );
    lines.push("|------------|-----------|-------------|---------------------|-------------|");

    for (const p of comparison.pairwiseComparisons) {
      const sigMark = p.test.significant ? "Yes" : "No";
      lines.push(
        `| ${p.condition1} vs ${p.condition2} | ${p.meanDifference.toFixed(4)} | ${p.effectSize.value.toFixed(4)} (${p.effectSize.interpretation}) | ${p.test.pValue.toExponential(3)} | ${sigMark} |`,
      );
    }
    lines.push("");
  }

  // Effect size summary
  if (comparison.overallEffectSize) {
    lines.push("## Effect Size Summary");
    lines.push(`- ${comparison.overallEffectSize}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Compute power analysis estimate (Cohen's d based)
 * Returns estimated sample size needed to detect effect
 */
export function estimateSampleSize(
  effectSize: number,
  alpha: number = 0.05,
  power: number = 0.8,
): number {
  // Using approximation for two-sample t-test
  // n = 2 * ((z_alpha + z_beta) / d)^2

  // Z-scores for alpha (two-tailed) and beta
  const z_alpha = 1.96; // Approximate for alpha = 0.05
  const z_beta = 0.84; // Approximate for power = 0.8

  // Adjust z_alpha for different alpha levels
  const z_alpha_adj =
    alpha === 0.05 ? 1.96 : alpha === 0.01 ? 2.576 : 1.645;

  // Adjust z_beta for different power levels
  const z_beta_adj =
    power === 0.8 ? 0.84 : power === 0.9 ? 1.28 : power === 0.95 ? 1.645 : 0.84;

  const n = 2 * Math.pow((z_alpha_adj + z_beta_adj) / effectSize, 2);

  return Math.ceil(n);
}

/**
 * Run a simple A/B comparison
 */
export function compareAB(
  groupA: number[],
  groupB: number[],
  options: {
    nameA?: string;
    nameB?: string;
    alpha?: number;
    higherIsBetter?: boolean;
  } = {},
): {
  winner: string | null;
  test: TestResult;
  effectSize: EffectSize;
  meanA: number;
  meanB: number;
  difference: number;
  differenceCI: ConfidenceInterval;
  recommendation: string;
} {
  const {
    nameA = "A",
    nameB = "B",
    alpha = 0.05,
    higherIsBetter = true,
  } = options;

  const test = mannWhitneyU(groupA, groupB, alpha);
  const effectSize = hedgesG(groupA, groupB);

  const meanA = mean(groupA);
  const meanB = mean(groupB);
  const difference = meanA - meanB;

  // Bootstrap CI for difference
  const diffs: number[] = [];
  for (const a of groupA) {
    for (const b of groupB) {
      diffs.push(a - b);
    }
  }
  const differenceCI = bootstrapBCaCI(diffs, mean, {
    nBootstrap: 5000,
    confidenceLevel: 0.95,
  });

  // Determine winner
  let winner: string | null = null;
  let recommendation: string;

  if (!test.significant) {
    recommendation = `No significant difference between ${nameA} and ${nameB} (p=${test.pValue.toFixed(4)}). Need more data or larger effect.`;
  } else {
    if (higherIsBetter) {
      winner = meanA > meanB ? nameA : nameB;
    } else {
      winner = meanA < meanB ? nameA : nameB;
    }

    const effectDesc = effectSize.interpretation;
    const percentChange = Math.abs((difference / meanB) * 100);

    recommendation = `${winner} is significantly ${higherIsBetter ? "better" : "worse"} than ${winner === nameA ? nameB : nameA} ` +
      `(${effectDesc} effect, ${percentChange.toFixed(1)}% ${difference > 0 ? "increase" : "decrease"}, p=${test.pValue.toExponential(3)})`;
  }

  return {
    winner,
    test,
    effectSize,
    meanA,
    meanB,
    difference,
    differenceCI,
    recommendation,
  };
}

export {
  mean,
  std,
  median,
  percentile,
  summarize,
  bootstrapCI,
  bootstrapBCaCI,
  cohensD,
  hedgesG,
  cliffsDelta,
  mannWhitneyU,
  kruskalWallis,
  bonferroniCorrection,
  holmCorrection,
  benjaminiHochbergCorrection,
};
