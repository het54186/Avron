import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useRouter } from '../../contexts/RouterContext';

const PAGE_TITLES: Record<string, string> = {
  login: 'Login',
  'admin-portal': 'Administration Portal',
  'forgot-password': 'Password Recovery',
  register: 'Staff Registration',
  'initialize-md': 'MD Initialization',
  dashboard: 'Dashboard Overview',
  users: 'User Management',
  departments: 'Department Management',
  'floor-map': 'Hospital Floor Map',
  notifications: 'Notifications',
  'audit-logs': 'Audit Logs',
  profile: 'My Profile',
  settings: 'System Settings',
  'bed-management': 'Bed & Room Management',
  beds: 'Bed Management',
  requisitions: 'Requisition System',
  discharge: 'Discharge Workflow',
  tickets: 'Support Tickets',
  'ticket-detail': 'Ticket Detail',
  pharmacy: 'Pharmacy',
  radiology: 'Radiology & Imaging',
  lab: 'Laboratory',
  chemo: 'Chemotherapy',
  media: 'Media Files',
  deliveries: 'Delivery Tracking',
  assets: 'Asset Management',
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { route } = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          pageTitle={PAGE_TITLES[route] || 'AVRON ERP'}
          onMobileMenuOpen={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
