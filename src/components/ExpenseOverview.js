import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc, getDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { format } from 'date-fns';
import Papa from 'papaparse';
import { Trash2, ChevronDown, ChevronUp, FileText, RefreshCw, Download, Plus } from 'lucide-react';


const ExpenseOverview = () => {
  const [expenses, setExpenses] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [selectedClientParentId, setSelectedClientParentId] = useState(null);
  const [itemsPerPage] = useState(10); 
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const ClientExpenseRow = ({ expense, onDelete, onAddSubExpense, isSubExpense = false, onUpdateStatus }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasSubExpenses = expense.subExpenses?.length > 0;
    
    // Calculate total including all sub-expenses
    const calculateTotalAmount = (exp) => {
      const subExpensesTotal = exp.subExpenses?.reduce((sum, subExp) => sum + Number(subExp.amount), 0) || 0;
      return Number(exp.amount) + subExpensesTotal;
    };
  
    return (
      <>
        <tr className={`hover:bg-gray-50 ${isSubExpense ? 'bg-gray-50' : ''}`}>
          <td className={`px-6 py-4 whitespace-nowrap ${isSubExpense ? 'pl-12' : ''}`}>
            {format(new Date(expense.date), 'dd/MM/yyyy')}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">{expense.category}</td>
          <td className="px-6 py-4">{expense.description}</td>
          <td className="px-6 py-4 whitespace-nowrap font-medium">
            <div className="flex flex-col">
              <span>€{Number(expense.amount).toFixed(2)}</span>
              {hasSubExpenses && (
                <span className="text-sm text-gray-500">
                  Total: €{calculateTotalAmount(expense).toFixed(2)}
                </span>
              )}
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <button
              onClick={() => onUpdateStatus(expense.id, expense.paymentStatus || 'pending')}
              className={`px-3 py-1 rounded-full text-xs font-medium
                ${expense.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
            >
              {expense.paymentStatus || 'Pending'}
            </button>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            {expense.imageURL && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleViewDocument(expense.imageURL)}
                  className="text-blue-500 hover:text-blue-700"
                  title="View Document"
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  onClick={() => downloadDocument(expense.imageURL, `expense_${expense.id}`)}
                  className="text-green-500 hover:text-green-700"
                  title="Download Document"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center space-x-2">
              {!isSubExpense && (
                <button
                  onClick={() => onAddSubExpense(expense.id)}
                  className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
                  title="Add Sub-expense"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Add</span>
                </button>
              )}
              {hasSubExpenses && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  {isExpanded ? 
                    <><ChevronUp className="h-4 w-4" /> <span className="text-sm">Hide</span></> : 
                    <><ChevronDown className="h-4 w-4" /> <span className="text-sm">Show ({expense.subExpenses.length})</span></>
                  }
                </button>
              )}
              <button
                onClick={() => onDelete(expense.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
        {isExpanded && hasSubExpenses && expense.subExpenses.map(subExpense => (
          <ClientExpenseRow
            key={subExpense.id}
            expense={subExpense}
            onDelete={onDelete}
            onAddSubExpense={onAddSubExpense}
            onUpdateStatus={onUpdateStatus}
            isSubExpense={true}
          />
        ))}
      </>
    );
  };
  // Pagination component
  const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) return null;

    return (
      <div className="flex justify-center items-center space-x-2 mt-4 mb-6">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded-md bg-white border border-gray-300 text-sm disabled:opacity-50"
        >
          Previous
        </button>
        
        <span className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded-md bg-white border border-gray-300 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    );
  };

// Pagination logic
const paginateData = (items, currentPage, itemsPerPage) => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return items.slice(startIndex, startIndex + itemsPerPage);
};

const AddExpenseModal = ({ isOpen, onClose, onSubmit, parentExpenseId }) => {
  const [newExpense, setNewExpense] = useState({
    amount: '',
    description: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    imageURL: '',
    bookingId: ''
  });
  const [bookings, setBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // Fetch active bookings when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchActiveBookings = async () => {
        setIsLoadingBookings(true);
        try {
          const bookingsRef = collection(db, 'bookings');
          const q = query(bookingsRef, orderBy('bookingDetails.date', 'desc'));
          const querySnapshot = await getDocs(q);
          
          const bookingsData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setBookings(bookingsData);
        } catch (error) {
          console.error('Error fetching bookings:', error);
        } finally {
          setIsLoadingBookings(false);
        }
      };

      fetchActiveBookings();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">
          {parentExpenseId ? 'Add Sub-expense' : 'Add New Expense'}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <input
              type="number"
              value={newExpense.amount}
              onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          {/* Booking Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Link to Booking (Optional)</label>
            <select
              value={newExpense.bookingId}
              onChange={(e) => setNewExpense({...newExpense, bookingId: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={isLoadingBookings}
            >
              <option value="">Select a booking</option>
              {bookings.map(booking => (
                <option key={booking.id} value={booking.id}>
                  {booking.bookingDetails.boatName} - {booking.clientDetails.name} - {
                    booking.bookingDetails.date ? 
                    format(new Date(booking.bookingDetails.date), 'dd/MM/yyyy') : 
                    'No date'
                  }
                </option>
              ))}
            </select>
            {isLoadingBookings && (
              <div className="mt-1 text-sm text-gray-500">Loading bookings...</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input
              type="text"
              value={newExpense.description}
              onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <input
              type="text"
              value={newExpense.category}
              onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={newExpense.date}
              onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Document URL (optional)</label>
            <input
              type="text"
              value={newExpense.imageURL}
              onChange={(e) => setNewExpense({...newExpense, imageURL: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSubmit(newExpense, parentExpenseId);
                setNewExpense({
                  amount: '',
                  description: '',
                  category: '',
                  date: new Date().toISOString().split('T')[0],
                  imageURL: '',
                  bookingId: ''
                });
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Add Expense
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
  
  const fetchBookingData = async (expense) => {
    try {
      if (!expense.bookingId) {
        return {};
      }
      const bookingRef = doc(db, 'bookings', expense.bookingId);
      const bookingSnap = await getDoc(bookingRef);

      if (bookingSnap.exists()) {
        return bookingSnap.data();
      } else {
        return {};
      }
    } catch (error) {
      console.error('Error fetching booking data', error);
      return {};
    }
  };

  const fetchExpenses = async () => {
    try {
      const expensesRef = collection(db, 'expenses');
      const q = query(expensesRef, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      
      // First, get all expenses
      const allExpenses = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const expenseData = {
            id: doc.id,
            ...doc.data(),
            date: doc.data().date,
            timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString()
          };
          const bookingData = await fetchBookingData(expenseData);
          return { ...expenseData, bookingData };
        })
      );
  
      // Separate parent and child expenses
      const parentExpenses = allExpenses.filter(exp => !exp.parentId);
      const childExpenses = allExpenses.filter(exp => exp.parentId);
  
      // Attach child expenses to their parents
      const groupedExpenses = parentExpenses.map(parent => {
        const children = childExpenses.filter(child => child.parentId === parent.id);
        if (children.length > 0) {
          return {
            ...parent,
            subExpenses: children,
            totalAmount: children.reduce((sum, child) => sum + Number(child.amount), Number(parent.amount))
          };
        }
        return parent;
      });
  
      setExpenses(groupedExpenses);
      calculateTotal(groupedExpenses);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setLoading(false);
    }
  };

  const calculateTotal = (expensesList) => {
    const { company, client, invoice } = getFilteredExpenses(expensesList);
    
    
    const calculateGroupTotal = (expenses) => {
      return expenses.reduce((sum, expense) => {
        const mainAmount = Number(expense.amount) || 0;
        const subExpensesTotal = expense.subExpenses?.reduce(
          (subSum, subExp) => subSum + (Number(subExp.amount) || 0),
          0
        ) || 0;
        return sum + mainAmount + subExpensesTotal;
      }, 0);
    };
  
    const companyTotal = calculateGroupTotal(company);
    const clientTotal = calculateGroupTotal(client);
    const invoiceTotal = calculateGroupTotal(invoice);
    
    setTotalAmount(companyTotal + clientTotal + invoiceTotal);
  };

  const getFilteredExpenses = (expensesList = expenses) => {
    let filtered = expensesList;

    if (filterQuery) {
      const searchTerm = filterQuery.toLowerCase();
      filtered = filtered.filter(expense =>
        expense.category?.toLowerCase().includes(searchTerm) ||
        expense.description?.toLowerCase().includes(searchTerm) ||
        expense.bookingData?.bookingDetails?.boatName?.toLowerCase().includes(searchTerm) ||
        expense.bookingData?.clientDetails?.name?.toLowerCase().includes(searchTerm) ||
        (expense.bookingData?.bookingDetails?.date && format(new Date(expense.bookingData?.bookingDetails?.date), 'dd/MM/yyyy')?.includes(searchTerm))
      );
    }

    if (filterDateFrom) {
      filtered = filtered.filter(expense => expense.date >= filterDateFrom);
    }

    if (filterDateTo) {
      filtered = filtered.filter(expense => expense.date <= filterDateTo);
    }

    return {
      company: filtered.filter(expense => expense.type === 'company'),
      client: filtered.filter(expense => expense.type === 'client'),
      invoice: filtered.filter(expense => expense.type === 'invoice'),
    };
  };

  const handleUpdatePaymentStatus = async (expenseId, currentStatus) => {
    setUpdatingStatus(expenseId);
    const newStatus = currentStatus === 'pending' ? 'paid' : 'pending';

    try {
      const expenseRef = doc(db, 'expenses', expenseId);
      await updateDoc(expenseRef, { paymentStatus: newStatus });
      setExpenses(prevExpenses =>
        prevExpenses.map(expense =>
          expense.id === expenseId ? { ...expense, paymentStatus: newStatus } : expense
        )
      );
    } catch (error) {
      console.error('Error updating payment status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
      setDeletingExpenseId(expenseId);
      try {
        const expenseRef = doc(db, 'expenses', expenseId);
  
        
        setExpenses(prevExpenses => {
          const updatedExpenses = prevExpenses.map(expense => {
            
            if (expense.subExpenses) {
              return {
                ...expense,
                subExpenses: expense.subExpenses.filter(sub => sub.id !== expenseId),
                
                totalAmount: expense.subExpenses
                  .filter(sub => sub.id !== expenseId)
                  .reduce((sum, sub) => sum + Number(sub.amount), Number(expense.amount))
              };
            }
            return expense;
          }).filter(expense => expense.id !== expenseId); 
  
          // Recalculate overall totals
          calculateTotal(updatedExpenses);
          return updatedExpenses;
        });
  
       
        await deleteDoc(expenseRef);
  
        const parentExpense = expenses.find(exp => 
          exp.subExpenses?.some(sub => sub.id === expenseId)
        );
  
        if (parentExpense) {
          const updatedSubExpenses = parentExpense.subExpenses.filter(sub => sub.id !== expenseId);
          const newTotal = updatedSubExpenses.reduce(
            (sum, sub) => sum + Number(sub.amount),
            Number(parentExpense.amount)
          );
  
          await updateDoc(doc(db, 'expenses', parentExpense.id), {
            subExpenses: updatedSubExpenses,
            totalAmount: newTotal
          });
        }
  
        alert("Expense deleted successfully");
      } catch (error) {
        console.error('Error deleting expense:', error);
        alert("Failed to delete expense. Please try again.");
        await fetchExpenses();
      } finally {
        setDeletingExpenseId(null);
      }
    }
  };
  const downloadDocument = async (url, fileName = 'document') => {
    if (!url) {
      alert('No document available to download');
      return;
    }
  
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading the document:', error);
      alert('Failed to download the document. Please try again.');
    }
  };
  
  const handleAddExpenseToBill = async (expenseData, parentId = null) => {
    try {
      const expenseRef = collection(db, 'expenses');
      const newExpense = {
        ...expenseData,
        type: 'client',
        timestamp: new Date(),
        paymentStatus: 'pending',
        parentId: parentId,
        amount: Number(expenseData.amount)
      };
  
      // Add the new expense to Firestore
      const docRef = await addDoc(expenseRef, newExpense);
      const newExpenseWithId = { ...newExpense, id: docRef.id };
  
      let updatedExpenses;
      if (parentId) {
        // Update parent expense with new sub-expense
        updatedExpenses = expenses.map(expense => {
          if (expense.id === parentId) {
            const existingSubExpenses = expense.subExpenses || [];
            return {
              ...expense,
              subExpenses: [...existingSubExpenses, newExpenseWithId]
            };
          }
          return expense;
        });
      } else {
        // Add new parent expense
        updatedExpenses = [...expenses, newExpenseWithId];
      }
  
      // Update state with new expenses and recalculate total
      setExpenses(updatedExpenses);
      calculateTotal(updatedExpenses);
  
      // If this is a sub-expense, update the parent's total in Firestore
      if (parentId) {
        const parentExpense = updatedExpenses.find(e => e.id === parentId);
        if (parentExpense) {
          const totalAmount = parentExpense.subExpenses.reduce(
            (sum, sub) => sum + Number(sub.amount),
            Number(parentExpense.amount)
          );
          await updateDoc(doc(db, 'expenses', parentId), { totalAmount });
        }
      }
  
      setIsClientModalOpen(false);
      setSelectedClientParentId(null);
      alert('New expense added successfully!');
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Failed to add expense. Please try again.');
    }
  };
  
  const handleClearFilters = () => {
    setFilterQuery('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };
  const handleViewDocument = (url) => {
    if (!url) {
      alert('No document available to view');
      return;
    }
  
    // Open the document in a new tab
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening the document:', error);
      alert('Failed to open the document. Please try again.');
    }
  };
  

  const downloadCSV = () => {
    const { company, client, invoice } = getFilteredExpenses();
    const allExpenses = [...company, ...client, ...invoice];
    
    const csvData = allExpenses.map(expense => ({
      Date: format(new Date(expense.date), 'dd/MM/yyyy'),
      Type: expense.type,
      Category: expense.category,
      Description: expense.description,
      Amount: expense.amount,
      'Payment Status': expense.paymentStatus || 'N/A',
      'Payment Method': expense.paymentMethod || 'N/A',
      'Boat Name': expense.bookingData?.bookingDetails?.boatName || 'N/A',
      'Booking Date': expense.bookingData?.bookingDetails?.date || 'N/A',
      'Boat Company': expense.bookingData?.bookingDetails?.boatCompany || 'N/A',
      'Client Name': expense.bookingData?.clientDetails?.name || 'N/A',
      'Invoice Number': expense.invoiceNumber || 'N/A'
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleRowExpansion = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const ExpenseCard = ({ expense, isSubExpense = false }) => {
    const isExpanded = expandedRows.has(expense.id);
    const hasSubExpenses = expense.subExpenses?.length > 0;
    
    // Calculate total including all sub-expenses
    const calculateTotalAmount = (exp) => {
      const subExpensesTotal = exp.subExpenses?.reduce((sum, subExp) => sum + Number(subExp.amount), 0) || 0;
      return Number(exp.amount) + subExpensesTotal;
    };
  
    return (
      <div className={`bg-white rounded-xl shadow-sm p-4 mb-4 overflow-hidden max-w-full 
        ${isSubExpense ? 'ml-4 border-l-2 border-blue-200' : ''}`}>
        <div className="flex flex-col gap-3">
          {/* Header Section */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1 max-w-full">
              <div className="text-sm text-gray-600 break-words">
                {format(new Date(expense.date), 'dd/MM/yyyy')}
              </div>
              <div className="font-medium break-words">{expense.category}</div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-xl font-bold">€{Number(expense.amount).toFixed(2)}</div>
              {hasSubExpenses && (
                <div className="text-sm text-gray-500">
                  Total: €{calculateTotalAmount(expense).toFixed(2)}
                </div>
              )}
            </div>
          </div>
  
          {/* Description Section */}
          <div className="text-gray-700 break-words">
            {expense.description || 'No description'}
          </div>
  
          {/* Client Expense Add Button */}
          {expense.type === 'client' && !isSubExpense && (
            <button
              onClick={() => {
                setSelectedClientParentId(expense.id);
                setIsClientModalOpen(true);
              }}
              className="mt-2 text-blue-600 text-sm flex items-center"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Expense
            </button>
          )}
  
          {/* Toggle Details Button */}
          {(expense.type === 'invoice' || hasSubExpenses) && (
            <button
              onClick={() => toggleRowExpansion(expense.id)}
              className="mt-2 text-blue-600 text-sm flex items-center"
            >
              {isExpanded ? (
                <>Less details <ChevronUp className="h-4 w-4 ml-1" /></>
              ) : (
                <>
                  {hasSubExpenses ? 
                    `Show Expenses (${expense.subExpenses.length})` : 
                    'More details'
                  } <ChevronDown className="h-4 w-4 ml-1" />
                </>
              )}
            </button>
          )}
  
          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-3 space-y-2 text-sm break-words">
              {/* Invoice Details */}
              {expense.type === 'invoice' && (
                <>
                  <div><span className="font-medium">Boat:</span> {expense.bookingData?.bookingDetails?.boatName || '-'}</div>
                  <div><span className="font-medium">Booking Date:</span> {expense.bookingData?.bookingDetails?.date || '-'}</div>
                  <div><span className="font-medium">Company:</span> {expense.bookingData?.bookingDetails?.boatCompany || '-'}</div>
                  <div><span className="font-medium">Client:</span> {expense.bookingData?.clientDetails?.name || '-'}</div>
                </>
              )}
              
              {/* Sub-expenses */}
              {hasSubExpenses && (
                <div className="mt-4 space-y-4">
                  {expense.subExpenses.map(subExpense => (
                    <ExpenseCard
                      key={subExpense.id}
                      expense={subExpense}
                      isSubExpense={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
  
          {/* Status and Actions Section */}
          <div className="mt-2 flex justify-between items-center flex-wrap">
            {/* Payment Status Button */}
            <button
              onClick={() => handleUpdatePaymentStatus(expense.id, expense.paymentStatus)}
              disabled={updatingStatus === expense.id}
              className={`px-3 py-1 rounded-full text-sm font-medium
                ${expense.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
            >
              {updatingStatus === expense.id ? 'Updating...' : (expense.paymentStatus || 'Pending')}
            </button>
  
            {/* Action Buttons */}
            <div className="flex gap-2">
              {/* Document Buttons */}
              {expense.imageURL && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewDocument(expense.imageURL)}
                    className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
                  >
                    <FileText className="h-4 w-4" /> View
                  </button>
                  <button
                    onClick={() => downloadDocument(expense.imageURL, `expense_${expense.id}`)}
                    className="text-green-500 hover:text-green-700 flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" /> Download
                  </button>
                </div>
              )}
  
              {/* Delete Button */}
              <button
                onClick={() => handleDeleteExpense(expense.id)}
                disabled={deletingExpenseId === expense.id}
                className="text-red-500 hover:text-red-700"
              >
                {deletingExpenseId === expense.id ? 'Deleting...' : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const { company, client, invoice } = getFilteredExpenses();

  
  const shouldShowSection = (section) => {
    return activeTab === 'all' || activeTab === section;
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-6 overflow-x-hidden">

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-lg">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Expense Overview</h1>
        <div className="flex gap-2">
        <button
          onClick={handleClearFilters}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Reset Filters
        </button>
        <button
          onClick={downloadCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>
    </div>

        {/* Filters Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Date From</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="rounded-lg border border-gray-200 px-4 py-2"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Date To</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="rounded-lg border border-gray-200 px-4 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Search</label>
              <input
                type="text"
                placeholder="Search by category, description, boat name, or client..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="rounded-lg border border-gray-200 px-4 py-2 w-full"
              />
            </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1">
          {['all', 'company', 'client', 'invoice'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-t-lg font-medium text-sm capitalize transition-colors
                ${activeTab === tab
                  ? 'bg-gray-100 text-blue-600 border-t-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              {tab === 'all' ? 'All Expenses' : `${tab}s`}
            </button>
          ))}
        </div>
        </div>

        {/* Replace your existing total div with this */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 col-span-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Total Expenses</span>
              <span className="text-3xl font-bold text-gray-900">€{totalAmount.toFixed(2)}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 col-span-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Company Expenses</span>
              <span className="text-3xl font-bold text-blue-600">€{company.reduce((sum, expense) => sum + Number(expense.amount), 0).toFixed(2)}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 col-span-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Client Expenses</span>
              <span className="text-3xl font-bold text-green-600">€{client.reduce((sum, expense) => sum + Number(expense.amount), 0).toFixed(2)}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 col-span-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Invoices</span>
              <span className="text-3xl font-bold text-purple-600">€{invoice.reduce((sum, expense) => sum + Number(expense.amount), 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Desktop Tables */}
        <div className="hidden md:block space-y-8">
          {/* Company Expenses Table */}
          {shouldShowSection('company') && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-blue-900">Company Expenses</h2>
              <span className="text-sm text-gray-600">
                {company.length} {company.length === 1 ? 'expense' : 'expenses'}
              </span>
            </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {company.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">{format(new Date(expense.date), 'dd/MM/yyyy')}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{expense.category}</td>
                        <td className="px-6 py-4">{expense.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap">€{Number(expense.amount).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        {expense.imageURL ? (
                          <div className="flex items-center space-x-2">
                            {/* View Document Button */}
                            <button
                              onClick={() => handleViewDocument(expense.imageURL)}
                              className="text-blue-500 hover:text-blue-700"
                              title="View Document"
                            >
                              <FileText className="h-4 w-4" />
                            </button>

                            {/* Download Document Button */}
                            <button
                              onClick={() => downloadDocument(expense.imageURL, `company_expense_${expense.id}`)}
                              className="text-green-500 hover:text-green-700"
                              title="Download Document"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">No document</span>
                        )}
                      </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            disabled={deletingExpenseId === expense.id}
                            className="text-red-500 hover:text-red-700"
                          >
                            {deletingExpenseId === expense.id ? 'Deleting...' : <Trash2 className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

            {/* Client Expenses Table */}
            {shouldShowSection('client') && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 bg-green-50 border-b border-green-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-green-900">Client Expenses</h2>
                  <span className="text-sm text-gray-600">
                    {client.length} {client.length === 1 ? 'expense' : 'expenses'}
                  </span>
                </div>
              </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginateData(client, currentPage, itemsPerPage).map((expense) => (
                        <ClientExpenseRow
                          key={expense.id}
                          expense={expense}
                          onDelete={handleDeleteExpense}
                          onAddSubExpense={(id) => {
                            setSelectedClientParentId(id);
                            setIsClientModalOpen(true);
                          }}
                          onUpdateStatus={handleUpdatePaymentStatus}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  totalItems={client.length}
                  itemsPerPage={itemsPerPage}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />

                <AddExpenseModal
                  isOpen={isClientModalOpen}
                  onClose={() => {
                    setIsClientModalOpen(false);
                    setSelectedClientParentId(null);
                  }}
                  onSubmit={(expenseData) => handleAddExpenseToBill(expenseData, selectedClientParentId)}
                  parentExpenseId={selectedClientParentId}
                />
              </div>
            )}

          {/* Invoices Table */}
        {shouldShowSection('invoice') && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 bg-purple-50 border-b border-purple-100">
              <h2 className="text-lg font-semibold text-purple-900">Invoices</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boat Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">{format(new Date(expense.date), 'dd/MM/yyyy')}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{expense.category}</td>
                      <td className="px-6 py-4">{expense.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap">€{Number(expense.amount).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{expense.bookingData?.bookingDetails?.boatName || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{expense.bookingData?.bookingDetails?.date ? format(new Date(expense.bookingData.bookingDetails.date), 'dd/MM/yyyy') : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{expense.bookingData?.bookingDetails?.boatCompany || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{expense.bookingData?.clientDetails?.name || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleUpdatePaymentStatus(expense.id, expense.paymentStatus)}
                          disabled={updatingStatus === expense.id}
                          className={`px-2 py-1 rounded-full text-xs font-medium
                            ${expense.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                          `}
                        >
                          {updatingStatus === expense.id ? 'Updating...' : (expense.paymentStatus || 'Pending')}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                      {expense.imageURL ? (
                        <div className="flex items-center space-x-2">
                          {/* View Document Button */}
                          <button
                            onClick={() => handleViewDocument(expense.imageURL)}
                            className="text-blue-500 hover:text-blue-700"
                            title="View Document"
                          >
                            <FileText className="h-4 w-4" />
                          </button>

                          {/* Download Document Button */}
                          <button
                            onClick={() => downloadDocument(expense.imageURL, `expense_${expense.id}`)}
                            className="text-green-500 hover:text-green-700"
                            title="Download Document"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">No document</span>
                      )}
                    </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          disabled={deletingExpenseId === expense.id}
                          className="text-red-500 hover:text-red-700"
                        >
                          {deletingExpenseId === expense.id ? 'Deleting...' : <Trash2 className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>

        {/* Mobile view */}
        <div className="md:hidden space-y-6">
          {/* Company Expenses */}
          {shouldShowSection('company') && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Company Expenses</h3>
              <div className="space-y-4">
                {company.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} />
                ))}
                {company.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No company expenses found</p>
                )}
              </div>
            </div>
          )}

          {/* Client Expenses - Mobile View */}
          {shouldShowSection('client') && (
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold text-green-900">Client Expenses</h3>
                <span className="text-sm text-gray-600">
                  {client.length} {client.length === 1 ? 'expense' : 'expenses'}
                </span>
              </div>
            </div>
              
              <div className="space-y-4">
                {paginateData(client, currentPage, itemsPerPage).map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    onDelete={handleDeleteExpense}
                    onAddSubExpense={(id) => {
                      setSelectedClientParentId(id);
                      setIsClientModalOpen(true);
                    }}
                    onUpdateStatus={handleUpdatePaymentStatus}
                  />
                ))}
                {client.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No client expenses found</p>
                )}
              </div>

              <Pagination
                totalItems={client.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
              
              <AddExpenseModal
                isOpen={isClientModalOpen}
                onClose={() => {
                  setIsClientModalOpen(false);
                  setSelectedClientParentId(null);
                }}
                onSubmit={(expenseData) => handleAddExpenseToBill(expenseData, selectedClientParentId)}
                parentExpenseId={selectedClientParentId}
              />
            </div>
          )}

          {/* Invoices */}
          {shouldShowSection('invoice') && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-900 mb-4">Invoices</h3>
              <div className="space-y-4">
                {invoice.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} />
                ))}
                {invoice.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No invoices found</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseOverview; 