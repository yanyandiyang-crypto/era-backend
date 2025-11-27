import { ResolutionOutcome } from '@prisma/client';

export interface SubmitResolutionDTO {
  what: string;
  when: string;
  where: string;
  who: string;
  why: string;
  how: ResolutionOutcome;
  notes?: string | null;
  personnelId: string;
}

export interface ConfirmResolutionDTO {
  adminNotes?: string;
}

export interface UpdateResolutionDTO {
  what?: string;
  when?: string;
  where?: string;
  who?: string;
  why?: string;
  how?: ResolutionOutcome;
  notes?: string;
  adminNotes?: string;
}
