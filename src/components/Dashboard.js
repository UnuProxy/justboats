import React, { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, limit, where } from "firebase/firestore";
import { db } from '../firebase/firebaseConfig.js';
import { useNavigate } from 'react-router-dom';
import { 
  Ship, 
  Calendar, 
  Users, 
  PlusCircle, 
  List, 
  Euro 
} from 'lucide-react';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBookings: 0,
    monthlyBookings: 0,
    activeClients: 0,
    totalRevenue: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Get total bookings
        const bookingsSnapshot = await getDocs(collection(db, "bookings"));
        const totalBookings = bookingsSnapshot.size;

        // Get this month's bookings
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthlyBookingsQuery = query(
          collection(db, "bookings"),
          where("bookingDetails.date", ">=", firstDayOfMonth.toISOString())
        );
        const monthlyBookingsSnapshot = await getDocs(monthlyBookingsQuery);
        const monthlyBookings = monthlyBookingsSnapshot.size;

        // Calculate total revenue
        let totalRevenue = 0;
        bookingsSnapshot.forEach((doc) => {
          const booking = doc.data();
          totalRevenue += booking.pricing?.finalPrice || 0;
        });

        // Get unique clients count
        const uniqueClients = new Set();
        bookingsSnapshot.forEach((doc) => {
          const booking = doc.data();
          if (booking.clientDetails?.email) {
            uniqueClients.add(booking.clientDetails.email);
          }
        });

        setStats({
          totalBookings,
          monthlyBookings,
          activeClients: uniqueClients.size,
          totalRevenue
        });

        // Get recent bookings
        const recentBookingsQuery = query(
          collection(db, "bookings"),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const recentBookingsSnapshot = await getDocs(recentBookingsQuery);
        const recentBookingsData = recentBookingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRecentBookings(recentBookingsData);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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
                <p className="text-2xl font-semibold text-gray-900">{stats.monthlyBookings}</p>
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
        </div>

        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {booking.clientDetails.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.bookingDetails.boatName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(booking.bookingDetails.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          {booking.pricing.paymentStatus}
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