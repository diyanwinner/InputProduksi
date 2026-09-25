/* DASHBOARD MONITORING ROOM - TARGET CONTROL v2.9.2 */

let chartTrendInstance = null;
let chartParetoInstance = null;

function dashFmtInt(n) { return Math.round(+n || 0).toLocaleString('id-ID'); }
function dashFmtPct(n) { return ((+n || 0).toFixed(1)) + '%'; }
function dashFmtSigned(n) { const x = Math.round(+n || 0); return (x > 0 ? '+' : '') + x.toLocaleString('id-ID'); }

document.addEventListener('DOMContentLoaded', () => {
    const btnDash = document.getElementById('btnDashboard');
    const closeDash = document.getElementById('pDashboardClose');
    const loadDash = document.getElementById('btnLoadDash');

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
});

function renderDashboard() {
    // Cek data global dari app.js
    if(typeof logs === 'undefined' || logs.length === 0) {
        alert("Data belum siap atau kosong. Refresh halaman utama dulu.");
        return;
    }

    const startStr = document.getElementById('dFrom').value;
    const endStr = document.getElementById('dTo').value;
    const lineFilter = document.getElementById('dLine').value.trim().toUpperCase();
    const shiftFilter = document.getElementById('dShift')?.value || '';

    // 1. FILTER DATA
    const sourceRows = typeof uniqueDashboardLogs === 'function' ? uniqueDashboardLogs(logs) : logs;
    const dataDash = OperationalDashboard.filterRows(sourceRows, { from: startStr, to: endStr, line: lineFilter, shift: shiftFilter });

    if(dataDash.length === 0) {
        alert("Tidak ada data produksi di periode/filter ini.");
        return;
    }

    // 2. HITUNG KPI CARD
    let totalHasil=0, totalOk=0, totalReject=0, sumYield=0;
    dataDash.forEach(r => {
        totalHasil += (+r.hasil); 
        totalOk += (+r.okpcs); 
        totalReject += (+r.reject); 
        sumYield += (+r.yieldpct);
    });
    
    document.getElementById('kpiHasil').innerText = totalHasil.toLocaleString();
    document.getElementById('kpiOk').innerText = totalOk.toLocaleString();
    document.getElementById('kpiReject').innerText = totalReject.toLocaleString();
    document.getElementById('kpiYield').innerText = (dataDash.length ? (sumYield / dataDash.length) : 0).toFixed(2) + "%";

    const targetRows = (typeof extractLogTarget === 'function') ? dataDash.map(r => ({ raw:r, tg: extractLogTarget(r) })).filter(x => x.tg.targetActual > 0) : [];
    const targetBad = targetRows.filter(x => typeof isTargetUnsafe === 'function' ? isTargetUnsafe(x.tg.status) : x.tg.gapActual < 0);
    const targetOk = targetRows.filter(x => typeof isTargetUnsafe === 'function' ? !isTargetUnsafe(x.tg.status) : x.tg.gapActual >= 0);
    const gapActualTotal = targetRows.reduce((sum, x) => sum + x.tg.gapActual, 0);
    const capacityLossTotal = targetRows.reduce((sum, x) => sum + (x.tg.capacityLossTotal || 0), 0);
    if(document.getElementById('kpiTargetBad')) document.getElementById('kpiTargetBad').innerText = targetBad.length.toLocaleString('id-ID');
    if(document.getElementById('kpiTargetOk')) document.getElementById('kpiTargetOk').innerText = targetOk.length.toLocaleString('id-ID');
    if(document.getElementById('kpiGapActual')) document.getElementById('kpiGapActual').innerText = dashFmtSigned(gapActualTotal);
    if(document.getElementById('kpiCapacityLoss')) document.getElementById('kpiCapacityLoss').innerText = dashFmtInt(capacityLossTotal);

    renderOperationalSnapshot(dataDash, startStr, endStr, shiftFilter);

    // 3. CHART 1: TREND PRODUKSI
    const trendMap = {};
    dataDash.forEach(r => {
        if(!trendMap[r.tanggal]) trendMap[r.tanggal] = { ok:0, rej:0 };
        trendMap[r.tanggal].ok += (+r.okpcs); 
        trendMap[r.tanggal].rej += (+r.reject);
    });
    const labelsTrend = Object.keys(trendMap).sort();
    
    const ctxTrend = document.getElementById('chartTrend').getContext('2d');
    if(chartTrendInstance) chartTrendInstance.destroy();
    chartTrendInstance = new Chart(ctxTrend, {
        type: 'bar',
        data: {
            labels: labelsTrend,
            datasets: [
                { label: 'OK (Pcs)', data: labelsTrend.map(d => trendMap[d].ok), backgroundColor: '#34D399', borderRadius: 4 },
                { label: 'Reject (Pcs)', data: labelsTrend.map(d => trendMap[d].rej), backgroundColor: '#F87171', borderRadius: 4 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { x: { stacked: true, ticks:{color:'#94A3B8'} }, y: { stacked: true, ticks:{color:'#94A3B8'}, grid:{color:'rgba(148,163,184,0.16)'} } }, 
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

    const sortedPareto = Object.entries(rejectCounts).sort((a,b) => b[1] - a[1]).filter(x => x[1] > 0);
    
    const ctxPareto = document.getElementById('chartPareto').getContext('2d');
    if(chartParetoInstance) chartParetoInstance.destroy();
    
    chartParetoInstance = new Chart(ctxPareto, {
        type: 'bar',
        data: {
            labels: sortedPareto.map(x => x[0].toUpperCase()),
            datasets: [{ label: 'Total Defect', data: sortedPareto.map(x => x[1]), backgroundColor: '#818CF8', borderRadius: 4 }]
        },
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { x: { ticks: { color: '#94A3B8' }, grid:{color:'rgba(148,163,184,0.16)'} }, y: { ticks: { color: '#E2E8F0' } } } 
        }
    });
    

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

function renderOperationalSnapshot(data, start, end, shift) {
    const targetOf = row => {
        const target = typeof extractLogTarget === 'function' ? extractLogTarget(row) : {};
        return { ...target, unsafe: typeof isTargetUnsafe === 'function' ? isTargetUnsafe(target.status) : (+target.gapActual || 0) < 0 };
    };
    const latest = OperationalDashboard.latestShift(data);
    const latestRows = latest ? data.filter(row => String(row.tanggal || '') === latest.tanggal && String(row.shift || '') === latest.shift) : [];
    const snapshot = OperationalDashboard.buildSnapshot(latestRows, targetOf);
    const periodBadge = document.getElementById('opsPeriodBadge');
    if(periodBadge) periodBadge.textContent = latest ? `${latest.tanggal} · Shift ${latest.shift}` : `${start} — ${end}${shift ? ` · Shift ${shift}` : ''}`;

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
    const reasons = OperationalDashboard.reasonSummary(latestRows).slice(0, 5);
    const max = reasons[0]?.count || 1;
    if(reasonList) reasonList.innerHTML = reasons.length ? reasons.map(item => `<div class="ops-reason-item"><div><span>${escapeHtml(item.reason)}</span><b>${item.count}</b></div><i style="--reason-width:${item.count / max * 100}%"></i></div>`).join('') : '<div class="ops-empty compact">Belum ada alasan tercatat.</div>';
}
