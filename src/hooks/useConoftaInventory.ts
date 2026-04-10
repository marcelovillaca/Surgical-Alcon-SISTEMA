import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Product {
  id: string; sku: string; name: string; category: string; unit: string;
  base_cost?: number; min_stock: number; is_active: boolean;
}
export interface InventoryItem {
  id?: string; product_id: string; institution_id: string; quantity: number;
  product?: Product;
}
export interface ReplenishmentRequest {
  id: string; request_number: string; institution_id: string; status: string;
  notes_request?: string; notes_dispatch?: string; notes_received?: string;
  requested_at: string; dispatched_at?: string; received_at?: string;
  institution?: { name: string };
  items?: ReplenishmentItem[];
}
export interface ReplenishmentItem {
  id?: string; request_id?: string; product_id: string; qty_requested: number;
  qty_sent?: number; qty_received?: number; divergence_reason?: string;
  product?: Product;
}
export interface InventoryTask {
  id: string; institution_id: string; period_year: number; period_month: number;
  status: string; due_date: string; completed_at?: string;
  institution?: { name: string };
}
export interface Journey {
  id: string; name: string; date: string; institution_id: string;
}
export interface JourneySupply {
  id: string; jornada_id: string; product_id: string; quantity: number;
  product?: Product;
}

export function useConoftaInventory() {
  const { role, institutionId, institutionName, isGerente } = useUserRole();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [requests, setRequests] = useState<ReplenishmentRequest[]>([]);
  const [tasks, setTasks] = useState<InventoryTask[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourneyConsumptions, setSelectedJourneyConsumptions] = useState<JourneySupply[]>([]);

  const fetchAll = useCallback(async () => {
    if (role === null) return;

    setLoading(true);
    try {
      // Products
      const prodRes = await supabase.from("conofta_products").select("*").order("name");
      setProducts(prodRes.data || []);

      // Institutions
      const instRes = await supabase.from("institutions").select("id, name").order("name");
      setInstitutions(instRes.data || []);

      // Inventory
      let invQ = supabase
        .from("conofta_inventory")
        .select("*, product:conofta_products(*)");
      
      if (role === "coordinador_local" && institutionId) {
        invQ = invQ.eq("institution_id", institutionId);
      }
      
      const { data: invData } = await invQ;
      setInventory(invData || []);

      // Replenishment requests
      let repQ = supabase
        .from("conofta_replenishment_requests")
        .select("*, institution:institutions(name), items:conofta_replenishment_items(*, product:conofta_products(sku, name, unit))")
        .order("created_at", { ascending: false });
      
      if (role === "coordinador_local" && institutionId) {
        repQ = repQ.eq("institution_id", institutionId);
      }
      
      const { data: repData } = await repQ;
      setRequests(repData || []);

      // Inventory tasks
      let taskQ = supabase
        .from("conofta_inventory_tasks")
        .select("*, institution:institutions(name)")
        .order("due_date", { ascending: false });
      
      if (role === "coordinador_local" && institutionId) {
        taskQ = taskQ.eq("institution_id", institutionId);
      }
      
      const { data: taskData } = await taskQ;
      setTasks(taskData || []);

      // Journeys (for consumption)
      const { data: journeyData } = await supabase.from("conofta_jornadas").select("*").order("date", { ascending: false });
      setJourneys(journeyData || []);

    } catch (err) {
      console.error("[useConoftaInventory] Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [role, institutionId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const generateRequestNumber = async (): Promise<string> => {
    const { data } = await (supabase as any).rpc("generate_request_number");
    return data || `REP-${Date.now()}`;
  };

  const handleCreateRequest = async (items: { product_id: string; qty_requested: number }[], notes: string, selectedInstitution: string) => {
    const reqNum = await generateRequestNumber();
    const instId = role === "coordinador_local" ? institutionId : selectedInstitution;
    
    if (!instId) {
      toast({ title: "Selecione uma sede", variant: "destructive" });
      return;
    }

    const { data: req, error: reqErr } = await supabase
      .from("conofta_replenishment_requests")
      .insert({ 
        request_number: reqNum, 
        institution_id: instId, 
        notes_request: notes, 
        requested_by: user?.id 
      })
      .select().single();

    if (reqErr) {
      toast({ title: "Erro ao criar pedido", description: reqErr.message, variant: "destructive" });
      return;
    }

    const itemsToInsert = items.map(i => ({ ...i, request_id: req.id }));
    await supabase.from("conofta_replenishment_items").insert(itemsToInsert);

    toast({ title: `✅ Pedido ${reqNum} criado com sucesso!` });
    fetchAll();
  };

  const handleDispatch = async (reqId: string, items: { id: string; qty_sent: number }[], notes: string) => {
    await supabase.from("conofta_replenishment_requests")
      .update({ 
        status: "enviado", 
        notes_dispatch: notes, 
        dispatched_by: user?.id, 
        dispatched_at: new Date().toISOString() 
      })
      .eq("id", reqId);

    for (const item of items) {
      await supabase.from("conofta_replenishment_items")
        .update({ qty_sent: item.qty_sent }).eq("id", item.id);
    }
    toast({ title: "✅ Pedido marcado como Enviado" });
    fetchAll();
  };

  const handleReceive = async (reqId: string, inst_id: string, items: { id: string; product_id: string; qty_received: number; qty_sent: number; divergence_reason?: string }[], notes: string) => {
    const hasDivergence = items.some(i => i.qty_received !== i.qty_sent);
    const newStatus = hasDivergence ? "divergente" : "recebido";

    await supabase.from("conofta_replenishment_requests")
      .update({ 
        status: newStatus, 
        notes_received: notes, 
        received_by: user?.id, 
        received_at: new Date().toISOString() 
      })
      .eq("id", reqId);

    for (const item of items) {
      await supabase.from("conofta_replenishment_items")
        .update({ qty_received: item.qty_received, divergence_reason: item.divergence_reason })
        .eq("id", item.id);
    }

    // Update inventory
    for (const item of items) {
      const { data: existing } = await supabase.from("conofta_inventory")
        .select("id, quantity").eq("institution_id", inst_id).eq("product_id", item.product_id).maybeSingle();

      if (existing) {
        await supabase.from("conofta_inventory")
          .update({ quantity: existing.quantity + item.qty_received, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("conofta_inventory")
          .insert({ institution_id: inst_id, product_id: item.product_id, quantity: item.qty_received });
      }

      // Stock movement record
      await supabase.from("conofta_stock_movements").insert({
        institution_id: inst_id, 
        product_id: item.product_id,
        movement_type: "entrada_reposicao",
        quantity: item.qty_received,
        reference_id: reqId, 
        reference_type: "replenishment_request",
        notes: hasDivergence ? `Divergência detectada. ${item.divergence_reason || ""}` : "Recepção confirmada",
        created_by: user?.id
      });
    }

    if (hasDivergence) {
      toast({ title: "⚠️ Pedido recebido com divergências", description: "O Gerente foi notificado.", variant: "destructive" });
    } else {
      toast({ title: "✅ Recepção confirmada! Estoque atualizado." });
    }
    fetchAll();
  };

  const handleFetchJourneyConsumptions = async (journeyId: string) => {
    const { data } = await supabase.from("conofta_journey_supplies")
      .select("*, product:conofta_products(*)")
      .eq("jornada_id", journeyId);
    setSelectedJourneyConsumptions(data || []);
  };

  const handleSaveJourneyConsumption = async (journeyId: string, items: { product_id: string; quantity: number }[]) => {
    const instId = journeys.find(j => j.id === journeyId)?.institution_id;
    if (!instId) {
      toast({ title: "Sede não encontrada", variant: "destructive" });
      return;
    }

    const itemsToInsert = items.map(i => ({
      jornada_id: journeyId,
      product_id: i.product_id,
      quantity: i.quantity,
      institution_id: instId,
      registered_by: user?.id
    }));

    const { error } = await supabase.from("conofta_journey_supplies").insert(itemsToInsert);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "✅ Consumo registrado y stock debidato" });
    handleFetchJourneyConsumptions(journeyId);
    fetchAll();
  };

  return {
    loading,
    products,
    inventory,
    institutions,
    requests,
    tasks,
    journeys,
    selectedJourneyConsumptions,
    role,
    institutionId,
    institutionName,
    isGerente,
    isAdmin: isGerente || role === "admin_conofta",
    isCoordinador: role === "coordinador_local",
    fetchAll,
    handleCreateRequest,
    handleDispatch,
    handleReceive,
    handleFetchJourneyConsumptions,
    handleSaveJourneyConsumption
  };
}
