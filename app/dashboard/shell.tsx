'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, HardHat, FileText, Wallet, ShoppingCart, Boxes,
  Users, Handshake, Truck, ClipboardList, Menu, X, LogOut,
} from 'lucide-react';

type ModuleLink = { href: string; label: string; ready: boolean };

const ICONS: Record<string, any> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/chantiers': HardHat,
  '/dashboard/devis': FileText,
  '/dashboard/budget': Wallet,
  '/dashboard/achats': ShoppingCart,
  '/dashboard/stock': Boxes,
  '/dashboard/rh': Users,
  '/dashboard/prestataires': Handshake,
  '/dashboard/engins': Truck,
  '/dashboard/rapports': ClipboardList,
};

export default function DashboardShell({
  children,
  modules,
  orgName,
  userName,
}: {
  children: React.ReactNode;
  modules: ModuleLink[];
  orgName: string;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const sidebarContent = (
    <>
      <div className="brand" style={{ marginBottom: 4 }}>
        SOURA <span>DIGITAL</span>
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-mid)', marginBottom: 24 }}>
        {orgName}
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {modules.map((m) => {
          const active = pathname === m.href;
          const Icon = ICONS[m.href] ?? LayoutDashboard;
          return (
            <Link
              key={m.href}
              href={m.ready ? m.href : '#'}
              onClick={() => setMobileOpen(false)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: '0.9rem',
                background: active ? 'var(--panel-2)' : 'transparent',
                color: m.ready ? 'var(--text-hi)' : 'var(--text-mid)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                justifyContent: 'space-between',
                cursor: m.ready ? 'pointer' : 'default',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                {m.label}
              </span>
              {!m.ready && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-mid)' }}>Bientôt</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}>
        <div style={{ fontSize: '0.85rem', marginBottom: 10 }}>{userName}</div>
        <button className="secondary" onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <LogOut size={15} /> Se déconnecter
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="mobile-topbar">
        <div className="brand" style={{ margin: 0 }}>SOURA <span>DIGITAL</span></div>
        <button className="secondary" onClick={() => setMobileOpen(true)} style={{ padding: 8 }} aria-label="Ouvrir le menu">
          <Menu size={20} />
        </button>
      </div>

      {mobileOpen && <div className="dashboard-overlay" onClick={() => setMobileOpen(false)} />}

      <aside
        className={`dashboard-sidebar${mobileOpen ? ' open' : ''}`}
        style={{
          width: 260,
          borderRight: '1px solid var(--line)',
          background: 'var(--panel)',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {sidebarContent}
      </aside>

      <main style={{ flex: 1, padding: '32px 40px', minWidth: 0 }}>{children}</main>
    </div>
  );
}
