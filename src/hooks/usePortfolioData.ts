import { useState, useEffect, useCallback } from 'react';
import { portfolioService, PortfolioConstituent, QuarterSummary } from '../lib/portfolioService';
import { useAuth } from '../contexts/AuthContext';

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
  isDataStale: boolean;
}

export const usePortfolioData = (initialQuarter?: string): UsePortfolioDataReturn => {
  const [portfolioData, setPortfolioData] = useState<PortfolioConstituent[]>([]);
  const [quarters, setQuarters] = useState<QuarterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(initialQuarter || null);
  const [isDataStale, setIsDataStale] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  
  const { user, isInitialized } = useAuth();

  // Data freshness check (5 minutes)
  const DATA_FRESHNESS_THRESHOLD = 5 * 60 * 1000;

  // Load quarters summary
  const loadQuarters = useCallback(async () => {
    try {
      console.log('Loading quarters...');
      const quartersData = await portfolioService.getQuartersSummary();
      setQuarters(quartersData);
      
      // Set default quarter if none selected
      if (!selectedQuarter && quartersData.length > 0) {
        setSelectedQuarter(quartersData[0].quarter);
      }
      
      setLastFetchTime(Date.now());
      setIsDataStale(false);
    } catch (err) {
      console.error('Error loading quarters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quarters');
      setIsDataStale(true);
    }
  }, [selectedQuarter]);

  // Load portfolio data for selected quarter
  const loadPortfolioData = useCallback(async () => {
    if (!selectedQuarter) return;

    try {
      setLoading(true);
      setError(null);
      console.log('Loading portfolio data for quarter:', selectedQuarter);
      
      const data = await portfolioService.getPortfolioByQuarter(selectedQuarter);
      console.log('Loaded portfolio data:', data.length, 'items');
      setPortfolioData(data);
      
      setLastFetchTime(Date.now());
      setIsDataStale(false);
    } catch (err) {
      console.error('Error loading portfolio data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data');
      setIsDataStale(true);
    } finally {
      setLoading(false);
    }
  }, [selectedQuarter]);

  // Check if data is stale and needs refresh
  const checkDataFreshness = useCallback(() => {
    const now = Date.now();
    const isStale = (now - lastFetchTime) > DATA_FRESHNESS_THRESHOLD;
    setIsDataStale(isStale);
    return isStale;
  }, [lastFetchTime]);
  // Refresh all data
  const refreshData = useCallback(async () => {
    console.log('Refreshing all data...');
    await Promise.all([loadQuarters(), loadPortfolioData()]);
  }, [loadQuarters, loadPortfolioData]);

  // Force refresh when user authentication changes
  const forceRefresh = useCallback(async () => {
    if (user && isInitialized) {
      console.log('User authenticated, forcing data refresh...');
      setLoading(true);
      setError(null);
      await refreshData();
    }
  }, [user, isInitialized, refreshData]);
  // CRUD operations
  const addConstituent = useCallback(async (constituent: Omit<PortfolioConstituent, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await portfolioService.addConstituent(constituent);
      // Data will be updated via real-time subscription
      setIsDataStale(false);
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
      setIsDataStale(false);
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
      setIsDataStale(false);
    } catch (err) {
      console.error('Error deleting constituent:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete constituent');
      throw err;
    }
  }, []);

  // Handle quarter selection change
  const handleQuarterChange = useCallback((quarter: string) => {
    setSelectedQuarter(quarter);
    setIsDataStale(true); // Mark as stale to trigger refresh
  }, []);

  // Initial data load when auth is initialized
  useEffect(() => {
    if (isInitialized) {
      console.log('Auth initialized, loading initial data...');
      loadQuarters();
    }
  }, [isInitialized, loadQuarters]);

  // Force refresh when user logs in
  useEffect(() => {
    if (user && isInitialized && portfolioData.length === 0) {
      console.log('User logged in, forcing data refresh...');
      forceRefresh();
    }
  }, [user, isInitialized, portfolioData.length, forceRefresh]);

  // Load portfolio data when quarter changes
  useEffect(() => {
    if (selectedQuarter && isInitialized) {
      loadPortfolioData();
    }
  }, [selectedQuarter, isInitialized, loadPortfolioData]);

  // Periodic data freshness check
  useEffect(() => {
    const interval = setInterval(() => {
      if (checkDataFreshness() && user) {
        console.log('Data is stale, refreshing...');
        refreshData();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [checkDataFreshness, refreshData, user]);
  // Set up real-time subscription
  useEffect(() => {
    if (!selectedQuarter || !user) return;

    console.log('Setting up real-time subscription for quarter:', selectedQuarter);

    const unsubscribe = portfolioService.subscribeToUpdates(
      (updatedData) => {
        console.log('Received real-time update:', updatedData);
        setPortfolioData(updatedData);
        setError(null);
        setIsDataStale(false);
        setLastFetchTime(Date.now());
      },
      selectedQuarter
    );

    return unsubscribe;
  }, [selectedQuarter, user]);

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
    deleteConstituent,
    isDataStale
  };
};