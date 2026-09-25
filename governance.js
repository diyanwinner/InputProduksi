/* Fase 5 governance console. Supabase connection and the existing admin PIN remain untouched. */
const GOVERNANCE_KEY = 'prod_governance_v1';

function loadGovernance() {
    try { return { locks: [], approvals: {}, audit: [], errors: [], ...(JSON.parse(localStorage.getItem(GOVERNANCE_KEY)) || {}) }; }
    catch (_) { return { locks: [], approvals: {}, audit: [], errors: [] }; }
}
function saveGovernance(state) { localStorage.setItem(GOVERNANCE_KEY, JSON.stringify(state)); }
function governanceAudit(action, entity, entityId, details) {
    const state = loadGovernance();
    state.audit.unshift(GovernanceCore.createAuditEntry(action, entity, entityId, details));
    state.audit = state.audit.slice(0, 500);
    saveGovernance(state);
}
function isGovernancePeriodLocked(date) { return GovernanceCore.isPeriodLocked(date, loadGovernance().locks); }
function recordGovernanceError(scope, error) {
    const state = loadGovernance();
    state.errors.unshift({ at: new Date().toISOString(), scope, message: String(error?.message || error) });
    state.errors = state.errors.slice(0, 100); saveGovernance(state);
}

document.addEventListener('DOMContentLoaded', () => {
    $('btnGovernance')?.addEventListener('click', () => checkAdmin(() => { adminWorkspaceGranted = true; openWorkspace('governance'); renderGovernance(); }));
    $('mGovernanceClose')?.addEventListener('click', () => openWorkspace('home'));
    $('btnAddLock')?.addEventListener('click', addPeriodLock);
    $('btnExportBackup')?.addEventListener('click', exportGovernanceBackup);
    $('btnImportMasterCsv')?.addEventListener('click', () => $('governanceMasterFile')?.click());
    $('governanceMasterFile')?.addEventListener('change', importMasterCsv);
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(error => recordGovernanceError('service_worker', error));
});

window.addEventListener('error', event => recordGovernanceError('javascript', event.error || event.message));
window.addEventListener('unhandledrejection', event => recordGovernanceError('promise', event.reason));

function renderGovernance() {
    const state = loadGovernance();
    const pending = (logs || []).filter(row => (state.approvals[row.id] || 'draft') === 'submitted');
    $('govPendingCount').textContent = pending.length;
    $('govLockCount').textContent = state.locks.length;
    $('govErrorCount').textContent = state.errors.length;
    $('govApprovalBody').innerHTML = (logs || []).slice(0, 100).map(row => {
        const status = state.approvals[row.id] || 'draft';
        return `<tr><td>${escapeHtml(row.tanggal)}</td><td>${escapeHtml(row.line)}</td><td>${escapeHtml(row.kode)}</td><td><span class="gov-status ${status}">${status}</span></td><td><select class="input gov-approval" data-id="${escapeHtml(row.id)}"><option value="">Ubah status</option>${GovernanceCore.APPROVAL_STATES.filter(next => GovernanceCore.canTransition(status, next)).map(next => `<option value="${next}">${next}</option>`).join('')}</select></td></tr>`;
    }).join('') || '<tr><td colspan="5">Belum ada laporan.</td></tr>';
    document.querySelectorAll('.gov-approval').forEach(select => select.onchange = () => updateApproval(select.dataset.id, select.value));
    $('govLockList').innerHTML = state.locks.map((lock, index) => `<div class="gov-list-item"><span>${escapeHtml(lock.date_from)} — ${escapeHtml(lock.date_to)}<small>${escapeHtml(lock.reason || 'Periode ditutup')}</small></span><button class="btn sm" data-unlock="${index}">Buka</button></div>`).join('') || '<div class="muted">Belum ada periode dikunci.</div>';
    document.querySelectorAll('[data-unlock]').forEach(button => button.onclick = () => { state.locks.splice(+button.dataset.unlock, 1); governanceAudit('unlock', 'period', '', {}); saveGovernance(state); renderGovernance(); });
    $('govAuditBody').innerHTML = state.audit.slice(0, 50).map(item => `<tr><td>${escapeHtml(new Date(item.created_at).toLocaleString('id-ID'))}</td><td>${escapeHtml(item.action)}</td><td>${escapeHtml(item.entity)}</td><td>${escapeHtml(item.entity_id)}</td></tr>`).join('') || '<tr><td colspan="4">Belum ada aktivitas.</td></tr>';
    $('govErrorList').innerHTML = state.errors.slice(0, 10).map(item => `<div class="gov-list-item"><span>${escapeHtml(item.scope)}<small>${escapeHtml(item.message)}</small></span><time>${escapeHtml(new Date(item.at).toLocaleString('id-ID'))}</time></div>`).join('') || '<div class="muted">Tidak ada error tercatat.</div>';
}

function updateApproval(id, next) {
    if(!next) return; const state = loadGovernance(), current = state.approvals[id] || 'draft';
    if(!GovernanceCore.canTransition(current, next)) return alert('Transisi approval tidak diizinkan.');
    state.approvals[id] = next; saveGovernance(state); governanceAudit('approval', 'logs', id, { from: current, to: next }); renderGovernance();
}
function addPeriodLock() {
    const from = $('govLockFrom').value, to = $('govLockTo').value;
    if(!from || !to || from > to) return alert('Rentang periode tidak valid.');
    const state = loadGovernance(); state.locks.push({ date_from: from, date_to: to, reason: $('govLockReason').value.trim() }); saveGovernance(state); governanceAudit('lock', 'period', `${from}:${to}`, {}); renderGovernance();
}
function downloadJson(name, value) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type:'application/json' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
function exportGovernanceBackup() { governanceAudit('backup', 'system', '', {}); downloadJson(`input-produksi-${todayISO()}.json`, GovernanceCore.buildBackup(logs, master, loadGovernance())); }
async function importMasterCsv(event) {
    try {
        const rows = GovernanceCore.parseMasterCsv(await event.target.files[0].text());
        if(!rows.length || !confirm(`Import ${rows.length} produk ke master?`)) return;
        const payload = rows.map(row => ({ id: uid(), ...row })); const { error } = await client.from('master').upsert(payload); if(error) throw error;
        governanceAudit('import', 'master', '', { count: rows.length }); await refreshData(false); renderGovernance();
    } catch(error) { recordGovernanceError('import_master', error); alert(`Import gagal: ${error.message}`); renderGovernance(); }
    finally { event.target.value = ''; }
}
