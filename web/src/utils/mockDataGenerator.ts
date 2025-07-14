/**
 * Mock data generator for JY5500 DAQ simulation
 * Generates high-frequency waveform data to test performance
 */

export interface MockConfig {
  channels: number;
  sampleRate: number; // Samples per second per channel
  bufferSize: number; // Buffer size in samples
  waveformType: 'sine' | 'square' | 'triangle' | 'noise' | 'mixed';
  amplitude: number;
  frequency: number; // Base frequency in Hz
  noiseLevel: number; // 0-1, amount of noise to add
}

export class MockDataGenerator {
  private config: MockConfig;
  private sampleCounter: number = 0;
  private startTime: number;
  private sequenceNumber: number = 0;

  constructor(config: MockConfig) {
    this.config = config;
    this.startTime = performance.now();
  }

  /**
   * Generate a chunk of mock data
   * Returns data in the format expected by WaveformChart
   */
  generateChunk(): {
    data: Float32Array[];
    metadata: {
      seq: number;
      timestamp: number;
      sampleRate: number;
      channels: number;
      bytesPerSecond: number;
    };
  } {
    const { channels, bufferSize, sampleRate } = this.config;
    const channelData: Float32Array[] = [];

    // Generate data for each channel
    for (let ch = 0; ch < channels; ch++) {
      const samples = new Float32Array(bufferSize);
      
      for (let i = 0; i < bufferSize; i++) {
        const sampleIndex = this.sampleCounter + i;
        const time = sampleIndex / sampleRate;
        
        // Generate different waveforms for different channels
        let value = this.generateSample(time, ch);
        
        // Add noise if configured
        if (this.config.noiseLevel > 0) {
          value += (Math.random() - 0.5) * this.config.noiseLevel * this.config.amplitude;
        }
        
        samples[i] = value;
      }
      
      channelData.push(samples);
    }

    this.sampleCounter += bufferSize;
    const currentSeq = this.sequenceNumber++;
    
    // Calculate data rate (16-bit samples)
    const bytesPerSecond = channels * sampleRate * 2; // 2 bytes per 16-bit sample

    return {
      data: channelData,
      metadata: {
        seq: currentSeq,
        timestamp: performance.now() - this.startTime,
        sampleRate,
        channels,
        bytesPerSecond
      }
    };
  }

  private generateSample(time: number, channel: number): number {
    const { waveformType, amplitude, frequency } = this.config;
    
    // Different frequency for each channel
    const channelFreq = frequency * (1 + channel * 0.1);
    const phase = 2 * Math.PI * channelFreq * time;
    
    switch (waveformType) {
      case 'sine':
        return amplitude * Math.sin(phase);
        
      case 'square':
        return amplitude * Math.sign(Math.sin(phase));
        
      case 'triangle':
        return amplitude * (2 / Math.PI) * Math.asin(Math.sin(phase));
        
      case 'noise':
        return amplitude * (Math.random() - 0.5) * 2;
        
      case 'mixed':
        // Combination of sine waves with different harmonics
        return amplitude * (
          0.6 * Math.sin(phase) +
          0.3 * Math.sin(2 * phase) +
          0.1 * Math.sin(3 * phase)
        );
        
      default:
        return amplitude * Math.sin(phase);
    }
  }

  /**
   * Reset the generator state
   */
  reset(): void {
    this.sampleCounter = 0;
    this.sequenceNumber = 0;
    this.startTime = performance.now();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MockConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current data rate in MB/s
   */
  getCurrentDataRate(): number {
    const { channels, sampleRate } = this.config;
    return (channels * sampleRate * 2) / (1024 * 1024); // Convert to MB/s
  }
}

/**
 * Predefined configurations for different JY5500 cards
 */
export const CARD_CONFIGS: Record<string, MockConfig> = {
  'PXIe-69846H': {
    channels: 4,
    sampleRate: 40_000_000, // 40 MS/s
    bufferSize: 100_000, // 100k samples per chunk
    waveformType: 'mixed',
    amplitude: 1.0,
    frequency: 1000, // 1 kHz base frequency
    noiseLevel: 0.05
  },
  'PXIe-5310': {
    channels: 16,
    sampleRate: 5_000_000, // 5 MS/s
    bufferSize: 50_000,
    waveformType: 'sine',
    amplitude: 0.8,
    frequency: 500,
    noiseLevel: 0.02
  },
  'PXIe-5500': {
    channels: 32,
    sampleRate: 1_000_000, // 1 MS/s
    bufferSize: 25_000,
    waveformType: 'triangle',
    amplitude: 0.6,
    frequency: 100,
    noiseLevel: 0.01
  }
};

/**
 * High-performance streaming data generator
 * Simulates the target 640 MB/s data rate
 */
export class HighPerformanceStreamer {
  private generator: MockDataGenerator;
  private intervalId: number | null = null;
  private onDataCallback: ((data: Float32Array[], metadata: any) => void) | null = null;
  private targetDataRate: number; // MB/s
  private chunkInterval: number; // ms

  constructor(config: MockConfig, targetDataRateMBps: number = 640) {
    this.generator = new MockDataGenerator(config);
    this.targetDataRate = targetDataRateMBps;
    
    // Calculate chunk interval to achieve target data rate
    const bytesPerChunk = config.channels * config.bufferSize * 2; // 16-bit samples
    const chunksPerSecond = (targetDataRateMBps * 1024 * 1024) / bytesPerChunk;
    this.chunkInterval = 1000 / chunksPerSecond; // Convert to milliseconds
  }

  start(onData: (data: Float32Array[], metadata: any) => void): void {
    this.onDataCallback = onData;
    
    const generateData = () => {
      if (this.onDataCallback) {
        const chunk = this.generator.generateChunk();
        this.onDataCallback(chunk.data, chunk.metadata);
      }
    };

    // Use high-precision timer for consistent data rate
    this.intervalId = window.setInterval(generateData, this.chunkInterval);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onDataCallback = null;
  }

  getActualDataRate(): number {
    return this.generator.getCurrentDataRate();
  }

  updateConfig(config: Partial<MockConfig>): void {
    this.generator.updateConfig(config);
  }
}
