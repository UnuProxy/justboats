// EnhancedSignatureModal Component with real signature pad
import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import SignaturePad from './SignaturePad'; // Import the new SignaturePad component

const EnhancedSignatureModal = ({ isOpen, onClose, onSave, paymentInfo }) => {
    const [signatureData, setSignatureData] = useState(null);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    
    const handleSave = async () => {
      if (!signatureData || !name) {
        alert('Please provide both signature and name');
        return;
      }
      
      setSaving(true);
      try {
        await onSave(signatureData, name, paymentInfo);
        // Show success animation before closing
        setTimeout(() => {
          onClose();
        }, 1000);
      } catch (error) {
        console.error('Error saving signature:', error);
      } finally {
        setSaving(false);
      }
    };
    
    // Handler for signature data from SignaturePad
    const handleSignature = (data) => {
      setSignatureData(data);
    };
    
    // Clear signature data
    const handleClearSignature = () => {
      setSignatureData(null);
    };
    
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Sign Off Payment
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              disabled={saving}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <AlertTriangle className="inline-block w-4 h-4 mr-1" />
            <strong>Important:</strong> Signing a payment will lock it permanently. This action cannot be undone.
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              disabled={saving}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Signature
            </label>
            <div className="border border-gray-300 rounded p-2 bg-gray-50">
            {signatureData ? (
  <div className="relative w-full h-full">
    <img 
      src={signatureData} 
      alt="Signature" 
      className="object-contain w-full h-full"
    />
    <button
      onClick={() => setSignatureData(null)}
      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
      disabled={saving}
    >
      <X className="w-4 h-4" />
    </button>
  </div>
) : (
  <SignaturePad 
    onSave={(data) => setSignatureData(data)}
    onClear={() => setSignatureData(null)}
  />
)}
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
              disabled={!signatureData || !name || saving}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Finalize Payment
                </>
              )}
            </button>
          </div>
          
          {/* Success animation overlay when saving is successful */}
          {saving && (
            <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
              <div className="bg-green-100 p-4 rounded-lg flex items-center">
                <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                <span className="text-green-800 font-medium">Payment signed successfully!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
};

export default EnhancedSignatureModal;