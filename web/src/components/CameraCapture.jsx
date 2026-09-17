import React, { useEffect, useRef, useState } from 'react';

// Live in-app camera capture ONLY. There is deliberately no <input type="file">
// anywhere in this component — evidence photos must come from getUserMedia,
// never a gallery pick or file upload, per compliance requirements.
// getUserMedia rejects with different DOMException names for genuinely
// different problems (permission denied vs. no camera vs. camera busy
// vs. an insecure page) — showing the same "allow permission" message
// for all of them sends people down the wrong troubleshooting path.
function messageForError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Open this site’s settings in your browser (tap the lock/info icon next to the address bar) and set Camera to Allow, then try again.';
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

export default function CameraCapture({ onCapture, captured }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (captured) return; // already have a photo — don't hold the camera open
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support in-app camera capture. Try opening this page in Chrome or Safari directly (not an in-app browser).');
      return;
    }
    let active = true;
    setError('');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => setError(messageForError(err)));

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [captured, attempt]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      setPreviewUrl(URL.createObjectURL(blob));
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
        <button type="button" className="btn btn-secondary btn-small" style={{ marginTop: 8 }} onClick={() => setAttempt((a) => a + 1)}>
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
            <video ref={videoRef} autoPlay playsInline muted />
            <button type="button" className="capture-btn" onClick={capture} aria-label="Capture photo" />
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
