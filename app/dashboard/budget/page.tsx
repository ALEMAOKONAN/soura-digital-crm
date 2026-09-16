'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Wallet } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';
import EmptyState from '../../components/empty-state';

type Chantier = { id: string; nom: string };
type Poste = { id: string; nom: string; montant_prevu: number };
type Depense = { id: string; libelle: string; montant: number; date_depense: string; poste_id: string | null };

export default function BudgetPage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [chantierId, setChantierId] = useState('');
  const [postes, setPostes] = useState<Poste[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPosteForm, setShowPosteForm] = useState(false);
  const [posteNom, setPosteNom] = useState('');
  const [posteMontant, setPosteMontant] = useState('');

  const [showDepenseForm, setShowDepenseForm] = useState(false);
  const [depLibelle, setDepLibelle] = useState('');
  const [depMontant, setDepMontant] = useState('');
  const [depPosteId, setDepPosteId] = useState('');
  const [depDate, setDepDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('chantiers').select('id, nom').order('created_at', { ascending: false });
      setChantiers(data ?? []);
      if (data && data.length > 0) setChantierId(data[0].id);
      setLoading(false);
    })();
  }, []);

  async function loadChantierData(id: string) {
    if (!id) return;
    const [{ data: postesData }, { data: depensesData }] = await Promise.all([
      supabase.from('budget_postes').select('id, nom, montant_prevu').eq('chantier_id', id).order('created_at'),
      supabase.from('depenses').select('id, libelle, montant, date_depense, poste_id').eq('chantier_id', id).order('date_depense', { ascending: false }),
    ]);
    setPostes(postesData ?? []);
    setDepenses(depensesData ?? []);
  }

  useEffect(() => {
    if (chantierId) loadChantierData(chantierId);
  }, [chantierId]);

  const totalPrevu = useMemo(() => postes.reduce((s, p) => s + Number(p.montant_prevu), 0), [postes]);
  const totalDepense = useMemo(() => depenses.reduce((s, d) => s + Number(d.montant), 0), [depenses]);
  const ecart = totalPrevu - totalDepense;
  const pourcentage = totalPrevu > 0 ? Math.round((totalDepense / totalPrevu) * 100) : 0;

  function depensePourPoste(posteId: string) {
    return depenses.filter((d) => d.poste_id === posteId).reduce((s, d) => s + Number(d.montant), 0);
  }

  async function handleCreatePoste(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('budget_postes').insert({
      organization_id: profile!.organization_id,
      chantier_id: chantierId,
      nom: posteNom,
      montant_prevu: Number(posteMontant) || 0,
    });

    if (error) {
      showToast('error', "Impossible d'ajouter le poste.");
      return;
    }
    showToast('success', `Poste "${posteNom}" ajouté.`);

    setPosteNom('');
    setPosteMontant('');
    setShowPosteForm(false);
    loadChantierData(chantierId);
  }

  async function handleCreateDepense(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('depenses').insert({
      organization_id: profile!.organization_id,
      chantier_id: chantierId,
      poste_id: depPosteId || null,
      libelle: depLibelle,
      montant: Number(depMontant) || 0,
      date_depense: depDate,
      created_by: user!.id,
    });

    if (error) {
      showToast('error', "Impossible d'ajouter la dépense.");
      return;
    }
    showToast('success', 'Dépense ajoutée.');

    setDepLibelle('');
    setDepMontant('');
    setDepPosteId('');
    setShowDepenseForm(false);
    loadChantierData(chantierId);
  }

  if (loading) return <Spinner label="Chargement…" />;

  if (chantiers.length === 0) {
    return (
      <div>
        <h1>Budget & dépenses</h1>
        <EmptyState
          icon={Wallet}
          title="Aucun chantier disponible"
          description={'Crée d\'abord un chantier dans "Chantiers & planning" pour pouvoir lui associer un budget.'}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Budget & dépenses</h1>
        <select value={chantierId} onChange={(e) => setChantierId(e.target.value)} style={{ maxWidth: 260 }}>
          {chantiers.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 24 }}>
        <div className="card">
          <div style={{ color: 'var(--text-mid)', fontSize: '0.85rem' }}>Budget prévu</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalPrevu.toLocaleString('fr-FR')} F</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-mid)', fontSize: '0.85rem' }}>Dépensé</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gold)' }}>{totalDepense.toLocaleString('fr-FR')} F</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-mid)', fontSize: '0.85rem' }}>Écart</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: ecart >= 0 ? 'var(--teal)' : 'var(--danger)' }}>
            {ecart.toLocaleString('fr-FR')} F
          </div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-mid)', fontSize: '0.85rem' }}>Consommation</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: pourcentage > 100 ? 'var(--danger)' : 'var(--text-hi)' }}>
            {pourcentage}%
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, marginTop: 32, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Postes budgétaires</h3>
            <button onClick={() => setShowPosteForm((v) => !v)}>{showPosteForm ? 'Annuler' : '+ Poste'}</button>
          </div>

          {showPosteForm && (
            <form onSubmit={handleCreatePoste} className="card" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Nom du poste</label>
                <input value={posteNom} onChange={(e) => setPosteNom(e.target.value)} placeholder="ex. Gros œuvre" required />
              </div>
              <div className="field">
                <label>Montant prévu (FCFA)</label>
                <input type="number" value={posteMontant} onChange={(e) => setPosteMontant(e.target.value)} required />
              </div>
              <button type="submit">Ajouter</button>
            </form>
          )}

          <table className="table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Poste</th>
                <th>Prévu</th>
                <th>Dépensé</th>
              </tr>
            </thead>
            <tbody>
              {postes.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: '12px 0', color: 'var(--text-mid)' }}>Aucun poste pour l'instant.</td></tr>
              ) : (
                postes.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td>{p.nom}</td>
                    <td>{Number(p.montant_prevu).toLocaleString('fr-FR')} F</td>
                    <td>{depensePourPoste(p.id).toLocaleString('fr-FR')} F</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Dépenses récentes</h3>
            <button onClick={() => setShowDepenseForm((v) => !v)}>{showDepenseForm ? 'Annuler' : '+ Dépense'}</button>
          </div>

          {showDepenseForm && (
            <form onSubmit={handleCreateDepense} className="card" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Libellé</label>
                <input value={depLibelle} onChange={(e) => setDepLibelle(e.target.value)} placeholder="ex. Achat ciment" required />
              </div>
              <div className="field">
                <label>Montant (FCFA)</label>
                <input type="number" value={depMontant} onChange={(e) => setDepMontant(e.target.value)} required />
              </div>
              <div className="field">
                <label>Poste (optionnel)</label>
                <select value={depPosteId} onChange={(e) => setDepPosteId(e.target.value)}>
                  <option value="">— Aucun —</option>
                  {postes.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} required />
              </div>
              <button type="submit">Ajouter</button>
            </form>
          )}

          <table className="table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Montant</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {depenses.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: '12px 0', color: 'var(--text-mid)' }}>Aucune dépense pour l'instant.</td></tr>
              ) : (
                depenses.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td>{d.libelle}</td>
                    <td>{Number(d.montant).toLocaleString('fr-FR')} F</td>
                    <td>{new Date(d.date_depense).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
