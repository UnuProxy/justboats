import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { format } from 'date-fns';
import Papa from 'papaparse';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';

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
  // New state for tab selection
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchExpenses();
  }, []);

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
      
      const expensesData = await Promise.all(
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
      setExpenses(expensesData);
      calculateTotal(expensesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setLoading(false);
    }
  };

  const calculateTotal = (expensesList) => {
    const { company, client, invoice } = getFilteredExpenses(expensesList);
    const allExpenses = [...company, ...client, ...invoice];
    const total = allExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    setTotalAmount(total);
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
        await deleteDoc(expenseRef);
        setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== expenseId));
        alert("Expense deleted successfully");
      } catch (error) {
        console.error('Error deleting expense:', error);
        alert("Failed to delete expense. Please try again.");
      } finally {
        setDeletingExpenseId(null);
      }
    }
  };

  const handleClearFilters = () => {
    setFilterQuery('');
    setFilterDateFrom('');
    setFilterDateTo('');
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

  const ExpenseCard = ({ expense }) => {
    const isExpanded = expandedRows.has(expense.id);
    
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-600">{format(new Date(expense.date), 'dd/MM/yyyy')}</div>
              <div className="font-medium">{expense.category}</div>
            </div>
            <div className="text-xl font-bold">€{Number(expense.amount).toFixed(2)}</div>
          </div>
          
          <div className="text-gray-700">{expense.description || 'No description'}</div>
          
          {expense.type === 'invoice' && (
            <button 
              onClick={() => toggleRowExpansion(expense.id)}
              className="mt-2 text-blue-600 text-sm flex items-center"
            >
              {isExpanded ? (
                <>Less details <ChevronUp className="h-4 w-4 ml-1" /></>
              ) : (
                <>More details <ChevronDown className="h-4 w-4 ml-1" /></>
              )}
            </button>
          )}
          
          {isExpanded && expense.type === 'invoice' && (
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="font-medium">Boat:</span> {expense.bookingData?.bookingDetails?.boatName || '-'}</div>
              <div><span className="font-medium">Booking Date:</span> {expense.bookingData?.bookingDetails?.date || '-'}</div>
              <div><span className="font-medium">Company:</span> {expense.bookingData?.bookingDetails?.boatCompany || '-'}</div>
              <div><span className="font-medium">Client:</span> {expense.bookingData?.clientDetails?.name || '-'}</div>
              <div className="flex justify-between items-center mt-3">
                <button
                  onClick={() => handleUpdatePaymentStatus(expense.id, expense.paymentStatus)}
                  disabled={updatingStatus === expense.id}
                  className={`px-3 py-1 rounded-full text-sm font-medium
                    ${expense.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                >
                  {updatingStatus === expense.id ? 'Updating...' : (expense.paymentStatus || 'Pending')}
                </button>
              </div>
            </div>
          )}
          
          <div className="mt-2 flex justify-end">
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

  // Helper function to determine if a section should be shown
  const shouldShowSection = (section) => {
    return activeTab === 'all' || activeTab === section;
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Tabs */}
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <h1 className="text-2xl font-bold">Expense Overview</h1>
            <div className="flex gap-2">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Clear Filters
              </button>
              <button
                onClick={downloadCSV}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Download CSV
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 border-b">
            {['all', 'company', 'client', 'invoice'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'all' ? 'All Expenses' : `${tab}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-gray-600 font-medium">Date From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-4 py-2"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-gray-600 font-medium">Date To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-4 py-2"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-gray-600 font-medium">Search</label>
            <input
              type="text"
              placeholder="Search expenses..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="rounded-lg border border-gray-200 px-4 py-2"
            />
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
              <div className="p-4 bg-blue-50 border-b border-blue-100">
                <h2 className="text-lg font-semibold text-blue-900">Company Expenses</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
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
              <div className="p-4 bg-green-50 border-b border-green-100">
                <h2 className="text-lg font-semibold text-green-900">Client Expenses</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {client.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">{format(new Date(expense.date), 'dd/MM/yyyy')}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{expense.category}</td>
                        <td className="px-6 py-4">{expense.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap">€{Number(expense.amount).toFixed(2)}</td>
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

          {/* Client Expenses */}
          {shouldShowSection('client') && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-900 mb-4">Client Expenses</h3>
              <div className="space-y-4">
                {client.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} />
                ))}
                {client.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No client expenses found</p>
                )}
              </div>
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