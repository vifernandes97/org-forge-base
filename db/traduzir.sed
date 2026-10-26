# Supabase -> Postgres próprio. Aplicado ao replay das migrações e ao schema do export.
s/auth\.users/app_auth.users/g
s/auth\.role()/app_auth.request_role()/g
