(() => {
  const fa = (value) =>
    new Intl.NumberFormat("fa-IR").format(Number(value) || 0);

  const digitMap = {
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };

  function normalizeDigits(value = "") {
    return String(value).replace(/[۰-۹٠-٩]/g, (digit) => digitMap[digit] || digit);
  }

  function numberFromText(value = "") {
    const match = normalizeDigits(value).match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function esc(text = "") {
    return String(text).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function initials(name = "") {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return (words[0]?.[0] || "خ") + (words[1]?.[0] || "");
  }

  function toneForPriority(text = "") {
    if (/فوری|بحرانی/.test(text)) return "critical";
    if (/بالا|مهم/.test(text)) return "high";
    if (/آرشیو/.test(text)) return "archived";
    if (/پایین/.test(text)) return "low";
    return "normal";
  }

  function formatDate(value, withTime = false) {
    if (!value) return "ثبت نشده";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      ...(withTime ? { timeStyle: "short" } : {}),
    }).format(date);
  }

  function fallbackCompleteness(family) {
    const checks = [
      ["headName", family.headName],
      ["familySurname", family.familySurname],
      ["headNationalId", family.headNationalId],
      ["headPhone", family.headPhone],
      ["headCardNumber", family.headCardNumber],
      ["headJob", family.headJob],
      ["headEducation", family.headEducation?.description || family.headEducation?.level],
      ["address", family.address],
      ["members", family.members?.length],
      ["notes", family.notes],
    ];
    const completeFields = checks.filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "number") return value > 0;
      return Boolean(String(value || "").trim());
    }).length;
    const totalFields = checks.length;
    const missingCount = Math.max(0, totalFields - completeFields);
    return {
      percent: Math.round((completeFields / totalFields) * 100),
      completeFields,
      totalFields,
      missingCount,
      missingPreview: missingCount ? `${fa(missingCount)} مورد باقی‌مانده` : "همهٔ موارد پایه تکمیل شده‌اند",
    };
  }

  function readProgressState(detail, family, comprehensive) {
    if (comprehensive?.completeness) {
      const info = comprehensive.completeness;
      const missingFields = info.missingFields || [];
      return {
        percent: Number(info.percent ?? 0),
        completeFields: Number(info.completeFields ?? 0),
        totalFields: Number(info.totalFields ?? 0),
        missingCount: missingFields.length,
        missingPreview: missingFields.length
          ? `${fa(missingFields.length)} مورد باقی‌مانده`
          : "همهٔ موارد بررسی‌شده تکمیل شده‌اند",
      };
    }

    const progressBox = detail.querySelector(".ui-family-progress");
    if (progressBox) {
      const percent =
        numberFromText(
          progressBox.querySelector(".ui-family-progress-percent")?.textContent || "",
        ) ?? fallbackCompleteness(family).percent;
      const countsText =
        progressBox.querySelector(".ui-family-progress-copy p")?.textContent || "";
      const counts = normalizeDigits(countsText).match(/(\d+)\s+از\s+(\d+)/);
      const preview =
        progressBox
          .querySelector(".ui-family-missing-preview div")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() || fallbackCompleteness(family).missingPreview;
      return {
        percent,
        completeFields: counts ? Number(counts[1]) : fallbackCompleteness(family).completeFields,
        totalFields: counts ? Number(counts[2]) : fallbackCompleteness(family).totalFields,
        missingCount:
          numberFromText(
            progressBox.querySelector(".ui-family-missing-preview")?.textContent || "",
          ) ?? fallbackCompleteness(family).missingCount,
        missingPreview: preview,
      };
    }

    return fallbackCompleteness(family);
  }

  function readFollowUpState(detail, comprehensive) {
    if (comprehensive?.followUp) {
      return {
        lastContact: comprehensive.followUp.lastContactAt
          ? formatDate(comprehensive.followUp.lastContactAt, true)
          : "ثبت نشده",
        nextFollowUp: comprehensive.followUp.nextFollowUpAt
          ? formatDate(comprehensive.followUp.nextFollowUpAt, true)
          : "تعریف نشده",
      };
    }

    const rows = [...detail.querySelectorAll(".profile-integrated-meta small")];
    const readValue = (label) =>
      rows.find((row) => row.textContent.includes(label))?.parentElement?.querySelector("b")
        ?.textContent?.trim();
    return {
      lastContact: readValue("آخرین تماس") || "ثبت نشده",
      nextFollowUp: readValue("پیگیری بعدی") || "تعریف نشده",
    };
  }

  function suggestNextAction(family, progressState, followUpState) {
    if (family.archived) {
      return {
        label: "وضعیت فعلی",
        value: "بازگردانی پرونده",
        note: "برای ادامه ویرایش ابتدا پرونده بازگردانی شود",
      };
    }
    if (family.approvalStatus === "pending") {
      return {
        label: "اقدام بعدی",
        value: "تأیید سطح بالاتر",
        note: "این پرونده هنوز در صف تأیید است",
      };
    }
    if ((progressState.missingCount || 0) > 0) {
      return {
        label: "اقدام بعدی",
        value: "تکمیل اطلاعات",
        note: progressState.missingPreview,
      };
    }
    if (followUpState.nextFollowUp && followUpState.nextFollowUp !== "تعریف نشده") {
      return {
        label: "پیگیری بعدی",
        value: followUpState.nextFollowUp,
        note: "برای ادامه هماهنگی پرونده",
      };
    }
    if (!family.members?.length) {
      return {
        label: "اقدام بعدی",
        value: "ثبت اعضای خانوار",
        note: "هنوز عضوی برای این پرونده ثبت نشده است",
      };
    }
    return {
      label: "مسیر اقدام بعدی",
      value: "مرور گزارش‌ها و پرداخت",
      note: `اولویت جاری · ${family.priority || "متوسط"}`,
    };
  }

  function cardMarkup({ label, value, note, variant = "default", progress = null }) {
    return `
      <article class="family-hero-metric" data-variant="${variant}">
        <span class="family-hero-metric-label">${esc(label)}</span>
        ${progress !== null ? `<div class="family-hero-progress-track" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, progress))}%"></span></div>` : ""}
        <strong class="family-hero-metric-value">${esc(value)}</strong>
        <small class="family-hero-metric-note">${esc(note)}</small>
      </article>
    `;
  }

  function reorderActions(actions) {
    if (!actions) return;
    const buttons = actions.querySelector(".family-action-buttons") || document.createElement("div");
    buttons.className = "family-action-buttons";
    const ordered = [
      actions.querySelector("#editFamilyBtn"),
      actions.querySelector("#profileUploadBtn"),
      actions.querySelector("#auditBtn"),
      actions.querySelector("#archiveFamilyBtn"),
    ].filter(Boolean);
    [...actions.children]
      .filter((child) => child.tagName === "BUTTON" && !ordered.includes(child))
      .forEach((button) => ordered.push(button));
    buttons.replaceChildren(...ordered);
    actions.append(buttons);
  }

  function ensureHeroStructure(detail, family) {
    const head = detail.querySelector(".detail-head");
    if (!head) return null;
    head.classList.add("family-record-head", "family-record-head--hero");
    const identity = head.firstElementChild;
    identity?.classList.add("family-record-identity", "family-hero-identity");

    if (identity && !identity.querySelector(".family-record-avatar")) {
      const avatar = document.createElement("span");
      avatar.className = "family-record-avatar";
      avatar.textContent = initials(family.headName || family.familySurname);
      avatar.setAttribute("aria-hidden", "true");
      identity.prepend(avatar);
    }

    let status = identity?.querySelector(".family-record-status");
    if (!status) {
      status = document.createElement("div");
      status.className = "family-record-status";
      identity?.append(status);
    }

    const actions = head.querySelector(".detail-actions");
    if (actions) {
      actions.classList.add("family-hero-actions");
      const priority = actions.querySelector(":scope > .status");
      if (priority) status.append(priority);
      reorderActions(actions);
      const primary =
        actions.querySelector("#editFamilyBtn") ||
        actions.querySelector("#profileUploadBtn");
      primary?.classList.add("family-primary-action");
    }

    // Move the original node so async team updates and bound actions are preserved.
    const team = detail.querySelector("#familyContactStrip");
    if (team && team.parentElement !== head) head.append(team);

    let metrics = head.querySelector(".family-hero-metrics");
    if (!metrics) {
      metrics = document.createElement("section");
      metrics.className = "family-hero-metrics";
      head.append(metrics);
    }

    return { head, identity, status, actions, metrics };
  }

  function syncHero(detail, family) {
    if (!detail?.querySelector(".detail-head") || !family) return;
    const comprehensive = detail.__familyComprehensive?.familyId === family.id
      ? detail.__familyComprehensive
      : null;
    const parts = ensureHeroStructure(detail, family);
    if (!parts) return;

    const { identity, status, metrics } = parts;
    const title = identity?.querySelector("h2");
    if (title) title.textContent = family.headName || title.textContent;
    const muted = identity?.querySelector(".muted");
    if (muted) muted.textContent = `خانوار ${family.familySurname || "بدون نام خانوادگی"}`;
    const eyebrow = identity?.querySelector(".eyebrow");
    if (eyebrow) eyebrow.textContent = `فرد اصلی خانوار · پرونده ${family.caseNumber || "—"}`;
    const avatar = identity?.querySelector(".family-record-avatar");
    if (avatar) avatar.textContent = initials(family.headName || family.familySurname);

    const stateText = family.archived ? "آرشیوشده" : "پرونده فعال";
    const memberText = `${fa(family.members?.length || 0)} عضو ثبت‌شده`;
    status.innerHTML = `
      <span data-tone="${family.archived ? "archived" : "active"}">${esc(stateText)}</span>
      <small>${esc(memberText)}</small>
      ${family.approvalStatus === "pending" ? "<small>در انتظار تأیید</small>" : ""}
    `;
    const priorityChip = document.createElement("span");
    priorityChip.className = "status family-hero-priority";
    priorityChip.textContent = `اولویت ${family.priority || "متوسط"}`;
    status.append(priorityChip);

    const progressState = readProgressState(detail, family, comprehensive);
    const followUpState = readFollowUpState(detail, comprehensive);
    const nextAction = suggestNextAction(family, progressState, followUpState);

    metrics.innerHTML = [
      cardMarkup({
        label: "پیشرفت تکمیل پرونده",
        value: `${fa(progressState.percent || 0)}٪`,
        note:
          progressState.totalFields
            ? `${fa(progressState.completeFields || 0)} از ${fa(progressState.totalFields || 0)} مورد تکمیل شده`
            : progressState.missingPreview,
        variant: "progress",
        progress: progressState.percent || 0,
      }),
      cardMarkup({
        label: nextAction.label,
        value: nextAction.value,
        note: nextAction.note,
        variant: "action",
      }),
      cardMarkup({
        label: "آخرین تماس",
        value: followUpState.lastContact || "ثبت نشده",
        note:
          followUpState.nextFollowUp && followUpState.nextFollowUp !== "تعریف نشده"
            ? `پیگیری بعدی · ${followUpState.nextFollowUp}`
            : `اولویت جاری · ${family.priority || "متوسط"}`,
        variant: "meta",
      }),
    ].join("");
  }

  function scheduleHeroSync(detail) {
    if (!detail || detail.dataset.familyHeroSyncPending === "true") return;
    detail.dataset.familyHeroSyncPending = "true";
    requestAnimationFrame(() => {
      detail.dataset.familyHeroSyncPending = "false";
      if (!detail.classList.contains("family-detail-v2")) return;
      syncHero(detail, detail.__familyData);
    });
  }

  function enhanceFamilyItem(item) {
    if (item.dataset.familyExperience) return;
    item.dataset.familyExperience = "true";
    const head = item.querySelector(".family-item-head");
    const title = head?.querySelector("b")?.textContent?.trim() || "خانواده";
    const meta = item.querySelector(":scope > p");
    const priority = head?.querySelector(".priority");
    item.dataset.priorityTone = toneForPriority(priority?.textContent || "");

    const avatar = document.createElement("span");
    avatar.className = "family-list-avatar";
    avatar.textContent = initials(title);
    avatar.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "family-list-copy";
    if (head) copy.append(head);
    if (meta) copy.append(meta);
    const row = item.closest(".family-item-row");
    if (row?.dataset.caseNumber !== undefined && meta) {
      meta.textContent = `${row.dataset.familySurname || "—"} · پرونده ${row.dataset.caseNumber}`;
      const members = document.createElement("span");
      members.className = "family-picker-members";
      members.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 2 4v2"/></svg>';
      members.append(document.createTextNode(`${fa(row.dataset.memberCount)} عضو`));
      copy.append(members);
    }
    item.setAttribute("aria-current", item.classList.contains("active") ? "true" : "false");
    item.append(avatar, copy);

    const preview = row?.querySelector(".quick-preview-btn");
    if (preview) {
      preview.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span class="quick-preview-label">نگاه سریع</span>';
    }
  }

  function enhanceFamilyList(root = document) {
    root
      .querySelectorAll?.("#familyList .family-item")
      .forEach(enhanceFamilyItem);
  }

  function maskNationalId(card) {
    if (!card || card.dataset.maskReady) return;
    const value = card.querySelector("b");
    if (!value) return;
    const raw = value.textContent.trim();
    if (!/^\d{10}$/.test(raw)) return;
    card.dataset.maskReady = "true";
    card.classList.add("family-sensitive-card");
    value.dataset.fullValue = raw;
    value.textContent = `${raw.slice(0, 3)} — •••• — ${raw.slice(-3)}`;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "family-sensitive-toggle";
    toggle.setAttribute("aria-pressed", "false");
    toggle.textContent = "نمایش";
    toggle.onclick = () => {
      const shown = toggle.getAttribute("aria-pressed") === "true";
      toggle.setAttribute("aria-pressed", String(!shown));
      toggle.textContent = shown ? "نمایش" : "پنهان";
      value.textContent = shown
        ? `${raw.slice(0, 3)} — •••• — ${raw.slice(-3)}`
        : raw;
    };
    card.append(toggle);
  }

  function linkPhone(card) {
    if (!card || card.dataset.phoneReady) return;
    const value = card.querySelector("b");
    if (!value) return;
    const phone = value.textContent.trim();
    if (!/^[+\d۰-۹٠-٩ -]{7,}$/.test(phone)) return;
    card.dataset.phoneReady = "true";
    const span = document.createElement("span");
    span.textContent = phone;
    span.className = "family-phone-link";
    span.setAttribute("aria-label", "شماره تماس");
    value.replaceWith(span);
  }

  function assignSectionIds(detail) {
    const grid = detail.querySelector(".detail-grid");
    if (grid) grid.id = "familyOverviewSection";
    const sections = [...detail.querySelectorAll(":scope > .detail-section")];
    const members = sections.find((section) =>
      section.querySelector("h3")?.textContent.includes("اعضای خانوار"),
    );
    if (members) members.id = "familyMembersSection";
    const notes = sections.find((section) =>
      section.textContent.includes("Timeline یادداشت‌ها"),
    );
    if (notes) notes.id = "familyDocumentsSection";
  }

  function createTabs(detail) {
    detail.querySelector(".family-detail-tabs")?.remove();
    const definitions = [
      ["familyOverviewSection", "خلاصه", "⌂"],
      ["familyMembersSection", "اعضا", "♙"],
      ["comprehensiveSection", "پرونده جامع", "▣"],
      ["actionSection", "اقدامات", "✓"],
      ["specialistSection", "تخصصی", "✚"],
      ["financeSection", "مالی", "▤"],
      ["familyDocumentsSection", "پیگیری و اسناد", "▤"],
    ];
    const available = definitions.filter(([id]) => detail.querySelector(`#${id}`));
    if (!available.length) return;
    const tabs = document.createElement("nav");
    tabs.className = "family-detail-tabs";
    tabs.setAttribute("aria-label", "بخش‌های پرونده خانواده");
    tabs.innerHTML = available
      .map(
        ([id, label, icon], index) => `
          <button type="button" data-family-tab="${id}" aria-current="${index === 0 ? "page" : "false"}">
            <span aria-hidden="true">${icon}</span><b>${label}</b>
          </button>
        `,
      )
      .join("");
    const progress = detail.querySelector(".ui-family-progress");
    (progress || detail.querySelector(".detail-head")).after(tabs);

    const activate = (id) => {
      tabs.querySelectorAll("[data-family-tab]").forEach((button) => {
        button.setAttribute(
          "aria-current",
          button.dataset.familyTab === id ? "page" : "false",
        );
      });
    };

    tabs.querySelectorAll("[data-family-tab]").forEach((button) => {
      button.onclick = () => {
        const target = detail.querySelector(`#${button.dataset.familyTab}`);
        if (!target) return;
        target.hidden = false;
        const toggle = target.previousElementSibling;
        if (toggle?.classList.contains("simple-section-toggle")) {
          toggle.setAttribute("aria-expanded", "true");
          const state = toggle.querySelector(".section-toggle-state");
          if (state) state.textContent = "باز است";
        }
        if (target.tagName === "DETAILS") target.open = true;
        const top =
          target.offsetTop -
          tabs.offsetHeight -
          (detail.querySelector(".ui-family-progress")?.offsetHeight ? 8 : 14);
        detail.scrollTo({
          top: Math.max(0, top),
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
        activate(button.dataset.familyTab);
      };
    });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible) activate(visible.target.id);
        },
        {
          root: detail,
          rootMargin: `-${tabs.offsetHeight + 12}px 0px -58% 0px`,
          threshold: [0.08, 0.35, 0.7],
        },
      );
      available.forEach(([id]) => {
        const target = detail.querySelector(`#${id}`);
        if (target) observer.observe(target);
      });
    }
  }

  function enhanceInfoCards(detail) {
    detail.querySelectorAll(".detail-grid .info-card").forEach((card) => {
      const label = card.querySelector("span")?.textContent.trim();
      if (label === "کد ملی فرد اصلی خانوار") maskNationalId(card);
      if (label === "شماره تماس") linkPhone(card);
    });
  }

  function enhanceMembers(detail) {
    detail.querySelectorAll(".member-card").forEach((card) => {
      if (card.classList.contains("member-empty-state") || card.dataset.memberReady) return;
      card.dataset.memberReady = "true";
      const nameNode = card.querySelector("b");
      if (!nameNode) return;
      const name = nameNode.textContent || "عضو";
      const avatar = document.createElement("span");
      avatar.className = "family-member-avatar";
      avatar.textContent = initials(name);
      avatar.setAttribute("aria-hidden", "true");
      card.prepend(avatar);
    });
  }

  function enhanceCollapsibleSections(detail) {
    // Section visibility is managed only by simplicity-layer.js.
  }

  function enhanceDetail(family) {
    const detail = document.querySelector("#familyDetail");
    if (!detail || !detail.querySelector(".detail-head")) return;
    detail.__familyData = family;
    if (detail.__familyComprehensive?.familyId !== family.id) {
      detail.__familyComprehensive = null;
    }
    detail.classList.add("family-detail-v2");
    assignSectionIds(detail);
    ensureHeroStructure(detail, family);
    enhanceInfoCards(detail);
    enhanceMembers(detail);
    createTabs(detail);
    enhanceCollapsibleSections(detail);
    scheduleHeroSync(detail);
  }

  function init() {
    enhanceFamilyList();
    const list = document.querySelector("#familyList");
    if (list)
      new MutationObserver(() => enhanceFamilyList(list)).observe(list, {
        childList: true,
        subtree: true,
      });

    window.addEventListener("familyloaded", (event) => {
      enhanceDetail(event.detail.family);
    });

    window.addEventListener("familycomprehensiveloaded", (event) => {
      const detail = document.querySelector("#familyDetail");
      if (!detail || (detail.__familyData && detail.__familyData.id !== event.detail.family.id)) return;
      detail.__familyComprehensive = {
        familyId: event.detail.family.id,
        ...event.detail.comprehensive,
      };
      detail.__familyData = event.detail.family;
      scheduleHeroSync(detail);
    });

    const detail = document.querySelector("#familyDetail");
    if (detail)
      new MutationObserver((records) => {
        if (!detail.classList.contains("family-detail-v2")) return;
        // Hero rendering changes its own descendants. Do not feed those writes
        // back into another frame indefinitely; external progress updates still sync.
        if (records.every((record) => record.target.closest?.(".family-record-head--hero"))) return;
        assignSectionIds(detail);
        enhanceMembers(detail);
        enhanceCollapsibleSections(detail);
        if (
          detail.querySelector("#familyDocumentsSection") &&
          !detail
            .querySelector(".family-detail-tabs")
            ?.querySelector('[data-family-tab="familyDocumentsSection"]')
        ) {
          createTabs(detail);
        }
        scheduleHeroSync(detail);
      }).observe(detail, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
