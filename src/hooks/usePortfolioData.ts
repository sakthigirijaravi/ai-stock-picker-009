import { useState, useEffect, useCallback } from 'react';
import { portfolioService, PortfolioConstituent, QuarterSummary } from '../lib/portfolioService';

interface UsePortfolioDataReturn {
  portfolioData: PortfolioConstituent[];
  quarters: QuarterSummary[];
  loading: boolean;
  error: string | null;
  selectedQuarter: string | null;
  setSelectedQuarter: (quarter: string) => void;
  refreshData: () => Promise<void>;
  addConstituent: (constituent: Omit<PortfolioConstituent, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateConstituent: (id: number, updates: Partial<PortfolioConstituent>) => Promise<void>;
  deleteConstituent: (id: number) => Promise<void>;
}

export const usePortfolioData = (initialQuarter?: string): UsePortfolioDataReturn => {
  const [portfolioData, setPortfolioData] = useState<PortfolioConstituent[]>([]);
  const [quarters, setQuarters] = useState<QuarterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(initialQuarter || null);

  // Load quarters summary
  const loadQuarters = useCallback(async () => {
    try {
      const quartersData = await portfolioService.getQuartersSummary();
      setQuarters(quartersData);
      
      // Set default quarter if none selected
      if (!selectedQuarter && quartersData.length > 0) {
        setSelectedQuarter(quartersData[0].quarter);
      }
    } catch (err) {
      console.error('Error loading quarters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quarters');
    }
  }, [selectedQuarter]);

  // Load portfolio data for selected quarter
  const loadPortfolioData = useCallback(async () => {
    if (!selectedQuarter) return;

    try {
      setLoading(true);
      setError(null);
      
      const data = await portfolioService.getPortfolioByQuarter(selectedQuarter);
      setPortfolioData(data);
    } catch (err) {
      console.error('Error loading portfolio data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  }, [selectedQuarter]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await Promise.all([loadQuarters(), loadPortfolioData()]);
  }, [loadQuarters, loadPortfolioData]);

  // CRUD operations
  const addConstituent = useCallback(async (constituent: Omit<PortfolioConstituent, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await portfolioService.addConstituent(constituent);
      // Data will be updated via real-time subscription
    } catch (err) {
      console.error('Error adding constituent:', err);
      setError(err instanceof Error ? err.message : 'Failed to add constituent');
      throw err;
    }
  }, []);

  const updateConstituent = useCallback(async (id: number, updates: Partial<PortfolioConstituent>) => {
    try {
      await portfolioService.updateConstituent(id, updates);
      // Data will be updated via real-time subscription
    } catch (err) {
      console.error('Error updating constituent:', err);
      setError(err instanceof Error ? err.message : 'Failed to update constituent');
      throw err;
    }
  }, []);

  const deleteConstituent = useCallback(async (id: number) => {
    try {
      await portfolioService.deleteConstituent(id);
      // Data will be updated via real-time subscription
    } catch (err) {
      console.error('Error deleting constituent:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete constituent');
      throw err;
    }
  }, []);

  // Handle quarter selection change
  const handleQuarterChange = useCallback((quarter: string) => {
    setSelectedQuarter(quarter);
  }, []);

  // Initial data load
  useEffect(() => {
    loadQuarters();
  }, [loadQuarters]);

  // Load portfolio data when quarter changes
  useEffect(() => {
    if (selectedQuarter) {
      loadPortfolioData();
    }
  }, [selectedQuarter, loadPortfolioData]);

  // Set up real-time subscription
  useEffect(() => {
    if (!selectedQuarter) return;

    const unsubscribe = portfolioService.subscribeToUpdates(
      (updatedData) => {
        console.log('Received real-time update:', updatedData);
        setPortfolioData(updatedData);
        setError(null);
      },
      selectedQuarter
    );

    return unsubscribe;
  }, [selectedQuarter]);

  return {
    portfolioData,
    quarters,
    loading,
    error,
    selectedQuarter,
    setSelectedQuarter: handleQuarterChange,
    refreshData,
    addConstituent,
    updateConstituent,
    deleteConstituent
  };
};