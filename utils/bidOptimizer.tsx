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
  action: string;
  tosRpc: number;
  ppRpc: number;
  restRpc: number;
  dataStatus: 'Sufficient' | 'Insufficient (Borrowed)' | 'Insufficient';
  // 新增：傳遞原始數據以便顯示
  statsTOS: PlacementMetric | null;
  statsPP: PlacementMetric | null;
}

// ==========================================
// Helper Functions
// ==========================================
const safeDiv = (num: number, denom: number): number => {
  return denom === 0 ? 0 : num / denom;
};

// 阻尼步長限制
const applyDampedStep = (current: number, target: number, maxStep: number): number => {
  const diff = target - current;
  let move = diff * 0.5; 
  if (diff < 0 && current > 100) {
      move = diff * 0.7; 
  }
  if (Math.abs(move) > maxStep) {
      move = move > 0 ? maxStep : -maxStep;
  }
  return current + move;
};

// ==========================================
// Logic 1: 版位溢價計算
// ==========================================
export const calculatePlacementAdjustment = (
  placements: PlacementMetric[],
  config: BidOptimizerConfig
): Record<string, OptimizedPlacement> => {
  
  const globalStats = {
      tos: { clicks: 0, sales: 0 },
      pp: { clicks: 0, sales: 0 },
      rest: { clicks: 0, sales: 0 }
  };

  const campaignMap: Record<string, { tos?: PlacementMetric, pp?: PlacementMetric, rest?: PlacementMetric }> = {};

  placements.forEach(p => {
    if (!campaignMap[p.campaignName]) campaignMap[p.campaignName] = {};
    const pName = p.placement.toLowerCase();
    
    // 簡單判斷版位類型
    let type: 'tos' | 'pp' | 'rest' = 'rest';
    if (pName.includes('top')) type = 'tos';
    else if (pName.includes('product')) type = 'pp';
    
    campaignMap[p.campaignName][type] = p;

    globalStats[type].clicks += p.clicks;
    globalStats[type].sales += p.sales;
  });

  const globalRpcTOS = safeDiv(globalStats.tos.sales, globalStats.tos.clicks);
  const globalRpcPP = safeDiv(globalStats.pp.sales, globalStats.pp.clicks);
  const globalRpcRest = safeDiv(globalStats.rest.sales, globalStats.rest.clicks);

  const results: Record<string, OptimizedPlacement> = {};

  Object.keys(campaignMap).forEach(campaign => {
    const { tos, pp, rest } = campaignMap[campaign];
    
    const currentModTOS = tos?.currentModifier || 0;
    const currentModPP = pp?.currentModifier || 0;

    const rpcTOS = tos ? safeDiv(tos.sales, tos.clicks) : 0;
    const rpcPP = pp ? safeDiv(pp.sales, pp.clicks) : 0;
    const rpcRest = rest ? safeDiv(rest.sales, rest.clicks) : 0;

    const isSufficient = (rest?.clicks || 0) > 10 && (tos?.clicks || 0) > 10;
    
    let targetModTOS = currentModTOS;
    let targetModPP = currentModPP;
    let dataStatus: 'Sufficient' | 'Insufficient (Borrowed)' | 'Insufficient' = 'Insufficient';

    if (isSufficient && rpcRest > 0) {
        if (rpcTOS > 0) targetModTOS = ((rpcTOS / rpcRest) - 1) * 100;
        if (rpcPP > 0) targetModPP = ((rpcPP / rpcRest) - 1) * 100;
        dataStatus = 'Sufficient';
    } else {
        if (globalRpcRest > 0) {
            if (globalRpcTOS > 0) targetModTOS = ((globalRpcTOS / globalRpcRest) - 1) * 100;
            if (globalRpcPP > 0) targetModPP = ((globalRpcPP / globalRpcRest) - 1) * 100;
            dataStatus = 'Insufficient (Borrowed)';
        }
    }

    targetModTOS = Math.max(0, Math.min(900, targetModTOS));
    targetModPP = Math.max(0, Math.min(900, targetModPP));

    const maxStepChange = config.maxPlacementIncrease || 30; 
    
    const finalModTOS = applyDampedStep(currentModTOS, targetModTOS, maxStepChange);
    const finalModPP = applyDampedStep(currentModPP, targetModPP, maxStepChange);

    let action = '維持';
    if (finalModTOS > currentModTOS + 5) action = '提高 TOS';
    else if (finalModTOS < currentModTOS - 5) action = '降低 TOS';

    results[campaign] = {
        campaignName: campaign,
        suggestedModifierTOS: Math.round(finalModTOS),
        suggestedModifierPP: Math.round(finalModPP),
        action,
        tosRpc: isSufficient ? rpcTOS : globalRpcTOS,
        ppRpc: isSufficient ? rpcPP : globalRpcPP,
        restRpc: isSufficient ? rpcRest : globalRpcRest,
        dataStatus,
        // 保存原始數據以供顯示
        statsTOS: tos || null,
        statsPP: pp || null
    };
  });

  return results;
};

// ==========================================
// Logic 2: 關鍵字出價計算
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

  const safeCurrentAcos = currentAcos <= 0 ? 0.1 : currentAcos;
  let idealBid = currentBid * (targetAcos / safeCurrentAcos);

  if (row.orders === 0) {
      if (row.clicks >= 10) { 
          const cutFactor = config.mode === 'lower_acos' ? 0.7 : 0.8;
          newBid = currentBid * cutFactor;
          rule = '無單高點擊 (降)';
      } 
      else if (row.impressions < 500 && row.spend < (currentBid * 5)) { 
          if (config.mode === 'boost_sales' || config.mode === 'balance') {
              if (row.suggestedBidMedian && row.suggestedBidMedian > currentBid) {
                  newBid = row.suggestedBidMedian;
              } else {
                  newBid = currentBid * 1.2; 
              }
              rule = '低曝光 (提價)';
          }
      }
  } 
  else {
      const damping = 0.8;
      newBid = currentBid + (idealBid - currentBid) * damping;

      if (currentAcos > targetAcos) {
          rule = '高 ACOS (降)';
          if (config.mode === 'lower_acos') newBid *= 0.95;
      } else {
          rule = '優異表現 (提)';
          if (config.mode === 'boost_sales') newBid *= 1.1;
      }
  }

  if (placementInfo) {
      const newMod = placementInfo.suggestedModifierTOS;
      if (newMod > 50) {
          const factor = 1 - (newMod / 1000); 
          newBid = newBid * Math.max(0.7, factor);
          rule += ' + 版位平衡';
      }
  }

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
// Main Export (產生結果報表)
// ==========================================
export const generateBidOptimizationPreview = (
    keywords: KeywordMetric[],
    placements: PlacementMetric[],
    config: BidOptimizerConfig
): OptimizationResultRow[] => {
    
    const placementSuggestions = calculatePlacementAdjustment(placements, config);

    // 1. 產生版位建議列 (Placement Rows)
    const placementRows: OptimizationResultRow[] = Object.values(placementSuggestions).flatMap(p => {
        const rows: OptimizationResultRow[] = [];
        
        // 輔助：計算版位指標 (ACOS, CTR...)
        const calcStats = (stats: PlacementMetric | null) => {
             if (!stats) return { imp: 0, clicks: 0, spend: 0, sales: 0, orders: 0, acos: 0, cpc: 0 };
             const acos = stats.sales > 0 ? (stats.spend / stats.sales) * 100 : 0;
             const cpc = stats.clicks > 0 ? stats.spend / stats.clicks : 0;
             return { ...stats, imp: stats.impressions, acos, cpc };
        };

        const tosStats = calcStats(p.statsTOS);
        const ppStats = calcStats(p.statsPP);

        // TOS Suggestion (即使是 0 也顯示)
        rows.push({
            id: `pl-tos-${p.campaignName}`,
            adType: 'SP',
            campaignName: p.campaignName,
            adGroupName: '-',
            entity: 'Placement (Top of Search)',
            targeting: 'Top of Search',
            matchType: '-',
            status: 'ENABLED',
            
            // 填入真實數據
            impressions: tosStats.imp,
            clicks: tosStats.clicks,
            spend: tosStats.spend,
            sales: tosStats.sales,
            orders: tosStats.orders,
            cpc: tosStats.cpc,
            ctr: 0, cvr: 0, roas: 0, cpa: 0, // 其他次要指標先略過
            
            acos: tosStats.acos,

            // 版位出價顯示為 % (在 Table 元件中會處理)
            currentBid: p.statsTOS?.currentModifier || 0,
            suggestedBid: p.suggestedModifierTOS,
            diffPercent: p.suggestedModifierTOS - (p.statsTOS?.currentModifier || 0),
            rule: `${p.action}`,
            targetAcos: config.targetAcos
        });

        // Product Pages Suggestion
        rows.push({
            id: `pl-pp-${p.campaignName}`,
            adType: 'SP',
            campaignName: p.campaignName,
            adGroupName: '-',
            entity: 'Placement (Product Pages)',
            targeting: 'Product Pages',
            matchType: '-',
            status: 'ENABLED',

            // 填入真實數據
            impressions: ppStats.imp,
            clicks: ppStats.clicks,
            spend: ppStats.spend,
            sales: ppStats.sales,
            orders: ppStats.orders,
            cpc: ppStats.cpc,
            ctr: 0, cvr: 0, roas: 0, cpa: 0,

            acos: ppStats.acos,

            currentBid: p.statsPP?.currentModifier || 0,
            suggestedBid: p.suggestedModifierPP,
            diffPercent: p.suggestedModifierPP - (p.statsPP?.currentModifier || 0),
            rule: p.suggestedModifierPP !== (p.statsPP?.currentModifier || 0) ? '優化調整' : '維持',
            targetAcos: config.targetAcos
        });

        return rows;
    });

    // 2. 產生關鍵字建議列 (Keyword Rows)
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

    return [...placementRows, ...keywordRows];
};