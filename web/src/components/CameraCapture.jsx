import React, { useEffect, useRef, useState } from 'react';

// Live in-app camera capture ONLY. There is deliberately no <input type="file">
// anywhere in this component — evidence photos must come from getUserMedia,
// never a gallery pick or file upload, per compliance requirements.
export default function CameraCapture({ onCapture, captured }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (captured) return; // already have a photo — don't hold the camera open
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError('Camera access is required to capture evidence photos. Please allow camera permission.'));

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [captured]);

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

  if (error) return <div className="error-banner">{error}</div>;

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
