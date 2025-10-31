# Simple Render Deployment Script
$RENDER_API_KEY = "rnd_Rz1gW2ucse023edwzfAgZpr1odCt"

Write-Host "Deploying HRMS Backend to Render..."

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

$jsonPayload = $payload | ConvertTo-Json -Depth 10

$headers = @{
    "Authorization" = "Bearer $RENDER_API_KEY"
    "Content-Type" = "application/json"
}

try {
    Write-Host "Sending deployment request..."
    $response = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Method POST -Headers $headers -Body $jsonPayload
    
    Write-Host "Service created successfully!"
    Write-Host "Service ID: $($response.id)"
    Write-Host "Service Name: $($response.name)"
    Write-Host "Dashboard: https://dashboard.render.com/web/$($response.id)"
    
} catch {
    Write-Host "Deployment failed!"
    Write-Host "Error: $($_.Exception.Message)"
}