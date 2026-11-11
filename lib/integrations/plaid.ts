/**
 * Plaid adapter — STUB, only shown when PLAID_ENABLED=1.
 *
 * TODO to make this real:
 *  1. Create a Plaid account and get PLAID_CLIENT_ID / PLAID_SECRET (sandbox first).
 *  2. Add a route that creates a link_token (POST /link/token/create) and use Plaid Link
 *     (react-plaid-link) in the browser to get a public_token.
 *  3. Exchange it server-side for an access_token (/item/public_token/exchange) and store it
 *     encrypted in integration_tokens (same as Strava).
 *  4. Use /transactions/sync to pull transactions, then reuse mapBankCsv-style mapping
 *     (date, amount, category) to create entries for a savings metric.
 *  5. Add a webhook route for TRANSACTIONS updates.
 */
import type { IntegrationAdapter } from "./types";

export const plaidAdapter: IntegrationAdapter<never, never> = {
  id: "plaid",
  name: "Plaid (bank sync)",
  description: "Automatic bank sync. Not implemented yet — use Bank CSV import for now.",
  isEnabled: (f) => f.plaid,
  async connect() {
    throw new Error("Plaid is a stub. See lib/integrations/plaid.ts for what's needed.");
  },
  async sync() {
    return [];
  },
  mapToMetrics: () => [],
};
