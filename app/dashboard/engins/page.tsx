'use client';

import { useEffect, useState, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Truck } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';
import EmptyState from '../../components/empty-state';

type Chantier = { id: string; nom: string };
type Engin = {
  id: string;
  nom: string;
  type: string | null;
  immatriculation: string | null;
  statut: string;
  chantier_id: string | null;
};
type Carburant = { engin_id: string; litres: number; cout: number };
type Maintenance = { engin_id: string; cout: number };

const STATUT_LABEL: Record<string, { label: string; color: string }> = {
  en_activite: { label: 'En activité', color: 'var(--teal)' },
  en_maintenance: { label: 'En maintenance', color: 'var(--gold)' },
  a_l_arret: { label: "À l'arrêt", color: 'var(--danger)' },
};

export default function EnginsPage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [engins, setEngins] = useState<Engin[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [carburant, setCarburant] = useState<Carburant[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [nom, setNom] = useState('');
  const [type, setType] = useState('');
  const [immatriculation, setImmatriculation] = useState('');
  const [chantierId, setChantierId] = useState('');

  const [panelOuvert, setPanelOuvert] = useState<{ enginId: string; mode: 'carburant' | 'maintenance' } | null>(null);
  const [litres, setLitres] = useState('');
  const [coutCarburant, setCoutCarburant] = useState('');
  const [descriptionMaintenance, setDescriptionMaintenance] = useState('');
  const [coutMaintenance, setCoutMaintenance] = useState('');

  async function loadAll() {
    setLoading(true);
    const [{ data: e }, { data: c }, { data: carb }, { data: maint }] = await Promise.all([
      supabase.from('engins').select('*').order('created_at'),
      supabase.from('chantiers').select('id, nom'),
      supabase.from('carburant').select('engin_id, litres, cout'),
      supabase.from('maintenances').select('engin_id, cout'),
    ]);
    setEngins(e ?? []);
    setChantiers(c ?? []);
    setCarburant(carb ?? []);
    setMaintenances(maint ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function nomChantier(id: string | null) {
    return chantiers.find((c) => c.id === id)?.nom ?? '—';
  }

  function totalLitres(enginId: string) {
    return carburant.filter((c) => c.engin_id === enginId).reduce((s, c) => s + Number(c.litres), 0);
  }

  function totalCoutCarburant(enginId: string) {
    return carburant.filter((c) => c.engin_id === enginId).reduce((s, c) => s + Number(c.cout), 0);
  }

  function totalCoutMaintenance(enginId: string) {
    return maintenances.filter((m) => m.engin_id === enginId).reduce((s, m) => s + Number(m.cout), 0);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('engins').insert({
      organization_id: profile!.organization_id,
      nom,
      type,
      immatriculation,
      chantier_id: chantierId || null,
    });

    if (error) {
      showToast('error', "Impossible d'ajouter l'engin.");
      return;
    }
    showToast('success', `"${nom}" ajouté.`);

    setNom('');
    setType('');
    setImmatriculation('');
    setChantierId('');
    setShowForm(false);
    loadAll();
  }

  async function changerStatut(engin: Engin, statut: string) {
    await supabase.from('engins').update({ statut }).eq('id', engin.id);
    showToast('success', 'Statut mis à jour.');
    loadAll();
  }

  async function handleCarburant(e: React.FormEvent, enginId: string) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('carburant').insert({
      organization_id: profile!.organization_id,
      engin_id: enginId,
      litres: Number(litres) || 0,
      cout: Number(coutCarburant) || 0,
      created_by: user!.id,
    });

    if (error) {
      showToast('error', "Impossible d'enregistrer le plein.");
      return;
    }
    showToast('success', 'Plein enregistré.');

    setLitres('');
    setCoutCarburant('');
    setPanelOuvert(null);
    loadAll();
  }

  async function handleMaintenance(e: React.FormEvent, enginId: string) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('maintenances').insert({
      organization_id: profile!.organization_id,
      engin_id: enginId,
      description: descriptionMaintenance,
      cout: Number(coutMaintenance) || 0,
      created_by: user!.id,
    });

    if (error) {
      showToast('error', "Impossible d'enregistrer la maintenance.");
      return;
    }
    showToast('success', 'Maintenance enregistrée.');

    setDescriptionMaintenance('');
    setCoutMaintenance('');
    setPanelOuvert(null);
    loadAll();
  }

  if (loading) return <Spinner label="Chargement…" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Engins & carburant</h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Annuler' : '+ Engin'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 20, maxWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Nom</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Chargeur CAT 320" required />
            </div>
            <div className="field">
              <label>Type</label>
              <input value={type} onChange={(e) => setType(e.target.value)} placeholder="ex. Chargeur" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Immatriculation</label>
              <input value={immatriculation} onChange={(e) => setImmatriculation(e.target.value)} />
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
          <button type="submit">Ajouter l'engin</button>
        </form>
      )}

      <div style={{ marginTop: 24 }}>
        {engins.length === 0 ? (
          <EmptyState icon={Truck} title="Aucun engin pour l'instant" description="Ajoute un engin pour suivre son carburant et sa maintenance." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Engin</th>
                <th>Chantier</th>
                <th>Statut</th>
                <th>Carburant</th>
                <th>Maintenance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {engins.map((e) => (
                <Fragment key={e.id}>
                  <tr style={{ borderBottom: panelOuvert?.enginId === e.id ? 'none' : '1px solid var(--line)' }}>
                    <td>
                      {e.nom} <span style={{ color: 'var(--text-mid)', fontSize: '0.8rem' }}>{e.immatriculation}</span>
                    </td>
                    <td>{nomChantier(e.chantier_id)}</td>
                    <td>
                      <select
                        value={e.statut}
                        onChange={(ev) => changerStatut(e, ev.target.value)}
                        style={{ color: STATUT_LABEL[e.statut]?.color, width: 'auto' }}
                      >
                        <option value="en_activite">En activité</option>
                        <option value="en_maintenance">En maintenance</option>
                        <option value="a_l_arret">À l'arrêt</option>
                      </select>
                    </td>
                    <td>{totalLitres(e.id)} L — {totalCoutCarburant(e.id).toLocaleString('fr-FR')} F</td>
                    <td>{totalCoutMaintenance(e.id).toLocaleString('fr-FR')} F</td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="secondary" onClick={() => setPanelOuvert(panelOuvert?.enginId === e.id && panelOuvert.mode === 'carburant' ? null : { enginId: e.id, mode: 'carburant' })}>
                        + Plein
                      </button>
                      <button className="secondary" onClick={() => setPanelOuvert(panelOuvert?.enginId === e.id && panelOuvert.mode === 'maintenance' ? null : { enginId: e.id, mode: 'maintenance' })}>
                        + Maintenance
                      </button>
                    </td>
                  </tr>
                  {panelOuvert?.enginId === e.id && panelOuvert.mode === 'carburant' && (
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <td colSpan={6} style={{ paddingBottom: 16 }}>
                        <form onSubmit={(ev) => handleCarburant(ev, e.id)} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Litres</label>
                            <input type="number" value={litres} onChange={(ev) => setLitres(ev.target.value)} required />
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Coût (FCFA)</label>
                            <input type="number" value={coutCarburant} onChange={(ev) => setCoutCarburant(ev.target.value)} required />
                          </div>
                          <button type="submit">Enregistrer</button>
                        </form>
                      </td>
                    </tr>
                  )}
                  {panelOuvert?.enginId === e.id && panelOuvert.mode === 'maintenance' && (
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <td colSpan={6} style={{ paddingBottom: 16 }}>
                        <form onSubmit={(ev) => handleMaintenance(ev, e.id)} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Description</label>
                            <input value={descriptionMaintenance} onChange={(ev) => setDescriptionMaintenance(ev.target.value)} placeholder="ex. Vidange" required />
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Coût (FCFA)</label>
                            <input type="number" value={coutMaintenance} onChange={(ev) => setCoutMaintenance(ev.target.value)} required />
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
