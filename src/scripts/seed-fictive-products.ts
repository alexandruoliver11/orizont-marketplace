/**
 * Seeds the 5 fictive products from public/produse-fictive
 *
 * Run with:
 *   cd orizont-marketplace
 *   npx medusa exec src/scripts/seed-fictive-products.ts
 *
 * Idempotent — skips products whose handle already exists.
 */

import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { MedusaContainer } from "@medusajs/framework"

const SALES_CHANNEL_ID  = "sc_01KMZHTT3EFF70VZE7VHE73YWP"
const SHIPPING_PROFILE  = "sp_01KMZHTJYPRREWQHKMMGTMR8DT"
const STOCK_LOCATION    = "sloc_01KN2QRNKBAB73JGPD4MPEJ5BE"
const REGION_ID         = "reg_01KMZHV7QFM7QR0Y68A753EEW8"

// Category IDs (verified from DB)
const CAT = {
  MATERIALE:   "pcat_01KN55XGS7GNG9GBGQ36WKYNRR",
  TERMOIZOL:   "pcat_01KN55XGT2HR121TTNWQ8Q168S",
  ADEZIVI:     "pcat_01KN55XGVZ1BBH45J49GQ0FF7H",
  SCULE:       "pcat_01KN55XGYF9H48Z0CC4FMMVVP2",
  ACCESORII:   "pcat_01KN55XGYXZJK58EZ5QSRXJW4D",
  CURTE:       "pcat_01KN55XGXR82387T0QT9STGGV7",
  IRIGATII:    "pcat_01KN55XGY8WP9K7E06GRV83Q7Q",
}

const BASE_URL = "http://localhost:9000/static"

const PRODUCTS = [
  {
    title: "Adeziv si masa de spaclu polistiren Firos Termfix, 20 kg",
    handle: "adeziv-masa-spaclu-polistiren-firos-termfix-20kg",
    description: `Adezivul și masa de șpaclu Firos Termfix este un produs bicomponent pe bază de ciment și polimeri, special formulat pentru lipirea plăcilor de polistiren expandat (EPS) în sistemele de termoizolație exterioară (ETICS/EIFS). Asigură o aderență excelentă pe suprafețe de beton, tencuială, cărămidă și BCA.\n\nCaracteristici principale:\n• Conținut de sac: 20 kg (randament ~4–5 m² la 4 mm grosime)\n• Timp de deschidere: ~30 minute la 20°C\n• Rezistență la tracțiune: ≥ 0,25 N/mm²\n• Clasa de reacție la foc: A1\n• Conținut redus de săruri solubile\n• Aplicare manuală sau mecanizată\n\nInstrucțiuni de utilizare:\nAmestecați conținutul sacului cu 5,5–6 l apă rece și amestecați cu mixerul timp de 3 minute până la obținerea unui amestec omogen. Aplicați pe placa de polistiren cu dințuitoarea și lipiți pe suprafața curată și uscată. Temperatura de aplicare: +5°C … +30°C.`,
    images: [`${BASE_URL}/1775584242190-adeziv-firos-termfix.jpg`],
    price: 38.5,
    categories: [CAT.MATERIALE, CAT.TERMOIZOL, CAT.ADEZIVI],
    material: "Ciment, polimeri, aditivi",
    weight: "20000",
  },
  {
    title: "Fir BOSCH PROFESSIONAL, 24m, 2.4mm",
    handle: "fir-bosch-professional-24m-2-4mm",
    description: `Firul de coasă BOSCH Professional este proiectat pentru aparatele de tuns iarbă BOSCH din seria ART și pentru modele compatibile cu fir de 2,4 mm. Fabricat din nylon de înaltă rezistență, oferă durabilitate sporită și tăiere curată, inclusiv în iarbă deasă sau cu tulpini mai rigide.\n\nSpecificații tehnice:\n• Lungime totală: 24 m\n• Diametru: 2,4 mm\n• Material: nylon duroflex armat\n• Culoare: galben (ușor de identificat)\n• Compatibil cu: BOSCH ART 26 SL, ART 30 SL, ART 30 Combitrim, alte modele cu orificiu de 2,4 mm\n\nAvantaje:\n• Rezistență ridicată la uzură și la impact\n• Tăiere precisă fără sfâșierea firelor de iarbă\n• Înlocuire rapidă cu sistemul AutoCut\n• Depozitare ușoară pe rola inclusă`,
    images: [`${BASE_URL}/1775584243259-fir-bosch-professional.jpg`],
    price: 29.9,
    categories: [CAT.SCULE, CAT.ACCESORII],
    material: "Nylon armat",
    weight: "120",
  },
  {
    title: "Pistol pentru stropit VERVE 101166247, 7 funcții, maro",
    handle: "pistol-stropit-verve-7-functii-maro",
    description: `Pistolul de udare VERVE cu 7 funcții este un accesoriu esențial pentru grădinărit, potrivit pentru udarea plantelor, curățarea teraselor, spălarea mașinii și irigarea gazonului. Mânerul ergonomic din material antiderapant asigură confort în utilizare prelungită.\n\nFuncțiile disponibile:\n1. Jet puternic — pentru curățare și spălare\n2. Jet plat — pentru udare uniformă\n3. Duș fin — pentru răsaduri și flori delicate\n4. Ceață — pentru umidificare ușoară\n5. Rotativ — pentru acoperire largă\n6. Jet centru — pentru rădăcini adânci\n7. Oprire — buton de blocare pentru pauze\n\nSpecificații:\n• Material carcasă: plastic ABS rezistent la UV, culoare maro\n• Conexiune: filet standard 1/2" — compatibil cu orice furtun de grădină\n• Debit maxim: 20 l/min\n• Presiune maximă: 8 bar\n• Greutate: ~180 g`,
    images: [`${BASE_URL}/1775584244323-pistol-stropit-verve.jpg`],
    price: 52.0,
    categories: [CAT.CURTE, CAT.IRIGATII],
    material: "Plastic ABS, cauciuc",
    weight: "180",
  },
  {
    title: "Ulei motor semisintetic Ruris 4T Max, 15W-40, 1l",
    handle: "ulei-motor-semisintetic-ruris-4t-max-15w40-1l",
    description: `Uleiul motor semisintetic Ruris 4T Max este formulat special pentru motoare cu 4 timpi cu răcire prin aer, utilizate la mașini de tuns iarbă, motocoase, motocultoare și generatoare. Baza semisinterică asigură protecție superioară față de uleiul mineral standard, prelungind durata de viață a motorului.\n\nSpecificații tehnice:\n• Vâscozitate SAE: 15W-40\n• Volumul ambalajului: 1 litru\n• Standard API: SJ/CF\n• Baza lubrifiantă: semisintetic\n• Compatibilitate: motoare Honda GC/GCV, Briggs & Stratton, Kawasaki, Loncin, și alte motoare 4T cu răcire prin aer\n\nAvantaje:\n• Protecție anti-uzură sporită la pornire la rece\n• Stabilitate termică excelentă la temperaturi ridicate\n• Reduce depunerile în motor\n• Menține viscozitatea în condiții extreme\n• Recomandat pentru schimb la fiecare 50 ore de funcționare`,
    images: [`${BASE_URL}/1775584245385-ulei-motor-ruris-4t.jpg`],
    price: 44.9,
    categories: [CAT.SCULE, CAT.ACCESORII],
    material: "Baza ulei semisintetic + aditivi",
    weight: "900",
  },
  {
    title: "Vata minerala bazaltica ROTYS Medium 90, 100 x 60 x 15 cm, 0.6 mp",
    handle: "vata-minerala-bazaltica-rotys-medium-90-100x60x15cm",
    description: `Vata minerală bazaltică ROTYS Medium 90 este un panou semi-rigid de izolație termică și acustică, fabricat din fibre de rocă vulcanică (bazalt). Datorită densității medii de 90 kg/m³, este potrivit pentru termoizolarea pereților exteriori, acoperișurilor plane și planșeelor intermediare.\n\nSpecificații tehnice:\n• Dimensiuni: 100 × 60 × 15 cm (0,6 m² per placă)\n• Densitate: 90 kg/m³\n• Conductivitate termică λ: 0,036 W/(m·K)\n• Rezistență termică R: 4,17 m²K/W\n• Clasa de reacție la foc: A1 (incombustibil)\n• Absorbție de apă: < 1 kg/m² (EN 1609)\n• Temperatura maximă de utilizare: 700°C\n\nAplicații:\n• Termoizolarea pereților exteriori în sisteme ETICS\n• Izolarea acoperișurilor terasă și înclinate\n• Izolarea planșeelor și a pereților despărțitori\n• Protecție pasivă la incendiu\n\nBeneficii ecologice: produs din rocă naturală, reciclabil, fără CFC sau HCFC.`,
    images: [`${BASE_URL}/1775584246462-vata-minerala-rotys.jpg`],
    price: 58.0,
    categories: [CAT.MATERIALE, CAT.TERMOIZOL],
    material: "Fibre minerale bazaltice",
    weight: "5400",
  },
]

export default async function seedFictiveProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query  = container.resolve(ContainerRegistrationKeys.QUERY)
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  logger.info("Seeding fictive products…")

  // Get existing handles to skip duplicates
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["handle"],
  })
  const existingHandles = new Set(existingProducts.map((p: any) => p.handle))

  for (const prod of PRODUCTS) {
    if (existingHandles.has(prod.handle)) {
      logger.info(`  ↩ Skipping (already exists): ${prod.title}`)
      continue
    }

    logger.info(`  + Creating: ${prod.title}`)

    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: prod.title,
            handle: prod.handle,
            description: prod.description,
            status: "published" as any,
            thumbnail: prod.images[0],
            images: prod.images.map((url) => ({ url })),
            material: prod.material,
            weight: prod.weight ? Number(prod.weight) : undefined,
            shipping_profile_id: SHIPPING_PROFILE,
            sales_channels: [{ id: SALES_CHANNEL_ID }],
            categories: prod.categories.map((id) => ({ id })),
            options: [
              {
                title: "Default option",
                values: ["Default option value"],
              },
            ],
            variants: [
              {
                title: prod.title,
                options: { "Default option": "Default option value" },
                prices: [
                  {
                    amount: prod.price,
                    currency_code: "ron",
                    region_id: REGION_ID,
                  },
                ],
                manage_inventory: true,
                allow_backorder: false,
              },
            ],
          },
        ],
      },
    })

    const createdProduct = result[0]
    const variantId = createdProduct.variants?.[0]?.id

    if (variantId) {
      // Look up the real inventory_item_id from the link table
      const rows = await pgConnection.raw(
        `SELECT inventory_item_id FROM product_variant_inventory_item WHERE variant_id = ? AND deleted_at IS NULL LIMIT 1`,
        [variantId]
      )
      const invItemId: string | undefined = rows.rows?.[0]?.inventory_item_id

      if (invItemId) {
        await createInventoryLevelsWorkflow(container).run({
          input: {
            inventory_levels: [
              {
                inventory_item_id: invItemId,
                location_id: STOCK_LOCATION,
                stocked_quantity: 1000000,
              },
            ],
          },
        })
      }
    }

    logger.info(`    ✓ Created: ${createdProduct.id}`)
  }

  logger.info("Done seeding fictive products.")
}
