-- Allow service role to manage tecnicos (for the Python bot)
-- Add permissive policy for INSERT via service role
CREATE POLICY "Allow insert tecnicos via service role" 
ON public.tecnicos 
FOR INSERT 
WITH CHECK (true);

-- Allow read access for tecnicos lookup by telegram id (needed for bot)
CREATE POLICY "Allow select tecnicos by telegram id" 
ON public.tecnicos 
FOR SELECT 
USING (true);