// src/components/PaymentTracking.js
import React from 'react';
import { DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';

const PaymentTracking = () => {
    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg shadow-md' },
        React.createElement(
            'div',
            { className: 'p-6' },
            React.createElement('h2', { className: 'text-xl font-semibold mb-4' }, 'Payment Tracking'),
            React.createElement(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-3 gap-4 mb-6' },
                React.createElement(
                    'div',
                    { className: 'bg-green-50 p-4 rounded-lg' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-between' },
                        React.createElement(
                            'div',
                            null,
                            React.createElement('p', { className: 'text-sm text-green-600' }, 'Fully Paid'),
                            React.createElement('p', { className: 'text-2xl font-bold text-green-700' }, '€0')
                        ),
                        React.createElement(CheckCircle, { className: 'w-8 h-8 text-green-500' })
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'bg-yellow-50 p-4 rounded-lg' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-between' },
                        React.createElement(
                            'div',
                            null,
                            React.createElement('p', { className: 'text-sm text-yellow-600' }, 'Deposits Pending'),
                            React.createElement('p', { className: 'text-2xl font-bold text-yellow-700' }, '€0')
                        ),
                        React.createElement(DollarSign, { className: 'w-8 h-8 text-yellow-500' })
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'bg-red-50 p-4 rounded-lg' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-between' },
                        React.createElement(
                            'div',
                            null,
                            React.createElement('p', { className: 'text-sm text-red-600' }, 'Outstanding'),
                            React.createElement('p', { className: 'text-2xl font-bold text-red-700' }, '€0')
                        ),
                        React.createElement(AlertTriangle, { className: 'w-8 h-8 text-red-500' })
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'border rounded-lg overflow-hidden' },
                React.createElement(
                    'table',
                    { className: 'min-w-full' },
                    React.createElement(
                        'thead',
                        { className: 'bg-gray-50' },
                        React.createElement(
                            'tr',
                            null,
                            ['Booking Ref', 'Customer', 'Total', 'Deposit', 'Balance', 'Status', 'Actions'].map(header =>
                                React.createElement(
                                    'th',
                                    { 
                                        key: header,
                                        className: 'px-4 py-2 text-left text-xs font-medium text-gray-500'
                                    },
                                    header
                                )
                            )
                        )
                    ),
                    React.createElement('tbody', { className: 'divide-y divide-gray-200' })
                )
            )
        )
    );
};

export default PaymentTracking;