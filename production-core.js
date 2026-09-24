(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ProductionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const STANDARD_SHIFT_HOURS = 8;
    const TARGET_TOLERANCE_PCT = 97;
    const TARGET_CRITICAL_PCT = 90;

    function toNumber(value) {
        return Number.isFinite(Number(value)) ? Number(value) : 0;
    }

    function clampEffectiveHours(value, standardHours = STANDARD_SHIFT_HOURS) {
        const hours = toNumber(value) || standardHours;
        return Math.min(standardHours, Math.max(1, hours));
    }

    function targetShotPerHour(cycleTimeSec) {
        const cycleTime = toNumber(cycleTimeSec);
        return cycleTime > 0 ? Math.round(3600 / cycleTime) : 0;
    }

    function targetStatus(okPcs, targetStandard, targetActual) {
        const ok = toNumber(okPcs);
        const actual = toNumber(targetActual);
        const standard = toNumber(targetStandard) > 0 ? toNumber(targetStandard) : actual;
        if (actual <= 0) return 'NO_TARGET';

        const achievement = (ok / actual) * 100;
        if (ok >= standard * (TARGET_TOLERANCE_PCT / 100)) return 'TARGET_STANDARD_TERCAPAI';
        if (ok >= actual * (TARGET_TOLERANCE_PCT / 100)) return 'TERCAPAI_AKTUAL_LOSS_CAPACITY';
        if (achievement >= TARGET_CRITICAL_PCT) return 'HAMPIR_TIDAK_TARGET';
        return 'TIDAK_TARGET';
    }

    function calculateProduction(input) {
        const standardHours = toNumber(input.standardShiftHours) || STANDARD_SHIFT_HOURS;
        const effectiveHours = clampEffectiveHours(input.effectiveHours, standardHours);
        const gram = toNumber(input.gram);
        const standardCavity = Math.max(1, toNumber(input.standardCavity));
        const activeCavity = Math.min(Math.max(1, toNumber(input.activeCavity)), standardCavity);
        const counter = toNumber(input.counter);
        const beforeRaw = toNumber(input.beforeRemainder);
        const afterRaw = toNumber(input.afterRemainder);
        const remainderFactor = input.type === 'kg_sisa' && gram > 0 ? 1000 / gram : 1;
        const beforePcs = beforeRaw * remainderFactor;
        const afterPcs = afterRaw * remainderFactor;
        const packedPcs = toNumber(input.packedPcs);
        const okPcs = packedPcs - beforePcs + afterPcs;
        const productionPcs = counter * activeCavity;
        const resultPcs = productionPcs + beforePcs - afterPcs;
        const rejectPcs = productionPcs - okPcs;
        const okKg = (okPcs * gram) / 1000;
        const rejectKg = (rejectPcs * gram) / 1000;
        const runnerKg = (counter * toNumber(input.runnerGram)) / 1000;
        const remainingMaterialKg = toNumber(input.materialAllocation) + toNumber(input.materialStock)
            - runnerKg - rejectKg - okKg - toNumber(input.blockKg);
        const yieldPct = resultPcs > 0 ? (okPcs / resultPcs) * 100 : 0;

        const shotPerHour = targetShotPerHour(input.cycleTimeSec);
        const targetHourStandard = shotPerHour * standardCavity;
        const targetHourActual = shotPerHour * activeCavity;
        const plannedStopHours = Math.max(0, standardHours - effectiveHours);
        const targetStandardPcs = targetHourStandard * standardHours;
        const targetActualPcs = targetHourActual * effectiveHours;
        const achievementStandardPct = targetStandardPcs > 0 ? (okPcs / targetStandardPcs) * 100 : 0;
        const achievementActualPct = targetActualPcs > 0 ? (okPcs / targetActualPcs) * 100 : 0;

        return {
            standardHours, effectiveHours, plannedStopHours, standardCavity, activeCavity,
            beforePcs, afterPcs, packedPcs, productionPcs, resultPcs, okPcs, rejectPcs,
            okKg, rejectKg, runnerKg, remainingMaterialKg, yieldPct,
            shotPerHour, targetHourStandard, targetHourActual, targetStandardPcs, targetActualPcs,
            achievementStandardPct, achievementActualPct,
            gapStandardPcs: targetStandardPcs > 0 ? okPcs - targetStandardPcs : 0,
            gapActualPcs: targetActualPcs > 0 ? okPcs - targetActualPcs : 0,
            timeLossPcs: Math.max(0, targetHourStandard * plannedStopHours),
            cavityLossPcs: Math.max(0, shotPerHour * (standardCavity - activeCavity) * effectiveHours),
            capacityLossTotalPcs: Math.max(0, targetStandardPcs - targetActualPcs),
            status: targetStatus(okPcs, targetStandardPcs, targetActualPcs),
            overpack: packedPcs > resultPcs
        };
    }

    return {
        STANDARD_SHIFT_HOURS, TARGET_TOLERANCE_PCT, TARGET_CRITICAL_PCT,
        toNumber, clampEffectiveHours, targetShotPerHour, targetStatus, calculateProduction
    };
});
