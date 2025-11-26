import React, { useState, useEffect, useMemo } from 'react';
import { CampaignData, DateRange, MetricKey, DisplayMode, ColumnDef, BidOptimizerConfig, OptimizationResultRow } from './types';
import { parseCSV, generateMockPreviousData, parsePlacementCSV, parseKeywordCSV, generateOptimizationPreview, calculateRecommendedBid, filterDataByDate, generateDailyChartData, aggregateCampaignData } from './utils/csvParser';
import SummaryCard from './components/SummaryCard';
import CampaignTable from './components/CampaignTable';
import TrendChart from './components/TrendChart';
import DateRangeControl from './components/DateRangeControl';
import FileUpload from './components/FileUpload';
import ColumnSelector from './components/ColumnSelector';
import BidOptimizerModal from './components/BidOptimizerModal';
import OptimizationUploadModal from './components/OptimizationUploadModal';
import OptimizationResultTable from './components/OptimizationResultTable';
import { Settings, Download, History, LayoutGrid, BarChart3, Filter } from 'lucide-react';

const METRIC_CONFIGS: Record<MetricKey, { key: MetricKey, label: string, color: string, type: 'bar' | 'line', format: (v: number) => string }> = {
  impressions: { key: 'impressions', label: '曝光數', color: '#8884d8', type: 'bar', format: (v) => v.toLocaleString() },
  clicks: { key: 'clicks', label: '點擊數', color: '#82ca9d', type: 'bar', format: (v) => v.toLocaleString() },
  orders: { key: 'orders', label: '訂單數', color: '#fcd34d', type: 'bar', format: (v) => v.toLocaleString() },
  units: { key: 'units', label: '銷售件數', color: '#fbbf24', type: 'bar', format: (v) => v.toLocaleString() },
  ctr: { key: 'ctr', label: '點擊率', color: '#ff7300', type: 'line', format: (v) => `${v}%` },
  cvr: { key: 'cvr', label: '轉換率', color: '#ff0000', type: 'line', format: (v) => `${v}%` },
  cpc: { key: 'cpc', label: 'CPC', color: '#0088FE', type: 'line', format: (v) => `$${v}` },
  spend: { key: 'spend', label: '花費', color: '#60a5fa', type: 'bar', format: (v) => `$${v}` },
  sales: { key: 'sales', label: '銷售額', color: '#34d399', type: 'bar', format: (v) => `$${v}` },
  acos: { key: 'acos', label: 'ACOS', color: '#f97316', type: 'line', format: (v) => `${v}%` },
  roas: { key: 'roas', label: 'ROAS', color: '#00C49F', type: 'line', format: (v) => v.toFixed(2) },
  cpa: { key: 'cpa', label: 'CPA', color: '#a855f7', type: 'line', format: (v) => `$${v}` },
};

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'campaignName', label: 'Campaign ID', isFixed: true, isVisible: true, type: 'text', width: 200 },
  { id: 'status', label: 'Status', isFixed: true, isVisible: true, type: 'text', width: 100 },
  { id: 'orders', label: 'Orders', isFixed: false, isVisible: true, type: 'number', width: 100 },
  { id: 'sales', label: 'Sales', isFixed: false, isVisible: true, type: 'currency', width: 120 },
  { id: 'spend', label: 'Spend', isFixed: false, isVisible: true, type: 'currency', width: 120 },
  { id: 'acos', label: 'ACOS', isFixed: false, isVisible: true, type: 'percent', width: 100 },
];

const INITIAL_CSV_MOCK = `State,Campaign,Status,Targeting,Portfolio,Budget,Impressions,Clicks,CTR,Spend,CPC,Orders,Sales,ACOS,ROAS
ENABLED,PTA024_AUTO,CAMPAIGN_SP,AUTOMATIC,PTA024,$40.00,38750,367,0.95%,$280.04,$0.76,21,$637.78,43.91%,2.27
ENABLED,RTS05&RTS013_KW,CAMPAIGN_SP,MANUAL,RTS05,60.00,29595,249,0.84%,$249.01,$1.00,16,$3599.84,6.92%,14.45
ENABLED,PTA08_KW,CAMPAIGN_SP,MANUAL,PTA08,40.00,15801,161,1.02%,$274.55,$1.71,19,$689.77,39.80%,2.51
ENABLED,RA02_KW,CAMPAIGN_SP,MANUAL,RA02,45.00,34285,255,0.74%,$243.32,$0.95,27,$975.72,24.94%,4.01
ENABLED,TTK015_AUTO,CAMPAIGN_SP,AUTOMATIC,TTK015,30.00,31145,333,1.07%,$156.20,$0.47,37,$1199.36,13.02%,7.67
ENABLED,RTS015_KW,CAMPAIGN_SP,MANUAL,RTS015,20.00,19350,143,0.74%,$140.15,$0.98,4,$333.56,42.02%,2.38
ENABLED,RTS05&RTS013_AUTO,CAMPAIGN_SP,AUTOMATIC,RTS05,100.00,33459,309,0.92%,$188.04,$0.61,20,$2238.00,8.40%,11.90
ENABLED,PTA18_KW_Broad,CAMPAIGN_SP,MANUAL,PTA18,20.00,10496,180,1.71%,$228.23,$1.27,10,$727.90,31.35%,3.18
PAUSED,OLD_CAMPAIGN_01,CAMPAIGN_SP,MANUAL,OLD,10.00,5000,40,0.8%,$40.00,$1.00,0,$0.00,0.00%,0.00
`;

const App: React.FC = () => {
  const [data, setData] = useState<CampaignData[]>([]);
  const [prevData, setPrevData] = useState<CampaignData[]>([]);
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(2025, 10, 2),
    endDate: new Date(2025, 10, 8)
  });

  const [compareRange, setCompareRange] = useState<DateRange | null>({
    startDate: new Date(2025, 10, 9),
    endDate: new Date(2025, 10, 15)
  });

  const [displayMode, setDisplayMode] = useState<DisplayMode>('all');
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['orders', 'spend', 'sales', 'acos']);

  const [optimizerConfig, setOptimizerConfig] = useState<BidOptimizerConfig | null>(null);
  const [optimizationResults, setOptimizationResults] = useState<OptimizationResultRow[]>([]);
  const [showOptimizationResults, setShowOptimizationResults] = useState(false);

  useEffect(() => {
    handleDataLoad(INITIAL_CSV_MOCK);
  }, []);

  const handleDataLoad = (csvText: string) => {
    setLoading(true);
    setTimeout(() => {
      const { data: parsed, columns: detectedColumns } = parseCSV(csvText);
      setData(parsed);
      setPrevData(generateMockPreviousData(parsed));
      
      if (detectedColumns.length > 0) {
         const merged = detectedColumns.map(newCol => {
            const prev = columns.find(c => c.id === newCol.id);
            if (prev) {
               return { ...newCol, isVisible: prev.isVisible, isFixed: prev.isFixed };
            }
            return newCol;
         });
         setColumns(merged);
      }
      setLoading(false);
    }, 200);
  };

  const handleOptimizerConfig = (config: BidOptimizerConfig) => {
    setOptimizerConfig(config);
    setIsUploadModalOpen(true);
  };

  const handleOptimizationFiles = (placementText: string, keywordText: string) => {
    if (!optimizerConfig) return;
    const placementMap = parsePlacementCSV(placementText);
    const keywordRows = parseKeywordCSV(keywordText);
    const results = generateOptimizationPreview(keywordRows, placementMap, optimizerConfig);
    setOptimizationResults(results);
    setIsUploadModalOpen(false);
    setShowOptimizationResults(true);
  };

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; 
        return prev.filter(k => k !== key);
      } else {
        if (prev.length >= 4) return prev; 
        return [...prev, key];
      }
    });
  };

  const { filteredData, aggregatedData, aggregatedPrevData, chartData, currentTotals, prevTotals } = useMemo(() => {
    // 1. Current Range
    const filtered = filterDataByDate(data, dateRange.startDate, dateRange.endDate);
    const aggregated = aggregateCampaignData(filtered); // This returns data with 'id' = campaign name
    
    const dailyChart = generateDailyChartData(data, dateRange.startDate, dateRange.endDate);

    const calcTotals = (dataset: CampaignData[]) => {
        const sum = (key: string) => dataset.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
        const spend = sum('spend');
        const sales = sum('sales');
        const clicks = sum('clicks');
        const impressions = sum('impressions');
        const orders = sum('orders');
        const units = sum('units');
        return {
            spend, sales, clicks, impressions, orders, units,
            acos: sales > 0 ? (spend / sales) * 100 : 0,
            roas: spend > 0 ? sales / spend : 0,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            cpc: clicks > 0 ? spend / clicks : 0,
            cvr: clicks > 0 ? (orders / clicks) * 100 : 0,
            cpa: orders > 0 ? spend / orders : 0,
            aov: orders > 0 ? sales / orders : 0,
            rpc: clicks > 0 ? sales / clicks : 0,
            actc: orders > 0 ? clicks / orders : 0,
            cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        };
    };

    const currTots = calcTotals(filtered);

    // 2. Comparison Range
    let prevTots = currTots; 
    let aggPrev: CampaignData[] = [];

    if (compareRange && compareRange.startDate && compareRange.endDate) {
        const filteredPrev = filterDataByDate(data, compareRange.startDate, compareRange.endDate);
        aggPrev = aggregateCampaignData(filteredPrev);
        prevTots = calcTotals(filteredPrev);
    }

    return { 
        filteredData: filtered, 
        aggregatedData: aggregated, 
        aggregatedPrevData: aggPrev, // Correct aggregated data for prev range
        chartData: dailyChart, 
        currentTotals: currTots,
        prevTotals: prevTots 
    };
  }, [data, dateRange, compareRange]);

  const showCompare = !!compareRange;

  const renderSummaryCard = (key: MetricKey, title: string, prefix = '', suffix = '', isCurrency = false, inverse = false) => (
    <SummaryCard 
      metricKey={key}
      title={title} 
      value={currentTotals[key]} 
      prevValue={prevTotals[key]} 
      prefix={prefix}
      suffix={suffix}
      isCurrency={isCurrency}
      inverseColor={inverse}
      showCompare={showCompare}
      displayMode={displayMode}
      isSelected={selectedMetrics.includes(key)}
      selectionColor={METRIC_CONFIGS[key].color}
      onClick={() => toggleMetric(key)}
    />
  );

  if (showOptimizationResults) {
    return (
      <OptimizationResultTable 
        data={optimizationResults} 
        onBack={() => setShowOptimizationResults(false)} 
      />
    );
  }

  return (
    <div className="min-h-screen text-gray-800 pb-12 bg-gray-50">
      <ColumnSelector 
        isOpen={isColumnSelectorOpen} 
        onClose={() => setIsColumnSelectorOpen(false)} 
        allColumns={columns}
        onSave={setColumns}
      />

      <BidOptimizerModal 
        isOpen={isOptimizerOpen}
        onClose={() => setIsOptimizerOpen(false)}
        onPreview={handleOptimizerConfig}
      />

      <OptimizationUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onProcess={handleOptimizationFiles}
      />

      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded shadow-sm text-gray-700 cursor-pointer hover:bg-gray-50">
            <Filter size={16} />
            <span className="text-sm font-medium">篩選器</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DateRangeControl 
            value={dateRange} 
            onChange={setDateRange} 
            compareRange={compareRange}
            onCompareChange={setCompareRange}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
          />
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          
          <button 
            onClick={() => setIsColumnSelectorOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <Settings size={14} />
            欄位
          </button>
          
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm">
            <Download size={14} />
            匯出 CSV
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">
            <History size={14} />
            歷史記錄
          </button>
          <div className="flex border border-gray-300 rounded overflow-hidden ml-2 bg-white">
             <button className="p-1.5 bg-gray-100 hover:bg-gray-200 border-r border-gray-300"><LayoutGrid size={16} /></button>
             <button className="p-1.5 bg-white hover:bg-gray-50"><BarChart3 size={16} /></button>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 max-w-[1800px] mx-auto">
        <div className="flex justify-between items-center mb-4">
           <h1 className="text-xl font-bold text-gray-800">廣告管理</h1>
           <FileUpload onDataLoaded={handleDataLoad} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {renderSummaryCard('impressions', '曝光數 Impressions')}
          {renderSummaryCard('clicks', '點擊數 Clicks')}
          {renderSummaryCard('orders', '訂單數 Orders')}
          {renderSummaryCard('units', '銷售件數 Units')}
          {renderSummaryCard('ctr', '點擊率 CTR', '', '%', false)}
          {renderSummaryCard('cvr', '轉換率 CVR', '', '%', false)}
          {renderSummaryCard('cpc', '每次點擊成本 CPC', '$', '', true, true)}
          {renderSummaryCard('spend', '花費 Spend', '$', '', true, true)}
          {renderSummaryCard('sales', '銷售額 Sales', '$', '', true)}
          {renderSummaryCard('acos', 'ACOS', '', '%', false, true)}
          {renderSummaryCard('roas', 'ROAS', '', '', false)}
          {renderSummaryCard('cpa', '每次訂單成本 CPA', '$', '', true, true)}
        </div>

        <div className="mb-8">
          <TrendChart 
            data={data} 
            dateRange={dateRange} 
            selectedMetrics={selectedMetrics}
            metricConfigs={METRIC_CONFIGS}
          />
        </div>

        <div className="mb-12">
          <CampaignTable 
            currentData={aggregatedData} 
            prevData={aggregatedPrevData} 
            showCompare={showCompare} 
            displayMode={displayMode}
            columns={columns}
            onOpenOptimizer={() => setIsOptimizerOpen(true)}
          />
        </div>

      </main>
    </div>
  );
};

export default App;