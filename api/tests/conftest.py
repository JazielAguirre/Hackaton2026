import os

# Las pruebas no deben depender de api/.env ni de claves reales.
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-de-prueba")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-de-prueba")
