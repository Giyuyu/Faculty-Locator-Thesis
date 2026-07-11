import React from 'react';
import { useNavigate } from 'react-router-dom';  // <-- Import

function LoginModal({ isOpen, closeModal }) {
  const navigate = useNavigate();  // <-- Hook for navigation

  const handleLogin = (e) => {
    e.preventDefault();
    closeModal();           // Optional: close modal
    navigate('/home');      // <-- Redirect to /home
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-300 scale-100 hover:scale-105">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white text-center relative">
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors duration-200"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold mb-2">Welcome Back</h2>
          <p className="text-blue-100">Sign in to your account</p>
        </div>
        <form onSubmit={handleLogin} className="p-6">
          <div className="mb-4">
            <label htmlFor="loginEmail" className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
            <div className="relative">
              <input
                type="email"
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                id="loginEmail"
                placeholder="name@example.com"
                required
              />
              <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="loginPassword" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <input
                type="password"
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                id="loginPassword"
                placeholder="Enter your password"
                required
              />
              <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <label className="flex items-center">
              <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>
            <a href="#" className="text-sm text-blue-600 hover:text-blue-500 font-medium">Forgot password?</a>
          </div>

          <div className="flex space-x-3">
            <button type="button" className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-lg transition-all duration-200 font-medium" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 py-3 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl">
              Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;
