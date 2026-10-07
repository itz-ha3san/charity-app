(() => {
  const advancedSections = [
    ["comprehensiveSection", "اطلاعات تکمیلی پرونده"],
    ["members", "اعضای خانوار"],
    ["actionSection", "اقدامات"],
    ["followup-history", "پیگیری‌ها و گزارش‌ها"],
    ["case-documents-section", "اسناد و فایل‌ها"],
    ["teamSection", "تیم و مسئولان پرونده"],
    ["supervisionSection", "گزارش‌های سرپرستی"],
    ["specialistSection", "پرونده‌های تخصصی"],
    ["financeSection", "امور مالی"],
  ];

  function findSection(detail, target) {
    if (target.startsWith("#")) return detail.querySelector(target);
    if (target.startsWith(".")) return detail.querySelector(target);
    const byId = detail.querySelector(`#${CSS.escape(target)}`);
    if (byId) return byId;
    if (target === "members") {
      return [...detail.querySelectorAll(":scope > .detail-section")].find((section) =>
        section.querySelector(":scope > .detail-section-title h3")?.textContent.trim() === "اعضای خانوار"
      );
    }
    return [...detail.querySelectorAll(":scope > .detail-section, :scope > .finance-section, :scope > .followup-history, :scope > .case-documents-section")].find((section) =>
      section.classList.contains(target)
    );
  }

  function addPageGuide(root) {
    if (!root || root.querySelector(".simple-page-guide")) return;
    const head = root.querySelector(":scope > .detail-head");
    if (!head) return;
    const guide = document.createElement("div");
    guide.className = "simple-page-guide";
    guide.innerHTML = `<div><b>کار بعدی چیست؟</b><span>برای ادامه، پیگیری تازه ثبت کنید یا اقدامات پرونده را مرور کنید.</span></div><div><button type="button" data-simple-target=".followup-history">پیگیری‌ها</button><button type="button" data-simple-target="#actionSection">اقدامات</button></div>`;
    head.after(guide);
    guide.querySelectorAll("[data-simple-target]").forEach((button) => {
      button.onclick = () => {const section=document.querySelector(button.dataset.simpleTarget);if(!section)return;section.hidden=false;const toggle=section.previousElementSibling;if(toggle?.classList.contains("simple-section-toggle")){toggle.setAttribute("aria-expanded","true");toggle.querySelector("i").textContent="−";}section.scrollIntoView({ behavior:"smooth",block:"start" });};
    });
  }

  function simplifySection(section, label) {
    if (!section || section.dataset.simpleSection) return;
    section.dataset.simpleSection = "true";
    const isMembers = label === "اعضای خانوار";
    if (isMembers) section.classList.add("simple-members-section");
    if (!section.id) section.id = `simple-section-${label.replace(/\s+/g, "-")}`;
    section.hidden = true;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `simple-section-toggle${isMembers ? " simple-members-toggle" : ""}`;
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", section.id);
    if (isMembers) {
      const count = section.querySelector(":scope > .detail-section-title .count-chip")?.textContent.trim() || "۰ نفر";
      button.innerHTML = `<span class="members-toggle-copy"><span class="members-toggle-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.4 2.4-5 5.5-5s5 1.6 5.5 5M16 11a3 3 0 1 0 0-6M16 14c2.2.2 3.7 1.8 4.2 4"/></svg></span><span><b>${label}</b><small>افراد ثبت‌شده در این پرونده</small></span></span><span class="members-toggle-meta"><span class="members-toggle-count">${count}</span><i aria-hidden="true">+</i></span>`;
    } else {
      button.innerHTML = `<span><b>${label}</b><small>در صورت نیاز باز کنید</small></span><i aria-hidden="true">+</i>`;
    }
    button.onclick = () => {
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      button.querySelector("i").textContent = open ? "+" : "−";
      section.hidden = open;
      if (!open) section.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    section.before(button);
  }

  function simplifyDetail() {
    const detail = document.querySelector("#familyDetail");
    if (!detail) return;
    addPageGuide(detail);
    advancedSections.forEach(([target, label]) => simplifySection(findSection(detail, target), label));
  }

  function cleanTechnicalLabels(root = document) {
    root.querySelectorAll?.(".eyebrow").forEach((node) => {
      if (/^C\.\d+/.test(node.textContent.trim())) node.textContent = "بخش تخصصی";
    });
  }

  function init() {
    document.body.classList.add("simple-mode");
    simplifyDetail();
    cleanTechnicalLabels();
    window.addEventListener("familyloaded", () => requestAnimationFrame(() => { simplifyDetail(); cleanTechnicalLabels(document.querySelector("#familyDetail")); }));
    new MutationObserver(() => { simplifyDetail(); cleanTechnicalLabels(); }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
