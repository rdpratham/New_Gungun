import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react'

const WebcamCapture = forwardRef(function WebcamCapture({ onCapture }, ref) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | requesting | live | captured | error
  const [errorMsg, setErrorMsg] = useState('')
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [capturedURL, setCapturedURL] = useState(null)

  useImperativeHandle(ref, () => ({
    getCapturedBlob: () => capturedBlob,
    hasCapture: () => !!capturedBlob,
  }))

  async function startCamera() {
    setStatus('requesting')
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('live')
    } catch (err) {
      let msg = 'Could not access camera.'
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera access denied. Please allow camera permissions in your browser settings.'
      } else if (err.name === 'NotFoundError') {
        msg = 'No camera found on this device.'
      } else if (err.name === 'NotReadableError') {
        msg = 'Camera is in use by another application.'
      }
      setErrorMsg(msg)
      setStatus('error')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) return
      stopCamera()
      const url = URL.createObjectURL(blob)
      setCapturedBlob(blob)
      setCapturedURL(url)
      setStatus('captured')
      onCapture?.(blob)
    }, 'image/jpeg', 0.9)
  }

  function retake() {
    if (capturedURL) URL.revokeObjectURL(capturedURL)
    setCapturedBlob(null)
    setCapturedURL(null)
    setStatus('idle')
    onCapture?.(null)
  }

  useEffect(() => {
    return () => {
      stopCamera()
      if (capturedURL) URL.revokeObjectURL(capturedURL)
    }
  }, [])

  return (
    <div className="space-y-3">
      {/* Video preview */}
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video w-full max-w-sm mx-auto">
        {status === 'live' && (
          <video
            ref={videoRef}
            className="webcam-mirror w-full h-full object-cover"
            playsInline
            muted
          />
        )}
        {status === 'captured' && capturedURL && (
          <img src={capturedURL} alt="Captured" className="w-full h-full object-cover" />
        )}
        {(status === 'idle' || status === 'requesting' || status === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
            <svg className="w-12 h-12 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {status === 'requesting' && (
              <div className="w-5 h-5 border-2 border-electric-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        )}

        {status === 'live' && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2.5 py-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white text-xs font-medium">LIVE</span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Error message */}
      {status === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {errorMsg}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 justify-center">
        {(status === 'idle' || status === 'error') && (
          <button type="button" onClick={startCamera} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {status === 'error' ? 'Retry Camera' : 'Open Camera'}
          </button>
        )}
        {status === 'live' && (
          <button type="button" onClick={capture} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Capture Photo
          </button>
        )}
        {status === 'captured' && (
          <button type="button" onClick={retake} className="btn-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retake
          </button>
        )}
      </div>

      {status === 'captured' && (
        <p className="text-center text-green-400 text-sm flex items-center justify-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Photo captured successfully
        </p>
      )}
    </div>
  )
})

export default WebcamCapture
