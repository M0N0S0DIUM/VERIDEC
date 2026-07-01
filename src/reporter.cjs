#!/usr/bin/env node

/**
 * Report generation module for VERIDEC
 * Handles formatting and output of analysis results
 */

const ISSUE_CATEGORIES = {
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  MAINTAINABILITY: 'maintainability',
  BEST_PRACTICES: 'best_practices',
  POTENTIAL_BUGS: 'potential_bugs'
};

// Issue severity colors for console output
const SEVERITY_COLORS = {
  high: '\x1b[31m', // Red
  medium: '\x1b[33m', // Yellow
  low: '\x1b[36m' // Cyan
};

const RESET_COLOR = '\x1b[0m';

/**
 * Format a single issue for display
 */
function formatIssue(issue) {
  const severityColor = SEVERITY_COLORS[issue.severity] || '';
  
  return `
${severityColor}Issue [${issue.severity.toUpperCase()}]${RESET_COLOR}
  Category: ${issue.category}
  Severity: ${issue.severity}
  Line: ${issue.line}:${issue.column}
  Message: ${issue.message}
`;
}

/**
 * Generate text report for console output
 */
function generateTextReport(analysisResults) {
  if (Array.isArray(analysisResults)) {
    // Multiple file results
    let report = 'VERIDEC Analysis Report\n';
    report += '='.repeat(50) + '\n\n';
    
    const totalFiles = analysisResults.length;
    let totalIssues = 0;
    let highSeverityCount = 0;
    let mediumSeverityCount = 0;
    let lowSeverityCount = 0;
    
    // Aggregate statistics
    analysisResults.forEach(result => {
      if (result.issues) {
        result.issues.forEach(issue => {
          totalIssues++;
          switch (issue.severity) {
            case 'high': highSeverityCount++; break;
            case 'medium': mediumSeverityCount++; break;
            case 'low': lowSeverityCount++; break;
          }
        });
      }
    });
    
    report += `Files analyzed: ${totalFiles}\n`;
    report += `Total issues found: ${totalIssues}\n`;
    report += `High severity: ${highSeverityCount}\n`;
    report += `Medium severity: ${mediumSeverityCount}\n`;
    report += `Low severity: ${lowSeverityCount}\n\n`;
    
    // Detailed results per file
    analysisResults.forEach((result, index) => {
      report += `File [${index + 1}]: ${result.filePath}\n`;
      report += '-'.repeat(30) + '\n';
      
      if (result.error) {
        report += `Error: ${result.error}\n\n`;
        return;
      }
      
      report += `Impact Score: ${result.impactScore}/100\n`;
      report += `Status: ${result.status}\n`;
      report += `Issues Found: ${result.issueCount}\n\n`;
      
      if (result.issues && result.issues.length > 0) {
        result.issues.forEach(issue => {
          report += formatIssue(issue);
        });
      } else {
        report += 'No issues found.\n';
      }
      
      report += '\n';
    });
    
    return report;
    
  } else {
    // Single file results
    const result = analysisResults;
    
    let report = 'VERIDEC Analysis Report\n';
    report += '='.repeat(50) + '\n\n';
    report += `File: ${result.filePath}\n`;
    report += `Impact Score: ${result.impactScore}/100\n`;
    report += `Status: ${result.status}\n`;
    report += `Issues Found: ${result.issueCount}\n\n`;
    
    if (result.issues && result.issues.length > 0) {
      report += 'Issues:\n';
      report += '-'.repeat(30) + '\n';
      result.issues.forEach(issue => {
        report += formatIssue(issue);
      });
    } else {
      report += 'No issues found - code passed all pre-flight checks.\n';
    }
    
    return report;
  }
}

/**
 * Generate JSON report for programmatic use
 */
function generateJsonReport(analysisResults) {
  // If it's a single result, convert to array
  const results = Array.isArray(analysisResults) ? analysisResults : [analysisResults];
  
  // Create summary statistics
  let totalIssues = 0;
  let highSeverityCount = 0;
  let mediumSeverityCount = 0;
  let lowSeverityCount = 0;
  
  results.forEach(result => {
    if (result.issues) {
      result.issues.forEach(issue => {
        totalIssues++;
        switch (issue.severity) {
          case 'high': highSeverityCount++; break;
          case 'medium': mediumSeverityCount++; break;
          case 'low': lowSeverityCount++; break;
        }
      });
    }
  });
  
  // Determine overall status
  let overallStatus = 'approved';
  if (totalIssues > 0) {
    if (highSeverityCount > 0 || results.some(r => r.status === 'warning')) {
      overallStatus = 'review_required';
    } else {
      overallStatus = 'conditional_approved';
    }
  }
  
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      filesAnalyzed: results.length,
      totalIssues,
      severityBreakdown: {
        high: highSeverityCount,
        medium: mediumSeverityCount,
        low: lowSeverityCount
      },
      overallStatus
    },
    fileResults: results.map(result => ({
      filePath: result.filePath,
      impactScore: result.impactScore,
      status: result.status,
      issueCount: result.issueCount,
      issues: result.issues || []
    }))
  }, null, 2);
}

/**
 * Generate report in the specified format
 */
function generateReport(analysisResults, format = 'text') {
  if (format === 'json') {
    return generateJsonReport(analysisResults);
  } else {
    return generateTextReport(analysisResults);
  }
}

/**
 * Get impact assessment summary
 */
function getImpactAssessment(analysisResults) {
  const results = Array.isArray(analysisResults) ? analysisResults : [analysisResults];
  
  if (results.length === 0) {
    return { 
      status: 'no_data', 
      message: 'No analysis results available',
      impactScore: null
    };
  }
  
  // If it's a single result, just return the assessment for that file
  if (results.length === 1 && !analysisResults.impactScore) {
    const result = analysisResults[0];
    return {
      status: result.status,
      impactScore: result.impactScore,
      issuesCount: result.issueCount
    };
  }
  
  // Calculate aggregate statistics
  let maxImpactScore = 0;
  let totalIssues = 0;
  let highSeverityCount = 0;
  
  results.forEach(result => {
    if (result.impactScore > maxImpactScore) {
      maxImpactScore = result.impactScore;
    }
    
    if (result.issues) {
      totalIssues += result.issueCount || result.issues.length;
      result.issues.forEach(issue => {
        if (issue.severity === 'high') highSeverityCount++;
      });
    } else {
      // Handle case where issue count is stored directly
      totalIssues += result.issueCount || 0;
    }
  });
  
  let status = 'approved';
  if (totalIssues > 0) {
    if (highSeverityCount > 0 || maxImpactScore > 75) {
      status = 'review_required';
    } else if (maxImpactScore > 25) {
      status = 'conditional_approved';
    }
  }
  
  return {
    status,
    impactScore: maxImpactScore,
    issuesCount: totalIssues,
    highSeverityCount
  };
}

// Export functions for use by other modules
module.exports = { 
  generateReport, 
  getImpactAssessment,
  SEVERITY_COLORS 
};