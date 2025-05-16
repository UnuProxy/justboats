import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
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
import PricingManager from './components/PricingManager';
import ExpenseTracker from './components/ExpenseTracker';
import CateringExpensesTracker from './components/CateringExpensesTracker';
import ContractGenerator from './components/ContractGenerator';

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
            className="fixed inset-0 flex flex-col items-center justify-center bg-[#0099cc] transition-opacity duration-300 ease-in-out z-50"
        >
            <div className="flex flex-col items-center">
                <img
                    src="/WhiteLogo-Just-Enjoy.png"
                    alt="Just Enjoy Ibiza"
                    className="w-48 h-auto animate-pulse"
                />
                <div className="flex space-x-2 mt-8">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce"
                        style={{ animationDelay: '-0.32s' }}
                    />
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce"
                        style={{ animationDelay: '-0.16s' }}
                    />
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                </div>
            </div>
        </div>
    );
};

function ErrorFallback({ error }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="p-6 max-w-sm w-full bg-white shadow-md rounded-lg">
                <h2 className="text-red-600 text-xl font-semibold mb-4">
                    Something went wrong
                </h2>
                <pre className="text-sm text-gray-700 overflow-auto">
                    {error.message}
                </pre>
            </div>
        </div>
    );
}

const ProtectedRoute = ({ children }) => {
    const { user, loading, isAdmin } = useAuth();
    
    // List of paths regular users are allowed to access
    const regularUserPaths = ['/bookings', '/san-antonio-tours'];

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" />;
    }
    
    // Get the current path
    const currentPath = window.location.pathname;
    
    // If user is not admin and tries to access a restricted path
    if (!isAdmin() && !regularUserPaths.includes(currentPath) && 
        !currentPath.startsWith('/bookings/')) { // Allow viewing specific bookings
        console.log("Access denied: Redirecting to bookings");
        return <Navigate to="/bookings" />;
    }

    return children;
};

function ProtectedLayout({ children }) {
    const navigate = useNavigate();

    return (
        <div className="relative bg-gray-100 min-h-screen">
            <Sidebar />
            <div className="md:ml-64 flex flex-col">
                <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
                    <div></div>
                    <div className="flex items-center gap-4">
                        <NotificationsCenter />
                        <h1 
                            className="text-xl font-semibold cursor-pointer hover:text-blue-500 transition-colors"
                            onClick={() => navigate('/')}
                        >
                            Just Enjoy Bookings
                        </h1>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
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
                             <Route path="/contract-generator" element={
                                <ProtectedRoute adminOnly={true}>
                                    <ContractGenerator />
                                </ProtectedRoute>
                                } />

                            {/* Financial Routes */}
                            <Route
                                path="/payment-tracking"
                                element={
                                    <ProtectedRoute>
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
                                    <ProtectedRoute requiredPermission="admin">
                                        <ProtectedLayout>
                                            <ProductManagement />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/add-product"
                                element={
                                    <ProtectedRoute requiredPermission="admin">
                                        <ProtectedLayout>
                                            <AddEditProduct />
                                        </ProtectedLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/edit-product/:id"
                                element={
                                    <ProtectedRoute requiredPermission="admin">
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
                                path="/pricing-manager"
                                element={
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <PricingManager />
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
                                    <ProtectedRoute>
                                        <ProtectedLayout>
                                            <ClientDirectory />
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