import { useEffect, useRef, useState } from 'react';
import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { TextField } from '../../components/forms/Field';
import { Notice } from '../../components/feedback/Notice';
import { useAiRequest } from '../../hooks/useAiRequest';
import { estimateFromPhoto } from '../../lib/ai/tasks';
import { checkImageFile, prepareImageForUpload, ACCEPTED_IMAGE_TYPES } from '../../lib/ai/image';
import { AiError } from '../../lib/ai/errors';
import type { NutritionEstimate } from '../../lib/ai/schemas';
import { useAiAvailability } from './useAiAvailability';
import { RequestStatus, SendButton, SendsDisclosure } from './shared';
import { EstimateReview } from './EstimateReview';
import styles from './Ai.module.css';

export function EstimatePhotoTool() {
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const file = photo?.file ?? null;
  const previewUrl = photo?.url ?? null;
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { ready, reason, options } = useAiAvailability();
  const req = useAiRequest<NutritionEstimate>();

  // Release the preview object URL when the photo changes or the tool unmounts.
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  const setFile = (f: File | null) => setPhoto(f ? { file: f, url: URL.createObjectURL(f) } : null);

  const choose = (f: File | undefined) => {
    req.reset();
    if (!f) return;
    const check = checkImageFile(f);
    if (!check.ok) {
      setError(check.error);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setError(null);
    setFile(f);
  };

  const send = () => {
    if (!file) return setError('Choose a photo first.');
    void req.run(async (signal) => {
      let image: { mimeType: string; base64: string };
      try {
        image = await prepareImageForUpload(file);
      } catch (err) {
        throw new AiError('bad-request', err instanceof Error ? err.message : 'The photo could not be prepared.');
      }
      if (signal.aborted) throw new AiError('cancelled');
      return estimateFromPhoto(options(signal), image, note);
    });
  };

  return (
    <Panel
      title="Estimate a meal from a photo"
      titleId="tool-title"
      description="Photo estimates are rough: portion sizes, oils and hidden ingredients are hard to see. Always review the numbers."
    >
      <div className="stack">
        <div>
          <label htmlFor="meal-photo" className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 'var(--space-2)' }}>
            Meal photo (JPEG, PNG, WebP or HEIC, up to 10 MB)
          </label>
          <input
            ref={inputRef}
            id="meal-photo"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={(e) => choose(e.target.files?.[0])}
            style={{ maxWidth: '100%' }}
          />
        </div>
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        {previewUrl && file && (
          <div className="stack-sm">
            <img src={previewUrl} alt="Selected meal photo preview" className={styles.preview} />
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFile(null);
                  req.reset();
                  if (inputRef.current) inputRef.current.value = '';
                }}
              >
                Remove photo
              </Button>
            </div>
          </div>
        )}
        <TextField
          label="Note for Gemini"
          optional
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          hint="e.g. “about 300 g of pasta, cooked in olive oil”"
        />
        <SendsDisclosure summary="the photo and your note">
          <p>
            The photo is resized to at most 1600 px and re-encoded as JPEG in your browser, which drops embedded metadata such as
            location. It is sent to Gemini with your note. Nothing else is included. If your browser can’t resize the file (for
            example HEIC outside Safari), the original file is sent instead, and it may still contain metadata.
          </p>
        </SendsDisclosure>
        <SendButton ready={ready && file !== null} reason={reason ?? (file ? null : 'Choose a photo to continue.')} loading={req.state.status === 'loading'} onClick={send}>
          Estimate from photo
        </SendButton>
        <RequestStatus state={req.state} onCancel={req.cancel} onRetry={send} loadingLabel="Sending photo to Gemini…" />
        {req.state.status === 'success' && <EstimateReview key={JSON.stringify(req.state.data)} estimate={req.state.data} onDiscard={req.reset} />}
      </div>
    </Panel>
  );
}
