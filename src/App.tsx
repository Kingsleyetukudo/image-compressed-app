import React, { useState, useCallback } from 'react';
import { Upload, Download, Image as ImageIcon, X, Trash2 } from 'lucide-react';

interface ProcessedImage {
  id: string;
  name: string;
  original: {
    url: string;
    size: number;
  };
  compressed: {
    url: string;
    size: number;
  };
}

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const compressImage = async (file: File): Promise<ProcessedImage> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        
        img.onload = () => {
          const MAX_SIZE = 100 * 1024; // 100KB in bytes
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          // Calculate new dimensions while maintaining aspect ratio
          const maxWidth = 1920;
          const maxHeight = 1080;
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Binary search for optimal quality
          let minQuality = 0;
          let maxQuality = 1;
          let bestQuality = 0;
          let bestUrl = '';
          let bestSize = 0;
          let iterations = 0;
          const MAX_ITERATIONS = 10;

          while (iterations < MAX_ITERATIONS) {
            const quality = (minQuality + maxQuality) / 2;
            const compressedUrl = canvas.toDataURL('image/webp', quality);
            const size = Math.round((compressedUrl.length * 3) / 4); // Base64 to binary size

            if (size <= MAX_SIZE) {
              bestQuality = quality;
              bestUrl = compressedUrl;
              bestSize = size;
              minQuality = quality;
            } else {
              maxQuality = quality;
            }

            iterations++;
          }

          // If we couldn't get under MAX_SIZE, use the smallest size we achieved
          if (!bestUrl) {
            bestUrl = canvas.toDataURL('image/webp', minQuality);
            bestSize = Math.round((bestUrl.length * 3) / 4);
          }
          
          resolve({
            id: crypto.randomUUID(),
            name: file.name,
            original: {
              url: e.target?.result as string,
              size: file.size
            },
            compressed: {
              url: bestUrl,
              size: bestSize
            }
          });
        };
      };
    });
  };

  const processFiles = async (files: FileList) => {
    setIsProcessing(true);
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    try {
      const results = await Promise.all(imageFiles.map(file => compressImage(file)));
      setProcessedImages(prev => [...prev, ...results]);
    } catch (error) {
      console.error('Error processing images:', error);
    }
    
    setIsProcessing(false);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await processFiles(e.dataTransfer.files);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      await processFiles(e.target.files);
    }
  }, []);

  const handleDownload = useCallback((image: ProcessedImage) => {
    const link = document.createElement('a');
    link.href = image.compressed.url;
    link.download = `${image.name.split('.')[0]}.webp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setProcessedImages(prev => prev.filter(img => img.id !== id));
  }, []);

  const handleRemoveAll = useCallback(() => {
    setProcessedImages([]);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateTotalSavings = () => {
    const originalSize = processedImages.reduce((acc, img) => acc + img.original.size, 0);
    const compressedSize = processedImages.reduce((acc, img) => acc + img.compressed.size, 0);
    const savedBytes = originalSize - compressedSize;
    const savingsPercent = ((savedBytes / originalSize) * 100).toFixed(1);
    return {
      saved: formatSize(savedBytes),
      percent: savingsPercent
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Image Optimizer</h1>
          <p className="text-gray-600">Compress images to WebP format (max 100KB)</p>
        </div>

        <div
          className={`border-4 border-dashed rounded-lg p-8 transition-all mb-8 ${
            isDragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-300 bg-white'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-xl text-gray-600 mb-4">
              Drag and drop your images here, or
            </p>
            <label className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer">
              <Upload className="w-5 h-5 mr-2" />
              Browse Files
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
              />
            </label>
            <p className="mt-4 text-sm text-gray-500">
              Supports: JPG, PNG, GIF, BMP, TIFF
            </p>
          </div>
        </div>

        {processedImages.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Processed Images</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Total space saved: {calculateTotalSavings().saved} ({calculateTotalSavings().percent}%)
                </p>
              </div>
              <button
                onClick={handleRemoveAll}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {processedImages.map((image) => (
                <div key={image.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-medium text-gray-900 truncate max-w-[200px]">
                      {image.name}
                    </h3>
                    <button
                      onClick={() => handleRemove(image.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <img
                        src={image.original.url}
                        alt="Original"
                        className="rounded-lg mb-2 w-full h-40 object-cover"
                      />
                      <p className="text-sm text-gray-600">
                        Original: {formatSize(image.original.size)}
                      </p>
                    </div>
                    <div>
                      <img
                        src={image.compressed.url}
                        alt="Compressed"
                        className="rounded-lg mb-2 w-full h-40 object-cover"
                      />
                      <p className="text-sm text-gray-600">
                        Compressed: {formatSize(image.compressed.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(image)}
                    className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download WebP
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-900">Processing your images...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;