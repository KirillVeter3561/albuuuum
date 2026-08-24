-- ЧИСТАЯ УСТАНОВКА. Запуск удалит старые тестовые альбомы и создаст новую структуру.
-- Supabase -> SQL Editor -> New query -> вставьте весь файл -> Run.

drop table if exists public.media cascade;
drop table if exists public.album_folders cascade;
drop table if exists public.album_access cascade;
drop table if exists public.albums cascade;
drop table if exists public.profiles cascade;
drop function if exists public.create_album(text, text, text, text);
drop function if exists public.check_album_password(text, text);
drop function if exists public.unlock_album(text, text);
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now()
);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  slug text not null unique,
  password_hash text not null,
  background text not null,
  content_background text not null default '#FFFEFA',
  font_family text not null default 'Nunito',
  created_at timestamptz not null default now()
);

create table public.album_access (
  album_id uuid not null references public.albums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (album_id, user_id)
);

create table public.album_folders (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  color text not null default '#DCE9E3',
  created_at timestamptz not null default now()
);

-- Файл принадлежит альбому; folder_id пустой, когда фото добавили напрямую, без папки.
create table public.media (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  folder_id uuid references public.album_folders(id) on delete cascade,
  file_path text not null,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create or replace function public.is_album_member(target_album_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.albums album
    where album.id = target_album_id
      and (album.owner_id = auth.uid() or exists (
        select 1 from public.album_access access
        where access.album_id = album.id and access.user_id = auth.uid()
      ))
  );
$$;

alter table public.profiles enable row level security;
alter table public.albums enable row level security;
alter table public.album_access enable row level security;
alter table public.album_folders enable row level security;
alter table public.media enable row level security;

create policy "users manage own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "members read albums" on public.albums for select to authenticated using (public.is_album_member(id));
create policy "owners create albums" on public.albums for insert to authenticated with check (owner_id = auth.uid());
create policy "owners update albums" on public.albums for update to authenticated using (owner_id = auth.uid());
create policy "owners delete albums" on public.albums for delete to authenticated using (owner_id = auth.uid());
create policy "users read own access" on public.album_access for select to authenticated using (user_id = auth.uid());
create policy "members read folders" on public.album_folders for select to authenticated using (public.is_album_member(album_id));
create policy "owners create folders" on public.album_folders for insert to authenticated with check (exists(select 1 from public.albums album where album.id = album_id and album.owner_id = auth.uid()));
create policy "owners update folders" on public.album_folders for update to authenticated using (exists(select 1 from public.albums album where album.id = album_id and album.owner_id = auth.uid()));
create policy "owners delete folders" on public.album_folders for delete to authenticated using (exists(select 1 from public.albums album where album.id = album_id and album.owner_id = auth.uid()));
create policy "members read media" on public.media for select to authenticated using (public.is_album_member(album_id));
create policy "owners upload media rows" on public.media for insert to authenticated with check (exists(select 1 from public.albums album where album.id = album_id and album.owner_id = auth.uid()));
create policy "owners update media rows" on public.media for update to authenticated using (exists(select 1 from public.albums album where album.id = album_id and album.owner_id = auth.uid())) with check (exists(select 1 from public.albums album where album.id = album_id and album.owner_id = auth.uid()));
create policy "owners delete media" on public.media for delete to authenticated using (exists(select 1 from public.albums album where album.id = album_id and album.owner_id = auth.uid()));

create or replace function public.create_album(album_title text, album_slug text, album_password text, album_background text, album_content_background text default '#FFFEFA', album_font_family text default 'Nunito')
returns public.albums language plpgsql security definer set search_path = public as $$
declare result public.albums;
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  if char_length(album_password) < 8 then raise exception 'Пароль должен содержать не менее 8 символов'; end if;
  insert into albums(owner_id,title,slug,password_hash,background,content_background,font_family)
  values(auth.uid(),album_title,album_slug,extensions.crypt(album_password,extensions.gen_salt('bf')),album_background,album_content_background,album_font_family)
  returning * into result;
  insert into album_access(album_id,user_id) values(result.id,auth.uid());
  return result;
end; $$;

create or replace function public.check_album_password(album_slug text, album_password text)
returns boolean language sql security definer set search_path = public as $$
  select exists(select 1 from albums where slug = album_slug and password_hash = extensions.crypt(album_password,password_hash));
$$;

create or replace function public.change_album_password(target_album_id uuid, new_password text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  if char_length(new_password) < 8 then raise exception 'Пароль должен содержать не менее 8 символов'; end if;
  update public.albums
  set password_hash = extensions.crypt(new_password, extensions.gen_salt('bf'))
  where id = target_album_id and owner_id = auth.uid();
  if not found then raise exception 'Недостаточно прав для изменения альбома'; end if;
end; $$;

create or replace function public.unlock_album(album_slug text, album_password text)
returns public.albums language plpgsql security definer set search_path = public as $$
declare result public.albums;
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  select * into result from albums where slug = album_slug and password_hash = extensions.crypt(album_password,password_hash);
  if result.id is null then raise exception 'Пароль неверный'; end if;
  insert into album_access(album_id,user_id) values(result.id,auth.uid()) on conflict do nothing;
  return result;
end; $$;

grant execute on function public.create_album(text,text,text,text,text,text) to authenticated;
grant execute on function public.check_album_password(text,text) to anon,authenticated;
grant execute on function public.change_album_password(uuid,text) to authenticated;
grant execute on function public.unlock_album(text,text) to authenticated;
grant execute on function public.is_album_member(uuid) to authenticated;

insert into storage.buckets(id,name,public) values ('album-media','album-media',false) on conflict(id) do update set public=false;
insert into storage.buckets(id,name,public) values ('avatars','avatars',false) on conflict(id) do update set public=false;
create policy "owners add album files" on storage.objects for insert to authenticated with check (bucket_id = 'album-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members read album files" on storage.objects for select to authenticated using (bucket_id = 'album-media' and public.is_album_member(((storage.foldername(name))[2])::uuid));
create policy "users manage own avatar" on storage.objects for all to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
