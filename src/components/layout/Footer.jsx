import React from 'react';
import logo from '../../assets/novaliches.jpg'; // Import the logo image (adjust path as needed)

const Footer = () => {
  return (
    <footer id="support" className="scroll-mt-20 bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo Section */}
          <div className="lg:col-span-1">
            <div className="mb-6">
              <img src={logo} alt="STI Novaliches Logo" className="h-35 w-auto" />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Empowering education through innovative technology and seamless faculty management.
            </p>
          </div>

          {/* Navigation Section */}
          <div>
            <h5 className="text-lg font-semibold mb-6 text-white">Navigation</h5>
            <ul className="space-y-3">
              <li><a href="#home" className="text-gray-400 hover:text-white transition-colors duration-200">Home</a></li>
              <li><a href="#about" className="text-gray-400 hover:text-white transition-colors duration-200">About</a></li>
              <li><a href="#faq" className="text-gray-400 hover:text-white transition-colors duration-200">FAQ</a></li>
              <li><a href="#support" className="text-gray-400 hover:text-white transition-colors duration-200">Support</a></li>
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h5 className="text-lg font-semibold mb-6 text-white">Contact</h5>
            <address className="text-gray-400 text-sm not-italic space-y-2">
              <p>Diamond Avenue corner Quirino Highway</p>
              <p>San Bartolome, Novaliches</p>
              <p>Quezon City, 1116 Metro Manila</p>
              <p className="pt-2">
                Phone: <a href="tel:+63289300049" className="text-blue-400 hover:text-blue-300 transition-colors duration-200">(02) 8930 0049</a>
              </p>
              <p>
                Website: <a href="https://www.sti.edu" className="text-blue-400 hover:text-blue-300 transition-colors duration-200" target="_blank" rel="noopener noreferrer">www.sti.edu</a>
              </p>
            </address>
          </div>

          {/* Socials Section */}
          <div>
            <h5 className="text-lg font-semibold mb-6 text-white">Connect With Us</h5>
            <div className="flex space-x-4">
              <a
                href="https://www.facebook.com/novaliches.sti.edu/"
                className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors duration-200"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 STI College Novaliches. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
