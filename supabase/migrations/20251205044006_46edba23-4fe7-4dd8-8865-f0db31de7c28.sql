-- Fix: Block anonymous public access to profiles table
-- Add a PERMISSIVE policy that requires authentication
-- This works with existing RESTRICTIVE policies to ensure only authenticated users can access

CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- Fix: Block anonymous public access to ordens_de_servico table
CREATE POLICY "Deny anonymous access to ordens_de_servico"
ON public.ordens_de_servico
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);