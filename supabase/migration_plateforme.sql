-- ============================================================
-- MIGRATION : secteur d'activité + espace "administrateur plateforme"
-- Ce script ne supprime RIEN — il ajoute seulement du nouveau, donc
-- il peut être exécuté sans perdre les comptes et données existants.
-- ============================================================

-- Secteur d'activité de l'entreprise cliente, choisi à l'inscription.
-- Sert à adapter l'interface (masquer des modules non pertinents) et
-- à te permettre, en tant qu'administrateur de la plateforme, de
-- savoir à quoi sert chaque entreprise inscrite.
alter table organizations
  add column if not exists secteur text not null default 'general';
  -- valeurs possibles : general / gros_oeuvre / electricite / plomberie
  --                     / vrd / peinture / autre

-- ============================================================
-- ADMINISTRATEUR DE LA PLATEFORME (toi, le propriétaire du logiciel)
-- Différent d'un "admin" d'entreprise cliente : un admin plateforme
-- voit la liste de TOUTES les entreprises inscrites, pas seulement
-- la sienne. Identifié par une liste d'e-mails en dur ci-dessous —
-- à mettre à jour si tu ajoutes un collaborateur à la gestion de la
-- plateforme plus tard.
create or replace function est_admin_plateforme()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.jwt() ->> 'email' in ('konanalemao@gmail.com');
$$;

-- Permet à l'admin plateforme de lister TOUTES les organisations,
-- en plus de la policy existante qui limite chacun à la sienne.
drop policy if exists "admin plateforme voit toutes les organisations" on organizations;
create policy "admin plateforme voit toutes les organisations"
  on organizations for select
  using (est_admin_plateforme());

-- Permet à l'admin plateforme de lister tous les profils (utile pour
-- compter les membres par entreprise, par exemple).
drop policy if exists "admin plateforme voit tous les profils" on profiles;
create policy "admin plateforme voit tous les profils"
  on profiles for select
  using (est_admin_plateforme());

-- Met à jour la fonction d'inscription pour qu'elle enregistre le
-- secteur d'activité choisi par le client (remplace la version qui
-- ne connaissait pas encore ce champ).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  company_name text;
  secteur_saisi text;
  code_saisi text;
  full_name_saisi text;
begin
  company_name := coalesce(new.raw_user_meta_data->>'company_name', 'Nouvelle entreprise');
  secteur_saisi := coalesce(new.raw_user_meta_data->>'secteur', 'general');
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
    insert into organizations (name, secteur)
    values (company_name, secteur_saisi)
    returning id into new_org_id;

    insert into profiles (id, organization_id, full_name, role)
    values (new.id, new_org_id, full_name_saisi, 'admin');
  end if;

  return new;
end;
$$;
