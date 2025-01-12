import React, { useState, useEffect } from 'react';
import { DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import axios from 'axios';

const PaymentTracking = () => {
    const [bookings, setBookings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    useEffect(() => {
        // Fetch booking data from your backend API
        axios.get('/api/bookings') // Replace with your API endpoint
            .then(response => {
                setBookings(response.data);
            })
            .catch(error => {
                console.error('Error fetching bookings:', error);
            });
    }, []);

    // Calculate summary values
    const fullyPaid = bookings.reduce((sum, booking) => booking.status === 'Fully Paid' ? sum + booking.totalAmount : sum, 0);
    const depositsPending = bookings.reduce((sum, booking) => booking.depositPaid < booking.totalAmount && booking.status !== 'Fully Paid' ? sum + booking.depositPaid : sum, 0);
    const outstanding = bookings.reduce((sum, booking) => booking.balance > 0 ? sum + booking.balance : sum, 0);

    // Filtered bookings for table display
    const filteredBookings = bookings.filter(booking => {
        const matchesSearch = booking.bookingRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              booking.customer.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus ? booking.status === filterStatus : true;
        return matchesSearch && matchesFilter;
    });

    const handleMarkAsPaid = (bookingRef) => {
        // Implement your logic to mark a booking as paid
        console.log(`Mark booking ${bookingRef} as paid`);
    };

    return (
        <div className="bg-white rounded-lg shadow-md">
            <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Payment Tracking</h2>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600">Fully Paid</p>
                                <p className="text-2xl font-bold text-green-700">€{fullyPaid}</p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-yellow-600">Deposits Pending</p>
                                <p className="text-2xl font-bold text-yellow-700">€{depositsPending}</p>
                            </div>
                            <DollarSign className="w-8 h-8 text-yellow-500" />
                        </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-red-600">Outstanding</p>
                                <p className="text-2xl font-bold text-red-700">€{outstanding}</p>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex justify-between mb-4">
                    <input
                        type="text"
                        className="border p-2 rounded"
                        placeholder="Search by Booking Ref or Customer"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <select
                        className="border p-2 rounded"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="">Filter by Status</option>
                        <option value="Fully Paid">Fully Paid</option>
                        <option value="Pending">Pending</option>
                        <option value="Outstanding">Outstanding</option>
                    </select>
                </div>

                {/* Bookings Table */}
                <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Booking Ref', 'Customer', 'Total', 'Deposit', 'Balance', 'Status', 'Actions'].map(header => (
                                    <th
                                        key={header}
                                        className="px-4 py-2 text-left text-xs font-medium text-gray-500"
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredBookings.map(booking => (
                                <tr key={booking.bookingRef}>
                                    <td className="px-4 py-2">{booking.bookingRef}</td>
                                    <td className="px-4 py-2">{booking.customer}</td>
                                    <td className="px-4 py-2">€{booking.totalAmount}</td>
                                    <td className="px-4 py-2">€{booking.depositPaid}</td>
                                    <td className="px-4 py-2">€{booking.balance}</td>
                                    <td className="px-4 py-2">{booking.status}</td>
                                    <td className="px-4 py-2">
                                        <button
                                            className="text-blue-500 underline"
                                            onClick={() => handleMarkAsPaid(booking.bookingRef)}
                                        >
                                            Mark as Paid
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PaymentTracking;
