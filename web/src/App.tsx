import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import WaveformChart from './components/WaveformChart';
import ControlPanel from './components/ControlPanel';
import { 
  HighPerformanceStreamer, 
  MockConfig, 
  CARD_CONFIGS 
} from './utils/mockDataGenerator';
import { 
  realDataService, 
  mockConfigToRealConfig
} from './services/realDataService';

function App() {
  // State management
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentData, setCurrentData] = useState<Float32Array[]>([]);
  const [config, setConfig] = useState<MockConfig>(CARD_CONFIGS['PXIe-69846H']);
  const [dataRate, setDataRate] = useState(0);
  const [frameRate, setFrameRate] = useState(0);
  const [useRealData, setUseRealData] = useState(false); // 数据源切换
  const [connectionStatus, setConnectionStatus] = useState<string>('未连接');
  
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

  // 优化的数据回调 - 减少状态更新频率
  const handleDataUpdate = useCallback((data: Float32Array[], metadata: any) => {
    setCurrentData(data);
    
    // 使用增强的元数据中的实际数据率
    const actualRate = metadata.actualDataRate || (metadata.bytesPerSecond / (1024 * 1024));
    setDataRate(actualRate);
    
    frameCountRef.current++;
  }, []);

  // Control handlers
  const handleStart = useCallback(async () => {
    try {
      if (useRealData) {
        // 使用真实数据服务
        setConnectionStatus('连接中...');
        const realConfig = mockConfigToRealConfig(config);
        await realDataService.start(realConfig, handleDataUpdate);
        setConnectionStatus('已连接');
      } else {
        // 使用模拟数据
        if (!streamerRef.current) {
          streamerRef.current = new HighPerformanceStreamer(config, 640);
        }
        streamerRef.current.start(handleDataUpdate);
        setConnectionStatus('模拟模式');
      }
      
      setIsStreaming(true);
      setIsPaused(false);
    } catch (error) {
      console.error('启动失败:', error);
      setConnectionStatus('连接失败');
    }
  }, [config, handleDataUpdate, useRealData]);

  const handleStop = useCallback(async () => {
    try {
      if (useRealData) {
        await realDataService.stop();
      } else {
        if (streamerRef.current) {
          streamerRef.current.stop();
        }
      }
      
      setIsStreaming(false);
      setIsPaused(false);
      setCurrentData([]);
      setDataRate(0);
      frameCountRef.current = 0;
      setConnectionStatus('未连接');
    } catch (error) {
      console.error('停止失败:', error);
    }
  }, [useRealData]);

  const handlePause = useCallback(async () => {
    try {
      if (useRealData) {
        await realDataService.pause();
      } else {
        if (streamerRef.current) {
          streamerRef.current.stop();
        }
      }
      setIsPaused(true);
    } catch (error) {
      console.error('暂停失败:', error);
    }
  }, [useRealData]);

  const handleResume = useCallback(async () => {
    try {
      if (useRealData) {
        await realDataService.resume();
      } else {
        if (streamerRef.current) {
          streamerRef.current.start(handleDataUpdate);
        }
      }
      setIsPaused(false);
    } catch (error) {
      console.error('恢复失败:', error);
    }
  }, [handleDataUpdate, useRealData]);

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
          useRealData={useRealData}
          connectionStatus={connectionStatus}
          onDataSourceChange={setUseRealData}
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
