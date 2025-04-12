import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase/firebaseConfig';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  isWithinInterval,
  isBefore,
  isValid,
  parseISO
} from 'date-fns';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Bar, BarChart, LineChart, Line
} from 'recharts';
import {
  Calendar, ChevronDown, DollarSign, TrendingUp, TrendingDown, AlertCircle,
  Clock, CreditCard, Download, RefreshCw, Users, Package, Info
} from 'lucide-react';

// Import the PrecisionFinancialUtils from the correct location
import FinancialUtils from '../utils/PrecisionFinancialUtils';

// ================================
// DATE UTILS
// ================================

/**
 * Date and time utilities
 */
const DateUtils = {
  // Ensure a value is a valid date
  ensureValidDate: (date) => {
    if (date instanceof Date && isValid(date)) {
      return date;
    }
    if (date instanceof Timestamp) {
      return date.toDate();
    }
    if (typeof date === 'string') {
      const parsedDate = parseISO(date);
      return isValid(parsedDate) ? parsedDate : null;
    }
    return null;
  },
  
  // Get start and end dates for a specified range
  getDateRange: (range) => {
    const now = new Date();
    
    switch (range) {
      case 'today': {
        return { start: startOfDay(now), end: endOfDay(now) };
      }
      case 'week': {
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      }
      case 'month': {
        return { start: startOfMonth(now), end: endOfMonth(now) };
      }
      case 'year': {
        return { start: startOfYear(now), end: endOfYear(now) };
      }
      case 'custom':
      default: {
        return { start: startOfMonth(now), end: endOfMonth(now) };
      }
    }
  },
  
  // Create a safe interval with validation
  createSafeInterval: (startDate, endDate) => {
    // Ensure both dates are valid
    const validStartDate = DateUtils.ensureValidDate(startDate) || startOfMonth(new Date());
    const validEndDate = DateUtils.ensureValidDate(endDate) || endOfMonth(new Date());
    
    // Swap if start is after end
    return isBefore(validEndDate, validStartDate) 
      ? { start: validEndDate, end: validStartDate }
      : { start: validStartDate, end: validEndDate };
  },
  
  // Format date with fallback
  formatDate: (date, formatStr = 'yyyy-MM-dd', defaultValue = '') => {
    const validDate = DateUtils.ensureValidDate(date);
    if (!validDate) return defaultValue;
    return format(validDate, formatStr);
  }
};

/**
 * Data extraction and processing
 */
const DataUtils = {
  // Extract a valid date from an item with fallbacks
  extractDate: (item) => {
    if (!item) return null;
    
    // Try all possible date fields with fallbacks
    if (item.date instanceof Timestamp) {
      return item.date.toDate();
    }
    
    if (item.date) {
      const dateObj = new Date(item.date);
      if (isValid(dateObj)) {
        return dateObj;
      }
    }
    
    if (item.timestamp instanceof Timestamp) {
      return item.timestamp.toDate();
    }
    
    if (item.createdAt instanceof Timestamp) {
      return item.createdAt.toDate();
    }
    
    if (item.createdAt) {
      const dateObj = new Date(item.createdAt);
      if (isValid(dateObj)) {
        return dateObj;
      }
    }
    
    if (item.orderDate) {
      const dateObj = new Date(item.orderDate);
      if (isValid(dateObj)) {
        return dateObj;
      }
    }
    
    if (item.bookingDate) {
      const dateObj = new Date(item.bookingDate);
      if (isValid(dateObj)) {
        return dateObj;
      }
    }
    
    return null;
  },
  
  // Get booking date or service date (when the service will be delivered)
  getServiceDate: (booking) => {
    if (!booking) return null;
    
    // Try bookingDate field first
    if (booking.bookingDate) {
      const dateObj = new Date(booking.bookingDate);
      if (isValid(dateObj)) {
        return dateObj;
      }
    }
    
    // Try date field in bookingDetails
    if (booking.bookingDetails && booking.bookingDetails.date) {
      const dateObj = new Date(booking.bookingDetails.date);
      if (isValid(dateObj)) {
        return dateObj;
      }
    }
    
    // Try plain date field
    if (booking.date) {
      const dateObj = new Date(booking.date);
      if (isValid(dateObj)) {
        return dateObj;
      }
    }
    
    // Fall back to created date
    return DataUtils.extractDate(booking);
  },
  
  // Filter items by date range safely
  filterByDateRange: (items, startDate, endDate) => {
    if (!items || !Array.isArray(items)) return [];
    
    // Create a safe interval
    const { start, end } = DateUtils.createSafeInterval(startDate, endDate);
    
    return items.filter(item => {
      try {
        const itemDate = DataUtils.extractDate(item);
        if (!itemDate) return false;
        
        return isWithinInterval(itemDate, { start, end });
      } catch (error) {
        console.warn('Date filtering error:', error, item);
        return false;
      }
    });
  },
  
  // Group expenses by period (month, week, etc.)
  groupByPeriod: (items, periodType) => {
    const groupedData = {};
    
    items.forEach(item => {
      const date = DataUtils.extractDate(item);
      if (!date) return;
      
      let periodKey;
      
      switch(periodType) {
        case 'day': {
          periodKey = format(date, 'yyyy-MM-dd');
          break;
        }
        case 'week': {
          // Get ISO week number (1-53)
          const weekOfYear = format(date, 'w');
          const year = format(date, 'yyyy');
          periodKey = `${year}-W${weekOfYear}`;
          break;
        }
        case 'month': {
          periodKey = format(date, 'yyyy-MM');
          break;
        }
        case 'year': {
          periodKey = format(date, 'yyyy');
          break;
        }
        default: {
          periodKey = format(date, 'yyyy-MM');
          break;
        }
      }
      
      if (!groupedData[periodKey]) {
        groupedData[periodKey] = {
          period: periodKey,
          displayName: periodType === 'day' ? format(date, 'MMM dd') : 
                      periodType === 'week' ? `Week ${format(date, 'w')}` :
                      periodType === 'month' ? format(date, 'MMM yyyy') :
                      periodType === 'year' ? format(date, 'yyyy') : format(date, 'MMM yyyy'),
          income: 0,
          expenses: 0,
          profit: 0,
          count: 0,
          items: []
        };
      }
      
      // Use PrecisionFinancialUtils for consistent money handling
      const itemAmount = item.amount ? FinancialUtils.normalizeAmount(item.amount).toNumber() : 0;
      
      // Handle income vs expense logic
      if (item.type === 'income' || (item.paymentStatus === 'paid' && item.payment_details?.amountPaid)) {
        const paidAmount = item.payment_details?.amountPaid 
          ? FinancialUtils.normalizeAmount(item.payment_details.amountPaid).toNumber() 
          : itemAmount;
        groupedData[periodKey].income += paidAmount;
      } else {
        groupedData[periodKey].expenses += itemAmount;
      }
      
      groupedData[periodKey].count++;
      groupedData[periodKey].items.push(item);
    });
    
    // Calculate profit for each period
    Object.values(groupedData).forEach(period => {
      period.profit = period.income - period.expenses;
    });
    
    // Convert to array and sort by period
    return Object.values(groupedData).sort((a, b) => a.period.localeCompare(b.period));
  }
};

// ================================
// REUSABLE COMPONENTS
// ================================

/**
 * Metric card component for KPIs
 */
const MetricCard = ({ 
  title, 
  value, 
  icon: Icon, 
  change, 
  changeLabel, 
  color = 'blue',
  isLoading = false
}) => {
  const colorMap = {
    green: {
      bg: 'bg-green-100',
      text: 'text-green-600',
      increase: 'text-green-500',
      decrease: 'text-red-500'
    },
    red: {
      bg: 'bg-red-100',
      text: 'text-red-600',
      increase: 'text-red-500',
      decrease: 'text-green-500'
    },
    blue: {
      bg: 'bg-blue-100',
      text: 'text-blue-600',
      increase: 'text-green-500',
      decrease: 'text-red-500'
    },
    yellow: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-600',
      increase: 'text-yellow-500',
      decrease: 'text-yellow-500'
    }
  };
  
  const colors = colorMap[color] || colorMap.blue;
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {isLoading ? (
            <div className="h-6 w-24 bg-gray-300 animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          )}
        </div>
        <div className={`${colors.bg} rounded-full p-3`}>
          <Icon className={`h-6 w-6 ${colors.text}`} />
        </div>
      </div>
      {change !== undefined && (
        <div className="mt-4 flex items-center">
          {isLoading ? (
            <div className="h-4 w-16 bg-gray-300 animate-pulse rounded"></div>
          ) : (
            <>
              <span className={`flex items-center text-sm ${change.isIncrease ? colors.increase : colors.decrease}`}>
                {change.isIncrease ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {typeof change === 'object' ? change.displayValue : change}
              </span>
              <span className="text-xs text-gray-500 ml-2">{changeLabel || 'vs previous period'}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Empty state component for no data scenarios
 */
const EmptyState = ({ icon: Icon, message, actionButton = null }) => (
  <div className="py-12 flex flex-col items-center text-center text-gray-500">
    <Icon className="h-12 w-12 text-gray-300 mb-3" />
    <p className="mb-4">{message}</p>
    {actionButton}
  </div>
);

/**
 * Loading spinner component
 */
const LoadingSpinner = ({ message = "Loading financial data..." }) => (
  <div className="py-12 flex justify-center">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      <p className="mt-3 text-gray-600">{message}</p>
    </div>
  </div>
);

/**
 * Chart Card wrapper component
 */
const ChartCard = ({ title, children, isLoading = false, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm p-6 border border-gray-200 ${className}`}>
    <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
    {isLoading ? (
      <div className="h-64 w-full bg-gray-200 animate-pulse rounded"></div>
    ) : (
      children
    )}
  </div>
);

/**
 * Financial Validation Component for data integrity
 */
const FinancialValidationPanel = ({ dataIssues = [] }) => {
  if (!dataIssues || dataIssues.length === 0) {
    return (
      <div className="mt-2 p-3 bg-green-50 rounded border border-green-200 text-green-700">
        <div className="flex items-center">
          <Info className="h-5 w-5 mr-2" />
          <span className="text-sm">All financial data appears consistent.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="p-3 bg-yellow-50 rounded border border-yellow-200 text-yellow-700">
        <div className="flex items-center mb-2">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span className="font-medium">Potential Data Inconsistencies</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="py-1 px-2 text-left">ID</th>
                <th className="py-1 px-2 text-left">Type</th>
                <th className="py-1 px-2 text-left">Client</th>
                <th className="py-1 px-2 text-left">Issue</th>
              </tr>
            </thead>
            <tbody>
              {dataIssues.map((issue, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-yellow-100 bg-opacity-40' : ''}>
                  <td className="py-1 px-2">{issue.id}</td>
                  <td className="py-1 px-2 capitalize">{issue.type}</td>
                  <td className="py-1 px-2">{issue.client}</td>
                  <td className="py-1 px-2">{issue.issue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs">
          These inconsistencies may affect financial calculations. Consider reviewing these records.
        </div>
      </div>
    </div>
  );
};

/**
 * Financial Reconciliation Summary
 */
const ReconciliationSummary = ({ metrics, formatCurrency }) => {
  // Only show if we have data to display
  if (!metrics) return null;
  
  return (
    <div className="mt-6 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Financial Reconciliation</h2>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-blue-800">Booking Revenue</p>
          <p className="text-xl font-bold">{formatCurrency(metrics.bookingIncome)}</p>
        </div>
        
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm font-medium text-green-800">Order Revenue</p>
          <p className="text-xl font-bold">{formatCurrency(metrics.orderIncome)}</p>
        </div>
        
        <div className="p-4 bg-purple-50 rounded-lg">
          <p className="text-sm font-medium text-purple-800">Other Revenue</p>
          <p className="text-xl font-bold">{formatCurrency(metrics.otherIncome || 0)}</p>
        </div>
        
        <div className="p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm font-medium text-yellow-800">Total Outstanding</p>
          <p className="text-xl font-bold">{formatCurrency(metrics.outstandingPayments)}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Income Sources</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <table className="min-w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1">Bookings</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(metrics.bookingIncome)}</td>
                  <td className="py-1 text-right text-gray-500">
                    {metrics.totalIncome > 0 
                      ? `${Math.round((metrics.bookingIncome / metrics.totalIncome) * 100)}%` 
                      : '0%'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1">Orders</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(metrics.orderIncome)}</td>
                  <td className="py-1 text-right text-gray-500">
                    {metrics.totalIncome > 0 
                      ? `${Math.round((metrics.orderIncome / metrics.totalIncome) * 100)}%` 
                      : '0%'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1">Other Payments</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(metrics.otherIncome || 0)}</td>
                  <td className="py-1 text-right text-gray-500">
                    {metrics.totalIncome > 0 && metrics.otherIncome
                      ? `${Math.round((metrics.otherIncome / metrics.totalIncome) * 100)}%` 
                      : '0%'}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-1 font-medium">Total Income</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(metrics.totalIncome)}</td>
                  <td className="py-1 text-right text-gray-500">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Outstanding Payments</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <table className="min-w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1">Bookings</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(metrics.bookingOutstanding || 0)}</td>
                  <td className="py-1 text-right text-gray-500">
                    {metrics.outstandingPayments > 0 && metrics.bookingOutstanding
                      ? `${Math.round((metrics.bookingOutstanding / metrics.outstandingPayments) * 100)}%` 
                      : '0%'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1">Orders</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(metrics.orderOutstanding || 0)}</td>
                  <td className="py-1 text-right text-gray-500">
                    {metrics.outstandingPayments > 0 && metrics.orderOutstanding
                      ? `${Math.round((metrics.orderOutstanding / metrics.outstandingPayments) * 100)}%` 
                      : '0%'}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-1 font-medium">Total Outstanding</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(metrics.outstandingPayments)}</td>
                  <td className="py-1 text-right text-gray-500">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ================================
// MAIN COMPONENT
// ================================

const FinancialDashboard = () => {
  // ================================
  // STATE MANAGEMENT
  // ================================
  
  // Data state
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter state
  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // UI state
  const [activePeriod, setActivePeriod] = useState('month');
  const [activeChart, setActiveChart] = useState('incomeExpense');
  
  // Debugging state
  const [debugMode, setDebugMode] = useState(false);
  
  // Comparison data (previous period)
  const [previousPeriodData, setPreviousPeriodData] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    outstandingPayments: 0
  });
  
  // ================================
  // FILTERING & DATE HANDLING
  // ================================
  
  // Handle date range change
  const handleDateRangeChange = useCallback((range) => {
    // Set new date range
    const { start, end } = DateUtils.getDateRange(range);
    setStartDate(start);
    setEndDate(end);
    setDateRange(range);
    setShowFilterMenu(false);
    
    // Calculate previous period for comparison
    const periodLength = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);
    const previousEnd = new Date(start.getTime() - 1);
    
    // Filter data for previous period
    const prevOrders = DataUtils.filterByDateRange(orders, previousStart, previousEnd);
    const prevExpenses = DataUtils.filterByDateRange(expenses, previousStart, previousEnd);
    const prevBookings = DataUtils.filterByDateRange(bookings, previousStart, previousEnd);
    
    // Calculate with precision using FinancialUtils
    const prevMetrics = FinancialUtils.calculateCompanyMargin(
      prevOrders, prevBookings, prevExpenses, [], 
      { startDate: previousStart, endDate: previousEnd }
    );
    
    // Update previous period data - using number values for compatibility
    setPreviousPeriodData({
      totalIncome: prevMetrics.revenueNumber,
      totalExpenses: prevMetrics.costsNumber,
      netProfit: prevMetrics.netProfitNumber,
      outstandingPayments: prevMetrics.outstandingNumber
    });
  }, [orders, expenses, bookings]);
  
  // Refresh data handler
  const refreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);
  
  // Toggle debug mode
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => !prev);
  }, []);
  
  // ================================
  // DATA FETCHING
  // ================================
  
  // Fetch data from Firestore
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    const fetchData = async () => {
      try {
        // Fetch orders
        const ordersRef = collection(db, 'orders');
        const ordersQuery = query(ordersRef, orderBy('createdAt', 'desc'));
        
        // Fetch expenses
        const expensesRef = collection(db, 'expenses');
        const expensesQuery = query(expensesRef, orderBy('date', 'desc'));
        
        // Fetch bookings
        const bookingsRef = collection(db, 'bookings');
        const bookingsQuery = query(bookingsRef, orderBy('createdAt', 'desc'));
        
        // Set up listeners with proper error handling
        const unsubscribeOrders = onSnapshot(
          ordersQuery, 
          (snapshot) => {
            const ordersData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data
              };
            });
            
            console.log(`Loaded ${ordersData.length} orders`);
            setOrders(ordersData);
          },
          (err) => {
            console.error('Error fetching orders:', err);
            setError(`Failed to load orders: ${err.message}`);
          }
        );
        
        const unsubscribeExpenses = onSnapshot(
          expensesQuery,
          (snapshot) => {
            const expensesData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data
              };
            });
            
            console.log(`Loaded ${expensesData.length} expenses`);
            setExpenses(expensesData);
          },
          (err) => {
            console.error('Error fetching expenses:', err);
            setError(`Failed to load expenses: ${err.message}`);
          }
        );
        
        const unsubscribeBookings = onSnapshot(
          bookingsQuery,
          (snapshot) => {
            const bookingsData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data
              };
            });
            
            console.log(`Loaded ${bookingsData.length} bookings`);
            setBookings(bookingsData);
          },
          (err) => {
            console.error('Error fetching bookings:', err);
            setError(`Failed to load bookings: ${err.message}`);
          }
        );
        
        // Try to fetch from payments collection if it exists
        let unsubscribePayments = () => {};
        try {
          const paymentsRef = collection(db, 'payments');
          const paymentsQuery = query(paymentsRef, orderBy('date', 'desc'));
          
          unsubscribePayments = onSnapshot(
            paymentsQuery,
            (snapshot) => {
              const paymentsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  ...data
                };
              });
              
              console.log(`Loaded ${paymentsData.length} payments`);
              setPayments(paymentsData);
            },
            // Silently handle error if payments collection doesn't exist
            () => { setPayments([]) }
          );
        } catch (err) {
          console.log('Payments collection may not exist yet');
          setPayments([]);
        }
        
        setIsLoading(false);
        
        // Return cleanup function for all listeners
        return () => {
          unsubscribeOrders();
          unsubscribeExpenses();
          unsubscribeBookings();
          unsubscribePayments();
        };
      } catch (error) {
        console.error('Error fetching financial data:', error);
        setError(`Failed to load financial data: ${error.message}`);
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [refreshKey]);
  
  // Set initial date range
  useEffect(() => {
    handleDateRangeChange('month');
  }, [handleDateRangeChange]);
  
  // ================================
  // DATA PROCESSING & CALCULATIONS
  // ================================
  
  // Calculate financial metrics using PrecisionFinancialUtils
  const financialMetrics = useMemo(() => {
    if (isLoading) return {
      totalIncome: 0,
      totalExpenses: 0,
      outstandingPayments: 0,
      netProfit: 0,
      dataIssues: []
    };
    
    console.log("Calculating financial metrics with PrecisionFinancialUtils...");
    
    // Filter data by selected date range with safe date handling
    const filteredOrders = DataUtils.filterByDateRange(orders, startDate, endDate);
    const filteredExpenses = DataUtils.filterByDateRange(expenses, startDate, endDate);
    const filteredBookings = DataUtils.filterByDateRange(bookings, startDate, endDate);
    const filteredPayments = DataUtils.filterByDateRange(payments, startDate, endDate);
    
    console.log(`Filtered data - Orders: ${filteredOrders.length}, Bookings: ${filteredBookings.length}, Expenses: ${filteredExpenses.length}, Payments: ${filteredPayments.length}`);
    
    // Calculate company margin with high precision using PrecisionFinancialUtils
    const companyMargin = FinancialUtils.calculateCompanyMargin(
      filteredOrders,
      filteredBookings,
      filteredExpenses,
      filteredPayments,
      { startDate, endDate }
    );
    
    // Data validation - check for potential issues
    const dataIssues = [];
    
    // Check bookings with missing payment info
    const bookingsWithNoPayments = filteredBookings.filter(booking => {
      const paymentData = FinancialUtils.extractBookingPayments(booking);
      return paymentData.totalAgreedPriceNumber > 0 && 
             paymentData.totalPaidNumber === 0 && 
             paymentData.totalOutstandingNumber === 0;
    });
    
    bookingsWithNoPayments.forEach(booking => {
      dataIssues.push({
        id: booking.id,
        type: 'booking',
        client: booking.clientName || booking.clientDetails?.name || 'Unknown',
        issue: 'Has agreed price but missing payment structure'
      });
    });
    
    // Check orders with payment status inconsistencies
    const ordersWithStatusIssues = filteredOrders.filter(order => {
      const paymentData = FinancialUtils.extractOrderPayments(order);
      return (paymentData.amountPaidNumber === 0 && order.paymentStatus === 'paid') ||
             (paymentData.amountPaidNumber > 0 && order.paymentStatus === 'unpaid');
    });
    
    ordersWithStatusIssues.forEach(order => {
      dataIssues.push({
        id: order.id,
        type: 'order',
        client: order.fullName || order.name || 'Unknown',
        issue: 'Payment status inconsistent with amount paid'
      });
    });
    
    // Check expenses with missing categories
    const expensesWithNoCategories = filteredExpenses.filter(expense => {
      return !expense.category && FinancialUtils.normalizeAmount(expense.amount).toNumber() > 0;
    });
    
    expensesWithNoCategories.forEach(expense => {
      dataIssues.push({
        id: expense.id,
        type: 'expense',
        client: 'N/A',
        issue: 'Expense has amount but no category'
      });
    });
    
    // ================================
    // CATEGORY BREAKDOWNS
    // ================================
    
    // Calculate income by category
    const incomeByCategoryMap = {};
    
    // Process bookings by type
    filteredBookings.forEach(booking => {
      const paymentData = FinancialUtils.extractBookingPayments(booking);
      const categoryName = booking.tourType || 'Standard Tour';
      
      if (!incomeByCategoryMap[categoryName]) {
        incomeByCategoryMap[categoryName] = 0;
      }
      incomeByCategoryMap[categoryName] += paymentData.totalPaidNumber;
    });
    
    // Process orders by item category
    filteredOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const categoryName = item.category || 'Other';
          const itemPrice = FinancialUtils.normalizeAmount(item.price).toNumber();
          const itemQuantity = parseInt(item.quantity) || 1;
          const itemTotal = itemPrice * itemQuantity;
          
          if (!incomeByCategoryMap[categoryName]) {
            incomeByCategoryMap[categoryName] = 0;
          }
          incomeByCategoryMap[categoryName] += itemTotal;
        });
      } else {
        // Order without items - use order total
        const paymentData = FinancialUtils.extractOrderPayments(order);
        const categoryName = 'General Orders';
        
        if (!incomeByCategoryMap[categoryName]) {
          incomeByCategoryMap[categoryName] = 0;
        }
        incomeByCategoryMap[categoryName] += paymentData.amountPaidNumber;
      }
    });
    
    // Convert income by category to array for charts
    const incomeByCategory = Object.keys(incomeByCategoryMap).map(name => ({
      name,
      value: incomeByCategoryMap[name]
    }));
    
    // Calculate expenses by category
    const expensesByCategory = filteredExpenses.reduce((categories, expense) => {
      if (expense.paymentStatus !== 'paid') return categories;
      
      const categoryName = expense.category || 'Uncategorized';
      const amount = FinancialUtils.normalizeAmount(expense.amount).toNumber();
      
      const existingCategory = categories.find(cat => cat.name === categoryName);
      if (existingCategory) {
        existingCategory.value += amount;
      } else {
        categories.push({ name: categoryName, value: amount });
      }
      return categories;
    }, []);
    
    // ================================
    // TIME SERIES DATA
    // ================================
    
    // Prepare data for time-trend charts
    const trendsByMonth = {};
    
    // Process booking income by month
    filteredBookings.forEach(booking => {
      const date = DataUtils.extractDate(booking);
      if (!date) return;
      
      const monthKey = format(date, 'MMM yyyy');
      if (!trendsByMonth[monthKey]) {
        trendsByMonth[monthKey] = { income: 0, expenses: 0 };
      }
      
      const paymentData = FinancialUtils.extractBookingPayments(booking);
      trendsByMonth[monthKey].income += paymentData.totalPaidNumber;
    });
    
    // Process order income by month
    filteredOrders.forEach(order => {
      const date = DataUtils.extractDate(order);
      if (!date) return;
      
      const monthKey = format(date, 'MMM yyyy');
      if (!trendsByMonth[monthKey]) {
        trendsByMonth[monthKey] = { income: 0, expenses: 0 };
      }
      
      const paymentData = FinancialUtils.extractOrderPayments(order);
      trendsByMonth[monthKey].income += paymentData.amountPaidNumber;
    });
    
    // Process expenses by month
    filteredExpenses.forEach(expense => {
      if (expense.paymentStatus !== 'paid') return;
      
      const date = DataUtils.extractDate(expense);
      if (!date) return;
      
      const monthKey = format(date, 'MMM yyyy');
      if (!trendsByMonth[monthKey]) {
        trendsByMonth[monthKey] = { income: 0, expenses: 0 };
      }
      
      trendsByMonth[monthKey].expenses += FinancialUtils.normalizeAmount(expense.amount).toNumber();
    });
    
    // Convert to array format for charts
    const trendData = Object.keys(trendsByMonth).map(month => ({
      name: month,
      income: trendsByMonth[month].income,
      expenses: trendsByMonth[month].expenses,
      profit: trendsByMonth[month].income - trendsByMonth[month].expenses
    })).sort((a, b) => {
      // Sort by month (assuming format is "MMM yyyy")
      const dateA = new Date(a.name);
      const dateB = new Date(b.name);
      return dateA - dateB;
    });
    
    // ================================
    // UPCOMING PAYMENTS
    // ================================
    
    // Calculate upcoming payments due within the next 7 days
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    // Get bookings with upcoming service dates
    const upcomingBookings = bookings
      .filter(booking => {
        // Check if booking has future service date within the next week
        const serviceDate = DataUtils.getServiceDate(booking);
        if (!serviceDate) return false;
        
        // Check if it's between today and next week
        return isWithinInterval(serviceDate, { start: today, end: nextWeek });
      })
      .filter(booking => {
        // Only include bookings with outstanding payments
        const paymentData = FinancialUtils.extractBookingPayments(booking);
        return paymentData.totalOutstandingNumber > 0;
      })
      .map(booking => {
        const paymentData = FinancialUtils.extractBookingPayments(booking);
        const serviceDate = DataUtils.getServiceDate(booking);
        
        return {
          id: booking.id,
          clientName: booking.clientName || booking.clientDetails?.name || 'Unknown Client',
          date: serviceDate,
          amount: paymentData.totalOutstandingNumber,
          type: 'booking',
          details: booking.bookingDetails
        };
      });
    
    // ================================
    // CALCULATE PERCENTAGE CHANGES
    // ================================
    
    // Calculate percentage changes for KPIs with high precision
    const incomeChange = FinancialUtils.calculatePercentChange(
      companyMargin.revenueNumber, 
      previousPeriodData.totalIncome
    );
    
    const expenseChange = FinancialUtils.calculatePercentChange(
      companyMargin.costsNumber, 
      previousPeriodData.totalExpenses
    );
    
    const profitChange = FinancialUtils.calculatePercentChange(
      companyMargin.netProfitNumber, 
      previousPeriodData.netProfit
    );
    
    const outstandingChange = FinancialUtils.calculatePercentChange(
      companyMargin.outstandingNumber,
      previousPeriodData.outstandingPayments
    );
    
    // Debug info for payment tracking
    const bookingPaymentsInfo = [];
    filteredBookings.forEach(booking => {
      const paymentData = FinancialUtils.extractBookingPayments(booking);
      bookingPaymentsInfo.push({
        id: booking.id,
        clientName: booking.clientName || booking.clientDetails?.name || 'Unknown',
        totalAgreedPrice: paymentData.totalAgreedPriceNumber,
        totalPaid: paymentData.totalPaidNumber,
        totalOutstanding: paymentData.totalOutstandingNumber,
        receivedPayments: paymentData.receivedPayments,
        pendingPayments: paymentData.pendingPayments
      });
    });
    
    const orderPaymentsInfo = [];
    filteredOrders.forEach(order => {
      const paymentData = FinancialUtils.extractOrderPayments(order);
      orderPaymentsInfo.push({
        id: order.id,
        totalAmount: paymentData.totalAmountNumber,
        amountPaid: paymentData.amountPaidNumber,
        amountDue: paymentData.amountDueNumber,
        status: order.paymentStatus
      });
    });
    
    // Return all calculated metrics with both precision Decimal objects and number values
    return {
      // Primary KPIs
      totalIncome: companyMargin.revenueNumber,
      totalExpenses: companyMargin.costsNumber,
      outstandingPayments: companyMargin.outstandingNumber,
      netProfit: companyMargin.netProfitNumber,
      profitMargin: companyMargin.profitMarginNumber,
      
      // Income sources
      bookingIncome: companyMargin.bookingRevenueNumber,
      orderIncome: companyMargin.orderRevenueNumber,
      otherIncome: companyMargin.otherRevenueNumber,
      
      // Outstanding details
      bookingOutstanding: companyMargin.bookingOutstandingNumber,
      orderOutstanding: companyMargin.orderOutstandingNumber,
      
      // Averages
      averageDailyIncome: companyMargin.dailyAvgRevenueNumber,
      averageDailyExpense: companyMargin.dailyAvgExpenseNumber,
      
      // Category breakdowns
      incomeByCategory,
      expensesByCategory,
      
      // Time series data
      incomeTrend: trendData,
      
      // Raw filtered data
      filteredOrders,
      filteredExpenses,
      filteredBookings,
      
      // Upcoming payments
      upcomingPayments: upcomingBookings,
      
      // Percentage changes
      changes: {
        income: incomeChange,
        expenses: expenseChange,
        profit: profitChange,
        outstanding: outstandingChange
      },
      
      // Formatted display values
      displayValues: companyMargin.displayValues,
      
      // Validation issues found
      dataIssues,
      
      // Debug information
      debug: {
        bookingPayments: bookingPaymentsInfo,
        orderPayments: orderPaymentsInfo
      }
    };
  }, [orders, expenses, bookings, payments, startDate, endDate, dateRange, isLoading, previousPeriodData]);
  
  // ================================
  // CHART CONFIGURATIONS
  // ================================
  
  // Color palette for charts
  const CHART_COLORS = {
    income: '#4f46e5', // Indigo
    incomeLight: '#c7d2fe', // Light indigo
    expenses: '#ef4444', // Red
    expensesLight: '#fee2e2', // Light red
    profit: '#10b981', // Green
    profitLight: '#d1fae5', // Light green
    neutral: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']
  };
  
  // Format currency with FinancialUtils
  const formatCurrency = useCallback((amount) => {
    return FinancialUtils.formatCurrency(amount);
  }, []);
  
  // ================================
  // DEBUG TOOLS
  // ================================
  
  const DebugPanel = () => {
    if (!debugMode) return null;
    
    return (
      <div className="mt-6 p-4 bg-gray-100 rounded-lg border border-gray-300">
        <h3 className="font-bold text-lg mb-2">Financial Data Validation</h3>
        
        <FinancialValidationPanel 
          dataIssues={financialMetrics.dataIssues}
          formatCurrency={formatCurrency}
        />
        
        <div className="mb-4 mt-6">
          <h4 className="font-semibold">Income Sources:</h4>
          <ul className="list-disc pl-5">
            <li>Booking Income: {formatCurrency(financialMetrics.bookingIncome)}</li>
            <li>Order Income: {formatCurrency(financialMetrics.orderIncome)}</li>
            <li>Other Payments: {formatCurrency(financialMetrics.otherIncome || 0)}</li>
          </ul>
        </div>
        
        <div className="mb-4">
          <h4 className="font-semibold">Booking Payments:</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="py-1 px-2 border text-left">ID</th>
                  <th className="py-1 px-2 border text-left">Client</th>
                  <th className="py-1 px-2 border text-right">Agreed Price</th>
                  <th className="py-1 px-2 border text-right">Paid</th>
                  <th className="py-1 px-2 border text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {financialMetrics.debug.bookingPayments.map((booking, index) => (
                  <tr key={booking.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-1 px-2 border">{booking.id}</td>
                    <td className="py-1 px-2 border">{booking.clientName}</td>
                    <td className="py-1 px-2 border text-right">{formatCurrency(booking.totalAgreedPrice)}</td>
                    <td className="py-1 px-2 border text-right">{formatCurrency(booking.totalPaid)}</td>
                    <td className="py-1 px-2 border text-right">{formatCurrency(booking.totalOutstanding)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan="3" className="py-1 px-2 border text-right">Total:</td>
                  <td className="py-1 px-2 border text-right">{formatCurrency(financialMetrics.bookingIncome)}</td>
                  <td className="py-1 px-2 border text-right">{formatCurrency(financialMetrics.debug.bookingPayments.reduce((sum, b) => sum + b.totalOutstanding, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold">Order Payments:</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="py-1 px-2 border text-left">ID</th>
                  <th className="py-1 px-2 border text-right">Total</th>
                  <th className="py-1 px-2 border text-right">Paid</th>
                  <th className="py-1 px-2 border text-right">Due</th>
                  <th className="py-1 px-2 border text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {financialMetrics.debug.orderPayments.map((order, index) => (
                  <tr key={order.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-1 px-2 border">{order.id}</td>
                    <td className="py-1 px-2 border text-right">{formatCurrency(order.totalAmount)}</td>
                    <td className="py-1 px-2 border text-right">{formatCurrency(order.amountPaid)}</td>
                    <td className="py-1 px-2 border text-right">{formatCurrency(order.amountDue)}</td>
                    <td className="py-1 px-2 border text-center">{order.status}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan="2" className="py-1 px-2 border text-right">Total:</td>
                  <td className="py-1 px-2 border text-right">{formatCurrency(financialMetrics.orderIncome)}</td>
                  <td className="py-1 px-2 border text-right">{formatCurrency(financialMetrics.debug.orderPayments.reduce((sum, o) => sum + o.amountDue, 0))}</td>
                  <td className="py-1 px-2 border"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-4">
          <h4 className="font-semibold">Financial Metrics Calculation:</h4>
          <pre className="bg-gray-800 text-white p-3 rounded text-xs overflow-x-auto mt-2">
            {JSON.stringify({
              totalIncome: formatCurrency(financialMetrics.totalIncome),
              totalExpenses: formatCurrency(financialMetrics.totalExpenses),
              netProfit: formatCurrency(financialMetrics.netProfit),
              profitMargin: `${financialMetrics.profitMargin.toFixed(2)}%`,
              totalOutstanding: formatCurrency(financialMetrics.outstandingPayments)
            }, null, 2)}
          </pre>
        </div>
      </div>
    );
  };
  
  // ================================
  // COMPONENT RENDERING
  // ================================
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header & Filters */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Dashboard</h1>
            <p className="text-gray-600 mt-1">High-precision financial tracking</p>
          </div>
          
          <div className="flex items-center space-x-2 mt-4 sm:mt-0">
            <div className="relative">
              <button 
                className="flex items-center bg-white border border-gray-300 rounded-lg py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
              >
                <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                {dateRange === 'today' ? 'Today' : 
                 dateRange === 'week' ? 'Last 7 Days' : 
                 dateRange === 'month' ? 'This Month' : 
                 dateRange === 'year' ? 'This Year' : 'Custom Range'}
                <ChevronDown className="h-4 w-4 ml-2 text-gray-500" />
              </button>
              
              {showFilterMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="p-2">
                    {['today', 'week', 'month', 'year'].map((range) => (
                      <button
                        key={range}
                        className={`w-full text-left px-4 py-2 text-sm rounded-md ${dateRange === range ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        onClick={() => handleDateRangeChange(range)}
                      >
                        {range === 'today' ? 'Today' : 
                         range === 'week' ? 'Last 7 Days' : 
                         range === 'month' ? 'This Month' : 
                         range === 'year' ? 'This Year' : range}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 my-2"></div>
                    <div className="px-4 py-2">
                      <p className="text-xs font-medium text-gray-500 mb-2">Custom Range</p>
                      <div className="flex flex-col space-y-2">
                        <div>
                          <label className="text-xs text-gray-500">Start Date</label>
                          <input 
                            type="date" 
                            value={DateUtils.formatDate(startDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                              const date = new Date(e.target.value);
                              if (isValid(date)) {
                                setStartDate(startOfDay(date));
                              }
                            }}
                            className="w-full border border-gray-300 rounded-md text-sm p-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">End Date</label>
                          <input 
                            type="date" 
                            value={DateUtils.formatDate(endDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                              const date = new Date(e.target.value);
                              if (isValid(date)) {
                                setEndDate(endOfDay(date));
                              }
                            }}
                            className="w-full border border-gray-300 rounded-md text-sm p-1"
                          />
                        </div>
                        <button
                          className="w-full bg-blue-600 text-white text-sm rounded-md py-1 mt-2"
                          onClick={() => {
                            setDateRange('custom');
                            setShowFilterMenu(false);
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              className="inline-flex items-center bg-white border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={refreshData}
              title="Refresh Data"
            >
              <RefreshCw className="h-4 w-4 text-gray-500" />
            </button>
            
            <button 
              className="inline-flex items-center bg-white border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Export Data"
              onClick={() => {
                alert('Export functionality will be implemented soon');
              }}
            >
              <Download className="h-4 w-4 text-gray-500" />
            </button>
            
            {/* Debug mode toggle */}
            <button
              className={`inline-flex items-center py-2 px-3 text-sm font-medium rounded-lg ${
                debugMode ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-700 border border-gray-300'
              }`}
              onClick={toggleDebugMode}
              title="Toggle Debug Mode"
            >
              {debugMode ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        </div>
        
        {/* Error display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
          </div>
        )}
        
        {/* Loading state */}
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Income */}
              <MetricCard
                title="Total Income"
                value={financialMetrics.displayValues?.revenue || formatCurrency(financialMetrics.totalIncome)}
                icon={DollarSign}
                change={financialMetrics.changes.income}
                color="green"
                isLoading={isLoading}
              />
              
              {/* Total Expenses */}
              <MetricCard
                title="Total Expenses"
                value={financialMetrics.displayValues?.costs || formatCurrency(financialMetrics.totalExpenses)}
                icon={TrendingDown}
                change={financialMetrics.changes.expenses}
                color="red"
                isLoading={isLoading}
              />
              
              {/* Outstanding Payments */}
              <MetricCard
                title="Outstanding Payments"
                value={financialMetrics.displayValues?.outstanding || formatCurrency(financialMetrics.outstandingPayments)}
                icon={Clock}
                change={financialMetrics.changes.outstanding}
                changeLabel={`${financialMetrics.upcomingPayments.length} payments due soon`}
                color="yellow"
                isLoading={isLoading}
              />
              
              {/* Net Profit */}
              <MetricCard
                title="Net Profit"
                value={financialMetrics.displayValues?.netProfit || formatCurrency(financialMetrics.netProfit)}
                icon={CreditCard}
                change={financialMetrics.changes.profit}
                changeLabel={financialMetrics.displayValues?.profitMargin || `${financialMetrics.profitMargin.toFixed(1)}%`}
                color={financialMetrics.netProfit >= 0 ? "green" : "red"}
                isLoading={isLoading}
              />
            </div>
            
            {/* Reconciliation Summary */}
            <ReconciliationSummary 
              metrics={financialMetrics} 
              formatCurrency={formatCurrency} 
            />
            
            {/* Debug Panel */}
            <DebugPanel />
            
            {/* Time period selector for charts */}
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Financial Trends</h2>
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  {['day', 'week', 'month', 'year'].map((period) => (
                    <button
                      key={period}
                      className={`px-3 py-1 text-sm ${
                        activePeriod === period ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
                      }`}
                      onClick={() => setActivePeriod(period)}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Chart type selector */}
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  className={`mr-6 py-2 text-sm font-medium border-b-2 ${
                    activeChart === 'incomeExpense' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveChart('incomeExpense')}
                >
                  Income vs Expenses
                </button>
                <button
                  className={`mr-6 py-2 text-sm font-medium border-b-2 ${
                    activeChart === 'profit' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveChart('profit')}
                >
                  Profit
                </button>
                <button
                  className={`mr-6 py-2 text-sm font-medium border-b-2 ${
                    activeChart === 'comparison' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveChart('comparison')}
                >
                  Comparison
                </button>
              </div>
            
              {/* Chart display area */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  {activeChart === 'incomeExpense' && (
                    <AreaChart
                      data={financialMetrics.incomeTrend}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatCurrency(value).replace('€', '')}
                      />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(value), value === 'income' ? 'Income' : 'Expenses']}
                        labelFormatter={(label) => `Period: ${label}`}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="income" 
                        name="Income" 
                        stroke={CHART_COLORS.income}
                        fill={CHART_COLORS.incomeLight}
                        activeDot={{ r: 6 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="expenses" 
                        name="Expenses" 
                        stroke={CHART_COLORS.expenses}
                        fill={CHART_COLORS.expensesLight}
                      />
                    </AreaChart>
                  )}
                  
                  {activeChart === 'profit' && (
                    <BarChart
                      data={financialMetrics.incomeTrend}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatCurrency(value).replace('€', '')}
                      />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(value), 'Profit']}
                        labelFormatter={(label) => `Period: ${label}`}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="profit" 
                        name="Profit" 
                        fill={CHART_COLORS.profit}
                        barSize={30}
                      >
                        {financialMetrics.incomeTrend.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.profit >= 0 ? CHART_COLORS.profit : CHART_COLORS.expenses} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                  
                  {activeChart === 'comparison' && (
                    <LineChart
                      data={financialMetrics.incomeTrend}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatCurrency(value).replace('€', '')}
                      />
                      <Tooltip 
                        formatter={(value, name) => [formatCurrency(value), name === 'income' ? 'Income' : name === 'expenses' ? 'Expenses' : 'Profit']}
                        labelFormatter={(label) => `Period: ${label}`}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="income" 
                        name="Income" 
                        stroke={CHART_COLORS.income}
                        strokeWidth={2}
                        dot={{ strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="expenses" 
                        name="Expenses" 
                        stroke={CHART_COLORS.expenses}
                        strokeWidth={2}
                        dot={{ strokeWidth: 2, r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="profit" 
                        name="Profit" 
                        stroke={CHART_COLORS.profit}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
              
              {/* Averages and projections */}
              <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center">
                  <DollarSign className="h-5 w-5 text-green-500 mr-1" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Avg. Daily Income</p>
                    <p className="text-lg font-semibold">{formatCurrency(financialMetrics.averageDailyIncome)}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <TrendingDown className="h-5 w-5 text-red-500 mr-1" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Avg. Daily Expenses</p>
                    <p className="text-lg font-semibold">{formatCurrency(financialMetrics.averageDailyExpense)}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <CreditCard className="h-5 w-5 text-blue-500 mr-1" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Profit Margin</p>
                    <p className="text-lg font-semibold">{financialMetrics.displayValues?.profitMargin || `${financialMetrics.profitMargin.toFixed(1)}%`}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Income and Expense Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income by Category */}
              <ChartCard title="Income by Category">
                {financialMetrics.incomeByCategory.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={financialMetrics.incomeByCategory}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {financialMetrics.incomeByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS.neutral[index % CHART_COLORS.neutral.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState 
                    icon={Package} 
                    message="No income data available for this period" 
                  />
                )}
              </ChartCard>
              
              {/* Expenses by Category */}
              <ChartCard title="Expenses by Category">
                {financialMetrics.expensesByCategory.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={financialMetrics.expensesByCategory}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {financialMetrics.expensesByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS.neutral[index % CHART_COLORS.neutral.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState 
                    icon={TrendingDown} 
                    message="No expense data available for this period" 
                  />
                )}
              </ChartCard>
            </div>
            
            {/* Upcoming Payments */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Upcoming Payments</h2>
                <span className="text-sm text-blue-600 font-medium cursor-pointer hover:underline">View All</span>
              </div>
              
              {financialMetrics.upcomingPayments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {financialMetrics.upcomingPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-gray-100">
                                <Users className="h-5 w-5 text-gray-500" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{payment.clientName}</div>
                                <div className="text-sm text-gray-500">
                                  {payment.details?.boatName || payment.type}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {DateUtils.formatDate(payment.date, 'MMM dd, yyyy')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 font-medium">{formatCurrency(payment.amount)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Due
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button className="text-blue-600 hover:text-blue-800 mr-3">Mark as Paid</button>
                            <button className="text-gray-600 hover:text-gray-800">Send Reminder</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState 
                  icon={Clock} 
                  message="No upcoming payments due" 
                  actionButton={
                    <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded text-sm">
                      Add Payment
                    </button>
                  }
                />
              )}
            </div>
            
            {/* Recent Transactions */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Recent Transactions</h2>
                <span className="text-sm text-blue-600 font-medium cursor-pointer hover:underline">View All</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Get recent orders + expenses + bookings with payments, sorted by date */}
                    {[
                      ...financialMetrics.filteredOrders.map(order => ({
                        ...order,
                        transactionType: 'order'
                      })),
                      ...financialMetrics.filteredExpenses.map(expense => ({
                        ...expense,
                        transactionType: 'expense'
                      })),
                      ...financialMetrics.filteredBookings
                        .filter(booking => {
                          const paymentData = FinancialUtils.extractBookingPayments(booking);
                          return paymentData.receivedPayments.length > 0;
                        })
                        .map(booking => {
                          const paymentData = FinancialUtils.extractBookingPayments(booking);
                          return {
                            ...booking,
                            transactionType: 'booking',
                            receivedPayments: paymentData.receivedPayments
                          };
                        })
                    ]
                      .sort((a, b) => {
                        const dateA = DataUtils.extractDate(a) || new Date(0);
                        const dateB = DataUtils.extractDate(b) || new Date(0);
                        return dateB - dateA;
                      })
                      .slice(0, 5)
                      .map((transaction, idx) => {
                        const isExpense = transaction.transactionType === 'expense';
                        const isBooking = transaction.transactionType === 'booking';
                        const date = DataUtils.extractDate(transaction) || new Date();
                        
                        let amount = 0;
                        let status = transaction.paymentStatus || 'unknown';
                        
                        if (isExpense) {
                          amount = -FinancialUtils.normalizeAmount(transaction.amount).toNumber();
                        } else if (isBooking) {
                          // Sum all received payments
                          amount = transaction.receivedPayments.reduce(
                            (sum, payment) => sum + payment.amountNumber, 
                            0
                          );
                          status = 'paid';
                        } else {
                          // Order
                          const paymentData = FinancialUtils.extractOrderPayments(transaction);
                          amount = paymentData.amountPaidNumber;
                        }
                        
                        return (
                          <tr key={`${transaction.id}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full ${isExpense ? 'bg-red-100' : 'bg-green-100'}`}>
                                  {isExpense ? (
                                    <TrendingDown className={`h-5 w-5 text-red-500`} />
                                  ) : (
                                    <DollarSign className={`h-5 w-5 text-green-500`} />
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {isExpense ? 
                                      transaction.description || transaction.category || 'Expense' : 
                                      isBooking ?
                                        `Booking: ${transaction.bookingDetails?.boatName || 'Tour'}` :
                                        transaction.fullName || 'Order'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {isExpense ? 
                                      transaction.category || 'Expense' : 
                                      isBooking ?
                                        transaction.clientName || transaction.clientDetails?.name || 'Client booking' :
                                        (transaction.items && Array.isArray(transaction.items)) 
                                          ? transaction.items.map(i => i.name).join(', ') 
                                          : 'Products'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{DateUtils.formatDate(date, 'MMM dd, yyyy')}</div>
                              <div className="text-sm text-gray-500">{DateUtils.formatDate(date, 'HH:mm')}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm font-medium ${amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(amount)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                isExpense ? 'bg-red-100 text-red-800' : 
                                isBooking ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {isExpense ? 'Expense' : isBooking ? 'Booking' : 'Order'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                status === 'paid' ? 'bg-green-100 text-green-800' : 
                                status === 'partially_paid' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {status === 'paid' ? 'Paid' : 
                                 status === 'partially_paid' ? 'Partial' :
                                 status || 'Unknown'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                
                {financialMetrics.filteredOrders.length === 0 && 
                 financialMetrics.filteredExpenses.length === 0 && 
                 financialMetrics.filteredBookings.length === 0 && (
                  <EmptyState 
                    icon={DollarSign} 
                    message="No transactions to display" 
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialDashboard;