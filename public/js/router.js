// Simple hash-based router for tab navigation
let isAuthenticated = false;
const privateTabs = ["transactions", "visualize"];

const router = {
  init() {
    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('load', () => this.route());
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        const tab = (link.getAttribute("href") || "").replace("#", "");
        if (!isAuthenticated && privateTabs.includes(tab)) {
          e.preventDefault();
          window.location.hash = "main";
          if (window.setAuthStatus) window.setAuthStatus("Sign in with your email and password to access all pages.", true);
        }
      });
    });
  },
  
  route() {
    const hash = window.location.hash.slice(1) || 'main';
    const tabs = ['main', 'transactions', 'visualize'];
    let activeTab = tabs.includes(hash) ? hash : 'main';
    if (!isAuthenticated && privateTabs.includes(activeTab)) {
      activeTab = "main";
      window.location.hash = "main";
    }
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Show active tab
    const activeElement = document.getElementById(`tab-${activeTab}`);
    if (activeElement) {
      activeElement.classList.add('active');
    }
    
    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${activeTab}`) {
        link.classList.add('active');
      }
    });

    document.querySelectorAll('.nav-link').forEach((link) => {
      const tab = (link.getAttribute("href") || "").replace("#", "");
      if (privateTabs.includes(tab)) {
        if (isAuthenticated) link.classList.remove("disabled");
        else link.classList.add("disabled");
      }
    });
  }
};

window.setAuthState = (nextState) => {
  isAuthenticated = !!nextState;
  router.route();
};

router.init();
