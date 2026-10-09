ALTER TABLE family_documents DROP CONSTRAINT IF EXISTS family_documents_category_check;
ALTER TABLE family_documents ADD CONSTRAINT family_documents_category_check CHECK(category IN ('شناسایی','درمانی','مالی','مسکن','آموزشی','سایر'));
