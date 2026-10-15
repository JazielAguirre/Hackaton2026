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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      analisis_lote: {
        Row: {
          conteo_por_clase: Json
          created_at: string
          destino_lote: Database["public"]["Enums"]["destino"] | null
          frutos_revision: number
          frutos_sanos: number
          frutos_separar: number
          grado: Database["public"]["Enums"]["grado_lote"] | null
          id: string
          lote_id: string
          modelo_version: string | null
          muestra_pequena: boolean
          pct_sanos: number | null
          pct_separar: number | null
          total_frutos: number
        }
        Insert: {
          conteo_por_clase?: Json
          created_at?: string
          destino_lote?: Database["public"]["Enums"]["destino"] | null
          frutos_revision: number
          frutos_sanos: number
          frutos_separar: number
          grado?: Database["public"]["Enums"]["grado_lote"] | null
          id?: string
          lote_id: string
          modelo_version?: string | null
          muestra_pequena: boolean
          pct_sanos?: number | null
          pct_separar?: number | null
          total_frutos: number
        }
        Update: {
          conteo_por_clase?: Json
          created_at?: string
          destino_lote?: Database["public"]["Enums"]["destino"] | null
          frutos_revision?: number
          frutos_sanos?: number
          frutos_separar?: number
          grado?: Database["public"]["Enums"]["grado_lote"] | null
          id?: string
          lote_id?: string
          modelo_version?: string | null
          muestra_pequena?: boolean
          pct_sanos?: number | null
          pct_separar?: number | null
          total_frutos?: number
        }
        Relationships: [
          {
            foreignKeyName: "analisis_lote_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "bitacora_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analisis_lote_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      clases: {
        Row: {
          codigo: string
          destino_default: Database["public"]["Enums"]["destino"]
          es_sana: boolean
          fruta_id: string
          id: number
          nombre: string
        }
        Insert: {
          codigo: string
          destino_default: Database["public"]["Enums"]["destino"]
          es_sana: boolean
          fruta_id: string
          id?: number
          nombre: string
        }
        Update: {
          codigo?: string
          destino_default?: Database["public"]["Enums"]["destino"]
          es_sana?: boolean
          fruta_id?: string
          id?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "clases_fruta_id_fkey"
            columns: ["fruta_id"]
            isOneToOne: false
            referencedRelation: "frutas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          clave: string
          descripcion: string | null
          valor: number
        }
        Insert: {
          clave: string
          descripcion?: string | null
          valor: number
        }
        Update: {
          clave?: string
          descripcion?: string | null
          valor?: number
        }
        Relationships: []
      }
      fichas: {
        Row: {
          causas_posibles: string | null
          clase_id: number
          fuente_nombre: string | null
          fuente_url: string | null
          id: number
          practicas_manejo: string | null
          updated_at: string
          verificada: boolean
        }
        Insert: {
          causas_posibles?: string | null
          clase_id: number
          fuente_nombre?: string | null
          fuente_url?: string | null
          id?: number
          practicas_manejo?: string | null
          updated_at?: string
          verificada?: boolean
        }
        Update: {
          causas_posibles?: string | null
          clase_id?: number
          fuente_nombre?: string | null
          fuente_url?: string | null
          id?: number
          practicas_manejo?: string | null
          updated_at?: string
          verificada?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fichas_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "clases"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos: {
        Row: {
          alto: number | null
          ancho: number | null
          brillo: number | null
          created_at: string
          id: string
          lote_id: string
          motivo_rechazo: string | null
          nitidez: number | null
          storage_path: string
          valida: boolean
        }
        Insert: {
          alto?: number | null
          ancho?: number | null
          brillo?: number | null
          created_at?: string
          id?: string
          lote_id: string
          motivo_rechazo?: string | null
          nitidez?: number | null
          storage_path: string
          valida?: boolean
        }
        Update: {
          alto?: number | null
          ancho?: number | null
          brillo?: number | null
          created_at?: string
          id?: string
          lote_id?: string
          motivo_rechazo?: string | null
          nitidez?: number | null
          storage_path?: string
          valida?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fotos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "bitacora_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      frutas: {
        Row: {
          activa: boolean
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          id: string
          nombre: string
        }
        Update: {
          activa?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      frutos: {
        Row: {
          caja_alto: number
          caja_ancho: number
          caja_x: number
          caja_y: number
          clase_id: number | null
          conf_clasificacion: number | null
          conf_deteccion: number
          created_at: string
          destino: Database["public"]["Enums"]["destino"]
          foto_id: string
          fruta_id: string
          id: string
          lote_id: string
          requiere_revision: boolean
        }
        Insert: {
          caja_alto: number
          caja_ancho: number
          caja_x: number
          caja_y: number
          clase_id?: number | null
          conf_clasificacion?: number | null
          conf_deteccion: number
          created_at?: string
          destino?: Database["public"]["Enums"]["destino"]
          foto_id: string
          fruta_id: string
          id?: string
          lote_id: string
          requiere_revision?: boolean
        }
        Update: {
          caja_alto?: number
          caja_ancho?: number
          caja_x?: number
          caja_y?: number
          clase_id?: number | null
          conf_clasificacion?: number | null
          conf_deteccion?: number
          created_at?: string
          destino?: Database["public"]["Enums"]["destino"]
          foto_id?: string
          fruta_id?: string
          id?: string
          lote_id?: string
          requiere_revision?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "frutos_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "clases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frutos_foto_id_fkey"
            columns: ["foto_id"]
            isOneToOne: false
            referencedRelation: "fotos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frutos_fruta_id_fkey"
            columns: ["fruta_id"]
            isOneToOne: false
            referencedRelation: "frutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frutos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "bitacora_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frutos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        Row: {
          created_at: string
          destino_buscado: Database["public"]["Enums"]["destino"] | null
          estado: Database["public"]["Enums"]["estado_lote"]
          fecha_cosecha: string | null
          fruta_principal: string | null
          id: string
          latitud: number | null
          longitud: number | null
          nombre: string
          parcela: string | null
          updated_at: string
          usuario_id: string
          zona_id: number | null
        }
        Insert: {
          created_at?: string
          destino_buscado?: Database["public"]["Enums"]["destino"] | null
          estado?: Database["public"]["Enums"]["estado_lote"]
          fecha_cosecha?: string | null
          fruta_principal?: string | null
          id?: string
          latitud?: number | null
          longitud?: number | null
          nombre: string
          parcela?: string | null
          updated_at?: string
          usuario_id?: string
          zona_id?: number | null
        }
        Update: {
          created_at?: string
          destino_buscado?: Database["public"]["Enums"]["destino"] | null
          estado?: Database["public"]["Enums"]["estado_lote"]
          fecha_cosecha?: string | null
          fruta_principal?: string | null
          id?: string
          latitud?: number | null
          longitud?: number | null
          nombre?: string
          parcela?: string | null
          updated_at?: string
          usuario_id?: string
          zona_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_fruta_principal_fkey"
            columns: ["fruta_principal"]
            isOneToOne: false
            referencedRelation: "frutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          created_at: string
          id: string
          nombre_completo: string | null
          organizacion: string | null
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono: string | null
          updated_at: string
          zona_id: number | null
        }
        Insert: {
          created_at?: string
          id: string
          nombre_completo?: string | null
          organizacion?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          updated_at?: string
          zona_id?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          nombre_completo?: string | null
          organizacion?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          updated_at?: string
          zona_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      sugerencias: {
        Row: {
          analisis_id: string
          created_at: string
          ficha_id: number | null
          id: string
          lote_id: string
          origen: Database["public"]["Enums"]["origen_sugerencia"]
          texto: string
        }
        Insert: {
          analisis_id: string
          created_at?: string
          ficha_id?: number | null
          id?: string
          lote_id: string
          origen: Database["public"]["Enums"]["origen_sugerencia"]
          texto: string
        }
        Update: {
          analisis_id?: string
          created_at?: string
          ficha_id?: number | null
          id?: string
          lote_id?: string
          origen?: Database["public"]["Enums"]["origen_sugerencia"]
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugerencias_analisis_id_fkey"
            columns: ["analisis_id"]
            isOneToOne: false
            referencedRelation: "analisis_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugerencias_analisis_id_fkey"
            columns: ["analisis_id"]
            isOneToOne: false
            referencedRelation: "bitacora_lotes"
            referencedColumns: ["analisis_id"]
          },
          {
            foreignKeyName: "sugerencias_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugerencias_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "bitacora_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugerencias_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      umbrales_grado: {
        Row: {
          destino_lote: Database["public"]["Enums"]["destino"]
          grado: Database["public"]["Enums"]["grado_lote"]
          max_pct_separar: number
          min_pct_sanos: number
          orden: number
        }
        Insert: {
          destino_lote: Database["public"]["Enums"]["destino"]
          grado: Database["public"]["Enums"]["grado_lote"]
          max_pct_separar: number
          min_pct_sanos: number
          orden: number
        }
        Update: {
          destino_lote?: Database["public"]["Enums"]["destino"]
          grado?: Database["public"]["Enums"]["grado_lote"]
          max_pct_separar?: number
          min_pct_sanos?: number
          orden?: number
        }
        Relationships: []
      }
      zonas: {
        Row: {
          activa: boolean
          estado: string | null
          id: number
          latitud: number | null
          longitud: number | null
          municipio: string | null
          nombre: string
        }
        Insert: {
          activa?: boolean
          estado?: string | null
          id?: number
          latitud?: number | null
          longitud?: number | null
          municipio?: string | null
          nombre: string
        }
        Update: {
          activa?: boolean
          estado?: string | null
          id?: number
          latitud?: number | null
          longitud?: number | null
          municipio?: string | null
          nombre?: string
        }
        Relationships: []
      }
    }
    Views: {
      bitacora_lotes: {
        Row: {
          analisis_id: string | null
          analizado_at: string | null
          conteo_por_clase: Json | null
          created_at: string | null
          destino_buscado: Database["public"]["Enums"]["destino"] | null
          destino_lote: Database["public"]["Enums"]["destino"] | null
          estado: Database["public"]["Enums"]["estado_lote"] | null
          fecha_cosecha: string | null
          fruta_principal: string | null
          frutos_revision: number | null
          frutos_sanos: number | null
          frutos_separar: number | null
          grado: Database["public"]["Enums"]["grado_lote"] | null
          id: string | null
          latitud: number | null
          longitud: number | null
          modelo_version: string | null
          muestra_pequena: boolean | null
          nombre: string | null
          parcela: string | null
          pct_sanos: number | null
          pct_separar: number | null
          total_frutos: number | null
          updated_at: string | null
          usuario_id: string | null
          zona_id: number | null
          zona_nombre: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_fruta_principal_fkey"
            columns: ["fruta_principal"]
            isOneToOne: false
            referencedRelation: "frutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      alertas_comunitarias: {
        Args: never
        Returns: {
          clase_codigo: string
          fruta_id: string
          lotes_afectados: number
          ultimo_reporte: string
          zona_id: number
          zona_nombre: string
        }[]
      }
      cerrar_analisis_lote: {
        Args: { p_lote_id: string; p_modelo_version: string }
        Returns: {
          conteo_por_clase: Json
          created_at: string
          destino_lote: Database["public"]["Enums"]["destino"] | null
          frutos_revision: number
          frutos_sanos: number
          frutos_separar: number
          grado: Database["public"]["Enums"]["grado_lote"] | null
          id: string
          lote_id: string
          modelo_version: string | null
          muestra_pequena: boolean
          pct_sanos: number | null
          pct_separar: number | null
          total_frutos: number
        }
        SetofOptions: {
          from: "*"
          to: "analisis_lote"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      destino:
        | "exportacion"
        | "mercado_nacional"
        | "procesamiento"
        | "separar"
        | "revision_manual"
      estado_lote: "borrador" | "analizando" | "analizado" | "error"
      grado_lote: "A" | "B" | "C" | "rechazo"
      origen_sugerencia: "plantilla" | "llm"
      rol_usuario: "productor" | "acopio" | "tecnico"
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
      destino: [
        "exportacion",
        "mercado_nacional",
        "procesamiento",
        "separar",
        "revision_manual",
      ],
      estado_lote: ["borrador", "analizando", "analizado", "error"],
      grado_lote: ["A", "B", "C", "rechazo"],
      origen_sugerencia: ["plantilla", "llm"],
      rol_usuario: ["productor", "acopio", "tecnico"],
    },
  },
} as const
