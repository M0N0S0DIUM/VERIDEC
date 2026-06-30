#!/bin/bash

# VERIDEC Deployment Script
# This script provides simple deployment commands for different scenarios

set -e  # Exit on any error

echo "=== VERIDEC Deployment Script ==="
echo ""

# Function to display usage information
show_help() {
    echo "Usage: ./deploy.sh [option]"
    echo ""
    echo "Options:"
    echo "  local          Run VERIDEC locally (CLI or API server)"
    echo "  docker         Deploy using Docker"
    echo "  pm2            Deploy with PM2 process manager"
    echo "  heroku         Deploy to Heroku cloud platform"
    echo "  help           Show this help message"
    echo ""
}

# Function for local deployment
deploy_local() {
    echo "Setting up VERIDEC locally..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    
    echo "Node version: $(node --version)"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    else
        echo "Dependencies already installed."
    fi
    
    # Check for required packages
    local required_packages="@fastify/cors @typescript-eslint/parser eslint-scope estraverse"
    for pkg in $required_packages; do
        if ! npm list "$pkg" &> /dev/null; then
            echo "Installing missing package: $pkg..."
            npm install "$pkg"
        fi
    done
    
    echo ""
    echo "VERIDEC is ready for local use!"
    echo ""
    echo "Available commands:"
    echo "  - Run CLI analysis: node src/cli.js <file>"
    echo "  - Start API server: npm run mcp"
    echo "  - Test locally: node test-full.js"
}

# Function for Docker deployment
deploy_docker() {
    echo "Setting up VERIDEC with Docker..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed. Please install Docker."
        exit 1
    fi
    
    echo "Docker version: $(docker --version)"
    
    # Create Dockerfile if it doesn't exist
    if [ ! -f "Dockerfile" ]; then
        echo "Creating Dockerfile..."
        cat > Dockerfile << 'EOF'
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
EOF
        
        echo "Dockerfile created."
    fi
    
    # Create .dockerignore if it doesn't exist
    if [ ! -f ".dockerignore" ]; then
        echo "Creating .dockerignore..."
        cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
.git
.gitignore
*.md
test*
.env
EOF
        
        echo ".dockerignore created."
    fi
    
    # Build and run Docker container
    echo ""
    echo "Building Docker image..."
    docker build -t veridec .
    
    echo ""
    echo "Starting VERIDEC server..."
    docker run -d \
        --name veridec-server \
        -p 3000:3000 \
        -e MCP_PORT=3000 \
        veridec
    
    echo ""
    echo "VERIDEC is now running in Docker!"
    echo "Server URL: http://localhost:3000"
    echo "Health check: curl http://localhost:3000/health"
}

# Function for PM2 deployment
deploy_pm2() {
    echo "Setting up VERIDEC with PM2..."
    
    # Install PM2 globally if not installed
    if ! npm list -g pm2 &> /dev/null; then
        echo "Installing PM2 globally..."
        npm install -g pm2
    else
        echo "PM2 is already installed."
    fi
    
    # Check if ecosystem.config.js exists
    if [ ! -f "ecosystem.config.js" ]; then
        echo "Creating PM2 configuration file..."
        cat > ecosystem.config.js << 'EOF'
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
EOF
        
        echo "ecosystem.config.js created."
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    echo ""
    echo "Starting VERIDEC with PM2..."
    pm2 start ecosystem.config.js
    pm2 save
    pm2 status
    
    echo ""
    echo "VERIDEC is now running with PM2!"
    echo "Server URL: http://localhost:3000"
    echo "Log files will be stored in ~/.pm2/logs/"
}

# Function for Heroku deployment
deploy_heroku() {
    echo "Setting up VERIDEC for Heroku deployment..."
    
    # Check if Heroku CLI is installed
    if ! command -v heroku &> /dev/null; then
        echo "Error: Heroku CLI is not installed. Please install it from https://heroku.com/cli"
        exit 1
    fi
    
    echo "Heroku version: $(heroku version)"
    
    # Check if user is logged in
    if ! heroku status &> /dev/null; then
        echo "You need to log in to Heroku first."
        heroku login
        
        if [ $? -ne 0 ]; then
            echo "Heroku login failed. Please try again."
            exit 1
        fi
    fi
    
    # Check for Git repository
    if [ ! -d ".git" ]; then
        echo "Initializing Git repository..."
        git init
        git add .
        git commit -m "Initial commit: VERIDEC deployment"
    fi
    
    # Check if Heroku app already exists
    APP_NAME="veridec-$(date +%s)"
    
    echo ""
    echo "Creating Heroku app ($APP_NAME)..."
    heroku create $APP_NAME
    
    echo ""
    echo "Deploying to Heroku..."
    git push heroku main
    
    echo ""
    echo "Enabling web service..."
    heroku ps:scale web=1
    
    echo ""
    echo "VERIDEC is now deployed to Heroku!"
    echo "App URL: https://$APP_NAME.herokuapp.com"
    echo "Open with: heroku open"
}

# Main script logic
case "${1:-local}" in
    local)
        deploy_local
        ;;
    docker)
        deploy_docker
        ;;
    pm2)
        deploy_pm2
        ;;
    heroku)
        deploy_heroku
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Error: Unknown option '$1'"
        show_help
        exit 1
        ;;
esac

echo ""
echo "=== Deployment Complete ==="