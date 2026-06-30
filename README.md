# VERIDEC

**VERIDEC** (CI/CD Pre-Flight Check & Impact Predictor) is a tool designed to analyze AI-generated code before deployment. It helps development teams assess the quality, security, and potential impact of AI-assisted code changes in their CI/CD pipelines.

## Features

- **Code Analysis**: Analyze JavaScript/TypeScript files for common issues
- **AI Pattern Detection**: Identify patterns commonly found in AI-generated code
- **Security Checks**: Detect potential security vulnerabilities
- **Performance Assessment**: Identify performance anti-patterns
- **Impact Scoring**: Calculate an impact score (0-100) to assess risk level
- **Multiple Output Formats**: Console reports and JSON for integration with CI/CD systems
- **Visual Dashboard**: Interactive web interface for code analysis

## Installation

```bash
npm install veridec
```

## Usage

### Command Line Interface

#### Basic Analysis

Analyze a single file:
```bash
veridec path/to/file.js
```

Analyze all files in a directory:
```bash
veridec --directory src/
```

#### Output Formats

Get JSON output for CI/CD integration:
```bash
veridec path/to/file.js --json
```

Save report to file:
```bash
veridec path/to/file.js --output file
```

### Programmatic Usage

```javascript
const veridec = require('veridec');

// Analyze code directly
const code = `function hello() { console.log("Hello World"); }`;
const result = await veridec.analyzeCode(code, 'hello.js');

console.log(`Issues found: ${result.issueCount}`);
console.log(`Impact score: ${result.impactScore}/100`);
console.log(`Status: ${result.status}`);

// Get a formatted report
const report = veridec.generateReport(result);
console.log(report);

// For multiple files
const results = [
  { filePath: 'file1.js', code: '...' },
  { filePath: 'file2.js', code: '...' }
];

const analysisResults = await Promise.all(
  results.map(async (file) => ({
    filePath: file.filePath,
    ...await veridec.analyzeCode(file.code, file.filePath)
  }))
);

const summaryReport = veridec.generateReport(analysisResults);
console.log(summaryReport);
```

### API Server

Start the MCP server for remote analysis:

```bash
npm run mcp
```

The server will start on port 3000 by default with these endpoints:

- `GET /health` - Health check
- `POST /analyze` - Analyze a single file (body: `{ code, filePath }`)
- `POST /analyze/batch` - Batch analyze files (body: `{ files: [{code, filePath}] }`)
- `POST /impact` - Get impact assessment (body: `{ results: [...] }`)

## Analysis Categories

### Security Issues
- Detection of dangerous patterns like `eval()` usage
- Identification of unsafe React patterns
- Dynamic code execution warnings

### Performance Issues
- Inefficient loop patterns
- Memory-intensive operations
- Unnecessary re-renders or processing

### Maintainability Issues
- Complex conditional logic
- Code duplication detection
- Naming convention violations

### Best Practices
- AI-generated code identification
- Debug statement detection (console.log, etc.)
- Missing error handling

## Impact Scoring

VERIDEC calculates an impact score from 0-100:

- **0-25**: Low impact - safe for automated deployment
- **26-75**: Medium impact - requires human review
- **76-100**: High impact - manual intervention required

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
          npx veridec --directory src/ --json > veridec-report.json
          
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: veridec-report
          path: veridec-report.json
```

### GitLab CI Example

```yaml
veridec_analysis:
  stage: test
  script:
    - npm install veridec
    - npx veridec --directory src/ --json > report.json
  artifacts:
    reports:
      json: report.json
  allow_failure: false
```

## Configuration Options

Future versions will support configuration files for customizing analysis rules and thresholds.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Uses [@typescript-eslint/parser](https://github.com/typescript-eslint/typescript-eslint) for AST parsing
- Built with [Fastify](https://www.fastify.io/) for the API server