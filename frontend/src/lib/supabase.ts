import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en frontend/.env (copia frontend/.env.example).')
}

// La clave anon es pública: lo que puede hacer cada usuario lo limita RLS en la base de datos.
export const supabase = createClient<Database>(url, anonKey)
