import { CampaignData, ColumnDef } from '../types';
import { KeywordMetric, PlacementMetric } from './bidOptimizer';

// ------------------------------------------------------------------
// 基礎輔助函式
// ------------------------------------------------------------------

const parseNumber = (val: string | number | undefined): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // 移除貨幣符號、百分比、逗號、小於符號 (<5% -> 5)
  const clean = String(val).replace(/[$,%<]/g, '');
  return parseFloat(clean) || 0;
};

const safeFloat = (val: any) => {
    if (typeof val === 'number') return val;
    const str = String(val || '').replace(/[$,%<]/g, '');
    return parseFloat(str) || 0;
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

// 標頭正規化 (Mapping)：讓 Parser 能讀懂各種 CSV 欄位名稱
const normalizeHeader = (header: string): string => {
  const cleanHeader = header.trim();
  
  // 1. 精確對照表
  const map: Record<string, string> = {
    // 基礎欄位
    'Date': 'date', 'date': 'date',
    'Campaign Name': 'campaignName', 'Campaigns': 'campaignName', 'Campaign': 'campaignName', 'Campaign name': 'campaignName',
    'Ad Group Name': 'adGroupName', 'Ad Group': 'adGroupName',
    'State': 'status', 'Status': 'status', 'Campaign Status': 'status',
    'Budget': 'budget', 'Budget (converted)': 'budget',
    
    // 核心指標
    'Impressions': 'impressions',
    'Clicks': 'clicks',
    'Spend': 'spend', 'Spend (converted)': 'spend', 'Cost': 'spend', 'Spend(USD)': 'spend',
    'Orders': 'orders', '7 Day Total Orders': 'orders', 'Orders': 'orders',
    'Sales': 'sales', 'Sales (converted)': 'sales', 'Sales(USD)': 'sales', '7 Day Total Sales': 'sales',
    'Units': 'units', '7 Day Total Units': 'units',
    
    // 比率指標
    'ACOS': 'acos', 'Total ACOS': 'acos',
    'ROAS': 'roas', 'Total ROAS': 'roas',
    'CTR': 'ctr',
    'CPC': 'cpc', 'CPC (converted)': 'cpc', 'CPC(USD)': 'cpc',
    'CVR': 'cvr', 'Conversion Rate': 'cvr',
    
    // 版位與關鍵字特定
    'Placement': 'placement', 'Campaign Placement': 'placement',
    'Bid': 'maxBid', 'Max Bid': 'maxBid', 'Keyword Bid': 'maxBid', 'Target bid(USD)': 'maxBid',
    'Bid adjustment': 'bidAdjustment',
    
    'Targeting': 'targeting', 
    'Keyword': 'keywordText', 'Keyword Text': 'keywordText', 
    'Customer Search Term': 'query', 
    'Targeting Expression': 'targeting',
    'Automatic targeting groups': 'keywordText',
    
    'Match Type': 'matchType',
    
    // 維度
    'Portfolio': 'portfolio', 'Portfolio name': 'portfolio',
    'Start Date': 'startDate', 'Start date': 'startDate',
    'End Date': 'endDate', 'End date': 'endDate',
    'Targeting Type': 'targetingType', 'Bidding strategy': 'biddingStrategy'
  };

  if (map[cleanHeader]) return map[cleanHeader];
  
  // 2. 模糊比對
  const lower = cleanHeader.toLowerCase();
  if (lower.includes('campaign') && lower.includes('name')) return 'campaignName';
  if (lower.includes('placement')) return 'placement';
  if (lower.includes('spend') || lower.includes('cost')) return 'spend';
  if (lower.includes('sales')) return 'sales';
  if (lower.includes('orders')) return 'orders';
  if (lower.includes('clicks')) return 'clicks';
  if (lower.includes('impressions')) return 'impressions';
  if ((lower.includes('bid') || lower.includes('target')) && !lower.includes('strategy') && !lower.includes('adjustment')) return 'maxBid';
  if (lower.includes('targeting') || lower.includes('keyword')) return 'keywordText';
  
  // 3. Fallback
  return lower.replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
};

// ------------------------------------------------------------------
// 主報表解析 (Dashboard 用)
// ------------------------------------------------------------------

export const parseCSV = (csvText: string): { data: CampaignData[], columns: ColumnDef[] } => {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const lines = cleanText.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return { data: [], columns: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const headerKeyMap = headers.map(normalizeHeader);
  
  // 【修正】定義完整的欄位列表，確保與 App.tsx 一致
  const definedColumns: ColumnDef[] = [
    // 1. 基礎資訊
    { id: 'campaignName', label: 'Campaign Name', isFixed: true, isVisible: true, type: 'text', width: 220 },
    { id: 'status', label: 'Status', isFixed: true, isVisible: true, type: 'text', width: 90 },
    { id: 'portfolio', label: 'Portfolio', isFixed: false, isVisible: true, type: 'text', width: 120 },
    { id: 'targetingType', label: 'Targeting Type', isFixed: false, isVisible: true, type: 'text', width: 110 },
    { id: 'biddingStrategy', label: 'Strategy', isFixed: false, isVisible: true, type: 'text', width: 130 },
    { id: 'budget', label: 'Budget', isFixed: false, isVisible: true, type: 'currency', width: 90 },
    { id: 'startDate', label: 'Start Date', isFixed: false, isVisible: true, type: 'date', width: 100 },
    { id: 'endDate', label: 'End Date', isFixed: false, isVisible: true, type: 'date', width: 100 },

    // 2. 核心表現
    { id: 'impressions', label: 'Impressions', isFixed: false, isVisible: true, type: 'number', width: 110 },
    { id: 'clicks', label: 'Clicks', isFixed: false, isVisible: true, type: 'number', width: 100 },
    { id: 'ctr', label: 'CTR', isFixed: false, isVisible: true, type: 'percent', width: 90 },
    { id: 'spend', label: 'Spend', isFixed: false, isVisible: true, type: 'currency', width: 110 },
    { id: 'cpc', label: 'CPC', isFixed: false, isVisible: true, type: 'currency', width: 90 },

    // 3. 轉換與銷售
    { id: 'orders', label: 'Orders', isFixed: false, isVisible: true, type: 'number', width: 90 },
    { id: 'units', label: 'Units', isFixed: false, isVisible: true, type: 'number', width: 90 },
    { id: 'sales', label: 'Sales', isFixed: false, isVisible: true, type: 'currency', width: 110 },
    { id: 'cvr', label: 'CVR', isFixed: false, isVisible: true, type: 'percent', width: 90 },

    // 4. 效率與進階指標
    { id: 'acos', label: 'ACOS', isFixed: false, isVisible: true, type: 'percent', width: 90 },
    { id: 'roas', label: 'ROAS', isFixed: false, isVisible: true, type: 'number', width: 90 },
    { id: 'cpa', label: 'CPA', isFixed: false, isVisible: false, type: 'currency', width: 90 },
    { id: 'aov', label: 'AOV', isFixed: false, isVisible: false, type: 'currency', width: 90 },
    { id: 'cpm', label: 'CPM', isFixed: false, isVisible: false, type: 'currency', width: 90 },
    { id: 'rpc', label: 'RPC', isFixed: false, isVisible: false, type: 'currency', width: 90 },
    { id: 'actc', label: 'aCTC', isFixed: false, isVisible: false, type: 'number', width: 90 },
    { id: 'percentOfSales', label: '% of Sales', isFixed: false, isVisible: false, type: 'percent', width: 100 },
    { id: 'percentOfSpend', label: '% of Spend', isFixed: false, isVisible: false, type: 'percent', width: 100 },
  ];

  const tempRows: CampaignData[] = [];
  let totalSales = 0;
  let totalSpend = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: any = { id: `row-${i}` };
    
    headerKeyMap.forEach((key, index) => {
      const rawVal = values[index];
      
      if (key === 'date' || key === 'startDate' || key === 'endDate') {
        const d = parseDate(rawVal);
        if (d) row[key] = d;
      } else if (['spend', 'sales', 'orders', 'clicks', 'impressions', 'budget', 'cpc', 'cpm', 'units', 'maxBid'].includes(key)) {
         row[key] = parseNumber(rawVal);
      } else if (['ctr', 'acos', 'roas', 'cvr'].includes(key)) {
         row[key] = parseNumber(rawVal);
      } else {
         row[key] = rawVal || '';
      }
    });

    // Default Campaign Name if missing
    if (!row.campaignName) {
        row.campaignName = "Current Campaign"; 
    }

    row.clicks = row.clicks || 0;
    row.orders = row.orders || 0;
    row.spend = row.spend || 0;
    row.sales = row.sales || 0;
    row.impressions = row.impressions || 0;
    row.units = row.units || 0;

    // 計算衍生指標
    row.acos = row.sales > 0 ? (row.spend / row.sales) * 100 : 0;
    row.roas = row.spend > 0 ? row.sales / row.spend : 0;
    row.ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    row.cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
    row.cvr = row.clicks > 0 ? (row.orders / row.clicks) * 100 : 0;
    
    // 進階指標
    row.cpa = row.orders > 0 ? row.spend / row.orders : 0;
    row.aov = row.orders > 0 ? row.sales / row.orders : 0;
    row.rpc = row.clicks > 0 ? row.sales / row.clicks : 0;
    row.actc = row.orders > 0 ? row.clicks / row.orders : 0;
    if (!row.cpm) row.cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0;

    totalSales += row.sales;
    totalSpend += row.spend;
    tempRows.push(row as CampaignData);
  }

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
    if (row.date) { const rowDate = new Date(row.date); return rowDate >= start && rowDate <= end; }
    if (row.startDate) { const rowStart = new Date(row.startDate); return rowStart >= start && rowStart <= end; }
    return true; 
  });
};

export const aggregateCampaignData = (data: CampaignData[]): CampaignData[] => {
  const aggMap: Record<string, CampaignData> = {};
  data.forEach(row => {
    const key = row.campaignName || 'Unknown';
    if (!aggMap[key]) {
      // 【修正】初始化時，保留靜態欄位資料 (Start Date, End Date, Portfolio, Budget 等)
      aggMap[key] = {
        id: key, 
        campaignName: key, 
        status: row.status, 
        portfolio: row.portfolio, 
        targetingType: row.targetingType, 
        biddingStrategy: row.biddingStrategy, 
        budget: row.budget,
        startDate: row.startDate, 
        endDate: row.endDate,
        
        clicks: 0, orders: 0, spend: 0, sales: 0, impressions: 0, units: 0,
      } as CampaignData;
    }
    aggMap[key].clicks += (row.clicks || 0);
    aggMap[key].orders += (row.orders || 0);
    aggMap[key].spend += (row.spend || 0);
    aggMap[key].sales += (row.sales || 0);
    aggMap[key].impressions += (row.impressions || 0);
    aggMap[key].units += (row.units || 0);
  });

  return Object.values(aggMap).map(row => {
    row.ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    row.cvr = row.clicks > 0 ? (row.orders / row.clicks) * 100 : 0;
    row.acos = row.sales > 0 ? (row.spend / row.sales) * 100 : 0;
    row.roas = row.spend > 0 ? row.sales / row.spend : 0;
    row.cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
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

export const generateMockPreviousData = (currentData: CampaignData[]): CampaignData[] => {
  return currentData.map(c => ({...c})); 
};

// Legacy placeholders
export const parsePlacementCSV = (csvText: string) => ({});
export const parseKeywordCSV = (csvText: string) => ([]);
export const calculateRecommendedBid = () => ({ bid: 0, rule: '' });
export const generateOptimizationPreview = () => ([]);

// ------------------------------------------------------------------
// Raw Parsers
// ------------------------------------------------------------------

export const parsePlacementCSVRaw = (csvText: string): PlacementMetric[] => {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const lines = cleanText.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => normalizeHeader(h.trim().replace(/^"|"$/g, '')));
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => colMap[h] = i);

  const results: PlacementMetric[] = [];
  
  for(let i=1; i<lines.length; i++) {
    const line = lines[i];
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    
    const getVal = (key: string) => {
        const idx = colMap[key];
        return idx !== undefined ? cols[idx] : undefined;
    };

    const campaignName = getVal('campaignName') || 'Current Campaign';
    const placementName = getVal('placement') || 'Unknown';

    results.push({
      placement: placementName,
      campaignName: campaignName,
      impressions: safeFloat(getVal('impressions')),
      clicks: safeFloat(getVal('clicks')),
      spend: safeFloat(getVal('spend')),
      sales: safeFloat(getVal('sales')), 
      orders: safeFloat(getVal('orders')),
      currentModifier: safeFloat(getVal('bidAdjustment'))
    });
  }
  return results;
};

export const parseKeywordCSVRaw = (csvText: string): KeywordMetric[] => {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const lines = cleanText.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => normalizeHeader(h.trim().replace(/^"|"$/g, '')));
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => colMap[h] = i);

  const results: KeywordMetric[] = [];
  
  for(let i=1; i<lines.length; i++) {
    const line = lines[i];
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    
    const getVal = (key: string) => {
        const idx = colMap[key];
        return idx !== undefined ? cols[idx] : undefined;
    };

    const campaignName = getVal('campaignName') || 'Current Campaign';

    const sales = safeFloat(getVal('sales'));
    const spend = safeFloat(getVal('spend'));

    results.push({
      id: `kw-${i}`,
      campaignName: campaignName,
      matchType: getVal('matchType') || '-',
      status: getVal('status') || 'ENABLED', 
      keywordText: getVal('keywordText') || getVal('targeting') || getVal('query') || '-',
      currentBid: safeFloat(getVal('maxBid')) || 0, 
      impressions: safeFloat(getVal('impressions')),
      clicks: safeFloat(getVal('clicks')),
      spend: spend,
      cpc: safeFloat(getVal('cpc')),
      orders: safeFloat(getVal('orders')),
      sales: sales,
      acos: sales > 0 ? (spend / sales) * 100 : 0
    });
  }
  return results;
};