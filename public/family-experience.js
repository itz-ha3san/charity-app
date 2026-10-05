(() => {
  const fa = (value) =>
    new Intl.NumberFormat("fa-IR").format(Number(value) || 0);

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
    item.append(avatar, copy);

    const row = item.closest(".family-item-row");
    const preview = row?.querySelector(".quick-preview-btn");
    if (preview) {
      preview.innerHTML =
        '<span aria-hidden="true">↗</span><span class="quick-preview-label">نگاه سریع</span>';
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

  function enhanceDetailHeader(detail, family) {
    const head = detail.querySelector(".detail-head");
    if (!head || head.dataset.familyExperience) return;
    head.dataset.familyExperience = "true";
    head.classList.add("family-record-head");
    const identity = head.firstElementChild;
    identity.classList.add("family-record-identity");
    const avatar = document.createElement("span");
    avatar.className = "family-record-avatar";
    avatar.textContent = initials(family.headName || family.familySurname);
    avatar.setAttribute("aria-hidden", "true");
    identity.prepend(avatar);

    const status = document.createElement("div");
    status.className = "family-record-status";
    status.innerHTML = `
      <span data-tone="${family.archived ? "archived" : "active"}">${family.archived ? "آرشیوشده" : "پرونده فعال"}</span>
      <small>${fa(family.members?.length || 0)} عضو ثبت‌شده</small>
    `;
    identity.append(status);

    const actions = head.querySelector(".detail-actions");
    if (actions) {
      const primary =
        actions.querySelector("#editFamilyBtn") ||
        actions.querySelector("#profileUploadBtn");
      primary?.classList.add("family-primary-action");
    }
  }

  function enhanceInfoCards(detail) {
    detail.querySelectorAll(".detail-grid .info-card").forEach((card) => {
      const label = card.querySelector("span")?.textContent.trim();
      if (label === "کد ملی سرپرست") maskNationalId(card);
      if (label === "شماره تماس") linkPhone(card);
    });
  }

  function enhanceMembers(detail) {
    detail.querySelectorAll(".member-card").forEach((card) => {
      if (card.dataset.memberReady) return;
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
    if (!detail) return;

    const sections = [
      ...detail.querySelectorAll(':scope > .detail-section, :scope > .finance-section, :scope > .full-profile'),
      ...detail.querySelectorAll('.followup-history, .case-documents-section'),
    ];

    const seen = new Set();
    sections.forEach((section) => {
      if (!section || seen.has(section) || section.dataset.collapseReady) return;
      seen.add(section);

      const head = section.querySelector(
        ':scope > .finance-head, :scope > .followup-history-head, :scope > .detail-section-title, :scope > summary'
      );
      if (!head) return;

      // Full-profile already has a native <summary>; turn it into the same visual control.
      if (head.tagName === 'SUMMARY') {
        section.dataset.collapseReady = 'true';
        section.classList.add('collapsible-detail-section');
        head.classList.add('collapsible-section-head');
        return;
      }

      section.dataset.collapseReady = 'true';
      section.classList.add('collapsible-detail-section');
      head.classList.add('collapsible-section-head');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'section-collapse-btn secondary';
      button.setAttribute('aria-expanded', 'true');
      button.innerHTML = '<span class="section-collapse-icon" aria-hidden="true">⌃</span><span class="section-collapse-label">بستن</span>';
      head.append(button);

      const setCollapsed = (closed) => {
        section.classList.toggle('is-collapsed', closed);
        button.setAttribute('aria-expanded', String(!closed));
        const label = button.querySelector('.section-collapse-label');
        if (label) label.textContent = closed ? 'باز کردن' : 'بستن';
        const icon = button.querySelector('.section-collapse-icon');
        if (icon) icon.textContent = closed ? '⌄' : '⌃';
        [...section.children]
          .filter((child) => child !== head)
          .forEach((child) => { child.hidden = closed; });
      };

      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setCollapsed(!section.classList.contains('is-collapsed'));
      };
    });
  }

  function enhanceDetail(family) {
    const detail = document.querySelector("#familyDetail");
    if (!detail || !detail.querySelector(".detail-head")) return;
    detail.classList.add("family-detail-v2");
    assignSectionIds(detail);
    enhanceDetailHeader(detail, family);
    enhanceInfoCards(detail);
    enhanceMembers(detail);
    createTabs(detail);
    enhanceCollapsibleSections(detail);
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
      setTimeout(() => enhanceDetail(event.detail.family), 0);
    });

    const detail = document.querySelector("#familyDetail");
    if (detail)
      new MutationObserver(() => {
        if (!detail.classList.contains("family-detail-v2")) return;
        assignSectionIds(detail);
        enhanceMembers(detail);
        enhanceCollapsibleSections(detail);
        if (
          detail.querySelector("#familyDocumentsSection") &&
          !detail
            .querySelector(".family-detail-tabs")
            ?.querySelector('[data-family-tab="familyDocumentsSection"]')
        )
          createTabs(detail);
      }).observe(detail, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();