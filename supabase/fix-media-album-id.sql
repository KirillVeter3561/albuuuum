-- Безопасное исправление для уже созданной базы.
-- Выполните этот файл в Supabase: SQL Editor -> New query -> Run.
-- Он не удаляет пользователей, альбомы или загруженные файлы.

alter table public.media
  add column if not exists album_id uuid references public.albums(id) on delete cascade;

alter table public.media
  alter column folder_id drop not null;

-- Старые файлы из папок получают альбом своей папки.
update public.media media
set album_id = folder.album_id
from public.album_folders folder
where media.album_id is null
  and media.folder_id = folder.id;

create index if not exists media_album_id_idx on public.media(album_id);

create or replace function public.is_album_member(target_album_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.albums album
    where album.id = target_album_id
      and (
        album.owner_id = auth.uid()
        or exists (
          select 1 from public.album_access access
          where access.album_id = album.id and access.user_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists "members read media" on public.media;
drop policy if exists "owners add media" on public.media;
drop policy if exists "owners upload media rows" on public.media;
drop policy if exists "owners delete media" on public.media;

create policy "members read media" on public.media
  for select to authenticated
  using (public.is_album_member(album_id));

create policy "owners upload media rows" on public.media
  for insert to authenticated
  with check (
    exists (
      select 1 from public.albums album
      where album.id = album_id and album.owner_id = auth.uid()
    )
  );

create policy "owners delete media" on public.media
  for delete to authenticated
  using (
    exists (
      select 1 from public.albums album
      where album.id = album_id and album.owner_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
