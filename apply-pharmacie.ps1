$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "app/dashboard/pharmacie" | Out-Null
New-Item -ItemType Directory -Force -Path "supabase" | Out-Null
$enc = New-Object System.Text.UTF8Encoding($false)

$secteurs = @'
// Secteurs d'activité proposés à l'inscription. La clé est stockée en
// base (organizations.secteur). "domaine" détermine quel ensemble de
// modules métier l'entreprise voit dans son tableau de bord : les
// modules BTP pour un domaine 'btp', le module Pharmacie pour un
// domaine 'pharmacie', etc. Les modules communs (tableau de bord,
// équipe) restent toujours visibles quel que soit le domaine.
export type Domaine = 'btp' | 'pharmacie';

export const SECTEURS: { value: string; label: string; domaine: Domaine }[] = [
  { value: 'general', label: 'BTP général / Multi-activités', domaine: 'btp' },
  { value: 'gros_oeuvre', label: 'BTP général — Gros œuvre', domaine: 'btp' },
  { value: 'electricite', label: 'BTP général — Électricité', domaine: 'btp' },
  { value: 'plomberie', label: 'BTP général — Plomberie', domaine: 'btp' },
  { value: 'vrd', label: 'BTP général — VRD / Terrassement', domaine: 'btp' },
  { value: 'peinture', label: 'BTP général — Peinture / Finition', domaine: 'btp' },
  { value: 'pharmacie', label: 'Pharmacie', domaine: 'pharmacie' },
  { value: 'autre', label: 'Autre', domaine: 'btp' },
];

export function labelSecteur(value: string) {
  return SECTEURS.find((s) => s.value === value)?.label ?? value;
}

export function domainePourSecteur(value: string): Domaine {
  return SECTEURS.find((s) => s.value === value)?.domaine ?? 'btp';
}
'@
[System.IO.File]::WriteAllText("lib/secteurs.ts", $secteurs, $enc)
Write-Host "OK: lib/secteurs.ts"

$layout = @'
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from './shell';
import { domainePourSecteur, type Domaine } from '@/lib/secteurs';

const MODULES: { href: string; label: string; ready: true; domaine: Domaine | 'commun' }[] = [
  { href: '/dashboard', label: 'Tableau de bord', ready: true, domaine: 'commun' },
  { href: '/dashboard/chantiers', label: 'Chantiers & planning', ready: true, domaine: 'btp' },
  { href: '/dashboard/devis', label: 'DQE / Devis / Factures', ready: true, domaine: 'btp' },
  { href: '/dashboard/budget', label: 'Budget & dépenses', ready: true, domaine: 'btp' },
  { href: '/dashboard/achats', label: 'Achats & demandes', ready: true, domaine: 'btp' },
  { href: '/dashboard/stock', label: 'Stocks & matériaux', ready: true, domaine: 'btp' },
  { href: '/dashboard/rh', label: 'RH / Ouvriers / Tâcherons', ready: true, domaine: 'btp' },
  { href: '/dashboard/prestataires', label: 'Prestataires / Sous-traitants', ready: true, domaine: 'btp' },
  { href: '/dashboard/engins', label: 'Engins & carburant', ready: true, domaine: 'btp' },
  { href: '/dashboard/rapports', label: 'Situations & rapports', ready: true, domaine: 'btp' },
  { href: '/dashboard/pharmacie', label: 'Pharmacie', ready: true, domaine: 'pharmacie' },
  { href: '/dashboard/equipe', label: 'Équipe', ready: true, domaine: 'commun' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, actif, organization_id, organizations(name, secteur)')
    .eq('id', user.id)
    .single();

  if (profile && profile.actif === false) {
    await supabase.auth.signOut();
    redirect('/login?desactive=1');
  }

  const orgName = (profile as any)?.organizations?.name ?? '';
  const secteur = (profile as any)?.organizations?.secteur ?? 'general';
  const domaine = domainePourSecteur(secteur);
  const modulesVisibles = MODULES.filter((m) => m.domaine === 'commun' || m.domaine === domaine);

  return (
    <DashboardShell modules={modulesVisibles} orgName={orgName} userName={profile?.full_name ?? user.email ?? ''}>
      {children}
    </DashboardShell>
  );
}
'@
[System.IO.File]::WriteAllText("app/dashboard/layout.tsx", $layout, $enc)
Write-Host "OK: app/dashboard/layout.tsx"

$shell = @'
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, HardHat, FileText, Wallet, ShoppingCart, Boxes,
  Users, Handshake, Truck, ClipboardList, Menu, X, LogOut, UserPlus, Pill,
} from 'lucide-react';

type ModuleLink = { href: string; label: string; ready: boolean };

const ICONS: Record<string, any> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/chantiers': HardHat,
  '/dashboard/devis': FileText,
  '/dashboard/budget': Wallet,
  '/dashboard/achats': ShoppingCart,
  '/dashboard/stock': Boxes,
  '/dashboard/rh': Users,
  '/dashboard/prestataires': Handshake,
  '/dashboard/engins': Truck,
  '/dashboard/rapports': ClipboardList,
  '/dashboard/pharmacie': Pill,
  '/dashboard/equipe': UserPlus,
};

export default function DashboardShell({
  children,
  modules,
  orgName,
  userName,
}: {
  children: React.ReactNode;
  modules: ModuleLink[];
  orgName: string;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const sidebarContent = (
    <>
      <div className="brand" style={{ marginBottom: 4 }}>
        SOURA <span>DIGITAL</span>
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-mid)', marginBottom: 24 }}>
        {orgName}
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {modules.map((m) => {
          const active = pathname === m.href;
          const Icon = ICONS[m.href] ?? LayoutDashboard;
          return (
            <Link
              key={m.href}
              href={m.ready ? m.href : '#'}
              onClick={() => setMobileOpen(false)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: '0.9rem',
                background: active ? 'var(--panel-2)' : 'transparent',
                color: m.ready ? 'var(--text-hi)' : 'var(--text-mid)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                justifyContent: 'space-between',
                cursor: m.ready ? 'pointer' : 'default',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                {m.label}
              </span>
              {!m.ready && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-mid)' }}>Bientôt</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}>
        <div style={{ fontSize: '0.85rem', marginBottom: 10 }}>{userName}</div>
        <button className="secondary" onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <LogOut size={15} /> Se déconnecter
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="mobile-topbar">
        <div className="brand" style={{ margin: 0 }}>SOURA <span>DIGITAL</span></div>
        <button className="secondary" onClick={() => setMobileOpen(true)} style={{ padding: 8 }} aria-label="Ouvrir le menu">
          <Menu size={20} />
        </button>
      </div>

      {mobileOpen && <div className="dashboard-overlay" onClick={() => setMobileOpen(false)} />}

      <aside
        className={`dashboard-sidebar${mobileOpen ? ' open' : ''}`}
        style={{
          width: 260,
          borderRight: '1px solid var(--line)',
          background: 'var(--panel)',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {sidebarContent}
      </aside>

      <main style={{ flex: 1, padding: '32px 40px', minWidth: 0 }}>{children}</main>
    </div>
  );
}
'@
[System.IO.File]::WriteAllText("app/dashboard/shell.tsx", $shell, $enc)
Write-Host "OK: app/dashboard/shell.tsx"

$pharmaciepage = @'
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
                <tr><th>Date</th><th>Mode</th><th>Total</th></tr>
              </thead>
              <tbody>
                {ventes.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '12px 0', color: 'var(--text-mid)' }}>Aucune vente pour l'instant.</td></tr>
                ) : (
                  ventes.map((v) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td>{new Date(v.created_at).toLocaleString('fr-FR')}</td>
                      <td style={{ textTransform: 'capitalize' }}>{v.mode_paiement.replace('_', ' ')}</td>
                      <td>{v.total.toLocaleString('fr-FR')} F</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
'@
[System.IO.File]::WriteAllText("app/dashboard/pharmacie/page.tsx", $pharmaciepage, $enc)
Write-Host "OK: app/dashboard/pharmacie/page.tsx"

$migration = @'
-- ============================================================
-- MIGRATION : module Pharmacie (secteur "pharmacie")
-- Ce script ne supprime RIEN — il ajoute seulement du nouveau, donc
-- il peut être exécuté sans perdre les comptes et données existants.
-- ============================================================

create table if not exists pharmacie_produits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nom text not null,
  dci text,
  forme text,
  lot text,
  date_peremption date,
  quantite_stock numeric not null default 0,
  seuil_alerte numeric not null default 10,
  prix_achat numeric not null default 0,
  prix_vente numeric not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists pharmacie_ventes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  total numeric not null default 0,
  mode_paiement text not null default 'especes',
  vendeur_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists pharmacie_vente_lignes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  vente_id uuid not null references pharmacie_ventes(id) on delete cascade,
  produit_id uuid not null references pharmacie_produits(id) on delete restrict,
  quantite numeric not null default 1,
  prix_unitaire numeric not null default 0
);

alter table pharmacie_produits enable row level security;
alter table pharmacie_ventes enable row level security;
alter table pharmacie_vente_lignes enable row level security;

drop policy if exists "voir les produits pharmacie de son organisation" on pharmacie_produits;
create policy "voir les produits pharmacie de son organisation"
  on pharmacie_produits for select
  using (organization_id = auth_organization_id());

drop policy if exists "creer un produit pharmacie dans son organisation" on pharmacie_produits;
create policy "creer un produit pharmacie dans son organisation"
  on pharmacie_produits for insert
  with check (organization_id = auth_organization_id());

drop policy if exists "modifier les produits pharmacie de son organisation" on pharmacie_produits;
create policy "modifier les produits pharmacie de son organisation"
  on pharmacie_produits for update
  using (organization_id = auth_organization_id());

drop policy if exists "supprimer les produits pharmacie de son organisation" on pharmacie_produits;
create policy "supprimer les produits pharmacie de son organisation"
  on pharmacie_produits for delete
  using (organization_id = auth_organization_id());

drop policy if exists "voir les ventes pharmacie de son organisation" on pharmacie_ventes;
create policy "voir les ventes pharmacie de son organisation"
  on pharmacie_ventes for select
  using (organization_id = auth_organization_id());

drop policy if exists "creer une vente pharmacie dans son organisation" on pharmacie_ventes;
create policy "creer une vente pharmacie dans son organisation"
  on pharmacie_ventes for insert
  with check (organization_id = auth_organization_id());

drop policy if exists "voir les lignes de vente pharmacie de son organisation" on pharmacie_vente_lignes;
create policy "voir les lignes de vente pharmacie de son organisation"
  on pharmacie_vente_lignes for select
  using (organization_id = auth_organization_id());

drop policy if exists "creer une ligne de vente pharmacie dans son organisation" on pharmacie_vente_lignes;
create policy "creer une ligne de vente pharmacie dans son organisation"
  on pharmacie_vente_lignes for insert
  with check (organization_id = auth_organization_id());
'@
[System.IO.File]::WriteAllText("supabase/migration_pharmacie.sql", $migration, $enc)
Write-Host "OK: supabase/migration_pharmacie.sql"

git add .
git commit -m "Secteurs regroupes et module Pharmacie"
git push

Write-Host ""
Write-Host "Termine. Va maintenant coller supabase/migration_pharmacie.sql dans Supabase SQL Editor (Run)."