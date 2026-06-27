/*
# Phase 6 & 8 – Media/Delivery System & Asset Management

## Phase 6 Tables
- media_files: Image/video/PDF files linked to any entity
- deliveries: End-to-end delivery tracking with photo proof requirement

## Phase 8 Tables
- assets: Hospital asset registry with QR codes
- asset_maintenance_logs: Maintenance history per asset

## Enums
- media_file_type: image, video, pdf, document
- delivery_status: created, assigned, picked_up, in_transit, delivered, failed
- asset_type: computer, laptop, printer, cctv, biomedical, network_device, furniture, other
- asset_status: active, inactive, under_maintenance, disposed, lost
*/

DO $$ BEGIN CREATE TYPE media_file_type AS ENUM ('image','video','pdf','document'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE delivery_status AS ENUM ('created','assigned','picked_up','in_transit','delivered','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE asset_type AS ENUM ('computer','laptop','printer','cctv','biomedical','network_device','furniture','vehicle','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE asset_status AS ENUM ('active','inactive','under_maintenance','disposed','lost'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- PHASE 6: MEDIA FILES
-- ============================================================
CREATE TABLE IF NOT EXISTS media_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL,
  entity_id     uuid,
  file_type     media_file_type NOT NULL DEFAULT 'image',
  file_name     text NOT NULL,
  file_url      text NOT NULL,
  file_size     bigint,
  mime_type     text,
  description   text,
  uploaded_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mf_entity_idx ON media_files(entity_type, entity_id);

ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mf_select" ON media_files; CREATE POLICY "mf_select" ON media_files FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "mf_insert" ON media_files; CREATE POLICY "mf_insert" ON media_files FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "mf_update" ON media_files; CREATE POLICY "mf_update" ON media_files FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "mf_delete" ON media_files; CREATE POLICY "mf_delete" ON media_files FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PHASE 6: DELIVERIES
-- ============================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_number text UNIQUE NOT NULL DEFAULT 'DLV-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6),
  item_name       text NOT NULL,
  quantity        int NOT NULL DEFAULT 1,
  status          delivery_status NOT NULL DEFAULT 'created',
  from_department uuid REFERENCES departments(id) ON DELETE SET NULL,
  to_department   uuid REFERENCES departments(id) ON DELETE SET NULL,
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  picked_up_at    timestamptz,
  delivered_at    timestamptz,
  photo_url       text,
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dlv_status_idx ON deliveries(status);
CREATE INDEX IF NOT EXISTS dlv_assigned_idx ON deliveries(assigned_to);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dlv_select" ON deliveries; CREATE POLICY "dlv_select" ON deliveries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dlv_insert" ON deliveries; CREATE POLICY "dlv_insert" ON deliveries FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "dlv_update" ON deliveries; CREATE POLICY "dlv_update" ON deliveries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "dlv_delete" ON deliveries; CREATE POLICY "dlv_delete" ON deliveries FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PHASE 8: ASSETS
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag       text UNIQUE NOT NULL DEFAULT 'AST-' || substr(gen_random_uuid()::text,1,8),
  name            text NOT NULL,
  type            asset_type NOT NULL DEFAULT 'other',
  brand           text,
  model           text,
  serial_number   text,
  department_id   uuid REFERENCES departments(id) ON DELETE SET NULL,
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location        text,
  status          asset_status NOT NULL DEFAULT 'active',
  condition       text,
  purchase_date   date,
  purchase_cost   numeric(12,2),
  warranty_expiry date,
  qr_code         text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assets_status_idx ON assets(status);
CREATE INDEX IF NOT EXISTS assets_dept_idx ON assets(department_id);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assets_select" ON assets; CREATE POLICY "assets_select" ON assets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "assets_insert" ON assets; CREATE POLICY "assets_insert" ON assets FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "assets_update" ON assets; CREATE POLICY "assets_update" ON assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "assets_delete" ON assets; CREATE POLICY "assets_delete" ON assets FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PHASE 8: ASSET MAINTENANCE LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_maintenance_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL DEFAULT 'routine',
  description     text NOT NULL,
  vendor          text,
  cost            numeric(12,2),
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  next_service_date date,
  parts_replaced  text,
  notes           text,
  performed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aml_asset_idx ON asset_maintenance_logs(asset_id);

ALTER TABLE asset_maintenance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aml_select" ON asset_maintenance_logs; CREATE POLICY "aml_select" ON asset_maintenance_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "aml_insert" ON asset_maintenance_logs; CREATE POLICY "aml_insert" ON asset_maintenance_logs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "aml_update" ON asset_maintenance_logs; CREATE POLICY "aml_update" ON asset_maintenance_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "aml_delete" ON asset_maintenance_logs; CREATE POLICY "aml_delete" ON asset_maintenance_logs FOR DELETE TO authenticated USING (true);
