(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.OperationalDashboard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const text = value => String(value ?? '').trim();
    const normalizeLine = value => text(value).toUpperCase();

    function latestShift(rows) {
        return (rows || []).reduce((latest, row) => {
            const key = `${text(row.tanggal)}|${text(row.shift).padStart(2, '0')}`;
            return !latest || key > latest.key
                ? { key, tanggal: text(row.tanggal), shift: text(row.shift) }
                : latest;
        }, null);
    }

    function filterRows(rows, filters = {}) {
        const line = normalizeLine(filters.line);
        return (rows || []).filter(row => {
            const date = text(row.tanggal);
            return (!filters.from || date >= filters.from)
                && (!filters.to || date <= filters.to)
                && (!filters.shift || text(row.shift) === text(filters.shift))
                && (!line || normalizeLine(row.line).includes(line));
        });
    }

    function buildSnapshot(rows, targetOf) {
        const groups = new Map();
        (rows || []).forEach(row => {
            const line = normalizeLine(row.line) || '-';
            if (!groups.has(line)) groups.set(line, { line, rows: 0, ok: 0, reject: 0, target: 0, gap: 0, loss: 0, unsafe: 0, reasons: new Map() });
            const item = groups.get(line);
            const target = targetOf(row) || {};
            item.rows += 1;
            item.ok += number(row.okpcs);
            item.reject += number(row.reject);
            item.target += number(target.targetActual);
            item.gap += number(target.gapActual);
            item.loss += number(target.capacityLossTotal);
            if (target.unsafe) item.unsafe += 1;
            [row.under_target_reason, row.planned_stop_reason, row.cavity_adjust_reason].filter(Boolean).forEach(reason => {
                item.reasons.set(text(reason), (item.reasons.get(text(reason)) || 0) + 1);
            });
        });
        return [...groups.values()].map(item => ({
            ...item,
            achievement: item.target > 0 ? item.ok / item.target * 100 : 0,
            yieldPct: item.ok + item.reject > 0 ? item.ok / (item.ok + item.reject) * 100 : 0,
            topReason: [...item.reasons].sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
        })).sort((a, b) => a.gap - b.gap || a.line.localeCompare(b.line));
    }

    function reasonSummary(rows) {
        const counts = new Map();
        (rows || []).forEach(row => [row.under_target_reason, row.planned_stop_reason, row.cavity_adjust_reason]
            .filter(Boolean).forEach(reason => counts.set(text(reason), (counts.get(text(reason)) || 0) + 1)));
        return [...counts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
    }

    return { latestShift, filterRows, buildSnapshot, reasonSummary };
});
