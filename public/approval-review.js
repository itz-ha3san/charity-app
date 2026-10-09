(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const plainObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const technicalKeys = new Set([
    "id",
    "createdAt",
    "updatedAt",
    "createdBy",
    "createdById",
    "updatedBy",
    "updatedById",
  ]);

  function sameValue(before, after) {
    const beforeEmpty =
      before === null ||
      before === undefined ||
      (typeof before === "string" && before.trim() === "");
    const afterEmpty =
      after === null ||
      after === undefined ||
      (typeof after === "string" && after.trim() === "");
    if (beforeEmpty || afterEmpty) return beforeEmpty && afterEmpty;
    if (typeof before === "number" || typeof after === "number") {
      const a = Number(before);
      const b = Number(after);
      if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
    }
    if (Array.isArray(before) || Array.isArray(after)) {
      if (!Array.isArray(before) || !Array.isArray(after))
        return false;
      return (
        before.length === after.length &&
        before.every((value, index) => sameValue(value, after[index]))
      );
    }
    if (plainObject(before) || plainObject(after)) {
      if (!plainObject(before) || !plainObject(after)) return false;
      const keys = [
        ...new Set([...Object.keys(before), ...Object.keys(after)]),
      ].filter((key) => !technicalKeys.has(key));
      return keys.every((key) => sameValue(before[key], after[key]));
    }
    return String(before).trim() === String(after).trim();
  }

  function collectDiffs(before, after, path = "") {
    if (sameValue(before, after)) return [];
    if (plainObject(after) || plainObject(before)) {
      const oldObject = plainObject(before) ? before : {};
      const newObject = plainObject(after) ? after : {};
      return [...new Set([...Object.keys(oldObject), ...Object.keys(newObject)])]
        .filter((key) => !technicalKeys.has(key))
        .flatMap((key) =>
          collectDiffs(
            oldObject[key],
            newObject[key],
            path ? `${path}.${key}` : key,
          ),
        );
    }
    if (Array.isArray(before) || Array.isArray(after)) {
      const oldArray = Array.isArray(before) ? before : [];
      const newArray = Array.isArray(after) ? after : [];
      return Array.from(
        { length: Math.max(oldArray.length, newArray.length) },
        (_, index) =>
          collectDiffs(
            oldArray[index],
            newArray[index],
            `${path}[${index}]`,
          ),
      ).flat();
    }
    return [{ path, before, after }];
  }

  function fieldTitle(path) {
    const memberMatch = path.match(/^members\[(\d+)\]\.(.+)$/);
    if (memberMatch)
      return `عضو ${fa(Number(memberMatch[1]) + 1)} · ${fieldTitle(memberMatch[2])}`;

    const nestedLabels = {
      "insurance.type": "نوع بیمه",
      "insurance.cost": "هزینه بیمه",
      "insurance.renewalDate": "تاریخ تمدید بیمه",
      "medical.hasCondition": "وضعیت بیماری",
      "medical.description": "توضیحات درمانی",
      "medical.monthlyCost": "هزینه ماهانه درمان",
      "housing.leaseRenewalDate": "موعد تمدید اجاره",
      "debt.amount": "مبلغ بدهی",
      "debt.reason": "علت بدهی",
    };
    if (nestedLabels[path]) return nestedLabels[path];
    const lastKey = path.split(".").pop().replace(/\[\d+\]/g, "");
    return label(lastKey);
  }

  function formatValue(value, path) {
    if (value === null || value === undefined || String(value).trim() === "")
      return "ثبت نشده";
    if (typeof value === "boolean") return value ? "بله" : "خیر";
    if (plainObject(value))
      return Object.keys(value).length
        ? `${fa(Object.keys(value).length)} مورد اطلاعات`
        : "ثبت نشده";
    if (Array.isArray(value))
      return value.length ? `${fa(value.length)} مورد` : "ثبت نشده";

    const key = path.split(".").pop().replace(/\[\d+\]/g, "");
    if (
      /(?:amount|cost|deposit|rent|monthlyIncome|monthlyAid|monthlyInstallments)$/i.test(
        key,
      ) &&
      Number.isFinite(Number(value))
    )
      return `${fa(Number(value))} تومان`;

    const text = String(value);
    if (/date$/i.test(key) && /^\d{4}-\d{2}-\d{2}/.test(text)) {
      const date = new Date(text);
      if (!Number.isNaN(date.getTime()))
        return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
    }
    return profileDisplayValue(text);
  }

  function renderValue(value, path) {
    const sensitive = /(?:nationalId|headCardNumber)$/i.test(
      path.split(".").pop().replace(/\[\d+\]/g, ""),
    );
    if (!sensitive || value === null || value === undefined || String(value) === "")
      return `<span class="approval-value-text">${esc(formatValue(value, path))}</span>`;

    const raw = String(value);
    const digits = raw.replace(/\D/g, "");
    const masked = digits.length > 4
      ? `••••••${fa(digits.slice(-4))}`
      : "••••";
    return `<span class="approval-sensitive-wrap"><span class="approval-value-text" data-approval-sensitive data-full="${esc(raw)}" data-masked="${esc(masked)}">${esc(masked)}</span><button class="approval-reveal" type="button" data-approval-reveal aria-pressed="false">نمایش</button></span>`;
  }

  function changedFields(item) {
    // Unversioned requests were created before the server recorded an
    // explicit patch. Their full-form snapshot is not a trustworthy list of
    // intended edits, so never present it as a set of approved changes.
    if (Number(item.proposalVersion) !== 3) return [];
    const before = item.currentData || {};
    const after = item.proposedData || {};
    const diffs = [];
    const requestedKeys = Array.isArray(item.changedFields)
      ? item.changedFields
      : Object.keys(after);
    requestedKeys.forEach((key) => {
      if (technicalKeys.has(key) || key === "supervisorId" || !Object.prototype.hasOwnProperty.call(after, key)) return;
      const entries = collectDiffs(before[key], after[key], key);
      diffs.push(
        ...entries.filter(
          (entry) =>
            !/^housing\.(?:type|deposit|rent|monthlyRent|address)$/.test(entry.path),
        ),
      );
    });

    if (
      Object.prototype.hasOwnProperty.call(after, "supervisorId") &&
      !sameValue(before.supervisorId, after.supervisorId)
    ) {
      diffs.push({
        path: "supervisorName",
        before: item.currentSupervisorName || null,
        after: item.proposedSupervisorName || null,
      });
    }
    return diffs;
  }

  function renderChangeCard(item) {
    const diffs = changedFields(item);
    const safeToApprove = Number(item.proposalVersion) === 3;
    const date = item.createdAt
      ? new Intl.DateTimeFormat("fa-IR", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(item.createdAt))
      : "زمان ثبت نامشخص";
    const changes = !safeToApprove
      ? '<div class="approval-legacy-warning" role="note"><strong>درخواست با نسخهٔ قدیمی ثبت شده است</strong><span>برای جلوگیری از تغییر ناخواستهٔ اطلاعات اعضای خانواده، این درخواست قابل تأیید نیست. از رابط بخواهید ویرایش را دوباره ثبت کند.</span></div>'
      : diffs.length
      ? diffs
          .map(
            (change) => `<div class="approval-diff-row">
              <strong class="approval-diff-label">${esc(fieldTitle(change.path))}</strong>
              <div class="approval-diff-values">
                <div class="approval-diff-value is-current"><small>اطلاعات فعلی</small>${renderValue(change.before, change.path)}</div>
                <span class="approval-diff-arrow" aria-hidden="true">←</span>
                <div class="approval-diff-value is-proposed"><small>درخواست رابط</small>${renderValue(change.after, change.path)}</div>
              </div>
            </div>`,
          )
          .join("")
      : '<div class="approval-no-diff">برای این درخواست اختلاف قابل‌نمایشی پیدا نشد؛ خود پرونده را پیش از تصمیم بررسی کنید.</div>';

    return `<article class="approval-request-card is-change">
      <header class="approval-request-head">
        <span class="approval-request-icon" aria-hidden="true">✎</span>
        <div class="approval-request-title">
          <span class="eyebrow">درخواست اصلاح پرونده</span>
          <h3>${esc(item.headName)} <span>· پرونده ${esc(item.caseNumber)}</span></h3>
          <p>ثبت‌شده توسط ${esc(item.requestedBy || "رابط خیریه")} · ${esc(date)}</p>
        </div>
        <span class="approval-change-count">${fa(diffs.length)} تغییر</span>
      </header>
      <section class="approval-diff-list" aria-label="مقایسه تغییرات پیشنهادی">
        <div class="approval-diff-heading"><strong>تغییرات پیشنهادی</strong><span>فعلی ← مقدار درخواستی</span></div>
        ${changes}
      </section>
      <footer class="approval-request-footer">
        <button class="secondary" type="button" data-approval-family="${esc(item.familyId)}">مشاهده پرونده فعلی</button>
        <div class="approval-request-actions">
          <button class="danger" type="button" data-review="${esc(item.id)}" data-kind="change" data-decision="reject">رد درخواست</button>
          ${safeToApprove ? `<button class="primary" type="button" data-review="${esc(item.id)}" data-kind="change" data-decision="approve">تأیید تغییرات</button>` : ""}
        </div>
      </footer>
    </article>`;
  }

  function renderNewFamilyCard(item) {
    const date = item.createdAt
      ? new Intl.DateTimeFormat("fa-IR", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(item.createdAt))
      : "زمان ثبت نامشخص";
    return `<article class="approval-request-card is-create">
      <header class="approval-request-head">
        <span class="approval-request-icon" aria-hidden="true">＋</span>
        <div class="approval-request-title">
          <span class="eyebrow">پرونده جدید · در انتظار تأیید</span>
          <h3>${esc(item.headName)} <span>· پرونده ${esc(item.caseNumber)}</span></h3>
          <p>ثبت‌شده توسط ${esc(item.requestedBy || "رابط خیریه")} · ${esc(date)}</p>
        </div>
      </header>
      <footer class="approval-request-footer">
        <button class="secondary" type="button" data-approval-family="${esc(item.id)}">مشاهده پرونده</button>
        <div class="approval-request-actions">
          <button class="danger" type="button" data-review="${esc(item.id)}" data-kind="create" data-decision="reject">رد پرونده</button>
          <button class="primary" type="button" data-review="${esc(item.id)}" data-kind="create" data-decision="approve">تأیید پرونده</button>
        </div>
      </footer>
    </article>`;
  }

  function bindQueueActions() {
    document.querySelectorAll("#modalRoot [data-close]").forEach((button) => {
      button.onclick = () => window.closeModal();
    });
    document.querySelectorAll("#modalRoot [data-review]").forEach((button) => {
      button.onclick = () =>
        openDecisionDialog(
          button.dataset.review,
          button.dataset.kind,
          button.dataset.decision,
        );
    });
    document.querySelectorAll("#modalRoot [data-approval-family]").forEach((button) => {
      button.onclick = () => window.openFamilyRecord?.(button.dataset.approvalFamily);
    });
    document.querySelectorAll("#modalRoot [data-approval-reveal]").forEach((button) => {
      button.onclick = () => {
        const value = button.closest(".approval-sensitive-wrap")?.querySelector("[data-approval-sensitive]");
        if (!value) return;
        const reveal = button.getAttribute("aria-pressed") !== "true";
        value.textContent = reveal ? value.dataset.full : value.dataset.masked;
        button.setAttribute("aria-pressed", String(reveal));
        button.textContent = reveal ? "پنهان" : "نمایش";
      };
    });
  }

  function openDecisionDialog(id, kind, decision) {
    const approving = decision === "approve";
    const noun = kind === "change" ? "تغییرات" : "پرونده";
    $("#modalRoot").innerHTML = `<div class="modal-backdrop approval-decision-backdrop">
      <section class="modal approval-decision-dialog" role="dialog" aria-modal="true" aria-labelledby="approvalDecisionTitle">
        <button class="close-btn" type="button" data-close aria-label="بستن">×</button>
        <span class="approval-decision-mark ${approving ? "is-approve" : "is-reject"}" aria-hidden="true">${approving ? "✓" : "!"}</span>
        <span class="eyebrow">ثبت تصمیم معاون</span>
        <h2 id="approvalDecisionTitle">${approving ? `تأیید ${noun}` : `رد ${noun}`}</h2>
        <p>دلیل تصمیم را بنویسید تا در سابقه پرونده ثبت شود.</p>
        <form id="approvalDecisionForm">
          <label for="approvalDecisionNote">دلیل تصمیم <span aria-hidden="true">*</span></label>
          <textarea id="approvalDecisionNote" name="note" minlength="3" maxlength="1000" required placeholder="${approving ? "چه چیزی بررسی و تأیید شد؟" : "علت رد درخواست را توضیح دهید…"}"></textarea>
          <div class="message error" id="approvalDecisionError" role="alert"></div>
          <div class="approval-decision-actions">
            <button class="secondary" type="button" data-close>بازگشت</button>
            <button class="${approving ? "primary" : "danger"}" id="approvalDecisionSubmit" type="submit">${approving ? "ثبت تأیید" : "ثبت رد درخواست"}</button>
          </div>
        </form>
      </section>
    </div>`;
    bindQueueActions();
    const form = $("#approvalDecisionForm");
    form.onsubmit = async (event) => {
      event.preventDefault();
      const note = $("#approvalDecisionNote").value.trim();
      if (note.length < 3) {
        $("#approvalDecisionError").textContent = "دلیل تصمیم باید دست‌کم ۳ نویسه باشد.";
        return;
      }
      const submit = $("#approvalDecisionSubmit");
      submit.disabled = true;
      submit.classList.add("button-loading");
      const url =
        kind === "create"
          ? `/api/families/${encodeURIComponent(id)}/review`
          : `/api/family-change-requests/${encodeURIComponent(id)}/review`;
      try {
        await window.api(url, {
          method: "POST",
          body: JSON.stringify({ decision, note }),
        });
        window.closeModal();
        window.toast("تصمیم ثبت شد.");
        await window.openApprovalQueue();
        window.loadFamilies?.();
      } catch (error) {
        $("#approvalDecisionError").textContent =
          error.message || "ثبت تصمیم انجام نشد.";
        submit.disabled = false;
        submit.classList.remove("button-loading");
      }
    };
    $("#approvalDecisionNote").focus();
  }

  window.openApprovalQueue = async function openApprovalQueue() {
    try {
      const data = await window.api("/api/approvals/families");
      const changes = data.changes || [];
      const newFamilies = data.newFamilies || [];
      const total = changes.length + newFamilies.length;
      $("#modalRoot").innerHTML = `<div class="modal-backdrop approval-queue-backdrop">
        <section class="modal approval-queue-modal" role="dialog" aria-modal="true" aria-labelledby="approvalQueueTitle">
          <header class="approval-queue-header">
            <button class="close-btn" type="button" data-close aria-label="بستن">×</button>
            <div class="approval-queue-heading">
              <span class="approval-queue-icon" aria-hidden="true">✓</span>
              <div><span class="eyebrow">بررسی و تصمیم سطح بالاتر</span><h2 id="approvalQueueTitle">کارتابل تأییدها</h2><p>پیش از تصمیم، مقدار فعلی را با پیشنهاد رابط مقایسه کنید.</p></div>
            </div>
            <span class="approval-queue-total">${fa(total)} مورد در انتظار</span>
          </header>
          <div class="approval-queue-body">
            ${changes.length ? `<section class="approval-queue-section"><div class="approval-queue-section-title"><div><h3>اصلاح اطلاعات پرونده‌ها</h3><p>تغییرهای هر درخواست به‌صورت «فعلی / پیشنهادی» نمایش داده شده است.</p></div><span>${fa(changes.length)} درخواست</span></div>${changes.map(renderChangeCard).join("")}</section>` : ""}
            ${newFamilies.length ? `<section class="approval-queue-section"><div class="approval-queue-section-title"><div><h3>پرونده‌های تازه</h3><p>پرونده‌های ایجادشده که هنوز تأیید نشده‌اند.</p></div><span>${fa(newFamilies.length)} پرونده</span></div>${newFamilies.map(renderNewFamilyCard).join("")}</section>` : ""}
            ${total ? "" : '<div class="approval-queue-empty"><span aria-hidden="true">✓</span><strong>کارتابل خالی است</strong><p>در حال حاضر پرونده یا تغییری برای بررسی ندارید.</p></div>'}
          </div>
        </section>
      </div>`;
      bindQueueActions();
    } catch (error) {
      window.toast(error.message || "دریافت کارتابل تأییدها ناموفق بود.");
    }
  };
})();