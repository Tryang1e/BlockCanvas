const { createClient } = require('@libsql/client');
const path = require('path');

const client = createClient({
  url: 'file:' + path.join(__dirname, '../dev.db'),
});

async function main() {
  // Check current value
  const check = await client.execute({
    sql: "SELECT * FROM SiteSetting WHERE key = 'MAINTENANCE_MODE'",
    args: []
  });
  
  console.log('Current MAINTENANCE_MODE in DB:', check.rows);

  // Set MAINTENANCE_MODE to false
  const res = await client.execute({
    sql: "INSERT OR REPLACE INTO SiteSetting (key, value, updated_at) VALUES ('MAINTENANCE_MODE', 'false', CURRENT_TIMESTAMP)",
    args: []
  });
  
  console.log('SUCCESS: Turned off MAINTENANCE_MODE:', res);
  
  // Verify value
  const verify = await client.execute({
    sql: "SELECT * FROM SiteSetting WHERE key = 'MAINTENANCE_MODE'",
    args: []
  });
  console.log('Verified value in DB:', verify.rows);
}

main().catch(console.error);
