-- À coller dans Supabase > SQL Editor > Run
create table if not exists public.comptes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.comptes enable row level security;

-- Chaque utilisateur ne voit et ne modifie QUE sa propre ligne
create policy "lecture perso" on public.comptes for select using (auth.uid() = user_id);
create policy "ajout perso"   on public.comptes for insert with check (auth.uid() = user_id);
create policy "modif perso"   on public.comptes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
