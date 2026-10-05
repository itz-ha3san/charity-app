(() => {
  const fa = (value) => new Intl.NumberFormat("fa-IR").format(Number(value) || 0);
  const pad = (value) => String(value).padStart(2, "0");

  function localDateTime(days = 0, hour = 9) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function enhance(form) {
    if (!form || form.dataset.followupEnhanced) return;
    form.dataset.followupEnhanced = "true";
    const modal = form.closest(".modal");
    if (!modal) return;
    modal.classList.add("followup-modal");

    const familyName = modal.dataset.followupFamily || "خانواده انتخاب‌شده";
    const caseNumber = modal.dataset.followupCase || "—";
    const head = modal.querySelector(".modal-head");
    const title = head?.querySelector("h2");
    if (head && title) {
      const copy = document.createElement("div");
      copy.className = "followup-head-copy";
      copy.innerHTML = `<span>پیگیری پرونده</span><h2>${title.textContent}</h2><p>نتیجه تماس، بازدید یا اقدام بعدی را ثبت کنید.</p>`;
      title.replaceWith(copy);
    }

    const context = document.createElement("div");
    context.className = "followup-context";
    context.innerHTML = `
      <span class="followup-avatar">${familyName.trim().slice(0, 1) || "خ"}</span>
      <span><b>${familyName}</b><small>پرونده ${caseNumber}</small></span>
      <i>در حال ثبت پیگیری</i>
    `;
    head?.after(context);

    const text = form.elements.namedItem("text");
    const textField = text?.closest(".form-field");
    if (text && textField) {
      text.minLength = 3;
      text.maxLength = 1200;
      text.placeholder = "شرح کوتاه و روشن از نتیجه پیگیری بنویسید…";
      const tools = document.createElement("div");
      tools.className = "followup-text-tools";
      tools.innerHTML = `
        <div class="followup-templates" aria-label="الگوهای آماده">
          <button type="button" data-followup-template="تماس تلفنی انجام شد. ">تماس تلفنی</button>
          <button type="button" data-followup-template="بازدید منزل انجام شد. ">بازدید منزل</button>
          <button type="button" data-followup-template="مدارک پرونده نیازمند بررسی تکمیلی است. ">بررسی مدارک</button>
        </div>
        <small data-followup-count>۰ از ۱٬۲۰۰</small>
      `;
      textField.append(tools);
      const updateCount = () => {
        tools.querySelector("[data-followup-count]").textContent = `${fa(text.value.length)} از ۱٬۲۰۰`;
      };
      tools.querySelectorAll("[data-followup-template]").forEach((button) => {
        button.onclick = () => {
          const spacer = text.value.trim() ? "\n" : "";
          text.value = `${text.value}${spacer}${button.dataset.followupTemplate}`;
          text.dispatchEvent(new Event("input", { bubbles: true }));
          text.focus();
        };
      });
      text.addEventListener("input", updateCount);
      updateCount();
    }

    const status = form.elements.namedItem("followUpStatus");
    const statusField = status?.closest(".form-field");
    if (status && statusField) {
      status.hidden = true;
      const segment = document.createElement("div");
      segment.className = "followup-status-segment";
      segment.setAttribute("role", "radiogroup");
      [...status.options].forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = option.textContent;
        button.dataset.value = option.value;
        button.setAttribute("role", "radio");
        button.onclick = () => {
          status.value = option.value;
          status.dispatchEvent(new Event("change", { bubbles: true }));
          syncStatus();
        };
        segment.append(button);
      });
      status.after(segment);
      const syncStatus = () => {
        segment.querySelectorAll("button").forEach((button) => {
          const selected = button.dataset.value === status.value;
          button.setAttribute("aria-checked", String(selected));
          button.tabIndex = selected ? 0 : -1;
        });
        const finished = ["انجام شد", "لغو شد"].includes(status.value);
        const date = form.elements.namedItem("nextFollowUpAt");
        if (date) {
          date.disabled = finished;
          if (finished) date.value = "";
          date.closest(".form-field")?.classList.toggle("is-disabled", finished);
        }
      };
      status.addEventListener("change", syncStatus);
      syncStatus();
    }

    const date = form.elements.namedItem("nextFollowUpAt");
    const dateField = date?.closest(".form-field");
    if (date && dateField) {
      const quick = document.createElement("div");
      quick.className = "followup-date-quick";
      quick.innerHTML = `
        <button type="button" data-days="0">امروز</button>
        <button type="button" data-days="1">فردا</button>
        <button type="button" data-days="7">یک هفته بعد</button>
        <button type="button" data-clear>پاک‌کردن</button>
      `;
      dateField.append(quick);
      quick.querySelectorAll("[data-days]").forEach((button) => {
        button.onclick = () => {
          date.value = localDateTime(Number(button.dataset.days));
          date.dispatchEvent(new Event("change", { bubbles: true }));
          quick.querySelectorAll("button").forEach((item) => item.removeAttribute("aria-pressed"));
          button.setAttribute("aria-pressed", "true");
        };
      });
      quick.querySelector("[data-clear]").onclick = () => {
        date.value = "";
        quick.querySelectorAll("button").forEach((item) => item.removeAttribute("aria-pressed"));
      };
    }

    const displayStatus = form.elements.namedItem("status");
    if (displayStatus) {
      displayStatus.placeholder = "مثلاً نیازمند تماس مجدد";
      const label = displayStatus.closest(".form-field")?.querySelector("label");
      if (label) label.textContent = "عنوان کوتاه پیگیری";
    }

    const actions = form.querySelector(".modal-actions");
    actions?.classList.add("followup-actions");
    const submit = actions?.querySelector('[type="submit"]');
    if (submit) submit.textContent = "ثبت پیگیری";

    let dirty = false;
    form.addEventListener("input", () => (dirty = true));
    form.addEventListener("change", () => (dirty = true));
    modal.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener(
        "click",
        (event) => {
          if (!dirty || confirm("پیگیری هنوز ثبت نشده است. فرم بسته شود؟")) return;
          event.preventDefault();
          event.stopImmediatePropagation();
        },
        true,
      );
    });
    form.addEventListener(
      "submit",
      (event) => {
        if (!text?.value.trim() || text.value.trim().length < 3) {
          event.preventDefault();
          event.stopImmediatePropagation();
          text?.setCustomValidity("حداقل سه نویسه برای شرح پیگیری وارد کنید.");
          text?.reportValidity();
          text?.focus();
          return;
        }
        text.setCustomValidity("");
        dirty = false;
        if (submit) submit.textContent = "در حال ثبت…";
      },
      true,
    );

    requestAnimationFrame(() => text?.focus());
  }

  function init() {
    const scan = () => enhance(document.querySelector("#noteForm"));
    scan();
    const root = document.querySelector("#modalRoot");
    if (root) new MutationObserver(scan).observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
