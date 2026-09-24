const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../production-core.js');

const base = {
    gram: 10, runnerGram: 2, standardCavity: 4, activeCavity: 4, counter: 1000,
    beforeRemainder: 0, afterRemainder: 0, packedPcs: 4000,
    materialAllocation: 50, materialStock: 0, blockKg: 0,
    cycleTimeSec: 10, effectiveHours: 8, standardShiftHours: 8, type: 'pcs'
};

test('menghitung output, berat, reject, dan yield produksi', () => {
    const result = core.calculateProduction({ ...base, packedPcs: 3900 });
    assert.equal(result.productionPcs, 4000);
    assert.equal(result.okPcs, 3900);
    assert.equal(result.rejectPcs, 100);
    assert.equal(result.okKg, 39);
    assert.equal(result.rejectKg, 1);
    assert.equal(result.yieldPct, 97.5);
});

test('mengonversi sisa tipe kg menjadi pcs', () => {
    const result = core.calculateProduction({ ...base, type: 'kg_sisa', beforeRemainder: 1, afterRemainder: 0.5 });
    assert.equal(result.beforePcs, 100);
    assert.equal(result.afterPcs, 50);
    assert.equal(result.okPcs, 3950);
    assert.equal(result.resultPcs, 4050);
});

test('menghitung target standar untuk shift penuh', () => {
    const result = core.calculateProduction(base);
    assert.equal(result.shotPerHour, 360);
    assert.equal(result.targetHourStandard, 1440);
    assert.equal(result.targetStandardPcs, 11520);
    assert.equal(result.targetActualPcs, 11520);
    assert.equal(result.capacityLossTotalPcs, 0);
});

test('menghitung capacity loss saat jam efektif dan cavity turun', () => {
    const result = core.calculateProduction({ ...base, activeCavity: 3, effectiveHours: 6 });
    assert.equal(result.targetActualPcs, 6480);
    assert.equal(result.timeLossPcs, 2880);
    assert.equal(result.cavityLossPcs, 2160);
    assert.equal(result.capacityLossTotalPcs, 5040);
});

test('mengklasifikasikan semua zona status target', () => {
    assert.equal(core.targetStatus(0, 0, 0), 'NO_TARGET');
    assert.equal(core.targetStatus(970, 1000, 1000), 'TARGET_STANDARD_TERCAPAI');
    assert.equal(core.targetStatus(780, 1000, 800), 'TERCAPAI_AKTUAL_LOSS_CAPACITY');
    assert.equal(core.targetStatus(920, 1000, 1000), 'HAMPIR_TIDAK_TARGET');
    assert.equal(core.targetStatus(899, 1000, 1000), 'TIDAK_TARGET');
});

test('membatasi jam efektif ke rentang operasional', () => {
    assert.equal(core.clampEffectiveHours(12, 8), 8);
    assert.equal(core.clampEffectiveHours(0, 8), 8);
    assert.equal(core.clampEffectiveHours(-2, 8), 1);
});
