import React, { useState } from 'react';
import { X, Upload, FileText, ArrowRight, Wand2 } from 'lucide-react';

interface OptimizationUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcess: (placementFile: string, keywordFile: string) => void;
}

const OptimizationUploadModal: React.FC<OptimizationUploadModalProps> = ({ isOpen, onClose, onProcess }) => {
  const [placementFile, setPlacementFile] = useState<File | null>(null);
  const [keywordFile, setKeywordFile] = useState<File | null>(null);
  const [placementText, setPlacementText] = useState<string>('');
  const [keywordText, setKeywordText] = useState<string>('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'placement' | 'keyword') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (type === 'placement') {
          setPlacementFile(file);
          setPlacementText(text);
        } else {
          setKeywordFile(file);
          setKeywordText(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleProcess = () => {
    if (placementText && keywordText) {
      onProcess(placementText, keywordText);
    }
  };

  // Mock Data Generators for Demo
  const handleLoadDemo = () => {
    const mockPlacement = `Placement,Campaign,Impression,Clicks,Cost,Spend,CPC,Orders,Sales,ACOS,ROAS
Top of Search (page 1),Campaign A,1000,50,0,25.00,0.50,5,100.00,25.00%,4.00
Rest of Search,Campaign A,2000,80,0,32.00,0.40,2,30.00,106.67%,0.94
Product Pages,Campaign A,5000,100,0,30.00,0.30,8,120.00,25.00%,4.00`;

    const mockKeyword = `State,Campaign Name,Match Type,Status,Keyword or Product Targeting,Bid,Max Bid,Impressions,Clicks,CTR,Spend,CPC,Orders,Sales,ACOS,ROAS
ENABLED,Campaign A,Broad,TARGETING_ENABLED,wireless charger,1.00,1.00,1500,45,3.00%,22.50,0.50,4,80.00,28.12%,3.55
ENABLED,Campaign A,Exact,TARGETING_ENABLED,iphone charger,1.50,1.50,800,35,4.37%,24.50,0.70,6,150.00,16.33%,6.12
PAUSED,Campaign A,Phrase,TARGETING_PAUSED,fast charger,0.80,0.80,200,5,2.50%,2.00,0.40,0,0.00,0.00%,0.00`;

    onProcess(mockPlacement, mockKeyword);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-[600px] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">上傳優化資料</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          
          {/* File 1: Placement */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors relative">
            <input 
              type="file" 
              accept=".csv"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => handleFileChange(e, 'placement')}
            />
            <div className="flex flex-col items-center gap-2">
              {placementFile ? (
                <>
                  <FileText size={32} className="text-teal-600" />
                  <span className="text-sm font-medium text-teal-800">{placementFile.name}</span>
                  <span className="text-xs text-gray-500">版位報表 (Placement Report)</span>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">點擊上傳版位報表 CSV</span>
                  <span className="text-xs text-gray-400">Placement Report</span>
                </>
              )}
            </div>
          </div>

          {/* File 2: Keywords */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors relative">
            <input 
              type="file" 
              accept=".csv"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => handleFileChange(e, 'keyword')}
            />
            <div className="flex flex-col items-center gap-2">
              {keywordFile ? (
                <>
                  <FileText size={32} className="text-teal-600" />
                  <span className="text-sm font-medium text-teal-800">{keywordFile.name}</span>
                  <span className="text-xs text-gray-500">關鍵字/搜尋詞報表 (Targeting Report)</span>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">點擊上傳關鍵字/搜尋詞報表 CSV</span>
                  <span className="text-xs text-gray-400">Keyword/Search Term Report</span>
                </>
              )}
            </div>
          </div>

        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50 rounded-b-lg">
          <button 
            onClick={handleLoadDemo}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <Wand2 size={14} /> 載入測試數據 (Demo)
          </button>

          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50 text-gray-700">
                取消
            </button>
            <button 
                onClick={handleProcess}
                disabled={!placementFile || !keywordFile}
                className={`flex items-center gap-2 px-6 py-2 text-white rounded text-sm font-medium shadow-sm ${(!placementFile || !keywordFile) ? 'bg-gray-400 cursor-not-allowed' : 'bg-teal-800 hover:bg-teal-900'}`}
            >
                開始計算 <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizationUploadModal;