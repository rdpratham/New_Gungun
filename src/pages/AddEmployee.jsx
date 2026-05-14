import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase'
import Navbar from '../components/Navbar'
import { signOut } from 'firebase/auth'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function AddEmployee() {
  const [form, setForm] = useState({
    employeeId: '', name: '', email: '', password: '', confirmPassword: '',
  })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5 MB.')
      return
    }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!photo) {
      setError('Please upload an employee photo.')
      return
    }

    setLoading(true)

    // Save current admin credentials to re-authenticate after creating employee user
    const adminUser = auth.currentUser
    const adminEmail = adminUser.email

    try {
      // 1. Convert photo to base64 (no Storage needed)
      const photoURL = await fileToBase64(photo)

      // 2. Create Firebase Auth user for employee
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
      const empUid = cred.user.uid

      // 3. Save employee data to Firestore using their UID as the document ID
      await setDoc(doc(db, 'employees', empUid), {
        employeeId: form.employeeId,
        name: form.name,
        email: form.email,
        photoURL,
        createdAt: serverTimestamp(),
      })

      setSuccess(true)
      setForm({ employeeId: '', name: '', email: '', password: '', confirmPassword: '' })
      setPhoto(null)
      setPhotoPreview(null)
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password is too weak.',
      }
      setError(messages[err.code] || `Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await signOut(auth)
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col">
      <Navbar isAdmin onLogout={handleLogout} />

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Add New Employee</h1>
            <p className="text-slate-400 text-sm mt-0.5">Create an employee account and profile</p>
          </div>
        </div>

        {success && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-medium">Employee added successfully!</p>
              <p className="text-sm mt-0.5 text-green-400/70">The employee can now log in with their email and password.</p>
              <button
                onClick={() => { setSuccess(false) }}
                className="text-sm underline mt-2 hover:no-underline"
              >
                Add another employee
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Photo upload */}
            <div>
              <label className="label">Profile Photo *</label>
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-xl bg-navy-700 border-2 border-dashed border-navy-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <div>
                  <label className="btn-secondary text-sm cursor-pointer inline-block">
                    {photo ? 'Change Photo' : 'Upload Photo'}
                    <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                  </label>
                  <p className="text-xs text-slate-500 mt-1.5">JPG, PNG up to 5 MB</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label">Employee ID *</label>
                <input
                  name="employeeId"
                  type="text"
                  className="input-field"
                  placeholder="e.g. EMP001"
                  value={form.employeeId}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="label">Full Name *</label>
                <input
                  name="name"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Rahul Sharma"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Email Address *</label>
              <input
                name="email"
                type="email"
                className="input-field"
                placeholder="rahul@shorthillsai.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label">Password *</label>
                <input
                  name="password"
                  type="password"
                  className="input-field"
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="label">Confirm Password *</label>
                <input
                  name="confirmPassword"
                  type="password"
                  className="input-field"
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/admin/dashboard')}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating…
                  </>
                ) : 'Create Employee'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
