import { useRef, useState, useEffect, useCallback } from 'react';

export default function WebcamCapture({ onCapture, onError }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [camState, setCamState] = useState('idle'); // idle | loading | active | captured | error
  const [capturedImage, setCapturedImage] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const startCamera = useCallback(async () => {
    setCamState('loading');
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamState('active');
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera in your browser settings.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : 'Could not start camera. Please try again.';
      setErrorMsg(msg);
      setCamState('error');
      onError?.(msg);
    }
  }, [onError]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    // Mirror the image (selfie flip)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataURL = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataURL);
    setCamState('captured');
    stopCamera();
    // Convert to blob for upload
    canvas.toBlob((blob) => {
      onCapture?.({ dataURL, blob });
    }, 'image/jpeg', 0.85);
  }, [stopCamera, onCapture]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setCamState('idle');
    onCapture?.(null);
    startCamera();
  }, [startCamera, onCapture]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="space-y-3">
      <label className="label">Attendance Photo</label>

      <div className="relative bg-navy-900 rounded-xl overflow-hidden aspect-video border-2 border-navy-700 flex items-center justify-center">
        {/* Live video (mirrored) */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover scale-x-[-1] ${camState === 'active' ? 'block' : 'hidden'}`}
          muted
          playsInline
        />

        {/* Captured photo */}
        {camState === 'captured' && capturedImage && (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
        )}

        {/* Loading */}
        {camState === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-4 border-electric-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Starting camera...</span>
          </div>
        )}

        {/* Error */}
        {camState === 'error' && (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 00-2 2v4a2 2 0 002 2h9a2 2 0 002-2V10a2 2 0 00-2-2H3z" />
            </svg>
            <p className="text-red-400 text-sm">{errorMsg}</p>
            <button onClick={startCamera} className="btn-secondary text-sm py-1.5 px-4">
              Try Again
            </button>
          </div>
        )}

        {/* Idle */}
        {camState === 'idle' && (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm">Camera not started</span>
          </div>
        )}
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="flex gap-3">
        {camState === 'active' && (
          <button onClick={capturePhoto} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Capture Photo
          </button>
        )}
        {camState === 'captured' && (
          <button onClick={retake} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retake Photo
          </button>
        )}
      </div>

      {camState === 'captured' && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 rounded-lg px-3 py-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Photo captured successfully
        </div>
      )}
    </div>
  );
}
