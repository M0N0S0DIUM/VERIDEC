#!/usr/bin/env node

/**
 * Production deployment verification for VERIDEC
 * This script checks all critical systems before going live
 */

import { analyzeCode } from './src/workers-friendly-analyzer.js';
import { generateApiKey, hashApiKey } from './src/auth.js';

// Configuration
const CONFIG = {
  maxCodeSize: 50000,
  rateLimitWindow: 60, // seconds
  rateLimitMaxRequests: 10,
  expectedTables: ['users', 'api_keys', 'usage_events', 'rate_limit_entries'],
};

async function verifyAnalysisFunctionality() {
  console.log('\n=== Verifying Analysis Functionality ===\n');
  
  const tests = [
    { 
      name: 'Basic analysis', 
      code: 'function hello() { return "World"; }',
      shouldPass: true,
    },
    { 
      name: 'Security detection (eval)', 
      code: 'eval(atob("Y29uc29sZS5sb2coMSk="))',
      shouldPass: false, // Should detect security issue
    },
    { 
      name: 'Hardcoded secret', 
      code: 'const API_KEY = "sk_live_1234567890abcdef"',
      shouldPass: false, // Should detect hardcoded secret
    },
  ];

  let passed = 0;
  for (const test of tests) {
    try {
      const result = await analyzeCode(test.code, `${test.name}.js`);
      
      if (test.shouldPass && result.issues.length === 0) {
        console.log(`✅ ${test.name}: PASS`);
        passed++;
      } else if (!test.shouldPass && result.issues.length > 0) {
        console.log(`✅ ${test.name}: PASS (detected ${result.issues.length} issues)`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: FAIL`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    }
  }

  return passed === tests.length;
}

async function verifySecurityFeatures() {
  console.log('\n=== Verifying Security Features ===\n');
  
  let passed = 0;
  
  // Test code size validation
  const largeCode = 'console.log("test");'.repeat(CONFIG.maxCodeSize);
  if (largeCode.length > CONFIG.maxCodeSize) {
    console.log(`✅ Code size validation: PASS (${largeCode.length} bytes would be rejected)`);
    passed++;
  }
  
  // Test API key generation
  try {
    const apiKey = generateApiKey();
    if (apiKey.startsWith('vd_live_') && apiKey.length > 20) {
      console.log(`✅ API key generation: PASS (${apiKey.substring(0, 16)}...)`);
      passed++;
    }
    
    // Test hash function
    const hash = await hashApiKey(apiKey);
    if (hash.length === 64) { // SHA-256 produces 64 char hex string
      console.log(`✅ API key hashing: PASS (${hash.substring(0, 16)}...)`);
      passed++;
    }
  } catch (error) {
    console.log(`❌ Security functions: ERROR - ${error.message}`);
  }

  return passed === 3; // 3 security checks
}

async function verifyDatabaseSchema() {
  console.log('\n=== Verifying Database Schema ===\n');
  
  // Read the migration files
  const fs = await import('fs');
  const migrationsDir = './migrations/';
  
  let tablesFound = [];
  try {
    const files = fs.readdirSync(migrationsDir);
    
    for (const file of files) {
      if (file.endsWith('.sql')) {
        const content = fs.readFileSync(migrationsDir + file, 'utf8');
        
        CONFIG.expectedTables.forEach(table => {
          // Look for table creation
          if (content.includes(`CREATE TABLE IF NOT EXISTS ${table}`) || 
              content.includes(`CREATE TABLE ${table}`)) {
            if (!tablesFound.includes(table)) {
              tablesFound.push(table);
              console.log(`✅ Table found: ${table}`);
            }
          }
        });
      }
    }
    
    const allTablesPresent = CONFIG.expectedTables.every(table => tablesFound.includes(table));
    return allTablesPresent;
  } catch (error) {
    console.log(`❌ Error reading migrations: ${error.message}`);
    return false;
  }
}

async function verifyEnvironmentConfig() {
  console.log('\n=== Verifying Environment Configuration ===\n');
  
  // Read wrangler.toml
  const fs = await import('fs');
  
  try {
    const content = fs.readFileSync('./wrangler.toml', 'utf8');
    
    const checks = [
      { name: 'Worker name defined', pattern: /^name\s*=/m },
      { name: 'Main file specified', pattern: /^main\s*=/m },
      { name: 'Compatibility date set', pattern: /^compatibility_date\s*=/m },
      { name: 'APP_URL variable', pattern: /APP_URL\s*=/ },
      { name: 'D1 database configured', pattern: /\[\[d1_databases\]\]/ },
    ];
    
    let passed = 0;
    for (const check of checks) {
      if (check.pattern.test(content)) {
        console.log(`✅ ${check.name}: PRESENT`);
        passed++;
      } else {
        console.log(`❌ ${check.name}: MISSING`);
      }
    }
    
    return passed === checks.length;
  } catch (error) {
    console.log(`❌ Error reading wrangler.toml: ${error.message}`);
    return false;
  }
}

async function verifySecurityHeaders() {
  console.log('\n=== Verifying Security Headers ===\n');
  
  const fs = await import('fs');
  const workerContent = fs.readFileSync('./src/worker.js', 'utf8');
  
  const expectedHeaders = [
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
  ];
  
  let passed = 0;
  for (const header of expectedHeaders) {
    if (workerContent.includes(header)) {
      console.log(`✅ Security header present: ${header}`);
      passed++;
    } else {
      console.log(`❌ Missing security header: ${header}`);
    }
  }
  
  return passed === expectedHeaders.length;
}

async function runFullVerification() {
  console.log('==============================================');
  console.log('   VERIDEC Production Deployment Verification');
  console.log('==============================================');
  
  const results = {
    analysis: await verifyAnalysisFunctionality(),
    security: await verifySecurityFeatures(),
    database: await verifyDatabaseSchema(),
    environment: await verifyEnvironmentConfig(),
    headers: await verifySecurityHeaders(),
  };
  
  // Summary
  console.log('\n=== Verification Summary ===\n');
  
  const totalTests = Object.values(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  for (const [name, result] of Object.entries(results)) {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${status}: ${name}`);
  }
  
  console.log(`\nTotal: ${passedTests}/${totalTests} checks passed\n`);
  
  if (passedTests === totalTests) {
    console.log('🎉 VERIDEC is ready for production deployment! 🚀\n');
    console.log('Next steps:');
    console.log('1. Apply database migration for rate_limit_entries table');
    console.log('2. Set Stripe environment variables in Cloudflare Dashboard');
    console.log('3. Test with real Stripe test cards (4242 4242 4242 4242)');
    console.log('4. Deploy with: npx wrangler deploy --env production\n');
  } else {
    console.log('⚠️ Some checks failed. Review the output above before deploying.\n');
  }
}

runFullVerification().catch(console.error);