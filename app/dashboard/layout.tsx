import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from './shell';
import { domainePourSecteur, type Domaine } from '@/lib/secteurs';

const MODULES: { href: string; label: string; ready: true; domaine: Domaine | 'commun' }[] = [
  { href: '/dashboard', label: 'Tableau de bord', ready: true, domaine: 'commun' },
  { href: '/dashboard/chantiers', label: 'Chantiers & planning', ready: true, domaine: 'btp' },
  { href: '/dashboard/devis', label: 'DQE / Devis / Factures', ready: true, domaine: 'btp' },
  { href: '/dashboard/budget', label: 'Budget & dépenses', ready: true, domaine: 'btp' },
  { href: '/dashboard/achats', label: 'Achats & demandes', ready: true, domaine: 'btp' },
  { href: '/dashboard/stock', label: 'Stocks & matériaux', ready: true, domaine: 'btp' },
  { href: '/dashboard/rh', label: 'RH / Ouvriers / Tâcherons', ready: true, domaine: 'btp' },
  { href: '/dashboard/prestataires', label: 'Prestataires / Sous-traitants', ready: true, domaine: 'btp' },
  { href: '/dashboard/engins', label: 'Engins & carburant', ready: true, domaine: 'btp' },
  { href: '/dashboard/rapports', label: 'Situations & rapports', ready: true, domaine: 'btp' },
  { href: '/dashboard/pharmacie', label: 'Pharmacie', ready: true, domaine: 'pharmacie' },
  { href: '/dashboard/equipe', label: 'Équipe', ready: true, domaine: 'commun' },
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
  const domaine = domainePourSecteur(secteur);
  const estAdmin = profile?.role === 'admin';

  // Le tableau de bord et l'équipe sont réservés aux administrateurs ;
  // un employé ne voit que les modules métier de son entreprise.
  const modulesVisibles = MODULES.filter((m) =>
    m.domaine === 'commun' ? estAdmin : m.domaine === domaine
  );

  return (
    <DashboardShell modules={modulesVisibles} orgName={orgName} userName={profile?.full_name ?? user.email ?? ''}>
      {children}
    </DashboardShell>
  );
}
