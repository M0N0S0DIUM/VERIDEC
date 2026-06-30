# VERIDEC Quick Start Guide

## Installation

```bash
npm install veridec
```

## Basic Usage

### Analyze a Single File

```bash
veridec path/to/file.js
```

**Example Output:**
```
VERIDEC Analysis Report
==================================================

File: C:\project\src\utils.js
Impact Score: 23/100
Status: review
Issues Found: 3

Issues:
------------------------------

Issue [LOW]
  Category: best_practices
  Severity: low
  Line: 5:1
  Message: Debug statement found: console.log

Issue [MEDIUM]
  Category: maintainability
  Severity: medium
  Line: 12:3
  Message: Complex conditional logic detected (complexity: 6)
```

### Analyze All Files in a Directory

```bash
veridec --directory src/
```

### JSON Output for CI/CD

```bash
veridec path/to/file.js --json > report.json
```

## Advanced Usage

### Start MCP Server (API)

```bash
npm run mcp
# Server starts on http://localhost:3000
```

### Use MCP Client

```bash
# Check server health
node src/mcp-client.js health

# Analyze a file
node src/mcp-client.js analyze path/to/file.js
```

## CI/CD Integration

### GitHub Actions Example

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
          npx veridec --directory src/ --json > report.json
          
      - name: Check Results
        run: |
          if [ $(cat report.json | jq '.summary.totalIssues') -gt 0 ]; then
            echo "Issues found, review required"
            exit 1
          fi
```

## Options

| Option | Description |
|--------|-------------|
| `-f, --file <path>` | Analyze a single file |
| `-d, --dir, --directory <path>` | Analyze all files in directory |
| `-o, --output <type>` | Output type (console, file) |
| `-j, --json` | Output results as JSON |
| `-h, --help` | Show help |

## Impact Score Guide

- **0-25**: Clean - Safe for automated deployment
- **26-75**: Review needed - Human review required
- **76-100**: High impact - Manual intervention required

## Common Issues Detected

### Security Issues
- `eval()` usage (high severity)
- Dynamic code execution (high severity)
- Unsafe React patterns (medium severity)

### Performance Issues
- Inefficient loops (medium severity)
- Memory-intensive operations (medium severity)
- Unnecessary async/await (low severity)

### Best Practices
- Debug statements left in code (low severity)
- AI-generated code indicators (medium severity)
- Complex conditional logic (medium severity)

## Getting Help

For more information, see the full [README.md](./README.md) and [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md).

## License

MIT