# Simple Render Deployment Script
$RENDER_API_KEY = "rnd_Rz1gW2ucse023edwzfAgZpr1odCt"

Write-Host "🚀 Deploying HRMS Backend to Render..." -ForegroundColor Green

# Create JSON payload file
$jsonPayload = @"
{
  "type": "web_service",
  "name": "hrms-backend",
  "repo": "https://github.com/codebyArya-bit/HRMS_Backend",
  "branch": "main",
  "buildCommand": "npm install && npx prisma generate",
  "startCommand": "npm start",
  "plan": "free",
  "region": "oregon",
  "runtime": "node",
  "numInstances": 1,
  "envVars": [
    {
      "key": "NODE_ENV",
      "value": "production"
    },
    {
      "key": "DATABASE_URL",
      "value": "file:./production.db"
    },
    {
      "key": "JWT_SECRET",
      "value": "supersecretjwtkey"
    },
    {
      "key": "GEMINI_API_KEY",
      "value": "AIzaSyDw4WGI78XEIgJVcCJ29xI2DDf_Pj04G0U"
    },
    {
      "key": "FRONTEND_URL",
      "value": "https://your-frontend-domain.vercel.app"
    },
    {
      "key": "PORT",
      "value": "3001"
    }
  ],
  "disk": {
    "name": "sqlite-disk",
    "sizeGB": 1,
    "mountPath": "/opt/render/project/src"
  }
}
"@

# Save payload to file
$jsonPayload | Out-File -FilePath "payload.json" -Encoding UTF8

# Use curl to deploy
$curlCommand = "curl -X POST https://api.render.com/v1/services -H `"Authorization: Bearer $RENDER_API_KEY`" -H `"Content-Type: application/json`" -d `"@payload.json`""

Write-Host "Executing deployment..." -ForegroundColor Yellow
Invoke-Expression $curlCommand

# Clean up
Remove-Item "payload.json" -ErrorAction SilentlyContinue

Write-Host "`n✅ Deployment request sent!" -ForegroundColor Green
Write-Host "Check your Render dashboard for deployment status." -ForegroundColor Cyan