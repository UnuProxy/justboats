import React from 'react';
import { Clock, Users } from 'lucide-react';

const BookingItem = ({ booking, onBookingSelect }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'No Payment':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  // Format date to DD/MM/YYYY
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const renderClientInfo = () => {
    if (booking.clientType === 'Direct') {
      return (
        <h3 className="font-semibold text-gray-900">
          {booking.clientName}
          <span className="ml-2 text-sm text-gray-500">(Direct)</span>
        </h3>
      );
    }
    
    
    return (
      <h3 className="font-semibold text-gray-900">
        {booking.clientName}
        <span className="ml-2 text-sm text-gray-500">
          ({booking.partnerName || booking.clientType})
        </span>
      </h3>
    );
  };

  return (
    <div 
      onClick={() => onBookingSelect(booking)}
      className="border-b last:border-b-0 hover:bg-gray-50 active:bg-gray-100 cursor-pointer"
    >
      <div className="p-4">
        {/* Date and Status Row */}
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-900">
            {formatDate(booking.bookingDate)}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(booking.paymentStatus)}`}>
            {booking.paymentStatus}
          </span>
        </div>

        {/* Client and Boat Info */}
        <div className="space-y-1">
          <div className="flex justify-between items-start">
            {renderClientInfo()}
            <span className="font-semibold text-gray-900">
              €{booking.finalPrice}
            </span>
          </div>
          <p className="text-sm text-gray-600">{booking.boatName}</p>
        </div>

        {/* Time and Passengers */}
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            {booking.startTime} - {booking.endTime}
          </div>
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            {booking.numberOfPassengers}
          </div>
        </div>

        {/* Cancelled Badge */}
        {booking.isCancelled && (
          <div className="mt-2">
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">
              Cancelled
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingItem;
