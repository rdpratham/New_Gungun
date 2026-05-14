# Shorthills AI — Attendance Management System

A full-stack web attendance system built with React + Vite + Firebase. Employees submit daily attendance with a webcam photo and work summary. Admins can manage employees and view all attendance reports.

**Made by Pratham Jain**

---

## What This System Does

- **Admin** can add employees, view all attendance records, and filter by date/name
- **Employees** log in and submit their daily attendance with a photo + work summary
- At **1:45 AM IST** a popup automatically appears — employees cannot dismiss it without submitting
- All data stored securely in Firebase (free tier)

---

## STEP 1 — Create a Firebase Project (Free)

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter project name: `shorthills-attendance` → Click Continue
4. Disable Google Analytics (not needed) → Click **"Create project"**
5. Wait for it to finish, then click **"Continue"**

---

## STEP 2 — Enable Firebase Authentication

1. In the Firebase console, click **"Authentication"** in the left sidebar
2. Click **"Get started"**
3. Under "Sign-in providers", click **"Email/Password"**
4. Toggle **"Enable"** → Click **"Save"**

### Create the Admin Account

1. Still in Authentication, click the **"Users"** tab
2. Click **"Add user"**
3. Enter your admin email (e.g. `admin@shorthillsai.com`) and a strong password
4. Click **"Add user"**
5. **Save this email and password** — you'll need them to log in as admin

---

## STEP 3 — Enable Firestore Database

1. Click **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Choose **"Start in production mode"** → Click Next
4. Select a region close to your users (e.g. `asia-south1` for India) → Click **"Enable"**

### Set Firestore Security Rules

1. In Firestore, click the **"Rules"** tab
2. Replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /employees/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email == 'YOUR_ADMIN_EMAIL';
    }
    match /attendance/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.employeeUID;
    }
  }
}
```

3. Replace `YOUR_ADMIN_EMAIL` with your actual admin email
4. Click **"Publish"**

---

## STEP 4 — Enable Firebase Storage

1. Click **"Storage"** in the left sidebar
2. Click **"Get started"**
3. Choose **"Start in production mode"** → Click Next
4. Select same region as Firestore → Click **"Done"**

### Set Storage Security Rules

1. In Storage, click the **"Rules"** tab
2. Replace everything with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /employees/{employeeId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email == 'YOUR_ADMIN_EMAIL';
    }
    match /attendance/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Replace `YOUR_ADMIN_EMAIL` with your actual admin email
4. Click **"Publish"**

---

## STEP 5 — Get Your Firebase Config Keys

1. In Firebase console, click the **gear icon** ⚙️ next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click **"</>"** (Web app icon)
5. Enter app name: `shorthills-attendance-web` → Click **"Register app"**
6. You'll see a `firebaseConfig` object like this:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc"
};
```

7. **Copy these values** — you'll need them in the next steps

---

## STEP 6 — Run Locally (for testing)

### Prerequisites
- Install [Node.js](https://nodejs.org) (version 18 or higher)
- Install [Git](https://git-scm.com)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/rdpratham/new_gungun.git
cd new_gungun/shorthills-attendance

# 2. Install dependencies
npm install

# 3. Create your .env file (copy from example)
cp .env.example .env
```

### Fill in your .env file

Open `.env` in any text editor (Notepad, VS Code, etc.) and fill in your Firebase values:

```
VITE_FIREBASE_API_KEY=AIza...your_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc
VITE_ADMIN_EMAIL=admin@shorthillsai.com
```

### Start the dev server

```bash
npm run dev
```

Open your browser to `http://localhost:5173/new_gungun/shorthills-attendance/`

---

## STEP 7 — Deploy to GitHub Pages (Free Hosting)

### Add GitHub Secrets

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"** for each of these:

| Secret Name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | Your Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Your Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Your Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Your Firebase app ID |
| `VITE_ADMIN_EMAIL` | Your admin email address |

### Enable GitHub Pages

1. Go to your repository → **Settings** → **Pages**
2. Under "Source", select **"Deploy from a branch"**
3. Select branch: `gh-pages` → folder: `/ (root)`
4. Click **Save**

### Trigger Deployment

Push any change to the `main` branch inside the `shorthills-attendance/` folder. GitHub Actions will automatically build and deploy.

Your live URL will be:
```
https://rdpratham.github.io/new_gungun/shorthills-attendance/
```

---

## How to Use the System

### Admin Login
1. Go to `/admin/login`
2. Enter the admin email and password you created in Step 2
3. Add employees using the **"Add New Employee"** button
4. View attendance reports under the **"Attendance Reports"** tab

### Employee Login
1. Go to the site (home page redirects based on role)
2. Enter the email and password given by the admin
3. At **1:45 AM IST**, a popup will appear automatically — fill in the work summary and capture a photo
4. You can also submit manually any time before that

---

## Project Structure

```
shorthills-attendance/
├── src/
│   ├── pages/
│   │   ├── AdminLogin.jsx         — Admin sign-in page
│   │   ├── AdminDashboard.jsx     — Employee list + attendance reports
│   │   ├── AddEmployee.jsx        — Form to create new employees
│   │   ├── EmployeeLogin.jsx      — Employee sign-in page
│   │   └── EmployeeAttendance.jsx — Employee home + attendance popup
│   ├── components/
│   │   ├── WebcamCapture.jsx      — Live webcam + photo capture
│   │   ├── AttendancePopup.jsx    — Full-screen attendance modal
│   │   ├── EmployeeCard.jsx       — Employee list item
│   │   └── Navbar.jsx             — Top navigation bar
│   ├── firebase.js                — Firebase initialization
│   ├── App.jsx                    — Routes and auth state
│   └── main.jsx                   — React entry point
├── .env.example                   — Environment variable template
├── .github/workflows/deploy.yml   — Auto-deploy to GitHub Pages
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | React 18 + Vite | Free |
| Styling | Tailwind CSS | Free |
| Auth | Firebase Authentication | Free (50k ops/month) |
| Database | Firebase Firestore | Free (50k reads/day) |
| File Storage | Firebase Storage | Free (5GB) |
| Hosting | GitHub Pages | Free (unlimited) |
| Webcam | Browser native API | Free |

**Total cost: ₹0 forever** for a small team.

---

*Made by Pratham Jain*
