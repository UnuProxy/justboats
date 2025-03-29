// components/PricingManager.js
import React, { useState, useEffect } from 'react';
import { Tag, Edit, Save, X, Plus, Trash2, Filter, Search, ArrowUpDown, Wine, Download, Loader } from 'lucide-react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from "../firebase/firebaseConfig";

const PricingManager = () => {
  // Collection name in Firebase - using a new separate collection
  const COLLECTION_NAME = 'pricingItems';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [editingId, setEditingId] = useState(null);
  const [showAddProductForm, setShowAddProductForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    buyingPrice: '',
    sellingPrice: ''
  });
  
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    buyingPrice: '',
    sellingPrice: ''
  });

  // Fetch products from Firebase on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const productsCollection = collection(db, COLLECTION_NAME);
        const productsSnapshot = await getDocs(productsCollection);
        const productsList = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productsList);
        setError(null);
      } catch (err) {
        console.error('Error fetching pricing items:', err);
        setError('Failed to load items. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Get all unique categories
  const categories = ['All', ...new Set(products.map(product => product.category))].sort();

  // Sort and filter products
  const filteredProducts = products
    .filter(product => 
      (categoryFilter === 'All' || product.category === categoryFilter) &&
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const fieldA = sortField === 'name' || sortField === 'category' 
        ? String(a[sortField]).toLowerCase()
        : Number(a[sortField]);
      
      const fieldB = sortField === 'name' || sortField === 'category'
        ? String(b[sortField]).toLowerCase()
        : Number(b[sortField]);
      
      if (fieldA < fieldB) return sortDirection === 'asc' ? -1 : 1;
      if (fieldA > fieldB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Toggle sort direction or change sort field
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Calculate profit margin
  const calculateProfitMargin = (buyingPrice, sellingPrice) => {
    if (!buyingPrice || !sellingPrice) return '';
    const buyPrice = parseFloat(buyingPrice);
    const sellPrice = parseFloat(sellingPrice);
    if (buyPrice <= 0) return '';
    return ((sellPrice - buyPrice) / buyPrice * 100).toFixed(2) + '%';
  };

  // Edit product
  const handleEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      name: product.name,
      category: product.category,
      buyingPrice: product.buyingPrice,
      sellingPrice: product.sellingPrice
    });
  };

  // Handle edit form changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm({
      ...editForm,
      [name]: value
    });
  };

  // Save edited product to Firebase
  const handleSave = async () => {
    try {
      const productRef = doc(db, COLLECTION_NAME, editingId);
      
      const updatedData = {
        name: editForm.name,
        category: editForm.category,
        buyingPrice: parseFloat(editForm.buyingPrice),
        sellingPrice: parseFloat(editForm.sellingPrice),
        updatedAt: new Date()
      };
      
      await updateDoc(productRef, updatedData);
      
      // Update local state
      setProducts(products.map(product => {
        if (product.id === editingId) {
          return { ...product, ...updatedData };
        }
        return product;
      }));
      
      setEditingId(null);
      setError(null);
    } catch (err) {
      console.error('Error updating item:', err);
      setError('Failed to update item. Please try again.');
    }
  };

  // Handle new product form
  const handleNewProductChange = (e) => {
    const { name, value } = e.target;
    setNewProduct({
      ...newProduct,
      [name]: value
    });
    
    // Auto-calculate selling price based on 100% markup
    if (name === 'buyingPrice' && value) {
      const buyingPrice = parseFloat(value);
      const sellingPrice = buyingPrice * 2; // 100% markup
      setNewProduct(prev => ({ ...prev, sellingPrice: sellingPrice.toFixed(2) }));
    }
  };

  // Add new product to Firebase
  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.category) {
      alert("Please fill in the product name and category");
      return;
    }
    
    if (!newProduct.buyingPrice || !newProduct.sellingPrice) {
      alert("Please enter buying and selling prices");
      return;
    }
    
    try {
      const productsCollection = collection(db, COLLECTION_NAME);
      
      const productData = {
        name: newProduct.name,
        category: newProduct.category,
        buyingPrice: parseFloat(newProduct.buyingPrice),
        sellingPrice: parseFloat(newProduct.sellingPrice),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(productsCollection, productData);
      
      // Update local state
      setProducts([
        ...products,
        {
          id: docRef.id,
          ...productData
        }
      ]);
      
      setNewProduct({
        name: '',
        category: newProduct.category, // Keep the category for convenience
        buyingPrice: '',
        sellingPrice: ''
      });
      
      setShowAddProductForm(false);
      setError(null);
    } catch (err) {
      console.error('Error adding item:', err);
      setError('Failed to add item. Please try again.');
    }
  };

  // Delete product from Firebase
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        const productRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(productRef);
        
        // Update local state
        setProducts(products.filter(product => product.id !== id));
        setError(null);
      } catch (err) {
        console.error('Error deleting item:', err);
        setError('Failed to delete item. Please try again.');
      }
    }
  };

  // Add new category
  const handleAddCategory = () => {
    if (!newCategory.trim()) {
      alert("Please enter a category name");
      return;
    }
    
    if (categories.includes(newCategory)) {
      alert("This category already exists");
      return;
    }
    
    // We don't need to add a product - just showing the form to add a product in this category
    setCategoryFilter(newCategory);
    setShowAddProductForm(true);
    setNewProduct({
      ...newProduct,
      category: newCategory
    });
    
    setNewCategory('');
    setShowCategoryForm(false);
  };

  // Update all prices in a category by percentage
  const [batchUpdatePercentage, setBatchUpdatePercentage] = useState('');
  
  const handleBatchUpdate = async () => {
    if (!batchUpdatePercentage || categoryFilter === 'All') return;
    
    const percentage = parseFloat(batchUpdatePercentage);
    if (isNaN(percentage)) return;
    
    const multiplier = 1 + (percentage / 100);
    
    try {
      // Get all products in this category
      const categoryProducts = products.filter(product => product.category === categoryFilter);
      
      // Update each product
      for (const product of categoryProducts) {
        const productRef = doc(db, COLLECTION_NAME, product.id);
        const newSellingPrice = parseFloat((product.buyingPrice * multiplier).toFixed(2));
        
        await updateDoc(productRef, { 
          sellingPrice: newSellingPrice,
          updatedAt: new Date()
        });
      }
      
      // Update local state
      setProducts(products.map(product => {
        if (product.category === categoryFilter) {
          return {
            ...product,
            sellingPrice: parseFloat((product.buyingPrice * multiplier).toFixed(2)),
            updatedAt: new Date()
          };
        }
        return product;
      }));
      
      setBatchUpdatePercentage('');
      setError(null);
    } catch (err) {
      console.error('Error updating prices:', err);
      setError('Failed to update prices. Please try again.');
    }
  };

  // Download table data as CSV
  const downloadTableAsCSV = () => {
    // Create CSV content
    const headers = ["Name", "Category", "Buying Price (€)", "Selling Price (€)", "Profit Margin"];
    
    const csvRows = [
      headers.join(','),
      ...filteredProducts.map(product => [
        `"${product.name}"`, // Add quotes around name to handle commas
        product.category,
        product.buyingPrice.toFixed(2),
        product.sellingPrice.toFixed(2),
        calculateProfitMargin(product.buyingPrice, product.sellingPrice).replace('%', '')
      ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    // Set filename
    const filename = categoryFilter === 'All' 
      ? 'price-inventory.csv' 
      : `${categoryFilter.toLowerCase()}-pricing.csv`;
      
    link.setAttribute('download', filename);
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2">Loading pricing data...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-semibold mb-6 flex items-center">
          <Tag className="mr-2" />
          Pricing Manager
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Top action buttons */}
        <div className="mb-6 flex flex-wrap gap-4 justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowAddProductForm(true);
                setShowCategoryForm(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Plus size={18} className="mr-2" />
              Add New Product
            </button>
            
            <button
              onClick={() => {
                setShowCategoryForm(true);
                setShowAddProductForm(false);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
            >
              <Plus size={18} className="mr-2" />
              Add New Category
            </button>
            
            <button
              onClick={downloadTableAsCSV}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
            >
              <Download size={18} className="mr-2" />
              Download CSV
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <Search size={18} className="text-gray-500" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-md"
            />
            
            <Filter size={18} className="text-gray-500 ml-2" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* New category form */}
        {showCategoryForm && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="text-lg font-medium mb-2">Add New Category</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Category name (e.g. Whiskey, Red, Spirits)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              />
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Add Category
              </button>
              <button
                onClick={() => setShowCategoryForm(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {/* New product form */}
        {showAddProductForm && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <Wine className="mr-2" size={20} />
              Add New Product
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Hennessy XO"
                  value={newProduct.name}
                  onChange={handleNewProductChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  name="category"
                  value={newProduct.category}
                  onChange={handleNewProductChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select Category</option>
                  {categories.filter(cat => cat !== 'All').map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buying Price (€)</label>
                <input
                  type="number"
                  name="buyingPrice"
                  placeholder="0.00"
                  value={newProduct.buyingPrice}
                  onChange={handleNewProductChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  step="0.01"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (€)</label>
                <input
                  type="number"
                  name="sellingPrice"
                  placeholder="0.00"
                  value={newProduct.sellingPrice}
                  onChange={handleNewProductChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Profit Margin: {calculateProfitMargin(newProduct.buyingPrice, newProduct.sellingPrice)}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleAddProduct}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Add Product
                </button>
                <button
                  onClick={() => setShowAddProductForm(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Batch update form */}
        {categoryFilter !== 'All' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h3 className="text-lg font-medium mb-2">Batch Update Prices for {categoryFilter}</h3>
            <div className="flex gap-2 items-center">
              <span>Set all profit margins to</span>
              <input
                type="number"
                placeholder="e.g. 100"
                value={batchUpdatePercentage}
                onChange={(e) => setBatchUpdatePercentage(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md"
              />
              <span>%</span>
              <button
                onClick={handleBatchUpdate}
                className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th 
                  className="border border-gray-200 px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Name
                    {sortField === 'name' && (
                      <ArrowUpDown size={16} className="ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  className="border border-gray-200 px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center">
                    Category
                    {sortField === 'category' && (
                      <ArrowUpDown size={16} className="ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  className="border border-gray-200 px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('buyingPrice')}
                >
                  <div className="flex items-center">
                    Buying Price
                    {sortField === 'buyingPrice' && (
                      <ArrowUpDown size={16} className="ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  className="border border-gray-200 px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('sellingPrice')}
                >
                  <div className="flex items-center">
                    Selling Price
                    {sortField === 'sellingPrice' && (
                      <ArrowUpDown size={16} className="ml-1" />
                    )}
                  </div>
                </th>
                <th className="border border-gray-200 px-4 py-2 text-left bg-blue-100">Profit Margin</th>
                <th className="border border-gray-200 px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-4 py-2">
                    {editingId === product.id ? (
                      <input
                        type="text"
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                        className="w-full p-1 border border-gray-300 rounded"
                      />
                    ) : (
                      product.name
                    )}
                  </td>
                  <td className="border border-gray-200 px-4 py-2">
                    {editingId === product.id ? (
                      <select
                        name="category"
                        value={editForm.category}
                        onChange={handleEditChange}
                        className="w-full p-1 border border-gray-300 rounded"
                      >
                        {categories.filter(cat => cat !== 'All').map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    ) : (
                      product.category
                    )}
                  </td>
                  <td className="border border-gray-200 px-4 py-2">
                    {editingId === product.id ? (
                      <input
                        type="number"
                        name="buyingPrice"
                        value={editForm.buyingPrice}
                        onChange={handleEditChange}
                        className="w-full p-1 border border-gray-300 rounded"
                        step="0.01"
                        min="0"
                      />
                    ) : (
                      product.buyingPrice !== undefined && product.buyingPrice !== null ? 
                      `${product.buyingPrice.toFixed(2)}€` : 
                      ''
                    )}
                  </td>
                  <td className="border border-gray-200 px-4 py-2">
                    {editingId === product.id ? (
                      <input
                        type="number"
                        name="sellingPrice"
                        value={editForm.sellingPrice}
                        onChange={handleEditChange}
                        className="w-full p-1 border border-gray-300 rounded"
                        step="0.01"
                        min="0"
                      />
                    ) : (
                      product.sellingPrice !== undefined && product.sellingPrice !== null ? 
                      `${product.sellingPrice.toFixed(2)}€` : 
                      ''
                    )}
                  </td>
                  <td className="border border-gray-200 px-4 py-2 bg-blue-50">
                    {calculateProfitMargin(
                      editingId === product.id ? editForm.buyingPrice : product.buyingPrice,
                      editingId === product.id ? editForm.sellingPrice : product.sellingPrice
                    )}
                  </td>
                  <td className="border border-gray-200 px-4 py-2">
                    {editingId === product.id ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={handleSave} 
                          className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                          title="Save"
                        >
                          <Save size={16} />
                        </button>
                        <button 
                          onClick={() => setEditingId(null)} 
                          className="p-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEdit(product)} 
                          className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)} 
                          className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="border border-gray-200 px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Wine size={40} className="text-gray-400 mb-2" />
                      {categoryFilter !== 'All' ? (
                        <>
                          <p className="mb-2">No products in the {categoryFilter} category.</p>
                          <button
                            onClick={() => setShowAddProductForm(true)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                          >
                            Add a {categoryFilter} Product
                          </button>
                        </>
                      ) : (
                        <p>No products match your search criteria. Try adjusting your filters.</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        
      </div>
    </div>
  );
};

export default PricingManager;