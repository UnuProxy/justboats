// SignaturePad.jsx
import React, { useRef, useState, useEffect } from 'react';

const SignaturePad = ({ onSave, onClear }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState(null);
  
  // Initialize canvas on component mount
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Set canvas to white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Configure drawing style
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.lineCap = 'round';
    
    setCtx(context);
    
    // Handle resize
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Reset canvas after resize
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = '#000000';
      context.lineWidth = 2;
      context.lineCap = 'round';
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Drawing event handlers
  const startDrawing = (e) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get pointer position (works for both mouse and touch)
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };
  
  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get pointer position
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  
  const stopDrawing = () => {
    setIsDrawing(false);
    ctx.closePath();
    
    // Save the signature data
    if (onSave) {
      const signatureData = canvasRef.current.toDataURL();
      onSave(signatureData);
    }
  };
  
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (onClear) {
      onClear();
    }
  };
  
  return (
    <div className="signature-pad-container w-full">
      <canvas 
        ref={canvasRef}
        width={400}
        height={200}
        className="border border-gray-300 rounded w-full h-32 touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="flex justify-end mt-2">
        <button
          onClick={clearCanvas}
          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;