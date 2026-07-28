export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          auth_id: string | null
          wallet: string | null
          username: string | null
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          twitter: string | null
          total_bets: number
          wins: number
          losses: number
          total_wagered: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']>
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      bets: {
        Row: {
          id: string
          on_chain_pubkey: string
          creator_wallet: string
          opponent_wallet: string | null
          winner_wallet: string | null
          bet_id: number
          amount_lamports: number
          description: string
          expiry: string
          status: 'open' | 'active' | 'resolved' | 'cancelled' | 'expired'
          tx_signature: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['bets']['Row']>
        Update: Partial<Database['public']['Tables']['bets']['Row']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          bet_id: string | null
          read: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['notifications']['Row']>
        Update: Partial<Database['public']['Tables']['notifications']['Row']>
      }
    }
    Views: {
      leaderboard: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          wallet: string | null
          wins: number
          losses: number
          total_bets: number
          total_wagered: number
          win_rate: number
        }
      }
    }
  }
}
