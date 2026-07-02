// /*
// Tujuan: Pemrosesan metrik analitik produk berbasis TikTok Orders (agregasi, sales regularity index, dual-scoring, composite multipliers, dan klasifikasi).
// Caller: API routes, Server Actions, data importer, Dashboard UI
// Dependensi: types/index.ts
// Main Functions: recomputeFromOrders, computeOrderBasedStats, computeCompositeScore, classifyProduct, calcWeeklyQuota, generateRecommendation
// Side Effects: Mengembalikan objek data dengan kalkulasi metrik teragregasi.
// */

import { Product, Order, StockHistory } from "@/types";

export interface OrderBasedProductStats {
  totalOrders: number;
  totalItemsSold: number;
  totalRefunded: number;
  netItemsSold: number;
  totalGMV: number;
  totalRevenue: number;
  avgCommissionRate: number;
  avgPrice: number;
  uniqueContentIds: number;
  ordersPerContent: number;
  ordersLast7d: number;
  soldLast7d: number;
  ordersDay8to14: number;
  soldDay8to14: number;
  ordersDay15to21: number;
  soldDay15to21: number;
  ordersOlder: number;
  soldOlder: number;
  daysSinceLastOrder: number;
  salesDaysCount: number;
  totalDaysRange: number;
  salesDensity: number;
  avgGapBetweenSales: number;
  maxGapBetweenSales: number;
  gapStdDev: number;
  regularityScore: number;
  shopAdsOrders: number;
  affiliateOrders: number;
  shopAdsRatio: number;
  isSellerAdvertising: boolean;
  refundRate: number;
  settlementRate: number;
  salesPattern: 'SUSTAINED' | 'MIXED' | 'BURST' | 'NONE';
  // OOS & Effective metrics
  suspended_days: number;
  effective_day_span: number;
  effective_days_since_first: number;
  effective_days_since_last: number;
  orders_post_restock: number;
  days_since_first_content: number;
  total_content_made: number;
}

export function computeOrderBasedStats(
  orders: Order[],
  product?: Product | null,
  stockHistory?: StockHistory[],
  productContents?: any[]
): OrderBasedProductStats {
  const now = Date.now();
  
  // Volume
  const totalOrders = orders.length;
  const totalItemsSold = orders.reduce((sum, o) => sum + (o.items_sold || 0), 0);
  const totalRefunded = orders.reduce((sum, o) => sum + (o.items_refunded || 0), 0);
  const netItemsSold = Math.max(0, totalItemsSold - totalRefunded);
  
  // Revenue & Price
  const totalGMV = orders.reduce((sum, o) => sum + (o.gmv || 0), 0);
  const totalRevenue = orders.reduce((sum, o) => sum + (o.est_commission || 0), 0);
  const avgCommissionRate = totalOrders > 0 
    ? orders.reduce((sum, o) => sum + (o.commission_rate || 0), 0) / totalOrders 
    : 0;
  const avgPrice = totalOrders > 0
    ? orders.reduce((sum, o) => sum + (o.price || 0), 0) / totalOrders
    : 0;
  
  // Content IDs
  const uniqueContents = new Set(orders.map(o => o.content_id).filter(Boolean));
  const uniqueContentIds = uniqueContents.size;
  const ordersPerContent = uniqueContentIds > 0 ? totalOrders / uniqueContentIds : 0;
  
  // Time Windows
  let ordersLast7d = 0;
  let soldLast7d = 0;
  let ordersDay8to14 = 0;
  let soldDay8to14 = 0;
  let ordersDay15to21 = 0;
  let soldDay15to21 = 0;
  let ordersOlder = 0;
  let soldOlder = 0;
  let minDiff = 999;
  
  orders.forEach(o => {
    const orderTime = new Date(o.order_date).getTime();
    const ageDays = Math.max(0, (now - orderTime) / 86400000);
    
    if (ageDays < minDiff) {
      minDiff = ageDays;
    }
    
    if (ageDays <= 7) {
      ordersLast7d++;
      soldLast7d += o.items_sold || 0;
    } else if (ageDays <= 14) {
      ordersDay8to14++;
      soldDay8to14 += o.items_sold || 0;
    } else if (ageDays <= 21) {
      ordersDay15to21++;
      soldDay15to21 += o.items_sold || 0;
    } else {
      ordersOlder++;
      soldOlder += o.items_sold || 0;
    }
  });
  
  const daysSinceLastOrder = minDiff === 999 ? 999 : minDiff;
  
  // Regularity (Metrik Utama)
  const salesDates = Array.from(new Set(
    orders.map(o => {
      const d = new Date(o.order_date);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    })
  )).sort((a, b) => {
    const [da, ma, ya] = a.split('/');
    const [db, mb, yb] = b.split('/');
    return new Date(`${ya}-${ma}-${da}`).getTime() - new Date(`${yb}-${mb}-${db}`).getTime();
  });
  
  const salesDaysCount = salesDates.length;
  let totalDaysRange = 0;
  let salesDensity = 0;
  let avgGapBetweenSales = 0;
  let maxGapBetweenSales = 0;
  let gapStdDev = 0;
  
  if (salesDaysCount >= 2) {
    const [daF, maF, yaF] = salesDates[0].split('/');
    const [daL, maL, yaL] = salesDates[salesDates.length - 1].split('/');
    const firstDate = new Date(`${yaF}-${maF}-${daF}`).getTime();
    const lastDate = new Date(`${yaL}-${maL}-${daL}`).getTime();
    totalDaysRange = Math.max(1, (lastDate - firstDate) / 86400000) + 1;
    
    const gaps: number[] = [];
    for (let i = 1; i < salesDates.length; i++) {
      const [daPrev, maPrev, yaPrev] = salesDates[i - 1].split('/');
      const [daCurr, maCurr, yaCurr] = salesDates[i].split('/');
      const prev = new Date(`${yaPrev}-${maPrev}-${daPrev}`).getTime();
      const curr = new Date(`${yaCurr}-${maCurr}-${daCurr}`).getTime();
      gaps.push((curr - prev) / 86400000);
    }
    
    avgGapBetweenSales = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    maxGapBetweenSales = Math.max(...gaps);
    const meanGap = avgGapBetweenSales;
    const variance = gaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gaps.length;
    gapStdDev = Math.sqrt(variance);
  } else if (salesDaysCount === 1) {
    totalDaysRange = 1;
  }
  
  // Calculate suspended_days
  let suspended_days = 0;
  const history = stockHistory || [];
  const sortedHist = [...history].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
  
  let oosStart: number | null = null;
  for (const h of sortedHist) {
    if (h.status === 'out_of_stock') {
      if (oosStart === null) {
        oosStart = new Date(h.changed_at).getTime();
      }
    } else if (h.status === 'available') {
      if (oosStart !== null) {
        const oosEnd = new Date(h.changed_at).getTime();
        suspended_days += Math.max(0, (oosEnd - oosStart) / 86400000);
        oosStart = null;
      }
    }
  }
  if (product && product.status === 'habis' && product.last_oos_started_at) {
    const oosStartTime = new Date(product.last_oos_started_at).getTime();
    suspended_days += Math.max(0, (now - oosStartTime) / 86400000);
  } else if (oosStart !== null) {
    suspended_days += Math.max(0, (now - oosStart) / 86400000);
  }
  
  // Calculate suspended_days_after_last_order
  let suspended_days_after_last_order = 0;
  if (orders.length > 0) {
    const lastOrderTime = new Date(orders[orders.length - 1].order_date).getTime();
    let oosStartAfterLast: number | null = null;
    for (const h of sortedHist) {
      const changeTime = new Date(h.changed_at).getTime();
      if (changeTime >= lastOrderTime) {
        if (h.status === 'out_of_stock') {
          if (oosStartAfterLast === null) {
            oosStartAfterLast = changeTime;
          }
        } else if (h.status === 'available') {
          if (oosStartAfterLast !== null) {
            const oosEnd = changeTime;
            suspended_days_after_last_order += Math.max(0, (oosEnd - oosStartAfterLast) / 86400000);
            oosStartAfterLast = null;
          }
        }
      }
    }
    if (product && product.status === 'habis' && product.last_oos_started_at) {
      const oosStartTime = new Date(product.last_oos_started_at).getTime();
      const startTime = Math.max(oosStartTime, lastOrderTime);
      if (now > startTime) {
        suspended_days_after_last_order += Math.max(0, (now - startTime) / 86400000);
      }
    } else if (oosStartAfterLast !== null) {
      suspended_days_after_last_order += Math.max(0, (now - oosStartAfterLast) / 86400000);
    }
  }
  
  // Calculate effective_day_span
  const effective_day_span = Math.max(1, totalDaysRange - suspended_days);
  
  // Calculate routineness_score
  let regularityScore = 0;
  if (salesDaysCount >= 1) {
    regularityScore = effective_day_span <= 3 ? 50 : (salesDaysCount / effective_day_span) * 100;
    regularityScore = Math.round(Math.min(100, Math.max(0, regularityScore)));
  }
  
  // Shop Ads
  const shopAdsOrders = orders.filter(o => o.order_type === 'shop_ads').length;
  const affiliateOrders = orders.filter(o => o.order_type === 'affiliate').length;
  const shopAdsRatio = totalOrders > 0 ? shopAdsOrders / totalOrders : 0;
  const isSellerAdvertising = shopAdsRatio > 0.3;
  
  // Health
  const refundRate = totalItemsSold > 0 ? totalRefunded / totalItemsSold : 0;
  const settledOrders = orders.filter(o => o.settlement_status === 'Settled').length;
  const settlementRate = totalOrders > 0 ? settledOrders / totalOrders : 0;
  
  // Pattern
  let salesPattern: 'SUSTAINED' | 'MIXED' | 'BURST' | 'NONE' = 'NONE';
  if (salesDaysCount >= 2) {
    const dayMap: Record<string, number> = {};
    orders.forEach(o => {
      const d = new Date(o.order_date);
      const k = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      dayMap[k] = (dayMap[k] || 0) + (o.items_sold || 0);
    });
    const dailySales = Object.values(dayMap);
    const maxDaySales = Math.max(...dailySales);
    const avgDaySales = dailySales.reduce((s, v) => s + v, 0) / dailySales.length;
    const burstRatio = avgDaySales > 0 ? maxDaySales / avgDaySales : 0;
    
    if (burstRatio > 3) {
      salesPattern = 'BURST';
    } else if (burstRatio > 1.5) {
      salesPattern = 'MIXED';
    } else {
      salesPattern = 'SUSTAINED';
    }
  }
  
  // Calculate contents stats
  let days_since_first_content = 999;
  let total_content_made = productContents ? productContents.length : 0;
  if (productContents && productContents.length > 0) {
    const dates = productContents
      .map(c => new Date(c.tanggal_upload).getTime())
      .filter(Boolean);
    if (dates.length > 0) {
      const minDate = Math.min(...dates);
      days_since_first_content = Math.max(0, (now - minDate) / 86400000);
    }
  }
  
  const effective_days_since_first = days_since_first_content !== 999
    ? Math.max(0, days_since_first_content - suspended_days)
    : 999;
    
  const effective_days_since_last = daysSinceLastOrder !== 999
    ? Math.max(0, daysSinceLastOrder - suspended_days_after_last_order)
    : 999;
    
  // Calculate orders_post_restock
  let orders_post_restock = 0;
  if (product && product.last_oos_ended_at) {
    const restockTime = new Date(product.last_oos_ended_at).getTime();
    orders_post_restock = orders.filter(o => new Date(o.order_date).getTime() >= restockTime).length;
  }
  
  return {
    totalOrders,
    totalItemsSold,
    totalRefunded,
    netItemsSold,
    totalGMV,
    totalRevenue,
    avgCommissionRate,
    avgPrice,
    uniqueContentIds,
    ordersPerContent,
    ordersLast7d,
    soldLast7d,
    ordersDay8to14,
    soldDay8to14,
    ordersDay15to21,
    soldDay15to21,
    ordersOlder,
    soldOlder,
    daysSinceLastOrder,
    salesDaysCount,
    totalDaysRange,
    salesDensity: salesDaysCount >= 2 ? salesDaysCount / effective_day_span : 0,
    avgGapBetweenSales,
    maxGapBetweenSales,
    gapStdDev,
    regularityScore, // routines_score
    shopAdsOrders,
    affiliateOrders,
    shopAdsRatio,
    isSellerAdvertising,
    refundRate,
    settlementRate,
    salesPattern,
    // OOS & Effective metrics
    suspended_days,
    effective_day_span,
    effective_days_since_first,
    effective_days_since_last,
    orders_post_restock,
    days_since_first_content,
    total_content_made
  };
}

export function computeCompositeScore(
  arg1: OrderBasedProductStats | Product,
  arg2?: any
): number {
  if (arg2 !== undefined) {
    return (arg2 as any).regularityScore || 0;
  }
  const stats = arg1 as OrderBasedProductStats;
  const routineness_score = stats.regularityScore;
  
  let routineness_points = 0;
  if (routineness_score >= 75) routineness_points = 30;
  else if (routineness_score >= 50) routineness_points = 22;
  else if (routineness_score >= 30) routineness_points = 14;
  else if (routineness_score >= 10) routineness_points = 6;
  
  let volume_points = 0;
  if (stats.totalOrders >= 100) volume_points = 25;
  else if (stats.totalOrders >= 50) volume_points = 20;
  else if (stats.totalOrders >= 20) volume_points = 15;
  else if (stats.totalOrders >= 10) volume_points = 10;
  else if (stats.totalOrders >= 5) volume_points = 6;
  else if (stats.totalOrders >= 1) volume_points = 3;
  
  let gmv_points = 0;
  const shopads_pct = stats.shopAdsRatio * 100;
  if (stats.totalOrders > 0) {
    if (shopads_pct >= 90) gmv_points = 25;
    else if (shopads_pct >= 70) gmv_points = 20;
    else if (shopads_pct >= 50) gmv_points = 14;
    else if (shopads_pct >= 30) gmv_points = 8;
    else gmv_points = 3;
  }
  
  let trend_points = 0;
  const order_trend = 
    stats.ordersLast7d > stats.ordersDay8to14 * 1.2 ? "growing" :
    stats.ordersLast7d < stats.ordersDay8to14 * 0.8 ? "declining" :
    stats.ordersLast7d === 0 && stats.ordersDay8to14 === 0 ? "dead" : "stable";

  if (stats.days_since_first_content <= 7) {
    trend_points = 12;
  } else {
    if (order_trend === "growing") trend_points = 20;
    else if (order_trend === "stable") trend_points = 14;
    else if (order_trend === "declining") trend_points = 5;
    else trend_points = 0;
  }
  
  // Stagnation penalty
  let stagnasi_penalty = 0;
  if (stats.effective_days_since_first > 14 && stats.totalOrders === 0) {
    stagnasi_penalty = Math.min(20, (stats.effective_days_since_first - 14) * 1.5);
  }
  
  if (stats.effective_days_since_last > 21 && stats.ordersLast7d === 0) {
    stagnasi_penalty += 10;
  }
  
  return Math.round(Math.max(0, Math.min(100, 
    routineness_points + volume_points + gmv_points + trend_points - stagnasi_penalty
  )));
}

export function classifyProduct(
  stats: OrderBasedProductStats,
  compositeScore: number,
  product?: Product | null
): 'COLLABORATION' | 'RESTOCK_CONFIRMED' | 'PROVEN_WINNER' | 'GMV_ACTIVE' | 'RESTOCK_RECOVERY' | 'GROWING' | 'EARLY_STAGE' | 'MONITOR' | 'SPIKE_ONLY' | 'STAGNANT' | 'DECLINING' {
  const now = Date.now();
  const TODAY = now;
  
  // 1. COLLABORATION (override tertinggi)
  if (product && product.is_kerjasama) {
    const deadline = product.kerjasama_deadline ? new Date(product.kerjasama_deadline).getTime() : null;
    const target = product.kerjasama_target || 0;
    const made = stats.total_content_made;
    if (!deadline || (deadline >= TODAY && made < target)) {
      return 'COLLABORATION';
    }
  }
  
  // 2. RESTOCK_CONFIRMED
  if (product && product.last_oos_ended_at && product.pre_oos_classification) {
    const restockTime = new Date(product.last_oos_ended_at).getTime();
    const daysSinceRestock = (now - restockTime) / 86400000;
    if (daysSinceRestock <= 14 && stats.orders_post_restock >= 1) {
      if (['PROVEN_WINNER', 'GMV_ACTIVE'].includes(product.pre_oos_classification)) {
        return product.pre_oos_classification as any;
      }
    }
  }
  
  // 3. PROVEN_WINNER
  if (compositeScore >= 60 && stats.regularityScore >= 50 && stats.totalOrders >= 10) {
    return 'PROVEN_WINNER';
  }
  
  // 4. GMV_ACTIVE
  if (compositeScore >= 35 && stats.shopAdsRatio * 100 >= 70 && stats.totalOrders >= 3) {
    return 'GMV_ACTIVE';
  }
  
  // 5. RESTOCK_RECOVERY
  if (product && product.last_oos_ended_at && product.pre_oos_classification) {
    const restockTime = new Date(product.last_oos_ended_at).getTime();
    const daysSinceRestock = (now - restockTime) / 86400000;
    if (daysSinceRestock <= 7 && stats.orders_post_restock === 0) {
      return 'RESTOCK_RECOVERY';
    }
  }
  
  // 6. GROWING
  const order_trend = 
    stats.ordersLast7d > stats.ordersDay8to14 * 1.2 ? "growing" :
    stats.ordersLast7d < stats.ordersDay8to14 * 0.8 ? "declining" :
    stats.ordersLast7d === 0 && stats.ordersDay8to14 === 0 ? "dead" : "stable";
    
  if (order_trend === 'growing' && stats.totalOrders >= 3) {
    return 'GROWING';
  }
  
  // 7. EARLY_STAGE
  if (stats.days_since_first_content <= 14 && stats.total_content_made <= 10) {
    return 'EARLY_STAGE';
  }
  
  // 8. MONITOR
  if (compositeScore >= 15) {
    return 'MONITOR';
  }
  
  // 9. SPIKE_ONLY
  if (stats.totalOrders >= 5 && stats.regularityScore < 25 && stats.salesDaysCount <= 3) {
    return 'SPIKE_ONLY';
  }
  
  // 10. STAGNANT
  const lastOosEndedTime = product && product.last_oos_ended_at ? new Date(product.last_oos_ended_at).getTime() : null;
  const isWithinRecovery = lastOosEndedTime && ((now - lastOosEndedTime) / 86400000 <= 7);
  if (stats.effective_days_since_first > 14 && stats.totalOrders === 0) {
    if (!isWithinRecovery) {
      return 'STAGNANT';
    }
  }
  
  // 11. DECLINING
  if (order_trend === 'declining' && stats.effective_days_since_last > 14) {
    if (!isWithinRecovery) {
      return 'DECLINING';
    }
  }
  
  return 'MONITOR';
}

export function calcWeeklyQuota(
  klasifikasi: 'COLLABORATION' | 'RESTOCK_CONFIRMED' | 'PROVEN_WINNER' | 'GMV_ACTIVE' | 'RESTOCK_RECOVERY' | 'GROWING' | 'EARLY_STAGE' | 'MONITOR' | 'SPIKE_ONLY' | 'STAGNANT' | 'DECLINING',
  compositeScore: number,
  isKerjasama: boolean,
  kerjasamaTarget: number
): number {
  if (isKerjasama && kerjasamaTarget > 0) {
    return kerjasamaTarget;
  }
  
  switch (klasifikasi) {
    case 'PROVEN_WINNER':
      return compositeScore >= 70 ? 5 : 3;
    case 'GMV_ACTIVE':
    case 'RESTOCK_CONFIRMED':
      return 3;
    case 'GROWING':
    case 'EARLY_STAGE':
    case 'RESTOCK_RECOVERY':
      return 2;
    case 'MONITOR':
    case 'SPIKE_ONLY':
    case 'DECLINING':
      return 1;
    case 'STAGNANT':
      return 0;
    default:
      return 1;
  }
}

export function generateRecommendation(
  klasifikasi: 'COLLABORATION' | 'RESTOCK_CONFIRMED' | 'PROVEN_WINNER' | 'GMV_ACTIVE' | 'RESTOCK_RECOVERY' | 'GROWING' | 'EARLY_STAGE' | 'MONITOR' | 'SPIKE_ONLY' | 'STAGNANT' | 'DECLINING',
  stats: OrderBasedProductStats
): string {
  switch (klasifikasi) {
    case 'COLLABORATION':
      return "Produk kerjasama aktif. Buat konten sesuai target dan deadline kerjasama.";
    case 'PROVEN_WINNER':
      if (stats.isSellerAdvertising) {
        return "Seller aktif beriklan (GMV Max). Perbanyak variasi konten untuk memperbesar peluang kesambar iklan.";
      }
      return "Produk proven. Tingkatkan kuota posting untuk memaksimalkan revenue.";
    case 'GMV_ACTIVE':
      return "Seller sangat aktif GMV Max dan produk menghasilkan order. Prioritaskan konten.";
    case 'RESTOCK_CONFIRMED':
      return "Produk terbukti aktif kembali pasca restock. Lanjutkan distribusi konten.";
    case 'RESTOCK_RECOVERY':
      return "Produk baru saja restock, belum ada order. Buat konten untuk memicu kembali traffic.";
    case 'GROWING':
      return "Tren penjualan meningkat. Dorong kuota konten untuk mengakselerasi pertumbuhan.";
    case 'EARLY_STAGE':
      return "Produk baru. Buat 2 konten evaluasi minggu ini.";
    case 'MONITOR':
      return "Performa stabil/sedang. Pantau tren penjualan secara berkala.";
    case 'SPIKE_ONLY':
      return "Order tidak rutin dan terpusat di hari tertentu. Buat konten berkala.";
    case 'STAGNANT':
      return "Tidak produktif setelah waktu evaluasi. Hentikan pembuatan konten dan alihkan ke produk lain.";
    case 'DECLINING':
      return `Sudah ${Math.round(stats.daysSinceLastOrder)} hari tanpa order (efektif). Batasi kuota konten.`;
    default:
      return "Analisa performa produk.";
  }
}

// compatibility wrappers
export function recomputeFromOrders(
  products: Product[],
  orders: Order[]
): Record<string, OrderBasedProductStats> {
  const statsMap: Record<string, OrderBasedProductStats> = {};
  
  // Inisialisasi default stats
  products.forEach(p => {
    const productOrders = orders.filter(o => o.product_id === p.id);
    statsMap[p.id] = computeOrderBasedStats(productOrders);
  });
  
  return statsMap;
}

// Compatibility wrapper for old recomputeProductStats (migrates contents/snapshots to dummy orders to avoid breakages in legacy modules)
export function recomputeProductStats(
  products: Product[],
  contents: any[]
): Record<string, any> {
  // Map contents back to order shape for scoring engine
  const dummyOrders: Order[] = [];
  
  contents.forEach(c => {
    if (c.items_sold > 0) {
      for (let i = 0; i < c.items_sold; i++) {
        dummyOrders.push({
          id: `dummy_${c.id}_${i}`,
          user_id: c.user_id,
          tiktok_order_id: `dummy_order_${c.id}_${i}`,
          product_id: c.product_id,
          content_id: c.id,
          sku_id: null,
          product_name: null,
          items_sold: 1,
          items_refunded: 0,
          price: c.gmv / c.items_sold,
          gmv: c.gmv / c.items_sold,
          order_type: 'affiliate',
          settlement_status: 'Settled',
          commission_rate: 10,
          est_commission: c.est_komisi / c.items_sold,
          actual_commission: c.est_komisi / c.items_sold,
          total_final_earned: c.est_komisi / c.items_sold,
          shop_name: null,
          shop_code: null,
          order_date: c.tanggal_upload || new Date().toISOString(),
          settlement_date: null,
          created_at: new Date().toISOString()
        });
      }
    }
  });

  const stats = recomputeFromOrders(products, dummyOrders);
  // Map back compatibility keys
  const compatStats: Record<string, any> = {};
  Object.entries(stats).forEach(([k, v]) => {
    compatStats[k] = {
      ...v,
      nVideo: v.uniqueContentIds,
      spreadDays: v.salesDaysCount,
      maxViews: 0,
      avgViews: 0,
      avgCTR: 0,
      avgCTOR: 0,
      effectiveSold: v.netItemsSold,
      recentSold: v.soldLast7d,
      daysSinceLastSale: v.daysSinceLastOrder,
      daysSinceLastContent: 999,
      periodsWithSale: 0,
      latestPeriodSold: v.soldLast7d,
      prevPeriodSold: v.soldDay8to14,
      olderPeriodsSold: v.soldDay15to21 + v.soldOlder,
      bestDays: [],
      bestHours: []
    };
  });
  return compatStats;
}

export function scoreBenchmark(
  products: Product[],
  statsMap: Record<string, any>
): void {
  products.forEach(p => {
    const s = statsMap[p.id];
    if (s) {
      p.bench_score = s.regularityScore || 0;
    }
  });
}

export function scoreTOPSIS(
  products: Product[],
  statsMap: Record<string, any>
): void {
  products.forEach(p => {
    const s = statsMap[p.id];
    if (s) {
      p.topsis_score = (s.regularityScore || 0) / 100;
    }
  });
}

// computeCompositeScore is overloaded above

export function classifyP(
  p: Product,
  stats: any,
  mode: any
): 'COLLABORATION' | 'RESTOCK_CONFIRMED' | 'PROVEN_WINNER' | 'GMV_ACTIVE' | 'RESTOCK_RECOVERY' | 'GROWING' | 'EARLY_STAGE' | 'MONITOR' | 'SPIKE_ONLY' | 'STAGNANT' | 'DECLINING' {
  const compositeScore = p.score_mode === 'topsis' ? p.topsis_score * 100 : p.bench_score;
  return classifyProduct(stats, compositeScore, p);
}

export function slotR(klas: 'COLLABORATION' | 'RESTOCK_CONFIRMED' | 'PROVEN_WINNER' | 'GMV_ACTIVE' | 'RESTOCK_RECOVERY' | 'GROWING' | 'EARLY_STAGE' | 'MONITOR' | 'SPIKE_ONLY' | 'STAGNANT' | 'DECLINING'): string {
  switch (klas) {
    case 'COLLABORATION':
    case 'PROVEN_WINNER':
    case 'RESTOCK_CONFIRMED':
    case 'GMV_ACTIVE':
      return "18:00/20:00"; // Prime
    case 'GROWING':
    case 'MONITOR':
      return "10:00/12:00"; // Regular
    case 'EARLY_STAGE':
    case 'RESTOCK_RECOVERY':
      return "06:30/09:00"; // Testing
    case 'SPIKE_ONLY':
    case 'DECLINING':
      return "10:00"; // Regular single
    case 'STAGNANT':
      return "—";
    default:
      return "—";
  }
}
