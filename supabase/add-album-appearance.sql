-- Запустите этот файл в Supabase SQL Editor для уже созданной базы данных.
alter table public.albums
  add column if not exists content_background text not null default '#FFFEFA',
  add column if not exists font_family text not null default 'Nunito';

drop function if exists public.create_album(text, text, text, text);
create or replace function public.create_album(
  album_title text,
  album_slug text,
  album_password text,
  album_background text,
  album_content_background text default '#FFFEFA',
  album_font_family text default 'Nunito'
) returns public.albums language plpgsql security definer set search_path = public as $$
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
grant execute on function public.create_album(text,text,text,text,text,text) to authenticated;
