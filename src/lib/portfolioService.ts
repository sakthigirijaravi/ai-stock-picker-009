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

  /**
   * Get all portfolio constituents for a specific quarter
   */
  async getPortfolioByQuarter(quarter: string): Promise<PortfolioConstituent[]> {
    try {
      const { data, error } = await supabase
        .from('portfolio_constituents')
        .select('*')
        .eq('quarter', quarter)
        .order('weight', { ascending: false });

      if (error) {
        console.error('Error fetching portfolio by quarter:', error);
        throw error;
      }

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
        return [];
      }

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
      const { data, error } = await supabase
        .from('portfolio_constituents')
        .select('quarter, weight, quarterly_returns')
        .order('quarter', { ascending: false });

      if (error) {
        console.error('Error fetching quarters summary:', error);
        throw error;
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

      return Array.from(quarterMap.entries()).map(([quarter, summary]) => ({
        quarter,
        total_stocks: summary.total_stocks,
        avg_returns: summary.total_returns / summary.total_stocks,
        total_weight: summary.total_weight
      }));
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
    this.subscribers.add(callback);

    if (!this.realtimeChannel) {
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
        });
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
      
      // If no more subscribers, close the channel
      if (this.subscribers.size === 0 && this.realtimeChannel) {
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