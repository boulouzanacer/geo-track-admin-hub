-- Create users table for app users
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create phones table
CREATE TABLE public.phones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_update TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create locations table
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_id UUID REFERENCES public.phones(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accuracy DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view their own data" 
ON public.users 
FOR SELECT 
USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all users" 
ON public.users 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE auth_user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can manage users" 
ON public.users 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE auth_user_id = auth.uid() AND role = 'admin'
));

-- Create policies for phones table
CREATE POLICY "Users can view their own phones" 
ON public.phones 
FOR SELECT 
USING (user_id IN (
  SELECT id FROM public.users WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Admins can view all phones" 
ON public.phones 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE auth_user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can manage phones" 
ON public.phones 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE auth_user_id = auth.uid() AND role = 'admin'
));

-- Create policies for locations table
CREATE POLICY "Users can view locations of their phones" 
ON public.locations 
FOR SELECT 
USING (phone_id IN (
  SELECT p.id FROM public.phones p 
  JOIN public.users u ON p.user_id = u.id 
  WHERE u.auth_user_id = auth.uid()
));

CREATE POLICY "Admins can view all locations" 
ON public.locations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE auth_user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Allow location inserts from API" 
ON public.locations 
FOR INSERT 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_phones_updated_at
BEFORE UPDATE ON public.phones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to update phone last_update when location is added
CREATE OR REPLACE FUNCTION public.update_phone_last_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.phones 
  SET last_update = NEW.timestamp 
  WHERE id = NEW.phone_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_phone_last_update_trigger
AFTER INSERT ON public.locations
FOR EACH ROW
EXECUTE FUNCTION public.update_phone_last_update();

-- Enable realtime for locations
ALTER TABLE public.locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;