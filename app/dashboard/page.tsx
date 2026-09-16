'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HardHat, Wallet, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import Spinner from '../components/spinner';
import EmptyState from '../components/empty-state';

type Chantier = { id: string; nom: string; statut: string; budget: number | null };
type BudgetPoste = { chantier_id: string; montant_prevu: number };
type Depense = { chantier_id: string; montant: number };

const STATUT_COLOR: Record<string, string> = {
  en_cours: '#2E9E86',
  en_retard: '#E5484D',
  termine: '#A9B4BE',
  a_venir: '#F0A93B',
};
const STATUT_LABEL: Record<string, string> = {
  en_cours: 'En cours', en_retard: 'En retard', termine: 'Terminé', a_venir: 'À venir',
};

export default function DashboardPage() {
  const supabase = createClient();
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [postes, setPostes] = useState<BudgetPoste[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }, { data: d }] = await Promise.all([
        supabase.from('chantiers').select('id, nom, statut, budget'),
        supabase.from('budget_postes').select('chantier_id, montant_prevu'),
        supabase.from('depenses').select('chantier_id, montant'),
      ]);
      setChantiers(c ?? []);
      setPostes(p ?? []);
      setDepenses(d ?? []);
      setLoading(false);
    })();
  }, []);

  const total = chantiers.length;
  const enCours = chantiers.filter((c) => c.statut === 'en_cours').length;
  const enRetard = chantiers.filter((c) => c.statut === 'en_retard').length;
  const budgetTotal = useMemo(() => postes.reduce((s, p) => s + Number(p.montant_prevu), 0), [postes]);
  const depenseTotal = useMemo(() => depenses.reduce((s, d) => s + Number(d.montant), 0), [depenses]);

  const chartBudget = useMemo(
    () =>
      chantiers.map((c) => ({
        nom: c.nom.length > 14 ? c.nom.slice(0, 14) + '…' : c.nom,
        Prévu: postes.filter((p) => p.chantier_id === c.id).reduce((s, p) => s + Number(p.montant_prevu), 0),
        Dépensé: depenses.filter((d) => d.chantier_id === c.id).reduce((s, d) => s + Number(d.montant), 0),
      })),
    [chantiers, postes, depenses]
  );

  const chartStatuts = useMemo(() => {
    const counts: Record<string, number> = {};
    chantiers.forEach((c) => { counts[c.statut] = (counts[c.statut] ?? 0) + 1; });
    return Object.entries(counts).map(([statut, value]) => ({
      name: STATUT_LABEL[statut] ?? statut,
      value,
      color: STATUT_COLOR[statut] ?? '#A9B4BE',
    }));
  }, [chantiers]);

  if (loading) return <Spinner label="Chargement du tableau de bord…" />;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Tableau de bord</h1>
      <p style={{ color: 'var(--text-mid)' }}>
        Vous ne voyez ici que les données de votre entreprise.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 24 }}>
        <StatCard icon={HardHat} label="Chantiers" value={String(total)} color="var(--text-hi)" />
        <StatCard icon={TrendingUp} label="En cours" value={String(enCours)} color="var(--teal)" />
        <StatCard icon={AlertTriangle} label="En retard" value={String(enRetard)} color="var(--danger)" />
        <StatCard icon={Wallet} label="Budget cumulé" value={`${budgetTotal.toLocaleString('fr-FR')} F`} color="var(--gold)" />
      </div>

      {total === 0 ? (
        <div style={{ marginTop: 32 }}>
          <EmptyState
            icon={HardHat}
            title="Aucun chantier pour l'instant"
            description="Crée ton premier chantier pour voir apparaître les graphiques ici."
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, marginTop: 32, alignItems: 'start' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Budget prévu vs dépensé</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartBudget}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="nom" stroke="var(--text-mid)" fontSize={12} />
                  <YAxis stroke="var(--text-mid)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.85rem' }}
                    formatter={(v: number) => v.toLocaleString('fr-FR') + ' F'}
                  />
                  <Bar dataKey="Prévu" fill="#3B4A5A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Dépensé" fill="#F0A93B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Chantiers par statut</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chartStatuts} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {chartStatuts.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--text-mid)' }} />
                  <Tooltip contentStyle={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.85rem' }} />
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
