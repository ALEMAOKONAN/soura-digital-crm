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
    .select('organizations(secteur)')
    .eq('id', user.id)
    .single();

  const secteur = (profile as any)?.organizations?.secteur ?? 'general';
  const domaine = domainePourSecteur(secteur);

  if (domaine === 'pharmacie') {
    return <DashboardPharmacie />;
  }
  return <DashboardBTP />;
}
