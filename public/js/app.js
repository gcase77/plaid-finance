// Consolidated application state
const appState = {
  auth: { userId: null, token: null, mode: "existing" },
  data: { items: [], transactions: [] },
  filters: {
    name: { mode: "contains", value: "" },
    merchant: { mode: "contains", value: "" },
    banks: [],
    accounts: [],
    categories: [],
    amount: { op: "", value: null },
    date: { start: "", end: "" }
  },
  transfers: {
    previewPairs: [],
    ambiguousPairs: [],
    selectedIds: new Set()
  },
  charts: { income: null, spending: null }
};

let supabaseClient = null;

// Initialize Supabase
const initSupabase = () => {
  const supabaseUrl = window.SUPABASE_URL || "";
  const supabaseAnonKey = window.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseAnonKey) {
    setAuthStatus("Missing Supabase config. Check SUPABASE_URL and SUPABASE_ANON_KEY.", true);
    return;
  }
  supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    appState.auth.token = session?.access_token || null;
    if (session?.user) {
      await onAuthenticated(session.user);
    } else if (event === "SIGNED_OUT") {
      appState.auth.token = null;
      showLoginUI();
    }
  });
  checkAuthState();
};

// Helper to fetch with auth token
const fetchWithAuth = async (url, options = {}) => {
  const headers = {
    ...options.headers,
    ...(appState.auth.token ? { 'Authorization': `Bearer ${appState.auth.token}` } : {})
  };
  return fetch(url, { ...options, headers });
};

// DOM manipulation utilities
const DOM = {
  show: (...ids) => ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
  }),
  hide: (...ids) => ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }),
  clear: (...ids) => ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  }),
  setText: (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },
  setValue: (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  },
  loading: (id, message = "Loading...") => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        <span class="text-muted">${message}</span>
      </div>`;
  }
};

const setAuthStatus = (message, isError = false) => {
  const el = document.getElementById("authStatus");
  if (!el) return;
  el.textContent = message || "";
  el.className = `${isError ? "text-danger" : "text-muted"} d-block mt-2`;
};

const formatAuthError = (error) => {
  const message = String(error?.message || error || "Unknown error");
  if (message.includes("Unexpected token '<'")) {
    return "Auth endpoint returned HTML instead of JSON. Usually this is a Supabase outage, timeout, or network/proxy issue.";
  }
  if (/Failed to fetch/i.test(message)) {
    return "Unable to reach Supabase auth service. Check internet/VPN/firewall and Supabase status.";
  }
  return message;
};

const onAuthenticated = async (user) => {
  appState.auth.userId = user.id;
  try {
    await ensureUserExists(user.id, user.email || "");
  } catch (e) {
    console.error('ensureUserExists failed:', e);
    return;
  }
  setAuthStatus("");
  showAuthenticatedUI(user.email || "Unknown");
};

const checkAuthState = async () => {
  if (!supabaseClient) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) await onAuthenticated(session.user);
    else showLoginUI();
  } catch (error) {
    showLoginUI();
    setAuthStatus(`Session check failed: ${formatAuthError(error)}`, true);
  }
};

const showAuthenticatedUI = (email) => {
  DOM.hide("loginForm");
  DOM.show("userAuthInfo", "userPanel", "userColumn");
  DOM.setText("userEmail", email);
  if (window.setAuthState) window.setAuthState(true);
  loadItems();
  refreshVisualizationsIfVisible();
};

const showLoginUI = () => {
  appState.auth.userId = null;
  DOM.show("loginForm");
  DOM.hide("userAuthInfo", "userPanel", "userColumn");
  DOM.clear("itemsList", "transactionsTable", "transferPairsTable");
  DOM.setText("userEmail", "");
  DOM.setText("transferPreviewStatus", "No transfer preview yet");
  DOM.setText("visualizeStatus", "Sign in to view charts");
  appState.data.items = [];
  appState.data.transactions = [];
  appState.transfers.previewPairs = [];
  appState.transfers.ambiguousPairs = [];
  appState.transfers.selectedIds = new Set();
  appState.data.selectedItemId = null;
  if (appState.charts.income) {
    appState.charts.income.destroy();
    appState.charts.income = null;
  }
  if (appState.charts.spending) {
    appState.charts.spending.destroy();
    appState.charts.spending = null;
  }
  if (window.Plotly) {
    const sankeyEl = document.getElementById("cashflowSankey");
    if (sankeyEl) window.Plotly.purge(sankeyEl);
  }
  const signUpBtn = document.getElementById("signUpBtn");
  const signInBtn = document.getElementById("signInBtn");
  if (signUpBtn) signUpBtn.disabled = false;
  if (signInBtn) signInBtn.disabled = false;
  setAuthStatus("");
  if (window.setAuthState) window.setAuthState(false);
  setAuthMode(appState.auth.mode);
};

const getAuthCredentials = (emailId, passwordId) => {
  const emailEl = document.getElementById(emailId);
  const passwordEl = document.getElementById(passwordId);
  const email = emailEl?.value.trim() || "";
  const password = passwordEl?.value || "";
  if (!email || !password) {
    setAuthStatus("Enter both email and password.", true);
    return null;
  }
  return { email, password };
};

const setAuthPending = (isPending) => {
  const signUpBtn = document.getElementById("signUpBtn");
  const signInBtn = document.getElementById("signInBtn");
  if (signUpBtn) signUpBtn.disabled = isPending;
  if (signInBtn) signInBtn.disabled = isPending;
};

const setAuthMode = (mode) => {
  appState.auth.mode = mode === "new" ? "new" : "existing";
  const existingToggle = document.getElementById("existingUserToggle");
  const newToggle = document.getElementById("newUserToggle");
  const existingForm = document.getElementById("existingUserForm");
  const newForm = document.getElementById("newUserForm");
  if (existingToggle) existingToggle.classList.toggle("active", appState.auth.mode === "existing");
  if (newToggle) newToggle.classList.toggle("active", appState.auth.mode === "new");
  if (existingForm) existingForm.style.display = appState.auth.mode === "existing" ? "block" : "none";
  if (newForm) newForm.style.display = appState.auth.mode === "new" ? "block" : "none";
};

const handleSignUp = async (e) => {
  e?.preventDefault();
  if (!supabaseClient) return alert("Supabase not initialized");
  const creds = getAuthCredentials("signUpEmail", "signUpPassword");
  if (!creds) return;
  setAuthPending(true);
  try {
    const { data, error } = await supabaseClient.auth.signUp(creds);
    if (error) return setAuthStatus(`Sign up failed: ${formatAuthError(error)}`, true);
    if (data?.session?.user) {
      setAuthStatus("Account created. You are now signed in.");
      return;
    }
    setAuthStatus("Account created. Sign in now.");
  } catch (error) {
    setAuthStatus(`Sign up failed: ${formatAuthError(error)}`, true);
  } finally {
    setAuthPending(false);
  }
};

const handleSignIn = async (e) => {
  e?.preventDefault();
  if (!supabaseClient) return alert("Supabase not initialized");
  const creds = getAuthCredentials("signInEmail", "signInPassword");
  if (!creds) return;
  setAuthPending(true);
  try {
    const { error } = await supabaseClient.auth.signInWithPassword(creds);
    if (error) return setAuthStatus(`Sign in failed: ${formatAuthError(error)}`, true);
    setAuthStatus("Signed in successfully.");
  } catch (error) {
    setAuthStatus(`Sign in failed: ${formatAuthError(error)}`, true);
  } finally {
    setAuthPending(false);
  }
};

const signOut = async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  showLoginUI();
};

const ensureUserExists = async (id, email) => {
  try {
    const res = await fetchWithAuth("/api/users");
    if (!res.ok) {
      const errorText = await res.text();
      console.error("GET /api/users failed:", res.status, errorText);
      throw new Error(`Failed to fetch users: ${res.status} - ${errorText}`);
    }
    const users = await res.json();
    const exists = users.find(u => u.id === id);
    if (!exists) {
      const createRes = await fetchWithAuth("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email })
      });
      if (!createRes.ok) {
        const errorText = await createRes.text();
        console.error("POST /api/users failed:", createRes.status, errorText);
        throw new Error(`Failed to create user: ${createRes.status} - ${errorText}`);
      }
    }
  } catch (e) {
    console.error("Failed to ensure user exists:", e);
    alert(`Authentication setup failed: ${e.message}. Check browser console for details.`);
    throw e;
  }
};

const getInputValue = (id) => {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
};

const getTxnDateValue = (t) => t.datetime || t.authorized_datetime || "";
const formatTxnDateText = (t) => {
  const raw = getTxnDateValue(t);
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.valueOf())) return String(raw);
  // Reconstruct from UTC year/month/day only, to avoid timezone shifting the displayed day
  const displayDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(displayDate);
};
const txnNameText = (t) => ((t.original_description ?? "").trim() || (t.name ?? ""));
const txnAmountText = (t) => `${String(t.iso_currency_code || "").toUpperCase() === "USD" ? "$  " : "?  "}${t.amount ?? ""}`;
const getTxnIconUrl = (t) => {
  // Prefer counterparty logo_url when it looks like a valid URL, otherwise fall back to personal_finance_category_icon_url
  const rawCounterparties = t.counterparties;
  let logo = null;
  if (Array.isArray(rawCounterparties)) {
    const withLogo = rawCounterparties.find((c) => c && typeof c.logo_url === "string" && c.logo_url.trim());
    logo = withLogo?.logo_url || null;
  } else if (rawCounterparties && typeof rawCounterparties === "object") {
    const maybeLogo = rawCounterparties.logo_url;
    logo = typeof maybeLogo === "string" && maybeLogo.trim() ? maybeLogo : null;
  }
  if (logo) {
    try {
      // Throws if not a valid absolute URL
      // eslint-disable-next-line no-new
      new URL(logo);
      return logo;
    } catch {
      // fall through to category icon
    }
  }
  return t.personal_finance_category_icon_url || null;
};

// Filter metadata configuration
const FILTER_CONFIGS = {
  name: { type: "text", modes: ["contains", "not"] },
  merchant: { type: "text", modes: ["contains", "not", "null"] },
  amount: { type: "numeric", ops: ["", "gt", "lt"] },
  date: { type: "dateRange" }
};

// Filter UI configuration
const FILTER_UI_CONFIGS = {
  name: {
    label: "Name",
    type: "text",
    modes: [
      { id: "contains", label: "Contains" },
      { id: "not", label: "Does not contain" }
    ]
  },
  merchant: {
    label: "Merchant",
    type: "text",
    modes: [
      { id: "contains", label: "Contains" },
      { id: "not", label: "Does not contain" },
      { id: "null", label: "Is null" }
    ]
  },
  banks: {
    label: "Banks",
    type: "multiselect"
  },
  accounts: {
    label: "Accounts",
    type: "multiselect"
  },
  categories: {
    label: "Categories",
    type: "multiselect"
  }
};

function initFilterUI() {
  const container = document.getElementById("filterContainer");
  if (!container) return;

  const filterHTML = Object.entries(FILTER_UI_CONFIGS).map(([key, config]) => {
    const summaryId = `filter${key.charAt(0).toUpperCase() + key.slice(1)}Summary`;

    if (config.type === "text") {
      const modeButtons = config.modes.map(mode =>
        `<button class="btn btn-outline-secondary ${mode.id === 'contains' ? 'active' : ''}"
                 data-filter="${key}" data-mode="${mode.id}">${mode.label}</button>`
      ).join("");

      return `
        <div class="col-md-3">
          <label class="form-label mb-1">${config.label}</label>
          <div class="dropdown">
            <button class="btn btn-outline-secondary dropdown-toggle w-100"
                    data-bs-toggle="dropdown" data-bs-auto-close="outside" type="button"
                    id="${summaryId}">Contains</button>
            <div class="dropdown-menu p-3 w-100">
              <div class="btn-group btn-group-sm mb-2">${modeButtons}</div>
              <input data-filter="${key}" class="form-control" />
            </div>
          </div>
        </div>`;
    } else if (config.type === "multiselect") {
      const optionsId = `filter${key.charAt(0).toUpperCase() + key.slice(1)}Options`;
      return `
        <div class="col-md-3">
          <label class="form-label mb-1">${config.label}</label>
          <div class="dropdown">
            <button class="btn btn-outline-secondary dropdown-toggle w-100"
                    data-bs-toggle="dropdown" data-bs-auto-close="outside" type="button">
              <span id="${summaryId}">${config.label}</span>
            </button>
            <div class="dropdown-menu p-3 w-100">
              <div class="d-flex gap-2 mb-2">
                <button class="btn btn-outline-secondary btn-sm"
                        data-action="selectAll" data-target="${optionsId}">Select all</button>
                <button class="btn btn-outline-secondary btn-sm"
                        data-action="selectNone" data-target="${optionsId}">Select none</button>
              </div>
              <div id="${optionsId}" class="d-grid gap-1" data-filter="${key}"></div>
            </div>
          </div>
        </div>`;
    }
  }).join("");

  container.innerHTML = filterHTML;
}

// Generic filter mode setter (replaces setTextFilterMode, setAmountOp, etc.)
const setFilterMode = (filterName, mode) => {
  const filter = appState.filters[filterName];
  if (FILTER_CONFIGS[filterName].type === "text") {
    filter.mode = mode;
  } else if (FILTER_CONFIGS[filterName].type === "numeric") {
    filter.op = mode;
  }
  updateFilterUI(filterName);
  renderTransactions();
};

// Generic summary updater (replaces updateTextSummary, updateAmountSummary, updateDateSummary)
const updateFilterUI = (filterName) => {
  const summaryId = `filter${filterName.charAt(0).toUpperCase() + filterName.slice(1)}Summary`;
  const summaryEl = document.getElementById(summaryId);
  if (!summaryEl) return;

  const filter = appState.filters[filterName];
  const config = FILTER_CONFIGS[filterName];

  if (config.type === "text") {
    summaryEl.textContent = filter.mode === "not" ? "Does not contain"
                           : filter.mode === "null" ? "Is null"
                           : "Contains";
  } else if (config.type === "numeric") {
    if (!filter.op) {
      summaryEl.textContent = "Any";
    } else {
      const label = filter.op === "gt" ? "> " : "< ";
      summaryEl.textContent = filter.value ? `${label}${filter.value}` : label.trim();
    }
  } else if (config.type === "dateRange") {
    if (!filter.start && !filter.end) {
      summaryEl.textContent = "Any time";
    } else if (filter.start && filter.end) {
      summaryEl.textContent = `${filter.start} to ${filter.end}`;
    } else {
      summaryEl.textContent = filter.start ? `From ${filter.start}` : `Until ${filter.end}`;
    }
  }
};

// Unified date preset handler (consolidates setDatePreset + setVisualizeDatePreset)
const applyDatePreset = (preset, targetType = "filter") => {
  const prefix = targetType === "filter" ? "filterDate" : "visualizeDate";
  const startEl = document.getElementById(`${prefix}Start`);
  const endEl = document.getElementById(`${prefix}End`);
  if (!startEl || !endEl) return;

  const now = new Date();
  let start = null, end = null;

  if (preset === "all") {
    startEl.value = "";
    endEl.value = "";
  } else if (preset === "last7") {
    end = new Date(now);
    start = new Date(now);
    start.setDate(start.getDate() - 6);
  } else if (preset === "last30") {
    end = new Date(now);
    start = new Date(now);
    start.setDate(start.getDate() - 29);
  } else if (preset === "last365") {
    end = new Date(now);
    start = new Date(now);
    start.setDate(start.getDate() - 364);
  } else if (preset === "lastMonth") {
    // last calendar month logic
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(firstOfThisMonth);
    end.setDate(end.getDate() - 1);
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else if (preset === "lastYear") {
    // last calendar year logic
    const year = now.getFullYear() - 1;
    start = new Date(year, 0, 1);
    end = new Date(year, 11, 31);
  }

  if (start && end) {
    startEl.value = formatDateInput(start);
    endEl.value = formatDateInput(end);
  }

  if (targetType === "filter") {
    appState.filters.date.start = startEl.value;
    appState.filters.date.end = endEl.value;
    updateFilterUI("date");
    renderTransactions();
  } else {
    updateVisualizeDateSummary();
    refreshVisualizationsIfVisible();
  }
};

const setActiveButtons = (activeId, ids) => {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("active", id === activeId);
  });
};

const setAmountFilter = (op, value) => {
  appState.filters.amount.op = op;
  appState.filters.amount.value = value;
  const valEl = document.getElementById("filterAmountValue");
  if (valEl) valEl.value = value;
  updateFilterUI("amount");
  renderTransactions();
};

const formatDateInput = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getVisualizeDateRange = () => ({
  startDate: getInputValue("visualizeDateStart"),
  endDate: getInputValue("visualizeDateEnd")
});

const buildVisualizeQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
};

const updateVisualizeDateSummary = () => {
  const summary = document.getElementById("visualizeDateSummary");
  if (!summary) return;
  const { startDate, endDate } = getVisualizeDateRange();
  if (!startDate && !endDate) summary.textContent = "Any time";
  else if (startDate && endDate) summary.textContent = `${startDate} to ${endDate}`;
  else summary.textContent = startDate ? `From ${startDate}` : `Until ${endDate}`;
};

const getCheckedValues = (containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll("input[type='checkbox']:checked")).map((el) => el.value);
};

const getCheckedLabels = (containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll("input[type='checkbox']:checked")).map((el) => {
    const label = el.closest("label")?.querySelector(".form-check-label")?.textContent;
    return (label || el.value || "").trim();
  }).filter(Boolean);
};

const summarizeList = (values) => {
  if (!values.length) return "";
  if (values.length <= 3) return values.join(", ");
  return `${values.slice(0, 3).join(", ")} +${values.length - 3}`;
};

const renderAppliedFiltersPanel = (matchedCount, totalCount) => {
  const panel = document.getElementById("appliedFiltersPanel");
  if (!panel) return;

  const filters = [];
  const nameValue = (appState.filters.name.value || "").trim();
  const merchantValue = (appState.filters.merchant.value || "").trim();
  const bankLabels = getCheckedLabels("filterBanksOptions");
  const accountLabels = getCheckedLabels("filterAccountsOptions");
  const categoryLabels = getCheckedLabels("filterCategoriesOptions");
  const amountOp = appState.filters.amount.op;
  const amountValue = appState.filters.amount.value;
  const dateStart = appState.filters.date.start;
  const dateEnd = appState.filters.date.end;

  if (nameValue) {
    const mode = appState.filters.name.mode === "not" ? "does not contain" : "contains";
    filters.push(`Name ${mode}: "${nameValue}"`);
  }
  if (appState.filters.merchant.mode === "null") {
    filters.push("Merchant is null");
  } else if (merchantValue) {
    const mode = appState.filters.merchant.mode === "not" ? "does not contain" : "contains";
    filters.push(`Merchant ${mode}: "${merchantValue}"`);
  }
  if (bankLabels.length) filters.push(`Banks: ${summarizeList(bankLabels)}`);
  if (accountLabels.length) filters.push(`Accounts: ${summarizeList(accountLabels)}`);
  if (categoryLabels.length) filters.push(`Categories: ${summarizeList(categoryLabels)}`);
  if (amountOp && amountValue !== null && Number.isFinite(amountValue)) {
    filters.push(`Amount ${amountOp === "gt" ? ">" : "<"} ${amountValue}`);
  }
  if (dateStart || dateEnd) {
    const startText = dateStart || "...";
    const endText = dateEnd || "...";
    filters.push(`Date: ${startText} to ${endText}`);
  }

  panel.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
      <div class="applied-filters-header">Applied Filters</div>
      <div class="small text-muted">${matchedCount} of ${totalCount} transactions shown</div>
    </div>
    ${filters.length
      ? `<div class="applied-filters-list">${filters.map((f) => `<span class="applied-filter-chip">${f}</span>`).join("")}</div>`
      : `<div class="small text-muted mt-2">No filters applied (showing all transactions).</div>`
    }
  `;
};

const updateMultiSelectSummary = (containerId, summaryId, label) => {
  const summary = document.getElementById(summaryId);
  if (!summary) return;
  const count = getCheckedValues(containerId).length;
  summary.textContent = count ? `${label} (${count})` : label;
};

const handleMultiSelectChange = (containerId, summaryId, label) => {
  updateMultiSelectSummary(containerId, summaryId, label);
  renderTransactions();
};

const selectAllOptions = (containerId, summaryId, label) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll("input[type='checkbox']").forEach((el) => {
    el.checked = true;
  });
  updateMultiSelectSummary(containerId, summaryId, label);
  renderTransactions();
};

const selectNoneOptions = (containerId, summaryId, label) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll("input[type='checkbox']").forEach((el) => {
    el.checked = false;
  });
  updateMultiSelectSummary(containerId, summaryId, label);
  renderTransactions();
};

const refreshFilterOptions = () => {
  const bankOptions = document.getElementById("filterBanksOptions");
  const accountOptions = document.getElementById("filterAccountsOptions");
  const categoryOptions = document.getElementById("filterCategoriesOptions");
  if (!bankOptions && !accountOptions && !categoryOptions) return;

  const banks = new Map();
  const accounts = new Map();
  const categories = new Set();
  for (const t of appState.data.transactions) {
    const bankLabel = t.institution_name || t.item_id || "";
    if (t.item_id && bankLabel) banks.set(t.item_id, bankLabel);
    const accountLabel = t.account_name || t.account_official_name || t.account_id || "";
    if (t.account_id && accountLabel) accounts.set(t.account_id, accountLabel);
    const category = t.personal_finance_category?.detailed || t.personal_finance_category?.primary;
    if (category) categories.add(category);
  }

  if (bankOptions) {
    const selected = new Set(getCheckedValues("filterBanksOptions"));
    bankOptions.innerHTML = [...banks.entries()]
      .sort((a, b) => (a[1] || "").localeCompare(b[1] || ""))
      .map(([id, label]) => (
        `<label class="form-check">
          <input class="form-check-input" type="checkbox" value="${id}">
          <span class="form-check-label">${label}</span>
        </label>`
      ))
      .join("");
    bankOptions.querySelectorAll("input[type='checkbox']").forEach((el) => {
      if (selected.has(el.value)) el.checked = true;
    });
    updateMultiSelectSummary("filterBanksOptions", "filterBanksSummary", "Banks");
  }

  if (accountOptions) {
    const selected = new Set(getCheckedValues("filterAccountsOptions"));
    accountOptions.innerHTML = [...accounts.entries()]
      .map(([id, label]) => (
        `<label class="form-check">
          <input class="form-check-input" type="checkbox" value="${id}">
          <span class="form-check-label">${label}</span>
        </label>`
      ))
      .join("");
    accountOptions.querySelectorAll("input[type='checkbox']").forEach((el) => {
      if (selected.has(el.value)) el.checked = true;
    });
    updateMultiSelectSummary("filterAccountsOptions", "filterAccountsSummary", "Accounts");
  }

  if (categoryOptions) {
    const selected = new Set(getCheckedValues("filterCategoriesOptions"));
    categoryOptions.innerHTML = [...categories]
      .sort()
      .map((label) => (
        `<label class="form-check">
          <input class="form-check-input" type="checkbox" value="${label}">
          <span class="form-check-label">${label}</span>
        </label>`
      ))
      .join("");
    categoryOptions.querySelectorAll("input[type='checkbox']").forEach((el) => {
      if (selected.has(el.value)) el.checked = true;
    });
    updateMultiSelectSummary("filterCategoriesOptions", "filterCategoriesSummary", "Categories");
  }
};

const clearAllFilters = () => {
  // Reset filter state
  appState.filters.name = { mode: "contains", value: "" };
  appState.filters.merchant = { mode: "contains", value: "" };
  appState.filters.amount = { op: "", value: null };
  appState.filters.date = { start: "", end: "" };

  // Clear text inputs
  document.querySelectorAll('[data-filter="name"], [data-filter="merchant"]').forEach((el) => {
    el.value = "";
  });

  // Reset amount input and mode buttons
  const amountInput = document.getElementById("filterAmountValue");
  if (amountInput) amountInput.value = "";
  setActiveButtons("amountModeAny", ["amountModeAny", "amountModeGt", "amountModeLt"]);

  // Clear date inputs
  const dateStartEl = document.getElementById("filterDateStart");
  const dateEndEl = document.getElementById("filterDateEnd");
  if (dateStartEl) dateStartEl.value = "";
  if (dateEndEl) dateEndEl.value = "";

  // Clear multiselect checkboxes
  ["filterBanksOptions", "filterAccountsOptions", "filterCategoriesOptions"].forEach((containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = false;
    });
  });

  // Refresh UI summaries
  updateFilterUI("name");
  updateFilterUI("merchant");
  updateFilterUI("amount");
  updateFilterUI("date");
  updateMultiSelectSummary("filterBanksOptions", "filterBanksSummary", "Banks");
  updateMultiSelectSummary("filterAccountsOptions", "filterAccountsSummary", "Accounts");
  updateMultiSelectSummary("filterCategoriesOptions", "filterCategoriesSummary", "Categories");

  // Re-render table
  renderTransactions();
};


const loadItems = async () => {
  if (!appState.auth.userId) return;
  DOM.loading("itemsList", "Loading banks...");
  const items = await fetchWithAuth(`/api/items`).then(r => r.json());
  appState.data.items = items;
  const list = document.getElementById("itemsList");
  appState.data.transactions = [];
  appState.transfers.previewPairs = [];
  appState.transfers.ambiguousPairs = [];
  appState.transfers.selectedIds = new Set();
  const syncResult = document.getElementById("syncResult");
  if (syncResult) syncResult.textContent = "No sync yet";
  const transferPairsTable = document.getElementById("transferPairsTable");
  if (transferPairsTable) transferPairsTable.innerHTML = "";
  const transferPreviewStatus = document.getElementById("transferPreviewStatus");
  if (transferPreviewStatus) transferPreviewStatus.textContent = "No transfer preview yet";
  await loadTransactions();
  renderTransactions();
  if (items.length === 0) {
    list.innerHTML = "<p class='text-muted'>No banks linked</p>";
    appState.data.transactions = [];
    if (syncResult) syncResult.textContent = "No sync yet";
    const txTable = document.getElementById("transactionsTable");
    if (txTable) txTable.innerHTML = "<p class='text-muted mb-0'>Link a bank and sync to load transactions</p>";
    return;
  }
  let html = "";
  for (const item of items) {
    const accounts = await fetchWithAuth(`/api/accounts/${item.id}`).then(r => r.json());
    const name = item.institution_name || "Unknown";
    html += `
    <div class="border p-2 mb-2 rounded">
      <div class="d-flex justify-content-between align-items-center">
        <span><strong>${name}</strong> (${item.id.substring(0, 8)}...)</span>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
      </div>
      <div class="mt-2 ps-2">
        <small class="text-muted fw-bold">Connected Accounts</small>
        ${accounts.length === 0 ? "<p class='mb-0 small text-muted'>None</p>" : "<ul class='mb-0 small'>" + accounts.map(a => `<li>${a.name || a.official_name || a.id}${a.mask ? ` ···${a.mask}` : ""} (${a.type})</li>`).join("") + "</ul>"}
      </div>
    </div>`;
  }
  list.innerHTML = html;
};

const loadTransactions = async () => {
  if (!appState.auth.userId) return;
  DOM.loading("transactionsTable", "Loading transactions...");
  const res = await fetchWithAuth(`/api/transactions`);
  const data = res.ok ? await res.json() : [];
  appState.data.transactions = Array.isArray(data) ? data : [];
  refreshFilterOptions();
  renderTransactions();
};

const transactionsTableMarkup = (rows) => `
  <table class="table table-sm table-striped align-middle mb-0">
    <thead>
      <tr>
        <th style="width: 40px;"></th>
        <th>Date</th>
        <th>Name</th>
        <th>Merchant</th>
        <th class="text-end">Amount</th>
        <th>Bank</th>
        <th>Account</th>
        <th>Category</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(t => `
        <tr>
          <td>${(() => {
            const iconUrl = getTxnIconUrl(t);
            return iconUrl ? `<img src="${iconUrl}" alt="icon" style="width: 24px; height: 24px;">` : "";
          })()}</td>
          <td>${formatTxnDateText(t)}</td>
          <td>${txnNameText(t) || ""}</td>
          <td>${t.merchant_name || ""}</td>
          <td class="text-end">${txnAmountText(t)}</td>
          <td>${t.institution_name || ""}</td>
          <td>${t.account_name || t.account_official_name || ""}</td>
          <td>${t.personal_finance_category?.detailed || t.personal_finance_category?.primary || ""}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>`;

const renderTransactions = () => {
  const nameValue = appState.filters.name.value.toLowerCase();
  const merchantValue = appState.filters.merchant.value.toLowerCase();
  const bankFilters = getCheckedValues("filterBanksOptions");
  const accountFilters = getCheckedValues("filterAccountsOptions");
  const categoryFilters = getCheckedValues("filterCategoriesOptions");
  const amountValue = appState.filters.amount.value;
  const dateStart = appState.filters.date.start;
  const dateEnd = appState.filters.date.end;
  const table = document.getElementById("transactionsTable");
  if (!table) return;

  let rows = appState.data.transactions;
  rows = rows.filter(t => {
    const name = (t.name || "").toLowerCase();
    const merchant = (t.merchant_name || "").toLowerCase();
    const category = t.personal_finance_category?.detailed || t.personal_finance_category?.primary || "";
    if (nameValue) {
      if (appState.filters.name.mode === "not" && name.includes(nameValue)) return false;
      if (appState.filters.name.mode !== "not" && !name.includes(nameValue)) return false;
    }
    if (appState.filters.merchant.mode === "null") {
      if (t.merchant_name) return false;
    } else if (merchantValue) {
      if (appState.filters.merchant.mode === "not" && merchant.includes(merchantValue)) return false;
      if (appState.filters.merchant.mode !== "not" && !merchant.includes(merchantValue)) return false;
    }
    if (bankFilters.length && !bankFilters.includes(t.item_id)) return false;
    if (accountFilters.length && !accountFilters.includes(t.account_id)) return false;
    if (categoryFilters.length && !categoryFilters.includes(category)) return false;
    if (appState.filters.amount.op && amountValue !== null && Number.isFinite(amountValue)) {
      const amt = Number(t.amount);
      if (Number.isFinite(amt)) {
        if (appState.filters.amount.op === "gt" && !(amt > amountValue)) return false;
        if (appState.filters.amount.op === "lt" && !(amt < amountValue)) return false;
      }
    }
    if (dateStart || dateEnd) {
      const dateValue = getTxnDateValue(t);
      if (!dateValue) return false;
      const date = new Date(dateValue);
      if (Number.isNaN(date.valueOf())) return false;
      if (dateStart) {
        const start = new Date(`${dateStart}T00:00:00`);
        if (date < start) return false;
      }
      if (dateEnd) {
        const end = new Date(`${dateEnd}T23:59:59`);
        if (date > end) return false;
      }
    }
    return true;
  });
  updateFilterUI("amount");
  updateFilterUI("date");
  renderAppliedFiltersPanel(rows.length, appState.data.transactions.length);
  if (rows.length === 0) {
    table.innerHTML = "<p class='text-muted mb-0'>No transactions match</p>";
    return;
  }
  table.innerHTML = transactionsTableMarkup(rows);
};

const syncTransactions = async () => {
  if (!appState.auth.userId) return alert("Sign in first");
  DOM.loading("transactionsTable", "Syncing transactions...");
  const result = await fetchWithAuth(`/api/transactions/sync`, { method: "POST" }).then(r => r.json());
  if (result.error) return alert("Error: " + result.error);
  const syncResult = document.getElementById("syncResult");
  if (syncResult) syncResult.textContent = `${result.modified} modified, ${result.added} added, ${result.removed} removed`;
  await loadTransactions();
};

const escapeHtml = (value) =>
  String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const transferDateText = (txn) => txn.datetime || txn.authorized_datetime || "";

const renderTransferPairs = () => {
  const table = document.getElementById("transferPairsTable");
  const status = document.getElementById("transferPreviewStatus");
  if (!table || !status) return;
  if (!appState.transfers.previewPairs.length && !appState.transfers.ambiguousPairs.length) {
    table.innerHTML = "";
    status.textContent = "No predicted transfer pairs";
    return;
  }
  const approvedCount = appState.transfers.previewPairs.filter((p) => appState.transfers.selectedIds.has(p.pairId)).length;
  const hasSelectable = appState.transfers.previewPairs.length > 0;
  status.textContent = `${appState.transfers.previewPairs.length} predicted pairs · ${approvedCount} selected · ${appState.transfers.ambiguousPairs.length} ambiguous`;
  table.innerHTML = `
    <table class="table table-sm table-striped align-middle mb-0">
      <thead>
        <tr>
          <th style="width: 40px;"><input type="checkbox" ${hasSelectable && approvedCount === appState.transfers.previewPairs.length ? "checked" : ""} ${hasSelectable ? `onclick="${approvedCount === appState.transfers.previewPairs.length ? "clearTransferPairSelection()" : "approveAllTransferPairs()"}"` : "disabled"}></th>
          <th>Amount</th>
          <th>Day Gap</th>
          <th>Reason</th>
          <th>Outflow</th>
          <th>Inflow</th>
        </tr>
      </thead>
      <tbody>
        ${appState.transfers.previewPairs.map((p) => `
          <tr>
            <td><input type="checkbox" ${appState.transfers.selectedIds.has(p.pairId) ? "checked" : ""} onchange="toggleTransferPair('${p.pairId}', this.checked)"></td>
            <td>${p.amount}</td>
            <td>${p.dayGap}</td>
            <td>${escapeHtml(p.reason || "")}</td>
            <td>
              ${escapeHtml(p.outflow.account_name || p.outflow.account_official_name || p.outflow.account_id || "")}<br>
              <small class="text-muted">${escapeHtml(transferDateText(p.outflow))} · ${escapeHtml(p.outflow.name || "")}</small>
            </td>
            <td>
              ${escapeHtml(p.inflow.account_name || p.inflow.account_official_name || p.inflow.account_id || "")}<br>
              <small class="text-muted">${escapeHtml(transferDateText(p.inflow))} · ${escapeHtml(p.inflow.name || "")}</small>
            </td>
          </tr>
        `).join("")}
        ${appState.transfers.ambiguousPairs.map((p) => `
          <tr class="table-warning">
            <td><input type="checkbox" disabled title="Ambiguous pairs cannot be applied"></td>
            <td>${p.amount}</td>
            <td>${p.dayGap}</td>
            <td>${escapeHtml((p.reason || "") + "_ambiguous")}</td>
            <td>
              ${escapeHtml(p.outflow.account_name || p.outflow.account_official_name || p.outflow.account_id || "")}<br>
              <small class="text-muted">${escapeHtml(transferDateText(p.outflow))} · ${escapeHtml(p.outflow.name || "")}</small>
            </td>
            <td>
              ${escapeHtml(p.inflow.account_name || p.inflow.account_official_name || p.inflow.account_id || "")}<br>
              <small class="text-muted">${escapeHtml(transferDateText(p.inflow))} · ${escapeHtml(p.inflow.name || "")}</small>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
};

const previewInternalTransfers = async () => {
  if (!appState.auth.userId) return alert("Sign in first");
  const status = document.getElementById("transferPreviewStatus");
  if (status) status.textContent = "Finding transfer pairs...";
  const startDate = getInputValue("transferStartDate") || undefined;
  const endDate = getInputValue("transferEndDate") || undefined;
  const result = await fetchWithAuth("/api/transactions/internal/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, includePending: false })
  }).then((r) => r.json());
  if (result.error) {
    if (status) status.textContent = `Error: ${result.error}`;
    return;
  }
  appState.transfers.previewPairs = result.pairs || [];
  appState.transfers.ambiguousPairs = result.ambiguous_pairs || [];
  appState.transfers.selectedIds = new Set();
  renderTransferPairs();
  if (status) {
    const s = result.summary || {};
    status.textContent = `Scanned ${s.scanned || 0}, candidates ${s.candidates || 0}, predicted ${s.predicted || 0}, ambiguous ${s.ambiguous_transactions || 0}`;
  }
};

const toggleTransferPair = (pairId, checked) => {
  if (checked) appState.transfers.selectedIds.add(pairId);
  else appState.transfers.selectedIds.delete(pairId);
  renderTransferPairs();
};

const approveAllTransferPairs = () => {
  appState.transfers.selectedIds = new Set(appState.transfers.previewPairs.map((p) => p.pairId));
  renderTransferPairs();
};

const clearTransferPairSelection = () => {
  appState.transfers.selectedIds = new Set();
  renderTransferPairs();
};

const applySelectedTransferPairs = async () => {
  if (!appState.auth.userId) return alert("Sign in first");
  if (!appState.transfers.selectedIds.size) return alert("Select at least one predicted pair");
  const status = document.getElementById("transferPreviewStatus");
  if (status) status.textContent = "Applying selected transfer pairs...";
  const startDate = getInputValue("transferStartDate") || undefined;
  const endDate = getInputValue("transferEndDate") || undefined;
  const overwrite = !!document.getElementById("transferOverwrite")?.checked;
  const result = await fetchWithAuth("/api/transactions/internal/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: appState.auth.userId,
      pairIds: [...appState.transfers.selectedIds],
      startDate,
      endDate,
      includePending: false,
      overwrite
    })
  }).then((r) => r.json());
  if (result.error) {
    if (status) status.textContent = `Error: ${result.error}`;
    return;
  }
  const s = result.summary || {};
  if (status) status.textContent = `Applied ${s.written_pairs || 0} pairs from ${s.approved || 0} approvals (${s.skipped_existing || 0} skipped existing)`;
  await previewInternalTransfers();
  refreshVisualizationsIfVisible();
};

const palette = [
  "#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#d97706", "#0891b2", "#be123c",
  "#0f766e", "#4f46e5", "#a16207", "#475569", "#ea580c"
];

const loadVisualizationCategoryTransactions = async (setType, category) => {
  if (!appState.auth.userId) return;
  const title = document.getElementById("visualizeDetailsTitle");
  const table = document.getElementById("visualizeTransactionsTable");
  if (!title || !table) return;
  title.textContent = `Loading ${setType} transactions for ${category}...`;
  const { startDate, endDate } = getVisualizeDateRange();
  const query = buildVisualizeQuery({ set: setType, category, startDate, endDate });
  const url = `/api/transactions/visualize/details${query}`;
  const data = await fetchWithAuth(url).then((r) => r.json());
  if (data.error) {
    title.textContent = `Error loading ${setType} ${category}: ${data.error}`;
    table.innerHTML = "";
    return;
  }
  title.textContent = `${setType === "income" ? "Income" : "Spending"} · ${category} (${data.count || 0} transactions)`;
  table.innerHTML = data.rows?.length ? transactionsTableMarkup(data.rows) : "<p class='text-muted mb-0'>No transactions for this slice</p>";
};

const renderCashflowSankey = (incomeCategories, spendingCategories) => {
  const el = document.getElementById("cashflowSankey");
  if (!el) return;
  if (!window.Plotly) {
    el.innerHTML = "<p class='text-muted mb-0'>Sankey library not loaded.</p>";
    return;
  }
  const inCats = (incomeCategories || []).filter((c) => Number(c.amount) > 0);
  const outCats = (spendingCategories || []).filter((c) => Number(c.amount) > 0);
  if (!inCats.length && !outCats.length) {
    window.Plotly.purge(el);
    el.innerHTML = "<p class='text-muted mb-0'>No income/spending data for this date range.</p>";
    return;
  }
  const labels = [
    ...inCats.map((c) => `Income · ${c.category}`),
    "Cashflow",
    ...outCats.map((c) => `Spending · ${c.category}`)
  ];
  const cashflowNode = inCats.length;
  const spendingCategoryStart = cashflowNode + 1;
  const source = [];
  const target = [];
  const value = [];
  const linkColors = [];
  inCats.forEach((c, i) => {
    source.push(i);
    target.push(cashflowNode);
    value.push(Number(c.amount || 0));
    linkColors.push("rgba(22,163,74,0.45)");
  });
  outCats.forEach((c, i) => {
    source.push(cashflowNode);
    target.push(spendingCategoryStart + i);
    value.push(Number(c.amount || 0));
    linkColors.push("rgba(248,113,113,0.4)");
  });
  const nodeColors = labels.map((label) => {
    if (label === "Cashflow") return "rgba(71,85,105,0.9)";
    if (label.startsWith("Income · ")) return "rgba(34,197,94,0.75)";
    return "rgba(248,113,113,0.75)";
  });
  const nodeX = labels.map((label) => {
    if (label.startsWith("Income · ")) return 0.02;
    if (label === "Cashflow") return 0.5;
    return 0.98;
  });
  const categoryVertical = (idx, total) => (idx + 1) / (total + 1);
  const nodeY = labels.map((label) => {
    if (label.startsWith("Income · ")) {
      const idx = inCats.findIndex((c) => `Income · ${c.category}` === label);
      return categoryVertical(Math.max(idx, 0), Math.max(inCats.length, 1));
    }
    if (label.startsWith("Spending · ")) {
      const idx = outCats.findIndex((c) => `Spending · ${c.category}` === label);
      return categoryVertical(Math.max(idx, 0), Math.max(outCats.length, 1));
    }
    return 0.5;
  });
  window.Plotly.react(el, [{
    type: "sankey",
    arrangement: "fixed",
    node: { label: labels, color: nodeColors, x: nodeX, y: nodeY, pad: 14, thickness: 14 },
    link: { source, target, value, color: linkColors }
  }], {
    margin: { l: 12, r: 12, t: 8, b: 8 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { size: 12 }
  }, { displayModeBar: false, responsive: true });
  if (typeof el.removeAllListeners === "function") el.removeAllListeners("plotly_click");
  el.on("plotly_click", (event) => {
    const point = event?.points?.[0];
    if (!point) return;
    let label = typeof point.label === "string" ? point.label : "";
    if (!label && Number.isInteger(point.target)) label = labels[point.target] || "";
    if (!label && Number.isInteger(point.source)) label = labels[point.source] || "";
    if (label.startsWith("Income · ")) loadVisualizationCategoryTransactions("income", label.replace("Income · ", ""));
    if (label.startsWith("Spending · ")) loadVisualizationCategoryTransactions("spending", label.replace("Spending · ", ""));
  });
};

const renderPieChart = (chartKey, canvasId, setType, categories) => {
  if (!window.Chart) return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  const labels = categories.map((c) => c.category);
  const values = categories.map((c) => Number(c.amount || 0));
  const currentChart = appState.charts[chartKey];
  if (currentChart) currentChart.destroy();
  const nextChart = new window.Chart(el, {
    type: "pie",
    data: {
      labels: labels.length ? labels : ["No data"],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: (labels.length ? labels : ["No data"]).map((_, i) => palette[i % palette.length])
      }]
    },
    options: {
      onClick: (_event, elements) => {
        if (!elements?.length || !labels.length) return;
        const category = labels[elements[0].index];
        loadVisualizationCategoryTransactions(setType, category);
      },
      plugins: {
        legend: { position: "bottom" }
      },
      onHover: (event, elements) => {
        const target = event?.native?.target;
        if (target) target.style.cursor = elements?.length ? "pointer" : "default";
      }
    }
  });
  appState.charts[chartKey] = nextChart;
};

const refreshVisualizations = async () => {
  if (!appState.auth.userId) return;
  const status = document.getElementById("visualizeStatus");
  updateVisualizeDateSummary();
  const { startDate, endDate } = getVisualizeDateRange();
  DOM.setText("visualizeStatus", "Loading visualizations...");
  const query = buildVisualizeQuery({ startDate, endDate });
  const data = await fetchWithAuth(`/api/transactions/visualize${query}`).then((r) => r.json());
  if (data.error) {
    if (status) status.textContent = `Error: ${data.error}`;
    return;
  }
  renderPieChart("income", "incomePieChart", "income", data.income?.categories || []);
  renderPieChart("spending", "spendingPieChart", "spending", data.spending?.categories || []);
  renderCashflowSankey(data.income?.categories || [], data.spending?.categories || []);
  if (status) {
    status.textContent = `Income: ${data.income?.count || 0} tx (${(data.income?.total || 0).toFixed(2)}) · Spending: ${data.spending?.count || 0} tx (${(data.spending?.total || 0).toFixed(2)})`;
  }
  const title = document.getElementById("visualizeDetailsTitle");
  const table = document.getElementById("visualizeTransactionsTable");
  if (title) title.textContent = "Click a pie slice or Sankey category node to view transactions";
  if (table) table.innerHTML = "";
};

const refreshVisualizationsIfVisible = () => {
  if ((window.location.hash || "#main") === "#visualize") {
    refreshVisualizations();
  }
};

window.addEventListener("hashchange", refreshVisualizationsIfVisible);

const formatPlaidError = (err) => {
  if (!err) return "Unknown error";
  return err.display_message || err.error_message || err.error_code || err.error_type || "Unknown error";
};

const clampLinkHistoryDays = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 730;
  return Math.min(730, Math.max(1, Math.floor(n)));
};

const syncLinkHistoryDaysInputs = (value) => {
  const days = clampLinkHistoryDays(value);
  const slider = document.getElementById("linkHistoryDaysSlider");
  const input = document.getElementById("linkHistoryDaysInput");
  const consentNote = document.getElementById("linkHistoryConsentNote");
  if (slider) slider.value = String(days);
  if (input) input.value = String(days);
  if (consentNote) consentNote.textContent = `Enable access to transactions up to ${days} days ago.`;
  return days;
};

const openPlaidLink = async (daysRequested) => {
  try {
    const res = await fetchWithAuth("/api/link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daysRequested: clampLinkHistoryDays(daysRequested) })
    });
    const data = await res.json();
    if (data.error) return alert("Error: " + data.error);
    if (!data.link_token) return alert("Failed to get link token");
    Plaid.create({
      token: data.link_token,
      onSuccess: async (publicToken) => {
        const exchangeRes = await fetchWithAuth("/api/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicToken }) });
        const exchangeData = await exchangeRes.json().catch(() => ({}));
        if (!exchangeRes.ok || exchangeData.error) throw new Error(exchangeData.error || "Token exchange failed");
        await loadItems();
      },
      onExit: (err, metadata) => {
        if (err) {
          console.error("Plaid Link error", { err, metadata });
          alert("Plaid Link error: " + formatPlaidError(err));
        }
      },
      onEvent: (eventName, metadata) => {
        if (eventName === "ERROR") console.error("Plaid Link event error", metadata);
      }
    }).open();
  } catch (e) {
    alert("Error: " + e.message);
  }
};

const linkBank = () => {
  if (!appState.auth.userId) return alert("Sign in first");
  syncLinkHistoryDaysInputs(document.getElementById("linkHistoryDaysInput")?.value || 730);
  const modalEl = document.getElementById("linkHistoryModal");
  if (!modalEl || !window.bootstrap?.Modal) return openPlaidLink(730);
  window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

const confirmLinkBank = async () => {
  const days = syncLinkHistoryDaysInputs(document.getElementById("linkHistoryDaysInput")?.value || 730);
  const modalEl = document.getElementById("linkHistoryModal");
  if (modalEl && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  await openPlaidLink(days);
};

const deleteItem = async (id) => {
  if (!confirm("Delete this bank connection?")) return;
  await fetchWithAuth(`/api/items/${id}`, { method: "DELETE" });
  await loadItems();
};

// Event delegation system
const ACTION_HANDLERS = {
  syncTransactions,
  linkBank,
  confirmLinkBank,
  signOut,
  previewInternalTransfers,
  approveAllTransferPairs,
  clearTransferPairSelection,
  applySelectedTransferPairs,
  refreshVisualizations,
  clearAllFilters,
  setAuthModeExisting: () => setAuthMode("existing"),
  setAuthModeNew: () => setAuthMode("new"),
  setAmountPositive: () => setAmountFilter("gt", 0),
  setAmountNegative: () => setAmountFilter("lt", 0),
  datePresetAll: () => applyDatePreset("all", "filter"),
  datePresetLast7: () => applyDatePreset("last7", "filter"),
  datePresetLast30: () => applyDatePreset("last30", "filter"),
  datePresetLast365: () => applyDatePreset("last365", "filter"),
  datePresetLastMonth: () => applyDatePreset("lastMonth", "filter"),
  datePresetLastYear: () => applyDatePreset("lastYear", "filter"),
  visualizeDatePresetAll: () => applyDatePreset("all", "visualize"),
  visualizeDatePresetLast30: () => applyDatePreset("last30", "visualize"),
  visualizeDatePresetLast365: () => applyDatePreset("last365", "visualize"),
  selectAll: (e) => {
    const targetId = e.target.dataset.target;
    const container = document.getElementById(targetId);
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    const filterName = container.dataset.filter;
    if (filterName) handleMultiSelectChange(targetId, `filter${filterName.charAt(0).toUpperCase() + filterName.slice(1)}Summary`, FILTER_UI_CONFIGS[filterName].label);
  },
  selectNone: (e) => {
    const targetId = e.target.dataset.target;
    const container = document.getElementById(targetId);
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    const filterName = container.dataset.filter;
    if (filterName) handleMultiSelectChange(targetId, `filter${filterName.charAt(0).toUpperCase() + filterName.slice(1)}Summary`, FILTER_UI_CONFIGS[filterName].label);
  }
};

function initEventDelegation() {
  // Click handler delegation
  document.body.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    const filter = e.target.dataset.filter;
    const mode = e.target.dataset.mode;

    // Filter mode buttons
    if (filter && mode !== undefined) {
      e.preventDefault();
      setFilterMode(filter, mode);
      // Update button active states
      const btnGroup = e.target.closest(".btn-group");
      if (btnGroup) {
        btnGroup.querySelectorAll(".btn").forEach(btn => btn.classList.remove("active"));
        e.target.classList.add("active");
      }
      return;
    }

    // Named actions
    if (action && ACTION_HANDLERS[action]) {
      e.preventDefault();
      ACTION_HANDLERS[action](e);
    }
  });

  // Input change handler delegation
  document.body.addEventListener("input", (e) => {
    if (e.target.dataset.filter) {
      const filterName = e.target.dataset.filter;
      appState.filters[filterName].value = e.target.value;
      renderTransactions();
    }
    if (e.target.dataset.filterInput === "amount") {
      const value = e.target.value;
      appState.filters.amount.value = value ? Number(value) : null;
      updateFilterUI("amount");
      renderTransactions();
    }
  });

  // Change handler for date inputs
  document.body.addEventListener("change", (e) => {
    if (e.target.matches("input[type='checkbox']")) {
      const container = e.target.closest("[data-filter]");
      const filterName = container?.dataset?.filter;
      if (filterName && FILTER_UI_CONFIGS[filterName]) {
        handleMultiSelectChange(
          container.id,
          `filter${filterName.charAt(0).toUpperCase() + filterName.slice(1)}Summary`,
          FILTER_UI_CONFIGS[filterName].label
        );
        return;
      }
    }
    if (e.target.dataset.filterDate) {
      const field = e.target.dataset.filterDate;
      appState.filters.date[field] = e.target.value;
      updateFilterUI("date");
      renderTransactions();
    }
    if (e.target.dataset.visualizeDate) {
      updateVisualizeDateSummary();
      refreshVisualizationsIfVisible();
    }
  });
}

updateFilterUI("name");
updateFilterUI("merchant");
updateFilterUI("amount");
updateFilterUI("date");
updateVisualizeDateSummary();
window.handleSignUp = handleSignUp;
window.handleSignIn = handleSignIn;
window.setAuthMode = setAuthMode;
window.signOut = signOut;
window.setAuthStatus = setAuthStatus;
window.syncTransactions = syncTransactions;
window.previewInternalTransfers = previewInternalTransfers;
window.toggleTransferPair = toggleTransferPair;
window.approveAllTransferPairs = approveAllTransferPairs;
window.clearTransferPairSelection = clearTransferPairSelection;
window.applySelectedTransferPairs = applySelectedTransferPairs;
window.refreshVisualizations = refreshVisualizations;
window.setFilterMode = setFilterMode;
window.selectAllOptions = selectAllOptions;
window.selectNoneOptions = selectNoneOptions;
window.handleMultiSelectChange = handleMultiSelectChange;
window.setAmountFilter = setAmountFilter;
window.applyDatePreset = applyDatePreset;
window.renderTransactions = renderTransactions;
window.linkBank = linkBank;
window.deleteItem = deleteItem;
// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initFilterUI();
  initEventDelegation();
  const slider = document.getElementById("linkHistoryDaysSlider");
  const input = document.getElementById("linkHistoryDaysInput");
  if (slider && input) {
    syncLinkHistoryDaysInputs(input.value);
    slider.addEventListener("input", (e) => syncLinkHistoryDaysInputs(e.target.value));
    input.addEventListener("input", (e) => syncLinkHistoryDaysInputs(e.target.value));
  }
  setAuthMode("existing");
});
initSupabase();
