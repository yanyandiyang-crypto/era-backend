-- Performance indexes for incident queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_status_reportedat 
ON incidents(status, reportedAt DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_type_priority 
ON incidents(type, priority, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_barangay_status 
ON incidents(barangayId, status);

-- Performance indexes for personnel queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personnel_status_available 
ON personnel(status, isAvailable);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personnel_locations_personnel_timestamp 
ON personnel_locations(personnelId, timestamp DESC);

-- Performance indexes for assignments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_incident_personnel 
ON incident_assignments(incidentId, personnelId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_createdat 
ON incident_assignments(assignedAt DESC);

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_status_priority_reportedat 
ON incidents(status, priority, reportedAt DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_type_status_reportedat 
ON incidents(type, status, reportedAt DESC);

-- Covering indexes for frequently queried fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_cover_report_queries 
ON incidents(status, reportedAt, type, priority, incidentNumber) 
INCLUDE (title, address, responseTime);

-- Index for real-time tracking queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personnel_locations_recent 
ON personnel_locations(personnelId, timestamp DESC) 
WHERE timestamp > NOW() - INTERVAL '24 HOURS';

-- Index for incident timeline queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incident_timeline_incident_timestamp 
ON incident_timeline(incidentId, timestamp DESC);

-- Index for audit log queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_type_created 
ON audit_logs(resourceType, createdAt DESC);

-- Index for notification acknowledgments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incident_notification_acks_incident_personnel 
ON incident_notification_acks(incidentId, personnelId);

-- Index for personnel assignment history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incident_assignments_personnel_created 
ON incident_assignments(personnelId, assignedAt DESC);