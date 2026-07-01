// VERIDEC Worker - Serves dashboard and proxies to MCP server

import { analyzeCode } from './workers-friendly-analyzer.js';

const MCP_SERVER_URL = 'http://localhost:3000'; // Change this to your actual MCP server URL

// Dashboard HTML content (inline for Cloudflare Workers)
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VERIDEC - Code Analysis Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 900px; margin: 0 auto; }
        header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
        }
        h1 { font-size: 2.5rem; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }
        .subtitle { font-size: 1.1rem; opacity: 0.9; }
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
        }
        @media (min-width: 768px) { .dashboard-grid { grid-template-columns: 1fr 1fr; } }
        .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .analysis-input { grid-column: span 1; }
        @media (min-width: 768px) { .analysis-input { grid-column: span 2; } }
        h2 { margin-bottom: 20px; color: #333; font-size: 1.4rem; }
        label { display: block; margin-bottom: 8px; color: #555; font-weight: 600; }
        textarea {
            width: 100%; height: 200px;
            padding: 15px; border: 2px solid #e0e0e0; border-radius: 10px;
            font-family: 'Courier New', Courier, monospace; font-size: 14px; resize: vertical;
        }
        textarea:focus { outline: none; border-color: #667eea; }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; border: none; padding: 15px 30px;
            font-size: 1.1rem; font-weight: 600; border-radius: 10px;
            cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
            margin-top: 15px; width: 100%;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4); }
        button:active { transform: translateY(0); }
        button:disabled { opacity: 0.7; cursor: not-allowed; }
        .result-card { display: none; margin-top: 20px; }
        .result-card.show { display: block; }
        .score-container {
            text-align: center;
            padding: 30px 20px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border-radius: 15px;
            margin-bottom: 25px;
        }
        .score-circle {
            width: 180px; height: 180px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 3.5rem; font-weight: bold; margin: 20px auto;
            color: white;
        }
        .status-badge {
            display: inline-block; padding: 8px 20px; border-radius: 20px;
            font-weight: bold; text-transform: uppercase; font-size: 0.9rem;
        }
        .status-clean { background: #4caf50; color: white; }
        .status-review { background: #ff9800; color: white; }
        .status-warning { background: #f44336; color: white; }
        .issues-counts { display: flex; gap: 20px; margin-bottom: 20px; justify-content: center; }
        .issue-stat { text-align: center; }
        .stat-value { font-size: 1.5rem; font-weight: bold; color: #667eea; }
        .stat-label { font-size: 0.85rem; color: #888; text-transform: uppercase; }
        .issue-item {
            padding: 12px 15px; margin-bottom: 10px;
            border-radius: 8px; display: flex; align-items: flex-start;
        }
        .issue-severity { font-weight: bold; padding: 4px 12px; border-radius: 4px; min-width: 80px; }
        .severity-high { background: #ffebee; color: #c62828; }
        .severity-medium { background: #fff3e0; color: #ef6c00; }
        .severity-low { background: #e3f2fd; color: #1565c0; }
        .issue-details { margin-left: 15px; flex: 1; }
        .issue-message { font-size: 0.95rem; color: #444; line-height: 1.5; }
        .issue-info { margin-top: 8px; font-size: 0.85rem; color: #888; }
        .file-path { font-family: 'Courier New', Courier, monospace; color: #667eea; word-break: break-all; }
        .loading-spinner { text-align: center; padding: 40px; display: none; }
        .spinner {
            border: 4px solid #f3f3f3; border-top: 4px solid #667eea;
            border-radius: 50%; width: 40px; height: 40px;
            animation: spin 1s linear infinite; margin: 0 auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .error-message {
            background: #ffebee; border: 1px solid #f44336; padding: 15px;
            border-radius: 10px; margin-bottom: 20px; color: #c62828; display: none;
        }
        .error-message.show { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>VERIDEC</h1>
            <p class="subtitle">CI/CD Pre-Flight Check & Impact Predictor for AI-generated code</p>
        </header>

        <div id="error-message" class="error-message"></div>

        <div class="dashboard-grid">
            <div class="card analysis-input">
                <h2>Analyze Your Code</h2>
                <label for="codeInput">Paste your JavaScript or TypeScript code below:</label>
                <textarea id="codeInput" placeholder="// Paste your code here...\n\nfunction example() {\n    console.log('Hello World');\n    return true;\n}"></textarea>
                <button id="analyzeBtn">Analyze Code</button>
            </div>

            <div class="loading-spinner" id="loadingSpinner">
                <div class="spinner"></div>
                <p>Analyzing code... This may take a few seconds.</p>
            </div>

            <div class="card result-card" id="resultCard">
                <h2>Analysis Results</h2>
                <div class="score-container">
                    <h3>Impact Score</h3>
                    <div class="score-circle" id="impactScore">0/100</div>
                    <p class="status-badge" id="statusBadge"></p>
                    <p class="score-text" id="scoreDescription">No analysis performed yet</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <label>File Name:</label>
                    <span class="file-path" id="fileName">unnamed-file.js</span>
                </div>

                <div class="issues-counts">
                    <div class="issue-stat">
                        <div class="stat-value" id="totalIssues">0</div>
                        <div class="stat-label">Total Issues</div>
                    </div>
                    <div class="issue-stat">
                        <div class="stat-value" id="highSeverity">0</div>
                        <div class="stat-label">High Severity</div>
                    </div>
                    <div class="issue-stat">
                        <div class="stat-value" id="mediumSeverity">0</div>
                        <div class="stat-label">Medium Severity</div>
                    </div>
                    <div class="issue-stat">
                        <div class="stat-value" id="lowSeverity">0</div>
                        <div class="stat-label">Low Severity</div>
                    </div>
                </div>

                <div class="issues-section">
                    <h3>Detected Issues</h3>
                    <div id="issuesList"></div>
                </div>
            </div>
        </div>

        <div style="text-align: center; margin-top: 40px; color: white; opacity: 0.7;">
            <p>VERIDEC v0.1.0 | Analyzes AI-generated code for CI/CD pre-flight checks</p>
        </div>
    </div>

    <script>
        const API_BASE_URL = '${MCP_SERVER_URL}';
        const analyzeBtn = document.getElementById('analyzeBtn');
        const codeInput = document.getElementById('codeInput');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const resultCard = document.getElementById('resultCard');
        const errorMessage = document.getElementById('error-message');

        const impactScoreEl = document.getElementById('impactScore');
        const statusBadgeEl = document.getElementById('statusBadge');
        const scoreDescriptionEl = document.getElementById('scoreDescription');
        const fileNameEl = document.getElementById('fileName');
        const totalIssuesEl = document.getElementById('totalIssues');
        const highSeverityEl = document.getElementById('highSeverity');
        const mediumSeverityEl = document.getElementById('mediumSeverity');
        const lowSeverityEl = document.getElementById('lowSeverity');
        const issuesListEl = document.getElementById('issuesList');

        analyzeBtn.addEventListener('click', async () => {
            const code = codeInput.value.trim();
            
            if (!code) {
                showError('Please enter some code to analyze.');
                return;
            }

            hideError();
            loadingSpinner.style.display = 'block';
            resultCard.classList.remove('show');
            analyzeBtn.disabled = true;

            try {
                const response = await fetch(API_BASE_URL + '/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, filePath: 'user-code.js' })
                });

                if (!response.ok) throw new Error('Analysis failed');

                const result = await response.json();
                displayResults(result);
                
            } catch (error) {
                showError(\`Analysis error: \${error.message}. Make sure the VERIDEC server is running at \${API_BASE_URL}\`);
            } finally {
                loadingSpinner.style.display = 'none';
                analyzeBtn.disabled = false;
            }
        });

        function displayResults(results) {
            const impactScore = results.impactScore || 0;
            impactScoreEl.textContent = \`\${impactScore}/100\`;
            
            if (impactScore <= 25) {
                impactScoreEl.style.background = 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)';
            } else if (impactScore <= 75) {
                impactScoreEl.style.background = 'linear-gradient(135deg, #ff9800 0%, #ff5722 100%)';
            } else {
                impactScoreEl.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
            }

            const status = results.status || 'clean';
            statusBadgeEl.textContent = status.replace('_', ' ');
            statusBadgeEl.className = \`status-badge status-\${status}\`;
            
            scoreDescriptionEl.textContent = getStatusDescription(status, impactScore);
            fileNameEl.textContent = results.filePath || 'unnamed-file.js';

            const issues = results.issues || [];
            totalIssuesEl.textContent = issues.length;
            
            let highCount = 0, mediumCount = 0, lowCount = 0;
            issues.forEach(issue => {
                switch (issue.severity) {
                    case 'high': highCount++; break;
                    case 'medium': mediumCount++; break;
                    case 'low': lowCount++; break;
                }
            });

            highSeverityEl.textContent = highCount;
            mediumSeverityEl.textContent = mediumCount;
            lowSeverityEl.textContent = lowCount;

            if (issues.length > 0) {
                issuesListEl.innerHTML = issues.map(issue => \`
                    <div class="issue-item">
                        <span class="issue-severity severity-\${issue.severity}">\${issue.severity}</span>
                        <div class="issue-details">
                            <p class="issue-message">\${issue.message}</p>
                            <div class="issue-info">Line \${issue.line}:\${issue.column} | Category: \${issue.category}</div>
                        </div>
                    </div>
                \`).join('');
            } else {
                issuesListEl.innerHTML = '<p>No issues detected. Your code looks clean!</p>';
            }

            resultCard.classList.add('show');
        }

        function getStatusDescription(status, score) {
            switch (status) {
                case 'clean': return '✅ Code passed all pre-flight checks';
                case 'review': return \`⚠️ \${score} issues found. Review recommended before deployment\`;
                case 'warning': return \`❌ High impact detected (\${score}). Manual review required\`;
                default: return \`\${score}/100 impact score\`;
            }
        }

        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.classList.add('show');
            setTimeout(hideError, 5000);
        }

        function hideError() {
            errorMessage.classList.remove('show');
        }
    </script>
</body>
</html>`;

// Health check endpoint
const healthEndpoint = async (request) => {
  return new Response(JSON.stringify({ status: 'healthy' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// Analysis proxy to MCP server
const analyzeEndpoint = async (request) => {
  try {
    const body = await request.json();
    
    const mcpResponse = await fetch(MCP_SERVER_URL + '/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: body.code,
        filePath: body.filePath || 'worker-analyzed-file.js'
      })
    });

    if (!mcpResponse.ok) {
      return new Response(JSON.stringify({ error: 'Analysis failed', message: 'MCP server unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await mcpResponse.json();
    return new Response(JSON.stringify(result), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Analysis failed', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Main fetch handler
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Serve dashboard HTML
    if (request.method === 'GET') {
      return new Response(DASHBOARD_HTML, {
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }

    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return healthEndpoint(request);
    }

    // Analysis endpoint
    if (url.pathname === '/analyze' && request.method === 'POST') {
      return analyzeEndpoint(request);
    }

    // Default response
    return new Response('VERIDEC - CI/CD Pre-Flight Check & Impact Predictor', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  },
};