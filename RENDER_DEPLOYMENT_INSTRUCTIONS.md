# 🚀 HRMS Backend Deployment Instructions for Render

## Prerequisites ✅
- ✅ GitHub repository: `https://github.com/codebyArya-bit/HRMS_Backend`
- ✅ Render API Key: `rnd_Rz1gW2ucse023edwzfAgZpr1odCt`
- ✅ All deployment files prepared and pushed to GitHub

## Manual Deployment Steps

### Step 1: Access Render Dashboard
1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Sign in with your account (or create one if needed)

### Step 2: Create New Web Service
1. Click **"New +"** button
2. Select **"Web Service"**
3. Choose **"Build and deploy from a Git repository"**
4. Click **"Connect account"** if GitHub isn't connected yet

### Step 3: Configure Repository
1. **Repository**: `https://github.com/codebyArya-bit/HRMS_Backend`
2. **Branch**: `main`
3. **Root Directory**: Leave empty (use root)

### Step 4: Configure Service Settings
```
Name: hrms-backend
Region: Oregon (US West)
Branch: main
Runtime: Node
Build Command: npm install && npx prisma generate
Start Command: npm start
Plan: Free
```

### Step 5: Add Environment Variables
Add these environment variables in the Render dashboard:

```
NODE_ENV=production
DATABASE_URL=file:./production.db
JWT_SECRET=supersecretjwtkey
GEMINI_API_KEY=AIzaSyDw4WGI78XEIgJVcCJ29xI2DDf_Pj04G0U
FRONTEND_URL=https://your-frontend-domain.vercel.app
PORT=3001
```

### Step 6: Configure Persistent Disk (Important for SQLite)
1. In the service settings, go to **"Disks"** section
2. Click **"Add Disk"**
3. Configure:
   ```
   Name: sqlite-disk
   Mount Path: /opt/render/project/src
   Size: 1 GB
   ```

### Step 7: Deploy
1. Click **"Create Web Service"**
2. Render will automatically start building and deploying
3. Monitor the deployment logs for any issues

## Expected Deployment Process

### Build Phase
```bash
npm install
npx prisma generate
```

### Start Phase
```bash
npm start
# Server will start on port 3001
# Health check available at /api/health
```

## Post-Deployment Verification

### 1. Check Service Status
- Service should show "Live" status in dashboard
- Build logs should show successful completion

### 2. Test API Endpoints
Once deployed, test these endpoints:

```bash
# Health check
GET https://your-service-name.onrender.com/api/health

# API root
GET https://your-service-name.onrender.com/api

# Test authentication endpoint
POST https://your-service-name.onrender.com/api/auth/login
```

### 3. Database Verification
- SQLite database should be persistent on the mounted disk
- Prisma should be able to connect and query the database

## Troubleshooting

### Common Issues:

1. **Build Fails**
   - Check if all dependencies are in package.json
   - Verify Node.js version compatibility

2. **Database Connection Issues**
   - Ensure DATABASE_URL points to the correct path
   - Verify disk is properly mounted

3. **Environment Variables**
   - Double-check all required env vars are set
   - Ensure no typos in variable names

4. **Port Issues**
   - Render automatically assigns a port, but we set PORT=3001
   - Server should listen on process.env.PORT || 3001

## Service URLs
After successful deployment, you'll get:
- **Service URL**: `https://hrms-backend-[random].onrender.com`
- **API Base URL**: `https://hrms-backend-[random].onrender.com/api`

## Next Steps After Deployment
1. Update frontend environment variables with the actual Render URL
2. Test all API endpoints
3. Verify database operations
4. Set up monitoring and logging
5. Configure custom domain (if needed)

## Important Notes
- ⚠️ Free tier services sleep after 15 minutes of inactivity
- ⚠️ Cold starts may take 30+ seconds
- ⚠️ SQLite database persists on the mounted disk
- ⚠️ Regular backups recommended for production data

## Support
If deployment fails, check:
1. Render service logs
2. GitHub repository access
3. Environment variable configuration
4. Disk mounting configuration