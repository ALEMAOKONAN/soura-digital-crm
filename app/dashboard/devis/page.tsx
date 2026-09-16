'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';
import EmptyState from '../../components/empty-state';

type Ligne = { id?: string; designation: string; unite: string; quantite: number; prix_unitaire: number };

type Doc = {
  id: string;
  type: 'dqe' | 'devis' | 'facture';
  numero: string;
  client: string | null;
  chantier_id: string | null;
  montant_total: number;
  statut: string;
  source_id: string | null;
};

type Chantier = { id: string; nom: string };

const TYPE_LABEL: Record<string, string> = { dqe: 'DQE', devis: 'Devis', facture: 'Facture' };
const STATUT_LABEL: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'var(--text-mid)' },
  envoye: { label: 'Envoyé', color: 'var(--gold)' },
  valide: { label: 'Validé', color: 'var(--teal)' },
  refuse: { label: 'Refusé', color: 'var(--danger)' },
  paye: { label: 'Payé', color: 'var(--teal)' },
};

const TABS: Array<Doc['type'] | 'tous'> = ['tous', 'dqe', 'devis', 'facture'];

export default function DevisPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('tous');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // formulaire de création
  const [client, setClient] = useState('');
  const [chantierId, setChantierId] = useState('');
  const [lignes, setLignes] = useState<Ligne[]>([
    { designation: '', unite: 'u', quantite: 1, prix_unitaire: 0 },
  ]);

  async function loadAll() {
    setLoading(true);
    const [{ data: docsData }, { data: chantiersData }] = await Promise.all([
      supabase.from('devis').select('*').order('created_at', { ascending: false }),
      supabase.from('chantiers').select('id, nom'),
    ]);
    setDocs((docsData as Doc[]) ?? []);
    setChantiers((chantiersData as Chantier[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = tab === 'tous' ? docs : docs.filter((d) => d.type === tab);

  function updateLigne(index: number, field: keyof Ligne, value: string) {
    setLignes((prev) =>
      prev.map((l, i) =>
        i === index
          ? { ...l, [field]: field === 'designation' || field === 'unite' ? value : Number(value) }
          : l
      )
    );
  }

  function addLigne() {
    setLignes((prev) => [...prev, { designation: '', unite: 'u', quantite: 1, prix_unitaire: 0 }]);
  }

  function removeLigne(index: number) {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  }

  const totalFormulaire = lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire, 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user!.id)
      .single();

    const numero = `DQE-${String(docs.filter((d) => d.type === 'dqe').length + 1).padStart(4, '0')}`;

    const { data: newDoc, error } = await supabase
      .from('devis')
      .insert({
        organization_id: profile!.organization_id,
        type: 'dqe',
        numero,
        client,
        chantier_id: chantierId || null,
        montant_total: totalFormulaire,
        created_by: user!.id,
      })
      .select()
      .single();

    if (error || !newDoc) {
      showToast('error', 'Impossible de créer le DQE.');
      return;
    }

    const lignesAInserer = lignes
      .filter((l) => l.designation.trim() !== '')
      .map((l) => ({
        organization_id: profile!.organization_id,
        devis_id: newDoc.id,
        designation: l.designation,
        unite: l.unite,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
      }));

    if (lignesAInserer.length > 0) {
      await supabase.from('devis_lignes').insert(lignesAInserer);
    }

    showToast('success', `${numero} créé.`);
    setClient('');
    setChantierId('');
    setLignes([{ designation: '', unite: 'u', quantite: 1, prix_unitaire: 0 }]);
    setShowForm(false);
    loadAll();
  }

  async function transformer(doc: Doc) {
    const nextType = doc.type === 'dqe' ? 'devis' : 'facture';
    const prefix = nextType === 'devis' ? 'DEV' : 'FAC';

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user!.id)
      .single();

    const numero = `${prefix}-${String(docs.filter((d) => d.type === nextType).length + 1).padStart(4, '0')}`;

    const { data: newDoc, error } = await supabase
      .from('devis')
      .insert({
        organization_id: profile!.organization_id,
        type: nextType,
        numero,
        client: doc.client,
        chantier_id: doc.chantier_id,
        montant_total: doc.montant_total,
        source_id: doc.id,
        created_by: user!.id,
      })
      .select()
      .single();

    if (error || !newDoc) {
      showToast('error', 'Impossible de transformer ce document.');
      return;
    }

    const { data: lignesOrigine } = await supabase
      .from('devis_lignes')
      .select('designation, unite, quantite, prix_unitaire')
      .eq('devis_id', doc.id);

    if (lignesOrigine && lignesOrigine.length > 0) {
      await supabase.from('devis_lignes').insert(
        lignesOrigine.map((l) => ({
          organization_id: profile!.organization_id,
          devis_id: newDoc.id,
          ...l,
        }))
      );
    }

    showToast('success', `Transformé en ${numero}.`);
    loadAll();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>DQE / Devis / Factures</h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Annuler' : '+ Nouveau DQE'}</button>
      </div>
      <p style={{ color: 'var(--text-mid)', marginTop: 6 }}>
        Créez un DQE, puis transformez-le en devis, puis en facture — sans ressaisir les lignes.
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 20, maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label>Client</label>
              <input value={client} onChange={(e) => setClient(e.target.value)} required />
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

          <div style={{ marginTop: 8, marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-mid)' }}>
            Lignes
          </div>
          {lignes.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Désignation"
                value={l.designation}
                onChange={(e) => updateLigne(i, 'designation', e.target.value)}
              />
              <input
                placeholder="Unité"
                value={l.unite}
                onChange={(e) => updateLigne(i, 'unite', e.target.value)}
              />
              <input
                type="number"
                placeholder="Qté"
                value={l.quantite}
                onChange={(e) => updateLigne(i, 'quantite', e.target.value)}
              />
              <input
                type="number"
                placeholder="PU (FCFA)"
                value={l.prix_unitaire}
                onChange={(e) => updateLigne(i, 'prix_unitaire', e.target.value)}
              />
              <button type="button" className="secondary" onClick={() => removeLigne(i)}>✕</button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={addLigne} style={{ marginBottom: 16 }}>
            + Ajouter une ligne
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div style={{ fontWeight: 600 }}>
              Total : {totalFormulaire.toLocaleString('fr-FR')} FCFA
            </div>
            <button type="submit">Créer le DQE</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 24, borderBottom: '1px solid var(--line)' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? '' : 'secondary'}
            style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          >
            {t === 'tous' ? 'Tous' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <Spinner label="Chargement des documents…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="Aucun document pour l'instant" description="Crée un DQE pour démarrer le suivi commercial du chantier." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Type</th>
                <th>Client</th>
                <th>Montant</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td>{d.numero}</td>
                  <td>{TYPE_LABEL[d.type]}</td>
                  <td>{d.client ?? '—'}</td>
                  <td>{Number(d.montant_total).toLocaleString('fr-FR')} F</td>
                  <td>
                    <span style={{ color: STATUT_LABEL[d.statut]?.color }}>
                      {STATUT_LABEL[d.statut]?.label ?? d.statut}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {d.type !== 'facture' && (
                      <button className="secondary" onClick={() => transformer(d)}>
                        Transformer en {d.type === 'dqe' ? 'devis' : 'facture'}
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
