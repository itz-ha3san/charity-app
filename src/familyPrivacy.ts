// Only these summary fields may leave the detailed endpoint without full-profile permission.
// An allowlist also protects future profile fields from accidental disclosure.
const summaryFields = [
  "id", "caseNumber", "familySurname", "headName", "headPhone", "priority",
  "archived", "approvalStatus", "assignedTo", "supervisorId", "tags",
] as const;
export function restrictedFamilyDetail(detail: Record<string, unknown>) {
  return {
    ...Object.fromEntries(summaryFields.filter(key => key in detail).map(key => [key, detail[key]])),
    profileRestricted: true,
    // Keep the frontend's collection contract without exposing member/note contents.
    members: [],
    notesHistory: [],
  };
}
