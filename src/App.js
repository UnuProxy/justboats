import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import AddBooking from './components/AddBooking';
import ManagePartners from './components/ManagePartners';
import UserManagement from './components/UserManagement';
import UpcomingBookings from './components/UpcomingBookings';
import FirestoreTest from "./FirestoreTest";
import Login from './components/Login'; 
import Analytics from './components/Analytics';
import ClientDirectory from './components/ClientDirectory';
import AddExpense from './components/AddExpense';
import AutomatedBookings from './components/AutomatedBookings';
import PaymentTracking from './components/PaymentTracking';
import ExpenseOverview from './components/ExpenseOverview';

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
    const { user, loading } = useAuth();

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

    return children;
};

function ProtectedLayout({ children }) {
    return (
        <div className="relative bg-gray-100 min-h-screen">
            <Sidebar />
            <div className="md:ml-64 flex flex-col">
                <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
                    <div></div>
                    <h1 className="text-xl font-semibold">
                        Boat Management
                    </h1>
                </header>
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}

function App() {
    return (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
            <AuthProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <ProtectedLayout>
                                        <UpcomingBookings />
                                    </ProtectedLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/booking-communications"
                            element={
                                <ProtectedRoute>
                                    <ProtectedLayout>
                                        <AutomatedBookings />
                                    </ProtectedLayout>
                                </ProtectedRoute>
                            }
                        />
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
                            path="/add-booking"
                            element={
                                <ProtectedRoute>
                                    <ProtectedLayout>
                                        <AddBooking />
                                    </ProtectedLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/manage-partners"
                            element={
                                <ProtectedRoute>
                                    <ProtectedLayout>
                                        <ManagePartners />
                                    </ProtectedLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/analytics"
                            element={
                                <ProtectedRoute>
                                    <ProtectedLayout>
                                        <Analytics />
                                    </ProtectedLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/user-management"
                            element={
                                <ProtectedRoute>
                                    <ProtectedLayout>
                                        <UserManagement />
                                    </ProtectedLayout>
                                </ProtectedRoute>
                            }
                        />
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
                            path="/test"
                            element={
                                <ProtectedRoute>
                                    <ProtectedLayout>
                                        <FirestoreTest />
                                    </ProtectedLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/add-expense"
                            element={
                                <ProtectedRoute>
                                    <ProtectedLayout>
                                        <AddExpense />
                                    </ProtectedLayout>
                                </ProtectedRoute>
                            }
                        />
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
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </Router>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;