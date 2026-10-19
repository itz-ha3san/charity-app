export const financialStatuses = ["درخواست جدید", "در بررسی", "تأیید شده", "ارجاع به حسابدار", "پرداخت شده", "رد شده", "لغو شده"] as const;
export const financialTransitionRules = {
    review: { from: ["درخواست جدید"], to: "در بررسی" },
    approve: { from: ["در بررسی"], to: "تأیید شده" },
    reject: { from: ["درخواست جدید", "در بررسی", "تأیید شده"], to: "رد شده" },
    refer: { from: ["تأیید شده"], to: "ارجاع به حسابدار" },
    queue_payment: { from: ["تأیید شده"], to: "ارجاع به حسابدار" },
    cancel: { from: ["درخواست جدید", "در بررسی", "تأیید شده", "ارجاع به حسابدار"], to: "لغو شده" },
} as const;
export type FinancialAction = keyof typeof financialTransitionRules;
export interface FinancialDecision {
    action: FinancialAction;
    reason?: string;
    approvedAmount?: number;
}
export const reviewStatuses = { approve: 'approved', reject: 'rejected', cancel: 'cancelled' } as const;
export function reviewStatus(decision: keyof typeof reviewStatuses) { return reviewStatuses[decision]; }
