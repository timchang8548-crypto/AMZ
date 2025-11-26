import React, { useState, useEffect, useRef } from 'react';
import { X, Search, RotateCcw, Check, GripVertical, Pin, PinOff } from 'lucide-react';
import { ColumnDef } from '../types';

interface ColumnSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  allColumns: ColumnDef[];
  onSave: (columns: ColumnDef[]) => void;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({ isOpen, onClose, allColumns, onSave }) => {
  const [localColumns, setLocalColumns] = useState<ColumnDef[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Ref to track the item being dragged
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const dragListType = useRef<'fixed' | 'selected' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalColumns(JSON.parse(JSON.stringify(allColumns)));
    }
  }, [isOpen, allColumns]);

  if (!isOpen) return null;

  const visibleColumns = localColumns.filter(c => c.isVisible && !c.isFixed);
  const fixedColumns = localColumns.filter(c => c.isFixed);
  const filteredAvailable = localColumns.filter(c => 
    !c.isVisible && c.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Logic ---

  const toggleVisibility = (id: string) => {
    setLocalColumns(prev => prev.map(c => {
      if (c.id === id) return { ...c, isVisible: true };
      return c;
    }));
  };

  const removeColumn = (id: string) => {
     setLocalColumns(prev => prev.map(c => c.id === id ? { ...c, isVisible: false, isFixed: false } : c));
  };

  const handleSelectAll = () => {
    const idsToSelect = filteredAvailable.map(c => c.id);
    setLocalColumns(prev => prev.map(c => idsToSelect.includes(c.id) ? { ...c, isVisible: true } : c));
  };

  const handleReset = () => {
    setLocalColumns(JSON.parse(JSON.stringify(allColumns)));
  };

  const toggleFixedStatus = (id: string, isFixed: boolean) => {
     setLocalColumns(prev => prev.map(c => c.id === id ? { ...c, isFixed } : c));
  };

  // --- Drag & Drop Logic ---

  const handleDragStart = (e: React.DragEvent, index: number, listType: 'fixed' | 'selected') => {
    dragItem.current = index;
    dragListType.current = listType;
  };

  const handleDragEnter = (e: React.DragEvent, index: number, listType: 'fixed' | 'selected') => {
    if (dragListType.current === listType) {
       dragOverItem.current = index;
    }
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      dragListType.current = null;
      return;
    }

    const listType = dragListType.current;
    const currentSubset = listType === 'fixed' ? [...fixedColumns] : [...visibleColumns];
    
    // Reorder the subset
    const draggedItemContent = currentSubset.splice(dragItem.current, 1)[0];
    currentSubset.splice(dragOverItem.current, 0, draggedItemContent);

    // Reconstruct full list: Fixed + Selected + Hidden
    const hiddenItems = localColumns.filter(c => !c.isVisible && !c.isFixed);
    
    let newColumns: ColumnDef[] = [];
    if (listType === 'fixed') {
       newColumns = [...currentSubset, ...visibleColumns, ...hiddenItems];
    } else {
       newColumns = [...fixedColumns, ...currentSubset, ...hiddenItems];
    }

    setLocalColumns(newColumns);

    dragItem.current = null;
    dragOverItem.current = null;
    dragListType.current = null;
  };

  return (
    // 關鍵修改：z-50 改為 z-[100] 以確保蓋過表格 Header (z-50) 和 App Header (z-60)
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] h-[700px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">自訂欄位顯示</h2>
            <p className="text-sm text-gray-500 mt-1">拖曳可調整順序，點擊可新增或隱藏欄位</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Available Selection */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col p-4 bg-gray-50/50">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide px-1">可用欄位</h3>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="搜尋欄位..." 
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs text-gray-500">{filteredAvailable.length} 個項目</span>
                <button 
                   onClick={handleSelectAll}
                   className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                >
                   全部加入
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
               {filteredAvailable.length === 0 && (
                   <div className="text-center py-8 text-gray-400 text-sm">
                       沒有符合的欄位
                   </div>
               )}
               {filteredAvailable.map(col => (
                 <div 
                   key={col.id} 
                   className="flex items-center gap-3 p-2.5 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 rounded-lg cursor-pointer transition-all group"
                   onClick={() => toggleVisibility(col.id)}
                 >
                    <div className="w-4 h-4 rounded border border-gray-300 bg-white flex items-center justify-center text-white transition-colors group-hover:border-teal-500">
                        {/* Empty box icon */}
                    </div>
                    <span className="text-sm text-gray-600 group-hover:text-gray-900">{col.label}</span>
                    <Check size={14} className="ml-auto text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                 </div>
               ))}
            </div>
          </div>

          {/* Right Panel: Active Selection */}
          <div className="flex-1 flex flex-col p-6 bg-white overflow-y-auto scrollbar-thin">
             
             {/* Fixed Columns Section */}
             <div className="mb-8">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                   <div className="flex items-center gap-2">
                       <Pin size={14} className="text-teal-600" />
                       <h3 className="font-semibold text-gray-800">固定顯示 ({fixedColumns.length})</h3>
                   </div>
                   <button 
                     onClick={() => fixedColumns.forEach(c => toggleFixedStatus(c.id, false))}
                     className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                   >
                     取消所有固定
                   </button>
                </div>

                <div className="space-y-2 min-h-[40px]">
                   {fixedColumns.length === 0 && (
                      <div className="p-4 border-2 border-dashed border-gray-100 rounded-lg text-center text-gray-400 text-sm">
                          暫無固定欄位
                      </div>
                   )}
                   {fixedColumns.map((col, index) => (
                      <div 
                        key={col.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, index, 'fixed')}
                        onDragEnter={(e) => handleDragEnter(e, index, 'fixed')}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex justify-between items-center p-3 bg-teal-50/50 border border-teal-100 rounded-lg hover:border-teal-200 cursor-move active:cursor-grabbing transition-all group"
                      >
                          <div className="flex items-center gap-3">
                             <GripVertical size={16} className="text-teal-300" />
                             <span className="text-sm font-medium text-teal-900">{col.label}</span>
                          </div>
                          <button 
                            onClick={() => toggleFixedStatus(col.id, false)} 
                            className="text-teal-400 hover:text-red-500 p-1.5 rounded hover:bg-white transition-colors" 
                            title="取消固定"
                          >
                             <PinOff size={16} />
                          </button>
                      </div>
                   ))}
                </div>
             </div>

             {/* Selected Columns Section */}
             <div>
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                   <h3 className="font-semibold text-gray-800">一般欄位 ({visibleColumns.length})</h3>
                   <button 
                      onClick={() => visibleColumns.forEach(c => removeColumn(c.id))}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                   >
                      全部隱藏
                   </button>
                </div>
                
                <div className="space-y-2 min-h-[40px]">
                   {visibleColumns.length === 0 && (
                      <div className="p-8 border-2 border-dashed border-gray-100 rounded-lg text-center">
                          <p className="text-gray-400 text-sm">請從左側選擇欄位加入</p>
                      </div>
                   )}
                   {visibleColumns.map((col, index) => (
                      <div 
                        key={col.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, index, 'selected')}
                        onDragEnter={(e) => handleDragEnter(e, index, 'selected')}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm cursor-move active:cursor-grabbing transition-all group"
                      >
                          <div className="flex items-center gap-3">
                             <GripVertical size={16} className="text-gray-300 group-hover:text-gray-500" />
                             <span className="text-sm text-gray-700">{col.label}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                             <button 
                                onClick={() => toggleFixedStatus(col.id, true)} 
                                className="text-gray-400 hover:text-teal-600 p-1.5 rounded hover:bg-gray-100"
                                title="固定至左側"
                             >
                                <Pin size={16} />
                             </button>
                             <button 
                                onClick={() => removeColumn(col.id)} 
                                className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-gray-100"
                                title="隱藏欄位"
                             >
                                <X size={16} />
                             </button>
                          </div>
                      </div>
                   ))}
                </div>
             </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/80 rounded-b-xl">
           <button 
             onClick={handleReset} 
             className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-200/50 transition-colors"
           >
             <RotateCcw size={14} />
             重設預設值
           </button>
           <div className="flex gap-3">
              <button 
                onClick={onClose} 
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 text-gray-700 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => { onSave(localColumns); onClose(); }} 
                className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black shadow-lg shadow-gray-200 hover:shadow-gray-300 transition-all"
              >
                套用變更
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnSelector;