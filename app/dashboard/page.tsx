import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { domainePourSecteur } from '@/lib/secteurs';
import DashboardBTP from './dashboard-btp';
import DashboardPharmacie from './dashboard-pharmacie';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organizations(secteur)')
    .eq('id', user.id)
    .single();

  const secteur = (profile as any)?.organizations?.secteur ?? 'general';
  const domaine = domainePourSecteur(secteur);

  // Le tableau de bord est réservé aux administrateurs ; un employé est
  // redirigé directement vers le module métier de son entreprise.
  if (profile?.role !== 'admin') {
    redirect(domaine === 'pharmacie' ? '/dashboard/pharmacie' : '/dashboard/chantiers');
  }

  if (domaine === 'pharmacie') {
    return <DashboardPharmacie />;
  }
  return <DashboardBTP />;
}
