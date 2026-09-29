-- 0012_note_images_storage.sql — image attachments for Markdown notes (paste/drop/attach).
-- Safe to rerun.
--
-- Design: a PUBLIC bucket with unguessable paths "<owner_uid>/<note_id>/<uuid>.<ext>".
-- Public read (instead of signed URLs) because image links are embedded directly in
-- Markdown (`![alt](https://…)`) and must keep working in the preview, after token
-- refresh, and in Obsidian-exported files. Writes/updates/deletes stay owner-scoped
-- to the "<auth.uid()>/…" prefix, same convention as 0003_storage.sql.
-- Trade-off: anyone holding a full image URL can view it (URLs contain a random UUID,
-- so they are unguessable but not access-controlled). Do not paste secrets as images.

insert into storage.buckets (id, name, public)
values ('note_images', 'note_images', true)
on conflict (id) do update set public = true;

drop policy if exists "note_images_public_read" on storage.objects;
drop policy if exists "note_images_owner_write" on storage.objects;
drop policy if exists "note_images_owner_update" on storage.objects;
drop policy if exists "note_images_owner_delete" on storage.objects;

-- Anyone can read (bucket is public by design; see note above).
create policy "note_images_public_read" on storage.objects
  for select using (bucket_id = 'note_images');

-- Only the owner may write under their own "<uid>/…" prefix.
create policy "note_images_owner_write" on storage.objects
  for insert with check (bucket_id = 'note_images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "note_images_owner_update" on storage.objects
  for update using (bucket_id = 'note_images' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'note_images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "note_images_owner_delete" on storage.objects
  for delete using (bucket_id = 'note_images' and auth.uid()::text = (storage.foldername(name))[1]);
