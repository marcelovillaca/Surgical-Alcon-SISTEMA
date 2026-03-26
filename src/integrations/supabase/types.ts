export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          gps_lat: number | null
          gps_lon: number | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          gps_lat?: number | null
          gps_lon?: number | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          gps_lat?: number | null
          gps_lon?: number | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      client_institutions: {
        Row: {
          client_id: string
          created_at: string
          id: string
          institution_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          institution_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          institution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_institutions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_institutions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          discount_pct: number
          email: string | null
          id: string
          market_type: string | null
          name: string
          phone: string | null
          pricing_level: Database["public"]["Enums"]["pricing_level"]
          segment: Database["public"]["Enums"]["client_segment"]
          updated_at: string
          visit_frequency: Database["public"]["Enums"]["visit_frequency"] | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number
          email?: string | null
          id?: string
          market_type?: string | null
          name: string
          phone?: string | null
          pricing_level?: Database["public"]["Enums"]["pricing_level"]
          segment?: Database["public"]["Enums"]["client_segment"]
          updated_at?: string
          visit_frequency?:
          | Database["public"]["Enums"]["visit_frequency"]
          | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number
          email?: string | null
          id?: string
          market_type?: string | null
          name?: string
          phone?: string | null
          pricing_level?: Database["public"]["Enums"]["pricing_level"]
          segment?: Database["public"]["Enums"]["client_segment"]
          updated_at?: string
          visit_frequency?:
          | Database["public"]["Enums"]["visit_frequency"]
          | null
        }
        Relationships: []
      }
      conofta_targets: {
        Row: {
          id: string
          anio: number
          enero: number
          febrero: number
          marzo: number
          abril: number
          mayo: number
          junio: number
          julio: number
          agosto: number
          septiembre: number
          octubre: number
          noviembre: number
          diciembre: number
          revenue_per_surgery: number
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          anio?: number
          enero?: number
          febrero?: number
          marzo?: number
          abril?: number
          mayo?: number
          junio?: number
          julio?: number
          agosto?: number
          septiembre?: number
          octubre?: number
          noviembre?: number
          diciembre?: number
          revenue_per_surgery?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          anio?: number
          enero?: number
          febrero?: number
          marzo?: number
          abril?: number
          mayo?: number
          junio?: number
          julio?: number
          agosto?: number
          septiembre?: number
          octubre?: number
          noviembre?: number
          diciembre?: number
          revenue_per_surgery?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      conofta_expenses: {
        Row: {
          id: string
          anio: number
          mes: number
          categoria: string
          monto: number
          descripcion: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          anio: number
          mes: number
          categoria: string
          monto?: number
          descripcion?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          anio?: number
          mes?: number
          categoria?: string
          monto?: number
          descripcion?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      commission_accelerators: {
        Row: {
          created_at: string
          id: string
          max_cumplimiento: number
          min_cumplimiento: number
          pago_pct: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_cumplimiento: number
          min_cumplimiento: number
          pago_pct: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_cumplimiento?: number
          min_cumplimiento?: number
          pago_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      hr_costs: {
        Row: {
          anio: number
          categoria: string
          created_at: string
          descripcion: string | null
          id: string
          mes: number
          monto: number
          uploaded_by: string | null
          tipo: string | null
          frecuencia: string | null
          mes_inicio: number | null
          mes_fin: number | null
          categoria_ext: string | null
        }
        Insert: {
          anio?: number
          categoria: string
          created_at?: string
          descripcion?: string | null
          id?: string
          mes: number
          monto?: number
          uploaded_by?: string | null
          tipo?: string | null
          frecuencia?: string | null
          mes_inicio?: number | null
          mes_fin?: number | null
          categoria_ext?: string | null
        }
        Update: {
          anio?: number
          categoria?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          mes?: number
          monto?: number
          uploaded_by?: string | null
          tipo?: string | null
          frecuencia?: string | null
          mes_inicio?: number | null
          mes_fin?: number | null
          categoria_ext?: string | null
        }
        Relationships: []
      }
      installed_equipment: {
        Row: {
          brand: string | null
          client_id: string
          created_at: string
          created_by: string | null
          equipment_name: string
          id: string
          is_own: boolean | null
          notes: string | null
        }
        Insert: {
          brand?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          equipment_name: string
          id?: string
          is_own?: boolean | null
          notes?: string | null
        }
        Update: {
          brand?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          equipment_name?: string
          id?: string
          is_own?: boolean | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installed_equipment_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          phone: string | null
          type: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          phone?: string | null
          type?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          phone?: string | null
          type?: string | null
        }
        Relationships: []
      }
      inventory_lots: {
        Row: {
          cost_unit_pyg: number
          created_at: string
          created_by: string | null
          expiry_date: string
          id: string
          lot_number: string
          price_base_pyg: number
          product_id: string
          quantity: number
          serial_number: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          cost_unit_pyg?: number
          created_at?: string
          created_by?: string | null
          expiry_date: string
          id?: string
          lot_number: string
          price_base_pyg?: number
          product_id: string
          quantity?: number
          serial_number?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          cost_unit_pyg?: number
          created_at?: string
          created_by?: string | null
          expiry_date?: string
          id?: string
          lot_number?: string
          price_base_pyg?: number
          product_id?: string
          quantity?: number
          serial_number?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          dioptria: string | null
          discount_pct: number | null
          id: string
          lot_id: string | null
          notes: string | null
          order_id: string
          product_id: string
          quantity: number
          subtotal_pyg: number
          toricidad: string | null
          unit_price_pyg: number
        }
        Insert: {
          created_at?: string
          dioptria?: string | null
          discount_pct?: number | null
          id?: string
          lot_id?: string | null
          notes?: string | null
          order_id: string
          product_id: string
          quantity?: number
          subtotal_pyg?: number
          toricidad?: string | null
          unit_price_pyg?: number
        }
        Update: {
          created_at?: string
          dioptria?: string | null
          discount_pct?: number | null
          id?: string
          lot_id?: string | null
          notes?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          subtotal_pyg?: number
          toricidad?: string | null
          unit_price_pyg?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          delivered_at: string | null
          dispatched_by: string | null
          id: string
          notes: string | null
          order_number: string
          prepared_by: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_pyg: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          delivered_at?: string | null
          dispatched_by?: string | null
          id?: string
          notes?: string | null
          order_number: string
          prepared_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_pyg?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          dispatched_by?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          prepared_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_pyg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          cost_pyg: number
          created_at: string
          description: string | null
          id: string
          name: string
          price_base_pyg: number
          product_line: Database["public"]["Enums"]["product_line"]
          sku: string
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          cost_pyg?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_base_pyg?: number
          product_line: Database["public"]["Enums"]["product_line"]
          sku: string
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          cost_pyg?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_base_pyg?: number
          product_line?: Database["public"]["Enums"]["product_line"]
          sku?: string
          unit_of_measure?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_details: {
        Row: {
          ciudad: string
          cliente: string
          cod_cliente: string
          cod2: string | null
          codigo_producto: string
          costo: number
          created_at: string
          direccion: string | null
          factura_nro: string
          fecha: string
          id: string
          linea_de_producto: string
          monto_en: string | null
          monto_usd: number
          producto: string
          total: number
          uploaded_by: string | null
          vendedor: string
          mercado: string | null
        }
        Insert: {
          ciudad: string
          cliente: string
          cod_cliente: string
          cod2?: string | null
          codigo_producto: string
          costo?: number
          created_at?: string
          direccion?: string | null
          factura_nro: string
          fecha: string
          id?: string
          linea_de_producto: string
          monto_en?: string | null
          monto_usd?: number
          producto: string
          total?: number
          uploaded_by?: string | null
          vendedor: string
          mercado?: string | null
        }
        Update: {
          ciudad?: string
          cliente?: string
          cod_cliente?: string
          cod2?: string | null
          codigo_producto?: string
          costo?: number
          created_at?: string
          direccion?: string | null
          factura_nro?: string
          fecha?: string
          id?: string
          linea_de_producto?: string
          monto_en?: string | null
          monto_usd?: number
          producto?: string
          total?: number
          uploaded_by?: string | null
          vendedor?: string
          mercado?: string | null
        }
        Relationships: []
      }
      sales_imports: {
        Row: {
          costo_pyg: number | null
          created_at: string
          factura_nro: string | null
          fecha: string | null
          file_name: string
          id: string
          imported_by: string | null
          margin_pyg: number | null
          monto_pyg: number | null
        }
        Insert: {
          costo_pyg?: number | null
          created_at?: string
          factura_nro?: string | null
          fecha?: string | null
          file_name: string
          id?: string
          imported_by?: string | null
          margin_pyg?: number | null
          monto_pyg?: number | null
        }
        Update: {
          costo_pyg?: number | null
          created_at?: string
          factura_nro?: string | null
          fecha?: string | null
          file_name?: string
          id?: string
          imported_by?: string | null
          margin_pyg?: number | null
          monto_pyg?: number | null
        }
        Relationships: []
      }
      sales_targets: {
        Row: {
          abril: number
          agosto: number
          anio: number
          created_at: string
          diciembre: number
          enero: number
          febrero: number
          id: string
          julio: number
          junio: number
          linea_de_producto: string
          marzo: number
          mayo: number
          noviembre: number
          octubre: number
          septiembre: number
          total: number
          uploaded_by: string | null
          visitador: string
        }
        Insert: {
          abril?: number
          agosto?: number
          anio?: number
          created_at?: string
          diciembre?: number
          enero?: number
          febrero?: number
          id?: string
          julio?: number
          junio?: number
          linea_de_producto: string
          marzo?: number
          mayo?: number
          noviembre?: number
          octubre?: number
          septiembre?: number
          total?: number
          uploaded_by?: string | null
          visitador: string
        }
        Update: {
          abril?: number
          agosto?: number
          anio?: number
          created_at?: string
          diciembre?: number
          enero?: number
          febrero?: number
          id?: string
          julio?: number
          junio?: number
          linea_de_producto?: string
          marzo?: number
          mayo?: number
          noviembre?: number
          octubre?: number
          septiembre?: number
          total?: number
          uploaded_by?: string | null
          visitador?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          invite_code: string
          role: Database["public"]["Enums"]["app_role"]
          used: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          invite_code: string
          role: Database["public"]["Enums"]["app_role"]
          used?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          invite_code?: string
          role?: Database["public"]["Enums"]["app_role"]
          used?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viaticos: {
        Row: {
          alimentacion: number | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          hospedaje: number | null
          id: string
          notes: string | null
          otros: number | null
          otros_descripcion: string | null
          status: Database["public"]["Enums"]["viatico_status"] | null
          total: number | null
          transporte: number | null
          updated_at: string
          visit_id: string
        }
        Insert: {
          alimentacion?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          hospedaje?: number | null
          id?: string
          notes?: string | null
          otros?: number | null
          otros_descripcion?: string | null
          status?: Database["public"]["Enums"]["viatico_status"] | null
          total?: number | null
          transporte?: number | null
          updated_at?: string
          visit_id: string
        }
        Update: {
          alimentacion?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          hospedaje?: number | null
          id?: string
          notes?: string | null
          otros?: number | null
          otros_descripcion?: string | null
          status?: Database["public"]["Enums"]["viatico_status"] | null
          total?: number | null
          transporte?: number | null
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viaticos_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          check_in_at: string | null
          check_in_lat: number | null
          check_in_lon: number | null
          check_out_at: string | null
          check_out_lat: number | null
          check_out_lon: number | null
          client_id: string
          created_at: string
          created_by: string
          id: string
          observations: string | null
          order_id: string | null
          scheduled_time: string | null
          updated_at: string
          visit_date: string
          visit_type: Database["public"]["Enums"]["visit_type"]
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lon?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lon?: number | null
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          observations?: string | null
          order_id?: string | null
          scheduled_time?: string | null
          updated_at?: string
          visit_date?: string
          visit_type: Database["public"]["Enums"]["visit_type"]
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lon?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lon?: number | null
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          observations?: string | null
          order_id?: string | null
          scheduled_time?: string | null
          updated_at?: string
          visit_date?: string
          visit_type?: Database["public"]["Enums"]["visit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_bodega: { Args: never; Returns: boolean }
      is_expedicion: { Args: never; Returns: boolean }
      is_gerente: { Args: never; Returns: boolean }
      is_visitador: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "gerente" | "visitador" | "bodega" | "expedicion"
      client_segment: "check_in" | "grow" | "partner" | "protect"
      order_status:
      | "borrador"
      | "pendiente"
      | "en_preparacion"
      | "en_ruta"
      | "entregado"
      | "devolucion"
      pricing_level: "A" | "B" | "C" | "D"
      product_line:
      | "total_monofocals"
      | "vit_ret_paks"
      | "phaco_paks"
      | "equipment"
      | "atiols"
      | "rest_of_portfolio"
      viatico_status: "pendiente" | "aprobado" | "rechazado"
      visit_frequency: "semanal" | "quincenal" | "mensual" | "trimestral"
      visit_type:
      | "soporte_tecnico"
      | "presentacion"
      | "cirugia"
      | "entrega"
      | "promocion_producto"
      | "soporte_tecnico_clinico"
      | "entrenamiento_capacitacion"
      | "gestion_relacion"
      | "seguimiento_oportunidades"
      | "postventa_incidencias"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["gerente", "visitador", "bodega", "expedicion"],
      client_segment: ["check_in", "grow", "partner", "protect"],
      order_status: [
        "borrador",
        "pendiente",
        "en_preparacion",
        "en_ruta",
        "entregado",
        "devolucion",
      ],
      pricing_level: ["A", "B", "C", "D"],
      product_line: [
        "total_monofocals",
        "vit_ret_paks",
        "phaco_paks",
        "ovds_and_solutions",
        "equipment",
        "atiols",
        "rest_of_portfolio",
      ],
      viatico_status: ["pendiente", "aprobado", "rechazado"],
      visit_frequency: ["semanal", "quincenal", "mensual", "trimestral"],
      visit_type: [
        "soporte_tecnico",
        "presentacion",
        "cirugia",
        "entrega",
        "promocion_producto",
        "soporte_tecnico_clinico",
        "entrenamiento_capacitacion",
        "gestion_relacion",
        "seguimiento_oportunidades",
        "postventa_incidencias",
      ],
    },
  },
} as const
