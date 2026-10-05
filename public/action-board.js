(() => {
  const fa = (v) => new Intl.NumberFormat("fa-IR").format(Number(v) || 0);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const actor = () => window.currentActor || {};
  const notify = (text) => typeof window.toast === "function" ? window.toast(text) : console.info(text);
  const priorityLabels = { low: "کم", medium: "متوسط", high: "بالا", urgent: "فوری" };
  const domainLabels = { general: "عمومی", health: "درمان", education: "آموزش" };
  const statusLabels = { proposed: "برنامه‌ریزی", assigned: "در حال انجام", revision_requested: "نیازمند اصلاح", completed: "منتظر تأیید", approved: "انجام‌شده", cancelled: "لغوشده" };
  const stageOf = (status) => status === "proposed" ? "planned" : ["assigned", "revision_requested"].includes(status) ? "doing" : status === "completed" ? "waiting" : "done";
  const stages = [
    ["planned", "برنامه‌ریزی‌شده"],
    ["doing", "در حال انجام"],
    ["waiting", "منتظر پاسخ"],
    ["done", "انجام‌شده"],
  ];
  let currentFamily = null;
  let currentData = null;
  let currentBox = null;

  async function request(path, options = {}) {
    const response = await fetch(path, { credentials: "include", ...options, headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "درخواست انجام نشد.");
    return data;
  }

  const isReviewer = () => actor().role === "admin" || ["ceo", "supervision_deputy"].includes(actor().position);
  const canCreate = () => ["admin", "caseworker"].includes(actor().role);
  const isOverdue = (action) => Boolean(action.dueAt && new Date(`${action.dueAt}T23:59:59`) < new Date() && !["approved", "cancelled"].includes(action.status));
  const dateFa = (value) => value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value)) : "بدون مهلت";

  function card(action) {
    const overdue = isOverdue(action);
    const user = actor();
    const canComplete = action.assignedToId === user.id && ["assigned", "revision_requested"].includes(action.status);
    const source = action.sourceNoteId ? "از پیگیری" : action.supervisionReportId ? "از گزارش هفتگی" : "ثبت مستقیم";
    const controls = [
      isReviewer() && ["proposed", "assigned", "revision_requested"].includes(action.status) ? `<button class="secondary" data-action-assign="${action.id}">${action.assignedToId ? "تغییر مسئول" : "تخصیص مسئول"}</button>` : "",
      canComplete ? `<button class="primary" data-action-complete="${action.id}">اعلام انجام</button>` : "",
      isReviewer() && action.status === "completed" ? `<button class="primary" data-action-review="${action.id}" data-decision="approve">تأیید نتیجه</button><button class="secondary" data-action-review="${action.id}" data-decision="revision">نیازمند اصلاح</button>` : "",
      action.status === "approved" && action.financialStatus === "none" ? `<button class="secondary" data-action-finance="${action.id}">درخواست مالی</button>` : "",
    ].join("");
    return `<article class="action-card" data-action-card data-stage="${stageOf(action.status)}" data-status="${action.status}" data-assignee="${esc(action.assignedToId || "")}" data-priority="${action.priority || "medium"}" data-overdue="${overdue}">
      <div class="action-card-top"><span class="action-priority" data-priority="${action.priority || "medium"}">${priorityLabels[action.priority] || "متوسط"}</span><span class="action-domain">${domainLabels[action.domain] || "عمومی"}</span></div>
      <h4>${esc(action.title)}</h4>${action.description ? `<p>${esc(action.description)}</p>` : ""}
      <div class="action-card-meta"><span>${esc(action.assignedToName || "بدون مسئول")}</span><span class="${overdue ? "is-overdue" : ""}">${overdue ? "عقب‌افتاده · " : ""}${dateFa(action.dueAt)}</span></div>
      <div class="action-card-source"><span>${source}</span><b>${statusLabels[action.status] || action.status}</b></div>
      ${action.completionNote ? `<div class="action-result"><b>نتیجه:</b> ${esc(action.completionNote)}</div>` : ""}
      ${controls ? `<div class="action-card-actions">${controls}</div>` : ""}
    </article>`;
  }

  function render(family, data, box = currentBox) {
    currentFamily = family; currentData = data; currentBox = box;
    if (!box) return;
    const actions = data.actions || [];
    const completed = actions.filter((a) => ["approved", "cancelled"].includes(a.status)).length;
    const overdue = actions.filter(isOverdue).length;
    const progress = actions.length ? Math.round((completed / actions.length) * 100) : 0;
    const assignees = [...new Map(actions.filter((a) => a.assignedToId).map((a) => [a.assignedToId, a.assignedToName])).entries()];
    box.className = "action-board-section";
    box.innerHTML = `<div class="action-board-head"><div><div class="eyebrow">برنامه عملیاتی پرونده</div><h3>اقدامات</h3><p>کار بعدی هر پرونده را ساده و مرحله‌به‌مرحله جلو ببرید.</p></div>${canCreate() && !family.archived ? '<button class="primary" data-new-action>+ اقدام جدید</button>' : ""}</div>
      <div class="action-progress"><div><span>پیشرفت اقدامات</span><b>${fa(progress)}٪</b></div><div class="action-progress-track"><span style="width:${progress}%"></span></div><small>${fa(completed)} از ${fa(actions.length)} اقدام بسته شده · ${fa(overdue)} عقب‌افتاده</small></div>
      <div class="action-filters"><select data-action-status aria-label="فیلتر وضعیت"><option value="all">همه وضعیت‌ها</option>${stages.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select><select data-action-assignee aria-label="فیلتر مسئول"><option value="all">همه مسئولان</option>${assignees.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join("")}</select><select data-action-priority aria-label="فیلتر اولویت"><option value="all">همه اولویت‌ها</option>${Object.entries(priorityLabels).map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select><button type="button" data-action-overdue aria-pressed="false">فقط عقب‌افتاده‌ها</button></div>
      <div class="action-mobile-tabs" role="tablist">${stages.map(([v,l],i)=>`<button type="button" data-stage-tab="${v}" aria-selected="${i===0}">${l}<b>${fa(actions.filter(a=>stageOf(a.status)===v).length)}</b></button>`).join("")}</div>
      <div class="action-kanban">${stages.map(([stage,label])=>`<section class="action-column" data-column="${stage}"><header><span>${label}</span><b>${fa(actions.filter(a=>stageOf(a.status)===stage).length)}</b></header><div>${actions.filter(a=>stageOf(a.status)===stage).map(card).join("") || '<div class="action-column-empty">موردی در این مرحله نیست.</div>'}</div></section>`).join("")}</div>
      <div class="action-filter-empty" hidden>اقدامی با این فیلترها پیدا نشد.</div>`;
    bind(box);
  }

  function applyFilters(box) {
    const status = box.querySelector("[data-action-status]").value;
    const assignee = box.querySelector("[data-action-assignee]").value;
    const priority = box.querySelector("[data-action-priority]").value;
    const overdue = box.querySelector("[data-action-overdue]").getAttribute("aria-pressed") === "true";
    let visible = 0;
    box.querySelectorAll("[data-action-card]").forEach((item) => {
      const show = (status === "all" || item.dataset.stage === status) && (assignee === "all" || item.dataset.assignee === assignee) && (priority === "all" || item.dataset.priority === priority) && (!overdue || item.dataset.overdue === "true");
      item.hidden = !show; if (show) visible++;
    });
    box.querySelector(".action-filter-empty").hidden = visible !== 0;
    box.querySelectorAll(".action-column").forEach((column) => column.classList.toggle("is-empty-filter", !column.querySelector('[data-action-card]:not([hidden])')));
  }

  function bind(box) {
    box.querySelector("[data-new-action]")?.addEventListener("click", () => openCreate(currentFamily));
    box.querySelectorAll(".action-filters select").forEach((select) => select.onchange = () => applyFilters(box));
    const overdue = box.querySelector("[data-action-overdue]");
    overdue.onclick = () => { overdue.setAttribute("aria-pressed", String(overdue.getAttribute("aria-pressed") !== "true")); applyFilters(box); };
    const showMobileStage = (stage) => {
      box.dataset.mobileStage = stage;
      box.querySelectorAll("[data-stage-tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.stage === stage)));
      box.querySelectorAll(".action-column").forEach((column) => column.classList.toggle("is-mobile-active", column.dataset.column === stage));
    };
    box.querySelectorAll("[data-stage-tab]").forEach((tab) => tab.onclick = () => showMobileStage(tab.dataset.stage));
    showMobileStage("planned");
    box.querySelectorAll("[data-action-assign]").forEach((b) => b.onclick = () => openAssign(currentFamily, currentData.actions.find((a)=>a.id===b.dataset.actionAssign)));
    box.querySelectorAll("[data-action-complete]").forEach((b) => b.onclick = () => openComplete(currentFamily, b.dataset.actionComplete));
    box.querySelectorAll("[data-action-review]").forEach((b) => b.onclick = () => review(currentFamily, b.dataset.actionReview, b.dataset.decision));
    box.querySelectorAll("[data-action-finance]").forEach((b) => b.onclick = () => typeof window.openSourceFinancialForm === "function" && window.openSourceFinancialForm(currentFamily,"action",b.dataset.actionFinance));
  }

  function modal(content) { document.querySelector("#modalRoot").innerHTML = `<div class="modal-backdrop"><div class="modal action-modal">${content}</div></div>`; document.querySelectorAll("[data-close]").forEach((b)=>b.onclick=()=>document.querySelector("#modalRoot").innerHTML=""); }
  const quickDates = () => `<div class="action-quick-dates"><button type="button" data-action-days="0">امروز</button><button type="button" data-action-days="1">فردا</button><button type="button" data-action-days="7">یک هفته بعد</button></div>`;
  const dateAfter = (days) => { const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); };

  function openCreate(family, source = {}) {
    modal(`<div class="modal-head"><div><div class="eyebrow">یک کار روشن و قابل پیگیری</div><h2>اقدام جدید</h2></div><button class="close-btn" data-close>×</button></div><form id="actionCreateForm"><div class="action-source-note" ${source.sourceNoteId ? "" : "hidden"}><b>ایجاد از پیگیری</b><p>${esc(source.text || "")}</p></div><div class="form-grid"><div class="form-field full"><label>عنوان اقدام *</label><input name="title" required minlength="3" placeholder="مثلاً تکمیل مدارک هویتی"></div><div class="form-field"><label>حوزه</label><select name="domain"><option value="general">عمومی</option><option value="health">درمان</option><option value="education">آموزش</option></select></div><div class="form-field"><label>اولویت</label><select name="priority"><option value="medium">متوسط</option><option value="high">بالا</option><option value="urgent">فوری</option><option value="low">کم</option></select></div><div class="form-field full"><label>شرح کوتاه</label><textarea name="description" placeholder="نتیجه مورد انتظار را کوتاه بنویسید">${esc(source.text || "")}</textarea></div></div><div class="modal-actions"><button class="primary" type="submit">ثبت اقدام</button><button class="secondary" type="button" data-close>انصراف</button></div></form>`);
    document.querySelector("#actionCreateForm").onsubmit = async (e) => { e.preventDefault(); const fd=new FormData(e.currentTarget); try { await request(`/api/families/${family.id}/actions`,{method:"POST",body:JSON.stringify({title:fd.get("title"),description:fd.get("description"),domain:fd.get("domain"),priority:fd.get("priority"),sourceNoteId:source.sourceNoteId||null})}); document.querySelector("#modalRoot").innerHTML=""; notify("اقدام ثبت شد."); load(family,currentBox); } catch(err){ notify(err.message); } };
  }

  async function openAssign(family, action) {
    try { let users=(await request("/api/assignees")).users; if(action.domain==="health")users=users.filter(u=>u.position==="health_officer"); if(action.domain==="education")users=users.filter(u=>u.position==="education_officer"); modal(`<div class="modal-head"><div><div class="eyebrow">تخصیص اقدام</div><h2>${esc(action.title)}</h2></div><button class="close-btn" data-close>×</button></div><form id="actionAssignForm"><div class="form-grid"><div class="form-field"><label>مسئول *</label><select name="assigneeId" required><option value="">انتخاب کنید</option>${users.map(u=>`<option value="${u.id}" ${u.id===action.assignedToId?"selected":""}>${esc(u.name)}</option>`).join("")}</select></div><div class="form-field"><label>مهلت *</label><input type="date" name="dueDate" required value="${action.dueAt||dateAfter(7)}">${quickDates()}</div><div class="form-field full"><label>توضیح تخصیص</label><textarea name="note">${esc(action.assignmentNote||"")}</textarea></div></div><div class="modal-actions"><button class="primary" type="submit">تخصیص و شروع</button><button class="secondary" type="button" data-close>انصراف</button></div></form>`); const form=document.querySelector("#actionAssignForm"); form.querySelectorAll("[data-action-days]").forEach(b=>b.onclick=()=>form.elements.dueDate.value=dateAfter(Number(b.dataset.actionDays))); form.onsubmit=async(e)=>{e.preventDefault();const fd=new FormData(form);try{await request(`/api/actions/${action.id}/assign`,{method:"POST",body:JSON.stringify(Object.fromEntries(fd))});document.querySelector("#modalRoot").innerHTML="";notify("اقدام به مسئول مربوط تخصیص یافت.");load(family,currentBox)}catch(err){notify(err.message)}}; } catch(err){notify(err.message)}
  }

  function openComplete(family,id){ modal(`<div class="modal-head"><div><div class="eyebrow">اعلام نتیجه</div><h2>این اقدام انجام شد؟</h2></div><button class="close-btn" data-close>×</button></div><form id="actionCompleteForm"><div class="form-field"><label>نتیجه انجام اقدام *</label><textarea name="result" required minlength="3" placeholder="نتیجه را کوتاه و مشخص بنویسید"></textarea></div><div class="modal-actions"><button class="primary" type="submit">ارسال برای تأیید</button><button class="secondary" type="button" data-close>انصراف</button></div></form>`); document.querySelector("#actionCompleteForm").onsubmit=async(e)=>{e.preventDefault();try{await request(`/api/actions/${id}/complete`,{method:"POST",body:JSON.stringify({result:new FormData(e.currentTarget).get("result")})});document.querySelector("#modalRoot").innerHTML="";notify("نتیجه برای تأیید ارسال شد.");load(family,currentBox)}catch(err){notify(err.message)}}; }
  async function review(family,id,decision){const note=decision==="revision"?prompt("دلیل اصلاح را کوتاه بنویسید:")||"":"";if(decision==="revision"&&note.trim().length<3)return;try{await request(`/api/actions/${id}/review`,{method:"POST",body:JSON.stringify({decision,note})});notify(decision==="approve"?"نتیجه تأیید شد.":"برای اصلاح بازگردانده شد.");load(family,currentBox)}catch(err){notify(err.message)}}
  async function load(family, box = currentBox) { currentFamily=family; currentBox=box||document.querySelector("#actionSection"); if(!currentBox)return; currentBox.innerHTML='<div class="panel-loading">در حال دریافت اقدامات…</div>'; try{const data=await request(`/api/families/${family.id}/actions`);render(family,data,currentBox)}catch(err){currentBox.innerHTML=`<div class="empty-state">${esc(err.message)}</div>`} }

  window.ActionBoard = { load, render, openCreate };
})();
