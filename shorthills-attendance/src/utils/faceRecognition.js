import * as faceapi from '@vladmandic/face-api'

// Load models from jsDelivr CDN — cached by browser after first load
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

let modelsLoaded = false
let loadingPromise = null

export async function loadFaceModels() {
  if (modelsLoaded) return
  if (loadingPromise) { await loadingPromise; return }

  loadingPromise = Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])
  await loadingPromise
  modelsLoaded = true
}

// Extract 128-point face descriptor from a dataURL image
export async function getDescriptorFromDataURL(dataURL) {
  await loadFaceModels()
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor()
        resolve(detection ? Array.from(detection.descriptor) : null)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = dataURL
  })
}

// Compare two face descriptors — returns true if same person
export function isFaceMatch(storedDescriptor, newDescriptor, threshold = 0.65) {
  if (!storedDescriptor?.length || !newDescriptor?.length) return false
  const dist = faceapi.euclideanDistance(
    new Float32Array(storedDescriptor),
    new Float32Array(newDescriptor)
  )
  console.log('Face distance:', dist.toFixed(3), '(threshold:', threshold, ')')
  return dist < threshold
}
