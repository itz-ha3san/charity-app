(() => {
  const password = document.querySelector("#loginPassword");
  const toggle = document.querySelector("#toggleLoginPassword");

  if (!password || !toggle) return;

  toggle.addEventListener("click", () => {
    const shouldShow = password.type === "password";
    password.type = shouldShow ? "text" : "password";
    toggle.textContent = shouldShow ? "پنهان" : "نمایش";
    toggle.setAttribute("aria-pressed", String(shouldShow));
    password.focus();
  });
})();