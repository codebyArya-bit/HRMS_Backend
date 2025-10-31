-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_login_activity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "activity" TEXT NOT NULL DEFAULT 'User logged in',
    CONSTRAINT "login_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_login_activity" ("id", "timestamp", "userId") SELECT "id", "timestamp", "userId" FROM "login_activity";
DROP TABLE "login_activity";
ALTER TABLE "new_login_activity" RENAME TO "login_activity";
CREATE INDEX "login_activity_timestamp_idx" ON "login_activity"("timestamp");
CREATE INDEX "login_activity_userId_idx" ON "login_activity"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
