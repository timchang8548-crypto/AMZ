import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, X, ArrowRightLeft, Check } from 'lucide-react';
import { DateRange, DisplayMode } from '../types';

interface DateRangeControlProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  compareRange: DateRange | null;
  onCompareChange: (range: DateRange | null) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  minDate?: Date;
  maxDate?: Date;
}

type PickerType = 'main' | 'compare';

const DateRangeControl: React.FC<DateRangeControlProps> = ({ 
  value, 
  onChange,
  compareRange,
  onCompareChange,
  displayMode,
  onDisplayModeChange,
  minDate,
  maxDate
}) => {
  // State for modals
  const [activePicker, setActivePicker] = useState<PickerType | null>(null);
  const [isDisplayModeOpen, setIsDisplayModeOpen] = useState(false);
  
  // Temporary state for the active picker
  const [tempRange, setTempRange] = useState<DateRange>(value);

  // Close dropdowns on outside click
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActivePicker(null);
        setIsDisplayModeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (d: Date) => {
    return `${d.getMonth() + 1}月 ${d.getDate()}, ${d.getFullYear()}`;
  };

  const getDisplayModeLabel = () => {
    switch (displayMode) {
      case 'value': return '顯示數值';
      case 'percent': return '顯示百分比';
      case 'all': return '同時顯示';
      default: return '同時顯示';
    }
  };

  // -- Handlers --

  const handleOpenPicker = (type: PickerType) => {
    if (type === 'main') {
      setTempRange(value);
    } else {
      // If opening compare picker, set temp range to current compare range OR default previous period
      if (compareRange) {
        setTempRange(compareRange);
      } else {
        // Default logic for new comparison: Previous period based on current value
        const duration = value.endDate.getTime() - value.startDate.getTime();
        const end = new Date(value.startDate);
        end.setDate(end.getDate() - 1);
        const start = new Date(end.getTime() - duration);
        setTempRange({ startDate: start, endDate: end });
      }
    }
    setActivePicker(type);
    setIsDisplayModeOpen(false);
  };

  const handleEnableCompare = () => {
    // Enable comparison with a default "Previous Period"
    const duration = value.endDate.getTime() - value.startDate.getTime();
    const end = new Date(value.startDate);
    end.setDate(end.getDate() - 1);
    const start = new Date(end.getTime() - duration);
    onCompareChange({ startDate: start, endDate: end });
  };

  const handleDisableCompare = () => {
    onCompareChange(null);
  };

  const handleApplyRange = () => {
    if (activePicker === 'main') {
      onChange(tempRange);
    } else if (activePicker === 'compare') {
      onCompareChange(tempRange);
    }
    setActivePicker(null);
  };

  // Check if a specific date is disabled
  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;

    // Range selection logic
    if (!tempRange.startDate || (tempRange.startDate && tempRange.endDate && tempRange.startDate.getTime() !== tempRange.endDate.getTime())) {
      setTempRange({ startDate: date, endDate: date });
    } else {
      if (date < tempRange.startDate) {
        setTempRange({ startDate: date, endDate: tempRange.startDate });
      } else {
        setTempRange({ startDate: tempRange.startDate, endDate: date });
      }
    }
  };

  // Presets for Comparison
  const handlePreset = (mode: 'previous' | 'lastYear') => {
    if (activePicker === 'compare') {
      const start = new Date(value.startDate);
      const end = new Date(value.endDate);
      const duration = end.getTime() - start.getTime();

      if (mode === 'previous') {
        const newEnd = new Date(start);
        newEnd.setDate(newEnd.getDate() - 1);
        const newStart = new Date(newEnd.getTime() - duration);
        setTempRange({ startDate: newStart, endDate: newEnd });
      } else if (mode === 'lastYear') {
        const newStart = new Date(start);
        newStart.setFullYear(newStart.getFullYear() - 1);
        const newEnd = new Date(end);
        newEnd.setFullYear(newEnd.getFullYear() - 1);
        setTempRange({ startDate: newStart, endDate: newEnd });
      }
    }
  };

  const isSelected = (date: Date) => {
    if (!tempRange.startDate) return false;
    if (!tempRange.endDate) return date.getTime() === tempRange.startDate.getTime();
    return date >= tempRange.startDate && date <= tempRange.endDate;
  };

  const renderCalendar = () => {
    // Render static months for demo: Nov 2025, Dec 2025
    const renderMonth = (year: number, month: number, title: string) => {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();
      
      const days = [];
      for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="p-1"></div>);
      
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const disabled = isDateDisabled(date);
        const selected = !disabled && isSelected(date);
        const isStart = !disabled && tempRange.startDate && date.getTime() === tempRange.startDate.getTime();
        const isEnd = !disabled && tempRange.endDate && date.getTime() === tempRange.endDate.getTime();
        
        let bgClass = '';
        let textClass = 'text-gray-700';
        let cursorClass = 'cursor-pointer hover:bg-gray-100';

        if (disabled) {
          textClass = 'text-gray-300';
          cursorClass = 'cursor-not-allowed';
        } else {
          if (selected) bgClass = 'bg-gray-100';
          if (isStart || isEnd) {
            bgClass = 'bg-teal-700 z-10 relative';
            textClass = 'text-white';
            cursorClass = 'hover:bg-teal-800';
          }
          if (isStart && isEnd) bgClass += ' rounded-full';
          else if (isStart) bgClass += ' rounded-l-full';
          else if (isEnd) bgClass += ' rounded-r-full';
          else if (selected) bgClass = 'bg-teal-50'; // Light teal for range
        }

        days.push(
          <button 
            key={i} 
            onClick={() => handleDateClick(date)}
            disabled={disabled}
            className={`w-8 h-8 flex items-center justify-center text-xs transition-colors ${bgClass} ${textClass} ${cursorClass}`}
          >
            {i}
          </button>
        );
      }

      return (
        <div>
          <div className="text-center font-bold text-gray-700 mb-2">{title}</div>
          <div className="grid grid-cols-7 gap-1 text-xs text-center mb-1 text-gray-400">
            <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
          </div>
          <div className="grid grid-cols-7 gap-y-1 gap-x-0 text-center place-items-center">
            {days}
          </div>
        </div>
      );
    };

    return (
      <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col w-[600px]">
         <div className="flex border-b border-gray-200">
           {/* Sidebar */}
           <div className="w-40 bg-gray-50 p-2 border-r border-gray-200 flex flex-col gap-1">
             {activePicker === 'compare' && (
               <>
                 <button onClick={() => handlePreset('previous')} className="px-3 py-2 text-sm text-left text-gray-600 hover:bg-gray-100 rounded">上一期間</button>
                 <button onClick={() => handlePreset('lastYear')} className="px-3 py-2 text-sm text-left text-gray-600 hover:bg-gray-100 rounded">去年同期</button>
               </>
             )}
             {activePicker === 'main' && (
                <div className="px-3 py-2 text-xs text-gray-400">自定義範圍</div>
             )}
           </div>
           
           {/* Calendar */}
           <div className="flex-1 p-4">
              <div className="flex justify-between items-center mb-4">
                 <h4 className="text-sm font-bold">選擇{activePicker === 'main' ? '日期' : '比較'}範圍</h4>
              </div>
              <div className="grid grid-cols-2 gap-6">
                 {renderMonth(2025, 10, "十一月 2025")}
                 {renderMonth(2025, 11, "十二月 2025")}
              </div>
           </div>
         </div>
         
         <div className="p-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
            <button onClick={() => setActivePicker(null)} className="px-4 py-1.5 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50">取消</button>
            <button onClick={handleApplyRange} className="px-4 py-1.5 bg-teal-800 text-white rounded text-sm hover:bg-teal-900 shadow-sm">套用</button>
         </div>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2 relative" ref={containerRef}>
      
      {/* 1. Main Date Range Button */}
      <div 
        className="flex items-center gap-2 bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-700 cursor-pointer hover:border-blue-400 transition-colors shadow-sm"
        onClick={() => handleOpenPicker('main')}
      >
        <Calendar size={16} className="text-gray-500" />
        <span>{formatDate(value.startDate)} - {formatDate(value.endDate)}</span>
      </div>

      {/* 2. Compare Controls */}
      {!compareRange ? (
        // Collapsed State: Just a trigger button
        <button 
          onClick={handleEnableCompare}
          className="flex items-center justify-center w-8 h-8 bg-white border border-gray-300 rounded text-gray-500 hover:text-blue-600 hover:border-blue-400 shadow-sm transition-colors"
          title="啟用比較"
        >
          <ArrowRightLeft size={14} />
        </button>
      ) : (
        // Expanded State: Compare Picker + Display Mode + Close
        <>
          {/* Compare Picker Button */}
          <div 
            className="flex items-center gap-2 bg-white border border-yellow-400 text-gray-900 rounded px-3 py-1.5 text-sm cursor-pointer shadow-sm hover:bg-yellow-50 transition-colors"
            onClick={() => handleOpenPicker('compare')}
          >
            <Calendar size={16} className="text-yellow-600" />
            <span>{formatDate(compareRange.startDate)} - {formatDate(compareRange.endDate)}</span>
          </div>

          {/* Display Mode Dropdown */}
          <div className="relative">
            <div 
              className="flex items-center justify-between bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-700 w-32 cursor-pointer shadow-sm hover:bg-gray-50"
              onClick={() => setIsDisplayModeOpen(!isDisplayModeOpen)}
            >
              <span>{getDisplayModeLabel()}</span>
              <ChevronDown size={14} className="text-gray-500" />
            </div>

            {isDisplayModeOpen && (
              <div className="absolute top-full right-0 mt-1 w-40 bg-white border border-gray-200 rounded shadow-lg z-20 overflow-hidden">
                <div className="p-2 text-xs font-semibold text-gray-400 bg-gray-50 border-b border-gray-100">顯示數值</div>
                <button 
                  onClick={() => { onDisplayModeChange('value'); setIsDisplayModeOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center justify-between"
                >
                  顯示數值
                  {displayMode === 'value' && <Check size={14} className="text-blue-600" />}
                </button>
                <button 
                  onClick={() => { onDisplayModeChange('percent'); setIsDisplayModeOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center justify-between"
                >
                  顯示百分比
                  {displayMode === 'percent' && <Check size={14} className="text-blue-600" />}
                </button>
                 <button 
                  onClick={() => { onDisplayModeChange('all'); setIsDisplayModeOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center justify-between"
                >
                  同時顯示
                  {displayMode === 'all' && <Check size={14} className="text-blue-600" />}
                </button>
              </div>
            )}
          </div>

          {/* Close Button */}
          <button 
            onClick={handleDisableCompare}
            className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </>
      )}

      {/* Render the Active Picker Modal if any */}
      {activePicker && renderCalendar()}
    </div>
  );
};

export default DateRangeControl;