'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';

type Produit = {
  id: string;
  nom: string;
  dci: string | null;
  forme: string | null;
  lot: string | null;
  date_peremption: string | null;
  quantite_stock: number;
  seuil_alerte: number;
  prix_vente: number;
};

type Vente = {
  id: string;
  total: number;
  mode_paiement: string;
  created_at: string;
};

type LignePanier = { produit_id: string; nom: string; quantite: number; prix_unitaire: number };

type LigneEdition = {
  produit_id: string;
  nom: string;
  quantite: number;
  quantite_originale: number;
  prix_unitaire: number;
};

const AUJOURDHUI = () => new Date().toISOString().slice(0, 10);
const DANS_30_JOURS = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

export default function PharmaciePage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [produits, setProduits] = useState<Produit[]>([]);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState<'stock' | 'vente'>('stock');

  // Formulaire produit
  const [showProduitForm, setShowProduitForm] = useState(false);
  const [nom, setNom] = useState('');
  const [dci, setDci] = useState('');
  const [forme, setForme] = useState('');
  const [lot, setLot] = useState('');
  const [datePeremption, setDatePeremption] = useState('');
  const [quantiteStock, setQuantiteStock] = useState('0');
  const [seuilAlerte, setSeuilAlerte] = useState('10');
  const [prixAchat, setPrixAchat] = useState('0');
  const [prixVente, setPrixVente] = useState('0');

  // Caisse / vente
  const [produitChoisi, setProduitChoisi] = useState('');
  const [quantiteVente, setQuantiteVente] = useState('1');
  const [panier, setPanier] = useState<LignePanier[]>([]);
  const [modePaiement, setModePaiement] = useState('especes');

  // Édition d'une vente déjà enregistrée
  const [venteEnEdition, setVenteEnEdition] = useState<string | null>(null);
  const [lignesEdition, setLignesEdition] = useState<LigneEdition[]>([]);
  const [lignesOriginalesEdition, setLignesOriginalesEdition] = useState<LigneEdition[]>([]);
  const [modePaiementEdition, setModePaiementEdition] = useState('especes');
  const [produitAjoutEdition, setProduitAjoutEdition] = useState('');
  const [quantiteAjoutEdition, setQuantiteAjoutEdition] = useState('1');
  const [enregistrementEdition, setEnregistrementEdition] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase.from('pharmacie_produits').select('*').order('nom'),
      supabase.from('pharmacie_ventes').select('id, total, mode_paiement, created_at').order('created_at', { ascending: false }).limit(15),
    ]);
    setProduits(p ?? []);
    setVentes(v ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const produitsEnAlerte = useMemo(
    () => produits.filter((p) => p.quantite_stock <= p.seuil_alerte),
    [produits]
  );

  const produitsPerimesBientot = useMemo(
    () =>
      produits.filter(
        (p) => p.date_peremption && p.date_peremption <= DANS_30_JOURS() && p.date_peremption >= AUJOURDHUI()
      ),
    [produits]
  );

  const produitsPerimes = useMemo(
    () => produits.filter((p) => p.date_peremption && p.date_peremption < AUJOURDHUI()),
    [produits]
  );

  async function handleCreateProduit(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error } = await supabase.from('pharmacie_produits').insert({
      organization_id: profile!.organization_id,
      nom,
      dci: dci || null,
      forme: forme || null,
      lot: lot || null,
      date_peremption: datePeremption || null,
      quantite_stock: Number(quantiteStock) || 0,
      seuil_alerte: Number(seuilAlerte) || 0,
      prix_achat: Number(prixAchat) || 0,
      prix_vente: Number(prixVente) || 0,
      created_by: user!.id,
    });

    if (error) {
      showToast('error', "Impossible d'ajouter le produit.");
      return;
    }
    showToast('success', `"${nom}" ajouté au stock.`);

    setNom(''); setDci(''); setForme(''); setLot(''); setDatePeremption('');
    setQuantiteStock('0'); setSeuilAlerte('10'); setPrixAchat('0'); setPrixVente('0');
    setShowProduitForm(false);
    loadAll();
  }

  function ajouterAuPanier() {
    const produit = produits.find((p) => p.id === produitChoisi);
    if (!produit) return;
    const qte = Number(quantiteVente) || 1;

    if (qte > produit.quantite_stock) {
      showToast('error', `Stock insuffisant (${produit.quantite_stock} dispo).`);
      return;
    }

    setPanier((prev) => {
      const existant = prev.find((l) => l.produit_id === produit.id);
      if (existant) {
        return prev.map((l) =>
          l.produit_id === produit.id ? { ...l, quantite: l.quantite + qte } : l
        );
      }
      return [...prev, { produit_id: produit.id, nom: produit.nom, quantite: qte, prix_unitaire: produit.prix_vente }];
    });
    setProduitChoisi('');
    setQuantiteVente('1');
  }

  function retirerDuPanier(produitId: string) {
    setPanier((prev) => prev.filter((l) => l.produit_id !== produitId));
  }

  const totalPanier = useMemo(
    () => panier.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0),
    [panier]
  );

  async function validerVente() {
    if (panier.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { data: vente, error: errVente } = await supabase
      .from('pharmacie_ventes')
      .insert({
        organization_id: profile!.organization_id,
        total: totalPanier,
        mode_paiement: modePaiement,
        vendeur_id: user!.id,
      })
      .select('id')
      .single();

    if (errVente || !vente) {
      showToast('error', "Impossible d'enregistrer la vente.");
      return;
    }

    const lignes = panier.map((l) => ({
      organization_id: profile!.organization_id,
      vente_id: vente.id,
      produit_id: l.produit_id,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
    }));
    const { error: errLignes } = await supabase.from('pharmacie_vente_lignes').insert(lignes);

    if (errLignes) {
      showToast('error', "Vente créée mais erreur sur le détail.");
      return;
    }

    // Décrément du stock, produit par produit
    for (const l of panier) {
      const produit = produits.find((p) => p.id === l.produit_id);
      if (!produit) continue;
      await supabase
        .from('pharmacie_produits')
        .update({ quantite_stock: Math.max(0, produit.quantite_stock - l.quantite) })
        .eq('id', l.produit_id);
    }

    showToast('success', `Vente enregistrée — ${totalPanier.toLocaleString('fr-FR')} F`);
    setPanier([]);
    setModePaiement('especes');
    loadAll();
  }

  async function ouvrirEditionVente(venteId: string) {
    const vente = ventes.find((v) => v.id === venteId);
    if (!vente) return;

    const { data: lignes, error } = await supabase
      .from('pharmacie_vente_lignes')
      .select('produit_id, quantite, prix_unitaire')
      .eq('vente_id', venteId);

    if (error || !lignes) {
      showToast('error', "Impossible de charger le détail de cette vente.");
      return;
    }

    const lignesFormatees: LigneEdition[] = lignes.map((l) => {
      const produit = produits.find((p) => p.id === l.produit_id);
      return {
        produit_id: l.produit_id,
        nom: produit?.nom ?? '(produit supprimé)',
        quantite: l.quantite,
        quantite_originale: l.quantite,
        prix_unitaire: l.prix_unitaire,
      };
    });

    setVenteEnEdition(venteId);
    setLignesEdition(lignesFormatees);
    setLignesOriginalesEdition(lignesFormatees);
    setModePaiementEdition(vente.mode_paiement);
    setProduitAjoutEdition('');
    setQuantiteAjoutEdition('1');
  }

  function annulerEditionVente() {
    setVenteEnEdition(null);
    setLignesEdition([]);
    setLignesOriginalesEdition([]);
    setProduitAjoutEdition('');
    setQuantiteAjoutEdition('1');
  }

  function stockDisponiblePour(produitId: string) {
    const produit = produits.find((p) => p.id === produitId);
    const stockActuel = produit?.quantite_stock ?? 0;
    const ligneOriginale = lignesOriginalesEdition.find((l) => l.produit_id === produitId);
    // Le stock actuel ne tient pas compte de cette vente qui a déjà été décomptée :
    // on ajoute la quantité d'origine de cette ligne pour connaître la vraie disponibilité.
    return stockActuel + (ligneOriginale?.quantite_originale ?? 0);
  }

  function modifierQuantiteEdition(produitId: string, quantite: number) {
    const max = stockDisponiblePour(produitId);
    const qte = Math.max(1, Math.min(quantite, max));
    setLignesEdition((prev) =>
      prev.map((l) => (l.produit_id === produitId ? { ...l, quantite: qte } : l))
    );
  }

  function retirerLigneEdition(produitId: string) {
    setLignesEdition((prev) => prev.filter((l) => l.produit_id !== produitId));
  }

  function ajouterLigneAEdition() {
    const produit = produits.find((p) => p.id === produitAjoutEdition);
    if (!produit) return;
    const qte = Number(quantiteAjoutEdition) || 1;
    const max = stockDisponiblePour(produit.id);

    const existante = lignesEdition.find((l) => l.produit_id === produit.id);
    if (existante) {
      modifierQuantiteEdition(produit.id, existante.quantite + qte);
    } else {
      if (qte > max) {
        showToast('error', `Stock insuffisant (${max} disponible pour cette vente).`);
        return;
      }
      setLignesEdition((prev) => [
        ...prev,
        {
          produit_id: produit.id,
          nom: produit.nom,
          quantite: qte,
          quantite_originale: 0,
          prix_unitaire: produit.prix_vente,
        },
      ]);
    }
    setProduitAjoutEdition('');
    setQuantiteAjoutEdition('1');
  }

  const totalEdition = useMemo(
    () => lignesEdition.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0),
    [lignesEdition]
  );

  async function enregistrerEditionVente() {
    if (!venteEnEdition || lignesEdition.length === 0 || enregistrementEdition) return;
    setEnregistrementEdition(true);

    // Vérification finale du stock disponible pour chaque ligne
    for (const l of lignesEdition) {
      if (l.quantite > stockDisponiblePour(l.produit_id)) {
        showToast('error', `Stock insuffisant pour "${l.nom}".`);
        setEnregistrementEdition(false);
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { error: errUpdate } = await supabase
      .from('pharmacie_ventes')
      .update({ total: totalEdition, mode_paiement: modePaiementEdition })
      .eq('id', venteEnEdition);

    if (errUpdate) {
      showToast('error', "Impossible de mettre à jour la vente.");
      setEnregistrementEdition(false);
      return;
    }

    await supabase.from('pharmacie_vente_lignes').delete().eq('vente_id', venteEnEdition);

    const nouvellesLignes = lignesEdition.map((l) => ({
      organization_id: profile!.organization_id,
      vente_id: venteEnEdition,
      produit_id: l.produit_id,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
    }));
    const { error: errLignes } = await supabase.from('pharmacie_vente_lignes').insert(nouvellesLignes);

    if (errLignes) {
      showToast('error', "Vente mise à jour mais erreur sur le détail.");
      setEnregistrementEdition(false);
      return;
    }

    // Ajustement du stock : on restitue les quantités d'origine puis on retire les nouvelles
    const produitsConcernes = Array.from(new Set([
      ...lignesOriginalesEdition.map((l) => l.produit_id),
      ...lignesEdition.map((l) => l.produit_id),
    ]));

    for (const produitId of produitsConcernes) {
      const produit = produits.find((p) => p.id === produitId);
      if (!produit) continue;
      const quantiteOriginale = lignesOriginalesEdition.find((l) => l.produit_id === produitId)?.quantite ?? 0;
      const quantiteNouvelle = lignesEdition.find((l) => l.produit_id === produitId)?.quantite ?? 0;
      const nouveauStock = Math.max(0, produit.quantite_stock + quantiteOriginale - quantiteNouvelle);
      await supabase.from('pharmacie_produits').update({ quantite_stock: nouveauStock }).eq('id', produitId);
    }

    showToast('success', 'Reçu modifié avec succès.');
    setEnregistrementEdition(false);
    annulerEditionVente();
    loadAll();
  }

  if (loading) return <Spinner label="Chargement…" />;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Pharmacie</h1>

      {(produitsEnAlerte.length > 0 || produitsPerimesBientot.length > 0 || produitsPerimes.length > 0) && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          {produitsPerimes.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--danger)' }}>
              <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 6 }}>⚠ Produits périmés</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {produitsPerimes.map((p) => (
                  <span key={p.id} style={{ fontSize: '0.85rem' }}>{p.nom} (lot {p.lot || '—'})</span>
                ))}
              </div>
            </div>
          )}
          {produitsPerimesBientot.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--gold)' }}>
              <div style={{ color: 'var(--gold)', fontWeight: 600, marginBottom: 6 }}>⏳ Péremption sous 30 jours</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {produitsPerimesBientot.map((p) => (
                  <span key={p.id} style={{ fontSize: '0.85rem' }}>
                    {p.nom} — {new Date(p.date_peremption!).toLocaleDateString('fr-FR')}
                  </span>
                ))}
              </div>
            </div>
          )}
          {produitsEnAlerte.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--danger)' }}>
              <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 6 }}>⚠ Stock bas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {produitsEnAlerte.map((p) => (
                  <span key={p.id} style={{ fontSize: '0.85rem' }}>{p.nom} ({p.quantite_stock} en stock)</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={onglet === 'stock' ? '' : 'secondary'} onClick={() => setOnglet('stock')}>
          Stock & produits
        </button>
        <button className={onglet === 'vente' ? '' : 'secondary'} onClick={() => setOnglet('vente')}>
          Caisse / vente
        </button>
      </div>

      {onglet === 'stock' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Produits</h3>
            <button onClick={() => setShowProduitForm((v) => !v)}>{showProduitForm ? 'Annuler' : '+ Produit'}</button>
          </div>

          {showProduitForm && (
            <form onSubmit={handleCreateProduit} className="card" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Nom commercial</label>
                <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Doliprane 1000mg" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>DCI</label>
                  <input value={dci} onChange={(e) => setDci(e.target.value)} placeholder="ex. Paracétamol" />
                </div>
                <div className="field">
                  <label>Forme</label>
                  <input value={forme} onChange={(e) => setForme(e.target.value)} placeholder="ex. Comprimé" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>N° de lot</label>
                  <input value={lot} onChange={(e) => setLot(e.target.value)} />
                </div>
                <div className="field">
                  <label>Date de péremption</label>
                  <input type="date" value={datePeremption} onChange={(e) => setDatePeremption(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Quantité en stock</label>
                  <input type="number" value={quantiteStock} onChange={(e) => setQuantiteStock(e.target.value)} />
                </div>
                <div className="field">
                  <label>Seuil d'alerte</label>
                  <input type="number" value={seuilAlerte} onChange={(e) => setSeuilAlerte(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Prix d'achat (F)</label>
                  <input type="number" value={prixAchat} onChange={(e) => setPrixAchat(e.target.value)} />
                </div>
                <div className="field">
                  <label>Prix de vente (F)</label>
                  <input type="number" value={prixVente} onChange={(e) => setPrixVente(e.target.value)} required />
                </div>
              </div>
              <button type="submit">Ajouter</button>
            </form>
          )}

          <table className="table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Produit</th>
                <th>DCI</th>
                <th>Lot</th>
                <th>Péremption</th>
                <th>Stock</th>
                <th>Prix vente</th>
              </tr>
            </thead>
            <tbody>
              {produits.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '12px 0', color: 'var(--text-mid)' }}>Aucun produit pour l'instant.</td></tr>
              ) : (
                produits.map((p) => {
                  const alerte = p.quantite_stock <= p.seuil_alerte;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td>{p.nom}</td>
                      <td>{p.dci || '—'}</td>
                      <td>{p.lot || '—'}</td>
                      <td>{p.date_peremption ? new Date(p.date_peremption).toLocaleDateString('fr-FR') : '—'}</td>
                      <td style={{ color: alerte ? 'var(--danger)' : 'var(--text-hi)' }}>
                        {p.quantite_stock} {alerte && '⚠'}
                      </td>
                      <td>{p.prix_vente.toLocaleString('fr-FR')} F</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {onglet === 'vente' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Nouvelle vente</h3>
            <div className="card">
              <div className="field">
                <label>Produit</label>
                <select value={produitChoisi} onChange={(e) => setProduitChoisi(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {produits.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.quantite_stock <= 0}>
                      {p.nom} ({p.quantite_stock} dispo) — {p.prix_vente.toLocaleString('fr-FR')} F
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                <div className="field">
                  <label>Quantité</label>
                  <input type="number" min={1} value={quantiteVente} onChange={(e) => setQuantiteVente(e.target.value)} />
                </div>
                <button type="button" onClick={ajouterAuPanier} disabled={!produitChoisi}>
                  Ajouter au panier
                </button>
              </div>
            </div>

            <table className="table" style={{ marginTop: 16 }}>
              <thead>
                <tr><th>Produit</th><th>Qté</th><th>P.U.</th><th>Sous-total</th><th></th></tr>
              </thead>
              <tbody>
                {panier.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '12px 0', color: 'var(--text-mid)' }}>Panier vide.</td></tr>
                ) : (
                  panier.map((l) => (
                    <tr key={l.produit_id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td>{l.nom}</td>
                      <td>{l.quantite}</td>
                      <td>{l.prix_unitaire.toLocaleString('fr-FR')} F</td>
                      <td>{(l.quantite * l.prix_unitaire).toLocaleString('fr-FR')} F</td>
                      <td>
                        <button type="button" className="secondary" onClick={() => retirerDuPanier(l.produit_id)}>
                          Retirer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {panier.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong>Total</strong>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--gold)' }}>
                    {totalPanier.toLocaleString('fr-FR')} F
                  </strong>
                </div>
                <div className="field">
                  <label>Mode de paiement</label>
                  <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
                    <option value="especes">Espèces</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="assurance">Assurance</option>
                  </select>
                </div>
                <button type="button" onClick={validerVente} style={{ width: '100%' }}>
                  Valider la vente
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 style={{ marginTop: 0 }}>Ventes récentes</h3>
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Mode</th><th>Total</th><th></th></tr>
              </thead>
              <tbody>
                {ventes.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '12px 0', color: 'var(--text-mid)' }}>Aucune vente pour l'instant.</td></tr>
                ) : (
                  ventes.map((v) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td>{new Date(v.created_at).toLocaleString('fr-FR')}</td>
                      <td style={{ textTransform: 'capitalize' }}>{v.mode_paiement.replace('_', ' ')}</td>
                      <td>{v.total.toLocaleString('fr-FR')} F</td>
                      <td>
                        <button type="button" className="secondary" onClick={() => ouvrirEditionVente(v.id)}>
                          Modifier
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {venteEnEdition && (
              <div className="card" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong>Modifier le reçu</strong>
                  <button type="button" className="secondary" onClick={annulerEditionVente}>
                    Fermer
                  </button>
                </div>

                <table className="table">
                  <thead>
                    <tr><th>Produit</th><th>Qté</th><th>P.U.</th><th>Sous-total</th><th></th></tr>
                  </thead>
                  <tbody>
                    {lignesEdition.map((l) => (
                      <tr key={l.produit_id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td>{l.nom}</td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            max={stockDisponiblePour(l.produit_id)}
                            value={l.quantite}
                            onChange={(e) => modifierQuantiteEdition(l.produit_id, Number(e.target.value) || 1)}
                            style={{ width: 70 }}
                          />
                        </td>
                        <td>{l.prix_unitaire.toLocaleString('fr-FR')} F</td>
                        <td>{(l.quantite * l.prix_unitaire).toLocaleString('fr-FR')} F</td>
                        <td>
                          <button type="button" className="secondary" onClick={() => retirerLigneEdition(l.produit_id)}>
                            Retirer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginTop: 12 }}>
                  <div className="field">
                    <label>Ajouter un produit</label>
                    <select value={produitAjoutEdition} onChange={(e) => setProduitAjoutEdition(e.target.value)}>
                      <option value="">— Choisir —</option>
                      {produits.map((p) => (
                        <option key={p.id} value={p.id} disabled={stockDisponiblePour(p.id) <= 0}>
                          {p.nom} ({stockDisponiblePour(p.id)} dispo) — {p.prix_vente.toLocaleString('fr-FR')} F
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={ajouterLigneAEdition} disabled={!produitAjoutEdition}>
                    Ajouter
                  </button>
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Quantité à ajouter</label>
                  <input
                    type="number"
                    min={1}
                    value={quantiteAjoutEdition}
                    onChange={(e) => setQuantiteAjoutEdition(e.target.value)}
                    style={{ width: 100 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0' }}>
                  <strong>Nouveau total</strong>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--gold)' }}>
                    {totalEdition.toLocaleString('fr-FR')} F
                  </strong>
                </div>
                <div className="field">
                  <label>Mode de paiement</label>
                  <select value={modePaiementEdition} onChange={(e) => setModePaiementEdition(e.target.value)}>
                    <option value="especes">Espèces</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="assurance">Assurance</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={enregistrerEditionVente}
                  disabled={lignesEdition.length === 0 || enregistrementEdition}
                  style={{ width: '100%', marginTop: 12 }}
                >
                  {enregistrementEdition ? 'Enregistrement…' : 'Enregistrer les modifications'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
