#!/usr/bin/env node

/**
 * VERIDEC - CI/CD Pre-Flight Check & Impact Predictor for AI-generated code
 * 
 * Main entry point that provides CLI interface and core functionality
 */

// Re-export main components for convenience
const cli = require('./cli');
const analyzer = require('./analyzer');
const reporter = require('./reporter');

/**
 * VERIDEC version
 */
exports.version = '0.1.0';

/**
 * Export all modules for programmatic use
 */
module.exports = {
  version: '0.1.0',
  cli,
  analyzer,
  reporter,
  
  // Re-export main functions
  analyzeCode: analyzer.analyzeCode,
  generateReport: reporter.generateReport,
  getImpactAssessment: reporter.getImpactAssessment
};

// Run CLI if executed directly
if (require.main === module) {
  cli.main();
}