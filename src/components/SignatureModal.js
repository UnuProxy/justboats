import React, { useRef, useState } from 'react';
import SignaturePad from 'react-signature-canvas';
import { X } from 'lucide-react';

const SignatureModal = ({ isOpen, onClose, onSave, paymentInfo }) => {
    const sigPadRef = useRef(null);
    const [name, setName] = useState('');

    const handleSave = () => {
        if (sigPadRef.current.isEmpty()) {
            alert('Please provide a signature');
            return;
        }
        if (!name.trim()) {
            alert('Please enter your name');
            return;
        }

        const signatureData = sigPadRef.current.toDataURL();
        onSave(signatureData, name, paymentInfo);
        onClose();
    };

    const handleClear = () => {
        sigPadRef.current.clear();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Sign Payment</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2"
                        placeholder="Enter your name"
                    />
                </div>

                <div className="border border-gray-300 rounded-md mb-4">
                    <SignaturePad
                        ref={sigPadRef}
                        canvasProps={{
                            className: "w-full h-48"
                        }}
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleClear}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                        Clear
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignatureModal;