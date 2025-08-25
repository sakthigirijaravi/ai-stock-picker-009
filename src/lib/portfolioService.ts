import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PortfolioConstituent {
  id: number;
  quarter: string;
  stock_name: string;
  stock_code: string;
  company_logo_url: string | null;
  weight: number;
  quarterly_returns: number;
  created_at: string;
  updated_at: string;
}

export interface QuarterSummary {
  quarter: string;
  total_stocks: number;
  avg_returns: number;
  total_weight: number;
}

class PortfolioService {
  private realtimeChannel: RealtimeChannel | null = null;
  private subscribers: Set<(data: PortfolioConstituent[]) => void> = new Set();
  private connectionRetries = 0;
  private maxRetries = 3;
  private retryDelay = 1000;

  /**
   * Get all portfolio constituents for a specific quarter
   */
  async getPortfolioByQuarter(quarter: string): Promise<PortfolioConstituent[]> {
    try {
      console.log('Fetching portfolio data for quarter:', quarter);
      
      // Ensure we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('No active session found');
        // Still try to fetch data as it might be publicly accessible
      }
      
      const { data, error } = await supabase
        .from('portfolio_constituents')
        .select('*')
        .eq('quarter', quarter)
        .order('weight', { ascending: false });

      if (error) {
        console.error('Error fetching portfolio by quarter:', error);
        
        // Retry logic for connection issues
        if (this.connectionRetries < this.maxRetries && (error.message.includes('connection') || error.message.includes('network'))) {
          this.connectionRetries++;
          console.log(`Retrying connection (${this.connectionRetries}/${this.maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.connectionRetries));
          return this.getPortfolioByQuarter(quarter);
        }
        
        throw error;
      }

      this.connectionRetries = 0; // Reset on success
      console.log('Successfully fetched portfolio data:', data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error('Error in getPortfolioByQuarter:', error);
      throw error;
    }
  }

  /**
   * Get the latest quarter's portfolio data
   */
  async getLatestPortfolio(): Promise<PortfolioConstituent[]> {
    try {
      console.log('Fetching latest portfolio...');
      
      // First, get the latest quarter
      const { data: latestQuarter, error: quarterError } = await supabase
        .from('portfolio_constituents')
        .select('quarter')
        .order('created_at', { ascending: false })
        .limit(1);

      if (quarterError) {
        console.error('Error fetching latest quarter:', quarterError);
        throw quarterError;
      }

      if (!latestQuarter || latestQuarter.length === 0) {
        console.log('No quarters found');
        return [];
      }

      console.log('Latest quarter:', latestQuarter[0].quarter);
      // Then get all constituents for that quarter
      return this.getPortfolioByQuarter(latestQuarter[0].quarter);
    } catch (error) {
      console.error('Error in getLatestPortfolio:', error);
      throw error;
    }
  }

  /**
   * Get all available quarters with summary data
   */
  async getQuartersSummary(): Promise<QuarterSummary[]> {
    try {
      console.log('Fetching quarters summary...');
      
      const { data, error } = await supabase
        .from('portfolio_constituents')
        .select('quarter, weight, quarterly_returns')
        .order('quarter', { ascending: false });

      if (error) {
        console.error('Error fetching quarters summary:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('No portfolio data found');
        return [];
      }

      // Group by quarter and calculate summaries
      const quarterMap = new Map<string, {
        total_stocks: number;
        total_returns: number;
        total_weight: number;
      }>();

      data?.forEach(item => {
        const existing = quarterMap.get(item.quarter) || {
          total_stocks: 0,
          total_returns: 0,
          total_weight: 0
        };

        quarterMap.set(item.quarter, {
          total_stocks: existing.total_stocks + 1,
          total_returns: existing.total_returns + item.quarterly_returns,
          total_weight: existing.total_weight + item.weight
        });
      });

      const summaries = Array.from(quarterMap.entries()).map(([quarter, summary]) => ({
        quarter,
        total_stocks: summary.total_stocks,
        avg_returns: summary.total_returns / summary.total_stocks,
        total_weight: summary.total_weight
      }));
      
      console.log('Quarters summary:', summaries.length, 'quarters found');
      return summaries;
    } catch (error) {
      console.error('Error in getQuartersSummary:', error);
      throw error;
    }
  }

  /**
   * Add a new portfolio constituent
   */
  async addConstituent(constituent: Omit<PortfolioConstituent, 'id' | 'created_at' | 'updated_at'>): Promise<PortfolioConstituent> {
    try {
      const { data, error } = await supabase
        .from('portfolio_constituents')
        .insert([constituent])
        .select()
        .single();

      if (error) {
        console.error('Error adding constituent:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in addConstituent:', error);
      throw error;
    }
  }

  /**
   * Update an existing portfolio constituent
   */
  async updateConstituent(id: number, updates: Partial<PortfolioConstituent>): Promise<PortfolioConstituent> {
    try {
      const { data, error } = await supabase
        .from('portfolio_constituents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating constituent:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in updateConstituent:', error);
      throw error;
    }
  }

  /**
   * Delete a portfolio constituent
   */
  async deleteConstituent(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('portfolio_constituents')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting constituent:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in deleteConstituent:', error);
      throw error;
    }
  }

  /**
   * Bulk insert portfolio constituents for a quarter
   */
  async bulkInsertConstituents(constituents: Omit<PortfolioConstituent, 'id' | 'created_at' | 'updated_at'>[]): Promise<PortfolioConstituent[]> {
    try {
      const { data, error } = await supabase
        .from('portfolio_constituents')
        .insert(constituents)
        .select();

      if (error) {
        console.error('Error bulk inserting constituents:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in bulkInsertConstituents:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time updates for portfolio constituents
   */
  subscribeToUpdates(callback: (data: PortfolioConstituent[]) => void, quarter?: string): () => void {
    console.log('Setting up real-time subscription for quarter:', quarter);
    this.subscribers.add(callback);

    if (!this.realtimeChannel) {
      console.log('Creating new real-time channel...');
      this.realtimeChannel = supabase
        .channel('portfolio_constituents_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'portfolio_constituents'
          },
          async (payload) => {
            console.log('Real-time update received:', payload);
            
            // Fetch updated data and notify all subscribers
            try {
              let updatedData: PortfolioConstituent[];
              
              if (quarter) {
                updatedData = await this.getPortfolioByQuarter(quarter);
              } else {
                updatedData = await this.getLatestPortfolio();
              }

              console.log('Broadcasting update to', this.subscribers.size, 'subscribers');
              // Notify all subscribers
              this.subscribers.forEach(subscriber => {
                try {
                  subscriber(updatedData);
                } catch (error) {
                  console.error('Error in subscriber callback:', error);
                }
              });
            } catch (error) {
              console.error('Error fetching updated data:', error);
            }
          }
        )
        .subscribe((status) => {
          console.log('Real-time subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to real-time updates');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Real-time subscription error');
            // Attempt to reconnect
            setTimeout(() => {
              console.log('Attempting to reconnect real-time subscription...');
              this.realtimeChannel?.unsubscribe();
              this.realtimeChannel = null;
              // Re-subscribe will happen on next call
            }, 5000);
          }
        });
    } else {
      console.log('Using existing real-time channel');
    }

    // Return unsubscribe function
    return () => {
      console.log('Unsubscribing from real-time updates');
      this.subscribers.delete(callback);
      
      // If no more subscribers, close the channel
      if (this.subscribers.size === 0 && this.realtimeChannel) {
        console.log('Closing real-time channel (no more subscribers)');
        this.realtimeChannel.unsubscribe();
        this.realtimeChannel = null;
      }
    };
  }

  /**
   * Get historical performance data across all quarters
   */
  async getHistoricalPerformance(): Promise<{
    quarter: string;
    avg_returns: number;
    total_stocks: number;
    period: string;
  }[]> {
    try {
      const quartersSummary = await this.getQuartersSummary();
      
      // Map quarters to readable periods
      const quarterToPeriod = (quarter: string): string => {
        const [q, year] = quarter.split(' ');
        const quarterMap: { [key: string]: string } = {
          'Q1': 'Jan - Mar',
          'Q2': 'Apr - Jun',
          'Q3': 'Jul - Sep',
          'Q4': 'Oct - Dec'
        };
        return `${quarterMap[q]} ${year}`;
      };

      return quartersSummary.map(summary => ({
        quarter: summary.quarter,
        avg_returns: summary.avg_returns,
        total_stocks: summary.total_stocks,
        period: quarterToPeriod(summary.quarter)
      }));
    } catch (error) {
      console.error('Error in getHistoricalPerformance:', error);
      throw error;
    }
  }

  /**
   * Search portfolio constituents by stock code or name
   */
  async searchConstituents(searchTerm: string, quarter?: string): Promise<PortfolioConstituent[]> {
    try {
      let query = supabase
        .from('portfolio_constituents')
        .select('*')
        .or(`stock_code.ilike.%${searchTerm}%,stock_name.ilike.%${searchTerm}%`);

      if (quarter) {
        query = query.eq('quarter', quarter);
      }

      const { data, error } = await query.order('weight', { ascending: false });

      if (error) {
        console.error('Error searching constituents:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in searchConstituents:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const portfolioService = new PortfolioService();