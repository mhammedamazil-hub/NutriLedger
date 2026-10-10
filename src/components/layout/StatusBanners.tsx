import { useEffect, useRef, useState } from 'react';
import { useData } from '../../app/dataContext';
import { Notice } from '../feedback/Notice';
import { Button } from '../common/Button';
import { usePwaStatus } from '../../app/pwaContext';
import { useToast } from '../feedback/toastContext';
import { useHasUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { unsavedChanges } from '../../app/unsavedChanges';

/** App-wide, unobtrusive status: connectivity, storage health and updates. */
export function StatusBanners({ online }: { online: boolean }) {
  const storageMessage = useData((s) => s.storageMessage);
  const skipped = useData((s) => s.skippedRecords);
  const { needRefresh, offlineReady, update, dismissOfflineReady } = usePwaStatus();
  const toast = useToast();
  const wasOnline = useRef(online);
  const unsaved = useHasUnsavedChanges();
  const [confirmUpdate, setConfirmUpdate] = useState(false);

  // Updating reloads the page. Never do that silently over unsaved form input.
  const requestUpdate = () => {
    if (unsaved && !confirmUpdate) {
      setConfirmUpdate(true);
      return;
    }
    if (unsaved) unsavedChanges.allowNextUnload();
    void update();
  };

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
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span>
              {confirmUpdate && unsaved
                ? 'You have unsaved changes in a form. Save or close it first, or update now and lose those changes.'
                : 'Your saved records stay on this device when you update.'}
            </span>
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              {confirmUpdate && unsaved && (
                <Button size="sm" onClick={() => setConfirmUpdate(false)}>
                  Not now
                </Button>
              )}
              <Button size="sm" variant={confirmUpdate && unsaved ? 'danger' : 'primary'} onClick={requestUpdate}>
                {confirmUpdate && unsaved ? 'Update anyway' : 'Reload to update'}
              </Button>
            </div>
          </div>
        </Notice>
      )}
    </>
  );
}
