import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { formatDateDDMMYYYY, formatDateTime } from "../utils/date.js";
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { format } from "date-fns";
import { db } from "../firebase/firebaseConfig";

const BookingDetails = ({ booking, onClose, onSave, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const modalRef = useRef(null);  
  const [linkedExpenses, setLinkedExpenses] = useState([]);
  const [editedBooking, setEditedBooking] = useState({
    ...booking,
    basePrice: booking?.basePrice || 0,
    discount: booking?.discount || 0,
    finalPrice: booking?.finalPrice || 0,
    deposit: booking?.deposit || 0,
    remainingPayment: booking?.remainingPayment || 0,
    paymentStatus: booking?.paymentStatus || 'No Payment'
  });
  
  const handleExpensePaymentStatusChange = async (expenseId, newStatus) => {
    console.log("Changing expense:", expenseId, "to", newStatus);
    try {
      
      await updateDoc(doc(db, "expenses", expenseId), { paymentStatus: newStatus });
      console.log("...Firestore update completed successfully!");
  
      setLinkedExpenses((prevExpenses) => {
        return prevExpenses.map((parentExp) => {
          let updatedParent = parentExp; 
      
          if (parentExp.id === expenseId) {
            updatedParent = { ...parentExp, paymentStatus: newStatus };
          }
      
          if (Array.isArray(parentExp.subExpenses) && parentExp.subExpenses.length) {
            const updatedSubExpenses = parentExp.subExpenses.map((sub) => {
              if (sub.id === expenseId) {
                
                return { ...sub, paymentStatus: newStatus };
              }
              return sub;
            });
            
            updatedParent = { ...updatedParent, subExpenses: updatedSubExpenses };
          }
      
          return updatedParent;
        });
      });
      
    } catch (error) {
      console.error("Error updating payment status:", error);
      alert("Failed to update payment status. Please try again.");
    }
  };

  const ExpensesSection = () => {
    const calculateTotal = () => {
      return linkedExpenses.reduce((sum, expense) => {
        const mainAmount = Number(expense.amount) || 0;
        const subExpensesTotal = expense.subExpenses?.reduce(
          (subSum, subExp) => subSum + (Number(subExp.amount) || 0),
          0
        ) || 0;
        return sum + mainAmount + subExpensesTotal;
      }, 0);
    };

    return (
      <div className="p-4 border rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-bold">Linked Expenses</h4>
          <div className="text-sm text-gray-600">
            Total Expenses: €{calculateTotal().toFixed(2)}
          </div>
        </div>

        {linkedExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {linkedExpenses.map(expense => (
                  <React.Fragment key={expense.id}>
                    {/* Parent Expense */}
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {format(new Date(expense.date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{expense.category}</td>
                      <td className="px-4 py-2">{expense.description}</td>
                      <td className="px-4 py-2 whitespace-nowrap">€{Number(expense.amount).toFixed(2)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          onClick={() =>
                            handleExpensePaymentStatusChange(
                              expense.id,
                              expense.paymentStatus === 'paid' ? 'pending' : 'paid'
                            )
                          }
                          className={`
                            px-2 py-1 rounded-full text-xs font-medium
                            ${
                              expense.paymentStatus === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }
                          `}
                        >
                          {expense.paymentStatus || 'pending'}
                        </button>
                      </td>
                    </tr>

                    {/* Sub-Expenses */}
                    {expense.subExpenses?.map(subExpense => (
                      <tr key={subExpense.id} className="bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap pl-8">
                          {format(new Date(subExpense.date), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">{subExpense.category}</td>
                        <td className="px-4 py-2">{subExpense.description}</td>
                        <td className="px-4 py-2 whitespace-nowrap">€{Number(subExpense.amount).toFixed(2)}</td>
                        <td>
                          <span
                            onClick={() =>
                              handleExpensePaymentStatusChange(
                                subExpense.id,
                                subExpense.paymentStatus === 'paid' ? 'pending' : 'paid'
                              )
                            }
                            className={`
                              cursor-pointer
                              px-2 py-1 rounded-full text-xs font-medium
                              ${
                                subExpense.paymentStatus === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }
                            `}
                          >
                            {subExpense.paymentStatus || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No expenses linked to this booking</p>
        )}
      </div>
    );
  };

    /**
   * 1) Focus the modal when it opens
   */
    useEffect(() => {
      if (modalRef.current) {
        modalRef.current.focus();
      }
    }, []);
  
    /**
     * 2) Real-time listener for expenses
     */
    useEffect(() => {
      if (!booking) return;
      
      // Always update local booking data
      setEditedBooking(booking);
  
      const expensesRef = collection(db, "expenses");
      const q = query(expensesRef, where("bookingId", "==", booking.id));
  
      // Set up the real-time listener
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const allExpenses = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        
        // Separate parent from child
        const parentExpenses = allExpenses.filter(exp => !exp.parentId);
        const childExpenses  = allExpenses.filter(exp => exp.parentId);
  
        // Attach children to each parent
        const combinedExpenses = parentExpenses.map(parent => ({
          ...parent,
          subExpenses: childExpenses.filter(child => child.parentId === parent.id)
        }));
  
        setLinkedExpenses(combinedExpenses);
      });
  
      // Clean up listener on unmount
      return () => unsubscribe();
    }, [booking]);
  
  if (!booking) return null;


  const handleInputChange = (field, value) => {
    setEditedBooking((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  

  const handlePriceChange = (field, value) => {
    setEditedBooking((prev) => {
      const newVal = parseFloat(value) || 0;
      let basePrice = field === "basePrice" ? newVal : parseFloat(prev.basePrice) || 0;
      let discount = field === "discount" ? newVal : parseFloat(prev.discount) || 0;
  
      const finalPrice = Math.max(0, basePrice - discount);
      const deposit = finalPrice * 0.5; // 50% deposit
      const remainingPayment = finalPrice - deposit;
  
      return {
        ...prev,
        [field]: newVal,
        finalPrice,
        deposit,
        remainingPayment,
        paymentMethod: prev.paymentMethod || '',
      };
    });
  };

  const handleDeleteBooking = () => {
    if (
      window.confirm(
        "Are you sure you want to delete this booking? This action cannot be undone."
      )
    ) {
      onDelete(booking.id);
    }
  };

  const handleSaveBooking = () => {
    if (!editedBooking.clientName || !editedBooking.clientName.trim()) {
      alert("Client name is required.");
      return;
    }
    if (!editedBooking.bookingDate || !editedBooking.bookingDate.trim()) {
      alert("Booking date is required.");
      return;
    }
  
    onSave(booking.id, editedBooking);
    setIsEditing(false);
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 sm:py-12 bg-black bg-opacity-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-details-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full"
        onClick={handleModalClick}
        ref={modalRef}
      >
        <div className="bg-gray-100 p-4 flex justify-between items-center rounded-t-lg">
          <h3
            id="booking-details-title"
            className="text-xl font-bold text-gray-800"
          >
            Booking Details
          </h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 focus:outline-none"
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

        <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 16rem)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="p-4 border rounded-lg">
                <h4 className="text-lg font-bold mb-3">Client Information</h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Client Name:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.clientName || ""}
                      onChange={(e) =>
                        handleInputChange("clientName", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">{editedBooking.clientName || "N/A"}</p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Client Type:
                  </label>
                  <p className="mt-1">{editedBooking.clientType || "N/A"}</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Phone:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.clientPhone || ""}
                      onChange={(e) =>
                        handleInputChange("clientPhone", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">{editedBooking.clientPhone || "N/A"}</p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Email:
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.clientEmail || ""}
                      onChange={(e) =>
                        handleInputChange("clientEmail", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">{editedBooking.clientEmail || "N/A"}</p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Passport:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.clientPassport || ""}
                      onChange={(e) =>
                        handleInputChange("clientPassport", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">
                      {editedBooking.clientPassport || "N/A"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="p-4 border rounded-lg mb-4">
                <h4 className="text-lg font-bold mb-3">Booking Details</h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Boat Name:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.boatName || ""}
                      onChange={(e) =>
                        handleInputChange("boatName", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">{editedBooking.boatName || "N/A"}</p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Company:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.boatCompanyName || ""}
                      onChange={(e) =>
                        handleInputChange("boatCompanyName", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">
                      {editedBooking.boatCompanyName || "N/A"}
                    </p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Passengers:
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={
                        isNaN(editedBooking.numberOfPassengers)
                          ? ""
                          : editedBooking.numberOfPassengers
                      }
                      onChange={(e) =>
                        handleInputChange("numberOfPassengers", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">
                      {editedBooking.numberOfPassengers >= 0
                        ? `${editedBooking.numberOfPassengers} passengers`
                        : "N/A"}
                    </p>
                  )}
                </div>
                <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Restaurant Name:
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={editedBooking.restaurantName || ''}
                    onChange={(e) =>
                      handleInputChange("restaurantName", e.target.value)
                    }
                    placeholder="Enter restaurant name"
                  />
                ) : (
                  <p className="mt-1">{editedBooking.restaurantName || 'N/A'}</p>
                )}
              </div>
              </div>

              {editedBooking.privateTransfer && (
                <div className="p-4 border rounded-lg">
                  <h4 className="text-lg font-bold mb-3">Transfer Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium">Pickup</h5>
                      <p>
                        <span className="font-semibold">Location:</span>{" "}
                        {editedBooking.pickupLocation || "N/A"}
                      </p>
                      {editedBooking.pickupAddress && (
                        <p>
                          <span className="font-semibold">Address:</span>{" "}
                          {editedBooking.pickupAddress}
                        </p>
                      )}
                    </div>
                    <div>
                      <h5 className="font-medium">Drop-off</h5>
                      <p>
                        <span className="font-semibold">Location:</span>{" "}
                        {editedBooking.dropoffLocation || "N/A"}
                      </p>
                      {editedBooking.dropoffAddress && (
                        <p>
                          <span className="font-semibold">Address:</span>{" "}
                          {editedBooking.dropoffAddress}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

    <div className="col-span-full">
              <div className="p-4 border rounded-lg">
                <h4 className="text-lg font-bold mb-3">Booking Time</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Date:
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={editedBooking.bookingDate || ""}
                        onChange={(e) =>
                          handleInputChange("bookingDate", e.target.value)
                        }
                      />
                    ) : (
                      <p className="mt-1">
                        {editedBooking.bookingDate
                          ? formatDateDDMMYYYY(editedBooking.bookingDate)
                          : "N/A"}
                      </p>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Time:
                    </label>
                    {isEditing ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="time"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={editedBooking.startTime || ""}
                          onChange={(e) =>
                            handleInputChange("startTime", e.target.value)
                          }
                        />
                        <span>-</span>
                        <input
                          type="time"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={editedBooking.endTime || ""}
                          onChange={(e) =>
                            handleInputChange("endTime", e.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <p className="mt-1">
                        {editedBooking.startTime && editedBooking.endTime
                          ? `${editedBooking.startTime} - ${editedBooking.endTime}`
                          : "N/A"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
    </div>

       

    <div className="col-span-full">
    <div className="p-4 border rounded-lg">
    <h4 className="text-lg font-bold mb-4">Payment Details</h4>
    
    {/* Price Row */}
    <div className="flex justify-between mb-8">
      <div>
        <label className="block text-sm font-medium text-gray-700">Base Price:</label>
        {isEditing ? (
          <input
            type="number"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={editedBooking.basePrice || 0}
            onChange={(e) => handlePriceChange("basePrice", e.target.value)}
          />
        ) : (
          <p className="text-lg">€{editedBooking.basePrice?.toFixed(2) || '0.00'}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Discount:</label>
        {isEditing ? (
          <input
            type="number"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={editedBooking.discount || 0}
            onChange={(e) => handlePriceChange("discount", e.target.value)}
          />
        ) : (
          <p className="text-lg">€{editedBooking.discount?.toFixed(2) || '0.00'}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Final Price:</label>
        <p className="text-lg text-blue-600">€{editedBooking.finalPrice?.toFixed(2) || '0.00'}</p>
      </div>
    </div>

    <div className="col-span-full">
    <ExpensesSection />
    </div>   


    {/* Payment Information */}
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex justify-between mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Initial Payment:</label>
          <p className="text-lg">€{editedBooking.deposit?.toFixed(2) || '0.00'}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Remaining Payment:</label>
          <p className="text-lg">€{editedBooking.remainingPayment?.toFixed(2) || '0.00'}</p>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700">Payment Status:</label>
        {isEditing ? (
          <select
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={editedBooking.paymentStatus || ""}
            onChange={(e) => handleInputChange("paymentStatus", e.target.value)}
          >
            <option value="No Payment">No Payment</option>
            <option value="Partial">Partial</option>
            <option value="Completed">Completed</option>
          </select>
        ) : (
          <p className={`
            ${editedBooking.paymentStatus === 'Completed' ? 'text-green-600' :
              editedBooking.paymentStatus === 'Partial' ? 'text-orange-600' :
              'text-red-600'}
          `}>
            {editedBooking.paymentStatus || "N/A"}
          </p>
        )}
      </div>
    </div>
    </div>
    </div>

    <div className="col-span-full">
              <div className="p-4 border rounded-lg">
                <h4 className="text-lg font-bold mb-3">
                  Additional Information
                </h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Notes:
                  </label>
                  {isEditing ? (
                    <textarea
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24"
                      value={editedBooking.clientNotes || ""}
                      onChange={(e) =>
                        handleInputChange("clientNotes", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">{editedBooking.clientNotes || "N/A"}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Created:
                    </label>
                    <p className="mt-1">
                      {editedBooking.createdAt
                        ? formatDateTime(editedBooking.createdAt)
                        : "N/A"}
                    </p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Last Updated:
                    </label>
                    <p className="mt-1">
                      {editedBooking.lastUpdated
                        ? formatDateTime(editedBooking.lastUpdated)
                        : "N/A"}
                    </p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Added by:
                    </label>
                    <p className="mt-1">
                      {editedBooking.createdBy &&
                      editedBooking.createdBy.displayName
                        ? editedBooking.createdBy.displayName
                        : editedBooking.createdBy && editedBooking.createdBy.email
                        ? editedBooking.createdBy.email
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
    </div>
    </div>
    </div>

        <div className="bg-gray-100 p-4 flex justify-end space-x-2 rounded-b-lg">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveBooking}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                aria-label="Save Changes"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                aria-label="Cancel Editing"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-label="Edit Booking"
            >
              Edit
            </button>
          )}
          {!booking.isCancelled && (
            <button
              type="button"
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
              onClick={handleDeleteBooking}
              aria-label="Delete Booking"
            >
              Delete
            </button>
          )}
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



