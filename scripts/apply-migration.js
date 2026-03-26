/**
 * Script para aplicar a migration de RBAC (is_blocked) diretamente no Supabase
 * via REST API sem precisar do Docker.
 *
 * USO: node scripts/apply-migration.js <SERVICE_ROLE_KEY>
 * A Service Role Key está em: Supabase Dashboard → Settings → API → service_role
 */

const projectId = "gvakitmpujjwfvfvtabs";
const serviceKey = process.argv[2];

if (!serviceKey) {
  console.error("❌  Forneça a Service Role Key como argumento:");
  console.error("    node scripts/apply-migration.js eyJhbGci...");
  process.exit(1);
}

const supabaseUrl = `https://${projectId}.supabase.co`;

const sql = `
-- 1. Add is_blocked column to user_roles
ALTER TABLE public.user_roles
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add institution_id to user_invitations
ALTER TABLE public.user_invitations
    ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;

-- 3. Index for blocked users
CREATE INDEX IF NOT EXISTS idx_user_roles_blocked
    ON public.user_roles(user_id, is_blocked)
    WHERE is_blocked = TRUE;

-- 4. Update is_gerente() to also check is_blocked
CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'gerente'
        AND is_blocked = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function run() {
  console.log("🚀 Aplicando migration...\n");
  
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    // Try the query endpoint instead
    const res2 = await fetch(`${supabaseUrl}/pg-meta/v1/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "X-Connection-Encrypted": "ENCRYPTED_CONN",
      },
      body: JSON.stringify({ query: sql }),
    });
    
    if (!res2.ok) {
      const text = await res2.text();
      console.error("❌ Erro ao aplicar migration:", text);
      console.error("\n💡 Execute o SQL manualmente no Supabase Dashboard:");
      console.error("   https://supabase.com/dashboard/project/" + projectId + "/sql/new");
      process.exit(1);
    }
    
    const data2 = await res2.json();
    console.log("✅ Migration aplicada com sucesso!", data2);
  } else {
    const data = await res.json();
    console.log("✅ Migration aplicada com sucesso!", data);
  }
}

run().catch(err => {
  console.error("❌ Erro:", err.message);
  console.error("\n💡 Execute o SQL manualmente no Supabase Dashboard SQL Editor.");
});
