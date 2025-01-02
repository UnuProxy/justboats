import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { formatDateDDMMYYYY, formatDateTime } from '../utils/date.js';

const BookingDetails = ({ booking, onClose, onSave, onDelete }) => {
  // Toggle between "view" and "edit" mode
  const [isEditing, setIsEditing] = useState(false);

  // Local copy of the booking so changes don't overwrite prop immediately
  const [editedBooking, setEditedBooking] = useState(booking || {});

  // Ref for focusing the modal
  const modalRef = useRef(null);

  // Focus the modal as soon as it mounts
  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus();
    }
  }, []);

  // If the booking prop changes (e.g. user picks a new booking), reset local state
  useEffect(() => {
    if (booking) {
      setEditedBooking(booking);
    }
  }, [booking]);

  // If there's no booking selected, nothing to render
  if (!booking) return null;

  /**
   * -------------- HANDLERS --------------
   */

  // Generic handler for text inputs
  const handleInputChange = (field, value) => {
    setEditedBooking((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Special handler for numeric price fields so we can recalc final values
  const handlePriceChange = (field, value) => {
    setEditedBooking((prev) => {
      // Convert strings to numbers and ensure they're not NaN
      const newVal = parseFloat(value) || 0;
      let basePrice = field === 'basePrice' ? newVal : parseFloat(prev.basePrice) || 0;
      let discount = field === 'discount' ? newVal : parseFloat(prev.discount) || 0;

      // Recalculate
      const finalPrice = basePrice - discount;
      const deposit = finalPrice * 0.5;
      const remainingPayment = finalPrice - deposit;

      return {
        ...prev,
        [field]: newVal,
        finalPrice,
        deposit,
        remainingPayment,
      };
    });
  };

  // Confirm delete
  const handleDeleteBooking = () => {
    if (window.confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
      onDelete(booking.id);
    }
  };

  // Save changes
  const handleSaveBooking = () => {
    // Basic validation
    if (!editedBooking.clientName || !editedBooking.clientName.trim()) {
      alert('Client name is required.');
      return;
    }
    if (!editedBooking.bookingDate || !editedBooking.bookingDate.trim()) {
      alert('Booking date is required.');
      return;
    }

    // Pass updated booking to parent
    onSave(booking.id, editedBooking);
    setIsEditing(false);
  };

  // Stop modal from closing if clicking inside the content
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  /**
   * -------------- RENDER --------------
   */

  // Transfer info (only if `privateTransfer` is true)
  const transferInfo = editedBooking.privateTransfer ? (
    <div className="transfer-info mt-4">
      <h4 className="text-lg font-semibold mb-2">Transfer Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="pickup-details">
          <h5 className="font-medium">Pickup</h5>
          <p>
            <strong>Location:</strong> {editedBooking.pickupLocation || "N/A"}
          </p>
          {editedBooking.pickupAddress && (
            <p>
              <strong>Address:</strong> {editedBooking.pickupAddress}
            </p>
          )}
        </div>
        <div className="dropoff-details">
          <h5 className="font-medium">Drop-off</h5>
          <p>
            <strong>Location:</strong> {editedBooking.dropoffLocation || "N/A"}
          </p>
          {editedBooking.dropoffAddress && (
            <p>
              <strong>Address:</strong> {editedBooking.dropoffAddress}
            </p>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-details-title"
      onClick={onClose}
    >

      {/* Modal Content */}
        <div
          className="bg-white rounded-lg overflow-auto shadow-xl w-full h-full sm:h-auto sm:max-w-2xl"
          onClick={handleModalClick}
          ref={modalRef}
          style={{ maxHeight: 'calc(100vh - 150px)' }}
        >
        <div className="flex flex-col sm:flex-row sm:items-start p-6">
          <div className="w-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3
                id="booking-details-title"
                className="text-xl font-semibold text-gray-900"
              >
                Booking Details
              </h3>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label="Close Modal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Edit / Save Buttons */}
            <div className="flex justify-end mb-4">
              {isEditing ? (
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveBooking}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none"
                    aria-label="Save Changes"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none"
                    aria-label="Cancel Editing"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none"
                  aria-label="Edit Booking"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Main Content */}
            <div className="space-y-4">
              {/* Client Information */}
              <div>
                <h4 className="text-lg font-medium mb-2">Client Information</h4>
                <p>
                  <strong>Client Name:</strong>{" "}
                  {isEditing ? (
                    <input
                      type="text"
                      className="border rounded p-2 w-full"
                      value={editedBooking.clientName || ""}
                      onChange={(e) => handleInputChange("clientName", e.target.value)}
                    />
                  ) : (
                    editedBooking.clientName || "N/A"
                  )}
                </p>

                <p>
                  <strong>Client Type:</strong>{" "}
                  {editedBooking.clientType || "N/A"}
                </p>

                <p>
                  <strong>Phone:</strong>{" "}
                  {isEditing ? (
                    <input
                      type="text"
                      className="border rounded p-2 w-full"
                      value={editedBooking.clientPhone || ""}
                      onChange={(e) => handleInputChange("clientPhone", e.target.value)}
                    />
                  ) : (
                    editedBooking.clientPhone || "N/A"
                  )}
                </p>

                <p>
                  <strong>Email:</strong>{" "}
                  {isEditing ? (
                    <input
                      type="email"
                      className="border rounded p-2 w-full"
                      value={editedBooking.clientEmail || ""}
                      onChange={(e) => handleInputChange("clientEmail", e.target.value)}
                    />
                  ) : (
                    editedBooking.clientEmail || "N/A"
                  )}
                </p>

                {isEditing ? (
                  <p>
                    <strong>Passport:</strong>{" "}
                    <input
                      type="text"
                      className="border rounded p-2 w-full"
                      value={editedBooking.clientPassport || ""}
                      onChange={(e) => handleInputChange("clientPassport", e.target.value)}
                    />
                  </p>
                ) : editedBooking.clientPassport ? (
                  <p>
                    <strong>Passport:</strong> {editedBooking.clientPassport}
                  </p>
                ) : null}
              </div>

              {/* Boat Information */}
              <div>
                <h4 className="text-lg font-medium mb-2">Boat Information</h4>
                <p>
                  <strong>Boat Name:</strong>{" "}
                  {isEditing ? (
                    <input
                      type="text"
                      className="border rounded p-2 w-full"
                      value={editedBooking.boatName || ""}
                      onChange={(e) => handleInputChange("boatName", e.target.value)}
                    />
                  ) : (
                    editedBooking.boatName || "N/A"
                  )}
                </p>
                <p>
                  <strong>Company:</strong>{" "}
                  {isEditing ? (
                    <input
                      type="text"
                      className="border rounded p-2 w-full"
                      value={editedBooking.boatCompanyName || ""}
                      onChange={(e) => handleInputChange("boatCompanyName", e.target.value)}
                    />
                  ) : (
                    editedBooking.boatCompanyName || "N/A"
                  )}
                </p>
                <p>
                  <strong>Passengers:</strong>{" "}
                  {isEditing ? (
                    <input
                    type="number"
                    className="border rounded p-2 w-full"
                    value={isNaN(editedBooking.numberOfPassengers) ? '' : editedBooking.numberOfPassengers}
                    onChange={(e) => handleInputChange("numberOfPassengers", e.target.value)}
                  />
                  ) : editedBooking.numberOfPassengers >= 0 ? (
                    `${editedBooking.numberOfPassengers} passengers`
                  ) : (
                    "N/A"
                  )}
                </p>
              </div>

              {/* Booking Date & Time */}
              <div>
                <h4 className="text-lg font-medium mb-2">Booking Time</h4>
                <div>
                  <strong>Date:</strong>{" "}
                  {isEditing ? (
                    <input
                      type="date"
                      className="border rounded p-2 w-full"
                      value={editedBooking.bookingDate || ""}
                      onChange={(e) => handleInputChange("bookingDate", e.target.value)}
                    />
                  ) : editedBooking.bookingDate ? (
                    formatDateDDMMYYYY(editedBooking.bookingDate)
                  ) : (
                    "N/A"
                  )}
                </div>
                <div>
                  <strong>Time:</strong>{" "}
                  {isEditing ? (
                    <div className="flex flex-col sm:flex-row sm:space-x-2">
                      <input
                        type="time"
                        className="border rounded p-2 w-full sm:w-auto"
                        value={editedBooking.startTime || ""}
                        onChange={(e) => handleInputChange("startTime", e.target.value)}
                      />
                      <span className="self-center">-</span>
                      <input
                        type="time"
                        className="border rounded p-2 w-full sm:w-auto"
                        value={editedBooking.endTime || ""}
                        onChange={(e) => handleInputChange("endTime", e.target.value)}
                      />
                    </div>
                  ) : editedBooking.startTime && editedBooking.endTime ? (
                    `${editedBooking.startTime} - ${editedBooking.endTime}`
                  ) : (
                    "N/A"
                  )}
                </div>
              </div>

              {/* Payment Details */}
              <div>
                <h4 className="text-lg font-medium mb-2">Payment Details</h4>
                <p>
                  <strong>Base Price:</strong>{" "}
                  {isEditing ? (
                    <input
                      type="number"
                      className="border rounded p-2 w-full"
                      value={editedBooking.basePrice || 0}
                      onChange={(e) => handlePriceChange("basePrice", e.target.value)}
                    />
                  ) : editedBooking.basePrice >= 0 ? (
                    `€${editedBooking.basePrice.toFixed(2)}`
                  ) : (
                    "N/A"
                  )}
                </p>
                <p>
                  <strong>Discount:</strong>{" "}
                  {isEditing ? (
                    <input
                      type="number"
                      className="border rounded p-2 w-full"
                      value={editedBooking.discount || 0}
                      onChange={(e) => handlePriceChange("discount", e.target.value)}
                    />
                  ) : editedBooking.discount >= 0 ? (
                    `€${editedBooking.discount.toFixed(2)}`
                  ) : (
                    "N/A"
                  )}
                </p>
                <p>
                  <strong>Final Price:</strong>{" "}
                  {editedBooking.finalPrice >= 0
                    ? `€${editedBooking.finalPrice.toFixed(2)}`
                    : "N/A"}
                </p>
                <p>
                  <strong>Deposit:</strong>{" "}
                  {editedBooking.deposit >= 0
                    ? `€${editedBooking.deposit.toFixed(2)}`
                    : "N/A"}
                </p>
                <p>
                  <strong>Remaining:</strong>{" "}
                  {editedBooking.remainingPayment >= 0
                    ? `€${editedBooking.remainingPayment.toFixed(2)}`
                    : "N/A"}
                </p>
                <p>
                  <strong>Payment Status:</strong>{" "}
                  {isEditing ? (
                    <select
                      className="border rounded p-2 w-full"
                      value={editedBooking.paymentStatus || ""}
                      onChange={(e) => handleInputChange("paymentStatus", e.target.value)}
                    >
                      <option value="">Select Status</option>
                      <option value="No Payment">No Payment</option>
                      <option value="Partial">Partial Payment</option>
                      <option value="Completed">Completed</option>
                    </select>
                  ) : editedBooking.paymentStatus || "N/A"}
                </p>
              </div>

              {/* Transfer Info */}
              {transferInfo}

              {/* Additional Info */}
              <div>
                <h4 className="text-lg font-medium mb-2">Additional Information</h4>
                <p>
                  <strong>Notes:</strong>{" "}
                  {isEditing ? (
                    <textarea
                      className="border rounded p-2 w-full h-24"
                      value={editedBooking.clientNotes || ""}
                      onChange={(e) => handleInputChange("clientNotes", e.target.value)}
                    />
                  ) : editedBooking.clientNotes || "N/A"}
                </p>
                <p>
                  <strong>Created:</strong>{" "}
                  {editedBooking.createdAt
                    ? formatDateTime(editedBooking.createdAt)
                    : "N/A"}
                </p>
                <p>
                  <strong>Last Updated:</strong>{" "}
                  {editedBooking.lastUpdated
                    ? formatDateTime(editedBooking.lastUpdated)
                    : "N/A"}
                </p>
                {/* Display who added the booking if available in the booking object */}
                {editedBooking.createdBy && editedBooking.createdBy.displayName ? (
                  <p>
                    <strong>Added by:</strong> {editedBooking.createdBy.displayName}
                  </p>
                ) : editedBooking.createdBy && editedBooking.createdBy.email ? (
                  <p>
                    <strong>Added by:</strong> {editedBooking.createdBy.email}
                  </p>
                ) : (
                  <p>
                    <strong>Added by:</strong> N/A
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-2">
          {!booking.isCancelled && (
            <button
              type="button"
              className="inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-red-500 text-base font-medium text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
              onClick={handleDeleteBooking}
              aria-label="Delete Booking"
            >
              Delete Booking
            </button>
          )}
          <button
            type="button"
            className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
            onClick={onClose}
            aria-label="Close Modal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

BookingDetails.propTypes = {
  booking: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default BookingDetails;



