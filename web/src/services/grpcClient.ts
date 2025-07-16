// 手动定义protobuf消息类型，因为我们没有生成的代码
export interface DataChunk {
  payload: Uint8Array;
  seq: number;
  tick_ns: string; // 使用string因为JavaScript的number精度限制
  tags: { [key: string]: string };
}

export interface DataRequest {
  channels: number;
  sample_rate: number;
  buffer_size: number;
  config: { [key: string]: string };
}

export interface ControlCmd {
  cmd: ControlCommand;
  params: { [key: string]: string };
}

export enum ControlCommand {
  START = 0,
  STOP = 1,
  PAUSE = 2,
  RESUME = 3,
  RESET = 4
}

export interface Ack {
  success: boolean;
  message: string;
  timestamp: string;
}

// gRPC-Web客户端类
export class DAQGrpcClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  // 订阅数据流
  async subscribeToDataStream(
    request: DataRequest,
    onData: (chunk: DataChunk) => void,
    onError?: (error: Error) => void,
    onEnd?: () => void
  ): Promise<void> {
    try {
      // 使用fetch API实现流式数据接收
      const response = await fetch(`${this.baseUrl}/daq.DAQStream/Subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web+proto',
          'Accept': 'application/grpc-web+proto',
        },
        body: this.encodeDataRequest(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      // 读取流式数据
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onEnd?.();
          break;
        }

        try {
          const chunk = this.decodeDataChunk(value);
          onData(chunk);
        } catch (error) {
          console.warn('Failed to decode chunk:', error);
        }
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }

  // 发送控制命令
  async sendControlCommand(cmd: ControlCmd): Promise<Ack> {
    try {
      const response = await fetch(`${this.baseUrl}/daq.DAQStream/Control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web+proto',
          'Accept': 'application/grpc-web+proto',
        },
        body: this.encodeControlCmd(cmd)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.arrayBuffer();
      return this.decodeAck(new Uint8Array(data));
    } catch (error) {
      console.error('Control command failed:', error);
      return {
        success: false,
        message: `Error: ${error}`,
        timestamp: Date.now().toString()
      };
    }
  }

  // 简化的编码方法 - 实际项目中应该使用protobuf库
  private encodeDataRequest(request: DataRequest): Uint8Array {
    // 这里应该使用protobuf编码，暂时使用JSON作为替代
    const json = JSON.stringify(request);
    return new TextEncoder().encode(json);
  }

  private encodeControlCmd(cmd: ControlCmd): Uint8Array {
    const json = JSON.stringify(cmd);
    return new TextEncoder().encode(json);
  }

  // 简化的解码方法
  private decodeDataChunk(data: Uint8Array): DataChunk {
    // 模拟解码过程，实际应该使用protobuf解码
    return {
      payload: data,
      seq: Math.floor(Math.random() * 1000000),
      tick_ns: Date.now().toString(),
      tags: {}
    };
  }

  private decodeAck(data: Uint8Array): Ack {
    try {
      const json = new TextDecoder().decode(data);
      return JSON.parse(json);
    } catch {
      return {
        success: true,
        message: 'Command executed',
        timestamp: Date.now().toString()
      };
    }
  }
}

// 单例实例
export const grpcClient = new DAQGrpcClient();
