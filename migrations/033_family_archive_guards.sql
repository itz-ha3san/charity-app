-- Archived family records are read-only across every API, bulk import and
-- related business table. Audit/access logs remain appendable for traceability.
-- These shared row locks serialize writes with a concurrent archive UPDATE.
CREATE OR REPLACE FUNCTION assert_family_writable(target_family uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE is_archived boolean;
BEGIN
  IF target_family IS NULL THEN RETURN; END IF;
  SELECT archived INTO is_archived FROM families WHERE id=target_family FOR SHARE;
  IF is_archived THEN
    RAISE EXCEPTION USING ERRCODE='P7501', MESSAGE='FAMILY_ARCHIVED';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION guard_archived_family() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.archived THEN
    -- Unarchive is the only permitted modification, without smuggling changes
    -- to profile, ownership, approval or any other family field alongside it.
    IF TG_OP='UPDATE' THEN
      IF NOT NEW.archived AND
        (to_jsonb(NEW)-ARRAY['archived','updated_at']) IS NOT DISTINCT FROM
        (to_jsonb(OLD)-ARRAY['archived','updated_at']) THEN RETURN NEW; END IF;
    END IF;
    RAISE EXCEPTION USING ERRCODE='P7501', MESSAGE='FAMILY_ARCHIVED';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS families_archive_guard ON families;
CREATE TRIGGER families_archive_guard BEFORE UPDATE OR DELETE ON families
FOR EACH ROW EXECUTE FUNCTION guard_archived_family();

CREATE OR REPLACE FUNCTION guard_archived_family_child() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE old_family uuid; new_family uuid; target_family uuid;
BEGIN
  IF TG_ARGV[0]='payment' THEN
    IF TG_OP<>'INSERT' THEN
      SELECT family_id INTO old_family FROM financial_cases WHERE id=OLD.financial_case_id;
    END IF;
    IF TG_OP<>'DELETE' THEN
      SELECT family_id INTO new_family FROM financial_cases WHERE id=NEW.financial_case_id;
    END IF;
  ELSE
    IF TG_OP<>'INSERT' THEN old_family:=OLD.family_id; END IF;
    IF TG_OP<>'DELETE' THEN new_family:=NEW.family_id; END IF;
  END IF;
  -- Check both parents on reparenting; never permit moving a child out of an
  -- archived family as a way to edit or erase historical records.
  FOR target_family IN SELECT DISTINCT f FROM unnest(ARRAY[old_family,new_family]) AS t(f) WHERE f IS NOT NULL ORDER BY f LOOP
    PERFORM assert_family_writable(target_family);
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DO $$
DECLARE child_table text;
BEGIN
  FOREACH child_table IN ARRAY ARRAY[
    'family_members','notes','family_documents','family_change_requests',
    'family_supervisor_assignments','service_referrals','family_supervision_plans',
    'supervision_reports','case_actions','case_action_events','specialist_cases',
    'specialist_case_documents','specialist_case_events','financial_cases',
    'financial_case_documents','financial_case_events','family_tag_assignments',
    'donation_allocations','inventory_transactions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS family_archive_guard ON %I',child_table);
    EXECUTE format('CREATE TRIGGER family_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION guard_archived_family_child(''family'')',child_table);
  END LOOP;
END;
$$;
DROP TRIGGER IF EXISTS family_archive_guard ON financial_payments;
CREATE TRIGGER family_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON financial_payments
FOR EACH ROW EXECUTE FUNCTION guard_archived_family_child('payment');
