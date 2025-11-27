export enum ReportType {
  INCIDENT_REPORT = 'INCIDENT_REPORT',
  INCIDENT_SUMMARY = 'INCIDENT_SUMMARY',
  PERSONNEL_REPORT = 'PERSONNEL_REPORT',
  BARANGAY_REPORT = 'BARANGAY_REPORT',
  STATISTICS_REPORT = 'STATISTICS_REPORT',
  ACTIVITY_REPORT = 'ACTIVITY_REPORT',
  CUSTOM_REPORT = 'CUSTOM_REPORT',
}

export interface GenerateReportDTO {
  type: ReportType;
  title?: string;
  fromDate?: string;
  toDate?: string;
  incidentId?: string;
  personnelId?: string;
  barangayId?: string | string[];
  includePhotos?: boolean;
  includeTimeline?: boolean;
  includeStatistics?: boolean;
  // Filter properties for Excel export
  status?: string[];
  priority?: string[];
  incidentTypes?: string[];
  barangayIdArray?: string[];
  search?: string;
  hasPhotosFilter?: boolean;
  hasAssignedPersonnel?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

export interface ReportMetadata {
  id: string;
  type: ReportType;
  title: string;
  generatedBy: {
    id: string;
    email: string;
    name: string;
  };
  generatedAt: Date;
  parameters: any;
  filesize: number;
  filename: string;
}
