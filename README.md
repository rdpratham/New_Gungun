# Shorthills AI — Attendance Management System

A full-stack employee attendance management system built with React + Vite + Firebase, deployed to GitHub Pages for free.

---

## Features

- **Admin panel** — manage employees, view attendance reports with photo evidence
- **Employee portal** — daily attendance submission with webcam selfie + work summary
- **Automated popup** — appears at 1:45 AM IST after every shift ends
- **Firebase backend** — Auth, Firestore, Storage (all free tier)
- **Mobile responsive** — works on phones with front camera

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| Auth | Firebase Authentication |
| Database | Firebase Firestore |
| File storage | Firebase Storage |
| Hosting | GitHub Pages |

---

## Setup Guide

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com) → **Add project**
2. Name it (e.g. `shorthills-attendance`) → Continue through setup

### 2. Enable Firebase Services

**Authentication:**
- Go to **Build → Authentication → Get started**
- Enable **Email/Password** sign-in method

**Firestore Database:**
- Go to **Build → Firestore Database → Create database**
- Start in **production mode** (you'll add rules below)
- Choose a region close to your users

**Storage:**
- Go to **Build → Storage → Get started**
- Start in **production mode**

### 3. Get Firebase Config Keys

- Go to **Project Settings** (gear icon) → **Your apps** → **Web app** (or add one)
- Copy the config values

### 4. Set Firestore Security Rules

In Firestore → **Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /employees/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email == 'admin@shorthillsai.com';
    }
    match /attendance/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

Replace `admin@shorthillsai.com` with your actual admin email.

### 5. Set Firebase Storage Rules

In Storage → **Rules**, paste:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /employees/{allPaths=**} {
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

### 6. Create the Admin Account

In Firebase Console → **Authentication → Users → Add user**:
- Email: `admin@shorthillsai.com` (or your chosen admin email)
- Password: strong password of your choice

### 7. Local Development

```bash
# Install dependencies
npm install

# Create .env from template
cp .env.example .env
# Fill in your Firebase values in .env

# Start dev server
npm run dev
```

Open `http://localhost:5173/new_gungun/`

### 8. Deploy to GitHub Pages

**Add GitHub Secrets** — go to repo Settings → Secrets and variables → Actions → New repository secret. Add each:

| Secret name | Value |
|-------------|-------|
| `VITE_FIREBASE_API_KEY` | Your Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID from Firebase |
| `VITE_FIREBASE_APP_ID` | App ID from Firebase |
| `VITE_ADMIN_EMAIL` | `admin@shorthillsai.com` |

**Enable GitHub Pages:**
- Go to repo Settings → Pages → Source: **GitHub Actions**

**Deploy:**
- Push to `main` branch → GitHub Actions builds and deploys automatically

---

## Usage

### Admin
1. Go to `/admin/login`
2. Log in with the admin email and password
3. Add employees from the dashboard (creates Firebase Auth account + Firestore record)
4. View attendance reports with filters by date and employee name

### Employee
1. Go to `/login`
2. Log in with credentials provided by admin
3. At 1:45 AM IST, a popup appears automatically after shift ends
4. Take a webcam selfie and write a work summary (min 50 characters)
5. Submit — record is saved with photo to Firebase

---

## Firestore Data Structure

```
employees/
  {uid}/
    employeeId: string
    name: string
    email: string
    photoURL: string
    createdAt: timestamp

attendance/
  {docId}/
    employeeId: string       (Firebase Auth UID)
    employeeName: string
    date: string             (YYYY-MM-DD in IST)
    submittedAt: timestamp
    workSummary: string
    photoURL: string
```

---

## Cost

**₹0 forever** on Firebase free (Spark) plan:
- 50,000 Firestore reads/day
- 20,000 writes/day
- 1 GB Storage
- GitHub Pages: free
