(() => {
  const fa = (value) =>
    new Intl.NumberFormat("fa-IR").format(Number(value) || 0);

  const labels = {
    trainingBtn: "راهنما و آموزش",
    uatBtn: "آزمون پذیرش",
    advancedSearchBtn: "جست‌وجوی پیشرفته",
    ceoDashboardC7: "داشبورد مدیرعامل",
    supervisionDashboardC7: "داشبورد سرپرستی",
    financeDashboardC7: "داشبورد مالی",
    alertsBtn: "هشدارها",
    financialInboxBtn: "کارتابل مالی",
    specialistInboxBtn: "کارتابل تخصصی",
    actionInboxBtn: "کارتابل اقدامات",
    approvalQueueBtn: "کارتابل تأییدها",
    dashboardReportBtn: "داشبورد و گزارش‌ها",
    overdueBtn: "پیگیری‌های عقب‌افتاده",
    fundsBtn: "صندوق‌ها و بودجه",
    organizationBtn: "ساختار سرپرستی",
    supervisionInboxBtn: "کارتابل سرپرستی",
    futureBtn: "حامیان و انبار",
    opsBtn: "وضعیت سامانه",
    migrationBtn: "مهاجرت داده",
    securityBtn: "امنیت و حریم خصوصی",
    usersBtn: "مدیریت کاربران",
  };

  const icons = {
    "workspaceHome": "<path d=\"M3 11.5 12 4l9 7.5\"/><path d=\"M5.5 10.5V20h13v-9.5\"/><path d=\"M9.5 20v-5h5v5\"/>",
    "advancedSearchBtn": "<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"m16 16 4.5 4.5\"/><path d=\"M8 10.5h5\"/>",
    "alertsBtn": "<path d=\"M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9\"/><path d=\"M10 21h4\"/>",
    "overdueBtn": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 7v5l3 2\"/><path d=\"M16.5 3.8 19 5.5\"/>",
    "approvalQueueBtn": "<path d=\"M5 4h14v16H5z\"/><path d=\"m8 12 2.2 2.2L16 8.5\"/><path d=\"M8 7h5\"/>",
    "financialInboxBtn": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"14\" rx=\"2\"/><path d=\"M3.5 9h17\"/><path d=\"M7 14h3\"/>",
    "specialistInboxBtn": "<path d=\"M12 4v16M4 12h16\"/><circle cx=\"12\" cy=\"12\" r=\"8.5\"/>",
    "actionInboxBtn": "<path d=\"M5 5h14v14H5z\"/><path d=\"m8 12 2.5 2.5L16 9\"/>",
    "supervisionInboxBtn": "<path d=\"M4 18V9M10 18V5M16 18v-7M20 18H3\"/><path d=\"m4 7 6-3 6 3 4-2\"/>",
    "ceoDashboardC7": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\"/><path d=\"M8 16v-4M12 16V8M16 16v-7\"/>",
    "supervisionDashboardC7": "<circle cx=\"12\" cy=\"8\" r=\"3\"/><path d=\"M5 20c.8-4 3.2-6 7-6s6.2 2 7 6\"/><path d=\"M18 5.5 20 7.5\"/>",
    "financeDashboardC7": "<path d=\"M5 18V9M10 18V6M15 18v-4M20 18H3\"/><path d=\"m4 7 5-3 5 3 5-2\"/>",
    "dashboardReportBtn": "<path d=\"M5 4h14v16H5z\"/><path d=\"M8 16v-4M12 16V8M16 16v-6\"/>",
    "fundsBtn": "<path d=\"M4 8h16v12H4z\"/><path d=\"M6 8V6h12v2\"/><path d=\"M12 11v6\"/><path d=\"M9 14h6\"/>",
    "organizationBtn": "<circle cx=\"12\" cy=\"6\" r=\"3\"/><circle cx=\"6\" cy=\"17\" r=\"3\"/><circle cx=\"18\" cy=\"17\" r=\"3\"/><path d=\"M12 9v4M8.5 15l3.5-2M15.5 15 12 13\"/>",
    "futureBtn": "<path d=\"M6 5h12v14H6z\"/><path d=\"M9 8h6M9 12h6M9 16h4\"/>",
    "usersBtn": "<circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3.5 19c.6-3.5 2.5-5 5.5-5s4.9 1.5 5.5 5\"/><path d=\"M15 5.5a3 3 0 0 1 0 5.5M16 14c2.5.2 4 1.8 4.5 4\"/>",
    "securityBtn": "<path d=\"M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z\"/><path d=\"m9 12 2 2 4-5\"/>",
    "migrationBtn": "<path d=\"M12 16V4M8 8l4-4 4 4\"/><path d=\"M5 13v6h14v-6\"/>",
    "opsBtn": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M8.5 12h7\"/>",
    "trainingBtn": "<path d=\"m3 8 9-4 9 4-9 4z\"/><path d=\"M6 10v5c2 2 10 2 12 0v-5\"/><path d=\"M21 8v6\"/>",
    "uatBtn": "<path d=\"M5 4h14v16H5z\"/><path d=\"M8 8h8M8 12h8M8 16h5\"/>"
};

  const groups = [
    {
      title: "فضای کاری",
      ids: ["advancedSearchBtn", "alertsBtn", "overdueBtn"],
    },
    {
      title: "کارتابل‌ها",
      ids: [
        "approvalQueueBtn",
        "financialInboxBtn",
        "specialistInboxBtn",
        "actionInboxBtn",
        "supervisionInboxBtn",
      ],
    },
    {
      title: "گزارش‌ها",
      ids: [
        "ceoDashboardC7",
        "supervisionDashboardC7",
        "financeDashboardC7",
        "dashboardReportBtn",
      ],
    },
    {
      title: "مدیریت",
      ids: [
        "fundsBtn",
        "organizationBtn",
        "futureBtn",
        "usersBtn",
        "securityBtn",
        "migrationBtn",
        "opsBtn",
        "trainingBtn",
        "uatBtn",
      ],
    },
  ];

  let enhanced = false;

  function cleanLabel(button) {
    const badge = button.querySelector(".count-chip");
    button.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
    const icon = document.createElement("span");
    icon.className = "workspace-nav-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${icons[button.id] || icons.workspaceHome}</svg>`;
    const text = document.createElement("span");
    text.className = "workspace-nav-label";
    text.textContent = labels[button.id] || button.getAttribute("aria-label") || "بخش";
    button.prepend(icon, text);
    if (badge) button.append(badge);
  }

  function groupNavigation(aside) {
    const nav = aside.querySelector(".ui-sidebar-nav");
    const existing = new Map(
      [...aside.querySelectorAll(".ui-sidebar-item[id]")].map((button) => [
        button.id,
        button,
      ]),
    );
    existing.forEach((button) => button.removeAttribute("aria-current"));
    nav.innerHTML = "";

    const home = document.createElement("button");
    home.id = "workspaceHome";
    home.type = "button";
    home.className = "ui-sidebar-item workspace-home";
    home.setAttribute("aria-current", "page");
    home.innerHTML =
      '<span class="workspace-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${icons.workspaceHome}</svg></span><span class="workspace-nav-label">نمای امروز</span>';
    home.onclick = () => {
      document
        .querySelector(".workspace-overview")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(home);
      closeMobileNav();
    };
    nav.append(home);
    setTimeout(() => setActive(home), 80);

    groups.forEach((group, index) => {
      const buttons = group.ids.map((id) => existing.get(id)).filter(Boolean);
      if (!buttons.length) return;
      const section = document.createElement("section");
      section.className = "workspace-nav-group";
      const title = document.createElement("button");
      title.type = "button";
      title.className = "workspace-nav-group-title";
      const initiallyOpen = index < 2;
      title.setAttribute("aria-expanded", String(initiallyOpen));
      title.innerHTML = `<span>${group.title}</span><span class="workspace-nav-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m7 9 5 5 5-5"/></svg></span>`;
      const items = document.createElement("div");
      items.className = "ui-sidebar-items workspace-nav-items";
      items.hidden = !initiallyOpen;
      buttons.forEach((button) => {
        cleanLabel(button);
        button.addEventListener("click", () => {
          setActive(button);
          closeMobileNav();
        });
        items.append(button);
      });
      title.onclick = () => {
        const open = title.getAttribute("aria-expanded") === "true";
        title.setAttribute("aria-expanded", String(!open));
        items.hidden = open;
      };
      section.append(title, items);
      nav.append(section);
      if (index > 1) section.classList.add("workspace-nav-secondary");
    });
  }

  function setActive(button) {
    document
      .querySelectorAll(".ui-sidebar-item[aria-current]")
      .forEach((item) => item.removeAttribute("aria-current"));
    button.setAttribute("aria-current", "page");
  }

  function enhanceSidebar(aside) {
    const role =
      document.querySelector("#userRole")?.textContent?.trim() || "کاربر سامانه";
    const head = aside.querySelector(".ui-sidebar-head");
    head.innerHTML = `
      <div class="workspace-sidebar-brand">
        <span class="workspace-sidebar-mark">خ</span>
        <span><b>مرکز عملیات</b><small>${role}</small></span>
      </div>
      <button class="workspace-sidebar-close" type="button" aria-label="بستن منو">×</button>
    `;
    head.querySelector(".workspace-sidebar-close").onclick = closeMobileNav;
    groupNavigation(aside);
    const footer = aside.querySelector(".ui-sidebar-footer");
    footer.innerHTML =
      '<span class="workspace-status-dot"></span><span>ارتباط امن با سامانه برقرار است</span>';
  }

  function enhanceHeader() {
    const head = document.querySelector(".dashboard-head");
    if (!head || head.dataset.workspaceEnhanced) return;
    head.dataset.workspaceEnhanced = "true";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "workspace-menu-toggle";
    toggle.setAttribute("aria-label", "بازکردن منوی اصلی");
    toggle.innerHTML = "<span></span><span></span><span></span>";
    toggle.onclick = openMobileNav;
    head.prepend(toggle);

    const topbar = document.querySelector(".topbar");
    if (topbar && !topbar.querySelector(".workspace-notification")) {
      const notification = document.createElement("button");
      notification.type = "button";
      notification.className = "workspace-notification";
      notification.setAttribute("aria-label", "مشاهده هشدارها");
      notification.innerHTML =
        '<span aria-hidden="true">!</span><i class="workspace-notification-dot"></i>';
      notification.onclick = () =>
        document.querySelector("#alertsBtn")?.click();
      const secure = topbar.querySelector(".secure-chip");
      secure?.before(notification);
    }
  }

  function openMobileNav() {
    document.body.classList.add("workspace-nav-open");
  }

  function closeMobileNav() {
    document.body.classList.remove("workspace-nav-open");
  }

  function createOverlay() {
    if (document.querySelector(".workspace-nav-overlay")) return;
    const overlay = document.createElement("button");
    overlay.type = "button";
    overlay.className = "workspace-nav-overlay";
    overlay.setAttribute("aria-label", "بستن منوی اصلی");
    overlay.onclick = closeMobileNav;
    document.body.append(overlay);
  }

  function actionButton(id, label, primary = false) {
    if (!document.querySelector(`#${id}`)) return "";
    return `<button type="button" class="${primary ? "primary" : "workspace-quick-action"}" data-workspace-action="${id}">${label}</button>`;
  }

  function createOverview(main) {
    if (main.querySelector(".workspace-overview")) return;
    const date = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
    const section = document.createElement("section");
    section.className = "workspace-overview";
    section.innerHTML = `
      <nav class="workspace-breadcrumb" aria-label="مسیر"><span>خانه</span><b aria-hidden="true">/</b><strong>نمای امروز</strong></nav>
      <div class="workspace-overview-head">
        <div>
          <div class="workspace-date">${date}</div>
          <h2>نمای امروز</h2>
          <p>مواردی که به توجه یا اقدام شما نیاز دارند.</p>
        </div>
        <div class="workspace-head-actions">
          <button class="workspace-refresh" type="button" aria-label="به‌روزرسانی نمای امروز">↻ <span>به‌روزرسانی</span></button>
          ${actionButton("createBtn", "+ پرونده جدید", true)}
        </div>
      </div>
      <div class="workspace-metrics" aria-label="خلاصه وضعیت">
        <button class="workspace-metric" data-tone="blue" data-workspace-action="advancedSearchBtn"><span class="workspace-metric-icon">خ</span><span><small>پرونده‌های فعال</small><strong data-metric="active">—</strong></span></button>
        <button class="workspace-metric" data-tone="red" data-workspace-action="overdueBtn"><span class="workspace-metric-icon">!</span><span><small>پیگیری عقب‌افتاده</small><strong data-metric="overdue">—</strong></span></button>
        <button class="workspace-metric" data-tone="orange" data-workspace-action="advancedSearchBtn"><span class="workspace-metric-icon">↑</span><span><small>موارد فوری</small><strong data-metric="urgent">—</strong></span></button>
        <button class="workspace-metric" data-tone="green" data-workspace-action="alertsBtn"><span class="workspace-metric-icon">●</span><span><small>هشدار خوانده‌نشده</small><strong data-metric="alerts">—</strong></span></button>
      </div>
      <div class="workspace-focus-grid">
        <article class="workspace-focus-card">
          <div class="workspace-card-head"><div><span class="workspace-card-kicker">اولویت‌ها</span><h3>نیازمند توجه شما</h3></div><button type="button" data-workspace-action="alertsBtn">مشاهده همه</button></div>
          <div class="workspace-priority-list" data-priority-list>
            <div class="workspace-loading"><i></i><span>در حال دریافت وضعیت…</span></div>
          </div>
        </article>
        <article class="workspace-focus-card">
          <div class="workspace-card-head"><div><span class="workspace-card-kicker">دسترسی سریع</span><h3>شروع یک اقدام</h3></div></div>
          <div class="workspace-quick-grid">
            ${actionButton("advancedSearchBtn", "جست‌وجوی پرونده")}
            ${actionButton("actionInboxBtn", "کارتابل اقدامات")}
            ${actionButton("financialInboxBtn", "کارتابل مالی")}
            ${actionButton("supervisionInboxBtn", "کارتابل سرپرستی")}
            ${actionButton("specialistInboxBtn", "کارتابل تخصصی")}
            ${actionButton("dashboardReportBtn", "گزارش‌ها")}
          </div>
        </article>
      </div>
    `;
    main.prepend(section);
    section.querySelectorAll("[data-workspace-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.querySelector(
          `#${button.dataset.workspaceAction}`,
        );
        target?.click();
      });
    });
    section.querySelector(".workspace-refresh").onclick = loadOverview;
  }

  async function request(path) {
    const response = await fetch(path, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }

  function priorityRow(tone, value, title, description, action) {
    if (!value) return "";
    return `
      <button type="button" class="workspace-priority" data-tone="${tone}" data-workspace-action="${action}">
        <span class="workspace-priority-mark"></span>
        <span><b>${title}</b><small>${description}</small></span>
        <strong>${fa(value)}</strong>
        <i aria-hidden="true">←</i>
      </button>
    `;
  }

  async function loadOverview() {
    const root = document.querySelector(".workspace-overview");
    if (!root) return;
    root.classList.add("is-loading");
    const [dashboard, alerts, overdue] = await Promise.allSettled([
      request("/api/dashboard"),
      request("/api/alerts?includeRead=false"),
      request("/api/follow-ups/overdue"),
    ]);
    const data = dashboard.status === "fulfilled" ? dashboard.value : {};
    const alertData = alerts.status === "fulfilled" ? alerts.value : {};
    const overdueCount =
      overdue.status === "fulfilled"
        ? overdue.value.items?.length || 0
        : data.overdue || 0;
    const values = {
      active: data.active,
      overdue: overdueCount,
      urgent: data.urgent,
      alerts: alertData.unread,
    };
    document
      .querySelector(".workspace-notification-dot")
      ?.classList.toggle("hidden", !alertData.unread);
    Object.entries(values).forEach(([key, value]) => {
      const node = root.querySelector(`[data-metric="${key}"]`);
      if (node) node.textContent = value === undefined ? "—" : fa(value);
    });
    const rows = [
      priorityRow(
        "red",
        overdueCount,
        "پیگیری‌های عقب‌افتاده",
        "موعد پیگیری این موارد گذشته است.",
        "overdueBtn",
      ),
      priorityRow(
        "orange",
        data.urgent,
        "پرونده‌های با اولویت فوری",
        "این پرونده‌ها به بررسی سریع نیاز دارند.",
        "advancedSearchBtn",
      ),
      priorityRow(
        "blue",
        alertData.unread,
        "هشدارهای خوانده‌نشده",
        "هشدارهای جدید سامانه را مرور کنید.",
        "alertsBtn",
      ),
    ].join("");
    const list = root.querySelector("[data-priority-list]");
    list.innerHTML =
      rows ||
      '<div class="workspace-all-clear"><span>✓</span><div><b>همه‌چیز مرتب است</b><small>در حال حاضر مورد فوری ثبت نشده است.</small></div></div>';
    list.querySelectorAll("[data-workspace-action]").forEach((button) => {
      button.onclick = () =>
        document.querySelector(`#${button.dataset.workspaceAction}`)?.click();
    });
    root.classList.remove("is-loading");
  }

  function enhance() {
    const dashboard = document.querySelector("#dashboard");
    const aside = dashboard?.querySelector(".ui-sidebar");
    const main = dashboard?.querySelector(".dashboard-main");
    if (!dashboard || !aside || !main || enhanced) return false;
    enhanced = true;
    dashboard.classList.add("workspace-dashboard");
    enhanceSidebar(aside);
    enhanceHeader();
    createOverlay();
    createOverview(main);
    loadOverview();
    return true;
  }

  function init() {
    if (enhance()) return;
    const observer = new MutationObserver(() => {
      if (enhance()) observer.disconnect();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();