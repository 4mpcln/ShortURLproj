export const formatDate = (date: string | null) => date
  ? new Date(date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'No expire date';
