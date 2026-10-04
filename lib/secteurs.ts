// Secteurs d'activitÃ© proposÃ©s Ã  l'inscription. La clÃ© est stockÃ©e en
// base (organizations.secteur). "domaine" dÃ©termine quel ensemble de
// modules mÃ©tier l'entreprise voit dans son tableau de bord : les
// modules BTP pour un domaine 'btp', le module Pharmacie pour un
// domaine 'pharmacie', etc. Les modules communs (tableau de bord,
// Ã©quipe) restent toujours visibles quel que soit le domaine.
export type Domaine = 'btp' | 'pharmacie';

export const SECTEURS: { value: string; label: string; domaine: Domaine }[] = [
  { value: 'general', label: 'BTP gÃ©nÃ©ral / Multi-activitÃ©s', domaine: 'btp' },
  { value: 'gros_oeuvre', label: 'BTP gÃ©nÃ©ral â€” Gros Å“uvre', domaine: 'btp' },
  { value: 'electricite', label: 'BTP gÃ©nÃ©ral â€” Ã‰lectricitÃ©', domaine: 'btp' },
  { value: 'plomberie', label: 'BTP gÃ©nÃ©ral â€” Plomberie', domaine: 'btp' },
  { value: 'vrd', label: 'BTP gÃ©nÃ©ral â€” VRD / Terrassement', domaine: 'btp' },
  { value: 'peinture', label: 'BTP gÃ©nÃ©ral â€” Peinture / Finition', domaine: 'btp' },
  { value: 'pharmacie', label: 'Pharmacie', domaine: 'pharmacie' },
  { value: 'autre', label: 'Autre', domaine: 'btp' },
];

export function labelSecteur(value: string) {
  return SECTEURS.find((s) => s.value === value)?.label ?? value;
}

export function domainePourSecteur(value: string): Domaine {
  return SECTEURS.find((s) => s.value === value)?.domaine ?? 'btp';
}