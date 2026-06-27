import { useState, useEffect, useCallback } from 'react';
import { Users, Building2, BedDouble, Activity, Clock, ArrowUpRight, Ticket, FileImage, Package, FlaskConical, Stethoscope, Pill, ClipboardList, Truck, Wrench, ChartBar as BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import { ROLE_LABELS } from '../types';
import { formatDate } from '../lib/utils';

interface DashboardStats {
  total_users: number;
  total_staff: number;
  total_departments: number;
  total_admissions: number;
  total_beds: number;
  occupied_beds: number;
  vacant_beds: number;
  total_tickets: number;
  open_tickets: number;
  assigned_tickets: number;
  in_progress_tickets: number;
  resolved_tickets: number;
  closed_tickets: number;
  escalated_tickets: number;
  total_media_files: number;
  total_assets: number;
  assets_in_maintenance: number;
  pending_discharges: number;
  pending_requisitions: number;
  pending_deliveries: number;
  total_lab_requests: number;
  total_radiology_requests: number;
  total_pharmacy_requests: number;
  total_notifications: number;
  total_audit_logs: number;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, unknown>;
  created_at: string;
  user_name?: string;
  user_role?: string;
}

export function DashboardHome() {
  const { profile, hasRole } = useAuth();
  const { navigate } = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const { data: viewData, error: viewErr } = await supabase
        .from('dashboard_stats')
        .select('*')
        .maybeSingle();

      if (!viewErr && viewData) {
        setStats(viewData as DashboardStats);
      } else {
        const { data: rpcData, error: rpcErr } = await supabase
          .rpc('get_dashboard_stats');
        if (!rpcErr && rpcData) {
          setStats(rpcData as DashboardStats);
        } else {
          const [
            usersRes, bedsRes, ticketsRes, deptsRes, mediaRes,
            assetsRes, labRes, radRes, drugRes, requisitionsRes,
            dischargeRes, deliveryRes, auditRes
          ] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('beds').select('status', { count: 'exact', head: true }),
            supabase.from('tickets').select('status', { count: 'exact', head: true }),
            supabase.from('departments').select('id', { count: 'exact', head: true }),
            supabase.from('media_files').select('id', { count: 'exact', head: true }),
            supabase.from('assets').select('id', { count: 'exact', head: true }).eq('status', 'active'),
            supabase.from('lab_requests').select('id', { count: 'exact', head: true }),
            supabase.from('radiology_requests').select('id', { count: 'exact', head: true }),
            supabase.from('drug_requests').select('id', { count: 'exact', head: true }),
            supabase.from('requisitions').select('id', { count: 'exact', head: true }).eq('status', 'created'),
            supabase.from('discharge_requests').select('id', { count: 'exact', head: true }).eq('status', 'initiated'),
            supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('status', 'created'),
            supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
          ]);
          setStats({
            total_users: usersRes.count ?? 0,
            total_staff: usersRes.count ?? 0,
            total_departments: deptsRes.count ?? 0,
            total_admissions: 0,
            total_beds: bedsRes.count ?? 0,
            occupied_beds: 0,
            vacant_beds: 0,
            total_tickets: ticketsRes.count ?? 0,
            open_tickets: 0,
            assigned_tickets: 0,
            in_progress_tickets: 0,
            resolved_tickets: 0,
            closed_tickets: 0,
            escalated_tickets: 0,
            total_media_files: mediaRes.count ?? 0,
            total_assets: assetsRes.count ?? 0,
            assets_in_maintenance: 0,
            pending_discharges: dischargeRes.count ?? 0,
            pending_requisitions: requisitionsRes.count ?? 0,
            pending_deliveries: deliveryRes.count ?? 0,
            total_lab_requests: labRes.count ?? 0,
            total_radiology_requests: radRes.count ?? 0,
            total_pharmacy_requests: drugRes.count ?? 0,
            total_notifications: 0,
            total_audit_logs: auditRes.count ?? 0,
          });
        }
      }
    } catch (e) {
      console.error('Dashboard stats fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const { data: rpcData } = await supabase.rpc('get_recent_activity', { limit_count: 10 });
      if (rpcData) {
        setRecentActivity(rpcData as AuditLogEntry[]);
        return;
      }
    } catch { /* fallback */ }

    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('id,action,entity_type,details,created_at,profile:profiles(full_name,role)')
        .order('created_at', { ascending: false })
        .limit(10);
      const mapped = (data ?? []).map((log: Record<string, unknown>) => {
        const p = log.profile as { full_name?: string; role?: string } | null;
        return {
          id: log.id as string,
          action: log.action as string,
          entity_type: log.entity_type as string,
          details: log.details as Record<string, unknown>,
          created_at: log.created_at as string,
          user_name: p?.full_name,
          user_role: p?.role,
        };
      });
      setRecentActivity(mapped);
    } catch (e) {
      console.error('Activity fetch error:', e);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchActivity();

    const tables = [
      'profiles', 'departments', 'beds', 'bed_allocations', 'tickets',
      'discharge_requests', 'media_files', 'assets', 'deliveries',
      'lab_requests', 'radiology_requests', 'drug_requests', 'requisitions',
      'audit_logs', 'notifications',
    ];
    const channel = supabase.channel('dashboard-realtime');
    tables.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        fetchStats();
        fetchActivity();
      });
    });
    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchStats, fetchActivity]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const s = stats;

  const statCards = [
    { label: 'Total Staff', value: s?.total_staff ?? 0, sub: `${s?.total_users ?? 0} total users`, icon: Users, color: 'bg-brand-blue-500', action: () => navigate('users'), canView: hasRole('super_admin', 'md', 'department_head') },
    { label: 'Departments', value: s?.total_departments ?? 0, sub: 'Hospital units', icon: Building2, color: 'bg-emerald-500', action: () => navigate('departments'), canView: true },
    { label: 'Beds', value: s?.total_beds ?? 0, sub: `${s?.occupied_beds ?? 0} occupied · ${s?.vacant_beds ?? 0} vacant`, icon: BedDouble, color: 'bg-violet-500', action: () => navigate('bed-management'), canView: true },
    { label: 'Admissions', value: s?.total_admissions ?? 0, sub: 'Active patients', icon: Activity, color: 'bg-amber-500', action: () => navigate('bed-management'), canView: true },
    { label: 'Tickets', value: s?.total_tickets ?? 0, sub: `${s?.open_tickets ?? 0} open · ${s?.in_progress_tickets ?? 0} in progress`, icon: Ticket, color: 'bg-rose-500', action: () => navigate('tickets'), canView: true },
    { label: 'Assets', value: s?.total_assets ?? 0, sub: `${s?.assets_in_maintenance ?? 0} in maintenance`, icon: Package, color: 'bg-cyan-500', action: () => navigate('assets'), canView: true },
    { label: 'Media', value: s?.total_media_files ?? 0, sub: 'Files uploaded', icon: FileImage, color: 'bg-fuchsia-500', action: () => navigate('media'), canView: true },
    { label: 'Deliveries', value: s?.pending_deliveries ?? 0, sub: 'Pending', icon: Truck, color: 'bg-orange-500', action: () => navigate('deliveries'), canView: true },
    { label: 'Lab', value: s?.total_lab_requests ?? 0, sub: 'Total requests', icon: FlaskConical, color: 'bg-teal-500', action: () => navigate('lab'), canView: true },
    { label: 'Radiology', value: s?.total_radiology_requests ?? 0, sub: 'Total requests', icon: Stethoscope, color: 'bg-indigo-500', action: () => navigate('radiology'), canView: true },
    { label: 'Pharmacy', value: s?.total_pharmacy_requests ?? 0, sub: 'Drug requests', icon: Pill, color: 'bg-pink-500', action: () => navigate('pharmacy'), canView: true },
    { label: 'Requisitions', value: s?.pending_requisitions ?? 0, sub: 'Pending', icon: ClipboardList, color: 'bg-lime-500', action: () => navigate('requisitions'), canView: true },
  ];

  const ticketBreakdown = [
    { label: 'Open', value: s?.open_tickets ?? 0, color: 'bg-sky-500' },
    { label: 'Assigned', value: s?.assigned_tickets ?? 0, color: 'bg-blue-500' },
    { label: 'In Progress', value: s?.in_progress_tickets ?? 0, color: 'bg-amber-500' },
    { label: 'Resolved', value: s?.resolved_tickets ?? 0, color: 'bg-emerald-500' },
    { label: 'Closed', value: s?.closed_tickets ?? 0, color: 'bg-slate-500' },
    { label: 'Escalated', value: s?.escalated_tickets ?? 0, color: 'bg-brand-red-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue-600 via-brand-blue-700 to-slate-800 p-6 text-white">
        <div className="relative z-10">
          <p className="text-brand-blue-200 text-sm font-medium">{greeting},</p>
          <h1 className="text-2xl font-bold mt-1">{profile?.full_name || 'Welcome'}</h1>
          <p className="text-brand-blue-300 text-sm mt-1">
            {profile ? ROLE_LABELS[profile.role] : ''} &nbsp;&middot;&nbsp;
            {formatDate(new Date().toISOString(), { dateStyle: 'full', timeStyle: undefined })}
          </p>
          <div className="flex items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AVRON ERP — Live & Synchronized
            </span>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 right-16 w-32 h-32 rounded-full bg-white/5 translate-y-10" />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-3" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-12 mb-2" />
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.filter(c => c.canView).map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="stat-card cursor-pointer group" onClick={card.action}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{card.label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{card.value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.sub}</p>
                  </div>
                  <div className={`${card.color} p-2.5 rounded-xl text-white flex-shrink-0`}>
                    <Icon size={18} />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1 text-xs text-brand-blue-600 dark:text-brand-blue-400 group-hover:gap-2 transition-all">
                  <span>View details</span>
                  <ArrowUpRight size={12} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={16} /> Ticket Breakdown
          </h2>
          <span className="text-xs text-slate-500">{s?.total_tickets ?? 0} total</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ticketBreakdown.map(item => (
            <div key={item.label} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
              <div className={`h-2 w-full rounded-full ${item.color} mb-2`} />
              <p className="text-xl font-bold text-slate-900 dark:text-white">{item.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <BedDouble size={16} /> Bed Occupancy
            </h2>
            <button onClick={() => navigate('bed-management')} className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline">Manage beds</button>
          </div>
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${s && s.total_beds > 0 ? Math.round((s.occupied_beds / s.total_beds) * 100) : 0}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-500">Occupied</span>
                    <span className="text-xs font-medium">{s && s.total_beds > 0 ? Math.round((s.occupied_beds / s.total_beds) * 100) : 0}%</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl">
                  <p className="text-xl font-bold text-emerald-600">{s?.vacant_beds ?? 0}</p>
                  <p className="text-xs text-slate-500">Vacant</p>
                </div>
                <div className="text-center p-3 bg-brand-red-50 dark:bg-brand-red-900/10 rounded-xl">
                  <p className="text-xl font-bold text-brand-red-600">{s?.occupied_beds ?? 0}</p>
                  <p className="text-xs text-slate-500">Occupied</p>
                </div>
                <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <p className="text-xl font-bold text-slate-700">{s?.total_beds ?? 0}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock size={16} /> Recent Activity
            </h2>
            {hasRole('super_admin', 'md') && (
              <button onClick={() => navigate('audit-logs')} className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline">Full log</button>
            )}
          </div>
          {activityLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4 animate-pulse" />
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No recent activity</p>
              ) : (
                recentActivity.map(log => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock size={12} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 capitalize">
                        {log.action.replace(/_/g, ' ')}
                        {log.user_name && <span className="text-slate-500 font-normal"> by {log.user_name}</span>}
                      </p>
                      <p className="text-[10px] text-slate-400">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'New Ticket', icon: Ticket, route: 'tickets', color: 'text-sky-600 bg-sky-50 dark:bg-sky-900/10' },
            { label: 'Admit Patient', icon: BedDouble, route: 'bed-management', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10' },
            { label: 'Add Asset', icon: Package, route: 'assets', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/10' },
            { label: 'Upload Media', icon: FileImage, route: 'media', color: 'text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-900/10' },
            { label: 'Lab Request', icon: FlaskConical, route: 'lab', color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/10' },
            { label: 'Maintenance', icon: Wrench, route: 'tickets', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/10' },
          ].map(action => {
            const Icon = action.icon;
            return (
              <button key={action.label} onClick={() => navigate(action.route)} className={`flex items-center gap-2 p-3 rounded-xl ${action.color} hover:opacity-80 transition-opacity text-left`}>
                <Icon size={16} />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
