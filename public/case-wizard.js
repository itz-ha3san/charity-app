(() => {
  const draftKey = "family-case-create-draft-v1";
  let activeState = null;

  const fa = (value) =>
    new Intl.NumberFormat("fa-IR").format(Number(value) || 0);

  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  const toEnglishDigits = (value) =>
    String(value ?? "")
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

  const onlyDigits = (value) => toEnglishDigits(value).replace(/\D/g, "");

  function validNationalId(value) {
    const id = onlyDigits(value);
    if (!/^\d{10}$/.test(id) || /^(\d)\1{9}$/.test(id)) return false;
    const remainder =
      id
        .slice(0, 9)
        .split("")
        .reduce((sum, digit, index) => sum + Number(digit) * (10 - index), 0) %
      11;
    const control = Number(id[9]);
    return remainder < 2 ? control === remainder : control === 11 - remainder;
  }

  function validJalaliDate(value) {
    if (!value) return true;
    const match = toEnglishDigits(value).match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!match) return false;
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (year < 1200 || year > 1500 || month < 1 || month > 12 || day < 1)
      return false;
    return day <= (month <= 6 ? 31 : month <= 11 ? 30 : 30);
  }

  function formatJalaliDate(value) {
    const digits = onlyDigits(value).slice(0, 8);
    return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)]
      .filter(Boolean)
      .join("/");
  }

  function formatMoney(value) {
    const digits = onlyDigits(value).replace(/^0+(?=\d)/, "");
    return digits ? new Intl.NumberFormat("en-US").format(Number(digits)) : "";
  }

  function ensureMessage(control) {
    const wrapper = control.closest(".form-field");
    if (!wrapper) return null;
    let message = wrapper.querySelector(
      `.case-field-message[data-for="${control.name}"]`,
    );
    if (!message) {
      message = document.createElement("small");
      message.className = "case-field-message";
      message.dataset.for = control.name;
      message.setAttribute("aria-live", "polite");
      wrapper.append(message);
    }
    const id = `${control.name}-${Math.random().toString(36).slice(2, 8)}-help`;
    message.id ||= id;
    control.setAttribute("aria-describedby", message.id);
    return message;
  }

  function setFieldState(control, message = "", valid = false) {
    const wrapper = control.closest(".form-field");
    const output = ensureMessage(control);
    if (!wrapper || !output) return;
    wrapper.classList.toggle("case-field-has-error", Boolean(message));
    wrapper.classList.toggle(
      "case-field-is-valid",
      !message && valid && Boolean(String(control.value).trim()),
    );
    control.classList.toggle("case-field-invalid", Boolean(message));
    control.setAttribute("aria-invalid", message ? "true" : "false");
    if (output.textContent !== message) output.textContent = message;
  }

  function validateUniqueNationalIds(form) {
    const controls = [
      form.elements.namedItem("headNationalId"),
      ...form.querySelectorAll('[name="memberNationalId"]'),
    ].filter(Boolean);
    controls.forEach((control) => {
      if (control.validationMessage === "کد ملی در همین پرونده تکراری است.") {
        control.setCustomValidity("");
        setFieldState(control, "", validNationalId(control.value));
      }
    });
    const counts = new Map();
    controls.forEach((control) => {
      const value = onlyDigits(control.value);
      if (value.length === 10) counts.set(value, (counts.get(value) || 0) + 1);
    });
    controls.forEach((control) => {
      const value = onlyDigits(control.value);
      if (value.length === 10 && counts.get(value) > 1) {
        control.setCustomValidity("کد ملی در همین پرونده تکراری است.");
        setFieldState(control, "این کد ملی برای فرد دیگری در فرم وارد شده است.");
      }
    });
  }

  function validateControl(control, form, { quiet = false } = {}) {
    const value = String(control.value || "").trim();
    let message = "";
    if (control.required && !value) message = "تکمیل این فیلد الزامی است.";
    else if (
      ["headNationalId", "memberNationalId"].includes(control.name) &&
      value &&
      !validNationalId(value)
    )
      message = "کد ملی واردشده معتبر نیست.";
    else if (
      control.name === "headPhone" &&
      value &&
      !/^09\d{9}$/.test(toEnglishDigits(value))
    )
      message = "شماره موبایل را با ۰۹ و ۱۱ رقم وارد کنید.";
    else if (
      control.name === "familyPhone" &&
      value &&
      !/^0\d{10}$/.test(toEnglishDigits(value))
    )
      message = "شماره تلفن باید با صفر و دقیقاً ۱۱ رقم باشد.";
    else if (
      control.name === "headCardNumber" &&
      value &&
      onlyDigits(value).length !== 16
    )
      message = "شماره کارت باید دقیقاً ۱۶ رقم باشد.";
    else if (
      ["headBirthDate", "memberBirthDate"].includes(control.name) &&
      value &&
      !validJalaliDate(value)
    )
      message = "تاریخ شمسی را به‌شکل ۱۴۰۰/۰۱/۰۱ وارد کنید.";
    else if (value && ["familySurname","headName","memberName"].includes(control.name) && !/^[\p{L}\p{M}\s\u200c'’.-]+$/u.test(value))
      message = "نام فقط می‌تواند شامل حروف باشد.";
    else if (value && ["headEducation","headJob","memberEducation","memberJob"].includes(control.name) && /\p{N}/u.test(value))
      message = "در این فیلد عدد وارد نکنید.";
    else if (value && control.name === "caseNumber" && !/^[1-9]\d{0,2}$/.test(toEnglishDigits(value)))
      message = "شماره پرونده باید از ۱ تا ۹۹۹ باشد.";
    else if (control.maxLength > 0 && value.length > control.maxLength)
      message = `حداکثر ${fa(control.maxLength)} نویسه مجاز است.`;
    else if (control.minLength > 0 && value && value.length < control.minLength)
      message = `حداقل ${fa(control.minLength)} نویسه وارد کنید.`;

    control.setCustomValidity(message);
    setFieldState(control, message, !message);
    if (!message && ["headNationalId", "memberNationalId"].includes(control.name))
      validateUniqueNationalIds(form);
    return !message;
  }

  function configureValidation(form) {
    const configure = (control) => {
      if (!control?.name || control.dataset.caseValidation) return;
      control.dataset.caseValidation = "true";
      ensureMessage(control);
      if(control.name === "caseNumber") control.addEventListener("input",()=>{control.value=toEnglishDigits(control.value);validateControl(control,form)});

      if (
        [
          "headNationalId",
          "memberNationalId",
          "headPhone",
          "familyPhone",
          "headCardNumber",
        ].includes(control.name)
      ) {
        control.inputMode = control.name.includes("Phone") ? "tel" : "numeric";
        control.addEventListener("input", () => {
          const limit = control.name === "headCardNumber" ? 16 : 11;
          const normalized = onlyDigits(control.value).slice(0, limit);
          control.value =
            control.name === "headCardNumber"
              ? normalized.replace(/(\d{4})(?=\d)/g, "$1 ")
              : normalized;
          validateControl(control, form, { quiet: true });
        });
      }

      if (["headBirthDate", "memberBirthDate"].includes(control.name)) {
        control.inputMode = "numeric";
        control.maxLength = 10;
        control.addEventListener("input", () => {
          control.value = formatJalaliDate(control.value);
          validateControl(control, form, { quiet: true });
        });
      }

      if (["housingDeposit", "housingRent"].includes(control.name)) {
        control.type = "text";
        control.inputMode = "numeric";
        control.autocomplete = "off";
        control.addEventListener("focus", () => {
          control.value = onlyDigits(control.value);
        });
        control.addEventListener("input", () => {
          control.value = onlyDigits(control.value).slice(0, 15);
        });
        control.addEventListener("blur", () => {
          control.value = formatMoney(control.value);
          validateControl(control, form);
        });
        if (control.value) control.value = formatMoney(control.value);
      }

      control.addEventListener("blur", () => validateControl(control, form));
      control.addEventListener("change", () => validateControl(control, form));
      control.addEventListener("input", () => {
        validateControl(control, form, { quiet: true });
      });
    };

    form.querySelectorAll("input,select,textarea").forEach(configure);
    const type = form.elements.namedItem("housingType");
    const syncHousing=()=>{const owned=["owned","owner","ملکی"].includes(type?.value);["housingDeposit","housingRent"].forEach(name=>{const c=form.elements.namedItem(name);if(!c)return;c.closest(".form-field").hidden=owned;c.disabled=owned;if(owned){c.value="0";c.setCustomValidity("");setFieldState(c,"",false)}})};
    type?.addEventListener("change",syncHousing);syncHousing();
    const members = form.querySelector("#memberEditors");
    if (members)
      new MutationObserver(() => {
        members.querySelectorAll("input,select,textarea").forEach(configure);
        validateUniqueNationalIds(form);
      }).observe(members, { childList: true });
  }

  function normalizeFormValues(form) {
    [
      "headNationalId",
      "headPhone",
      "familyPhone",
      "headCardNumber",
      "headBirthDate",
      "housingDeposit",
      "housingRent",
    ].forEach((name) => {
      const control = form.elements.namedItem(name);
      if (!control || control instanceof RadioNodeList) return;
      if (["housingDeposit", "housingRent"].includes(name))
        control.value = onlyDigits(control.value) || "0";
      else if (name === "headBirthDate")
        control.value = formatJalaliDate(control.value);
      else control.value = onlyDigits(control.value);
    });
    form.querySelectorAll('[name="memberNationalId"]').forEach((control) => {
      control.value = onlyDigits(control.value);
    });
    form.querySelectorAll('[name="memberBirthDate"]').forEach((control) => {
      control.value = formatJalaliDate(control.value);
    });
  }

  async function checkCaseNumber(form, originalValue = "") {
    const control = form.elements.namedItem("caseNumber");
    if (!control || !String(control.value).trim()) return true;
    const value = toEnglishDigits(control.value).trim();
    control.value = value;
    if (value === originalValue) return true;
    const output = ensureMessage(control);
    control.closest(".form-field")?.classList.add("case-field-is-checking");
    if (output) output.textContent = "در حال بررسی شماره پرونده…";
    try {
      const params = new URLSearchParams({
        search: value,
        status: "all",
        limit: "100",
      });
      const response = await fetch(`/api/families?${params}`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (output) output.textContent = "";
        return true;
      }
      const data = await response.json();
      const duplicate = (data.families || []).some(
        (family) => String(family.caseNumber).trim() === value,
      );
      const message = duplicate
        ? "این شماره پرونده قبلاً در سامانه ثبت شده است."
        : "";
      control.setCustomValidity(message);
      setFieldState(control, message, !message);
      return !duplicate;
    } catch {
      if (output) output.textContent = "";
      return true;
    } finally {
      control.closest(".form-field")?.classList.remove("case-field-is-checking");
    }
  }

  function serverErrorMessage(error) {
    const code = error?.data?.error;
    if (code === "DUPLICATE_VALUE") {
      const conflicts = error.data?.conflicts || [];
      const hasCase = conflicts.some((item) => item.type === "caseNumber");
      return hasCase
        ? "شماره پرونده قبلاً ثبت شده است."
        : "یکی از کدهای ملی قبلاً در سامانه ثبت شده است.";
    }
    const issue = error?.data?.issues?.[0];
    if (issue?.message === "INVALID_NATIONAL_ID")
      return "کد ملی واردشده معتبر نیست.";
    return issue?.message || error?.message || "ثبت اطلاعات انجام نشد.";
  }

  const relationOptions = [
    ["", "انتخاب نسبت"],
    ["همسر", "همسر"],
    ["فرزند", "فرزند"],
    ["پدر", "پدر"],
    ["مادر", "مادر"],
    ["خواهر", "خواهر"],
    ["برادر", "برادر"],
    ["نوه", "نوه"],
    ["سایر", "سایر"],
  ];

  function approximateAge(value) {
    const year = Number(toEnglishDigits(value).slice(0, 4));
    if (!year || year < 1200 || year > 1500) return "";
    const currentYear = Number(
      new Intl.DateTimeFormat("en-US-u-ca-persian", {
        year: "numeric",
      }).format(new Date()),
    );
    const age = currentYear - year;
    return age >= 0 && age <= 130 ? `${fa(age)} ساله` : "";
  }

  function memberIsComplete(row) {
    const name = row.querySelector('[name="memberName"]')?.value.trim();
    const nationalId = row.querySelector('[name="memberNationalId"]');
    const normalizedId = onlyDigits(nationalId?.value || "");
    const form = row.closest("form");
    const duplicateCount = form
      ? [
          form.elements.namedItem("headNationalId"),
          ...form.querySelectorAll('[name="memberNationalId"]'),
        ].filter(
          (control) => control && onlyDigits(control.value) === normalizedId,
        ).length
      : 0;
    return Boolean(
      name &&
        name.length >= 2 &&
        nationalId &&
        validNationalId(nationalId.value) &&
        nationalId.checkValidity() &&
        duplicateCount === 1,
    );
  }

  function updateMemberCard(row) {
    const name =
      row.querySelector('[name="memberName"]')?.value.trim() || "عضو بدون نام";
    const relation =
      row.querySelector('[name="memberRelation"]')?.value.trim() ||
      "نسبت ثبت نشده";
    const age = approximateAge(
      row.querySelector('[name="memberBirthDate"]')?.value || "",
    );
    const complete = memberIsComplete(row);
    row.dataset.complete = String(complete);
    const title = row.querySelector("[data-member-title]");
    const meta = row.querySelector("[data-member-meta]");
    const badge = row.querySelector("[data-member-status]");
    if (title) title.textContent = name;
    if (meta)
      meta.textContent = [relation, age].filter(Boolean).join(" · ") || relation;
    if (badge) {
      badge.textContent = complete ? "کامل" : "ناقص";
      badge.dataset.complete = String(complete);
    }
  }

  function updateMembersOverview(step) {
    const rows = [...step.querySelectorAll("[data-member]")];
    const complete = rows.filter((row) => memberIsComplete(row)).length;
    const overview = step.querySelector("[data-members-overview]");
    if (!overview) return;
    overview.innerHTML = `
      <span><b>${fa(rows.length)}</b> عضو ثبت‌شده</span>
      <span data-state="complete"><b>${fa(complete)}</b> کامل</span>
      <span data-state="incomplete"><b>${fa(rows.length - complete)}</b> نیازمند تکمیل</span>
    `;
  }

  function enhanceMemberCard(row, form, step) {
    if (row.dataset.memberEnhanced) return;
    row.dataset.memberEnhanced = "true";
    const header = row.querySelector(".member-editor-head");
    const grid = row.querySelector(":scope > .form-grid");
    const remove = row.querySelector("[data-remove-member]");
    if (!header || !grid || !remove) return;

    const relationInput = row.querySelector('[name="memberRelation"]');
    if (relationInput?.tagName === "INPUT") {
      const select = document.createElement("select");
      select.name = relationInput.name;
      const currentRelation = relationInput.value.trim();
      const options = relationOptions.some(([value]) => value === currentRelation)
        ? relationOptions
        : [...relationOptions, [currentRelation, currentRelation]];
      select.innerHTML = options
        .map(
          ([value, label]) =>
            `<option value="${escapeHtml(value)}" ${value === currentRelation ? "selected" : ""}>${escapeHtml(label)}</option>`,
        )
        .join("");
      relationInput.replaceWith(select);
    }

    const body = document.createElement("div");
    body.className = "case-member-body";
    grid.before(body);
    body.append(grid);

    const summary = document.createElement("div");
    summary.className = "case-member-summary";
    summary.innerHTML = `
      <span class="case-member-index" data-member-number></span>
      <span class="case-member-copy">
        <b data-member-title>عضو بدون نام</b>
        <small data-member-meta>نسبت ثبت نشده</small>
      </span>
      <span class="case-member-status" data-member-status data-complete="false">ناقص</span>
    `;
    const actions = document.createElement("div");
    actions.className = "case-member-actions";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "case-member-toggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "جمع‌کردن اطلاعات عضو");
    toggle.textContent = "−";
    remove.textContent = "حذف";
    actions.append(toggle, remove);
    header.replaceChildren(summary, actions);

    toggle.onclick = () => {
      const collapsed = row.classList.toggle("is-collapsed");
      body.hidden = collapsed;
      toggle.textContent = collapsed ? "+" : "−";
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute(
        "aria-label",
        collapsed ? "بازکردن اطلاعات عضو" : "جمع‌کردن اطلاعات عضو",
      );
    };

    remove.addEventListener(
      "click",
      (event) => {
        const hasData = [...row.querySelectorAll("input,select,textarea")].some(
          (control) => String(control.value || "").trim(),
        );
        if (
          hasData &&
          !confirm("اطلاعات این عضو حذف می‌شود. آیا مطمئن هستید؟")
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );

    const refresh = () => {
      updateMemberCard(row);
      updateMembersOverview(step);
    };
    row.addEventListener("input", refresh);
    row.addEventListener("change", refresh);
    refresh();
    form.querySelectorAll("[data-member-number]").forEach((item, index) => {
      item.textContent = fa(index + 1);
    });
  }

  function setupMemberExperience(step, form) {
    const box = step.querySelector("#memberEditors");
    const title = step.querySelector(".detail-section-title");
    const add = step.querySelector("#addMemberBtn");
    if (!box || !title || !add) return;
    add.textContent = "+ افزودن عضو";
    add.classList.add("case-add-member");

    const overview = document.createElement("div");
    overview.className = "case-members-overview";
    overview.dataset.membersOverview = "true";
    title.after(overview);

    const scan = () => {
      box
        .querySelectorAll("[data-member]")
        .forEach((row) => enhanceMemberCard(row, form, step));
      form.querySelectorAll("[data-member-number]").forEach((item, index) => {
        item.textContent = fa(index + 1);
      });
      updateMembersOverview(step);
    };
    scan();
    new MutationObserver(scan).observe(box, { childList: true });
    form.addEventListener("input", (event) => {
      if (event.target?.name === "headNationalId") {
        box.querySelectorAll("[data-member]").forEach(updateMemberCard);
        updateMembersOverview(step);
      }
    });
  }

  function makeStep(title, description) {
    const section = document.createElement("section");
    section.className = "case-wizard-step";
    section.innerHTML = `
      <header class="case-step-head">
        <div><h3>${title}</h3><p>${description}</p></div>
      </header>
      <div class="form-grid"></div>
    `;
    return section;
  }

  function field(form, name) {
    return form.elements.namedItem(name)?.closest(".form-field") || null;
  }

  function moveFields(form, step, names) {
    const grid = step.querySelector(".form-grid");
    names.forEach((name) => {
      const wrapper = field(form, name);
      if (wrapper) grid.append(wrapper);
    });
  }

  function serializeDraft(form) {
    return {
      savedAt: new Date().toISOString(),
      entries: [...new FormData(form).entries()]
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value]),
    };
  }

  function saveDraft(form) {
    try {
      localStorage.setItem(draftKey, JSON.stringify(serializeDraft(form)));
      return true;
    } catch {
      return false;
    }
  }

  function readDraft() {
    try {
      const value = JSON.parse(localStorage.getItem(draftKey) || "null");
      return value?.entries?.length ? value : null;
    } catch {
      return null;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
  }

  function restoreDraft(form, draft) {
    const grouped = new Map();
    draft.entries.forEach(([key, value]) => {
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(value);
    });
    const memberCount = grouped.get("memberName")?.length || 0;
    const box = form.querySelector("#memberEditors");
    while (box?.querySelectorAll("[data-member]").length < memberCount)
      form.querySelector("#addMemberBtn")?.click();

    grouped.forEach((values, name) => {
      const controls = [...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
      controls.forEach((control, index) => {
        if (control.type === "checkbox") control.checked = values[index] === "on";
        else control.value = values[index] ?? values[0] ?? "";
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  function validateStep(step) {
    const form = step.closest("form");
    step
      .querySelectorAll("input,select,textarea")
      .forEach((control) => validateControl(control, form));
    validateUniqueNationalIds(form);
    const invalid = [...step.querySelectorAll("input,select,textarea")].find(
      (control) => !control.checkValidity(),
    );
    step
      .querySelectorAll(".case-field-invalid")
      .forEach((control) => control.classList.remove("case-field-invalid"));
    if (!invalid) return true;
    const memberCard = invalid.closest("[data-member]");
    if (memberCard?.classList.contains("is-collapsed")) {
      memberCard.classList.remove("is-collapsed");
      const body = memberCard.querySelector(".case-member-body");
      const toggle = memberCard.querySelector(".case-member-toggle");
      if (body) body.hidden = false;
      if (toggle) {
        toggle.textContent = "−";
        toggle.setAttribute("aria-expanded", "true");
      }
    }
    invalid.classList.add("case-field-invalid");
    setFieldState(
      invalid,
      invalid.validationMessage || "مقدار این فیلد را بررسی کنید.",
    );
    invalid.focus();
    invalid.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  function completion(form) {
    const controls = [
      ...form.querySelectorAll(
        ".case-wizard-step input:not([type=hidden]),.case-wizard-step select,.case-wizard-step textarea",
      ),
    ].filter((control) => !control.disabled);
    if (!controls.length) return 0;
    const filled = controls.filter((control) =>
      control.type === "checkbox" ? control.checked : String(control.value).trim(),
    ).length;
    return Math.round((filled / controls.length) * 100);
  }

  function reviewValue(form, name, fallback = "ثبت نشده") {
    const control = form.elements.namedItem(name);
    if (!control || Array.isArray(control)) return fallback;
    const value = String(control.value || "").trim();
    if (!value) return fallback;
    if (control.tagName === "SELECT")
      return control.selectedOptions[0]?.textContent || value;
    return value;
  }

  function renderReview(form, root) {
    const members = form.querySelectorAll("[data-member]").length;
    const required = [...form.querySelectorAll("[required]")];
    const missing = required.filter((control) => !control.checkValidity()).length;
    const card = (label, value) =>
      `<div class="case-review-card"><span>${label}</span><b>${escapeHtml(value)}</b></div>`;
    root.innerHTML = `
      <div class="case-review-status" data-ready="${missing === 0}">
        <span>${missing === 0 ? "✓" : "!"}</span>
        <div><b>${missing === 0 ? "آماده ثبت نهایی" : `${fa(missing)} مورد الزامی ناقص است`}</b><small>${missing === 0 ? "اطلاعات اصلی پرونده تکمیل شده است." : "به مرحله مربوط برگردید و موارد مشخص‌شده را کامل کنید."}</small></div>
      </div>
      <div class="case-review-grid">
        ${card("شماره پرونده", reviewValue(form, "caseNumber"))}
        ${card("سرپرست", reviewValue(form, "headName"))}
        ${card("نام خانوادگی", reviewValue(form, "familySurname"))}
        ${card("شماره تماس", reviewValue(form, "headPhone"))}
        ${card("اولویت", reviewValue(form, "priority"))}
        ${card("نوع مسکن", reviewValue(form, "housingType"))}
        ${card("اعضای ثبت‌شده", `${fa(members)} نفر`)}
        ${card("نشانی", reviewValue(form, "address"))}
      </div>
    `;
  }

  function enhanceWizard(form) {
    if (!form || form.dataset.caseWizard) return;
    form.dataset.caseWizard = "true";
    const modal = form.closest(".create-modal");
    if (!modal) return;
    modal.classList.add("case-wizard-modal");
    const editing = document.querySelector("#createTitle")?.textContent.includes("ویرایش");
    const modalEyebrow = modal.querySelector(".modal-head .eyebrow");
    if (modalEyebrow)
      modalEyebrow.textContent = editing
        ? "ویرایش مرحله‌ای پرونده"
        : "تشکیل پرونده خانواده";

    const sections = [...form.querySelectorAll(":scope > .form-section")];
    if (sections.length < 4) return;
    const [main, housing, members, notes] = sections;

    const identity = makeStep(
      "هویت و اطلاعات تماس",
      "مشخصات پایه سرپرست و راه‌های ارتباطی خانواده",
    );
    moveFields(form, identity, [
      "caseNumber",
      "supervisorId",
      "familySurname",
      "headName",
      "headNationalId",
      "headBirthDate",
      "headPhone",
      "familyPhone",
    ]);

    const status = makeStep(
      "وضعیت پرونده",
      "اطلاعات کاری، تحصیلی و اولویت رسیدگی",
    );
    moveFields(form, status, [
      "headCardNumber",
      "headJob",
      "headEducation",
      "priority",
    ]);
    const extra = makeStep(
      "اطلاعات تکمیلی و موارد ناقص",
      "اطلاعاتی که در تکمیل پرونده لازم است؛ از جمله بیمه، درمان، درآمد و هزینه‌ها",
    );
    moveFields(form, extra, [
      "insuranceType",
      "insuranceCost",
      "insuranceRenewalDate",
      "medicalHasCondition",
      "medicalDescription",
      "medicalMonthlyCost",
      "incomeDescription",
      "debtAmount",
      "debtReason",
      "transportationCost",
      "utilityCost",
      "monthlyInstallments",
      "monthlyAid",
      "sponsor",
      "nextFollowUp",
    ]);
    const extraGrid = extra.querySelector(".form-grid");
    extraGrid.insertAdjacentHTML(
      "afterbegin",
      '<div class="case-missing-info-hint full"><b>تکمیل موارد ناقص</b><p>اگر در صفحه پرونده موردی به‌عنوان ناقص نمایش داده شد، همین‌جا می‌توانید آن را ثبت یا اصلاح کنید.</p></div>',
    );

    main.before(identity, status, extra);
    main.remove();

    housing.classList.add("case-wizard-step");
    const housingTitle = housing.querySelector("h3");
    housingTitle.textContent = "مسکن و نشانی";
    housingTitle.insertAdjacentHTML(
      "afterend",
      '<p class="case-step-description">شرایط سکونت و هزینه‌های اصلی مسکن</p>',
    );
    members.classList.add("case-wizard-step");
    const memberDescription = members.querySelector(".form-help");
    if (memberDescription)
      memberDescription.textContent =
        "اعضای خانواده را اضافه کنید؛ بعداً نیز قابل ویرایش هستند.";
    setupMemberExperience(members, form);

    const final = makeStep(
      editing ? "مرور تغییرات" : "یادداشت و مرور نهایی",
      "اطلاعات را کنترل و برای ثبت نهایی تأیید کنید",
    );
    if (!notes.classList.contains("hidden")) {
      [...notes.children].forEach((child) => {
        if (child.matches("h3")) return;
        final.append(child);
      });
    }
    notes.remove();
    const review = document.createElement("div");
    review.className = "case-review";
    final.append(review);

    const error = form.querySelector("#createError");
    error.before(final);
    const steps = [identity, status, extra, housing, members, final];
    steps.forEach((step, index) => {
      step.dataset.step = String(index);
      step.hidden = index !== 0;
    });

    const labels = [
      ["اطلاعات پایه", "هویت"],
      ["وضعیت پرونده", "شغل و اولویت"],
      ["اطلاعات تکمیلی", "بیمه و هزینه‌ها"],
      ["مسکن", "هزینه و نشانی"],
      ["اعضای خانواده", "ترکیب خانوار"],
      ["مرور نهایی", "تأیید و ثبت"],
    ];
    const shell = document.createElement("div");
    shell.className = "case-wizard-shell";
    shell.innerHTML = `
      <div class="case-wizard-progress"><span></span></div>
      <ol class="case-wizard-nav">
        ${labels
          .map(
            ([title, hint], index) => `
              <li data-step-state="${index === 0 ? "active" : "pending"}">
                <button type="button" data-go-step="${index}" ${index ? "disabled" : ""}>
                  <span>${fa(index + 1)}</span><b>${title}</b><small>${hint}</small>
                </button>
              </li>
            `,
          )
          .join("")}
      </ol>
      <div class="case-wizard-meta"><span data-step-label>مرحله ۱ از ۵</span><span data-completion>۰٪ تکمیل</span></div>
    `;
    form.before(shell);

    const oldActions = form.querySelector(".modal-actions");
    const submit = oldActions.querySelector("#submitFamily");
    const cancel = oldActions.querySelector("[data-close]");
    submit.remove();
    cancel.remove();
    oldActions.remove();

    const actions = document.createElement("div");
    actions.className = "case-wizard-actions";
    actions.innerHTML = `
      <button type="button" class="secondary" data-wizard-prev>مرحله قبل</button>
      <div class="case-wizard-action-spacer"></div>
      ${editing ? "" : '<button type="button" class="case-draft-button" data-save-draft>ذخیره پیش‌نویس</button>'}
      <button type="button" class="primary" data-wizard-next>ادامه</button>
    `;
    actions.append(submit, cancel);
    form.append(actions);
    submit.classList.add("case-final-submit");
    submit.hidden = true;
    cancel.classList.add("case-cancel");

    let current = 0;
    let maxVisited = 0;
    let dirty = false;
    let autosaveTimer;
    const originalCaseNumber = String(
      form.elements.namedItem("caseNumber")?.value || "",
    ).trim();
    activeState = {
      form,
      set dirty(value) {
        dirty = value;
      },
    };

    const navItems = [...shell.querySelectorAll(".case-wizard-nav li")];
    const progress = shell.querySelector(".case-wizard-progress span");
    const stepLabel = shell.querySelector("[data-step-label]");
    const completionLabel = shell.querySelector("[data-completion]");
    const prev = actions.querySelector("[data-wizard-prev]");
    const next = actions.querySelector("[data-wizard-next]");
    const draftButton = actions.querySelector("[data-save-draft]");
    configureValidation(form);

    const caseNumber = form.elements.namedItem("caseNumber");
    caseNumber?.addEventListener("blur", () =>
      checkCaseNumber(form, originalCaseNumber),
    );

    const updateCompletion = () => {
      const value = completion(form);
      completionLabel.textContent = `${fa(value)}٪ تکمیل`;
    };

    const show = (index, focus = true) => {
      current = Math.max(0, Math.min(steps.length - 1, index));
      maxVisited = Math.max(maxVisited, current);
      steps.forEach((step, i) => (step.hidden = i !== current));
      navItems.forEach((item, i) => {
        item.dataset.stepState =
          i < current ? "done" : i === current ? "active" : "pending";
        const button = item.querySelector("button");
        button.disabled = i > maxVisited;
        button.setAttribute("aria-current", i === current ? "step" : "false");
      });
      progress.style.width = `${(current / (steps.length - 1)) * 100}%`;
      stepLabel.textContent = `مرحله ${fa(current + 1)} از ${fa(steps.length)}`;
      prev.hidden = current === 0;
      next.hidden = current === steps.length - 1;
      submit.hidden = current !== steps.length - 1;
      if (current === steps.length - 1) renderReview(form, review);
      updateCompletion();
      requestAnimationFrame(() => {
        navItems[current]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      });
      if (focus)
        modal.querySelector(".case-wizard-shell")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    };
    activeState.show = show;
    activeState.steps = steps;

    prev.onclick = () => show(current - 1);
    next.onclick = async () => {
      if (!validateStep(steps[current])) return;
      if (current === 0 && !(await checkCaseNumber(form, originalCaseNumber))) {
        caseNumber?.focus();
        return;
      }
      show(current + 1);
    };
    shell.querySelectorAll("[data-go-step]").forEach((button) => {
      button.onclick = () => {
        const target = Number(button.dataset.goStep);
        if (target <= maxVisited) show(target);
      };
    });

    form.addEventListener(
      "submit",
      (event) => {
        normalizeFormValues(form);
        if (current < steps.length - 1) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (validateStep(steps[current])) show(current + 1);
          return;
        }
        const invalid = [...form.querySelectorAll("[required]")].find(
          (control) => !control.checkValidity(),
        );
        if (invalid) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const index = steps.findIndex((step) => step.contains(invalid));
          show(index < 0 ? 0 : index);
          invalid.reportValidity();
          invalid.focus();
        }
      },
      true,
    );

    form.addEventListener("input", () => {
      dirty = true;
      updateCompletion();
      if (!editing) {
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => saveDraft(form), 700);
      }
    });
    form.addEventListener("change", updateCompletion);

    if (draftButton)
      draftButton.onclick = () => {
        const saved = saveDraft(form);
        draftButton.textContent = saved ? "پیش‌نویس ذخیره شد ✓" : "ذخیره ممکن نشد";
        setTimeout(() => (draftButton.textContent = "ذخیره پیش‌نویس"), 1800);
        dirty = false;
      };

    const guardClose = (event) => {
      if (!dirty) return;
      if (
        !confirm(
          "تغییرات ذخیره‌نشده دارید. آیا مطمئن هستید که می‌خواهید فرم را ببندید؟",
        )
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else {
        dirty = false;
        removeEventListener("beforeunload", beforeUnload);
      }
    };
    modal
      .querySelectorAll("[data-close]")
      .forEach((button) => button.addEventListener("click", guardClose, true));

    const beforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    addEventListener("beforeunload", beforeUnload);

    if (!editing) {
      const draft = readDraft();
      if (draft) {
        const notice = document.createElement("div");
        notice.className = "case-draft-notice";
        notice.innerHTML = `
          <div><b>پیش‌نویس قبلی موجود است</b><small>ذخیره‌شده در ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(draft.savedAt))}</small></div>
          <button type="button" data-restore-draft>بازیابی</button>
          <button type="button" data-delete-draft>حذف</button>
        `;
        shell.after(notice);
        notice.querySelector("[data-restore-draft]").onclick = () => {
          restoreDraft(form, draft);
          notice.remove();
          dirty = true;
          updateCompletion();
        };
        notice.querySelector("[data-delete-draft]").onclick = () => {
          clearDraft();
          notice.remove();
        };
      }
    }
    show(0, false);
  }

  function handleServerError(error) {
    if (!activeState?.form) return serverErrorMessage(error);
    const { form, steps, show } = activeState;
    const conflicts = error?.data?.conflicts || [];
    const caseConflict = conflicts.find((item) => item.type === "caseNumber");
    const nationalConflict = conflicts.find((item) => item.type === "nationalId");
    const issuePath = error?.data?.issues?.[0]?.path?.[0];
    let control = null;
    let message = serverErrorMessage(error);

    if (caseConflict) control = form.elements.namedItem("caseNumber");
    else if (nationalConflict) {
      const target = String(nationalConflict.value || "");
      control = [
        form.elements.namedItem("headNationalId"),
        ...form.querySelectorAll('[name="memberNationalId"]'),
      ].find((item) => item && onlyDigits(item.value) === target);
      control ||= form.elements.namedItem("headNationalId");
    } else if (typeof issuePath === "string") {
      control = form.elements.namedItem(issuePath);
    }

    if (control && !(control instanceof RadioNodeList)) {
      control.setCustomValidity(message);
      setFieldState(control, message);
      const index = steps.findIndex((step) => step.contains(control));
      if (index >= 0) show(index, false);
      requestAnimationFrame(() => {
        control.focus();
        control.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    const errorBox = form.querySelector("#createError");
    if (errorBox) errorBox.textContent = message;
    return message;
  }

  async function success({ mode, familyId }) {
    if (activeState) activeState.dirty = false;
    if (mode === "create") clearDraft();
    const root = document.querySelector("#modalRoot");
    if (!root) return "view";
    const form = activeState?.form;
    const caseNumber =
      form?.elements.namedItem("caseNumber")?.value?.trim() || "—";
    const headName =
      form?.elements.namedItem("headName")?.value?.trim() || "خانواده";
    const members = form?.querySelectorAll("[data-member]").length || 0;
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal case-success case-success-center" role="dialog" aria-modal="true" aria-labelledby="caseSuccessTitle" data-family-id="${escapeHtml(familyId || "")}">
          <div class="case-success-visual">
            <svg viewBox="0 0 72 72" aria-hidden="true">
              <circle cx="36" cy="36" r="33"></circle>
              <path d="M22 37 L32 47 L51 27"></path>
            </svg>
          </div>
          <div class="case-success-copy">
            <span class="case-success-kicker">${mode === "edit" ? "ذخیره تغییرات" : "ثبت پرونده جدید"}</span>
            <h2 id="caseSuccessTitle">${mode === "edit" ? "تغییرات با موفقیت ذخیره شد" : "پرونده با موفقیت ایجاد شد"}</h2>
            <p>${mode === "edit" ? "اطلاعات جدید در پرونده ثبت شد و آماده ادامه پیگیری است." : "اطلاعات اصلی ثبت شد؛ حالا می‌توانید پرونده را ببینید یا اولین پیگیری را ایجاد کنید."}</p>
          </div>
          <div class="case-success-summary" aria-label="خلاصه پرونده">
            <div><span>شماره پرونده</span><b>${escapeHtml(caseNumber)}</b></div>
            <div><span>سرپرست</span><b>${escapeHtml(headName)}</b></div>
            <div><span>اعضای ثبت‌شده</span><b>${fa(members)} نفر</b></div>
          </div>
          <div class="case-success-next">
            <b>گام بعدی را انتخاب کنید</b>
            <div class="case-success-actions">
              <button type="button" class="primary" data-success-action="view">مشاهده پرونده</button>
              <button type="button" class="secondary" data-success-action="followup">ثبت پیگیری</button>
              ${mode === "create" ? '<button type="button" class="secondary" data-success-action="new">ایجاد پرونده دیگر</button>' : ""}
              <button type="button" class="case-success-close" data-success-action="close">فعلاً بستن</button>
            </div>
          </div>
        </div>
      </div>
    `;
    return new Promise((resolve) => {
      const finish = (action) => {
        document.removeEventListener("keydown", onKeyDown);
        root.innerHTML = "";
        resolve(action);
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") finish("close");
      };
      document.addEventListener("keydown", onKeyDown);
      root.querySelectorAll("[data-success-action]").forEach((button) => {
        button.onclick = () => finish(button.dataset.successAction);
      });
      requestAnimationFrame(() =>
        root.querySelector('[data-success-action="view"]')?.focus(),
      );
    });
  }

  function init() {
    const scan = () => enhanceWizard(document.querySelector("#createFamilyForm"));
    scan();
    new MutationObserver(scan).observe(document.querySelector("#modalRoot"), {
      childList: true,
      subtree: true,
    });
  }

  window.CaseWizard = { success, handleServerError };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();