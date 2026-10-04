import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { labelSecteur } from '@/lib/secteurs';

const ADMIN_PLATEFORME_EMAILS = ['konanalemao@gmail.com'];

export default async function PlatformPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !ADMIN_PLATEFORME_EMAILS.includes(user.email ?? '')) {
    redirect('/login');
  }

  const [{ data: organizations }, { data: profiles }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, secteur, subscription_plan, subscription_status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('organization_id, role, actif'),
  ]);

  const orgs = organizations ?? [];
  const allProfiles = profiles ?? [];

  function nbMembres(orgId: string) {
    return allProfiles.filter((p) => p.organization_id === orgId && p.actif).length;
  }

  const totalEntreprises = orgs.length;
  const totalMembres = allProfiles.filter((p) => p.actif).length;
  const actives = orgs.filter((o) => o.subscription_status === 'active').length;

  const STATUT_COLOR: Record<string, string> = {
    active: 'var(--teal)',
    suspendu: 'var(--danger)',
    annule: 'var(--text-mid)',
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <div className="brand" style={{ marginBottom: 4 }}>SOURA <span>DIGITAL</span></div>
      <p style={{ color: 'var(--text-mid)', marginTop: -4, marginBottom: 28 }}>Espace administrateur de la plateforme</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <div className="card">
          <div style={{ color: 'var(--text-mid)', fontSize: '0.85rem' }}>Entreprises inscrites</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{totalEntreprises}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-mid)', fontSize: '0.85rem' }}>Abonnements actifs</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--teal)' }}>{actives}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-mid)', fontSize: '0.85rem' }}>Utilisateurs actifs</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--gold)' }}>{totalMembres}</div>
        </div>
      </div>

      <h3>Entreprises clientes</h3>
      {orgs.length === 0 ? (
        <p style={{ color: 'var(--text-mid)' }}>Aucune entreprise inscrite pour l'instant.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Secteur</th>
              <th>Membres</th>
              <th>Plan</th>
              <th>Statut</th>
              <th>Inscrite le</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{labelSecteur(o.secteur)}</td>
                <td>{nbMembres(o.id)}</td>
                <td style={{ textTransform: 'capitalize' }}>{o.subscription_plan}</td>
                <td>
                  <span style={{ color: STATUT_COLOR[o.subscription_status] ?? 'var(--text-mid)' }}>
                    {o.subscription_status}
                  </span>
                </td>
                <td>{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
