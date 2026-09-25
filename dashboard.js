/* DASHBOARD MONITORING ROOM - TARGET CONTROL v2.9.2 */

let chartTrendInstance = null;
let chartParetoInstance = null;
let chartDowntimeInstance = null;
let dashboardRefreshTimer = null;
let dashboardFocusMode = 'line';

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
    document.getElementById('dashAnalytics')?.addEventListener('toggle', event => { if(event.target.open) renderDashboard(); });
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
    document.getElementById('dFocusProduct').value = '';
    document.getElementById('dashFocusedContent').hidden = true;
    document.getElementById('dashFocusEmpty').hidden = false;
    document.getElementById('dashAnalytics').open = false;
}

function populateDashboardFocusOptions(rows) {
    const lineSelect = document.getElementById('dFocusLine');
    const currentLine = lineSelect.value;
    const lines = [...new Set(rows.map(row => (row.line || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'id', { numeric:true }));
    lineSelect.innerHTML = '<option value="">Pilih mesin...</option>' + lines.map(line => `<option value="${escapeHtml(line)}">${escapeHtml(line)}</option>`).join('');
    if(lines.includes(currentLine)) lineSelect.value = currentLine;
    const products = new Map(); rows.forEach(row => { if(row.kode || row.nama) products.set(`${row.kode || ''}|${row.nama || ''}`, `${row.kode || '-'} — ${row.nama || '-'}`); });
    document.getElementById('dashProductOptions').innerHTML = [...products.values()].sort().map(label => `<option value="${escapeHtml(label)}"></option>`).join('');
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
        alert("Tidak ada data produksi di periode/filter ini.");
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

    populateDashboardFocusOptions(periodData);
    const focusValue = dashboardFocusMode === 'line' ? document.getElementById('dFocusLine').value.trim() : document.getElementById('dFocusProduct').value.trim();
    if(!focusValue) { clearDashboardFocus(); return; }
    const productCode = focusValue.split(' — ')[0].trim();
    const dataDash = periodData.filter(row => dashboardFocusMode === 'line'
        ? String(row.line || '').toUpperCase() === focusValue.toUpperCase()
        : String(row.kode || '').toUpperCase() === productCode.toUpperCase() || String(row.nama || '').toLowerCase().includes(focusValue.toLowerCase()));
    if(!dataDash.length) { document.getElementById('dashFocusEmpty').textContent = 'Data pilihan tidak ditemukan pada periode ini.'; document.getElementById('dashFocusEmpty').hidden = false; document.getElementById('dashFocusedContent').hidden = true; return; }
    document.getElementById('dashFocusEmpty').hidden = true;
    document.getElementById('dashFocusedContent').hidden = false;
    document.getElementById('opsSnapshotTitle').textContent = dashboardFocusMode === 'line' ? `Mesin ${focusValue}` : `Produk ${focusValue}`;
    renderOperationalSnapshot(dataDash, startStr, endStr, shiftFilter);
    if(!document.getElementById('dashAnalytics').open) return;
    const targetRows = dataDash.map(r => ({ raw:r, tg:extractLogTarget(r) })).filter(x => x.tg.targetActual > 0);

    // 3. CHART 1: TREND PRODUKSI
    const trend = OperationalDashboard.targetTrend(dataDash, extractLogTarget);
    const labelsTrend = trend.map(point => point.date);
    
    const ctxTrend = document.getElementById('chartTrend').getContext('2d');
    if(chartTrendInstance) chartTrendInstance.destroy();
    chartTrendInstance = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: labelsTrend,
            datasets: [
                { label: 'Target Aktual', data: trend.map(point => point.target), borderColor: '#FBBF24', backgroundColor: 'rgba(251,191,36,.12)', tension:.25, fill:true },
                { label: 'OK Aktual', data: trend.map(point => point.actual), borderColor: '#34D399', backgroundColor: 'rgba(52,211,153,.1)', tension:.25, fill:true }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { x: { ticks:{color:'#94A3B8'} }, y: { beginAtZero:true, ticks:{color:'#94A3B8'}, grid:{color:'rgba(148,163,184,0.16)'} } },
            plugins: { legend: { position:'bottom', labels: {color:'#E2E8F0'} } } 
        }
    });

    // 4. CHART 2: PARETO REJECT
    const rejectKeys = ['uneven', 'mottled', 'startup', 'short', 'flow', 'flashing', 'crack', 'spot', 'scratch', 'dirty'];
    const rejectCounts = {}; rejectKeys.forEach(k => rejectCounts[k] = 0);
    
    dataDash.forEach(r => {
        rejectCounts['uneven'] += (+r.reject_uneven || 0); rejectCounts['mottled'] += (+r.reject_mottled || 0);
        rejectCounts['startup'] += (+r.reject_startup || 0); rejectCounts['short'] += (+r.reject_short || 0);
        rejectCounts['flow'] += (+r.reject_flow || 0); rejectCounts['flashing'] += (+r.reject_flashing || 0);
        rejectCounts['crack'] += (+r.reject_crack || 0); rejectCounts['spot'] += (+r.reject_spot || 0);
        rejectCounts['scratch'] += (+r.reject_scratch || 0); rejectCounts['dirty'] += (+r.reject_dirty || 0);
    });

    const sortedPareto = OperationalDashboard.pareto(rejectCounts);
    
    const ctxPareto = document.getElementById('chartPareto').getContext('2d');
    if(chartParetoInstance) chartParetoInstance.destroy();
    
    chartParetoInstance = new Chart(ctxPareto, {
        data: {
            labels: sortedPareto.map(x => x.label.toUpperCase()),
            datasets: [{ type:'bar', label:'Total Defect', data:sortedPareto.map(x => x.value), backgroundColor:'#818CF8', borderRadius:4, yAxisID:'y' }, { type:'line', label:'Kumulatif %', data:sortedPareto.map(x => x.cumulativePct), borderColor:'#FBBF24', pointBackgroundColor:'#FBBF24', yAxisID:'pct' }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { position:'bottom', labels:{color:'#E2E8F0'} }, annotation: {} },
            scales: { x: { ticks:{color:'#E2E8F0'} }, y:{beginAtZero:true,ticks:{color:'#94A3B8'}}, pct:{position:'right',min:0,max:100,ticks:{color:'#FBBF24',callback:value=>value+'%'},grid:{drawOnChartArea:false}} }
        }
    });

    renderDowntimeAndRanking(dataDash);
    

    // 5. TARGET CONTROL DETAIL TABLE
    const targetDetailBody = document.querySelector('#tblTargetDetail tbody');
    if(targetDetailBody && typeof extractLogTarget === 'function') {
        const rows = targetRows
            .sort((a,b) => a.tg.gapActual - b.tg.gapActual)
            .slice(0, 80);
        targetDetailBody.innerHTML = rows.map(x => {
            const r = x.raw;
            const tg = x.tg;
            const meta = (typeof statusMeta === 'function') ? statusMeta(tg.status) : { label: tg.gapActual < 0 ? 'Tidak Target' : 'Aman', cls: tg.gapActual < 0 ? 'bad' : 'ok', icon: tg.gapActual < 0 ? '🔴' : '✅' };
            const notes = [];
            if(tg.effectiveHours < tg.standardShiftHours) notes.push(`Jam ${tg.effectiveHours}/${tg.standardShiftHours}: ${r.planned_stop_reason || 'stop terencana'}`);
            if(tg.cavityActive < tg.cavityStd) notes.push(`Cav ${tg.cavityStd}→${tg.cavityActive}: ${r.cavity_adjust_reason || 'cavity turun'}`);
            if(r.under_target_reason) notes.push(`Target: ${r.under_target_reason}`);
            if(!notes.length && r.catatan) notes.push(r.catatan);
            return `
                <tr>
                    <td><span class="target-pill ${meta.cls}">${meta.icon} ${meta.label}</span></td>
                    <td><b>${escapeHtml(r.line || '-')}</b></td>
                    <td>${escapeHtml(r.shift || '-')}</td>
                    <td><b>${escapeHtml(r.kode || '-')}</b><br><small>${escapeHtml(r.nama || '-')}</small></td>
                    <td class="right">${tg.effectiveHours || '-'} jam</td>
                    <td class="right">${dashFmtInt(tg.targetActual)}</td>
                    <td class="right text-ok"><b>${dashFmtInt(tg.okpcs)}</b></td>
                    <td class="right ${tg.gapActual < 0 ? 'text-danger' : 'text-ok'}"><b>${dashFmtSigned(tg.gapActual)}</b></td>
                    <td class="right"><b>${dashFmtPct(tg.achActual)}</b></td>
                    <td>${escapeHtml(notes.join(' | ') || '-')}</td>
                </tr>
            `;
        }).join('');
    }

    // 6. DATA MAPPING (OK & Reject)
    const prodMap = {};
    dataDash.forEach(r => {
        const k = r.kode + "|" + r.nama; 
        if(!prodMap[k]) prodMap[k] = { kode: r.kode, nama: r.nama, ok:0, rej:0 };
        prodMap[k].ok += (+r.okpcs); 
        prodMap[k].rej += (+r.reject);
    });

    // 7. TABEL KIRI: TOP 5 PRODUK OK (Hijau)
    const topProdsOk = Object.values(prodMap).sort((a,b) => b.ok - a.ok).slice(0, 5);
    const tblBodyOk = document.querySelector('#tblTopProd tbody');
    if(tblBodyOk) {
        tblBodyOk.innerHTML = topProdsOk.map(x => `
            <tr>
                <td>
                    <div style="font-weight:700; font-size:0.95rem; margin-bottom:2px; color:var(--gold); font-family:'JetBrains Mono', monospace;">${escapeHtml(x.kode)}</div>
                    <div style="font-size:0.8rem; color:#E2E8F0;">${escapeHtml(x.nama)}</div>
                </td>
                <td class="right text-ok" style="font-weight:bold; font-size:1.1rem; vertical-align:middle;">${x.ok.toLocaleString()}</td>
            </tr>
        `).join('');
    }

    // 8. TABEL KANAN: TOP 5 PRODUK REJECT (Merah)
    const topProdsReject = Object.values(prodMap).sort((a,b) => b.rej - a.rej).slice(0, 5);
    const tblBodyReject = document.querySelector('#tblTopReject tbody');
    if(tblBodyReject) {
        tblBodyReject.innerHTML = topProdsReject.map(x => `
            <tr>
                <td>
                    <div style="font-weight:700; font-size:0.95rem; margin-bottom:2px; color:#E2E8F0; font-family:'JetBrains Mono', monospace;">${escapeHtml(x.kode)}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(x.nama)}</div>
                </td>
                <td class="right text-danger" style="font-weight:bold; font-size:1.1rem; vertical-align:middle;">${x.rej.toLocaleString()}</td>
            </tr>
        `).join('');
    }
}

function renderDowntimeAndRanking(data) {
    const downtimeCounts = {};
    data.forEach(row => { const reason = row.planned_stop_reason || 'Tanpa alasan'; const hours = +row.planned_stop_hours || 0; if(hours > 0) downtimeCounts[reason] = (downtimeCounts[reason] || 0) + hours; });
    const downtime = OperationalDashboard.pareto(downtimeCounts);
    const canvas = document.getElementById('chartDowntime');
    if(chartDowntimeInstance) chartDowntimeInstance.destroy();
    chartDowntimeInstance = new Chart(canvas.getContext('2d'), { type:'bar', data:{ labels:downtime.map(x=>x.label), datasets:[{label:'Jam stop',data:downtime.map(x=>x.value),backgroundColor:'#F59E0B',borderRadius:4}] }, options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{color:'#94A3B8'}},y:{ticks:{color:'#E2E8F0'}}}} });

    const ranking = OperationalDashboard.lineRanking(data, row => { const target = extractLogTarget(row); return {...target, unsafe:isTargetUnsafe(target.status)}; });
    const body = document.querySelector('#tblLineRanking tbody');
    body.innerHTML = ranking.map((line,index) => `<tr class="dash-drill-row" data-line="${escapeHtml(line.line)}"><td>${index+1}</td><td><b>${escapeHtml(line.line)}</b></td><td class="right">${dashFmtPct(line.achievement)}</td><td class="right">${dashFmtPct(line.yieldPct)}</td><td class="right ${line.gap<0?'text-danger':'text-ok'}">${dashFmtSigned(line.gap)}</td></tr>`).join('') || '<tr><td colspan="5">Belum ada data.</td></tr>';
    body.querySelectorAll('[data-line]').forEach(row => row.onclick = () => { document.getElementById('fLine').value = row.dataset.line; document.getElementById('fFrom').value = document.getElementById('dFrom').value; document.getElementById('fTo').value = document.getElementById('dTo').value; openWorkspace('reports'); renderTable(); });
}

function renderOperationalSnapshot(data, start, end, shift) {
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
        return `<article class="ops-line-card ${state}">
            <div class="ops-line-head"><strong>${escapeHtml(line.line)}</strong><span>${label}</span></div>
            <div class="ops-line-ach">${dashFmtPct(line.achievement)}</div><small>Pencapaian target aktual</small>
            <div class="ops-line-metrics"><span><b>${dashFmtSigned(line.gap)}</b> Gap</span><span><b>${dashFmtInt(line.reject)}</b> Reject</span><span><b>${dashFmtPct(line.yieldPct)}</b> Yield</span></div>
            <div class="ops-line-reason" title="Penyebab dominan">${escapeHtml(line.topReason)}</div>
        </article>`;
    }).join('') : '<div class="ops-empty">Tidak ada snapshot line untuk filter ini.</div>';

    const queue = document.getElementById('opsActionQueue');
    const critical = snapshot.filter(line => line.unsafe || line.gap < 0).slice(0, 6);
    if(queue) queue.innerHTML = critical.length ? critical.map((line, index) => `<div class="ops-action-item"><span>${index + 1}</span><div><b>${escapeHtml(line.line)} · Gap ${dashFmtSigned(line.gap)}</b><small>${escapeHtml(line.topReason)} · loss ${dashFmtInt(line.loss)} pcs</small></div></div>`).join('') : '<div class="ops-empty compact">Tidak ada line kritis.</div>';

    const reasonList = document.getElementById('opsReasonList');
    const reasons = OperationalDashboard.reasonSummary(data).slice(0, 5);
    const max = reasons[0]?.count || 1;
    if(reasonList) reasonList.innerHTML = reasons.length ? reasons.map(item => `<div class="ops-reason-item"><div><span>${escapeHtml(item.reason)}</span><b>${item.count}</b></div><i style="--reason-width:${item.count / max * 100}%"></i></div>`).join('') : '<div class="ops-empty compact">Belum ada alasan tercatat.</div>';
}
