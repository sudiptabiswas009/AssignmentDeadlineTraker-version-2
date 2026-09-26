# 📚 Assignment Deadline Tracker V2

A full-stack **Assignment & Deadline Management System** built to help students manage assignments, deadlines, subjects, and completion status in one place.

The project uses a **Java backend, MySQL database, and Next.js frontend**, with multi-user authentication so each student can manage their own assignments.

---

## 🚀 Live Project

🌐 **Frontend:**  
https://app.sudipta.dpdns.org

🔗 **Backend API:**  
https://api.sudipta.dpdns.org

---

## ✨ Features

### 🔐 Authentication
- User Signup
- User Login
- UID + Password authentication
- BCrypt password hashing
- Session/token-based authentication
- Logout
- Multi-user support
- Each user can access only their own assignments

### 📋 Assignment Management
- Add assignments
- View all assignments
- Edit assignments
- Delete assignments
- Mark assignments as completed
- Undo deleted assignments
- Assignment descriptions
- Assignment details popup

### 📊 Dashboard
- Total Assignments
- Pending Assignments
- Completed Assignments
- Overdue Assignments
- Due Today
- Clickable dashboard statistics

### 🔎 Search & Filtering
- Search assignments by subject
- Filter by:
  - All
  - Pending
  - Completed
  - Overdue
  - Due Today
- Subject-based filtering
- Sorting by:
  - Soonest deadline
  - Latest deadline
  - Subject
  - Newest

### 📅 Deadline Management
- Upcoming assignments
- Calendar view
- List view
- Deadline reminders
- Browser notifications
- Due-date tracking

### 🎨 UI Features
- Modern dashboard interface
- Assignment cards
- Clickable assignment cards
- Toast notifications
- Loading states
- Error handling
- Completion confetti
- Progress ring
- "Next Up" assignment section
- Developer credit

---

## 🛠️ Technologies Used

### Frontend

- Next.js
- React
- TypeScript
- CSS

### Backend

- Java
- Java HTTP Server
- JDBC
- BCrypt

### Database

- MySQL

### Deployment

- Vercel — Frontend
- Cloudflare Tunnel — Backend API

---

## 🏗️ Project Architecture

```text
Assignment Deadline Tracker V2
│
├── backend/
│   ├── Main.java
│   ├── Assignment.java
│   ├── AssignmentManager.java
│   ├── DatabaseManager.java
│   ├── ApiServer.java
│   │
│   └── lib/
│       ├── jbcrypt-0.4.jar
│       └── mysql-connector-j-26.7.0.jar
│
└── frontend/
    ├── app/
    ├── public/
    ├── package.json
    └── ...
