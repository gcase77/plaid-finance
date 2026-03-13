import express from "express";

const app = express();
const port = Number(process.env.TAGS_UI_PORT || 8788);


const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tagging Concepts</title>
  <style>
    :root { color-scheme: light dark; --bg:#050816; --bg-elevated:#0b1120; --border-subtle:rgba(148,163,184,.4); --text:#e5e7eb; --muted:#9ca3af; --accent:#38bdf8; }
    *,*::before,*::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui,-apple-system,sans-serif; background: radial-gradient(circle at top,#0f172a,#020617 55%); color: var(--text); }
    .app-shell { max-width: 1120px; margin: 32px auto; padding: 24px 24px 32px; border-radius: 24px; background: radial-gradient(circle at top left,rgba(56,189,248,.12),transparent 55%),radial-gradient(circle at top right,rgba(217,70,239,.12),transparent 55%),linear-gradient(to bottom right,rgba(15,23,42,.95),rgba(15,23,42,.98)); border: 1px solid rgba(148,163,184,.35); box-shadow: 0 40px 80px rgba(15,23,42,.9),0 0 0 1px rgba(15,23,42,.9); }
    .app-header h1 { margin: 0 0 4px; letter-spacing: -.03em; font-size: 26px; }
    .app-header p { margin: 0; color: var(--muted); font-size: 14px; }
    .concept-tabs { display: inline-flex; margin-top: 20px; padding: 4px; border-radius: 999px; background: radial-gradient(circle at top left,rgba(148,163,184,.35),rgba(15,23,42,.95)); box-shadow: inset 0 0 0 1px rgba(15,23,42,.9); }
    .concept-tab { border: 0; padding: 6px 14px; border-radius: 999px; background: transparent; color: var(--muted); font-size: 12px; cursor: pointer; transition: all 120ms ease-out; white-space: nowrap; }
    .concept-tab--active { background: radial-gradient(circle at top,rgba(248,250,252,.12),rgba(248,250,252,.04)); color: #f9fafb; box-shadow: 0 10px 20px rgba(15,23,42,.6),0 0 0 1px rgba(148,163,184,.8); }
    .concept-body { margin-top: 24px; padding-top: 18px; border-top: 1px solid rgba(148,163,184,.4); }
    .concept-panel { display: none; }
    .concept-panel.active { display: block; }
    .concept-header h2 { margin: 0 0 4px; font-size: 18px; }
    .concept-header p { margin: 0 0 14px; font-size: 13px; color: var(--muted); }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
    .table th,.table td { padding: 8px 10px; border-bottom: 1px solid rgba(30,41,59,.9); }
    .table thead th { font-weight: 500; color: var(--muted); text-align: left; font-size: 12px; }
    .text-right { text-align: right; }
    .select { width: 100%; padding: 4px 8px; font-size: 12px; border-radius: 999px; border: 1px solid var(--border-subtle); background: rgba(15,23,42,.85); color: var(--text); }
    .palette { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 6px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(148,163,184,.7); background: rgba(15,23,42,.8); color: var(--muted); font-size: 11px; cursor: pointer; transition: all 120ms ease-out; }
    .pill-dot { width: 8px; height: 8px; border-radius: 999px; }
    .pill--active { background: radial-gradient(circle at top,rgba(248,250,252,.16),rgba(15,23,42,1)); color: #e5e7eb; box-shadow: 0 0 0 1px rgba(248,250,252,.35),0 10px 24px rgba(15,23,42,.9); }
    .palette-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .btn { border-radius: 999px; border: 1px solid rgba(148,163,184,.6); background: rgba(15,23,42,.85); color: #e5e7eb; font-size: 12px; padding: 5px 12px; cursor: pointer; }
    .btn-ghost { border-style: dashed; color: var(--muted); }
    .row--selected { background: radial-gradient(circle at left,rgba(56,189,248,.2),rgba(15,23,42,.95)); }
    .chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; border: 1px solid rgba(148,163,184,.7); background: rgba(15,23,42,.9); font-size: 11px; }
    .chip-dot { width: 8px; height: 8px; border-radius: 999px; }
    .muted { color: var(--muted); }
    .small { font-size: 11px; }
    .matrix-scroll { overflow-x: auto; margin-top: 6px; }
    .matrix { min-width: 640px; }
    .matrix-tag-label { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; color: var(--muted); }
    .matrix-txn-label { display: flex; flex-direction: column; gap: 2px; }
    .matrix-cell { width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(148,163,184,.4); background: rgba(15,23,42,.8); cursor: pointer; }
    .matrix-cell--active { box-shadow: 0 0 0 1px rgba(15,23,42,.9),0 0 0 2px rgba(248,250,252,.6); }
    @media (max-width: 768px) {
      .app-shell { margin: 16px; padding: 18px 16px 24px; max-width: 100%; overflow-x: auto; }
      .concept-tabs { flex-wrap: wrap; }
      .concept-tab { font-size: 11px; padding: 6px 10px; }
      .table { font-size: 12px; }
      .table th, .table td { padding: 6px 8px; }
      .matrix { min-width: 520px; }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <header class="app-header">
      <h1>Tagging Concepts</h1>
      <p>Three standalone ideas for how tagging could feel.</p>
    </header>
    <nav class="concept-tabs">
      <button type="button" class="concept-tab concept-tab--active" data-concept="inline">1. Inline per-row</button>
      <button type="button" class="concept-tab" data-concept="pill-palette">2. Tag palette</button>
      <button type="button" class="concept-tab" data-concept="matrix">3. Tag matrix</button>
    </nav>
    <main class="concept-body">
      <section id="panel-inline" class="concept-panel active">
        <header class="concept-header">
          <h2>Inline per-row</h2>
          <p>Each transaction owns its own compact tag selector, good for highly precise manual tagging.</p>
        </header>
        <table class="table">
          <thead><tr><th>Date</th><th>Merchant</th><th class="text-right">Amount</th><th>Tag</th></tr></thead>
          <tbody id="inline-tbody"></tbody>
        </table>
      </section>
      <section id="panel-pill-palette" class="concept-panel">
        <header class="concept-header">
          <h2>Global tag palette</h2>
          <p>Pick a tag once, paint it onto a set of checked rows. Optimized for speed.</p>
        </header>
        <div class="palette" id="pill-palette"></div>
        <div class="palette-actions">
          <button type="button" class="btn" id="apply-tag-btn">Apply tag to <span id="selected-count">0</span> selected</button>
          <button type="button" class="btn btn-ghost" id="clear-tags-btn">Clear tags on selected</button>
        </div>
        <table class="table">
          <thead><tr><th></th><th>Date</th><th>Merchant</th><th class="text-right">Amount</th><th>Tag</th></tr></thead>
          <tbody id="palette-tbody"></tbody>
        </table>
      </section>
      <section id="panel-matrix" class="concept-panel">
        <header class="concept-header">
          <h2>Tag matrix</h2>
          <p>Tags are columns; click to toggle intersections. Helpful for visually scanning which tags are applied where.</p>
        </header>
        <div class="matrix-scroll">
          <table class="table matrix">
            <thead><tr id="matrix-head-row"><th>Transaction</th></tr></thead>
            <tbody id="matrix-tbody"></tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
  <script>
    var TAGS = [
      {id:1, name:"Rent", color:"#f97316", group:"Housing"},
      {id:2, name:"Groceries", color:"#22c55e", group:"Living"},
      {id:3, name:"Salary", color:"#0ea5e9", group:"Income"},
      {id:4, name:"Dining Out", color:"#a855f7", group:"Living"},
      {id:5, name:"Travel", color:"#e11d48", group:"Fun"}
    ];
    var TXNS = [
      {id:"t1", date:"2025-02-01", name:"ACME Payroll", amount:4200},
      {id:"t2", date:"2025-02-02", name:"Whole Foods", amount:-86.23},
      {id:"t3", date:"2025-02-03", name:"Landlord LLC", amount:-2150},
      {id:"t4", date:"2025-02-04", name:"Chipotle", amount:-14.75},
      {id:"t5", date:"2025-02-05", name:"Delta Airlines", amount:-512.4}
    ];

    document.querySelectorAll(".concept-tab").forEach(function(btn) {
      btn.addEventListener("click", function() {
        document.querySelectorAll(".concept-tab").forEach(function(b) { b.classList.remove("concept-tab--active"); });
        document.querySelectorAll(".concept-panel").forEach(function(p) { p.classList.remove("active"); });
        this.classList.add("concept-tab--active");
        document.getElementById("panel-" + this.dataset.concept).classList.add("active");
      });
    });

    var tagByTxn = {};
    var inlineTbody = document.getElementById("inline-tbody");
    TXNS.forEach(function(t) {
      var tr = document.createElement("tr");
      var sel = document.createElement("select");
      sel.className = "select";
      sel.innerHTML = '<option value="">Unassigned</option>' + TAGS.map(function(tag) { return '<option value="' + tag.id + '">' + tag.name + '</option>'; }).join('');
      sel.value = String(tagByTxn[t.id] || '');
      sel.addEventListener("change", function() {
        tagByTxn[t.id] = this.value ? Number(this.value) : null;
        this.value = String(tagByTxn[t.id] || '');
      });
      tr.innerHTML = '<td>' + t.date + '</td><td>' + t.name + '</td><td class="text-right">' + t.amount.toFixed(2) + '</td><td></td>';
      tr.querySelector("td:last-child").appendChild(sel);
      inlineTbody.appendChild(tr);
    });

    var selectedTxnIds = new Set();
    var paletteTagByTxn = {};
    var activeTagId = (TAGS[0] && TAGS[0].id) || null;
    var pillPalette = document.getElementById("pill-palette");
    TAGS.forEach(function(tag) {
      var pillBtn = document.createElement("button");
      pillBtn.type = "button";
      pillBtn.className = "pill" + (activeTagId === tag.id ? " pill--active" : "");
      pillBtn.style.borderColor = tag.color;
      pillBtn.style.color = tag.color;
      pillBtn.innerHTML = '<span class="pill-dot" style="background:' + tag.color + '"></span>' + tag.name;
      pillBtn.addEventListener("click", function() {
        activeTagId = tag.id;
        document.querySelectorAll("#pill-palette .pill").forEach(function(b) { b.classList.remove("pill--active"); });
        this.classList.add("pill--active");
      });
      pillPalette.appendChild(pillBtn);
    });
    function renderPaletteTable() {
      var tbody = document.getElementById("palette-tbody");
      tbody.innerHTML = "";
      document.getElementById("selected-count").textContent = selectedTxnIds.size;
      TXNS.forEach(function(t) {
        var isSelected = selectedTxnIds.has(t.id);
        var tagId = paletteTagByTxn[t.id];
        var tag = TAGS.find(function(x) { return x.id === tagId; });
        var tr = document.createElement("tr");
        if (isSelected) tr.classList.add("row--selected");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = isSelected;
        cb.addEventListener("change", function() {
          if (this.checked) selectedTxnIds.add(t.id); else selectedTxnIds.delete(t.id);
          renderPaletteTable();
        });
        tr.innerHTML = '<td></td><td>' + t.date + '</td><td>' + t.name + '</td><td class="text-right">' + t.amount.toFixed(2) + '</td><td></td>';
        tr.querySelector("td:first-child").appendChild(cb);
        var tagCell = tr.querySelector("td:last-child");
        if (tag) {
          var chip = document.createElement("span");
          chip.className = "chip";
          chip.innerHTML = '<span class="chip-dot" style="background:' + tag.color + '"></span>' + tag.name;
          tagCell.appendChild(chip);
        } else {
          var m = document.createElement("span");
          m.className = "muted";
          m.textContent = "Unassigned";
          tagCell.appendChild(m);
        }
        tbody.appendChild(tr);
      });
    }
    renderPaletteTable();
    document.getElementById("apply-tag-btn").addEventListener("click", function() {
      if (!activeTagId || selectedTxnIds.size === 0) return;
      selectedTxnIds.forEach(function(id) { paletteTagByTxn[id] = activeTagId; });
      renderPaletteTable();
    });
    document.getElementById("clear-tags-btn").addEventListener("click", function() {
      selectedTxnIds.forEach(function(id) { delete paletteTagByTxn[id]; });
      renderPaletteTable();
    });

    var tagIdsByTxn = {};
    var headRow = document.getElementById("matrix-head-row");
    TAGS.forEach(function(tag) {
      var th = document.createElement("th");
      var s = document.createElement("span");
      s.className = "matrix-tag-label";
      s.textContent = tag.name;
      th.appendChild(s);
      headRow.appendChild(th);
    });
    var matrixTbody = document.getElementById("matrix-tbody");
    TXNS.forEach(function(t) {
      var tr = document.createElement("tr");
      if (!tagIdsByTxn[t.id]) tagIdsByTxn[t.id] = new Set();
      var activeSet = tagIdsByTxn[t.id];
      var td0 = document.createElement("td");
      td0.innerHTML = '<div class="matrix-txn-label"><div>' + t.name + '</div><div class="muted small">' + t.date + ' · ' + t.amount.toFixed(2) + '</div></div>';
      tr.appendChild(td0);
      TAGS.forEach(function(tag) {
        var td = document.createElement("td");
        var active = activeSet.has(tag.id);
        var cellBtn = document.createElement("button");
        cellBtn.type = "button";
        cellBtn.className = "matrix-cell" + (active ? " matrix-cell--active" : "");
        if (active) { cellBtn.style.backgroundColor = tag.color; cellBtn.style.borderColor = tag.color; }
        cellBtn.addEventListener("click", function() {
          if (activeSet.has(tag.id)) activeSet.delete(tag.id); else activeSet.add(tag.id);
          var on = activeSet.has(tag.id);
          this.classList.toggle("matrix-cell--active", on);
          this.style.backgroundColor = on ? tag.color : "";
          this.style.borderColor = on ? tag.color : "";
        });
        td.appendChild(cellBtn);
        tr.appendChild(td);
      });
      matrixTbody.appendChild(tr);
    });
  </script>
</body>
</html>`;

app.get("/", (_req, res) => {
  res.type("html").send(html);
});

app.listen(port, () => {
  console.log(`Tags UI at http://localhost:${port}`);
});
