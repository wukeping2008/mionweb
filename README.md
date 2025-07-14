# JYTEK Modular Instrument Platform

A high-performance web-based data acquisition platform for JYTEK modular instruments, supporting real-time waveform display and 640 MB/s data stream processing.

## Overview

JYTEK Modular Instrument Platform is a frontend-first data acquisition solution with a three-tier architecture:

```
Browser            ── gRPC‑web / SignalR ──►   Service Host   ──►   JY5500.Core   ─►   Driver DLL
<‑‑ streamed data  ◄──────────────────────        (ASP.NET)          (.NET)              (C++)
```

### Technology Stack

- **Frontend**: React 19 + TypeScript + Plotly.js (WebGL)
- **Backend**: ASP.NET Core + gRPC-web + SignalR
- **Protocol**: Protocol Buffers (gRPC)
- **Rendering**: WebGL high-performance graphics rendering

### Performance Targets

- **Data Throughput**: 640 MB/s (2x performance buffer)
- **UI Frame Rate**: ≥55 fps
- **Latency**: p99 < 10ms (local), < 25ms (LAN)
- **Data Loss**: < 1 ppm (72-hour test)

## Supported Hardware

| Model | Channels | Sample Rate | Max Data Rate | Mock Target |
|-------|----------|-------------|---------------|-------------|
| PXIe-69846H | 4×16-bit | 40 MS/s | 320 MB/s | **640 MB/s** |
| PXIe-5310 | 16×16-bit | 5 MS/s | 160 MB/s | 320 MB/s |
| PXIe-5500 | 32×16-bit | 1 MS/s | 64 MB/s | 128 MB/s |

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Modern browser with WebGL support

### Installation and Running

```bash
# Clone the repository
git clone https://github.com/wukeping2008/mionweb.git
cd mionweb

# Install frontend dependencies
cd web
npm install

# Start development server
npm start
```

Visit http://localhost:3000 to view the application.

### Project Structure

```
mionweb/
├── web/                    # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── WaveformChart.tsx    # Waveform display component
│   │   │   └── ControlPanel.tsx     # Control panel
│   │   ├── utils/          # Utility functions
│   │   │   └── mockDataGenerator.ts # Mock data generator
│   │   ├── proto/          # Protocol Buffers definitions
│   │   │   └── daq.proto   # DAQ service protocol
│   │   └── App.tsx         # Main application component
├── service/                # ASP.NET Core backend (to be developed)
├── core/                   # .NET Core library (to be developed)
└── docs/                   # Project documentation
```

## Features

### 🎯 Real-time Waveform Display
- Support for 1M data points real-time rendering
- WebGL acceleration with 60fps smooth display
- Multi-channel simultaneous display with automatic color assignment
- Dynamic zoom and pan capabilities

### ⚡ High-Performance Data Processing
- 640 MB/s data stream simulation
- Intelligent sampling and LOD (Level of Detail)
- Memory-optimized data buffering
- Adaptive frame rate adjustment

### 🎛️ Flexible Configuration
- Support for multiple DAQ card models
- Real-time parameter adjustment
- Multiple waveform types (sine, square, triangle, noise, mixed)
- Adjustable sample rate and channel count

### 📊 Performance Monitoring
- Real-time data rate display
- UI frame rate monitoring
- Performance status indicators
- Target achievement assessment

## Development Guide

### Component Overview

#### WaveformChart
High-performance waveform display component based on Plotly.js WebGL rendering:
- Support for 1M real-time data points
- Automatic LOD optimization
- 60fps target frame rate
- Multi-channel color management

#### ControlPanel
Data acquisition control panel:
- Start/Stop/Pause controls
- Real-time configuration adjustment
- Performance metrics display
- Hardware model selection

#### MockDataGenerator
High-performance data simulator:
- Multiple waveform generation
- Configurable data rates
- Real-time performance statistics
- Hardware characteristic simulation

### Performance Optimization

1. **WebGL Rendering**: Uses Plotly.js scattergl mode
2. **Data Sampling**: Intelligent LOD reduces rendering points
3. **Memory Management**: Float32Array efficient data storage
4. **Frame Rate Control**: Precise control with requestAnimationFrame
5. **Batch Updates**: Reduced DOM operation frequency

### Extension Development

Adding new waveform types:
```typescript
// Extend in mockDataGenerator.ts
case 'custom':
  return amplitude * customWaveformFunction(phase);
```

Adding new hardware configurations:
```typescript
// Add to CARD_CONFIGS
'PXIe-NewCard': {
  channels: 8,
  sampleRate: 10_000_000,
  bufferSize: 50_000,
  // ...
}
```

## Testing and Validation

### Performance Testing
- 640 MB/s data stream stress testing
- Long-term stability testing (72 hours)
- Multi-browser compatibility testing
- Low-end device performance testing

### Functional Testing
- All control function verification
- Data accuracy checking
- UI responsiveness testing
- Error handling validation

## Deployment

### Development Environment
```bash
npm start  # Start development server
```

### Production Build
```bash
npm run build  # Build production version
```

### Docker Deployment
```bash
# Build image
docker build -t mionweb .

# Run container
docker run -p 3000:3000 mionweb
```

## Roadmap

- [x] **Week 1**: Specification freeze, proto definition
- [x] **Week 2-3**: Waveform component P0 development
- [ ] **Week 4**: 640 MB/s stress testing
- [ ] **Week 5**: UI state machine enhancement
- [ ] **Week 6-7**: gRPC-web integration
- [ ] **Week 8**: Mock mode extension
- [ ] **Week 9-10**: FFT WASM integration
- [ ] **Week 11**: CI/CD pipeline
- [ ] **Week 12**: Authentication and CLI tools

## Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- Project Maintainer: JYTEK Development Team
- Email: support@jytek.com
- Project Link: [https://github.com/wukeping2008/mionweb](https://github.com/wukeping2008/mionweb)

---

**JYTEK Modular Instrument Platform** - Making high-performance data acquisition accessible through the web 🚀
