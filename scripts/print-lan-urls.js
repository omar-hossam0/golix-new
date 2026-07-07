/* eslint-disable @typescript-eslint/no-require-imports */
const os = require("node:os");

const interfaces = os.networkInterfaces();
const urls = [];

for (const [name, entries] of Object.entries(interfaces)) {
  for (const entry of entries || []) {
    if (entry.family !== "IPv4" || entry.internal) continue;
    if (entry.address.startsWith("127.")) continue;
    urls.push({ name, address: entry.address });
  }
}

console.log("");
console.log("Goalix LAN URLs:");
console.log("  Local:   http://localhost:3001");

for (const item of urls) {
  console.log(`  ${item.name}: http://${item.address}:3001`);
}

console.log("");
console.log("Use the Ethernet/Wi-Fi address that is on the same router as your phone.");
console.log("If it does not open from the phone, allow TCP ports 3000 and 3001 in Windows Firewall.");
