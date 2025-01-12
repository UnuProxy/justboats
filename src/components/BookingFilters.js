
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react'; 

const BookingFilters = ({ filters, onFilterChange, onClear, onApply }) => {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
            {/* Mobile Filter Toggle */}
            <div className="md:hidden flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-700">Filters</h3>
                <button 
                    onClick={() => setIsMobileOpen(!isMobileOpen)}
                    className="text-gray-600 hover:text-gray-800 focus:outline-none"
                    aria-label="Toggle Filters"
                >
                    {isMobileOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
            </div>

            {/* Filters Container */}
            <div className={`${isMobileOpen ? 'block' : 'hidden'} md:block`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    {/* From Date */}
                    <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1">From Date:</label>
                        <input
                            type="date"
                            className="border rounded p-2 text-sm"
                            value={filters.dateFrom}
                            onChange={e => onFilterChange('dateFrom', e.target.value)}
                            onBlur={(e) => {
                                if (e.target.value && !filters.dateTo) {
                                    onFilterChange('dateTo', e.target.value)
                                }
                            }}
                        />
                    </div>
                    
                    {/* To Date */}
                    <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1">To Date:</label>
                        <input
                            type="date"
                            className="border rounded p-2 text-sm"
                            value={filters.dateTo}
                            onChange={e => onFilterChange('dateTo', e.target.value)}
                        />
                    </div>
                    
                    {/* Client Type */}
                    <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1">Client Type:</label>
                        <select
                            className="border rounded p-2 text-sm"
                            value={filters.clientType}
                            onChange={e => onFilterChange('clientType', e.target.value)}
                        >
                            <option value="">All</option>
                            <option value="Direct">Direct</option>
                            <option value="Hotel">Hotel</option>
                            <option value="Collaborator">Collaborator</option>
                        </select>
                    </div>
                    
                    {/* Payment Status */}
                    <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1">Payment Status:</label>
                        <select
                            className="border rounded p-2 text-sm"
                            value={filters.paymentStatus}
                            onChange={e => onFilterChange('paymentStatus', e.target.value)}
                        >
                            <option value="">All</option>
                            <option value="No Payment">Unpaid</option>
                            <option value="Partial">Partial</option>
                            <option value="Completed">Paid</option>
                        </select>
                    </div>
                    
                    {/* Booking Status */}
                    <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1">Booking Status:</label>
                        <select
                            className="border rounded p-2 text-sm"
                            value={filters.bookingStatus}
                            onChange={e => onFilterChange('bookingStatus', e.target.value)}
                        >
                            <option value="">All</option>
                            <option value="active">Active</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex flex-col sm:flex-row sm:justify-end sm:space-x-2 space-y-2 sm:space-y-0">
                    <button 
                        onClick={onClear}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                        aria-label="Clear Filters"
                    >
                        Clear
                    </button>
                    <button 
                        onClick={onApply}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        aria-label="Apply Filters"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );

};

export default BookingFilters;

