import { grpcClient, DataRequest, ControlCommand } from './grpcClient';
import { signalrClient, PerformanceMetrics, DAQStatus } from './signalrClient';
import { MockConfig } from '../utils/mockDataGenerator';

export interface RealDataServiceConfig {
  channels: number;
  sampleRate: number;
  bufferSize: number;
  waveformType?: string;
  amplitude?: number;
  frequency?: number;
}

export class RealDataService {
  private isStreaming: boolean = false;
  private isPaused: boolean = false;
  private currentConfig: RealDataServiceConfig | null = null;
  private dataCallback: ((data: Float32Array[], metadata: any) => void) | null = null;
  private performanceCallback: ((metrics: PerformanceMetrics) => void) | null = null;
  private statusCallback: ((status: DAQStatus) => void) | null = null;

  constructor() {
    this.setupSignalRHandlers();
  }

  private setupSignalRHandlers(): void {
    // 监听性能指标更新
    signalrClient.onPerformanceUpdate((metrics: PerformanceMetrics) => {
      if (this.performanceCallback) {
        this.performanceCallback(metrics);
      }
    });

    // 监听状态更新
    signalrClient.onStatusUpdate((status: DAQStatus) => {
      this.isStreaming = status.isRunning;
      this.isPaused = status.isPaused;
      
      if (this.statusCallback) {
        this.statusCallback(status);
      }
    });

    // 监听错误
    signalrClient.onError((error: string) => {
      console.error('DAQ服务错误:', error);
    });
  }

  async initialize(): Promise<void> {
    try {
      // 连接SignalR
      if (!signalrClient.connected) {
        await signalrClient.connect();
        await signalrClient.joinPerformanceGroup();
      }
      console.log('实时数据服务初始化成功');
    } catch (error) {
      console.error('实时数据服务初始化失败:', error);
      throw error;
    }
  }

  async start(
    config: RealDataServiceConfig,
    dataCallback: (data: Float32Array[], metadata: any) => void
  ): Promise<void> {
    try {
      await this.initialize();
      
      this.currentConfig = config;
      this.dataCallback = dataCallback;

      // 发送启动命令通过SignalR
      await signalrClient.sendCommand('START', {
        channels: config.channels,
        sampleRate: config.sampleRate,
        bufferSize: config.bufferSize,
        waveformType: config.waveformType || 'sine',
        amplitude: config.amplitude || 1.0,
        frequency: config.frequency || 1000
      });

      // 订阅gRPC数据流
      const dataRequest: DataRequest = {
        channels: config.channels,
        sample_rate: config.sampleRate,
        buffer_size: config.bufferSize,
        config: {
          waveformType: config.waveformType || 'sine',
          amplitude: (config.amplitude || 1.0).toString(),
          frequency: (config.frequency || 1000).toString()
        }
      };

      // 启动数据流订阅
      grpcClient.subscribeToDataStream(
        dataRequest,
        (chunk) => {
          // 将接收到的数据转换为Float32Array格式
          const convertedData = this.convertDataChunkToFloat32Arrays(chunk, config.channels);
          
          const metadata = {
            seq: chunk.seq,
            timestamp: chunk.tick_ns,
            actualDataRate: this.calculateDataRate(chunk.payload.length),
            bytesPerSecond: chunk.payload.length * 60 // 假设60fps
          };

          if (this.dataCallback) {
            this.dataCallback(convertedData, metadata);
          }
        },
        (error) => {
          console.error('gRPC数据流错误:', error);
        },
        () => {
          console.log('gRPC数据流结束');
        }
      );

      this.isStreaming = true;
      this.isPaused = false;
      
      console.log('实时数据流启动成功');
    } catch (error) {
      console.error('启动实时数据流失败:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // 发送停止命令
      if (signalrClient.connected) {
        await signalrClient.sendCommand('STOP');
      }

      // 发送gRPC控制命令
      await grpcClient.sendControlCommand({
        cmd: ControlCommand.STOP,
        params: {}
      });

      this.isStreaming = false;
      this.isPaused = false;
      this.dataCallback = null;
      
      console.log('实时数据流已停止');
    } catch (error) {
      console.error('停止实时数据流失败:', error);
      throw error;
    }
  }

  async pause(): Promise<void> {
    try {
      if (signalrClient.connected) {
        await signalrClient.sendCommand('PAUSE');
      }

      await grpcClient.sendControlCommand({
        cmd: ControlCommand.PAUSE,
        params: {}
      });

      this.isPaused = true;
      console.log('实时数据流已暂停');
    } catch (error) {
      console.error('暂停实时数据流失败:', error);
      throw error;
    }
  }

  async resume(): Promise<void> {
    try {
      if (signalrClient.connected) {
        await signalrClient.sendCommand('RESUME');
      }

      await grpcClient.sendControlCommand({
        cmd: ControlCommand.RESUME,
        params: {}
      });

      this.isPaused = false;
      console.log('实时数据流已恢复');
    } catch (error) {
      console.error('恢复实时数据流失败:', error);
      throw error;
    }
  }

  async updateConfig(newConfig: Partial<RealDataServiceConfig>): Promise<void> {
    if (this.currentConfig) {
      this.currentConfig = { ...this.currentConfig, ...newConfig };
      
      // 如果正在运行，重新启动以应用新配置
      if (this.isStreaming && this.dataCallback) {
        await this.stop();
        await this.start(this.currentConfig, this.dataCallback);
      }
    }
  }

  // 设置性能指标回调
  setPerformanceCallback(callback: (metrics: PerformanceMetrics) => void): void {
    this.performanceCallback = callback;
  }

  // 设置状态回调
  setStatusCallback(callback: (status: DAQStatus) => void): void {
    this.statusCallback = callback;
  }

  // 将DataChunk转换为Float32Array数组
  private convertDataChunkToFloat32Arrays(chunk: any, channels: number): Float32Array[] {
    const result: Float32Array[] = [];
    
    // 假设payload是交错的16位整数数据
    const samples = chunk.payload.length / 2; // 16位 = 2字节
    const samplesPerChannel = Math.floor(samples / channels);
    
    // 为每个通道创建Float32Array
    for (let ch = 0; ch < channels; ch++) {
      const channelData = new Float32Array(samplesPerChannel);
      
      // 从交错数据中提取通道数据
      for (let i = 0; i < samplesPerChannel; i++) {
        const byteIndex = (i * channels + ch) * 2;
        if (byteIndex + 1 < chunk.payload.length) {
          // 将16位整数转换为浮点数 (-1.0 到 1.0)
          const value = (chunk.payload[byteIndex] | (chunk.payload[byteIndex + 1] << 8));
          channelData[i] = value / 32768.0; // 归一化到 -1.0 到 1.0
        }
      }
      
      result.push(channelData);
    }
    
    return result;
  }

  // 计算数据率 (MB/s)
  private calculateDataRate(bytesReceived: number): number {
    const megabytes = bytesReceived / (1024 * 1024);
    return megabytes * 60; // 假设60fps，计算每秒数据率
  }

  async cleanup(): Promise<void> {
    try {
      await this.stop();
      
      if (signalrClient.connected) {
        await signalrClient.leavePerformanceGroup();
        await signalrClient.disconnect();
      }
      
      console.log('实时数据服务清理完成');
    } catch (error) {
      console.error('清理实时数据服务失败:', error);
    }
  }

  // 获取当前状态
  get streaming(): boolean {
    return this.isStreaming;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  get config(): RealDataServiceConfig | null {
    return this.currentConfig;
  }
}

// 单例实例
export const realDataService = new RealDataService();

// 兼容性适配器，将MockConfig转换为RealDataServiceConfig
export function mockConfigToRealConfig(mockConfig: MockConfig): RealDataServiceConfig {
  return {
    channels: mockConfig.channels,
    sampleRate: mockConfig.sampleRate,
    bufferSize: mockConfig.bufferSize,
    waveformType: mockConfig.waveformType || 'sine',
    amplitude: mockConfig.amplitude || 1.0,
    frequency: mockConfig.frequency || 1000
  };
}
