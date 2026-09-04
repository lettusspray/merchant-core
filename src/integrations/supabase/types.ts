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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          alt_text: string | null
          byte_size: number | null
          content_type: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          merchant_id: string | null
          public_url: string | null
          storage_key: string
          storage_provider: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          byte_size?: number | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          merchant_id?: string | null
          public_url?: string | null
          storage_key: string
          storage_provider?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          byte_size?: number | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          merchant_id?: string | null
          public_url?: string | null
          storage_key?: string
          storage_provider?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          location_id: string
          opens_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          location_id: string
          opens_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          location_id?: string
          opens_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          tenant_id: string
          updated_at: string
          vertical: Database["public"]["Enums"]["vertical"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          tenant_id: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["vertical"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["vertical"]
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          merchant_id: string
          tenant_id: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          merchant_id: string
          tenant_id: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          merchant_id?: string
          tenant_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_candidates: {
        Row: {
          city: string | null
          created_at: string
          dedupe_key: string | null
          evidence: Json
          id: string
          job_id: string | null
          merchant_id: string | null
          name: string
          observed_at: string
          payload: Json
          phone: string | null
          provider: string
          region: string | null
          score: number
          signals: Json
          status: Database["public"]["Enums"]["discovery_status"]
          tenant_id: string
          updated_at: string
          vertical: Database["public"]["Enums"]["vertical"]
          website: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          dedupe_key?: string | null
          evidence?: Json
          id?: string
          job_id?: string | null
          merchant_id?: string | null
          name: string
          observed_at?: string
          payload?: Json
          phone?: string | null
          provider?: string
          region?: string | null
          score?: number
          signals?: Json
          status?: Database["public"]["Enums"]["discovery_status"]
          tenant_id: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["vertical"]
          website?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          dedupe_key?: string | null
          evidence?: Json
          id?: string
          job_id?: string | null
          merchant_id?: string | null
          name?: string
          observed_at?: string
          payload?: Json
          phone?: string | null
          provider?: string
          region?: string | null
          score?: number
          signals?: Json
          status?: Database["public"]["Enums"]["discovery_status"]
          tenant_id?: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["vertical"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "discovery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_candidates_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_jobs: {
        Row: {
          city: string | null
          created_at: string
          created_count: number
          error: string | null
          finished_at: string | null
          found_count: number
          id: string
          provider: string
          query: string
          requested_by: string | null
          started_at: string
          status: Database["public"]["Enums"]["workflow_status"]
          tenant_id: string
          updated_at: string
          vertical: Database["public"]["Enums"]["vertical"] | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_count?: number
          error?: string | null
          finished_at?: string | null
          found_count?: number
          id?: string
          provider: string
          query: string
          requested_by?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          tenant_id: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["vertical"] | null
        }
        Update: {
          city?: string | null
          created_at?: string
          created_count?: number
          error?: string | null
          finished_at?: string | null
          found_count?: number
          id?: string
          provider?: string
          query?: string
          requested_by?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          tenant_id?: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["vertical"] | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          subject_id: string | null
          subject_type: string | null
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          subject_id?: string | null
          subject_type?: string | null
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          subject_id?: string | null
          subject_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      happening_reviews: {
        Row: {
          action: string
          created_at: string
          happening_id: string
          id: string
          notes: string | null
          reviewer_id: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          happening_id: string
          id?: string
          notes?: string | null
          reviewer_id?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          happening_id?: string
          id?: string
          notes?: string | null
          reviewer_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "happening_reviews_happening_id_fkey"
            columns: ["happening_id"]
            isOneToOne: false
            referencedRelation: "happenings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "happening_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      happenings: {
        Row: {
          ai_confidence: number | null
          ai_model: string | null
          ai_provider: string | null
          body: string | null
          created_at: string
          ends_at: string | null
          evidence_excerpt: string | null
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["happening_kind"]
          merchant_id: string
          origin: string
          published_at: string | null
          source_kind: string | null
          source_observed_at: string | null
          source_record_id: string | null
          source_url: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["happening_status"]
          tenant_id: string
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          ai_confidence?: number | null
          ai_model?: string | null
          ai_provider?: string | null
          body?: string | null
          created_at?: string
          ends_at?: string | null
          evidence_excerpt?: string | null
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["happening_kind"]
          merchant_id: string
          origin?: string
          published_at?: string | null
          source_kind?: string | null
          source_observed_at?: string | null
          source_record_id?: string | null
          source_url?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["happening_status"]
          tenant_id: string
          title: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          ai_confidence?: number | null
          ai_model?: string | null
          ai_provider?: string | null
          body?: string | null
          created_at?: string
          ends_at?: string | null
          evidence_excerpt?: string | null
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["happening_kind"]
          merchant_id?: string
          origin?: string
          published_at?: string | null
          source_kind?: string | null
          source_observed_at?: string | null
          source_record_id?: string | null
          source_url?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["happening_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "happenings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "happenings_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "happenings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          category: string
          config: Json
          created_at: string
          id: string
          mode: string
          provider: string
          status: Database["public"]["Enums"]["connector_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string
          id?: string
          mode?: string
          provider: string
          status?: Database["public"]["Enums"]["connector_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          id?: string
          mode?: string
          provider?: string
          status?: Database["public"]["Enums"]["connector_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_primary: boolean
          label: string
          latitude: number | null
          longitude: number | null
          merchant_id: string
          phone: string | null
          postal_code: string | null
          region: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          label: string
          latitude?: number | null
          longitude?: number | null
          merchant_id: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          merchant_id?: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          brand_color: string | null
          created_at: string
          data_quality: number
          description: string | null
          id: string
          logo_url: string | null
          name: string
          primary_category_id: string | null
          slug: string
          status: Database["public"]["Enums"]["merchant_status"]
          tagline: string | null
          tenant_id: string
          updated_at: string
          vertical: Database["public"]["Enums"]["vertical"]
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          data_quality?: number
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_category_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["merchant_status"]
          tagline?: string | null
          tenant_id: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["vertical"]
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          data_quality?: number
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_category_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["merchant_status"]
          tagline?: string | null
          tenant_id?: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["vertical"]
        }
        Relationships: [
          {
            foreignKeyName: "merchants_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          confidence: number
          created_at: string
          current_value: string | null
          field_path: string
          id: string
          merchant_id: string
          observed_at: string
          observed_value: string | null
          source_record_id: string | null
          status: Database["public"]["Enums"]["observation_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          current_value?: string | null
          field_path: string
          id?: string
          merchant_id: string
          observed_at?: string
          observed_value?: string | null
          source_record_id?: string | null
          status?: Database["public"]["Enums"]["observation_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          current_value?: string | null
          field_path?: string
          id?: string
          merchant_id?: string
          observed_at?: string
          observed_value?: string | null
          source_record_id?: string | null
          status?: Database["public"]["Enums"]["observation_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "observations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          created_at: string
          description: string | null
          discount_label: string | null
          ends_at: string | null
          id: string
          merchant_id: string
          starts_at: string | null
          state: Database["public"]["Enums"]["publish_state"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_label?: string | null
          ends_at?: string | null
          id?: string
          merchant_id: string
          starts_at?: string | null
          state?: Database["public"]["Enums"]["publish_state"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_label?: string | null
          ends_at?: string | null
          id?: string
          merchant_id?: string
          starts_at?: string | null
          state?: Database["public"]["Enums"]["publish_state"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          description: string
          id: string
          order_id: string
          quantity: number
          tenant_id: string
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          order_id: string
          quantity?: number
          tenant_id: string
          unit_price_cents?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          order_id?: string
          quantity?: number
          tenant_id?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          commission_bps: number
          commission_cents: number
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          dispute_status: string | null
          id: string
          idempotency_key: string | null
          merchant_id: string
          mode: string
          payout_reference: string | null
          placed_at: string
          provider: string
          provider_reference: string | null
          reference: string
          refunded_cents: number
          status: Database["public"]["Enums"]["order_status"]
          tenant_id: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          commission_bps?: number
          commission_cents?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          dispute_status?: string | null
          id?: string
          idempotency_key?: string | null
          merchant_id: string
          mode?: string
          payout_reference?: string | null
          placed_at?: string
          provider?: string
          provider_reference?: string | null
          reference: string
          refunded_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          tenant_id: string
          total_cents?: number
          updated_at?: string
        }
        Update: {
          commission_bps?: number
          commission_cents?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          dispute_status?: string | null
          id?: string
          idempotency_key?: string | null
          merchant_id?: string
          mode?: string
          payout_reference?: string | null
          placed_at?: string
          provider?: string
          provider_reference?: string | null
          reference?: string
          refunded_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          tenant_id?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          id: string
          merchant_id: string
          name: string
          price_cents: number | null
          sku: string | null
          state: Database["public"]["Enums"]["publish_state"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          merchant_id: string
          name: string
          price_cents?: number | null
          sku?: string | null
          state?: Database["public"]["Enums"]["publish_state"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          merchant_id?: string
          name?: string
          price_cents?: number | null
          sku?: string | null
          state?: Database["public"]["Enums"]["publish_state"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          merchant_id: string
          name: string
          price_cents: number | null
          state: Database["public"]["Enums"]["publish_state"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          merchant_id: string
          name: string
          price_cents?: number | null
          state?: Database["public"]["Enums"]["publish_state"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          merchant_id?: string
          name?: string
          price_cents?: number | null
          state?: Database["public"]["Enums"]["publish_state"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      source_connectors: {
        Row: {
          config: Json
          created_at: string
          id: string
          last_synced_at: string | null
          name: string
          provider: string
          status: Database["public"]["Enums"]["connector_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          last_synced_at?: string | null
          name: string
          provider: string
          status?: Database["public"]["Enums"]["connector_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          last_synced_at?: string | null
          name?: string
          provider?: string
          status?: Database["public"]["Enums"]["connector_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_connectors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      source_records: {
        Row: {
          connector_id: string
          created_at: string
          external_id: string | null
          fetched_at: string
          id: string
          merchant_id: string | null
          payload: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          connector_id: string
          created_at?: string
          external_id?: string | null
          fetched_at?: string
          id?: string
          merchant_id?: string | null
          payload?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          connector_id?: string
          created_at?: string
          external_id?: string | null
          fetched_at?: string
          id?: string
          merchant_id?: string | null
          payload?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_records_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "source_connectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_records_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          id: string
          interval: string
          merchant_id: string
          plan: string
          price_cents: number
          provider: string
          provider_reference: string | null
          reconciled_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          interval?: string
          merchant_id: string
          plan: string
          price_cents?: number
          provider?: string
          provider_reference?: string | null
          reconciled_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          interval?: string
          merchant_id?: string
          plan?: string
          price_cents?: number
          provider?: string
          provider_reference?: string | null
          reconciled_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      value_signals: {
        Row: {
          candidate_id: string | null
          confidence: number | null
          created_at: string
          decided_at: string
          id: string
          merchant_id: string | null
          payload: Json
          signal: string
          stage: string
          tenant_id: string
          value_cents: number | null
        }
        Insert: {
          candidate_id?: string | null
          confidence?: number | null
          created_at?: string
          decided_at?: string
          id?: string
          merchant_id?: string | null
          payload?: Json
          signal: string
          stage: string
          tenant_id: string
          value_cents?: number | null
        }
        Update: {
          candidate_id?: string | null
          confidence?: number | null
          created_at?: string
          decided_at?: string
          id?: string
          merchant_id?: string | null
          payload?: Json
          signal?: string
          stage?: string
          tenant_id?: string
          value_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "value_signals_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "discovery_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_signals_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_queries: {
        Row: {
          created_at: string
          id: string
          intent: string | null
          merchant_id: string | null
          prompt: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          intent?: string | null
          merchant_id?: string | null
          prompt: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          intent?: string | null
          merchant_id?: string | null
          prompt?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visibility_queries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_queries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_runs: {
        Row: {
          cost_usd: number | null
          created_at: string
          engines: Json
          error: string | null
          external_id: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          merchant_id: string
          metrics: Json
          mode: string
          provider: string
          raw: Json | null
          requested_by: string | null
          started_at: string
          status: Database["public"]["Enums"]["workflow_status"]
          system_version: string | null
          tenant_id: string
          updated_at: string
          warnings: Json
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          engines?: Json
          error?: string | null
          external_id?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          merchant_id: string
          metrics?: Json
          mode?: string
          provider: string
          raw?: Json | null
          requested_by?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          system_version?: string | null
          tenant_id: string
          updated_at?: string
          warnings?: Json
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          engines?: Json
          error?: string | null
          external_id?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          merchant_id?: string
          metrics?: Json
          mode?: string
          provider?: string
          raw?: Json | null
          requested_by?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          system_version?: string | null
          tenant_id?: string
          updated_at?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "visibility_runs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_snapshots: {
        Row: {
          answer_excerpt: string | null
          captured_at: string
          citations: Json
          cost_usd: number | null
          created_at: string
          engine: string
          factual_accuracy: number | null
          id: string
          mentioned: boolean
          mentioned_entities: Json
          merchant_id: string
          model: string | null
          provider: string
          query_id: string | null
          rank: number | null
          raw: Json | null
          recommended: boolean
          run_id: string | null
          score: number
          sentiment: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          answer_excerpt?: string | null
          captured_at?: string
          citations?: Json
          cost_usd?: number | null
          created_at?: string
          engine: string
          factual_accuracy?: number | null
          id?: string
          mentioned?: boolean
          mentioned_entities?: Json
          merchant_id: string
          model?: string | null
          provider?: string
          query_id?: string | null
          rank?: number | null
          raw?: Json | null
          recommended?: boolean
          run_id?: string | null
          score?: number
          sentiment?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          answer_excerpt?: string | null
          captured_at?: string
          citations?: Json
          cost_usd?: number | null
          created_at?: string
          engine?: string
          factual_accuracy?: number | null
          id?: string
          mentioned?: boolean
          mentioned_entities?: Json
          merchant_id?: string
          model?: string | null
          provider?: string
          query_id?: string | null
          rank?: number | null
          raw?: Json | null
          recommended?: boolean
          run_id?: string | null
          score?: number
          sentiment?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visibility_snapshots_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_snapshots_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "visibility_queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "visibility_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error: string | null
          event_type: string | null
          external_id: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          error?: string | null
          event_type?: string | null
          external_id: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          error?: string | null
          event_type?: string | null
          external_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      website_page_versions: {
        Row: {
          blocks: Json
          body: string | null
          created_at: string
          created_by: string | null
          generated: boolean
          id: string
          meta_description: string | null
          page_id: string
          seo_title: string | null
          tenant_id: string
          title: string
          version: number
        }
        Insert: {
          blocks?: Json
          body?: string | null
          created_at?: string
          created_by?: string | null
          generated?: boolean
          id?: string
          meta_description?: string | null
          page_id: string
          seo_title?: string | null
          tenant_id: string
          title: string
          version: number
        }
        Update: {
          blocks?: Json
          body?: string | null
          created_at?: string
          created_by?: string | null
          generated?: boolean
          id?: string
          meta_description?: string | null
          page_id?: string
          seo_title?: string | null
          tenant_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "website_page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_page_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      website_pages: {
        Row: {
          blocks: Json
          body: string | null
          created_at: string
          generated: boolean
          id: string
          kind: string
          locked: boolean
          merchant_id: string | null
          meta_description: string | null
          path: string
          published_at: string | null
          seo_title: string | null
          sort_order: number
          state: Database["public"]["Enums"]["publish_state"]
          tenant_id: string
          title: string
          updated_at: string
          version: number
          website_id: string
        }
        Insert: {
          blocks?: Json
          body?: string | null
          created_at?: string
          generated?: boolean
          id?: string
          kind?: string
          locked?: boolean
          merchant_id?: string | null
          meta_description?: string | null
          path: string
          published_at?: string | null
          seo_title?: string | null
          sort_order?: number
          state?: Database["public"]["Enums"]["publish_state"]
          tenant_id: string
          title: string
          updated_at?: string
          version?: number
          website_id: string
        }
        Update: {
          blocks?: Json
          body?: string | null
          created_at?: string
          generated?: boolean
          id?: string
          kind?: string
          locked?: boolean
          merchant_id?: string | null
          meta_description?: string | null
          path?: string
          published_at?: string | null
          seo_title?: string | null
          sort_order?: number
          state?: Database["public"]["Enums"]["publish_state"]
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_pages_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_pages_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          created_at: string
          domain: string
          id: string
          last_generated_at: string | null
          merchant_id: string
          nav: Json
          published_at: string | null
          published_version: number
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          state: Database["public"]["Enums"]["publish_state"]
          tenant_id: string
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          last_generated_at?: string | null
          merchant_id: string
          nav?: Json
          published_at?: string | null
          published_version?: number
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          state?: Database["public"]["Enums"]["publish_state"]
          tenant_id: string
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          last_generated_at?: string | null
          merchant_id?: string
          nav?: Json
          published_at?: string | null
          published_version?: number
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          state?: Database["public"]["Enums"]["publish_state"]
          tenant_id?: string
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "websites_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "websites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          created_at: string
          engine: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          output: Json | null
          started_at: string
          status: Database["public"]["Enums"]["workflow_status"]
          steps: Json
          tenant_id: string
          updated_at: string
          workflow: string
        }
        Insert: {
          created_at?: string
          engine?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          output?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          steps?: Json
          tenant_id: string
          updated_at?: string
          workflow: string
        }
        Update: {
          created_at?: string
          engine?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          output?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          steps?: Json
          tenant_id?: string
          updated_at?: string
          workflow?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_tenant_role: {
        Args: {
          _roles: Database["public"]["Enums"]["tenant_role"][]
          _tenant_id: string
        }
        Returns: boolean
      }
      is_tenant_member: { Args: { _tenant_id: string }; Returns: boolean }
    }
    Enums: {
      connector_status: "not_configured" | "configured" | "syncing" | "error"
      discovery_status: "new" | "reviewing" | "claimed" | "dismissed"
      happening_kind:
        | "event"
        | "promotion"
        | "announcement"
        | "menu_change"
        | "hours_change"
      happening_status:
        | "draft"
        | "in_review"
        | "approved"
        | "published"
        | "rejected"
      merchant_status:
        | "prospect"
        | "onboarding"
        | "active"
        | "paused"
        | "archived"
      observation_status: "pending" | "accepted" | "rejected" | "superseded"
      order_status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded"
      publish_state: "draft" | "published" | "archived"
      subscription_status: "trialing" | "active" | "past_due" | "cancelled"
      tenant_role: "owner" | "admin" | "editor" | "viewer"
      vertical:
        | "restaurant"
        | "home_service"
        | "beauty"
        | "pet_service"
        | "automotive"
        | "local_retail"
        | "other"
      workflow_status: "queued" | "running" | "succeeded" | "failed"
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
      connector_status: ["not_configured", "configured", "syncing", "error"],
      discovery_status: ["new", "reviewing", "claimed", "dismissed"],
      happening_kind: [
        "event",
        "promotion",
        "announcement",
        "menu_change",
        "hours_change",
      ],
      happening_status: [
        "draft",
        "in_review",
        "approved",
        "published",
        "rejected",
      ],
      merchant_status: [
        "prospect",
        "onboarding",
        "active",
        "paused",
        "archived",
      ],
      observation_status: ["pending", "accepted", "rejected", "superseded"],
      order_status: ["pending", "paid", "fulfilled", "cancelled", "refunded"],
      publish_state: ["draft", "published", "archived"],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
      tenant_role: ["owner", "admin", "editor", "viewer"],
      vertical: [
        "restaurant",
        "home_service",
        "beauty",
        "pet_service",
        "automotive",
        "local_retail",
        "other",
      ],
      workflow_status: ["queued", "running", "succeeded", "failed"],
    },
  },
} as const
