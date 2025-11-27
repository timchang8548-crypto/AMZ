// 通用指標 Keys
export type MetricKey = 
  | 'impressions' | 'clicks' | 'orders' | 'units' 
  | 'ctr' | 'cvr' | 'cpc' | 'spend' | 'sales' 
  | 'acos' | 'roas' | 'cpa' | 'aov' | 'rpc' | 'actc' | 'cpm' 
  | 'percentOfSales' | 'percentOfSpend';

export type DisplayMode = 'all' | 'active' | 'paused';

// 優化器設定 (Config)
export type OptimizationMode = 'balance' | 'lower_acos' | 'boost_sales';
export type LimitType = 'off' | 'min' | 'max' | 'custom' | 'dynamic';
export type MultiplierType = 1 | 2 | 3;
export type AdjustmentUnit = 'percent' | 'amount';

export interface BidOptimizerConfig {
  mode: OptimizationMode;
  targetAcos: number; 
  
  // 出價限制
  bidFloorType: LimitType;
  bidFloorValue: number;
  bidCeilingType: LimitType;
  bidCeilingValue: number;
  tcpcMultiplier: MultiplierType;

  // 調整幅度限制
  maxBidIncrease: number;
  maxBidIncreaseUnit: AdjustmentUnit;
  maxBidDecrease: number;
  maxBidDecreaseUnit: AdjustmentUnit;

  // 版位設定
  enablePlacement?: boolean;
  maxPlacementIncrease?: number;
  maxPlacementDecrease?: number;
  
  // 相容欄位 (Optional)
  strategy?: string; 
  minBid?: number;
  maxBid?: number;
}

// 優化結果行 (Result Row)
export interface OptimizationResultRow {
  id: string;
  adType: string;
  campaignName: string;
  adGroupName: string;
  entity: string;
  targeting: string;
  matchType: string;
  status: string;
  
  // 數據
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  cpc: number;
  ctr: number;
  cvr: number;
  acos: number;
  roas: number;
  cpa: number;

  // 結果
  currentBid: number;
  suggestedBid: number;
  diffPercent: number;
  rule: string;
  targetAcos: number;
}

// 其他基礎介面
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface CampaignData {
  id: string; 
  date?: string;
  campaignName: string;
  status: string;
  [key: string]: any; 
}

export interface ColumnDef {
  id: string;
  label: string;
  isFixed?: boolean;
  isVisible: boolean;
  // 新增 'date'
  type: 'text' | 'number' | 'currency' | 'percent' | 'date'; 
  width?: number;
}