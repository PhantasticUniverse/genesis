/**
 * Reference 3D Organisms
 * Curated selection from Bert Chan's LeniaNDK animals3D.json
 * These are scientifically documented 3D artificial life forms
 */

import type { ReferenceOrganism3D } from "./organism-importer-3d";

/**
 * Curated 3D organisms from reference Lenia project
 * Categorized by family:
 * - Guttidae (Gu): Droplet-shaped organisms
 * - Sphaeridae (Sp): Spherical organisms
 * - Ovidae (Ov): Ovoid/egg-shaped organisms
 * - Platonidae (Pl): Platonic solid shapes
 * - Asperidae (As): Foramina structures
 */
export const REFERENCE_3D_ORGANISMS: ReferenceOrganism3D[] = [
  // === GUTTIDAE (Droplet-shaped) ===
  {
    code: "4Gu2s",
    name: "Diguttome saliens",
    cname: "乙雫球(躍)",
    params: {
      R: 10,
      T: 10,
      b: "1,3/4,7/12,11/12",
      m: 0.12,
      s: 0.01,
      kn: 1,
      gn: 1,
    },
    cells:
      "14.$14.$14.$14.$5.uWyO7.$5.yN3yO5.$4.sE4yO5.$4.rLyH2yOyFqD4.$5.uKxQwRvD5.$14.$14.$14.$14.%14.$14.$6.sAB6.$5.3yOtLrV4.$3.uI6yO4.$3.2yOsMpV3yOrA3.$3.2yOG2.3yO3.$3.yNyOpF2.2yOyN3.$3.xRyOyFrXsE2yOpQ3.$3.tHyK5yO4.$4.BvExOwQuO5.$14.$14.%14.$6.qXpR6.$4.pR4yOqB4.$3.7yOsM3.$2.uVyOuQ3.vW2yOS2.$2.yLyO5.xJyOxA2.$2.yOtL5.D2yO2.$2.yJrU6.2yO2.$2.xGyD5.CyO3.$2.rIyOtA3.PyOyL3.$3.uW2yOwB3yO4.$5.uExOwXpL5.$14.%14.$4.rM3yOwBpB4.$3.7yOrB3.$2.sKyOuN3.wR2yOtQ2.$2.yO7.2yOM.$.yFyO7.wXyOrR.$.yItF8.yOrM.$.xPrW3.R4.yOpR.$.vFwO8.yO2.$2.yOU6.2yO2.$2.rPyOqO3.F2yO3.$3.qU5yOyK4.$5.pTrHpH6.%5.qAqB7.$4.5yOxBM3.$3.2yOuFrUsVxM2yOpQ2.$2.2yO5.vI2yOD.$.2yO7.tPyOwE.$.yO3.rIyOxM3.yOxL.$.yO2.W3yOH2.2yO.$.yO2.pJ3yON2.2yO.$.yO3.qFyJwW3.2yO.$.wSvH8.yOU.$2.xXsA6.yOyK2.$3.yGyOqJF.vNyO4.$4.rMxSyNyIwX5.%5.sQsWqPpN5.$3.vW6yOuA3.$2.2yOvXpD2.uJyLyOvK2.$.vVyOqJ5.sD2yOsK.$.yOsJ3.A3.pB2yO.$.yO3.3yOwH2.yDyO.$.yO2.5yO2.tTyO.$sPyO2.vR4yO2.rTyO.$.yO3.xD3yO2.yMyO.$.yOW3.qGqP3.yOtC.$2.yOB6.2yO2.$3.yOqB4.2yO3.$4.wS4yOwQ4.%4.pLuBsVuSvOpT4.$3.7yOyKK2.$2.2yOwAB.AuMyL2yOD.$.qUyOsW5.pQ2yOxH.$.yO4.sXpG3.2yOA$pLyO2.rN4yO2.xKyOV$xXwJ2.2yOqGsPyO2.sPyO.$xOxD2.yG2yOyByO2.rAyO.$.yO2.sQ4yO2.2yO.$.yOA2.qNuGtP3.yOuG.$.tSyOA6.2yO2.$2.qGyOpX4.2yO3.$3.qHxW4yOyI4.%4.HsLtKwPvWpC4.$3.wJ6yOtJ3.$2.sTyOyBsCpQrPvU2yOyM2.$2.yOvG5.W2yOsS.$.yOwE8.2yO.$rNyO3.3yOqR2.xMyOH$sOyO2.xB4yO2.uPyO.$AyO2.wQ4yO2.vEyO.$.yO3.3yOsN2.2yO.$.yOpR3.rN4.yOtO.$.pUyOR6.2yO2.$3.yOvO3.A2yO3.$4.wT4yOyA4.%5.qCrHsCqA5.$4.5yOxTpD3.$3.2yOyNxLwTyM2yOsN2.$2.2yO5.vG2yOpA.$.2yO7.wHyOuD.$.yOpE3.A3.qC2yO.$.yO3.qByOxI3.2yO.$.yO3.sM2yO3.2yO.$.yOL8.yOwW.$.wQyO7.2yOW.$2.xFyO5.vDyO3.$3.xUyOuXUH2yO4.$5.vHyFyKxR5.%14.$4.sB4yOsG4.$3.xF7yOC2.$2.3yOyHwRxIyN3yO2.$2.2yO5.uG2yOV.$.qTyOqT5.F2yOvD.$.yNyO7.2yOtX.$.2yO7.yKyOtA.$.wByO7.2yOqC.$2.2yO5.rPyOxX2.$3.2yOM2.xD2yO3.$4.6yO4.$6.qX7.%14.$5.UqLqJpS5.$4.rN4yOuQQ3.$3.qX6yOuKW2.$3.2yOuDsGsXxI2yOrS2.$2.vXyOqSE2.sAyByOuS2.$2.2yO5.vWyOtS2.$2.2yO5.vUyOsU2.$2.vHyO4.sAyHyOqP2.$3.2yO2.pW2yOwV3.$3.sB6yO4.$5.qMyFqX6.$14.%14.$14.$5.SqOqLpI5.$4.pL2yOxDxRrG4.$3.C6yOK3.$3.7yOtF3.$3.7yOuA3.$3.7yOsF3.$3.yM6yO4.$4.5yOsC4.$5.pM2yO6.$14.$14.%14.$14.$14.$5.BMC6.$5.qFqPqNqT5.$4.KwI2yOuSpX4.$5.3yOuKpN4.$5.yJ2yOvUpO4.$5.pTsDtDuI5.$7.D6.$14.$14.$14.!",
  },

  {
    code: "3Gu2t",
    name: "Diguttome tardus",
    cname: "乙雫球(緩)",
    params: {
      R: 10,
      T: 10,
      b: "2/3,1,5/6",
      m: 0.15,
      s: 0.016,
      kn: 1,
      gn: 1,
    },
    cells:
      "13.$13.$13.$13.$13.$5.PuV6.$5.pEuC6.$13.$13.$13.$13.$13.%13.$13.$13.$4.sM3yO5.$3.pG5yO4.$3.xI5yOqO3.$3.xM5yOyE3.$3.qJ5yO4.$4.sP3yOqL4.$13.$13.$13.%13.$13.$4.5yO4.$3.7yO3.$2.wQ2yOpM.3yOJ2.$2.2yOqD3.3yO2.$2.2yOF3.3yO2.$2.xC2yO2.rN2yO3.$3.7yO3.$4.4yOyF4.$6.O6.$13.%13.$4.4yOqV4.$3.7yO3.$2.2yOvN2.xW3yO2.$2.yOtW4.tA2yO2.$.wQyO6.2yOU.$.xEyO6.2yOL.$.qLyOpN5.2yO2.$2.2yOA3.3yO2.$3.7yO3.$4.xR3yOwB4.$13.%5.PtNM5.$3.6yOqO3.$2.4yOxC3yOuF2.$.rXyOuU4.tC2yOA.$.2yO6.yM2yO.$.yOpH.uG2yOqN2.2yO.$.yOE.yJ3yO2.2yO.$.2yO2.2yO2.P2yO.$.tGyOH5.2yO2.$2.2yOqH3.3yO2.$3.xJ5yOxT3.$5.rEvMqB5.%4.E3yOK4.$3.7yO3.$2.3yO2.rW3yO2.$.2yO6.2yOuQ.$.yOV2.2yOpF2.2yO.$.yO2.yO2.yO2.2yO.$pRyO2.yO2.yO2.2yO.$.yO2.4yO2.2yO.$.2yO2.xByG2.2yOyM.$2.2yO4.vF2yO2.$3.7yO3.$4.rD3yOqA4.%4.uE3yOqL4.$3.7yO3.$2.2yOvI2.G3yO2.$.2yO6.3yO.$.yO3.2yOsW2.2yO.$tAyO2.yO2.xS2.2yOA$tSyO2.yO2.vCpF.2yO.$.yO2.4yO2.2yO.$.2yO2.yJyO2.wX2yO.$2.yOwX4.uL2yO2.$2.pQ3yOyN3yO3.$4.vA3yOwE4.%4.O2yOxGK4.$3.7yO3.$2.3yOpM.yE3yO2.$.2yOtR5.2yOsW.$.2yO2.rGtM2.sF2yO.$.yO2.2yOxQwS2.2yO.$.yO2.2yOuKyO2.2yO.$.yOpV2.2yOpD2.2yO.$.yNyO6.2yOrN.$2.2yO4.3yO2.$3.7yO3.$5.3yO5.%5.GqBJ5.$3.sF5yOqA3.$2.8yOrE2.$2.2yOR3.3yO2.$.2yO6.2yOvM.$.2yO6.xD2yO.$.2yO2.EqG2.wB2yO.$.2yO6.2yOuI.$2.2yO4.wH2yO2.$2.xO2yOAO3yOqL2.$3.uM5yOC3.$6.vL6.%13.$4.qC3yOqE4.$3.6yOxQ3.$2.8yOtG2.$2.2yOxW2.tA3yO2.$.xL2yO4.xJ2yOJ.$.wI2yO4.vS2yOF.$2.2yO4.3yO2.$2.3yOyIvF3yOuM2.$3.7yO3.$4.uP3yOB4.$13.%13.$13.$4.tQ3yOrQ4.$3.6yOtT3.$3.7yOC2.$2.8yOsC2.$2.8yOrP2.$2.sW7yO3.$3.6yOtL3.$4.4yOpM4.$13.$13.%13.$13.$13.$5.tIyOsF5.$4.4yOvM4.$3.A5yOH3.$4.5yOB3.$4.4yOvB4.$5.2yOrQ5.$13.$13.$13.!",
  },

  // === SPHAERIDAE (Spherical) ===
  {
    code: "1Sp1l",
    name: "Sphaerome lithos",
    cname: "正球(石)",
    params: {
      R: 12,
      T: 10,
      b: "1",
      m: 0.14,
      s: 0.016,
      kn: 1,
      gn: 1,
    },
    cells:
      "11.$11.$11.$4.3yOxH3.$3.5yO3.$2.rI6yO2.$2.rS6yO2.$3.5yO3.$4.3yOyF3.$11.$11.$11.%11.$11.$3.5yO3.$2.7yO2.$2.8yO.$.4yOsV4yO.$.4yOsA4yO.$2.8yO.$2.7yO2.$3.5yO3.$11.$11.%11.$3.sX4yO3.$2.7yO2.$.4yO.4yO.$.2yOwT4.2yO.$.2yO5.3yO$.2yO5.3yO$.2yOwB4.2yO.$.4yO.4yO.$2.7yO2.$3.vJ4yO3.$11.%11.$3.6yO2.$.rU8yO.$.2yO5.2yO.$xE2yO6.2yO$2yO7.2yO$2yO7.2yO$xO2yO6.2yO$.2yO5.2yO.$.tP8yO.$3.6yO2.$11.%4.3yO4.$2.7yO2.$.3yO3.3yO.$.2yO5.3yO$2yO7.2yO$2yO7.2yO$2yO7.2yO$2yO7.2yO$.2yO5.3yO$.3yO3.3yO.$2.7yO2.$4.3yO4.%4.3yO4.$2.7yO2.$.3yO3.3yO.$.2yO5.3yO$2yO7.2yO$2yO7.2yO$2yO7.2yO$2yO7.2yO$.2yO5.uK2yO$.3yO3.3yO.$2.7yO2.$4.3yO4.%5.yOuN4.$2.7yO2.$.4yO.uU3yO.$.2yO5.3yO$2yO7.2yO$2yO7.2yO$2yO7.2yO$2yO7.2yO$.2yO5.3yO$.4yO.F3yO.$2.7yO2.$4.pR2yO4.%11.$3.5yO3.$2.8yO.$.3yO3.3yO.$.2yO5.3yO$2yOsQ6.2yO$2yOrS6.2yO$.2yO5.3yO$.3yO3.sS2yO.$2.8yO.$3.5yO3.$11.%11.$4.3yO4.$2.7yO2.$2.8yO.$.3yO3.3yO.$.2yOuX4.2yO.$.2yOtS4.2yO.$.3yO3.3yO.$2.8yO.$2.7yO2.$4.3yO4.$11.%11.$11.$4.3yO4.$3.6yO2.$2.7yO2.$2.7yOtI.$2.7yOuR.$2.7yO2.$3.6yO2.$4.3yO4.$11.$11.%11.$11.$11.$11.$4.3yO4.$3.5yO3.$3.5yO3.$4.3yOrF3.$11.$11.$11.$11.!",
  },

  {
    code: "3Sp2l",
    name: "Disphaerome lithos",
    cname: "乙正球(石)",
    params: {
      R: 12,
      T: 10,
      b: "1,1,1",
      m: 0.15,
      s: 0.017,
      kn: 1,
      gn: 1,
    },
    cells:
      "16.$16.$16.$16.$6.xXyOwCB6.$5.5yOsN5.$5.6yO5.$4.pN6yOpL4.$5.6yO5.$5.wH3yOyGpB5.$6.uByOsK7.$16.$16.$16.$16.%16.$16.$7.qD8.$5.6yO5.$4.8yO4.$3.wS8yO4.$3.10yO3.$3.10yO3.$3.10yO3.$3.uK8yO4.$4.8yO4.$5.6yO5.$16.$16.$16.%16.$7.H8.$4.rG6yO5.$3.vB8yO4.$3.10yO3.$2.5yOtRsO4yO3.$2.4yO4.4yO2.$2.3yOxS4.4yO2.$2.4yO4.4yO2.$2.4yOyD2.4yOF2.$3.10yO3.$3.wX8yO4.$5.6yO5.$16.$16.%16.$5.6yO5.$3.9yO4.$2.qM10yO3.$2.3yOyA4.4yO2.$.O2yOyI6.3yO2.$.3yO8.2yO2.$.3yO8.2yOrL.$.3yO8.2yOE.$.M2yOxK6.3yO2.$2.3yO5.tE3yO2.$2.sS10yO3.$3.xN8yOpU3.$5.6yO5.$16.%6.sXwAtE7.$4.8yO4.$3.10yO3.$2.3yOxK4.4yO2.$.uR2yOR6.3yO2.$.3yO8.3yO.$.2yO9.3yO.$.2yO9.K2yO.$.2yO9.3yO.$.3yO8.2yOwW.$.tV2yO7.wH2yO2.$2.3yOpR4.4yO2.$3.10yO3.$4.8yO4.$6.pCqL8.%5.yI4yOrH5.$3.xH8yO4.$2.5yOsTrR4yOpS2.$.rW2yOxI6.3yO2.$.3yO8.3yO.$.2yO9.D2yO.$tT2yO3.4yO3.2yO.$vM2yO3.4yO3.2yO.$qC2yO3.4yO3.2yO.$.2yO4.yOuD4.2yO.$.3yO8.3yO.$.sC2yOrQ6.3yO2.$2.4yOI2.sN3yOsQ2.$3.yI8yO4.$5.xC4yO6.%5.6yO5.$3.10yO3.$2.4yO4.4yO2.$.3yO7.tK2yOsN.$.2yO9.3yO.$uM2yO3.4yO3.2yO.$3yO2.2yO2.yOsO2.2yOsR$2yOqT2.yO3.2yO2.2yOrN$3yO2.2yO2.yOvX2.2yO.$qK2yO3.4yO3.2yO.$.2yO10.2yO.$.3yO8.2yOpT.$2.3yOtD4.4yO2.$3.10yO3.$5.6yO5.%4.B6yO5.$3.10yO3.$2.3yOyB4.4yO2.$.3yO8.2yOwA.$.2yO9.sF2yO.$wO2yO3.4yO3.2yO.$2yOqK2.yOpL2.2yO2.2yOsF$2yO3.yO4.yO2.2yOpX$2yO3.yO3.uNyO2.2yO.$sS2yO2.D4yO3.2yO.$.2yO4.xKvB4.2yO.$.3yO8.2yOwI.$2.3yO5.sN3yO2.$3.10yO3.$5.6yO5.%5.6yO5.$3.10yO3.$2.4yO4.4yO2.$.3yO7.pJ2yOpU.$.2yO9.3yO.$rH2yO3.4yO3.2yO.$3yO2.2yO2.yOvH2.2yO.$2yO3.yO3.uUyO2.2yO.$2yOrM2.2yO2.yOwI2.2yO.$.2yO3.4yO3.2yO.$.2yO10.2yO.$.3yO8.2yO2.$2.3yOpH4.4yO2.$3.9yOyJ3.$5.6yO5.%5.wK3yOtL6.$3.vF8yO4.$2.5yO2.4yOP2.$.qN2yOyJ6.3yO2.$.3yO8.2yOxD.$.2yO4.yIuE4.2yO.$pH2yO3.4yO3.2yO.$rC2yO2.tL4yO3.2yO.$.2yO3.4yO3.2yO.$.2yO3.uJyOwI4.2yO.$.2yOvE8.2yOyB.$2.2yO7.wT2yO2.$2.4yO4.3yO3.$3.sC8yO4.$5.qC4yO6.%6.rIsF8.$4.8yO4.$3.10yO3.$2.3yOrR4.4yO2.$.vB2yO7.3yO2.$.3yO8.3yO.$.2yO9.D2yO.$.2yO4.xCtT4.2yO.$.2yO10.2yO.$.2yOxB8.2yOxE.$.sW2yO8.2yO2.$2.3yO5.I3yO2.$3.10yO3.$4.yL6yOxH4.$7.tQ8.%16.$5.6yO5.$3.9yO4.$2.M10yO3.$2.3yOtN4.rA3yO2.$.qK2yOtV6.3yO2.$.3yO8.2yOtS.$.3yO8.2yOwE.$.3yO8.2yO2.$2.2yO7.yM2yO2.$2.3yO5.pT3yO2.$2.wM4yOwUwR4yO3.$3.vR8yO4.$5.5yOvT5.$16.%16.$16.$5.6yO5.$3.G8yO4.$3.10yO3.$2.4yOqN2.D3yOqC2.$2.3yOqC4.4yO2.$2.3yO5.rS3yO2.$2.3yOpO4.3yOyI2.$2.4yOB3.3yO3.$3.10yO3.$3.uM8yO4.$5.6yO5.$16.$16.%16.$16.$16.$5.5yOtQ5.$4.7yOxX4.$3.xH8yO4.$3.10yO3.$3.10yO3.$3.9yOvC3.$3.U8yO4.$4.yM6yOwF4.$5.5yOvA5.$16.$16.$16.%16.$16.$16.$16.$6.pQqP8.$5.vW3yOyN6.$5.6yO5.$5.6yO5.$5.6yO5.$6.3yOyG6.$6.rCuUV7.$16.$16.$16.$16.!",
  },

  // === OVIDAE (Ovoid/Egg-shaped) ===
  {
    code: "4Ov1l",
    name: "Ovome limus",
    cname: "卵球(偏)",
    params: {
      R: 10,
      T: 10,
      b: "7/12,1/6,1,5/6",
      m: 0.15,
      s: 0.019,
      kn: 1,
      gn: 1,
    },
    cells:
      "13.$13.$13.$13.$6.vX6.$6.yO6.$6.xK6.$13.$13.$13.$13.$13.$13.%13.$13.$5.yFyO6.$3.yL5yO4.$3.7yO3.$3.7yO3.$3.7yO3.$3.7yO3.$3.6yO4.$5.3yO5.$13.$13.$13.%13.$5.xXyOwD5.$3.6yO4.$2.8yO3.$2.9yO2.$2.9yO2.$2.9yO2.$2.8yOwS2.$2.yK7yO3.$3.7yO3.$5.rF2yO5.$13.$13.%5.yGyOvV5.$3.7yO3.$2.8yO3.$.4yO3.3yO2.$.3yO4.vP3yO.$.3yO5.3yO.$.3yO5.3yO.$.4yOD2.4yO.$.10yOH.$2.9yO2.$3.7yO3.$5.3yO5.$13.%3.yK5yO4.$2.8yO3.$.4yO3.3yO2.$.2yO6.3yO.$3yO2.rOyO3.2yO.$3yO2.3yO2.2yO.$3yO2.3yO2.2yO.$3yO2.rHyOA.3yO.$.3yO5.3yO.$.10yOF.$2.yC7yO3.$3.vR5yO4.$13.%3.7yO3.$2.9yO2.$.3yO5.2yOqG.$yN2yO3.yO3.2yO.$2yO2.yO2.yO2.2yO.$2yO2.yO3.yO2.yOwQ$2yO2.yO3.yO.3yO$2yOxL.4yOC.2yOvD$3yO2.vVyO2.3yO.$.3yOS3.sQ3yO.$2.8yOxT2.$3.6yOyM3.$13.%3.7yO3.$2.3yO2.sP3yO2.$.2yO6.3yO.$2yO8.2yO.$2yO2.J6.2yO$2yO.qX4.yO2.2yO$2yO.yO4.yO2.2yO$2yO2.yO2.tUyO.3yO$3yO.S3yO2.2yO.$.3yO5.3yO.$2.9yO2.$3.7yO3.$6.yO6.%3.7yO3.$2.3yO3.3yO2.$.2yO6.yI2yO.$2yO8.2yO.$2yO9.2yO$2yO.yO4.wA2.2yO$2yO.yO4.yO2.2yO$2yO2.yO3.yO.pHyOqC$3yO2.2yOpE2.2yO.$.3yO5.3yO.$2.3yOpT5yO2.$3.7yO3.$6.yOpR5.%3.6yO4.$2.3yO.wW3yOxP2.$.2yO6.2yOxB.$3yO7.2yO.$2yO8.2yOxD$2yO9.yOwR$2yO9.yOsX$2yO5.xI2.2yO.$3yO3.tE3.2yO.$.3yO4.qP3yO.$2.9yO2.$3.7yO3.$6.pL6.%4.5yO4.$2.8yO3.$.3yO5.2yO2.$.2yO7.2yO.$3yO7.2yO.$2yO8.2yO.$2yO8.2yO.$uQ2yO7.2yO.$.2yO6.3yO.$.4yO2.D3yO2.$2.8yO3.$3.6yO4.$13.%13.$3.6yO4.$2.8yOxN2.$.3yO5.2yO2.$.2yO6.2yO2.$.2yO7.2yO.$.2yO6.3yO.$.3yO5.2yO2.$.4yO3.3yO2.$2.8yOsV2.$3.6yO4.$5.tPyO6.$13.%13.$5.2yO6.$3.6yO4.$2.xL7yO3.$2.3yO2.3yOuU2.$2.3yO3.3yO2.$2.3yO3.3yO2.$2.9yO2.$2.wJ7yO3.$3.6yOyG3.$6.2yO5.$13.$13.%13.$13.$13.$4.5yO4.$3.6yO4.$3.7yO3.$3.7yO3.$3.7yO3.$4.5yO4.$5.vR2yO5.$13.$13.$13.!",
  },

  {
    code: "3Ov1c",
    name: "Ovome octahedron",
    cname: "卵球(八面)",
    params: {
      R: 10,
      T: 10,
      b: "1,1/3,1/4",
      m: 0.24,
      s: 0.041,
      kn: 1,
      gn: 1,
    },
    cells:
      "13.$13.$13.$5.3yO5.$4.5yO4.$3.rJ5yOtB3.$3.7yO3.$3.vJ5yOtO3.$4.5yO4.$5.2yOyF5.$13.$13.$13.%13.$13.$4.5yO4.$3.7yO3.$2.vP7yOuN2.$2.9yO2.$2.9yO2.$2.9yO2.$2.8yOsU2.$3.7yO3.$4.5yO4.$13.$13.%13.$4.5yO4.$2.pF7yOA2.$2.9yO2.$.10yOtG.$.4yOvH.5yO.$.4yO3.4yO.$.5yO2.4yO.$.10yOqD.$2.9yO2.$2.I7yOK2.$4.5yO4.$13.%5.3yO5.$3.7yO3.$2.9yO2.$.11yO.$.3yOuS4.3yO.$4yO5.3yOrE$4yO5.tQ3yO$4yO5.3yOqW$.3yOwE4.3yO.$.5yO.5yO.$2.9yO2.$3.7yO3.$5.2yOwL5.%4.5yO4.$2.9yO2.$.11yO.$.3yOvO3.wA3yO.$3yOT5.tC3yO$3yO7.3yO$3yO2.tB2yO2.3yO$3yO3.uSyM2.3yO$3yO7.3yO$.3yOxH3.C3yO.$.5yOyL5yO.$2.9yO2.$4.5yO4.%3.7yO3.$2.9yO2.$.4yOyL6yO.$4yO5.4yO$3yO7.3yO$2yOuW2.xNyOsD2.uW2yO$2yOyB.JyOyEuG2.3yO$2yOqE3.TrJ2.3yO$3yO3.wIyO2.3yO$4yO5.4yO$.4yO3.4yO.$2.9yO2.$3.7yO3.%3.7yO3.$2.9yO2.$.4yO3.4yO.$3yO7.3yO$3yO2.vGyOtP2.3yO$2yO2.2yOxA2yO2.2yO$2yO2.yO3.yO2.2yO$2yO2.yO5.3yO$2yOsC.uK3yO2.3yO$3yO3.yO3.3yO$.3yO5.3yO.$2.9yO2.$3.7yO3.%3.7yO3.$2.9yO2.$.4yO3.4yO.$3yO6.tX3yO$3yO2.2yOsB2.3yO$2yO2.yOqF.2yO2.2yO$2yO2.yO3.yO2.2yO$2yO2.yO3.uV2.2yO$3yO2.2yOsN2.3yO$4yO5.4yO$.3yOqR3.4yO.$2.9yO2.$3.7yO3.%4.5yO4.$2.9yO2.$.5yOyH5yO.$.3yO5.3yO.$3yO7.3yO$3yO7.yK2yO$2yO5.yNyO2.2yO$2yOvK2.rB2yOvG2.2yO$3yO7.3yO$qB3yO5.3yO.$.11yO.$2.9yO2.$4.5yO4.%5.3yO5.$3.7yO3.$2.9yO2.$.4yOrC6yO.$.3yO5.3yOpX$4yO5.4yO$3yOsS.2yO2.4yO$3yOuL.2yO2.qD3yO$.3yO5.3yO.$.4yOtO.D4yO.$2.9yO2.$3.7yO3.$5.3yOrX4.%13.$4.5yO4.$2.9yO2.$2.9yO2.$.4yOuH6yO.$.3yO5.3yO.$.3yO2.L2.3yO.$.3yOK4.3yO.$.4yO2.qS4yO.$2.9yO2.$2.9yO2.$4.5yO4.$13.%13.$13.$4.5yO4.$3.7yO3.$2.9yO2.$2.9yO2.$.tM9yOR.$2.9yO2.$2.9yO2.$2.wN7yOvT2.$3.yA5yOvB3.$13.$13.%13.$13.$13.$5.3yOyI4.$4.5yOyB3.$3.7yO3.$3.7yO3.$3.7yO3.$3.vL6yO3.$4.xX4yO4.$13.$13.$13.!",
  },

  {
    code: "3Ov1e",
    name: "Ovome ellipsis",
    cname: "卵球(橢)",
    params: {
      R: 10,
      T: 10,
      b: "1/2,1,3/4",
      m: 0.2,
      s: 0.028,
      kn: 1,
      gn: 1,
    },
    cells:
      "13.$13.$13.$5.4yO4.$4.6yO3.$4.6yO3.$4.6yO3.$4.6yO3.$5.4yO4.$13.$13.$13.%13.$6.pVqV5.$4.6yO3.$3.8yO2.$3.8yO2.$2.pB8yOwN.$2.L8yOsM.$3.8yO2.$3.8yO2.$4.6yO3.$6.PW5.$13.%13.$4.6yO3.$3.8yO2.$2.10yO.$2.10yO.$2.10yOA$2.10yO.$2.10yO.$2.10yO.$3.8yO2.$4.6yO3.$13.%5.4yO4.$3.8yO2.$2.10yO.$2.4yOxT2.3yO.$.7yO2.3yO$.7yOA.3yO$.7yOwSpU3yO$.7yO.wA3yO$2.10yO.$2.10yO.$3.8yO2.$5.4yO4.%4.6yO3.$3.8yO2.$2.4yO3.3yO.$.3yOtUpG4.3yO$.5yOuPtRsI.3yO$.4yOvC4.pM2yO$.4yOtH4.vL2yO$.5yOW.wB.3yO$.3yOvN4.pL3yO$2.3yOwI2.yG3yO.$3.8yO2.$4.6yO3.%4.6yO3.$2.uR9yO.$2.3yO4.3yO.$.3yOtOqP4.3yO$.2yOqD2yO2.vA2.2yO$.2yO.yO6.2yO$.2yO.uG6.2yO$.2yO2.wS4.tG2yO$.3yO6.3yO$2.3yO4.3yO.$2.vV8yOyI.$4.6yO3.%4.6yO3.$2.xQ8yOuC.$2.3yO4.3yO.$.3yOsSB4.3yO$.2yO.2yO2.sB2.2yO$.2yO.yO6.2yO$N2yO.tT6.2yO$.2yO2.yO4.pO2yO$.3yO6.3yO$.C3yO4.3yO.$2.9yOwI.$4.6yO3.%4.6yO3.$3.8yO2.$2.4yO2.pR3yO.$.3yOpT5.3yO$.3yO.yOqUMyO.3yO$.2yO.wAuT4.3yO$.2yO2.sD4.3yO$.2yOwO.yO2.vA.3yO$.3yO6.3yO$2.3yO3.pT3yO.$3.8yO2.$4.6yO3.%5.4yO4.$3.8yO2.$2.10yO.$2.3yOwQ6yOH$.3yOxKxW7yO$.3yOvRyOrMxL5yO$.3yOuQyD.pE5yO$.3yOqN2.tGyG4yO$.pG3yO3.yD3yO.$2.10yO.$3.8yO2.$5.4yO4.%13.$4.6yO3.$3.8yO2.$2.10yO.$2.10yO.$2.10yO.$2.10yO.$2.10yO.$2.10yO.$3.8yO2.$4.6yO3.$13.%13.$13.$4.6yO3.$3.8yO2.$3.8yO2.$3.8yO2.$3.8yO2.$3.8yO2.$3.8yO2.$4.6yO3.$6.pGR5.$13.%13.$13.$13.$5.4yO4.$4.6yO3.$4.6yO3.$4.6yO3.$4.6yO3.$5.4yO4.$13.$13.$13.!",
  },

  {
    code: "3Ov1t",
    name: "Ovome torus",
    cname: "卵球(環)",
    params: {
      R: 15,
      T: 10,
      b: "1,1",
      m: 0.27,
      s: 0.036,
      kn: 1,
      gn: 1,
    },
    cells:
      "32.$32.$32.$32.$32.$32.$32.$32.$14.rHqR17.$12.5yOsV13.$11.7yO13.$10.9yO12.$10.9yO12.$10.9yO12.$10.9yO12.$11.7yO13.$12.qQ4yO14.$14.pJ17.$32.$32.$32.$32.$32.$32.$32.$32.%32.$32.$32.$32.$32.$32.$10.7yOqJ13.$9.9yO12.$8.11yO11.$7.12yOuP10.$7.13yO10.$7.12yOuO10.$7.12yOwV10.$7.12yOqF10.$7.12yOrX10.$8.11yO11.$9.9yO12.$10.6yOxO13.$32.$32.$32.$32.$32.$32.%32.$32.$32.$32.$32.$9.8yO13.$7.11yOvJ10.$6.13yO11.$6.14yO10.$5.15yOuT9.$5.16yO9.$5.15yOsT9.$5.14yOxS10.$5.14yOyI10.$5.14yOyO10.$6.13yO11.$7.11yO12.$9.7yOwF13.$32.$32.$32.$32.$32.%32.$32.$32.$32.$8.7yOxP14.$6.11yO13.$5.13yOsU11.$4.5yOvHrW7yO11.$4.5yOrS3.7yOvI9.$3.6yO5.8yO9.$3.6yO6.8yO8.$3.6yO6.8yOwI8.$3.6yO6.7yOyF9.$3.6yO5.7yOyJ10.$4.5yOvK2.8yO10.$4.6yOyG7yOwW11.$5.14yO11.$6.11yO12.$9.6yOwJ14.$32.$32.$32.$32.%32.$32.$32.$8.6yO16.$5.11yOuB13.$4.6yOsApU6yOsQ11.$3.6yO5.7yO10.$3.5yO7.7yO10.$2.6yO8.7yOwM9.$2.6yO9.6yOxS9.$2.6yO9.6yOyI9.$2.6yO9.6yOyB9.$2.6yO8.6yOyG10.$3.5yO7.7yO10.$3.6yO5.7yO10.$4.6yOwRvM6yOqJ11.$5.12yO13.$8.6yOxV15.$32.$32.$32.%32.$32.$7.6yO17.$4.11yOwE14.$3.6yOvIpP7yO12.$2.5yO6.7yOwA10.$2.5yO8.7yO10.$.5yO9.7yO10.$.5yO10.6yOxV9.$.5yO10.6yOyI9.$.5yO10.6yOxX9.$.5yO10.6yOyE9.$.5yO9.6yOyG10.$2.5yO8.7yO10.$2.5yO6.7yOtC10.$3.6yOyFvN7yO11.$4.12yO13.$7.6yOwP15.$32.$32.%32.$6.5yOwT17.$3.10yOuI14.$2.6yOwBsU7yO11.$.5yO6.8yO10.$.5yO8.7yO10.$5yO10.7yO9.$5yO10.7yO9.$5yO11.6yOyI8.$5yO11.6yOyO8.$5yO11.6yOyG8.$5yO10.7yO9.$5yO10.7yO9.$.5yO8.7yO10.$.5yO6.7yOsV10.$2.6yOxSxH7yO11.$3.11yO13.$6.6yO16.$32.%32.$5.5yOwO17.$3.10yO14.$.6yOwSrW7yO11.$.5yO6.7yO10.$5yO9.7yO10.$5yO10.6yOwV9.$4yOxE10.6yOyO9.$4yOyB11.6yOyO8.$4yOyO12.6yO8.$4yOyL11.6yOyN8.$4yOyA11.6yOyM8.$5yO10.6yOyG9.$5yO9.7yO9.$.5yO6.7yOqI10.$.6yOxFwD7yO11.$2.11yO14.$5.6yOsB15.$32.%32.$5.5yO18.$2.10yOsR14.$.6yOqMB7yO11.$.5yO6.7yOwU9.$5yO9.7yO9.$4yOwM10.6yOyE9.$4yOyM11.6yOyO8.$4yOyO12.5yOyO8.$4yOyO12.5yOyO8.$4yOyO12.5yOyO8.$4yOyO11.6yOyM8.$4yOxL10.6yOyA9.$5yO9.7yO9.$.5yO6.7yOtW10.$.6yOvUvF7yO11.$2.10yOxT14.$5.5yOwN16.$32.%32.$5.5yOxA17.$2.10yOuO14.$.6yOsNpS7yO11.$.5yO6.7yOuK9.$5yO9.7yO9.$4yOvW10.6yOyG9.$4yOyN11.6yOyO8.$4yOyO12.5yOyO8.$4yOyO12.5yOyO8.$4yOyO12.5yOyO8.$4yOyN11.6yOyM8.$4yOuX10.6yOyE9.$5yO9.7yO9.$.5yO6.7yOsG10.$.6yOwLwL7yO11.$2.10yOxX14.$5.5yOvC16.$32.%32.$5.6yO17.$2.11yO14.$.6yOvBvE7yO11.$.5yO6.7yOrX10.$5yO9.7yO9.$4yOvB10.6yOyI9.$4yOyO11.6yOyO8.$4yOyO12.5yOyO8.$4yOyO12.5yOyO8.$4yOyO12.5yOyO8.$4yOyL11.6yOyL8.$4yOrT10.6yOyC9.$5yO9.7yO9.$.5yO6.7yOqI10.$.6yOyEvF7yO11.$2.10yOyF14.$5.6yO16.$32.%32.$5.6yO17.$3.10yO14.$.6yOyJyC7yO11.$.5yO6.7yOpX10.$5yO9.7yO9.$4yOsM10.6yOyK9.$4yOyO11.6yOyO8.$4yOyO12.5yOyO8.$4yOyO12.5yOyO8.$4yOyO12.5yOyO8.$4yOyN11.6yOyN8.$4yOpQ10.6yOyE9.$5yO9.7yO9.$.5yO6.7yOrO10.$.6yOyGxP7yO11.$2.11yO14.$5.6yOwO16.$32.%32.$6.5yOtP16.$3.10yOyL13.$.6yOyBxH7yO11.$.5yO6.7yOvB10.$5yO9.7yO9.$5yO10.6yOyK9.$4yOyC10.6yOyO8.$4yOyO11.6yOyO8.$4yOyO12.5yOyO8.$4yOyO11.6yOyO8.$4yOyG10.6yOyN8.$5yO10.6yOyI9.$5yO9.7yO9.$.5yO6.7yOvW10.$.6yOyNyC7yO11.$3.10yOyM14.$6.5yOwW16.$32.%32.$6.6yO16.$3.11yO13.$2.6yOyAuU7yO11.$.5yO6.7yOyF10.$.5yO8.7yO10.$5yO10.7yO9.$5yO10.6yOyO9.$4yOyJ11.6yOyO8.$4yOyO11.6yOyO8.$4yOyC10.6yOyO8.$5yO10.6yOyM9.$5yO10.7yO9.$.5yO8.7yO10.$.5yO6.7yOyF10.$2.6yOyExQ7yO11.$3.11yO13.$6.6yOsP15.$32.%32.$32.$7.5yOxP14.$3.11yOuF12.$2.6yOyNxN7yO11.$.5yO6.8yO10.$.5yO8.7yO10.$5yO10.7yO9.$5yO10.7yO9.$5yO11.6yOyB8.$5yO11.6yOyL8.$5yO10.6yOyO9.$5yO10.7yO9.$5yO10.7yO9.$.5yO8.7yO10.$.5yO6.8yO10.$2.6yOyOxN7yO11.$3.11yOuW12.$7.5yOyN14.$32.%32.$32.$7.6yO15.$4.11yOwV12.$2.6yOxOwR7yO11.$.5yO6.8yO10.$.5yO8.7yO10.$5yO10.7yO9.$5yO10.7yO9.$5yO10.6yOyM9.$5yO10.6yOyO9.$5yO10.7yO9.$5yO10.7yO9.$5yO10.7yO9.$.5yO8.7yO10.$.5yO6.7yOyI10.$2.6yOyGwH7yO11.$3.12yO12.$7.6yOtM14.$32.%32.$32.$32.$8.5yOvX14.$4.11yOvM12.$3.6yOsTrU7yO11.$2.5yO6.8yO10.$2.5yO8.7yO10.$.6yO9.7yO10.$.5yO10.7yO9.$.5yO10.7yO9.$.5yO9.7yO10.$.6yO9.7yO10.$2.5yO7.8yO10.$2.5yO6.7yOxW10.$3.6yOvEvG7yO11.$4.12yO12.$8.5yOyH14.$32.$32.%32.$32.$32.$9.5yOwQ14.$5.10yOvM12.$3.6yOsRvF7yO11.$2.6yO5.8yO10.$2.5yO7.7yOwN10.$2.5yO8.7yOyH10.$2.6yO8.7yOyA9.$2.6yO8.7yOxE9.$2.5yO8.7yOxT10.$2.5yO7.8yO10.$3.6yO5.7yOyE10.$3.6yOxMvR7yO11.$5.11yO12.$9.5yOyL14.$32.$32.$32.%32.$32.$32.$32.$10.5yO16.$5.11yOwT12.$4.6yOxPyJ7yO11.$3.5yO6.7yOyO10.$3.6yO6.7yOyI10.$3.5yO7.7yOyA10.$3.5yO7.7yOxH10.$3.5yO7.7yOyG10.$3.6yO6.7yOyO10.$3.6yO5.8yOvU10.$4.6yOyHxF7yO11.$5.12yO12.$10.5yOvN15.$32.$32.$32.$32.%32.$32.$32.$32.$32.$11.5yOuV14.$6.10yOyL11.$5.6yOyLvV7yO10.$4.6yO5.7yOyD10.$4.6yO5.7yOyH10.$4.6yO5.7yOyE10.$4.6yO5.7yOyH10.$4.6yO5.7yOyE10.$4.6yO5.7yOyN10.$5.6yOyOxC7yO10.$6.11yO11.$11.5yOxT14.$32.$32.$32.$32.$32.%32.$32.$32.$32.$32.$32.$12.5yO15.$8.9yO14.$6.12yO12.$6.12yOyB11.$6.12yOyI11.$6.12yOyI11.$6.12yOyD11.$6.12yO12.$7.10yO13.$12.5yOsT14.$32.$32.$32.$32.$32.$32.%32.$32.$32.$32.$32.$32.$32.$32.$14.rC17.$12.4yOwI14.$11.6yOyB13.$10.7yOyI13.$10.8yO12.$10.7yOxS13.$11.6yOwK13.$12.4yOsN14.$14.rR17.$32.$32.$32.$32.$32.$32.$32.$32.!",
  },

  // === PLATONIDAE (Platonic solid shapes) ===
  {
    code: "2Pl8l",
    name: "Octahedrome lithos",
    cname: "八面球(石)",
    params: {
      R: 13,
      T: 10,
      b: "1,5/12",
      m: 0.19,
      s: 0.019,
      kn: 1,
      gn: 1,
    },
    cells:
      "14.$14.$14.$14.$14.$5.tFyOvH6.$5.vA3yO5.$5.B2yOxP5.$5.rJyOyLGpI4.$7.sNqJ5.$14.$14.$14.$14.%14.$14.$14.$6.rJpS6.$4.6yOV3.$3.8yO3.$3.yG6yOxK3.$3.7yOyB3.$3.rP7yO3.$4.6yOpF3.$6.xOyOyK5.$14.$14.$14.%14.$14.$4.DtQ2yOvA5.$3.8yO3.$2.10yO2.$2.10yO2.$2.10yO2.$2.10yO2.$2.10yO2.$3.8yO3.$4.7yO3.$4.vH4yOsW4.$7.rF6.$14.%14.$14.$3.wB6yOxO3.$2.4yOrUpTvV3yO2.$2.4yO2.tF3yO2.$.5yOvNRpN4yO.$.3yOxE8yO.$.rV2yOsGsC3yOwQ3yO.$.vEyOpX2.vGyOwV.rHyO2.$2.2yO2.rQxAvEJ2yO2.$2.10yO2.$3.8yO3.$5.wD3yO5.$14.%14.$5.4yO5.$2.sN9yO2.$.qR3yOH3.yF2yO2.$.4yOM3.sS3yO.$.4yOwHwVvItGvF3yO.$.9yOxI2yO.$.2yO.pQ4yOvF.uVyOO$.2yO2.H3yO2.2yO.$.xGyO3.tJyOsF2.yO2.$2.2yOrU.tRxIuWP2yO2.$2.xK9yO2.$4.6yOqA3.$6.vCuI6.%14.$3.rX6yOtI3.$2.4yOsK5yO2.$.4yO4.pN3yO.$.4yOuPtSsCqSrB3yOqF$.12yOtH$sF12yOuI$3yOtU6yO.tWyOyH$.2yO.pX4yOtF2.yOsG$.2yO2.qF3yO2.2yO.$.Q2yOrXsBvWyOvBsMxWyO2.$2.10yO2.$3.8yO3.$5.vU3yOsR4.%6.uPxNrP5.$3.uV7yO3.$2.4yOvRvF4yO2.$.4yOpK3.4yO.$sS12yOvK$wJ13yO$6yOqSqB6yO$vJ5yOWM2yOqQLyOyK$yL2yOuX6yO.uWyOxV$.2yOqCqU4yOrO.pIyOF$.3yOrVuI3yOsWuN2yO.$2.4yOyD5yO2.$3.xL7yO3.$4.rNwM3yOrW4.%5.vTyOyDuOqS4.$3.sE7yO3.$2.10yO2.$.rW2yOvB4yOyM3yO.$.2yO.qP8yOpG$.2yOqD6yOwX3yO$wWyOvQqG2yOpEP3yOyHyOwG$6yOUL6yO$yF9yOuSyNyOxJ$tH9yOuE2yOvE$.4yOpMxR2yOxQ3yO.$2.4yOtAtV4yO2.$3.8yO3.$5.yG3yOwL4.%5.tPxVyOQ5.$3.sJ7yO3.$2.10yO2.$2.10yOtS.$.2yO2.4yO2.2yO.$.yOqG.O5yO.2yO.$.yOyL.yD5yOqT3yO$sN2yOrK6yOuJ2yOrX$qJ9yOyC2yOuP$N12yO.$.3yOxR.pAwXxV4yO.$2.3yOuStH.4yO2.$3.8yO3.$5.tV3yO5.%6.tVxGpW5.$4.6yO4.$2.vA9yO2.$2.2yOtQ7yO2.$2.yO2.qV2yOtN2.2yO.$.2yO2.vT2yOyC2.2yO.$.yOsM2.4yOT.2yO.$.2yOqTuM4yOvGrO2yOuG$.3yOyL8yO.$.3yOxMsVyFyN5yO.$2.2yOvJ4.3yOvD.$2.4yOvDwK4yO2.$3.rJ6yO4.$14.%14.$5.tJ3yOsH4.$3.8yO3.$2.10yO2.$2.2yO.tAyGwN2.2yO2.$2.yO2.pXyOwG3.yOvQ.$.wH2yO.rLyOuQ2.qW2yO.$.xOyOxL.uP2yOqM.rP2yO.$.4yOvSyDyGwU4yO.$2.3yOsV2.wN3yOvM.$2.3yOqH2.uE3yO2.$3.8yOsX2.$5.pEyAyOsX5.$14.%14.$6.tGqF6.$5.5yO4.$3.vL6yO4.$3.8yOB2.$2.yI9yO2.$2.6yOqGuC2yO2.$2.10yO2.$2.10yO2.$2.4yOwQ5yO2.$2.wB8yO3.$4.6yOqJ3.$14.$14.%14.$14.$14.$5.wQyOxQrC5.$4.6yO4.$3.wW6yOtD3.$3.wV7yO3.$3.yK7yO3.$3.8yO3.$3.vO6yOtP3.$4.sI4yOsB4.$14.$14.$14.%14.$14.$14.$14.$6.qPI6.$6.wSyOrC5.$4.CwO2yOwP5.$5.3yOwVsK4.$4.sD3yOxP5.$6.xV.uB5.$14.$14.$14.$14.!",
  },

  {
    code: "2Pl4t",
    name: "Tetrahedrome rotans",
    cname: "四面球(轉)",
    params: {
      R: 18,
      T: 10,
      b: "1,7/12",
      m: 0.17,
      s: 0.016,
      kn: 1,
      gn: 1,
    },
    cells:
      "18.$18.$18.$18.$18.$18.$8.UM8.$7.4yOvS6.$6.6yOtT5.$6.7yO5.$6.7yOwQ5.$7.5yOxH6.$18.$18.$18.$18.$18.$18.%18.$18.$18.$18.$7.4yOsQ6.$5.8yO4.$4.wS9yO4.$4.10yO4.$3.11yO4.$3.11yO4.$3.10yOxL4.$4.9yOsK4.$5.7yOqC5.$8.vMsQ8.$18.$18.$18.$18.%18.$18.$18.$6.rM4yOvE5.$4.vJ8yO4.$3.vH10yO4.$2.4yOuGuU6yO4.$2.4yO2.xL6yO3.$2.4yO3.sU6yO2.$2.4yO4.S6yO2.$2.4yO4.uV6yO2.$2.4yO4.sH5yO3.$3.4yOsSpS5yO4.$4.10yO4.$5.tT6yOyK4.$8.tMtKvI7.$18.$18.%18.$18.$5.2yOvXC7.$3.8yOpV5.$2.4yOtLpN5yOuP3.$2.4yO2.qA6yO3.$.3yO4.D7yO2.$.3yO5.7yOtO.$.3yO6.tV6yO.$.3yO7.6yO.$.3yO6.yI6yO.$.3yO5.wW6yOqR.$.3yO4.vV6yO2.$2.4yO2.vN6yO3.$3.4yOxTsW5yOsM4.$4.10yO4.$5.yM6yOtD5.$8.qA9.$18.%18.$4.3yOrH9.$2.tH9yO5.$.4yOqCsI7yO3.$.4yO2.G7yO2.$3yO5.O7yO.$3yO6.8yO$3yO7.7yO$3yO6.C7yOqD$3yO7.7yO$3yO7.6yOsM$3yO6.P7yO.$.4yO4.qK7yO.$.4yOrOyE7yO2.$2.uI10yO3.$4.8yO4.$6.tAwG8.$18.%6.uMqK9.$3.8yO6.$2.4yOvNvL5yOvT3.$.4yO2.sS6yO2.$3yO5.qT7yO$3yO6.8yO$2yOyE6.8yO$2yOyO7.7yOvM$2yOyO7.7yOyF$2yOyM6.8yO$2yOvE6.8yO$3yO5.pP8yO$.4yO3.yB7yO.$.4yOyD7yO2.$2.qR10yO3.$4.8yO5.$6.wWxT9.%5.yN3yO8.$2.9yO5.$.4yOqIrR6yO3.$3yO4.rG7yO.$3yO5.pP7yO$2yOyK6.8yO$2yOyO7.7yOyB$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyO7.7yOyB$2yOyK6.8yO$3yO5.wB8yO$3yO5.7yOxL.$.3yOxO6yO2.$2.10yO3.$4.7yOxA4.$7.xQvE9.%4.qO4yO8.$2.9yO5.$.4yOrIsC6yO3.$3yO4.qP7yO.$3yO6.7yO$2yOyA6.8yO$2yOyO7.7yOyH$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyO7.7yOyJ$2yOyG6.8yO$3yO5.xI7yOV$3yO4.wG7yOqU.$.3yOqSwQ7yO2.$2.10yO3.$3.qI8yO4.$6.xUwR9.%4.vV3yOxP8.$2.9yO5.$.4yOqHrC6yO3.$3yO4.tD7yO.$3yO5.xM7yO$2yOyC6.8yO$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyO7.7yOyL$2yOvD6.8yO$3yO5.uX7yOyL$3yO4.qO7yOxO.$.4yOpLxI7yO2.$2.10yO3.$4.8yO4.$6.sSwR9.%5.uG3yO8.$2.9yO5.$.4yOvBoU6yO3.$3yO4.yA7yO.$3yO5.tP7yO$2yOyD6.8yO$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyO7.7yOyI$2yOsK6.8yO$3yO5.xX7yOyO$3yO4.sR7yOyN.$.4yOqMxV6yOvV.$2.10yO3.$4.8yO4.$6.uGwF9.%5.qV3yOqV8.$2.9yO5.$2.4yOyEsO6yO3.$3yO5.7yOtK.$3yO5.8yO$2yOyF7.7yOyJ$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyO7.7yOyL$2yOxP6.8yO$3yO5.uO7yOyE$3yO4.pM7yOvD$.4yOqJuX7yO2.$2.10yO3.$4.8yO4.$6.tDuR9.%6.tI3yO8.$2.wH8yOuH4.$2.4yOxHpI5yOvI3.$3yO4.sC7yO.$3yO5.8yO$2yOsP6.8yO$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyL7.7yOyB$2yOxF6.8yO$3yO5.uU7yOvD$3yO4.rG8yO.$.4yOsMvI6yO2.$2.10yO3.$4.8yO4.$6.tErW9.%6.sL3yO8.$2.yH8yO5.$.3yOuJsR6yOuV3.$3yO4.uS7yO.$3yO5.8yO$2yOpR6.8yO$2yOyL7.7yOyO$2yOyO7.7yOyO$2yOyO7.7yOyO$2yOyC7.7yOxI$2yOsN6.8yO$3yO5.qB7yOuI$3yO4.xF7yOsU.$.4yOvJxE6yOqS.$2.10yO3.$4.8yOpO4.$7.uNxU8.%18.$3.rR8yOpM5.$2.4yOxAsK5yOvC3.$.3yO3.rP7yOsH.$.3yO5.8yO$3yO6.7yO.$2yOxO6.7yOyN$2yOyL6.8yO$2yOxP6.8yO$3yO6.7yOuE.$.3yO5.8yO.$.3yO4.B7yOtI.$.4yOqQxD6yOtK.$2.4yOyI6yO3.$3.10yO4.$5.7yOqS5.$8.tCwI8.%18.$18.$4.8yO5.$2.4yOwRvG6yO3.$.4yO2.G7yO2.$.3yO4.pT7yO.$.3yO5.8yO.$.3yO5.7yOyF.$.3yO5.7yOtX.$.3yO4.tM7yO.$.4yO2.qI7yO2.$.4yOxKyA6yO3.$2.uI10yO4.$4.8yO5.$6.rKxN8.$18.$18.%18.$18.$18.$5.7yOpW5.$3.9yO5.$2.4yOvMuV5yOuM3.$2.4yO2.qN6yO3.$2.4yO3.qU5yO3.$2.4yO4.5yO4.$2.4yO3.tD5yO4.$3.3yOtLvI6yO4.$4.10yO4.$4.xW8yO4.$6.7yOvU5.$9.qIwN7.$18.$18.$18.%18.$18.$18.$18.$18.$6.rK5yO6.$5.7yOxL5.$4.9yO4.$4.9yOsK4.$4.9yOpE4.$4.9yOqX4.$4.9yOvI4.$5.7yOyK5.$7.4yOtR6.$18.$18.$18.$18.$18.!",
  },

  // === ASPERIDAE (Foramina structures) ===
  {
    code: "4As1l",
    name: "Foraminome lithos",
    cname: "有孔球(石)",
    params: {
      R: 10,
      T: 10,
      b: "1/3,1,7/12,5/6",
      m: 0.15,
      s: 0.02,
      kn: 1,
      gn: 1,
    },
    cells:
      "14.$14.$14.$14.$6.qBR6.$5.4yO5.$5.5yOqE4.$5.5yOqB4.$5.4yO5.$6.sJrF6.$14.$14.$14.$14.%14.$14.$5.tIyOuM6.$4.5yO5.$3.7yO4.$2.yF7yO4.$2.8yOwU3.$2.8yOwV3.$2.8yO4.$3.6yOwQ4.$4.tW4yO5.$6.JqG6.$14.$14.%14.$4.sBqMqP6.$3.5yOsH5.$2.7yO4.$.2yOsQxI4yO3.$.2yOyE3.3yO3.$.2yO5.3yOvU.$.2yO5.2yOtK2.$.2yO6.2yOpW.$.2yOyK3.2yOpI3.$.uT2yOwU3yOvX4.$3.7yOsJ4.$5.rIqD7.$14.%14.$3.pBpHrA7.$2.uP5yOuN4.$.3yOvOpS4yOwR2.$.2yOrN4.3yO2.$.2yO6.3yO.$.2yO6.2yOtS.$.2yO7.2yO.$.2yO7.2yO.$.2yO6.2yOvL.$.2yO5.3yO2.$3.4yOrU3yOpQ.$.Q5yOyN4.$3.qF2yOpN6.$14.%5.qUE7.$2.6yOV5.$2.3yOuKxC3yO4.$.2yO5.3yO3.$.2yO6.3yO.$.2yO7.2yO.$sM2yO7.2yO$tL2yO8.2yO$F2yO8.2yO$.2yO7.2yO.$.2yO6.3yO.$2.3yO3.3yO2.$2.5yOyF4yO.$.D4yOxV5.$4.vD8.%4.rNuNqL6.$2.5yOyB5.$.3yOsRpT4yO3.$.2yO5.3yOwD.$.2yO6.3yO.$A2yO8.2yO$tL2yO8.2yO$yH2yO8.2yO$yB2yO8.2yO$vB2yO8.2yO$.2yO7.2yO.$.2yO6.3yO.$2.3yO3.4yO.$2.6yO4yO.$4.qOxTyM5.%4.wFyOvAR5.$2.6yO5.$.3yOuSsN4yO3.$.2yO5.4yO.$.2yO7.3yO$F2yO8.2yO$xF2yO8.2yO$yO2yO8.2yO$yM2yO8.2yO$sU2yO8.2yO$A2yO7.2yO.$.2yO6.3yO.$2.3yO3.4yO.$2.pX5yOyL3yO.$.H4yOyE5.$4.qBwNO5.%4.xNyOwBV5.$2.6yO5.$.3yOxHyC4yO3.$.2yO5.4yO.$.2yO7.3yO$A2yO8.2yO$sO2yO8.2yO$yL2yO8.2yO$yO2yO8.2yO$xO2yO8.2yO$H2yO7.2yO.$.2yO6.3yO.$2.3yO3.4yO.$2.sT5yO3yOpO.$3.5yOsV4.$4.rCwKsV5.%4.yKyOrRC5.$2.6yO5.$.3yOyIyL4yOtO2.$.2yO5.4yO.$.2yO7.3yO$I2yO8.2yO$qG2yO8.2yO$yC2yO8.2yO$yK2yO8.2yO$vJ2yO8.2yO$H2yO7.2yO.$.2yO6.3yO.$2.3yO3.4yO.$2.xD5yOxX2yOpP.$.S4yOxT5.$4.pTuXtK5.%5.xM2yOT5.$2.tQ5yOtH4.$.3yOvKvP4yOtW2.$.2yO5.4yO.$.2yO7.2yOuC$G2yO8.2yO$tD2yO8.2yO$yD2yO8.2yO$yG2yO8.2yO$vI2yO8.2yO.$.2yO7.2yO.$.2yO6.3yO.$2.3yO3.4yO.$2.wI5yOyB2yOqK.$.T5yOuI4.$4.qNrXpR5.%5.xL2yOsB5.$3.5yOrI4.$.3yOsIuU4yOrP2.$.2yO5.4yO.$.2yO7.2yOvN$F2yO8.2yO$pX2yO8.2yO$xR2yO8.2yO$xN2yO8.2yO$qJ2yO8.2yO.$.2yO7.2yO.$.2yO6.3yO.$2.3yO3.4yO.$2.tN5yOyJ2yOpW.$.G5yOvC4.$4.vOsR6.%14.$3.5yOwM5.$2.3yOqJuR4yOpR2.$.2yO5.4yO.$.2yO6.3yO.$.2yO7.2yO.$.F2yO8.2yO$A2yO8.2yO$.M2yO7.2yO.$.2yO7.2yO.$.2yO6.3yO.$2.3yO3.4yO.$2.qO5yOyO2yOpV.$3.uU5yOqV4.$5.sRsE7.$14.%14.$4.4yOvG5.$2.3yOpSrU4yOqQ2.$.2yO5.4yO2.$.2yO6.3yO2.$.2yO7.2yOrG.$.2yO7.2yO2.$.rD2yO7.2yOB.$.2yO7.2yO2.$.2yO6.3yO2.$.2yO5.3yOvL2.$2.3yOsQ4yO4.$2.rJ5yOxE4.$4.wEwC7.$14.%14.$14.$4.4yO5.$2.wV6yOqM4.$.tP8yO4.$.3yO3.4yO3.$.2yO5.3yO3.$.2yO6.3yO2.$.2yO5.3yO3.$.3yO3.4yO3.$.yO8yO4.$2.yB7yO4.$4.4yO5.$14.$14.%14.$14.$14.$5.sAqX6.$4.4yOwL5.$3.6yO5.$3.6yOuO4.$3.6yOtR4.$3.5yOqD4.$4.4yOwU5.$5.uIvK6.$14.$14.$14.!",
  },
];

/**
 * Get all reference 3D organisms
 */
export function getAllReference3DOrganisms(): ReferenceOrganism3D[] {
  return REFERENCE_3D_ORGANISMS;
}

/**
 * Get a reference 3D organism by code
 */
export function getReference3DOrganismByCode(
  code: string,
): ReferenceOrganism3D | undefined {
  return REFERENCE_3D_ORGANISMS.find((o) => o.code === code);
}

/**
 * Get reference 3D organisms by family prefix
 */
export function getReference3DOrganismsByFamily(
  familyPrefix: string,
): ReferenceOrganism3D[] {
  return REFERENCE_3D_ORGANISMS.filter(
    (o) =>
      o.code.includes(familyPrefix) ||
      o.name.toLowerCase().includes(familyPrefix.toLowerCase()),
  );
}

/**
 * Family descriptions for 3D organisms
 */
export const FAMILY_3D_DESCRIPTIONS = {
  Gu: "Guttidae - Droplet-shaped organisms with fluid dynamics",
  Sp: "Sphaeridae - Spherical organisms with stable structures",
  Ov: "Ovidae - Ovoid/egg-shaped organisms with varied symmetries",
  Pl: "Platonidae - Platonic solid shapes (tetrahedra, cubes, octahedra)",
  As: "Asperidae - Organisms with internal void structures (foramina)",
  Me: "Membranidae - Membrane/sheet-like structures",
} as const;
