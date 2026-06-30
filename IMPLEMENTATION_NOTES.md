# VERIDEC Implementation Notes

This document provides detailed information about the implementation of VERIDEC (CI/CD Pre-Flight Check & Impact Predictor).

## Project Structure

```
VERIDEC/
├── src/
│   ├── index.js       # Main entry point that exports all modules
│   ├── cli.js         # Command-line interface for local analysis
│   ├── analyzer.js    # Core code analysis logic using AST parsing
│   ├── reporter.js    # Report generation (text and JSON formats)
│   └── mcp.js         # MCP server for remote API access
│   └── mcp-client.js  # Client for interacting with the MCP server
├── package.json       # Project dependencies and scripts
└── README.md          # User documentation

## Core Components

### 1. Analyzer (src/analyzer.js)

The analyzer is the heart of VERIDEC, responsible for parsing code and identifying issues.

#### Features:
- **AST Parsing**: Uses `@typescript-eslint/parser` to parse JavaScript/TypeScript into Abstract Syntax Trees
- **Pattern Detection**: Identifies common patterns in AI-generated code
- **Security Checks**: Detects potentially dangerous patterns (eval(), dynamic code execution)
- **Performance Analysis**: Identifies inefficient code patterns

#### Analysis Process:
1. Parse source code into an AST
2. Traverse the AST to identify structural issues
3. Scan for text-based patterns (console.log statements, AI indicators)
4. Check security and performance anti-patterns
5. Calculate impact score based on detected issues

### 2. CLI (src/cli.js)

The command-line interface provides local code analysis capabilities.

#### Usage:
```bash
# Analyze a single file
veridec path/to/file.js

# Analyze all files in directory
veridec --directory src/

# Output as JSON for CI/CD integration
veridec path/to/file.js --json
```

#### Features:
- File and directory analysis
- Multiple output formats (text, JSON)
- Detailed reporting with severity levels

### 3. Reporter (src/reporter.js)

Handles formatting of analysis results.

#### Features:
- **Text Reports**: Human-readable console output with colored severity indicators
- **JSON Reports**: Machine-readable format for CI/CD integration
- **Impact Assessment**: Summary statistics and overall status

### 4. MCP Server (src/mcp.js)

Provides a REST API for remote code analysis.

#### Endpoints:
- `GET /health` - Health check
- `POST /analyze` - Analyze single file
- `POST /analyze/batch` - Batch analyze multiple files
- `POST /impact` - Get impact assessment

#### API Example:
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"code":"function test() {}","filePath":"test.js"}'
```

### 5. MCP Client (src/mcp-client.js)

Provides a programmatic interface to the MCP server.

#### Usage:
```bash
# Check server health
node src/mcp-client.js health

# Analyze a file
node src/mcp-client.js analyze path/to/file.js
```

## Analysis Categories

### Security Issues
- Detection of `eval()` usage
- Identification of unsafe React patterns (`dangerouslySetInnerHTML`)
- Dynamic code execution warnings

### Performance Issues
- Inefficient loop patterns (for-in on arrays)
- Memory-intensive operations (spread operators with large arrays)
- Unnecessary async/await usage

### Maintainability Issues
- Complex conditional logic detection
- Code duplication indicators
- Excessive nesting levels

### Best Practices
- AI-generated code identification
- Debug statement detection (console.log, etc.)
- Missing error handling patterns

## Impact Scoring System

VERIDEC uses a 0-100 impact score to assess code quality:

- **0-25**: Low impact - safe for automated deployment
- **26-75**: Medium impact - requires human review
- **76-100**: High impact - manual intervention required

Severity weights:
- High: 25 points
- Medium: 10 points
- Low: 3 points

## CI/CD Integration Examples

### GitHub Actions
```yaml
name: VERIDEC Analysis
on:
  pull_request:
    branches: [ main ]

jobs:
  veridec-check:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install VERIDEC
        run: npm install veridec
        
      - name: Run VERIDEC Analysis
        run: |
          npx veridec --directory src/ --json > veridec-report.json
```

### GitLab CI
```yaml
veridec_analysis:
  stage: test
  script:
    - npm install veridec
    - npx veridec --directory src/ --json > report.json
  artifacts:
    reports:
      json: report.json
```

## Future Enhancements

1. **Configuration Options**:
   - Custom rule definitions
   - Threshold adjustments
   - File exclusion patterns

2. **Enhanced Analysis**:
   - Type checking integration
   - Dependency analysis
   - Test coverage assessment

3. **Reporting Improvements**:
   - Markdown report generation
   - HTML dashboard
   - Slack/Teams integration

## Troubleshooting

### Common Issues

1. **Module Not Found Errors**:
   ```bash
   npm install
   ```

2. **Port Already in Use**:
   ```bash
   # Change MCP server port
   MCP_PORT=3001 node src/mcp.js
   ```

3. **Parsing Errors**:
   - Ensure code is valid JavaScript/TypeScript
   - Check for syntax errors in the source file

## License

MIT License