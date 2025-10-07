export interface DatabaseTest {
  public: {
    Tables: {
      subscribers_test: {
        Row: {
          id: string
          email: string
          name: string | null
          status: 'pending' | 'active' | 'unsubscribed'
          preferences: {
            industries?: string[]
            salary_range?: string
            locations?: string[]
            job_types?: string[]
            experience_levels?: string[]
            frequency?: 'daily' | 'weekly'
            max_jobs_per_email?: number
          }
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          status?: 'pending' | 'active' | 'unsubscribed'
          preferences?: {
            industries?: string[]
            salary_range?: string
            locations?: string[]
            job_types?: string[]
            experience_levels?: string[]
            frequency?: 'daily' | 'weekly'
            max_jobs_per_email?: number
          }
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          status?: 'pending' | 'active' | 'unsubscribed'
          preferences?: {
            industries?: string[]
            salary_range?: string
            locations?: string[]
            job_types?: string[]
            experience_levels?: string[]
            frequency?: 'daily' | 'weekly'
            max_jobs_per_email?: number
          }
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      campaigns_test: {
        Row: {
          id: string
          date: string
          subject: string
          jobs_count: number
          sent_count: number
          status: 'draft' | 'sending' | 'sent' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          subject: string
          jobs_count?: number
          sent_count?: number
          status?: 'draft' | 'sending' | 'sent' | 'failed'
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          subject?: string
          jobs_count?: number
          sent_count?: number
          status?: 'draft' | 'sending' | 'sent' | 'failed'
          created_at?: string
        }
      }
      email_logs_test: {
        Row: {
          id: string
          campaign_id: string | null
          subscriber_id: string | null
          job_id: string | null
          sent_at: string | null
          opened_at: string | null
          clicked_at: string | null
          status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced'
        }
        Insert: {
          id?: string
          campaign_id?: string | null
          subscriber_id?: string | null
          job_id?: string | null
          sent_at?: string | null
          opened_at?: string | null
          clicked_at?: string | null
          status?: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced'
        }
        Update: {
          id?: string
          campaign_id?: string | null
          subscriber_id?: string | null
          job_id?: string | null
          sent_at?: string | null
          opened_at?: string | null
          clicked_at?: string | null
          status?: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced'
        }
      }
    }
  }
}

