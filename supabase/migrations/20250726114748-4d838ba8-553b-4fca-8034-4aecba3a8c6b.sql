-- Fix security definer function with proper search path
CREATE OR REPLACE FUNCTION public.check_user_role(user_auth_id uuid, required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_user_id = user_auth_id 
    AND role = required_role
  );
$$;

-- Fix other functions with proper search path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_phone_last_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.phones 
  SET last_update = NEW.timestamp 
  WHERE id = NEW.phone_id;
  RETURN NEW;
END;
$$;