// App.js
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

const Landing = lazy(() => import('./pages/Landing/Landing'));
const Home = lazy(() => import('./pages/Home/Home'));
const Login = lazy(() => import('./pages/Login/Login'));
const Profile = lazy(() => import('./pages/Profile/Profile'));
const Notifications = lazy(() => import('./pages/Notifications/Notifications'));
const Student = lazy(() => import('./pages/Student/Student'));
const Faculty = lazy(() => import('./pages/Faculty/Faculty'));
const FacultySchedules = lazy(() => import('./pages/Faculty/FacultySchedules'));
const RoomTracker = lazy(() => import('./pages/Faculty/RoomTracker'));
const Admin = lazy(() => import('./pages/Admin/Admin'));
const Kiosk = lazy(() => import('./pages/Kiosk/Kiosk'));

function App() {
  return (
    <Router>
      <div className="App">
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-xl">Loading...</div></div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/signup" element={<Navigate to="/login" replace />} />
            <Route path="/student" element={<ProtectedRoute permission="access_student_module"><Student /></ProtectedRoute>} />
            <Route path="/faculty" element={<ProtectedRoute permission="access_faculty_module"><Faculty /></ProtectedRoute>} />
            <Route path="/faculty-schedules" element={<ProtectedRoute permission="view_schedules"><FacultySchedules /></ProtectedRoute>} />
            <Route path="/room-tracker" element={<ProtectedRoute permission="access_faculty_module"><RoomTracker /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute permission="access_admin_module"><Admin /></ProtectedRoute>} />
            <Route path="/kiosk" element={<Kiosk />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;
