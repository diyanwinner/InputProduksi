/* Production Run Monitor: derived read-only from Supabase logs. */
let productionRuns = [];
let productionRunLogs = [];

const runText = value => String(value ?? '').trim();
const runNorm = value => runText(value).toLocaleUpperCase();
const runProductKey = row => JSON.stringify([runNorm(row.kode), runNorm(row.nama)]);
const runLineKey = row => runNorm(row.line);
const runShiftOrder = value => {
    const number = Number(String(value ?? '').match(/\d+/)?.[0]);
    return number >= 1 && number <= 3 ? number : 99;
};
const runNumber = value => Number(value) || 0;
const runFormat = value => Math.round(runNumber(value)).toLocaleString('id-ID');
const runDateLabel = value => {
    if(!value) return '-';
    const parts = String(value).split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
};

document.addEventListener('DOMContentLoaded', () => {
    $('btnProductionRun').onclick = () => { openWorkspace('runs'); loadProductionRuns(); };
    $('mProductionRunClose').onclick = () => openWorkspace('home');
    $('btnRefreshProductionRun').onclick = loadProductionRuns;
    $('btnCloseRunDetail').onclick = () => $('mRunDetail').classList.remove('open');
    ['runDateFrom', 'runDateTo'].forEach(id => $(id).onchange = renderProductionRuns);
    $('runLineFilter').onchange = () => renderProductionRuns();
    $('runProductFilter').onchange = () => renderProductionRuns();
});

async function loadProductionRuns() {
    if(!client) return renderRunError('Hubungkan database Supabase terlebih dahulu.');
    const rows = [];
    const pageSize = 1000;
    for(let offset = 0; ; offset += pageSize) {
        const request = client.from('logs').select('id,tanggal,shift,line,kode,nama,counter,okpcs,reject,hasil,yieldpct,created_at').order('tanggal', { ascending:true }).range(offset, offset + pageSize - 1);
        const { data, error } = await request;
        if(error) return renderRunError(`Gagal memuat logs: ${error.message}`);
        rows.push(...(data || []));
        if(!data || data.length < pageSize) break;
    }
    productionRunLogs = rows;
    populateRunFilters(rows);
    productionRuns = buildProductionRuns(rows);
    renderProductionRuns();
}

function populateRunFilters(rows) {
    const lineSelect = $('runLineFilter');
    const productSelect = $('runProductFilter');
    const selectedLine = lineSelect.value;
    const selectedProduct = productSelect.value;
    const lines = [...new Map(rows.filter(row => runLineKey(row)).map(row => [runLineKey(row), runText(row.line)])).entries()].sort((a,b) => a[1].localeCompare(b[1], 'id', { numeric:true }));
    const products = [...new Map(rows.filter(row => runText(row.kode) || runText(row.nama)).map(row => [runProductKey(row), { kode:runText(row.kode), nama:runText(row.nama) }])).entries()].sort((a,b) => `${a[1].kode} ${a[1].nama}`.localeCompare(`${b[1].kode} ${b[1].nama}`, 'id'));
    lineSelect.innerHTML = '<option value="">Semua mesin</option>' + lines.map(([key, value]) => `<option value="${escapeHtml(key)}">${escapeHtml(value)}</option>`).join('');
    productSelect.innerHTML = '<option value="">Semua produk</option>' + products.map(([key, value]) => `<option value="${escapeHtml(key)}">${escapeHtml(value.kode)} — ${escapeHtml(value.nama)}</option>`).join('');
    lineSelect.value = lines.some(([key]) => key === selectedLine) ? selectedLine : '';
    productSelect.value = products.some(([key]) => key === selectedProduct) ? selectedProduct : '';
}

function buildProductionRuns(rows) {
    const byLine = new Map();
    rows.filter(row => runLineKey(row) && (runText(row.kode) || runText(row.nama))).forEach(row => {
        const key = runLineKey(row);
        if(!byLine.has(key)) byLine.set(key, []);
        byLine.get(key).push(row);
    });
    const allRuns = [];
    byLine.forEach((lineRows, lineKey) => {
        lineRows.sort((a, b) => String(a.tanggal || '').localeCompare(String(b.tanggal || '')) || runShiftOrder(a.shift) - runShiftOrder(b.shift) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
        const productRunCount = new Map();
        let current = null;
        const closeRun = () => {
            if(!current) return;
            current.endDate = current.logs[current.logs.length - 1].tanggal || current.startDate;
            current.lastShift = current.logs[current.logs.length - 1].shift || '-';
            current.logCount = current.logs.length;
            current.totalCounter = current.logs.reduce((sum, row) => sum + runNumber(row.counter), 0);
            current.totalOk = current.logs.reduce((sum, row) => sum + runNumber(row.okpcs), 0);
            current.totalReject = current.logs.reduce((sum, row) => sum + runNumber(row.reject), 0);
            current.totalHasil = current.logs.reduce((sum, row) => sum + runNumber(row.hasil), 0);
            current.averageYield = current.logs.length ? current.logs.reduce((sum, row) => sum + runNumber(row.yieldpct), 0) / current.logs.length : 0;
            allRuns.push(current);
        };
        lineRows.forEach(row => {
            const productKey = runProductKey(row);
            if(!current || current.productKey !== productKey) {
                closeRun();
                const runNumberForProduct = (productRunCount.get(productKey) || 0) + 1;
                productRunCount.set(productKey, runNumberForProduct);
                current = { id:`${lineKey}|${allRuns.length}|${productKey}`, lineKey, line:runText(row.line), productKey, kode:runText(row.kode), nama:runText(row.nama), runNumber:runNumberForProduct, startDate:row.tanggal || '', endDate:row.tanggal || '', firstShift:row.shift || '-', lastShift:row.shift || '-', logs:[] };
            }
            current.logs.push(row);
        });
        closeRun();
        const lastRun = [...allRuns].reverse().find(run => run.lineKey === lineKey);
        if(lastRun) lastRun.status = 'RUNNING';
        allRuns.filter(run => run.lineKey === lineKey && run !== lastRun).forEach(run => run.status = 'ENDED');
    });
    return allRuns.sort((a,b) => String(b.endDate).localeCompare(String(a.endDate)) || runShiftOrder(b.lastShift) - runShiftOrder(a.lastShift));
}

function renderProductionRuns() {
    const line = $('runLineFilter').value;
    const product = $('runProductFilter').value;
    const from = $('runDateFrom').value;
    const to = $('runDateTo').value;
    if(from && to && from > to) return renderRunError('Tanggal akhir tidak boleh sebelum tanggal mulai.');
    const visible = productionRuns.filter(run => (!line || run.lineKey === line) && (!product || run.productKey === product) && run.logs.some(row => (!from || row.tanggal >= from) && (!to || row.tanggal <= to)));
    $('runKpiRunning').textContent = visible.filter(run => run.status === 'RUNNING').length;
    $('runKpiTotal').textContent = visible.length;
    $('runKpiOk').textContent = runFormat(visible.reduce((sum, run) => sum + run.totalOk, 0));
    $('runKpiReject').textContent = runFormat(visible.reduce((sum, run) => sum + run.totalReject, 0));
    $('productionRunEmpty').hidden = visible.length > 0;
    $('productionRunList').innerHTML = visible.map(run => `<article class="run-card"><div class="run-card-head"><div><span class="run-line-label">MESIN ${escapeHtml(run.line)}</span><h3>${escapeHtml(run.kode)} <span>— ${escapeHtml(run.nama)}</span></h3></div><span class="run-status ${run.status === 'RUNNING' ? 'running' : 'ended'}">${run.status}</span></div><div class="run-date-row"><span>Run #${run.runNumber}</span><span>Mulai ${runDateLabel(run.startDate)}</span><span>Terakhir ${runDateLabel(run.endDate)} · Shift ${escapeHtml(run.lastShift)}</span></div><div class="run-metrics"><div><span>OK</span><b class="text-ok">${runFormat(run.totalOk)}</b></div><div><span>Reject</span><b class="text-danger">${runFormat(run.totalReject)}</b></div><div><span>Yield rata-rata</span><b>${run.averageYield.toFixed(1)}%</b></div><div><span>Log</span><b>${run.logCount}</b></div></div><button class="btn sm run-detail-btn" type="button" data-run-detail="${escapeHtml(run.id)}">Lihat detail</button></article>`).join('');
    document.querySelectorAll('[data-run-detail]').forEach(button => button.onclick = () => openRunDetail(button.dataset.runDetail));
}

function renderRunError(message) {
    $('runKpiRunning').textContent = '0'; $('runKpiTotal').textContent = '0'; $('runKpiOk').textContent = '0'; $('runKpiReject').textContent = '0';
    $('productionRunEmpty').hidden = false;
    $('productionRunEmpty').textContent = message;
    $('productionRunList').innerHTML = '';
}

function openRunDetail(id) {
    const run = productionRuns.find(item => item.id === id);
    if(!run) return;
    $('runDetailTitle').textContent = `Mesin ${run.line} · ${run.kode} · Run #${run.runNumber}`;
    $('runDetailMeta').textContent = `${run.nama} · ${runDateLabel(run.startDate)} s/d ${runDateLabel(run.endDate)}`;
    $('runDetailSummary').innerHTML = `<span>Counter <b>${runFormat(run.totalCounter)}</b></span><span>Hasil <b>${runFormat(run.totalHasil)}</b></span><span>OK <b class="text-ok">${runFormat(run.totalOk)}</b></span><span>Reject <b class="text-danger">${runFormat(run.totalReject)}</b></span>`;
    $('runDetailBody').innerHTML = run.logs.map(row => `<tr><td>${runDateLabel(row.tanggal)}</td><td>${escapeHtml(row.shift || '-')}</td><td>${runFormat(row.counter)}</td><td class="right text-ok">${runFormat(row.okpcs)}</td><td class="right text-danger">${runFormat(row.reject)}</td><td class="right">${runFormat(row.hasil)}</td><td class="right">${runNumber(row.yieldpct).toFixed(1)}%</td></tr>`).join('');
    $('mRunDetail').classList.add('open');
}
