import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import AddBooking from './components/AddBooking';
import ManagePartners from './components/ManagePartners';
import UserManagement from './components/UserManagement';
import UpcomingBookings from './components/UpcomingBookings';
import FirestoreTest from "./FirestoreTest";
import Login from './components/Login';
import ClientDirectory from './components/ClientDirectory';
import PaymentTracking from './components/PaymentTracking';
import PaymentLinkGenerator from './components/PaymentLinkGenerator';
import ExpenseOverview from './components/ExpenseOverview';
import BoatManagement from './components/BoatManagement';
import AddBoat from './components/AddBoat';
import Dashboard from './components/Dashboard';
import ChatbotSettings from './components/ChatbotSettings';
import SystemSettings from './components/SystemSettings';
import ProductManagement from './components/ProductManagement';
import AddEditProduct from './components/AddEditProduct';
import CateringOrders from './components/CateringOrders';
import BoatFinder from './components/BoatFinder';
import LeadManagement from './components/LeadManagement';
import NotificationsCenter from './components/notifications/NotificationsCenter';
import InvoiceGenerator from './components/InvoiceGenerator';
import SanAntonioBookingsAdmin from './components/SanAntonioBookingsAdmin';
import PlaceQRManager from './components/PlaceQRManager';
import FinancialDashboard from './components/FinancialDashboard';

import ExpenseTracker from './components/ExpenseTracker';
import CateringExpensesTracker from './components/CateringExpensesTracker';
import CollaboratorManagement from './components/CollaboratorManagement';
import DataInsights from './components/DataInsights';
import RemindersBoard from './components/RemindersBoard';
import GlobalSearch from './components/search/GlobalSearch';
import BoatPerformanceAnalytics from './components/BoatPerformanceAnalytics';
import PartnerPerformanceReports from './components/PartnerPerformanceReports';
import DataBackup from './components/DataBackup';
import { canRoleAccessPath } from './config/accessControl';
const Splash = ({ onFinish }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onFinish();
        }, 2000);
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <div
            id="splash-screen"
            className="fixed inset-0 flex flex-col items-center justify-center bg-white transition-opacity duration-300 ease-in-out z-50"
        >
            <div className="flex flex-col items-center">
                <img
                    src="/Nautiq.Logo03.png"
                    alt="Nautiq Ibiza"
                    className="w-44 h-auto"
                />
                <div className="flex space-x-2 mt-8">
                    <div className="w-2 h-2 rounded-full bg-system-gray-400 animate-bounce"
                        style={{ animationDelay: '-0.32s' }}
                    />
                    <div className="w-2 h-2 rounded-full bg-system-gray-400 animate-bounce"
                        style={{ animationDelay: '-0.16s' }}
                    />
                    <div className="w-2 h-2 rounded-full bg-system-gray-400 animate-bounce" />
                </div>
            </div>
        </div>
    );
};

function ErrorFallback({ error }) {
    return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
            <div className="app-card p-6 max-w-sm w-full">
                <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--danger)' }}>
                    Something went wrong
                </h2>
                <pre className="text-sm overflow-auto" style={{ color: 'var(--text-secondary)' }}>
                    {error.message}
                </pre>
            </div>
        </div>
    );
}

const ProtectedRoute = ({ children, adminOnly = false, requiredPermission }) => {
    const { user, loading, userRole, isAdmin, isStaff, isEmployee, isDriver } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--accent)' }} />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    const requiresAdmin = adminOnly || requiredPermission === 'admin';
    if (requiresAdmin && !isAdmin()) {
        return <Navigate to="/bookings" replace />;
    }

    if (requiredPermission) {
        const permissions = Array.isArray(requiredPermission)
            ? requiredPermission
            : [requiredPermission];

        const hasPermission = permissions.some((permission) => {
            switch (permission) {
                case 'admin':
                    return isAdmin();
                case 'staff':
                    return isAdmin() || isStaff();
                case 'employee':
                    return isAdmin() || isEmployee?.();
                case 'driver':
                    return isAdmin() || isDriver?.();
                default:
                    return false;
            }
        });

        if (!hasPermission) {
            return <Navigate to="/bookings" replace />;
        }
    }

    const effectiveRole = isAdmin() ? 'admin' : (userRole || 'staff');
    if (effectiveRole !== 'admin' && !canRoleAccessPath(effectiveRole, location.pathname)) {
        return <Navigate to="/bookings" replace />;
    }

    return children;
};

function ProtectedLayout({ children }) {
    return (
        <div className="relative min-h-screen text-slate-900">
            <Sidebar />
            <div
                className="min-h-screen transition-all duration-300"
                style={{ marginLeft: 'var(--sidebar-offset, 0px)' }}
            >
                <header className="sticky top-0 z-30 border-b bg-white/85 backdrop-blur-md" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-end gap-3 px-6 py-2 lg:px-10">
                        <div className="flex items-center gap-2">
                            <GlobalSearch />
                            <NotificationsCenter />
                        </div>
                    </div>
                </header>
                <main className="shell-gradient relative flex-1 overflow-y-auto px-6 pb-12 pt-8 sm:px-8 lg:px-12">
                    <div className="relative mx-auto max-w-7xl space-y-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

function App() {
    const [showSplash, setShowSplash] = useState(true);

    return (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
            {showSplash && <Splash onFinish={() => setShowSplash(false)} />}
            <div className={`transition-opacity duration-300 ${showSplash ? 'opacity-0' : 'opacity-100'}`}>
                <AuthProvider>
                    <Router>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            
                            {/* Dashboard */}
                            <Route
                                path="/"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <Dashboard />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />

                            <Route path="/bookings" element={
                            <ProtectedRoute>
                                <ProtectedLayout>
                                <UpcomingBookings />
                                </ProtectedLayout>
                            </ProtectedRoute>
                            }>
                            {/* Add a nested route for viewing specific bookings */}
                            <Route path=":id" element={
                                <ProtectedRoute>
                                <ProtectedLayout>
                                    <UpcomingBookings />
                                </ProtectedLayout>
                                </ProtectedRoute>
                            } />
                            </Route>
                            <Route
                                path="/add-booking"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <AddBooking />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />

                            
                            {/* San Antonio Tours */}
                            <Route
                                path="/san-antonio-tours"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <SanAntonioBookingsAdmin />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            

                            {/* Financial Routes */}
                            <Route
                                path="/payment-links"
                                element={
                                    <ProtectedRoute requiredPermission="staff">
                                        <ProtectedLayout>
                                            <PaymentLinkGenerator />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/payment-tracking"
                                element={
                                    <ProtectedRoute requiredPermission={['admin', 'employee']}>
                                        <ProtectedLayout>
                                            <PaymentTracking />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/invoice-generator"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <InvoiceGenerator />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            {/* Catering Routes */}
                            
                            <Route
                                path="/expenses"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <ExpenseOverview />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/products"
                                element={
                                    <ProtectedRoute requiredPermission="staff">
                                        <ProtectedLayout>
                                            <ProductManagement />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/add-product"
                                element={
                                    <ProtectedRoute requiredPermission="staff">
                                        <ProtectedLayout>
                                            <AddEditProduct />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/edit-product/:id"
                                element={
                                    <ProtectedRoute requiredPermission="staff">
                                        <ProtectedLayout>
                                            <AddEditProduct />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/catering-orders"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <CateringOrders />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/catering-expenses"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <CateringExpensesTracker />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                           <Route
                                path="/collaborator-management"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <CollaboratorManagement />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />

                            {/* Fleet Management Routes */}
                            <Route
                                path="/boats"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <BoatManagement />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/add-boat"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <AddBoat />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/available-boats"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <BoatFinder />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/edit-boat/:id"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <AddBoat />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/places"
                                element={
                                    <ProtectedRoute requiredPermission="admin">
                                        <ProtectedLayout>
                                            <PlaceQRManager />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />

                            {/* Directory Routes */}
                            <Route
                                path="/clients"
                                element={
                                    <ProtectedRoute requiredPermission="admin">
                                        <ProtectedLayout>
                                            <ClientDirectory />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/reminders"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <RemindersBoard />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/manage-partners"
                                element={
                                    <ProtectedRoute requiredPermission="admin">
                                        <ProtectedLayout>
                                            <ManagePartners />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/expense-tracker"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <ExpenseTracker />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />

                            {/* Administration Routes */}

                            <Route
                                path="/financial-dashboard"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <FinancialDashboard />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/insights"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <DataInsights />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/boat-performance"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <BoatPerformanceAnalytics />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/partner-performance"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <PartnerPerformanceReports />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/data-backup"
                                element={
                                    <ProtectedRoute requiredPermission="admin">
                                        <ProtectedLayout>
                                            <DataBackup />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/user-management"
                                element={
                                    <ProtectedRoute requiredPermission="admin">
                                        <ProtectedLayout>
                                            <UserManagement />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/inquiries"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <LeadManagement />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />

                            {/* New Routes */}
                            <Route
                                path="/chatbot-settings"
                                element={
                                    <ProtectedRoute requiredPermission="admin">
                                        <ProtectedLayout>
                                            <ChatbotSettings />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/settings"
                                element={
                                    <ProtectedRoute requiredPermission="admin">
                                        <ProtectedLayout>
                                            <SystemSettings />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />

                            {/* Test Route */}
                            <Route
                                path="/test"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <FirestoreTest />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />

                            {/* Catch all route */}
                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    </Router>
                </AuthProvider>
            </div>
        </ErrorBoundary>
    );
}

export default App;
