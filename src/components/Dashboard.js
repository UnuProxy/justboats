import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from '../firebase/firebaseConfig.js';
import { useNavigate } from 'react-router-dom';
import { 
  Ship, 
  Calendar, 
  Users, 
  PlusCircle, 
  List, 
  Euro,
  TrendingUp,
  BarChart2,
  Download
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBookings: 0,
    monthlyBookings: 0,
    activeClients: 0,
    totalRevenue: 0,
    avgBookingValue: 0,
    bookingGrowth: 0,
    topBoat: { name: "-", bookings: 0 },
    revenueByMonth: []
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [revenueByBoat, setRevenueByBoat] = useState([]);
  const [bookingTrend, setBookingTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("year"); // year, quarter, month

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Get all bookings
        const bookingsSnapshot = await getDocs(collection(db, "bookings"));
        const bookings = bookingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        const totalBookings = bookings.length;

        // Get this month's bookings
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const thisMonthBookings = bookings.filter(booking => 
          new Date(booking.bookingDetails?.date) >= firstDayOfMonth
        );
        const monthlyBookings = thisMonthBookings.length;

        // Get last month's bookings for growth calculation
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        const lastMonthBookings = bookings.filter(booking => {
          const date = new Date(booking.bookingDetails?.date);
          return date >= firstDayOfLastMonth && date <= lastMonthEnd;
        });
        
        // Calculate booking growth percentage
        const bookingGrowth = lastMonthBookings.length > 0 
          ? ((monthlyBookings - lastMonthBookings.length) / lastMonthBookings.length) * 100 
          : 100;

        // Calculate total revenue and average booking value
        let totalRevenue = 0;
        bookings.forEach((booking) => {
          totalRevenue += booking.pricing?.finalPrice || 0;
        });
        
        const avgBookingValue = totalBookings > 0 
          ? totalRevenue / totalBookings 
          : 0;

        // Get unique clients count
        const uniqueClients = new Set();
        bookings.forEach((booking) => {
          if (booking.clientDetails?.email) {
            uniqueClients.add(booking.clientDetails.email);
          }
        });

        // Find most popular boat
        const boatCounts = {};
        bookings.forEach((booking) => {
          const boatName = booking.bookingDetails?.boatName || 'Unknown';
          boatCounts[boatName] = (boatCounts[boatName] || 0) + 1;
        });
        
        let topBoat = { name: "-", bookings: 0 };
        Object.keys(boatCounts).forEach(boat => {
          if (boatCounts[boat] > topBoat.bookings) {
            topBoat = { name: boat, bookings: boatCounts[boat] };
          }
        });

        // Generate revenue by month data
        const revenueByMonth = generateRevenueByMonth(bookings);
        
        // Generate revenue by boat data
        const boatRevenueData = generateRevenueByBoat(bookings);
        
        // Generate booking trend data
        const trendData = generateBookingTrend(bookings, timeRange);

        setStats({
          totalBookings,
          monthlyBookings,
          activeClients: uniqueClients.size,
          totalRevenue,
          avgBookingValue,
          bookingGrowth,
          topBoat,
          revenueByMonth
        });
        
        setRevenueByBoat(boatRevenueData);
        setBookingTrend(trendData);

        // Get recent bookings
        const recentBookingsData = [...bookings]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5);
          
        setRecentBookings(recentBookingsData);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeRange]);

  // Helper function to generate revenue by month
  const generateRevenueByMonth = (bookings) => {
    const months = {};
    
    bookings.forEach(booking => {
      if (!booking.bookingDetails?.date) return;
      
      const date = new Date(booking.bookingDetails.date);
      const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      if (!months[monthYear]) {
        months[monthYear] = {
          name: monthName,
          revenue: 0,
          bookings: 0
        };
      }
      
      months[monthYear].revenue += booking.pricing?.finalPrice || 0;
      months[monthYear].bookings += 1;
    });
    
    return Object.values(months)
      .sort((a, b) => new Date(a.month) - new Date(b.month))
      .slice(-6); // Get last 6 months
  };
  
  // Helper function to generate revenue by boat
  const generateRevenueByBoat = (bookings) => {
    const boats = {};
    
    bookings.forEach(booking => {
      const boatName = booking.bookingDetails?.boatName || 'Unknown';
      
      if (!boats[boatName]) {
        boats[boatName] = {
          name: boatName,
          revenue: 0,
          bookings: 0
        };
      }
      
      boats[boatName].revenue += booking.pricing?.finalPrice || 0;
      boats[boatName].bookings += 1;
    });
    
    return Object.values(boats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5); // Get top 5 boats by revenue
  };
  
  // Helper function to generate booking trend data
  const generateBookingTrend = (bookings, timeRange) => {
    const now = new Date();
    let periods = [];
    // Define periods based on time range
    if (timeRange === "year") {
      // Last 12 months
      periods = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        return {
          startDate: date,
          endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0),
          label: date.toLocaleString('default', { month: 'short' })
        };
      });
      // Month format
    } else if (timeRange === "quarter") {
      // Last 13 weeks
      periods = Array.from({ length: 13 }, (_, i) => {
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - ((13 - i - 1) * 7));
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        return {
          startDate,
          endDate,
          label: `W${i + 1}`
        };
      });
      // Week format
    } else {
      // Last 30 days
      periods = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(now);
        date.setDate(now.getDate() - (30 - i - 1));
        return {
          startDate: date,
          endDate: date,
          label: date.getDate().toString()
        };
      });
      // Day format
    }
    
    // Count bookings in each period
    const trendData = periods.map(period => {
      const periodBookings = bookings.filter(booking => {
        if (!booking.bookingDetails?.date) return false;
        const bookingDate = new Date(booking.bookingDetails.date);
        return bookingDate >= period.startDate && bookingDate <= period.endDate;
      });
      
      const periodRevenue = periodBookings.reduce((sum, booking) => 
        sum + (booking.pricing?.finalPrice || 0), 0);
      
      return {
        name: period.label,
        bookings: periodBookings.length,
        revenue: periodRevenue
      };
    });
    
    return trendData;
  };

  // Function to export revenue data
  const exportRevenueData = () => {
    // Combine all booking data for export
    const exportData = stats.revenueByMonth.map(month => ({
      Month: month.name,
      Revenue: month.revenue,
      Bookings: month.bookings
    }));
    
    // Convert to CSV
    const headers = Object.keys(exportData[0]).join(',');
    const rows = exportData.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'revenue_data.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const quickActions = [
    { 
      label: "New Booking", 
      icon: PlusCircle, 
      action: () => navigate("/add-booking"),
      bgColor: "bg-blue-100 hover:bg-blue-200",
      iconColor: "text-blue-600"
    },
    { 
      label: "View Bookings", 
      icon: List, 
      action: () => navigate("/bookings"),
      bgColor: "bg-green-100 hover:bg-green-200",
      iconColor: "text-green-600"
    },
    { 
      label: "Export Revenue", 
      icon: Download, 
      action: exportRevenueData,
      bgColor: "bg-purple-100 hover:bg-purple-200",
      iconColor: "text-purple-600"
    },
  ];

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4 overflow-x-hidden">
      <div className="max-w-full mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Just Enjoy Ibiza</h1>
          <p className="text-gray-600 mt-2">Here&apos;s your business overview</p>
        </div>

        {/* Stats Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-center">
              <div className="bg-blue-500 p-3 rounded-lg">
                <Ship className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-center">
              <div className="bg-green-500 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <div className="flex items-baseline">
                  <p className="text-2xl font-semibold text-gray-900">{stats.monthlyBookings}</p>
                  <span className={`ml-2 text-sm font-medium ${stats.bookingGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.bookingGrowth > 0 ? '+' : ''}{stats.bookingGrowth.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-center">
              <div className="bg-purple-500 p-3 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Clients</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.activeClients}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-center">
              <div className="bg-yellow-500 p-3 rounded-lg">
                <Euro className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-semibold text-gray-900">€{stats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Additional Statistics Cards */}
          <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-center">
              <div className="bg-indigo-500 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Booking Value</p>
                <p className="text-2xl font-semibold text-gray-900">€{stats.avgBookingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-center">
              <div className="bg-red-500 p-3 rounded-lg">
                <BarChart2 className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Most Popular Boat</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.topBoat.name}</p>
                <p className="text-sm text-gray-600">{stats.topBoat.bookings} bookings</p>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Analytics Section */}
        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Revenue Analytics</h2>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setTimeRange("month")} 
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    timeRange === "month" 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Month
                </button>
                <button 
                  onClick={() => setTimeRange("quarter")} 
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    timeRange === "quarter" 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Quarter
                </button>
                <button 
                  onClick={() => setTimeRange("year")} 
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    timeRange === "year" 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Year
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Trend Chart */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bookingTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => `€${value.toLocaleString()}`} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        name="Revenue" 
                        stroke="#8884d8" 
                        activeDot={{ r: 8 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Revenue by Boat Chart */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue by Boat</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByBoat}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => `€${value.toLocaleString()}`} />
                      <Legend />
                      <Bar 
                        dataKey="revenue" 
                        name="Revenue" 
                        fill="#82ca9d" 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-3 gap-4">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.action}
                  className={`flex flex-col items-center justify-center p-6 rounded-lg transition-all 
                    ${action.bgColor} transform hover:scale-[1.02]`}
                >
                  <action.icon className={`w-8 h-8 ${action.iconColor} mb-3`} />
                  <span className="text-sm font-medium text-gray-900">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Bookings Section */}
        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Bookings</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boat</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentBookings.map((booking) => (
                    <tr 
                      key={booking.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/booking/${booking.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {booking.clientDetails?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.bookingDetails?.boatName || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.bookingDetails?.date 
                          ? new Date(booking.bookingDetails.date).toLocaleDateString() 
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        €{(booking.pricing?.finalPrice || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          (booking.pricing?.paymentStatus === "Paid") 
                            ? "bg-green-100 text-green-800"
                            : (booking.pricing?.paymentStatus === "Partial") 
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}>
                          {booking.pricing?.paymentStatus || "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;