import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from './shell';
import { modulesMasquesPourSecteur } from '@/lib/secteurs';

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
  { href: '/dashboard/equipe', label: 'Équipe', ready: true },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, actif, organization_id, organizations(name, secteur)')
    .eq('id', user.id)
    .single();

  if (profile && profile.actif === false) {
    await supabase.auth.signOut();
    redirect('/login?desactive=1');
  }

  const orgName = (profile as any)?.organizations?.name ?? '';
  const secteur = (profile as any)?.organizations?.secteur ?? 'general';
  const masques = modulesMasquesPourSecteur(secteur);
  const modulesVisibles = MODULES.filter((m) => !masques.includes(m.href));

  return (
    <DashboardShell modules={modulesVisibles} orgName={orgName} userName={profile?.full_name ?? user.email ?? ''}>
      {children}
    </DashboardShell>
  );
}
