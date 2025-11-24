import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Users, DollarSign, Award, Download, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/profitCalculations';
import * as XLSX from 'xlsx';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const PartnerPerformanceReports = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [partnerPerformance, setPartnerPerformance] = useState([]);
  const [timeRange, setTimeRange] = useState('year');
  const [partnerType, setPartnerType] = useState('all'); // all, Hotel, Collaborator
  const [sortBy, setSortBy] = useState('revenue');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (bookings.length > 0) {
      calculatePerformance();
    }
  }, [bookings, hotels, collaborators, timeRange, partnerType, sortBy]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // eslint-disable-next-line no-undef
      const [bookingsSnap, hotelsSnap, collaboratorsSnap] = await Promise.all([
        getDocs(collection(db, 'bookings')),
        getDocs(collection(db, 'hotels')),
        getDocs(collection(db, 'collaborators'))
      ]);

      const bookingsData = bookingsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const hotelsData = hotelsSnap.docs.map(doc => ({
        id: doc.id,
        type: 'Hotel',
        ...doc.data()
      }));

      const collaboratorsData = collaboratorsSnap.docs.map(doc => ({
        id: doc.id,
        type: 'Collaborator',
        ...doc.data()
      }));

      setBookings(bookingsData);
      setHotels(hotelsData);
      setCollaborators(collaboratorsData);
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
      year: new Date(now.getFullYear(), 0, 1),
      allTime: new Date(2020, 0, 1)
    };
    return cutoffs[timeRange];
  };

  const calculatePerformance = () => {
    const cutoffDate = getDateCutoff();

    // Filter bookings by time range and partner type
    const filteredBookings = bookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDetails?.date);
      const typeMatches = partnerType === 'all' || booking.clientType === partnerType;
      return bookingDate >= cutoffDate && booking.status !== 'cancelled' && typeMatches;
    });

    // Create partner map
    const allPartners = [...hotels, ...collaborators];
    const partnerMap = {};

    // Initialize all partners with zero values
    allPartners.forEach(partner => {
      partnerMap[partner.id] = {
        id: partner.id,
        name: partner.name,
        type: partner.type,
        commissionRate: partner.commissionRate || 0,
        totalBookings: 0,
        totalRevenue: 0,
        totalCommission: 0,
        avgBookingValue: 0,
        bookings: []
      };
    });

    // Calculate metrics for each booking
    filteredBookings.forEach(booking => {
      const partnerId = booking.selectedPartner;
      if (!partnerId || !partnerMap[partnerId]) return;

      const revenue = booking.pricing?.agreedPrice || booking.pricing?.finalPrice || 0;
      const commissionRate = partnerMap[partnerId].commissionRate || 0;
      const commission = (revenue * commissionRate) / 100;

      partnerMap[partnerId].totalBookings++;
      partnerMap[partnerId].totalRevenue += revenue;
      partnerMap[partnerId].totalCommission += commission;
      partnerMap[partnerId].bookings.push(booking);
    });

    // Calculate average booking value
    Object.values(partnerMap).forEach(partner => {
      if (partner.totalBookings > 0) {
        partner.avgBookingValue = partner.totalRevenue / partner.totalBookings;
      }
    });

    // Filter out partners with no bookings (optional - keep for completeness)
    const performance = Object.values(partnerMap).filter(p => p.totalBookings > 0);

    // Sort based on selected criteria
    performance.sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return b.totalRevenue - a.totalRevenue;
        case 'bookings':
          return b.totalBookings - a.totalBookings;
        case 'commission':
          return b.totalCommission - a.totalCommission;
        case 'avgValue':
          return b.avgBookingValue - a.avgBookingValue;
        default:
          return 0;
      }
    });

    setPartnerPerformance(performance);
  };

  const exportToExcel = () => {
    const exportData = partnerPerformance.map(partner => ({
      'Partner Name': partner.name,
      'Type': partner.type,
      'Total Bookings': partner.totalBookings,
      'Total Revenue (€)': partner.totalRevenue.toFixed(2),
      'Commission Rate (%)': partner.commissionRate,
      'Total Commission (€)': partner.totalCommission.toFixed(2),
      'Avg Booking Value (€)': partner.avgBookingValue.toFixed(2)
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Partner Performance');

    // Add summary sheet
    const summaryData = [
      ['Partner Performance Report'],
      [''],
      ['Time Range', timeRange],
      ['Partner Type', partnerType],
      ['Generated On', new Date().toLocaleString()],
      [''],
      ['Summary'],
      ['Total Partners', partnerPerformance.length],
      ['Total Bookings', totalStats.totalBookings],
      ['Total Revenue (€)', totalStats.totalRevenue.toFixed(2)],
      ['Total Commission (€)', totalStats.totalCommission.toFixed(2)]
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    XLSX.writeFile(
      workbook,
      `partner-performance-${timeRange}-${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const totalStats = partnerPerformance.reduce(
    (acc, partner) => ({
      totalBookings: acc.totalBookings + partner.totalBookings,
      totalRevenue: acc.totalRevenue + partner.totalRevenue,
      totalCommission: acc.totalCommission + partner.totalCommission
    }),
    { totalBookings: 0, totalRevenue: 0, totalCommission: 0 }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading partner data...</p>
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
            <Users className="w-8 h-8 text-blue-600" />
            Partner Performance Reports
          </h1>
          <p className="text-gray-600 mt-2">
            Track bookings and revenue from hotels and collaborators
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
                <option value="allTime">All Time</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Partner Type:</label>
              <select
                value={partnerType}
                onChange={(e) => setPartnerType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">All Partners</option>
                <option value="Hotel">Hotels Only</option>
                <option value="Collaborator">Collaborators Only</option>
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
                <option value="commission">Commission</option>
                <option value="avgValue">Avg Booking Value</option>
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
                <p className="text-sm text-gray-600">Active Partners</p>
                <p className="text-2xl font-bold text-gray-900">{partnerPerformance.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{totalStats.totalBookings}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-600" />
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
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Commission</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalStats.totalCommission)}
                </p>
              </div>
              <Award className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue by Partner */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Partners by Revenue</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={partnerPerformance.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="totalRevenue" fill="#3b82f6" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bookings by Partner */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Partners by Bookings</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={partnerPerformance.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalBookings" fill="#10b981" name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Distribution (Top 8)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={partnerPerformance.slice(0, 8)}
                  dataKey="totalRevenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.name}: ${formatCurrency(entry.totalRevenue)}`}
                >
                  {partnerPerformance.slice(0, 8).map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Commission Owed */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Commission Owed (Top 10)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={partnerPerformance.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="totalCommission" fill="#f59e0b" name="Commission" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Detailed Partner Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Partner Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bookings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commission %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commission Owed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Booking
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {partnerPerformance.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {partner.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          partner.type === 'Hotel'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {partner.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {partner.totalBookings}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(partner.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {partner.commissionRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-orange-600">
                      {formatCurrency(partner.totalCommission)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(partner.avgBookingValue)}
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

export default PartnerPerformanceReports;
