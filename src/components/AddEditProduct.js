import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from "../firebase/firebaseConfig";
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, Save, ArrowLeft } from 'lucide-react';

const AddEditProduct = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: 'drinks',
        stock: '',
        imageUrl: '',
        isActive: true,
        contents: ''
    });

    useEffect(() => {
        if (id) {
            loadProduct();
        }
    }, [id]);

    const loadProduct = async () => {
        try {
            setLoading(true);
            const productDoc = await getDoc(doc(db, 'products', id));
            if (productDoc.exists()) {
                const data = productDoc.data();
                setFormData({
                    ...data,
                    price: data.price.toString(),
                    stock: data.stock.toString()
                });
                setImagePreview(data.imageUrl);
            }
        } catch (error) {
            console.error('Error loading product:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5000000) {
                alert('Image size should be less than 5MB');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            let imageUrl = formData.imageUrl;

            // Handle image upload if there's a new file
            const imageInput = document.querySelector('input[type="file"]');
            if (imageInput.files.length > 0) {
                const file = imageInput.files[0];
                const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const productData = {
                ...formData,
                price: parseFloat(formData.price),
                stock: parseInt(formData.stock),
                imageUrl,
                updatedAt: new Date().toISOString()
            };

            if (id) {
                // Update existing product
                const productRef = doc(db, 'products', id);
                await updateDoc(productRef, productData);
            } else {
                // Add new product
                await addDoc(collection(db, 'products'), {
                    ...productData,
                    createdAt: new Date().toISOString()
                });
            }

            navigate('/products');
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Error saving product. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-6">
            <button
                onClick={() => navigate('/products')}
                className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
            >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Products
            </button>

            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
                <h1 className="text-2xl font-bold mb-6">
                    {id ? 'Edit Product' : 'Add New Product'}
                </h1>

                {/* Image Upload */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Image
                    </label>
                    <div className="flex items-center space-x-4">
                        {imagePreview && (
                            <img
                                src={imagePreview}
                                alt="Preview"
                                className="w-32 h-32 object-cover rounded-lg"
                            />
                        )}
                        <label className="flex flex-col items-center px-4 py-6 bg-white rounded-lg shadow-lg border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50">
                            <Upload className="w-8 h-8 text-gray-400" />
                            <span className="mt-2 text-sm text-gray-500">Upload image</span>
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                        </label>
                    </div>
                </div>

                {/* Product Details */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Product Name
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Category
                        </label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="drinks">Drinks</option>
                            <option value="snacks">Snacks</option>
                            <option value="packages">Packages</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                            rows="3"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Price (€)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                required
                                min="0"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Stock Quantity
                            </label>
                            <input
                                type="number"
                                value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                required
                                min="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                        </label>
                        <select
                            value={formData.isActive}
                            onChange={(e) => setFormData({ 
                                ...formData, 
                                isActive: e.target.value === 'true' 
                            })}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>

                    {/* Additional Fields for Packages */}
                    {formData.category === 'packages' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Package Contents
                            </label>
                            <textarea
                                value={formData.contents}
                                onChange={(e) => setFormData({ 
                                    ...formData, 
                                    contents: e.target.value 
                                })}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                rows="4"
                                placeholder="List the items included in this package..."
                            />
                        </div>
                    )}
                </div>

                {/* Submit Buttons */}
                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={() => navigate('/products')}
                        className="mr-4 px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className={`px-6 py-2 bg-blue-500 text-white rounded-lg flex items-center ${
                            loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                        }`}
                    >
                        <Save className="w-5 h-5 mr-2" />
                        {loading ? 'Saving...' : 'Save Product'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddEditProduct;