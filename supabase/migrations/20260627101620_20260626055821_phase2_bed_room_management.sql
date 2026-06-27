/*
# Phase 2 – Bed & Room Management

## New Tables
- rooms: Physical rooms per floor with type and capacity
- beds: Individual beds within rooms with real-time status
- bed_allocations: Patient-bed assignment history
- bed_transfer_requests: Requests to move a patient between beds

## Enums
- bed_status: available, occupied, maintenance, reserved
- room_type: general_ward, private_room, suite, icu, ot, recovery
- transfer_request_status: pending, approved, rejected, completed
*/

DO $$ BEGIN CREATE TYPE bed_status AS ENUM ('available','occupied','maintenance','reserved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE room_type AS ENUM ('general_ward','private_room','suite','icu','ot','recovery','nursing_station','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transfer_status AS ENUM ('pending','approved','rejected','completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number   text NOT NULL,
  floor         text NOT NULL,
  room_type     room_type NOT NULL DEFAULT 'general_ward',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  total_beds    int NOT NULL DEFAULT 1,
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooms_floor_idx ON rooms(floor);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rooms_select" ON rooms; CREATE POLICY "rooms_select" ON rooms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rooms_insert" ON rooms; CREATE POLICY "rooms_insert" ON rooms FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rooms_update" ON rooms; CREATE POLICY "rooms_update" ON rooms FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rooms_delete" ON rooms; CREATE POLICY "rooms_delete" ON rooms FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS beds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_number     text NOT NULL,
  status         bed_status NOT NULL DEFAULT 'available',
  patient_name   text,
  patient_uhid   text,
  admitted_at    timestamptz,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS beds_room_idx ON beds(room_id);
CREATE INDEX IF NOT EXISTS beds_status_idx ON beds(status);
CREATE UNIQUE INDEX IF NOT EXISTS beds_room_number_idx ON beds(room_id, bed_number);

ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "beds_select" ON beds; CREATE POLICY "beds_select" ON beds FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "beds_insert" ON beds; CREATE POLICY "beds_insert" ON beds FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "beds_update" ON beds; CREATE POLICY "beds_update" ON beds FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "beds_delete" ON beds; CREATE POLICY "beds_delete" ON beds FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS bed_allocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id          uuid NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  room_id         uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  patient_name    text NOT NULL,
  patient_uhid    text,
  age             int,
  gender          text,
  diagnosis       text,
  allocated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  discharged_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  discharged_at   timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bed_allocations_bed_idx ON bed_allocations(bed_id);
CREATE INDEX IF NOT EXISTS bed_allocations_discharged_idx ON bed_allocations(discharged_at) WHERE discharged_at IS NULL;

ALTER TABLE bed_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bed_allocations_select" ON bed_allocations; CREATE POLICY "bed_allocations_select" ON bed_allocations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bed_allocations_insert" ON bed_allocations; CREATE POLICY "bed_allocations_insert" ON bed_allocations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "bed_allocations_update" ON bed_allocations; CREATE POLICY "bed_allocations_update" ON bed_allocations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bed_allocations_delete" ON bed_allocations; CREATE POLICY "bed_allocations_delete" ON bed_allocations FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS bed_transfer_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_allocation_id uuid NOT NULL REFERENCES bed_allocations(id) ON DELETE CASCADE,
  from_bed_id     uuid NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  to_bed_id       uuid NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  status          transfer_status NOT NULL DEFAULT 'pending',
  requested_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bed_transfer_status_idx ON bed_transfer_requests(status);

ALTER TABLE bed_transfer_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bed_transfer_select" ON bed_transfer_requests; CREATE POLICY "bed_transfer_select" ON bed_transfer_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bed_transfer_insert" ON bed_transfer_requests; CREATE POLICY "bed_transfer_insert" ON bed_transfer_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "bed_transfer_update" ON bed_transfer_requests; CREATE POLICY "bed_transfer_update" ON bed_transfer_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bed_transfer_delete" ON bed_transfer_requests; CREATE POLICY "bed_transfer_delete" ON bed_transfer_requests FOR DELETE TO authenticated USING (true);

-- Seed rooms for 2nd-7th floors
INSERT INTO rooms (room_number, floor, room_type, total_beds, description) VALUES
  ('201', '2nd Floor', 'general_ward', 4, 'General Ward Room 201'),
  ('202', '2nd Floor', 'general_ward', 4, 'General Ward Room 202'),
  ('203', '2nd Floor', 'general_ward', 4, 'General Ward Room 203'),
  ('204', '2nd Floor', 'general_ward', 4, 'General Ward Room 204'),
  ('301', '3rd Floor', 'general_ward', 4, 'General Ward Room 301'),
  ('302', '3rd Floor', 'general_ward', 4, 'General Ward Room 302'),
  ('303', '3rd Floor', 'general_ward', 4, 'General Ward Room 303'),
  ('304', '3rd Floor', 'general_ward', 4, 'General Ward Room 304'),
  ('401', '4th Floor', 'private_room', 1, 'Private Room 401'),
  ('402', '4th Floor', 'private_room', 1, 'Private Room 402'),
  ('403', '4th Floor', 'private_room', 1, 'Private Room 403'),
  ('404', '4th Floor', 'private_room', 1, 'Private Room 404'),
  ('405', '4th Floor', 'private_room', 1, 'Private Room 405'),
  ('406', '4th Floor', 'private_room', 1, 'Private Room 406'),
  ('407', '4th Floor', 'private_room', 1, 'Private Room 407'),
  ('408', '4th Floor', 'suite', 2, 'Suite Room 408'),
  ('501', '5th Floor', 'private_room', 1, 'Private Room 501'),
  ('502', '5th Floor', 'private_room', 1, 'Private Room 502'),
  ('503', '5th Floor', 'private_room', 1, 'Private Room 503'),
  ('504', '5th Floor', 'private_room', 1, 'Private Room 504'),
  ('505', '5th Floor', 'private_room', 1, 'Private Room 505'),
  ('506', '5th Floor', 'private_room', 1, 'Private Room 506'),
  ('507', '5th Floor', 'private_room', 1, 'Private Room 507'),
  ('508', '5th Floor', 'suite', 2, 'Suite Room 508'),
  ('601', '6th Floor', 'icu', 1, 'ICU Bed 1'),
  ('602', '6th Floor', 'icu', 1, 'ICU Bed 2'),
  ('701', '7th Floor', 'ot', 1, 'OT 1'),
  ('702', '7th Floor', 'ot', 1, 'OT 2'),
  ('703', '7th Floor', 'recovery', 2, 'Recovery Room')
ON CONFLICT DO NOTHING;

-- Seed beds from rooms
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, room_number, total_beds FROM rooms LOOP
    FOR i IN 1..r.total_beds LOOP
      INSERT INTO beds (room_id, bed_number) VALUES (r.id, r.room_number || '–B' || i)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
