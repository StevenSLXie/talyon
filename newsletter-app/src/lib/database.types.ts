export interface Database {
  public: {
    Tables: {
      subscribers: {
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
      campaigns: {
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
      email_logs: {
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
      login_codes: {
        Row: {
          id: string
          email: string
          code: string
          expires_at: string
          used_at: string | null
          created_at: string
          attempts: number
        }
        Insert: {
          id?: string
          email: string
          code: string
          expires_at: string
          used_at?: string | null
          created_at?: string
          attempts?: number
        }
        Update: {
          id?: string
          email?: string
          code?: string
          expires_at?: string
          used_at?: string | null
          created_at?: string
          attempts?: number
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          session_token: string
          expires_at: string
          created_at: string
          last_accessed_at: string
          user_agent: string | null
          ip_address: string | null
        }
        Insert: {
          id?: string
          user_id: string
          session_token: string
          expires_at: string
          created_at?: string
          last_accessed_at?: string
          user_agent?: string | null
          ip_address?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          session_token?: string
          expires_at?: string
          created_at?: string
          last_accessed_at?: string
          user_agent?: string | null
          ip_address?: string | null
        }
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          linkedin_url: string | null
          resume_url: string | null
          experience_level: 'entry' | 'mid' | 'senior' | 'executive' | null
          current_salary: number | null
          expected_salary: number | null
          availability: 'immediate' | '2weeks' | '1month' | '3months' | 'flexible' | null
          job_preferences: {
            industries?: string[]
            locations?: string[]
            remote_work?: boolean
            company_size?: string
            job_types?: string[]
            salary_range?: string
          }
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          linkedin_url?: string | null
          resume_url?: string | null
          experience_level?: 'entry' | 'mid' | 'senior' | 'executive' | null
          current_salary?: number | null
          expected_salary?: number | null
          availability?: 'immediate' | '2weeks' | '1month' | '3months' | 'flexible' | null
          job_preferences?: {
            industries?: string[]
            locations?: string[]
            remote_work?: boolean
            company_size?: string
            job_types?: string[]
            salary_range?: string
          }
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          linkedin_url?: string | null
          resume_url?: string | null
          experience_level?: 'entry' | 'mid' | 'senior' | 'executive' | null
          current_salary?: number | null
          expected_salary?: number | null
          availability?: 'immediate' | '2weeks' | '1month' | '3months' | 'flexible' | null
          job_preferences?: {
            industries?: string[]
            locations?: string[]
            remote_work?: boolean
            company_size?: string
            job_types?: string[]
            salary_range?: string
          }
          created_at?: string
          updated_at?: string
        }
      }
      saved_jobs: {
        Row: {
          id: string
          user_id: string
          job_hash: string
          job_title: string
          company: string
          salary_low: number | null
          salary_high: number | null
          location: string | null
          industry: string | null
          job_type: string | null
          experience_level: string | null
          post_date: string | null
          application_url: string | null
          status: 'saved' | 'applied' | 'interviewed' | 'rejected' | 'offered'
          applied_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          job_hash: string
          job_title: string
          company: string
          salary_low?: number | null
          salary_high?: number | null
          location?: string | null
          industry?: string | null
          job_type?: string | null
          experience_level?: string | null
          post_date?: string | null
          application_url?: string | null
          status?: 'saved' | 'applied' | 'interviewed' | 'rejected' | 'offered'
          applied_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          job_hash?: string
          job_title?: string
          company?: string
          salary_low?: number | null
          salary_high?: number | null
          location?: string | null
          industry?: string | null
          job_type?: string | null
          experience_level?: string | null
          post_date?: string | null
          application_url?: string | null
          status?: 'saved' | 'applied' | 'interviewed' | 'rejected' | 'offered'
          applied_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      job_applications: {
        Row: {
          id: string
          user_id: string
          job_hash: string
          application_url: string | null
          application_date: string
          status: 'applied' | 'under_review' | 'interview_scheduled' | 'interviewed' | 'rejected' | 'offered' | 'accepted' | 'withdrawn'
          notes: string | null
          follow_up_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          job_hash: string
          application_url?: string | null
          application_date?: string
          status?: 'applied' | 'under_review' | 'interview_scheduled' | 'interviewed' | 'rejected' | 'offered' | 'accepted' | 'withdrawn'
          notes?: string | null
          follow_up_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          job_hash?: string
          application_url?: string | null
          application_date?: string
          status?: 'applied' | 'under_review' | 'interview_scheduled' | 'interviewed' | 'rejected' | 'offered' | 'accepted' | 'withdrawn'
          notes?: string | null
          follow_up_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
