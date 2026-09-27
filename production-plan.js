/* Production Plan: internal CRUD only. It never writes to production logs. */
let productionPlans = [];
let productionPlanProgress = new Map();
let productionPlanAdjustments = new Map();
let activeAdjustmentPlanId = '';
let planSelectedProduct = null;
let planProductActiveIndex = -1;
let planProductChoices = [];
let planLookupSequence = 0;

const planText = value => String(value ?? '').trim();
const planNorm = value => planText(value).toLocaleLowerCase('id-ID');
const planFmt = value => Math.round(Number(value) || 0).toLocaleString('id-ID');
const planDate = value => {
    const text = planText(value);
    if(/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};
const planLine = value => planText(value);

document.addEventListener('DOMContentLoaded', () => {
    $('btnProductionPlan').onclick = () => { openWorkspace('plans'); loadProductionPlans(); };
    $('mProductionPlanClose').onclick = () => openWorkspace('home');
    $('btnPlanCreate').onclick = () => openProductionPlanForm();
    $('btnPlanCancel').onclick = () => closeProductionPlanForm();
    $('btnSavePlan').onclick = saveProductionPlan;
    $('planStatusFilter').onchange = renderProductionPlans;
    $('planStartDate').onchange = () => { populatePlanMachines(planLine($('planLine').value)); };
    $('planLine').onchange = () => { updatePlanProductsFromLogs(); };
    installPlanProductAutocomplete();
    $('btnClosePlanAdjustments').onclick = closePlanAdjustments;
    $('btnSavePlanAdjustment').onclick = savePlanAdjustment;
});

async function loadProductionPlans() {
    if(!client) return showPlanMessage('Hubungkan database Supabase terlebih dahulu.');
    const { data, error } = await client.from('production_plans').select('*').order('start_date', { ascending:true }).order('created_at', { ascending:false });
    if(error) return showPlanMessage(`Gagal memuat plan: ${error.message}`);
    productionPlans = data || [];
    await loadProductionPlanAdjustments();
    await loadProductionPlanProgress();
    renderProductionPlans();
}

async function loadProductionPlanProgress() {
    productionPlanProgress = new Map();
    const activePlans = productionPlans.filter(plan => plan.status === 'ACTIVE' && plan.start_date && plan.line_code);
    if(!activePlans.length || !client) return;
    const earliestStart = activePlans.map(plan => planDate(plan.start_date)).filter(Boolean).sort()[0];
    if(!earliestStart) return;
    const rows = [];
    const pageSize = 1000;
    for(let from = 0; ; from += pageSize) {
        const { data, error } = await client.from('logs').select('tanggal,line,kode,nama,okpcs').gte('tanggal', earliestStart).order('tanggal', { ascending:true }).range(from, from + pageSize - 1);
        if(error) { console.error('Gagal memuat progress Production Plan:', error); return; }
        rows.push(...(data || []));
        if(!data || data.length < pageSize) break;
    }
    activePlans.forEach(plan => {
        const producedOk = rows.reduce((sum, row) => {
            const match = planDate(row.tanggal) >= planDate(plan.start_date)
                && planLine(row.line) === planLine(plan.line_code)
                && planNorm(row.kode) === planNorm(plan.product_code_snapshot)
                && planNorm(row.nama) === planNorm(plan.product_name_snapshot);
            return match ? sum + (Number(row.okpcs) || 0) : sum;
        }, 0);
        const quantity = Number(plan.plan_qty) || 0;
        const adjustmentTotal = (productionPlanAdjustments.get(plan.id) || []).reduce((sum, adjustment) => sum + (adjustment.direction === 'ADD' ? 1 : -1) * (Number(adjustment.qty) || 0), 0);
        const netGood = Math.max(producedOk + adjustmentTotal, 0);
        const remaining = Math.max(quantity - netGood, 0);
        const overQty = Math.max(netGood - quantity, 0);
        productionPlanProgress.set(plan.id, { producedOk, adjustmentTotal, netGood, remaining, overQty, progressPct: quantity > 0 ? netGood / quantity * 100 : 0 });
    });
}

async function loadProductionPlanAdjustments() {
    productionPlanAdjustments = new Map();
    if(!client) return;
    const { data, error } = await client.from('production_plan_adjustments').select('*').order('adjustment_date', { ascending:false }).order('created_at', { ascending:false });
    if(error) { console.error('Gagal memuat penyesuaian Production Plan:', error); return; }
    (data || []).forEach(adjustment => {
        if(!productionPlanAdjustments.has(adjustment.plan_id)) productionPlanAdjustments.set(adjustment.plan_id, []);
        productionPlanAdjustments.get(adjustment.plan_id).push(adjustment);
    });
}

function showPlanMessage(message) {
    const empty = $('productionPlanEmpty');
    empty.textContent = message;
    empty.hidden = false;
    $('productionPlanBody').innerHTML = '';
    $('planCount').textContent = message;
}

function renderProductionPlans() {
    const status = $('planStatusFilter').value;
    const rows = productionPlans.filter(plan => !status || plan.status === status);
    $('planCount').textContent = `${rows.length} plan${status ? ` ${status.toLowerCase()}` : ''}`;
    $('productionPlanEmpty').hidden = rows.length > 0;
    $('productionPlanEmpty').textContent = 'Belum ada Production Plan pada status ini.';
    $('productionPlanBody').innerHTML = rows.map(plan => {
        const statusClass = String(plan.status || 'ACTIVE').toLowerCase();
        const due = plan.due_date || '-';
        const progress = productionPlanProgress.get(plan.id);
        const progressMarkup = progress ? `<div class="plan-progress"><div class="plan-progress-top"><b>${progress.progressPct.toFixed(1)}%</b><span>${progress.overQty ? `Over +${planFmt(progress.overQty)} pcs` : `Remaining ${planFmt(progress.remaining)} pcs`}</span></div><div class="plan-progress-track"><i style="width:${Math.min(progress.progressPct, 100)}%"></i></div></div>` : '<span class="muted">-</span>';
        const secondaryActions = [`<option value="">Aksi lain</option>`, `<option value="edit">Edit</option>`, plan.status === 'ACTIVE' ? `<option value="complete">Selesai</option><option value="cancel">Batal</option>` : '', `<option value="delete">Hapus</option>`].join('');
        const actionButtons = `<button class="btn sm" type="button" data-plan-adjust="${escapeHtml(plan.id)}">Penyesuaian</button><select class="input plan-action-select" data-plan-more="${escapeHtml(plan.id)}" aria-label="Aksi plan">${secondaryActions}</select>`;
        return `<tr><td><b>${escapeHtml(plan.product_code_snapshot || '-')}</b><br><small class="plan-product-name" title="${escapeHtml(plan.product_name_snapshot || '-')}">${escapeHtml(plan.product_name_snapshot || '-')}</small></td><td>${escapeHtml(plan.line_code || '-')}</td><td class="right"><b>${planFmt(plan.plan_qty)}</b></td><td class="right">${progress ? `<b>${planFmt(progress.producedOk)}</b>` : '-'}</td><td class="right ${progress?.adjustmentTotal < 0 ? 'text-danger' : 'text-ok'}">${progress ? `${progress.adjustmentTotal > 0 ? '+' : ''}${planFmt(progress.adjustmentTotal)}` : '-'}</td><td class="right">${progress ? `<b>${planFmt(progress.netGood)}</b>` : '-'}</td><td class="right">${progress ? planFmt(progress.remaining) : '-'}</td><td class="plan-progress-cell">${progressMarkup}</td><td>${escapeHtml(plan.start_date || '-')}</td><td>${escapeHtml(due)}</td><td><span class="plan-status ${statusClass}">${escapeHtml(plan.status || 'ACTIVE')}</span></td><td class="plan-note-cell">${escapeHtml(plan.note || '-')}</td><td class="right plan-actions">${actionButtons}</td></tr>`;
    }).join('');
    document.querySelectorAll('[data-plan-edit]').forEach(button => button.onclick = () => openProductionPlanForm(button.dataset.planEdit));
    document.querySelectorAll('[data-plan-adjust]').forEach(button => button.onclick = () => openPlanAdjustments(button.dataset.planAdjust));
    document.querySelectorAll('[data-plan-status]').forEach(button => button.onclick = () => setProductionPlanStatus(button.dataset.planId, button.dataset.planStatus));
    document.querySelectorAll('[data-plan-delete]').forEach(button => button.onclick = () => deleteProductionPlan(button.dataset.planDelete));
    document.querySelectorAll('[data-plan-more]').forEach(select => select.onchange = () => {
        const action = select.value;
        const planId = select.dataset.planMore;
        select.value = '';
        if (action === 'edit') openProductionPlanForm(planId);
        if (action === 'complete') setProductionPlanStatus(planId, 'COMPLETED');
        if (action === 'cancel') setProductionPlanStatus(planId, 'CANCELLED');
        if (action === 'delete') deleteProductionPlan(planId);
    });
}

function openProductionPlanForm(id = '') {
    const plan = id ? productionPlans.find(item => item.id === id) : null;
    $('productionPlanForm').hidden = false;
    $('productionPlanFormTitle').textContent = plan ? 'Edit Plan' : 'Buat Plan';
    $('planId').value = plan?.id || '';
    $('planQty').value = plan?.plan_qty ?? '';
    $('planStartDate').value = plan?.start_date || todayISO();
    $('planDueDate').value = plan?.due_date || '';
    $('planNote').value = plan?.note || '';
    const product = plan ? master.find(item => item.id === plan.product_id) || master.find(item => planNorm(item.kode) === planNorm(plan.product_code_snapshot) && planNorm(item.nama) === planNorm(plan.product_name_snapshot)) : null;
    populatePlanMachines(plan?.line_code || '', product || null, plan ? { code:plan.product_code_snapshot, name:plan.product_name_snapshot, id:plan.product_id } : null);
    $('mProductionPlan').scrollTo({ top:0, behavior:'smooth' });
}

function closeProductionPlanForm() {
    $('productionPlanForm').hidden = true;
    $('planId').value = '';
    $('planLine').value = '';
    clearPlanProduct();
    resetPlanProductSource('Pilih tanggal dan mesin terlebih dahulu.', 'neutral');
    hidePlanProductOptions();
}

function normalizedPlanProductKey(row) {
    return `${planNorm(row.kode)}|${planNorm(row.nama)}`;
}

async function populatePlanMachines(selectedLine = '', preferredProduct = null, fallback = null) {
    const startDate = planDate($('planStartDate').value);
    const select = $('planLine');
    clearPlanProduct();
    hidePlanProductOptions();
    planProductChoices = [];
    if(!startDate) {
        select.disabled = true;
        select.innerHTML = '<option value="">Pilih tanggal terlebih dahulu...</option>';
        $('planProductSearch').disabled = true;
        return resetPlanProductSource('Pilih tanggal dan mesin terlebih dahulu.', 'neutral');
    }
    if(!client) {
        select.disabled = true;
        select.innerHTML = '<option value="">Hubungkan database terlebih dahulu...</option>';
        $('planProductSearch').disabled = true;
        return resetPlanProductSource('Hubungkan database Supabase untuk mengambil mesin dan produk.', 'manual');
    }
    const sequence = ++planLookupSequence;
    select.disabled = true;
    select.innerHTML = '<option value="">Memuat mesin...</option>';
    const { data, error } = await client.from('logs').select('line');
    if(sequence !== planLookupSequence) return;
    if(error) {
        select.innerHTML = '<option value="">Gagal memuat mesin</option>';
        return resetPlanProductSource(`Gagal membaca laporan: ${error.message}`, 'manual');
    }
    const lines = [...new Set((data || []).map(row => planLine(row.line)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id', { numeric:true }));
    if(selectedLine && !lines.some(line => planLine(line) === planLine(selectedLine))) lines.push(planLine(selectedLine));
    select.disabled = false;
    select.innerHTML = '<option value="">Pilih mesin...</option>' + lines.map(line => `<option value="${escapeHtml(line)}">${escapeHtml(line)}</option>`).join('');
    select.value = selectedLine ? planLine(selectedLine) : '';
    $('planProductSearch').disabled = true;
    if(selectedLine) return updatePlanProductsFromLogs(preferredProduct, fallback);
    resetPlanProductSource(lines.length ? 'Pilih mesin untuk mencari produk dari laporan.' : 'Belum ada mesin pada data produksi.', lines.length ? 'neutral' : 'manual');
}

function resetPlanProductSource(message, state = 'neutral') {
    const source = $('planProductSource');
    source.textContent = message;
    source.className = `plan-product-source ${state}`;
}

async function updatePlanProductsFromLogs(preferredProduct = null, fallback = null) {
    const startDate = planDate($('planStartDate').value);
    const line = planLine($('planLine').value);
    clearPlanProduct();
    hidePlanProductOptions();
    if(!startDate || !line) {
        $('planProductSearch').disabled = true;
        planProductChoices = [];
        return resetPlanProductSource('Pilih tanggal dan mesin terlebih dahulu.', 'neutral');
    }
    if(!client) {
        $('planProductSearch').disabled = true;
        return resetPlanProductSource('Hubungkan database Supabase untuk mengambil laporan.', 'manual');
    }
    const sequence = ++planLookupSequence;
    $('planProductSearch').disabled = true;
    resetPlanProductSource('Mencari produk dari laporan produksi...', 'neutral');
    const { data, error } = await client.from('logs').select('tanggal,line,shift,kode,nama').eq('tanggal', startDate);
    if(sequence !== planLookupSequence) return;
    if(error) {
        return resetPlanProductSource(`Gagal membaca laporan: ${error.message}`, 'manual');
    }
    const matchingLogs = (data || []).filter(row => planDate(row.tanggal) === startDate && planLine(row.line) === line);
    const groups = new Map();
    matchingLogs.forEach(row => {
        const key = normalizedPlanProductKey(row);
        if(!planText(row.kode) && !planText(row.nama)) return;
        if(!groups.has(key)) groups.set(key, { code:planText(row.kode), name:planText(row.nama), shifts:new Set() });
        if(planText(row.shift)) groups.get(key).shifts.add(planText(row.shift));
    });
    planProductChoices = [...groups.values()].map(candidate => {
        const product = master.find(item => normalizedPlanProductKey(item) === normalizedPlanProductKey(candidate));
        return { ...(product || {}), id:product?.id || '', kode:candidate.code, nama:candidate.name, shifts:[...candidate.shifts].sort() };
    });
    $('planProductSearch').disabled = false;
    if(planProductChoices.length === 1) {
        setPlanProduct(planProductChoices[0]);
        return resetPlanProductSource(`Produk ditemukan dari laporan produksi · Shift ${planProductChoices[0].shifts.join(', ') || '-'}`, 'found');
    }
    if(planProductChoices.length > 1) {
        if(preferredProduct) setPlanProduct(preferredProduct, fallback);
        resetPlanProductSource(`${planProductChoices.length} produk ditemukan dari laporan produksi. Pilih produk yang tepat.`, 'found');
        if(!preferredProduct) renderPlanProductOptions();
        return;
    }
    planProductChoices = master.map(product => ({ ...product, shifts:[] }));
    if(preferredProduct) setPlanProduct(preferredProduct, fallback);
    resetPlanProductSource('Belum ada laporan, pilih produk manual dari Master Produk.', 'manual');
}

function setPlanProduct(product, fallback = null) {
    const chosen = product || fallback;
    const shifts = chosen?.shifts || chosen?.shift ? (Array.isArray(chosen.shifts) ? chosen.shifts : [chosen.shift]) : [];
    planSelectedProduct = chosen ? { id:chosen.id || '', code:planText(chosen.kode ?? chosen.code), name:planText(chosen.nama ?? chosen.name), shifts:[...shifts].map(planText).filter(Boolean) } : null;
    $('planProductSearch').value = planSelectedProduct ? `${planSelectedProduct.code} — ${planSelectedProduct.name}` : '';
    $('planProductHint').textContent = planSelectedProduct ? `Dipilih: ${planSelectedProduct.code} — ${planSelectedProduct.name}${planSelectedProduct.shifts.length ? ` · Shift ${planSelectedProduct.shifts.join(', ')}` : ''}` : 'Pilih produk dari Master Produk.';
    hidePlanProductOptions();
}

function clearPlanProduct() {
    planSelectedProduct = null;
    $('planProductSearch').value = '';
    $('planProductHint').textContent = 'Pilih produk dari Master Produk.';
}

function matchingPlanProducts(query) {
    const term = planNorm(query);
    return planProductChoices.filter(product => !term || planNorm(product.kode).includes(term) || planNorm(product.nama).includes(term)).slice(0, 60);
}

function renderPlanProductOptions(query = '') {
    const options = $('planProductOptions');
    const matches = matchingPlanProducts(query);
    planProductActiveIndex = matches.length ? 0 : -1;
    options.innerHTML = matches.length ? matches.map((product, index) => `<button class="plan-product-option${index === 0 ? ' active' : ''}" type="button" role="option" aria-selected="${index === 0}" data-plan-product-index="${planProductChoices.indexOf(product)}"><strong>${escapeHtml(product.kode || '-')}</strong><small>${escapeHtml(product.nama || '-')}${product.shifts?.length ? ` · Shift ${escapeHtml(product.shifts.join(', '))}` : ''}</small></button>`).join('') : '<div class="plan-product-no-result">Produk tidak ditemukan.</div>';
    options.hidden = false;
    $('planProductSearch').setAttribute('aria-expanded', 'true');
    options.querySelectorAll('[data-plan-product-index]').forEach(button => button.onclick = () => setPlanProduct(planProductChoices[Number(button.dataset.planProductIndex)]));
}

function hidePlanProductOptions() {
    const options = $('planProductOptions');
    options.hidden = true;
    options.innerHTML = '';
    $('planProductSearch').setAttribute('aria-expanded', 'false');
    planProductActiveIndex = -1;
}

function movePlanProductActive(direction) {
    const options = [...document.querySelectorAll('#planProductOptions [data-plan-product-index]')];
    if(!options.length) return;
    planProductActiveIndex = (planProductActiveIndex + direction + options.length) % options.length;
    options.forEach((option, index) => {
        const active = index === planProductActiveIndex;
        option.classList.toggle('active', active);
        option.setAttribute('aria-selected', String(active));
        if(active) option.scrollIntoView({ block:'nearest' });
    });
}

function installPlanProductAutocomplete() {
    const input = $('planProductSearch');
    input.addEventListener('input', () => { planSelectedProduct = null; $('planProductHint').textContent = 'Pilih produk dari Master Produk.'; renderPlanProductOptions(input.value); });
    input.addEventListener('focus', () => renderPlanProductOptions(input.value));
    input.addEventListener('keydown', event => {
        const options = $('planProductOptions');
        if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if(options.hidden) renderPlanProductOptions(input.value);
            else movePlanProductActive(event.key === 'ArrowDown' ? 1 : -1);
        } else if(event.key === 'Enter' && !options.hidden && planProductActiveIndex >= 0) {
            event.preventDefault();
            const active = options.querySelectorAll('[data-plan-product-index]')[planProductActiveIndex];
            if(active) setPlanProduct(planProductChoices[Number(active.dataset.planProductIndex)]);
        } else if(event.key === 'Escape') hidePlanProductOptions();
    });
    document.addEventListener('pointerdown', event => { if(!event.target.closest('.plan-product-search')) hidePlanProductOptions(); });
}

function openPlanAdjustments(planId) {
    const plan = productionPlans.find(item => item.id === planId);
    if(!plan) return;
    activeAdjustmentPlanId = planId;
    $('mPlanAdjustments').classList.add('open');
    $('planAdjustmentTitle').textContent = `Penyesuaian · Line ${plan.line_code || '-'}`;
    $('planAdjustmentProduct').textContent = `${plan.product_code_snapshot || '-'} — ${plan.product_name_snapshot || '-'}`;
    const progress = productionPlanProgress.get(planId) || { producedOk:0, netGood:0 };
    $('adjustmentProducedOk').textContent = `${planFmt(progress.producedOk)} pcs`;
    $('adjustmentNetGood').textContent = `${planFmt(progress.netGood)} pcs`;
    resetPlanAdjustmentForm();
    renderPlanAdjustmentHistory();
}

function closePlanAdjustments() {
    $('mPlanAdjustments').classList.remove('open');
    activeAdjustmentPlanId = '';
}

function resetPlanAdjustmentForm(adjustment = null) {
    const plan = productionPlans.find(item => item.id === activeAdjustmentPlanId);
    $('planAdjustmentId').value = adjustment?.id || '';
    $('adjustmentDate').value = adjustment?.adjustment_date || planDate(new Date()) || plan?.start_date || '';
    $('adjustmentDate').min = plan?.start_date || '';
    $('adjustmentDirection').value = adjustment?.direction || 'LOSS';
    $('adjustmentQty').value = adjustment?.qty ?? '';
    $('adjustmentReason').value = adjustment?.reason || 'Reject Tambahan';
    $('adjustmentNote').value = adjustment?.note || '';
}

function renderPlanAdjustmentHistory() {
    const rows = productionPlanAdjustments.get(activeAdjustmentPlanId) || [];
    $('planAdjustmentHistory').innerHTML = rows.length ? rows.map(adjustment => `<article class="plan-adjustment-item ${String(adjustment.direction).toLowerCase()}"><div><b>${escapeHtml(adjustment.direction)} ${adjustment.direction === 'ADD' ? '+' : '-'}${planFmt(adjustment.qty)}</b><small>${escapeHtml(adjustment.adjustment_date)} · ${escapeHtml(adjustment.reason)}</small>${adjustment.note ? `<em>${escapeHtml(adjustment.note)}</em>` : ''}</div><div><button class="btn sm" type="button" data-adjustment-edit="${escapeHtml(adjustment.id)}">Edit</button><button class="btn danger sm" type="button" data-adjustment-delete="${escapeHtml(adjustment.id)}">Hapus</button></div></article>`).join('') : '<div class="plan-empty">Belum ada penyesuaian untuk plan ini.</div>';
    document.querySelectorAll('[data-adjustment-edit]').forEach(button => button.onclick = () => {
        const adjustment = rows.find(item => item.id === button.dataset.adjustmentEdit);
        if(adjustment) resetPlanAdjustmentForm(adjustment);
    });
    document.querySelectorAll('[data-adjustment-delete]').forEach(button => button.onclick = () => deletePlanAdjustment(button.dataset.adjustmentDelete));
}

async function savePlanAdjustment() {
    const plan = productionPlans.find(item => item.id === activeAdjustmentPlanId);
    if(!client || !plan) return;
    const qty = Number($('adjustmentQty').value);
    const date = planDate($('adjustmentDate').value);
    if(!date || date < planDate(plan.start_date)) return alert('Tanggal penyesuaian tidak boleh sebelum tanggal mulai plan.');
    if(!Number.isFinite(qty) || qty <= 0) return alert('Qty penyesuaian harus lebih dari 0.');
    const payload = { id:$('planAdjustmentId').value || uid(), plan_id:plan.id, adjustment_date:date, direction:$('adjustmentDirection').value, qty, reason:$('adjustmentReason').value, note:$('adjustmentNote').value.trim() || null };
    const { error } = await client.from('production_plan_adjustments').upsert(payload);
    if(error) return alert(`Gagal menyimpan penyesuaian: ${error.message}`);
    await loadProductionPlans();
    openPlanAdjustments(plan.id);
}

async function deletePlanAdjustment(id) {
    if(!confirm('Hapus penyesuaian ini?') || !client) return;
    const { error } = await client.from('production_plan_adjustments').delete().eq('id', id);
    if(error) return alert(`Gagal menghapus penyesuaian: ${error.message}`);
    await loadProductionPlans();
    openPlanAdjustments(activeAdjustmentPlanId);
}

async function saveProductionPlan() {
    if(!client) return alert('Hubungkan database Supabase terlebih dahulu.');
    const quantity = Number($('planQty').value);
    if(!planSelectedProduct) return alert('Pilih produk dari daftar Master Produk.');
    if(!planSelectedProduct.id) {
        const { data, error } = await client.from('master').select('id,kode,nama').eq('kode', planSelectedProduct.code);
        if(error) return alert(`Gagal memeriksa Master Produk: ${error.message}`);
        const exactMaster = (data || []).find(product => normalizedPlanProductKey(product) === `${planNorm(planSelectedProduct.code)}|${planNorm(planSelectedProduct.name)}`);
        if(!exactMaster) return alert('Produk dari laporan belum memiliki pasangan exact di Master Produk. Tambahkan atau samakan kode dan nama produknya di Master Produk.');
        planSelectedProduct.id = exactMaster.id;
    }
    if(!Number.isFinite(quantity) || quantity <= 0) return alert('Plan Qty harus lebih dari 0.');
    if(!$('planStartDate').value) return alert('Tanggal mulai wajib diisi.');
    if(!$('planLine').value) return alert('Mesin / Line wajib dipilih.');
    const id = $('planId').value || uid();
    const current = productionPlans.find(plan => plan.id === id);
    const payload = {
        id,
        product_id: planSelectedProduct.id,
        product_code_snapshot: planSelectedProduct.code,
        product_name_snapshot: planSelectedProduct.name,
        line_code: $('planLine').value.trim(),
        plan_qty: quantity,
        start_date: $('planStartDate').value,
        due_date: $('planDueDate').value || null,
        note: $('planNote').value.trim() || null,
        status: current?.status || 'ACTIVE'
    };
    const { error } = await client.from('production_plans').upsert(payload);
    if(error) return alert(`Gagal menyimpan plan: ${error.message}`);
    closeProductionPlanForm();
    await loadProductionPlans();
}

async function setProductionPlanStatus(id, status) {
    if(!client) return;
    const { error } = await client.from('production_plans').update({ status }).eq('id', id);
    if(error) return alert(`Gagal mengubah status: ${error.message}`);
    await loadProductionPlans();
}

async function deleteProductionPlan(id) {
    if(!confirm('Hapus Production Plan ini?')) return;
    if(!client) return;
    const { error } = await client.from('production_plans').delete().eq('id', id);
    if(error) return alert(`Gagal menghapus plan: ${error.message}`);
    await loadProductionPlans();
}
