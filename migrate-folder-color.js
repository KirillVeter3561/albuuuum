import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const sql = readFileSync('./supabase/add-folder-color.sql', 'utf-8')

console.log('Применяем миграцию для добавления column color...')
console.log('SQL:', sql)

// Supabase JS client не поддерживает прямое выполнение DDL через anon key
// Нужен service_role key или использование Dashboard SQL Editor
console.log('\n⚠️  Пожалуйста, выполните этот SQL вручную в Supabase Dashboard:')
console.log('1. Откройте https://supabase.com/dashboard/project/rpphyedtwvxhztfvrzom/sql/new')
console.log('2. Вставьте и выполните:\n')
console.log(sql)
