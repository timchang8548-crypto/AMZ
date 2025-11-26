import { BidOptimizerConfig, OptimizationResultRow } from '../types';

// ==========================================
// Type Definitions
// ==========================================

export interface KeywordMetric {
  id: string;
  campaignName: string;
  matchType: string;
  keywordText: string;
  currentBid: number;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  cpc: number;
  status: string;
  acos: number; 
  suggestedBidMedian?: number; // Optional from CSV
}

export interface PlacementMetric {
  campaignName: string;
  placement: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  currentModifier: number;
}

interface OptimizedPlacement {
  campaignName: string;
  suggestedModifierTOS: number;
  suggestedModifierPP: number;
  action: string;
  tosRpc: number;
  ppRpc: number;
  restRpc: number;
  dataStatus: 'Sufficient' | 'Insufficient (Borrowed)' | 'Insufficient';
}

// ==========================================
// Helper Functions
// ==========================================
const safeDiv = (num: number, denom: number): number => {
  return denom === 0 ? 0 : num / denom;
};

// 阻尼步長限制 (Damped Step Limit)
// 邏輯：當目標與現狀差距過大時，不要一次到位，而是移動一定比例 (e.g. 50% 的路程)
// 同時受限於最大步長 (e.g. max 30%)
const applyDampedStep = (current: number, target: number, maxStep: number): number => {
  const diff = target - current;
  
  // 1. 阻尼係數：只走一半的路 (Conservative approach)
  // 說明中提到：不要一次調太快
  let move = diff * 0.5; 

  // 2. 降價加速邏輯 (根據說明：減的速度更快)
  if (diff < 0 && current > 100) {
      move = diff * 0.7; // 如果目前溢價很高且要降，走快一點 (70% 路程)
  }

  // 3. 硬性最大步長限制 (Max Step Cap)
  if (Math.abs(move) > maxStep) {
      move = move > 0 ? maxStep : -maxStep;
  }

  return current + move;
};

// ==========================================
// Logic 1: 版位溢價計算 (Placement Optimization with Data Borrowing)
// ==========================================
export const calculatePlacementAdjustment = (
  placements: PlacementMetric[],
  config: BidOptimizerConfig
): Record<string, OptimizedPlacement> => {
  
  // 1. 資料分組 & 聚合 (Aggregation for Borrowing)
  // 為了模擬 "借用數據"，我們先計算一個 "全域平均" (Global Average) 或 "群組平均"
  // 在實務上，通常是借用 "同產品類型" 的數據。這裡我們簡化為：若單一 Campaign 數據不足，參考全體平均。
  
  const globalStats = {
      tos: { clicks: 0, sales: 0 },
      pp: { clicks: 0, sales: 0 },
      rest: { clicks: 0, sales: 0 }
  };

  const campaignMap: Record<string, { tos?: PlacementMetric, pp?: PlacementMetric, rest?: PlacementMetric }> = {};

  placements.forEach(p => {
    if (!campaignMap[p.campaignName]) campaignMap[p.campaignName] = {};
    
    const pName = p.placement.toLowerCase();
    let type: 'tos' | 'pp' | 'rest' = 'rest';
    
    if (pName.includes('top')) type = 'tos';
    else if (pName.includes('product')) type = 'pp';
    
    campaignMap[p.campaignName][type] = p;

    // 累加全域數據
    globalStats[type].clicks += p.clicks;
    globalStats[type].sales += p.sales;
  });

  // 計算全域 RPC 基準
  const globalRpcTOS = safeDiv(globalStats.tos.sales, globalStats.tos.clicks);
  const globalRpcPP = safeDiv(globalStats.pp.sales, globalStats.pp.clicks);
  const globalRpcRest = safeDiv(globalStats.rest.sales, globalStats.rest.clicks);

  const results: Record<string, OptimizedPlacement> = {};

  // 2. 個別計算
  Object.keys(campaignMap).forEach(campaign => {
    const { tos, pp, rest } = campaignMap[campaign];
    
    const currentModTOS = tos?.currentModifier || 0;
    const currentModPP = pp?.currentModifier || 0;

    // 個別 RPC
    const rpcTOS = tos ? safeDiv(tos.sales, tos.clicks) : 0;
    const rpcPP = pp ? safeDiv(pp.sales, pp.clicks) : 0;
    const rpcRest = rest ? safeDiv(rest.sales, rest.clicks) : 0;

    // 判斷數據是否足夠 (Data Sufficiency Check)
    // 說明：至少要有訂單，或者點擊數超過平均轉換所需點擊 (這裡設閾值 10 做為簡單判斷)
    const isSufficient = (rest?.clicks || 0) > 10 && (tos?.clicks || 0) > 10;
    
    let targetModTOS = currentModTOS;
    let targetModPP = currentModPP;
    let dataStatus: 'Sufficient' | 'Insufficient (Borrowed)' | 'Insufficient' = 'Insufficient';

    // 邏輯分支：數據足夠 vs 不足
    if (isSufficient && rpcRest > 0) {
        // A. 數據足夠：用自己的數據算
        if (rpcTOS > 0) targetModTOS = ((rpcTOS / rpcRest) - 1) * 100;
        if (rpcPP > 0) targetModPP = ((rpcPP / rpcRest) - 1) * 100;
        dataStatus = 'Sufficient';
    } else {
        // B. 數據不足：借用全域數據 (Data Borrowing)
        // 假設這個 Campaign 跟其他上傳的是同類產品
        if (globalRpcRest > 0) {
            if (globalRpcTOS > 0) targetModTOS = ((globalRpcTOS / globalRpcRest) - 1) * 100;
            if (globalRpcPP > 0) targetModPP = ((globalRpcPP / globalRpcRest) - 1) * 100;
            dataStatus = 'Insufficient (Borrowed)';
        }
    }

    // 限制範圍 (0~900%)
    targetModTOS = Math.max(0, Math.min(900, targetModTOS));
    targetModPP = Math.max(0, Math.min(900, targetModPP));

    // 3. 應用步長與阻尼 (Step Limit)
    const maxStepChange = config.maxPlacementIncrease || 30; 
    
    const finalModTOS = applyDampedStep(currentModTOS, targetModTOS, maxStepChange);
    const finalModPP = applyDampedStep(currentModPP, targetModPP, maxStepChange);

    let action = '維持';
    if (finalModTOS > currentModTOS + 5) action = '提高 TOS 溢價';
    else if (finalModTOS < currentModTOS - 5) action = '降低 TOS 溢價';

    results[campaign] = {
        campaignName: campaign,
        suggestedModifierTOS: Math.round(finalModTOS),
        suggestedModifierPP: Math.round(finalModPP),
        action,
        tosRpc: isSufficient ? rpcTOS : globalRpcTOS,
        ppRpc: isSufficient ? rpcPP : globalRpcPP,
        restRpc: isSufficient ? rpcRest : globalRpcRest,
        dataStatus
    };
  });

  return results;
};

// ==========================================
// Logic 2: 關鍵字出價計算 (Keyword Bid Optimization)
// ==========================================
export const optimizeKeywordBid = (
  row: KeywordMetric, 
  config: BidOptimizerConfig,
  placementInfo?: OptimizedPlacement
): { bid: number, rule: string } => {

  const currentBid = row.currentBid > 0 ? row.currentBid : (row.cpc || 0.5);
  const targetAcos = config.targetAcos; 
  
  let currentAcos = row.acos; 
  if (currentAcos < 1 && currentAcos > 0) currentAcos *= 100;

  let newBid = currentBid;
  let rule = '維持';

  // ----------------------------------------------------
  // 1. 理想出價 (Ideal Bid)
  // ----------------------------------------------------
  const safeCurrentAcos = currentAcos <= 0 ? 0.1 : currentAcos;
  
  // 核心公式： Ideal Bid = Current Bid * (Target / Actual)
  let idealBid = currentBid * (targetAcos / safeCurrentAcos);

  // ----------------------------------------------------
  // 2. 情境判斷 (Scenarios)
  // ----------------------------------------------------

  // 情境 A: 無訂單 (Zero Orders)
  if (row.orders === 0) {
      // 點擊多 -> 降
      if (row.clicks >= 10) { 
          const cutFactor = config.mode === 'lower_acos' ? 0.7 : 0.8;
          newBid = currentBid * cutFactor;
          rule = '無單高點擊 (降)';
      } 
      // 曝光低 -> 升 (買數據)
      else if (row.impressions < 500 && row.spend < (currentBid * 5)) { 
          if (config.mode === 'boost_sales' || config.mode === 'balance') {
              // 如果有建議出價，嘗試採納建議出價
              if (row.suggestedBidMedian && row.suggestedBidMedian > currentBid) {
                  newBid = row.suggestedBidMedian;
              } else {
                  newBid = currentBid * 1.2; 
              }
              rule = '低曝光 (提價)';
          }
      }
  } 
  
  // 情境 B: 有訂單 (Has Orders)
  else {
      // 阻尼係數：不要直接跳到 Ideal Bid
      // New = Current + (Ideal - Current) * Factor
      const damping = 0.8; // 80% 趨近速度
      newBid = currentBid + (idealBid - currentBid) * damping;

      if (currentAcos > targetAcos) {
          rule = '高 ACOS (降)';
          // 模式修正：保守模式降更多
          if (config.mode === 'lower_acos') newBid *= 0.95;
      } else {
          rule = '優異表現 (提)';
          // 模式修正：積極模式提更多
          if (config.mode === 'boost_sales') newBid *= 1.1;
      }
  }

  // ----------------------------------------------------
  // 3. 版位連動 (Placement Awareness)
  // ----------------------------------------------------
  // 說明：如果版位溢價增加，Base Bid 要降低以維持平衡
  if (placementInfo) {
      const newMod = placementInfo.suggestedModifierTOS; // e.g. 100%
      
      // 簡單閾值：如果溢價超過 50%，開始壓低 Base Bid
      if (newMod > 50) {
          // 補償係數：溢價越高，Base Bid 壓越低，但不要壓死
          // 這裡使用一個溫和的 decay function
          const factor = 1 - (newMod / 1000); // e.g. 100% -> 0.9, 200% -> 0.8
          newBid = newBid * Math.max(0.7, factor); // 最多打七折
          rule += ' + 版位平衡';
      }
  }

  // ----------------------------------------------------
  // 4. 邊界與步長限制 (Constraints)
  // ----------------------------------------------------
  
  // 漲跌幅限制
  const maxIncPct = (config.maxBidIncrease || 30) / 100;
  const maxDecPct = (config.maxBidDecrease || 30) / 100;

  if (newBid > currentBid * (1 + maxIncPct)) {
      newBid = currentBid * (1 + maxIncPct);
      rule += ' (漲幅限制)';
  }
  if (newBid < currentBid * (1 - maxDecPct)) {
      newBid = currentBid * (1 - maxDecPct);
      rule += ' (跌幅限制)';
  }

  // 地板與天花板
  const floor = config.bidFloorValue || 0.02;
  const ceiling = config.bidCeilingValue || 100.0;

  if (newBid < floor) newBid = floor;
  if (newBid > ceiling) newBid = ceiling;

  return {
      bid: parseFloat(newBid.toFixed(2)),
      rule
  };
};

// ==========================================
// Main Export
// ==========================================
export const generateBidOptimizationPreview = (
    keywords: KeywordMetric[],
    placements: PlacementMetric[],
    config: BidOptimizerConfig
): OptimizationResultRow[] => {
    
    // 1. 先計算版位建議 (含數據借用邏輯)
    const placementSuggestions = calculatePlacementAdjustment(placements, config);

    // 2. 計算關鍵字出價
    return keywords.map(kw => {
        const placementMod = placementSuggestions[kw.campaignName];
        
        const result = optimizeKeywordBid(kw, config, placementMod);
        
        const diffPercent = kw.currentBid > 0 
            ? ((result.bid - kw.currentBid) / kw.currentBid) * 100 
            : 0;

        return {
            id: kw.id,
            adType: 'SP',
            campaignName: kw.campaignName,
            adGroupName: '-', 
            entity: 'Keyword',
            targeting: kw.keywordText,
            matchType: kw.matchType,
            status: kw.status || 'ENABLED',
            
            impressions: kw.impressions,
            clicks: kw.clicks,
            spend: kw.spend,
            sales: kw.sales,
            orders: kw.orders,
            cpc: kw.cpc,
            ctr: kw.impressions > 0 ? (kw.clicks / kw.impressions) * 100 : 0,
            cvr: kw.clicks > 0 ? (kw.orders / kw.clicks) * 100 : 0,
            acos: kw.sales > 0 ? (kw.spend / kw.sales) * 100 : 0,
            roas: kw.spend > 0 ? kw.sales / kw.spend : 0,
            cpa: kw.orders > 0 ? kw.spend / kw.orders : 0,

            currentBid: kw.currentBid,
            suggestedBid: result.bid,
            diffPercent: diffPercent,
            rule: result.rule,
            targetAcos: config.targetAcos
        };
    });
};