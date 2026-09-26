/* DASHBOARD MONITORING ROOM - TARGET CONTROL v2.9.2 */

let dashboardRefreshTimer = null;
let dashboardFocusMode = 'line';
let dashboardFocusProducts = [];
let dashboardFocusProductActive = -1;

function dashFmtInt(n) { return Math.round(+n || 0).toLocaleString('id-ID'); }
function dashFmtPct(n) { return ((+n || 0).toFixed(1)) + '%'; }
function dashFmtSigned(n) { const x = Math.round(+n || 0); return (x > 0 ? '+' : '') + x.toLocaleString('id-ID'); }

document.addEventListener('DOMContentLoaded', () => {
    const btnDash = document.getElementById('btnDashboard');
    const closeDash = document.getElementById('pDashboardClose');
    const loadDash = document.getElementById('btnLoadDash');
    const autoRefresh = document.getElementById('dashAutoRefresh');
    const tvMode = document.getElementById('btnTvMode');
    const focusApply = document.getElementById('btnApplyDashFocus');
    const focusClear = document.getElementById('btnClearDashFocus');

    if(btnDash) {
        btnDash.onclick = () => {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 7); // Default 7 hari terakhir
            document.getElementById('dFrom').value = start.toISOString().slice(0,10);
            document.getElementById('dTo').value = end.toISOString().slice(0,10);
            openWorkspace('monitoring');
            renderDashboard();
        };
    }
    
    if(closeDash) closeDash.onclick = () => openWorkspace('home');
    if(loadDash) loadDash.onclick = renderDashboard;
    if(autoRefresh) autoRefresh.onchange = () => {
        clearInterval(dashboardRefreshTimer);
        dashboardRefreshTimer = autoRefresh.checked ? setInterval(() => { if(document.body.dataset.route === 'monitoring') renderDashboard(); }, 60000) : null;
    };
    if(tvMode) tvMode.onclick = () => { document.getElementById('pDashboard')?.classList.toggle('tv-mode'); tvMode.textContent = document.getElementById('pDashboard')?.classList.contains('tv-mode') ? 'KELUAR TV' : 'MODE TV'; };
    document.querySelectorAll('[data-focus-mode]').forEach(button => button.onclick = () => setDashboardFocusMode(button.dataset.focusMode));
    if(focusApply) focusApply.onclick = renderDashboard;
    if(focusClear) focusClear.onclick = clearDashboardFocus;
    installDashboardProductAutocomplete();
});

function setDashboardFocusMode(mode) {
    dashboardFocusMode = mode === 'product' ? 'product' : 'line';
    document.querySelectorAll('[data-focus-mode]').forEach(button => button.classList.toggle('active', button.dataset.focusMode === dashboardFocusMode));
    document.getElementById('dashLineControl').hidden = dashboardFocusMode !== 'line';
    document.getElementById('dashProductControl').hidden = dashboardFocusMode !== 'product';
    document.getElementById('dashFocusedContent').hidden = true;
    document.getElementById('dashFocusEmpty').hidden = false;
}

function clearDashboardFocus() {
    document.getElementById('dFocusLine').value = '';
    clearDashboardProductSelection();
    showDashboardFocusEmpty('Belum ada detail ditampilkan.');
}

function populateDashboardFocusOptions(rows) {
    const lineSelect = document.getElementById('dFocusLine');
    const currentLine = lineSelect.value;
    const lines = [...new Set(rows.map(row => (row.line || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'id', { numeric:true }));
    lineSelect.innerHTML = '<option value="">Pilih mesin...</option>' + lines.map(line => `<option value="${escapeHtml(line)}">${escapeHtml(line)}</option>`).join('');
    if(lines.includes(currentLine)) lineSelect.value = currentLine;
    const products = new Map();
    rows.forEach(row => {
        const code = String(row.kode || '').trim();
        const name = String(row.nama || '').trim();
        if(!code && !name) return;
        const key = `${normalizeDashboardProductCode(code)}|${normalizeDashboardProductText(name)}`;
        products.set(key, { code, name, label: `${code || '-'} — ${name || '-'}` });
    });
    dashboardFocusProducts = [...products.values()].sort((a,b) => a.label.localeCompare(b.label, 'id'));
    const input = document.getElementById('dFocusProduct');
    const selected = getDashboardFocusProduct();
    if(selected && !dashboardFocusProducts.some(product => product.code === selected.code && product.name === selected.name)) clearDashboardProductSelection();
    if(input === document.activeElement) renderDashboardProductOptions(input.value);
}

function showDashboardFocusEmpty(message) {
    const empty = document.getElementById('dashFocusEmpty');
    if(empty) { empty.textContent = message; empty.hidden = false; }
    const content = document.getElementById('dashFocusedContent');
    if(content) content.hidden = true;
}

function normalizeDashboardProductText(value) { return String(value || '').trim().toLocaleLowerCase('id-ID'); }
function normalizeDashboardProductCode(value) { return String(value || '').trim().toUpperCase(); }

function getDashboardFocusProduct() {
    const input = document.getElementById('dFocusProduct');
    if(!input?.dataset.productCode && !input?.dataset.productName) return null;
    return { code: input.dataset.productCode || '', name: input.dataset.productName || '', label: input.value.trim() };
}

function clearDashboardProductSelection() {
    const input = document.getElementById('dFocusProduct');
    if(!input) return;
    input.value = '';
    delete input.dataset.productCode;
    delete input.dataset.productName;
    hideDashboardProductOptions();
}

function setDashboardFocusProduct(product) {
    const input = document.getElementById('dFocusProduct');
    if(!input || !product) return;
    input.dataset.productCode = product.code || '';
    input.dataset.productName = product.name || '';
    input.value = product.label;
    hideDashboardProductOptions();
}

function hideDashboardProductOptions() {
    const options = document.getElementById('dashProductOptions');
    const input = document.getElementById('dFocusProduct');
    if(options) { options.hidden = true; options.innerHTML = ''; }
    if(input) input.setAttribute('aria-expanded', 'false');
    dashboardFocusProductActive = -1;
}

function renderDashboardProductOptions(query = '') {
    const options = document.getElementById('dashProductOptions');
    const input = document.getElementById('dFocusProduct');
    if(!options || !input) return;
    const term = normalizeDashboardProductText(query);
    const matches = dashboardFocusProducts.filter(product => !term || normalizeDashboardProductText(product.code).includes(term) || normalizeDashboardProductText(product.name).includes(term)).slice(0, 60);
    dashboardFocusProductActive = matches.length ? 0 : -1;
    options.innerHTML = matches.length ? matches.map((product, index) => `<button type="button" class="dash-product-option${index === dashboardFocusProductActive ? ' active' : ''}" role="option" aria-selected="${index === dashboardFocusProductActive}" data-product-index="${dashboardFocusProducts.indexOf(product)}"><strong>${escapeHtml(product.code || '-')}</strong><small>${escapeHtml(product.name || '-')}</small></button>`).join('') : '<div class="dash-product-no-result">Produk tidak ditemukan.</div>';
    options.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    options.querySelectorAll('[data-product-index]').forEach(button => button.onclick = () => setDashboardFocusProduct(dashboardFocusProducts[Number(button.dataset.productIndex)]));
}

function updateDashboardProductActive(direction) {
    const buttons = [...document.querySelectorAll('#dashProductOptions [data-product-index]')];
    if(!buttons.length) return;
    dashboardFocusProductActive = (dashboardFocusProductActive + direction + buttons.length) % buttons.length;
    buttons.forEach((button, index) => {
        const active = index === dashboardFocusProductActive;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        if(active) button.scrollIntoView({ block:'nearest' });
    });
}

function installDashboardProductAutocomplete() {
    const input = document.getElementById('dFocusProduct');
    if(!input) return;
    input.addEventListener('input', () => {
        delete input.dataset.productCode;
        delete input.dataset.productName;
        renderDashboardProductOptions(input.value);
    });
    input.addEventListener('focus', () => renderDashboardProductOptions(input.value));
    input.addEventListener('keydown', event => {
        const options = document.getElementById('dashProductOptions');
        if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if(options.hidden) renderDashboardProductOptions(input.value);
            else updateDashboardProductActive(event.key === 'ArrowDown' ? 1 : -1);
        } else if(event.key === 'Enter' && !options.hidden && dashboardFocusProductActive >= 0) {
            event.preventDefault();
            const option = options.querySelectorAll('[data-product-index]')[dashboardFocusProductActive];
            if(option) setDashboardFocusProduct(dashboardFocusProducts[Number(option.dataset.productIndex)]);
        } else if(event.key === 'Escape') {
            hideDashboardProductOptions();
        }
    });
    document.addEventListener('pointerdown', event => {
        if(!event.target.closest('.dash-product-autocomplete')) hideDashboardProductOptions();
    });
}

function renderDashboard() {
    // Cek data global dari app.js
    if(typeof logs === 'undefined' || logs.length === 0) {
        alert("Data belum siap atau kosong. Refresh halaman utama dulu.");
        return;
    }

    const startStr = document.getElementById('dFrom').value;
    const endStr = document.getElementById('dTo').value;
    const shiftFilter = document.getElementById('dShift')?.value || '';

    // 1. FILTER DATA
    const sourceRows = typeof uniqueDashboardLogs === 'function' ? uniqueDashboardLogs(logs) : logs;
    const periodData = OperationalDashboard.filterRows(sourceRows, { from: startStr, to: endStr, shift: shiftFilter });

    if(periodData.length === 0) {
        const hasFocus = dashboardFocusMode === 'line' ? Boolean(document.getElementById('dFocusLine').value.trim()) : Boolean(document.getElementById('dFocusProduct').value.trim());
        if(hasFocus) showDashboardFocusEmpty('Tidak ada data untuk pilihan ini pada periode dan shift yang dipilih.');
        else alert("Tidak ada data produksi di periode/filter ini.");
        return;
    }

    // 2. HITUNG KPI CARD
    let totalHasil=0, totalOk=0, totalReject=0, sumYield=0;
    periodData.forEach(r => {
        totalHasil += (+r.hasil); 
        totalOk += (+r.okpcs); 
        totalReject += (+r.reject); 
        sumYield += (+r.yieldpct);
    });
    
    document.getElementById('kpiHasil').innerText = totalHasil.toLocaleString();
    document.getElementById('kpiOk').innerText = totalOk.toLocaleString();
    document.getElementById('kpiReject').innerText = totalReject.toLocaleString();
    document.getElementById('kpiYield').innerText = (periodData.length ? (sumYield / periodData.length) : 0).toFixed(2) + "%";

    const summaryTargets = (typeof extractLogTarget === 'function') ? periodData.map(r => ({ raw:r, tg: extractLogTarget(r) })).filter(x => x.tg.targetActual > 0) : [];
    const targetBad = summaryTargets.filter(x => typeof isTargetUnsafe === 'function' ? isTargetUnsafe(x.tg.status) : x.tg.gapActual < 0);
    const targetOk = summaryTargets.filter(x => typeof isTargetUnsafe === 'function' ? !isTargetUnsafe(x.tg.status) : x.tg.gapActual >= 0);
    const gapActualTotal = summaryTargets.reduce((sum, x) => sum + x.tg.gapActual, 0);
    const capacityLossTotal = summaryTargets.reduce((sum, x) => sum + (x.tg.capacityLossTotal || 0), 0);
    if(document.getElementById('kpiTargetBad')) document.getElementById('kpiTargetBad').innerText = targetBad.length.toLocaleString('id-ID');
    if(document.getElementById('kpiTargetOk')) document.getElementById('kpiTargetOk').innerText = targetOk.length.toLocaleString('id-ID');
    if(document.getElementById('kpiGapActual')) document.getElementById('kpiGapActual').innerText = dashFmtSigned(gapActualTotal);
    if(document.getElementById('kpiCapacityLoss')) document.getElementById('kpiCapacityLoss').innerText = dashFmtInt(capacityLossTotal);
    renderGlobalOperationalSnapshot(periodData, startStr, endStr, shiftFilter);

    populateDashboardFocusOptions(periodData);
    const focusValue = dashboardFocusMode === 'line' ? document.getElementById('dFocusLine').value.trim() : document.getElementById('dFocusProduct').value.trim();
    if(!focusValue) { clearDashboardFocus(); return; }
    const selectedProduct = dashboardFocusMode === 'product' ? getDashboardFocusProduct() : null;
    if(dashboardFocusMode === 'product' && !selectedProduct) {
        showDashboardFocusEmpty('Pilih produk dari daftar pencarian terlebih dahulu.');
        return;
    }
    const dataDash = periodData.filter(row => dashboardFocusMode === 'line'
        ? String(row.line || '').toUpperCase() === focusValue.toUpperCase()
        : (selectedProduct.code
            ? normalizeDashboardProductCode(row.kode) === normalizeDashboardProductCode(selectedProduct.code)
            : normalizeDashboardProductText(row.nama) === normalizeDashboardProductText(selectedProduct.name)));
    if(!dataDash.length) { showDashboardFocusEmpty('Tidak ada data untuk pilihan ini pada periode dan shift yang dipilih.'); return; }
    document.getElementById('dashFocusEmpty').hidden = true;
    document.getElementById('dashFocusedContent').hidden = false;
    document.getElementById('dashFocusResultTitle').textContent = dashboardFocusMode === 'line' ? `Mesin ${focusValue}` : `Produk ${selectedProduct.label}`;
    renderOperationalSnapshot(dataDash, startStr, endStr, shiftFilter, dashboardFocusMode);
    return;
}

function renderGlobalOperationalSnapshot(data, start, end, shift) {
    const targetOf = row => {
        const target = typeof extractLogTarget === 'function' ? extractLogTarget(row) : {};
        return { ...target, unsafe: typeof isTargetUnsafe === 'function' ? isTargetUnsafe(target.status) : (+target.gapActual || 0) < 0 };
    };
    const snapshot = OperationalDashboard.buildSnapshot(data, targetOf);
    const periodBadge = document.getElementById('opsPeriodBadge');
    if(periodBadge) periodBadge.textContent = `${start} — ${end}${shift ? ` · Shift ${shift}` : ''}`;
    const grid = document.getElementById('opsLineGrid');
    if(grid) grid.innerHTML = snapshot.length ? snapshot.map(line => {
        const state = line.unsafe ? 'critical' : line.achievement < 97 ? 'watch' : 'safe';
        const label = state === 'critical' ? 'Tindak lanjut' : state === 'watch' ? 'Pantau' : 'Aman';
        return `<article class="ops-line-card ${state}"><div class="ops-line-head"><strong>${escapeHtml(line.line)}</strong><span>${label}</span></div><div class="ops-line-ach">${dashFmtPct(line.achievement)}</div><small>Pencapaian target aktual</small><div class="ops-line-metrics"><span><b>${dashFmtSigned(line.gap)}</b> Gap</span><span><b>${dashFmtInt(line.reject)}</b> Reject</span><span><b>${dashFmtPct(line.yieldPct)}</b> Yield</span></div><div class="ops-line-reason" title="Penyebab dominan">${escapeHtml(line.topReason)}</div></article>`;
    }).join('') : '<div class="ops-empty">Tidak ada snapshot line untuk filter ini.</div>';
    const queue = document.getElementById('opsActionQueue');
    const critical = snapshot.filter(line => line.unsafe || line.gap < 0).slice(0, 6);
    if(queue) queue.innerHTML = critical.length ? critical.map((line, index) => `<div class="ops-action-item"><span>${index + 1}</span><div><b>${escapeHtml(line.line)} · Gap ${dashFmtSigned(line.gap)}</b><small>${escapeHtml(line.topReason)} · loss ${dashFmtInt(line.loss)} pcs</small></div></div>`).join('') : '<div class="ops-empty compact">Tidak ada data kritis.</div>';
    const reasonList = document.getElementById('opsReasonList');
    const reasons = OperationalDashboard.reasonSummary(data).slice(0, 5);
    const max = reasons[0]?.count || 1;
    if(reasonList) reasonList.innerHTML = reasons.length ? reasons.map(item => `<div class="ops-reason-item"><div><span>${escapeHtml(item.reason)}</span><b>${item.count}</b></div><i style="--reason-width:${item.count / max * 100}%"></i></div>`).join('') : '<div class="ops-empty compact">Belum ada alasan tercatat.</div>';
}

function renderOperationalSnapshot(data, start, end, shift, mode = 'line') {
    const targetOf = row => {
        const target = typeof extractLogTarget === 'function' ? extractLogTarget(row) : {};
        return { ...target, unsafe: typeof isTargetUnsafe === 'function' ? isTargetUnsafe(target.status) : (+target.gapActual || 0) < 0 };
    };
    const snapshot = mode === 'line'
        ? OperationalDashboard.buildProductBreakdown(data, targetOf)
        : OperationalDashboard.buildSnapshot(data, targetOf);
    const periodBadge = document.getElementById('dashFocusPeriodBadge');
    if(periodBadge) periodBadge.textContent = `${start} — ${end}${shift ? ` · Shift ${shift}` : ''}`;

    const totals = data.reduce((summary, row) => {
        const target = targetOf(row);
        summary.production += +row.hasil || 0;
        summary.ok += +row.okpcs || 0;
        summary.reject += +row.reject || +row.rejectpcs || 0;
        summary.target += +target.targetActual || 0;
        summary.gap += +target.gapActual || 0;
        summary.loss += +target.capacityLossTotal || 0;
        return summary;
    }, { production:0, ok:0, reject:0, target:0, gap:0, loss:0 });
    const achievement = totals.target > 0 ? totals.ok / totals.target * 100 : 0;
    const yieldPct = totals.ok + totals.reject > 0 ? totals.ok / (totals.ok + totals.reject) * 100 : 0;
    const meta = document.getElementById('dashFocusResultMeta');
    if(meta) meta.textContent = `${dashFmtInt(data.length)} laporan · Produksi ${dashFmtInt(totals.production)} pcs · OK ${dashFmtInt(totals.ok)} pcs${totals.loss ? ` · Loss capacity ${dashFmtInt(totals.loss)} pcs` : ''}`;
    const summary = document.getElementById('dashFocusSummary');
    if(summary) summary.innerHTML = [
        ['Achievement', dashFmtPct(achievement), 'target aktual'],
        ['Gap target', dashFmtSigned(totals.gap), 'pcs'],
        ['Reject', dashFmtInt(totals.reject), 'pcs'],
        ['Yield', dashFmtPct(yieldPct), 'OK / output']
    ].map(([label, value, hint]) => `<article class="dash-focus-kpi"><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`).join('');

    const grid = document.getElementById('dashFocusGrid');
    if(grid) grid.innerHTML = snapshot.length ? snapshot.map(line => {
        const state = line.unsafe ? 'critical' : line.achievement < 97 ? 'watch' : 'safe';
        const label = state === 'critical' ? 'Tindak lanjut' : state === 'watch' ? 'Pantau' : 'Aman';
        return `<article class="ops-line-card ${state}">
            <div class="ops-line-head"><strong>${escapeHtml(line.label || line.line)}</strong><span>${label}</span></div>
            <div class="ops-line-ach">${dashFmtPct(line.achievement)}</div><small>Pencapaian target aktual</small>
            <div class="ops-line-metrics"><span><b>${dashFmtSigned(line.gap)}</b> Gap</span><span><b>${dashFmtInt(line.reject)}</b> Reject</span><span><b>${dashFmtPct(line.yieldPct)}</b> Yield</span></div>
            <div class="ops-line-reason" title="Penyebab dominan">${escapeHtml(line.topReason)}</div>
        </article>`;
    }).join('') : '<div class="ops-empty">Tidak ada snapshot line untuk filter ini.</div>';

    const queue = document.getElementById('dashFocusActionQueue');
    const critical = snapshot.filter(line => line.unsafe || line.gap < 0).slice(0, 6);
    if(queue) queue.innerHTML = critical.length ? critical.map((line, index) => `<div class="ops-action-item"><span>${index + 1}</span><div><b>${escapeHtml(line.label || line.line)} · Gap ${dashFmtSigned(line.gap)}</b><small>${escapeHtml(line.topReason)} · loss ${dashFmtInt(line.loss)} pcs</small></div></div>`).join('') : '<div class="ops-empty compact">Tidak ada data kritis.</div>';

    const reasonList = document.getElementById('dashFocusReasonList');
    const reasons = OperationalDashboard.reasonSummary(data).slice(0, 5);
    const max = reasons[0]?.count || 1;
    if(reasonList) reasonList.innerHTML = reasons.length ? reasons.map(item => `<div class="ops-reason-item"><div><span>${escapeHtml(item.reason)}</span><b>${item.count}</b></div><i style="--reason-width:${item.count / max * 100}%"></i></div>`).join('') : '<div class="ops-empty compact">Belum ada alasan tercatat.</div>';
}
