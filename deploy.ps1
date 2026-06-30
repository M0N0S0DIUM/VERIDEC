# VERIDEC Deployment Script for Windows
# This script provides simple deployment commands for different scenarios

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("local", "docker", "pm2", "heroku")]
    [string]$Option = "local"
)

Write-Host "=== VERIDEC Deployment Script ===" -ForegroundColor Cyan
Write-Host ""

function Show-Help {
    Write-Host "Usage: .\deploy.ps1 [option]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  local     Run VERIDEC locally (CLI or API server)" -ForegroundColor White
    Write-Host "  docker    Deploy using Docker" -ForegroundColor White
    Write-Host "  pm2       Deploy with PM2 process manager" -ForegroundColor White
    Write-Host "  heroku    Deploy to Heroku cloud platform" -ForegroundColor White
    Write-Host ""
}

function Test-CommandExists {
    param($command)
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'stop'
    try { if(Get-Command $command) {return $true} }
    catch {return $false}
    finally {$ErrorActionPreference=$oldPreference}
}

function Deploy-Local {
    Write-Host "Setting up VERIDEC locally..." -ForegroundColor Green
    
    # Check if Node.js is installed
    if (-not (Test-CommandExists "node")) {
        Write-Host "Error: Node.js is not installed. Please install Node.js 18 or higher." -ForegroundColor Red
        exit 1
    }
    
    $nodeVersion = node --version
    Write-Host "Node version: $nodeVersion" -ForegroundColor Cyan
    
    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Green
        npm install
    } else {
        Write-Host "Dependencies already installed." -ForegroundColor Yellow
    }
    
    # Check for required packages
    $requiredPackages = @("@fastify/cors", "@typescript-eslint/parser", "eslint-scope", "estraverse")
    foreach ($pkg in $requiredPackages) {
        $packageCheck = npm list $pkg 2>&1
        if ($packageCheck -match "empty") {
            Write-Host "Installing missing package: $pkg..." -ForegroundColor Green
            npm install $pkg
        }
    }
    
    Write-Host ""
    Write-Host "VERIDEC is ready for local use!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Available commands:" -ForegroundColor Yellow
    Write-Host "  - Run CLI analysis: node src/cli.js <file>" -ForegroundColor White
    Write-Host "  - Start API server: npm run mcp" -ForegroundColor White
    Write-Host "  - Test locally: node test-full.js" -ForegroundColor White
}

function Deploy-Docker {
    Write-Host "Setting up VERIDEC with Docker..." -ForegroundColor Green
    
    # Check if Docker is installed
    if (-not (Test-CommandExists "docker")) {
        Write-Host "Error: Docker is not installed. Please install Docker." -ForegroundColor Red
        exit 1
    }
    
    $dockerVersion = docker --version
    Write-Host "Docker version: $dockerVersion" -ForegroundColor Cyan
    
    # Create Dockerfile if it doesn't exist
    if (-not (Test-Path "Dockerfile")) {
        Write-Host "Creating Dockerfile..." -ForegroundColor Green
        
        $dockerFileContent = @'
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
'@
        
        $dockerFileContent | Out-File -FilePath Dockerfile -Encoding ascii
        Write-Host "Dockerfile created." -ForegroundColor Green
    }
    
    # Create .dockerignore if it doesn't exist
    if (-not (Test-Path ".dockerignore")) {
        Write-Host "Creating .dockerignore..." -ForegroundColor Green
        
        $dockerIgnoreContent = @'
node_modules
npm-debug.log
.git
.gitignore
*.md
test*
.env
'@
        
        $dockerIgnoreContent | Out-File -FilePath .dockerignore -Encoding ascii
        Write-Host ".dockerignore created." -ForegroundColor Green
    }
    
    # Build and run Docker container
    Write-Host ""
    Write-Host "Building Docker image..." -ForegroundColor Green
    docker build -t veridec .
    
    Write-Host ""
    Write-Host "Starting VERIDEC server..." -ForegroundColor Green
    
    $existingContainer = docker ps -a --filter name=veridec-server --format "{{.Names}}"
    if ($existingContainer -eq "veridec-server") {
        Write-Host "Stopping existing container..." -ForegroundColor Yellow
        docker stop veridec-server
        docker rm veridec-server
    }
    
    docker run -d `
        --name veridec-server `
        -p 3000:3000 `
        -e MCP_PORT=3000 `
        veridec
    
    Write-Host ""
    Write-Host "VERIDEC is now running in Docker!" -ForegroundColor Green
    Write-Host "Server URL: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Health check: curl http://localhost:3000/health" -ForegroundColor Cyan
}

function Deploy-PM2 {
    Write-Host "Setting up VERIDEC with PM2..." -ForegroundColor Green
    
    # Install PM2 globally if not installed
    $pm2Installed = npm list -g pm2 2>&1 | Select-String -Pattern "pm@"
    
    if (-not $pm2Installed) {
        Write-Host "Installing PM2 globally..." -ForegroundColor Green
        npm install -g pm2
    } else {
        Write-Host "PM2 is already installed." -ForegroundColor Yellow
    }
    
    # Check if ecosystem.config.js exists
    if (-not (Test-Path "ecosystem.config.js")) {
        Write-Host "Creating PM2 configuration file..." -ForegroundColor Green
        
        $configContent = @'
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
'@
        
        $configContent | Out-File -FilePath ecosystem.config.js -Encoding ascii
        Write-Host "ecosystem.config.js created." -ForegroundColor Green
    }
    
    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Green
        npm install
    }
    
    Write-Host ""
    Write-Host "Starting VERIDEC with PM2..." -ForegroundColor Green
    pm2 start ecosystem.config.js
    pm2 save
    pm2 status
    
    Write-Host ""
    Write-Host "VERIDEC is now running with PM2!" -ForegroundColor Green
    Write-Host "Server URL: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Log files will be stored in ~/.pm2/logs/" -ForegroundColor Yellow
}

function Deploy-Heroku {
    Write-Host "Setting up VERIDEC for Heroku deployment..." -ForegroundColor Green
    
    # Check if Heroku CLI is installed
    if (-not (Test-CommandExists "heroku")) {
        Write-Host "Error: Heroku CLI is not installed. Please install it from https://heroku.com/cli" -ForegroundColor Red
        exit 1
    }
    
    $herokuVersion = heroku version
    Write-Host "Heroku version: $herokuVersion" -ForegroundColor Cyan
    
    # Check if user is logged in
    try {
        heroku status | Out-Null
    } catch {
        Write-Host "You need to log in to Heroku first." -ForegroundColor Yellow
        heroku login
    }
    
    # Check for Git repository
    if (-not (Test-Path ".git")) {
        Write-Host "Initializing Git repository..." -ForegroundColor Green
        
        git init
        git add .
        git commit -m "Initial commit: VERIDEC deployment"
    }
    
    # Create Heroku app with unique name
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $appName = "veridec-$timestamp"
    
    Write-Host ""
    Write-Host "Creating Heroku app ($appName)..." -ForegroundColor Green
    heroku create $appName
    
    Write-Host ""
    Write-Host "Deploying to Heroku..." -ForegroundColor Green
    git push heroku main
    
    Write-Host ""
    Write-Host "Enabling web service..." -ForegroundColor Green
    heroku ps:scale web=1
    
    Write-Host ""
    Write-Host "VERIDEC is now deployed to Heroku!" -ForegroundColor Green
    Write-Host "App URL: https://$appName.herokuapp.com" -ForegroundColor Cyan
    Write-Host "Open with: heroku open" -ForegroundColor Yellow
}

# Main script logic
switch ($Option) {
    "local" { Deploy-Local }
    "docker" { Deploy-Docker }
    "pm2" { Deploy-PM2 }
    "heroku" { Deploy-Heroku }
    default { 
        Write-Host "Error: Unknown option '$Option'" -ForegroundColor Red
        Show-Help
        exit 1
    }
}

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green