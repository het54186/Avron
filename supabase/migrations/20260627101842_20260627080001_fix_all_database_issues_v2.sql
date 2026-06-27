-- ==========================================
-- FIX ALL DATABASE ISSUES FOR AVRON HOSPITALS ERP
-- ==========================================

-- ==========================================
-- 1. FIX handle_new_user TRIGGER
-- ==========================================

-- Drop the broken trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Fix the function to properly insert into profiles with all fields
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')::hospital_role,
    NEW.email,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger AFTER INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 2. FIX dashboard_stats VIEW
-- ==========================================

DROP VIEW IF EXISTS public.dashboard_stats;

CREATE OR REPLACE VIEW public.dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM public.profiles) AS total_users,
  (SELECT COUNT(*) FROM public.profiles WHERE role IN ('staff', 'department_head', 'floor_supervisor', 'it_team', 'maintenance_team', 'biomedical_team')) AS total_staff,
  (SELECT COUNT(*) FROM public.departments) AS total_departments,
  (SELECT COUNT(*) FROM public.bed_allocations WHERE discharged_at IS NULL) AS total_admissions,
  (SELECT COUNT(*) FROM public.beds) AS total_beds,
  (SELECT COUNT(*) FROM public.beds WHERE status = 'occupied') AS occupied_beds,
  (SELECT COUNT(*) FROM public.beds WHERE status = 'available') AS vacant_beds,
  (SELECT COUNT(*) FROM public.tickets) AS total_tickets,
  (SELECT COUNT(*) FROM public.tickets WHERE status = 'open') AS open_tickets,
  (SELECT COUNT(*) FROM public.tickets WHERE status = 'assigned') AS assigned_tickets,
  (SELECT COUNT(*) FROM public.tickets WHERE status = 'in_progress') AS in_progress_tickets,
  (SELECT COUNT(*) FROM public.tickets WHERE status = 'resolved') AS resolved_tickets,
  (SELECT COUNT(*) FROM public.tickets WHERE status = 'closed') AS closed_tickets,
  (SELECT COUNT(*) FROM public.tickets WHERE status = 'escalated') AS escalated_tickets,
  (SELECT COUNT(*) FROM public.media_files) AS total_media_files,
  (SELECT COUNT(*) FROM public.assets WHERE status = 'active') AS total_assets,
  (SELECT COUNT(*) FROM public.assets WHERE status = 'under_maintenance') AS assets_in_maintenance,
  (SELECT COUNT(*) FROM public.discharge_requests WHERE status = 'initiated') AS pending_discharges,
  (SELECT COUNT(*) FROM public.requisitions WHERE status = 'created') AS pending_requisitions,
  (SELECT COUNT(*) FROM public.deliveries WHERE status = 'created') AS pending_deliveries,
  (SELECT COUNT(*) FROM public.lab_requests) AS total_lab_requests,
  (SELECT COUNT(*) FROM public.radiology_requests) AS total_radiology_requests,
  (SELECT COUNT(*) FROM public.drug_requests) AS total_pharmacy_requests,
  (SELECT COUNT(*) FROM public.notifications) AS total_notifications,
  (SELECT COUNT(*) FROM public.audit_logs) AS total_audit_logs;

-- ==========================================
-- 3. ADD get_md_count FUNCTION (for login page check)
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_md_count() RETURNS bigint AS $$
  SELECT COUNT(*) FROM public.profiles WHERE role = 'md';
$$ LANGUAGE sql SECURITY DEFINER;

-- ==========================================
-- 4. ADD get_dashboard_stats FUNCTION (security definer for reliable counts)
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats() RETURNS json AS $$
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_staff', (SELECT COUNT(*) FROM public.profiles WHERE role IN ('staff', 'department_head', 'floor_supervisor', 'it_team', 'maintenance_team', 'biomedical_team')),
    'total_departments', (SELECT COUNT(*) FROM public.departments),
    'total_admissions', (SELECT COUNT(*) FROM public.bed_allocations WHERE discharged_at IS NULL),
    'total_beds', (SELECT COUNT(*) FROM public.beds),
    'occupied_beds', (SELECT COUNT(*) FROM public.beds WHERE status = 'occupied'),
    'vacant_beds', (SELECT COUNT(*) FROM public.beds WHERE status = 'available'),
    'total_tickets', (SELECT COUNT(*) FROM public.tickets),
    'open_tickets', (SELECT COUNT(*) FROM public.tickets WHERE status = 'open'),
    'assigned_tickets', (SELECT COUNT(*) FROM public.tickets WHERE status = 'assigned'),
    'in_progress_tickets', (SELECT COUNT(*) FROM public.tickets WHERE status = 'in_progress'),
    'resolved_tickets', (SELECT COUNT(*) FROM public.tickets WHERE status = 'resolved'),
    'closed_tickets', (SELECT COUNT(*) FROM public.tickets WHERE status = 'closed'),
    'escalated_tickets', (SELECT COUNT(*) FROM public.tickets WHERE status = 'escalated'),
    'total_media_files', (SELECT COUNT(*) FROM public.media_files),
    'total_assets', (SELECT COUNT(*) FROM public.assets WHERE status = 'active'),
    'assets_in_maintenance', (SELECT COUNT(*) FROM public.assets WHERE status = 'under_maintenance'),
    'pending_discharges', (SELECT COUNT(*) FROM public.discharge_requests WHERE status = 'initiated'),
    'pending_requisitions', (SELECT COUNT(*) FROM public.requisitions WHERE status = 'created'),
    'pending_deliveries', (SELECT COUNT(*) FROM public.deliveries WHERE status = 'created'),
    'total_lab_requests', (SELECT COUNT(*) FROM public.lab_requests),
    'total_radiology_requests', (SELECT COUNT(*) FROM public.radiology_requests),
    'total_pharmacy_requests', (SELECT COUNT(*) FROM public.drug_requests),
    'total_notifications', (SELECT COUNT(*) FROM public.notifications),
    'total_audit_logs', (SELECT COUNT(*) FROM public.audit_logs)
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ==========================================
-- 5. ADD get_recent_activity FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_recent_activity(limit_count int DEFAULT 10) RETURNS json AS $$
  SELECT coalesce(
    json_agg(
      json_build_object(
        'id', al.id,
        'action', al.action,
        'entity_type', al.entity_type,
        'entity_id', al.entity_id,
        'details', al.details,
        'created_at', al.created_at,
        'user_name', p.full_name,
        'user_role', p.role
      ) ORDER BY al.created_at DESC
    ),
    '[]'::json
  )
  FROM (
    SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT limit_count
  ) al
  LEFT JOIN public.profiles p ON al.user_id = p.id;
$$ LANGUAGE sql SECURITY DEFINER;
