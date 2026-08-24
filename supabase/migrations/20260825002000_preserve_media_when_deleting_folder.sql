-- Позволяет владельцу отвязать файлы от папки перед её удалением.
-- Файлы и записи media не удаляются: folder_id становится NULL.
drop policy if exists "owners update media rows" on public.media;

create policy "owners update media rows" on public.media
  for update to authenticated
  using (
    exists (
      select 1 from public.albums album
      where album.id = album_id and album.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.albums album
      where album.id = album_id and album.owner_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
