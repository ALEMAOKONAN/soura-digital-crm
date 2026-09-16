-- ============================================================
-- SOURA DIGITAL CRM — Schéma multi-tenant (SaaS BTP)
-- Chaque entreprise cliente = une "organization".
-- Toutes les tables métier ont organization_id + Row Level
-- Security : un utilisateur ne voit JAMAIS les données d'une
-- autre organisation, même en cas de bug côté application.
-- ============================================================

-- Nettoyage préalable : permet de relancer ce script plusieurs fois
-- sans erreur "already exists", par exemple après un essai précédent.
-- Ordre important : les tables (et leurs policies) doivent être
-- supprimées AVANT les fonctions dont ces policies dépendent.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists verrou_privileges_profil on profiles;
drop function if exists empecher_elevation_privileges();
drop table if exists situations cascade;
drop table if exists maintenances cascade;
drop table if exists carburant cascade;
drop table if exists engins cascade;
drop table if exists paiements_prestataires cascade;
drop table if exists prestataires cascade;
drop table if exists paiements_employes cascade;
drop table if exists pointages cascade;
drop table if exists employes cascade;
drop table if exists mouvements_stock cascade;
drop table if exists materiaux cascade;
drop table if exists achats cascade;
drop table if exists depenses cascade;
drop table if exists budget_postes cascade;
drop table if exists devis_lignes cascade;
drop table if exists devis cascade;
drop table if exists chantiers cascade;
drop table if exists profiles cascade;
drop table if exists organizations cascade;
drop function if exists handle_new_user();
drop function if exists auth_organization_id();

-- 1. ORGANISATIONS (une ligne = une entreprise cliente qui paie)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subscription_plan text not null default 'essai',       -- essai / standard / pro
  subscription_status text not null default 'active',    -- active / suspendu / annule
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz not null default now()
);

-- 2. PROFILS (un utilisateur = une ligne, rattaché à UNE organisation)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text,
  role text not null default 'membre',   -- admin / conducteur_travaux / chef_chantier / membre
  created_at timestamptz not null default now()
);

-- 3. CHANTIERS (premier module métier)
create table chantiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nom text not null,
  client text,
  budget numeric,
  avancement int not null default 0,      -- pourcentage 0-100
  statut text not null default 'en_cours', -- en_cours / en_retard / termine / a_venir
  date_debut date,
  date_fin_prevue date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4. DEVIS / DQE / FACTURES — un même document passe par 3 statuts
--    successifs (dqe -> devis -> facture). source_id relie un document
--    au document dont il a été transformé, pour garder l'historique.
create table devis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type text not null default 'dqe' check (type in ('dqe', 'devis', 'facture')),
  numero text not null,
  client text,
  chantier_id uuid references chantiers(id) on delete set null,
  montant_total numeric not null default 0,
  statut text not null default 'brouillon', -- brouillon / envoye / valide / refuse / paye
  source_id uuid references devis(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5. LIGNES d'un devis/DQE/facture (désignation, quantité, prix unitaire)
create table devis_lignes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  devis_id uuid not null references devis(id) on delete cascade,
  designation text not null,
  unite text,
  quantite numeric not null default 1,
  prix_unitaire numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 6. POSTES BUDGÉTAIRES par chantier (ex. Gros œuvre, Électricité…)
create table budget_postes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chantier_id uuid not null references chantiers(id) on delete cascade,
  nom text not null,
  montant_prevu numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 7. DÉPENSES réelles, rattachées à un chantier et (optionnellement) à un poste
create table depenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chantier_id uuid not null references chantiers(id) on delete cascade,
  poste_id uuid references budget_postes(id) on delete set null,
  libelle text not null,
  montant numeric not null default 0,
  date_depense date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 8. ACHATS & DEMANDES — du besoin exprimé jusqu'au paiement
create table achats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chantier_id uuid references chantiers(id) on delete set null,
  designation text not null,
  quantite numeric not null default 1,
  unite text,
  fournisseur text,
  montant numeric not null default 0,
  statut text not null default 'demande', -- demande / validee / commandee / receptionnee / payee / rejetee
  date_demande date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 9. MATÉRIAUX (catalogue des articles suivis en stock)
create table materiaux (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nom text not null,
  categorie text,
  unite text not null default 'u',
  seuil_alerte numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 10. MOUVEMENTS DE STOCK (entrée = livraison reçue, sortie = utilisation chantier)
create table mouvements_stock (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  materiau_id uuid not null references materiaux(id) on delete cascade,
  chantier_id uuid references chantiers(id) on delete set null,
  type text not null check (type in ('entree', 'sortie')),
  quantite numeric not null default 0,
  date_mouvement date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 11. EMPLOYÉS (ouvriers et tâcherons)
create table employes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nom text not null,
  poste text,
  type text not null default 'ouvrier' check (type in ('ouvrier', 'tacheron')),
  telephone text,
  taux_journalier numeric not null default 0,
  chantier_id uuid references chantiers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 12. POINTAGES (présence sur chantier, un par employé et par jour)
create table pointages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employe_id uuid not null references employes(id) on delete cascade,
  date_pointage date not null default current_date,
  created_at timestamptz not null default now(),
  unique (employe_id, date_pointage)
);

-- 13. PAIEMENTS (avances et paiements versés à un employé)
create table paiements_employes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employe_id uuid not null references employes(id) on delete cascade,
  type text not null default 'avance' check (type in ('avance', 'paiement')),
  montant numeric not null default 0,
  date_paiement date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 14. PRESTATAIRES / SOUS-TRAITANTS
create table prestataires (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nom text not null,
  specialite text,
  telephone text,
  chantier_id uuid references chantiers(id) on delete set null,
  montant_marche numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 15. PAIEMENTS aux prestataires (avances et paiements)
create table paiements_prestataires (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  prestataire_id uuid not null references prestataires(id) on delete cascade,
  type text not null default 'avance' check (type in ('avance', 'paiement')),
  montant numeric not null default 0,
  date_paiement date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 16. ENGINS (matériel lourd : camions, chargeurs, grues…)
create table engins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nom text not null,
  type text,
  immatriculation text,
  statut text not null default 'en_activite', -- en_activite / en_maintenance / a_l_arret
  chantier_id uuid references chantiers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 17. PLEINS DE CARBURANT
create table carburant (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  engin_id uuid not null references engins(id) on delete cascade,
  litres numeric not null default 0,
  cout numeric not null default 0,
  date_plein date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 18. MAINTENANCES des engins
create table maintenances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  engin_id uuid not null references engins(id) on delete cascade,
  description text not null,
  cout numeric not null default 0,
  date_maintenance date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 19. SITUATIONS DE TRAVAUX (facturation par tranche selon l'avancement)
create table situations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chantier_id uuid not null references chantiers(id) on delete cascade,
  numero text not null,
  pourcentage_avancement int not null default 0,
  montant numeric not null default 0,
  statut text not null default 'brouillon', -- brouillon / envoyee / validee / payee
  date_situation date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Fonction utilitaire : quelle est l'organisation de l'utilisateur connecté ?
-- ============================================================
create or replace function auth_organization_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from profiles where id = auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY — c'est ce qui garantit l'étanchéité entre clients
-- ============================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table chantiers enable row level security;
alter table devis enable row level security;
alter table devis_lignes enable row level security;
alter table budget_postes enable row level security;
alter table depenses enable row level security;
alter table achats enable row level security;
alter table materiaux enable row level security;
alter table mouvements_stock enable row level security;
alter table employes enable row level security;
alter table pointages enable row level security;
alter table paiements_employes enable row level security;
alter table prestataires enable row level security;
alter table paiements_prestataires enable row level security;
alter table engins enable row level security;
alter table carburant enable row level security;
alter table maintenances enable row level security;
alter table situations enable row level security;

-- Une organisation n'est visible que par ses propres membres
create policy "voir sa propre organisation"
  on organizations for select
  using (id = auth_organization_id());

-- Un profil ne voit que les profils de SA organisation
create policy "voir les profils de son organisation"
  on profiles for select
  using (organization_id = auth_organization_id());

create policy "modifier son propre profil"
  on profiles for update
  using (id = auth.uid());

-- Verrou de sécurité critique : sans lui, un utilisateur pourrait modifier
-- son propre organization_id via l'API et accéder aux données d'une AUTRE
-- entreprise cliente, ou modifier son role pour s'octroyer les droits admin.
-- Les policies RLS ci-dessus autorisent la modification de sa propre ligne,
-- mais ce trigger interdit que organization_id ou role changent de valeur,
-- quelle que soit la façon dont la requête de mise à jour est construite.
create or replace function empecher_elevation_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Modification de organization_id non autorisée';
  end if;
  if new.role is distinct from old.role then
    raise exception 'Modification de role non autorisée';
  end if;
  return new;
end;
$$;

drop trigger if exists verrou_privileges_profil on profiles;
create trigger verrou_privileges_profil
  before update on profiles
  for each row execute function empecher_elevation_privileges();

-- Chantiers : lecture/écriture strictement limitée à l'organisation de l'utilisateur
create policy "voir les chantiers de son organisation"
  on chantiers for select
  using (organization_id = auth_organization_id());

create policy "creer un chantier dans son organisation"
  on chantiers for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les chantiers de son organisation"
  on chantiers for update
  using (organization_id = auth_organization_id());

create policy "supprimer les chantiers de son organisation (admin seulement)"
  on chantiers for delete
  using (
    organization_id = auth_organization_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Devis / DQE / Factures : même principe d'isolation par organisation
create policy "voir les devis de son organisation"
  on devis for select
  using (organization_id = auth_organization_id());

create policy "creer un devis dans son organisation"
  on devis for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les devis de son organisation"
  on devis for update
  using (organization_id = auth_organization_id());

create policy "supprimer les devis de son organisation (admin seulement)"
  on devis for delete
  using (
    organization_id = auth_organization_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Lignes de devis : même isolation
create policy "voir les lignes de devis de son organisation"
  on devis_lignes for select
  using (organization_id = auth_organization_id());

create policy "creer des lignes de devis dans son organisation"
  on devis_lignes for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les lignes de devis de son organisation"
  on devis_lignes for update
  using (organization_id = auth_organization_id());

create policy "supprimer les lignes de devis de son organisation"
  on devis_lignes for delete
  using (organization_id = auth_organization_id());

-- Postes budgétaires : même isolation par organisation
create policy "voir les postes budgetaires de son organisation"
  on budget_postes for select
  using (organization_id = auth_organization_id());

create policy "creer un poste budgetaire dans son organisation"
  on budget_postes for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les postes budgetaires de son organisation"
  on budget_postes for update
  using (organization_id = auth_organization_id());

create policy "supprimer les postes budgetaires de son organisation"
  on budget_postes for delete
  using (organization_id = auth_organization_id());

-- Dépenses : même isolation par organisation
create policy "voir les depenses de son organisation"
  on depenses for select
  using (organization_id = auth_organization_id());

create policy "creer une depense dans son organisation"
  on depenses for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les depenses de son organisation"
  on depenses for update
  using (organization_id = auth_organization_id());

create policy "supprimer les depenses de son organisation"
  on depenses for delete
  using (organization_id = auth_organization_id());

-- Achats & demandes : même isolation par organisation
create policy "voir les achats de son organisation"
  on achats for select
  using (organization_id = auth_organization_id());

create policy "creer un achat dans son organisation"
  on achats for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les achats de son organisation"
  on achats for update
  using (organization_id = auth_organization_id());

create policy "supprimer les achats de son organisation"
  on achats for delete
  using (organization_id = auth_organization_id());

-- Matériaux : même isolation par organisation
create policy "voir les materiaux de son organisation"
  on materiaux for select
  using (organization_id = auth_organization_id());

create policy "creer un materiau dans son organisation"
  on materiaux for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les materiaux de son organisation"
  on materiaux for update
  using (organization_id = auth_organization_id());

create policy "supprimer les materiaux de son organisation"
  on materiaux for delete
  using (organization_id = auth_organization_id());

-- Mouvements de stock : même isolation par organisation
create policy "voir les mouvements de son organisation"
  on mouvements_stock for select
  using (organization_id = auth_organization_id());

create policy "creer un mouvement dans son organisation"
  on mouvements_stock for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les mouvements de son organisation"
  on mouvements_stock for update
  using (organization_id = auth_organization_id());

create policy "supprimer les mouvements de son organisation"
  on mouvements_stock for delete
  using (organization_id = auth_organization_id());

-- Employés : même isolation par organisation
create policy "voir les employes de son organisation"
  on employes for select
  using (organization_id = auth_organization_id());

create policy "creer un employe dans son organisation"
  on employes for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les employes de son organisation"
  on employes for update
  using (organization_id = auth_organization_id());

create policy "supprimer les employes de son organisation"
  on employes for delete
  using (organization_id = auth_organization_id());

-- Pointages : même isolation par organisation
create policy "voir les pointages de son organisation"
  on pointages for select
  using (organization_id = auth_organization_id());

create policy "creer un pointage dans son organisation"
  on pointages for insert
  with check (organization_id = auth_organization_id());

create policy "supprimer les pointages de son organisation"
  on pointages for delete
  using (organization_id = auth_organization_id());

-- Paiements employés : même isolation par organisation
create policy "voir les paiements de son organisation"
  on paiements_employes for select
  using (organization_id = auth_organization_id());

create policy "creer un paiement dans son organisation"
  on paiements_employes for insert
  with check (organization_id = auth_organization_id());

create policy "supprimer les paiements de son organisation"
  on paiements_employes for delete
  using (organization_id = auth_organization_id());

-- Prestataires : même isolation par organisation
create policy "voir les prestataires de son organisation"
  on prestataires for select
  using (organization_id = auth_organization_id());

create policy "creer un prestataire dans son organisation"
  on prestataires for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les prestataires de son organisation"
  on prestataires for update
  using (organization_id = auth_organization_id());

create policy "supprimer les prestataires de son organisation"
  on prestataires for delete
  using (organization_id = auth_organization_id());

-- Paiements prestataires : même isolation par organisation
create policy "voir les paiements prestataires de son organisation"
  on paiements_prestataires for select
  using (organization_id = auth_organization_id());

create policy "creer un paiement prestataire dans son organisation"
  on paiements_prestataires for insert
  with check (organization_id = auth_organization_id());

create policy "supprimer les paiements prestataires de son organisation"
  on paiements_prestataires for delete
  using (organization_id = auth_organization_id());

-- Engins : même isolation par organisation
create policy "voir les engins de son organisation"
  on engins for select
  using (organization_id = auth_organization_id());

create policy "creer un engin dans son organisation"
  on engins for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les engins de son organisation"
  on engins for update
  using (organization_id = auth_organization_id());

create policy "supprimer les engins de son organisation"
  on engins for delete
  using (organization_id = auth_organization_id());

-- Carburant : même isolation par organisation
create policy "voir le carburant de son organisation"
  on carburant for select
  using (organization_id = auth_organization_id());

create policy "creer un plein dans son organisation"
  on carburant for insert
  with check (organization_id = auth_organization_id());

create policy "supprimer le carburant de son organisation"
  on carburant for delete
  using (organization_id = auth_organization_id());

-- Maintenances : même isolation par organisation
create policy "voir les maintenances de son organisation"
  on maintenances for select
  using (organization_id = auth_organization_id());

create policy "creer une maintenance dans son organisation"
  on maintenances for insert
  with check (organization_id = auth_organization_id());

create policy "supprimer les maintenances de son organisation"
  on maintenances for delete
  using (organization_id = auth_organization_id());

-- Situations de travaux : même isolation par organisation
create policy "voir les situations de son organisation"
  on situations for select
  using (organization_id = auth_organization_id());

create policy "creer une situation dans son organisation"
  on situations for insert
  with check (organization_id = auth_organization_id());

create policy "modifier les situations de son organisation"
  on situations for update
  using (organization_id = auth_organization_id());

create policy "supprimer les situations de son organisation"
  on situations for delete
  using (organization_id = auth_organization_id());

-- ============================================================
-- INSCRIPTION : quand une nouvelle entreprise s'inscrit sans code
-- d'invitation, on crée automatiquement son organisation + son
-- profil admin. Si un code d'invitation valide est fourni, la
-- personne rejoint l'entreprise correspondante comme "membre" au
-- lieu de créer une nouvelle entreprise.
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  company_name text;
  code_saisi text;
  full_name_saisi text;
begin
  company_name := coalesce(new.raw_user_meta_data->>'company_name', 'Nouvelle entreprise');
  code_saisi := nullif(trim(new.raw_user_meta_data->>'invite_code'), '');
  full_name_saisi := coalesce(new.raw_user_meta_data->>'full_name', new.email);

  if code_saisi is not null then
    select id into new_org_id from organizations where invite_code = code_saisi;

    if new_org_id is null then
      raise exception 'Code d''invitation invalide';
    end if;

    insert into profiles (id, organization_id, full_name, role)
    values (new.id, new_org_id, full_name_saisi, 'membre');
  else
    -- Pas de code : crée une nouvelle entreprise
    insert into organizations (name)
    values (company_name)
    returning id into new_org_id;

    insert into profiles (id, organization_id, full_name, role)
    values (new.id, new_org_id, full_name_saisi, 'admin');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
