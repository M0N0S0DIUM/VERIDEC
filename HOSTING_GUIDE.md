# VERIDEC Hosting Guide

This guide explains how to deploy and host VERIDEC for personal or organizational use.

## Understanding Your Options

VERIDEC can be deployed in several ways, depending on your needs:

### 1. Local Development (Quick Start)
**Best for**: Individual developers testing the tool

- **How it works**: Run directly on your machine
- **Pros**: Fast setup, no infrastructure needed
- **Cons**: Limited to local access only

```bash
# Install dependencies
npm install veridec

# Use CLI locally
npx veridec path/to/file.js

# Or start the API server locally
npm run mcp  # Runs on http://localhost:3000
```

### 2. Self-Hosted Server
**Best for**: Teams wanting private deployment with web access

- **How it works**: Run VERIDEC server on your own infrastructure
- **Pros**: Full control, private data, team access
- **Cons**: Requires server management

### 3. Cloud Hosting
**Best for**: Organizations wanting managed solutions with scalability

- **How it works**: Deploy to cloud platforms (AWS, GCP, Azure)
- **Pros**: Scalability, reliability, professional hosting
- **Cons**: Ongoing costs, setup complexity

## Deployment Methods

### Method 1: Docker Containerization

**Step 1**: Create a Dockerfile

Create `Dockerfile` in your project directory:

```dockerfile
# Use Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY src/ ./src/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S veridec -u 1001

# Change ownership
RUN chown -R veridec:nodejs /app

# Switch to non-root user
USER veridec

# Expose the MCP server port
EXPOSE 3000

# Set environment variables
ENV MCP_PORT=3000
ENV NODE_ENV=production

# Start the application
CMD ["node", "src/mcp.js"]
```

**Step 2**: Create a .dockerignore file

Create `.dockerignore`:

```
node_modules
npm-debug.log
.git
.gitignore
*.md
test*
.env
```

**Step 3**: Build and run

```bash
# Build the image
docker build -t veridec .

# Run the container
docker run -d \
  --name veridec-server \
  -p 3000:3000 \
  -e MCP_PORT=3000 \
  veridec

# Test the server
curl http://localhost:3000/health
```

**Step 4**: Docker Compose (Optional)

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  veridec:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MCP_PORT=3000
      - NODE_ENV=production
    restart: unless-stopped
```

Then run:

```bash
docker-compose up -d
```

### Method 2: Direct Node.js Deployment

**Step 1**: Prepare for production

```bash
# Set environment to production
npm install --production

# Install PM2 (process manager)
npm install -g pm2
```

**Step 2**: Start with PM2

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'veridec',
    script: 'src/mcp.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      MCP_PORT: process.env.PORT || 3000
    }
  }]
};
```

Then start:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Method 3: Cloud Platform Deployment

#### Option A: Heroku

**Step 1**: Create a Procfile

Create `Procfile`:

```
web: node src/mcp.js
```

**Step 2**: Add Heroku deployment scripts

Update `package.json`:

```json
{
  "scripts": {
    "start": "node src/mcp.js",
    "heroku-postbuild": "npm install --production"
  }
}
```

**Step 3**: Deploy

```bash
# Login to Heroku
heroku login

# Create new app
heroku create veridec-yourname

# Set environment variables
heroku config:set MCP_PORT=3000 NODE_ENV=production

# Deploy
git push heroku main
```

#### Option B: AWS Elastic Beanstalk

**Step 1**: Initialize EB

```bash
# Install EB CLI if not already installed
pip install awsebcli

# Initialize in your project directory
eb init
```

**Step 2**: Create environment configuration

Create `.aws/commands/config.yml`:

```yaml
branch-defaults:
  default:
    environment: veridec-env
    group_name: veridec-app
global:
  application_name: veridec
  branch: null
  repository: null
  sc: null
```

**Step 3**: Deploy

```bash
# Create and deploy to new environment
eb create

# Or deploy to existing environment
eb deploy
```

#### Option C: Google Cloud Run

Create `Dockerfile` (same as Method 1), then:

```bash
# Build and push container to Artifact Registry
gcloud builds submit --tag gcr.io/PROJECT-ID/veridec

# Deploy to Cloud Run
gcloud run deploy veridec \
  --image gcr.io/PROJECT-ID/veridec \
  --platform managed \
  --region REGION \
  --allow-unauthenticated \
  --port 3000
```

#### Option D: Azure Container Instances

```bash
# Login to Azure CLI
az login

# Create resource group
az group create --name veridec-rg --location eastus

# Deploy container instance
az container create \
  --resource-group veridec-rg \
  --name veridec \
  --image YOUR_REGISTRY/veridec:latest \
  --ports 3000 \
  --protocol Tcp \
  --cpu 1 \
  --memory 2 \
  --environment-variables MCP_PORT=3000 NODE_ENV=production
```

## Advanced Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | `3000` | Port for the API server |
| `NODE_ENV` | `development` | Node environment (production recommended) |
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, debug) |

### Security Configuration

#### HTTPS/SSL Setup

Create a secure production configuration:

```javascript
// mcp-secure.js
const Fastify = require('fastify');
const fs = require('fs');
const path = require('path');

const SSL_OPTIONS = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'private.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'certificate.crt'))
};

async function startSecureServer() {
  const fastify = Fastify({
    logger: true,
    https: SSL_OPTIONS
  });

  // ... (rest of server setup)

  await fastify.listen({ 
    port: process.env.PORT || 443, 
    host: '0.0.0.0' 
  });
}

startSecureServer();
```

#### Authentication

Add authentication middleware:

```javascript
// Add to mcp.js after Fastify initialization
fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET || 'veridec-secret-key'
});

// Protected route example
fastify.addHook('onRequest', async (request, reply) => {
  if (request.url !== '/health') {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  }
});
```

## Monitoring and Maintenance

### Logging

VERIDEC uses Fastify's built-in logging. For production:

```bash
# PM2 with JSON logging
pm2 start ecosystem.config.js --log-date-format="YYYY-MM-DD HH:mm:ss Z" \
  --output ./logs/out.log \
  --error ./logs/error.log \
  --merge-logs \
  --log-type json
```

### Health Checks

Create a monitoring endpoint:

```javascript
// Add to mcp.js
fastify.get('/monitoring/health', async (request, reply) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  
  return health;
});
```

### Backup Strategy

For production deployments:

1. **Configuration backups**: Backup `.env` files and configs
2. **Database backups** (if added later): Set up regular backups
3. **Log rotation**: Configure logrotate for production logs

## Cost Considerations

### Free Options
- **Local development**: No cost
- **Heroku free tier**: Limited hours/month, no custom domains
- **GitHub Pages**: Static hosting only (not suitable for API)

### Low-Cost Options (~$5-20/month)
- **DigitalOcean droplet**: $5-12/month
- **Linode**: ~$10/month
- **AWS EC2 t3.micro**: ~$7/month (under free tier limits)

### Enterprise Options ($50+/month)
- **Managed Kubernetes**: $50-200/month
- **Cloud Run/Functions**: Pay-per-use, starts at ~$5/month
- **Heroku Professional**: $25-100/month

## Scaling Considerations

### Horizontal Scaling
For high-volume deployments:

```javascript
// Use cluster mode for multiple CPU cores
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  startServer();
}
```

### Caching Strategy

Add caching for repeated analyses:

```javascript
// In mcp.js, add Redis caching
const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Cache analysis results by hash
fastify.post('/analyze', async (request, reply) => {
  const { code } = request.body;
  const hash = require('crypto').createHash('md5').update(code).digest('hex');
  
  // Check cache first
  const cached = await client.get(`analysis:${hash}`);
  if (cached) return JSON.parse(cached);
  
  // If not cached, analyze and store
  const result = await analyzeCode(code);
  await client.setEx(`analysis:${hash}`, 3600, JSON.stringify(result));
  
  return result;
});
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port
   lsof -i :3000
   
   # Or change port in environment variables
   MCP_PORT=3001 npm run mcp
   ```

2. **Module not found errors**
   ```bash
   # Ensure all dependencies are installed
   npm install
   
   # Check node version (needs >= 18)
   node --version
   ```

3. **Connection refused**
   - Verify server is running: `pm2 status` or `docker ps`
   - Check firewall settings
   - Confirm correct port in client configuration

### Debug Mode

```bash
# Verbose logging
NODE_ENV=development DEBUG=* npm run mcp

# With PM2
PM2_LOG_DATE_FORMAT="YYYY-MM-DD HH:mm:ss Z" \
  PM2_LOG_TYPE="json" \
  pm2 start ecosystem.config.js
```

## Maintenance Checklist

- [ ] Regular dependency updates (`npm outdated`, `npm update`)
- [ ] Log monitoring and alerting setup
- [ ] Security audits (run `npm audit`)
- [ ] Backup configuration files
- [ ] Test failover procedures
- [ ] Update documentation with changes

## Next Steps

1. **Start small**: Deploy locally first to understand the tool
2. **Prototype**: Try one deployment method (Docker recommended)
3. **Test**: Verify all endpoints work in your environment
4. **Scale**: Move to production deployment when ready
5. **Monitor**: Set up logging and alerting for production use

## Support Resources

- GitHub Issues: https://github.com/M0N0S0DIUM/VERIDEC/issues
- Documentation: See README.md for usage examples
- Source code: All JavaScript files in src/ directory are well-commented

By following this guide, you can deploy VERIDEC in whatever way best suits your needs - from simple local development to enterprise-grade cloud hosting.