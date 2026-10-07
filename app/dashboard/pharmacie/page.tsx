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
  assurance_nom: string | null;
  assurance_numero_adherent: string | null;
  assurance_numero_bon: string | null;
  assurance_taux_couverture: number | null;
  assurance_patient_nom: string | null;
  mobile_money_operateur: string | null;
  mobile_money_numero: string | null;
  montant_recu: number | null;
  monnaie_rendue: number | null;
};

const OPERATEURS_MOBILE_MONEY = [
  'Orange Money',
  'MTN Mobile Money',
  'Moov Money',
  'Wave',
];

type LignePanier = { produit_id: string; nom: string; quantite: number; prix_unitaire: number };

type LigneRecu = { nom: string; quantite: number; prix_unitaire: number };

type Recu = {
  numero: string;
  date: string;
  lignes: LigneRecu[];
  total: number;
  modePaiement: string;
  assuranceNom?: string | null;
  assuranceNumeroAdherent?: string | null;
  assuranceNumeroBon?: string | null;
  assuranceTauxCouverture?: number | null;
  assurancePatientNom?: string | null;
  mobileMoneyOperateur?: string | null;
  mobileMoneyNumero?: string | null;
  montantRecu?: number | null;
  monnaieRendue?: number | null;
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

  // Détails assurance (visibles uniquement si mode de paiement = assurance)
  const [assuranceNom, setAssuranceNom] = useState('');
  const [assuranceNumeroAdherent, setAssuranceNumeroAdherent] = useState('');
  const [assuranceNumeroBon, setAssuranceNumeroBon] = useState('');
  const [assuranceTauxCouverture, setAssuranceTauxCouverture] = useState('100');
  const [assurancePatientNom, setAssurancePatientNom] = useState('');

  // Détails mobile money (visibles uniquement si mode de paiement = mobile_money)
  const [mobileMoneyOperateur, setMobileMoneyOperateur] = useState(OPERATEURS_MOBILE_MONEY[0]);
  const [mobileMoneyNumero, setMobileMoneyNumero] = useState('');

  // Rendu de monnaie (visible uniquement si mode de paiement = espèces)
  const [montantRecu, setMontantRecu] = useState('');

  // Reçu affiché/imprimable (vente qui vient d'être validée, ou vente passée)
  const [recu, setRecu] = useState<Recu | null>(null);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('organizations(name)')
        .eq('id', user.id)
        .single();
      setOrgName((profile as any)?.organizations?.name ?? '');
    })();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase.from('pharmacie_produits').select('*').order('nom'),
      supabase
        .from('pharmacie_ventes')
        .select('id, total, mode_paiement, created_at, assurance_nom, assurance_numero_adherent, assurance_numero_bon, assurance_taux_couverture, assurance_patient_nom, mobile_money_operateur, mobile_money_numero, montant_recu, monnaie_rendue')
        .order('created_at', { ascending: false })
        .limit(15),
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

  async function imprimerVentePassee(v: Vente) {
    const { data: lignes } = await supabase
      .from('pharmacie_vente_lignes')
      .select('quantite, prix_unitaire, pharmacie_produits(nom)')
      .eq('vente_id', v.id);

    setRecu({
      numero: v.id.slice(0, 8).toUpperCase(),
      date: v.created_at,
      lignes: (lignes ?? []).map((l: any) => ({
        nom: l.pharmacie_produits?.nom ?? '—',
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
      })),
      total: v.total,
      modePaiement: v.mode_paiement,
      assuranceNom: v.assurance_nom,
      assuranceNumeroAdherent: v.assurance_numero_adherent,
      assuranceNumeroBon: v.assurance_numero_bon,
      assuranceTauxCouverture: v.assurance_taux_couverture,
      assurancePatientNom: v.assurance_patient_nom,
      mobileMoneyOperateur: v.mobile_money_operateur,
      mobileMoneyNumero: v.mobile_money_numero,
      montantRecu: v.montant_recu,
      monnaieRendue: v.monnaie_rendue,
    });
  }

  const totalPanier = useMemo(
    () => panier.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0),
    [panier]
  );

  const tauxCouvertureNum = Math.min(100, Math.max(0, Number(assuranceTauxCouverture) || 0));
  const montantPrisEnCharge = modePaiement === 'assurance' ? Math.round(totalPanier * (tauxCouvertureNum / 100)) : 0;
  const resteACharge = totalPanier - montantPrisEnCharge;

  const montantRecuNum = Number(montantRecu) || 0;
  const monnaieARendre = modePaiement === 'especes' ? Math.max(0, montantRecuNum - totalPanier) : 0;

  async function validerVente() {
    if (panier.length === 0) return;

    if (modePaiement === 'assurance' && (!assuranceNom.trim() || !assuranceNumeroAdherent.trim())) {
      showToast('error', "Renseigne au moins le nom de l'assurance et le n° d'adhérent.");
      return;
    }

    if (modePaiement === 'mobile_money' && !mobileMoneyOperateur) {
      showToast('error', "Choisis l'opérateur mobile money.");
      return;
    }

    if (modePaiement === 'especes' && montantRecu.trim() === '') {
      showToast('error', "Indique le montant reçu du client.");
      return;
    }

    if (modePaiement === 'especes' && montantRecuNum < totalPanier) {
      showToast('error', 'Le montant reçu est inférieur au total de la vente.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user!.id).single();

    const { data: vente, error: errVente } = await supabase
      .from('pharmacie_ventes')
      .insert({
        organization_id: profile!.organization_id,
        total: totalPanier,
        mode_paiement: modePaiement,
        vendeur_id: user!.id,
        assurance_nom: modePaiement === 'assurance' ? assuranceNom.trim() : null,
        assurance_numero_adherent: modePaiement === 'assurance' ? assuranceNumeroAdherent.trim() : null,
        assurance_numero_bon: modePaiement === 'assurance' ? (assuranceNumeroBon.trim() || null) : null,
        assurance_taux_couverture: modePaiement === 'assurance' ? tauxCouvertureNum : null,
        assurance_montant_couvert: modePaiement === 'assurance' ? montantPrisEnCharge : null,
        assurance_patient_nom: modePaiement === 'assurance' ? (assurancePatientNom.trim() || null) : null,
        mobile_money_operateur: modePaiement === 'mobile_money' ? mobileMoneyOperateur : null,
        mobile_money_numero: modePaiement === 'mobile_money' ? (mobileMoneyNumero.trim() || null) : null,
        montant_recu: modePaiement === 'especes' ? montantRecuNum : null,
        monnaie_rendue: modePaiement === 'especes' ? monnaieARendre : null,
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

    setRecu({
      numero: vente.id.slice(0, 8).toUpperCase(),
      date: new Date().toISOString(),
      lignes: panier.map((l) => ({ nom: l.nom, quantite: l.quantite, prix_unitaire: l.prix_unitaire })),
      total: totalPanier,
      modePaiement,
      assuranceNom: modePaiement === 'assurance' ? assuranceNom.trim() : null,
      assuranceNumeroAdherent: modePaiement === 'assurance' ? assuranceNumeroAdherent.trim() : null,
      assuranceNumeroBon: modePaiement === 'assurance' ? (assuranceNumeroBon.trim() || null) : null,
      assuranceTauxCouverture: modePaiement === 'assurance' ? tauxCouvertureNum : null,
      assurancePatientNom: modePaiement === 'assurance' ? (assurancePatientNom.trim() || null) : null,
      mobileMoneyOperateur: modePaiement === 'mobile_money' ? mobileMoneyOperateur : null,
      mobileMoneyNumero: modePaiement === 'mobile_money' ? (mobileMoneyNumero.trim() || null) : null,
      montantRecu: modePaiement === 'especes' ? montantRecuNum : null,
      monnaieRendue: modePaiement === 'especes' ? monnaieARendre : null,
    });

    setPanier([]);
    setModePaiement('especes');
    setAssuranceNom('');
    setAssuranceNumeroAdherent('');
    setAssuranceNumeroBon('');
    setAssuranceTauxCouverture('100');
    setAssurancePatientNom('');
    setMobileMoneyOperateur(OPERATEURS_MOBILE_MONEY[0]);
    setMobileMoneyNumero('');
    setMontantRecu('');
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

                {modePaiement === 'especes' && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-mid)', marginBottom: 10 }}>
                      Rendu de monnaie
                    </div>
                    <div className="field">
                      <label>Montant reçu du client (F)</label>
                      <input
                        type="number"
                        min={0}
                        value={montantRecu}
                        onChange={(e) => setMontantRecu(e.target.value)}
                        placeholder={`ex. ${totalPanier}`}
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: 8 }}>
                      <span>Monnaie à rendre</span>
                      <strong>{montantRecu.trim() !== '' ? monnaieARendre.toLocaleString('fr-FR') : '—'} F</strong>
                    </div>
                  </div>
                )}

                {modePaiement === 'mobile_money' && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-mid)', marginBottom: 10 }}>
                      Détails du paiement mobile money
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="field">
                        <label>Opérateur</label>
                        <select
                          value={mobileMoneyOperateur}
                          onChange={(e) => setMobileMoneyOperateur(e.target.value)}
                        >
                          {OPERATEURS_MOBILE_MONEY.map((op) => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>N° de transaction / téléphone (optionnel)</label>
                        <input
                          value={mobileMoneyNumero}
                          onChange={(e) => setMobileMoneyNumero(e.target.value)}
                          placeholder="ex. 07 00 00 00 00"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {modePaiement === 'assurance' && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-mid)', marginBottom: 10 }}>
                      Détails de la prise en charge
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="field">
                        <label>Compagnie d'assurance</label>
                        <input
                          value={assuranceNom}
                          onChange={(e) => setAssuranceNom(e.target.value)}
                          placeholder="ex. NSIA, SUNU, ASACI…"
                          required
                        />
                      </div>
                      <div className="field">
                        <label>N° d'adhérent / carte</label>
                        <input
                          value={assuranceNumeroAdherent}
                          onChange={(e) => setAssuranceNumeroAdherent(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label>Nom du malade (si différent de l'adhérent)</label>
                      <input
                        value={assurancePatientNom}
                        onChange={(e) => setAssurancePatientNom(e.target.value)}
                        placeholder="optionnel — nom de la personne qui utilise le bon"
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="field">
                        <label>N° de bon / prise en charge</label>
                        <input
                          value={assuranceNumeroBon}
                          onChange={(e) => setAssuranceNumeroBon(e.target.value)}
                          placeholder="optionnel"
                        />
                      </div>
                      <div className="field">
                        <label>Taux de prise en charge (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={assuranceTauxCouverture}
                          onChange={(e) => setAssuranceTauxCouverture(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: 8 }}>
                      <span>Pris en charge par l'assurance</span>
                      <strong>{montantPrisEnCharge.toLocaleString('fr-FR')} F</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>Reste à la charge du patient</span>
                      <strong>{resteACharge.toLocaleString('fr-FR')} F</strong>
                    </div>
                  </div>
                )}

                <button type="button" onClick={validerVente} style={{ width: '100%', marginTop: 12 }}>
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
                      <td style={{ textTransform: 'capitalize' }}>
                        {v.mode_paiement.replace('_', ' ')}
                        {v.mode_paiement === 'especes' && v.montant_recu != null && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-mid)', textTransform: 'none' }}>
                            Reçu {v.montant_recu.toLocaleString('fr-FR')} F · Rendu {(v.monnaie_rendue ?? 0).toLocaleString('fr-FR')} F
                          </div>
                        )}
                        {v.mode_paiement === 'mobile_money' && v.mobile_money_operateur && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-mid)', textTransform: 'none' }}>
                            {v.mobile_money_operateur}
                            {v.mobile_money_numero ? ` — ${v.mobile_money_numero}` : ''}
                          </div>
                        )}
                        {v.mode_paiement === 'assurance' && v.assurance_nom && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-mid)', textTransform: 'none' }}>
                            {v.assurance_nom}
                            {v.assurance_numero_adherent ? ` — ${v.assurance_numero_adherent}` : ''}
                            {v.assurance_taux_couverture != null ? ` (${v.assurance_taux_couverture}%)` : ''}
                            {v.assurance_patient_nom ? ` · Malade : ${v.assurance_patient_nom}` : ''}
                          </div>
                        )}
                      </td>
                      <td>{v.total.toLocaleString('fr-FR')} F</td>
                      <td>
                        <button type="button" className="secondary" onClick={() => imprimerVentePassee(v)}>
                          Reçu
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-mid)', marginTop: 8 }}>
              Une vente validée est définitive et ne peut plus être modifiée.
            </p>
          </div>
        </div>
      )}

      {recu && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#fff', color: '#111', borderRadius: 8, padding: 24, width: 360, maxHeight: '90vh', overflow: 'auto' }}>
            <div id="zone-impression">
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: '1.05rem' }}>{orgName || 'Pharmacie'}</strong>
                <div style={{ fontSize: '0.8rem' }}>Reçu de vente</div>
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: 8 }}>
                <div>N° {recu.numero}</div>
                <div>{new Date(recu.date).toLocaleString('fr-FR')}</div>
              </div>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <th style={{ textAlign: 'left' }}>Produit</th>
                    <th>Qté</th>
                    <th>P.U.</th>
                    <th>S/total</th>
                  </tr>
                </thead>
                <tbody>
                  {recu.lignes.map((l, i) => (
                    <tr key={i}>
                      <td>{l.nom}</td>
                      <td style={{ textAlign: 'center' }}>{l.quantite}</td>
                      <td style={{ textAlign: 'right' }}>{l.prix_unitaire.toLocaleString('fr-FR')}</td>
                      <td style={{ textAlign: 'right' }}>{(l.quantite * l.prix_unitaire).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  marginTop: 8,
                  borderTop: '1px solid #000',
                  paddingTop: 8,
                }}
              >
                <span>Total</span>
                <span>{recu.total.toLocaleString('fr-FR')} F</span>
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: 8, textTransform: 'capitalize' }}>
                Paiement : {recu.modePaiement.replace('_', ' ')}
              </div>
              {recu.modePaiement === 'especes' && recu.montantRecu != null && (
                <div style={{ fontSize: '0.75rem' }}>
                  Reçu : {recu.montantRecu.toLocaleString('fr-FR')} F — Rendu : {(recu.monnaieRendue ?? 0).toLocaleString('fr-FR')} F
                </div>
              )}
              {recu.modePaiement === 'mobile_money' && recu.mobileMoneyOperateur && (
                <div style={{ fontSize: '0.75rem' }}>
                  {recu.mobileMoneyOperateur}
                  {recu.mobileMoneyNumero ? ` — ${recu.mobileMoneyNumero}` : ''}
                </div>
              )}
              {recu.modePaiement === 'assurance' && recu.assuranceNom && (
                <div style={{ fontSize: '0.75rem' }}>
                  {recu.assuranceNom}
                  {recu.assuranceNumeroAdherent ? ` — ${recu.assuranceNumeroAdherent}` : ''}
                  {recu.assuranceTauxCouverture != null ? ` (${recu.assuranceTauxCouverture}%)` : ''}
                  {recu.assurancePatientNom ? ` · Malade : ${recu.assurancePatientNom}` : ''}
                </div>
              )}
              <div style={{ textAlign: 'center', fontSize: '0.75rem', marginTop: 16 }}>Merci de votre visite</div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => window.print()} style={{ flex: 1 }}>
                Imprimer
              </button>
              <button type="button" className="secondary" onClick={() => setRecu(null)} style={{ flex: 1 }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #zone-impression,
          #zone-impression * {
            visibility: visible;
          }
          #zone-impression {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            padding: 16px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
