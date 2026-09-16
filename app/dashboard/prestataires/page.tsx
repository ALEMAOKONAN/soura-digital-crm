'use client';

import { useEffect, useState, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Handshake } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';
import EmptyState from '../../components/empty-state';

type Chantier = { id: string; nom: string };
type Prestataire = {
  id: string;
  nom: string;
  specialite: string | null;
  telephone: string | null;
  chantier_id: string | null;
  montant_marche: number;
};
type Paiement = { prestataire_id: string; montant: number };

export default function PrestatairesPage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [nom, setNom] = useState('');
  const [specialite, setSpecialite] = useState('');
  const [telephone, setTelephone] = useState('');
  const [chantierId, setChantierId] = useState('');
  const [montantMarche, setMontantMarche] = useState('');

  const [paiementOuvert, setPaiementOuvert] = useState<string | null>(null);
  const [paiementType, setPaiementType] = useState<'avance' | 'paiement'>('avance');
  const [paiementMontant, setPaiementMontant] = useState('');

  async function loadAll() {
    setLoading(true);
    const [{ data: p }, { data: c }, { data: pay }] = await Promise.all([
      supabase.from('prestataires').select('*').order('created_at'),
      supabase.from('chantiers').select('id, nom'),
      supabase.from('paiements_prestataires').select('prestataire_id, montant'),
    ]);
    setPrestataires(p ?? []);
    setChantiers(c ?? []);
    setPaiements(pay ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function totalVerse(id: string) {
    return paiements.filter((p) => p.prestataire_id === id).reduce((s, p) => s + Number(p.montant), 0);
  }

  function nomChantier(id: string | null) {
    return chantiers.find((c) => c.id === id)?.nom ?? '—';
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('prestataires').insert({
      organization_id: profile!.organization_id,
      nom,
      specialite,
      telephone,
      chantier_id: chantierId || null,
      montant_marche: Number(montantMarche) || 0,
    });

    if (error) {
      showToast('error', "Impossible d'ajouter le prestataire.");
      return;
    }
    showToast('success', `"${nom}" ajouté.`);

    setNom('');
    setSpecialite('');
    setTelephone('');
    setChantierId('');
    setMontantMarche('');
    setShowForm(false);
    loadAll();
  }

  async function handlePaiement(e: React.FormEvent, prestataireId: string) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('paiements_prestataires').insert({
      organization_id: profile!.organization_id,
      prestataire_id: prestataireId,
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
        <h1 style={{ margin: 0 }}>Prestataires / Sous-traitants</h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Annuler' : '+ Prestataire'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 20, maxWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Nom / raison sociale</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} required />
            </div>
            <div className="field">
              <label>Spécialité</label>
              <input value={specialite} onChange={(e) => setSpecialite(e.target.value)} placeholder="ex. Plomberie" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Téléphone</label>
              <input value={telephone} onChange={(e) => setTelephone(e.target.value)} />
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
          <div className="field">
            <label>Montant du marché (FCFA)</label>
            <input type="number" value={montantMarche} onChange={(e) => setMontantMarche(e.target.value)} />
          </div>
          <button type="submit">Ajouter le prestataire</button>
        </form>
      )}

      <div style={{ marginTop: 24 }}>
        {prestataires.length === 0 ? (
          <EmptyState icon={Handshake} title="Aucun prestataire pour l'instant" description="Ajoute un prestataire pour suivre son marché et ses paiements." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Prestataire</th>
                <th>Spécialité</th>
                <th>Chantier</th>
                <th>Marché</th>
                <th>Versé</th>
                <th>Reste à payer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prestataires.map((p) => {
                const verse = totalVerse(p.id);
                const reste = Number(p.montant_marche) - verse;
                return (
                  <Fragment key={p.id}>
                    <tr style={{ borderBottom: paiementOuvert === p.id ? 'none' : '1px solid var(--line)' }}>
                      <td>{p.nom}</td>
                      <td>{p.specialite || '—'}</td>
                      <td>{nomChantier(p.chantier_id)}</td>
                      <td>{Number(p.montant_marche).toLocaleString('fr-FR')} F</td>
                      <td>{verse.toLocaleString('fr-FR')} F</td>
                      <td style={{ color: reste > 0 ? 'var(--gold)' : 'var(--teal)' }}>
                        {reste.toLocaleString('fr-FR')} F
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="secondary" onClick={() => setPaiementOuvert(paiementOuvert === p.id ? null : p.id)}>
                          {paiementOuvert === p.id ? 'Fermer' : '+ Paiement'}
                        </button>
                      </td>
                    </tr>
                    {paiementOuvert === p.id && (
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <td colSpan={7} style={{ paddingBottom: 16 }}>
                          <form onSubmit={(e) => handlePaiement(e, p.id)} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
