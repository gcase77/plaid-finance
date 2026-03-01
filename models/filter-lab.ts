import express from "express";

const app = express();
const port = Number(process.env.FILTER_LAB_PORT || 8787);

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Filter Lab POC</title>
  <style>
    :root { color-scheme: dark; --bg:#0b1020; --panel:#131a30; --soft:#1c2540; --ink:#dfe7ff; --muted:#93a1c9; --accent:#7aa2ff; --good:#22c55e; --bad:#ef4444; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; color: var(--ink); background: linear-gradient(180deg, #090e1c, #0f1730); }
    .wrap { max-width: 1320px; margin: 0 auto; padding: 20px; }
    .hero { margin-bottom: 12px; }
    .hero h1 { margin: 0; font-size: 23px; }
    .hero p { margin: 6px 0 0; color: var(--muted); }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .tab-btn { border: 1px solid #2b3866; background: #121a33; color: var(--ink); padding: 8px 12px; border-radius: 10px; cursor: pointer; user-select: none; }
    .tab-btn.active { background: #223269; border-color: #4666ca; }
    .grid { display: grid; grid-template-columns: 380px 1fr; gap: 12px; }
    .panel { background: var(--panel); border: 1px solid #2b3866; border-radius: 14px; padding: 12px; }
    .panel h3 { margin: 0 0 8px; font-size: 16px; }
    .hint { color: var(--muted); font-size: 12px; margin: 0 0 8px; }
    .section { margin-bottom: 12px; }
    .input, .select { width: 100%; border-radius: 10px; border: 1px solid #34467d; background: #0f1730; color: var(--ink); padding: 8px; }
    .select[multiple] { min-height: 120px; }
    .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; display: block; }
    .group { border: 1px solid #314477; border-radius: 10px; padding: 8px; margin-bottom: 10px; }
    .option { display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 13px; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .pill { background: #1f2a54; border: 1px solid #3f5295; border-radius: 999px; padding: 4px 8px; font-size: 12px; color: #d7e0ff; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #2b3866; padding: 8px 6px; text-align: left; }
    th { color: #a9b8e8; font-weight: 600; }
    .amt-pos { color: var(--bad); }
    .amt-neg { color: var(--good); }
    .row { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .btn { border: 1px solid #3f5295; background: #1a2650; color: var(--ink); border-radius: 8px; padding: 7px 10px; cursor: pointer; }
    .btn:disabled { opacity: .45; cursor: not-allowed; }
    .range-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .k2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .badge { border: 1px solid #3a4d88; background: #1a2650; border-radius: 8px; padding: 2px 6px; font-size: 11px; color: #c7d6ff; }
    .hidden { display: none; }
    .foot { margin-top: 8px; font-size: 12px; color: var(--muted); }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>Transactions Filter POC Lab</h1>
      <p>Same filter fields across all concepts: name, merchant, bank, accounts, categories, amount, date range.</p>
    </div>
    <div class="tabs">
      <button type="button" class="tab-btn active" data-tab="a">Concept A: Compact Bar</button>
      <button type="button" class="tab-btn" data-tab="b">Concept B: Left Rail</button>
      <button type="button" class="tab-btn" data-tab="c">Concept C: Stack Cards</button>
    </div>
    <section id="tab-a" class="tab-root">
      <div class="grid">
        <div class="panel">
          <h3>Compact Bar</h3>
          <p class="hint">Dense controls, quick scanning.</p>
          <div class="k2">
            <div class="section"><label class="label">Name contains</label><input id="aName" class="input" /></div>
            <div class="section"><label class="label">Merchant contains</label><input id="aMerchant" class="input" /></div>
          </div>
          <div class="section">
            <label class="label">Bank</label>
            <select id="aBank" class="select" multiple></select>
          </div>
          <div class="k2">
            <div class="section">
              <label class="label">Accounts</label>
              <select id="aAccounts" class="select" multiple></select>
            </div>
            <div class="section">
              <label class="label">Categories</label>
              <select id="aCategories" class="select" multiple></select>
            </div>
          </div>
          <div class="section">
            <label class="label">Amount range (absolute)</label>
            <div class="range-row">
              <input id="aAmtMin" class="input" type="number" placeholder="min" />
              <input id="aAmtMax" class="input" type="number" placeholder="max" />
            </div>
          </div>
          <div class="section">
            <label class="label">Date range</label>
            <div class="range-row">
              <input id="aDateStart" class="input" type="date" />
              <input id="aDateEnd" class="input" type="date" />
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="meta" id="aMeta"></div>
          <div id="aTable"></div>
        </div>
      </div>
    </section>
    <section id="tab-b" class="tab-root hidden">
      <div class="grid">
        <div class="panel">
          <h3>Left Rail</h3>
          <p class="hint">Facets with counts + text + range fields.</p>
          <div class="group">
            <label class="label">Name contains</label>
            <input id="bName" class="input" />
          </div>
          <div class="group">
            <label class="label">Merchant contains</label>
            <input id="bMerchant" class="input" />
          </div>
          <div class="group">
            <label class="label">Banks</label>
            <div id="bBanks"></div>
          </div>
          <div class="group">
            <label class="label">Accounts</label>
            <div id="bAccounts"></div>
          </div>
          <div class="group">
            <label class="label">Categories</label>
            <div id="bCategories"></div>
          </div>
          <div class="group">
            <label class="label">Amount range (absolute)</label>
            <div class="range-row">
              <input id="bAmtMin" class="input" type="number" placeholder="min" />
              <input id="bAmtMax" class="input" type="number" placeholder="max" />
            </div>
          </div>
          <div class="group">
            <label class="label">Date range</label>
            <div class="range-row">
              <input id="bDateStart" class="input" type="date" />
              <input id="bDateEnd" class="input" type="date" />
            </div>
          </div>
          <button class="btn" id="bClear">Clear all</button>
        </div>
        <div class="panel">
          <div class="meta" id="bMeta"></div>
          <div id="bTable"></div>
        </div>
      </div>
    </section>
    <section id="tab-c" class="tab-root hidden">
      <div class="grid">
        <div class="panel">
          <h3>Stack Cards</h3>
          <p class="hint">Large touch-friendly cards for each filter group.</p>
          <div class="group">
            <label class="label">Name contains</label>
            <input id="cName" class="input" />
          </div>
          <div class="group">
            <label class="label">Merchant contains</label>
            <input id="cMerchant" class="input" />
          </div>
          <div class="group">
            <label class="label">Bank</label>
            <select id="cBank" class="select" multiple></select>
          </div>
          <div class="group">
            <label class="label">Accounts</label>
            <select id="cAccounts" class="select" multiple></select>
          </div>
          <div class="group">
            <label class="label">Categories</label>
            <select id="cCategories" class="select" multiple></select>
          </div>
          <div class="group">
            <label class="label">Amount range (absolute)</label>
            <div class="range-row">
              <input id="cAmtMin" class="input" type="number" placeholder="min" />
              <input id="cAmtMax" class="input" type="number" placeholder="max" />
            </div>
          </div>
          <div class="group">
            <label class="label">Date range</label>
            <div class="range-row">
              <input id="cDateStart" class="input" type="date" />
              <input id="cDateEnd" class="input" type="date" />
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="meta" id="cMeta"></div>
          <div id="cTable"></div>
        </div>
      </div>
    </section>
  </div>
  <script>
    const data = [
      { id:"t1", date:"2026-01-28", bank:"Chase", account:"Freedom", merchant:"Trader Joe's", category:"Groceries", amount:86.21, name:"Trader Joe's #112" },
      { id:"t2", date:"2026-01-29", bank:"Chase", account:"Freedom", merchant:"Shell", category:"Gas", amount:52.11, name:"Shell Station 442" },
      { id:"t3", date:"2026-01-30", bank:"SoFi", account:"Checking", merchant:"Payroll", category:"Income", amount:-2380.00, name:"ACME Payroll" },
      { id:"t4", date:"2026-02-01", bank:"Amex", account:"Gold", merchant:"Delta", category:"Travel", amount:341.99, name:"Delta Airlines" },
      { id:"t5", date:"2026-02-02", bank:"SoFi", account:"Checking", merchant:"Venmo", category:"Transfer", amount:250.00, name:"Venmo Transfer" },
      { id:"t6", date:"2026-02-03", bank:"Chase", account:"Sapphire", merchant:"OpenTable", category:"Dining", amount:94.42, name:"OpenTable - Date Night" },
      { id:"t7", date:"2026-02-04", bank:"Capital One", account:"Venture", merchant:"Amazon", category:"Shopping", amount:129.57, name:"Amazon Marketplace" },
      { id:"t8", date:"2026-02-05", bank:"SoFi", account:"Savings", merchant:"SoFi", category:"Income", amount:-5.21, name:"Interest Credit" },
      { id:"t9", date:"2026-02-06", bank:"Amex", account:"Gold", merchant:"Whole Foods", category:"Groceries", amount:120.84, name:"Whole Foods 0199" },
      { id:"t10", date:"2026-02-07", bank:"Chase", account:"Freedom", merchant:"HBO Max", category:"Subscriptions", amount:16.99, name:"HBO Max Monthly" },
      { id:"t11", date:"2026-02-08", bank:"Capital One", account:"Checking", merchant:"Landlord", category:"Housing", amount:1450.00, name:"Rent February" },
      { id:"t12", date:"2026-02-09", bank:"SoFi", account:"Checking", merchant:"Coffee Project", category:"Dining", amount:9.25, name:"Coffee Project 8th" }
    ];

    const unique = (k) => [...new Set(data.map(r => r[k]))].sort((a, b) => String(a).localeCompare(String(b)));
    const money = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toFixed(2);
    const abs = (n) => Math.abs(Number(n || 0));
    const selectedValues = (id) => Array.from(document.getElementById(id).selectedOptions || []).map(o => o.value);
    const contains = (text, term) => String(text || "").toLowerCase().includes(String(term || "").toLowerCase());
    const validDate = (s) => s ? new Date(s + "T00:00:00") : null;

    function baseFilter(rows, f) {
      const start = validDate(f.dateStart);
      const end = validDate(f.dateEnd);
      if (end) end.setHours(23,59,59,999);
      return rows.filter(r => {
        if (f.name && !contains(r.name, f.name)) return false;
        if (f.merchant && !contains(r.merchant, f.merchant)) return false;
        if (f.banks.length && !f.banks.includes(r.bank)) return false;
        if (f.accounts.length && !f.accounts.includes(r.account)) return false;
        if (f.categories.length && !f.categories.includes(r.category)) return false;
        if (f.amountMin !== "" && abs(r.amount) < Number(f.amountMin)) return false;
        if (f.amountMax !== "" && abs(r.amount) > Number(f.amountMax)) return false;
        const d = new Date(r.date + "T00:00:00");
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    function renderTable(hostId, rows) {
      const host = document.getElementById(hostId);
      if (!rows.length) { host.innerHTML = "<p class='hint'>No rows match current filters.</p>"; return; }
      host.innerHTML = "<table><thead><tr><th>Date</th><th>Name</th><th>Merchant</th><th>Bank</th><th>Account</th><th>Category</th><th>Amount</th></tr></thead><tbody>"
        + rows.map(r => "<tr><td>" + r.date + "</td><td>" + r.name + "</td><td>" + r.merchant + "</td><td>" + r.bank + "</td><td>" + r.account + "</td><td>" + r.category + "</td><td class='" + (r.amount < 0 ? "amt-neg" : "amt-pos") + "'>" + money(r.amount) + "</td></tr>").join("")
        + "</tbody></table>";
    }

    function renderMeta(hostId, rows, label) {
      const spend = rows.filter(r => r.amount > 0).reduce((a, b) => a + b.amount, 0);
      const income = rows.filter(r => r.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);
      document.getElementById(hostId).innerHTML =
        "<span class='pill'>" + label + "</span>" +
        "<span class='pill'>Rows: " + rows.length + "</span>" +
        "<span class='pill'>Spend: $" + spend.toFixed(2) + "</span>" +
        "<span class='pill'>Income: $" + income.toFixed(2) + "</span>";
    }

    function fillMultiSelect(id, values) {
      document.getElementById(id).innerHTML = values.map(v => "<option value='" + v + "'>" + v + "</option>").join("");
    }

    function readFilters(prefix) {
      return {
        name: document.getElementById(prefix + "Name").value.trim(),
        merchant: document.getElementById(prefix + "Merchant").value.trim(),
        banks: selectedValues(prefix + "Bank").concat(selectedValues(prefix + "Banks")),
        accounts: selectedValues(prefix + "Accounts"),
        categories: selectedValues(prefix + "Categories"),
        amountMin: document.getElementById(prefix + "AmtMin").value.trim(),
        amountMax: document.getElementById(prefix + "AmtMax").value.trim(),
        dateStart: document.getElementById(prefix + "DateStart").value,
        dateEnd: document.getElementById(prefix + "DateEnd").value
      };
    }

    function wireAllInputs(prefix, rerender) {
      const ids = ["Name","Merchant","Bank","Banks","Accounts","Categories","AmtMin","AmtMax","DateStart","DateEnd"];
      ids.forEach(s => {
        const el = document.getElementById(prefix + s);
        if (!el) return;
        el.addEventListener("input", rerender);
        el.addEventListener("change", rerender);
      });
    }

    function renderA() {
      const rows = baseFilter(data, readFilters("a"));
      renderMeta("aMeta", rows, "Concept A");
      renderTable("aTable", rows);
    }

    function renderB() {
      const rows = baseFilter(data, readFilters("b"));
      renderMeta("bMeta", rows, "Concept B");
      renderTable("bTable", rows);
    }

    function renderC() {
      const rows = baseFilter(data, readFilters("c"));
      renderMeta("cMeta", rows, "Concept C");
      renderTable("cTable", rows);
    }

    function wireTabs() {
      document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const key = btn.getAttribute("data-tab");
          document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
          btn.classList.add("active");
          document.querySelectorAll(".tab-root").forEach(x => x.classList.add("hidden"));
          document.getElementById("tab-" + key).classList.remove("hidden");
        });
      });
    }

    function renderChecklist(id, values, selectedRef, onChange) {
      const root = document.getElementById(id);
      root.innerHTML = values.map(v => {
        const count = data.filter(r => r[id === "bBanks" ? "bank" : id === "bAccounts" ? "account" : "category"] === v).length;
        return "<label class='option'><input type='checkbox' value='" + v + "' " + (selectedRef.has(v) ? "checked" : "") + "/> <span>" + v + "</span> <span class='badge'>" + count + "</span></label>";
      }).join("");
      root.querySelectorAll("input[type='checkbox']").forEach(cb => {
        cb.addEventListener("change", (e) => {
          const v = e.target.value;
          if (e.target.checked) selectedRef.add(v); else selectedRef.delete(v);
          onChange();
        });
      });
    }

    function init() {
      const banks = unique("bank");
      const accounts = unique("account");
      const categories = unique("category");

      fillMultiSelect("aBank", banks);
      fillMultiSelect("aAccounts", accounts);
      fillMultiSelect("aCategories", categories);
      fillMultiSelect("cBank", banks);
      fillMultiSelect("cAccounts", accounts);
      fillMultiSelect("cCategories", categories);

      wireTabs();
      wireAllInputs("a", renderA);
      wireAllInputs("c", renderC);

      const bState = { banks:new Set(), accounts:new Set(), categories:new Set() };
      const syncBHidden = () => {
        document.getElementById("bBanks").dataset.values = JSON.stringify([...bState.banks]);
        document.getElementById("bAccounts").dataset.values = JSON.stringify([...bState.accounts]);
        document.getElementById("bCategories").dataset.values = JSON.stringify([...bState.categories]);
      };
      const readB = () => ({
        name: document.getElementById("bName").value.trim(),
        merchant: document.getElementById("bMerchant").value.trim(),
        banks: [...bState.banks],
        accounts: [...bState.accounts],
        categories: [...bState.categories],
        amountMin: document.getElementById("bAmtMin").value.trim(),
        amountMax: document.getElementById("bAmtMax").value.trim(),
        dateStart: document.getElementById("bDateStart").value,
        dateEnd: document.getElementById("bDateEnd").value
      });
      const redrawB = () => {
        syncBHidden();
        const rows = baseFilter(data, readB());
        renderMeta("bMeta", rows, "Concept B");
        renderTable("bTable", rows);
      };
      renderChecklist("bBanks", banks, bState.banks, redrawB);
      renderChecklist("bAccounts", accounts, bState.accounts, redrawB);
      renderChecklist("bCategories", categories, bState.categories, redrawB);
      ["bName","bMerchant","bAmtMin","bAmtMax","bDateStart","bDateEnd"].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener("input", redrawB);
        el.addEventListener("change", redrawB);
      });
      document.getElementById("bClear").addEventListener("click", () => {
        ["bName","bMerchant","bAmtMin","bAmtMax","bDateStart","bDateEnd"].forEach(id => document.getElementById(id).value = "");
        bState.banks.clear(); bState.accounts.clear(); bState.categories.clear();
        renderChecklist("bBanks", banks, bState.banks, redrawB);
        renderChecklist("bAccounts", accounts, bState.accounts, redrawB);
        renderChecklist("bCategories", categories, bState.categories, redrawB);
        redrawB();
      });

      renderA();
      redrawB();
      renderC();
    }

    init();
  </script>
</body>
</html>`;

app.get("/", (_req, res) => {
  res.type("html").send(html);
});

app.listen(port, () => {
  console.log(`Filter lab: http://localhost:${port}`);
});

