# Final Render Deployment Script for HRMS Backend
$RENDER_API_KEY = "rnd_Rz1gW2ucse023edwzfAgZpr1odCt"

Write-Host "🚀 Deploying HRMS Backend to Render..." -ForegroundColor Green

# Create the service payload
$payload = @{
    type = "web_service"
    name = "hrms-backend"
    repo = "https://github.com/codebyArya-bit/HRMS_Backend"
    branch = "main"
    buildCommand = "npm install && npx prisma generate"
    startCommand = "npm start"
    plan = "free"
    region = "oregon"
    runtime = "node"
    numInstances = 1
    envVars = @(
        @{ key = "NODE_ENV"; value = "production" },
        @{ key = "DATABASE_URL"; value = "file:./production.db" },
        @{ key = "JWT_SECRET"; value = "supersecretjwtkey" },
        @{ key = "GEMINI_API_KEY"; value = "AIzaSyDw4WGI78XEIgJVcCJ29xI2DDf_Pj04G0U" },
        @{ key = "FRONTEND_URL"; value = "https://your-frontend-domain.vercel.app" },
        @{ key = "PORT"; value = "3001" }
    )
    disk = @{
        name = "sqlite-disk"
        sizeGB = 1
        mountPath = "/opt/render/project/src"
    }
}

# Convert to JSON
$jsonPayload = $payload | ConvertTo-Json -Depth 10

# Set headers
$headers = @{
    "Authorization" = "Bearer $RENDER_API_KEY"
    "Content-Type" = "application/json"
}

try {
    Write-Host "Sending deployment request..." -ForegroundColor Yellow
    
    # Make the API call
    $response = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Method POST -Headers $headers -Body $jsonPayload
    
    Write-Host "✅ Service created successfully!" -ForegroundColor Green
    Write-Host "Service ID: $($response.id)" -ForegroundColor Yellow
    Write-Host "Service Name: $($response.name)" -ForegroundColor Yellow
    
    if ($response.serviceDetails -and $response.serviceDetails.url) {
        Write-Host "Service URL: $($response.serviceDetails.url)" -ForegroundColor Yellow
    }
    
    Write-Host "Dashboard: https://dashboard.render.com/web/$($response.id)" -ForegroundColor Yellow
    
    Write-Host "`n📋 Next Steps:" -ForegroundColor Magenta
    Write-Host "1. Visit the Render dashboard to monitor deployment progress" -ForegroundColor White
    Write-Host "2. The service will automatically deploy from the main branch" -ForegroundColor White
    Write-Host "3. Check the logs for any deployment issues" -ForegroundColor White
    Write-Host "4. Test the deployed API endpoints once deployment is complete" -ForegroundColor White
    
} catch {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
        
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            $reader.Close()
            Write-Host "Response Body: $errorBody" -ForegroundColor Red
        } catch {
            Write-Host "Could not read error response body" -ForegroundColor Red
        }
    }
}