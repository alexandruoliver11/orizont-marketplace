import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "node:crypto"

/**
 * EuPlătesc HMAC-MD5 helper – same algorithm as in payment-url/route.ts.
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

/**
 * IPN (Instant Payment Notification) fields sent by EuPlătesc.
 * https://www.euplatesc.ro/docs/standard/
 */
type IpnBody = {
  amount?: string
  curr?: string
  invoice_id?: string  // our cart_id
  ep_id?: string       // EuPlătesc transaction ID
  merch_id?: string
  action?: string      // "0" = approved, else rejected
  message?: string
  approval?: string    // approval code (set on success)
  timestamp?: string
  nonce?: string
  fp_hash?: string
}

/**
 * POST /store/euplatesc/ipn
 *
 * EuPlătesc calls this URL server-to-server after every payment attempt.
 * We verify the HMAC signature and acknowledge with the required response.
 *
 * Required response format:
 *   <EPAYMENT>YYYYMMDDHHMMSS|OK</EPAYMENT>   (on success)
 *   <EPAYMENT>YYYYMMDDHHMMSS|ERROR</EPAYMENT> (on error)
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const key = process.env.EUPLATESC_KEY

  if (!key) {
    console.error("[EuPlătesc IPN] EUPLATESC_KEY nu este configurat.")
    const ts = new Date().toISOString().replace(/[-T:]/g, "").slice(0, 14)
    res.setHeader("Content-Type", "text/plain")
    return res.status(200).send(`<EPAYMENT>${ts}|ERROR</EPAYMENT>`)
  }

  const body = (req.body ?? {}) as IpnBody

  const {
    amount,
    curr,
    invoice_id,
    ep_id,
    merch_id,
    action,
    message,
    approval,
    timestamp,
    nonce,
    fp_hash: receivedHash,
  } = body

  // ── Verify HMAC ────────────────────────────────────────────────────────────
  // IPN hash covers these 10 fields in this order:
  const expectedHash = epHash(
    [amount, curr, invoice_id, ep_id, merch_id, action, message, approval, timestamp, nonce],
    key
  )

  const ts = new Date().toISOString().replace(/[-T:]/g, "").slice(0, 14)
  res.setHeader("Content-Type", "text/plain")

  if (receivedHash !== expectedHash) {
    console.warn("[EuPlătesc IPN] Semnătură invalidă. invoice_id:", invoice_id)
    return res.status(200).send(`<EPAYMENT>${ts}|ERROR</EPAYMENT>`)
  }

  if (action === "0") {
    // ── Payment approved ────────────────────────────────────────────────────
    console.log(
      `[EuPlătesc IPN] Plată aprobată. invoice_id=${invoice_id} ep_id=${ep_id} amount=${amount} ${curr}`
    )
    // The storefront success page is responsible for completing the Medusa order.
    // The IPN is a server-side confirmation that the payment was captured by EuPlătesc.
    // You can optionally update the Medusa payment session status here using the
    // payment module if you have an EuPlătesc payment provider registered.
  } else {
    console.warn(
      `[EuPlătesc IPN] Plată respinsă. invoice_id=${invoice_id} action=${action} message=${message}`
    )
  }

  // EuPlătesc expects exactly this format to acknowledge receipt
  return res.status(200).send(`<EPAYMENT>${ts}|OK</EPAYMENT>`)
}
