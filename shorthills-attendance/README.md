# Shorthills AI — Attendance Management System

A full-stack web attendance system built with React + Firebase. Free forever.

**Made with ♥ by Pratham Jain**

---

## What This Does

- **Admin** can add employees, view all attendance records, filter by date/name
- **Employees** log in with email + password
- Every night at **1:45 AM IST**, a popup appears — employees must submit a photo (via webcam) and a work summary
- All data stored in Firebase (free tier — no cost)

---

## Step-by-Step Setup (Non-Coder Friendly)

### STEP 1 — Create a Firebase Project (Free)

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter project name: `shorthills-attendance` → Click **Continue** → Click **Create project**
4. Wait for it to finish → Click **Continue**

### STEP 2 — Enable Firebase Services

#### 2a. Enable Authentication
1. In Firebase Console, click **Authentication** (left sidebar)
2. Click **Get started**
3. Click **Email/Password** → Toggle **Enable** → Click **Save**

#### 2b. Enable Firestore Database
1. Click **Firestore Database** (left sidebar)
2. Click **Create database**
3. Choose **Start in test mode** → Click **Next** → Choose your region → Click **Done**

#### 2c. Enable Storage
1. Click **Storage** (left sidebar)
2. Click **Get started**
3. Choose **Start in test mode** → Click **Next** → Click **Done**

### STEP 3 — Get Your Firebase Config Keys

1. In Firebase Console, click the **gear icon** (⚙️) → **Project settings**
2. Scroll down to **"Your apps"** section
3. Click **`</>`** (Web) icon to add a web app
4. Enter app nickname: `shorthills-attendance` → Click **Register app**
5. You'll see a config object like this — **copy all these values**:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123..."
};
```

### STEP 4 — Create Admin Account in Firebase

1. In Firebase Console → **Authentication** → **Users** tab
2. Click **Add user**
3. Enter:
   - Email: `admin@shorthillsai.com` (or whatever you want)
   - Password: choose a strong password
4. Click **Add user**
5. **Remember this email** — you'll need it in the next step

### STEP 5 — Set Firestore Security Rules

1. In Firebase Console → **Firestore Database** → **Rules** tab
2. Replace the existing rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Employees collection — readable by authenticated users, writable by admin only
    match /employees/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email == "admin@shorthillsai.com";
    }
    // Attendance — employees can write their own, admin can read all
    match /attendance/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == resource.data.employeeUid;
      allow update, delete: if false;
    }
  }
}
```

3. Replace `admin@shorthillsai.com` with your actual admin email
4. Click **Publish**

### STEP 6 — Set Storage Rules

1. In Firebase Console → **Storage** → **Rules** tab
2. Replace with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /employees/{employeeId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /attendance/{employeeId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == employeeId;
    }
  }
}
```

3. Click **Publish**

### STEP 7 — Create Your .env File

1. In the `shorthills-attendance` folder, copy `.env.example` to `.env`
2. Open `.env` and fill in your Firebase values:

```
VITE_FIREBASE_API_KEY=AIza...your_key...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123...
VITE_ADMIN_EMAIL=admin@shorthillsai.com
```

### STEP 8 — Run Locally (For Testing)

```bash
cd shorthills-attendance
npm install
npm run dev
```

Open [http://localhost:5173/shorthills-attendance/](http://localhost:5173/shorthills-attendance/)

### STEP 9 — Push to GitHub

1. Create a GitHub repository named `shorthills-attendance` at [https://github.com/new](https://github.com/new)
2. Make it **Public** (required for free GitHub Pages)
3. Push your code:

```bash
git init
git add .
git commit -m "Initial commit — Shorthills AI Attendance System"
git remote add origin https://github.com/YOUR_USERNAME/shorthills-attendance.git
git push -u origin main
```

### STEP 10 — Add GitHub Secrets (for auto-deployment)

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"** for each of these:

| Secret Name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | Your API key from Step 3 |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | e.g. `your-project` |
| `VITE_FIREBASE_STORAGE_BUCKET` | e.g. `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | The number from Step 3 |
| `VITE_FIREBASE_APP_ID` | The appId from Step 3 |
| `VITE_ADMIN_EMAIL` | e.g. `admin@shorthillsai.com` |

### STEP 11 — Enable GitHub Pages

1. Go to GitHub repository → **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Branch: `gh-pages` → Folder: `/ (root)` → Click **Save**

### STEP 12 — Deploy!

Every time you push to the `main` branch, GitHub Actions will automatically build and deploy.

**Your app will be live at:**
`https://YOUR_USERNAME.github.io/shorthills-attendance/`

---

## How to Use

### Admin
1. Go to `/admin/login`
2. Log in with your admin email + password
3. Add employees using **"Add New Employee"** button
4. View all attendance records in the **"Attendance Records"** tab
5. Filter by date or employee name

### Employee
1. Go to `/login` (or the root URL)
2. Log in with the email + password the admin created
3. Your dashboard shows today's attendance status
4. At **1:45 AM IST**, a popup appears automatically — capture your photo and write your work summary
5. Hit **Submit Attendance**

---

## Project Structure

```
shorthills-attendance/
├── src/
│   ├── pages/
│   │   ├── AdminLogin.jsx          — Admin sign-in page
│   │   ├── AdminDashboard.jsx      — Employee list + attendance records
│   │   ├── AddEmployee.jsx         — Add new employee form
│   │   ├── EmployeeLogin.jsx       — Employee sign-in page
│   │   └── EmployeeAttendance.jsx  — Employee home + popup trigger
│   ├── components/
│   │   ├── WebcamCapture.jsx       — Camera capture component
│   │   ├── AttendancePopup.jsx     — Full-screen attendance submission modal
│   │   ├── EmployeeCard.jsx        — Employee list item card
│   │   └── Navbar.jsx              — Top navigation bar
│   ├── firebase.js                 — Firebase initialization
│   ├── App.jsx                     — Routing + auth state
│   └── main.jsx                    — React entry point
├── .env.example                    — Environment variable template
├── .github/workflows/deploy.yml    — Auto-deploy to GitHub Pages
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## Tech Stack (100% Free)

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Auth | Firebase Authentication |
| Database | Firebase Firestore |
| File Storage | Firebase Storage |
| Webcam | Browser native API (`getUserMedia`) |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

**Total cost: ₹0 forever** — Firebase free tier handles ~50,000 reads/day.

---

## Troubleshooting

**"Camera not working"** — Make sure you're using HTTPS (GitHub Pages uses HTTPS). `getUserMedia` doesn't work on `http://`.

**"Permission denied" error in Firestore** — Check your Firestore security rules (Step 5).

**"User not found" on employee login** — Make sure the admin added the employee through the dashboard (not directly in Firebase Console).

**Build fails in GitHub Actions** — Make sure all 7 secrets are added in Step 10.

---

*Made with ♥ by Pratham Jain*
