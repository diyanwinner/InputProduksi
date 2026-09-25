const test = require('node:test');
const assert = require('node:assert/strict');
const dashboard = require('../operational-dashboard');

const rows = [
    { tanggal: '2026-09-24', shift: '3', line: 'L-01', okpcs: 80, reject: 20, under_target_reason: 'Mesin trouble' },
    { tanggal: '2026-09-25', shift: '1', line: 'l-01', okpcs: 90, reject: 10, planned_stop_reason: 'Material telat' },
    { tanggal: '2026-09-25', shift: '1', line: 'L-02', okpcs: 110, reject: 0, under_target_reason: 'Mesin trouble' }
];

test('finds the latest production shift and applies operational filters', () => {
    assert.deepEqual(dashboard.latestShift(rows), { key: '2026-09-25|01', tanggal: '2026-09-25', shift: '1' });
    assert.equal(dashboard.filterRows(rows, { from: '2026-09-25', to: '2026-09-25', line: '01', shift: '1' }).length, 1);
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
