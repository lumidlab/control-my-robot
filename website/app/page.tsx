'use client'

import { useEffect, useState } from 'react';
import { scsServoSDK } from 'feetech.js';

// Add Web Serial API types
declare global {
  interface Navigator {
    serial: {
      requestPort(): Promise<SerialPort>;
    };
  }
  
  interface SerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream;
    writable: WritableStream;
  }
}

export default function Home() {
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWebSerialSupported, setIsWebSerialSupported] = useState<boolean | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check if Web Serial API is supported
    const checkWebSerialSupport = () => {
      if (typeof navigator !== 'undefined' && 'serial' in navigator) {
        setIsWebSerialSupported(true);
        return true;
      } else {
        setIsWebSerialSupported(false);
        setError('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
        return false;
      }
    };

    checkWebSerialSupport();
  }, []);

  const requestPort = async () => {
    if (!isWebSerialSupported) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Request port selection from user
      const port = await navigator.serial.requestPort();
      
      // Try to connect with the selected port
      await scsServoSDK.connect();
      setIsConnected(true);
      
      // Read servo position
      const servoPosition = await scsServoSDK.readPosition(1);
      console.log(servoPosition); // 1122
      setPosition(servoPosition);
      
    } catch (err) {
      console.error('Error connecting to servo:', err);
      let errorMessage = 'Unknown error occurred';
      
      if (err instanceof Error) {
        if (err.message.includes('navigator.serial is undefined')) {
          errorMessage = 'Web Serial API is not available. Please ensure you are using a supported browser (Chrome, Edge, Opera) and accessing the site via HTTPS or localhost.';
        } else if (err.message.includes('Failed to select a serial port')) {
          errorMessage = 'No serial port selected. Please connect your servo hardware and try again.';
        } else if (err.message.includes('Failed to open port')) {
          errorMessage = 'Failed to open serial port. Please check if the port is already in use by another application.';
        } else if (err.message.includes('User cancelled')) {
          errorMessage = 'Port selection was cancelled. Please try again and select a port.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      await scsServoSDK.disconnect();
      setIsConnected(false);
      setPosition(null);
      setError(null);
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError('Error disconnecting from servo');
    }
  };

  const readPosition = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      const servoPosition = await scsServoSDK.readPosition(1);
      console.log(servoPosition);
      setPosition(servoPosition);
    } catch (err) {
      console.error('Error reading position:', err);
      setError('Error reading servo position');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Robot Control Interface</h1>
      
      {!isWebSerialSupported && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="text-red-800 font-semibold mb-2">Browser Not Supported</h3>
          <p className="text-red-700">Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.</p>
          <div className="mt-4">
            <h4 className="text-red-800 font-semibold mb-2">Requirements:</h4>
            <ul className="text-red-700 list-disc list-inside space-y-1">
              <li>Use Chrome, Edge, or Opera browser</li>
              <li>Access via HTTPS or localhost</li>
              <li>Connect your Feetech servo hardware</li>
              <li>Allow serial port access when prompted</li>
            </ul>
          </div>
        </div>
      )}
      
      {isWebSerialSupported && !isConnected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-blue-800 font-semibold mb-2">Connect to Servo</h3>
          <p className="text-blue-700 mb-4">
            Click the button below to select a serial port and connect to your Feetech servo.
          </p>
          <button
            onClick={requestPort}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded"
          >
            {isLoading ? 'Connecting...' : 'Select Port & Connect'}
          </button>
        </div>
      )}
      
      {isConnected && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <h3 className="text-green-800 font-semibold mb-2">Connected to Servo</h3>
          <p className="text-green-700 mb-4">
            Successfully connected to serial port. You can now read servo data.
          </p>
          <div className="flex gap-2">
            <button
              onClick={readPosition}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-2 px-4 rounded"
            >
              {isLoading ? 'Reading...' : 'Read Position'}
            </button>
            <button
              onClick={disconnect}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="text-red-800 font-semibold mb-2">Connection Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {position !== null && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-green-800 font-semibold mb-2">Servo Status</h3>
          <p className="text-green-700">Servo position: {position}</p>
        </div>
      )}
      
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2">About This Interface</h3>
        <p className="text-gray-700 mb-2">
          This web interface allows you to control Feetech servos through your browser using the Web Serial API.
        </p>
        <p className="text-gray-600 text-sm">
          Make sure your servo hardware is connected and you're using a compatible browser.
        </p>
      </div>
    </div>
  );
}
