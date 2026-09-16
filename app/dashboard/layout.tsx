import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from './shell';

const MODULES = [
  { href: '/dashboard', label: 'Tableau de bord', ready: true },
  { href: '/dashboard/chantiers', label: 'Chantiers & planning', ready: true },
  { href: '/dashboard/devis', label: 'DQE / Devis / Factures', ready: true },
  { href: '/dashboard/budget', label: 'Budget & dépenses', ready: true },
  { href: '/dashboard/achats', label: 'Achats & demandes', ready: true },
  { href: '/dashboard/stock', label: 'Stocks & matériaux', ready: true },
  { href: '/dashboard/rh', label: 'RH / Ouvriers / Tâcherons', ready: true },
  { href: '/dashboard/prestataires', label: 'Prestataires / Sous-traitants', ready: true },
  { href: '/dashboard/engins', label: 'Engins & carburant', ready: true },
  { href: '/dashboard/rapports', label: 'Situations & rapports', ready: true },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, organization_id, organizations(name)')
    .eq('id', user.id)
    .single();

  const orgName = (profile as any)?.organizations?.name ?? '';

  return (
    <DashboardShell modules={MODULES} orgName={orgName} userName={profile?.full_name ?? user.email ?? ''}>
      {children}
    </DashboardShell>
  );
}
