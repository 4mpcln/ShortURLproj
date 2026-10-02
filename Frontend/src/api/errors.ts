import { isAxiosError } from 'axios';

type ApiErrorResponse = {
  message?: string;
  issues?: { path: (string | number)[] }[];
};

export function getCreateShortUrlError(error: unknown): string {
  if (!isAxiosError<ApiErrorResponse>(error)) {
    return 'Could not create short URL. Please try again.';
  }

  if (!error.response) {
    return 'Cannot connect to the server. Please try again shortly.';
  }

  if (error.response.status === 409) {
    return 'Custom alias is already in use. Choose another alias.';
  }

  if (error.response.status === 400) {
    const field = error.response.data?.issues?.[0]?.path?.[0];
    if (field === 'originalUrl') return 'Enter a valid URL, including https:// or http://.';
    if (field === 'customCode') return 'Custom alias must contain 3–32 letters, numbers, hyphens or underscores.';
    if (field === 'title') return 'Title must be no longer than 160 characters.';
    return error.response.data?.message === 'Invalid request payload.' ? 'Check the URL, title, alias and access times.' : error.response.data?.message || 'Check the form and try again.';
  }

  return 'The server could not create your short URL. Please try again shortly.';
}
