import { useState, useEffect } from 'react';
import {
  Users, Building2, BedDouble, Activity, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, ArrowUpRight, Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import { ROLE_LABELS, FLOORS } from '../types';
import { formatDate } from '../lib/utils';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalDepartments: number;
  activeDepartments: number;
}

export function DashboardHome() {
  const { profile, hasRole } = useAuth();
  const { navigate } = useRouter();
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, totalDepartments: 0, activeDepartments: 0 });
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string; action: string; details: Record<string, unknown>; created_at: string;
  }>>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [usersRes, deptRes, activityRes] = await Promise.all([
        supabase.from('profiles').select('id, is_active'),
        supabase.from('departments').select('id, is_active'),
        supabase.from('audit_logs').select('id,action,details,created_at').order('created_at', { ascending: false }).limit(8),
      ]);

      const users = usersRes.data ?? [];
      const depts = deptRes.data ?? [];

      setStats({
        totalUsers: users.length,
        activeUsers: users.filter(u => u.is_active).length,
        totalDepartments: depts.length,
        activeDepartments: depts.filter(d => d.is_active).length,
      });

      setRecentActivity(activityRes.data ?? []);
    };

    fetchStats();

    // Real-time subscriptions — refresh dashboard on any change to core tables
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const statCards = [
    {
      label: 'Total Staff',
      value: stats.totalUsers,
      sub: `${stats.activeUsers} active`,
      icon: Users,
      color: 'bg-brand-blue-500',
      action: () => navigate('users'),
      canView: hasRole('super_admin', 'md', 'department_head'),
    },
    {
      label: 'Departments',
      value: stats.totalDepartments,
      sub: `${stats.activeDepartments} operational`,
      icon: Building2,
      color: 'bg-emerald-500',
      action: () => navigate('departments'),
      canView: true,
    },
    {
      label: 'Hospital Floors',
      value: FLOORS.length,
      sub: 'Mapped & tracked',
      icon: Layers,
      color: 'bg-violet-500',
      action: () => navigate('floor-map'),
      canView: true,
    },
    {
      label: 'System Status',
      value: 'Online',
      sub: 'All services running',
      icon: Activity,
      color: 'bg-amber-500',
      action: undefined,
      canView: true,
    },
  ];

  const actionBadges = [
    { icon: CheckCircle2, label: 'login',  color: 'text-emerald-500' },
    { icon: AlertTriangle, label: 'update', color: 'text-amber-500' },
    { icon: TrendingUp, label: 'create', color: 'text-brand-blue-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br
                      from-brand-blue-600 via-brand-blue-700 to-slate-800 p-6 text-white">
        <div className="relative z-10">
          <p className="text-brand-blue-200 text-sm font-medium">{greeting},</p>
          <h1 className="text-2xl font-bold mt-1">{profile?.full_name || 'Welcome'}</h1>
          <p className="text-brand-blue-300 text-sm mt-1">
            {profile ? ROLE_LABELS[profile.role] : ''} &nbsp;·&nbsp;
            {formatDate(new Date().toISOString(), { dateStyle: 'full', timeStyle: undefined })}
          </p>
          <div className="flex items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm
                             border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AVRON ERP — Phase 1 Active
            </span>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 right-16 w-32 h-32 rounded-full bg-white/5 translate-y-10" />
        <img src="/assets/images/image copy copy.png" alt="" className="absolute right-6 bottom-4 h-16 opacity-10 hidden sm:block" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.filter(c => c.canView).map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`stat-card ${card.action ? 'cursor-pointer group' : ''}`}
              onClick={card.action}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                    {card.value}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.sub}</p>
                </div>
                <div className={`${card.color} p-2.5 rounded-xl text-white flex-shrink-0`}>
                  <Icon size={18} />
                </div>
              </div>
              {card.action && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700
                                flex items-center gap-1 text-xs text-brand-blue-600 dark:text-brand-blue-400
                                group-hover:gap-2 transition-all">
                  <span>View details</span>
                  <ArrowUpRight size={12} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Floor summary */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Hospital Floor Overview</h2>
            <button
              onClick={() => navigate('floor-map')}
              className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline"
            >
              View map
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { floor: 'Basement', units: 'Radiology · X-Ray · USG · HR · IT', status: 'operational' },
              { floor: 'Ground Floor', units: 'Emergency · Pharmacy · Billing', status: 'operational' },
              { floor: '1st Floor', units: 'OPD · Consultation · Registration', status: 'operational' },
              { floor: '2nd–3rd Floor', units: 'General Ward (32 beds)', status: 'operational' },
              { floor: '4th–5th Floor', units: 'Private Rooms · Suites', status: 'operational' },
              { floor: '6th Floor', units: 'ICU 1 & ICU 2', status: 'critical' },
              { floor: '7th Floor', units: 'OT 1 & OT 2 · Recovery', status: 'restricted' },
              { floor: '8th Floor', units: 'MD Office · Administration', status: 'restricted' },
              { floor: 'Terrace', units: 'Utilities · HVAC · Oxygen', status: 'operational' },
            ].map(f => (
              <div
                key={f.floor}
                className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 hover:bg-slate-100
                           dark:hover:bg-slate-700 transition-colors cursor-default"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    f.status === 'operational' ? 'bg-emerald-400' :
                    f.status === 'critical' ? 'bg-brand-red-400 animate-pulse' :
                    'bg-amber-400'
                  }`} />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{f.floor}</p>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{f.units}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
            {hasRole('super_admin', 'md') && (
              <button
                onClick={() => navigate('audit-logs')}
                className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline"
              >
                Full log
              </button>
            )}
          </div>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No recent activity</p>
            ) : (
              recentActivity.map(log => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-700
                                  flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock size={12} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 capitalize">
                      {log.action.replace('_', ' ')}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {formatDate(log.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
