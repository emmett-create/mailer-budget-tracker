// Mailer Project Budget Tracker — built 2026-10-01 for Loulou Viemeister's
// mailer projects (Slack, 2026-09-30/10-01): "i need to be able to separate
// client and then mailer project, so madegood - bts, madegood - evergreen
// etc." One tracker spans every client's mailer projects, rather than one
// tracker per client like the other budget trackers — client + project are
// just columns on each entry here, not separate tables.
//
// No Lumanu/DocuSign/invoice flow and no per-project dollar budget caps
// (Emmett's call, 2026-10-01: "No, just log spend") — this just logs actual
// spend and rolls it up by client.

// Source: Loulou's Slack message, 2026-10-01 ("CLIENT - MAILER PROJECT:").
// Add a new client or project here — nothing else needs to change.
const CLIENT_PROJECTS = {
  "MadeGood":       ["Evergreen", "BTS", "Pumpkin Spice"],
  "Stardust":       ["Tarot Mailer"],
  "Magna":          ["Creatine", "Iced Tea", "Shirley Temple"],
  "Gimme Seaweed":  ["K Crips"],
  "Tein":           ["6 Pack Mailer"],
  "Biossance":      ["Evergreen Shipper"],
  "Magic Molecule": ["Evergreen Shipper"],
};

const API = `${SUPABASE_URL}/rest/v1/mailer_budget_entries`;
const SB  = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

let rows         = [];
let clientFilter = null;
let search       = '';
let sortCol      = 'date';
let sortDir      = 'desc';
let deleteId     = null;
let editId       = null;

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindAll();
  load();
});

// ── Data ─────────────────────────────────────────────────────────────────────
async function load() {
  const r = await fetch(`${API}?order=date.desc,created_at.desc`, { headers: SB });
  rows = r.ok ? await r.json() : [];
  render();
}

async function insert(entry) {
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { ...SB, 'Prefer': 'return=minimal' },
      body: JSON.stringify(entry),
    });
    return r.ok;
  } catch { return false; }
}

async function remove(id) {
  try {
    const r = await fetch(`${API}?id=eq.${id}`, { method: 'DELETE', headers: SB });
    return r.ok;
  } catch { return false; }
}

async function update(id, data) {
  try {
    const r = await fetch(`${API}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...SB, 'Prefer': 'return=minimal' },
      body: JSON.stringify(data),
    });
    return r.ok;
  } catch { return false; }
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  renderSummary();
  renderTable();
}

function renderSummary() {
  const total = sum(rows);
  setText('total-spent', fmt(total));
  setText('total-count', `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`);

  // Every client from CLIENT_PROJECTS always shows, even at $0, so Loulou
  // can see who hasn't logged anything yet, not just who has. Sorted by
  // spend descending so the biggest line items are immediately visible.
  const byClient = Object.keys(CLIENT_PROJECTS)
    .map(client => ({ client, amt: sum(rows.filter(r => r.client === client)) }))
    .sort((a, b) => b.amt - a.amt);

  const wrap = document.getElementById('client-breakdown');
  wrap.innerHTML = byClient.map(({ client, amt }) => {
    const isOpen = clientFilter === client;
    // Expanded client shows its own projects' spend right underneath —
    // same sum-by-filter logic as the client total, just one level deeper
    // (Emmett, 2026-10-01: "show the dropdown of categories within the
    // client and the spend there" when clicked from this list).
    const projectRows = isOpen
      ? CLIENT_PROJECTS[client].map(project => {
          const pAmt = sum(rows.filter(r => r.client === client && r.project === project));
          return `<div class="project-row">
            <span class="project-name">${esc(project)}</span>
            <span class="project-amt">${fmt(pAmt)}</span>
          </div>`;
        }).join('')
      : '';
    return `
    <div class="client-row${isOpen ? ' selected' : ''}" data-client="${esc(client)}">
      <span class="client-name">${esc(client)}</span>
      <span class="client-amt">${fmt(amt)}</span>
    </div>
    ${isOpen ? `<div class="project-breakdown">${projectRows}</div>` : ''}`;
  }).join('');

  wrap.querySelectorAll('.client-row').forEach(el =>
    el.addEventListener('click', () => {
      const c = el.dataset.client;
      clientFilter = clientFilter === c ? null : c;
      document.getElementById('filter-banner').classList.toggle('hidden', !clientFilter);
      if (clientFilter) setText('filter-banner-label', clientFilter);
      renderSummary();
      renderTable();
    })
  );
}

// ── Table view ────────────────────────────────────────────────────────────────
function filtered() {
  let data = [...rows];
  if (clientFilter) data = data.filter(r => r.client === clientFilter);
  if (search) {
    const q = search.toLowerCase();
    data = data.filter(r =>
      (r.client      || '').toLowerCase().includes(q) ||
      (r.project     || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    );
  }
  data.sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (sortCol === 'amount') { av = +av; bv = +bv; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });
  return data;
}

function renderTable() {
  document.querySelectorAll('th.sh').forEach(th => {
    const col = th.dataset.col;
    const isSorted = col === sortCol;
    th.classList.toggle('sorted', isSorted);
    th.textContent = {
      date:    'Date',
      client:  'Client',
      project: 'Project',
      amount:  'Amount',
    }[col] + (isSorted ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕');
  });

  const data = filtered();
  const tbody = document.getElementById('entries-tbody');

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No entries match your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(e => `<tr>
    <td style="white-space:nowrap;color:#8b949e">${fmtDate(e.date)}</td>
    <td>${esc(e.client)}</td>
    <td>${esc(e.project)}</td>
    <td class="amount-actual" style="white-space:nowrap">${fmt(+e.amount)}</td>
    <td class="note-text">${esc(e.description || '')}</td>
    <td style="white-space:nowrap"><button class="btn-edit" data-id="${e.id}" title="Edit">✏</button> <button class="btn-del" data-id="${e.id}">✕</button></td>
  </tr>`).join('');

  tbody.querySelectorAll('.btn-del').forEach(b =>
    b.addEventListener('click', () => openDelete(b.dataset.id))
  );
  tbody.querySelectorAll('.btn-edit').forEach(b =>
    b.addEventListener('click', () => {
      const entry = rows.find(r => String(r.id) === b.dataset.id);
      if (entry) openEditModal(entry);
    })
  );
}

// ── Client → Project cascading select ────────────────────────────────────────
function populateClientSelect(selected) {
  const sel = document.getElementById('f-client');
  sel.innerHTML = '<option value="">— select —</option>' +
    Object.keys(CLIENT_PROJECTS).map(c => `<option${c === selected ? ' selected' : ''}>${esc(c)}</option>`).join('');
}

function populateProjectSelect(client) {
  const sel = document.getElementById('f-project');
  const projects = CLIENT_PROJECTS[client] || [];
  sel.innerHTML = projects.map(p => `<option>${esc(p)}</option>`).join('');
  sel.disabled = projects.length === 0;
  // Only one project for this client — select it automatically so there's
  // nothing redundant to click (Loulou: "choose one of the categories
  // within the client (if there are multiple)" — implies no real choice
  // when there's only one).
  if (projects.length === 1) sel.value = projects[0];
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal() {
  editId = null;
  document.getElementById('modal-title').textContent = 'Add Entry';
  document.getElementById('btn-submit').textContent  = 'Add Entry';
  document.getElementById('entry-form').reset();
  populateClientSelect(null);
  document.getElementById('f-project').innerHTML = '<option value="">— select client first —</option>';
  document.getElementById('f-project').disabled = true;
  document.getElementById('f-date').value = todayStr();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openEditModal(entry) {
  editId = entry.id;
  document.getElementById('modal-title').textContent = 'Edit Entry';
  document.getElementById('btn-submit').textContent  = 'Save Changes';
  document.getElementById('entry-form').reset();
  populateClientSelect(entry.client);
  populateProjectSelect(entry.client);
  document.getElementById('f-project').value     = entry.project;
  document.getElementById('f-date').value        = entry.date;
  document.getElementById('f-amount').value      = entry.amount;
  document.getElementById('f-description').value = entry.description || '';
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  editId = null;
  document.getElementById('modal-overlay').classList.add('hidden');
}
function openDelete(id) {
  deleteId = id;
  document.getElementById('delete-overlay').classList.remove('hidden');
}
function closeDelete() {
  deleteId = null;
  document.getElementById('delete-overlay').classList.add('hidden');
}

// ── Bind events ───────────────────────────────────────────────────────────────
function bindAll() {
  document.getElementById('btn-add-entry').addEventListener('click', openModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  document.getElementById('f-client').addEventListener('change', e => {
    const client = e.target.value;
    const projSel = document.getElementById('f-project');
    if (!client) {
      projSel.innerHTML = '<option value="">— select client first —</option>';
      projSel.disabled = true;
      return;
    }
    populateProjectSelect(client);
  });

  document.getElementById('entry-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn    = document.getElementById('btn-submit');
    const isEdit = !!editId;
    const client  = document.getElementById('f-client').value;
    const project = document.getElementById('f-project').value;
    if (!client || !project) { alert('Pick a client and project first.'); return; }

    btn.disabled = true; btn.textContent = 'Saving…';
    const payload = {
      date:        document.getElementById('f-date').value,
      client,
      project,
      amount:      parseFloat(document.getElementById('f-amount').value),
      description: document.getElementById('f-description').value.trim() || null,
    };
    const ok = isEdit ? await update(editId, payload) : await insert(payload);
    btn.disabled = false; btn.textContent = isEdit ? 'Save Changes' : 'Add Entry';
    if (!ok) { alert('Error saving — please try again.'); return; }
    closeModal();
    await load();
  });

  document.getElementById('delete-cancel').addEventListener('click', closeDelete);
  document.getElementById('delete-overlay').addEventListener('click', e => {
    if (e.target.id === 'delete-overlay') closeDelete();
  });
  document.getElementById('delete-confirm').addEventListener('click', async () => {
    if (!deleteId) return;
    await remove(deleteId);
    closeDelete();
    await load();
  });

  document.getElementById('filter-clear').addEventListener('click', () => {
    clientFilter = null;
    document.getElementById('filter-banner').classList.add('hidden');
    renderSummary();
    renderTable();
  });

  document.getElementById('search-input').addEventListener('input', e => {
    search = e.target.value;
    renderTable();
  });

  document.querySelectorAll('th.sh').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = col === 'amount' ? 'desc' : 'asc';
      }
      renderTable();
    });
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function sum(arr) { return arr.reduce((s, r) => s + Number(r.amount), 0); }
function fmt(n)   { return '$' + Math.round(n).toLocaleString('en-US'); }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${+m}/${+d}/${y}`;
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
