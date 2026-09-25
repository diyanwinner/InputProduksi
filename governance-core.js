(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GovernanceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const APPROVAL_STATES = ['draft', 'submitted', 'approved', 'rejected'];
    const isoDate = value => String(value || '').slice(0, 10);

    function canTransition(from, to) {
        const transitions = { draft: ['submitted'], submitted: ['approved', 'rejected'], rejected: ['submitted'], approved: [] };
        return APPROVAL_STATES.includes(to) && (transitions[from || 'draft'] || []).includes(to);
    }

    function isPeriodLocked(date, locks) {
        const value = isoDate(date);
        return Boolean(value && (locks || []).some(lock => value >= isoDate(lock.date_from) && value <= isoDate(lock.date_to)));
    }

    function createAuditEntry(action, entity, entityId, details = {}, actor = 'operator') {
        return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, created_at: new Date().toISOString(), actor, action, entity, entity_id: String(entityId || ''), details };
    }

    function buildBackup(logs, master, governance) {
        return { format: 'input-produksi-backup', version: 1, exported_at: new Date().toISOString(), logs: logs || [], master: master || [], governance: governance || {} };
    }

    function validateBackup(value) {
        if (!value || value.format !== 'input-produksi-backup' || value.version !== 1) return { valid: false, error: 'Format backup tidak dikenali.' };
        if (!Array.isArray(value.logs) || !Array.isArray(value.master)) return { valid: false, error: 'Data logs/master tidak valid.' };
        return { valid: true, error: '' };
    }

    function parseMasterCsv(text) {
        const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(x => x.trim().toLowerCase());
        const required = ['kode', 'nama', 'tipe', 'gram', 'runner', 'cavity'];
        if (!required.every(key => headers.includes(key))) throw new Error(`Kolom wajib: ${required.join(', ')}`);
        return lines.slice(1).map(line => {
            const values = line.split(',').map(x => x.trim());
            const row = Object.fromEntries(headers.map((key, index) => [key, values[index] || '']));
            ['gram', 'runner', 'cavity', 'cycle_time_sec', 'per_dus', 'per_box'].forEach(key => { row[key] = Number(row[key] || 0); });
            return row;
        }).filter(row => row.kode && row.nama);
    }

    return { APPROVAL_STATES, canTransition, isPeriodLocked, createAuditEntry, buildBackup, validateBackup, parseMasterCsv };
});
