/* Persian date input, actionable queues and clearer workflow panels. */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const actorNow = () => window.currentActor || {};
  const escHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
  const faNum = (value) => new Intl.NumberFormat("fa-IR").format(Number(value) || 0);
  const localIsoDate = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const asDate = (value) => {
    if (!value) return null;
    const raw = String(value);
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const jalaliDate = (value, time = false) => {
    const date = asDate(value);
    if (!date) return "ثبت نشده";
    return new Intl.DateTimeFormat(
      "fa-IR-u-ca-persian",
      time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" },
    ).format(date);
  };
  const dayGap = (value) => {
    const date = asDate(value);
    if (!date) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today - date) / 86400000));
  };
  const fmtMoney = (value) => `${new Intl.NumberFormat("fa-IR").format(Number(value) || 0)} تومان`;
  const closeRoot = () => {
    if (typeof window.closeModal === "function") window.closeModal();
    else $("#modalRoot").replaceChildren();
  };
  const bindClose = (root = $("#modalRoot")) => {
    root?.querySelectorAll("[data-close]").forEach((button) => {
      button.onclick = closeRoot;
    });
    root?.querySelector(".modal-backdrop")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeRoot();
    });
  };
  const shell = (eyebrow, title, description, icon = "✓", close = true) => `
    <div class="modal-backdrop"><section class="modal ops-modal" role="dialog" aria-modal="true">
      <header class="modal-head"><span class="ops-head-mark" aria-hidden="true">${icon}</span>
        <div class="ops-head-copy"><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${description}</p></div>
        ${close ? '<button type="button" class="close-btn" data-close aria-label="بستن">×</button>' : ""}
      </header><div class="ops-modal-body" id="opsModalBody"></div>
    </section></div>`;
  const openShell = (eyebrow, title, description, icon = "✓") => {
    $("#modalRoot").innerHTML = shell(eyebrow, title, description, icon);
    bindClose();
    return $("#opsModalBody");
  };
  const empty = (title, detail, icon = "✓") =>
    `<div class="ops-empty"><i aria-hidden="true">${icon}</i><b>${title}</b><span>${detail}</span></div>`;
  const pill = (text, tone = "") =>
    `<span class="ops-pill${tone ? ` is-${tone}` : ""}">${text}</span>`;
  const queueSection = (title, count, content, detail = "") =>
    `<section class="ops-section"><header class="ops-section-head"><div><h3>${title}</h3>${detail ? `<p>${detail}</p>` : ""}</div><span class="ops-count">${faNum(count)} مورد</span></header>${content || empty("موردی نیست", "در حال حاضر چیزی برای رسیدگی وجود ندارد.")}</section>`;
  const linkFamily = (familyId, sectionSelector = "") => {
    closeRoot();
    if (familyId && typeof window.openFamilyRecord === "function") window.openFamilyRecord(familyId);
    else if (familyId && typeof window.loadDetail === "function") window.loadDetail(familyId);
    if (sectionSelector) setTimeout(() => $(sectionSelector)?.scrollIntoView({ behavior: "smooth", block: "start" }), 500);
  };
  const personLine = (item) =>
    `پرونده ${escHtml(item.caseNumber || "—")} · ${escHtml(item.headName || "خانواده")}`;

  function overdueCard(item) {
    const days = dayGap(item.nextFollowUpAt);
    return `<article class="overdue-card" data-overdue-item data-search="${escHtml(`${item.headName} ${item.caseNumber} ${item.text} ${item.assigneeName || ""}`.toLowerCase())}" data-days="${days}">
      <span class="overdue-days">${faNum(days)}<small>روز</small></span>
      <div><b>${escHtml(item.headName)} · پرونده ${escHtml(item.caseNumber)}</b><p>${escHtml(item.text || "بدون شرح")}<br><span>مسئول: ${escHtml(item.assigneeName || "تعیین نشده")}</span></p><small>موعد: <span class="ops-inline-date">${jalaliDate(item.nextFollowUpAt, true)}</span> · ${escHtml(item.status || "باز")}</small></div>
      <button class="ops-item-action" type="button" data-open-overdue-family="${escHtml(item.familyId)}">بازکردن پیگیری</button>
    </article>`;
  }
  async function openOverdue() {
    const body = openShell("کارتابل پیگیری", "پیگیری‌های عقب‌افتاده", "موعدهای گذشته را بر اساس میزان تأخیر مرتب کنید و مستقیم به پرونده برسید.", "◷");
    body.innerHTML = '<div class="panel-loading">در حال دریافت موعدهای گذشته…</div>';
    try {
      const data = await window.api("/api/follow-ups/overdue");
      const items = data.items || [];
      const over7 = items.filter((item) => dayGap(item.nextFollowUpAt) >= 7).length;
      const unassigned = items.filter((item) => !item.assigneeName).length;
      body.innerHTML = `<div class="ops-hero"><div class="ops-hero-copy"><b>${items.length ? `${faNum(items.length)} پیگیری از موعد گذشته` : "پیگیری‌ها به‌روز هستند"}</b><p>${items.length ? "اول مواردی را بررسی کنید که مدت بیشتری از موعدشان گذشته است." : "در حال حاضر پیگیری عقب‌افتاده‌ای ثبت نشده است."}</p></div>${items.length ? `<button type="button" class="primary" data-open-overdue-family="${escHtml(items[0].familyId)}">رسیدگی به قدیمی‌ترین مورد</button>` : ""}</div>
        <div class="ops-metrics"><div class="ops-metric" data-tone="danger"><span>کل عقب‌افتاده</span><b>${faNum(items.length)}</b><small>پیگیری باز و سررسیدگذشته</small></div><div class="ops-metric"><span>بیش از یک هفته</span><b>${faNum(over7)}</b><small>اولویت رسیدگی بالاتر</small></div><div class="ops-metric"><span>بدون مسئول</span><b>${faNum(unassigned)}</b><small>نیازمند تعیین مسئول</small></div><div class="ops-metric"><span>جدیدترین موعد</span><b>${items.length ? jalaliDate(items[items.length - 1].nextFollowUpAt) : "—"}</b><small>قدیمی‌ترین مورد نخست نمایش داده می‌شود</small></div></div>
        <div class="ops-toolbar"><input type="search" data-overdue-search placeholder="جست‌وجوی نام، شماره پرونده یا متن پیگیری"><button class="ops-filter-chip" type="button" data-overdue-filter="all" aria-pressed="true">همه موارد</button><button class="ops-filter-chip" type="button" data-overdue-filter="7" aria-pressed="false">۷ روز و بیشتر</button></div>
        <div class="ops-queue-list" data-overdue-list>${items.map(overdueCard).join("") || empty("مورد عقب‌افتاده‌ای نیست", "هر پیگیری تازه‌ای در موعد مقرر اینجا نمایش داده می‌شود.")}</div>`;
      let minDays = 0;
      const apply = () => {
        const term = String(body.querySelector("[data-overdue-search]")?.value || "").trim().toLowerCase();
        let visible = 0;
        body.querySelectorAll("[data-overdue-item]").forEach((card) => {
          const show = Number(card.dataset.days) >= minDays && card.dataset.search.includes(term);
          card.hidden = !show;
          if (show) visible += 1;
        });
        const list = body.querySelector("[data-overdue-list]");
        const none = list.querySelector(".overdue-filter-empty");
        if (!visible && items.length) {
          if (!none) list.insertAdjacentHTML("beforeend", '<div class="ops-empty overdue-filter-empty"><i>⌕</i><b>موردی با این فیلتر پیدا نشد</b><span>جست‌وجو یا فیلتر را تغییر دهید.</span></div>');
        } else none?.remove();
      };
      body.querySelector("[data-overdue-search]")?.addEventListener("input", apply);
      body.querySelectorAll("[data-overdue-filter]").forEach((button) => button.onclick = () => {
        minDays = Number(button.dataset.overdueFilter) || 0;
        body.querySelectorAll("[data-overdue-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        apply();
      });
      body.querySelectorAll("[data-open-overdue-family]").forEach((button) => button.onclick = () => linkFamily(button.dataset.openOverdueFamily, ".followup-history"));
    } catch (error) {
      body.innerHTML = empty("دریافت پیگیری‌ها ناموفق بود", escHtml(error.message), "!");
    }
  }

  const actionStatusFa = { proposed: "در انتظار تخصیص", assigned: "در حال انجام", revision_requested: "نیازمند اصلاح", completed: "منتظر تأیید نتیجه", approved: "تأیید و بسته‌شده", cancelled: "لغوشده" };
  const actionPriorityFa = { urgent: "فوری", high: "بالا", medium: "متوسط", low: "کم" };
  async function openActionInbox() {
    const body = openShell("کارتابل اقدام", "اقدام‌هایی که باید پیگیری شوند", "نتیجه‌های منتظر تأیید، اقدام‌های نیازمند تخصیص و کارهای واگذارشده را یکجا ببینید.", "✓");
    body.innerHTML = '<div class="panel-loading">در حال دریافت کارها…</div>';
    try {
      const data = await window.api("/api/actions/inbox");
      const items = data.items || [];
      const reviews = items.filter((item) => ["proposed", "completed"].includes(item.status)).length;
      const overdue = items.filter((item) => dayGap(item.dueAt) > 0 && ["assigned", "revision_requested"].includes(item.status)).length;
      body.innerHTML = `<div class="ops-metrics"><div class="ops-metric"><span>${data.mode === "reviewer" ? "نیازمند تصمیم" : "واگذارشده به شما"}</span><b>${faNum(data.mode === "reviewer" ? reviews : items.length)}</b><small>${data.mode === "reviewer" ? "پیشنهاد تخصیص یا نتیجه" : "اقدام‌های باز"}</small></div><div class="ops-metric" data-tone="danger"><span>عقب‌افتاده</span><b>${faNum(overdue)}</b><small>از مهلت گذشته</small></div><div class="ops-metric"><span>فوری و بالا</span><b>${faNum(items.filter((item) => ["urgent", "high"].includes(item.priority)).length)}</b><small>اولویت بالاتر</small></div><div class="ops-metric"><span>در این کارتابل</span><b>${faNum(items.length)}</b><small>موارد قابل مشاهده برای شما</small></div></div>
        <div class="ops-toolbar"><input type="search" data-action-search placeholder="جست‌وجوی اقدام یا خانواده"><select data-action-filter><option value="all">همه وضعیت‌ها</option><option value="proposed">در انتظار تخصیص</option><option value="completed">منتظر تأیید نتیجه</option><option value="assigned">در حال انجام</option><option value="revision_requested">نیازمند اصلاح</option></select></div>
        <div class="ops-queue-list" data-action-queue>${items.map((item) => {
          const late = dayGap(item.dueAt);
          const searchable = `${item.title} ${item.headName} ${item.caseNumber} ${item.assignedToName || ""}`.toLowerCase();
          return `<article class="ops-item" data-action-item data-status="${escHtml(item.status)}" data-search="${escHtml(searchable)}">
            <span class="ops-item-icon ${late ? "is-late" : ""}">${item.status === "completed" ? "✓" : "↗"}</span>
            <div class="ops-item-copy"><b>${escHtml(item.title)} · ${escHtml(item.headName)}</b><p>${personLine(item)} · ${escHtml(item.domain === "health" ? "درمان" : item.domain === "education" ? "آموزش" : "عمومی")} · ${escHtml(item.assignedToName || "بدون مسئول")}</p><small>${pill(actionStatusFa[item.status] || item.status, item.status === "completed" ? "warning" : "")}${pill(`اولویت ${actionPriorityFa[item.priority] || "متوسط"}`)}${item.dueAt ? pill(`${late ? `⏱ ${faNum(late)} روز از موعد` : "مهلت"} · ${jalaliDate(item.dueAt)}`, late ? "danger" : "") : ""}</small>${item.completionNote ? `<p>نتیجه ثبت‌شده: ${escHtml(item.completionNote)}</p>` : ""}${item.reviewNote ? `<p>یادداشت بررسی: ${escHtml(item.reviewNote)}</p>` : ""}</div>
            <button type="button" class="ops-item-action" data-open-action-family="${escHtml(item.familyId)}">بررسی در پرونده</button></article>`;
        }).join("") || empty("اقدامی برای رسیدگی نیست", "با ایجاد یا تخصیص یک اقدام، وضعیت آن در این کارتابل نمایش داده می‌شود.")}</div>`;
      const apply = () => {
        const term = String(body.querySelector("[data-action-search]")?.value || "").trim().toLowerCase();
        const status = body.querySelector("[data-action-filter]")?.value || "all";
        body.querySelectorAll("[data-action-item]").forEach((item) => {
          item.hidden = (status !== "all" && status !== item.dataset.status) || !item.dataset.search.includes(term);
        });
      };
      body.querySelector("[data-action-search]")?.addEventListener("input", apply);
      body.querySelector("[data-action-filter]")?.addEventListener("change", apply);
      body.querySelectorAll("[data-open-action-family]").forEach((button) => button.onclick = () => linkFamily(button.dataset.openActionFamily, "#actionSection"));
    } catch (error) {
      body.innerHTML = empty("کارتابل اقدامات در دسترس نیست", escHtml(error.message), "!");
    }
  }

  const checklistItems = (checklist = {}) => {
    const labels = [
      ["urgentNeed", "نیاز فوری"],
      ["healthConcern", "نگرانی درمانی"],
      ["educationConcern", "نگرانی آموزشی"],
      ["contactSuccessful", "تماس موفق"],
    ];
    const changeName = (key, name) => ({ none: "بدون تغییر", improved: "بهبود", worse: "بدترشدن", unknown: "نامشخص" }[key] || name);
    return labels.filter(([key]) => checklist[key]).map(([, label]) => `<span class="supervision-check is-active">${label}</span>`)
      .concat(checklist.housingChange && checklist.housingChange !== "none" ? [`<span class="supervision-check">مسکن: ${changeName(checklist.housingChange)}</span>`] : [])
      .concat(checklist.incomeChange && checklist.incomeChange !== "none" ? [`<span class="supervision-check">درآمد: ${changeName(checklist.incomeChange)}</span>`] : [])
      .join("");
  };
  const contactMethodFa = { phone: "تماس تلفنی", message: "پیام", in_person_with_supervisor: "دیدار با سرپرست" };
  function reportCard(report) {
    const isUrgent = ["urgent", "high"].includes(report.priority);
    return `<article class="supervision-review-card" data-priority="${escHtml(report.priority)}">
      <header class="supervision-review-head"><div><h4>${escHtml(report.headName)} · پرونده ${escHtml(report.caseNumber)}</h4><p>${escHtml(report.liaisonName)} · سرپرست ارتباط: ${escHtml(report.supervisorName)} · هفتهٔ ${jalaliDate(report.weekStart)}</p></div><div>${pill(report.priority === "urgent" ? "فوری" : report.priority === "high" ? "بالا" : report.priority === "low" ? "کم" : "عادی", isUrgent ? "danger" : "")}</div></header>
      <div class="supervision-checks">${checklistItems(report.checklist) || '<span class="supervision-check">بدون هشدار ثبت‌شده</span>'}</div>
      <p class="supervision-review-summary">${escHtml(report.summary)}</p>
      ${report.proposedActions ? `<div class="specialist-case-detail"><b>اقدام پیشنهادی</b><br>${escHtml(report.proposedActions)}</div>` : ""}
      <div class="ops-item-copy"><small>${pill(`ارتباط: ${contactMethodFa[report.contactMethod] || "ثبت‌شده"}`)}${pill(`زمان تماس: ${jalaliDate(report.contactAt, true)}`)}</small></div>
      <div class="supervision-review-actions"><button type="button" class="secondary" data-open-weekly-family="${escHtml(report.familyId)}">پرونده خانواده</button><button type="button" class="secondary" data-review-weekly="${escHtml(report.id)}" data-decision="revision">درخواست اصلاح</button><button type="button" class="primary" data-review-weekly="${escHtml(report.id)}" data-decision="approve">تأیید گزارش</button></div>
    </article>`;
  }
  function openReportDecision(report, decision) {
    const approve = decision === "approve";
    $("#modalRoot").innerHTML = `<div class="modal-backdrop"><section class="modal ops-review-modal" role="dialog" aria-modal="true">
      <div class="modal-head"><div><span class="eyebrow">${approve ? "تأیید پیگیری هفتگی" : "بازگشت برای تکمیل"}</span><h2>${approve ? "این گزارش را تأیید می‌کنید؟" : "درخواست اصلاح گزارش"}</h2><p>${escHtml(report.headName)} · پرونده ${escHtml(report.caseNumber)}</p></div><button type="button" class="close-btn" data-close aria-label="بستن">×</button></div>
      <div class="supervision-review-summary">${escHtml(report.summary)}</div>
      <form id="weeklyDecisionForm"><div class="form-field"><label>${approve ? "یادداشت تأیید (اختیاری)" : "دلیل اصلاح *"}</label><textarea name="note" ${approve ? "" : "required minlength=3"} maxlength="2000" placeholder="${approve ? "نکته‌ای برای رابط یا سرپرست دارید؟" : "دقیق بنویسید چه چیزی باید اصلاح یا تکمیل شود"}"></textarea></div><div id="weeklyDecisionError" class="message error"></div><footer class="modal-actions"><button type="submit" class="${approve ? "primary" : "secondary"}">${approve ? "تأیید گزارش" : "ارسال درخواست اصلاح"}</button><button type="button" class="secondary" data-close>انصراف</button></footer></form>
    </section></div>`;
    bindClose();
    $("#weeklyDecisionForm").onsubmit = async (event) => {
      event.preventDefault();
      const note = String(new FormData(event.currentTarget).get("note") || "").trim();
      if (!approve && note.length < 3) return $("#weeklyDecisionError").textContent = "برای درخواست اصلاح، دلیل کوتاه و مشخص بنویسید.";
      const submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await window.api(`/api/supervision-reports/${encodeURIComponent(report.id)}/review`, {
          method: "POST",
          body: JSON.stringify({ decision, note }),
        });
        closeRoot();
        window.toast?.(approve ? "گزارش سرپرستی تأیید شد." : "گزارش برای اصلاح بازگردانده شد.");
        openSupervisionInbox();
      } catch (error) {
        submit.disabled = false;
        $("#weeklyDecisionError").textContent = error.message;
      }
    };
  }
  async function openSupervisionInbox() {
    const body = openShell("پیگیری سرپرستی", "کارتابل پیگیری سرپرستی", "گزارش‌های هفتگی، موارد عقب‌افتاده و تصمیم‌های منتظر بررسی را همین‌جا رسیدگی کنید.", "↗");
    body.innerHTML = '<div class="panel-loading">در حال دریافت گزارش‌های سرپرستی…</div>';
    try {
      const data = await window.api("/api/supervision/inbox");
      if (data.mode === "liaison") {
        const due = data.due || [];
        body.innerHTML = `<div class="ops-hero"><div class="ops-hero-copy"><b>${due.length ? `${faNum(due.length)} پیگیری به موعد رسیده` : "پیگیری‌های سرپرستی به‌روز است"}</b><p>با خانواده تماس بگیرید و پس از آن گزارش هفتگی را ثبت کنید.</p></div>${due.length ? `<button class="primary" type="button" data-open-weekly-family="${escHtml(due[0].familyId)}">ثبت اولین گزارش</button>` : ""}</div>
          <div class="ops-metrics"><div class="ops-metric" data-tone="${due.length ? "danger" : "success"}"><span>موعدهای رسیده</span><b>${faNum(due.length)}</b><small>نیازمند تماس یا گزارش</small></div><div class="ops-metric"><span>بدون موعد</span><b>${faNum(due.filter((x) => !x.overdue).length)}</b><small>موعد فعلی امروز است</small></div><div class="ops-metric"><span>سرپرستان مرتبط</span><b>${faNum(new Set(due.map((x) => x.supervisorName)).size)}</b><small>خانواده‌های تحت پیگیری</small></div><div class="ops-metric"><span>عقب‌افتاده</span><b>${faNum(due.filter((x) => x.overdue).length)}</b><small>موعد گذشته</small></div></div>
          ${queueSection("خانواده‌های منتظر پیگیری", due.length, `<div class="ops-queue-list">${due.map((item) => `<article class="ops-item"><span class="ops-item-icon ${item.overdue ? "is-late" : ""}">◷</span><div class="ops-item-copy"><b>${escHtml(item.headName)} · پرونده ${escHtml(item.caseNumber)}</b><p>سرپرست ارتباط: ${escHtml(item.supervisorName)} · موعد: ${jalaliDate(item.nextDueAt)}</p><small>${item.overdue ? pill(`عقب‌افتاده ${faNum(dayGap(item.nextDueAt))} روز`, "danger") : pill("موعد امروز", "warning")}</small></div><button type="button" class="ops-item-action" data-open-weekly-family="${escHtml(item.familyId)}">بازکردن پرونده</button></article>`).join("")}</div>`)}
        `;
      } else {
        const pending = data.pending || [];
        const overdue = data.overdue || [];
        body.innerHTML = `<div class="ops-metrics"><div class="ops-metric" data-tone="${pending.length ? "warning" : "success"}"><span>گزارش منتظر تأیید</span><b>${faNum(pending.length)}</b><small>تصمیم مستقیم در همین صفحه</small></div><div class="ops-metric" data-tone="${overdue.length ? "danger" : "success"}"><span>پیگیری عقب‌افتاده</span><b>${faNum(overdue.length)}</b><small>خانواده نیازمند تماس رابط</small></div><div class="ops-metric"><span>گزارش فوری و مهم</span><b>${faNum(pending.filter((x) => ["urgent", "high"].includes(x.priority)).length)}</b><small>برای بررسی سریع‌تر</small></div><div class="ops-metric"><span>رابط‌های گزارش‌دهنده</span><b>${faNum(new Set(pending.map((x) => x.liaisonName)).size)}</b><small>در صف فعلی</small></div></div>
          ${queueSection("گزارش‌های منتظر تأیید", pending.length, pending.map(reportCard).join(""), "خلاصه تماس و موارد هشدار را پیش از تأیید مرور کنید.")}
          ${queueSection("خانواده‌های عقب‌افتاده در برنامه پیگیری", overdue.length, `<div class="ops-queue-list">${overdue.map((item) => `<article class="ops-item"><span class="ops-item-icon is-late">◷</span><div class="ops-item-copy"><b>${escHtml(item.headName)} · پرونده ${escHtml(item.caseNumber)}</b><p>رابط: ${escHtml(item.liaisonName || "تعیین نشده")} · سرپرست: ${escHtml(item.supervisorName || "تعیین نشده")}</p><small>${pill(`موعد ${jalaliDate(item.nextDueAt)}`, "danger")}${pill(`${faNum(dayGap(item.nextDueAt))} روز تأخیر`, "danger")}</small></div><button type="button" class="ops-item-action" data-open-weekly-family="${escHtml(item.familyId)}">بررسی پرونده</button></article>`).join("")}</div>`, "این فهرست برنامه‌های سرپرستی را نشان می‌دهد که موعد بعدی آن‌ها گذشته است.")}`;
        body.querySelectorAll("[data-review-weekly]").forEach((button) => button.onclick = () => {
          const report = pending.find((item) => item.id === button.dataset.reviewWeekly);
          if (report) openReportDecision(report, button.dataset.decision);
        });
      }
      body.querySelectorAll("[data-open-weekly-family]").forEach((button) => button.onclick = () => linkFamily(button.dataset.openWeeklyFamily, "#supervisionSection"));
    } catch (error) {
      body.innerHTML = empty("کارتابل سرپرستی در دسترس نیست", escHtml(error.message), "!");
    }
  }

  const weeklyStatusFa = { draft: "پیش‌نویس", submitted: "منتظر تأیید", approved: "تأییدشده", revision_requested: "نیازمند اصلاح" };
  const supervisionPriorityFa = { low: "کم", normal: "عادی", high: "بالا", urgent: "فوری" };
  async function loadWeeklyReports(family) {
    const box = $("#supervisionSection");
    if (!box) return;
    try {
      const data = await window.api(`/api/families/${encodeURIComponent(family.id)}/supervision-reports`);
      const canCreate = actorNow().position === "liaison" && !family.archived;
      const reports = data.reports || [];
      const plan = data.plan;
      box.innerHTML = `<div class="supervision-family-panel"><header class="specialist-panel-head"><div><span class="eyebrow">ارتباط خانواده با سرپرست</span><h3>گزارش‌ها و پیگیری سرپرستی</h3><p>گزارش تماس و تغییر وضعیت خانواده را ثبت و نتیجهٔ بررسی معاون سرپرستی را دنبال کنید.</p></div>${canCreate ? '<button class="primary" id="newWeeklyReportBtn">＋ ثبت گزارش این هفته</button>' : ""}</header>
        ${plan ? `<div class="ops-metrics"><div class="ops-metric"><span>تناوب تماس</span><b>هر ${faNum(plan.frequencyDays)} روز</b><small>برنامه فعال</small></div><div class="ops-metric"><span>موعد بعدی</span><b>${jalaliDate(plan.nextDueAt)}</b><small>${asDate(plan.nextDueAt) && dayGap(plan.nextDueAt) > 0 ? "از موعد گذشته" : "برنامه پیگیری"}</small></div><div class="ops-metric"><span>آخرین گزارش تأییدشده</span><b>${jalaliDate(plan.lastApprovedReportAt)}</b><small>مبنای موعد بعدی</small></div><div class="ops-metric"><span>گزارش‌های ثبت‌شده</span><b>${faNum(reports.length)}</b><small>${faNum(reports.filter((r) => r.status === "submitted").length)} منتظر بررسی</small></div></div>` : `<div class="ops-warning">برنامهٔ دوره‌ای پیگیری هنوز برای این خانواده تنظیم نشده است.</div>`}
        <div class="supervision-report-list">${reports.map((report) => `<article class="supervision-review-card" data-priority="${escHtml(report.priority)}"><header class="supervision-review-head"><div><h4>هفتهٔ ${jalaliDate(report.weekStart)} · ${escHtml(report.liaisonName || "رابط")}</h4><p>${contactMethodFa[report.contactMethod] || "ارتباط"} · ${jalaliDate(report.contactAt, true)}</p></div>${pill(weeklyStatusFa[report.status] || report.status, report.status === "approved" ? "success" : report.status === "submitted" ? "warning" : report.status === "revision_requested" ? "danger" : "")}</header><div class="supervision-checks">${checklistItems(report.checklist) || '<span class="supervision-check">بدون هشدار</span>'}${pill(`اولویت ${supervisionPriorityFa[report.priority] || "عادی"}`)}</div><p class="supervision-review-summary">${escHtml(report.summary)}</p>${report.proposedActions ? `<div class="specialist-case-detail"><b>اقدام پیشنهادی</b><br>${escHtml(report.proposedActions)}</div>` : ""}${report.reviewNote ? `<div class="ops-warning"><b>نظر معاون:</b> ${escHtml(report.reviewNote)}</div>` : ""}${report.status === "approved" && report.financialStatus === "none" ? `<div class="supervision-review-actions"><button type="button" class="secondary" data-weekly-finance="${escHtml(report.id)}">ثبت درخواست مالی</button></div>` : ""}</article>`).join("") || empty("گزارشی ثبت نشده", "پس از تماس با سرپرست، گزارش هفتگی را ثبت کنید.")}</div></div>`;
      $("#newWeeklyReportBtn")?.addEventListener("click", () => openWeeklyReportForm(family));
      box.querySelectorAll("[data-weekly-finance]").forEach((button) => button.onclick = () => window.openSourceFinancialForm?.(family, "weekly_report", button.dataset.weeklyFinance));
    } catch (error) {
      box.innerHTML = `<div class="ops-empty"><i>!</i><b>گزارش‌های سرپرستی بارگذاری نشد</b><span>${escHtml(error.message)}</span></div>`;
    }
  }

  function openWeeklyReportForm(family) {
    const today = localIsoDate();
    $("#modalRoot").innerHTML = `<div class="modal-backdrop"><section class="modal ops-modal" role="dialog" aria-modal="true">
      <header class="modal-head"><span class="ops-head-mark">✓</span><div class="ops-head-copy"><span class="eyebrow">گزارش تماس هفتگی</span><h2>ثبت گزارش سرپرستی</h2><p>${escHtml(family.headName || "خانواده")} · پرونده ${escHtml(family.caseNumber || "—")}</p></div><button type="button" class="close-btn" data-close aria-label="بستن">×</button></header>
      <div class="ops-modal-body"><form id="weeklyReportForm">
        <div class="form-grid">
          <div class="form-field"><label>شروع هفته *</label><input name="weekStart" type="date" value="${today}" required></div>
          <div class="form-field"><label>تاریخ تماس *</label><input name="contactDate" type="date" value="${today}" required></div>
          <div class="form-field"><label>ساعت تماس *</label><input name="contactTime" type="time" required></div>
          <div class="form-field"><label>روش ارتباط</label><select name="contactMethod"><option value="phone">تماس تلفنی</option><option value="message">پیام</option><option value="in_person_with_supervisor">دیدار با سرپرست</option></select></div>
          <div class="form-field"><label>اولویت</label><select name="priority"><option value="normal">عادی</option><option value="high">بالا</option><option value="urgent">فوری</option><option value="low">کم</option></select></div>
          <div class="form-field"><label>تغییر وضعیت مسکن</label><select name="housingChange"><option value="none">بدون تغییر</option><option value="improved">بهبود</option><option value="worse">بدتر شده</option><option value="unknown">نامشخص</option></select></div>
          <div class="form-field"><label>تغییر درآمد</label><select name="incomeChange"><option value="none">بدون تغییر</option><option value="improved">بهبود</option><option value="worse">بدتر شده</option><option value="unknown">نامشخص</option></select></div>
          ${[["contactSuccessful","ارتباط موفق بود"],["healthConcern","نگرانی درمانی"],["educationConcern","نگرانی آموزشی"],["urgentNeed","نیاز فوری"]].map(([name,label]) => `<label class="ops-check-field"><input type="checkbox" name="${name}"><span>${label}</span></label>`).join("")}
          <div class="form-field full"><label>خلاصه تماس و وضعیت خانواده *</label><textarea name="summary" required minlength="3" maxlength="5000" placeholder="نتیجه تماس و تغییرات مهم را ثبت کنید"></textarea></div>
          <div class="form-field full"><label>اقدامات پیشنهادی</label><textarea name="proposedActions" maxlength="3000" placeholder="اقدام لازم، مسئول و مهلت پیشنهادی"></textarea></div>
          <div class="form-field full"><label>توضیحات چک‌لیست</label><textarea name="checklistNotes" maxlength="2000"></textarea></div>
        </div>
        <div id="weeklyError" class="message error" role="alert"></div>
        <footer class="modal-actions"><button class="primary" type="submit">ثبت و ارسال برای بررسی</button><button class="secondary" type="button" data-close>انصراف</button></footer>
      </form></div></section></div>`;
    bindClose();
    const form = $("#weeklyReportForm");
    form.querySelectorAll('input[type="date"]').forEach((input) => window.AdvancedUI?.enhanceDate?.(input));
    form.onsubmit = async (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const date = String(fd.get("contactDate") || "");
      const time = String(fd.get("contactTime") || "");
      if (!date || !time) return;
      const contactAt = new Date(`${date}T${time}:00`);
      if (Number.isNaN(contactAt.getTime())) return;
      const body = {
        weekStart: String(fd.get("weekStart")),
        contactAt: contactAt.toISOString(),
        contactMethod: String(fd.get("contactMethod")),
        priority: String(fd.get("priority")),
        summary: String(fd.get("summary") || "").trim(),
        proposedActions: String(fd.get("proposedActions") || "").trim(),
        checklist: {
          contactSuccessful: fd.get("contactSuccessful") === "on",
          housingChange: String(fd.get("housingChange")),
          incomeChange: String(fd.get("incomeChange")),
          healthConcern: fd.get("healthConcern") === "on",
          educationConcern: fd.get("educationConcern") === "on",
          urgentNeed: fd.get("urgentNeed") === "on",
          notes: String(fd.get("checklistNotes") || "").trim(),
        },
      };
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const created = await window.api(`/api/families/${encodeURIComponent(family.id)}/supervision-reports`, { method: "POST", body: JSON.stringify(body) });
        await window.api(`/api/supervision-reports/${encodeURIComponent(created.reportId)}/submit`, { method: "POST", body: "{}" });
        closeRoot();
        window.toast?.("گزارش برای بررسی معاون سرپرستی ارسال شد.");
        loadWeeklyReports(family);
      } catch (error) {
        submit.disabled = false;
        $("#weeklyError").textContent = error.message;
      }
    };
  }

  const healthStages = [
    ["new_referral", "ارجاع"], ["initial_assessment", "ارزیابی"],
    ["appointment_scheduled", "نوبت"], ["in_treatment", "درمان"], ["completed", "پایان"],
  ];
  const educationStages = [
    ["new_referral", "ارجاع"], ["assessment", "ارزیابی"],
    ["support_plan", "برنامه"], ["follow_up", "پیگیری"], ["completed", "پایان"],
  ];
  const statusLabel = (status) => ({
    new_referral: "ارجاع جدید", initial_assessment: "ارزیابی اولیه",
    appointment_scheduled: "نوبت تعیین‌شده", in_treatment: "در حال درمان",
    assessment: "در حال ارزیابی", support_plan: "برنامه حمایت",
    follow_up: "پیگیری آموزشی", completed: "تکمیل‌شده", cancelled: "لغوشده",
  }[status] || status || "وضعیت نامشخص");
  const urgencyLabel = (value) => ({ critical: "بحرانی", urgent: "فوری", important: "مهم", normal: "عادی" }[value] || "عادی");
  const isManager = () => ["admin", "ceo", "supervision_deputy", "health_deputy", "education_deputy"].includes(actorNow().position) || actorNow().role === "admin";
  function specialistCard(item, family) {
    const stages = item.domain === "health" ? healthStages : educationStages;
    const currentIndex = stages.findIndex(([key]) => key === item.status);
    const canManage = isManager() || item.assignedToId === actorNow().id;
    const dueLate = item.nextFollowUpAt && dayGap(item.nextFollowUpAt) > 0 && !["completed", "cancelled"].includes(item.status);
    const detailRows = [
      item.appointmentAt ? ["نوبت", jalaliDate(item.appointmentAt, true)] : null,
      item.nextFollowUpAt ? ["پیگیری بعدی", jalaliDate(item.nextFollowUpAt, true)] : null,
      item.providerName ? ["پزشک / ارائه‌دهنده", item.providerName] : null,
      item.centerName ? ["مرکز", item.centerName] : null,
      item.school ? ["مدرسه", item.school] : null,
      item.grade ? ["پایه", item.grade] : null,
      item.estimatedCost ? ["برآورد", fmtMoney(item.estimatedCost)] : null,
      item.actualCost ? ["هزینه واقعی", fmtMoney(item.actualCost)] : null,
    ].filter(Boolean);
    const closed = ["completed", "cancelled"].includes(item.status);
    return `<article class="specialist-case-card" data-urgency="${escHtml(item.urgency)}">
      <header class="specialist-case-top"><span class="specialist-domain-icon">${item.domain === "health" ? "✚" : "آم"}</span><div class="specialist-case-title"><h4>${item.domain === "health" ? "پرونده درمانی" : "پرونده آموزشی"} · ${escHtml(item.memberName || family.headName)}</h4><p>مسئول: ${escHtml(item.assignedToName || "تعیین نشده")} · فوریت ${urgencyLabel(item.urgency)}</p></div>${pill(statusLabel(item.status), closed ? "success" : dueLate ? "danger" : "")}</header>
      <div class="specialist-stepper" aria-label="پیشرفت پرونده">${stages.map(([key, label], index) => `<span class="specialist-step ${index < currentIndex ? "is-done" : index === currentIndex ? "is-current" : ""}">${label}</span>`).join("")}</div>
      <div class="specialist-case-body"><p class="specialist-case-summary">${escHtml(item.summary)}</p>
        ${detailRows.length ? `<div class="specialist-facts">${detailRows.map(([label, value]) => `<div class="specialist-fact"><span>${label}</span><b>${escHtml(value)}</b></div>`).join("")}</div>` : ""}
        ${item.assessment ? `<div class="specialist-case-detail"><b>ارزیابی</b><br>${escHtml(item.assessment)}</div>` : ""}
        ${item.educationIssue ? `<div class="specialist-case-detail"><b>نیاز آموزشی</b><br>${escHtml(item.educationIssue)}</div>` : ""}
        ${item.supportPlan ? `<div class="specialist-case-detail"><b>برنامهٔ حمایت</b><br>${escHtml(item.supportPlan)}</div>` : ""}
        ${item.result ? `<div class="specialist-case-detail"><b>نتیجه</b><br>${escHtml(item.result)}</div>` : ""}
        ${item.progressEvaluation ? `<div class="specialist-case-detail"><b>ارزیابی پیشرفت</b><br>${escHtml(item.progressEvaluation)}</div>` : ""}
        ${item.nextFollowUpAt ? `<div class="supervision-checks">${pill(`${dueLate ? "پیگیری عقب‌افتاده" : "پیگیری بعدی"} · ${jalaliDate(item.nextFollowUpAt)}`, dueLate ? "danger" : "warning")}</div>` : ""}
        <div class="case-attachments"><div class="case-attachments-title"><strong>مدارک همین پرونده</strong><span>${faNum((item.documents || []).length)} پیوست</span></div>${(item.documents || []).map((doc) => `<div class="case-attachment-row"><span>▤</span><div><b>${escHtml(doc.fileName)}</b><small>${escHtml(doc.documentType)}${doc.description ? ` · ${escHtml(doc.description)}` : ""}</small></div><button type="button" class="secondary" data-secure-download="/api/specialist-documents/${escHtml(doc.id)}/download">دریافت</button></div>`).join("") || '<p class="case-attachments-empty">مدرکی به پرونده پیوست نشده است.</p>'}</div>
        <div class="specialist-case-actions">${canManage && !closed ? `<button type="button" class="secondary" data-edit-specialist="${escHtml(item.id)}">ویرایش جزئیات</button><button type="button" class="primary" data-next-specialist="${escHtml(item.id)}" data-domain="${escHtml(item.domain)}" data-status="${escHtml(item.status)}">ثبت مرحله بعد</button><button type="button" class="secondary" data-doc-specialist="${escHtml(item.id)}">＋ پیوست مدرک</button>` : ""}${item.status === "completed" && item.financialStatus === "none" && (actorNow().role === "admin" || actorNow().role === "caseworker") ? `<button type="button" class="secondary" data-c5-specialist="${escHtml(item.id)}" data-c5-type="${item.domain === "health" ? "health_case" : "education_case"}">درخواست مالی مرتبط</button>` : ""}</div>
      </div>
    </article>`;
  }
  async function loadSpecialistCases(family) {
    const box = $("#specialistSection");
    if (!box) return;
    box.innerHTML = '<div class="panel-loading">در حال دریافت پرونده‌های تخصصی…</div>';
    try {
      const data = await window.api(`/api/families/${encodeURIComponent(family.id)}/specialist-cases`);
      const cases = data.cases || [];
      const open = cases.filter((item) => !["completed", "cancelled"].includes(item.status));
      const urgent = open.filter((item) => ["urgent", "critical"].includes(item.urgency)).length;
      const overdue = open.filter((item) => item.nextFollowUpAt && dayGap(item.nextFollowUpAt) > 0).length;
      const canCreate = (data.availableReferrals || []).length > 0;
      box.className = "finance-section specialist-panel";
      box.innerHTML = `<header class="specialist-panel-head"><div><span class="eyebrow">ارجاع به درمان و آموزش</span><h3>پرونده‌های تخصصی خانواده</h3><p>نیاز تخصصی را به ارجاع فعال وصل کنید؛ مسئول، مرحله، مهلت، ارزیابی و نتیجه هر پرونده در همین‌جا دنبال می‌شود. درخواست مالی جداگانه و به پرونده تخصصی پیوست می‌ماند.</p></div>${canCreate && !family.archived ? '<button type="button" class="primary" data-new-specialist>＋ تشکیل پرونده</button>' : ""}</header>
        <div class="ops-metrics"><div class="ops-metric"><span>پرونده باز</span><b>${faNum(open.length)}</b><small>نیازمند پیگیری</small></div><div class="ops-metric" data-tone="${urgent ? "danger" : ""}"><span>فوری یا بحرانی</span><b>${faNum(urgent)}</b><small>با اولویت بالا</small></div><div class="ops-metric" data-tone="${overdue ? "danger" : ""}"><span>پیگیری عقب‌افتاده</span><b>${faNum(overdue)}</b><small>موعد ثبت‌شده گذشته</small></div><div class="ops-metric" data-tone="success"><span>تکمیل‌شده</span><b>${faNum(cases.length - open.length)}</b><small>سوابق این خانواده</small></div></div>
        <div class="ops-toolbar"><input type="search" data-specialist-search placeholder="جست‌وجوی موضوع یا عضو خانواده"><select data-specialist-domain><option value="all">درمان و آموزش</option><option value="health">درمان</option><option value="education">آموزش</option></select><select data-specialist-status><option value="open">پرونده‌های باز</option><option value="all">همه پرونده‌ها</option><option value="completed">تکمیل‌شده</option></select></div>
        <div class="specialist-case-list" data-specialist-list>${cases.map((item) => `<div data-specialist-item data-domain="${escHtml(item.domain)}" data-status="${escHtml(item.status)}" data-search="${escHtml(`${item.summary} ${item.memberName || family.headName}`.toLowerCase())}">${specialistCard(item, family)}</div>`).join("") || empty("ارجاع تخصصی ثبت نشده", data.availableReferrals?.length ? "از دکمهٔ تشکیل پرونده، یک ارجاع فعال را به پرونده تخصصی تبدیل کنید." : "برای تشکیل پرونده، ابتدا باید ارجاع درمانی یا آموزشی فعال باشد.")}</div>`;
      box.querySelector("[data-new-specialist]")?.addEventListener("click", () => createSpecialistCase(family, data.availableReferrals || []));
      const apply = () => {
        const term = String(box.querySelector("[data-specialist-search]")?.value || "").trim().toLowerCase();
        const domain = box.querySelector("[data-specialist-domain]")?.value || "all";
        const status = box.querySelector("[data-specialist-status]")?.value || "open";
        box.querySelectorAll("[data-specialist-item]").forEach((item) => {
          item.hidden = (domain !== "all" && item.dataset.domain !== domain) ||
            (status === "open" && ["completed", "cancelled"].includes(item.dataset.status)) ||
            (status === "completed" && item.dataset.status !== "completed") ||
            !item.dataset.search.includes(term);
        });
      };
      box.querySelector("[data-specialist-search]")?.addEventListener("input", apply);
      box.querySelector("[data-specialist-domain]")?.addEventListener("change", apply);
      box.querySelector("[data-specialist-status]")?.addEventListener("change", apply);
      box.querySelectorAll("[data-edit-specialist]").forEach((button) => button.onclick = () => {
        const item = cases.find((row) => row.id === button.dataset.editSpecialist);
        if (item) editSpecialistCase(family, item);
      });
      box.querySelectorAll("[data-next-specialist]").forEach((button) => button.onclick = () => nextSpecialistStatus(family, button.dataset.nextSpecialist, button.dataset.domain, button.dataset.status));
      box.querySelectorAll("[data-doc-specialist]").forEach((button) => button.onclick = () => window.uploadSpecialistDocument?.(family, button.dataset.docSpecialist));
      box.querySelectorAll("[data-c5-specialist]").forEach((button) => button.onclick = () => window.openSourceFinancialForm?.(family, button.dataset.c5Type, button.dataset.c5Specialist));
      if (typeof window.bindSecureDownloads === "function") window.bindSecureDownloads(box);
    } catch (error) {
      box.innerHTML = `<div class="ops-empty"><i>!</i><b>دریافت ارجاع‌های تخصصی ناموفق بود</b><span>${escHtml(error.message)}</span></div>`;
    }
  }
  function createSpecialistCase(family, referrals) {
    if (!referrals.length) return window.toast?.("ارجاع فعال درمانی یا آموزشی برای این خانواده وجود ندارد.");
    const members = family.members || [];
    $("#modalRoot").innerHTML = `<div class="modal-backdrop"><section class="modal ops-modal specialist-form-modal" role="dialog" aria-modal="true">
      <div class="modal-head"><span class="ops-head-mark">＋</span><div class="ops-head-copy"><span class="eyebrow">ارجاع فعال خانواده</span><h2>تشکیل پرونده تخصصی</h2><p>${escHtml(family.headName)} · پرونده ${escHtml(family.caseNumber)}</p></div><button type="button" class="close-btn" data-close aria-label="بستن">×</button></div>
      <div class="ops-modal-body"><p class="specialist-form-intro">ارجاع تخصصی برای ارزیابی و پیگیری نیاز درمانی یا آموزشی است؛ ثبت کمک مالی از بخش مالی انجام می‌شود.</p>
        <form id="specialistCreateForm"><div class="form-grid">
          <div class="form-field full"><label>ارجاعی که به پرونده تبدیل می‌شود *</label><select name="referralId" required>${referrals.map((referral) => `<option value="${escHtml(referral.referralId)}" data-domain="${escHtml(referral.domain)}" data-action-id="${escHtml(referral.actionId || "")}">${referral.domain === "health" ? "درمان" : "آموزش"} · ${escHtml(referral.reason || "نیاز ثبت‌شده")}</option>`).join("")}</select></div>
          <div class="form-field"><label>عضو مرتبط</label><select name="memberId"><option value="">فرد اصلی خانوار</option>${members.map((member) => `<option value="${escHtml(member.id)}">${escHtml(member.name)} · ${escHtml(member.relation || "عضو خانواده")}</option>`).join("")}</select></div>
          <div class="form-field"><label>فوریت</label><select name="urgency"><option value="normal">عادی</option><option value="important">مهم</option><option value="urgent">فوری</option><option value="critical">بحرانی</option></select></div>
          <div class="form-field full"><label>خلاصه نیاز تخصصی *</label><textarea name="summary" required minlength="3" maxlength="3000" placeholder="نیاز خانواده و دلیل ارجاع را کوتاه و دقیق ثبت کنید"></textarea></div>
        </div><div id="specialistCreateError" class="message error"></div><footer class="modal-actions"><button class="primary" type="submit">ایجاد پرونده و شروع پیگیری</button><button class="secondary" type="button" data-close>انصراف</button></footer></form>
      </div></section></div>`;
    bindClose();
    $("#specialistCreateForm").onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const refId = String(fd.get("referralId"));
      const referral = referrals.find((item) => item.referralId === refId);
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await window.api(`/api/families/${encodeURIComponent(family.id)}/specialist-cases`, {
          method: "POST",
          body: JSON.stringify({
            domain: referral.domain,
            referralId: referral.referralId,
            actionId: referral.actionId || null,
            memberId: String(fd.get("memberId") || "") || null,
            summary: String(fd.get("summary") || "").trim(),
            urgency: String(fd.get("urgency") || "normal"),
          }),
        });
        closeRoot();
        window.toast?.("پرونده تخصصی تشکیل شد.");
        loadSpecialistCases(family);
      } catch (error) {
        button.disabled = false;
        $("#specialistCreateError").textContent = error.message;
      }
    };
  }
  function dateFieldValue(value) {
    const date = asDate(value);
    return date ? localIsoDate(date) : "";
  }
  function specialistEditFields(item) {
    const base = `<div class="form-field"><label>فوریت</label><select name="urgency">${[["normal", "عادی"], ["important", "مهم"], ["urgent", "فوری"], ["critical", "بحرانی"]].map(([value, label]) => `<option value="${value}" ${item.urgency === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="form-field full"><label>خلاصه نیاز</label><textarea name="summary" minlength="3" maxlength="3000" required>${escHtml(item.summary)}</textarea></div>`;
    const time = `<div class="form-field"><label>تاریخ نوبت</label><input type="date" name="appointmentDate" value="${dateFieldValue(item.appointmentAt)}"></div><div class="form-field"><label>تاریخ پیگیری بعدی</label><input type="date" name="nextFollowUpDate" value="${dateFieldValue(item.nextFollowUpAt)}"></div>`;
    const result = `<div class="form-field full"><label>نتیجه</label><textarea name="result" maxlength="5000">${escHtml(item.result || "")}</textarea></div>`;
    if (item.domain === "health")
      return `${base}<div class="form-field"><label>ارزیابی درمانی</label><textarea name="assessment" maxlength="5000">${escHtml(item.assessment || "")}</textarea></div><div class="form-field"><label>نام پزشک / ارائه‌دهنده</label><input name="providerName" maxlength="200" value="${escHtml(item.providerName || "")}"></div><div class="form-field"><label>مرکز درمانی</label><input name="centerName" maxlength="200" value="${escHtml(item.centerName || "")}"></div><div class="form-field"><label>نوع خدمت</label><input name="serviceType" maxlength="200" value="${escHtml(item.serviceType || "")}"></div>${time}<div class="form-field"><label>برآورد هزینه (تومان)</label><input type="number" min="0" name="estimatedCost" value="${escHtml(item.estimatedCost || "")}"></div><div class="form-field"><label>هزینه واقعی (تومان)</label><input type="number" min="0" name="actualCost" value="${escHtml(item.actualCost || "")}"></div>${result}`;
    return `${base}<div class="form-field"><label>پایه تحصیلی</label><input name="grade" maxlength="80" value="${escHtml(item.grade || "")}"></div><div class="form-field"><label>مدرسه</label><input name="school" maxlength="200" value="${escHtml(item.school || "")}"></div><div class="form-field"><label>سال تحصیلی</label><input name="academicYear" maxlength="30" value="${escHtml(item.academicYear || "")}"></div><div class="form-field full"><label>نیاز یا مسئله آموزشی</label><textarea name="educationIssue" maxlength="3000">${escHtml(item.educationIssue || "")}</textarea></div><div class="form-field full"><label>برنامه حمایت آموزشی</label><textarea name="supportPlan" maxlength="5000">${escHtml(item.supportPlan || "")}</textarea></div><div class="form-field full"><label>ارزیابی پیشرفت</label><textarea name="progressEvaluation" maxlength="5000">${escHtml(item.progressEvaluation || "")}</textarea></div>${time}${result}`;
  }
  function editSpecialistCase(family, item) {
    $("#modalRoot").innerHTML = `<div class="modal-backdrop"><section class="modal ops-modal specialist-form-modal" role="dialog" aria-modal="true">
      <div class="modal-head"><span class="ops-head-mark">✎</span><div class="ops-head-copy"><span class="eyebrow">${item.domain === "health" ? "پرونده درمانی" : "پرونده آموزشی"} · ${statusLabel(item.status)}</span><h2>به‌روزرسانی پیگیری تخصصی</h2><p>${escHtml(family.headName)} · ${escHtml(item.memberName || "فرد اصلی خانوار")}</p></div><button type="button" class="close-btn" data-close aria-label="بستن">×</button></div>
      <div class="ops-modal-body"><form id="specialistEditForm"><div class="form-grid">${specialistEditFields(item)}</div><div id="specialistEditError" class="message error"></div><footer class="modal-actions"><button type="submit" class="primary">ذخیره اطلاعات پیگیری</button><button type="button" class="secondary" data-close>انصراف</button></footer></form></div>
    </section></div>`;
    bindClose();
    const form = $("#specialistEditForm");
    form.querySelectorAll('input[type="date"]').forEach((input) => window.AdvancedUI?.enhanceDate?.(input));
    form.onsubmit = async (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const payload = {};
      const stringKeys = item.domain === "health"
        ? ["summary", "urgency", "assessment", "providerName", "centerName", "serviceType", "result"]
        : ["summary", "urgency", "grade", "school", "academicYear", "educationIssue", "supportPlan", "progressEvaluation", "result"];
      stringKeys.forEach((key) => payload[key] = String(fd.get(key) || "").trim());
      for (const key of ["estimatedCost", "actualCost"]) if (fd.has(key)) payload[key] = String(fd.get(key) || "").trim() === "" ? null : Number(fd.get(key));
      const appointment = String(fd.get("appointmentDate") || "");
      const next = String(fd.get("nextFollowUpDate") || "");
      payload.appointmentAt = appointment ? new Date(`${appointment}T12:00:00`).toISOString() : null;
      payload.nextFollowUpAt = next ? new Date(`${next}T12:00:00`).toISOString() : null;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await window.api(`/api/specialist-cases/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify(payload) });
        closeRoot();
        window.toast?.("اطلاعات پیگیری تخصصی ذخیره شد.");
        loadSpecialistCases(family);
      } catch (error) {
        submit.disabled = false;
        $("#specialistEditError").textContent = error.message;
      }
    };
  }
  function nextSpecialistStatus(family, id, domain, status) {
    const stages = domain === "health" ? healthStages : educationStages;
    const index = stages.findIndex(([key]) => key === status);
    const next = stages[index + 1];
    if (!next) return;
    const title = statusLabel(next[0]);
    $("#modalRoot").innerHTML = `<div class="modal-backdrop"><section class="modal ops-review-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="eyebrow">مرحله بعدی پرونده</span><h2>ثبت «${title}»</h2><p>پرونده ${escHtml(family.caseNumber)} · ${escHtml(family.headName)}</p></div><button class="close-btn" data-close>×</button></div><p class="specialist-form-intro">پس از انتقال، وضعیت و زمان این تغییر در سوابق پرونده ثبت می‌شود.</p><form id="specialistTransitionForm"><div class="form-field"><label>توضیح این مرحله (اختیاری)</label><textarea name="note" maxlength="2000" placeholder="نتیجه یا توضیح کوتاه"></textarea></div><div id="specialistTransitionError" class="message error"></div><footer class="modal-actions"><button type="submit" class="primary">ثبت مرحله</button><button type="button" class="secondary" data-close>انصراف</button></footer></form></section></div>`;
    bindClose();
    $("#specialistTransitionForm").onsubmit = async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await window.api(`/api/specialist-cases/${encodeURIComponent(id)}/transition`, { method: "POST", body: JSON.stringify({ to: next[0], note: String(new FormData(event.currentTarget).get("note") || "").trim() }) });
        closeRoot();
        window.toast?.(`مرحله «${title}» ثبت شد.`);
        loadSpecialistCases(family);
      } catch (error) {
        button.disabled = false;
        $("#specialistTransitionError").textContent = error.message;
      }
    };
  }
  async function openSpecialistInbox() {
    const body = openShell("کارتابل تخصصی", "ارجاع‌های درمانی و آموزشی", "پرونده‌های فعال را بر اساس حوزه، فوریت و موعد پیگیری مرور کنید.", "✚");
    body.innerHTML = '<div class="panel-loading">در حال دریافت ارجاع‌ها…</div>';
    try {
      const data = await window.api("/api/specialist-cases/inbox");
      const items = data.items || [];
      const health = items.filter((item) => item.domain === "health").length;
      const education = items.filter((item) => item.domain === "education").length;
      const late = items.filter((item) => item.nextFollowUpAt && dayGap(item.nextFollowUpAt) > 0).length;
      body.innerHTML = `<div class="ops-metrics"><div class="ops-metric"><span>پرونده باز</span><b>${faNum(items.length)}</b><small>کارتابل فعلی</small></div><div class="ops-metric"><span>درمان</span><b>${faNum(health)}</b><small>نیاز درمانی</small></div><div class="ops-metric"><span>آموزش</span><b>${faNum(education)}</b><small>نیاز آموزشی</small></div><div class="ops-metric" data-tone="${late ? "danger" : ""}"><span>پیگیری عقب‌افتاده</span><b>${faNum(late)}</b><small>از موعد گذشته</small></div></div>
        <div class="ops-toolbar"><input type="search" data-specialist-inbox-search placeholder="جست‌وجوی نام خانواده یا موضوع"><button class="ops-filter-chip" data-specialist-inbox-filter="all" aria-pressed="true">همه</button><button class="ops-filter-chip" data-specialist-inbox-filter="health" aria-pressed="false">درمان</button><button class="ops-filter-chip" data-specialist-inbox-filter="education" aria-pressed="false">آموزش</button></div>
        <div data-specialist-inbox-list>${items.map((item) => `<button type="button" class="specialist-inbox-item" data-specialist-open="${escHtml(item.familyId)}" data-domain="${escHtml(item.domain)}" data-search="${escHtml(`${item.headName} ${item.caseNumber} ${item.summary}`.toLowerCase())}"><span class="specialist-domain-icon">${item.domain === "health" ? "✚" : "آم"}</span><span><b>${item.domain === "health" ? "درمان" : "آموزش"} · ${escHtml(item.memberName || item.headName)}</b><small>${escHtml(item.headName)} · پرونده ${escHtml(item.caseNumber)} · ${escHtml(item.summary)}</small><small>مسئول: ${escHtml(item.assignedToName || "تعیین نشده")}${item.nextFollowUpAt ? ` · پیگیری ${jalaliDate(item.nextFollowUpAt)}` : ""}</small></span>${pill(urgencyLabel(item.urgency), ["urgent", "critical"].includes(item.urgency) ? "danger" : "")}</button>`).join("") || empty("پروندهٔ تخصصی بازی وجود ندارد", "ارجاع‌های جدید پس از تشکیل پرونده در اینجا قرار می‌گیرند.")}</div>`;
      let filter = "all";
      const apply = () => {
        const term = String(body.querySelector("[data-specialist-inbox-search]")?.value || "").trim().toLowerCase();
        body.querySelectorAll(".specialist-inbox-item").forEach((item) => item.hidden = (filter !== "all" && item.dataset.domain !== filter) || !item.dataset.search.includes(term));
      };
      body.querySelector("[data-specialist-inbox-search]")?.addEventListener("input", apply);
      body.querySelectorAll("[data-specialist-inbox-filter]").forEach((button) => button.onclick = () => {
        filter = button.dataset.specialistInboxFilter;
        body.querySelectorAll("[data-specialist-inbox-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        apply();
      });
      body.querySelectorAll("[data-specialist-open]").forEach((button) => button.onclick = () => linkFamily(button.dataset.specialistOpen, "#specialistSection"));
    } catch (error) {
      body.innerHTML = empty("کارتابل تخصصی در دسترس نیست", escHtml(error.message), "!");
    }
  }

  async function openAttentionItems() {
    const body = openShell("مرکز رسیدگی", "موارد نیازمند اقدام", "تصمیم‌ها، تأییدها و پیگیری‌هایی که در این نقش منتظر اقدام شما هستند.", "!");
    body.innerHTML = '<div class="panel-loading">در حال گردآوری کارهای شما…</div>';
    const requests = [
      ["overdue", "/api/follow-ups/overdue"],
      ["alerts", "/api/alerts?includeRead=false"],
      ["actions", "/api/actions/inbox"],
      ["supervision", "/api/supervision/inbox"],
      ["specialist", "/api/specialist-cases/inbox"],
      ["approvals", "/api/approvals/families"],
    ];
    const results = await Promise.allSettled(requests.map(([, url]) => window.api(url)));
    const data = Object.fromEntries(requests.map(([key], index) => [key, results[index].status === "fulfilled" ? results[index].value : null]));
    const overdue = data.overdue?.items || [];
    const alerts = data.alerts?.alerts || [];
    const actionItems = data.actions?.items || [];
    const actionReviews = data.actions?.mode === "reviewer" ? actionItems.filter((item) => ["proposed", "completed"].includes(item.status)) : [];
    const overdueActions = actionItems.filter((item) => ["assigned", "revision_requested"].includes(item.status) && item.dueAt && dayGap(item.dueAt) > 0);
    const supervisionItems = data.supervision?.mode === "reviewer" ? (data.supervision.pending || []) : (data.supervision?.due || []);
    const supervisionLate = data.supervision?.mode === "reviewer" ? (data.supervision.overdue || []) : [];
    const specialistItems = data.specialist?.items || [];
    const familyApprovals = data.approvals ? (data.approvals.newFamilies || []).length + (data.approvals.changes || []).length : 0;
    const queueLinks = [];
    if (familyApprovals) queueLinks.push({ title: "تأیید پرونده‌ها", count: familyApprovals, subtitle: "پرونده جدید یا اصلاح اطلاعات", action: () => window.openApprovalQueue?.(), icon: "✓", tone: "warning" });
    if (actionReviews.length || overdueActions.length) queueLinks.push({ title: "تصمیم و پیگیری اقدام‌ها", count: actionReviews.length + overdueActions.length, subtitle: `${faNum(actionReviews.length)} منتظر تصمیم · ${faNum(overdueActions.length)} عقب‌افتاده`, action: () => openActionInbox(), icon: "↗", tone: overdueActions.length ? "danger" : "warning" });
    if (supervisionItems.length || supervisionLate.length) queueLinks.push({ title: data.supervision?.mode === "liaison" ? "پیگیری هفتگی خانواده‌ها" : "تأیید گزارش سرپرستی", count: supervisionItems.length + supervisionLate.length, subtitle: `${faNum(supervisionItems.length)} گزارش/موعد · ${faNum(supervisionLate.length)} عقب‌افتاده`, action: () => openSupervisionInbox(), icon: "⌁", tone: supervisionLate.length ? "danger" : "warning" });
    if (specialistItems.length) queueLinks.push({ title: "ارجاع‌های تخصصی", count: specialistItems.length, subtitle: "درمان و آموزش · نیازمند پیگیری", action: () => openSpecialistInbox(), icon: "✚", tone: "" });
    const approvalRows = data.approvals ? [...(data.approvals.newFamilies || []).map((item) => ({ ...item, queueType: "پرونده جدید" })), ...(data.approvals.changes || []).map((item) => ({ ...item, queueType: "اصلاح پرونده" }))].slice(0, 5) : [];
    const alertRows = alerts.slice(0, 5).map((item) => `<article class="ops-item"><span class="ops-item-icon ${item.severity === "critical" || item.severity === "urgent" ? "is-late" : ""}">!</span><div class="ops-item-copy"><b>${escHtml(item.title)}</b><p>${escHtml(item.message)}</p></div><button class="ops-item-action" type="button" data-attention-alert="${escHtml(item.key)}" data-family="${escHtml(item.familyId || "")}">رسیدگی</button></article>`).join("");
    const overdueRows = overdue.slice(0, 6).map((item) => `<article class="ops-item"><span class="ops-item-icon is-late">◷</span><div class="ops-item-copy"><b>${escHtml(item.headName)} · پرونده ${escHtml(item.caseNumber)}</b><p>${escHtml(item.text)}</p><small>${pill(`موعد ${jalaliDate(item.nextFollowUpAt)}`, "danger")}${pill(`${faNum(dayGap(item.nextFollowUpAt))} روز تأخیر`, "danger")}</small></div><button class="ops-item-action" type="button" data-open-attention-family="${escHtml(item.familyId)}">بازکردن پرونده</button></article>`).join("");
    const approvalItems = approvalRows.map((item) => `<article class="ops-item"><span class="ops-item-icon">✓</span><div class="ops-item-copy"><b>${escHtml(item.headName)} · پرونده ${escHtml(item.caseNumber)}</b><p>${escHtml(item.queueType)} · توسط ${escHtml(item.requestedBy || "رابط خیریه")}</p></div><button type="button" class="ops-item-action" data-open-approvals>بررسی درخواست</button></article>`).join("");
    const alertSummary = data.alerts?.unread ?? alerts.length;
    body.innerHTML = `<div class="ops-hero"><div class="ops-hero-copy"><b>${faNum(queueLinks.reduce((sum, item) => sum + item.count, 0) + overdue.length + alertSummary)} مورد برای رسیدگی شما</b><p>موارد به تفکیک کارتابل آمده‌اند؛ با انتخاب هر مورد به همان بخش بروید.</p></div></div>
      <div class="ops-metrics"><div class="ops-metric" data-tone="${familyApprovals ? "warning" : "success"}"><span>تأیید پرونده</span><b>${faNum(familyApprovals)}</b><small>پرونده یا اصلاح اطلاعات</small></div><div class="ops-metric" data-tone="${actionReviews.length ? "warning" : ""}"><span>اقدام منتظر تأیید</span><b>${faNum(actionReviews.length)}</b><small>نتیجه یا تخصیص اقدام</small></div><div class="ops-metric" data-tone="${overdue.length + overdueActions.length + supervisionLate.length ? "danger" : "success"}"><span>پیگیری عقب‌افتاده</span><b>${faNum(overdue.length + overdueActions.length + supervisionLate.length)}</b><small>نیازمند رسیدگی</small></div><div class="ops-metric"><span>هشدار خوانده‌نشده</span><b>${faNum(alertSummary)}</b><small>اعلان‌های تازه</small></div></div>
      ${queueLinks.length ? queueSection("کارتابل‌هایی که نیاز به اقدام دارند", queueLinks.length, `<div class="ops-queue-list">${queueLinks.map((item) => `<button class="ops-item" type="button" data-queue-action="${escHtml(item.title)}"><span class="ops-item-icon ${item.tone === "danger" ? "is-late" : ""}">${item.icon}</span><span class="ops-item-copy"><b>${escHtml(item.title)} · ${faNum(item.count)}</b><p>${escHtml(item.subtitle)}</p></span><span class="ops-item-action">رفتن به کارتابل ←</span></button>`).join("")}</div>`) : ""}
      ${queueSection("پیگیری‌های عقب‌افتاده", overdue.length, `<div class="ops-queue-list">${overdueRows}</div>`, "موعد گذشته است؛ پرونده را باز کنید و گام بعدی را ثبت کنید.")}
      ${approvalRows.length ? queueSection("درخواست‌های منتظر تأیید", familyApprovals, `<div class="ops-queue-list">${approvalItems}</div>`) : ""}
      ${alertSummary ? queueSection("هشدارهای خوانده‌نشده", alertSummary, `<div class="ops-queue-list">${alertRows}</div>`) : ""}
      ${!queueLinks.length && !overdue.length && !alertSummary ? empty("همه‌چیز به‌روز است", "در حال حاضر موردی برای اقدام یا تأیید ندارید.") : ""}
      ${results.some((result) => result.status === "rejected") ? '<div class="ops-warning">بعضی از کارتابل‌ها به‌دلیل محدودیت دسترسی یا خطای ارتباطی نمایش داده نشدند؛ کارتابل‌های مجاز در بالا قابل دسترسی‌اند.</div>' : ""}`;
    body.querySelectorAll("[data-queue-action]").forEach((button) => button.onclick = () => {
      const item = queueLinks.find((row) => row.title === button.dataset.queueAction);
      if (item) item.action();
    });
    body.querySelectorAll("[data-open-approvals]").forEach((button) => button.onclick = () => window.openApprovalQueue?.());
    body.querySelectorAll("[data-open-attention-family]").forEach((button) => button.onclick = () => linkFamily(button.dataset.openAttentionFamily, ".followup-history"));
    body.querySelectorAll("[data-attention-alert]").forEach((button) => button.onclick = async () => {
      try {
        await window.api(`/api/alerts/${encodeURIComponent(button.dataset.attentionAlert)}/read`, { method: "POST", body: "{}" });
        window.refreshAlertBadge?.();
        if (button.dataset.family) linkFamily(button.dataset.family);
        else openAttentionItems();
      } catch (error) { window.toast?.(error.message); }
    });
  }

  function renderSupervisionDashboard(data) {
    const summary = data.summary || {};
    const total = Number(summary.pending_reports || 0) + Number(summary.overdue_families || 0) + Number(summary.overdue_actions || 0) + Number(summary.pending_results || 0);
    const metrics = [
      ["گزارش منتظر تأیید", summary.pending_reports, "warning"],
      ["خانواده عقب‌افتاده", summary.overdue_families, "danger"],
      ["اقدام عقب‌افتاده", summary.overdue_actions, "danger"],
      ["نتیجه منتظر تأیید", summary.pending_results, "warning"],
    ];
    const liaisons = data.liaisons || [];
    const maxFamilies = Math.max(1, ...liaisons.map((item) => Number(item.families) || 0));
    const liaisonRows = liaisons.map((item) => {
      const width = Math.round((Number(item.families || 0) / maxFamilies) * 100);
      return `<div class="supervision-liaison-row"><div><b>${escHtml(item.name)}</b><small class="muted">${faNum(item.families)} خانواده · ${faNum(item.reports)} گزارش</small></div><div class="supervision-liaison-track"><i style="width:${width}%"></i></div><span>${faNum(item.on_time_percent)}٪ به‌موقع</span></div>`;
    }).join("");
    const families = (data.untrackedFamilies || []).slice(0, 30);
    const content = `<section class="ops-hero"><div class="ops-hero-copy"><b>${total ? `${faNum(total)} مورد در انتظار رسیدگی` : "برنامهٔ پیگیری در وضعیت مناسب است"}</b><p>گزارش‌های منتظر تأیید، موعدهای ازدست‌رفته و نتیجهٔ اقدامات را از همین‌جا دنبال کنید.</p></div><button class="primary" type="button" id="supervisionOpenInbox">بازکردن کارتابل پیگیری</button></section>
      <div class="supervision-dash-grid">${metrics.map(([label, value, tone]) => `<div class="ops-metric" data-tone="${tone}"><span>${label}</span><b>${faNum(value)}</b><small>نیازمند اقدام معاونت</small></div>`).join("")}</div>
      <section class="c7-report-panel"><div class="c7-report-heading"><div><span class="eyebrow">نظارت و پشتیبانی</span><h3>عملکرد رابط‌ها</h3><p>میزان پیگیری به‌موقع و تعداد پرونده‌های هر رابط</p></div><span class="count-chip">${faNum(liaisons.length)} رابط</span></div>${liaisons.length ? `<div>${liaisonRows}</div>` : empty("اطلاعات رابطی موجود نیست", "پس از ثبت گزارش‌ها، عملکرد رابط‌ها در اینجا دیده می‌شود.")}</section>
      <section class="c7-report-panel"><div class="c7-report-heading"><div><span class="eyebrow">نیازمند توجه</span><h3>خانواده‌های بدون پیگیری کافی</h3></div><span class="count-chip">${faNum(families.length)} خانواده</span></div><div class="ops-queue-list">${families.map((item) => `<button type="button" class="ops-item" data-supervision-family="${escHtml(item.familyId)}"><span class="ops-item-icon is-late">◷</span><span class="ops-item-copy"><b>${escHtml(item.headName)} · پرونده ${escHtml(item.caseNumber)}</b><p>رابط: ${escHtml(item.liaisonName || "بدون رابط")} · موعد: ${jalaliDate(item.nextDueAt)}</p></span><span class="ops-item-action">بررسی پرونده</span></button>`).join("") || empty("موردی برای هشدار نیست", "خانواده‌ها طبق برنامه پیگیری شده‌اند.")}</div></section>`;
    const body = openShell("C.7", "داشبورد معاون سرپرستی", "نمای پیگیری‌ها، گزارش‌های رابط‌ها و موارد نیازمند تصمیم.", "↗");
    body.innerHTML = `${content}${window.reportLinks?.([["liaison", "عملکرد رابط"]]) || ""}`;
    body.querySelector("#supervisionOpenInbox")?.addEventListener("click", openSupervisionInbox);
    body.querySelectorAll("[data-supervision-family]").forEach((button) => button.onclick = () => linkFamily(button.dataset.supervisionFamily, "#supervisionSection"));
  }

  // Expose globally so every dashboard shortcut and family panel uses the same work flows.
  window.followupDate = jalaliDate;
  window.openOverdue = openOverdue;
  window.openAttentionItems = openAttentionItems;
  window.openActionInbox = openActionInbox;
  window.openSupervisionInbox = openSupervisionInbox;
  window.loadWeeklyReports = loadWeeklyReports;
  window.openWeeklyReportForm = openWeeklyReportForm;
  window.loadSpecialistCases = loadSpecialistCases;
  window.createSpecialistCase = createSpecialistCase;
  window.editSpecialistCase = editSpecialistCase;
  window.nextSpecialistStatus = nextSpecialistStatus;
  window.openSpecialistInbox = openSpecialistInbox;
  window.renderSupervisionDashboard = renderSupervisionDashboard;
})();