# Render Deployment Script for HRMS Backend
# This script deploys the HRMS backend to Render using the API

$RENDER_API_KEY = "rnd_Rz1gW2ucse023edwzfAgZpr1odCt"
$GITHUB_REPO = "https://github.com/codebyArya-bit/HRMS_Backend"

# Create service payload
$servicePayload = @{
    type = "web_service"
    name = "hrms-backend"
    ownerId = $null  # Will be auto-detected
    repo = $GITHUB_REPO
    branch = "main"
    buildCommand = "npm install && npx prisma generate"
    startCommand = "npm start"
    plan = "free"
    region = "oregon"
    runtime = "node"
    numInstances = 1
    envVars = @(
        @{
            key = "NODE_ENV"
            value = "production"
        },
        @{
            key = "DATABASE_URL"
            value = "file:./production.db"
        },
        @{
            key = "JWT_SECRET"
            value = "supersecretjwtkey"
        },
        @{
            key = "GEMINI_API_KEY"
            value = "AIzaSyDw4WGI78XEIgJVcCJ29xI2DDf_Pj04G0U"
        },
        @{
            key = "FRONTEND_URL"
            value = "https://your-frontend-domain.vercel.app"
        },
        @{
            key = "PORT"
            value = "3001"
        }
    )
    disk = @{
        name = "sqlite-disk"
        sizeGB = 1
        mountPath = "/opt/render/project/src"
    }
} | ConvertTo-Json -Depth 10

# Headers for API request
$headers = @{
    "Authorization" = "Bearer $RENDER_API_KEY"
    "Content-Type" = "application/json"
}

Write-Host "🚀 Deploying HRMS Backend to Render..." -ForegroundColor Green
Write-Host "Repository: $GITHUB_REPO" -ForegroundColor Cyan
Write-Host "Branch: main" -ForegroundColor Cyan

try {
    # Create the service
    $response = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Method POST -Headers $headers -Body $servicePayload
    
    Write-Host "✅ Service created successfully!" -ForegroundColor Green
    Write-Host "Service ID: $($response.id)" -ForegroundColor Yellow
    Write-Host "Service URL: $($response.serviceDetails.url)" -ForegroundColor Yellow
    Write-Host "Dashboard: https://dashboard.render.com/web/$($response.id)" -ForegroundColor Yellow
    
    Write-Host "`n📋 Next Steps:" -ForegroundColor Magenta
    Write-Host "1. Visit the Render dashboard to monitor deployment progress" -ForegroundColor White
    Write-Host "2. The service will automatically deploy from the main branch" -ForegroundColor White
    Write-Host "3. Check the logs for any deployment issues" -ForegroundColor White
    Write-Host "4. Test the deployed API endpoints" -ForegroundColor White
    
} catch {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorResponse)
        $errorBody = $reader.ReadToEnd()
        $reader.Close()
        Write-Host "Response: $errorBody" -ForegroundColor Red
    }
}