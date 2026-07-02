// /*
// Tujuan: Re-export importAffiliateOrdersAction sebagai importAnalyticsAction untuk menjaga backward compatibility.
// Caller: Obsolete references / Test runners
// Dependensi: app/actions/import-orders.ts
// Main Functions: importAnalyticsAction
// Side Effects: None (Re-export only)
// */

import { importAffiliateOrdersAction } from "./import-orders";

export async function importAnalyticsAction(rows: any[], filename: string) {
  return importAffiliateOrdersAction(rows, filename);
}
