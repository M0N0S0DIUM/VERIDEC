# VERIDEC Working Commands and Workflows

This document records the tested and working commands for implementing, testing, and managing the VERIDEC project.

## Project Setup Commands

```bash
# Navigate to project directory
cd C:\Users\msg33\OneDrive\Documents\GitHub\VERIDEC

# Install dependencies (with compatible versions)
npm install @fastify/cors@8.5.0 eslint-scope estraverse

# Alternative: install all required dependencies at once
npm install @fastify/cors@8.5.0 eslint-scope estraverse --save
```

## CLI Testing Commands

```bash
# Show help information
node src/cli.js --help

# Analyze a single file
node src/cli.js test.js

# Analyze all files in directory
node src/cli.js --directory src/

# Output as JSON for CI/CD integration
node src/cli.js test.js --json

# Save report to file
node src/cli.js test.js --output file

# Combine options
node src/cli.js --directory src/ --json > report.json
```

## MCP Server Commands

```bash
# Start the MCP server
node src/mcp.js

# With custom port (if needed)
MCP_PORT=3001 node src/mcp.js

# Check if server is running (in another terminal)
node src/mcp-client.js health

# Analyze a file via the MCP server
node src/mcp-client.js analyze test.js
```

## Package.json Scripts

```bash
# Start the main application
npm start

# Run with auto-reload during development
npm run dev

# Start the MCP server
npm run mcp

# Run CLI directly
npm run cli

# Start the MCP client
npm run client
```

## Testing Workflow

1. **Basic file analysis**:
   ```bash
   node src/cli.js test.js
   ```

2. **JSON output verification**:
   ```bash
   node src/cli.js test.js --json > report.json
   cat report.json  # or use a JSON viewer
   ```

3. **Server testing**:
   - Terminal 1: `node src/mcp.js`
   - Terminal 2: `node src/mcp-client.js health`
   - Terminal 2: `node src/mcp-client.js analyze test.js`

4. **Directory analysis**:
   ```bash
   node src/cli.js --directory src/
   ```

## Important Fixes Applied

### Fixed Module Import Issues
- Removed unused `escope` import from analyzer.js (was causing module not found errors)
- Updated import statement from:
  ```javascript
  const escope = require('escope');
  const eslintScope = require('eslint-scope');
  ```
  To:
  ```javascript
  // removed unused imports
  ```

### Fixed CORS Compatibility Issues
- Changed `@fastify/cors` version from `^9.0.1` to `^8.5.0`
- Version 9.0.1 was incompatible with fastify 5.x

### Server Binding Fix
- Changed server binding from `0.0.0.0` to `127.0.0.1` for Windows compatibility
- In mcp.js, changed:
  ```javascript
  await fastify.listen({ port, host: '0.0.0.0' });
  ```
  To:
  ```javascript
  await fastify.listen({ port, host: '127.0.0.1' });
  ```

## Git Workflow Commands

```bash
# Check status
git status

# Add all new/modified files
git add src/analyzer.js src/cli.js src/mcp-client.js src/mcp.js src/reporter.js README.md IMPLEMENTATION_NOTES.md PROJECT_SUMMARY.md QUICKSTART.md package.json

# Commit with descriptive message
git commit -m "Initial implementation of VERIDEC: CI/CD Pre-Flight Check & Impact Predictor for AI-generated code"

# Push to remote repository
git push origin main

# View recent commits
git log --oneline -5
```

## CI/CD Integration Commands

```yaml
# GitHub Actions example
- name: Run VERIDEC Analysis
  run: |
    npx veridec --directory src/ --json > report.json

# GitLab CI example
script:
  - npx veridec --directory src/ --json > report.json
artifacts:
  reports:
    json: report.json
```

## Troubleshooting Commands

```bash
# If port already in use (3000)
netstat -ano | findstr :3000
taskkill /PID <process_id> /F

# Check node version (must be >=18.0.0)
node --version

# Verify package installation
npm list @fastify/cors eslint-scope estraverse
```

## Verification Commands

```bash
# Test all components in sequence
node src/cli.js --help                    # CLI help
node src/cli.js test.js                   # Basic analysis
node src/cli.js test.js --json           # JSON output
node src/mcp-client.js health            # Server health check
node src/mcp-client.js analyze test.js   # API analysis
```