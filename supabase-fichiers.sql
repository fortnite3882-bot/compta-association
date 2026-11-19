-- À lancer UNE FOIS dans Supabase > SQL Editor > Run (pour les pièces jointes des factures)
insert into storage.buckets (id, name, public, file_size_limit)
values ('justificatifs', 'justificatifs', false, 10485760)
on conflict (id) do nothing;

-- Chaque utilisateur n'accède qu'aux fichiers rangés dans SON dossier (son identifiant)
create policy "justif lecture" on storage.objects for select
  using (bucket_id = 'justificatifs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "justif ajout" on storage.objects for insert
  with check (bucket_id = 'justificatifs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "justif modif" on storage.objects for update
  using (bucket_id = 'justificatifs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "justif suppression" on storage.objects for delete
  using (bucket_id = 'justificatifs' and (storage.foldername(name))[1] = auth.uid()::text);
