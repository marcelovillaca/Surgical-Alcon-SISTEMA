import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "LOGIN" | "LOGOUT" | "IMPORT_DATA" | "CREATE_ORDER" | "UPDATE_ORDER" | "VIEW_PAGE";
export type EntityType = "sales_imports" | "orders" | "clients" | "visits" | "auth";

export const useAudit = () => {
    const logAction = async (
        action: AuditAction,
        details?: Record<string, any>,
        entityType?: EntityType,
        entityId?: string
    ) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Capture GPS if available (silently fails if disallowed)
            let gps: { lat: number; lon: number } | null = null;
            if (details?.gps) {
                gps = details.gps;
                delete details.gps;
            }

            await supabase.from("audit_log").insert({
                user_id: user.id,
                action,
                entity_type: entityType,
                entity_id: entityId,
                details,
                gps_lat: gps?.lat,
                gps_lon: gps?.lon,
            });
        } catch (error) {
            console.error("Failed to log audit action:", error);
            // Fail silently to not disrupt user flow
        }
    };

    return { logAction };
};
