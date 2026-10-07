(() => {
  const key = "charity-theme";
  const root = document.documentElement;
  const validThemes = ["light", "dark"];
  let preference = "light";

  try {
    const saved = localStorage.getItem(key);
    const legacy = localStorage.getItem("c14-theme");
    preference = validThemes.includes(saved)
      ? saved
      : validThemes.includes(legacy)
        ? legacy
        : "light";
    localStorage.setItem(key, preference);
    localStorage.removeItem("c14-theme");
  } catch {}

  const applyTheme = () => {
    root.dataset.theme = preference;
    root.style.colorScheme = preference;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.content = preference === "dark" ? "#101722" : "#f5f7fb";
    }
  };

  const icons = {
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.4A8.5 8.5 0 0 1 8.6 3.6 8.5 8.5 0 1 0 20.4 15.4Z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>',
  };

  applyTheme();

  const init = () => {
    const header = document.querySelector(".topbar");
    if (!header || document.querySelector("#themeToggle")) return;
    const actionArea = header.querySelector(".topbar-actions") || header;

    const box = document.createElement("div");
    box.className = "theme-switcher";
    box.innerHTML =
      '<button class="theme-toggle" id="themeToggle" type="button" aria-pressed="false"></button>';
    actionArea.append(box);

    const button = box.querySelector("button");
    const syncButton = () => {
      const isDark = preference === "dark";
      button.innerHTML = isDark ? icons.sun : icons.moon;
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute(
        "aria-label",
        isDark ? "فعال‌کردن تم روشن" : "فعال‌کردن تم تیره",
      );
      button.title = isDark ? "تم روشن" : "تم تیره";
    };

    button.addEventListener("click", () => {
      preference = preference === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(key, preference);
      } catch {}
      applyTheme();
      syncButton();
    });
    syncButton();
    applyTheme();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();