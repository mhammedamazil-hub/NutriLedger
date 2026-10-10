import { useEffect, useRef } from 'react';
import { useData } from '../../app/dataContext';
import { Notice } from '../feedback/Notice';
import { Button } from '../common/Button';
import { usePwaStatus } from '../../app/pwaContext';
import { useToast } from '../feedback/toastContext';

/** App-wide, unobtrusive status: connectivity, storage health and updates. */
export function StatusBanners({ online }: { online: boolean }) {
  const storageMessage = useData((s) => s.storageMessage);
  const skipped = useData((s) => s.skippedRecords);
  const { needRefresh, offlineReady, update, dismissOfflineReady } = usePwaStatus();
  const toast = useToast();
  const wasOnline = useRef(online);

  useEffect(() => {
    if (offlineReady) {
      toast.show('NutriLedger is ready to work offline on this device.');
      dismissOfflineReady();
    }
  }, [offlineReady, toast, dismissOfflineReady]);

  useEffect(() => {
    if (wasOnline.current !== online) {
      toast.show(online ? 'Back online.' : 'You’re offline. Your diary, calculator and exports keep working.');
      wasOnline.current = online;
    }
  }, [online, toast]);

  return (
    <>
      {storageMessage && (
        <Notice tone="warning" title="Records are not being saved permanently" role="status">
          {storageMessage}
        </Notice>
      )}
      {skipped > 0 && (
        <Notice tone="warning" title={`${skipped} stored ${skipped === 1 ? 'record' : 'records'} could not be read`} role="status">
          They failed validation and are hidden, not deleted. Your other records are unaffected. Exporting a backup will not
          include them.
        </Notice>
      )}
      {needRefresh && (
        <Notice tone="info" title="A new version of NutriLedger is available" role="status">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>Your records stay on this device when you update.</span>
            <Button size="sm" variant="primary" onClick={() => void update()}>
              Reload to update
            </Button>
          </div>
        </Notice>
      )}
    </>
  );
}
