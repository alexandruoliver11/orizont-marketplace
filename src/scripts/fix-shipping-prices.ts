/**
 * Ensures there is exactly ONE "Livrare Standard" shipping option at 25 RON
 * and ONE "Ridicare Personală" option at 0 RON. Removes duplicates and fixes prices.
 *
 * Run with:
 *   cd orizont-marketplace
 *   npx medusa exec src/scripts/fix-shipping-prices.ts
 *
 * Use this when:
 *  - "Livrare Standard" shows 0 RON instead of 25 RON
 *  - There are duplicate shipping options
 *  - The shipping option exists but was created with wrong/missing prices
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const SHIPPING_PRICES: Record<string, number> = {
  "Livrare Standard": 25,
  "Ridicare Personală": 0,
}

export default async function fixShippingPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const pricingService = container.resolve(Modules.PRICING)
  const regionService = container.resolve(Modules.REGION)

  // ── Resolve region ──────────────────────────────────────────────────────────
  const allRegions = await regionService.listRegions({})
  const region = allRegions.find((r: any) => r.name === "Romania") ?? allRegions[0]

  if (!region) {
    logger.error("No region found. Run setup-orizont.ts first.")
    return
  }
  logger.info(`Using region: "${region.name}" (${region.id})`)

  // ── Load ALL shipping options ───────────────────────────────────────────────
  const allOptions = await fulfillmentService.listShippingOptions(
    {},
    { select: ["id", "name", "price_set_id"] } as any
  )

  logger.info(`\nFound ${allOptions.length} shipping option(s) total:`)
  allOptions.forEach((o: any) => logger.info(`  • "${o.name}" (${o.id}) price_set_id=${o.price_set_id ?? "MISSING"}`))

  // ── Deduplicate: keep only one per name, delete the rest ───────────────────
  const seen = new Map<string, any>()
  const toDelete: string[] = []

  for (const option of allOptions) {
    const name: string = option.name ?? ""
    if (!seen.has(name)) {
      seen.set(name, option)
    } else {
      // Prefer keeping the one that has a price_set_id
      const existing = seen.get(name)!
      if (!(existing as any).price_set_id && (option as any).price_set_id) {
        toDelete.push(existing.id)
        seen.set(name, option)
      } else {
        toDelete.push(option.id)
      }
    }
  }

  if (toDelete.length > 0) {
    logger.info(`\nRemoving ${toDelete.length} duplicate shipping option(s)…`)
    await fulfillmentService.deleteShippingOptions(toDelete)
    logger.info("  → Duplicates removed.")
  } else {
    logger.info("\nNo duplicates found.")
  }

  // ── Fix prices on the canonical options ────────────────────────────────────
  for (const [name, targetAmount] of Object.entries(SHIPPING_PRICES)) {
    const option = seen.get(name) as any

    if (!option) {
      logger.warn(`\n"${name}" not found — skipping. Run setup-orizont.ts to create it.`)
      continue
    }

    const priceSetId = option.price_set_id

    logger.info(`\n── "${name}"`)
    logger.info(`   Target price : ${targetAmount} RON`)
    logger.info(`   Price set ID : ${priceSetId ?? "MISSING"}`)

    if (!priceSetId) {
      logger.warn(
        "   No price_set_id on this option. " +
        "Delete the option in Medusa Admin and re-run setup-orizont.ts to recreate it correctly."
      )
      continue
    }

    // Get current prices so we can report and remove them
    const [priceSet] = await pricingService.listPriceSets(
      { id: [priceSetId] },
      { relations: ["prices"] }
    )

    const currentPrices = priceSet?.prices ?? []
    logger.info(
      `   Current prices: ${
        currentPrices.length
          ? currentPrices.map((p: any) => `${p.amount} ${p.currency_code}`).join(", ")
          : "none"
      }`
    )

    // Remove ALL existing prices (prevents duplicates / wrong values)
    if (currentPrices.length > 0) {
      await pricingService.removePrices(currentPrices.map((p: any) => p.id))
      logger.info(`   Removed ${currentPrices.length} old price(s)`)
    }

    // Add correct prices (currency fallback + region-specific)
    await pricingService.addPrices([
      {
        priceSetId,
        prices: [
          {
            currency_code: "ron",
            amount: targetAmount,
            rules: {},
          },
          {
            currency_code: "ron",
            amount: targetAmount,
            rules: { region_id: region.id },
          },
        ],
      },
    ])

    logger.info(`   ✓ Price reset to ${targetAmount} RON`)
  }

  logger.info("\n✓ Done. Restart the server and test checkout again.")
  logger.info("  Livrare Standard : 25 RON")
  logger.info("  Ridicare Personală:  0 RON")
}
