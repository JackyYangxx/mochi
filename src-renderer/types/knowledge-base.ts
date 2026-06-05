export interface KbSource {
  id: number;
  path: string;
  enabled: boolean;
  addedAt: string;
  fileCount: number;
}

export interface KbStats {
  pending: number;
  processing: number;
  failed: number;
  lastIngestedAt: string | null;
}
