cd /d C:\Users\msg33\Documents\GitHub\VERIDEC
git add .
git commit -m "Fix Cloudflare Workers deployment" -m "- Create workers-friendly-analyzer.js for Cloudflare Workers compatibility" -m "- Update worker.js to use new lightweight analyzer" -m "- Remove problematic @typescript-eslint/parser dependency chain" -m "- Rename Node.js-specific files to .cjs extension" -m "- Add documentation and test files"
git push origin main
