import * as signalR from '@microsoft/signalr';

export interface PerformanceMetrics {
  dataRate: number;
  frameRate: number;
  latency: number;
  memoryUsage: number;
  timestamp: string;
}

export interface DAQStatus {
  isRunning: boolean;
  isPaused: boolean;
  currentConfig: any;
  errorMessage?: string;
}

export class DAQSignalRClient {
  private connection: signalR.HubConnection;
  private isConnected: boolean = false;

  constructor(baseUrl: string = 'http://localhost:5000') {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/daqhub`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.connection.onreconnecting(() => {
      console.log('SignalR: 重新连接中...');
      this.isConnected = false;
    });

    this.connection.onreconnected(() => {
      console.log('SignalR: 重新连接成功');
      this.isConnected = true;
    });

    this.connection.onclose(() => {
      console.log('SignalR: 连接关闭');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.connection.start();
      this.isConnected = true;
      console.log('SignalR: 连接成功');
    } catch (error) {
      console.error('SignalR: 连接失败', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.isConnected = false;
      console.log('SignalR: 已断开连接');
    }
  }

  // 订阅性能指标更新
  onPerformanceUpdate(callback: (metrics: PerformanceMetrics) => void): void {
    this.connection.on('PerformanceUpdate', callback);
  }

  // 订阅DAQ状态更新
  onStatusUpdate(callback: (status: DAQStatus) => void): void {
    this.connection.on('StatusUpdate', callback);
  }

  // 订阅错误消息
  onError(callback: (error: string) => void): void {
    this.connection.on('Error', callback);
  }

  // 发送控制命令
  async sendCommand(command: string, params?: any): Promise<void> {
    if (!this.isConnected) {
      throw new Error('SignalR连接未建立');
    }

    try {
      await this.connection.invoke('SendCommand', command, params);
    } catch (error) {
      console.error('发送命令失败:', error);
      throw error;
    }
  }

  // 加入性能监控组
  async joinPerformanceGroup(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('SignalR连接未建立');
    }

    try {
      await this.connection.invoke('JoinPerformanceGroup');
      console.log('已加入性能监控组');
    } catch (error) {
      console.error('加入性能监控组失败:', error);
      throw error;
    }
  }

  // 离开性能监控组
  async leavePerformanceGroup(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.connection.invoke('LeavePerformanceGroup');
      console.log('已离开性能监控组');
    } catch (error) {
      console.error('离开性能监控组失败:', error);
    }
  }

  get connectionState(): signalR.HubConnectionState {
    return this.connection.state;
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

// 单例实例
export const signalrClient = new DAQSignalRClient();
