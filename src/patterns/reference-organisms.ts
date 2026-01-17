/**
 * Reference Lenia Organisms
 * Classic organisms imported from the reference Lenia project by Bert Chan
 *
 * Format documentation:
 * - code: Unique identifier (e.g., O2u = Orbidae family, species 2, variant u)
 * - name: Scientific name in Latin
 * - cname: Chinese/Japanese name
 * - params: Lenia parameters (R, T, b, m, s, kn, gn)
 * - cells: RLE-encoded pattern
 */

import type { ReferenceOrganism } from "./organism-importer";

/**
 * Classic organisms from the Lenia project
 * Total: 15 carefully selected organisms representing diverse behaviors
 */
export const REFERENCE_ORGANISMS: ReferenceOrganism[] = [
  // === ORBIDAE (Spherical Gliders) ===
  {
    code: "O2u",
    name: "Orbium unicaudatus",
    cname: "球虫(單尾)",
    params: {
      R: 13,
      T: 10,
      b: "1",
      m: 0.15,
      s: 0.015,
      kn: 1,
      gn: 1,
    },
    cells:
      "7.MD6.qL$6.pKqEqFURpApBRAqQ$5.VqTrSsBrOpXpWpTpWpUpCrQ$4.CQrQsTsWsApITNPpGqGvL$3.IpIpWrOsGsBqXpJ4.LsFrL$A.DpKpSpJpDqOqUqSqE5.ExD$qL.pBpTT2.qCrGrVrWqM5.sTpP$.pGpWpD3.qUsMtItQtJ6.tL$.uFqGH3.pXtOuR2vFsK5.sM$.tUqL4.GuNwAwVxBwNpC4.qXpA$2.uH5.vBxGyEyMyHtW4.qIpL$2.wV5.tIyG3yOxQqW2.FqHpJ$2.tUS4.rM2yOyJyOyHtVpPMpFqNV$2.HsR4.pUxAyOxLxDxEuVrMqBqGqKJ$3.sLpE3.pEuNxHwRwGvUuLsHrCqTpR$3.TrMS2.pFsLvDvPvEuPtNsGrGqIP$4.pRqRpNpFpTrNtGtVtStGsMrNqNpF$5.pMqKqLqRrIsCsLsIrTrFqJpHE$6.RpSqJqPqVqWqRqKpRXE$8.OpBpIpJpFTK!",
  },
  {
    code: "O2ui",
    name: "Orbium unicaudatus ignis",
    cname: "球虫(單尾焰)",
    params: {
      R: 13,
      T: 10,
      b: "1",
      m: 0.11,
      s: 0.012,
      kn: 1,
      gn: 1,
    },
    cells:
      "8.DPXUD$5.pFqMqRpTpW2qBqDpXB$4.HrHsLrVqFpTpJXpCpSqMsL$3.UpWrSrAqCpKQA3.SqPsV$2.pBqAqEqApSpIpN6.CsS$.EpWqApIQpBqVrNqL7.wO$.pIqCXB2.rP2sUqF6.U$.pXpR4.sEuBuKtW7.uJ$PqHpA4.rTuTvNvMtL6.qR$DqSO5.vDwLwUwI7.pN$.tHK5.uUxBxUxWtF6.qK$.vCO5.LxM2yOxT6.qG$2.pN6.uE3yOsN4.SpU$2.wU6.CxQ2yOvWqJ3.pSpK$2.H7.tU2xTwSuGrGpUqAqER$3.tL6.rLwDwPwBvAtGrQqUpQ$3.CqS5.qXuTvHuJtJsJrFpWR$4.pJqC3.IrJtNtJsFrEqKpOS$5.pCqGpNpMqErKrXrIqHpNpDPC$6.HpNqAqGqJqEpOpDPKA$8.EPSQNIC!",
  },
  {
    code: "O2b",
    name: "Orbium bicaudatus",
    cname: "球虫(雙尾)",
    params: {
      R: 13,
      T: 10,
      b: "1",
      m: 0.15,
      s: 0.014,
      kn: 1,
      gn: 1,
    },
    cells:
      "13.pK$14.qV$6.VpA.MpEpKpITqV$4.BpPpNrIrEqDpWpOpLpUqNvT$4.IqRrNsPsKqHJ3.GqOuC$4.TrLsTrPrLpS6.uUD$3.SpWqNrBqLpRqPqE6.vA$2.FpTpMLpHqPqHrVsPrS5.qUqA$K.pCpRG.ErFsRsVuSuPqN4.CrR$pA.pTU3.rWuBuRvXwTwKpF4.rCH$.tPqHH3.qFvAwUwVyJyKwNL2.DqLR$.pGsGA4.vPxSyDxE2yOuHS.XqJT$2.xIE4.sCyHyOvLvRyFxCsGpVpXqGP$2.VsU4.DxQyOvVuSwDwQuBrMqSqCF$3.vG5.tEyKwVvIvKvMtVrXqTpM$4.sU4.qFvDwMvNuUuDsUrKqDO$4.qCrDJ2.pPsKuGuHtOsQrNqKpC$5.pTqTpVpNqFrJsGsKrVrDqFpFD$6.QqCqJqPqVqXqRqHpOTC$8.LWpFpEXPG!",
  },

  // === SCUTIDAE (Oscillators/Pulsers) ===
  {
    code: "S1s",
    name: "Scutium solidus",
    cname: "盾虫(實)",
    params: {
      R: 13,
      T: 10,
      b: "1",
      m: 0.29,
      s: 0.045,
      kn: 1,
      gn: 1,
    },
    cells:
      "5.pGQ$6.sUsDqRR$4.VpXrJwKvNtXrW$2.ApVrGrWsIwKyOyDwTuNO$2.qArOrIqIpPpTxH2yOyIvKqG$rVpIrNrJpH4.xP3yOvFqWA$sKvNsKqE5.pI4yOuHqPC$sNxBuMpD5.JuN3yOwXsUpN$sGxFyOT5.pCtIyF3yOuKqUH$rPwXyOxT5.qKtSxS3yOvIrQT$pQwK2yOtWXJXqHsGuWxW3yOvPsApC$.vQ3yOuVsLsGsXuMwOyK3yOvHrVpC$.rKyK3yOxEwBwCwXyE3yOxQuMrJU$.WvC5yOyM5yOwFtJqOL$2.rVwO9yOwWuMsApOC$2.pLtBwK6yOyJwQuTsQqLP$3.qHsWvEwUxTyCxRwWvRuGsNqSpA$3.HqBrUtHuGuPuLtVsXrSqIXB$4.DpDqEqW2rIqWqGpJN$6.ENTUPHA!",
  },
  {
    code: "S1v",
    name: "Scutium valvatus",
    cname: "盾虫(閥)",
    params: {
      R: 13,
      T: 10,
      b: "1",
      m: 0.283,
      s: 0.0461,
      kn: 1,
      gn: 1,
    },
    cells:
      "4.LrCrNrRrPrMVCJKD$5.pSvOwCwGwEwBuMsUsCrEqCU$4.pLqWsByN2yOyMyIyDwHuKsRqXpE$3.pOqXrKrBqLuQ5yOyBvLtFqXX$2.WqSrCpVM2.GvW4yOyHvKsSqGK$2.pWrEqGH4.QtT4yOxLuKrOpF$pVMqQrIpK6.qOuPyN3yOvUsSqAE$qIuIrLrPpC6.pWsQwJ3yOwStOqOL$WtOxCxDpK5.AqAsFuXyE2yOxAtXqVO$.sFwI2yO5.pBqOsKuIxG2yOwTtWqWP$.qGvCyD2yOqFTpApOqMrSsPuDwLyDxVwDtNqPM$2.tOxE3yOuEsIsEsOtHtRuXwPxNxBvHsTqDG$2.SvEyG3yOxVwGvT2wBwQxGxEwDuGrTpJA$3.rLwG8yOyBxMwOvCsXqOP$3.pUtGwP7yOyCwUvJtOrKpJC$3.HrCtPvWxU4yOxXwQvEtOrQpSH$4.pGrGtAuMvPwJwNwFvKuGsUrHpQK$5.pCqKrOsLtBtFtAsJrLqHpEG$6.IpBpRqDqFqCpQpCLA$8.BFGFC!",
  },
  {
    code: "S2s",
    name: "Discutium solidus",
    cname: "乙盾虫(實)",
    params: {
      R: 13,
      T: 10,
      b: "1",
      m: 0.356,
      s: 0.063,
      kn: 1,
      gn: 1,
    },
    cells:
      "8.AEG2JHFB$6.HUpKpWqGqKqLqHpXpOpCOE$4.FpCqGrGsCsQtBtEtDsUsMrXrIqNpRVF$3.MqArPtDuHvDvPvUvVvSvMvAuMtTsWrWqUpRQA$2.MqMsSuSwIxKyDyKyMyKyFxUxKwUwCvGuGtCrTqKpBD$.DqKtHvWyC10yOyHxLwLvHtXsMqUpHE$.pMsWwG14yOyMxJwBuOsVrBpHD$.rLvM6yOyLyDyByGyL6yOyAwOuVsXqVX$VtMxS5yOyGwR2vXwJxCxTyI5yOyLwTuUsOqHM$qGvDyM5yOvWtRtDtHtWuTvSwRxNyEyN4yOwRuJrUpKB$rKwFxXyK3yOxRsJqNqIqSrMsJtIuIvHwIxJyH3yOyMwDtJqOL$sCwLwWxU3yOuRT2.GpBqAqXrXsXuBvIwWyH3yOxTuVrSpB$sHuSvLxAyK2yOrO6.OpOqPrTtFvDxJ4yOwGsUpRA$rXsStVvVxW2yOpO8.IpOrEtJwM4yOxLtSqGC$qBqQsFuPxByLxWqWV9.pFrWwD4yOyJuIqOD$.NqOtGvTxPuLsDqUpKJ8.rDxD5yOuOqOB$2.WrRuFwDrP2rTrHqLpJL6.sK6yOuIqE$3.qBsIrPpKqAqOrBrIrFqOpTXJCBKxI5yOxXtMpI$3.HqJ3.HpBpVqQrGrKrEqQqHqGuE4yOyMyNwNsBB$11.NpNqLrFrTsDsO2yOyNyE2xSyCuLqA$13.GpLqNrPuKyDxUxDwJwCwLvUrV$15.NpTwDwCvMuPtXuCvAsVS$16.GtNtIsPrTrLsDsTpL$16.pEqSqIpNVpBqFpH$16.A5.G!",
  },
  {
    code: "S4s",
    name: "Tetrascutium solidus",
    cname: "丁盾虫(實)",
    params: {
      R: 13,
      T: 10,
      b: "1",
      m: 0.422,
      s: 0.0878,
      kn: 1,
      gn: 1,
    },
    cells:
      "11.BGOVpA2pFpDpATOGB$9.JpApSqMrArLrS2rVrSrNrGqTqHpSpFQG$7.LpKqOrSsUtQuIuSuXvBuXuUuNuCtOtBsKrQqWqEpIQE$5.BpDqRsKuAvJwLxExRyByDyBxUxPxEwVwIvTvEuKtOsRrSqTpUpAJ$4.EpSrVuCwDxR12yOyDxPwVwDvGuKtJsHrGqCpDG$3.BpXsRvJxW17yOyIxPwSvTuStQsKrGpXVE$3.pPsWwF22yOyBxCwAuUtOsHqWpNO$2.QsHwI25yOyBxCvWuPtGrSqHpAE$2.qTvJ7yOyIyB3xW4yB2yDyIyL8yOxWwSvMuAsKqWpKG$.JtJyG6yOxJwIvTvRvWwDwI4wLwQwVxHxRyDyL7yOxMwFuPtBrIpSL$.qJvRyL5yOwSuKtGsWtBtJtTuC2uF2uCuIuSvJwAwVxMyByL6yOyDwSvGtLrSpXO$.sHxMxWyL3yOyBtGqWqCpXqHqTrLrVrXrS2rNrVsHtBtVuXvWwVxPyDyL6yOxEvOtVrXqCO$BtVwLxEyD3yOuUpN4.OpN2qCpSpIpFpIpXqRrSsUuAvBwDwXxRyG6yOxMvWuCsCqCO$pKuIvBwFxP3yOrV6.pApSpNT4.QpSrAsFtGuIvJwFxCxUyI5yOxRwAuCrXpXJ$qMsPtOvBwXyI2yOqEE3.BpDrDrSrGpUQE3.OpPqRrQsPtLuKvMwLxMyG5yOxUwAtVrQpNE$pUqRsCuAwDxWyOwIrQqC2pFpSqTtJuSuNtLrXrGqHpNpATpKpXqJqRrDrQsMtOuPvWxEyD5yOxRvTtOrDpD$.TqOsUvExCyGtVtDsMsFsKtGuPwAvTuStQtDtBsPsFrSrX2sHrVrAqJqEqOrLsRuCvOxCyD5yOxMvJsWqJL$2.pDrQuAvWvBtGtJtLtQuAuIvGuUtOsKrSsFsRtBtDtLuFuUuXuIsRqRpIVpNqRsFtVvRxHyI5yOxCuPrXpNB$3.qHsMuKrArSsHsP2sWtDsWrQqEpFpKqEqWrNrXsWuCvB2vRuPsFpN2.TqJsFuFwDxPyL5yOwItOqTQ$3.TqWpSVpPqEqMqOqHqMpK5.OpFpXrDsKtLuNvGvEtOqRL2.TqOsRuUwSyB5yOxWvEsFpNB$4.V17.pAqErIsPtQuIuAsFqCL2.pIrLtOvRxHyI5yOwQtOqOJ$24.pDqJrQsR2tDrXqEO.QqJsKuKwFxRyL4yOyDuXrQV$25.BpKqRrSsWtBsFqOpDpApUrItDuXwQyB5yOwDsPpN$27.OqErSsUtDsMrNqHpPqHrQtJvGxCyI4yOxHtOqEE$28.JqCrLsRtQtTrXpSpApXrNtOvTxR4yOyGuKqRG$29.BpPrLtVvGtLpU.EpSrVuIwVyL4yOuXrDL$31.qHtOvWuNpP3.qEtBwDyI4yOvJrIL$31.pItBvWuSqC3.TrXvRyL4yOvOrIL$31.LsMvGuIrDE3.rLwF5yOvJrDG$32.rS2uFsFpF3.sKyD5yOuUqMB$32.qRsMuAtDqWpAEpSwD6yOtVpP$32.pFrNtGtOsPrGqJvG6yOxHsKQ$33.qEsFtGtLtGvJ7yOvGqO$33.QqRsFtDtV3yOyI2yGyIxPsRL$34.pAqRrXwAxRxPxJxCwXxExRuKpS$35.VqWvOvTvRvJvEvJwAvJqT$36.rXtGtJtDsUtBtQuPrI$36.qHqRqO2qJrAsCrG$40.BpDqJ!",
  },

  // === PTERAE (Winged/Flying) ===
  {
    code: "PG1a",
    name: "Gyropteron arcus",
    cname: "旋翼虫(鼓)",
    params: {
      R: 13,
      T: 10,
      b: "1",
      m: 0.283,
      s: 0.0481,
      kn: 1,
      gn: 1,
    },
    cells:
      "8.O2pATKA$7.pLqSrMrSrPrCqHpGH$6.pIrOtHuKvAvCuRtUsOqTpB$5.qXtSvWxNyFyL2yOxSwKuLsApMA$3.rJuFvUxBxXyM6yOxSvJsIpJ$2.qOtKvOxGyH9yOxQvErRU$.pCsJvDxGyL2yOwVvBuTvBvNwJxHyCyDwVtXqKE$.qXuEwTxBuBqR2.OpRqUrArPtDvHxBxIvLrXW$pDsRqDrMrIpH4.JpNqLqJqWsUvPxDwGtEpRA$pQ.qHrKqGD5.XqDqRqTsAuTwVwPtUqHE$.GqMrFpN6.XqFrLrRsQvDxDwWuFqPI$.IqNrCpO5.ApMqUsHtNuRwPxTxCuFqPJ$2.qDrGqHJ4.VqNsFuBwIyB2yOxAtUqKI$2.pIrBrGpTF2.UqWtDvKxL4yOwLtEpXF$2.CqGrTrWqXtXvGwVyE6yOyBvKsEpLC$3.pArPyE11yOwLtWrCW$4.sGwOxWyM7yOyBwKuMsGqAJ$4.rDtKvKwRtMwC4yOxDvPuCsKqPpAA$9.GvByOxUwEuRtGrUqMpFE$10.rCtUuItMsEqVpUXE$10.pTrFrHqNpQVIA$10.C2MGB!",
  },
  {
    code: "PG1c",
    name: "Gyropteron cavus",
    cname: "旋翼虫(屈)",
    params: {
      R: 13,
      T: 10,
      b: "1",
      m: 0.25,
      s: 0.04,
      kn: 1,
      gn: 1,
    },
    cells:
      "10.BOpA2pIpDL$9.JpApSqJqWrAqWqEpIB$7.pNrN2sHsCsFsHsMsHrNqWpNE$5.uK6yOwQuXuAtLsUsCrApN$3.rIyD2yO2xW5yOxHvMuFtBrXqMpA$2.rQxMyIuIpI2.qTwX5yOwLuNsWrIpP$.pPvMwLtGpK4.sKxM5yOwIuIsMqJO$.sPvBuPrIB4.qEwQyG4yOyGvRtQrGpD$pDsW2uPqT5.qCvGxH5yOwQuNsCpK$pXsUuSvRqO5.pKuIwV2yOxU2yOxEvBsPpN$qCsFuUxMtQ5.BtGwQ3yOxCxRwQvBsRpP$pPrSuCwXyD6.rIwS3yOxJ2vOuKsHpK$VrAtGvRyOV6.xE3yOwStLtTtDrGV$BqEsUuUxMrS6.wL3yOwSrQrVrLqCE$.pIsHtVwLsMpK5.sK3yOwLqCqHpUT$.JrXtGvEqTqRpF3.pFtGvWwQxPtJ2VO$2.rQsUrLEpSqOpUpNpSrQtJtGrXrLJ$2.rGsH2.TpUqWrArIrXrQpN$2.qRrI3.OpXqMqOqHO$2.pKqH5.L$3.J!",
  },
  {
    code: "PV1",
    name: "Vagopteron vagus",
    cname: "遊翼虫",
    params: {
      R: 25,
      T: 10,
      b: "1",
      m: 0.217,
      s: 0.0348,
      kn: 1,
      gn: 1,
    },
    cells:
      "17.GpEpVqIqR2qWqTqNqEpRpERF$15.pKqQrSsOtCtJtMtNtMtItBsPsCrMqWqGpNVH2BA$13.pPrGsPtNuAuFuLuOuQ2uSuRuNuHtVtJsTsBrFqMpSpAKFDB$11.UqWsPtR2uBtWtRtOtSuBuKuTvBvFvEuXuNuAtHsPrVqXqFpIRIFC$10.pOrQtItXtStGsMrUrOrNrUsLtFuAuRvG2vMvFuTuGtOsTsBrDqIpLTKFC$9.pWsCtPtUtGsDqUqApIpFpJpVqSrUtAuCvAvNvSvQvJuUuFtMsQrWrAqFpIQIDA$8.pUsDtQtRsUrHpSO4.MpKqPsAtKuQvMwAwBvSvIuRuBtHsLrPqRpVpBLFB$7.pLrWtPtRsSqWpG7.RpUrGsUuHvLwDwIwFvSvFuNtUtBsErHqJpLQFB$6.WrKtKtUtArCpG7.BPpNqSsHtUvFwDwNwMwFvRvDuKtRsVrXrAqApAFA$5.GqQsXtXtMrRpTD6.FPpCpRqPrUtHuRvUwMwSwPwGvTvFuNtTsVrUqQpNM$5.pOsCtUtXsQqSW5.IRpCpMpVqHqVrTtCuNvWwWxLxNxDwPwEvPuXuBtArSqIpA$4.NrBtHuEtPsCqEP3.ISpFpRqEqNqXrJrVsMtMuVwLxX5yOyJwSvQuOtFrOpVI$3.ApRsFtWuItJrSqCWKLSpEpRqFqSrGrRsBsJsStFtVuVwHxP8yOyBvItIrEpD$3.MqUtEuJuHtGrUqNpQpHpIpPqDqRrGrTsFsMsRsTtCtMuCuIuQvHwFxGyJ7yOxKtIqKB$2.ApHrRtRuPuKtMsIrJqRqIqHqPrDrQsFsN3sSsUtAtJtRtPtLtKtPuEvCwFxO7yOtFpC$2.GqDsMuEuUuPtXtFsNsArRrPrSsDsNsVtAsUsQsMsLsTtItGsXsRsNsJsGsM2sHtFvEyF5yOsN$2.QqTtBuMvBuXuOuFtVtOtHtDtBtDtHtItCsTsLsGsJsStBsRsLsGrUrOqVH3.LpGtJ4yOyIqO$.CpDrHtIuQvFvHvGvFvGvFvCuTuMuGuBtRtIsUsNsKsPtAsOsJrXrNrFqI5.AOpOqUwQ2yOyHwI$.FpMrPtMuRvIvOvSwAwHwNwPwLwCvOvAuLtUtKtCtEtBsOsHrTrJqUqJ7.HpEqIrRwFyOyGxIsK$.KpTrUtNuRvJvSwBwJwUxHxQxUxSxIwOvSvCuJtStFsPsIrRrHqPpXA7.BVqDrJsUwNyDxDvU$ANpWrUtLuPvHvRwBwJwTxIyA3yOyAwUvMuItPsUsJrSrHqMpRU9.RqBrHsHtDwTwVvNrG$BQqArStHuJvBvLvTwBwIwTxV4yOxPvWuItGsMrVrIqMpPN10.QqCrHsAsItOwLvEtN$CRpXrNtAuBuQvDvJvOvSwAxQ4yOyJwMuJsWsFrLqOpOI11.UqHrHrRrPrEuPuTtQT$DRpTrHsPtOuHuPuVvAvCvHxW5yOxFuMsRrSqUpRF12.pEqOrIrHqVqGsVuKtKqJ$CQpPqWsDtCtSuDuGuKuMuQ6yOyAuTsNrJqC13.GpOqVrGqRqCpMsAuAtDrE$BOpLqMrOsNtDtMtStTtVwC7yOvJpS15.PqGrDqTqCpHpIrStMsTrL$.KpFqDrCrUsMsVtCtFtI7yOwBpU15.DpLqRrAqFpGRqHsCtDsKrG$.IXpSqNrHrTsFsLsMuS7yOvSpF15.UqKrBqJpIMqJrSsNsOsDqT$.FSpJqBqPrErMrSrWxC7yOvTpL14.NqArAqRpMpNrSsUtAsQsDrOqF$.AKpBpPqDqNqUrBrDvUyFyOxKyJ3yOwEqMF12.NpTqWrIsPrQtWuCtGsOsBrMqQpL$2.GRpFpQpXqGqIqWuBwBuMvAwV3yOwTsDpAE9.CUqBqXrPtRvNvEuDtFsLrUrHqIpMO$3.JUpFpNpRpSpVsArIqNsQvAxE2yOxKtUqFXHB5.EOpLqLrCrPtWwLvEuCtDsHrOqXpPVH$3.CKUpCpF2pIpGpFpGqEsSvGxMyLxSvJsHqIpKWP2MRpDpOqJqXrBrEtUwIvCuAtBsErHqGQ$4.DJQU2WUSQSqDsWvLxDxKwIuFsEqXqHqBqAqCqJqQrDrFrBqIsUwBuWtVsWsArCpK$5.CHK2MLJIHIqEsTvA2wEvGtWsRrXrOrKrL2rOrGqTpVqTvNuNtQsTrVqTpP$7.D3FEC3BpVsDtXuVuXuLtStBsQsIsCrRrBqIpHMsGuDtHsMrPqOpID$17.pAqVsHtDtItGsTsKrXrIqNpPQ.KsEsXsErJqLpHB$19.pEqHqXrFrCqTqGpMO5.qKrEqIpIF$22.IMI9.LpLN$36.C!",
  },

  // === KRONIDAE (Complex Structures) ===
  {
    code: "K4s",
    name: "Kronium solidus",
    cname: "冠虫(實)",
    params: {
      R: 18,
      T: 10,
      b: "1,1/3",
      m: 0.24,
      s: 0.029,
      kn: 1,
      gn: 1,
    },
    cells:
      "9.GL2OGB$6.BpPrIsM2tDsPrVqTpPO$5.pKsRvRyD4yOxHvRtVrVpUE$4.qEuS10yOwFtLqRJ$3.OuF6yOyL5yOxHuCqTE$3.sFyG3yOxEuCtDtTvJxHyL3yOxHtQpX$2.pPwX3yOsC3.BqHtBvWyG3yOwIsFO$2.uP3yO7.pIsMvRyG2yOyLuFpS$.qMyI2yO9.pPtBwN3yOvWrA$.vGyOwN4.qJsHrQqEB2.qTuNyB2yOxCrSB$pPxMyOpN3.yLwSqMpUrIrA2.TsUxC2yOxRsFG$sHyGvEJ2.xWxC3.GrXL2.rQwL2yOxRsCE$sUxEtVJ.tVuXpN4.sPO2.qWwN2yOxErN$rIvRuFpFrIqRsHpU3.pDtT3.rAxP2yOvWqM$pItTuUwFqMrAsFrQpD2.yBqE3.tG3yOuApF$.tVyGwFvMtBrVrXsHtQyOsK3.ByG2yOxUrQB$.sWtVyLyOvBqTpFvJwDpD4.yB3yOuCpF$2.tBxCyOvJpDqWqM5.4yOwAqE$2.qTuUwVuAsRTB.BLsW4yOwLqM$3.rGsHvWuAsUsCsPuI4yOxHuNpX$4.2sCuIvMwSyLyOyLxWvWtJqOB$6.qJsKuKuStTsHpP$7.B!",
  },
  {
    code: "K4t",
    name: "Kronium tardus",
    cname: "冠虫(緩)",
    params: {
      R: 18,
      T: 10,
      b: "1,1/3",
      m: 0.34,
      s: 0.062,
      kn: 1,
      gn: 1,
    },
    cells:
      "7.JpSqWrQrSrApUJ$5.ErDwA5yOyGvErXV$5.vM10yOvOqO$4.vO12yOxWrI$3.wV14yOyDqR$2.sW6yOwDuAuPxC6yOwApA$2.xR4yOvM5.sHyB5yOrS$.sP4yOpA7.rGyG4yOvEG$.xC3yO3.tO2yOuNL2.tV4yOxUpA$.yI2yOpF2.6yOB.pKyI4yOpP$pU3yO2.tD2yOxUwV2yOrD2.xM4yOpU$rI3yO2.vW2yO.qJ2yOsU2.xP4yOpI$qW3yO2pAwI2yO.wN2yOqC2.4yOxEL$OyG2yOuNrLvB6yO2.sH4yOuA$.xE3yOuAtOvMyG3yO3.5yOqO$.uPyL3yOqOpIpK2qH3.5yOvOE$2.xE3yOxCO4.rA6yOpD$2.rNxU4yOuAqTrS7yOpX$3.sFxP11yOyIpF$4.pIvWyI7yOxJvB$6.pKuAwD2wXwDuArG!",
  },
  {
    code: "K4v",
    name: "Kronium vagus",
    cname: "冠虫(遊)",
    params: {
      R: 18,
      T: 10,
      b: "1,1/3",
      m: 0.22,
      s: 0.024,
      kn: 1,
      gn: 1,
    },
    cells:
      "9.2B$5.EpFqEqT2rAqOpUVE$4.pKrIsWuCuXvMvRvOuXtTsCpXJ$2.BqEsWuXwLxJxW2yGyBxUxPwXvGsMpSB$2.qHtTwQyD2yOyLyDxMwSwIwQxRyLxHuFqTL$.pKtOxP2yOyLxJwXwLvOuKtJtLvBxWyOyLuUrDL$BrVxC2yOyGwLvEuXuPuItLsHrSsPvR3yOuKqOB$pAuI3yOwDtLsCrIrDrAqRqOqWsCuFyB2yOxJsWpF$qCwF2yOxPsPpSG5.EpKrVwI3yOuUqO$rDxM2yOuST3.GpIT3.TtO3yOvWrI$rSxW2yOqO3.BqMpUqHpP3.qEyG2yOwFrL$rIxM2yO4.qOpD2.qOJ3.xC2yOvWrD$pSwV2yO4.sH3.pNpS3.vB2yOuXqE$.wI2yO3.GrX3.GrG3.tJ2yOsWL$.vR2yO3.qOrV3.GsF3.tJyOyLpX$.uNyLyO3.uFuX3.tBrV3.wDyOxM$.pKxRyOqE2.wXtBpSQpPyLsW3.2yOvE$2.vWyOtVpU.wLtGrVrIrSxWvB2.pUyOxWrN$2.tGxJvEtJpUvJtTuCtTtVwItVQrDuPyLvG$2.qEuNtVuKsUuNqEsMtDrSuKtBsUuUyLwDrX$3.rDrSsKtOvMrXrIqWrAuKtDuFvOvRsF$4.TQqHrX2sU2sPtOsRsFuNrL$8.TpPqJqOqEpIpSqJ$8.pUpA!",
  },
  {
    code: "K5s",
    name: "Argentokronium solidus",
    cname: "銀冠虫(實)",
    params: {
      R: 18,
      T: 10,
      b: "1,1/3",
      m: 0.24,
      s: 0.025,
      kn: 1,
      gn: 1,
    },
    cells:
      "13.GVpNpUpSpDG$10.OpUrGsHtBtTuAtTsUrDpD$5.V3pSqRsRtVuAuFvGwXxUxPwLuPsFpK$3.GrGtBtTtLtJvBwLvE2tJvT4yOxUvEsKpI$2.JsWvEwAxHxExH2yOuFqTrAvE5yOwXuPsFpA$2.tOxCwNyD5yOrA.JuFxM4yOwFuSuCrSJ$.qWyOyLxC5yOwX3.rLuPwVxRxJwFsRsWuPuIqM$.wX2yOyL5yOpX3.LrLtJtQtBqCEqJuUwNtGpI$.4yOyBxU2xWxC5.J2pST2.GwAyOvTrSpPE$LyI3yOwAuNuKuFpS12.2yOyBuPsWqOB$sHwVyI2yOtDqRqOqE12.pA3yOxWwItTqC$rAuAwS2yOqH6.pAqMrAqEG4.tD4yOyLvTsP$.qOuFxPyOpI5.QtLuAtJtGrDE3.wQ5yOwQuXQ$2.rIvMyDrVQ4.sWxRuNsMtVuCpS3.uIwVyG2yOyIxHxCpN$2.LsPsUsFrNpNJBEyIyOwDtJvTwVqJ3.rAtOvTxPyOxU2yOpP$3.pI.pKrGrXrQqOrGyG2yDxW2yOQ4.qEsRwI4yOO$6.EqMtDuAvBuUuNuKwVyDxM6.rAxR4yO$8.sHwXvWqEqMqEtBvRtVVE4.uN4yOvM$8.qRyOsF3.pKtJsRsHrDqEpUqJsF2yOxWxEwV$8.pNxWpU4.vRwAtTrX2rSrXuUxCvRuFtOtD$8.pDvRrLV2.QyOvWpXGBGLtOsUrGpSpK$9.sFpF2qRrAuNwNpX5.pSL$12.JQuNrI$14.pX!",
  },
];

/**
 * Get organism by code
 */
export function getOrganismByCode(code: string): ReferenceOrganism | undefined {
  return REFERENCE_ORGANISMS.find((o) => o.code === code);
}

/**
 * Get organisms by family prefix
 * O = Orbidae, S = Scutidae, P = Pterae, K = Kronidae
 */
export function getOrganismsByFamily(prefix: string): ReferenceOrganism[] {
  return REFERENCE_ORGANISMS.filter((o) => o.code.startsWith(prefix));
}

/**
 * Family descriptions
 */
export const ORGANISM_FAMILIES = {
  O: {
    name: "Orbidae",
    description: "Spherical gliders - smooth oval shapes that move steadily",
  },
  S: {
    name: "Scutidae",
    description: "Shield-like oscillators and pulsers",
  },
  P: {
    name: "Pterae",
    description: "Winged/flying organisms with complex rotation",
  },
  K: {
    name: "Kronidae",
    description: "Crown-shaped complex structures",
  },
} as const;
