-- 025_hard_delete_users.sql
-- Makes a real DELETE FROM users possible so deleted accounts leave no tombstone.
-- History tables are append-only (triggers block UPDATE/DELETE), so their FKs to
-- users are dropped instead of cascaded: they keep the actor's username in text,
-- which is what the log needs, and no UPDATE is ever attempted on them.

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
ALTER TABLE public.security_events DROP CONSTRAINT IF EXISTS security_events_actor_id_fkey;
ALTER TABLE public.sensitive_access_logs DROP CONSTRAINT IF EXISTS sensitive_access_logs_actor_id_fkey;

-- History columns become optional so a deleted user's records survive unattributed.
ALTER TABLE public.case_actions ALTER COLUMN proposed_by DROP NOT NULL;
ALTER TABLE public.family_change_requests ALTER COLUMN requested_by DROP NOT NULL;
ALTER TABLE public.service_referrals ALTER COLUMN assigned_to DROP NOT NULL;
ALTER TABLE public.specialist_cases ALTER COLUMN assigned_to DROP NOT NULL;
ALTER TABLE public.supervision_reports ALTER COLUMN liaison_id DROP NOT NULL;
ALTER TABLE public.supervisors ALTER COLUMN liaison_id DROP NOT NULL;
ALTER TABLE public.uat_results ALTER COLUMN tester_id DROP NOT NULL;

-- Ownership rows (sessions, alert state, training acks, dev password log) are the
-- user's own data: remove them with the user.
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey, ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.training_acknowledgements DROP CONSTRAINT IF EXISTS training_acknowledgements_user_id_fkey, ADD CONSTRAINT training_acknowledgements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_alert_states DROP CONSTRAINT IF EXISTS user_alert_states_user_id_fkey, ADD CONSTRAINT user_alert_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_password_log DROP CONSTRAINT IF EXISTS user_password_log_user_id_fkey, ADD CONSTRAINT user_password_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Everything else keeps the record and loses only the attribution.
ALTER TABLE public.alert_settings DROP CONSTRAINT IF EXISTS alert_settings_updated_by_fkey, ADD CONSTRAINT alert_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.case_action_events DROP CONSTRAINT IF EXISTS case_action_events_actor_id_fkey, ADD CONSTRAINT case_action_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.case_actions DROP CONSTRAINT IF EXISTS case_actions_assigned_by_fkey, ADD CONSTRAINT case_actions_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.case_actions DROP CONSTRAINT IF EXISTS case_actions_assigned_to_fkey, ADD CONSTRAINT case_actions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.case_actions DROP CONSTRAINT IF EXISTS case_actions_proposed_by_fkey, ADD CONSTRAINT case_actions_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.case_actions DROP CONSTRAINT IF EXISTS case_actions_reviewed_by_fkey, ADD CONSTRAINT case_actions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.data_import_batches DROP CONSTRAINT IF EXISTS data_import_batches_created_by_fkey, ADD CONSTRAINT data_import_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.data_retention_policy DROP CONSTRAINT IF EXISTS data_retention_policy_updated_by_fkey, ADD CONSTRAINT data_retention_policy_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.donation_allocations DROP CONSTRAINT IF EXISTS donation_allocations_allocated_by_fkey, ADD CONSTRAINT donation_allocations_allocated_by_fkey FOREIGN KEY (allocated_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.donations DROP CONSTRAINT IF EXISTS donations_created_by_fkey, ADD CONSTRAINT donations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.donors DROP CONSTRAINT IF EXISTS donors_created_by_fkey, ADD CONSTRAINT donors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.families DROP CONSTRAINT IF EXISTS families_approved_by_fkey, ADD CONSTRAINT families_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.families DROP CONSTRAINT IF EXISTS families_assigned_to_fkey, ADD CONSTRAINT families_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.families DROP CONSTRAINT IF EXISTS families_created_by_fkey, ADD CONSTRAINT families_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.family_change_requests DROP CONSTRAINT IF EXISTS family_change_requests_requested_by_fkey, ADD CONSTRAINT family_change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.family_change_requests DROP CONSTRAINT IF EXISTS family_change_requests_reviewed_by_fkey, ADD CONSTRAINT family_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.family_documents DROP CONSTRAINT IF EXISTS family_documents_created_by_fkey, ADD CONSTRAINT family_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.family_documents DROP CONSTRAINT IF EXISTS family_documents_deleted_by_fkey, ADD CONSTRAINT family_documents_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.family_supervision_plans DROP CONSTRAINT IF EXISTS family_supervision_plans_updated_by_fkey, ADD CONSTRAINT family_supervision_plans_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.family_supervisor_assignments DROP CONSTRAINT IF EXISTS family_supervisor_assignments_assigned_by_fkey, ADD CONSTRAINT family_supervisor_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.family_tag_assignments DROP CONSTRAINT IF EXISTS family_tag_assignments_assigned_by_fkey, ADD CONSTRAINT family_tag_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.family_tag_definitions DROP CONSTRAINT IF EXISTS family_tag_definitions_created_by_fkey, ADD CONSTRAINT family_tag_definitions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_case_documents DROP CONSTRAINT IF EXISTS financial_case_documents_created_by_fkey, ADD CONSTRAINT financial_case_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_case_events DROP CONSTRAINT IF EXISTS financial_case_events_actor_id_fkey, ADD CONSTRAINT financial_case_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_cases DROP CONSTRAINT IF EXISTS financial_cases_approved_by_fkey, ADD CONSTRAINT financial_cases_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_cases DROP CONSTRAINT IF EXISTS financial_cases_cancelled_by_fkey, ADD CONSTRAINT financial_cases_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_cases DROP CONSTRAINT IF EXISTS financial_cases_created_by_fkey, ADD CONSTRAINT financial_cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_cases DROP CONSTRAINT IF EXISTS financial_cases_rejected_by_fkey, ADD CONSTRAINT financial_cases_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_payments DROP CONSTRAINT IF EXISTS financial_payments_created_by_fkey, ADD CONSTRAINT financial_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.fund_budgets DROP CONSTRAINT IF EXISTS fund_budgets_created_by_fkey, ADD CONSTRAINT fund_budgets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.funds DROP CONSTRAINT IF EXISTS funds_created_by_fkey, ADD CONSTRAINT funds_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.handover_checklist_items DROP CONSTRAINT IF EXISTS handover_checklist_items_completed_by_fkey, ADD CONSTRAINT handover_checklist_items_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_created_by_fkey, ADD CONSTRAINT inventory_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_created_by_fkey, ADD CONSTRAINT inventory_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_assignee_id_fkey, ADD CONSTRAINT notes_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_created_by_fkey, ADD CONSTRAINT notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_created_by_fkey, ADD CONSTRAINT notification_outbox_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.public_support_requests DROP CONSTRAINT IF EXISTS public_support_requests_reviewed_by_fkey, ADD CONSTRAINT public_support_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.report_exports DROP CONSTRAINT IF EXISTS report_exports_requested_by_fkey, ADD CONSTRAINT report_exports_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.service_referrals DROP CONSTRAINT IF EXISTS service_referrals_assigned_to_fkey, ADD CONSTRAINT service_referrals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.service_referrals DROP CONSTRAINT IF EXISTS service_referrals_created_by_fkey, ADD CONSTRAINT service_referrals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.specialist_case_documents DROP CONSTRAINT IF EXISTS specialist_case_documents_created_by_fkey, ADD CONSTRAINT specialist_case_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.specialist_case_events DROP CONSTRAINT IF EXISTS specialist_case_events_actor_id_fkey, ADD CONSTRAINT specialist_case_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.specialist_cases DROP CONSTRAINT IF EXISTS specialist_cases_assigned_to_fkey, ADD CONSTRAINT specialist_cases_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.specialist_cases DROP CONSTRAINT IF EXISTS specialist_cases_created_by_fkey, ADD CONSTRAINT specialist_cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.supervision_reports DROP CONSTRAINT IF EXISTS supervision_reports_liaison_id_fkey, ADD CONSTRAINT supervision_reports_liaison_id_fkey FOREIGN KEY (liaison_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.supervision_reports DROP CONSTRAINT IF EXISTS supervision_reports_reviewed_by_fkey, ADD CONSTRAINT supervision_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.supervisors DROP CONSTRAINT IF EXISTS supervisors_created_by_fkey, ADD CONSTRAINT supervisors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.supervisors DROP CONSTRAINT IF EXISTS supervisors_liaison_id_fkey, ADD CONSTRAINT supervisors_liaison_id_fkey FOREIGN KEY (liaison_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.uat_cycles DROP CONSTRAINT IF EXISTS uat_cycles_created_by_fkey, ADD CONSTRAINT uat_cycles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.uat_feedback DROP CONSTRAINT IF EXISTS uat_feedback_reported_by_fkey, ADD CONSTRAINT uat_feedback_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.uat_results DROP CONSTRAINT IF EXISTS uat_results_tester_id_fkey, ADD CONSTRAINT uat_results_tester_id_fkey FOREIGN KEY (tester_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.user_password_log DROP CONSTRAINT IF EXISTS user_password_log_set_by_user_id_fkey, ADD CONSTRAINT user_password_log_set_by_user_id_fkey FOREIGN KEY (set_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

