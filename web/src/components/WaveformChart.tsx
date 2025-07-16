import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { PlotData, Layout, Config } from 'plotly.js';

interface WaveformChartProps {
  data: Float32Array[];
  sampleRate: number;
  channels: number;
  isStreaming: boolean;
  maxPoints?: number;
}

interface PlotlyData extends Partial<PlotData> {
  x: number[];
  y: number[];
  type: 'scattergl';
  mode: 'lines';
  name: string;
  line: {
    color: string;
    width: number;
  };
}

// 循环缓冲区类，用于高效内存管理
class CircularBuffer {
  private buffer: Float32Array;
  private timeBuffer: Float32Array;
  private writeIndex: number = 0;
  private size: number;
  private isFull: boolean = false;

  constructor(size: number) {
    this.size = size;
    this.buffer = new Float32Array(size);
    this.timeBuffer = new Float32Array(size);
  }

  push(value: number, time: number): void {
    this.buffer[this.writeIndex] = value;
    this.timeBuffer[this.writeIndex] = time;
    this.writeIndex = (this.writeIndex + 1) % this.size;
    if (this.writeIndex === 0) this.isFull = true;
  }

  getData(): { values: Float32Array; times: Float32Array; length: number } {
    const length = this.isFull ? this.size : this.writeIndex;
    if (this.isFull) {
      // 重新排列数据，使其按时间顺序
      const values = new Float32Array(length);
      const times = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        const index = (this.writeIndex + i) % this.size;
        values[i] = this.buffer[index];
        times[i] = this.timeBuffer[index];
      }
      return { values, times, length };
    } else {
      return {
        values: this.buffer.slice(0, length),
        times: this.timeBuffer.slice(0, length),
        length
      };
    }
  }

  clear(): void {
    this.writeIndex = 0;
    this.isFull = false;
  }
}

const WaveformChart: React.FC<WaveformChartProps> = ({
  data,
  sampleRate,
  channels,
  isStreaming,
  maxPoints = 500000 // 减少到500k以提高性能
}) => {
  const [plotData, setPlotData] = useState<PlotlyData[]>([]);
  const [revision, setRevision] = useState(0);
  const frameRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);
  const buffersRef = useRef<CircularBuffer[]>([]);
  const frameCountRef = useRef<number>(0);
  
  // Color palette for different channels (memoized to prevent re-creation)
  const channelColors = useMemo(() => [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
    '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
    '#bcbd22', '#17becf', '#aec7e8', '#ffbb78',
    '#98df8a', '#ff9896', '#c5b0d5', '#c49c94'
  ], []);

  // 初始化循环缓冲区
  useEffect(() => {
    buffersRef.current = Array.from({ length: channels }, () => new CircularBuffer(maxPoints));
  }, [channels, maxPoints]);

  // 智能LOD算法 - 根据数据量动态调整采样率
  const calculateOptimalStep = useCallback((dataLength: number, targetPoints: number): number => {
    if (dataLength <= targetPoints) return 1;
    
    // 使用对数缩放来保持重要特征
    const baseStep = Math.floor(dataLength / targetPoints);
    return Math.max(1, baseStep);
  }, []);

  // 高性能数据转换，使用循环缓冲区和智能采样
  const convertDataToPlot = useCallback((rawData: Float32Array[]): PlotlyData[] => {
    const result: PlotlyData[] = [];
    
    for (let ch = 0; ch < Math.min(channels, rawData.length); ch++) {
      const channelData = rawData[ch];
      if (!channelData || channelData.length === 0) continue;
      
      const buffer = buffersRef.current[ch];
      if (!buffer) continue;

      // 将新数据添加到循环缓冲区
      const step = calculateOptimalStep(channelData.length, maxPoints / 4); // 每次只处理1/4的数据
      for (let i = 0; i < channelData.length; i += step) {
        const time = (frameCountRef.current * channelData.length + i) / sampleRate;
        buffer.push(channelData[i], time);
      }

      // 从缓冲区获取数据用于显示
      const bufferData = buffer.getData();
      const displayStep = Math.max(1, Math.floor(bufferData.length / (maxPoints / channels)));
      
      const sampledData: number[] = [];
      const timeData: number[] = [];
      
      for (let i = 0; i < bufferData.length; i += displayStep) {
        sampledData.push(bufferData.values[i]);
        timeData.push(bufferData.times[i]);
      }
      
      result.push({
        x: timeData,
        y: sampledData,
        type: 'scattergl',
        mode: 'lines',
        name: `Channel ${ch + 1}`,
        line: {
          color: channelColors[ch % channelColors.length],
          width: 1
        }
      });
    }
    
    frameCountRef.current++;
    return result;
  }, [channels, sampleRate, maxPoints, channelColors, calculateOptimalStep]);

  // 优化的更新循环 - 降低更新频率以提高性能
  useEffect(() => {
    if (!isStreaming) return;
    
    const updatePlot = () => {
      const now = performance.now();
      
      // 降低到30fps以提高性能，减少WebGL clear()调用
      if (now - lastUpdateRef.current >= 33.33) { // ~30fps
        const newPlotData = convertDataToPlot(data);
        setPlotData(newPlotData);
        setRevision(prev => prev + 1);
        lastUpdateRef.current = now;
      }
      
      frameRef.current = requestAnimationFrame(updatePlot);
    };
    
    frameRef.current = requestAnimationFrame(updatePlot);
    
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [data, isStreaming, convertDataToPlot]);

  // 清理缓冲区当停止流式传输时
  useEffect(() => {
    if (!isStreaming) {
      buffersRef.current.forEach(buffer => buffer?.clear());
      frameCountRef.current = 0;
      const newPlotData = convertDataToPlot(data);
      setPlotData(newPlotData);
      setRevision(prev => prev + 1);
    }
  }, [data, isStreaming, convertDataToPlot]);

  const layout: Partial<Layout> = useMemo(() => ({
    title: {
      text: `JYTEK Waveform Display - ${channels} Channels @ ${sampleRate.toLocaleString()} S/s`,
      font: { size: 16 }
    },
    xaxis: {
      title: { text: 'Time (s)' },
      showgrid: false, // 减少网格渲染开销
      zeroline: false,
      type: 'linear',
      fixedrange: false, // 允许缩放
      autorange: true
    },
    yaxis: {
      title: { text: 'Amplitude' },
      showgrid: false, // 减少网格渲染开销
      zeroline: true,
      type: 'linear',
      fixedrange: false,
      autorange: true
    },
    showlegend: true,
    legend: {
      x: 1,
      y: 1,
      bgcolor: 'rgba(255,255,255,0.8)',
      bordercolor: 'rgba(0,0,0,0.1)',
      borderwidth: 1
    },
    margin: { l: 60, r: 60, t: 60, b: 60 },
    plot_bgcolor: '#ffffff', // 简化背景色
    paper_bgcolor: '#ffffff',
    hovermode: false, // 禁用hover以提高性能
    // 高性能优化配置
    uirevision: revision,
    datarevision: revision
    // 移除transition和scene配置以避免类型错误
  }), [channels, sampleRate, revision]);

  const config: Partial<Config> = useMemo(() => ({
    displayModeBar: false, // 完全隐藏工具栏以提高性能
    displaylogo: false,
    responsive: true,
    // WebGL性能优化
    plotGlPixelRatio: 1, // 降低像素比以提高性能
    // 禁用交互以提高性能
    staticPlot: false,
    // 内存管理
    editable: false,
    // 减少DOM操作
    showTips: false,
    showLink: false,
    // 性能优化
    doubleClick: false,
    autosizable: true
  }), []);

  return (
    <div className="waveform-chart" style={{ width: '100%', height: '600px' }}>
      <Plot
        data={plotData}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
        revision={revision}
      />
      
      {/* Performance indicator */}
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        right: '10px', 
        background: 'rgba(0,0,0,0.7)', 
        color: 'white', 
        padding: '5px 10px', 
        borderRadius: '3px',
        fontSize: '12px'
      }}>
        {isStreaming ? '🔴 LIVE' : '⏸️ PAUSED'} | 
        Points: {plotData.reduce((sum, trace) => sum + (trace.y?.length || 0), 0).toLocaleString()}
      </div>
    </div>
  );
};

export default WaveformChart;
