import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, get, child, update } from 'firebase/database';
import { auth, database } from '../../firebase';

const ROLES = {
  admin: {
    role_id: 'admin',
    role_name: 'Admin'
  },
  faculty: {
    role_id: 'faculty',
    role_name: 'Faculty'
  },
  student: {
    role_id: 'student',
    role_name: 'Student'
  }
};

const SPECIAL_PASSWORD_CHARS = `!@#$%^&*()_+-=[]{};':"\\|,.<>/?`;

const hasSpecialPasswordChar = (value) =>
  [...value].some((char) => SPECIAL_PASSWORD_CHARS.includes(char));

function Signup() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userType, setUserType] = useState('student'); // 'student' or 'faculty'
  const [formData, setFormData] = useState({
    studentId: '',
    facultyId: '',
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  // Validation functions
  const validateStudentId = (id) => {
    // Format: 02000xxxxxx (11 digits, starts with 02000)
    const studentIdRegex = /^02000\d{6}$/;
    return studentIdRegex.test(id);
  };

  const validateFacultyId = (id) => {
    // Format: NVSxxxxF (7 characters: NVS + 4 digits + F)
    const facultyIdRegex = /^NVS\d{4}F$/;
    return facultyIdRegex.test(id);
  };

  const validateEmail = (email) => {
    // STI Novaliches domain validation
    const stiEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@novaliches\.sti\.edu\.ph$/;
    return stiEmailRegex.test(email) && email.length <= 254;
  };

  const validatePassword = (password) => {
    // ISO 27001 compliant password requirements
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = hasSpecialPasswordChar(password);

    return password.length >= minLength &&
           hasUpperCase &&
           hasLowerCase &&
           hasNumbers &&
           hasSpecialChar;
  };

  const validateName = (name) => {
    // Allow letters, spaces, hyphens, apostrophes (Unicode compliant)
    const nameRegex = /^[\p{L}\s\-']{1,30}$/u;
    return nameRegex.test(name.trim()) && name.trim().length >= 1;
  };

  const validateForm = () => {
    const errors = {};

    // Common validations
    if (!validateName(formData.firstName)) {
      errors.firstName = 'First name must be 1-30 characters and contain only letters, spaces, hyphens, and apostrophes.';
    }

    if (!validateName(formData.lastName)) {
      errors.lastName = 'Last name must be 1-30 characters and contain only letters, spaces, hyphens, and apostrophes.';
    }

    if (formData.middleName && !validateName(formData.middleName)) {
      errors.middleName = 'Middle name must contain only letters, spaces, hyphens, and apostrophes.';
    }

    if (!validateEmail(formData.email)) {
      errors.email = 'Email must be from @novaliches.sti.edu.ph domain.';
    }

    if (!validatePassword(formData.password)) {
      errors.password = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    // User type specific validations
    if (userType === 'student') {
      if (!formData.studentId.trim()) {
        errors.studentId = 'Student ID is required.';
      } else if (!validateStudentId(formData.studentId)) {
        errors.studentId = 'Student ID must be in format: 02000xxxxxx (e.g., 02000123456).';
      }
    } else {
      if (!formData.facultyId.trim()) {
        errors.facultyId = 'Faculty ID is required.';
      } else if (!validateFacultyId(formData.facultyId)) {
        errors.facultyId = 'Faculty ID must be in format: NVSxxxxF (e.g., NVS0690F).';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Update password checks progressively
    if (name === 'password') {
      setPasswordChecks({
        length: value.length >= 8,
        upper: /[A-Z]/.test(value),
        lower: /[a-z]/.test(value),
        number: /\d/.test(value),
        special: hasSpecialPasswordChar(value)
      });
    }
  };

  const handleUserTypeChange = (type) => {
    setUserType(type);
    setValidationErrors({});
    // Clear the ID field when switching types
    setFormData(prev => ({
      ...prev,
      studentId: type === 'student' ? prev.studentId : '',
      facultyId: type === 'faculty' ? prev.facultyId : ''
    }));
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Please correct the errors below.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
       const db = database;

      // Check if student/faculty ID already exists (with retry logic for slow networks)
      const idToCheck = userType === 'student' ? formData.studentId : formData.facultyId;
      const idPath = userType === 'student'
        ? `students/${idToCheck}`
        : `faculties/${idToCheck}`;
      
      let idExists = false;
      let lastError = null;
      
      // Try up to 3 times with increasing timeout for slow networks (like mobile data)
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const idSnapshot = await get(child(ref(db), idPath));
          idExists = idSnapshot.exists();
          lastError = null;
          break; // Success, exit retry loop
        } catch (checkError) {
          lastError = checkError;
          console.error(`ID check attempt ${attempt} failed:`, checkError);
          
          // Wait longer between each retry
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, attempt * 1500));
          }
        }
      }

      if (lastError) {
        // Check specific error types
        if (lastError.code === 'permission_denied' || 
            lastError.message?.includes('Permission denied')) {
          setError('Database access denied. Please contact administrator to configure Firebase rules.');
        } else if (lastError.code === 'auth/network-request-failed' || 
            lastError.message?.includes('network') ||
            lastError.message?.includes('timeout')) {
          setError('Network is slow. Please try again with a stable connection or wait a moment.');
        } else {
          setError('Unable to verify ID. Please check your network connection and try again.');
        }
        setIsLoading(false);
        return;
      }

      if (idExists) {
        setError(`${userType === 'student' ? 'Student' : 'Faculty'} ID already exists. Please use a different ID.`);
        setIsLoading(false);
        return;
      }

      // Create user with Firebase Authentication (with retry for slow networks)
      let user;
      let authError = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          user = userCredential.user;
          authError = null;
          break;
        } catch (err) {
          authError = err;
          console.error(`Auth attempt ${attempt} failed:`, err);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, attempt * 1500));
          }
        }
      }

      if (authError) {
        // Handle specific Firebase errors
        if (authError.code === 'auth/email-already-in-use') {
          setError('An account with this email already exists.');
        } else if (authError.code === 'auth/weak-password') {
          setError('Password is too weak. Please choose a stronger password.');
        } else if (authError.code === 'auth/invalid-email') {
          setError('Invalid email address format.');
        } else if (authError.code === 'auth/network-request-failed' || 
                   authError.message?.includes('network') ||
                   authError.message?.includes('timeout')) {
          setError('Network is slow. Please try again with a stable connection or wait a moment.');
        } else if (authError.code === 'auth/operation-not-allowed') {
          setError('Email/password sign-up is not enabled. Contact administrator.');
        } else if (authError.code === 'auth/too-many-requests') {
          setError('Too many attempts. Please wait a moment and try again.');
        } else {
          setError(authError.message || 'Failed to create account. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      // Prepare schema-based records for Realtime Database
      const createdDate = new Date().toISOString();
      const roleId = userType;
      const status = 'active';

      const userRecord = {
        user_id: user.uid,
        username: formData.email,
        password: 'managed_by_firebase_auth',
        role_id: roleId,
        status,
        created_date: createdDate
      };

      const profileRecord = userType === 'student'
        ? {
            student_id: formData.studentId,
            user_id: user.uid,
            student_number: formData.studentId,
            first_name: formData.firstName,
            middle_name: formData.middleName || '',
            last_name: formData.lastName
          }
        : {
            faculty_id: formData.facultyId,
            user_id: user.uid,
            first_name: formData.firstName,
            middle_name: formData.middleName || '',
            last_name: formData.lastName,
            department: '',
            email: formData.email,
            status
          };

      const dbUpdates = {
        [`users/${user.uid}`]: userRecord,
        [`roles/${ROLES.admin.role_id}`]: ROLES.admin,
        [`roles/${ROLES.faculty.role_id}`]: ROLES.faculty,
        [`roles/${ROLES.student.role_id}`]: ROLES.student,
        [userType === 'student'
          ? `students/${formData.studentId}`
          : `faculties/${formData.facultyId}`]: profileRecord
      };

      // Store schema records in Realtime Database (with retry for slow networks)
      let dbWriteError = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await update(ref(db), dbUpdates);
          
          dbWriteError = null;
          break; // Success, exit retry loop
        } catch (dbError) {
          dbWriteError = dbError;
          console.error(`Database write attempt ${attempt} failed:`, dbError);
          
          // Wait longer between each retry
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, attempt * 1500));
          }
        }
      }

      if (dbWriteError) {
        console.error('Database write error:', dbWriteError);
        // Clean up: delete the auth user if database write fails
        try {
          await user.delete();
        } catch (deleteError) {
          console.error('Failed to clean up auth user:', deleteError);
        }
        
        if (dbWriteError.code === 'auth/network-request-failed' || 
            dbWriteError.message?.includes('network') ||
            dbWriteError.message?.includes('timeout')) {
          setError('Network is slow. Please try again with a stable connection or wait a moment.');
        } else {
          setError('Failed to save account data. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error('Signup error:', err);

      // Handle specific Firebase errors
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/password sign-up is not enabled. Contact administrator.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.');
      } else {
        // Show more informative error message
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-teal-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center min-h-[500px]">
          {/* Left side - Info */}
          <div className="text-center md:text-left space-y-6 md:space-y-8 flex flex-col justify-center">
            {/* Navigation */}
            <div className="flex justify-center md:justify-start">
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/60 backdrop-blur-sm rounded-full border border-gray-200/50 hover:bg-white/80 transition-all duration-200 shadow-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </Link>
            </div>

            <div>
              <div className="mx-auto lg:mx-0 w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent leading-relaxed pt-2 pb-1">
                Join Our Community
              </h1>
              <p className="text-lg text-gray-600 mb-4 leading-relaxed">
                Start your journey with Faculty Tracker and streamline academic management.
              </p>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Why Choose Us?</h3>
                <div className="space-y-2">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-gray-700 text-sm">Free registration and setup</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-gray-700 text-sm">Secure and reliable platform</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-gray-700 text-sm">24/7 support and assistance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Signup Form */}
          <div className="flex justify-center">
            <div className="w-full max-w-lg">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Create Account</h2>
                <p className="text-gray-600">Join us today and get started</p>
              </div>

              <form className="space-y-4 bg-white/95 backdrop-blur-lg p-6 rounded-3xl shadow-2xl border border-white/40 hover:shadow-3xl transition-all duration-300" onSubmit={handleSignup}>
                {/* User Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUserTypeChange('student')}
                      className={`flex-1 p-4 border-2 rounded-xl text-center text-sm font-medium transition-all duration-200 cursor-pointer ${
                        userType === 'student'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUserTypeChange('faculty')}
                      className={`flex-1 p-4 border-2 rounded-xl text-center text-sm font-medium transition-all duration-200 cursor-pointer ${
                        userType === 'faculty'
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Faculty
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* ID Field - Dynamic based on user type */}
                  <div>
                    <label htmlFor={userType === 'student' ? 'studentId' : 'facultyId'} className="block text-sm font-medium text-gray-700 mb-2">
                      {userType === 'student' ? 'Student ID' : 'Faculty ID'} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <input
                        id={userType === 'student' ? 'studentId' : 'facultyId'}
                        name={userType === 'student' ? 'studentId' : 'facultyId'}
                        type="text"
                        value={userType === 'student' ? formData.studentId : formData.facultyId}
                        onChange={handleInputChange}
                        required
                        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:bg-white/70 focus:bg-white ${
                          validationErrors[userType === 'student' ? 'studentId' : 'facultyId']
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder={userType === 'student' ? '02000123456' : 'NVS0690F'}
                      />
                      <div className="absolute left-4 top-3.5">
                        <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 7V3a2 2 0 012-2z" />
                        </svg>
                      </div>
                    </div>
                    {validationErrors[userType === 'student' ? 'studentId' : 'facultyId'] && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors[userType === 'student' ? 'studentId' : 'facultyId']}</p>
                    )}
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        autoComplete="given-name"
                        required
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:bg-white/70 focus:bg-white text-sm ${
                          validationErrors.firstName ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="First"
                      />
                      {validationErrors.firstName && (
                        <p className="mt-1 text-xs text-red-600">{validationErrors.firstName}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-2">
                        Middle Name
                      </label>
                      <input
                        id="middleName"
                        name="middleName"
                        type="text"
                        value={formData.middleName}
                        onChange={handleInputChange}
                        autoComplete="additional-name"
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:bg-white/70 focus:bg-white text-sm ${
                          validationErrors.middleName ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="Middle (Optional)"
                      />
                      {validationErrors.middleName && (
                        <p className="mt-1 text-xs text-red-600">{validationErrors.middleName}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        autoComplete="family-name"
                        required
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:bg-white/70 focus:bg-white text-sm ${
                          validationErrors.lastName ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="Last"
                      />
                      {validationErrors.lastName && (
                        <p className="mt-1 text-xs text-red-600">{validationErrors.lastName}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      autoComplete="email"
                      required
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:bg-white/70 focus:bg-white text-sm ${
                        validationErrors.email ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="your.email@novaliches.sti.edu.ph"
                    />
                    <p className="mt-1 text-xs text-gray-500">Must use <span className="font-medium">@novaliches.sti.edu.ph</span> domain</p>
                    {validationErrors.email && (
                      <p className="mt-1 text-xs text-red-600">{validationErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-500 mb-2">Password must contain all of the following:</p>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      autoComplete="new-password"
                      required
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:bg-white/70 focus:bg-white text-sm ${
                        validationErrors.password ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="Create strong password"
                    />
                    {validationErrors.password && (
                      <p className="mt-1 text-xs text-red-600">{validationErrors.password}</p>
                    )}
                    <div className="mt-1 space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.length ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {passwordChecks.length ? (
                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <span className={`text-xs ${passwordChecks.length ? 'text-green-700' : 'text-gray-500'}`}>At least 8 characters</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.upper ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {passwordChecks.upper ? (
                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <span className={`text-xs ${passwordChecks.upper ? 'text-green-700' : 'text-gray-500'}`}>One uppercase letter</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.lower ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {passwordChecks.lower ? (
                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <span className={`text-xs ${passwordChecks.lower ? 'text-green-700' : 'text-gray-500'}`}>One lowercase letter</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.number ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {passwordChecks.number ? (
                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <span className={`text-xs ${passwordChecks.number ? 'text-green-700' : 'text-gray-500'}`}>One number</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.special ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {passwordChecks.special ? (
                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <span className={`text-xs ${passwordChecks.special ? 'text-green-700' : 'text-gray-500'}`}>One special character</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      autoComplete="new-password"
                      required
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:bg-white/70 focus:bg-white text-sm ${
                        validationErrors.confirmPassword ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="Confirm your password"
                    />
                    {validationErrors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-600">{validationErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    required
                  />
                  <label htmlFor="terms" className="text-xs text-gray-700 leading-relaxed">
                    I agree to the{' '}
                    <a href="#" className="text-blue-600 hover:text-blue-500 font-medium">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-blue-600 hover:text-blue-500 font-medium">
                      Privacy Policy
                    </a>{' '}
                    <span className="text-red-500">*</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Account...
                    </div>
                  ) : (
                    'Create Account'
                  )}
                </button>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-green-700 text-sm">{success}</p>
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200">
                      Sign in
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
