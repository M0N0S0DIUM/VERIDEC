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
        :root {
            --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --success-gradient: linear-gradient(135deg, #4caf50 0%, #8bc34a 100%);
            --warning-gradient: linear-gradient(135deg, #ff9800 0%, #ff5722 100%);
            --danger-gradient: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
            --card-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(to bottom, #667eea 0%, #764ba2 50%, #f093fb 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1000px; margin: 0 auto; }
        header {
            text-align: center;
            color: white;
            margin-bottom: 50px;
            padding: 40px 20px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
        }
        h1 { font-size: 3rem; margin-bottom: 15px; text-shadow: 2px 2px 8px rgba(0,0,0,0.2); }
        .subtitle { font-size: 1.3rem; opacity: 0.95; max-width: 700px; margin: 0 auto; line-height: 1.6; }
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 30px;
        }
        @media (min-width: 992px) {
            .dashboard-grid { grid-template-columns: repeat(3, 1fr); }
            .analysis-input { grid-column: span 3; }
            .result-card { grid-column: span 3; }
        }
        @media (min-width: 768px) and (max-width: 991px) {
            .dashboard-grid { grid-template-columns: repeat(2, 1fr); }
            .analysis-input { grid-column: span 2; }
            .result-card { grid-column: span 2; }
        }
        .card { background: white; border-radius: 20px; padding: 30px; box-shadow: var(--card-shadow); transition: all 0.3s ease; position: relative; overflow: hidden; }
        .card:hover { transform: translateY(-5px); box-shadow: 0 15px 50px rgba(0,0,0,0.15); }
        .analysis-input::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 8px;
            background: var(--primary-gradient);
            border-radius: 20px 20px 0 0;
        }
        h2 { margin-bottom: 25px; color: #2d3436; font-size: 1.6rem; display: flex; align-items: center; gap: 10px; }
        .icon { width: 32px; height: 32px; background: var(--primary-gradient); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem; }
        label { display: block; margin-bottom: 12px; color: #636e72; font-weight: 600; font-size: 0.95rem; }
        .textarea-wrapper {
            position: relative;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            transition: all 0.3s ease;
        }
        .textarea-wrapper:focus-within { box-shadow: 0 6px 20px rgba(102, 126, 234, 0.25); }
        textarea {
            width: 100%;
            height: 250px;
            padding: 20px;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 14px;
            resize: vertical;
            transition: all 0.3s ease;
            background-color: #f8f9fa;
        }
        textarea:focus { outline: none; border-color: #667eea; background-color: white; }
        .button-group {
            display: flex;
            gap: 15px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        button {
            padding: 16px 35px;
            font-size: 1.1rem;
            font-weight: 600;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            border: none;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        .btn-primary { background: var(--primary-gradient); color: white; flex: 1; }
        .btn-secondary { background: white; color: #636e72; border: 2px solid #e9ecef; }
        button:hover:not(:disabled) {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.35);
        }
        button:active:not(:disabled) { transform: translateY(1px); }
        button:disabled { opacity: 0.7; cursor: not-allowed; filter: grayscale(0.3); }
        .result-card { position: relative; animation: fadeInUp 0.5s ease-out; }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .result-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 8px;
            background: var(--success-gradient);
            border-radius: 20px 20px 0 0;
        }
        .score-container {
            text-align: center;
            padding: 35px 25px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            margin-bottom: 30px;
            position: relative;
        }
        .score-container::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: radial-gradient(rgba(255,255,255,0.1) 2px, transparent 2px);
            background-size: 30px 30px;
            border-radius: 15px;
            pointer-events: none;
        }
        .score-title { font-size: 1rem; color: #636e72; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; font-weight: 600; }
        .score-circle {
            width: 200px;
            height: 200px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 4rem;
            font-weight: bold;
            margin: 20px auto;
            color: white;
            position: relative;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        .score-circle::before {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: conic-gradient(var(--gradient-color) var(--score-percentage), #e9ecef 0);
            animation: spin 1s ease-out;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(var(--rotation-angle)); } }
        .status-badge {
            display: inline-block;
            padding: 10px 25px;
            border-radius: 30px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 1rem;
            margin-top: 15px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
            100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
        }
        .status-clean { background: var(--success-gradient); color: white; }
        .status-review { background: var(--warning-gradient); color: white; }
        .status-warning { background: var(--danger-gradient); color: white; }
        .score-text { font-size: 1.2rem; margin-top: 20px; color: #636e72; }
        .file-info {
            background: #f8f9fa;
            padding: 15px 20px;
            border-radius: 12px;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            gap: 15px;
            border-left: 4px solid var(--primary-gradient);
        }
        .file-icon {
            width: 40px;
            height: 40px;
            background: var(--primary-gradient);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.2rem;
        }
        .file-path { font-family: 'Courier New', Courier, monospace; color: #667eea; word-break: break-all; flex: 1; }
        .issues-counts {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .issue-stat { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 12px; transition: all 0.3s ease; }
        .issue-stat:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
        .stat-value { font-size: 2.2rem; font-weight: bold; margin-bottom: 8px; }
        .stat-label { font-size: 0.9rem; color: #636e72; text-transform: uppercase; letter-spacing: 1px; }
        .issues-section h3 { margin-bottom: 20px; color: #2d3436; font-size: 1.4rem; display: flex; align-items: center; gap: 10px; }
        .issues-list-container { max-height: 400px; overflow-y: auto; padding-right: 10px; }
        .issue-item {
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 12px;
            display: flex;
            align-items: flex-start;
            gap: 20px;
            transition: all 0.3s ease;
            border-left: 4px solid transparent;
        }
        .issue-item:hover { transform: translateX(5px); box-shadow: 0 5px 15px rgba(0,0,0,0.08); }
        .issue-item:last-child { margin-bottom: 0; }
        .issue-severity {
            font-weight: bold;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            min-width: 100px;
            text-align: center;
            flex-shrink: 0;
        }
        .severity-high { background: rgba(244, 67, 54, 0.1); color: #d32f2f; border: 1px solid #f44336; }
        .severity-medium { background: rgba(255, 152, 0, 0.1); color: #ff9800; border: 1px solid #ff9800; }
        .severity-low { background: rgba(33, 150, 243, 0.1); color: #2196f3; border: 1px solid #2196f3; }
        .issue-details { flex: 1; }
        .issue-message { font-size: 1rem; color: #2d3436; line-height: 1.5; margin-bottom: 10px; }
        .issue-info {
            display: flex;
            gap: 20px;
            font-size: 0.85rem;
            color: #636e72;
            align-items: center;
        }
        .category-badge {
            padding: 4px 10px;
            border-radius: 12px;
            background: #e9ecef;
            color: #636e72;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.75rem;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 12px;
            color: #636e72;
        }
        .empty-state-icon { font-size: 4rem; margin-bottom: 20px; }
        .loading-spinner { text-align: center; padding: 60px; display: none; animation: fadeInUp 0.5s ease-out; }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid var(--primary-gradient);
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        .error-message {
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid #f44336;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            color: #c62828;
            display: none;
            animation: fadeInUp 0.5s ease-out;
        }
        .error-message.show { display: block; }
        footer {
            text-align: center;
            margin-top: 50px;
            padding: 30px 20px;
            color: white;
            font-size: 1.1rem;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
        }
        .version {
            display: inline-block;
            padding: 8px 16px;
            background: rgba(255,255,255,0.2);
            border-radius: 20px;
            margin-top: 10px;
            font-size: 0.9rem;
        }
        .dark-mode-toggle {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 60px;
            height: 60px;
            background: var(--primary-gradient);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            z-index: 1000;
        }
        .dark-mode-toggle:hover { transform: scale(1.1) rotate(90deg); }
        @media (max-width: 768px) {
            h1 { font-size: 2rem; }
            .subtitle { font-size: 1.1rem; }
            .score-circle { width: 150px; height: 150px; font-size: 3rem; }
            .stat-value { font-size: 1.8rem; }
            .issues-list-container { max-height: 300px; }
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>VERIDEC</h1>
            <p class="subtitle">CI/CD Pre-Flight Check & Impact Predictor for AI-generated code. Analyze your code for quality, security, and impact before deployment.</p>
        </header>

        <div id="error-message" class="error-message"></div>

        <div class="dashboard-grid">
            <div class="card analysis-input">
                <h2><span class="icon">💻</span>Analyze Your Code</h2>
                <label for="codeInput">Paste your JavaScript or TypeScript code below:</label>
                <div class="textarea-wrapper">
                    <textarea id="codeInput" placeholder="// Paste your code here...

function example() {
    console.log('Hello World');
    return true;
}"></textarea>
                </div>
                <div class="button-group">
                    <button id="analyzeBtn" class="btn-primary"><span>🔍</span>Analyze Code</button>
                    <button id="clearBtn" class="btn-secondary">Clear</button>
                </div>
            </div>

            <div class="loading-spinner" id="loadingSpinner">
                <div class="spinner"></div>
                <p>Analyzing code... This may take a few seconds.</p>
                <p style="margin-top: 10px; font-size: 0.9rem; color: #636e72;">Checking for security issues, performance patterns, and code quality metrics.</p>
            </div>

            <div class="card result-card" id="resultCard">
                <h2><span class="icon">📊</span>Analysis Results</h2>
                <div class="score-container">
                    <p class="score-title">Impact Score</p>
                    <div class="score-circle" id="impactScore"><span class="score-value">0/100</span></div>
                    <p class="status-badge" id="statusBadge"></p>
                    <p class="score-text" id="scoreDescription">No analysis performed yet</p>
                    <div class="button-group" style="justify-content: center; margin-top: 20px;">
                        <button id="exportJsonBtn" class="btn-secondary"><span>📄</span>Export JSON</button>
                        <button id="copyResultsBtn" class="btn-secondary"><span>📋</span>Copy Summary</button>
                    </div>
                </div>

                <div class="file-info">
                    <div class="file-icon">📄</div>
                    <div><p style="margin: 0; font-size: 0.9rem; color: #636e72;">File Name</p><p class="file-path" id="fileName">unnamed-file.js</p></div>
                </div>

                <div class="issues-counts">
                    <div class="issue-stat"><div class="stat-value" style="color: #667eea;" id="totalIssues">0</div><div class="stat-label">Total Issues</div></div>
                    <div class="issue-stat"><div class="stat-value" style="color: #d32f2f;" id="highSeverity">0</div><div class="stat-label">High Severity</div></div>
                    <div class="issue-stat"><div class="stat-value" style="color: #ff9800;" id="mediumSeverity">0</div><div class="stat-label">Medium Severity</div></div>
                    <div class="issue-stat"><div class="stat-value" style="color: #2196f3;" id="lowSeverity">0</div><div class="stat-label">Low Severity</div></div>
                </div>

                <div class="issues-section">
                    <h3>Detected Issues</h3>
                    <div class="issues-list-container" id="issuesList">
                        <div class="empty-state"><div class="empty-state-icon">✅</div><p>No issues detected. Your code looks clean!</p><p style="font-size: 0.9rem; margin-top: 10px;">Great job! Your code passed all pre-flight checks.</p></div>
                    </div>
                </div>

                <div class="card" style="margin-top: 25px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);">
                    <h3 style="font-size: 1.2rem; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;"><span class="icon" style="width: 28px; height: 28px;">💡</span>Code Quality Tips</h3>
                    <div id="qualityTips">
                        <p style="color: #636e72; line-height: 1.6;">Based on your analysis, here are some recommendations to improve your code quality:</p>
                        <ul style="margin-top: 10px; padding-left: 20px; color: #636e72;"><li>Regularly review and refactor complex functions</li><li>Avoid using console.log statements in production code</li><li>Implement proper error handling for all critical operations</li></ul>
                    </div>
                </div>
            </div>
        </div>

        <footer>
            <p>VERIDEC v1.0.0 | Analyzes AI-generated code for CI/CD pre-flight checks</p>
            <span class="version">Pro Edition</span>
        </footer>
    </div>

    <div class="dark-mode-toggle" id="darkModeToggle">🌙</div>

    <script>
        const API_BASE_URL = '${MCP_SERVER_URL}';
        const analyzeBtn = document.getElementById('analyzeBtn');
        const clearBtn = document.getElementById('clearBtn');
        const codeInput = document.getElementById('codeInput');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const resultCard = document.getElementById('resultCard');
        const errorMessage = document.getElementById('error-message');
        const darkModeToggle = document.getElementById('darkModeToggle');
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        const copyResultsBtn = document.getElementById('copyResultsBtn');

        const impactScoreEl = document.getElementById('impactScore');
        const statusBadgeEl = document.getElementById('statusBadge');
        const scoreDescriptionEl = document.getElementById('scoreDescription');
        const fileNameEl = document.getElementById('fileName');
        const totalIssuesEl = document.getElementById('totalIssues');
        const highSeverityEl = document.getElementById('highSeverity');
        const mediumSeverityEl = document.getElementById('mediumSeverity');
        const lowSeverityEl = document.getElementById('lowSeverity');
        const issuesListEl = document.getElementById('issuesList');
        const qualityTipsEl = document.getElementById('qualityTips');

        let currentAnalysisResult = null;

        // Initialize dark mode based on system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.style.background = 'linear-gradient(to bottom, #1a1c2e 0%, #4a192c 50%, #3d1b4f 100%)';
            darkModeToggle.textContent = '☀️';
        }

        analyzeBtn.addEventListener('click', async () => {
            const code = codeInput.value.trim();
            
            if (!code) {
                showError('Please enter some code to analyze.');
                return;
            }

            hideError();
            loadingSpinner.style.display = 'block';
            resultCard.classList.remove('show');
            resultCard.classList.add('fade-in');
            analyzeBtn.disabled = true;

            try {
                const response = await fetch(API_BASE_URL + '/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, filePath: 'user-code.js' })
                });

                if (!response.ok) throw new Error('Analysis failed');

                const result = await response.json();
                currentAnalysisResult = result;
                displayResults(result);
                
            } catch (error) {
                showError("Analysis error: " + error.message + ". Make sure the VERIDEC server is running at " + API_BASE_URL);
                loadingSpinner.style.display = 'none';
                analyzeBtn.disabled = false;
            }
        });

        clearBtn.addEventListener('click', () => {
            codeInput.value = '';
            resultCard.classList.remove('show');
            currentAnalysisResult = null;
            hideError();
            
            document.documentElement.style.setProperty('--score-percentage', '0%');
            document.documentElement.style.setProperty('--rotation-angle', '-90deg');
            impactScoreEl.querySelector('.score-value').textContent = '0/100';
            statusBadgeEl.textContent = '';
            scoreDescriptionEl.textContent = 'No analysis performed yet';
            fileNameEl.textContent = 'unnamed-file.js';
            
            const emptyStateHtml = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <p>No issues detected. Your code looks clean!</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Paste your code above to begin analysis.</p>
                </div>`;
            
            totalIssuesEl.textContent = '0';
            highSeverityEl.textContent = '0';
            mediumSeverityEl.textContent = '0';
            lowSeverityEl.textContent = '0';
            issuesListEl.innerHTML = emptyStateHtml;
        });

        darkModeToggle.addEventListener('click', () => {
            const body = document.body;
            
            if (body.style.background.includes('#1a1c2e')) {
                body.style.background = 'linear-gradient(to bottom, #667eea 0%, #764ba2 50%, #f093fb 100%)';
                darkModeToggle.textContent = '🌙';
            } else {
                body.style.background = 'linear-gradient(to bottom, #1a1c2e 0%, #4a192c 50%, #3d1b4f 100%)';
                darkModeToggle.textContent = '☀️';
            }
        });

        exportJsonBtn.addEventListener('click', () => {
            if (!currentAnalysisResult) {
                showError('No analysis results to export. Please analyze code first.');
                return;
            }

            const jsonStr = JSON.stringify(currentAnalysisResult, null, 2);
            
            // Create download link
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `veridec-analysis-${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        copyResultsBtn.addEventListener('click', () => {
            if (!currentAnalysisResult) {
                showError('No analysis results to copy. Please analyze code first.');
                return;
            }

            const summary = `VERIDEC Analysis Results
=================================
File: ${currentAnalysisResult.filePath || 'unnamed-file.js'}
Impact Score: ${currentAnalysisResult.impactScore}/100
Status: ${currentAnalysisResult.status}
Total Issues: ${currentAnalysisResult.issueCount}

Issues by Severity:
- High: ${currentAnalysisResult.issues.filter(i => i.severity === 'high').length}
- Medium: ${currentAnalysisResult.issues.filter(i => i.severity === 'medium').length}
- Low: ${currentAnalysisResult.issues.filter(i => i.severity === 'low').length}

Summary:
${getStatusDescription(currentAnalysisResult.status, currentAnalysisResult.impactScore)}`;

            navigator.clipboard.writeText(summary)
                .then(() => {
                    const originalText = copyResultsBtn.innerHTML;
                    copyResultsBtn.innerHTML = '<span>✅</span>Copied!';
                    setTimeout(() => { copyResultsBtn.innerHTML = originalText; }, 2000);
                })
                .catch(err => showError('Failed to copy results to clipboard'));
        });

        function displayResults(results) {
            const impactScore = results.impactScore || 0;
            
            // Calculate percentage for gradient animation
            const percentage = (impactScore / 100);
            
            // Set rotation angle based on score
            let rotationAngle = -90;
            if (percentage > 0) {
                rotationAngle = -90 + (360 * percentage);
            }
            
            document.documentElement.style.setProperty('--score-percentage', `${percentage * 100}%`);
            document.documentElement.style.setProperty('--rotation-angle', `${rotationAngle}deg`);

            // Determine gradient color based on score
            let gradientColor;
            if (impactScore <= 25) {
                gradientColor = '#4caf50'; // Green
            } else if (impactScore <= 75) {
                gradientColor = '#ff9800'; // Orange
            } else {
                gradientColor = '#f44336'; // Red
            }
            
            document.documentElement.style.setProperty('--gradient-color', gradientColor);
            impactScoreEl.querySelector('.score-value').textContent = `${impactScore}/100`;
            
            // Update status badge
            const status = results.status || 'clean';
            statusBadgeEl.textContent = status.replace('_', ' ');
            statusBadgeEl.className = `status-badge status-${status}`;
            
            scoreDescriptionEl.textContent = getStatusDescription(status, impactScore);
            fileNameEl.textContent = results.filePath || 'unnamed-file.js';

            // Update issue counts
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

            // Update issues list
            if (issues.length > 0) {
                issuesListEl.innerHTML = issues.map(issue => `
                    <div class="issue-item">
                        <span class="issue-severity severity-${issue.severity}">${issue.severity}</span>
                        <div class="issue-details">
                            <p class="issue-message">${escapeHtml(issue.message)}</p>
                            <div class="issue-info">
                                <span>Line ${issue.line}:${issue.column}</span>
                                <span class="category-badge">${escapeHtml(issue.category)}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                issuesListEl.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">✅</div>
                        <p>No issues detected. Your code looks clean!</p>
                        <p style="font-size: 0.9rem; margin-top: 10px;">Great job! Your code passed all pre-flight checks.</p>
                    </div>`;
            }

            // Show results card
            resultCard.classList.add('show');

            // Update quality tips
            updateQualityTips(issues);

            loadingSpinner.style.display = 'none';
            analyzeBtn.disabled = false;
        }

        function getStatusDescription(status, score) {
            switch (status) {
                case 'clean': return '✅ Code passed all pre-flight checks';
                case 'review': return `⚠️ ${score} issues found. Review recommended before deployment`;
                case 'warning': return `❌ High impact detected (${score}). Manual review required`;
                default: return `${score}/100 impact score`;
            }
        }

        function updateQualityTips(issues) {
            const tips = [];
            
            if (issues.some(i => i.category === 'security')) {
                tips.push('🔒 <strong>Security:</strong> Review security-related issues before deployment');
            }
            
            if (issues.some(i => i.category === 'performance')) {
                tips.push('⚡ <strong>Performance:</strong> Consider optimizing performance-critical sections');
            }
            
            if (issues.some(i => i.severity === 'high')) {
                tips.push('⚠️ <strong>Critical:</strong> Address high-severity issues immediately');
            }
            
            if (issues.some(i => i.category === 'best_practices')) {
                tips.push('📚 <strong>Best Practices:</strong> Review coding standards and conventions');
            }
            
            // Add generic tips
            tips.push('🔄 <strong>Maintenance:</strong> Regular refactoring improves long-term maintainability');
            tips.push('🧪 <strong>Testing:</strong> Ensure comprehensive test coverage before deployment');

            qualityTipsEl.innerHTML = `
                <p style="color: #636e72; line-height: 1.6;">Based on your analysis, here are some recommendations to improve your code quality:</p>
                
                <ul style="margin-top: 10px; padding-left: 20px; color: #636e72; line-height: 1.8;">
                    ${tips.map(tip => `<li>${tip}</li>`).join('')}
                </ul>`;
        }

        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.classList.add('show');
            setTimeout(hideError, 5000);
        }

        function hideError() {
            errorMessage.classList.remove('show');
        }

        function escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
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