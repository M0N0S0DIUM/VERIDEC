#!/usr/bin/env node

/**
 * Simple test script for VERIDEC workers-friendly-analyzer (ES module version)
 */

import { analyzeCode, ISSUE_CATEGORIES } from './src/workers-friendly-analyzer.js';

async function runTests() {
  console.log('Testing VERIDEC Worker-Friendly Analyzer\n');
  
  // Test 1: Clean code
  const cleanCode = `
function add(a, b) {
    return a + b;
}

console.log(add(2, 3));
`;
  
  console.log('Test 1: Analyzing clean code...');
  let result = await analyzeCode(cleanCode, 'clean.js');
  console.log(`Issues found: ${result.issueCount}`);
  console.log(`Impact score: ${result.impactScore}/100`);
  console.log(`Status: ${result.status}\n`);
  
  // Test 2: Code with potential issues
  const problematicCode = `
// TODO: AI generated code - need to review this thoroughly

function calculate(a, b) {
    // Using for-in on array (performance issue)
    const arr = [1, 2, 3];
    for (let i in arr) {
        console.log(arr[i]); // Debug statement
    }
    
    // Potential security issues
    eval("console.log('test')");
    
    return a + b;
}

// Hardcoded password (security issue)
const password = "supersecret123";
`;
  
  console.log('Test 2: Analyzing problematic code...');
  result = await analyzeCode(problematicCode, 'problematic.js');
  console.log(`Issues found: ${result.issueCount}`);
  console.log(`Impact score: ${result.impactScore}/100`);
  console.log(`Status: ${result.status}\n`);
  
  if (result.issues.length > 0) {
    console.log('Detected issues:');
    result.issues.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
      console.log(`   Category: ${issue.category} | Line: ${issue.line}\n`);
    });
  }
  
  // Test 3: Code with AI indicators
  const aiCode = `
// TODO: AI generated code - need to review this thoroughly

function dummyFunction() {
    // This is a sample implementation that needs customization
    return "hello";
}

/**
 * Assuming the user wants to perform some operation here
 */
function hypotheticalOperation(data) {
    return data;
}
`;
  
  console.log('Test 3: Analyzing AI-indicator code...');
  result = await analyzeCode(aiCode, 'ai-code.js');
  console.log(`Issues found: ${result.issueCount}`);
  console.log(`Impact score: ${result.impactScore}/100`);
  console.log(`Status: ${result.status}\n`);
  
  if (result.issues.length > 0) {
    const aiIssues = result.issues.filter(i => i.category === ISSUE_CATEGORIES.BEST_PRACTICES);
    console.log(`AI-related issues detected: ${aiIssues.length}`);
  }
  
  console.log('All tests completed!');
}

runTests().catch(console.error);
