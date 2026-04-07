/**
 * Fix inventory for product variants that have manage_inventory=true
 * but are missing inventory items / inventory levels.
 *
 * Run with:  npx medusa exec ./src/scripts/fix-inventory.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

export default async function fixInventory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const inventoryService = container.resolve(Modules.INVENTORY)
  const productService = container.resolve(Modules.PRODUCT)

  logger.info("=== Fix Inventory Script ===")

  // 1. Get stock location
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })

  if (!stockLocations.length) {
    logger.error("No stock locations found. Run the seed script first.")
    return
  }

  const stockLocation = stockLocations[0]
  logger.info(`Using stock location: ${stockLocation.name} (${stockLocation.id})`)

  // 2. Get all product variants with manage_inventory = true  
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.manage_inventory",
    ],
  })

  let fixedCount = 0

  for (const product of products) {
    if (!product.variants) continue

    for (const variant of product.variants) {
      if (!variant.manage_inventory) continue

      // 3. Check if this variant already has an inventory item linked
      const { data: existingLinks } = await query.graph({
        entity: "product_variant_inventory_item",
        fields: ["inventory_item_id"],
        filters: {
          variant_id: variant.id,
        },
      })

      if (existingLinks.length > 0) {
        // Already has inventory item linked
        continue
      }

      logger.info(
        `Fixing: "${product.title}" → variant "${variant.title}" (${variant.id})`
      )

      // 4. Create inventory item
      const inventoryItem = await inventoryService.createInventoryItems({
        sku: variant.sku || undefined,
        title: variant.title,
        requires_shipping: true,
      })

      logger.info(`  Created inventory item: ${inventoryItem.id}`)

      // 5. Link inventory item to variant
      await link.create({
        [Modules.PRODUCT]: { variant_id: variant.id },
        [Modules.INVENTORY]: { inventory_item_id: inventoryItem.id },
      })

      logger.info(`  Linked to variant ${variant.id}`)

      // 6. Create inventory level at the stock location
      await inventoryService.createInventoryLevels({
        inventory_item_id: inventoryItem.id,
        location_id: stockLocation.id,
        stocked_quantity: 1000000, // large default stock
      })

      logger.info(
        `  Created inventory level at ${stockLocation.name} with qty 1,000,000`
      )

      fixedCount++
    }
  }

  if (fixedCount === 0) {
    logger.info("All variants already have inventory items. Nothing to fix.")
  } else {
    logger.info(`\n✅ Fixed ${fixedCount} variant(s). You can now add products to cart.`)
  }
}
