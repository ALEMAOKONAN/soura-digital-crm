'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HardHat, ClipboardList } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';
import EmptyState from '../../components/empty-state';

type Chantier = { id: string; nom: string; avancement: number; budget: number | null };
type BudgetPoste = { chantier_id: string; montant_prevu: number };
type Depense = { chantier_id: string; montant: number };
type Achat = { chantier_id: string | null; montant: number };
type Employe = { chantier_id: string | null };
type Engin = { chantier_id: string | null };

type Situation = {
  id: string;
  chantier_id: string;
  numero: string;
  pourcentage_avancement: number;
  montant: number;
  statut: string;
  date_situation: string;
};

const STATUT_ORDRE = ['brouillon', 'envoyee', 'validee', 'payee'];
const STATUT_LABEL: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'var(--text-mid)' },
  envoyee: { label: 'Envoyée', color: 'var(--gold)' },
  validee: { label: 'Validée', color: 'var(--teal)' },
  payee: { label: 'Payée', color: 'var(--teal)' },
};

function prochainStatut(statut: string) {
  const i = STATUT_ORDRE.indexOf(statut);
  if (i === -1 || i === STATUT_ORDRE.length - 1) return null;
  return STATUT_ORDRE[i + 1];
}

export default function RapportsPage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [budgetPostes, setBudgetPostes] = useState<BudgetPoste[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [achats, setAchats] = useState<Achat[]>([]);
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [engins, setEngins] = useState<Engin[]>([]);
  const [situations, setSituations] = useState<Situation[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [chantierId, setChantierId] = useState('');
  const [pourcentage, setPourcentage] = useState('');
  const [montant, setMontant] = useState('');

  async function loadAll() {
    setLoading(true);
    const [
      { data: c }, { data: bp }, { data: d }, { data: a }, { data: e }, { data: en }, { data: s },
    ] = await Promise.all([
      supabase.from('chantiers').select('id, nom, avancement, budget'),
      supabase.from('budget_postes').select('chantier_id, montant_prevu'),
      supabase.from('depenses').select('chantier_id, montant'),
      supabase.from('achats').select('chantier_id, montant'),
      supabase.from('employes').select('chantier_id'),
      supabase.from('engins').select('chantier_id'),
      supabase.from('situations').select('*').order('created_at', { ascending: false }),
    ]);
    setChantiers(c ?? []);
    setBudgetPostes(bp ?? []);
    setDepenses(d ?? []);
    setAchats(a ?? []);
    setEmployes(e ?? []);
    setEngins(en ?? []);
    setSituations(s ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function nomChantier(id: string) {
    return chantiers.find((c) => c.id === id)?.nom ?? '—';
  }

  function recap(chantierId: string) {
    const budgetPrevu = budgetPostes.filter((p) => p.chantier_id === chantierId).reduce((s, p) => s + Number(p.montant_prevu), 0);
    const depense = depenses.filter((d) => d.chantier_id === chantierId).reduce((s, d) => s + Number(d.montant), 0);
    const achat = achats.filter((a) => a.chantier_id === chantierId).reduce((s, a) => s + Number(a.montant), 0);
    const nbEmployes = employes.filter((e) => e.chantier_id === chantierId).length;
    const nbEngins = engins.filter((e) => e.chantier_id === chantierId).length;
    return { budgetPrevu, depense, achat, nbEmployes, nbEngins };
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const numero = `SIT-${String(situations.filter((s) => s.chantier_id === chantierId).length + 1).padStart(3, '0')}`;

    const { error } = await supabase.from('situations').insert({
      organization_id: profile!.organization_id,
      chantier_id: chantierId,
      numero,
      pourcentage_avancement: Number(pourcentage) || 0,
      montant: Number(montant) || 0,
      created_by: user!.id,
    });

    if (error) {
      showToast('error', 'Impossible de créer la situation.');
      return;
    }
    showToast('success', `${numero} créée.`);

    setChantierId('');
    setPourcentage('');
    setMontant('');
    setShowForm(false);
    loadAll();
  }

  async function avancerStatut(s: Situation) {
    const suivant = prochainStatut(s.statut);
    if (!suivant) return;
    await supabase.from('situations').update({ statut: suivant }).eq('id', s.id);
    showToast('success', `Statut mis à jour : ${STATUT_LABEL[suivant]?.label}.`);
    loadAll();
  }

  if (loading) return <Spinner label="Chargement…" />;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Situations & rapports</h1>

      <h3>Récapitulatif par chantier</h3>
      {chantiers.length === 0 ? (
        <EmptyState icon={HardHat} title="Aucun chantier pour l'instant" />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
          <thead>
            <tr>
              <th>Chantier</th>
              <th>Avancement</th>
              <th>Budget prévu</th>
              <th>Dépensé</th>
              <th>Achats</th>
              <th>Équipe</th>
              <th>Engins</th>
            </tr>
          </thead>
          <tbody>
            {chantiers.map((c) => {
              const r = recap(c.id);
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td>{c.nom}</td>
                  <td>{c.avancement}%</td>
                  <td>{r.budgetPrevu.toLocaleString('fr-FR')} F</td>
                  <td>{r.depense.toLocaleString('fr-FR')} F</td>
                  <td>{r.achat.toLocaleString('fr-FR')} F</td>
                  <td>{r.nbEmployes}</td>
                  <td>{r.nbEngins}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Situations de travaux</h3>
        <button onClick={() => setShowForm((v) => !v)} disabled={chantiers.length === 0}>
          {showForm ? 'Annuler' : '+ Nouvelle situation'}
        </button>
      </div>
      <p style={{ color: 'var(--text-mid)', marginTop: 6, fontSize: '0.9rem' }}>
        Une situation facture l'avancement des travaux à un moment donné (ex. "40% réalisé = 4 000 000 FCFA à facturer").
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 12, maxWidth: 480 }}>
          <div className="field">
            <label>Chantier</label>
            <select value={chantierId} onChange={(e) => setChantierId(e.target.value)} required>
              <option value="">— Choisir —</option>
              {chantiers.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>% d'avancement</label>
              <input type="number" min="0" max="100" value={pourcentage} onChange={(e) => setPourcentage(e.target.value)} required />
            </div>
            <div className="field">
              <label>Montant (FCFA)</label>
              <input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} required />
            </div>
          </div>
          <button type="submit">Créer la situation</button>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        {situations.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Aucune situation pour l'instant" description="Crée une situation pour facturer l'avancement d'un chantier." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Chantier</th>
                <th>Avancement</th>
                <th>Montant</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {situations.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td>{s.numero}</td>
                  <td>{nomChantier(s.chantier_id)}</td>
                  <td>{s.pourcentage_avancement}%</td>
                  <td>{Number(s.montant).toLocaleString('fr-FR')} F</td>
                  <td>
                    <span style={{ color: STATUT_LABEL[s.statut]?.color }}>{STATUT_LABEL[s.statut]?.label}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {prochainStatut(s.statut) && (
                      <button className="secondary" onClick={() => avancerStatut(s)}>
                        → {STATUT_LABEL[prochainStatut(s.statut)!]?.label}
                      </button>
                    )}
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
