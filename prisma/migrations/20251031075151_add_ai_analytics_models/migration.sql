/*
  Warnings:

  - You are about to drop the column `location` on the `User` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "performance_insights" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "performanceScore" REAL,
    "productivityRating" REAL,
    "qualityRating" REAL,
    "collaborationRating" REAL,
    "performanceForecast" TEXT,
    "riskFactors" TEXT,
    "recommendations" TEXT,
    "strengths" TEXT,
    "improvementAreas" TEXT,
    "analysisDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analysisType" TEXT NOT NULL DEFAULT 'monthly',
    "confidence" REAL,
    "dataSource" TEXT,
    "nextQuarterForecast" TEXT,
    "careerProgression" TEXT,
    CONSTRAINT "performance_insights_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employee_feedback" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "feedbackText" TEXT NOT NULL,
    "feedbackType" TEXT NOT NULL DEFAULT 'general',
    "source" TEXT,
    "category" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "department" TEXT,
    CONSTRAINT "employee_feedback_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sentiment_analysis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "feedbackId" INTEGER NOT NULL,
    "overallSentiment" TEXT NOT NULL,
    "sentimentScore" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "emotions" TEXT,
    "keyThemes" TEXT,
    "concerns" TEXT,
    "positiveAspects" TEXT,
    "actionableInsights" TEXT,
    "urgencyLevel" TEXT NOT NULL DEFAULT 'low',
    "riskIndicators" TEXT,
    "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiModel" TEXT NOT NULL DEFAULT 'gemini-2.5-pro',
    "processingTime" INTEGER,
    CONSTRAINT "sentiment_analysis_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "employee_feedback" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sentiment_trends" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "department" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL DEFAULT 'monthly',
    "averageSentiment" REAL NOT NULL,
    "positivePercentage" REAL NOT NULL,
    "neutralPercentage" REAL NOT NULL,
    "negativePercentage" REAL NOT NULL,
    "trendDirection" TEXT NOT NULL,
    "riskFactors" TEXT,
    "recommendations" TEXT,
    "keyInsights" TEXT,
    "alertLevel" TEXT NOT NULL DEFAULT 'green',
    "alertMessage" TEXT,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedbackCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "ai_analytics_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "configKey" TEXT NOT NULL,
    "configValue" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" INTEGER
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "employeeId" TEXT,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "department" TEXT,
    "avatar" TEXT,
    "joinDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleId" INTEGER NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorMethod" TEXT,
    "backupCodes" TEXT,
    "twoFactorSetupDate" DATETIME,
    "twoFactorLastUsed" DATETIME,
    "phone" TEXT,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatar", "backupCodes", "department", "email", "employeeId", "id", "joinDate", "name", "password", "phone", "roleId", "twoFactorEnabled", "twoFactorLastUsed", "twoFactorMethod", "twoFactorSecret", "twoFactorSetupDate") SELECT "avatar", "backupCodes", "department", "email", "employeeId", "id", "joinDate", "name", "password", "phone", "roleId", "twoFactorEnabled", "twoFactorLastUsed", "twoFactorMethod", "twoFactorSecret", "twoFactorSetupDate" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "performance_insights_employeeId_idx" ON "performance_insights"("employeeId");

-- CreateIndex
CREATE INDEX "performance_insights_analysisDate_idx" ON "performance_insights"("analysisDate");

-- CreateIndex
CREATE INDEX "employee_feedback_employeeId_idx" ON "employee_feedback"("employeeId");

-- CreateIndex
CREATE INDEX "employee_feedback_submittedAt_idx" ON "employee_feedback"("submittedAt");

-- CreateIndex
CREATE INDEX "employee_feedback_feedbackType_idx" ON "employee_feedback"("feedbackType");

-- CreateIndex
CREATE INDEX "sentiment_analysis_feedbackId_idx" ON "sentiment_analysis"("feedbackId");

-- CreateIndex
CREATE INDEX "sentiment_analysis_analyzedAt_idx" ON "sentiment_analysis"("analyzedAt");

-- CreateIndex
CREATE INDEX "sentiment_analysis_overallSentiment_idx" ON "sentiment_analysis"("overallSentiment");

-- CreateIndex
CREATE INDEX "sentiment_analysis_urgencyLevel_idx" ON "sentiment_analysis"("urgencyLevel");

-- CreateIndex
CREATE INDEX "sentiment_trends_department_idx" ON "sentiment_trends"("department");

-- CreateIndex
CREATE INDEX "sentiment_trends_periodStart_idx" ON "sentiment_trends"("periodStart");

-- CreateIndex
CREATE INDEX "sentiment_trends_alertLevel_idx" ON "sentiment_trends"("alertLevel");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analytics_config_configKey_key" ON "ai_analytics_config"("configKey");
