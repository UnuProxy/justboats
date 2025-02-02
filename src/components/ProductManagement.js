import React, { useState, useEffect } from 'react';
import { db, storage } from "../firebase/firebaseConfig";
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';

const ProductManagement = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const productsCollection = collection(db, 'products'); // Changed from database to db
            const productsSnapshot = await getDocs(productsCollection);
            const productsList = productsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProducts(productsList);
        } catch (error) {
            console.error('Error loading products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (productId, imageUrl) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                // Delete from Firestore
                await deleteDoc(doc(db, 'products', productId)); // Changed from database to db

                // Delete image from Storage if exists
                if (imageUrl) {
                    const imageRef = ref(storage, imageUrl);
                    await deleteObject(imageRef);
                }

                // Update state
                setProducts(products.filter(product => product.id !== productId));
            } catch (error) {
                console.error('Error deleting product:', error);
            }
        }
    };

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Product Management</h1>
                <button
                    onClick={() => navigate('/add-product')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Add New Product
                </button>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                    <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                        <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-48 object-cover"
                        />
                        <div className="p-4">
                            <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
                            <p className="text-gray-600 mb-2">{product.description}</p>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-blue-500 font-bold">€{product.price}</span>
                                <span className={`px-2 py-1 rounded-full text-sm ${
                                    product.stock > 10 ? 'bg-green-100 text-green-800' :
                                    product.stock > 0 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                    Stock: {product.stock}
                                </span>
                            </div>
                            <div className="flex justify-end space-x-2 mt-4">
                                <button
                                    onClick={() => navigate(`/edit-product/${product.id}`)}
                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded"
                                >
                                    <Edit className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDelete(product.id, product.imageUrl)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-500">No products found</p>
                </div>
            )}
        </div>
    );
};

export default ProductManagement;