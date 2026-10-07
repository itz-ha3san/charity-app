/* VibeFarsi component adapter for the existing vanilla/HTML frontend.
 * It only maps existing UI primitives to a consistent component vocabulary.
 * No API calls, state, or business rules are changed here.
 */
(() => {
  const map = [
    [".primary, .secondary, .danger", "vf-button"],
    [".dashboard-card, .workspace-card, .workspace-focus-card, .workspace-family-card, .metric-card, .ui-stat, .finance-card, .fund-card, .audit-card", "vf-card"],
    [".family-detail-tabs", "vf-tabs"],
    [".simple-section-toggle", "vf-accordion-trigger"],
    [".ui-table, .registry-table, .optimized-table", "vf-data-table"],
    [".ui-sidebar", "vf-sidebar"],
    [".modal, .ui-dialog-panel, .ui-sheet-panel, .quick-drawer", "vf-surface"],
  ];

  function apply(root = document) {
    for (const [selector, className] of map) {
      root.querySelectorAll?.(selector).forEach((el) => el.classList.add(className));
    }
  }

  function init() {
    apply();
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1) apply(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
