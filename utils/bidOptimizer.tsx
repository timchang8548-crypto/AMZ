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
  suggestedBidMedian?: number; 
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
  baseBidMultiplier: number; 
  action: string;
  tosRpc: number;
  ppRpc: number;
  restRpc: number;
  campaignFallbackRpc: number; 
  campaignAov: number;   
  campaignActc: number;  
  dataStatus: 'Sufficient' | 'Insufficient (Borrowed)' | 'Insufficient';
  statsTOS: PlacementMetric | null;
  statsPP: PlacementMetric | null;
  statsRest: PlacementMetric | null;
}

const safeDiv = (num: number, denom: number): number => {
  return denom === 0 ? 0 : num / denom;
};

// ==========================================
// Logic 1: 版位溢價計算 & 全局數據準備
// ==========================================
export const calculatePlacementAdjustment = (
  placements: PlacementMetric[],
  config: BidOptimizerConfig
): Record<string, OptimizedPlacement> => {
  
  // 1. 全局數據統計 (Account Level Fallback)
  const globalStats = { sales: 0, clicks: 0, orders: 0 };
  const campaignMap: Record<string, { tos?: PlacementMetric, pp?: PlacementMetric, rest?: PlacementMetric }> = {};

  placements.forEach(p => {
    if (!campaignMap[p.campaignName]) campaignMap[p.campaignName] = {};
    const pName = p.placement.toLowerCase();
    
    let type: 'tos' | 'pp' | 'rest' = 'rest';
    if (pName.includes('top')) type = 'tos';
    else if (pName.includes('product')) type = 'pp';
    
    campaignMap[p.campaignName][type] = p;
    globalStats.sales += p.sales;
    globalStats.clicks += p.clicks;
    globalStats.orders += p.orders;
  });

  const accountFallbackRpc = safeDiv(globalStats.sales, globalStats.clicks);
  const accountAov = safeDiv(globalStats.sales, globalStats.orders) || 50; 
  const accountActc = safeDiv(globalStats.clicks, globalStats.orders) || 20; 

  const results: Record<string, OptimizedPlacement> = {};

  Object.keys(campaignMap).forEach(campaign => {
    const { tos, pp, rest } = campaignMap[campaign];
    
    const rawRpcTOS = tos ? safeDiv(tos.sales, tos.clicks) : 0;
    const rawRpcPP = pp ? safeDiv(pp.sales, pp.clicks) : 0;
    const rawRpcRest = rest ? safeDiv(rest.sales, rest.clicks) : 0;

    const THRESHOLD = 20; 

    // 有效 RPC 計算
    const getEffectiveRpc = (rawRpc: number, clicks: number) => {
        if (clicks >= THRESHOLD && rawRpc > 0) return rawRpc;
        if (clicks >= THRESHOLD && rawRpc === 0) return 0; 
        return accountFallbackRpc;
    };

    const effRpcTOS = getEffectiveRpc(rawRpcTOS, tos?.clicks || 0);
    const effRpcPP = getEffectiveRpc(rawRpcPP, pp?.clicks || 0);
    const effRpcRest = getEffectiveRpc(rawRpcRest, rest?.clicks || 0);

    const totalSales = (tos?.sales || 0) + (pp?.sales || 0) + (rest?.sales || 0);
    const totalClicks = (tos?.clicks || 0) + (pp?.clicks || 0) + (rest?.clicks || 0);
    const totalOrders = (tos?.orders || 0) + (pp?.orders || 0) + (rest?.orders || 0);
    
    const campaignTotalRpc = totalClicks > 10 ? safeDiv(totalSales, totalClicks) : accountFallbackRpc;
    const campaignAov = totalOrders > 5 ? safeDiv(totalSales, totalOrders) : accountAov;
    const campaignActc = totalOrders > 5 ? safeDiv(totalClicks, totalOrders) : accountActc;

    // --- 計算版位係數 (Modifier) ---
    // 邏輯：最差版位 RPC / 整體 RPC
    const rpcList = [effRpcTOS, effRpcPP, effRpcRest];
    const worstRpc = Math.min(...rpcList);
    
    let baseBidMultiplier = safeDiv(worstRpc, campaignTotalRpc);
    // 限制係數範圍，避免過度降價
    baseBidMultiplier = Math.max(0.2, Math.min(1.0, baseBidMultiplier));

    // --- 計算溢價 (Bid Adjustment) ---
    // 公式：((該版位 RPC / 最差版位 RPC) - 1) * 100%
    const calcAdjustment = (targetRpc: number) => {
        const base = worstRpc === 0 ? campaignTotalRpc * 0.5 : worstRpc;
        if (targetRpc <= base) return 0;
        return ((targetRpc / base) - 1) * 100;
    };

    let suggestedModifierTOS = calcAdjustment(effRpcTOS);
    let suggestedModifierPP = calcAdjustment(effRpcPP);

    // 應用使用者設定的最大調幅限制 (Caps)
    const tosLimit = config.maxPlacementIncrease || 900; 
    const ppLimit = config.maxPlacementDecrease || 900;

    suggestedModifierTOS = Math.min(tosLimit, suggestedModifierTOS);
    suggestedModifierPP = Math.min(ppLimit, suggestedModifierPP);

    let action = '維持';
    if (baseBidMultiplier < 0.95) action = `係數 x${baseBidMultiplier.toFixed(2)}`;

    let dataStatus: 'Sufficient' | 'Insufficient (Borrowed)' | 'Insufficient' = 
        totalClicks > THRESHOLD * 2 ? 'Sufficient' : 'Insufficient (Borrowed)';

    results[campaign] = {
        campaignName: campaign,
        suggestedModifierTOS: Math.round(suggestedModifierTOS),
        suggestedModifierPP: Math.round(suggestedModifierPP),
        baseBidMultiplier, 
        action,
        tosRpc: rawRpcTOS,
        ppRpc: rawRpcPP,
        restRpc: rawRpcRest,
        campaignFallbackRpc: campaignTotalRpc,
        campaignAov, 
        campaignActc, 
        dataStatus,
        statsTOS: tos || null,
        statsPP: pp || null,
        statsRest: rest || null
    };
  });

  return results;
};

// ==========================================
// Logic 2: 關鍵字出價優化 (嚴格依據三大模式與四大規則)
// ==========================================
export const optimizeKeywordBid = (
  row: KeywordMetric, 
  config: BidOptimizerConfig,
  placementInfo?: OptimizedPlacement
): { bid: number, rule: string } => {

  const currentBid = row.currentBid > 0 ? row.currentBid : (row.cpc || 0.5);
  const targetAcosDecimal = config.targetAcos / 100;
  
  // 1. 取得全域參數
  let effectiveRpc = placementInfo ? placementInfo.campaignFallbackRpc : 0;
  let effectiveAov = placementInfo ? placementInfo.campaignAov : 50;
  let effectiveActc = placementInfo ? placementInfo.campaignActc : 20;

  // 若關鍵字本身數據充足，優先使用關鍵字數據
  if (row.clicks >= 20) {
      if (row.sales > 0) effectiveRpc = row.sales / row.clicks;
      else effectiveRpc = 0; 
  }
  
  // 2. 取得版位調整係數 (Modifier)
  const modifier = placementInfo ? placementInfo.baseBidMultiplier : 1.0;

  // 3. 計算 tCPC (技術可負擔 CPC)
  // 公式：RPC * 目標ACOS * 版位係數
  let tCPC = effectiveRpc * targetAcosDecimal * modifier;
  if (tCPC < 0.02) tCPC = 0.02;

  // 4. 定義模式參數 (觸發門檻與倍數)
  const MODE = config.mode; // 'balance', 'lower_acos', 'boost_sales'

  // --- 觸發門檻 (Thresholds) ---
  const highAcosTriggerMult = MODE === 'boost_sales' ? 1.33 : (MODE === 'lower_acos' ? 1.00 : 1.20);
  const noSalesCpaMult = MODE === 'boost_sales' ? 1.25 : (MODE === 'lower_acos' ? 0.80 : 1.00);
  const lowAcosTriggerMult = MODE === 'boost_sales' ? 0.85 : (MODE === 'lower_acos' ? 0.50 : 0.80);
  const lowVisActcMult = MODE === 'lower_acos' ? 0.50 : 0.90; 

  // --- 調整幅度 (Adjustment Factors) ---
  // 低 ACOS: 平衡 1.1x / 降低 1.1x / 提升 1.2x
  const lowAcosBidMult = MODE === 'boost_sales' ? 1.20 : 1.10; 
  // 低能見度: 平衡 1.05x / 降低 1.05x / 提升 1.1x
  const lowVisBidMult = MODE === 'boost_sales' ? 1.10 : 1.05;

  // --- 出價上限倍數 (Ceiling Multiplier) ---
  const ceilingMult = MODE === 'boost_sales' ? 3.0 : (MODE === 'lower_acos' ? 1.0 : 2.0);

  // 5. 規則判斷與計算
  const currentAcosDecimal = row.sales > 0 ? (row.spend / row.sales) : 0;
  // 目標 CPA 計算
  const targetCpa = effectiveAov * targetAcosDecimal;

  let suggestedBid = currentBid;
  let rule = '維持';
  let appliedCeilingBase = tCPC; // 預設使用 tCPC 作為基底，再依規則乘倍數

  // 狀態判定
  const isHighAcos = row.sales > 0 && currentAcosDecimal > (targetAcosDecimal * highAcosTriggerMult);
  const isHighSpendNoSales = row.orders === 0 && row.spend > (targetCpa * noSalesCpaMult);
  const isLowAcos = row.sales > 0 && currentAcosDecimal < (targetAcosDecimal * lowAcosTriggerMult) && row.orders >= 1;
  const isLowVisibility = row.clicks < (effectiveActc * lowVisActcMult);

  // --- 執行優先順序邏輯 ---

  if (isHighAcos) {
      if (config.rules?.highAcos) {
          // 公式: RPC * Target ACOS * Modifier (即 tCPC)
          suggestedBid = tCPC;
          rule = '高 ACOS 修正';
          // 高 ACOS 時不套用倍數，回歸 1x tCPC
          appliedCeilingBase = tCPC * 1.0; 
      } else {
          rule = '高 ACOS(略過)';
      }
  }
  else if (isHighSpendNoSales) {
      if (config.rules?.highSpendNoSales) {
          // 平滑降價公式
          const smoothBid = (effectiveAov / (row.clicks + effectiveActc)) * targetAcosDecimal * modifier;
          suggestedBid = smoothBid;
          rule = '無單降價';
      } else {
          rule = '無單(略過)';
      }
  }
  else if (isLowAcos) {
      if (config.rules?.lowAcos) {
          // 積極提價公式
          suggestedBid = currentBid * lowAcosBidMult;
          rule = '表現優異(提價)';
          // 應用上限倍數 (1x, 2x, 3x)
          appliedCeilingBase = tCPC * ceilingMult;
      } else {
          rule = '優異(略過)';
      }
  }
  else if (isLowVisibility) {
      if (config.rules?.lowImpression) {
          // 試探提價公式
          suggestedBid = currentBid * lowVisBidMult;
          rule = '低曝測試';
          // 低能見度保護：嚴格鎖死 1x tCPC
          appliedCeilingBase = tCPC * 1.0; 
      } else {
          rule = '低曝(略過)';
      }
  }
  else {
      rule = '維持 (觀察中)';
  }

  // 6. 衝突檢查 1：Bid Ceiling (依據上述規則計算出的 appliedCeiling)
  // 注意：使用者也可以手動選擇 "自訂" 上限，若有設定則覆蓋
  let finalCeiling = appliedCeilingBase;
  if (config.bidCeilingType === 'custom' || config.bidCeilingType === 'max') {
       finalCeiling = config.bidCeilingValue || 999;
  }

  if (suggestedBid > finalCeiling) {
      suggestedBid = finalCeiling;
      rule += ' (觸及上限)';
  }

  // 7. 衝突檢查 2：單次最大漲跌幅限制 (Safety Guard)
  const maxIncPct = (config.maxBidIncrease || 25) / 100;
  const maxDecPct = (config.maxBidDecrease || 25) / 100;
  const maxAllowedBid = currentBid * (1 + maxIncPct);
  const minAllowedBid = currentBid * (1 - maxDecPct);

  if (suggestedBid > maxAllowedBid) {
      suggestedBid = maxAllowedBid;
      rule += ' (漲幅限制)';
  }
  if (suggestedBid < minAllowedBid) {
      suggestedBid = minAllowedBid;
      rule += ' (跌幅限制)';
  }

  const floor = config.bidFloorValue || 0.02;
  suggestedBid = Math.max(floor, suggestedBid);

  return {
      bid: parseFloat(suggestedBid.toFixed(2)),
      rule: `${rule}` 
  };
};

// ==========================================
// Main Export (產生結果報表)
// ==========================================
export const generateBidOptimizationPreview = (
    keywords: KeywordMetric[],
    placements: PlacementMetric[],
    config: BidOptimizerConfig
): OptimizationResultRow[] => {
    
    // 1. 計算版位係數
    const placementSuggestions = calculatePlacementAdjustment(placements, config);

    // 2. 產生版位建議列
    const placementRows: OptimizationResultRow[] = Object.values(placementSuggestions).flatMap(p => {
        const rows: OptimizationResultRow[] = [];
        const calcStats = (stats: PlacementMetric | null) => {
             if (!stats) return { imp: 0, clicks: 0, spend: 0, sales: 0, orders: 0, acos: 0, cpc: 0 };
             const acos = stats.sales > 0 ? (stats.spend / stats.sales) * 100 : 0;
             const cpc = stats.clicks > 0 ? stats.spend / stats.clicks : 0;
             return { ...stats, imp: stats.impressions, acos, cpc };
        };

        const tosStats = calcStats(p.statsTOS);
        const ppStats = calcStats(p.statsPP);
        const restStats = calcStats(p.statsRest);

        // Top of Search
        rows.push({
            id: `pl-tos-${p.campaignName}`,
            adType: 'SP',
            campaignName: p.campaignName,
            adGroupName: '-',
            entity: 'Placement',
            targeting: 'Top of Search',
            matchType: '-',
            status: 'ENABLED',
            impressions: tosStats.imp, clicks: tosStats.clicks, spend: tosStats.spend, sales: tosStats.sales, orders: tosStats.orders, cpc: tosStats.cpc, ctr: 0, cvr: 0, roas: 0, cpa: 0, acos: tosStats.acos,
            currentBid: p.statsTOS?.currentModifier || 0,
            suggestedBid: p.suggestedModifierTOS,
            diffPercent: p.suggestedModifierTOS - (p.statsTOS?.currentModifier || 0),
            rule: `RPC: $${p.tosRpc.toFixed(2)}`,
            targetAcos: config.targetAcos
        });

        // Product Pages
        rows.push({
            id: `pl-pp-${p.campaignName}`,
            adType: 'SP',
            campaignName: p.campaignName,
            adGroupName: '-',
            entity: 'Placement',
            targeting: 'Product Pages',
            matchType: '-',
            status: 'ENABLED',
            impressions: ppStats.imp, clicks: ppStats.clicks, spend: ppStats.spend, sales: ppStats.sales, orders: ppStats.orders, cpc: ppStats.cpc, ctr: 0, cvr: 0, roas: 0, cpa: 0, acos: ppStats.acos,
            currentBid: p.statsPP?.currentModifier || 0,
            suggestedBid: p.suggestedModifierPP,
            diffPercent: p.suggestedModifierPP - (p.statsPP?.currentModifier || 0),
            rule: `RPC: $${p.ppRpc.toFixed(2)}`,
            targetAcos: config.targetAcos
        });

        // Rest of Search
        rows.push({
            id: `pl-rest-${p.campaignName}`,
            adType: 'SP',
            campaignName: p.campaignName,
            adGroupName: '-',
            entity: 'Placement',
            targeting: 'Rest of Search',
            matchType: '-',
            status: 'ENABLED',
            impressions: restStats.imp, clicks: restStats.clicks, spend: restStats.spend, sales: restStats.sales, orders: restStats.orders, cpc: restStats.cpc, ctr: 0, cvr: 0, roas: 0, cpa: 0, acos: restStats.acos,
            currentBid: 0,
            suggestedBid: 0,
            diffPercent: 0,
            rule: `基準 RPC: $${p.restRpc.toFixed(2)} (係數:${p.baseBidMultiplier.toFixed(2)})`,
            targetAcos: config.targetAcos
        });

        return rows;
    });

    // 3. 產生關鍵字建議列
    const keywordRows = keywords.map(kw => {
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
            
            impressions: kw.impressions, clicks: kw.clicks, spend: kw.spend, sales: kw.sales, orders: kw.orders, cpc: kw.cpc,
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

    return [...placementRows, ...keywordRows];
};