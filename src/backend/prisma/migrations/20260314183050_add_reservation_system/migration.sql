-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('ALERT_CPU', 'ALERT_MEMORY', 'ALERT_GPU', 'ALERT_TEMP', 'ALERT_SERVER_OFFLINE', 'TASK_CREATED', 'TASK_STARTED', 'TASK_COMPLETED', 'TASK_FAILED', 'TASK_CANCELLED', 'SYSTEM_MAINTENANCE', 'SYSTEM_UPDATE', 'SYSTEM_RESTART', 'BATCH_STARTED', 'BATCH_PROGRESS', 'BATCH_COMPLETED', 'BATCH_FAILED', 'USER_LOGIN', 'USER_LOGOUT', 'USER_KICKED');

-- CreateEnum
CREATE TYPE "notification_severity" AS ENUM ('CRITICAL', 'WARNING', 'INFO', 'SUCCESS');

-- CreateEnum
CREATE TYPE "notification_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('EMAIL', 'DINGTALK', 'WEBSOCKET', 'SMS');

-- CreateEnum
CREATE TYPE "export_type" AS ENUM ('CSV', 'EXCEL', 'PDF');

-- CreateEnum
CREATE TYPE "export_data_type" AS ENUM ('SERVERS', 'GPUS', 'TASKS', 'USERS', 'METRICS');

-- CreateEnum
CREATE TYPE "export_status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "alert_status" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "alert_type" AS ENUM ('HIGH_CPU', 'HIGH_MEMORY', 'HIGH_GPU', 'HIGH_TEMP', 'SERVER_OFFLINE');

-- CreateEnum
CREATE TYPE "server_status" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'ERROR');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'MANAGER', 'USER');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "slot_status" AS ENUM ('AVAILABLE', 'RESERVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "quota_type" AS ENUM ('USER', 'ROLE', 'GLOBAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_revoked" BOOLEAN DEFAULT false,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "status" "server_status" NOT NULL DEFAULT 'OFFLINE',
    "gpu_count" INTEGER NOT NULL DEFAULT 0,
    "location" VARCHAR(200),
    "ip_address" INET,
    "ssh_port" INTEGER DEFAULT 22,
    "ssh_username" VARCHAR(50),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpus" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "server_id" UUID NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "memory" INTEGER NOT NULL,
    "allocated" BOOLEAN DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gpus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpu_allocations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "gpu_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "allocated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(6),
    "duration" INTEGER,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "gpu_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "task_status" NOT NULL DEFAULT 'PENDING',
    "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
    "user_id" UUID NOT NULL,
    "gpu_requirements" JSONB,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_metrics" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "server_id" UUID NOT NULL,
    "cpu_usage" DECIMAL(5,2),
    "memory_usage" DECIMAL(5,2),
    "gpu_usage" DECIMAL(5,2),
    "temperature" DECIMAL(5,2),
    "disk_usage" DECIMAL(5,2),
    "network_in" BIGINT,
    "network_out" BIGINT,
    "recorded_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "type" "alert_type" NOT NULL,
    "status" "alert_status" NOT NULL DEFAULT 'ACTIVE',
    "severity" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "server_id" UUID,
    "message" TEXT NOT NULL,
    "details" JSONB DEFAULT '{}',
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50),
    "resource_id" UUID,
    "details" JSONB DEFAULT '{}',
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "export_type" "export_type" NOT NULL,
    "data_type" "export_data_type" NOT NULL,
    "status" "export_status" NOT NULL DEFAULT 'PENDING',
    "file_path" TEXT,
    "file_size" INTEGER,
    "record_count" INTEGER,
    "filters" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,

    CONSTRAINT "export_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "notification_type" "notification_type" NOT NULL,
    "severity" "notification_severity" NOT NULL,
    "priority" "notification_priority" NOT NULL DEFAULT 'NORMAL',
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "channel" "notification_channel"[] DEFAULT ARRAY['WEBSOCKET']::"notification_channel"[],
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "reservation_status" NOT NULL DEFAULT 'PENDING',
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "actual_start_time" TIMESTAMPTZ(6),
    "actual_end_time" TIMESTAMPTZ(6),
    "gpu_count" INTEGER NOT NULL DEFAULT 0,
    "cpu_cores" INTEGER,
    "memory_gb" INTEGER,
    "task_id" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpu_reservations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "reservation_id" UUID NOT NULL,
    "gpu_id" UUID NOT NULL,
    "allocated_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gpu_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_approvals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "reservation_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'PENDING',
    "level" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_slots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "server_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "status" "slot_status" NOT NULL DEFAULT 'AVAILABLE',
    "reservation_id" UUID,
    "block_reason" VARCHAR(255),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_quotas" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "quota_type" "quota_type" NOT NULL,
    "target_id" UUID,
    "max_servers" INTEGER,
    "max_server_hours" INTEGER,
    "max_gpus" INTEGER,
    "max_gpu_hours" INTEGER,
    "max_reservation_days" INTEGER,
    "max_advance_days" INTEGER,
    "max_concurrent" INTEGER,
    "effective_from" TIMESTAMPTZ(6),
    "effective_until" TIMESTAMPTZ(6),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_username" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "idx_sessions_token" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "idx_sessions_user_id" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_servers_status" ON "servers"("status");

-- CreateIndex
CREATE INDEX "idx_gpus_allocated" ON "gpus"("allocated");

-- CreateIndex
CREATE INDEX "idx_gpus_server_id" ON "gpus"("server_id");

-- CreateIndex
CREATE INDEX "idx_gpu_allocations_gpu_id" ON "gpu_allocations"("gpu_id");

-- CreateIndex
CREATE INDEX "idx_gpu_allocations_user_id" ON "gpu_allocations"("user_id");

-- CreateIndex
CREATE INDEX "idx_tasks_priority" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "idx_tasks_status" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "idx_tasks_user_id" ON "tasks"("user_id");

-- CreateIndex
CREATE INDEX "idx_server_metrics_recorded_at" ON "server_metrics"("recorded_at" DESC);

-- CreateIndex
CREATE INDEX "idx_server_metrics_server_id" ON "server_metrics"("server_id");

-- CreateIndex
CREATE INDEX "idx_alerts_status" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "idx_alerts_type" ON "alerts"("type");

-- CreateIndex
CREATE INDEX "idx_audit_logs_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_email_notifications_status" ON "email_notifications"("status");

-- CreateIndex
CREATE INDEX "idx_email_notifications_user_id" ON "email_notifications"("user_id");

-- CreateIndex
CREATE INDEX "idx_export_history_status" ON "export_history"("status");

-- CreateIndex
CREATE INDEX "idx_export_history_user_id" ON "export_history"("user_id");

-- CreateIndex
CREATE INDEX "idx_export_history_created_at" ON "export_history"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notification_history_is_read" ON "notification_history"("is_read");

-- CreateIndex
CREATE INDEX "idx_notification_history_user_id" ON "notification_history"("user_id");

-- CreateIndex
CREATE INDEX "idx_notification_history_created_at" ON "notification_history"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notification_history_severity" ON "notification_history"("severity");

-- CreateIndex
CREATE INDEX "idx_notification_history_type" ON "notification_history"("notification_type");

-- CreateIndex
CREATE UNIQUE INDEX "idx_notification_history_id_userId" ON "notification_history"("id", "user_id");

-- CreateIndex
CREATE INDEX "idx_reservations_user_id" ON "reservations"("user_id");

-- CreateIndex
CREATE INDEX "idx_reservations_server_id" ON "reservations"("server_id");

-- CreateIndex
CREATE INDEX "idx_reservations_status" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "idx_reservations_start_time" ON "reservations"("start_time");

-- CreateIndex
CREATE INDEX "idx_reservations_end_time" ON "reservations"("end_time");

-- CreateIndex
CREATE INDEX "idx_reservations_user_status" ON "reservations"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_reservations_server_status" ON "reservations"("server_id", "status");

-- CreateIndex
CREATE INDEX "idx_reservations_time_range" ON "reservations"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "idx_gpu_reservations_gpu_id" ON "gpu_reservations"("gpu_id");

-- CreateIndex
CREATE INDEX "idx_gpu_reservations_reservation_id" ON "gpu_reservations"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_gpu_reservations_unique" ON "gpu_reservations"("reservation_id", "gpu_id");

-- CreateIndex
CREATE INDEX "idx_reservation_approvals_reservation_id" ON "reservation_approvals"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_reservation_approvals_approver_id" ON "reservation_approvals"("approver_id");

-- CreateIndex
CREATE INDEX "idx_reservation_approvals_status" ON "reservation_approvals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "idx_reservation_approvals_unique_level" ON "reservation_approvals"("reservation_id", "level");

-- CreateIndex
CREATE INDEX "idx_reservation_slots_server_id" ON "reservation_slots"("server_id");

-- CreateIndex
CREATE INDEX "idx_reservation_slots_time_range" ON "reservation_slots"("server_id", "start_time", "end_time");

-- CreateIndex
CREATE INDEX "idx_reservation_slots_status" ON "reservation_slots"("status");

-- CreateIndex
CREATE INDEX "idx_reservation_slots_reservation_id" ON "reservation_slots"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_resource_quotas_type" ON "resource_quotas"("quota_type");

-- CreateIndex
CREATE INDEX "idx_resource_quotas_target_id" ON "resource_quotas"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_resource_quotas_unique_target" ON "resource_quotas"("quota_type", "target_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gpus" ADD CONSTRAINT "gpus_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gpu_allocations" ADD CONSTRAINT "gpu_allocations_gpu_id_fkey" FOREIGN KEY ("gpu_id") REFERENCES "gpus"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gpu_allocations" ADD CONSTRAINT "gpu_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "server_metrics" ADD CONSTRAINT "server_metrics_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gpu_reservations" ADD CONSTRAINT "gpu_reservations_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gpu_reservations" ADD CONSTRAINT "gpu_reservations_gpu_id_fkey" FOREIGN KEY ("gpu_id") REFERENCES "gpus"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservation_approvals" ADD CONSTRAINT "reservation_approvals_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservation_approvals" ADD CONSTRAINT "reservation_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservation_slots" ADD CONSTRAINT "reservation_slots_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservation_slots" ADD CONSTRAINT "reservation_slots_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_quotas" ADD CONSTRAINT "resource_quotas_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
