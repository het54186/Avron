/*
# Phase 4 – Ticketing System

## New Tables
- tickets: IT, Maintenance, Biomedical, FMS tickets with SLA tracking
- ticket_comments: Discussion thread per ticket
- ticket_escalations: Escalation history

## SLA Deadlines (auto-computed on insert)
- Critical: 30 min | High: 90 min | Medium: 3 hrs | Low: 5 hrs

## Enums
- ticket_type: it, maintenance, biomedical, fms
- ticket_priority: low, medium, high, critical
- ticket_status: open, assigned, in_progress, escalated, resolved, closed, reopened
*/

DO $$ BEGIN CREATE TYPE ticket_type AS ENUM ('it','maintenance','biomedical','fms'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ticket_priority AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ticket_status AS ENUM ('open','assigned','in_progress','escalated','resolved','closed','reopened'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tickets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number  text UNIQUE NOT NULL DEFAULT 'TKT-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6),
  title          text NOT NULL,
  description    text NOT NULL,
  type           ticket_type NOT NULL,
  priority       ticket_priority NOT NULL DEFAULT 'medium',
  status         ticket_status NOT NULL DEFAULT 'open',
  department_id  uuid REFERENCES departments(id) ON DELETE SET NULL,
  location       text,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sla_deadline   timestamptz,
  assigned_at    timestamptz,
  resolved_at    timestamptz,
  closed_at      timestamptz,
  resolution_notes text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
CREATE INDEX IF NOT EXISTS tickets_priority_idx ON tickets(priority);
CREATE INDEX IF NOT EXISTS tickets_type_idx ON tickets(type);
CREATE INDEX IF NOT EXISTS tickets_assigned_idx ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS tickets_created_by_idx ON tickets(created_by);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tickets_select" ON tickets; CREATE POLICY "tickets_select" ON tickets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tickets_insert" ON tickets; CREATE POLICY "tickets_insert" ON tickets FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "tickets_update" ON tickets; CREATE POLICY "tickets_update" ON tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tickets_delete" ON tickets; CREATE POLICY "tickets_delete" ON tickets FOR DELETE TO authenticated USING (true);

-- SLA auto-computation
CREATE OR REPLACE FUNCTION compute_ticket_sla_deadline() RETURNS trigger AS $$
BEGIN
  NEW.sla_deadline := now() + INTERVAL '30 minutes';
  IF NEW.priority = 'high'    THEN NEW.sla_deadline := now() + INTERVAL '90 minutes'; END IF;
  IF NEW.priority = 'medium'  THEN NEW.sla_deadline := now() + INTERVAL '3 hours'; END IF;
  IF NEW.priority = 'low'     THEN NEW.sla_deadline := now() + INTERVAL '5 hours'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ticket_sla'
  ) THEN
    CREATE TRIGGER trg_ticket_sla
      BEFORE INSERT ON tickets
      FOR EACH ROW EXECUTE FUNCTION compute_ticket_sla_deadline();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS ticket_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  comment       text NOT NULL,
  is_internal   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_comments_ticket_idx ON ticket_comments(ticket_id);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_comments_select" ON ticket_comments; CREATE POLICY "ticket_comments_select" ON ticket_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ticket_comments_insert" ON ticket_comments; CREATE POLICY "ticket_comments_insert" ON ticket_comments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ticket_comments_update" ON ticket_comments; CREATE POLICY "ticket_comments_update" ON ticket_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ticket_comments_delete" ON ticket_comments; CREATE POLICY "ticket_comments_delete" ON ticket_comments FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS ticket_escalations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  escalated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  escalated_to   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_escalations_ticket_idx ON ticket_escalations(ticket_id);

ALTER TABLE ticket_escalations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_escalations_select" ON ticket_escalations; CREATE POLICY "ticket_escalations_select" ON ticket_escalations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ticket_escalations_insert" ON ticket_escalations; CREATE POLICY "ticket_escalations_insert" ON ticket_escalations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ticket_escalations_update" ON ticket_escalations; CREATE POLICY "ticket_escalations_update" ON ticket_escalations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ticket_escalations_delete" ON ticket_escalations; CREATE POLICY "ticket_escalations_delete" ON ticket_escalations FOR DELETE TO authenticated USING (true);
