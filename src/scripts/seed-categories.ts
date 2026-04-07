/**
 * Seeds the 7 main product categories and their subcategories.
 *
 * Run with:
 *   cd orizont-marketplace
 *   npx medusa exec src/scripts/seed-categories.ts
 *
 * Idempotent — safe to re-run. Skips categories that already exist (by handle).
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const CATEGORY_TREE = [
  {
    name: "Materiale de construcții",
    handle: "materiale-de-constructii",
    subcategories: [
      { name: "Armături și fundații",           handle: "armaturi-si-fundatii" },
      { name: "Produse metalurgice",             handle: "produse-metalurgice" },
      { name: "Țevi și profile",                 handle: "tevi-si-profile" },
      { name: "Materiale prăfoase",              handle: "materiale-prafoase" },
      { name: "Termoizolații",                   handle: "termoizolatii" },
      { name: "Hidroizolații și etanșări",       handle: "hidroizolatii-si-etansari" },
      { name: "Utilaje și echipamente",          handle: "utilaje-si-echipamente" },
      { name: "Produse din lemn",                handle: "produse-din-lemn" },
    ],
  },
  {
    name: "Acoperișuri și sisteme",
    handle: "acoperisuri-si-sisteme",
    subcategories: [
      { name: "Țiglă ceramică și beton",         handle: "tigla-ceramica-si-beton" },
      { name: "Tablă pentru acoperiș",           handle: "tabla-pentru-acoperis" },
      { name: "Membrane bituminoase",            handle: "membrane-bituminoase" },
      { name: "Jgheaburi și burlane",            handle: "jgheaburi-si-burlane" },
      { name: "Accesorii acoperiș",              handle: "accesorii-acoperis" },
    ],
  },
  {
    name: "Finisaje",
    handle: "finisaje",
    subcategories: [
      { name: "Vopsele și grunduri",             handle: "vopsele-si-grunduri" },
      { name: "Tencuieli decorative",            handle: "tencuieli-decorative" },
      { name: "Glet și șpaclu",                  handle: "glet-si-spaclu" },
      { name: "Gresie și faianță",               handle: "gresie-si-faianta" },
      { name: "Parchet și laminat",              handle: "parchet-si-laminat" },
      { name: "Plăci și panouri decorative",     handle: "placi-si-panouri-decorative" },
      { name: "Adezivi și chituri finisaje",     handle: "adezivi-si-chituri-finisaje" },
    ],
  },
  {
    name: "Instalații sanitare",
    handle: "instalatii-sanitare",
    subcategories: [
      { name: "Țevi și fitinguri",               handle: "tevi-si-fitinguri" },
      { name: "Robineți și racorduri",           handle: "robineti-si-racorduri" },
      { name: "Obiecte sanitare",                handle: "obiecte-sanitare" },
      { name: "Canalizare interioară",           handle: "canalizare-interioara" },
      { name: "Canalizare exterioară",           handle: "canalizare-exterioara" },
      { name: "Cămine de inspecție",             handle: "camine-de-inspectie" },
      { name: "Sisteme de încălzire",            handle: "sisteme-de-incalzire" },
    ],
  },
  {
    name: "Instalații electrice",
    handle: "instalatii-electrice",
    subcategories: [
      { name: "Cabluri și conductori",           handle: "cabluri-si-conductori" },
      { name: "Prize și întrerupătoare",         handle: "prize-si-intrerupatoare" },
      { name: "Tablouri electrice",              handle: "tablouri-electrice" },
      { name: "Corpuri de iluminat",             handle: "corpuri-de-iluminat" },
      { name: "Tuburi și accesorii instalații",  handle: "tuburi-si-accesorii-instalatii" },
      { name: "Doze și conectori",               handle: "doze-si-conectori" },
    ],
  },
  {
    name: "Curte și grădină",
    handle: "curte-si-gradina",
    subcategories: [
      { name: "Pavaje și borduri",               handle: "pavaje-si-borduri" },
      { name: "Garduri metalice și panouri",     handle: "garduri-metalice-si-panouri" },
      { name: "Beton și prefabricate",           handle: "beton-si-prefabricate" },
      { name: "Sisteme de irigații",             handle: "sisteme-de-irigatii" },
      { name: "Iluminat exterior",               handle: "iluminat-exterior" },
    ],
  },
  {
    name: "Scule și echipamente",
    handle: "scule-si-echipamente",
    subcategories: [
      { name: "Scule electrice",                 handle: "scule-electrice" },
      { name: "Scule manuale",                   handle: "scule-manuale" },
      { name: "Echipamente de protecție",        handle: "echipamente-de-protectie" },
      { name: "Accesorii și consumabile",        handle: "accesorii-si-consumabile" },
    ],
  },
]

export default async function seedCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(Modules.PRODUCT)

  logger.info("Seeding product categories…\n")

  // Load all existing categories once
  const existing = await productModuleService.listProductCategories(
    {},
    { select: ["id", "handle"] }
  )
  const byHandle = new Map(existing.map((c: any) => [c.handle, c.id]))

  let created = 0
  let skipped = 0

  for (const parent of CATEGORY_TREE) {
    let parentId: string

    if (byHandle.has(parent.handle)) {
      parentId = byHandle.get(parent.handle)!
      logger.info(`  ↩ ${parent.name} (exists)`)
      skipped++
    } else {
      const [newParent] = await productModuleService.createProductCategories([
        {
          name: parent.name,
          handle: parent.handle,
          is_active: true,
          rank: CATEGORY_TREE.indexOf(parent),
        },
      ])
      parentId = newParent.id
      byHandle.set(parent.handle, parentId)
      logger.info(`  ✓ ${parent.name}`)
      created++
    }

    for (const [idx, sub] of parent.subcategories.entries()) {
      if (byHandle.has(sub.handle)) {
        logger.info(`      ↩ ${sub.name} (exists)`)
        skipped++
      } else {
        await productModuleService.createProductCategories([
          {
            name: sub.name,
            handle: sub.handle,
            is_active: true,
            parent_category_id: parentId,
            rank: idx,
          },
        ])
        byHandle.set(sub.handle, "")
        logger.info(`      ✓ ${sub.name}`)
        created++
      }
    }
  }

  logger.info(`\n✅ Done. Created: ${created}  |  Already existed: ${skipped}`)
  logger.info("   Run 'npx medusa build && npx medusa start' to apply changes.")
}
