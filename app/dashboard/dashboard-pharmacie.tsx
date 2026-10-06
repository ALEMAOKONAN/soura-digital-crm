'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Pill, Wallet, AlertTriangle, ShoppingCart } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import Spinner from '../components/spinner';
import EmptyState from '../components/empty-state';

type Produit = {
  id: string;
  nom: string;
  quantite_stock: number;
  seuil_alerte: number;
  date_peremption: string | null;
};

type Vente = {
  id: string;
  total: number;
  mode_paiement: string;
  created_at: string;
};

type LigneVente = { produit_id: string; quantite: number; prix_unitaire: number };

const AUJOURDHUI = () => new Date().toISOString().slice(0, 10);
const DANS_30_JOURS = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};
const DEBUT_MOIS = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const MODE_LABEL: Record<string, string> = {
  especes: 'Espèces',
  mobile_money: 'Mobile Money',
  assurance: 'Assurance',
};
const MODE_COLOR: Record<string, string> = {
  especes: '#2E9E86',
  mobile_money: '#F0A93B',
  assurance: '#3B4A5A',
};

export default function DashboardPharmacie() {
  const supabase = createClient();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [lignes, setLignes] = useState<LigneVente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: v }, { data: l }] = await Promise.all([
        supabase.from('pharmacie_produits').select('id, nom, quantite_stock, seuil_alerte, date_peremption'),
        supabase
          .from('pharmacie_ventes')
          .select('id, total, mode_paiement, created_at')
          .gte('created_at', DEBUT_MOIS())
          .order('created_at', { ascending: false }),
        supabase.from('pharmacie_vente_lignes').select('produit_id, quantite, prix_unitaire'),
      ]);
      setProduits(p ?? []);
      setVentes(v ?? []);
      setLignes(l ?? []);
      setLoading(false);
    })();
  }, []);

  const ventesDuJour = useMemo(
    () => ventes.filter((v) => v.created_at.slice(0, 10) === AUJOURDHUI()),
    [ventes]
  );
  const totalJour = useMemo(() => ventesDuJour.reduce((s, v) => s + Number(v.total), 0), [ventesDuJour]);
  const totalMois = useMemo(() => ventes.reduce((s, v) => s + Number(v.total), 0), [ventes]);

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

  const chartPaiements = useMemo(() => {
    const counts: Record<string, number> = {};
    ventes.forEach((v) => { counts[v.mode_paiement] = (counts[v.mode_paiement] ?? 0) + Number(v.total); });
    return Object.entries(counts).map(([mode, value]) => ({
      name: MODE_LABEL[mode] ?? mode,
      value,
      color: MODE_COLOR[mode] ?? '#A9B4BE',
    }));
  }, [ventes]);

  const chartTopProduits = useMemo(() => {
    const totaux: Record<string, number> = {};
    lignes.forEach((l) => {
      totaux[l.produit_id] = (totaux[l.produit_id] ?? 0) + l.quantite;
    });
    return Object.entries(totaux)
      .map(([produitId, quantite]) => {
        const produit = produits.find((p) => p.id === produitId);
        return { nom: produit ? (produit.nom.length > 14 ? produit.nom.slice(0, 14) + '…' : produit.nom) : '?', Quantité: quantite };
      })
      .sort((a, b) => b.Quantité - a.Quantité)
      .slice(0, 6);
  }, [lignes, produits]);

  if (loading) return <Spinner label="Chargement du tableau de bord…" />;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Tableau de bord — Pharmacie</h1>
      <p style={{ color: 'var(--text-mid)' }}>
        Vous ne voyez ici que les données de votre pharmacie.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 24 }}>
        <StatCard icon={ShoppingCart} label="Ventes aujourd'hui" value={String(ventesDuJour.length)} color="var(--text-hi)" />
        <StatCard icon={Wallet} label="Chiffre du jour" value={`${totalJour.toLocaleString('fr-FR')} F`} color="var(--teal)" />
        <StatCard icon={Wallet} label="Chiffre du mois" value={`${totalMois.toLocaleString('fr-FR')} F`} color="var(--gold)" />
        <StatCard icon={AlertTriangle} label="Produits en alerte" value={String(produitsEnAlerte.length)} color="var(--danger)" />
      </div>

      {(produitsEnAlerte.length > 0 || produitsPerimesBientot.length > 0) && (
        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          {produitsEnAlerte.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--danger)' }}>
              <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 6 }}>⚠ Stock bas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {produitsEnAlerte.map((p) => (
                  <span key={p.id} style={{ fontSize: '0.85rem' }}>{p.nom} ({p.quantite_stock})</span>
                ))}
              </div>
            </div>
          )}
          {produitsPerimesBientot.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--gold)' }}>
              <div style={{ color: 'var(--gold)', fontWeight: 600, marginBottom: 6 }}>⏳ Péremption sous 30 jours</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {produitsPerimesBientot.map((p) => (
                  <span key={p.id} style={{ fontSize: '0.85rem' }}>{p.nom}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {ventes.length === 0 ? (
        <div style={{ marginTop: 32 }}>
          <EmptyState
            icon={Pill}
            title="Aucune vente ce mois-ci"
            description="Enregistre une vente dans Caisse / vente pour voir apparaître les statistiques ici."
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, marginTop: 32, alignItems: 'start' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Produits les plus vendus (ce mois)</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartTopProduits}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="nom" stroke="var(--text-mid)" fontSize={12} />
                  <YAxis stroke="var(--text-mid)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.85rem' }}
                  />
                  <Bar dataKey="Quantité" fill="#2E9E86" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Chiffre d'affaires par mode de paiement</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chartPaiements} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {chartPaiements.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--text-mid)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.85rem' }}
                    formatter={(v: number) => v.toLocaleString('fr-FR') + ' F'}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-mid)', fontSize: '0.85rem' }}>{label}</span>
        <Icon size={18} color={color} strokeWidth={2} />
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
