import { CampaignData, ColumnDef, BidOptimizerConfig, OptimizationResultRow } from '../types';

// 輔助函式：清理數字字串
const parseNumber = (val: string | number | undefined): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // 移除貨幣符號、百分比、逗號
  const clean = String(val).replace(/[$,%]/g, '');
  return parseFloat(clean) || 0;
};

// 輔助函式：解析日期
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

// 1. 擴充標頭對照表 (Mapping)
const normalizeHeader = (header: string): string => {
  const map: Record<string, string> = {
    // 基礎欄位
    'Date': 'date',
    'date': 'date',
    'Campaign Name': 'campaignName',
    'Campaigns': 'campaignName',
    'Campaign': 'campaignName',
    'State': 'status',
    'Status': 'status', // 注意：有些報表 Status 是 State
    'Budget': 'budget',
    'Budget (converted)': 'budget',
    
    // 核心指標
    'Impressions': 'impressions',
    'Clicks': 'clicks',
    'Spend': 'spend',
    'Spend (converted)': 'spend',
    'Orders': 'orders',
    'Sales': 'sales',
    'Sales (converted)': 'sales',
    'Units': 'units',
    
    // 比率指標
    'ACOS': 'acos',
    'ROAS': 'roas',
    'CTR': 'ctr',
    'CPC': 'cpc',
    'CPC (converted)': 'cpc',
    'CVR': 'cvr',
    'CPM': 'cpm',
    'CPM (converted)': 'cpm',

    // 維度欄位 (補上缺少的)
    'Portfolio': 'portfolio',
    'Start Date': 'startDate',
    'Start date': 'startDate',
    'End Date': 'endDate',
    'End date': 'endDate',
    'Targeting': 'targetingType',
    'Targeting Type': 'targetingType',
    'Cost Type': 'costType',
    'Cost type': 'costType',
    'Campaign bidding strategy': 'biddingStrategy',
    'Bidding strategy': 'biddingStrategy',
    
    // 30天滾動數據 (有的話)
    '7 Day Total Sales': 'last30dSales', 
    '7 Day Total Spend': 'last30dSpend' 
  };

  const cleanHeader = header.trim();
  if (map[cleanHeader]) return map[cleanHeader];

  // Fallback: 轉駝峰式命名
  return cleanHeader.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
};

export const parseCSV = (csvText: string): { data: CampaignData[], columns: ColumnDef[] } => {
  const lines = csvText.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return { data: [], columns: [] };

  // 處理 CSV 標頭
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const headerKeyMap = headers.map(normalizeHeader);
  
  // 2. 定義所有可顯示的欄位 (包含新欄位)
  const definedColumns: ColumnDef[] = [
    { id: 'campaignName', label: 'Campaign', isFixed: true, isVisible: true, type: 'text', width: 250 },
    { id: 'status', label: 'Status', isFixed: true, isVisible: true, type: 'text', width: 100 },
    
    // 核心數據
    { id: 'spend', label: 'Spend', isFixed: false, isVisible: true, type: 'currency', width: 120 },
    { id: 'sales', label: 'Sales', isFixed: false, isVisible: true, type: 'currency', width: 120 },
    { id: 'acos', label: 'ACOS', isFixed: false, isVisible: true, type: 'percent', width: 100 },
    { id: 'roas', label: 'ROAS', isFixed: false, isVisible: true, type: 'number', width: 100 },
    { id: 'orders', label: 'Orders', isFixed: false, isVisible: true, type: 'number', width: 100 },
    { id: 'clicks', label: 'Clicks', isFixed: false, isVisible: true, type: 'number', width: 100 },
    { id: 'impressions', label: 'Impressions', isFixed: false, isVisible: true, type: 'number', width: 120 },
    
    // 進階指標
    { id: 'ctr', label: 'CTR', isFixed: false, isVisible: false, type: 'percent', width: 100 },
    { id: 'cvr', label: 'CVR', isFixed: false, isVisible: false, type: 'percent', width: 100 },
    { id: 'cpc', label: 'CPC', isFixed: false, isVisible: false, type: 'currency', width: 100 },
    { id: 'cpm', label: 'CPM', isFixed: false, isVisible: false, type: 'currency', width: 100 },
    { id: 'cpa', label: 'CPA', isFixed: false, isVisible: false, type: 'currency', width: 100 },
    { id: 'aov', label: 'AOV', isFixed: false, isVisible: false, type: 'currency', width: 100 },
    { id: 'rpc', label: 'RPC', isFixed: false, isVisible: false, type: 'currency', width: 100 },
    { id: 'actc', label: 'aCTC', isFixed: false, isVisible: false, type: 'number', width: 100 },
    
    // 佔比
    { id: 'percentOfSales', label: '% Sales', isFixed: false, isVisible: false, type: 'percent', width: 100 },
    { id: 'percentOfSpend', label: '% Spend', isFixed: false, isVisible: false, type: 'percent', width: 100 },
    
    // 維度資訊
    { id: 'portfolio', label: 'Portfolio', isFixed: false, isVisible: false, type: 'text', width: 150 },
    { id: 'targetingType', label: 'Targeting', isFixed: false, isVisible: false, type: 'text', width: 120 },
    { id: 'biddingStrategy', label: 'Bid Strategy', isFixed: false, isVisible: false, type: 'text', width: 150 },
    { id: 'budget', label: 'Budget', isFixed: false, isVisible: false, type: 'currency', width: 120 },
  ];

  const tempRows: CampaignData[] = [];
  let totalSales = 0;
  let totalSpend = 0;

  // 第一遍迴圈：解析原始數據並計算單行指標
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 使用 Regex 分割 CSV，保留引號內的逗號
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    
    const row: any = { id: `row-${i}` };
    
    headerKeyMap.forEach((key, index) => {
      const rawVal = values[index];
      
      if (key === 'date' || key === 'startDate' || key === 'endDate') {
        // 日期處理
        const d = parseDate(rawVal);
        if (d) row[key] = d; // 保持 Date 物件
      } else if (['spend', 'sales', 'orders', 'clicks', 'impressions', 'budget', 'cpc', 'cpm', 'units', 'last30dSales', 'last30dSpend'].includes(key)) {
         // 數值處理
         row[key] = parseNumber(rawVal);
      } else if (['ctr', 'acos', 'roas', 'cvr'].includes(key)) {
         // 百分比/比率處理
         row[key] = parseNumber(rawVal);
      } else {
         // 文字處理
         row[key] = rawVal || '';
      }
    });

    // 確保數值不為 undefined
    row.clicks = row.clicks || 0;
    row.orders = row.orders || 0;
    row.spend = row.spend || 0;
    row.sales = row.sales || 0;
    row.impressions = row.impressions || 0;
    row.units = row.units || 0;

    // 3. 補上缺失的計算欄位 (Calculated Fields)
    // ACOS
    row.acos = row.sales > 0 ? (row.spend / row.sales) * 100 : 0;
    // ROAS
    row.roas = row.spend > 0 ? row.sales / row.spend : 0;
    // CTR
    row.ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    // CPC
    row.cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
    // CVR
    row.cvr = row.clicks > 0 ? (row.orders / row.clicks) * 100 : 0;
    
    // --- 新增欄位計算 ---
    // CPA (Cost Per Acquisition)
    row.cpa = row.orders > 0 ? row.spend / row.orders : 0;
    
    // AOV (Average Order Value)
    row.aov = row.orders > 0 ? row.sales / row.orders : 0;
    
    // RPC (Revenue Per Click)
    row.rpc = row.clicks > 0 ? row.sales / row.clicks : 0;
    
    // aCTC (Average Click To Conversion)
    row.actc = row.orders > 0 ? row.clicks / row.orders : 0;
    
    // CPM (Cost Per Mille) - 若檔案沒給，自己算
    if (!row.cpm) {
        row.cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0;
    }

    // 累加總數
    totalSales += row.sales;
    totalSpend += row.spend;

    tempRows.push(row as CampaignData);
  }

  // 第二遍迴圈：計算佔比 (% of Total)
  const finalData = tempRows.map(row => {
      row.percentOfSales = totalSales > 0 ? (row.sales / totalSales) * 100 : 0;
      row.percentOfSpend = totalSpend > 0 ? (row.spend / totalSpend) * 100 : 0;
      return row;
  });

  return { data: finalData, columns: definedColumns };
};

export const filterDataByDate = (data: CampaignData[], startDate: Date, endDate: Date): CampaignData[] => {
  if (!startDate || !endDate) return data;
  
  const start = new Date(startDate); start.setHours(0,0,0,0);
  const end = new Date(endDate); end.setHours(23,59,59,999);

  return data.filter(row => {
    // 如果資料行有 date 欄位，用 date 過濾
    if (row.date) {
        const rowDate = new Date(row.date);
        return rowDate >= start && rowDate <= end;
    }
    // 如果只有 startDate (例如某些報表類型)，也可以用 startDate 過濾
    if (row.startDate) {
        const rowStart = new Date(row.startDate);
        return rowStart >= start && rowStart <= end;
    }
    return true; 
  });
};

export const aggregateCampaignData = (data: CampaignData[]): CampaignData[] => {
  const aggMap: Record<string, CampaignData> = {};

  data.forEach(row => {
    const key = row.campaignName || 'Unknown';
    if (!aggMap[key]) {
      aggMap[key] = {
        id: key,
        campaignName: key,
        status: row.status,
        // 保留維度資訊 (取第一筆)
        portfolio: row.portfolio,
        targetingType: row.targetingType,
        biddingStrategy: row.biddingStrategy,
        budget: row.budget, // 預算通常是單一設定，不適合加總，取最新或第一筆
        
        clicks: 0,
        orders: 0,
        spend: 0,
        sales: 0,
        impressions: 0,
        units: 0,
      } as CampaignData;
    }
    
    aggMap[key].clicks += (row.clicks || 0);
    aggMap[key].orders += (row.orders || 0);
    aggMap[key].spend += (row.spend || 0);
    aggMap[key].sales += (row.sales || 0);
    aggMap[key].impressions += (row.impressions || 0);
    aggMap[key].units += (row.units || 0);
  });

  // 重新計算聚合後的比率指標
  return Object.values(aggMap).map(row => {
    row.ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    row.cvr = row.clicks > 0 ? (row.orders / row.clicks) * 100 : 0;
    row.acos = row.sales > 0 ? (row.spend / row.sales) * 100 : 0;
    row.roas = row.spend > 0 ? row.sales / row.spend : 0;
    row.cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
    
    // 新增指標的聚合計算
    row.cpa = row.orders > 0 ? row.spend / row.orders : 0;
    row.aov = row.orders > 0 ? row.sales / row.orders : 0;
    row.rpc = row.clicks > 0 ? row.sales / row.clicks : 0;
    row.actc = row.orders > 0 ? row.clicks / row.orders : 0;
    row.cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0;

    return row;
  });
};

export const generateDailyChartData = (data: CampaignData[], startDate: Date, endDate: Date) => {
  const dailyMap: Record<string, any> = {};
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // 初始化每一天，確保圖表X軸連續
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dailyMap[dateKey] = { date: dateKey, spend: 0, sales: 0, clicks: 0, orders: 0, impressions: 0, units: 0, acos: 0 };
  }

  data.forEach(row => {
    if (!row.date) return;
    const d = new Date(row.date);
    if (d < startDate || d > endDate) return;
    const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    if (dailyMap[dateKey]) {
      dailyMap[dateKey].spend += (row.spend || 0);
      dailyMap[dateKey].sales += (row.sales || 0);
      dailyMap[dateKey].clicks += (row.clicks || 0);
      dailyMap[dateKey].orders += (row.orders || 0);
      dailyMap[dateKey].impressions += (row.impressions || 0);
      dailyMap[dateKey].units += (row.units || 0);
    }
  });

  return Object.values(dailyMap).map(day => {
    const s = day.sales as number;
    const sp = day.spend as number;
    day.acos = s > 0 ? parseFloat(((sp / s) * 100).toFixed(2)) : 0;
    day.spend = parseFloat(sp.toFixed(2));
    day.sales = parseFloat(s.toFixed(2));
    return day;
  });
};

// ... (後面的 Mock Data, Placement Parser, Keyword Parser 保持不變) ...
export const parsePlacementCSV = (csvText: string) => {
  const lines = csvText.split('\n').filter(l => l.trim() !== '');
  const placementMap: Record<string, { topRpc: number, restRpc: number }> = {};
  
  for(let i=1; i<lines.length; i++) {
    const line = lines[i];
    if(!line) continue;
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    
    const placement = cols[0];
    const campaign = cols[1];
    const clicks = parseNumber(cols[3]);
    const sales = parseNumber(cols[8]);
    
    if (!campaign) continue;

    const rpc = clicks > 0 ? sales / clicks : 0;

    if (!placementMap[campaign]) placementMap[campaign] = { topRpc: 0, restRpc: 0 };

    if (placement && placement.toUpperCase().includes('TOP')) {
      placementMap[campaign].topRpc = rpc;
    } else if (placement && placement.toUpperCase().includes('REST')) {
      placementMap[campaign].restRpc = rpc;
    }
  }
  return placementMap;
};

export const parseKeywordCSV = (csvText: string) => {
  const lines = csvText.split('\n').filter(l => l.trim() !== '');
  const keywords: any[] = [];
  
  for(let i=1; i<lines.length; i++) {
    const line = lines[i];
    if(!line) continue;
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    
    if (cols.length < 5) continue;

    keywords.push({
      id: `kw-${i}`,
      state: cols[0],
      campaignName: cols[1],
      matchType: cols[2],
      status: cols[3],
      keywordText: cols[4],
      currentBid: parseNumber(cols[5]), 
      impressions: parseNumber(cols[7]),
      clicks: parseNumber(cols[8]),
      spend: parseNumber(cols[10]),
      cpc: parseNumber(cols[11]),
      orders: parseNumber(cols[12]),
      sales: parseNumber(cols[13])
    });
  }
  return keywords;
};

export const calculateRecommendedBid = (
  row: { 
    currentBid: number; 
    acos: number; 
    orders: number; 
    clicks: number; 
    sales: number; 
    spend: number; 
    impressions: number; 
    cpa?: number; 
    actc?: number; 
    rpc?: number 
  }, 
  config: BidOptimizerConfig
) => {
  const currentBid = row.currentBid || 0.5;
  const acos = (row.acos || 0) / 100;
  const targetAcos = config.targetAcos / 100;
  const orders = row.orders || 0;
  const clicks = row.clicks || 0;
  const spend = row.spend || 0;
  const cpa = row.cpa || (orders > 0 ? spend / orders : 0);

  let newBid = currentBid;
  let rule = '維持 (Maintain)';

  if (config.mode === 'balance') {
     if (spend > cpa && orders === 0) {
        newBid = currentBid * 0.5;
        rule = 'High Spend No Sales';
     } else if (acos > targetAcos * 1.2) {
        const safeAcos = acos || 0.01;
        newBid = currentBid * (targetAcos / safeAcos) * 0.9;
        rule = 'High ACOS';
     } else if (acos < targetAcos * 0.8 && orders > 0) {
        const safeAcos = acos || 0.01;
        newBid = currentBid * (targetAcos / safeAcos) * 1.1;
        rule = 'Low ACOS';
     }
  } else if (config.mode === 'lower_acos') {
     if (acos > targetAcos) {
        newBid = currentBid * 0.8;
        rule = 'Reduce ACOS';
     }
  } else if (config.mode === 'boost_sales') {
     if (acos < targetAcos * 1.1) {
        newBid = currentBid * 1.2;
        rule = 'Boost Sales';
     }
  }

  if (config.bidFloorType === 'min' || config.bidFloorType === 'custom') {
     const floor = config.bidFloorType === 'custom' ? config.bidFloorValue : 0.02;
     if (newBid < floor) newBid = floor;
  }

  const maxInc = config.maxBidIncreaseUnit === 'percent' ? (1 + config.maxBidIncrease/100) : 999;
  if (newBid > currentBid * maxInc) newBid = currentBid * maxInc;

  return { bid: parseFloat(newBid.toFixed(2)), rule };
};

export const generateOptimizationPreview = (
  keywordRows: any[], 
  placementMap: any, 
  config: BidOptimizerConfig
): OptimizationResultRow[] => {
  
  return keywordRows.map(row => {
    const acos = row.sales > 0 ? (row.spend / row.sales) * 100 : 0;
    
    const calcResult = calculateRecommendedBid({
      currentBid: row.currentBid,
      acos: acos,
      orders: row.orders,
      clicks: row.clicks,
      sales: row.sales,
      spend: row.spend,
      impressions: row.impressions
    }, config);

    const diff = row.currentBid > 0 ? ((calcResult.bid - row.currentBid) / row.currentBid) * 100 : 0;

    return {
      id: row.id,
      adType: 'SP',
      campaignName: row.campaignName,
      adGroupName: '-', 
      entity: 'Keyword',
      targeting: row.keywordText,
      matchType: row.matchType,
      currentBid: row.currentBid,
      suggestedBid: calcResult.bid,
      diffPercent: diff,
      acos: acos,
      targetAcos: config.targetAcos,
      roas: row.spend > 0 ? row.sales / row.spend : 0,
      cpa: row.orders > 0 ? row.spend / row.orders : 0,
      impressions: row.impressions,
      clicks: row.clicks,
      orders: row.orders,
      sales: row.sales,
      spend: row.spend,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
      cvr: row.clicks > 0 ? (row.orders / row.clicks) * 100 : 0,
      cpc: row.cpc,
      rule: calcResult.rule,
      status: row.state
    };
  });
};

export const generateMockPreviousData = (currentData: CampaignData[]): CampaignData[] => {
  return currentData.map(c => ({...c})); 
};