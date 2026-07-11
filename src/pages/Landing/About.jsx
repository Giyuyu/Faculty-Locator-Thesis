import React from "react";

// Import images
import AboutImage1 from "../../assets/TER_Thumbnail_Cover.jpg"; // Adjust the path as needed
import AboutImage2 from "../../assets/SHS_Thumbnail_Cover.jpg"; // Adjust the path as needed

const About = () => {
  return (
    <section id="about" className="scroll-mt-20 py-20 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="transform hover:scale-105 transition-transform duration-300">
                <img
                  src={AboutImage1}
                  alt="STI College Tertiary Education"
                  className="w-full h-64 object-cover rounded-2xl shadow-lg"
                />
              </div>
              <div className="transform hover:scale-105 transition-transform duration-300 mt-8">
                <img
                  src={AboutImage2}
                  alt="STI College Senior High School"
                  className="w-full h-64 object-cover rounded-2xl shadow-lg"
                />
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          <div className="lg:pl-8">
            <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold mb-6">
              About Our System
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Faculty Tracker
            </h2>
            <h3 className="text-2xl font-semibold text-blue-600 mb-6">
              Streamlining Academic Management
            </h3>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              Our comprehensive Faculty Tracker system revolutionizes how educational institutions manage faculty resources, schedules, and student-faculty interactions. Built with cutting-edge technology and user-centric design, it ensures seamless coordination between students, faculty, and administrators.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">500+</div>
                <div className="text-gray-600">Faculty Members</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">10k+</div>
                <div className="text-gray-600">Students Served</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
