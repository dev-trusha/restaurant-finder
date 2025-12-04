const crypto = require('crypto');
const fs = require('fs');

// Generate secret
const secret = crypto.randomBytes(64).toString('hex');

// Update .env file
const envContent = `JWT_SECRET=${secret}\nJWT_EXPIRES_IN=24h\n`;

fs.writeFileSync('.env', envContent, { flag: 'a' });

console.log('✅ JWT Secret generated and saved to .env file:');
console.log('JWT_SECRET=', secret);
console.log('\n⚠️  IMPORTANT:');
console.log('1. Add .env to .gitignore (if not already)');
console.log('2. Set the same secret in your hosting platform');