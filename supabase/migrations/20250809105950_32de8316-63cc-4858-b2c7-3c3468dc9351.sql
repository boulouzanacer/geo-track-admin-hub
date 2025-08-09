-- Add policies for users to update and delete their own phones
CREATE POLICY "Users can update their own phones" 
ON public.phones 
FOR UPDATE 
USING (user_id IN (
  SELECT users.id
  FROM users
  WHERE users.auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete their own phones" 
ON public.phones 
FOR DELETE 
USING (user_id IN (
  SELECT users.id
  FROM users
  WHERE users.auth_user_id = auth.uid()
));