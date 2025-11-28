import React, { useState, useEffect } from 'react';
import { CampaignData, SortDirection, SortField, DisplayMode, ColumnDef } from '../types';
import { ArrowUp, ArrowDown, PlayCircle, PauseCircle, Wand2, FolderPlus } from 'lucide-react';

interface CampaignTableProps {
  currentData: CampaignData[];
  prevData: CampaignData[];
  showCompare?: boolean;
  displayMode?: DisplayMode;
  columns: ColumnDef[];
  onOpenOptimizer: () => void;
}

const CHECKBOX_WIDTH = 50;

const CampaignTable: React.FC<CampaignTableProps> = ({ 
  currentData, 
  prevData, 
  showCompare = true,
  displayMode = 'all',
  columns,
  onOpenOptimizer
}) => {
  const [sortField, setSortField] = useState<SortField>('spend');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // [新增] 追蹤選取的廣告活動 ID
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 當資料來源改變時（例如切換日期），重置選取狀態
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentData]);

  const visibleColumns = columns.filter(c => c.isVisible);
  const fixedColumns = visibleColumns.filter(c => c.isFixed);
  const scrollableColumns = visibleColumns.filter(c => !c.isFixed);
  const displayColumns = [...fixedColumns, ...scrollableColumns];

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const tableData = currentData.map(curr => {
    const prev = prevData.find(p => p.id === curr.id);
    return { curr, prev };
  });

  const sortedData = [...tableData].sort((a, b) => {
    const valA = a.curr[sortField];
    const valB = b.curr[sortField];
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortDirection === 'asc' 
      ? (Number(valA) || 0) - (Number(valB) || 0) 
      : (Number(valB) || 0) - (Number(valA) || 0);
  });

  // [新增] 處理單選
  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // [新增] 處理全選
  const handleSelectAll = () => {
    if (selectedIds.size === sortedData.length && sortedData.length > 0) {
      setSelectedIds(new Set()); // 取消全選
    } else {
      const allIds = sortedData.map(item => item.curr.id);
      setSelectedIds(new Set(allIds));
    }
  };

  // [新增] 處理優化按鈕點擊
  const handleOptimizerClick = () => {
    if (selectedIds.size === 0) {
      alert("請先勾選至少一個廣告活動以進行優化");
      return;
    }
    onOpenOptimizer();
  };

  const formatDate = (val: any) => {
    if (!val) return '-';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderStackedCell = (value: any, prevValue: any, type: string, inverse = false, isFooter = false) => {
    if (value === undefined || value === null || value === '') return <span className="text-gray-300">-</span>;

    const isCurrency = type === 'currency';
    const isPercent = type === 'percent';
    const format = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: isCurrency ? 2 : (isPercent ? 2 : 0) });

    let displayValue = String(value);
    if (typeof value === 'number') {
       displayValue = format(value);
       if (isCurrency) displayValue = `$${displayValue}`;
       if (isPercent) displayValue = `${displayValue}%`;
    }

    if (!showCompare || prevValue === undefined || prevValue === null) {
      return (
        <div className={`flex items-center h-full py-1 justify-end`}>
          <span className={`text-sm font-medium text-gray-900 leading-tight ${isFooter ? 'font-bold' : ''}`}>{displayValue}</span>
        </div>
      );
    }

    const safePrev = typeof prevValue === 'number' ? prevValue : 0;
    const safeCurr = typeof value === 'number' ? value : 0;
    const diffPercent = safePrev !== 0 ? ((safeCurr - safePrev) / safePrev) * 100 : 0;
    
    let displayPrev = format(safePrev);
    if (isCurrency) displayPrev = `$${displayPrev}`;
    if (isPercent) displayPrev = `${displayPrev}%`;

    const isPositive = diffPercent > 0;
    const isNegative = diffPercent < 0;
    let colorClass = 'text-gray-400';
    if (isPositive) colorClass = inverse ? 'text-red-600' : 'text-green-600';
    if (isNegative) colorClass = inverse ? 'text-green-600' : 'text-red-600';

    return (
      <div className={`flex flex-col items-end justify-center h-full py-1`}>
        <span className={`text-sm text-gray-900 leading-tight ${isFooter ? 'font-bold' : 'font-medium'}`}>{displayValue}</span>
        {(displayMode === 'all' || displayMode === 'value') && (
           <span className="text-[10px] text-gray-400 leading-tight mt-0.5">{displayPrev}</span>
        )}
        {(displayMode === 'all' || displayMode === 'percent') && (
           <span className={`text-[10px] font-bold leading-tight mt-0.5 ${colorClass}`}>
              {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
           </span>
        )}
      </div>
    );
  };

  const getStickyStyle = (index: number, isHeader = false, isFooter = false, colWidth: number) => {
    if (index >= fixedColumns.length) {
        if (isHeader) return { position: 'sticky' as const, top: 0, zIndex: 40, backgroundColor: '#f9fafb', width: colWidth };
        if (isFooter) return { position: 'sticky' as const, bottom: 0, zIndex: 40, backgroundColor: '#f3f4f6', width: colWidth };
        return { width: colWidth };
    }

    let left = CHECKBOX_WIDTH; 
    for (let i = 0; i < index; i++) {
       left += (fixedColumns[i].width || 150);
    }

    const isLastFixed = index === fixedColumns.length - 1;

    const zIndex = isHeader ? 50 : (isFooter ? 50 : 30);
    const bgColor = isHeader ? '#f9fafb' : (isFooter ? '#f3f4f6' : 'var(--row-bg, #ffffff)');

    const style: React.CSSProperties = {
       position: 'sticky',
       left: `${left}px`,
       top: isHeader ? 0 : undefined,
       bottom: isFooter ? 0 : undefined,
       zIndex: zIndex,
       backgroundColor: bgColor,
       width: colWidth,
       minWidth: colWidth,
       maxWidth: colWidth,
       borderRight: isLastFixed ? '1px solid #e5e7eb' : 'none', 
    };

    if (isLastFixed) {
        style.boxShadow = '4px 0 8px -2px rgba(0, 0, 0, 0.1)';
        style.clipPath = 'inset(0 -15px 0 0)'; 
    }

    return style;
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden mt-4">
      <div className="flex items-center gap-2 p-3 bg-white border-b border-gray-200 sticky left-0 z-10">
         {/* [修改] 顯示真實的選取數量 */}
         <div className="text-sm text-gray-500 mr-2">
            已選擇 {selectedIds.size} 個項目
         </div>
         
         <button className={`flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-opacity ${!hasSelection ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <FolderPlus size={14} /> 加入優化組合
         </button>
         
         {/* [修改] 加入 disabled 樣式與點擊檢查 */}
         <button 
            onClick={handleOptimizerClick}
            disabled={!hasSelection}
            className={`flex items-center gap-1 px-3 py-1.5 bg-teal-800 text-white rounded text-sm hover:bg-teal-900 transition-all ${!hasSelection ? 'opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400' : ''}`}
         >
            <Wand2 size={14} /> 優化出價
         </button>
      </div>

      <div className="overflow-x-auto scrollbar-thin relative min-h-[400px] max-h-[800px]">
        <table className="min-w-full divide-y divide-gray-200" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
          <thead className="bg-gray-50">
            <tr>
              {/* Checkbox Header */}
              <th 
                className="px-4 py-3 text-center border-b border-gray-200 sticky left-0 top-0 z-50 bg-gray-50"
                style={{ width: CHECKBOX_WIDTH, minWidth: CHECKBOX_WIDTH, maxWidth: CHECKBOX_WIDTH }}
              >
                  {/* [修改] 實作全選功能 */}
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 cursor-pointer" 
                    checked={sortedData.length > 0 && selectedIds.size === sortedData.length}
                    onChange={handleSelectAll}
                  />
              </th>
              
              {displayColumns.map((col, idx) => {
                const colWidth = col.width || 150;
                const style = getStickyStyle(idx, true, false, colWidth);
                const align = col.type === 'number' || col.type === 'currency' || col.type === 'percent' ? 'right' : 'left';
                
                return (
                  <th 
                    key={col.id}
                    className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200"
                    style={style}
                    onClick={() => handleSort(col.id)}
                  >
                    <div className={`flex items-center gap-1 ${align === 'left' ? 'justify-start' : 'justify-end'}`}>
                      {col.label}
                      {sortField === col.id && (
                        sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((row) => (
              <tr 
                key={row.curr.id} 
                className={`hover:bg-gray-50 transition-colors group ${selectedIds.has(row.curr.id) ? 'bg-blue-50/30' : ''}`}
                style={{ '--row-bg': selectedIds.has(row.curr.id) ? '#eff6ff' : '#f9fafb' } as React.CSSProperties}
              >
                {/* Checkbox Body */}
                <td 
                  className="px-4 py-3 text-center sticky left-0 z-30 border-b border-gray-100" 
                  style={{ 
                      width: CHECKBOX_WIDTH, 
                      minWidth: CHECKBOX_WIDTH, 
                      maxWidth: CHECKBOX_WIDTH,
                      backgroundColor: 'var(--row-bg, white)' 
                  }}
                >
                  {/* [修改] 實作單選功能 */}
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                    checked={selectedIds.has(row.curr.id)}
                    onChange={() => handleSelectOne(row.curr.id)}
                  />
                </td>

                {displayColumns.map((col, idx) => {
                  const colWidth = col.width || 150;
                  const style = getStickyStyle(idx, false, false, colWidth);
                  
                  const isTextColumn = col.id === 'campaignName';
                  const wrapClass = isTextColumn ? 'whitespace-normal break-words' : 'whitespace-nowrap';

                  let content = null;

                  if (col.id === 'campaignName') {
                      content = (
                        <div className="flex flex-col justify-center h-full items-start text-left">
                           <span 
                             className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                             title={row.curr[col.id]}
                           >
                             {row.curr[col.id]}
                           </span>
                        </div>
                      );
                  } 
                  else if (col.id === 'status') {
                      const statusVal = String(row.curr[col.id]).toUpperCase();
                      content = (
                        <div className="flex items-center justify-start pl-2">
                           {statusVal === 'ENABLED' 
                             ? <PlayCircle className="text-green-500 fill-green-50" size={20} /> 
                             : <PauseCircle className="text-orange-400 fill-orange-50" size={20} />
                           }
                        </div>
                      );
                  } 
                  else if (col.type === 'date') {
                      content = (
                        <div className="flex items-center justify-end h-full text-sm text-gray-600">
                          {formatDate(row.curr[col.id])}
                        </div>
                      );
                  }
                  else if (col.id === 'state') {
                       content = <span className="px-2 py-0.5 rounded border border-gray-300 text-xs font-bold text-gray-500 bg-gray-50">SP</span>;
                  }
                  else {
                      content = renderStackedCell(
                        row.curr[col.id], 
                        row.prev?.[col.id], 
                        col.type, 
                        ['cpc', 'acos', 'cpa', 'spend', 'cpm'].includes(col.id)
                      );
                  }

                  return (
                    <td 
                      key={col.id} 
                      className={`px-4 py-3 border-b border-gray-100 ${wrapClass}`}
                      style={style}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          {/* Footer */}
          {sortedData.length > 0 && (
             <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
               <tr>
                 <td 
                    className="px-4 py-4 sticky left-0 bottom-0 z-50 bg-gray-100 shadow-[1px_0_0_0_rgba(209,213,219,1)]"
                    style={{ width: CHECKBOX_WIDTH, minWidth: CHECKBOX_WIDTH, maxWidth: CHECKBOX_WIDTH }}
                 ></td>
                 {displayColumns.map((col, idx) => {
                     const colWidth = col.width || 150;
                     const style = getStickyStyle(idx, false, true, colWidth);
                     const footerStyle = { 
                       ...style, 
                       borderTop: '2px solid #d1d5db',
                       backgroundColor: '#f3f4f6' 
                     };
                     
                     if (col.id === 'campaignName') {
                         return (
                             <td key={col.id} style={footerStyle} className="px-4 py-4 text-left">
                                 <span className="text-gray-600">總計</span>
                             </td>
                         );
                     }
                     return <td key={col.id} style={footerStyle} className="px-4 py-4 text-right"></td>;
                 })}
               </tr>
             </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default CampaignTable;