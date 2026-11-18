-- CreateTable
CREATE TABLE "couples" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invite_code" TEXT
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "couple_id" TEXT,
    "calendar_feed_token" TEXT,
    "reset_token_hash" TEXT,
    "reset_token_expires_at" DATETIME,
    CONSTRAINT "users_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "environments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "couple_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL,
    CONSTRAINT "environments_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "environments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "environment_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "start_datetime" DATETIME,
    "end_datetime" DATETIME,
    "is_all_day" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "assigned_to" TEXT,
    "proposal_status" TEXT NOT NULL DEFAULT 'NONE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    CONSTRAINT "notification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "couples_invite_code_key" ON "couples"("invite_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_calendar_feed_token_key" ON "users"("calendar_feed_token");

-- CreateIndex
CREATE INDEX "tasks_environment_id_start_datetime_idx" ON "tasks"("environment_id", "start_datetime");

-- CreateIndex
CREATE UNIQUE INDEX "notification_tokens_user_id_token_key" ON "notification_tokens"("user_id", "token");
