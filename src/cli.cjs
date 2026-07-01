#!/usr/bin/env node

const { analyzeCode } = require('./analyzer.cjs');
const { generateReport } = require('./reporter.cjs');
const fs = require('fs');
const path = require('path');

/**
 * CLI interface for VERIDEC - CI/CD Pre-Flight Check & Impact Predictor
 */

function parseArgs(args) {
  const options = {
    file: null,
    directory: null,
    output: 'console',
    format: 'text'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-f':
      case '--file':
        options.file = args[++i];
        break;
      case '-d':
      case '--dir':
      case '--directory':
        options.directory = args[++i];
        break;
      case '-o':
      case '--output':
        options.output = args[++i] || 'console';
        break;
      case '-j':
      case '--json':
        options.format = 'json';
        break;
      case '-h':
      case '--help':
        console.log(`
VERIDEC - CI/CD Pre-Flight Check & Impact Predictor for AI-generated code

Usage: veridec [options]

Options:
  -f, --file <path>       Analyze a single file
  -d, --dir, --directory <path>  Analyze all files in directory
  -o, --output <type>     Output type (console, file)
  -j, --json              Output results as JSON
  -h, --help              Show help

Examples:
  veridec --file path/to/file.js
  veridec --directory src/
  veridec --file app.ts --json > report.json
`);
        process.exit(0);
      default:
        if (!args[i].startsWith('-')) {
          options.file = args[i];
        }
    }
  }

  return options;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('VERIDEC - CI/CD Pre-Flight Check & Impact Predictor');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  const options = parseArgs(args);

  try {
    let results;

    if (options.file) {
      // Analyze single file
      const filePath = path.resolve(options.file);
      if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found ${filePath}`);
        process.exit(1);
      }

      const code = fs.readFileSync(filePath, 'utf8');
      results = await analyzeCode(code, filePath);
    } 
    else if (options.directory) {
      // Analyze all files in directory
      const dirPath = path.resolve(options.directory);
      if (!fs.existsSync(dirPath)) {
        console.error(`Error: Directory not found ${dirPath}`);
        process.exit(1);
      }

      results = await analyzeDirectory(dirPath);
    } 
    else {
      console.error('Error: Please specify a file or directory to analyze');
      process.exit(1);
    }

    // Generate and output report
    const report = generateReport(results, options.format);
    
    if (options.output === 'console') {
      console.log(report);
    } else if (options.output === 'file') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputPath = `veridec-report-${timestamp}.${options.format}`;
      fs.writeFileSync(outputPath, report);
      console.log(`Report saved to ${outputPath}`);
    }

  } catch (error) {
    console.error('Error during analysis:', error.message);
    process.exit(1);
  }
}

async function analyzeDirectory(dirPath) {
  const results = [];
  
  // Get all JavaScript/TypeScript files
  const files = fs.readdirSync(dirPath).filter(file => 
    file.endsWith('.js') || file.endsWith('.ts') || 
    file.endsWith('.jsx') || file.endsWith('.tsx')
  );

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const analysis = await analyzeCode(code, filePath);
      results.push({
        file: filePath,
        ...analysis
      });
    } catch (error) {
      results.push({
        file: filePath,
        error: `Failed to analyze: ${error.message}`,
        issues: [],
        impactScore: 0
      });
    }
  }

  return results;
}

// Export for use by other modules
module.exports = { main, parseArgs };

// Run if executed directly
if (require.main === module) {
  main();
}