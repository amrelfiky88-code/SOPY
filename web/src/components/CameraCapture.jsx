import React, { useEffect, useRef, useState } from 'react';

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

function permissionHelp() {
  if (isIOS()) {
    return 'Camera permission was denied. In Safari, tap “aA” in the address bar → Website Settings → Camera → Allow (or Settings → Safari → Camera), then try again.';
  }
  if (/Android/.test(navigator.userAgent)) {
    return 'Camera permission was denied. Tap the icon to the left of the address bar → Permissions → Camera → Allow, then try again. If it stays blocked, allow Camera for your browser in Android Settings → Apps.';
  }
  return 'Camera permission was denied. Open this site’s settings in your browser (tap the lock/info icon next to the address bar) and set Camera to Allow, then try again.';
}

function messageForError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return permissionHelp();
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use by another app. Close any other app using the camera and try again.';
    case 'OverconstrainedError':
      return 'This device’s camera doesn’t support the requested mode.';
    case 'SecurityError':
      return 'Camera access is blocked on this page — it must be loaded over HTTPS.';
    default:
      return `Camera access failed (${err?.name || 'unknown error'}${err?.message ? `: ${err.message}` : ''}). Try again.`;
  }
}

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
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (previewUrl) return undefined; // showing the shot — don't hold the camera open
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support in-app camera capture. Try opening this page in Chrome or Safari directly (not an in-app browser).');
      return undefined;
    }
    let active = true;
    setError('');
    setReady(false);
    navigator.mediaDevices
      .getUserMedia(CONSTRAINTS)
      .catch((err) => (err?.name === 'OverconstrainedError'
        ? navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        : Promise.reject(err)))
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // iOS Safari sometimes ignores autoPlay for a srcObject stream.
          video.play().catch(() => {});
        }
      })
      .catch((err) => { if (active) setError(messageForError(err)); });

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
      if (!blob) { setError('Could not take the photo. Try again.'); return; }
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
        <div className="error-banner">{error}</div>
        <button type="button" className="btn btn-secondary btn-small" style={{ marginTop: 8 }} onClick={() => { setPreviewUrl(null); setAttempt((a) => a + 1); }}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="camera-box">
        {previewUrl ? (
          <img src={previewUrl} alt="Captured evidence" />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setReady(true)} />
            <button type="button" className="capture-btn" onClick={capture} disabled={!ready} aria-label="Capture photo" />
          </>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {previewUrl && (
        <button type="button" className="btn btn-secondary btn-small" style={{ marginTop: 8 }} onClick={retake}>
          Retake
        </button>
      )}
    </div>
  );
}
