#!/usr/bin/env node

/**
 * VERIDEC Analyzer - Node.js compatible version
 * Uses lightweight implementation without heavy dependencies
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
 * Analyze code for common patterns and issues
 * @param {string} code - The source code to analyze
 * @param {string} filePath - Path to the file being analyzed (for context)
 * @returns {Promise<Object>} Analysis results with issues and impact score
 */
async function analyzeCode(code, filePath = 'unnamed-file') {
  const issues = [];
  
  try {
    // Run analysis passes
    await checkAIPatterns(code, issues);
    await checkSecurityIssues(code, issues);
    await checkPerformanceIssues(code, issues);
    
    // Basic syntax validation
    try {
      new Function(code);
    } catch (e) {
      // Only add parse errors for obvious syntax issues
      if (code.trim().length > 0) {
        issues.push({
          category: ISSUE_CATEGORIES.BEST_PRACTICES,
          severity: 'high',
          message: `Syntax error: ${e.message}`,
          line: 1,
          column: 1
        });
      }
    }
    
  } catch (error) {
    issues.push({
      category: ISSUE_CATEGORIES.BEST_PRACTICES,
      severity: 'high',
      message: `Analysis error: ${error.message}`,
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
  
  // Check for AI comment patterns
  const commentPattern = /\/\*[\s\S]*?(AI|artificial|intelligence)[\s\S]*?\*\//i;
  if (commentPattern.test(code)) {
    issues.push({
      category: ISSUE_CATEGORIES.BEST_PRACTICES,
      severity: 'medium',
      message: 'Comment indicates AI-generated code - ensure proper review and testing',
      line: 1,
      column: 1
    });
  }
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
  
  // Check for hardcoded secrets (basic check)
  const secretPatterns = [
    { pattern: /password\s*=\s*["'][^"']+["']/i, message: 'Hardcoded password detected' },
    { pattern: /api[_\s]?key\s*=\s*["'][^"']+["']/i, message: 'Hardcoded API key detected' }
  ];
  
  lines.forEach((line, index) => {
    secretPatterns.forEach(({ pattern, message }) => {
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
      pattern: /for\s*\(.*in\s+/, 
      message: 'Using for-in loop on arrays - consider for-of or traditional for loop' 
    },
    { 
      pattern: /\.\.\.\w+\s*\[/, 
      message: 'Spread operator in array creation - can be inefficient with large arrays' 
    },
    { 
      pattern: /setTimeout\s*\(.*\d+\)/, 
      message: 'Using setTimeout with delay - verify necessity' 
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
  
  // Check for console statements (debug code often left in AI output)
  const consolePattern = /console\.(log|warn|error)\s*\(/;
  if (consolePattern.test(code)) {
    const linesWithConsole = code.split('\n').filter(line => consolePattern.test(line));
    linesWithConsole.forEach((line, index) => {
      // Find line number in original code
      let lineNumber = 0;
      for (let i = 0; i < code.length; i++) {
        if (code[i] === '\n') lineNumber++;
        if (i === index) break;
      }
      
      issues.push({
        category: ISSUE_CATEGORIES.BEST_PRACTICES,
        severity: 'low',
        message: `Debug statement found: ${line.trim()}`,
        line: lineNumber + 1,
        column: line.indexOf(line.trim()) + 1
      });
    });
  }
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
