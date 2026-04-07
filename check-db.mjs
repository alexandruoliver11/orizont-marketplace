import pg from 'pg'
import crypto from 'crypto'
const { Client } = pg
const client = new Client('postgres://postgres:12345@localhost/medusa-orizont-marketplace')
await client.connect()

// Get table structure first
const cols = await client.query(`SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'product_shipping_profile' ORDER BY ordinal_position`)
console.log('Columns:', cols.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`))

// Get one existing row for reference
const sample = await client.query(`SELECT * FROM product_shipping_profile LIMIT 1`)
console.log('Sample row:', JSON.stringify(sample.rows[0], null, 2))

await client.end()
