-- Добавляем колонку color в таблицу album_folders
ALTER TABLE album_folders ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#DCE9E3';
