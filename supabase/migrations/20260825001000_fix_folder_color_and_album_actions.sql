alter table public.album_folders
  add column if not exists color text not null default '#DCE9E3';

create or replace function public.change_album_password(
  target_album_id uuid,
  new_password text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  if char_length(new_password) < 8 then raise exception 'Пароль должен содержать не менее 8 символов'; end if;
  update public.albums
  set password_hash = extensions.crypt(new_password, extensions.gen_salt('bf'))
  where id = target_album_id and owner_id = auth.uid();
  if not found then raise exception 'Недостаточно прав для изменения альбома'; end if;
end; $$;

grant execute on function public.change_album_password(uuid, text) to authenticated;

-- PostgREST caches the database schema. Reload it immediately so REST updates
-- using the new color column work without waiting for the automatic refresh.
notify pgrst, 'reload schema';
