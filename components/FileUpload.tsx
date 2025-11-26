import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onDataLoaded: (csvText: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onDataLoaded(text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="ml-4">
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
      >
        <Upload size={16} />
        匯入 CSV
      </button>
    </div>
  );
};

export default FileUpload;
