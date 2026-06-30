#!/usr/bin/env node

const parser = require('@typescript-eslint/parser');
const estraverse = require('estraverse');

/**
 * Core analysis logic for VERIDEC
 * Analyzes JavaScript/TypeScript code for AI-generated code patterns and potential issues
 */

// Define issue categories
const ISSUE_CATEGORIES = {
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  MAINTAINABILITY: 'maintainability',
  BEST_PRACTICES: 'best_practices',
  POTENTIAL_BUGS: 'potential_bugs'
};

/**
 * Analyze code for issues and patterns
 * @param {string} code - The source code to analyze
 * @param {string} filePath - Path to the file being analyzed (for context)
 * @returns {Promise<Object>} Analysis results with issues and impact score
 */
async function analyzeCode(code, filePath = 'unnamed-file') {
  const issues = [];
  
  try {
    // Parse the code into AST
    const ast = parser.parse(code, {
      ecmaVersion: 2023,
      sourceType: 'module',
      loc: true,
      range: true
    });

    // Run various analysis passes
    await analyzeAST(ast, code, issues);
    await checkAIPatterns(code, issues);
    await checkSecurityIssues(code, issues);
    await checkPerformanceIssues(code, issues);
    
  } catch (error) {
    issues.push({
      category: ISSUE_CATEGORIES.BEST_PRACTICES,
      severity: 'high',
      message: `Parse error: ${error.message}`,
      line: 1,
      column: 1
    });
  }

  // Calculate impact score (0-100, lower is better)
  const impactScore = calculateImpactScore(issues);

  return {
    filePath,
    issues,
    issueCount: issues.length,
    impactScore,
    status: issues.length === 0 ? 'clean' : issues.some(i => i.severity === 'high') ? 'warning' : 'review'
  };
}

/**
 * Analyze AST for common patterns and issues
 */
function analyzeAST(ast, code, issues) {
  const comments = ast.comments || [];
  
  // Check for AI-generated comment patterns
  comments.forEach(comment => {
    const text = comment.value.toLowerCase();
    
    if (text.includes('ai') && text.includes('code')) {
      issues.push({
        category: ISSUE_CATEGORIES.BEST_PRACTICES,
        severity: 'medium',
        message: 'AI-generated code detected - ensure proper review and testing',
        line: comment.loc.start.line,
        column: comment.loc.start.column + 1
      });
    }
  });

  // Check for common problematic patterns in AI code
  estraverse.traverse(ast, {
    enter(node) {
      // Check for overly complex conditional statements
      if (node.type === 'IfStatement') {
        const test = node.test;
        let complexity = 0;
        
        // Simple heuristic to count AND/OR operators in condition
        if (test.type === 'LogicalExpression') {
          let stack = [test];
          while (stack.length > 0) {
            const current = stack.pop();
            if (current.left && current.right) complexity++;
            if (current.left) stack.push(current.left);
            if (current.right) stack.push(current.right);
          }
        }
        
        if (complexity > 3) {
          issues.push({
            category: ISSUE_CATEGORIES.MAINTAINABILITY,
            severity: 'medium',
            message: `Complex conditional logic detected (complexity: ${complexity})`,
            line: node.loc.start.line,
            column: node.loc.start.column + 1
          });
        }
      }

      // Check for console.log statements (debug code often left in AI output)
      if (node.type === 'CallExpression' && 
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'console' &&
          ['log', 'warn', 'error'].includes(node.callee.property.name)) {
        issues.push({
          category: ISSUE_CATEGORIES.BEST_PRACTICES,
          severity: 'low',
          message: `Debug statement found: console.${node.callee.property.name}`,
          line: node.loc.start.line,
          column: node.loc.start.column + 1
        });
      }
    }
  });
}

/**
 * Check for AI-generated code patterns
 */
async function checkAIPatterns(code, issues) {
  // Look for common AI indicators
  const aiPatterns = [
    { pattern: /TODO.*AI/i, message: 'AI code requires further review' },
    { pattern: /placeholder|dummy/i, message: 'Placeholder code detected' },
    { pattern: /example|sample/i, message: 'Example code that may need customization' },
    { pattern: /assuming|hypothetical/i, message: 'Assumptions in code - verify logic' }
  ];

  const lines = code.split('\n');
  lines.forEach((line, index) => {
    aiPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push({
          category: ISSUE_CATEGORIES.BEST_PRACTICES,
          severity: 'medium',
          message: `${message}: ${line.trim()}`,
          line: index + 1,
          column: line.indexOf(line.trim()) + 1
        });
      }
    });
  });
}

/**
 * Check for common security issues
 */
async function checkSecurityIssues(code, issues) {
  const lines = code.split('\n');
  
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    { 
      pattern: /eval\s*\(/, 
      message: 'Use of eval() detected - potential security risk' 
    },
    { 
      pattern: /dangerouslySetInnerHTML/, 
      message: 'Potentially unsafe React pattern' 
    },
    { 
      pattern: /new Function\(/, 
      message: 'Dynamic code execution detected' 
    }
  ];

  lines.forEach((line, index) => {
    dangerousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push({
          category: ISSUE_CATEGORIES.SECURITY,
          severity: 'high',
          message: `${message}: ${line.trim()}`,
          line: index + 1,
          column: line.indexOf(line.trim()) + 1
        });
      }
    });
  });
}

/**
 * Check for common performance issues
 */
async function checkPerformanceIssues(code, issues) {
  const lines = code.split('\n');
  
  // Check for potentially problematic patterns
  const performancePatterns = [
    { 
      pattern: /for\s*\(\s*let\s+\w+\s+in\s+\w+\)/,
      message: 'Using for-in loop on arrays - consider for-of or traditional for loop' 
    },
    { 
      pattern: /\.\.\.\w+\s*\[/, 
      message: 'Spread operator in array creation - can be inefficient with large arrays' 
    },
    { 
      pattern: /setTimeout.*0/, 
      message: 'Using setTimeout with 0 delay - verify necessity' 
    }
  ];

  lines.forEach((line, index) => {
    performancePatterns.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push({
          category: ISSUE_CATEGORIES.PERFORMANCE,
          severity: 'medium',
          message: `${message}: ${line.trim()}`,
          line: index + 1,
          column: line.indexOf(line.trim()) + 1
        });
      }
    });
  });
}

/**
 * Calculate impact score based on issues found
 */
function calculateImpactScore(issues) {
  if (issues.length === 0) return 0;
  
  let score = 0;
  const severityWeights = {
    high: 25,
    medium: 10,
    low: 3
  };

  issues.forEach(issue => {
    score += severityWeights[issue.severity] || 5;
  });

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Generate impact assessment report
 */
function generateImpactReport(analysisResults) {
  if (Array.isArray(analysisResults)) {
    const totalIssues = analysisResults.reduce((sum, result) => sum + result.issueCount, 0);
    const maxScore = Math.max(...analysisResults.map(r => r.impactScore), 0);
    
    return {
      summary: `Analyzed ${analysisResults.length} files with ${totalIssues} total issues`,
      maxImpactScore: maxScore,
      status: totalIssues === 0 ? 'approved' : 
              analysisResults.some(r => r.status === 'warning') ? 'review_required' : 'conditional_approved',
      fileResults: analysisResults
    };
  } else {
    return {
      summary: `Analysis of ${analysisResults.filePath}`,
      impactScore: analysisResults.impactScore,
      status: analysisResults.status,
      issuesCount: analysisResults.issueCount
    };
  }
}

// Export functions for use by other modules
module.exports = { 
  analyzeCode, 
  generateImpactReport,
  ISSUE_CATEGORIES 
};