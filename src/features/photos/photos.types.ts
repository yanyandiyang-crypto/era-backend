export interface UploadPhotoDTO {
  incidentId: string;
  caption?: string;
}

export interface PhotoResponse {
  id: string;
  incidentId: string;
  filename: string;
  filepath: string;
  filesize: number;
  mimetype: string;
  caption: string | null;
  url: string;
  uploadedAt: Date;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface UpdatePhotoCaptionDTO {
  caption: string;
}
