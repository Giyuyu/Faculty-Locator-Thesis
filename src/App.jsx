// App.js
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

const Landing = lazy(() => import('./pages/Landing/Landing'));
const Home = lazy(() => import('./pages/Home/Home'));
const Login = lazy(() => import('./pages/Login/Login'));
const Student = lazy(() => import('./pages/Student/Student'));
const Faculty = lazy(() => import('./pages/Faculty/Faculty'));
const FacultySchedules = lazy(() => import('./pages/Faculty/FacultySchedules'));
const RoomTracker = lazy(() => import('./pages/Faculty/RoomTracker'));
const Admin = lazy(() => import('./pages/Admin/Admin'));

function App() {
  return (
    <Router>
      <div className="App">
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-xl">Loading...</div></div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Navigate to="/login" replace />} />
            <Route path="/student" element={<Student />} />
            <Route path="/faculty" element={<Faculty />} />
            <Route path="/faculty-schedules" element={<FacultySchedules />} />
            <Route path="/room-tracker" element={<RoomTracker />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;
