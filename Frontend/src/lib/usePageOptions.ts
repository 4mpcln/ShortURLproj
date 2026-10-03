import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Metadata } from '../components/LinkOrganization';
import { readOrganizationOptions, updatePageOptions, writeOrganizationOptions } from './pageOptions';

export function usePageOptions() {
  const [params, setParams] = useSearchParams();
  function updateOptions(changes: Record<string, string | null>) {
    setParams(current => updatePageOptions(current, changes), { preventScrollReset: true });
  }
  return { params, updateOptions };
}

export function useOrganizationOptions(userId: string | undefined) {
  const [params, setParams] = useSearchParams();
  const organizationKey = JSON.stringify([...params].filter(([key]) => ['tag', 'folder', 'startsAt', 'expiresAt'].includes(key)));
  const [accessCode, setAccessCode] = useState<string | null>(null);
  // Access codes stay in memory and are never written to browser URLs or history.
  const metadata = useMemo(() => ({ ...readOrganizationOptions(params), accessCode }), [organizationKey, accessCode]);
  const previousUser = useRef(userId);
  useEffect(() => {
    setAccessCode(null);
    if (previousUser.current && previousUser.current !== userId) {
      setParams(current => writeOrganizationOptions(current, { tagIds: [], folderId: '', startsAt: '', expiresAt: '' }),
        { replace: true, preventScrollReset: true });
    }
    previousUser.current = userId;
  }, [userId]);
  function setMetadata(value: Metadata) {
    setAccessCode(value.accessCode ?? null);
    setParams(current => writeOrganizationOptions(current, value), { preventScrollReset: true });
  }
  return [metadata, setMetadata] as const;
}
