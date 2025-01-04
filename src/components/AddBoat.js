import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from "../firebase/firebaseConfig";
import { useNavigate, useParams } from 'react-router-dom';

const AddBoat = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const MAX_IMAGES = 12;
    const [isEditing, setIsEditing] = useState(false);

    const initialBoatState = {
        name: '',
        images: [],
        specs: '',
        price: '',
        cruisingArea: '',
        description: '',
        detailedSpecs: {
            Length: '',
            Guests: '',
            Crew: '',
            'Cruising Area': '',
            Price: '',
            'Cruising Speed': '',
            'Max Speed': '',
            Class: '',
            Engine: '',
            HP: ''
        },
        seasonalPrices: {
            'May / October': '',
            'June / September': '',
            'July / August': ''
        }
    };

    const [boatData, setBoatData] = useState(initialBoatState);

    useEffect(() => {
        if (id) {
            setIsEditing(true);
            const fetchBoatDetails = async () => {
                setLoading(true);
                try {
                     const boatDoc = await getDoc(doc(db, 'boats', id));
                     if (boatDoc.exists()) {
                        const data = boatDoc.data();
                        setBoatData({ id: boatDoc.id, ...data });
                        setImagePreviews(data.images || []);
                        setImageFiles(data.images || []); // Initialize imageFiles with existing URLs
                     } else {
                         setError("Boat not found");
                    }
                } catch (err) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            fetchBoatDetails();
        } else {
            setBoatData(initialBoatState);
            setImageFiles([]);
            setImagePreviews([]);
            setIsEditing(false);
        }
    }, [id]);

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        const remainingSlots = MAX_IMAGES - imageFiles.length;
        const filesToAdd = files.slice(0, remainingSlots);

        if (imageFiles.length + files.length > MAX_IMAGES) {
            alert(`You can only upload up to ${MAX_IMAGES} images. ${remainingSlots} slots remaining.`);
        }

        filesToAdd.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviews(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });

        setImageFiles(prev => [...prev, ...filesToAdd]);
    };

    const removeImage = (index) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleInputChange = (e, section = null) => {
        const { name, value } = e.target;

        if (section) {
            setBoatData(prev => ({
                ...prev,
                [section]: {
                    ...prev[section],
                    [name]: value
                }
            }));
        } else {
            setBoatData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const uploadImages = async (files) => {
        const uploadPromises = files.map(async (file) => {
            try {
                const storageRef = ref(storage, `boats/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                return getDownloadURL(storageRef);
            } catch (error) {
                console.error('Error uploading image:', error);
                throw error;
            }
        });

        return Promise.all(uploadPromises);
    };

     const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
           const newImageUrls = await uploadImages(imageFiles.filter(file => typeof file !== 'string'));

            let finalImageUrls = [];

             if (isEditing && boatData.images) {
              // Preserve existing images and add new ones
              const existingImageUrls = Array.isArray(boatData.images)
                  ? boatData.images.filter(url => imagePreviews.includes(url))
                : [];
              finalImageUrls = [...existingImageUrls, ...newImageUrls];

             } else {
               finalImageUrls = newImageUrls;
           }


            if (isEditing) {
                const boatRef = doc(db, 'boats', id);
                await updateDoc(boatRef, {
                    ...boatData,
                    images: finalImageUrls,
                    updatedAt: new Date()
                });
                navigate('/boats');
            } else {
                const boatsRef = collection(db, 'boats');
                await addDoc(boatsRef, {
                    ...boatData,
                    images: finalImageUrls,
                    createdAt: new Date()
                });
                navigate('/boats');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const placeholders = {
        description: "Enter a detailed description of the boat, including its key features, amenities, and unique characteristics...",
        specs: {
            Length: "e.g., 32.92m",
            Guests: "e.g., 12",
            Crew: "e.g., 3",
            'Cruising Area': "e.g., Balearics",
            Price: "e.g., €11,000 per day",
            'Cruising Speed': "e.g., 28 knots",
            'Max Speed': "e.g., 36 knots",
            Class: "e.g., Motoryacht",
            Engine: "e.g., 2 x MTU 12V 4000 M90",
            HP: "e.g., 5,470"
        },
        seasonalPrices: {
            'May / October': "e.g., €11,000 per day",
            'June / September': "e.g., €11,000 per day",
            'July / August': "e.g., €13,750 per day"
        }
    };

     return (
        <div className="container mx-auto p-4 max-w-3xl">
            <h1 className="text-2xl font-bold mb-6">{isEditing ? 'Edit Boat' : 'Add New Boat'}</h1>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={boatData.name}
                                onChange={handleInputChange}
                                placeholder="e.g., Mangusta 108"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Boat Images</label>
                            <div className="mt-1 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                        <span>Upload Images ({imageFiles.length}/{MAX_IMAGES})</span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageChange}
                                            disabled={imageFiles.length >= MAX_IMAGES}
                                        />
                                    </label>
                                    <span className="text-sm text-gray-500">
                                        {MAX_IMAGES - imageFiles.length} slots remaining
                                    </span>
                                </div>
                                {loading ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                    {/* Skeleton preview images while loading */}
                                        {[...Array(12)].map((_, index) => (
                                           <div key={index} className="relative group bg-gray-100 rounded-lg w-full h-24 animate-pulse">
                                          </div>
                                        ))}
                                  </div>
                                ) : (
                                    imagePreviews.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                            {imagePreviews.map((preview, index) => (
                                                <div key={index} className="relative group">
                                                    <img
                                                        src={preview}
                                                        alt={`Preview ${index + 1}`}
                                                        className="w-full h-24 object-cover rounded-lg"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeImage(index)}
                                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            name="description"
                            value={boatData.description}
                            onChange={handleInputChange}
                            placeholder={placeholders.description}
                            rows="4"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Detailed Specifications</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.keys(boatData.detailedSpecs).map(spec => (
                            <div key={spec}>
                                <label className="block text-sm font-medium text-gray-700">{spec}</label>
                                <input
                                    type="text"
                                    name={spec}
                                    value={boatData.detailedSpecs[spec]}
                                    onChange={(e) => handleInputChange(e, 'detailedSpecs')}
                                    placeholder={placeholders.specs[spec]}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Seasonal Prices</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.keys(boatData.seasonalPrices).map(season => (
                            <div key={season}>
                                <label className="block text-sm font-medium text-gray-700">{season}</label>
                                <input
                                    type="text"
                                    name={season}
                                    value={boatData.seasonalPrices[season]}
                                    onChange={(e) => handleInputChange(e, 'seasonalPrices')}
                                    placeholder={placeholders.seasonalPrices[season]}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end space-x-4">
                    <button
                        type="button"
                        onClick={() => navigate('/boats')}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update Boat' : 'Add Boat')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddBoat;