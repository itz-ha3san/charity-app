(() => {
  const advancedSections = [
    ["comprehensiveSection", "اطلاعات تکمیلی پرونده"],
    ["teamSection", "تیم و مسئولان پرونده"],
    ["supervisionSection", "گزارش‌های سرپرستی"],
    ["specialistSection", "پرونده‌های تخصصی"],
    ["financeSection", "امور مالی"],
  ];

  function addPageGuide(root) {
    if (!root || root.querySelector(".simple-page-guide")) return;
    const head = root.querySelector(":scope > .detail-head");
    if (!head) return;
    const guide = document.createElement("div");
    guide.className = "simple-page-guide";
    guide.innerHTML = `<div><b>کار بعدی چیست؟</b><span>برای ادامه، پیگیری تازه ثبت کنید یا اقدامات پرونده را مرور کنید.</span></div><div><button type="button" data-simple-target=".followup-history">پیگیری‌ها</button><button type="button" data-simple-target="#actionSection">اقدامات</button></div>`;
    head.after(guide);
    guide.querySelectorAll("[data-simple-target]").forEach((button) => {
      button.onclick = () => document.querySelector(button.dataset.simpleTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function simplifySection(section, label) {
    if (!section || section.dataset.simpleSection) return;
    section.dataset.simpleSection = "true";
    section.hidden = true;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "simple-section-toggle";
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = `<span><b>${label}</b><small>در صورت نیاز باز کنید</small></span><i aria-hidden="true">+</i>`;
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
    advancedSections.forEach(([id, label]) => simplifySection(detail.querySelector(`#${id}`), label));
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
