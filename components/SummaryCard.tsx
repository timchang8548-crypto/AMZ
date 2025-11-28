import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { MetricKey, DisplayMode } from '../types';

interface SummaryCardProps {
  metricKey?: MetricKey;
  title: string;
  value: number;
  prevValue: number;
  prefix?: string;
  suffix?: string;
  isCurrency?: boolean;
  inverseColor?: boolean;
  showCompare?: boolean;
  displayMode?: DisplayMode;
  isSelected?: boolean;
  selectionColor?: string;
  onClick?: () => void;
  // [新增] 允許指定小數點位數
  decimals?: number;
}

const formatNumber = (num: number, isCurrency: boolean, decimals?: number) => {
  // 如果有傳入 decimals 則使用，否則根據是否為貨幣決定 (貨幣2位，其他0位)
  const d = decimals !== undefined ? decimals : (isCurrency ? 2 : 0);

  if (isCurrency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(num);
  }
  return new Intl.NumberFormat('en-US', {
    // [修改] 強制設定最小位數，確保 4.00 不會變成 4
    minimumFractionDigits: d, 
    maximumFractionDigits: d
  }).format(num);
};

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  prevValue,
  prefix = '',
  suffix = '',
  isCurrency = false,
  inverseColor = false,
  showCompare = true,
  displayMode = 'all',
  isSelected = false,
  selectionColor = '#3b82f6',
  onClick,
  decimals // [新增]
}) => {
  const diff = value - prevValue;
  const percentChange = prevValue !== 0 ? (diff / prevValue) * 100 : 0;
  
  let colorClass = 'text-gray-500';
  let Icon = null;

  if (percentChange > 0) {
    colorClass = inverseColor ? 'text-red-600' : 'text-green-600';
    Icon = ArrowUp;
  } else if (percentChange < 0) {
    colorClass = inverseColor ? 'text-green-600' : 'text-red-600';
    Icon = ArrowDown;
  }

  const renderCompareContent = () => {
    if (!showCompare) return <div className="h-[18px] mt-1"></div>;

    if (prevValue === 0 && value === 0) {
       return <div className="h-[18px] mt-1"></div>;
    }

    // [修改] 這裡也套用相同的 decimals 格式化規則
    const formattedPrev = `${prefix}${formatNumber(prevValue, isCurrency, decimals)}${suffix}`;
    const formattedPercent = `${Math.abs(percentChange).toFixed(2)}%`;

    if (displayMode === 'value') {
       return (
          <div className="mt-1 text-xs text-gray-500">
             {formattedPrev}
          </div>
       );
    }

    if (displayMode === 'percent') {
       return (
          <div className={`flex items-center mt-1 text-xs font-medium ${colorClass}`}>
             {Icon && <Icon size={10} className="mr-0.5" />}
             {formattedPercent}
          </div>
       );
    }

    return (
      <div className="flex items-center gap-2 mt-1 text-xs">
         <span className="text-gray-400 font-normal">
            {formattedPrev}
         </span>
         <div className={`flex items-center font-medium ${colorClass}`}>
           {Icon && <Icon size={10} className="mr-0.5" />}
           {formattedPercent}
         </div>
      </div>
    );
  };

  return (
    <div 
      onClick={onClick}
      className={`
        bg-white p-4 rounded shadow-sm transition-all min-w-[140px] flex flex-col justify-between h-[110px] cursor-pointer relative overflow-hidden
        ${isSelected ? 'ring-2 ring-opacity-50' : 'border border-gray-200 hover:shadow-md'}
      `}
      style={{
        borderColor: isSelected ? selectionColor : undefined,
        boxShadow: isSelected ? `0 0 0 1px ${selectionColor} inset` : undefined
      }}
    >
      {isSelected && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1" 
          style={{ backgroundColor: selectionColor }}
        />
      )}

      <div className="flex items-center gap-1 text-xs font-medium text-gray-500 pl-1">
        <span>{title}</span>
        <span className="cursor-pointer text-gray-400 hover:text-gray-600" onClick={(e) => e.stopPropagation()}>ⓘ</span>
      </div>
      
      <div className="mt-1 pl-1">
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {/* [修改] 傳入 decimals */}
          {prefix}{formatNumber(value, isCurrency, decimals)}{suffix}
        </div>
        {renderCompareContent()}
      </div>
    </div>
  );
};

export default SummaryCard;