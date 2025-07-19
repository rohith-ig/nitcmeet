import React, { useState, useEffect } from 'react';
import { Video, Users, Settings, Sun, Moon, Shield, Wifi, WifiOff, Info } from 'lucide-react';


export default function Navbar () {
  const [darkMode, setDarkMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(Math.random() > 0.3); 
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={darkMode ? 'dark' : 'h-[7.5vh]'}>
      <nav className={`${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} shadow-lg transition-all duration-300 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gradient-to-r from-blue-500 to-purple-500'} shadow-md`}>
                <Video className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  NITC Meet
                </span>
                <span className="text-xs text-gray-500 hidden sm:block">Random Video Chat</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
                isConnected 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {isConnected ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    <span>Disconnected</span>
                  </>
                )}
              </div>
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} transition-colors duration-200`}
                aria-label="Toggle dark mode"
              >
                {darkMode ? (
                  <Sun className="h-5 w-5 text-yellow-500" />
                ) : (
                  <Moon className="h-5 w-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}