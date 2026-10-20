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

  function simplifySection(section, label) {
    if (!section || section.dataset.simpleSection) return;
    section.dataset.simpleSection = "true";
    const isMembers = label === "اعضای خانوار";
    if (isMembers) section.classList.add("simple-members-section");
    if (!section.id) section.id = `simple-section-${label.replace(/\s+/g, "-")}`;
    if(section.tagName === "DETAILS") section.open=true;
    section.hidden = true;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `simple-section-toggle${isMembers ? " simple-members-toggle" : ""}`;
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", section.id);
    const descriptions = {
      "اعضای خانوار":"افراد ثبت‌شده و اطلاعات هر عضو",
      "گزارش‌های سرپرستی":"برنامه ارتباط با خانواده و گزارش‌های رابط",
      "امور مالی":"درخواست‌ها، حمایت‌ها و سوابق پرداخت",
      "پرونده‌های تخصصی":"ارجاع‌ها و رسیدگی درمانی و آموزشی",
      "اطلاعات تکمیلی پرونده":"اطلاعات ثبت‌شده و موارد نیازمند تکمیل",
      "پیگیری‌ها و گزارش‌ها":"تماس‌ها، نتایج و موعد پیگیری بعدی",
      "اقدامات":"وظایف، مسئول رسیدگی و نتیجه اقدام",
      "اسناد و فایل‌ها":"مدارک و فایل‌های پیوست پرونده",
      "تیم و مسئولان پرونده":"مسئولان و دسترسی‌های مرتبط با خانواده",
    };
    const glyphs={"اعضای خانوار":'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M16 5a3 3 0 0 1 0 6M17 14c3 1 4 3 4 5"/>',"امور مالی":'<path d="m3 9 9-6 9 6M3 21h18M5 9v12M12 9v12M19 9v12"/>',"پیگیری‌ها و گزارش‌ها":'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',"پرونده‌های تخصصی":'<path d="M12 5v14M5 12h14"/>'};
    const glyph=glyphs[label]||'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>';
    const count=isMembers?(section.querySelector(":scope > .detail-section-title .count-chip")?.textContent.trim()||"۰ نفر"):"";
    button.innerHTML=`<span class="section-toggle-copy"><span class="section-toggle-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${glyph}</svg></span><span class="section-toggle-text"><small>پرونده خانواده</small><b>${label}</b><span>${descriptions[label]||"اطلاعات و سوابق این بخش"}</span></span></span><span class="section-toggle-meta">${count?`<span class="section-toggle-count">${count}</span>`:""}<span class="section-toggle-state">نمایش</span><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9 6 6 6-6"/></svg></i></span>`;
    section.classList.add("family-section-body");
    button.onclick = () => {
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      button.querySelector(".section-toggle-state").textContent = open ? "نمایش" : "باز است";
      section.hidden = open;
      if (!open) section.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    section.before(button);
  }

  function simplifyDetail() {
    const detail = document.querySelector("#familyDetail");
    if (!detail) return;
    detail.querySelector(".simple-page-guide")?.remove();
    advancedSections.forEach(([target, label]) => simplifySection(findSection(detail, target), label));
  }

  function cleanTechnicalLabels(root = document) {
    root.querySelectorAll?.(".eyebrow, .alert-center-head small, .workspace-card-kicker").forEach(node=>{
      const text=node.textContent;
      const cleaned=text.replace(/\b[A-Z]\.\d+(?:\.\d+)*\s*(?:[·:—-]\s*)?/gi, "").trim();
      if(cleaned!==text){node.textContent=cleaned;node.hidden=!cleaned;}
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
