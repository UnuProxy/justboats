import React, { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from '../firebase/firebaseConfig.js';
import { useNavigate } from 'react-router-dom';
import { 
  Ship, 
  Calendar, 
  Users, 
  PlusCircle, 
  List, 
  TrendingUp,
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

const cx = (...classes) => classes.filter(Boolean).join(' ');

const reminderTypeLabels = {
  client: 'Client follow-up',
  task: 'Internal to-do',
  meeting: 'Meeting or call',
};

const reminderTypeBadge = {
  client: 'border-slate-200 bg-slate-50 text-slate-600',
  task: 'border-slate-200 bg-slate-100 text-slate-600',
  meeting: 'border-slate-200 bg-slate-50 text-slate-600',
};

const getReminderDueMeta = (dueDate) => {
  if (!dueDate) {
    return { label: 'No due date', className: 'border-slate-200 bg-slate-100 text-slate-600' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Overdue', className: 'border-rose-200 bg-rose-50 text-rose-600' };
  }
  if (diffDays === 0) {
    return { label: 'Due today', className: 'border-amber-200 bg-amber-50 text-amber-600' };
  }
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`, className: 'border-slate-200 bg-slate-50 text-slate-600' };
  }
  return {
    label: due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    className: 'border-slate-200 bg-slate-100 text-slate-600',
  };
};

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
  const [upcomingReminders, setUpcomingReminders] = useState([]);
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

        // Fetch open reminders to show on the dashboard
        const remindersQuery = query(
          collection(db, 'reminders'),
          where('completed', '==', false)
        );
        const remindersSnapshot = await getDocs(remindersQuery);
        const reminders = remindersSnapshot.docs
          .map((document) => {
            const data = document.data();
            const due =
              data.dueDate?.toDate?.() ??
              (data.dueDate ? new Date(data.dueDate) : null);
            return {
              id: document.id,
              title: data.title || '',
              type: data.type || 'task',
              dueDate: due && !Number.isNaN(due.getTime()) ? due : null,
              relatedClient: data.relatedClient || '',
              relatedBoat: data.relatedBoat || '',
              notes: data.notes || '',
            };
          })
          .sort((a, b) => {
            const timeA = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
            const timeB = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
            if (timeA !== timeB) return timeA - timeB;
            return a.title.localeCompare(b.title);
          });

        setUpcomingReminders(reminders.slice(0, 5));

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
  const exportRevenueData = useCallback(() => {
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
  }, [stats.revenueByMonth]);

  useEffect(() => {
    const handler = () => exportRevenueData();
    window.addEventListener('dashboard-export-revenue', handler);
    return () => window.removeEventListener('dashboard-export-revenue', handler);
  }, [exportRevenueData]);

  const quickActions = [
    {
      label: "New Booking",
      icon: PlusCircle,
      action: () => navigate("/add-booking"),
    },
    {
      label: "View Bookings",
      icon: List,
      action: () => navigate("/bookings"),
    },
    {
      label: "Export Revenue",
      icon: Download,
      action: exportRevenueData,
    },
  ];

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-7 lg:grid-cols-[2fr,1fr]">
        <div className="app-card p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/50 px-3 py-1 mb-3 backdrop-blur">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-600">Live overview</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">This month&rsquo;s performance</h2>
              <p className="mt-1 text-sm text-slate-600">
                Monitor bookings, revenue, and client activity across the fleet in real time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.action}
                  className="group inline-flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-light)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] transition-all group-hover:bg-[var(--background)]">
                    <action.icon className="h-4 w-4" />
                  </span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="group relative overflow-hidden app-card p-5 transition-transform duration-200 hover:-translate-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Scheduled departures</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{stats.monthlyBookings}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background-secondary)]/40 px-3 py-1">
                <span className={`text-xs font-semibold ${stats.bookingGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {stats.bookingGrowth >= 0 ? '↑' : '↓'} {Math.abs(stats.bookingGrowth).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500">vs last month</span>
              </div>
            </div>
            <div className="group relative overflow-hidden app-card p-5 transition-transform duration-200 hover:-translate-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Total bookings</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{stats.totalBookings}</p>
              <span className="mt-2 inline-block text-xs font-medium text-slate-600">All time captured in CRM</span>
            </div>
            <div className="group relative overflow-hidden app-card p-5 transition-transform duration-200 hover:-translate-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Revenue to date</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">€{stats.totalRevenue.toLocaleString()}</p>
              <span className="mt-2 inline-block text-xs font-medium text-slate-600">Avg €{stats.avgBookingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} per booking</span>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="app-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Top performing boat</p>
            <h3 className="mt-3 text-2xl font-bold text-slate-900">{stats.topBoat.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{stats.topBoat.bookings} bookings captured</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="app-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Avg value</p>
              <p className="mt-2 text-xl font-bold text-slate-900">
                €{stats.avgBookingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="app-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Active clients</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{stats.activeClients}</p>
            </div>
          </div>
          <div className="app-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Revenue last 6 months</p>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              €{stats.revenueByMonth.reduce((sum, month) => sum + (month.revenue || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="group rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Total Bookings</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{stats.totalBookings}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--background-secondary)]/60 text-slate-800">
                <Ship className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="group rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">This Month</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900">{stats.monthlyBookings}</p>
                  <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${stats.bookingGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stats.bookingGrowth >= 0 ? '↑' : '↓'}{Math.abs(stats.bookingGrowth).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--background-secondary)]/60 text-slate-800">
                <Calendar className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="group rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Active Clients</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{stats.activeClients}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--background-secondary)]/60 text-slate-800">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="group rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Avg Booking Value</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">€{stats.avgBookingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--background-secondary)]/60 text-slate-800">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-7 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Revenue Analytics</h2>
              <p className="mt-1 text-sm text-slate-600">Track performance across different time periods</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['month', 'quarter', 'year'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cx(
                    'px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-200',
                    timeRange === range
                      ? 'border-transparent bg-[var(--accent)] text-white shadow-sm'
                      : 'border-[var(--border)] bg-white text-slate-600 hover:text-slate-900'
                  )}
                >
                  {range === 'month' ? 'Month' : range === 'quarter' ? 'Quarter' : 'Year'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-slate-600"></div>
                <h3 className="text-sm font-bold text-slate-900">Revenue Trend</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bookingTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                    <Tooltip formatter={(value) => `€${value.toLocaleString()}`} contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#c36a3f"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#c36a3f', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-slate-400"></div>
                <h3 className="text-sm font-bold text-slate-900">Revenue by Boat</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByBoat}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                    <Tooltip formatter={(value) => `€${value.toLocaleString()}`} contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                    <defs>
                      <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f0c79c" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#c36a3f" stopOpacity={0.85}/>
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Recent Bookings</h2>
                <p className="text-xs text-slate-500 mt-1">Latest 5 transactions</p>
              </div>
              <button
                onClick={() => navigate("/bookings")}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                View all →
              </button>
            </div>
            {recentBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-900">No bookings yet</p>
                <p className="text-xs text-slate-500 mt-1">Get started by creating your first booking</p>
                <button
                  onClick={() => navigate("/add-booking")}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
                >
                  <PlusCircle className="h-4 w-4" />
                  New Booking
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentBookings.slice(0, 5).map((booking) => {
                  const bookingDate = booking.bookingDetails?.date ? new Date(booking.bookingDetails.date) : null;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isUpcoming = bookingDate && bookingDate >= today;
                  const isPast = bookingDate && bookingDate < today;

                  return (
                    <div
                      key={booking.id}
                      className="group relative app-card p-4 transition-all duration-200 hover:-translate-y-0.5 overflow-hidden"
                    >
                      {/* Colored left border indicator */}
                      <div className={cx(
                        "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-200",
                        booking.pricing?.paymentStatus === 'Paid'
                          ? 'bg-emerald-400'
                          : booking.pricing?.paymentStatus === 'Partial'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                      )}></div>

                      <button
                        onClick={() => navigate(`/booking/${booking.id}`)}
                        className="w-full p-4 pl-5 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-bold text-slate-900 group-hover:text-slate-700 transition-colors truncate">
                                {booking.clientDetails?.name || 'N/A'}
                              </p>
                              {isUpcoming && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/70 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                  Upcoming
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Ship className="h-3 w-3 text-slate-400" />
                              <span className="truncate">{booking.bookingDetails?.boatName || 'Unassigned'}</span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-base font-bold text-slate-900">
                              €{(booking.pricing?.finalPrice || 0).toLocaleString()}
                            </p>
                            <span
                              className={cx(
                                'mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur',
                                (booking.pricing?.paymentStatus === 'Paid')
                                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
                                  : (booking.pricing?.paymentStatus === 'Partial')
                                    ? 'border-amber-200 bg-amber-50/70 text-amber-700'
                                    : 'border-rose-200 bg-rose-50/70 text-rose-600'
                              )}
                            >
                              {booking.pricing?.paymentStatus === 'Paid' && '✓ '}
                              {booking.pricing?.paymentStatus || 'Pending'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span className={cx(
                              "font-medium",
                              isUpcoming ? "text-slate-800" : isPast ? "text-slate-500" : "text-slate-600"
                            )}>
                              {bookingDate
                                ? bookingDate.toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })
                                : 'Date TBC'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-400">
                              #{booking.id.slice(-6).toUpperCase()}
                            </span>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                                View →
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="app-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Upcoming Reminders</h2>
                <p className="text-xs text-slate-500 mt-1">Tasks & follow-ups</p>
              </div>
              <button
                onClick={() => navigate('/reminders')}
                className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg bg-white hover:border-[var(--accent-light)] transition-colors"
              >
                Manage
              </button>
            </div>
            {upcomingReminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-12 w-12 rounded-full bg-white/70 flex items-center justify-center mb-3 text-slate-500 shadow-inner">
                  <span className="text-2xl">✓</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">All caught up!</p>
                <p className="text-xs text-slate-500 mt-1">No pending reminders</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {upcomingReminders.map((reminder) => {
                  const dueMeta = getReminderDueMeta(reminder.dueDate);
                  const typeBadgeClass =
                    reminderTypeBadge[reminder.type] || reminderTypeBadge.task;
                  return (
                    <li key={reminder.id} className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm hover:-translate-y-0.5 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900">{reminder.title}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${typeBadgeClass}`}>
                              {reminderTypeLabels[reminder.type] || 'Reminder'}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${dueMeta.className}`}>
                              {dueMeta.label}
                            </span>
                          </div>
                          {reminder.relatedClient && (
                            <p className="mt-2 text-xs text-slate-600">
                              <span className="font-semibold">Client:</span> {reminder.relatedClient}
                            </p>
                          )}
                          {reminder.relatedBoat && (
                            <p className="text-xs text-slate-600">
                              <span className="font-semibold">Boat:</span> {reminder.relatedBoat}
                            </p>
                          )}
                          {reminder.notes && (
                            <p className="mt-2 text-xs text-slate-500 italic">{reminder.notes}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
