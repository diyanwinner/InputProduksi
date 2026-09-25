const test = require('node:test');
const assert = require('node:assert/strict');
const governance = require('../governance-core');

test('enforces approval transitions', () => {
    assert.equal(governance.canTransition('draft', 'submitted'), true);
    assert.equal(governance.canTransition('draft', 'approved'), false);
    assert.equal(governance.canTransition('approved', 'rejected'), false);
});
test('detects dates inside locked periods', () => {
    const locks = [{ date_from:'2026-09-01', date_to:'2026-09-30' }];
    assert.equal(governance.isPeriodLocked('2026-09-25', locks), true);
    assert.equal(governance.isPeriodLocked('2026-10-01', locks), false);
});
test('validates backup and parses master CSV', () => {
    const backup = governance.buildBackup([], [], {});
    assert.equal(governance.validateBackup(backup).valid, true);
    const rows = governance.parseMasterCsv('kode,nama,tipe,gram,runner,cavity\nP01,Produk,pcs,10,2,4');
    assert.deepEqual(rows[0], { kode:'P01', nama:'Produk', tipe:'pcs', gram:10, runner:2, cavity:4, cycle_time_sec:0, per_dus:0, per_box:0 });
});
