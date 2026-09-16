'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HardHat, Plus } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';
import EmptyState from '../../components/empty-state';

type Chantier = {
  id: string;
  nom: string;
  client: string | null;
  budget: number | null;
  avancement: number;
  statut: string;
};

const STATUTS: Record<string, { label: string; color: string }> = {
  en_cours: { label: 'En cours', color: 'var(--teal)' },
  en_retard: { label: 'En retard', color: 'var(--danger)' },
  termine: { label: 'Terminé', color: 'var(--text-mid)' },
  a_venir: { label: 'À venir', color: 'var(--gold)' },
};

export default function ChantiersPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [nom, setNom] = useState('');
  const [client, setClient] = useState('');
  const [budget, setBudget] = useState('');

  async function loadChantiers() {
    setLoading(true);
    const { data } = await supabase
      .from('chantiers')
      .select('id, nom, client, budget, avancement, statut')
      .order('created_at', { ascending: false });
    setChantiers(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadChantiers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user!.id)
      .single();

    const { error } = await supabase.from('chantiers').insert({
      nom,
      client,
      budget: budget ? Number(budget) : null,
      organization_id: profile!.organization_id,
      created_by: user!.id,
    });

    setSubmitting(false);

    if (error) {
      showToast('error', "Impossible de créer le chantier.");
      return;
    }

    showToast('success', `Chantier "${nom}" créé.`);
    setNom('');
    setClient('');
    setBudget('');
    setShowForm(false);
    loadChantiers();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Chantiers & planning</h1>
        <button onClick={() => setShowForm((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {showForm ? 'Annuler' : <><Plus size={16} /> Nouveau chantier</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 20, maxWidth: 420 }}>
          <div className="field">
            <label>Nom du chantier</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div className="field">
            <label>Client / maître d'ouvrage</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} />
          </div>
          <div className="field">
            <label>Budget (FCFA)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <button type="submit" disabled={submitting}>
            {submitting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Créer le chantier'}
          </button>
        </form>
      )}

      <div style={{ marginTop: 24 }}>
        {loading ? (
          <Spinner label="Chargement des chantiers…" />
        ) : chantiers.length === 0 ? (
          <EmptyState icon={HardHat} title="Aucun chantier pour l'instant" description="Crée ton premier chantier pour commencer à suivre son avancement." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Chantier</th>
                <th>Client</th>
                <th>Budget</th>
                <th>Avancement</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {chantiers.map((c) => (
                <tr key={c.id}>
                  <td>{c.nom}</td>
                  <td>{c.client ?? '—'}</td>
                  <td>{c.budget ? Number(c.budget).toLocaleString('fr-FR') + ' F' : '—'}</td>
                  <td>{c.avancement}%</td>
                  <td>
                    <span style={{ color: STATUTS[c.statut]?.color ?? 'var(--text-mid)' }}>
                      {STATUTS[c.statut]?.label ?? c.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
