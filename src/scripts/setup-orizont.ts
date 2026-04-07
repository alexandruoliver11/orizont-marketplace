/**
 * Orizont – full backend setup script
 *
 * Run once (safe to re-run – idempotent):
 *   cd orizont-marketplace
 *   npx medusa exec src/scripts/setup-orizont.ts
 *
 * What this does:
 *  1. Adds RON to the store's supported currencies
 *  2. Creates the "Romania" region (RON, country RO, manual payment provider)
 *  3. Creates a Romania tax region
 *  4. Creates / reuses the "Default" shipping profile
 *  5. Creates the "Magazin Orizont" stock location
 *  6. Attaches the manual fulfillment provider to the location
 *  7. Creates two fulfillment sets:
 *       • "Livrare Orizont"           type: shipping
 *       • "Ridicare Personală Orizont" type: pickup
 *  8. Creates service zones for Romania inside each set
 *  9. Creates two shipping options with RON prices:
 *       • Livrare Standard     – 25 RON
 *       • Ridicare Personală   –  0 RON (free)
 * 10. Assigns the Default shipping profile to every existing product
 * 11. Links all existing inventory items to the stock location (stocked: 1 000 000)
 * 12. Links the stock location to the default sales channel
 */

import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  updateShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateProductsWorkflow,
  updateStoresWorkflow,
  createInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function setupOrizont({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const regionModuleService = container.resolve(Modules.REGION)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const storeModuleService = container.resolve(Modules.STORE)
  const taxModuleService = container.resolve(Modules.TAX)
  const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION)

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Store – add RON to supported currencies
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[1/12] Updating store to support RON…")

  // listStores() does NOT join relations — use query.graph to get currencies
  const { data: storeList } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code", "supported_currencies.is_default"],
  })
  const store = storeList[0] as {
    id: string
    supported_currencies: { currency_code: string; is_default: boolean }[]
  }

  const existingCurrencies = store.supported_currencies ?? []
  const hasRon = existingCurrencies.some((c) => c.currency_code === "ron")

  if (!hasRon) {
    // Build the new list; if nothing is currently default, make the first one default
    const hasDefault = existingCurrencies.some((c) => c.is_default)
    const normalized = existingCurrencies.map((c, i) => ({
      currency_code: c.currency_code,
      is_default: hasDefault ? c.is_default : i === 0,
    }))
    // If still nothing is default (empty list), RON becomes the default
    const ronIsDefault = !normalized.some((c) => c.is_default)
    normalized.push({ currency_code: "ron", is_default: ronIsDefault })

    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: { supported_currencies: normalized },
      },
    })
    logger.info("  → RON added to store currencies.")
  } else {
    logger.info("  → RON already present, skipping.")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Romania region
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[2/12] Creating Romania region…")
  const existingRegions = await regionModuleService.listRegions({ name: "Romania" })
  let region = existingRegions[0] ?? null

  if (!region) {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Romania",
            currency_code: "ron",
            countries: ["ro"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = regionResult[0]
    logger.info("  → Romania region created.")
  } else {
    logger.info("  → Romania region already exists, skipping.")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Tax region for Romania
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[3/12] Creating Romania tax region…")
  const existingTaxRegions = await taxModuleService.listTaxRegions({
    country_code: "ro",
  })

  if (!existingTaxRegions.length) {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "ro", provider_id: "tp_system" }],
    })
    logger.info("  → Romania tax region created.")
  } else {
    logger.info("  → Romania tax region already exists, skipping.")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Default shipping profile
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[4/12] Ensuring Default shipping profile…")
  const existingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  let shippingProfile = existingProfiles[0] ?? null

  if (!shippingProfile) {
    const { result: profileResult } = await createShippingProfilesWorkflow(
      container
    ).run({
      input: {
        data: [{ name: "Default", type: "default" }],
      },
    })
    shippingProfile = profileResult[0]
    logger.info("  → Default shipping profile created.")
  } else {
    logger.info(`  → Using existing profile: ${shippingProfile.name}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Stock location
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[5/12] Creating stock location…")
  const existingLocations = await stockLocationModuleService.listStockLocations({
    name: "Magazin Orizont",
  })
  let stockLocation = existingLocations[0] ?? null

  if (!stockLocation) {
    const { result: locationResult } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: "Magazin Orizont",
            address: {
              address_1: "Strada Exemplu nr. 1",
              city: "București",
              country_code: "RO",
              postal_code: "010000",
            },
          },
        ],
      },
    })
    stockLocation = locationResult[0]
    logger.info("  → Stock location created.")
  } else {
    logger.info("  → Stock location already exists, skipping.")
  }

  // Update store's default location
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_location_id: stockLocation.id },
    },
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Link manual fulfillment provider → stock location
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[6/12] Linking manual fulfillment provider to stock location…")
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
    logger.info("  → Provider linked.")
  } catch {
    logger.info("  → Already linked, skipping.")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7 & 8. Fulfillment sets + service zones
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[7/12] Creating fulfillment sets and service zones…")

  // Check if our fulfillment sets already exist
  const allFulfillmentSets = await fulfillmentModuleService.listFulfillmentSets({
    name: ["Livrare Orizont", "Ridicare Personală Orizont"],
  })

  const deliverySetExists = allFulfillmentSets.some(
    (fs) => fs.name === "Livrare Orizont"
  )
  const pickupSetExists = allFulfillmentSets.some(
    (fs) => fs.name === "Ridicare Personală Orizont"
  )

  let deliverySet = allFulfillmentSets.find((fs) => fs.name === "Livrare Orizont") ?? null
  let pickupSet = allFulfillmentSets.find((fs) => fs.name === "Ridicare Personală Orizont") ?? null

  if (!deliverySetExists) {
    deliverySet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Livrare Orizont",
      type: "shipping",
      service_zones: [
        {
          name: "Romania – Livrare",
          geo_zones: [{ country_code: "ro", type: "country" }],
        },
      ],
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: deliverySet.id },
    })
    logger.info("  → Delivery fulfillment set created and linked.")
  } else {
    logger.info("  → Delivery fulfillment set already exists, skipping.")
  }

  if (!pickupSetExists) {
    pickupSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Ridicare Personală Orizont",
      type: "pickup",
      service_zones: [
        {
          name: "Romania – Ridicare",
          geo_zones: [{ country_code: "ro", type: "country" }],
        },
      ],
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: pickupSet.id },
    })
    logger.info("  → Pickup fulfillment set created and linked.")
  } else {
    logger.info("  → Pickup fulfillment set already exists, skipping.")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Shipping options
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[9/12] Creating shipping options…")

  const existingShippingOptions =
    await fulfillmentModuleService.listShippingOptions({
      name: ["Livrare Standard", "Ridicare Personală"],
    })

  const existingDelivery = existingShippingOptions.find((o) => o.name === "Livrare Standard")
  const existingPickup  = existingShippingOptions.find((o) => o.name === "Ridicare Personală")

  const optionsToCreate: any[] = []
  const optionsToUpdate: any[] = []

  if (!existingDelivery && deliverySet) {
    const freshDeliverySet = await fulfillmentModuleService.retrieveFulfillmentSet(
      deliverySet.id,
      { relations: ["service_zones"] }
    )
    optionsToCreate.push({
      name: "Livrare Standard",
      price_type: "flat",
      provider_id: "manual_manual",
      service_zone_id: freshDeliverySet.service_zones[0].id,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Standard",
        description: "Livrare în 2-5 zile lucrătoare.",
        code: "standard",
      },
      prices: [
        { currency_code: "ron", amount: 25 },
        { region_id: region.id, amount: 25 },
      ],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" },
        { attribute: "is_return", value: "false", operator: "eq" },
      ],
    })
  } else if (existingDelivery) {
    // Ensure prices are set even if the option was created without them
    optionsToUpdate.push({
      id: existingDelivery.id,
      prices: [
        { currency_code: "ron", amount: 25 },
        { region_id: region.id, amount: 25 },
      ],
    })
  }

  if (!existingPickup && pickupSet) {
    const freshPickupSet = await fulfillmentModuleService.retrieveFulfillmentSet(
      pickupSet.id,
      { relations: ["service_zones"] }
    )
    optionsToCreate.push({
      name: "Ridicare Personală",
      price_type: "flat",
      provider_id: "manual_manual",
      service_zone_id: freshPickupSet.service_zones[0].id,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Ridicare din magazin",
        description: "Ridici comanda din magazinul nostru – gratuit.",
        code: "pickup",
      },
      prices: [
        { currency_code: "ron", amount: 0 },
        { region_id: region.id, amount: 0 },
      ],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" },
        { attribute: "is_return", value: "false", operator: "eq" },
      ],
    })
  } else if (existingPickup) {
    optionsToUpdate.push({
      id: existingPickup.id,
      prices: [
        { currency_code: "ron", amount: 0 },
        { region_id: region.id, amount: 0 },
      ],
    })
  }

  if (optionsToCreate.length > 0) {
    await createShippingOptionsWorkflow(container).run({ input: optionsToCreate })
    logger.info(`  → Created ${optionsToCreate.length} shipping option(s).`)
  }

  if (optionsToUpdate.length > 0) {
    await updateShippingOptionsWorkflow(container).run({ input: optionsToUpdate })
    logger.info(`  → Updated prices on ${optionsToUpdate.length} existing shipping option(s).`)
  }

  if (optionsToCreate.length === 0 && optionsToUpdate.length === 0) {
    logger.info("  → All shipping options already exist and were updated.")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Assign Default shipping profile to every existing product
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[10/12] Assigning shipping profile to all products…")

  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id", "title", "shipping_profile_id"],
  })

  const productsNeedingProfile = allProducts.filter(
    (p: any) => !p.shipping_profile_id || p.shipping_profile_id !== shippingProfile.id
  )

  if (productsNeedingProfile.length > 0) {
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: productsNeedingProfile.map((p: any) => p.id) },
        update: { shipping_profile_id: shippingProfile.id },
      },
    })
    logger.info(`  → Shipping profile assigned to ${productsNeedingProfile.length} product(s):`)
    productsNeedingProfile.forEach((p: any) => logger.info(`     • ${p.title}`))
  } else {
    logger.info("  → All products already have the shipping profile.")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Inventory levels – link all items to our stock location
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[11/12] Setting inventory levels…")

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  })

  // Find items that don't yet have a level at this location
  const { data: existingLevels } = await query.graph({
    entity: "inventory_level",
    fields: ["inventory_item_id", "location_id"],
    filters: { location_id: stockLocation.id },
  })

  const existingItemIds = new Set(
    existingLevels.map((l: any) => l.inventory_item_id)
  )

  const levelsToCreate: CreateInventoryLevelInput[] = inventoryItems
    .filter((item: any) => !existingItemIds.has(item.id))
    .map((item: any) => ({
      inventory_item_id: item.id,
      location_id: stockLocation.id,
      stocked_quantity: 1_000_000,
    }))

  if (levelsToCreate.length > 0) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: levelsToCreate },
    })
    logger.info(`  → Created ${levelsToCreate.length} inventory level(s).`)
  } else {
    logger.info("  → All inventory levels already exist, skipping.")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. Link stock location to the default sales channel
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("[12/12] Linking stock location to sales channel…")
  const [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels(
    { name: "Default Sales Channel" }
  )

  if (defaultSalesChannel) {
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: {
          id: stockLocation.id,
          add: [defaultSalesChannel.id],
        },
      })
      logger.info("  → Sales channel linked.")
    } catch {
      logger.info("  → Already linked, skipping.")
    }
  } else {
    logger.info("  → No default sales channel found, skipping.")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Done
  // ─────────────────────────────────────────────────────────────────────────
  logger.info("✅  Orizont setup complete!")
  logger.info("   Region:   Romania (RON)")
  logger.info("   Location: Magazin Orizont")
  logger.info("   Shipping: Livrare Standard (25 RON) + Ridicare Personală (0 RON)")
  logger.info("   Products: shipping profile assigned to all")
}
