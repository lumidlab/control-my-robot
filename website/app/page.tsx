'use client'

import { useEffect, useState } from 'react';
import { scsServoSDK } from 'feetech.js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Zap, Power, PowerOff, RotateCcw, Plus, Minus } from "lucide-react";

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

interface ServoData {
  id: number;
  position: number | null;
  targetPosition: number;
  originalPosition: number | null;
  speed: number;
  acceleration: number;
  torqueEnabled: boolean;
}

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWebSerialSupported, setIsWebSerialSupported] = useState<boolean | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [servos, setServos] = useState<Map<number, ServoData>>(new Map());
  const [availableServoIds, setAvailableServoIds] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [originalPositions, setOriginalPositions] = useState<{ [key: number]: number }>({});

  // Initialize default servo data
  useEffect(() => {
    const defaultServos = new Map<number, ServoData>();
    availableServoIds.forEach(id => {
      defaultServos.set(id, {
        id,
        position: null,
        targetPosition: 2048,
        originalPosition: null,
        speed: 50,
        acceleration: 50,
        torqueEnabled: false
      });
    });
    setServos(defaultServos);
  }, [availableServoIds]);

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

  const connectToServo = async () => {
    if (!isWebSerialSupported) return;

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Connecting to servo motors...');
      
      // Let the SDK handle port selection internally
      await scsServoSDK.connect();
      setIsConnected(true);
      
      console.log('Connection established, reading initial positions...');
      
      // Read positions for all available servos and store as original positions
      await captureOriginalPositions();
      
      console.log('Connection and initial position reading completed');
      
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
      // Reset all servo positions
      const resetServos = new Map(servos);
      resetServos.forEach((servo, id) => {
        resetServos.set(id, { ...servo, position: null, torqueEnabled: false });
      });
      setServos(resetServos);
      setError(null);
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError('Error disconnecting from servo');
    }
  };

  const captureOriginalPositions = async () => {
    if (!isConnected) return;
    
    try {
      console.log('Capturing original positions for all servos...');
      const newOriginalPositions: { [key: number]: number } = {};
      const updatedServos = new Map(servos);
      
      // Read positions for servos 1-6 (adjust range as needed)
      for (let servoId = 1; servoId <= 6; servoId++) {
        try {
          const position = await scsServoSDK.readPosition(servoId);
          newOriginalPositions[servoId] = position;
          
          // Also update the servo state to show it's connected
          const servo = updatedServos.get(servoId);
          if (servo) {
            updatedServos.set(servoId, { 
              ...servo, 
              position, 
              targetPosition: position,
              originalPosition: position
            });
          }
          
          console.log(`Servo ${servoId} original position: ${position}`);
          
          // Add a small delay between commands to prevent port conflicts
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          console.warn(`Could not read position for servo ${servoId}:`, err);
          // Set a default position if we can't read it
          newOriginalPositions[servoId] = 2048; // Default center position
          
          // Mark servo as disconnected
          const servo = updatedServos.get(servoId);
          if (servo) {
            updatedServos.set(servoId, { 
              ...servo, 
              position: null
            });
          }
        }
      }
      
      setOriginalPositions(newOriginalPositions);
      setServos(updatedServos);
      console.log('Original positions captured:', newOriginalPositions);
      
    } catch (err) {
      console.error('Error capturing original positions:', err);
      setError('Failed to read initial servo positions');
    }
  };

  const readAllPositions = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      const updatedServos = new Map(servos);
      
      console.log('Reading current positions for all servos...');
      
      // Execute commands sequentially to avoid port conflicts
      for (const servoId of availableServoIds) {
        try {
          console.log(`Reading position for servo ${servoId}...`);
          const position = await scsServoSDK.readPosition(servoId);
          console.log(`Servo ${servoId} current position: ${position}`);
          
          const servo = updatedServos.get(servoId);
          if (servo) {
            updatedServos.set(servoId, { 
              ...servo, 
              position, 
              targetPosition: position
            });
          }
          // Add a small delay between commands to prevent port conflicts
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          console.error(`Servo ${servoId} not responding:`, err);
          // Mark servo as disconnected by setting position to null
          const servo = updatedServos.get(servoId);
          if (servo) {
            updatedServos.set(servoId, { 
              ...servo, 
              position: null
            });
          }
        }
      }
      
      setServos(updatedServos);
      console.log('All positions read successfully');
      
    } catch (err) {
      console.error('Error reading positions:', err);
      setError('Error reading servo positions');
    } finally {
      setIsLoading(false);
    }
  };

  const testMotorMovement = async (servoId: number) => {
    if (!isConnected) return;
    
    try {
      console.log(`Testing motor ${servoId} movement...`);
      const currentPosition = servos.get(servoId)?.position ?? 2048;
      const testPosition = currentPosition + 100;
      
      console.log(`Moving servo ${servoId} from ${currentPosition} to ${testPosition}`);
      await scsServoSDK.writePosition(servoId, testPosition);
      
      // Update the position in state
      const updatedServos = new Map(servos);
      const servo = updatedServos.get(servoId);
      if (servo) {
        updatedServos.set(servoId, { ...servo, position: testPosition, targetPosition: testPosition });
        setServos(updatedServos);
      }
      
      console.log(`Test movement completed for servo ${servoId}`);
    } catch (err) {
      console.error(`Test movement failed for servo ${servoId}:`, err);
      setError(`Test movement failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const moveServoToPosition = async (servoId: number, newPosition: number) => {
    if (!isConnected) return;
    
    try {
      console.log(`Moving servo ${servoId} to position: ${newPosition}`);
      await scsServoSDK.writePosition(servoId, newPosition);
      
      const updatedServos = new Map(servos);
      const servo = updatedServos.get(servoId);
      if (servo) {
        updatedServos.set(servoId, { ...servo, position: newPosition, targetPosition: newPosition });
        setServos(updatedServos);
        console.log(`Successfully moved servo ${servoId} to position: ${newPosition}`);
      }
    } catch (err) {
      console.error(`Error moving servo ${servoId}:`, err);
      setError(`Error moving servo ${servoId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const resetToOriginalPositions = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      const updatedServos = new Map(servos);
      
      console.log('Resetting servos to original positions:', originalPositions);
      console.log('Available servo IDs:', availableServoIds);
      
      // Execute commands sequentially to avoid port conflicts
      for (const servoId of availableServoIds) {
        const originalPosition = originalPositions[servoId];
        console.log(`Checking servo ${servoId}, original position:`, originalPosition);
        
        if (originalPosition === undefined) {
          console.warn(`No original position stored for servo ${servoId}`);
          continue;
        }
        
        try {
          console.log(`Resetting servo ${servoId} to position ${originalPosition}`);
          await scsServoSDK.writePosition(servoId, originalPosition);
          console.log(`Successfully sent reset command to servo ${servoId}`);
          
          // Add a small delay between commands to prevent port conflicts
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const servo = updatedServos.get(servoId);
          if (servo) {
            updatedServos.set(servoId, { 
              ...servo, 
              position: originalPosition, 
              targetPosition: originalPosition 
            });
            console.log(`Updated servo ${servoId} state to position ${originalPosition}`);
          }
        } catch (err) {
          console.error(`Failed to reset servo ${servoId}:`, err);
        }
      }
      
      setServos(updatedServos);
      console.log('Reset all servos to original positions');
    } catch (err) {
      console.error('Error resetting to original positions:', err);
      setError('Error resetting servos to original positions');
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentServo = (servoId: number) => servos.get(servoId);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 Motor Control Panel</h1>
          <p className="text-gray-600">Real-time servo motor control</p>
        </div>

        {/* Connection Status */}
        {!isWebSerialSupported && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <PowerOff className="h-5 w-5" />
                Browser Not Supported
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-700">Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.</p>
            </CardContent>
          </Card>
        )}

        {/* Connection Control */}
        {isWebSerialSupported && !isConnected && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-800 flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Connect to Motors
              </CardTitle>
              <CardDescription>
                Connect to your servo motors to start controlling them
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={connectToServo}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isLoading ? 'Connecting...' : 'Connect to Motors'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Main Control Panel */}
        {isConnected && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Power className="h-5 w-5 text-green-600" />
                    Motor Control Panel
                  </CardTitle>
                  <CardDescription>
                    Real-time control of all connected motors
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={captureOriginalPositions}
                    disabled={isLoading}
                    variant="outline"
                    className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  >
                    {isLoading ? 'Capturing...' : 'Capture Original Positions'}
                  </Button>
                  <Button
                    onClick={readAllPositions}
                    disabled={isLoading}
                    variant="outline"
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                  >
                    {isLoading ? 'Reading...' : 'Read Positions'}
                  </Button>
                  <Button
                    onClick={resetToOriginalPositions}
                    disabled={isLoading}
                    variant="outline"
                    className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {isLoading ? 'Resetting...' : 'Reset to Original'}
                  </Button>
                  <Button
                    onClick={disconnect}
                    variant="outline"
                    className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Debug Information */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-sm font-medium text-yellow-800 mb-2">Debug Info:</div>
                <div className="text-xs text-yellow-700">
                  <div>Original Positions: {JSON.stringify(originalPositions)}</div>
                  <div>Connected Servos: {availableServoIds.filter(id => servos.get(id)?.position !== null).join(', ')}</div>
                </div>
              </div>
              
              {availableServoIds.map((servoId) => {
                const servo = getCurrentServo(servoId);
                const currentPosition = servo?.position ?? 2048;
                const isConnected = servo?.position !== null;
                
                return (
                  <div key={servoId} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-24 text-center">
                      <div className="font-bold text-lg">Motor {servoId}</div>
                      <div className="text-sm text-gray-600">
                        Current: {isConnected && servo ? servo.position : 'N/A'}
                      </div>
                      {originalPositions[servoId] !== undefined && (
                        <div className="text-xs text-blue-600">
                          Original: {originalPositions[servoId]}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => {
                          if (isConnected) {
                            moveServoToPosition(servoId, Math.max(0, currentPosition - 100));
                          }
                        }}
                        disabled={isLoading || !isConnected}
                        variant="outline"
                        size="sm"
                        className="w-10 h-10 p-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex-1 min-w-[200px]">
                        <Slider
                          value={[currentPosition]}
                          onValueChange={(value) => {
                            if (isConnected) {
                              moveServoToPosition(servoId, value[0]);
                            }
                          }}
                          max={4095}
                          min={0}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>0</span>
                          <span>2048</span>
                          <span>4095</span>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => {
                          if (isConnected) {
                            moveServoToPosition(servoId, Math.min(4095, currentPosition + 100));
                          }
                        }}
                        disabled={isLoading || !isConnected}
                        variant="outline"
                        size="sm"
                        className="w-10 h-10 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="w-16 text-center">
                      <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                        isConnected ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <div className="text-xs text-gray-600">
                        {isConnected ? 'Connected' : 'Offline'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
