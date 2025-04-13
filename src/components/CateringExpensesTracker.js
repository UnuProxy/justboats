import React from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import toast from 'react-hot-toast';

class CateringExpensesTracker extends React.Component {
  constructor(props) {
    super(props);
    
    this.state = {
      orders: [],
      loading: true,
      error: null,
      selectedOrderId: null,
      newExpense: {
        description: '',
        amount: '',
        category: 'food',
        date: new Date().toISOString().split('T')[0]
      },
      activeTab: 'summary', // 'summary', 'expenses', 'add'
      expenseSummaryByCategory: {},
      // Aggregated data
      totalRevenue: 0,
      totalExpenses: 0,
      totalProfit: 0,
      allExpenses: []
    };
  }
  
  componentDidMount() {
    this.loadOrders();
  }
  
  loadOrders = async () => {
    try {
      this.setState({ loading: true, error: null });
      
      if (!db) {
        throw new Error("Database connection is not available");
      }
      
      // Get orders from firestore
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef); // Get all orders for a complete picture
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        this.setState({ 
          orders: [], 
          loading: false,
          selectedOrderId: null,
          totalRevenue: 0,
          totalExpenses: 0,
          totalProfit: 0,
          allExpenses: []
        });
        return;
      }
      
      const ordersList = [];
      
      querySnapshot.forEach((doc) => {
        if (doc.exists()) {
          const orderData = doc.data();
          
          // Safely extract data with fallbacks
          ordersList.push({
            id: doc.id,
            orderId: orderData.orderId || doc.id.substring(0, 8),
            revenue: parseFloat(orderData.amount_total || 0),
            expenses: [],
            totalExpenses: 0,
            profit: parseFloat(orderData.amount_total || 0)
          });
        }
      });
      
      // Now fetch expenses for each order
      const ordersWithExpenses = await this.fetchExpensesForOrders(ordersList);
      
      // Sort orders by revenue (highest first)
      ordersWithExpenses.sort((a, b) => b.revenue - a.revenue);
      
      const firstId = ordersWithExpenses.length > 0 ? ordersWithExpenses[0].id : null;
      
      // Calculate aggregated data
      let totalRevenue = 0;
      let totalExpenses = 0;
      let allExpenses = [];
      
      ordersWithExpenses.forEach(order => {
        totalRevenue += order.revenue;
        totalExpenses += order.totalExpenses;
        
        // Add order reference to each expense
        const orderExpenses = order.expenses.map(exp => ({
          ...exp,
          orderId: order.id,
          orderNumber: order.orderId
        }));
        
        allExpenses = [...allExpenses, ...orderExpenses];
      });
      
      // Sort all expenses by date (newest first)
      allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      this.setState({
        orders: ordersWithExpenses,
        loading: false,
        selectedOrderId: firstId,
        totalRevenue,
        totalExpenses,
        totalProfit: totalRevenue - totalExpenses,
        allExpenses
      }, () => {
        // Calculate expense summary by category
        this.calculateTotalExpenseSummaryByCategory();
        
        if (firstId) {
          this.calculateOrderExpenseSummaryByCategory();
        }
      });
      
    } catch (error) {
      console.error("Error loading orders:", error);
      this.setState({
        loading: false,
        error: "Failed to load orders: " + error.message
      });
    }
  };
  
  fetchExpensesForOrders = async (ordersList) => {
    const result = [];
    
    for (const order of ordersList) {
      if (!order || !order.id) continue;
      
      try {
        // Get expenses subcollection for this order
        const expensesRef = collection(db, 'orders', order.id, 'expenses');
        const expensesSnapshot = await getDocs(expensesRef);
        
        let expenses = [];
        let totalExpenses = 0;
        
        expensesSnapshot.forEach((doc) => {
          if (doc.exists()) {
            const expenseData = doc.data();
            const amount = parseFloat(expenseData.amount || 0);
            
            expenses.push({
              id: doc.id,
              description: expenseData.description || 'Unnamed expense',
              category: expenseData.category || 'other',
              amount: amount,
              date: expenseData.date || new Date().toISOString().split('T')[0]
            });
            
            totalExpenses += amount;
          }
        });
        
        result.push({
          ...order,
          expenses: expenses,
          totalExpenses: totalExpenses,
          profit: order.revenue - totalExpenses
        });
        
      } catch (error) {
        console.error(`Error fetching expenses for order ${order.id}:`, error);
        // Still add the order but without expenses
        result.push({
          ...order,
          expenses: [],
          totalExpenses: 0,
          profit: order.revenue
        });
      }
    }
    
    return result;
  };
  
  calculateOrderExpenseSummaryByCategory = () => {
    const selectedOrder = this.getSelectedOrder();
    
    if (!selectedOrder || !selectedOrder.expenses) {
      this.setState({ expenseSummaryByCategory: {} });
      return;
    }
    
    const summary = {};
    
    selectedOrder.expenses.forEach(expense => {
      const category = expense.category || 'other';
      if (!summary[category]) {
        summary[category] = 0;
      }
      summary[category] += parseFloat(expense.amount) || 0;
    });
    
    this.setState({ expenseSummaryByCategory: summary });
  };
  
  calculateTotalExpenseSummaryByCategory = () => {
    const { allExpenses } = this.state;
    
    if (!allExpenses || allExpenses.length === 0) {
      this.setState({ expenseSummaryByCategory: {} });
      return;
    }
    
    const summary = {};
    
    allExpenses.forEach(expense => {
      const category = expense.category || 'other';
      if (!summary[category]) {
        summary[category] = 0;
      }
      summary[category] += parseFloat(expense.amount) || 0;
    });
    
    this.setState({ expenseSummaryByCategory: summary });
  };
  
  getSelectedOrder = () => {
    const { orders, selectedOrderId } = this.state;
    
    if (!selectedOrderId || !orders || orders.length === 0) {
      return null;
    }
    
    return orders.find(order => order && order.id === selectedOrderId) || null;
  };
  
  handleOrderChange = (orderId) => {
    this.setState({ 
      selectedOrderId: orderId,
      activeTab: 'summary' 
    }, () => {
      this.calculateOrderExpenseSummaryByCategory();
    });
  };
  
  handleTabChange = (tab) => {
    if (tab === 'summary') {
      // When switching to summary, recalculate the total expenses by category
      this.calculateTotalExpenseSummaryByCategory();
    } else if (tab === 'order-summary' && this.state.selectedOrderId) {
      // When switching to order summary, calculate that order's expenses by category
      this.calculateOrderExpenseSummaryByCategory();
    }
    
    this.setState({ activeTab: tab });
  };
  
  handleAddExpense = async () => {
    const { selectedOrderId, newExpense } = this.state;
    
    if (!selectedOrderId) {
      toast.error("Please select an order first");
      return;
    }
    
    if (!newExpense.description || !newExpense.amount) {
      toast.error("Please enter a description and amount");
      return;
    }
    
    try {
      // Prepare expense data - ensure all values are valid Firestore types
      const expenseData = {
        description: newExpense.description.trim(),
        amount: Number(parseFloat(newExpense.amount).toFixed(2)), // Ensure it's a clean number
        category: newExpense.category || 'other',
        date: newExpense.date || new Date().toISOString().split('T')[0],
        createdAt: new Date()
      };
      
      // Add expense to Firestore
      const expensesRef = collection(db, 'orders', selectedOrderId, 'expenses');
      const docRef = await addDoc(expensesRef, expenseData);
      
      // Update the order with hasExpenses flag
      const orderRef = doc(db, 'orders', selectedOrderId);
      await updateDoc(orderRef, {
        hasExpenses: true,
        lastUpdated: new Date()
      });
      
      // Create the new expense with ID
      const newExpenseWithId = {
        id: docRef.id,
        ...expenseData,
        orderId: selectedOrderId,
        orderNumber: this.getSelectedOrder()?.orderId || 'Unknown'
      };
      
      // Update local state
      this.setState(prevState => {
        // Update the selected order's expenses
        const updatedOrders = prevState.orders.map(order => {
          if (!order || order.id !== selectedOrderId) return order;
          
          const updatedExpenses = [...(order.expenses || []), newExpenseWithId];
          const newTotalExpenses = updatedExpenses.reduce(
            (sum, exp) => sum + (parseFloat(exp.amount) || 0), 
            0
          );
          
          return {
            ...order,
            expenses: updatedExpenses,
            totalExpenses: newTotalExpenses,
            profit: order.revenue - newTotalExpenses
          };
        });
        
        // Calculate new totals
        let newTotalExpenses = prevState.totalExpenses + parseFloat(newExpense.amount);
        
        // Add to all expenses list
        const newAllExpenses = [...prevState.allExpenses, newExpenseWithId];
        // Sort all expenses by date (newest first)
        newAllExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return {
          orders: updatedOrders,
          totalExpenses: newTotalExpenses,
          totalProfit: prevState.totalRevenue - newTotalExpenses,
          allExpenses: newAllExpenses,
          newExpense: {
            description: '',
            amount: '',
            category: 'food',
            date: new Date().toISOString().split('T')[0]
          },
          activeTab: 'expenses' // Switch to expenses tab after adding
        };
      }, () => {
        // Update expense category summary based on current tab
        if (this.state.activeTab === 'summary') {
          this.calculateTotalExpenseSummaryByCategory();
        } else {
          this.calculateOrderExpenseSummaryByCategory();
        }
      });
      
      toast.success("Expense added successfully");
      
    } catch (error) {
      console.error("Error adding expense:", error);
      toast.error("Failed to add expense: " + error.message);
    }
  };
  
  handleDeleteExpense = async (expenseId, orderId) => {
    // If orderId is not passed, use the selected order
    const orderIdToUse = orderId || this.state.selectedOrderId;
    
    if (!orderIdToUse || !expenseId) return;
    
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }
    
    try {
      // Delete from Firestore
      const expenseRef = doc(db, 'orders', orderIdToUse, 'expenses', expenseId);
      await deleteDoc(expenseRef);
      
      // Update the order
      const orderRef = doc(db, 'orders', orderIdToUse);
      await updateDoc(orderRef, {
        lastUpdated: new Date()
      });
      
      // Find the expense to calculate the amount to subtract
      const expenseToDelete = this.state.allExpenses.find(e => e.id === expenseId && e.orderId === orderIdToUse);
      const amountToSubtract = expenseToDelete ? parseFloat(expenseToDelete.amount) || 0 : 0;
      
      // Update local state
      this.setState(prevState => {
        // Update the affected order's expenses
        const updatedOrders = prevState.orders.map(order => {
          if (!order || order.id !== orderIdToUse) return order;
          
          const updatedExpenses = (order.expenses || []).filter(
            expense => expense && expense.id !== expenseId
          );
          
          const newTotalExpenses = updatedExpenses.reduce(
            (sum, exp) => sum + (parseFloat(exp.amount) || 0), 
            0
          );
          
          return {
            ...order,
            expenses: updatedExpenses,
            totalExpenses: newTotalExpenses,
            profit: order.revenue - newTotalExpenses
          };
        });
        
        // Update all expenses list
        const newAllExpenses = prevState.allExpenses.filter(
          expense => !(expense.id === expenseId && expense.orderId === orderIdToUse)
        );
        
        // Calculate new totals
        const newTotalExpenses = prevState.totalExpenses - amountToSubtract;
        
        return { 
          orders: updatedOrders,
          allExpenses: newAllExpenses,
          totalExpenses: newTotalExpenses,
          totalProfit: prevState.totalRevenue - newTotalExpenses
        };
      }, () => {
        // Update expense category summary based on current tab
        if (this.state.activeTab === 'summary') {
          this.calculateTotalExpenseSummaryByCategory();
        } else {
          this.calculateOrderExpenseSummaryByCategory();
        }
      });
      
      toast.success("Expense deleted successfully");
      
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense: " + error.message);
    }
  };
  
  handleInputChange = (field, value) => {
    this.setState(prevState => ({
      newExpense: {
        ...prevState.newExpense,
        [field]: value
      }
    }));
  };
  
  formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(parseFloat(amount) || 0);
  };
  
  formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      // Handle Firestore timestamp objects
      if (typeof dateString === 'object' && dateString.seconds) {
        return new Date(dateString.seconds * 1000).toLocaleDateString();
      }
      
      // Handle ISO date strings
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      return dateString.toString();
    }
  };
  
  getCategoryIcon = (category) => {
    switch(category) {
      case 'food':
        return '🍽️';
      case 'beverage':
        return '🥤';
      case 'staff':
        return '👥';
      case 'transport':
        return '🚗';
      case 'equipment':
        return '🔧';
      case 'rentals':
        return '🏠';
      default:
        return '📦';
    }
  };
  
  getCategoryColor = (category) => {
    switch(category) {
      case 'food':
        return 'bg-red-100 text-red-800';
      case 'beverage':
        return 'bg-blue-100 text-blue-800';
      case 'staff':
        return 'bg-purple-100 text-purple-800';
      case 'transport':
        return 'bg-green-100 text-green-800';
      case 'equipment':
        return 'bg-yellow-100 text-yellow-800';
      case 'rentals':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  render() {
    const { 
      orders, loading, error, selectedOrderId, newExpense, 
      activeTab, expenseSummaryByCategory, totalRevenue, 
      totalExpenses, totalProfit, allExpenses 
    } = this.state;
    
    const selectedOrder = this.getSelectedOrder();
    
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <p className="mt-4 text-gray-600">Loading catering orders...</p>
          </div>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="space-y-4 p-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Catering Expenses Tracker</h1>
            <button
              onClick={this.loadOrders}
              className="p-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors shadow-sm"
              title="Refresh"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    if (!orders || orders.length === 0) {
      return (
        <div className="space-y-4 p-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Catering Expenses Tracker</h1>
            <button
              onClick={this.loadOrders}
              className="p-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors shadow-sm"
              title="Refresh"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center shadow-sm">
            <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500 mb-4">There are no catering orders in the system yet.</p>
            <button 
              onClick={this.loadOrders}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-screen-xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Catering Expenses Tracker</h1>
          <button
            onClick={this.loadOrders}
            className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 sm:p-6">
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => this.handleTabChange('summary')}
                  className={`whitespace-nowrap px-1 py-2 font-medium text-sm flex items-center ${
                    activeTab === 'summary'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Overall Summary
                </button>
                <button
                  onClick={() => this.handleTabChange('expenses')}
                  className={`whitespace-nowrap px-1 py-2 font-medium text-sm flex items-center ${
                    activeTab === 'expenses'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  All Expenses
                  {allExpenses && allExpenses.length > 0 && (
                    <span className="ml-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {allExpenses.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => this.handleTabChange('order-details')}
                  className={`whitespace-nowrap px-1 py-2 font-medium text-sm flex items-center ${
                    activeTab === 'order-details'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Order Details
                </button>
                <button
                  onClick={() => this.handleTabChange('add')}
                  className={`whitespace-nowrap px-1 py-2 font-medium text-sm flex items-center ${
                    activeTab === 'add'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Expense
                </button>
              </nav>
            </div>
            
            {/* Tab Content */}
            <div>
              {/* Overall Summary Tab */}
              {activeTab === 'summary' && (
                <div>
                  {/* Financial Summary */}
                  <div className="mb-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Overall Financial Summary
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                        <h3 className="font-medium text-blue-800 mb-1 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Total Revenue
                        </h3>
                        <p className="text-2xl font-bold text-blue-900">{this.formatCurrency(totalRevenue)}</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
                        <h3 className="font-medium text-red-800 mb-1 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Total Expenses
                        </h3>
                        <p className="text-2xl font-bold text-red-900">{this.formatCurrency(totalExpenses)}</p>
                      </div>
                      <div className={`p-4 rounded-lg border shadow-sm ${
                        totalProfit >= 0 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <h3 className="font-medium text-gray-800 mb-1 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Total Profit
                        </h3>
                        <p className={`text-2xl font-bold ${
                          totalProfit >= 0 
                            ? 'text-green-700' 
                            : 'text-red-700'
                        }`}>
                          {this.formatCurrency(totalProfit)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expense by Category */}
                  {(allExpenses && allExpenses.length > 0) ? (
                    <div className="mb-6">
                      <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        Expenses by Category
                      </h2>
                      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="divide-y divide-gray-200">
                          {Object.entries(expenseSummaryByCategory).map(([category, amount]) => (
                            <div key={category} className="p-4 flex justify-between items-center">
                              <div className="flex items-center">
                                <span className="mr-2 text-lg">{this.getCategoryIcon(category)}</span>
                                <span className={`px-2 py-1 rounded-md text-xs font-medium ${this.getCategoryColor(category)}`}>{category}</span>
                              </div>
                              <span className="font-semibold">{this.formatCurrency(amount)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                          <span className="font-medium">Total Expenses</span>
                          <span className="text-lg font-bold">{this.formatCurrency(totalExpenses)}</span>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => this.handleTabChange('add')}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Add New Expense
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6 text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Expenses Yet</h3>
                      <p className="text-gray-500 mb-4">Track your costs by adding expenses.</p>
                      <button
                        onClick={() => this.handleTabChange('add')}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add First Expense
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* All Expenses Tab */}
              {activeTab === 'expenses' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium text-gray-900 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      All Expenses
                    </h2>
                    <button
                      onClick={() => this.handleTabChange('add')}
                      className="inline-flex items-center px-3 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add New
                    </button>
                  </div>
                  
                  {allExpenses && allExpenses.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Description
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Category
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Order
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Amount
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {allExpenses.map(expense => {
                              if (!expense || !expense.id) return null;
                              return (
                                <tr key={`${expense.orderId}-${expense.id}`} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {expense.description}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getCategoryColor(expense.category)}`}>
                                      {this.getCategoryIcon(expense.category)} {expense.category}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    #{expense.orderNumber || 'Unknown'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {this.formatDate(expense.date)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-right">
                                    {this.formatCurrency(expense.amount)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                    <button
                                      onClick={() => this.handleDeleteExpense(expense.id, expense.orderId)}
                                      className="text-red-600 hover:text-red-900 focus:outline-none"
                                      title="Delete expense"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                            <tr>
                              <td colSpan="4" className="px-6 py-4 text-sm font-medium text-gray-700">
                                Total Expenses
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                                {this.formatCurrency(totalExpenses)}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Expenses Yet</h3>
                      <p className="text-gray-500 mb-4">Track your costs by adding expenses.</p>
                      <button
                        onClick={() => this.handleTabChange('add')}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add First Expense
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Order Details Tab */}
              {activeTab === 'order-details' && (
                <div>
                  {/* Order Selector */}
                  <div className="mb-6">
                    <label htmlFor="order-select" className="block text-sm font-medium text-gray-700 mb-1">
                      Select an Order
                    </label>
                    <select
                      id="order-select"
                      value={selectedOrderId || ''}
                      onChange={(e) => this.handleOrderChange(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {orders.map(order => {
                        if (!order || !order.id) return null;
                        return (
                          <option key={order.id} value={order.id}>
                            Order #{order.orderId} - Revenue: {this.formatCurrency(order.revenue)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  
                  {selectedOrder && (
                    <>
                      {/* Financial Summary */}
                      <div className="mb-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Financial Summary for Order #{selectedOrder.orderId}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                            <h3 className="font-medium text-blue-800 mb-1 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Revenue
                            </h3>
                            <p className="text-2xl font-bold text-blue-900">{this.formatCurrency(selectedOrder.revenue)}</p>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
                            <h3 className="font-medium text-red-800 mb-1 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Expenses
                            </h3>
                            <p className="text-2xl font-bold text-red-900">{this.formatCurrency(selectedOrder.totalExpenses)}</p>
                          </div>
                          <div className={`p-4 rounded-lg border shadow-sm ${
                            selectedOrder.profit >= 0 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <h3 className="font-medium text-gray-800 mb-1 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              Profit
                            </h3>
                            <p className={`text-2xl font-bold ${
                              selectedOrder.profit >= 0 
                                ? 'text-green-700' 
                                : 'text-red-700'
                            }`}>
                              {this.formatCurrency(selectedOrder.profit)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Order Expenses */}
                      {(selectedOrder.expenses && selectedOrder.expenses.length > 0) ? (
                        <div className="mb-6">
                          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Expenses for Order #{selectedOrder.orderId}
                          </h2>
                          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Description
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Category
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Date
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Amount
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {selectedOrder.expenses.map(expense => {
                                    if (!expense || !expense.id) return null;
                                    return (
                                      <tr key={expense.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                          {expense.description}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getCategoryColor(expense.category)}`}>
                                            {this.getCategoryIcon(expense.category)} {expense.category}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                          {this.formatDate(expense.date)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-right">
                                          {this.formatCurrency(expense.amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                          <button
                                            onClick={() => this.handleDeleteExpense(expense.id)}
                                            className="text-red-600 hover:text-red-900 focus:outline-none"
                                            title="Delete expense"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                  <tr>
                                    <td colSpan="3" className="px-6 py-4 text-sm font-medium text-gray-700">
                                      Total Expenses for this Order
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                                      {this.formatCurrency(selectedOrder.totalExpenses)}
                                    </td>
                                    <td></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-6 text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No Expenses for this Order</h3>
                          <p className="text-gray-500 mb-4">Track your costs by adding expenses for this order.</p>
                          <button
                            onClick={() => this.handleTabChange('add')}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add Expense
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* Add Expense Tab */}
              {activeTab === 'add' && (
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add New Expense
                  </h2>
                  
                  {/* Order Selection for Expense */}
                  <div className="mb-6">
                    <label htmlFor="expense-order" className="block text-sm font-medium text-gray-700 mb-1">
                      Select Order <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="expense-order"
                      value={selectedOrderId || ''}
                      onChange={(e) => this.setState({ selectedOrderId: e.target.value })}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    >
                      <option value="">-- Select an order --</option>
                      {orders.map(order => {
                        if (!order || !order.id) return null;
                        return (
                          <option key={order.id} value={order.id}>
                            Order #{order.orderId} - Revenue: {this.formatCurrency(order.revenue)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="col-span-1 md:col-span-2">
                        <label htmlFor="expense-description" className="block text-sm font-medium text-gray-700 mb-1">
                          Description <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="expense-description"
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          placeholder="e.g., Fresh Seafood, Staff Payment"
                          value={newExpense.description}
                          onChange={(e) => this.handleInputChange('description', e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="expense-category" className="block text-sm font-medium text-gray-700 mb-1">
                          Category
                        </label>
                        <select
                          id="expense-category"
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={newExpense.category}
                          onChange={(e) => this.handleInputChange('category', e.target.value)}
                        >
                          <option value="food">🍽️ Food</option>
                          <option value="beverage">🥤 Beverage</option>
                          <option value="staff">👥 Staff</option>
                          <option value="transport">🚗 Transportation</option>
                          <option value="equipment">🔧 Equipment</option>
                          <option value="rentals">🏠 Rentals</option>
                          <option value="other">📦 Other</option>
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="expense-amount" className="block text-sm font-medium text-gray-700 mb-1">
                          Amount (€) <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">€</span>
                          </div>
                          <input
                            type="number"
                            id="expense-amount"
                            className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            value={newExpense.amount}
                            onChange={(e) => this.handleInputChange('amount', e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="expense-date" className="block text-sm font-medium text-gray-700 mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          id="expense-date"
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={newExpense.date}
                          onChange={(e) => this.handleInputChange('date', e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2">
                      <div className="text-sm text-gray-500">
                        <span className="text-red-500">*</span> Required fields
                      </div>
                      <div className="flex space-x-3">
                        <button
                          type="button"
                          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          onClick={() => this.handleTabChange('summary')}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={this.handleAddExpense}
                          disabled={!selectedOrderId || !newExpense.description || !newExpense.amount}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Add Expense
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default CateringExpensesTracker;