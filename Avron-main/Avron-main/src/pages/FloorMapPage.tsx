import { useState, useEffect, useCallback } from 'react';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn } from '../lib/utils';
import { FLOORS, type Department } from '../types';

const FLOOR_CONFIG: Record<string, {
  color: string; bg: string; border: string;
  icon: string; description: string;
}> = {
  'Basement':     { color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', icon: '🏗️', description: 'Diagnostics & Support Services' },
  'Ground Floor': { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800', icon: '🚪', description: 'Entry & Emergency Services' },
  '1st Floor':    { color: 'text-brand-blue-700 dark:text-brand-blue-400', bg: 'bg-brand-blue-50 dark:bg-brand-blue-900/10', border: 'border-brand-blue-200 dark:border-brand-blue-800', icon: '🏥', description: 'Outpatient Department' },
  '2nd Floor':    { color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-900/10', border: 'border-sky-200 dark:border-sky-800', icon: '🛏️', description: 'General Ward — 16 Beds' },
  '3rd Floor':    { color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/10', border: 'border-cyan-200 dark:border-cyan-800', icon: '🛏️', description: 'General Ward — 16 Beds' },
  '4th Floor':    { color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/10', border: 'border-teal-200 dark:border-teal-800', icon: '🚪', description: 'Rooms 401–407 & Suite 408' },
  '5th Floor':    { color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/10', border: 'border-violet-200 dark:border-violet-800', icon: '🏨', description: 'Rooms 501–507 & Suite 508' },
  '6th Floor':    { color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/10', border: 'border-rose-200 dark:border-rose-800', icon: '💊', description: 'ICU 1 & ICU 2 — Critical Care' },
  '7th Floor':    { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800', icon: '🔬', description: 'Operation Theatres & Recovery' },
  '8th Floor':    { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800', icon: '🏢', description: 'Administration & Management' },
  'Terrace':      { color: 'text-lime-700 dark:text-lime-400', bg: 'bg-lime-50 dark:bg-lime-900/10', border: 'border-lime-200 dark:border-lime-800', icon: '⚙️', description: 'Utilities & Infrastructure' },
};

const ACCESS_BADGE: Record<string, 'success'|'warning'|'danger'|'neutral'> = {
  'Ground Floor': 'success', '1st Floor': 'success',
  '6th Floor': 'danger', '7th Floor': 'danger',
  '8th Floor': 'warning', 'Terrace': 'warning',
};

export function FloorMapPage() {
  const [depts, setDepts]         = useState<Department[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set(FLOORS.slice(0, 3)));

  const fetchDepts = useCallback(async () => {
    const { data } = await supabase.from('departments').select('*').order('floor').order('name');
    setDepts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const toggle = (floor: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor);
      else next.add(floor);
      return next;
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hospital Floor Map</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {depts.length} departments across {FLOORS.length} floors
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-3">
          {FLOORS.map(floor => {
            const floorDepts = depts.filter(d => d.floor === floor);
            const cfg = FLOOR_CONFIG[floor];
            const open = expanded.has(floor);
            return (
              <div
                key={floor}
                className={cn(
                  'rounded-xl border transition-all overflow-hidden',
                  cfg.border,
                  cfg.bg,
                )}
              >
                <button
                  onClick={() => toggle(floor)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cfg.icon}</span>
                    <div>
                      <h3 className={cn('text-sm font-semibold', cfg.color)}>{floor}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{cfg.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {floorDepts.length} dept{floorDepts.length !== 1 ? 's' : ''}
                    </span>
                    <div className="h-6 w-6 rounded-full bg-white/50 dark:bg-slate-700/50 flex items-center justify-center">
                      {open ? (
                        <ChevronUp size={14} className="text-slate-500" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-500" />
                      )}
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="px-5 pb-4">
                    {floorDepts.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">No departments on this floor.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {floorDepts.map(d => (
                          <div
                            key={d.id}
                            className={cn(
                              'bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700',
                              'p-3 flex items-center justify-between',
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                                <Building2 size={13} className="text-slate-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{d.name}</p>
                                <p className="text-[10px] text-slate-400">{d.description || 'No description'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant={d.is_active ? 'success' : 'neutral'}
                                dot
                                className="text-[10px]"
                              >
                                {d.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              {ACCESS_BADGE[floor] && (
                                <Badge
                                  variant={ACCESS_BADGE[floor]}
                                  className="text-[10px]"
                                >
                                  {floor}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
