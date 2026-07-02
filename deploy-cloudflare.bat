
@echo off
echo === VERIDEC CLOUDFLARE WORKERS DEPLOYMENT ===
echo.
echo Step 1: Verifying project files...
if not exist "src/worker.js" (
    echo [ERROR] src/worker.js not found!
    exit /b 1
)
echo [OK] src/worker.js found

if not exist "wrangler.toml" (
    echo [ERROR] wrangler.toml not found!
    exit /b 1
)
echo [OK] wrangler.toml found

echo Step 2: Deploying to Cloudflare Workers...
wrangler deploy --compatibility-date=2024-01-01

if %errorlevel% equ 0 (
    echo.
    echo === DEPLOYMENT SUCCESSFUL ===
    echo.
    echo The updated VERIDEC dashboard should now be live at https://veridecai.com/
    echo.
    echo Note: Cloudflare cache may need a few minutes to update.
) else (
    echo.
    echo [ERROR] Deployment failed!
    echo Please check the errors above and try again.
)

pause
