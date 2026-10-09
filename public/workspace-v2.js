(() => {
  const fa = (value) =>
    new Intl.NumberFormat("fa-IR").format(Number(value) || 0);
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
    );

  const labels = {
    advancedSearchBtn: "جست‌وجوی پیشرفته",
    familiesBtn: "خانواده‌ها",
    alertsBtn: "مرکز پیگیری",
    financeHubBtn: "امور مالی",
    managementHubBtn: "مدیریت و گزارش‌ها",
  };

  const icons = {
    "workspaceHome": "<path d=\"M3 11.5 12 4l9 7.5\"/><path d=\"M5.5 10.5V20h13v-9.5\"/><path d=\"M9.5 20v-5h5v5\"/>",
    "advancedSearchBtn": "<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"m16 16 4.5 4.5\"/><path d=\"M8 10.5h5\"/>",
    "familiesBtn": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\"/><path d=\"M8 8h8M8 12h8M8 16h5\"/>",
    "alertsBtn": "<path d=\"M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9\"/><path d=\"M10 21h4\"/>",
    "financeHubBtn": "<path d=\"M4 8h16v12H4z\"/><path d=\"M6 8V6h12v2\"/><path d=\"M12 11v6\"/><path d=\"M9 14h6\"/>",
    "managementHubBtn": "<path d=\"M4 19h16M6 16V9M12 16V5M18 16v-4\"/><path d=\"m5 7 6-3 5 3 3-2\"/>",
};

  const navItems = [
    "familiesBtn",
    "advancedSearchBtn",
    "alertsBtn",
    "financeHubBtn",
    "managementHubBtn",
  ];


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
    home.innerHTML = `<span class="workspace-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${icons.workspaceHome}</svg></span><span class="workspace-nav-label">نمای امروز</span>`;
    home.onclick = () => {
      document
        .querySelector(".workspace-overview")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(home);
      closeMobileNav();
    };
    nav.append(home);
    setTimeout(() => setActive(home), 80);

    nav.classList.add("workspace-nav-flat");
    const items = document.createElement("div");
    items.className = "ui-sidebar-items workspace-nav-items";
    navItems
      .map((id) => existing.get(id))
      .filter(Boolean)
      .forEach((button) => {
        cleanLabel(button);
        button.addEventListener("click", () => {
          setActive(button);
          closeMobileNav();
        });
        items.append(button);
      });
    nav.append(items);
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
        <img class="workspace-sidebar-mark" src="${document.documentElement.dataset.theme === "dark" ? "/brand/charity-logo-dark.png" : "/brand/charity-logo.png"}" data-brand-logo alt="نشان خیریه">
        <span><b>مرکز عملیات</b><small>${role}</small></span>
      </div>
      <button class="workspace-sidebar-close" type="button" aria-label="بازگشت">بازگشت</button>
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
      <div class="workspace-overview-head">
        <div>
          <div class="workspace-date">${date}</div>
          <h2>نمای امروز</h2>
          <p>اولویت‌های امروز و پیگیری خانواده‌ها، یک‌جا</p>
        </div>
      </div>
      <section class="workspace-notices" aria-labelledby="workspaceNoticesTitle">
        <header class="workspace-notices-head">
          <div><span class="workspace-card-kicker">برای شروع کار</span><h3 id="workspaceNoticesTitle">پیام‌ها و موارد مهم</h3></div>
          <div class="workspace-notice-tools">
            <button type="button" data-workspace-action="messagesBtn">صندوق پیام‌ها <span data-message-unread>۰</span></button>
            <button type="button" data-workspace-action="alertsBtn">همه هشدارها</button>
          </div>
        </header>
        <div class="workspace-notice-list" data-notice-list>
          <div class="workspace-loading"><i></i><span>در حال بررسی پیام‌ها و هشدارها…</span></div>
        </div>
      </section>
      <div class="workspace-metrics-heading"><b>خلاصه وضعیت</b></div>
      <div class="workspace-metrics" aria-label="خلاصه وضعیت">
        <button class="workspace-metric" data-tone="blue" data-workspace-action="activeFamiliesBtn"><span class="workspace-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg></span><span class="workspace-metric-copy"><small>پرونده‌های فعال</small><strong data-metric="active">—</strong><span class="workspace-metric-caption">خانوارهای در جریان رسیدگی</span></span></button>
        <button class="workspace-metric" data-tone="red" data-workspace-action="overdueBtn"><span class="workspace-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg></span><span class="workspace-metric-copy"><small>پیگیری عقب‌افتاده</small><strong data-metric="overdue">—</strong><span class="workspace-metric-caption">موعد اقدام گذشته است</span></span></button>
        <button class="workspace-metric" data-tone="orange" data-workspace-action="urgentFamiliesBtn"><span class="workspace-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 16 5-5 3 3 6-7"/><path d="M14 7h5v5"/></svg></span><span class="workspace-metric-copy"><small>موارد فوری</small><strong data-metric="urgent">—</strong><span class="workspace-metric-caption">فهرست پرونده‌های فوری</span></span></button>
        <button class="workspace-metric" data-tone="green" data-workspace-action="alertsBtn"><span class="workspace-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span><span class="workspace-metric-copy"><small>هشدار خوانده‌نشده</small><strong data-metric="alerts">—</strong><span class="workspace-metric-caption">نیازمند مرور</span></span></button>
      </div>
      <div class="workspace-focus-grid workspace-focus-grid-single">
        <article class="workspace-focus-card">
          <div class="workspace-card-head"><div><span class="workspace-card-kicker">پیگیری‌ها</span><h3>نیازمند اقدام</h3></div><button type="button" data-workspace-action="attentionItemsBtn">مشاهده همه</button></div>
          <div class="workspace-priority-list" data-priority-list>
            <div class="workspace-loading"><i></i><span>در حال دریافت وضعیت…</span></div>
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
        runOverviewAction(button.dataset.workspaceAction, target);
      });
    });
  }

  function runOverviewAction(action, target) {
    if (action === "activeFamiliesBtn") return window.openActiveFamilyList?.();
    if (action === "urgentFamiliesBtn") return window.openUrgentFamilyList?.();
    if (action === "attentionItemsBtn") return window.openAttentionItems?.();
    if (action === "messagesBtn") return openMessageInbox();
    if (action === "overdueBtn" && typeof openOverdue === "function") return openOverdue();
    if (action === "alertsBtn" && typeof openAlerts === "function") return openAlerts("", true);
    target?.click();
  }

  async function request(path) {
    const response = await fetch(path, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }

  const severityNames = { critical: "بحرانی", urgent: "فوری", important: "مهم" };
  const severityRank = { critical: 0, urgent: 1, important: 2 };
  function faDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ""
      : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(date);
  }
  function noticeCard(item, kind, expanded = false) {
    const isMessage = kind === "message";
    const tone = item.severity || "important";
    const familyName = item.headName ? `${item.headName}${item.caseNumber ? ` · پرونده ${item.caseNumber}` : ""}` : "";
    const detail = isMessage ? item.body : item.message;
    const date = isMessage ? item.createdAt : item.dueAt || item.createdAt;
    const action = isMessage
      ? `<button type="button" class="workspace-notice-action" data-message-${item.acknowledgementRequired ? "ack" : "read"}="${escapeHtml(item.id)}">${item.acknowledgementRequired ? "خواندم و متوجه شدم" : "علامت‌گذاری به‌عنوان خوانده‌شده"}</button>`
      : item.familyId
        ? `<button type="button" class="workspace-notice-action" data-open-notice-family="${escapeHtml(item.familyId)}" data-notice-section="${item.type === "weekly_revision_requested" ? "#supervisionSection" : ""}" data-alert-key="${escapeHtml(item.key)}">بازکردن پرونده</button>`
        : `<button type="button" class="workspace-notice-action" data-open-alert-center>مرکز هشدارها</button>`;
    return `<article class="workspace-notice-card" data-tone="${escapeHtml(tone)}">
      <span class="workspace-notice-mark" aria-hidden="true">${isMessage ? "✉" : "!"}</span>
      <div class="workspace-notice-copy">
        <div class="workspace-notice-meta"><span>${isMessage ? `پیام از ${escapeHtml(item.senderName || "مدیریت")}${item.senderPosition ? ` · ${escapeHtml(item.senderPosition)}` : ""}` : escapeHtml(item.title || "هشدار سامانه")}</span><b>${severityNames[tone] || "مهم"}</b>${date ? `<time>${faDate(date)}</time>` : ""}</div>
        ${isMessage ? `<h4>${escapeHtml(item.title)}</h4>` : ""}
        <p>${escapeHtml(detail || "")}</p>
        ${familyName ? `<small class="workspace-notice-family">${escapeHtml(familyName)}</small>` : ""}
        ${expanded ? `<div class="workspace-notice-extra">${isMessage && item.acknowledgedAt ? "این پیام را تأیید کرده‌اید." : isMessage && item.readAt ? "این پیام خوانده شده است." : ""}${!isMessage && item.dueAt ? `موعد: ${faDate(item.dueAt)}` : ""}</div>` : ""}
      </div>
      <div class="workspace-notice-actions">${action}${isMessage && item.familyId ? `<button type="button" class="workspace-notice-link" data-open-notice-family="${escapeHtml(item.familyId)}">مشاهده پرونده</button>` : ""}</div>
    </article>`;
  }
  async function refreshNotices() {
    const [messageResult, alertResult] = await Promise.allSettled([
      request("/api/messages/inbox?includeRead=false"),
      request("/api/alerts?includeRead=false"),
    ]);
    return {
      messages: messageResult.status === "fulfilled" ? messageResult.value.messages || [] : [],
      alerts: alertResult.status === "fulfilled" ? alertResult.value.alerts || [] : [],
      unreadMessages: messageResult.status === "fulfilled" ? messageResult.value.unread || 0 : 0,
    };
  }
  async function openMessageInbox() {
    const root = document.querySelector("#modalRoot");
    if (!root) return;
    root.innerHTML = `<div class="modal-backdrop"><section class="modal workspace-message-modal" role="dialog" aria-modal="true"><header class="modal-head"><div><span class="eyebrow">پیام‌های دریافتی از مدیریت</span><h2>صندوق پیام‌ها</h2><p class="muted">پیام‌های مهم و مواردی که نیاز به تأیید شما دارند.</p></div><button type="button" class="close-btn" data-close aria-label="بستن">×</button></header><div class="workspace-message-inbox"><div class="panel-loading">در حال دریافت پیام‌ها…</div></div></section></div>`;
    const close = () => { if (typeof window.closeModal === "function") window.closeModal(); else root.replaceChildren(); };
    root.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", close));
    root.querySelector(".modal-backdrop")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) close();
    });
    try {
      const [messageData, alertData] = await Promise.all([
        request("/api/messages/inbox?includeRead=true"),
        request("/api/alerts?includeRead=false"),
      ]);
      const box = root.querySelector(".workspace-message-inbox");
      const messages = messageData.messages || [];
      box.innerHTML = `${messages.length ? `<div class="workspace-message-count">${fa(messages.filter((message) => !message.readAt).length)} پیام خوانده‌نشده</div>${messages.map((message) => noticeCard(message, "message", true)).join("")}` : '<div class="workspace-notice-empty"><b>پیامی در صندوق شما نیست</b><span>اگر پیامی از مدیریت ارسال شود، اینجا نمایش داده می‌شود.</span></div>'}
        ${(alertData.alerts || []).length ? `<h3 class="workspace-inbox-subhead">هشدارهای سامانه</h3>${alertData.alerts.map((alert) => noticeCard(alert, "alert", true)).join("")}` : ""}`;
      bindNoticeActions(box, refreshNotices);
    } catch (error) {
      root.querySelector(".workspace-message-inbox").innerHTML = `<div class="workspace-notice-empty"><b>صندوق پیام بارگذاری نشد</b><span>${escapeHtml(error.message)}</span></div>`;
    }
  }
  function bindNoticeActions(root, onChange) {
    root.querySelectorAll("[data-message-read],[data-message-ack]").forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        try {
          const path = button.hasAttribute("data-message-ack")
            ? `/api/messages/${encodeURIComponent(button.dataset.messageAck)}/acknowledge`
            : `/api/messages/${encodeURIComponent(button.dataset.messageRead)}/read`;
          await window.api(path, { method: "POST", body: "{}" });
          if (onChange) await onChange();
          if (root.closest("#modalRoot")) openMessageInbox();
        } catch (error) {
          button.disabled = false;
          window.toast?.(error.message);
        }
      };
    });
    root.querySelectorAll("[data-open-notice-family]").forEach((button) => {
      button.onclick = async () => {
        const alertKey = button.dataset.alertKey;
        if (alertKey) {
          try { await window.api(`/api/alerts/${encodeURIComponent(alertKey)}/read`, { method: "POST", body: "{}" }); } catch {}
        }
        const id = button.dataset.openNoticeFamily;
        if (root.closest("#modalRoot")) window.closeModal?.();
        window.openFamilyRecord?.(id);
        const section = button.dataset.noticeSection;
        if (section) setTimeout(() => document.querySelector(section)?.scrollIntoView({ behavior: "smooth", block: "start" }), 750);
      };
    });
    root.querySelectorAll("[data-open-alert-center]").forEach((button) => button.onclick = () => window.openAlerts?.());
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
    const position = window.currentActor?.position;
    const scopedWorker = ["liaison", "health_officer", "education_officer"].includes(position);
    const dashboardRequest = scopedWorker
      ? request("/api/families?status=active&limit=1&offset=0").then((data) => ({ active: data.total }))
      : request("/api/dashboard");
    const [dashboard, alerts, overdue, urgent, messages] = await Promise.allSettled([
      dashboardRequest,
      request("/api/alerts?includeRead=false"),
      request("/api/follow-ups/overdue"),
      request(
        "/api/families/search/advanced?status=active&priority=" +
          encodeURIComponent("فوری") +
          "&limit=5",
      ),
      request("/api/messages/inbox?includeRead=false"),
    ]);
    const data = dashboard.status === "fulfilled" ? dashboard.value : {};
    const alertData = alerts.status === "fulfilled" ? alerts.value : {};
    const messageData = messages.status === "fulfilled" ? messages.value : {};
    const urgentData = urgent.status === "fulfilled" ? urgent.value : {};
    const overdueCount =
      overdue.status === "fulfilled"
        ? overdue.value.items?.length || 0
        : data.overdue || 0;
    const values = {
      active: data.active,
      overdue: overdueCount,
      urgent: urgentData.total ?? data.urgent,
      alerts: alertData.unread,
    };
    Object.entries(values).forEach(([key, value]) => {
      const node = root.querySelector(`[data-metric="${key}"]`);
      if (node) node.textContent = value === undefined ? "—" : fa(value);
    });
    const directMessages = messageData.messages || [];
    const systemAlerts = alertData.alerts || [];
    const messageUnread = root.querySelector("[data-message-unread]");
    if (messageUnread) messageUnread.textContent = fa(messageData.unread || 0);
    const notices = root.querySelector("[data-notice-list]");
    const visibleNotices = [
      ...directMessages.slice(0, 2).map((item) => noticeCard(item, "message")),
      ...systemAlerts.slice(0, 2).map((item) => noticeCard(item, "alert")),
    ];
    notices.innerHTML = visibleNotices.join("") ||
      '<div class="workspace-notice-empty"><span class="workspace-notice-clear">✓</span><div><b>پیام یا هشدار خوانده‌نشده‌ای ندارید</b><small>اگر مدیریتی برای شما پیامی بفرستد، همین‌جا نمایش داده می‌شود.</small></div></div>';
    bindNoticeActions(notices, loadOverview);
    const rows = [
      priorityRow(
        "red",
        overdueCount,
        "پیگیری‌های عقب‌افتاده",
        "موعد پیگیری این موارد گذشته است.",
        "overdueBtn",
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
      '<div class="workspace-all-clear"><span>✓</span><div><b>موردی برای پیگیری نیست</b><small>موارد فوری را از کارت بالای صفحه ببینید.</small></div></div>';
    list.querySelectorAll("[data-workspace-action]").forEach((button) => {
      button.onclick = () =>
        runOverviewAction(
          button.dataset.workspaceAction,
          document.querySelector(`#${button.dataset.workspaceAction}`),
        );
    });
    root.classList.remove("is-loading");
  }

  function enhance() {
    const dashboard = document.querySelector("#dashboard");
    const aside = dashboard?.querySelector(".ui-sidebar");
    const main = dashboard?.querySelector(".dashboard-main");
    if (!dashboard || !aside || !main || aside.dataset.workspaceEnhanced) return false;
    aside.dataset.workspaceEnhanced = "true";
    dashboard.classList.add("workspace-dashboard");
    enhanceSidebar(aside);
    enhanceHeader();
    createOverlay();
    createOverview(main);
    loadOverview();
    return true;
  }

  function init() {
    window.addEventListener("uisidebarready", () => enhance());
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