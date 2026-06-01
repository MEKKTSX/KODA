/**
 * KODA UI v2 — Hybrid layout: desktop sidebar + mobile bottom nav
 */
document.addEventListener("DOMContentLoaded", () => {
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  const isHome =
    currentPath === "index.html" || currentPath === "";
  const isMarkets =
    currentPath === "watchlist.html" ||
    currentPath === "portfolio.html" ||
    currentPath === "stock-detail.html";
  const isPortfolio = currentPath === "portfolio.html";
  const isWorld = currentPath === "world-news.html";
  const isAiOps = currentPath === "ai-ops.html";
  const isConfig = currentPath === "config.html";

  const navItems = [
    { href: "index.html", icon: "home", label: "Home", active: isHome },
    {
      href: "watchlist.html",
      icon: "bar_chart",
      label: "Markets",
      active: isMarkets && !isPortfolio,
    },
    {
      href: "portfolio.html",
      icon: "account_balance_wallet",
      label: "Portfolio",
      active: isPortfolio,
    },
    { href: "world-news.html", icon: "public", label: "World", active: isWorld },
    { href: "ai-ops.html", icon: "insights", label: "AI Ops", active: isAiOps },
    { href: "config.html", icon: "settings", label: "Settings", active: isConfig },
  ];

  const sidebarContainer = document.getElementById("koda-sidebar-container");
  if (sidebarContainer) {
    const links = navItems
      .map(
        (item) => `
      <a href="${item.href}" class="koda-sidebar-link ${item.active ? "active" : ""}">
        <span class="material-symbols-outlined ${item.active ? "fill-icon" : ""}">${item.icon}</span>
        <span>${item.label}</span>
      </a>`
      )
      .join("");

    sidebarContainer.innerHTML = `
      <aside class="koda-sidebar" aria-label="Main navigation">
        <div class="koda-sidebar-brand">
          <div class="koda-sidebar-brand-icon">
            <span class="material-symbols-outlined">monitoring</span>
          </div>
          <div>
            <div class="koda-sidebar-brand-text">KODA</div>
            <div class="koda-sidebar-brand-sub">Intelligence</div>
          </div>
        </div>
        <nav class="koda-sidebar-nav">${links}</nav>
      </aside>`;
  }

  const navContainer = document.getElementById("bottom-nav-container");
  if (!navContainer) return;

  const mobileLinks = navItems
    .map(
      (item) => `
    <a class="flex flex-col items-center gap-0.5 min-w-[3rem] ${item.active ? "text-primary" : "text-slate-500 hover:text-primary transition-colors"}" href="${item.href}">
      <span class="material-symbols-outlined text-[22px] ${item.active ? "fill-icon" : ""}">${item.icon}</span>
      <span class="text-[10px] font-semibold">${item.label === "Settings" ? "Config" : item.label}</span>
    </a>`
    )
    .join("");

  navContainer.innerHTML = `
    <div class="koda-bottom-nav">
      <nav class="flex justify-between items-center px-3 pt-2 pb-3 max-w-lg mx-auto" aria-label="Mobile navigation">
        ${mobileLinks}
      </nav>
    </div>`;
});
