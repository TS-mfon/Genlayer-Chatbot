export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      knowledge_entries: {
        Row: {
          id: string;
          title: string;
          content: string;
          category: string | null;
          tags: string[] | null;
          embedding: number[] | null;
          source_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          category?: string | null;
          tags?: string[] | null;
          embedding?: number[] | null;
          source_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          content?: string;
          category?: string | null;
          tags?: string[] | null;
          embedding?: number[] | null;
          source_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_sessions: {
        Row: { id: string; created_at: string };
        Insert: { id?: string; created_at?: string };
        Update: { created_at?: string };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: "user" | "assistant";
          content: string;
          sources: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: "user" | "assistant";
          content: string;
          sources?: Json;
          created_at?: string;
        };
        Update: {
          role?: "user" | "assistant";
          content?: string;
          sources?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "chat_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_knowledge_entries: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
          query_text?: string;
        };
        Returns: Array<{
          id: string;
          title: string;
          content: string;
          category: string | null;
          similarity: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
