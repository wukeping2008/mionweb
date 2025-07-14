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

const WaveformChart: React.FC<WaveformChartProps> = ({
  data,
  sampleRate,
  channels,
  isStreaming,
  maxPoints = 1000000 // 1M points as per spec
}) => {
  const [plotData, setPlotData] = useState<PlotlyData[]>([]);
  const [revision, setRevision] = useState(0);
  const frameRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);
  
  // Color palette for different channels (memoized to prevent re-creation)
  const channelColors = useMemo(() => [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
    '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
    '#bcbd22', '#17becf', '#aec7e8', '#ffbb78',
    '#98df8a', '#ff9896', '#c5b0d5', '#c49c94'
  ], []);

  // Convert raw data to plot format with time axis
  const convertDataToPlot = useCallback((rawData: Float32Array[]): PlotlyData[] => {
    const result: PlotlyData[] = [];
    
    for (let ch = 0; ch < Math.min(channels, rawData.length); ch++) {
      const channelData = rawData[ch];
      if (!channelData || channelData.length === 0) continue;
      
      // Limit points for performance
      const step = Math.max(1, Math.floor(channelData.length / maxPoints));
      const sampledData = [];
      const timeData = [];
      
      for (let i = 0; i < channelData.length; i += step) {
        sampledData.push(channelData[i]);
        timeData.push(i / sampleRate); // Convert to time in seconds
      }
      
      result.push({
        x: timeData,
        y: sampledData,
        type: 'scattergl', // Use WebGL for performance
        mode: 'lines',
        name: `Channel ${ch + 1}`,
        line: {
          color: channelColors[ch % channelColors.length],
          width: 1
        }
      });
    }
    
    return result;
  }, [channels, sampleRate, maxPoints, channelColors]);

  // High-frequency update loop for streaming data
  useEffect(() => {
    if (!isStreaming) return;
    
    const updatePlot = () => {
      const now = performance.now();
      
      // Target 120fps as per spec, but limit to 60fps for browser compatibility
      if (now - lastUpdateRef.current >= 16.67) { // ~60fps
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

  // Update plot when not streaming
  useEffect(() => {
    if (!isStreaming) {
      const newPlotData = convertDataToPlot(data);
      setPlotData(newPlotData);
      setRevision(prev => prev + 1);
    }
  }, [data, isStreaming, convertDataToPlot]);

  const layout: Partial<Layout> = {
    title: {
      text: `JYTEK Waveform Display - ${channels} Channels @ ${sampleRate} S/s`,
      font: { size: 16 }
    },
    xaxis: {
      title: { text: 'Time (s)' },
      showgrid: true,
      zeroline: false,
      type: 'linear'
    },
    yaxis: {
      title: { text: 'Amplitude' },
      showgrid: true,
      zeroline: true,
      type: 'linear'
    },
    showlegend: true,
    legend: {
      x: 1,
      y: 1,
      bgcolor: 'rgba(255,255,255,0.8)'
    },
    margin: { l: 60, r: 60, t: 60, b: 60 },
    plot_bgcolor: '#fafafa',
    paper_bgcolor: '#ffffff',
    hovermode: 'x unified',
    // Performance optimizations
    uirevision: revision,
    datarevision: revision
  };

  const config: Partial<Config> = {
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: [
      'pan2d',
      'lasso2d',
      'select2d',
      'autoScale2d',
      'hoverClosestCartesian',
      'hoverCompareCartesian',
      'toggleSpikelines'
    ],
    responsive: true,
    // Enable WebGL for better performance
    plotGlPixelRatio: 2
  };

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
