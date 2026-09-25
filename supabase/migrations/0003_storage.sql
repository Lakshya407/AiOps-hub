-- Private storage bucket for documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage RLS: owner-scoped paths => "<auth.uid()>/..."
drop policy if exists "documents_owner_read" on storage.objects;
drop policy if exists "documents_owner_write" on storage.objects;
drop policy if exists "documents_owner_update" on storage.objects;
drop policy if exists "documents_owner_delete" on storage.objects;

create policy "documents_owner_read" on storage.objects
  for select using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "documents_owner_write" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "documents_owner_update" on storage.objects
  for update using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "documents_owner_delete" on storage.objects
  for delete using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
