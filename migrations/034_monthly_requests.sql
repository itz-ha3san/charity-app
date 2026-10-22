-- A monthly invoice is a request bundle, never a payment or an approval.
CREATE TABLE monthly_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 liaison_id uuid REFERENCES users(id) ON DELETE SET NULL,
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 jalali_year int NOT NULL CHECK(jalali_year BETWEEN 1300 AND 1600),
 jalali_month int NOT NULL CHECK(jalali_month BETWEEN 1 AND 12),
 status text NOT NULL CHECK(status IN ('draft','submitted')),
 selected_ids jsonb NOT NULL DEFAULT '[]', snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(liaison_id,jalali_year,jalali_month)
);
CREATE TABLE monthly_request_families (
 request_id uuid NOT NULL REFERENCES monthly_requests(id),
 family_id uuid NOT NULL REFERENCES families(id),
 jalali_year int NOT NULL, jalali_month int NOT NULL,
 financial_case_id uuid REFERENCES financial_cases(id),
 PRIMARY KEY(request_id,family_id), UNIQUE(family_id,jalali_year,jalali_month)
);
CREATE TABLE monthly_request_aids (
 request_id uuid NOT NULL REFERENCES monthly_requests(id),
 family_id uuid NOT NULL REFERENCES families(id),
 financial_case_id uuid NOT NULL REFERENCES financial_cases(id),
 PRIMARY KEY(financial_case_id)
);
CREATE TRIGGER family_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON monthly_request_families
 FOR EACH ROW EXECUTE FUNCTION guard_archived_family_child('family');
CREATE TRIGGER family_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON monthly_request_aids
 FOR EACH ROW EXECUTE FUNCTION guard_archived_family_child('family');

-- Protect both the batch endpoint and the pre-existing single-family endpoint.
-- Lock the family, not only the invoice: concurrent requests for the same period
-- serialize even if no monthly case existed at the start of either transaction.
CREATE FUNCTION guard_monthly_financial_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.request_type='monthly' AND NEW.jalali_year IS NOT NULL AND NEW.jalali_month IS NOT NULL
    AND NEW.status NOT IN ('رد شده','لغو شده') THEN
  PERFORM 1 FROM families WHERE id=NEW.family_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM financial_cases fc WHERE fc.family_id=NEW.family_id
    AND fc.request_type='monthly' AND fc.jalali_year=NEW.jalali_year AND fc.jalali_month=NEW.jalali_month
    AND fc.status NOT IN ('رد شده','لغو شده') AND fc.id<>NEW.id) THEN
   RAISE EXCEPTION 'monthly period already exists' USING ERRCODE='P7502';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER monthly_period_guard BEFORE INSERT OR UPDATE OF family_id,request_type,jalali_year,jalali_month,status ON financial_cases
 FOR EACH ROW EXECUTE FUNCTION guard_monthly_financial_period();
