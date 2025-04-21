// src/components/QRGenerator.js
import React, { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { QRCodeCanvas } from 'qrcode.react';   // direct import!

const WA_BASE_URL = 'https://wa.me';

const QRGenerator = ({
  defaultCountryCode = '+34',
  defaultMessage     = 'Hello! I just scanned your QR code.',
  minSize            = 128,
  maxSize            = 512,
  stepSize           = 32,
}) => {
  const [phoneNumber, setPhoneNumber] = useState(defaultCountryCode);
  const [message, setMessage]         = useState(defaultMessage);
  const [qrSize, setQrSize]           = useState(256);
  const qrRef                          = useRef(null);
  const [whatsappUrl, setWhatsappUrl] = useState('');

  // always build public wa.me URL
  const getWhatsAppUrl = useCallback(() => {
    const digits = phoneNumber.replace(/\D/g, '');
    return digits
      ? `${WA_BASE_URL}/${digits}?text=${encodeURIComponent(message)}`
      : '';
  }, [phoneNumber, message]);

  // keep URL in sync
  useEffect(() => {
    const url = getWhatsAppUrl();
    console.log('🔗 WhatsApp URL:', url);
    setWhatsappUrl(url);
  }, [getWhatsAppUrl]);

  // download the generated QR
  const downloadQRCode = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const png   = canvas.toDataURL('image/png');
    const link  = document.createElement('a');
    link.href   = png;
    link.download = 'whatsapp-qr.png';
    link.click();
  }, []);

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-center">WhatsApp QR Generator</h1>

      {/* Phone */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          WhatsApp Number
        </label>
        <input
          type="text"
          value={phoneNumber}
          onChange={e => setPhoneNumber(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg"
        />
      </div>

      {/* Message */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Message
        </label>
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg"
        />
      </div>

      {/* Size */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Size: <span className="font-semibold">{qrSize}px</span>
        </label>
        <input
          type="range"
          min={minSize}
          max={maxSize}
          step={stepSize}
          value={qrSize}
          onChange={e => setQrSize(+e.target.value)}
          className="w-full"
        />
      </div>

      {/* Preview */}
      {whatsappUrl && (
        <>
          <div className="break-words bg-gray-100 p-2 rounded-lg mb-4 text-sm">
            <strong>URL:</strong> {whatsappUrl}
          </div>
          <div className="flex justify-center mb-4" ref={qrRef}>
            <QRCodeCanvas
              value={whatsappUrl}
              size={qrSize}
              level="H"
              includeMargin={true}
            />
          </div>
          <button
            onClick={downloadQRCode}
            className="w-full py-2 mb-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Download QR Code
          </button>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-center"
          >
            Test URL Directly
          </a>
        </>
      )}
    </div>
  );
};

QRGenerator.propTypes = {
  defaultCountryCode: PropTypes.string,
  defaultMessage:     PropTypes.string,
  minSize:            PropTypes.number,
  maxSize:            PropTypes.number,
  stepSize:           PropTypes.number,
};

export default QRGenerator;
