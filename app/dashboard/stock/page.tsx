'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Boxes } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';
import EmptyState from '../../components/empty-state';

type Chantier = { id: string; nom: string };
type Materiau = { id: string; nom: string; categorie: string | null; unite: string; seuil_alerte: number };
type Mouvement = {
  id: string;
  materiau_id: string;
  chantier_id: string | null;
  type: 'entree' | 'sortie';
  quantite: number;
  date_mouvement: string;
};

export default function StockPage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [materiaux, setMateriaux] = useState<Materiau[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [loading, setLoading] = useState(true);

  const [showMateriauForm, setShowMateriauForm] = useState(false);
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('');
  const [unite, setUnite] = useState('u');
  const [seuilAlerte, setSeuilAlerte] = useState('0');

  const [showMouvementForm, setShowMouvementForm] = useState(false);
  const [materiauId, setMateriauId] = useState('');
  const [typeMouvement, setTypeMouvement] = useState<'entree' | 'sortie'>('entree');
  const [quantite, setQuantite] = useState('1');
  const [chantierId, setChantierId] = useState('');
  const [dateMouvement, setDateMouvement] = useState(() => new Date().toISOString().slice(0, 10));

  async function loadAll() {
    setLoading(true);
    const [{ data: m }, { data: mv }, { data: c }] = await Promise.all([
      supabase.from('materiaux').select('*').order('created_at'),
      supabase.from('mouvements_stock').select('*').order('date_mouvement', { ascending: false }),
      supabase.from('chantiers').select('id, nom'),
    ]);
    setMateriaux(m ?? []);
    setMouvements(mv ?? []);
    setChantiers(c ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function stockActuel(materiauId: string) {
    return mouvements
      .filter((mv) => mv.materiau_id === materiauId)
      .reduce((s, mv) => s + (mv.type === 'entree' ? mv.quantite : -mv.quantite), 0);
  }

  function nomMateriau(id: string) {
    return materiaux.find((m) => m.id === id)?.nom ?? '—';
  }

  function nomChantier(id: string | null) {
    return chantiers.find((c) => c.id === id)?.nom ?? '—';
  }

  const materiauxEnAlerte = useMemo(
    () => materiaux.filter((m) => stockActuel(m.id) <= m.seuil_alerte && m.seuil_alerte > 0),
    [materiaux, mouvements]
  );

  async function handleCreateMateriau(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('materiaux').insert({
      organization_id: profile!.organization_id,
      nom,
      categorie,
      unite,
      seuil_alerte: Number(seuilAlerte) || 0,
    });

    if (error) {
      showToast('error', "Impossible d'ajouter le matériau.");
      return;
    }
    showToast('success', `"${nom}" ajouté.`);

    setNom('');
    setCategorie('');
    setUnite('u');
    setSeuilAlerte('0');
    setShowMateriauForm(false);
    loadAll();
  }

  async function handleCreateMouvement(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('mouvements_stock').insert({
      organization_id: profile!.organization_id,
      materiau_id: materiauId,
      chantier_id: chantierId || null,
      type: typeMouvement,
      quantite: Number(quantite) || 0,
      date_mouvement: dateMouvement,
      created_by: user!.id,
    });

    if (error) {
      showToast('error', "Impossible d'enregistrer le mouvement.");
      return;
    }
    showToast('success', typeMouvement === 'entree' ? 'Entrée enregistrée.' : 'Sortie enregistrée.');

    setMateriauId('');
    setQuantite('1');
    setChantierId('');
    setShowMouvementForm(false);
    loadAll();
  }

  if (loading) return <Spinner label="Chargement…" />;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Stocks & matériaux</h1>

      {materiauxEnAlerte.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 20 }}>
          <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 6 }}>⚠ Seuil bas atteint</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {materiauxEnAlerte.map((m) => (
              <span key={m.id} style={{ fontSize: '0.85rem', color: 'var(--text-hi)' }}>
                {m.nom} ({stockActuel(m.id)} {m.unite})
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Matériaux</h3>
            <button onClick={() => setShowMateriauForm((v) => !v)}>{showMateriauForm ? 'Annuler' : '+ Matériau'}</button>
          </div>

          {showMateriauForm && (
            <form onSubmit={handleCreateMateriau} className="card" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Nom</label>
                <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Sac de ciment 50kg" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Catégorie</label>
                  <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="ex. Gros œuvre" />
                </div>
                <div className="field">
                  <label>Unité</label>
                  <input value={unite} onChange={(e) => setUnite(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Seuil d'alerte (0 = pas d'alerte)</label>
                <input type="number" value={seuilAlerte} onChange={(e) => setSeuilAlerte(e.target.value)} />
              </div>
              <button type="submit">Ajouter</button>
            </form>
          )}

          <table className="table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Matériau</th>
                <th>Catégorie</th>
                <th>Stock actuel</th>
              </tr>
            </thead>
            <tbody>
              {materiaux.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: '12px 0', color: 'var(--text-mid)' }}>Aucun matériau pour l'instant.</td></tr>
              ) : (
                materiaux.map((m) => {
                  const stock = stockActuel(m.id);
                  const alerte = m.seuil_alerte > 0 && stock <= m.seuil_alerte;
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td>{m.nom}</td>
                      <td>{m.categorie || '—'}</td>
                      <td style={{ color: alerte ? 'var(--danger)' : 'var(--text-hi)' }}>
                        {stock} {m.unite} {alerte && '⚠'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Mouvements récents</h3>
            <button onClick={() => setShowMouvementForm((v) => !v)} disabled={materiaux.length === 0}>
              {showMouvementForm ? 'Annuler' : '+ Mouvement'}
            </button>
          </div>

          {materiaux.length === 0 && (
            <p style={{ color: 'var(--text-mid)', fontSize: '0.85rem', marginTop: 8 }}>
              Ajoute d'abord un matériau pour pouvoir enregistrer un mouvement.
            </p>
          )}

          {showMouvementForm && (
            <form onSubmit={handleCreateMouvement} className="card" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Matériau</label>
                <select value={materiauId} onChange={(e) => setMateriauId(e.target.value)} required>
                  <option value="">— Choisir —</option>
                  {materiaux.map((m) => (
                    <option key={m.id} value={m.id}>{m.nom}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Type</label>
                  <select value={typeMouvement} onChange={(e) => setTypeMouvement(e.target.value as 'entree' | 'sortie')}>
                    <option value="entree">Entrée (livraison)</option>
                    <option value="sortie">Sortie (utilisation)</option>
                  </select>
                </div>
                <div className="field">
                  <label>Quantité</label>
                  <input type="number" value={quantite} onChange={(e) => setQuantite(e.target.value)} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Chantier (optionnel)</label>
                  <select value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
                    <option value="">— Aucun —</option>
                    {chantiers.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={dateMouvement} onChange={(e) => setDateMouvement(e.target.value)} required />
                </div>
              </div>
              <button type="submit">Enregistrer</button>
            </form>
          )}

          <table className="table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Matériau</th>
                <th>Type</th>
                <th>Qté</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '12px 0', color: 'var(--text-mid)' }}>Aucun mouvement pour l'instant.</td></tr>
              ) : (
                mouvements.slice(0, 10).map((mv) => (
                  <tr key={mv.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td>{nomMateriau(mv.materiau_id)}</td>
                    <td style={{ color: mv.type === 'entree' ? 'var(--teal)' : 'var(--gold)' }}>
                      {mv.type === 'entree' ? 'Entrée' : 'Sortie'}
                    </td>
                    <td>{mv.quantite}</td>
                    <td>{new Date(mv.date_mouvement).toLocaleDateString('fr-FR')}</td>
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
