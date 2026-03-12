-- LSM Project Database Schema for PostgreSQL
-- Version: 3.0.0
-- Date: 2026-03-12
-- Author: AI Backend Developer

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'USER');
CREATE TYPE server_status AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'ERROR');
CREATE TYPE task_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE alert_type AS ENUM ('HIGH_CPU', 'HIGH_MEMORY', 'HIGH_GPU', 'HIGH_TEMP', 'SERVER_OFFLINE');
CREATE TYPE alert_status AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Sessions table (for JWT refresh tokens)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT false
);

-- Servers table
CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status server_status NOT NULL DEFAULT 'OFFLINE',
    gpu_count INTEGER NOT NULL DEFAULT 0,
    location VARCHAR(200),
    ip_address INET,
    ssh_port INTEGER DEFAULT 22,
    ssh_username VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- GPUs table
CREATE TABLE gpus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    memory INTEGER NOT NULL, -- in GB
    allocated BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- GPU Allocations table
CREATE TABLE gpu_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gpu_id UUID NOT NULL REFERENCES gpus(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID,
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in minutes
    metadata JSONB DEFAULT '{}'
);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'PENDING',
    priority task_priority NOT NULL DEFAULT 'MEDIUM',
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gpu_requirements JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Server Metrics table
CREATE TABLE server_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    cpu_usage DECIMAL(5,2), -- percentage
    memory_usage DECIMAL(5,2), -- percentage
    gpu_usage DECIMAL(5,2), -- percentage
    temperature DECIMAL(5,2), -- Celsius
    disk_usage DECIMAL(5,2), -- percentage
    network_in BIGINT, -- bytes
    network_out BIGINT, -- bytes
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type alert_type NOT NULL,
    status alert_status NOT NULL DEFAULT 'ACTIVE',
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    server_id UUID REFERENCES servers(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs table (for security)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email Notifications table
CREATE TABLE email_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_gpus_server_id ON gpus(server_id);
CREATE INDEX idx_gpus_allocated ON gpus(allocated);
CREATE INDEX idx_gpu_allocations_user_id ON gpu_allocations(user_id);
CREATE INDEX idx_gpu_allocations_gpu_id ON gpu_allocations(gpu_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_server_metrics_server_id ON server_metrics(server_id);
CREATE INDEX idx_server_metrics_recorded_at ON server_metrics(recorded_at DESC);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_email_notifications_user_id ON email_notifications(user_id);
CREATE INDEX idx_email_notifications_status ON email_notifications(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gpus_updated_at BEFORE UPDATE ON gpus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123, change in production!)
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@lsm.local', '$2b$10$rH9zqX8FQ7N1K5pL2mJ3uO6vW8xY0zA1bC2dE3fG4hI5jK6lM7nO8', 'ADMIN');

-- Create views for common queries
CREATE VIEW v_active_allocations AS
SELECT 
    a.id,
    a.gpu_id,
    a.user_id,
    a.task_id,
    a.allocated_at,
    g.model as gpu_model,
    g.memory as gpu_memory,
    s.name as server_name,
    u.username as user_name
FROM gpu_allocations a
JOIN gpus g ON a.gpu_id = g.id
JOIN servers s ON g.server_id = s.id
JOIN users u ON a.user_id = u.id
WHERE a.released_at IS NULL;

CREATE VIEW v_cluster_stats AS
SELECT 
    COUNT(DISTINCT s.id) as total_servers,
    COUNT(DISTINCT CASE WHEN s.status = 'ONLINE' THEN s.id END) as online_servers,
    COUNT(DISTINCT g.id) as total_gpus,
    COUNT(DISTINCT CASE WHEN g.allocated = true THEN g.id END) as allocated_gpus,
    AVG(sm.cpu_usage) as avg_cpu_usage,
    AVG(sm.memory_usage) as avg_memory_usage
FROM servers s
LEFT JOIN gpus g ON s.id = g.server_id
LEFT JOIN server_metrics sm ON s.id = sm.server_id;

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lsm_admin;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO lsm_readonly;

COMMENT ON DATABASE lsm IS 'Laboratory Server Management System Database';
