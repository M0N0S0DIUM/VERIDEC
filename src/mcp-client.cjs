#!/usr/bin/env node

/**
 * MCP Client for VERIDEC
 * Allows external tools to interact with the VERIDEC analysis service
 */

const http = require('http');

class VeridecMCPClient {
  constructor(host = 'localhost', port = 3000) {
    this.host = host;
    this.port = port;
    this.baseUrl = `http://${host}:${port}`;
  }

  async _request(path, method = 'GET', data = null) {
    const options = {
      hostname: this.host,
      port: this.port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        
        res.on('data', chunk => {
          body += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode >= 400) {
              reject(new Error(parsed.error || `Request failed with status ${res.statusCode}`));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            resolve(body);
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async healthCheck() {
    try {
      const result = await this._request('/health');
      return result;
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message 
      };
    }
  }

  async analyzeFile(code, filePath = 'unnamed-file') {
    const data = {
      code,
      filePath
    };

    try {
      const result = await this._request('/analyze', 'POST', data);
      return result;
    } catch (error) {
      return {
        error: error.message,
        issues: [],
        impactScore: 0
      };
    }
  }

  async analyzeFiles(files) {
    const data = {
      files: files.map((file, index) => ({
        code: file.code || '',
        filePath: file.filePath || `unnamed-file-${index}`
      }))
    };

    try {
      const result = await this._request('/analyze/batch', 'POST', data);
      return result;
    } catch (error) {
      return files.map((file, index) => ({
        filePath: file.filePath || `unnamed-file-${index}`,
        error: error.message,
        issues: [],
        impactScore: 0
      }));
    }
  }

  async getImpactAssessment(results) {
    const data = {
      results
    };

    try {
      const result = await this._request('/impact', 'POST', data);
      return result;
    } catch (error) {
      return {
        error: error.message,
        status: 'unknown',
        impactScore: null
      };
    }
  }

  async isServerRunning() {
    const health = await this.healthCheck();
    return health.healthy === true || health.status === 'healthy';
  }
}

module.exports = VeridecMCPClient;

if (require.main === module) {
  const args = process.argv.slice(2);
  const client = new VeridecMCPClient();

  if (args.length === 0) {
    console.log('VERIDEC MCP Client');
    console.log('Usage: veridec-client [command] [options]');
    console.log('');
    console.log('Commands:');
    console.log('  health              Check server health');
    console.log('  analyze <file>      Analyze a file');
    console.log('  batch <dir>         Analyze all files in directory');
    process.exit(1);
  }

  const command = args[0];

  switch (command) {
    case 'health':
      client.healthCheck()
        .then(result => {
          if (result.healthy || result.status === 'healthy') {
            console.log('✓ VERIDEC server is running');
            process.exit(0);
          } else {
            console.log('✗ VERIDEC server is not running');
            console.log('Start it with: npm run mcp');
            process.exit(1);
          }
        })
        .catch(error => {
          console.log('✗ Error connecting to server:', error.message);
          process.exit(1);
        });
      break;

    case 'analyze':
      if (args.length < 2) {
        console.error('Error: Please provide a file path');
        process.exit(1);
      }

      const fs = require('fs');
      const filePath = args[1];
      
      try {
        const code = fs.readFileSync(filePath, 'utf8');
        
        client.analyzeFile(code, filePath)
          .then(result => {
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
          })
          .catch(error => {
            console.error('Analysis failed:', error.message);
            process.exit(1);
          });
      } catch (error) {
        console.error('Error reading file:', error.message);
        process.exit(1);
      }
      break;

    case 'batch':
      if (args.length < 2) {
        console.error('Error: Please provide a directory path');
        process.exit(1);
      }

      const dirPath = args[1];
      
      try {
        const fs = require('fs');
        const path = require('path');
        
        const files = fs.readdirSync(dirPath).filter(file => 
          file.endsWith('.js') || file.endsWith('.ts') ||
          file.endsWith('.jsx') || file.endsWith('.tsx')
        );
        
        const fileContents = files.map(file => ({
          filePath: path.join(dirPath, file),
          code: fs.readFileSync(path.join(dirPath, file), 'utf8')
        }));
        
        client.analyzeFiles(fileContents)
          .then(results => {
            console.log(JSON.stringify(results, null, 2));
            process.exit(0);
          })
          .catch(error => {
            console.error('Batch analysis failed:', error.message);
            process.exit(1);
          });
      } catch (error) {
        console.error('Error reading directory:', error.message);
        process.exit(1);
      }
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}
