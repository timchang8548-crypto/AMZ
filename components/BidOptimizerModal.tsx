import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Info, ArrowRight, Check } from 'lucide-react';
import { BidOptimizerConfig, OptimizationMode, LimitType, MultiplierType, AdjustmentUnit } from '../types';

interface BidOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreview: (config: BidOptimizerConfig) => void;
}

const BidOptimizerModal: React.FC<BidOptimizerModalProps> = ({ isOpen, onClose, onPreview }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Configuration State
  const [mode, setMode] = useState<OptimizationMode>('balance');
  const [targetAcos, setTargetAcos] = useState<number>(30);
  
  // Advanced State
  const [bidFloorType, setBidFloorType] = useState<LimitType>('off');
  const [bidFloorValue, setBidFloorValue] = useState<number>(0);
  
  const [bidCeilingType, setBidCeilingType] = useState<LimitType>('dynamic');
  const [bidCeilingValue, setBidCeilingValue] = useState<number>(0);
  const [tcpcMultiplier, setTcpcMultiplier] = useState<MultiplierType>(2);
  
  const [maxBidIncrease, setMaxBidIncrease] = useState<number>(25);
  const [maxBidIncreaseUnit, setMaxBidIncreaseUnit] = useState<AdjustmentUnit>('percent');
  
  const [maxBidDecrease, setMaxBidDecrease] = useState<number>(25);
  const [maxBidDecreaseUnit, setMaxBidDecreaseUnit] = useState<AdjustmentUnit>('percent');
  
  const [enablePlacement, setEnablePlacement] = useState(true);
  const [maxPlacementIncrease, setMaxPlacementIncrease] = useState<number>(33);
  const [maxPlacementDecrease, setMaxPlacementDecrease] = useState<number>(33);

  // Goal States
  const [goals, setGoals] = useState({
    highAcos: true,
    highSpendNoSales: true,
    lowAcos: true,
    lowImpression: true,
    includeZeroImp: false
  });

  const [usePortfolio, setUsePortfolio] = useState(false);

  if (!isOpen) return null;

  const handlePreview = () => {
    onPreview({
      mode,
      targetAcos,
      bidFloorType,
      bidFloorValue,
      bidCeilingType,
      bidCeilingValue,
      tcpcMultiplier,
      maxBidIncrease,
      maxBidIncreaseUnit,
      maxBidDecrease,
      maxBidDecreaseUnit,
      maxPlacementIncrease,
      maxPlacementDecrease,
      // @ts-ignore - 如果您的 types 定義有差異，請確保這裡符合您的 interface
      strategy: mode === 'lower_acos' ? 'conservative' : 'aggressive',
      minBid: bidFloorValue,
      maxBid: bidCeilingValue
    });
    onClose();
  };

  const toggleGoal = (key: keyof typeof goals) => {
    setGoals(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    // 修正點：z-[100] 確保在最上層，蓋過表格與 Header
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">優化出價</h2>
            <p className="text-sm text-gray-500 mt-1">設定自動化規則以調整廣告活動出價</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 overflow-y-auto scrollbar-thin">
          
          {/* Basic Settings Grid */}
          <div className="grid grid-cols-12 gap-8 mb-6">
            
            {/* Mode */}
            <div className="col-span-4">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                優先順序 <Info size={14} className="text-gray-400" />
              </label>
              <div className="relative">
                <select 
                  value={mode}
                  onChange={(e) => setMode(e.target.value as OptimizationMode)}
                  className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm font-medium transition-shadow cursor-pointer"
                >
                  <option value="balance">平衡 (Balance)</option>
                  <option value="lower_acos">降低 ACOS (Conservative)</option>
                  <option value="boost_sales">提升銷售 (Aggressive)</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Target ACOS */}
            <div className="col-span-4">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                目標 ACOS <Info size={14} className="text-gray-400" />
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  value={targetAcos}
                  onChange={(e) => setTargetAcos(parseFloat(e.target.value))}
                  className="w-full pl-4 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow" 
                />
                <span className="absolute right-3 top-2.5 text-gray-500 font-medium">%</span>
              </div>
            </div>

            {/* Optimization Toggle */}
            <div className="col-span-4">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                優化組合 <Info size={14} className="text-gray-400" />
              </label>
              <div 
                className="flex items-center gap-3 p-2 cursor-pointer group"
                onClick={() => setUsePortfolio(!usePortfolio)}
              >
                <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${usePortfolio ? 'bg-teal-600' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform duration-200 ${usePortfolio ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
                <span className="text-sm text-gray-600 group-hover:text-gray-800 select-none">使用優化組合設定</span>
              </div>
            </div>
          </div>

          {/* Advanced Trigger */}
          <div className="flex justify-center my-4">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-teal-600 text-sm font-medium hover:text-teal-800 transition-colors px-4 py-1.5 rounded-full hover:bg-teal-50"
            >
              {showAdvanced ? '隱藏進階選項' : '顯示進階選項'}
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {/* Advanced Settings Panel */}
          {showAdvanced && (
            <div className="grid grid-cols-3 gap-8 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
              
              {/* Col 1: Optimization Goals */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 text-teal-700 font-bold text-sm mb-4">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700">1</div>
                   優化目標規則
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">降低無效花費</div>
                    <div className="space-y-2">
                      <div 
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => toggleGoal('highAcos')}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${goals.highAcos ? 'bg-teal-600 border-teal-600' : 'bg-white border-gray-300 group-hover:border-teal-400'}`}>
                            {goals.highAcos && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-sm text-gray-700">高 ACOS 降價</span>
                      </div>
                      <div 
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => toggleGoal('highSpendNoSales')}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${goals.highSpendNoSales ? 'bg-teal-600 border-teal-600' : 'bg-white border-gray-300 group-hover:border-teal-400'}`}>
                            {goals.highSpendNoSales && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-sm text-gray-700">高花費無銷售</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">把握潛力機會</div>
                    <div className="space-y-2">
                      <div 
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => toggleGoal('lowAcos')}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${goals.lowAcos ? 'bg-teal-600 border-teal-600' : 'bg-white border-gray-300 group-hover:border-teal-400'}`}>
                            {goals.lowAcos && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-sm text-gray-700">低 ACOS 提價</span>
                      </div>
                      <div 
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => toggleGoal('lowImpression')}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${goals.lowImpression ? 'bg-teal-600 border-teal-600' : 'bg-white border-gray-300 group-hover:border-teal-400'}`}>
                            {goals.lowImpression && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-sm text-gray-700">低曝光提價</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Col 2: Bid Constraints */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 text-teal-700 font-bold text-sm mb-4">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700">2</div>
                   出價限制與幅度
                </div>

                <div className="space-y-4">
                  {/* Floor */}
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">出價下限 (Floor)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select 
                          value={bidFloorType}
                          onChange={(e) => setBidFloorType(e.target.value as LimitType)}
                          className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-md bg-white text-sm focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="off">不限制</option>
                          <option value="min">建議最小值</option>
                          <option value="custom">自訂</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                      </div>
                      {bidFloorType === 'custom' && (
                         <input 
                           type="number" 
                           value={bidFloorValue} 
                           onChange={(e) => setBidFloorValue(parseFloat(e.target.value))}
                           className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm" 
                           placeholder="0.00"
                         />
                      )}
                    </div>
                  </div>

                  {/* Ceiling */}
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">出價上限 (Ceiling)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select 
                          value={bidCeilingType} 
                          onChange={(e) => setBidCeilingType(e.target.value as LimitType)}
                          className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-md bg-white text-sm focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="dynamic">動態 (tCPC)</option>
                          <option value="max">最大值</option>
                          <option value="custom">自訂</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                      </div>
                      {bidCeilingType === 'custom' ? (
                          <input 
                            type="number" 
                            value={bidCeilingValue} 
                            onChange={(e) => setBidCeilingValue(parseFloat(e.target.value))}
                            className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm" 
                          />
                      ) : (
                          <div className="relative w-20">
                             <select 
                                value={tcpcMultiplier}
                                onChange={(e) => setTcpcMultiplier(parseInt(e.target.value) as MultiplierType)}
                                className="w-full pl-2 pr-6 py-2 border border-gray-300 rounded-md bg-white text-sm"
                             >
                                <option value={1}>1x</option>
                                <option value={2}>2x</option>
                                <option value={3}>3x</option>
                             </select>
                          </div>
                      )}
                    </div>
                  </div>

                  <hr className="border-gray-200" />

                  {/* Max Increase */}
                  <div className="flex items-center justify-between gap-2">
                     <span className="text-xs text-gray-600">單次最大漲幅</span>
                     <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          value={maxBidIncrease} 
                          onChange={(e) => setMaxBidIncrease(parseFloat(e.target.value))}
                          className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-right" 
                        />
                        <select 
                           value={maxBidIncreaseUnit} 
                           onChange={(e) => setMaxBidIncreaseUnit(e.target.value as AdjustmentUnit)}
                           className="bg-gray-50 border border-gray-300 rounded py-1.5 px-1 text-xs"
                        >
                           <option value="percent">%</option>
                           <option value="amount">$</option>
                        </select>
                     </div>
                  </div>

                  {/* Max Decrease */}
                  <div className="flex items-center justify-between gap-2">
                     <span className="text-xs text-gray-600">單次最大降幅</span>
                     <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          value={maxBidDecrease} 
                          onChange={(e) => setMaxBidDecrease(parseFloat(e.target.value))}
                          className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-right" 
                        />
                        <select 
                           value={maxBidDecreaseUnit} 
                           onChange={(e) => setMaxBidDecreaseUnit(e.target.value as AdjustmentUnit)}
                           className="bg-gray-50 border border-gray-300 rounded py-1.5 px-1 text-xs"
                        >
                           <option value="percent">%</option>
                           <option value="amount">$</option>
                        </select>
                     </div>
                  </div>
                </div>
              </div>

              {/* Col 3: Placement Settings */}
              <div className={`bg-gray-50/50 p-5 rounded-xl border border-gray-100 ${!enablePlacement ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-teal-700 font-bold text-sm">
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700">3</div>
                       版位溢價
                    </div>
                    <div 
                        className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${enablePlacement ? 'bg-teal-600' : 'bg-gray-300'}`}
                        onClick={() => setEnablePlacement(!enablePlacement)}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${enablePlacement ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                </div>
                
                <div className={`space-y-4 ${!enablePlacement ? 'pointer-events-none' : ''}`}>
                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-1">Top of Search (首頁頂部)</div>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-gray-400">最大調幅</span>
                       <div className="relative flex-1">
                          <input 
                            type="number" 
                            value={maxPlacementIncrease} 
                            onChange={(e) => setMaxPlacementIncrease(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm pr-8" 
                          />
                          <span className="absolute right-3 top-2 text-gray-400 text-xs">%</span>
                       </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-1">Product Pages (商品頁面)</div>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-gray-400">最大調幅</span>
                       <div className="relative flex-1">
                          <input 
                            type="number" 
                            value={maxPlacementDecrease} 
                            onChange={(e) => setMaxPlacementDecrease(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm pr-8" 
                          />
                          <span className="absolute right-3 top-2 text-gray-400 text-xs">%</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handlePreview}
            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black shadow-lg shadow-gray-200 hover:shadow-gray-300 transition-all"
          >
            預覽優化建議 <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BidOptimizerModal;