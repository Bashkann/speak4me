import axios from 'axios';
import type { ApiErrorBody } from '../types/api';

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return fallback;
  return error.response?.data?.error?.message ?? (error.code === 'ECONNABORTED' ? 'The server took too long to respond.' : fallback);
}
