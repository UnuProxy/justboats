import React, { useState } from 'react';
import { X, Download, FilterX } from 'lucide-react';
import * as XLSX from 'xlsx';

const BookingHistoryModal = ({ 
  showHistory, 
  setShowHistory, 
  selectedPartnerHistory, 
  setSelectedPartnerHistory,
  bookingHistory,
  historyLoading 
}) => {
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const resetFilters = () => {
    setDateRange({ startDate: '', endDate: '' });
    setMinAmount('');
    setMaxAmount('');
  };

  const filteredBookings = bookingHistory.filter(booking => {
    const bookingDate = new Date(booking.bookingDetails.date);
    const bookingAmount = parseFloat(booking.pricing.finalPrice);

    if (dateRange.startDate && bookingDate < new Date(dateRange.startDate)) return false;
    if (dateRange.endDate && bookingDate > new Date(dateRange.endDate)) return false;
    if (minAmount && bookingAmount < parseFloat(minAmount)) return false;
    if (maxAmount && bookingAmount > parseFloat(maxAmount)) return false;

    return true;
  });

  const downloadExcel = () => {
    const exportData = filteredBookings.map(booking => ({
      'Date': new Date(booking.bookingDetails.date).toLocaleDateString(),
      'Client Name': booking.clientDetails.name,
      'Boat': booking.bookingDetails.boatName,
      'Amount': `€${booking.pricing.finalPrice}`,
      'Commission Rate': `${booking.commissionRate}%`,
      'Commission Amount': `€${(booking.pricing.finalPrice * booking.commissionRate / 100).toFixed(2)}`
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings');

    let filename = `${selectedPartnerHistory.name}_bookings`;
    if (dateRange.startDate || dateRange.endDate) {
      filename += `_${dateRange.startDate || 'start'}_to_${dateRange.endDate || 'end'}`;
    }
    filename += '.xlsx';

    XLSX.writeFile(wb, filename);
  };

  if (!showHistory) return null;

  return React.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
  }, 
    React.createElement('div', {
      className: 'bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden'
    }, [
      // Header
      React.createElement('div', {
        key: 'header',
        className: 'p-6 border-b'
      }, 
        React.createElement('div', {
          className: 'flex justify-between items-center'
        }, [
          React.createElement('h3', {
            key: 'title',
            className: 'text-xl font-semibold'
          }, `Booking History - ${selectedPartnerHistory?.name}`),
          React.createElement('button', {
            key: 'close-button',
            onClick: () => {
              setShowHistory(false);
              setSelectedPartnerHistory(null);
              resetFilters();
            },
            className: 'text-gray-500 hover:text-gray-700'
          }, React.createElement(X, { className: 'h-6 w-6' }))
        ])
      ),

      // Filters Section
      React.createElement('div', {
        key: 'filters',
        className: 'p-4 border-b bg-gray-50'
      }, [
        React.createElement('div', {
          key: 'filter-grid',
          className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
        }, [
          // Start Date Filter
          React.createElement('div', { key: 'start-date' }, [
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700'
            }, 'Start Date'),
            React.createElement('input', {
              type: 'date',
              className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500',
              value: dateRange.startDate,
              onChange: (e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))
            })
          ]),
          // End Date Filter
          React.createElement('div', { key: 'end-date' }, [
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700'
            }, 'End Date'),
            React.createElement('input', {
              type: 'date',
              className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500',
              value: dateRange.endDate,
              onChange: (e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))
            })
          ]),
          // Min Amount Filter
          React.createElement('div', { key: 'min-amount' }, [
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700'
            }, 'Min Amount (€)'),
            React.createElement('input', {
              type: 'number',
              className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500',
              value: minAmount,
              onChange: (e) => setMinAmount(e.target.value)
            })
          ]),
          // Max Amount Filter
          React.createElement('div', { key: 'max-amount' }, [
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700'
            }, 'Max Amount (€)'),
            React.createElement('input', {
              type: 'number',
              className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500',
              value: maxAmount,
              onChange: (e) => setMaxAmount(e.target.value)
            })
          ])
        ]),
        
        // Filter Actions
        React.createElement('div', {
          key: 'filter-actions',
          className: 'mt-4 flex justify-between'
        }, [
          React.createElement('button', {
            key: 'reset-button',
            onClick: resetFilters,
            className: 'flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50'
          }, [
            React.createElement(FilterX, { key: 'filter-icon', className: 'mr-2 h-4 w-4' }),
            'Reset Filters'
          ]),
          React.createElement('button', {
            key: 'download-button',
            onClick: downloadExcel,
            disabled: filteredBookings.length === 0,
            className: 'flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700'
          }, [
            React.createElement(Download, { key: 'download-icon', className: 'mr-2 h-4 w-4' }),
            'Download Excel'
          ])
        ])
      ]),

      // Bookings List
      React.createElement('div', {
        key: 'bookings-list',
        className: 'p-6 overflow-y-auto max-h-[calc(90vh-350px)]'
      }, 
        historyLoading ? 
          React.createElement('div', {
            className: 'flex justify-center items-center h-32'
          }, 
            React.createElement('div', {
              className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900'
            })
          ) :
          filteredBookings.length === 0 ?
            React.createElement('p', {
              className: 'text-center text-gray-500'
            }, 'No bookings found matching the selected filters.') :
            React.createElement('div', {
              className: 'space-y-4'
            }, 
              filteredBookings.map(booking => 
                React.createElement('div', {
                  key: booking.id,
                  className: 'border rounded-lg p-4 hover:bg-gray-50'
                }, 
                  React.createElement('div', {
                    className: 'flex justify-between items-start'
                  }, [
                    React.createElement('div', { key: 'booking-info' }, [
                      React.createElement('p', { 
                        key: 'client-name',
                        className: 'font-semibold' 
                      }, booking.clientDetails.name),
                      React.createElement('p', {
                        key: 'booking-date',
                        className: 'text-sm text-gray-600'
                      }, `Date: ${new Date(booking.bookingDetails.date).toLocaleDateString()}`),
                      React.createElement('p', {
                        key: 'boat-name',
                        className: 'text-sm text-gray-600'
                      }, `Boat: ${booking.bookingDetails.boatName}`)
                    ]),
                    React.createElement('div', { 
                      key: 'booking-amounts',
                      className: 'text-right' 
                    }, [
                      React.createElement('p', {
                        key: 'price',
                        className: 'font-semibold'
                      }, `€${booking.pricing.finalPrice}`),
                      React.createElement('p', {
                        key: 'commission-rate',
                        className: 'text-sm text-blue-600'
                      }, `Commission Rate: ${booking.commissionRate}%`),
                      React.createElement('p', {
                        key: 'commission-amount',
                        className: 'text-sm text-green-600'
                      }, `Commission: €${(booking.pricing.finalPrice * booking.commissionRate / 100).toFixed(2)}`)
                    ])
                  ])
                )
              )
            )
      )
    ])
  );
};

export default BookingHistoryModal;