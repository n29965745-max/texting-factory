const { Client } = require('pg');
const tls = require('tls');

const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres',
  password: 'Texting-222!',
  ssl: {
    rejectUnauthorized: false,
    servername: 'xobkowupqahpoxybjuvg'
  },
  connectionTimeoutMillis: 15000
});

async function run() {
  try {
    await client.connect();
    console.log('Connected!');
    const res = await client.query('SELECT current_database(), current_user');
    console.log('DB:', res.rows[0]);
    await client.end();
  } catch(e) {
    console.log('Failed:', e.message.split('\n')[0]);
  }
}
run();
