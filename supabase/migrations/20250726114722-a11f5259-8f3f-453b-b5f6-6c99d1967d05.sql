-- Create a security definer function to check user roles safely
CREATE OR REPLACE FUNCTION public.check_user_role(user_auth_id uuid, required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_user_id = user_auth_id 
    AND role = required_role
  );
$$;

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;

DROP POLICY IF EXISTS "Admins can view all phones" ON public.phones;
DROP POLICY IF EXISTS "Admins can manage phones" ON public.phones;
DROP POLICY IF EXISTS "Users can view their own phones" ON public.phones;

DROP POLICY IF EXISTS "Admins can view all locations" ON public.locations;
DROP POLICY IF EXISTS "Users can view locations of their phones" ON public.locations;

-- Create new safe policies for users table
CREATE POLICY "Users can view their own data" 
ON public.users 
FOR SELECT 
USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own data" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all users" 
ON public.users 
FOR SELECT 
USING (public.check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage users" 
ON public.users 
FOR ALL 
USING (public.check_user_role(auth.uid(), 'admin'));

-- Create new safe policies for phones table
CREATE POLICY "Users can view their own phones" 
ON public.phones 
FOR SELECT 
USING (user_id IN (
  SELECT id FROM public.users WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Admins can view all phones" 
ON public.phones 
FOR SELECT 
USING (public.check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage phones" 
ON public.phones 
FOR ALL 
USING (public.check_user_role(auth.uid(), 'admin'));

-- Create new safe policies for locations table
CREATE POLICY "Users can view locations of their phones" 
ON public.locations 
FOR SELECT 
USING (phone_id IN (
  SELECT p.id 
  FROM public.phones p 
  JOIN public.users u ON p.user_id = u.id 
  WHERE u.auth_user_id = auth.uid()
));

CREATE POLICY "Admins can view all locations" 
ON public.locations 
FOR SELECT 
USING (public.check_user_role(auth.uid(), 'admin'));