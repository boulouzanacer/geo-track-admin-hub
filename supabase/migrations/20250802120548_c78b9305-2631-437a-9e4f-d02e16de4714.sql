-- Create user profile for existing authenticated user
INSERT INTO public.users (auth_user_id, name, email, role, enabled)
VALUES (
  '6024630f-6f92-4af2-ad31-63d044bb44ef',
  'SEBTI',
  'sebrti.bouabdallah@gmail.com',
  'user',
  true
)
ON CONFLICT (auth_user_id) DO NOTHING;