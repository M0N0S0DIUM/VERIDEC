# VERIDEC Deployment Quick Start

## For Individual Developers (Get Started in 5 Minutes)

### Option 1: Local CLI Only (Easiest)
```bash
npm install veridec -g
veridec path/to/file.js
```

### Option 2: Local API Server (For Integration)
```bash
# Clone and setup
git clone https://github.com/M0N0S0DIUM/VERIDEC.git
cd VERIDEC
npm install

# Start server
npm run mcp
# Server runs on http://localhost:3000
```

## For Teams (Self-Hosted)

### Using Docker (Recommended)
```bash
# Clone the repository
git clone https://github.com/M0N0S0DIUM/VERIDEC.git
cd VERIDEC

# Create Dockerfile and .dockerignore (see HOSTING_GUIDE.md)

# Build and run
docker build -t veridec .
docker run -d -p 3000:3000 --name veridec-server veridec
```

### Using PM2 (Process Manager)
```bash
npm install -g pm2
npm install

# Create ecosystem.config.js (see HOSTING_GUIDE.md)
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable auto-start on reboot
```

## For Organizations (Cloud Deployment)

### Heroku (Simplest Cloud Option)
```bash
heroku login
heroku create veridec-yourcompany
git push heroku main
heroku open  # Opens the deployed app
```

### AWS Elastic Beanstalk (Enterprise Ready)
```bash
eb init  # Follow prompts to configure
eb create veridec-env
eb deploy
eb open  # Opens the deployed application
```

## API Usage After Deployment

Once your VERIDEC server is running, use it via:

```bash
# Check health
curl http://localhost:3000/health

# Analyze code
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"code":"function test() {}", "filePath":"test.js"}'
```

## Cost Summary

| Deployment Type | Estimated Cost |
|----------------|----------------|
| Local (your machine) | $0 |
| Docker on VPS | ~$5-12/month |
| Heroku Free Tier | $0 (limited) |
| Heroku Basic | ~$7-25/month |
| AWS/GCP/Azure | ~$5-50/month |

## Next Steps

1. **Test locally**: Verify VERIDEC works as expected
2. **Choose deployment**: Pick the method that fits your needs
3. **Deploy**: Follow the appropriate guide above
4. **Integrate**: Add to your CI/CD pipeline
5. **Monitor**: Set up logging and alerts for production use

For detailed instructions, see `HOSTING_GUIDE.md` in this repository.