'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShoppingCart } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';
import EmptyState from '../../components/empty-state';

type Chantier = { id: string; nom: string };

type Achat = {
  id: string;
  designation: string;
  quantite: number;
  unite: string | null;
  fournisseur: string | null;
  montant: number;
  statut: string;
  chantier_id: string | null;
  date_demande: string;
};

const STATUT_ORDRE = ['demande', 'validee', 'commandee', 'receptionnee', 'payee'];

const STATUT_LABEL: Record<string, { label: string; color: string }> = {
  demande: { label: 'Demandé', color: 'var(--text-mid)' },
  validee: { label: 'Validé', color: 'var(--gold)' },
  commandee: { label: 'Commandé', color: 'var(--gold)' },
  receptionnee: { label: 'Réceptionné', color: 'var(--teal)' },
  payee: { label: 'Payé', color: 'var(--teal)' },
  rejetee: { label: 'Rejeté', color: 'var(--danger)' },
};

function prochainStatut(statut: string) {
  const i = STATUT_ORDRE.indexOf(statut);
  if (i === -1 || i === STATUT_ORDRE.length - 1) return null;
  return STATUT_ORDRE[i + 1];
}

export default function AchatsPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const [achats, setAchats] = useState<Achat[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [designation, setDesignation] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [unite, setUnite] = useState('u');
  const [fournisseur, setFournisseur] = useState('');
  const [montant, setMontant] = useState('');
  const [chantierId, setChantierId] = useState('');

  async function loadAll() {
    setLoading(true);
    const [{ data: achatsData }, { data: chantiersData }] = await Promise.all([
      supabase.from('achats').select('*').order('created_at', { ascending: false }),
      supabase.from('chantiers').select('id, nom'),
    ]);
    setAchats(achatsData ?? []);
    setChantiers(chantiersData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function nomChantier(id: string | null) {
    return chantiers.find((c) => c.id === id)?.nom ?? '—';
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('achats').insert({
      organization_id: profile!.organization_id,
      chantier_id: chantierId || null,
      designation,
      quantite: Number(quantite) || 1,
      unite,
      fournisseur,
      montant: Number(montant) || 0,
      created_by: user!.id,
    });

    if (error) {
      showToast('error', "Impossible de créer la demande.");
      return;
    }
    showToast('success', 'Demande créée.');

    setDesignation('');
    setQuantite('1');
    setUnite('u');
    setFournisseur('');
    setMontant('');
    setChantierId('');
    setShowForm(false);
    loadAll();
  }

  async function avancerStatut(achat: Achat) {
    const suivant = prochainStatut(achat.statut);
    if (!suivant) return;
    await supabase.from('achats').update({ statut: suivant }).eq('id', achat.id);
    showToast('success', `Statut mis à jour : ${STATUT_LABEL[suivant]?.label}.`);
    loadAll();
  }

  async function rejeter(achat: Achat) {
    await supabase.from('achats').update({ statut: 'rejetee' }).eq('id', achat.id);
    showToast('success', 'Demande rejetée.');
    loadAll();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Achats & demandes</h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Annuler' : '+ Nouvelle demande'}</button>
      </div>
      <p style={{ color: 'var(--text-mid)', marginTop: 6 }}>
        Demandé → Validé → Commandé → Réceptionné → Payé.
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 20, maxWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Désignation</label>
              <input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="ex. Sacs de ciment" required />
            </div>
            <div className="field">
              <label>Quantité</label>
              <input type="number" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
            </div>
            <div className="field">
              <label>Unité</label>
              <input value={unite} onChange={(e) => setUnite(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Fournisseur</label>
              <input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
            </div>
            <div className="field">
              <label>Montant estimé (FCFA)</label>
              <input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
            </div>
            <div className="field">
              <label>Chantier (optionnel)</label>
              <select value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
                <option value="">— Aucun —</option>
                {chantiers.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit">Créer la demande</button>
        </form>
      )}

      <div style={{ marginTop: 24 }}>
        {loading ? (
          <Spinner label="Chargement…" />
        ) : achats.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Aucune demande pour l'instant" description="Crée une demande d'achat pour démarrer le suivi." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Désignation</th>
                <th>Chantier</th>
                <th>Fournisseur</th>
                <th>Montant</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {achats.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td>{a.designation} <span style={{ color: 'var(--text-mid)' }}>({a.quantite} {a.unite})</span></td>
                  <td>{nomChantier(a.chantier_id)}</td>
                  <td>{a.fournisseur || '—'}</td>
                  <td>{Number(a.montant).toLocaleString('fr-FR')} F</td>
                  <td>
                    <span style={{ color: STATUT_LABEL[a.statut]?.color }}>
                      {STATUT_LABEL[a.statut]?.label ?? a.statut}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    {prochainStatut(a.statut) && (
                      <button className="secondary" onClick={() => avancerStatut(a)}>
                        → {STATUT_LABEL[prochainStatut(a.statut)!]?.label}
                      </button>
                    )}
                    {(a.statut === 'demande' || a.statut === 'validee') && (
                      <button className="secondary" onClick={() => rejeter(a)} style={{ color: 'var(--danger)' }}>
                        Rejeter
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
