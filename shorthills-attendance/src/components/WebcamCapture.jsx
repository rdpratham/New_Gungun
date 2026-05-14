import { useRef, useState, useEffect, useCallback } from 'react';

export default function WebcamCapture({ onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const startCamera = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Could not start camera: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataURL = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataURL);
    stopCamera();
    onCapture(dataURL);
  };

  const retake = () => {
    setCaptured(null);
    onCapture(null);
    startCamera();
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">Attendance Photo</label>
      <div className="rounded-xl overflow-hidden bg-navy-700 aspect-video relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-electric-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
            <div>
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={startCamera} className="mt-3 px-4 py-2 bg-electric-500 text-white rounded-lg text-sm hover:bg-electric-600 transition-colors">
                Try Again
              </button>
            </div>
          </div>
        )}
        {!captured ? (
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
        ) : (
          <img src={captured} alt="Captured" className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <div className="flex gap-3">
        {!captured ? (
          <button
            onClick={capturePhoto}
            disabled={!streaming || loading}
            className="flex-1 py-3 bg-electric-500 hover:bg-electric-600 disabled:bg-navy-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-colors"
          >
            Capture Photo
          </button>
        ) : (
          <button
            onClick={retake}
            className="flex-1 py-3 bg-navy-700 hover:bg-navy-600 text-white font-medium rounded-xl transition-colors border border-navy-600"
          >
            Retake Photo
          </button>
        )}
      </div>
      {captured && <p className="text-green-400 text-sm text-center">Photo captured successfully</p>}
    </div>
  );
}
