import axios, { AxiosRequestConfig } from 'axios';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3211',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function apiClient<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await instance.request<T>(config);
  return response.data;
}
