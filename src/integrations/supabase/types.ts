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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          at: string
          created_at: string
          id: string
          module: string
          reference: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action: string
          at?: string
          created_at?: string
          id?: string
          module: string
          reference?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          at?: string
          created_at?: string
          id?: string
          module?: string
          reference?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          dedupe_key: string | null
          id: string
          motive: string
          notes: string
          number: string
          reference: string
          source: string
          time: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date?: string
          dedupe_key?: string | null
          id?: string
          motive?: string
          notes?: string
          number?: string
          reference?: string
          source?: string
          time?: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          dedupe_key?: string | null
          id?: string
          motive?: string
          notes?: string
          number?: string
          reference?: string
          source?: string
          time?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_payments: {
        Row: {
          allocations: Json
          amount: number
          created_at: string
          created_by: string
          customer_id: string
          debt_after: number
          debt_before: number
          id: string
          mode: string
          number: string
        }
        Insert: {
          allocations?: Json
          amount: number
          created_at?: string
          created_by: string
          customer_id: string
          debt_after: number
          debt_before: number
          id: string
          mode: string
          number: string
        }
        Update: {
          allocations?: Json
          amount?: number
          created_at?: string
          created_by?: string
          customer_id?: string
          debt_after?: number
          debt_before?: number
          id?: string
          mode?: string
          number?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          company: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string
          phone: string
          type: string
          updated_at: string
          wilaya: string
        }
        Insert: {
          address?: string
          company?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string
          phone?: string
          type?: string
          updated_at?: string
          wilaya?: string
        }
        Update: {
          address?: string
          company?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string
          phone?: string
          type?: string
          updated_at?: string
          wilaya?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          address: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          delivered_at: string | null
          driver_id: string | null
          id: string
          notes: string
          number: string
          paid: number
          payment_mode: string
          route_id: string | null
          status: string
          total: number
          vehicle_id: string | null
        }
        Insert: {
          address?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          delivered_at?: string | null
          driver_id?: string | null
          id?: string
          notes?: string
          number: string
          paid?: number
          payment_mode?: string
          route_id?: string | null
          status?: string
          total?: number
          vehicle_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          delivered_at?: string | null
          driver_id?: string | null
          id?: string
          notes?: string
          number?: string
          paid?: number
          payment_mode?: string
          route_id?: string | null
          status?: string
          total?: number
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "driver_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          delivery_id: string
          id: string
          item_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          delivery_id: string
          id?: string
          item_id: string
          quantity: number
          total?: number
          unit_price?: number
        }
        Update: {
          delivery_id?: string
          id?: string
          item_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_counters: {
        Row: {
          last: number
          prefix: string
          year: number
        }
        Insert: {
          last?: number
          prefix: string
          year: number
        }
        Update: {
          last?: number
          prefix?: string
          year?: number
        }
        Relationships: []
      }
      driver_cash_movements: {
        Row: {
          amount: number
          created_at: string
          driver_id: string
          id: string
          mode: string
          reference: string
          route_id: string | null
          source: string
        }
        Insert: {
          amount: number
          created_at?: string
          driver_id: string
          id?: string
          mode: string
          reference?: string
          route_id?: string | null
          source: string
        }
        Update: {
          amount?: number
          created_at?: string
          driver_id?: string
          id?: string
          mode?: string
          reference?: string
          route_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_cash_movements_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "driver_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_routes: {
        Row: {
          cash_expected: number
          cash_handed: number
          closed_at: string | null
          driver_id: string
          handover_status: string
          id: string
          number: string
          opened_at: string
          status: string
          summary: Json
          validated_at: string | null
          validated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          cash_expected?: number
          cash_handed?: number
          closed_at?: string | null
          driver_id: string
          handover_status?: string
          id?: string
          number: string
          opened_at?: string
          status?: string
          summary?: Json
          validated_at?: string | null
          validated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          cash_expected?: number
          cash_handed?: number
          closed_at?: string | null
          driver_id?: string
          handover_status?: string
          id?: string
          number?: string
          opened_at?: string
          status?: string
          summary?: Json
          validated_at?: string | null
          validated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_sale_items: {
        Row: {
          id: string
          item_id: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          item_id: string
          quantity: number
          sale_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          id?: string
          item_id?: string
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_sale_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "driver_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_sales: {
        Row: {
          created_at: string
          customer_id: string | null
          driver_id: string
          id: string
          number: string
          paid: number
          payment_mode: string
          remaining: number
          route_id: string | null
          total: number
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          driver_id: string
          id?: string
          number: string
          paid?: number
          payment_mode?: string
          remaining?: number
          route_id?: string | null
          total?: number
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          driver_id?: string
          id?: string
          number?: string
          paid?: number
          payment_mode?: string
          remaining?: number
          route_id?: string | null
          total?: number
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_sales_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "driver_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_sales_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          number: string
          payment_mode: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          number: string
          payment_mode?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          number?: string
          payment_mode?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      olive_receptions: {
        Row: {
          cancelled: boolean
          client_choice: string
          condition: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string
          number: string
          oil_kg: number
          origin: string
          paid: number
          payment_status: string
          price_per_kg: number
          remaining: number
          sold_kg: number
          supplier_id: string | null
          time: string
          total: number
          transform_status: string
          updated_at: string
          variety: string
          weight_kg: number
        }
        Insert: {
          cancelled?: boolean
          client_choice?: string
          condition?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string
          number: string
          oil_kg?: number
          origin?: string
          paid?: number
          payment_status?: string
          price_per_kg?: number
          remaining?: number
          sold_kg?: number
          supplier_id?: string | null
          time?: string
          total?: number
          transform_status?: string
          updated_at?: string
          variety?: string
          weight_kg: number
        }
        Update: {
          cancelled?: boolean
          client_choice?: string
          condition?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string
          number?: string
          oil_kg?: number
          origin?: string
          paid?: number
          payment_status?: string
          price_per_kg?: number
          remaining?: number
          sold_kg?: number
          supplier_id?: string | null
          time?: string
          total?: number
          transform_status?: string
          updated_at?: string
          variety?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "olive_receptions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          mode: string
          sale_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          mode?: string
          sale_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          mode?: string
          sale_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      productions: {
        Row: {
          byproducts_kg: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string
          number: string
          oil_liters: number
          olives_kg: number
          reception_id: string | null
          updated_at: string
          yield_pct: number
        }
        Insert: {
          byproducts_kg?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string
          number: string
          oil_liters: number
          olives_kg: number
          reception_id?: string | null
          updated_at?: string
          yield_pct?: number
        }
        Update: {
          byproducts_kg?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string
          number?: string
          oil_liters?: number
          olives_kg?: number
          reception_id?: string | null
          updated_at?: string
          yield_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "productions_reception_id_fkey"
            columns: ["reception_id"]
            isOneToOne: false
            referencedRelation: "olive_receptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string
          first_name?: string
          id: string
          last_name?: string
          phone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      record_locks: {
        Row: {
          locked_at: string
          record_id: string
          table_name: string
          user_id: string
        }
        Insert: {
          locked_at?: string
          record_id: string
          table_name: string
          user_id: string
        }
        Update: {
          locked_at?: string
          record_id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          quantity: number
          sale_id: string
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          quantity: number
          sale_id: string
          total: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          id: string
          item_id: string | null
          notes: string
          number: string
          paid: number
          payment_mode: string
          quantity: number
          remaining: number
          sale_type: string
          status: string
          total: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          item_id?: string | null
          notes?: string
          number: string
          paid?: number
          payment_mode?: string
          quantity: number
          remaining?: number
          sale_type?: string
          status?: string
          total?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          item_id?: string | null
          notes?: string
          number?: string
          paid?: number
          payment_mode?: string
          quantity?: number
          remaining?: number
          sale_type?: string
          status?: string
          total?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          address: string
          auto_print_receipt: boolean
          company_name: string
          created_at: string
          currency: string
          daily_price: number
          default_unit: string
          id: number
          last_backup_at: string | null
          low_stock_threshold: number
          number_format: string
          phone: string
          tax_number: string
          updated_at: string
          wilaya: string
        }
        Insert: {
          address?: string
          auto_print_receipt?: boolean
          company_name?: string
          created_at?: string
          currency?: string
          daily_price?: number
          default_unit?: string
          id?: number
          last_backup_at?: string | null
          low_stock_threshold?: number
          number_format?: string
          phone?: string
          tax_number?: string
          updated_at?: string
          wilaya?: string
        }
        Update: {
          address?: string
          auto_print_receipt?: boolean
          company_name?: string
          created_at?: string
          currency?: string
          daily_price?: number
          default_unit?: string
          id?: number
          last_backup_at?: string | null
          low_stock_threshold?: number
          number_format?: string
          phone?: string
          tax_number?: string
          updated_at?: string
          wilaya?: string
        }
        Relationships: []
      }
      showroom_documents: {
        Row: {
          created_at: string
          created_by: string
          data: Json
          id: string
          kind: string
          number: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data: Json
          id: string
          kind: string
          number: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data?: Json
          id?: string
          kind?: string
          number?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          barcode: string | null
          bundle_size: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          location: string
          min_quantity: number
          name: string
          quantity: number
          sale_price: number
          unit: string
          updated_at: string
          wholesale_price: number
          wholesale_tiers: Json
        }
        Insert: {
          barcode?: string | null
          bundle_size?: number
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          location?: string
          min_quantity?: number
          name: string
          quantity?: number
          sale_price?: number
          unit?: string
          updated_at?: string
          wholesale_price?: number
          wholesale_tiers?: Json
        }
        Update: {
          barcode?: string | null
          bundle_size?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          location?: string
          min_quantity?: number
          name?: string
          quantity?: number
          sale_price?: number
          unit?: string
          updated_at?: string
          wholesale_price?: number
          wholesale_tiers?: Json
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          date: string
          id: string
          item_id: string
          quantity: number
          reference: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          item_id: string
          quantity: number
          reference?: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          item_id?: string
          quantity?: number
          reference?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string
          commune: string
          company: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string
          phone: string
          type: string
          updated_at: string
          wilaya: string
        }
        Insert: {
          address?: string
          commune?: string
          company?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string
          phone?: string
          type?: string
          updated_at?: string
          wilaya?: string
        }
        Update: {
          address?: string
          commune?: string
          company?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string
          phone?: string
          type?: string
          updated_at?: string
          wilaya?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          level: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          level: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          level?: string
          module?: string
          updated_at?: string
          user_id?: string
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
      vehicle_stock: {
        Row: {
          item_id: string
          quantity: number
          vehicle_id: string
        }
        Insert: {
          item_id: string
          quantity?: number
          vehicle_id: string
        }
        Update: {
          item_id?: string
          quantity?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_stock_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string | null
          id: string
          item_id: string
          number: string
          quantity: number
          reference: string
          route_id: string | null
          type: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          item_id: string
          number?: string
          quantity: number
          reference?: string
          route_id?: string | null
          type: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          item_id?: string
          number?: string
          quantity?: number
          reference?: string
          route_id?: string | null
          type?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_stock_movements_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "driver_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_stock_movements_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          created_at: string
          driver_id: string | null
          id: string
          name: string
          plate: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          driver_id?: string | null
          id?: string
          name: string
          plate?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          driver_id?: string | null
          id?: string
          name?: string
          plate?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_lock: { Args: { _id: string; _table: string }; Returns: string }
      can_write: { Args: { _module: string }; Returns: boolean }
      close_route: { Args: { _cash_handed: number }; Returns: string }
      complete_delivery: {
        Args: { _id: string; _mode: string; _paid: number }
        Returns: string
      }
      create_delivery: {
        Args: {
          _address: string
          _customer: string
          _date: string
          _items: Json
          _notes: string
          _vehicle: string
        }
        Returns: string
      }
      driver_add_customer: {
        Args: { _address: string; _name: string; _phone: string }
        Returns: string
      }
      driver_return: {
        Args: { _damaged: boolean; _items: Json; _notes: string }
        Returns: string
      }
      driver_sell: {
        Args: { _customer: string; _items: Json; _mode: string; _paid: number }
        Returns: string
      }
      fleet_can_see: { Args: { _driver: string }; Returns: boolean }
      fleet_load: { Args: { _items: Json; _vehicle: string }; Returns: string }
      has_any_role: { Args: { _roles: string[] }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      is_driver: { Args: never; Returns: boolean }
      my_vehicle: { Args: never; Returns: string }
      next_doc_number: {
        Args: { _date: string; _prefix: string }
        Returns: string
      }
      record_customer_payment: {
        Args: { _amount: number; _customer: string; _id: string; _mode: string }
        Returns: Json
      }
      release_lock: {
        Args: { _id: string; _table: string }
        Returns: undefined
      }
      route_for: {
        Args: { _driver: string; _vehicle: string }
        Returns: string
      }
      set_delivery_status: {
        Args: { _id: string; _notes: string; _status: string }
        Returns: undefined
      }
      showroom_document: {
        Args: {
          _beneficiary?: string
          _customer?: string
          _id: string
          _items: Json
          _kind: string
          _mode: string
          _motive?: string
          _paid: number
        }
        Returns: Json
      }
      showroom_sell: {
        Args: { _customer?: string; _items: Json; _mode: string }
        Returns: string
      }
      validate_route: { Args: { _id: string }; Returns: undefined }
      vstock_add: {
        Args: { _delta: number; _item: string; _vehicle: string }
        Returns: undefined
      }
      wholesale_unit_price: {
        Args: { _item: string; _qty: number }
        Returns: number
      }
    }
    Enums: {
      app_role:
        | "ADMIN"
        | "RESPONSABLE_PRODUCTION"
        | "MAGASINIER"
        | "COMMERCIAL"
        | "COMPTABLE"
        | "CONSULTATION"
        | "CHAUFFEUR"
        | "VENDEUR"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "ADMIN",
        "RESPONSABLE_PRODUCTION",
        "MAGASINIER",
        "COMMERCIAL",
        "COMPTABLE",
        "CONSULTATION",
        "CHAUFFEUR",
        "VENDEUR",
      ],
    },
  },
} as const
