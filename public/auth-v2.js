(() => {
  const password = document.querySelector("#loginPassword");
  const toggle = document.querySelector("#toggleLoginPassword");

  if (!password || !toggle) return;

  const caps = document.querySelector('#loginCapsHint');
  const updateCaps = event => { if(caps)caps.hidden = !event.getModifierState?.('CapsLock'); };
  password.addEventListener('keyup', updateCaps);
  password.addEventListener('keydown', updateCaps);
  password.addEventListener('blur', () => { if(caps)caps.hidden=true; });
  toggle.addEventListener("click", () => {
    const shouldShow = password.type === "password";
    password.type = shouldShow ? "text" : "password";
    toggle.textContent = shouldShow ? "پنهان" : "نمایش";
    toggle.setAttribute("aria-pressed", String(shouldShow));
    password.focus();
  });
})();