import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, FlaskConical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import type { LabRequest, LabStatus } from '../types';

const SAMPLE_TYPES = ['Blood', 'Urine', 'Swab', 'Tissue', 'Sputum', 'CSF', 'Stool', 'Other'];
const TEST_PANELS = ['CBC', 'LFT', 'KFT', 'Lipid Profile', 'Thyroid Panel', 'HbA1c', 'Blood Culture', 'Urine Culture', 'COVID RT-PCR', 'Histopathology', 'Other'];

const STATUS_CONFIG: Record<LabStatus, { label: string; variant: 'neutral'|'info'|'warning'|'success' }> = {
  sample_pending:   { label: 'Sample Pending',   variant: 'neutral' },
  sample_collected: { label: 'Sample Collected', variant: 'info' },
  processing:       { label: 'Processing',       variant: 'warning' },
  report_ready:     { label: 'Report Ready',     variant: 'info' },
  delivered:        { label: 'Delivered',        variant: 'success' },
};

const STATUS_NEXT: Partial<Record<LabStatus, LabStatus>> = {
  sample_pending: 'sample_collected',
  sample_collected: 'processing',
  processing: 'report_ready',
  report_ready: 'delivered',
};

export function LabPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();
  const [reqs, setReqs] = useState<LabRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState<LabStatus | ''>('');
  const [createOpen, setCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    patient_name: '', patient_uhid: '', test_panel: 'CBC',
    test_details: '', sample_type: 'Blood', notes: '',
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('lab_requests').select('*')
      .order('created_at', { ascending: false }).limit(100);
    setReqs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    if (!form.patient_name.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'Patient name is required.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('lab_requests').insert({
      patient_name: form.patient_name.trim(), patient_uhid: form.patient_uhid.trim() || null,
      test_type: form.test_panel, sample_type: form.sample_type,
      test_details: form.test_details.trim() || null, notes: form.notes.trim() || null,
      requested_by: profile?.id,
    });
    setSaving(false);
    if (error) { addToast({ type: 'error', title: 'Error', message: error.message }); return; }
    addToast({ type: 'success', title: 'Lab request created', message: form.patient_name });
    setCreate(false);
    setForm({ patient_name: '', patient_uhid: '', test_panel: 'CBC', test_details: '', sample_type: 'Blood', notes: '' });
    fetch();
  };

  const updateStatus = async (r: LabRequest, next: LabStatus) => {
    const updates: Record<string, unknown> = { status: next };
    if (next === 'sample_collected') updates.collected_by = profile?.id;
    if (next === 'processing') updates.processed_by = profile?.id;
    if (next === 'report_ready') updates.reported_by = profile?.id;
    if (next === 'delivered') updates.delivered_by = profile?.id;
    await supabase.from('lab_requests').update(updates).eq('id', r.id);
    addToast({ type: 'success', title: 'Status updated', message: STATUS_CONFIG[next].label });
    fetch();
  };

  const filtered = reqs.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.patient_name.toLowerCase().includes(q) || (r.req_number ?? '').toLowerCase().includes(q))
      && (!statusFilter || r.status === statusFilter);
  });

  const stats = { total: reqs.length, sample_pending: reqs.filter(r => r.status === 'sample_pending').length, sample_collected: reqs.filter(r => r.status === 'sample_collected').length, processing: reqs.filter(r => r.status === 'processing').length, report_ready: reqs.filter(r => r.status === 'report_ready').length, delivered: reqs.filter(r => r.status === 'delivered').length };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Laboratory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.total} requests &middot; {stats.sample_pending} pending &middot; {stats.processing} processing
          </p>
        </div>
        <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={16} /> New Request</button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {Object.entries(stats).map(([k, v]) => {
          const cfg = STATUS_CONFIG[k as LabStatus];
          return (
            <div key={k} className="card p-3 text-center">
              <p className="text-xl font-bold text-slate-900 dark:text-white">{v}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{cfg?.label ?? k}</p>
            </div>
          );
        })}
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lab requests..." className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value as LabStatus | '')} className="input-field sm:w-40">
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetch} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-10"><Spinner size="lg" /></div> :
         filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><FlaskConical size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No lab requests</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Request #</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Test</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const next = STATUS_NEXT[r.status];
                  const cfg = STATUS_CONFIG[r.status];
                  return (
                    <tr key={r.id} className="table-row">
                      <td className="table-cell font-mono text-xs text-brand-blue-600 dark:text-brand-blue-400">{r.req_number}</td>
                      <td className="table-cell">
                        <p className="text-sm font-medium">{r.patient_name}</p>
                        <p className="text-xs text-slate-500">{r.patient_uhid ?? '—'}</p>
                      </td>
                      <td className="table-cell text-sm text-slate-700 dark:text-slate-300">{r.test_type} ({r.sample_type})</td>
                      <td className="table-cell hidden md:table-cell"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          {next && <button onClick={() => updateStatus(r, next)} className="text-xs text-emerald-600 hover:underline">{STATUS_CONFIG[next].label}</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreate(false)} title="New Lab Request" size="md"
        footer={<><button onClick={() => setCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'Create'}</button></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Patient Name *</label>
              <input type="text" value={form.patient_name} onChange={e => setForm(p => ({ ...p, patient_name: e.target.value }))} placeholder="Patient name" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">UHID</label>
              <input type="text" value={form.patient_uhid} onChange={e => setForm(p => ({ ...p, patient_uhid: e.target.value }))} placeholder="UHID" className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Test Panel</label>
              <select value={form.test_panel} onChange={e => setForm(p => ({ ...p, test_panel: e.target.value }))} className="input-field">
                {TEST_PANELS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sample Type</label>
              <select value={form.sample_type} onChange={e => setForm(p => ({ ...p, sample_type: e.target.value }))} className="input-field">
                {SAMPLE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Test Details</label>
            <textarea value={form.test_details} onChange={e => setForm(p => ({ ...p, test_details: e.target.value }))} rows={2} placeholder="Additional test details..." className="input-field resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Notes..." className="input-field resize-none" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
