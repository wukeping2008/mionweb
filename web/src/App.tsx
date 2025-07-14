import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import WaveformChart from './components/WaveformChart';
import ControlPanel from './components/ControlPanel';
import { 
  HighPerformanceStreamer, 
  MockConfig, 
  CARD_CONFIGS 
} from './utils/mockDataGenerator';

function App() {
  // State management
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentData, setCurrentData] = useState<Float32Array[]>([]);
  const [config, setConfig] = useState<MockConfig>(CARD_CONFIGS['PXIe-69846H']);
  const [dataRate, setDataRate] = useState(0);
  const [frameRate, setFrameRate] = useState(0);
  
  // Refs for performance tracking
  const streamerRef = useRef<HighPerformanceStreamer | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const fpsIntervalRef = useRef<number | null>(null);

  // Initialize frame rate monitoring
  useEffect(() => {
    const updateFPS = () => {
      const now = performance.now();
      const deltaTime = now - lastFrameTimeRef.current;
      
      if (deltaTime >= 1000) { // Update every second
        const fps = (frameCountRef.current * 1000) / deltaTime;
        setFrameRate(fps);
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }
    };

    fpsIntervalRef.current = window.setInterval(updateFPS, 100);
    
    return () => {
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
    };
  }, []);

  // Data callback for streaming
  const handleDataUpdate = useCallback((data: Float32Array[], metadata: any) => {
    setCurrentData(data);
    setDataRate(metadata.bytesPerSecond / (1024 * 1024)); // Convert to MB/s
    frameCountRef.current++;
  }, []);

  // Control handlers
  const handleStart = useCallback(() => {
    if (!streamerRef.current) {
      // Create new streamer with current config
      streamerRef.current = new HighPerformanceStreamer(config, 640); // Target 640 MB/s
    }
    
    streamerRef.current.start(handleDataUpdate);
    setIsStreaming(true);
    setIsPaused(false);
  }, [config, handleDataUpdate]);

  const handleStop = useCallback(() => {
    if (streamerRef.current) {
      streamerRef.current.stop();
    }
    setIsStreaming(false);
    setIsPaused(false);
    setCurrentData([]);
    setDataRate(0);
    frameCountRef.current = 0;
  }, []);

  const handlePause = useCallback(() => {
    if (streamerRef.current) {
      streamerRef.current.stop();
    }
    setIsPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    if (streamerRef.current) {
      streamerRef.current.start(handleDataUpdate);
    }
    setIsPaused(false);
  }, [handleDataUpdate]);

  const handleConfigChange = useCallback((newConfig: Partial<MockConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    
    // Update streamer config if running
    if (streamerRef.current) {
      streamerRef.current.updateConfig(updatedConfig);
    }
  }, [config]);

  const handleCardSelect = useCallback((cardType: string) => {
    const cardConfig = CARD_CONFIGS[cardType];
    if (cardConfig) {
      setConfig(cardConfig);
      
      // Restart streaming if currently active
      if (isStreaming && !isPaused) {
        handleStop();
        setTimeout(() => {
          setConfig(cardConfig);
          // Will restart automatically due to useEffect
        }, 100);
      }
    }
  }, [isStreaming, isPaused, handleStop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamerRef.current) {
        streamerRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="App" style={{ 
      padding: '20px', 
      backgroundColor: '#ffffff',
      minHeight: '100vh'
    }}>
      <header style={{ 
        textAlign: 'center', 
        marginBottom: '30px',
        borderBottom: '2px solid #e9ecef',
        paddingBottom: '20px'
      }}>
        <h1 style={{ 
          color: '#333', 
          margin: '0 0 10px 0',
          fontSize: '2.5rem'
        }}>
          JYTEK Modular Instrument Platform
        </h1>
        <p style={{ 
          color: '#666', 
          margin: 0,
          fontSize: '1.1rem'
        }}>
          简仪科技模块仪器Web端平台 - High-Performance Data Acquisition & Real-Time Waveform Display
        </p>
      </header>

      <main>
        <ControlPanel
          isStreaming={isStreaming}
          currentConfig={config}
          onStart={handleStart}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
          onConfigChange={handleConfigChange}
          onCardSelect={handleCardSelect}
          dataRate={dataRate}
          frameRate={frameRate}
        />

        <WaveformChart
          data={currentData}
          sampleRate={config.sampleRate}
          channels={config.channels}
          isStreaming={isStreaming && !isPaused}
          maxPoints={1000000} // 1M points as per spec
        />
      </main>

      <footer style={{
        marginTop: '40px',
        textAlign: 'center',
        color: '#666',
        fontSize: '14px',
        borderTop: '1px solid #e9ecef',
        paddingTop: '20px'
      }}>
        <p>
          JYTEK Modular Instrument Platform - 简仪科技模块仪器Web端平台 | 
          Target: 640 MB/s, 55+ fps | 
          Built with React 19 + Plotly.js WebGL
        </p>
      </footer>
    </div>
  );
}

export default App;
