
-- Table for manager-created invitations
CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL,
  invite_code text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Only gerente can manage invitations
CREATE POLICY "Gerente can manage invitations"
  ON public.user_invitations FOR ALL
  USING (public.is_gerente());

-- Anyone can read invitations by code (for signup validation)
CREATE POLICY "Anyone can validate invite code"
  ON public.user_invitations FOR SELECT
  USING (true);
