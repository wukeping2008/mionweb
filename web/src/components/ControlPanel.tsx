import React, { useState } from 'react';
import { CARD_CONFIGS, MockConfig } from '../utils/mockDataGenerator';

interface ControlPanelProps {
  isStreaming: boolean;
  currentConfig: MockConfig;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onConfigChange: (config: Partial<MockConfig>) => void;
  onCardSelect: (cardType: string) => void;
  dataRate: number; // Current data rate in MB/s
  frameRate: number; // Current UI frame rate
  useRealData?: boolean; // 数据源选择
  connectionStatus?: string; // 连接状态
  onDataSourceChange?: (useReal: boolean) => void; // 数据源切换回调
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  isStreaming,
  currentConfig,
  onStart,
  onStop,
  onPause,
  onResume,
  onConfigChange,
  onCardSelect,
  dataRate,
  frameRate,
  useRealData = false,
  connectionStatus = '未连接',
  onDataSourceChange
}) => {
  const [selectedCard, setSelectedCard] = useState<string>('PXIe-69846H');
  const [isPaused, setIsPaused] = useState(false);

  const handleStart = () => {
    setIsPaused(false);
    onStart();
  };

  const handleStop = () => {
    setIsPaused(false);
    onStop();
  };

  const handlePause = () => {
    setIsPaused(true);
    onPause();
  };

  const handleResume = () => {
    setIsPaused(false);
    onResume();
  };

  const handleCardChange = (cardType: string) => {
    setSelectedCard(cardType);
    onCardSelect(cardType);
  };

  const getStatusColor = () => {
    if (!isStreaming) return '#6c757d'; // Gray
    if (isPaused) return '#ffc107'; // Yellow
    return '#28a745'; // Green
  };

  const getStatusText = () => {
    if (!isStreaming) return 'STOPPED';
    if (isPaused) return 'PAUSED';
    return 'STREAMING';
  };

  return (
    <div className="control-panel" style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      marginBottom: '20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      {/* Status Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, color: '#333' }}>JYTEK DAQ Control</h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{
            padding: '8px 16px',
            backgroundColor: getStatusColor(),
            color: 'white',
            borderRadius: '20px',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            {getStatusText()}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {dataRate.toFixed(1)} MB/s | {frameRate.toFixed(0)} fps
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px'
      }}>
        <button
          onClick={handleStart}
          disabled={isStreaming && !isPaused}
          style={{
            padding: '10px 20px',
            backgroundColor: isStreaming && !isPaused ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isStreaming && !isPaused ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          ▶️ START
        </button>
        
        <button
          onClick={isPaused ? handleResume : handlePause}
          disabled={!isStreaming}
          style={{
            padding: '10px 20px',
            backgroundColor: !isStreaming ? '#6c757d' : '#ffc107',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: !isStreaming ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {isPaused ? '▶️ RESUME' : '⏸️ PAUSE'}
        </button>
        
        <button
          onClick={handleStop}
          disabled={!isStreaming}
          style={{
            padding: '10px 20px',
            backgroundColor: !isStreaming ? '#6c757d' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: !isStreaming ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          ⏹️ STOP
        </button>
      </div>

      {/* Data Source Selection */}
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#e3f2fd',
        borderRadius: '5px',
        border: '1px solid #2196f3'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>数据源选择</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="radio"
              name="dataSource"
              checked={!useRealData}
              onChange={() => onDataSourceChange?.(false)}
              disabled={isStreaming}
            />
            <span>模拟数据 (Mock Data)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="radio"
              name="dataSource"
              checked={useRealData}
              onChange={() => onDataSourceChange?.(true)}
              disabled={isStreaming}
            />
            <span>真实数据 (Real Data)</span>
          </label>
          <div style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            backgroundColor: useRealData ? '#4caf50' : '#ff9800',
            color: 'white',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            {connectionStatus}
          </div>
        </div>
      </div>

      {/* Configuration Panel */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px'
      }}>
        {/* Card Selection */}
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Card Type:
          </label>
          <select
            value={selectedCard}
            onChange={(e) => handleCardChange(e.target.value)}
            disabled={isStreaming}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: isStreaming ? '#f5f5f5' : 'white'
            }}
          >
            {Object.keys(CARD_CONFIGS).map(cardType => (
              <option key={cardType} value={cardType}>
                {cardType}
              </option>
            ))}
          </select>
        </div>

        {/* Channels */}
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Channels: {currentConfig.channels}
          </label>
          <input
            type="range"
            min="1"
            max="32"
            value={currentConfig.channels}
            onChange={(e) => onConfigChange({ channels: parseInt(e.target.value) })}
            disabled={isStreaming}
            style={{ width: '100%' }}
          />
        </div>

        {/* Sample Rate */}
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Sample Rate: {(currentConfig.sampleRate / 1_000_000).toFixed(1)} MS/s
          </label>
          <input
            type="range"
            min="100000"
            max="50000000"
            step="100000"
            value={currentConfig.sampleRate}
            onChange={(e) => onConfigChange({ sampleRate: parseInt(e.target.value) })}
            disabled={isStreaming}
            style={{ width: '100%' }}
          />
        </div>

        {/* Waveform Type */}
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Waveform Type:
          </label>
          <select
            value={currentConfig.waveformType}
            onChange={(e) => onConfigChange({ 
              waveformType: e.target.value as MockConfig['waveformType'] 
            })}
            disabled={isStreaming}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: isStreaming ? '#f5f5f5' : 'white'
            }}
          >
            <option value="sine">Sine Wave</option>
            <option value="square">Square Wave</option>
            <option value="triangle">Triangle Wave</option>
            <option value="noise">Random Noise</option>
            <option value="mixed">Mixed Harmonics</option>
          </select>
        </div>

        {/* Frequency */}
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Frequency: {currentConfig.frequency} Hz
          </label>
          <input
            type="range"
            min="1"
            max="10000"
            value={currentConfig.frequency}
            onChange={(e) => onConfigChange({ frequency: parseInt(e.target.value) })}
            disabled={isStreaming}
            style={{ width: '100%' }}
          />
        </div>

        {/* Amplitude */}
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Amplitude: {currentConfig.amplitude.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.1"
            value={currentConfig.amplitude}
            onChange={(e) => onConfigChange({ amplitude: parseFloat(e.target.value) })}
            disabled={isStreaming}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Performance Metrics */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#e9ecef',
        borderRadius: '5px'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Performance Metrics</h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          fontSize: '14px'
        }}>
          <div>
            <strong>Data Rate:</strong> {dataRate.toFixed(1)} MB/s
          </div>
          <div>
            <strong>Frame Rate:</strong> {frameRate.toFixed(0)} fps
          </div>
          <div>
            <strong>Channels:</strong> {currentConfig.channels}
          </div>
          <div>
            <strong>Buffer Size:</strong> {(currentConfig.bufferSize / 1000).toFixed(0)}k samples
          </div>
          <div>
            <strong>Target:</strong> 640 MB/s, 55+ fps
          </div>
          <div style={{
            color: frameRate >= 55 ? '#28a745' : '#dc3545',
            fontWeight: 'bold'
          }}>
            <strong>Status:</strong> {frameRate >= 55 ? '✅ OPTIMAL' : '⚠️ SUBOPTIMAL'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
