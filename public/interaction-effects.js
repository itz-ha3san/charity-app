(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let shellEnhanced = false;

  function enhanceTabs(segment) {
    if (!segment || segment.dataset.animatedTabs) return;
    const buttons = [...segment.querySelectorAll('button[role="radio"]')];
    if (!buttons.length) return;
    segment.dataset.animatedTabs = "true";
    segment.style.setProperty("--tab-count", String(buttons.length));

    const sync = () => {
      const index = Math.max(
        0,
        buttons.findIndex((button) => button.getAttribute("aria-checked") === "true"),
      );
      segment.style.setProperty("--tab-index", String(index));
      buttons.forEach((button, i) => {
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(i === index));
        button.tabIndex = i === index ? 0 : -1;
      });
    };

    segment.setAttribute("role", "tablist");
    segment.setAttribute("aria-label", "وضعیت پرونده‌ها");
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => requestAnimationFrame(sync));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const current = buttons.indexOf(document.activeElement);
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : (current + delta + buttons.length) % buttons.length;
        buttons[next].click();
        buttons[next].focus();
      });
      button.dataset.tabIndex = String(index);
    });
    new MutationObserver(sync).observe(segment, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-checked"],
    });
    sync();
  }

  function addScrollProgress() {
    if (document.querySelector(".interaction-scroll-progress")) return;
    const root = document.createElement("div");
    root.className = "interaction-scroll-progress";
    root.setAttribute("role", "progressbar");
    root.setAttribute("aria-label", "پیشرفت صفحه");
    root.setAttribute("aria-valuemin", "0");
    root.setAttribute("aria-valuemax", "100");
    root.innerHTML = "<span></span>";
    document.body.append(root);
    let queued = false;
    const read = () => {
      queued = false;
      const max =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = max > 0 ? Math.min(1, scrollY / max) : 0;
      root.style.setProperty("--scroll-progress", String(progress));
      root.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    };
    addEventListener(
      "scroll",
      () => {
        if (!queued) {
          queued = true;
          requestAnimationFrame(read);
        }
      },
      { passive: true },
    );
    addEventListener("resize", read, { passive: true });
    read();
  }

  function enhanceReveal(root = document) {
    const candidates = root.querySelectorAll?.(
      ".workspace-metric,.workspace-focus-card,.workspace-family-card,.family-workspace",
    );
    if (!candidates?.length) return;
    const observer =
      !reduceMotion && "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("interaction-revealed");
                observer.unobserve(entry.target);
              });
            },
            { rootMargin: "0px 0px -8% 0px" },
          )
        : null;
    candidates.forEach((element, index) => {
      if (element.dataset.revealReady) return;
      element.dataset.revealReady = "true";
      element.classList.add("interaction-reveal");
      element.style.setProperty("--reveal-delay", `${Math.min(index, 4) * 55}ms`);
      if (observer) observer.observe(element);
      else element.classList.add("interaction-revealed");
    });
  }

  function enhanceMorphButton(button) {
    if (!button || button.dataset.morphReady) return;
    button.dataset.morphReady = "true";
    button.classList.add("interaction-morph-button");
    button.innerHTML = `
      <span data-phase="idle">به‌روزرسانی</span>
      <span data-phase="loading"><i class="interaction-spinner"></i>در حال دریافت…</span>
      <span data-phase="done"><i class="interaction-mini-check">✓</i>به‌روز شد</span>
    `;
    const setPhase = (phase) => {
      button.dataset.phase = phase;
      button.setAttribute("aria-busy", String(phase === "loading"));
    };
    setPhase("idle");
    button.addEventListener("click", () => {
      if (button.dataset.phase !== "idle") return;
      setPhase("loading");
      window.setTimeout(() => {
        setPhase("done");
        window.setTimeout(() => setPhase("idle"), 1800);
      }, 900);
    });
  }

  function successSvg() {
    return `
      <svg class="interaction-success-check" viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="32"></circle>
        <path d="M22 37 L32 47 L51 27"></path>
      </svg>
    `;
  }

  function enhanceSuccess(root = document) {
    root
      .querySelectorAll?.(
        ".ui-toast-card[data-variant='success']:not([data-success-ready]),.message.success:not([data-success-ready])",
      )
      .forEach((element) => {
        if (!element.textContent.trim()) return;
        element.dataset.successReady = "true";
        element.insertAdjacentHTML("afterbegin", successSvg());
      });
  }

  function syncBeam() {
    const card = document.querySelector(".workspace-focus-card");
    if (!card) return;
    const hasPriority = !!card.querySelector(".workspace-priority");
    card.classList.toggle("interaction-border-beam", hasPriority);
  }

  function enhanceShell() {
    const dashboard = document.querySelector(".workspace-dashboard");
    const sidebar = dashboard?.querySelector(".ui-sidebar");
    const segment = dashboard?.querySelector(".family-toolbar .ui-segment");
    if (!dashboard || !sidebar || !segment) return false;
    if (!shellEnhanced) {
      shellEnhanced = true;
      addScrollProgress();
      enhanceMorphButton(document.querySelector("#refreshBtn"));
    }
    enhanceTabs(segment);
    enhanceReveal(dashboard);
    enhanceSuccess(dashboard);
    syncBeam();
    return true;
  }

  function init() {
    enhanceShell();
    const observer = new MutationObserver((records) => {
      enhanceShell();
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          enhanceReveal(node);
          enhanceSuccess(node);
        }),
      );
      syncBeam();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
