import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "node:crypto"

// EuPlătesc gateway URL
// Production: https://secure.euplatesc.ro/tdsprocess/tranzactd.php
// The same URL handles both test and live – test mode is determined by your merchant credentials.
const EP_GATEWAY_URL =
  "https://secure.euplatesc.ro/tdsprocess/tranzactd.php"

/**
 * Builds the EuPlătesc fp_hash (HMAC-MD5).
 *
 * For each field value v:
 *   – empty / null → "0"
 *   – otherwise    → `${v.length}${v}`
 * All field strings are concatenated, then HMAC-MD5'd with the HMAC key.
 */
function epHash(
  fields: (string | null | undefined)[],
  hmacKey: string
): string {
  const data = fields
    .map((v) => (v == null || v === "" ? "0" : `${v.length}${v}`))
    .join("")
  return crypto
    .createHmac("md5", Buffer.from(hmacKey, "utf8"))
    .update(data)
    .digest("hex")
}

/** YYYYMMDDHHMMSS in UTC */
function epTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-T:]/g, "")
    .slice(0, 14)
}

type RequestBody = {
  cart_id?: string
  /** Cart total in RON (full units, not bani). Provided by the storefront. */
  total?: number
  country_code?: string
}

/**
 * POST /store/euplatesc/payment-url
 *
 * Generates the EuPlătesc payment form fields required to redirect the customer
 * to the EuPlătesc secure payment page.
 *
 * Required env vars:
 *   EUPLATESC_MID   – merchant ID (merch_id)
 *   EUPLATESC_KEY   – HMAC-MD5 secret key
 *   EUPLATESC_SANDBOX – set to "false" for production (defaults to test mode)
 *
 * Request body: { cart_id, total, country_code }
 * Response:     { action_url, form_fields }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { cart_id, total, country_code = "ro" } = (req.body ?? {}) as RequestBody

    if (!cart_id) {
      return res.status(400).json({ error: "cart_id este obligatoriu" })
    }
    if (total == null || isNaN(Number(total)) || Number(total) <= 0) {
      return res.status(400).json({ error: "total trebuie să fie un număr pozitiv" })
    }

    const mid = process.env.EUPLATESC_MID
    const key = process.env.EUPLATESC_KEY
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:8000"

    if (!mid || !key) {
      console.error("[EuPlătesc] EUPLATESC_MID sau EUPLATESC_KEY nu sunt configurate.")
      return res
        .status(500)
        .json({ error: "Credențialele EuPlătesc nu sunt configurate." })
    }

    // ── Build payment fields ────────────────────────────────────────────────
    const amount = Number(total).toFixed(2)   // e.g. "125.90"
    const curr = "RON"
    const invoice_id = cart_id                 // max 64 chars
    const order_desc = `Comanda Orizont`       // max 255 chars
    const merch_id = mid
    const timestamp = epTimestamp()
    const nonce = crypto.randomBytes(16).toString("hex") // 32 hex chars

    const back_ref = `${baseUrl}/${country_code}/checkout/euplatesc/success?cart_id=${encodeURIComponent(cart_id)}`
    const cancel_back_ref = `${baseUrl}/${country_code}/checkout/euplatesc/fail?cart_id=${encodeURIComponent(cart_id)}`

    // Hash covers exactly these 7 fields in this order
    const fp_hash = epHash(
      [amount, curr, invoice_id, order_desc, merch_id, timestamp, nonce],
      key
    )

    return res.json({
      action_url: EP_GATEWAY_URL,
      form_fields: {
        amount,
        curr,
        invoice_id,
        order_desc,
        merch_id,
        timestamp,
        nonce,
        fp_hash,
        back_ref,
        cancel_back_ref,
      },
    })
  } catch (err: any) {
    console.error("[EuPlătesc] Eroare la generarea URL-ului de plată:", err)
    return res.status(500).json({ error: err?.message ?? "Eroare internă" })
  }
}
