import axios from 'axios';
import { http } from '../lib/http';

export interface UploadFeatureConfig {
  enabled: boolean;
  maxBytes: number;
  contentTypes: string[];
}

interface SignedUpload {
  uploadId: string;
  uploadUrl: string;
  publicUrl: string;
  expiresAt: string;
  headers: Record<string, string>;
}

export async function getUploadConfig(): Promise<UploadFeatureConfig> {
  return (await http.get<UploadFeatureConfig>('/uploads/config')).data;
}

export async function uploadMessageImage(file: File, onProgress: (percent: number) => void): Promise<SignedUpload> {
  const signed = (await http.post<SignedUpload>('/uploads/sign', {
    contentType: file.type,
    sizeBytes: file.size,
  })).data;
  await axios.put(signed.uploadUrl, file, {
    headers: { 'Content-Type': file.type },
    onUploadProgress: (event) => onProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
  });
  return signed;
}
