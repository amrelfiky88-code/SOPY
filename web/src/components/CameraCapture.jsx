import React, { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.jsx';

// Live in-app camera capture ONLY. There is deliberately no <input type="file">
// anywhere in this component — evidence photos must come from getUserMedia,
// never a gallery pick or file upload, per compliance requirements.
// getUserMedia rejects with different DOMException names for genuinely
// different problems (permission denied vs. no camera vs. camera busy
// vs. an insecure page) — showing the same "allow permission" message
// for all of them sends people down the wrong troubleshooting path.
// iPadOS reports itself as a Mac, so check for touch as well.
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

const isAndroid = () => /Android/.test(navigator.userAgent);

// Links opened from chat/social apps land in that app's embedded browser
// (an Android WebView, or a Chrome "custom tab" with an ✕ bar), which
// often refuses the camera outright without ever asking. The fix is to
// open the page in the real browser.
const isEmbeddedBrowser = () =>
  /\bwv\b|FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok|GSA\//i.test(navigator.userAgent);

// Android intent link that opens this exact page in Chrome proper —
// works from a WebView or custom tab, where the permission prompt can't
// be shown. (iOS has no equivalent; users use the in-app browser's menu.)
export const openInChromeHref = () =>
  `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;

// Errors are kept as a message key (cam.* in i18n/pageLabels.js) plus
// whether it's a permission block, which is when "Open in Chrome" helps.
function permissionHelp() {
  if (isIOS()) return { key: isEmbeddedBrowser() ? 'cam.iosInApp' : 'cam.iosDenied', blocked: true };
  if (isAndroid()) return { key: 'cam.androidDenied', blocked: true };
  return { key: 'cam.denied', blocked: true };
}

function errorForException(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return permissionHelp();
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { key: 'cam.notFound' };
    case 'NotReadableError':
    case 'TrackStartError':
      return { key: 'cam.inUse' };
    case 'OverconstrainedError':
      return { key: 'cam.unsupportedMode' };
    case 'SecurityError':
      return { key: 'cam.insecure', blocked: true };
    default:
      return { key: 'cam.failed', vars: { detail: `${err?.name || 'unknown error'}${err?.message ? `: ${err.message}` : ''}` } };
  }
}

const TRANSIENT_ERRORS = new Set(['NotReadableError', 'TrackStartError', 'AbortError', 'NotFoundError', 'DevicesNotFoundError']);

// Evidence needs to be legible (labels, thermometer readouts), but a
// full-sensor frame is several MB on a phone connection.
const MAX_EDGE = 1920;

// Rear camera at a readable resolution. Both are `ideal`, not `exact`,
// so phones without a rear camera or that resolution still get a stream.
const CONSTRAINTS = {
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  audio: false,
};

export default function CameraCapture({ onCapture }) {
  const t = useT();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null); // { key, vars?, blocked? }
  const [previewUrl, setPreviewUrl] = useState(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Quiet retries for errors that pass on their own: the camera still held
  // by the last checkpoint's preview (Android: NotReadableError) or briefly
  // not listed. Showing "camera in use" for those sent people hunting for
  // another app; a moment later it opens.
  const quietRetries = useRef(0);

  useEffect(() => {
    if (previewUrl) return undefined; // showing the shot — don't hold the camera open
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({ key: 'cam.noSupport', blocked: true });
      return undefined;
    }
    let active = true;
    setError(null);
    setReady(false);
    navigator.mediaDevices
      .getUserMedia(CONSTRAINTS)
      .catch((err) => (err?.name === 'OverconstrainedError'
        ? navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        : Promise.reject(err)))
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        quietRetries.current = 0;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // iOS Safari sometimes ignores autoPlay for a srcObject stream.
          video.play().catch(() => {});
        }
      })
      .catch((err) => {
        if (!active) return;
        if (TRANSIENT_ERRORS.has(err?.name) && quietRetries.current < 2) {
          quietRetries.current += 1;
          // 0.7 s, then 1.4 s, before saying anything.
          const wait = 700 * quietRetries.current;
          setTimeout(() => { if (active) setAttempt((a) => a + 1); }, wait);
          return;
        }
        setError(errorForException(err));
      });

    // Phones stop the camera when the app goes to the background; the
    // preview then sits frozen on return. Reopen it if that happened.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || track.readyState === 'ended') setAttempt((a) => a + 1);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [previewUrl, attempt]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Before the first frame arrives the video is 0×0 and would produce
    // an empty (null) image.
    if (!video || !canvas || !video.videoWidth) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError({ key: 'cam.captureFailed' }); return; }
      setPreviewUrl(URL.createObjectURL(blob));
      onCapture(blob);
    }, 'image/jpeg', 0.85);
  };

  const retake = () => {
    setPreviewUrl(null);
    onCapture(null);
  };

  if (error) {
    return (
      <div>
        <div className="error-banner">{t(error.key, error.vars)}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {error.blocked && isAndroid() && (
            <a className="btn btn-primary btn-small" href={openInChromeHref()}>{t('cam.openInChrome')}</a>
          )}
          <button type="button" className="btn btn-secondary btn-small" onClick={() => { setPreviewUrl(null); setAttempt((a) => a + 1); }}>
            {t('common.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="camera-box">
        {previewUrl ? (
          <img src={previewUrl} alt={t('cam.captured')} />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setReady(true)} />
            <button type="button" className="capture-btn" onClick={capture} disabled={!ready} aria-label={t('cam.capture')} />
          </>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {previewUrl && (
        <button type="button" className="btn btn-secondary btn-small" style={{ marginTop: 8 }} onClick={retake}>
          {t('cam.retake')}
        </button>
      )}
    </div>
  );
}
