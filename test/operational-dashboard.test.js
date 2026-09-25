const test = require('node:test');
const assert = require('node:assert/strict');
const dashboard = require('../operational-dashboard');

const rows = [
    { tanggal: '2026-09-24', shift: '3', line: 'L-01', kode:'P01', nama:'Produk A', okpcs: 80, reject: 20, under_target_reason: 'Mesin trouble' },
    { tanggal: '2026-09-25', shift: '1', line: 'l-01', kode:'P01', nama:'Produk A', okpcs: 90, reject: 10, planned_stop_reason: 'Material telat' },
    { tanggal: '2026-09-25', shift: '1', line: 'L-02', kode:'P02', nama:'Produk B', okpcs: 110, reject: 0, under_target_reason: 'Mesin trouble' }
];

test('finds the latest production shift and applies operational filters', () => {
    assert.deepEqual(dashboard.latestShift(rows), { key: '2026-09-25|01', tanggal: '2026-09-25', shift: '1' });
    assert.equal(dashboard.filterRows(rows, { from: '2026-09-25', to: '2026-09-25', line: '01', shift: '1' }).length, 1);
    assert.equal(dashboard.filterRows(rows, { product: 'produk' }).length, 3);
});

test('builds line snapshot ordered by the most critical gap', () => {
    const snapshot = dashboard.buildSnapshot(rows.slice(1), row => row.line.toUpperCase() === 'L-01'
        ? { targetActual: 100, gapActual: -10, capacityLossTotal: 8, unsafe: true }
        : { targetActual: 100, gapActual: 10, capacityLossTotal: 0, unsafe: false });
    assert.equal(snapshot[0].line, 'L-01');
    assert.equal(snapshot[0].achievement, 90);
    assert.equal(snapshot[0].topReason, 'Material telat');
});

test('summarizes operational reasons by frequency', () => {
    assert.deepEqual(dashboard.reasonSummary(rows)[0], { reason: 'Mesin trouble', count: 2 });
});

test('calculates cumulative pareto percentages', () => {
    const result = dashboard.pareto({ A: 60, B: 30, C: 10 });
    assert.deepEqual(result.map(x => x.cumulativePct), [60, 90, 100]);
});

test('builds target versus actual trend and line ranking', () => {
    const targetOf = row => ({ targetActual: 100, gapActual: row.okpcs - 100, unsafe: row.okpcs < 97 });
    const trend = dashboard.targetTrend(rows, targetOf);
    assert.equal(trend.at(-1).target, 200);
    assert.equal(trend.at(-1).actual, 200);
    assert.equal(dashboard.lineRanking(rows.slice(1), targetOf)[0].line, 'L-02');
});
