import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole =
  | "gerente"
  | "visitador"
  | "bodega"
  | "expedicion"
  | "hospital_externo"
  | "admin_conofta"
  | "coordinador_local";

// ─── Role World Helpers ────────────────────────────────────────────────────────
/** Roles que pertencem ao mundo Alcon (comercial/logístico) */
export const ALCON_ROLES: AppRole[] = ["visitador", "bodega", "expedicion"];

/** Roles que pertencem ao mundo CONOFTA (gestão cirúrgica) */
export const CONOFTA_ROLES: AppRole[] = ["admin_conofta", "coordinador_local"];

/** Roles com acesso financeiro — APENAS gerente */
export const FINANCIAL_ROLES: AppRole[] = ["gerente"];

/** Roles com acesso a dados CONOFTA */
export const CONOFTA_ACCESS_ROLES: AppRole[] = ["gerente", "admin_conofta", "coordinador_local"];

/** Roles com acesso a dados Alcon */
export const ALCON_ACCESS_ROLES: AppRole[] = ["gerente", "visitador", "bodega", "expedicion"];

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole]                   = useState<AppRole | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [isBlocked, setIsBlocked]         = useState(false);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setInstitutionId(null);
      setInstitutionName(null);
      setIsBlocked(false);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data, error } = await (supabase
        .from("user_roles")
        .select("role, institution_id, is_blocked")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle() as any);

      if (error) {
        console.error("Error fetching role:", error);
        setLoading(false);
        return;
      }

      const assignedRole = (data?.role as AppRole) ?? null;

      setRole(assignedRole);
      setInstitutionId(data?.institution_id ?? null);
      setIsBlocked(data?.is_blocked ?? false);

      if (data?.institution_id) {
        const { data: instData } = await supabase
          .from("institutions")
          .select("name")
          .eq("id", data.institution_id)
          .maybeSingle();
        setInstitutionName(instData?.name ?? null);
      }

      setLoading(false);
    };

    fetchRole();
  }, [user]);

  // ─── Computed flags ──────────────────────────────────────────────────────────
  /** Único perfil com acesso total (financeiro + ambos os mundos) */
  const isGerente = role === "gerente";

  /** Pertence ao mundo Alcon (comercial/logístico) */
  const isAlcon = role !== null && ALCON_ROLES.includes(role);

  /** Pertence ao mundo CONOFTA (gestão cirúrgica) */
  const isConofta = role !== null && CONOFTA_ROLES.includes(role);

  /** Tem acesso a qualquer dado CONOFTA */
  const canAccessConofta = role !== null && CONOFTA_ACCESS_ROLES.includes(role);

  /** Tem acesso a qualquer dado Alcon */
  const canAccessAlcon = role !== null && ALCON_ACCESS_ROLES.includes(role);

  /** Pode ver informações financeiras (Gross Margin, Profit, P&L) — só gerente */
  const canViewFinancials = isGerente;

  /** Admin CONOFTA ou Gerente — pode agendar entre sedes, gerenciar cirurgiões */
  const isAdminConofta = isGerente || role === "admin_conofta";

  /** Coordinator local — acesso só à sua sede */
  const isCoordinadorLocal = role === "coordinador_local";

  return {
    role,
    loading,
    isGerente,
    isAlcon,
    isConofta,
    isAdminConofta,
    isCoordinadorLocal,
    canAccessConofta,
    canAccessAlcon,
    canViewFinancials,
    isBlocked,
    institutionId,
    institutionName,
  };
}
