-- ============================================================
-- MIGRATION : module Pharmacie (secteur "pharmacie")
-- Ce script ne supprime RIEN â€” il ajoute seulement du nouveau, donc
-- il peut Ãªtre exÃ©cutÃ© sans perdre les comptes et donnÃ©es existants.
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