'use client';

import { useState, useCallback, DragEvent, ChangeEvent } from 'react';

interface FileState {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  stats?: {
    staged: number;
    duplicates: number;
    skills: number;
    intros: number;
  };
  error?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'csv'].includes(ext || '');
    });

    setFiles(prev => [
      ...prev,
      ...droppedFiles.map(file => ({ file, status: 'pending' as const }))
    ]);
  }, []);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const selectedFiles = Array.from(e.target.files).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'csv'].includes(ext || '');
    });

    setFiles(prev => [
      ...prev,
      ...selectedFiles.map(file => ({ file, status: 'pending' as const }))
    ]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = async () => {
    if (isUploading) return;
    
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const fileState = files[i];
      if (fileState.status !== 'pending') continue;

      // Update to uploading
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading' } : f
      ));

      try {
        // Update to processing
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'processing' } : f
        ));

        const formData = new FormData();
        formData.append('file', fileState.file);

        const response = await fetch('/api/ingest/process', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const result = await response.json();

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { 
            ...f, 
            status: 'done',
            stats: {
              staged: result.staged || 0,
              duplicates: result.duplicates || 0,
              skills: result.skills || 0,
              intros: result.intros || 0,
            }
          } : f
        ));
      } catch (error) {
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { 
            ...f, 
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          } : f
        ));
      }
    }

    setIsUploading(false);
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Upload Resumes</h1>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors mb-6
            ${isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
          `}
        >
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.csv"
            onChange={handleFileSelect}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer">
            <p className="text-lg text-gray-600 mb-2">
              Drag and drop resumes here, or click to browse
            </p>
            <p className="text-sm text-gray-400">
              Supports .pdf, .docx, .csv
            </p>
          </label>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-6">
            {files.map((fileState, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border-b last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">{fileState.file.name}</span>
                  {fileState.status === 'uploading' && (
                    <span className="text-blue-600 text-sm">Uploading...</span>
                  )}
                  {fileState.status === 'processing' && (
                    <span className="text-yellow-600 text-sm">Processing...</span>
                  )}
                  {fileState.status === 'done' && fileState.stats && (
                    <span className="text-green-600 text-sm opacity-0 animate-fade-in">
                      ✓ {fileState.stats.staged} bullets, {fileState.stats.duplicates} dupes
                    </span>
                  )}
                  {fileState.status === 'error' && (
                    <span className="text-red-600 text-sm">{fileState.error}</span>
                  )}
                </div>
                <button
                  onClick={() => removeFile(index)}
                  disabled={fileState.status === 'uploading' || fileState.status === 'processing'}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={pendingCount === 0 || isUploading}
          className={`
            w-full py-3 px-6 rounded-lg font-medium transition-opacity
            ${pendingCount === 0 || isUploading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          {isUploading 
            ? 'Processing...' 
            : pendingCount > 0 
              ? `Upload ${pendingCount} file${pendingCount > 1 ? 's' : ''}`
              : 'No files to upload'
          }
        </button>

        {/* Error display for failed files */}
        {files.some(f => f.status === 'error') && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-medium text-red-800 mb-2">Failed Uploads</h3>
            {files.filter(f => f.status === 'error').map((f, i) => (
              <p key={i} className="text-sm text-red-600">
                {f.file.name}: {f.error}
              </p>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-in;
        }
      `}</style>
    </div>
  );
}
