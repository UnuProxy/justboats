import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Ship, TrendingUp, DollarSign, Calendar, Download } from 'lucide-react';
import { calculateBookingProfit, findMatchingExpense, formatCurrency } from '../utils/profitCalculations';
import * as XLSX from 'xlsx';

const MAX_CHART_ITEMS = 12;

const BoatPerformanceAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [timeRange, setTimeRange] = useState('year'); // year, 6months, 3months, month
  const [sortBy, setSortBy] = useState('revenue'); // revenue, bookings, profit, margin

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (bookings.length > 0) {
      calculatePerformance();
    }
  }, [bookings, expenses, timeRange, sortBy]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all required data
      // eslint-disable-next-line no-undef
      const [bookingsSnap, expensesSnap] = await Promise.all([
        getDocs(collection(db, 'bookings')),
        getDocs(collection(db, 'expenses'))
      ]);

      const bookingsData = bookingsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const expensesData = expensesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setBookings(bookingsData);
      setExpenses(expensesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateCutoff = () => {
    const now = new Date();
    const cutoffs = {
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      '3months': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
      '6months': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
      year: new Date(now.getFullYear(), 0, 1)
    };
    return cutoffs[timeRange];
  };

  const calculatePerformance = () => {
    const cutoffDate = getDateCutoff();

    // Filter bookings by time range
    const filteredBookings = bookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDetails?.date);
      return bookingDate >= cutoffDate && booking.status !== 'cancelled';
    });

    // Group by boat
    const boatMap = {};

    filteredBookings.forEach(booking => {
      const boatName = booking.bookingDetails?.boatName || 'Unknown';

      if (!boatMap[boatName]) {
        boatMap[boatName] = {
          boatName,
          bookings: [],
          totalBookings: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalExpenses: 0,
          bookingsWithExpenses: 0
        };
      }

      const expense = findMatchingExpense(booking, expenses);
      const profit = calculateBookingProfit(booking, expense);

      boatMap[boatName].bookings.push({ booking, profit });
      boatMap[boatName].totalBookings++;
      boatMap[boatName].totalRevenue += profit.revenue;
      boatMap[boatName].totalProfit += profit.netProfit;
      boatMap[boatName].totalExpenses += profit.expenses;

      if (profit.hasExpenseData) {
        boatMap[boatName].bookingsWithExpenses++;
      }
    });

    // Calculate metrics
    const performance = Object.values(boatMap).map(boat => {
      const avgBookingValue = boat.totalBookings > 0 ? boat.totalRevenue / boat.totalBookings : 0;
      const profitMargin = boat.totalRevenue > 0 ? (boat.totalProfit / boat.totalRevenue) * 100 : 0;

      return {
        ...boat,
        avgBookingValue,
        profitMargin
      };
    });

    // Sort based on selected criteria
    performance.sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return b.totalRevenue - a.totalRevenue;
        case 'bookings':
          return b.totalBookings - a.totalBookings;
        case 'profit':
          return b.totalProfit - a.totalProfit;
        case 'margin':
          return b.profitMargin - a.profitMargin;
        default:
          return 0;
      }
    });

    setPerformanceData(performance);
  };

  const exportToExcel = () => {
    const exportData = performanceData.map(boat => ({
      'Boat Name': boat.boatName,
      'Total Bookings': boat.totalBookings,
      'Total Revenue (€)': boat.totalRevenue.toFixed(2),
      'Total Expenses (€)': boat.totalExpenses.toFixed(2),
      'Total Profit (€)': boat.totalProfit.toFixed(2),
      'Profit Margin (%)': boat.profitMargin.toFixed(2),
      'Avg Booking Value (€)': boat.avgBookingValue.toFixed(2),
      'Bookings with Expense Data': boat.bookingsWithExpenses
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Boat Performance');

    XLSX.writeFile(
      workbook,
      `boat-performance-${timeRange}-${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const totalStats = performanceData.reduce(
    (acc, boat) => ({
      totalBookings: acc.totalBookings + boat.totalBookings,
      totalRevenue: acc.totalRevenue + boat.totalRevenue,
      totalProfit: acc.totalProfit + boat.totalProfit,
      totalExpenses: acc.totalExpenses + boat.totalExpenses
    }),
    { totalBookings: 0, totalRevenue: 0, totalProfit: 0, totalExpenses: 0 }
  );

  const avgProfitMargin = totalStats.totalRevenue > 0
    ? (totalStats.totalProfit / totalStats.totalRevenue) * 100
    : 0;

  const {
    revenueChartData,
    profitChartData,
    bookingsChartData,
    marginChartData
  } = useMemo(() => {
    const buildDataset = (metric, includeOtherBucket = false) => {
      if (!performanceData.length) return [];
      const sorted = [...performanceData].sort(
        (a, b) => (b[metric] ?? 0) - (a[metric] ?? 0)
      );
      const top = sorted.slice(0, MAX_CHART_ITEMS);

      if (includeOtherBucket && sorted.length > MAX_CHART_ITEMS) {
        const otherValue = sorted
          .slice(MAX_CHART_ITEMS)
          .reduce((sum, item) => sum + (item[metric] ?? 0), 0);
        if (otherValue > 0) {
          top.push({
            boatName: 'Other',
            [metric]: otherValue
          });
        }
      }

      return top;
    };

    return {
      revenueChartData: buildDataset('totalRevenue'),
      profitChartData: buildDataset('totalProfit'),
      bookingsChartData: buildDataset('totalBookings', true),
      marginChartData: buildDataset('profitMargin')
    };
  }, [performanceData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading performance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Ship className="w-8 h-8 text-blue-600" />
            Boat Performance Analytics
          </h1>
          <p className="text-gray-600 mt-2">
            Compare revenue, bookings, and profitability across your fleet
          </p>
        </div>

        {/* Filters and Export */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center flex-wrap">
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Time Range:</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="month">This Month</option>
                <option value="3months">Last 3 Months</option>
                <option value="6months">Last 6 Months</option>
                <option value="year">This Year</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Sort By:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="revenue">Revenue</option>
                <option value="bookings">Bookings</option>
                <option value="profit">Profit</option>
                <option value="margin">Profit Margin</option>
              </select>
            </div>
          </div>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Export to Excel
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{totalStats.totalBookings}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalStats.totalRevenue)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Profit</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalStats.totalProfit)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Profit Margin</p>
                <p className="text-2xl font-bold text-gray-900">{avgProfitMargin.toFixed(1)}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue by Boat */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Boat</h3>
            {revenueChartData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="boatName"
                    angle={-30}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="totalRevenue" fill="#3b82f6" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500">No revenue data for this range.</p>
            )}
          </div>

          {/* Profit by Boat */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profit by Boat</h3>
            {profitChartData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={profitChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="boatName"
                    angle={-30}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="totalProfit" fill="#10b981" name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500">No profit data for this range.</p>
            )}
          </div>

          {/* Booking Count by Boat */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bookings by Boat</h3>
            {bookingsChartData.length ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={bookingsChartData}
                    layout="vertical"
                    margin={{ left: 80, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="boatName"
                      width={120}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip formatter={(value) => [`${value} bookings`, 'Bookings']} />
                    <Bar dataKey="totalBookings" fill="#f59e0b" name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-gray-500">
                  Showing top boats by bookings (others grouped into &quot;Other&quot;).
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">No booking data for this range.</p>
            )}
          </div>

          {/* Profit Margin Comparison */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profit Margin (%)</h3>
            {marginChartData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={marginChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="boatName"
                    angle={-30}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                  <Bar dataKey="profitMargin" fill="#8b5cf6" name="Profit Margin" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500">No margin data for this range.</p>
            )}
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Detailed Performance Data</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Boat Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bookings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expenses
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Booking
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {performanceData.map((boat, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {boat.boatName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {boat.totalBookings}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(boat.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(boat.totalExpenses)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span
                        className={
                          boat.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {formatCurrency(boat.totalProfit)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span
                        className={
                          boat.profitMargin >= 20
                            ? 'text-green-600'
                            : boat.profitMargin >= 10
                            ? 'text-blue-600'
                            : 'text-orange-600'
                        }
                      >
                        {boat.profitMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(boat.avgBookingValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoatPerformanceAnalytics;
