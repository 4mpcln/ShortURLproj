import axios, { AxiosRequestConfig } from 'axios';

const instance = axios.create({
  withCredentials: true,
  baseURL: import.meta.env?.VITE_API_BASE_URL ?? '',
  headers: {
    'Content-Type': 'application/json',
  },
});

export function onUnauthorized(callback: () => void) {
  let active = true;
  const interceptor = instance.interceptors.response.use(response => response, error => {
    if (active && axios.isAxiosError(error) && error.response?.status === 401) {
      const path = new URL(error.config?.url || '/', 'http://localhost').pathname;
      if (path !== '/api/auth/login' && path !== '/api/auth/register') callback();
    }
    return Promise.reject(error);
  });
  return () => {
    // In-flight requests can still hold an ejected interceptor.
    active = false;
    instance.interceptors.response.eject(interceptor);
  };
}

export async function apiClient<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await instance.request<T>(config);
  return response.data;
}
