import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from '../firebase/firebaseConfig.js';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { useMediaQuery } from 'react-responsive';

function Analytics() {
  const [bookingData, setBookingData] = useState([]);
  const [topBoats, setTopBoats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const isMobile = useMediaQuery({ query: '(max-width: 768px)' });

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        const bookingsSnapshot = await getDocs(collection(db, "bookings"));
        const bookings = bookingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const monthlyData = processMonthlyData(bookings);
        const boatsData = processTopBoats(bookings);
        
        setBookingData(monthlyData);
        setTopBoats(boatsData);
      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, []);

  const processMonthlyData = (bookings) => {
    const monthlyStats = {};

    bookings.forEach(booking => {
      const date = new Date(booking.bookingDetails.date);
      const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });

      if (!monthlyStats[monthYear]) {
        monthlyStats[monthYear] = {
          month: monthYear,
          bookings: 0,
          revenue: 0
        };
      }

      monthlyStats[monthYear].bookings += 1;
      monthlyStats[monthYear].revenue += parseFloat(booking.pricing.finalPrice) || 0;
    });

    return Object.values(monthlyStats)
      .sort((a, b) => new Date(a.month) - new Date(b.month));
  };

  const processTopBoats = (bookings) => {
    const boatsStats = {};

    bookings.forEach(booking => {
      const boatName = booking.bookingDetails.boatName;
      if (!boatsStats[boatName]) {
        boatsStats[boatName] = {
          name: boatName,
          bookings: 0,
          revenue: 0
        };
      }
      boatsStats[boatName].bookings += 1;
      boatsStats[boatName].revenue += parseFloat(booking.pricing.finalPrice) || 0;
    });

    return Object.values(boatsStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5) // Get top 5 boats
      .map(boat => ({
        ...boat,
        revenue: Math.round(boat.revenue),
      }));
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 sm:p-4 border rounded shadow text-sm sm:text-base">
          <p className="font-semibold">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('Revenue') ? `€${entry.value.toLocaleString()}` : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-6 space-y-4 sm:space-y-6">
      {/* Main Chart Section */}
      <div className="bg-white p-3 sm:p-6 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold">Monthly Performance</h2>
          <div className="flex gap-2 text-sm sm:text-base">
            <button
              onClick={() => setSelectedMetric('revenue')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded ${
                selectedMetric === 'revenue' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setSelectedMetric('bookings')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded ${
                selectedMetric === 'bookings' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Bookings
            </button>
          </div>
        </div>
        
        <div className="h-64 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={bookingData}
              margin={isMobile ? 
                { top: 5, right: 10, left: 0, bottom: 5 } :
                { top: 5, right: 30, left: 20, bottom: 5 }
              }
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                padding={{ left: 10, right: 10 }}
                tick={{ fontSize: isMobile ? 12 : 14 }}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? "end" : "middle"}
                height={isMobile ? 60 : 30}
              />
              <YAxis tick={{ fontSize: isMobile ? 12 : 14 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={isMobile ? { fontSize: '12px' } : undefined} />
              {selectedMetric === 'revenue' ? (
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#2563eb" 
                  name="Revenue" 
                  strokeWidth={2}
                />
              ) : (
                <Line 
                  type="monotone" 
                  dataKey="bookings" 
                  stroke="#16a34a" 
                  name="Bookings"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Boats Section - Responsive Grid */}
      <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6">
        {/* Bar Chart */}
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow">
          <h2 className="text-lg sm:text-xl font-bold mb-4">Top Performing Boats</h2>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topBoats}
                margin={isMobile ?
                  { top: 5, right: 10, left: 0, bottom: 5 } :
                  { top: 5, right: 30, left: 20, bottom: 5 }
                }
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: isMobile ? 12 : 14 }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={isMobile ? 80 : 100}
                  tick={{ fontSize: isMobile ? 12 : 14 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={isMobile ? { fontSize: '12px' } : undefined} />
                <Bar dataKey="revenue" name="Revenue (€)" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Details Table */}
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow">
          <h2 className="text-lg sm:text-xl font-bold mb-4">Top Boats Details</h2>
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">Boat</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">Book.</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">Avg</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topBoats.map((boat) => (
                  <tr key={boat.name} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">{boat.name}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">{boat.bookings}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">€{boat.revenue.toLocaleString()}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                      €{Math.round(boat.revenue / boat.bookings).toLocaleString()}
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
}

export default Analytics;
