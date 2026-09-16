'use client';

import { useEffect, useState, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';
import EmptyState from '../../components/empty-state';

type Chantier = { id: string; nom: string };
type Employe = {
  id: string;
  nom: string;
  poste: string | null;
  type: 'ouvrier' | 'tacheron';
  telephone: string | null;
  taux_journalier: number;
  chantier_id: string | null;
};
type Pointage = { employe_id: string; date_pointage: string };
type Paiement = { employe_id: string; type: 'avance' | 'paiement'; montant: number };

const AUJOURD_HUI = new Date().toISOString().slice(0, 10);

export default function RhPage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [employes, setEmployes] = useState<Employe[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [nom, setNom] = useState('');
  const [poste, setPoste] = useState('');
  const [type, setType] = useState<'ouvrier' | 'tacheron'>('ouvrier');
  const [telephone, setTelephone] = useState('');
  const [tauxJournalier, setTauxJournalier] = useState('');
  const [chantierId, setChantierId] = useState('');

  const [paiementOuvert, setPaiementOuvert] = useState<string | null>(null);
  const [paiementType, setPaiementType] = useState<'avance' | 'paiement'>('avance');
  const [paiementMontant, setPaiementMontant] = useState('');

  async function loadAll() {
    setLoading(true);
    const [{ data: e }, { data: c }, { data: p }, { data: pay }] = await Promise.all([
      supabase.from('employes').select('*').order('created_at'),
      supabase.from('chantiers').select('id, nom'),
      supabase.from('pointages').select('employe_id, date_pointage').eq('date_pointage', AUJOURD_HUI),
      supabase.from('paiements_employes').select('employe_id, type, montant'),
    ]);
    setEmployes(e ?? []);
    setChantiers(c ?? []);
    setPointages(p ?? []);
    setPaiements(pay ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function estPointeAujourdhui(employeId: string) {
    return pointages.some((p) => p.employe_id === employeId);
  }

  function totalVerse(employeId: string) {
    return paiements.filter((p) => p.employe_id === employeId).reduce((s, p) => s + Number(p.montant), 0);
  }

  function nomChantier(id: string | null) {
    return chantiers.find((c) => c.id === id)?.nom ?? '—';
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('employes').insert({
      organization_id: profile!.organization_id,
      nom,
      poste,
      type,
      telephone,
      taux_journalier: Number(tauxJournalier) || 0,
      chantier_id: chantierId || null,
    });

    if (error) {
      showToast('error', "Impossible d'ajouter l'employé.");
      return;
    }
    showToast('success', `"${nom}" ajouté.`);

    setNom('');
    setPoste('');
    setType('ouvrier');
    setTelephone('');
    setTauxJournalier('');
    setChantierId('');
    setShowForm(false);
    loadAll();
  }

  async function pointerAujourdhui(employeId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('pointages').insert({
      organization_id: profile!.organization_id,
      employe_id: employeId,
      date_pointage: AUJOURD_HUI,
    });
    if (error) {
      showToast('error', 'Impossible de pointer cet employé.');
      return;
    }
    showToast('success', 'Présence enregistrée.');
    loadAll();
  }

  async function handlePaiement(e: React.FormEvent, employeId: string) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('paiements_employes').insert({
      organization_id: profile!.organization_id,
      employe_id: employeId,
      type: paiementType,
      montant: Number(paiementMontant) || 0,
      created_by: user!.id,
    });

    if (error) {
      showToast('error', "Impossible d'enregistrer le paiement.");
      return;
    }
    showToast('success', paiementType === 'avance' ? 'Avance enregistrée.' : 'Paiement enregistré.');

    setPaiementMontant('');
    setPaiementOuvert(null);
    loadAll();
  }

  if (loading) return <Spinner label="Chargement…" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>RH / Ouvriers / Tâcherons</h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Annuler' : '+ Employé'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 20, maxWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Nom</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} required />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'ouvrier' | 'tacheron')}>
                <option value="ouvrier">Ouvrier</option>
                <option value="tacheron">Tâcheron</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Métier / poste</label>
              <input value={poste} onChange={(e) => setPoste(e.target.value)} placeholder="ex. Maçon" />
            </div>
            <div className="field">
              <label>Téléphone</label>
              <input value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Taux journalier (FCFA)</label>
              <input type="number" value={tauxJournalier} onChange={(e) => setTauxJournalier(e.target.value)} />
            </div>
            <div className="field">
              <label>Chantier affecté (optionnel)</label>
              <select value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
                <option value="">— Aucun —</option>
                {chantiers.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit">Ajouter l'employé</button>
        </form>
      )}

      <div style={{ marginTop: 24 }}>
        {employes.length === 0 ? (
          <EmptyState icon={Users} title="Aucun employé pour l'instant" description="Ajoute un ouvrier ou un tâcheron pour commencer le suivi." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Poste</th>
                <th>Chantier</th>
                <th>Taux/j</th>
                <th>Total versé</th>
                <th>Aujourd'hui</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employes.map((emp) => (
                <Fragment key={emp.id}>
                  <tr style={{ borderBottom: paiementOuvert === emp.id ? 'none' : '1px solid var(--line)' }}>
                    <td>{emp.nom} <span style={{ color: 'var(--text-mid)', fontSize: '0.8rem' }}>({emp.type === 'ouvrier' ? 'Ouvrier' : 'Tâcheron'})</span></td>
                    <td>{emp.poste || '—'}</td>
                    <td>{nomChantier(emp.chantier_id)}</td>
                    <td>{Number(emp.taux_journalier).toLocaleString('fr-FR')} F</td>
                    <td>{totalVerse(emp.id).toLocaleString('fr-FR')} F</td>
                    <td>
                      {estPointeAujourdhui(emp.id) ? (
                        <span style={{ color: 'var(--teal)' }}>✓ Présent</span>
                      ) : (
                        <button className="secondary" onClick={() => pointerAujourdhui(emp.id)}>Pointer</button>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="secondary" onClick={() => setPaiementOuvert(paiementOuvert === emp.id ? null : emp.id)}>
                        {paiementOuvert === emp.id ? 'Fermer' : '+ Paiement'}
                      </button>
                    </td>
                  </tr>
                  {paiementOuvert === emp.id && (
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <td colSpan={7} style={{ paddingBottom: 16 }}>
                        <form onSubmit={(e) => handlePaiement(e, emp.id)} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Type</label>
                            <select value={paiementType} onChange={(e) => setPaiementType(e.target.value as 'avance' | 'paiement')}>
                              <option value="avance">Avance</option>
                              <option value="paiement">Paiement</option>
                            </select>
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Montant (FCFA)</label>
                            <input type="number" value={paiementMontant} onChange={(e) => setPaiementMontant(e.target.value)} required />
                          </div>
                          <button type="submit">Enregistrer</button>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
