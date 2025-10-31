-- CreateTable
CREATE TABLE "leave_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL DEFAULT 'ANNUAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "managerComments" TEXT,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "employeeId" INTEGER NOT NULL,
    CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
