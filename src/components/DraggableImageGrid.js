import React from 'react';

const DraggableImageGrid = ({ images, onReorder, onRemove }) => {
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (dragIndex === dropIndex) return;

    const newImages = [...images];
    const [movedItem] = newImages.splice(dragIndex, 1);
    newImages.splice(dropIndex, 0, movedItem);
    onReorder(newImages);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
      {images.map((preview, index) => (
        <div
          key={index}
          className="relative group cursor-move"
          draggable="true"
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
        >
          <img
            src={preview}
            alt={`Preview ${index + 1}`}
            className="w-full h-24 object-cover rounded-lg"
          />
          <div className="absolute top-0 left-0 bg-black bg-opacity-50 text-white px-2 py-1 text-xs rounded-tl-lg">
            {index + 1}
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default DraggableImageGrid;