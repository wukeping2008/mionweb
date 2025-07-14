# JYTEK Modular Instrument Platform

简仪科技模块仪器Web端平台 - 高性能数据采集卡的Web前端界面，支持实时波形显示和640 MB/s数据流处理。

## 项目概述

JYTEK Modular Instrument Platform（简仪科技模块仪器Web端平台）是一个前端优先的数据采集解决方案，采用三层架构设计：

```
Browser            ── gRPC‑web / SignalR ──►   Service Host   ──►   JY5500.Core   ─►   Driver DLL
<‑‑ streamed data  ◄──────────────────────        (ASP.NET)          (.NET)              (C++)
```

### 技术栈

- **前端**: React 19 + TypeScript + Plotly.js (WebGL)
- **后端**: ASP.NET Core + gRPC-web + SignalR
- **协议**: Protocol Buffers (gRPC)
- **渲染**: WebGL高性能图形渲染

### 性能目标

- **数据吞吐量**: 640 MB/s (2x性能缓冲)
- **UI帧率**: ≥55 fps
- **延迟**: p99 < 10ms (本地), < 25ms (局域网)
- **数据丢失**: < 1 ppm (72小时测试)

## 支持的硬件

| 型号 | 通道数 | 采样率 | 最大数据率 | Mock目标 |
|------|--------|--------|------------|----------|
| PXIe-69846H | 4×16位 | 40 MS/s | 320 MB/s | **640 MB/s** |
| PXIe-5310 | 16×16位 | 5 MS/s | 160 MB/s | 320 MB/s |
| PXIe-5500 | 32×16位 | 1 MS/s | 64 MB/s | 128 MB/s |

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- 现代浏览器 (支持WebGL)

### 安装和运行

```bash
# 克隆项目
git clone <repository-url>
cd jy5500-web-instrument

# 安装前端依赖
cd web
npm install

# 启动开发服务器
npm start
```

访问 http://localhost:3000 查看应用。

### 项目结构

```
jy5500-web-instrument/
├── web/                    # React前端应用
│   ├── src/
│   │   ├── components/     # React组件
│   │   │   ├── WaveformChart.tsx    # 波形显示组件
│   │   │   └── ControlPanel.tsx     # 控制面板
│   │   ├── utils/          # 工具函数
│   │   │   └── mockDataGenerator.ts # 模拟数据生成器
│   │   ├── proto/          # Protocol Buffers定义
│   │   │   └── daq.proto   # DAQ服务协议
│   │   └── App.tsx         # 主应用组件
├── service/                # ASP.NET Core后端 (待开发)
├── core/                   # .NET Core库 (待开发)
└── docs/                   # 项目文档
```

## 功能特性

### 🎯 实时波形显示
- 支持1M点数据实时渲染
- WebGL加速，60fps流畅显示
- 多通道同时显示，自动颜色分配
- 动态缩放和平移

### ⚡ 高性能数据处理
- 640 MB/s数据流模拟
- 智能采样和LOD (Level of Detail)
- 内存优化的数据缓冲
- 帧率自适应调节

### 🎛️ 灵活配置
- 支持多种DAQ卡型号
- 实时参数调整
- 多种波形类型 (正弦波、方波、三角波、噪声、混合)
- 可调采样率和通道数

### 📊 性能监控
- 实时数据率显示
- UI帧率监控
- 性能状态指示
- 目标达成度评估

## 开发指南

### 组件说明

#### WaveformChart
高性能波形显示组件，基于Plotly.js WebGL渲染：
- 支持1M点实时数据
- 自动LOD优化
- 60fps目标帧率
- 多通道颜色管理

#### ControlPanel
数据采集控制面板：
- 启动/停止/暂停控制
- 实时配置调整
- 性能指标显示
- 硬件型号选择

#### MockDataGenerator
高性能数据模拟器：
- 多种波形生成
- 可配置数据率
- 实时性能统计
- 硬件特性模拟

### 性能优化

1. **WebGL渲染**: 使用Plotly.js的scattergl模式
2. **数据采样**: 智能LOD减少渲染点数
3. **内存管理**: Float32Array高效数据存储
4. **帧率控制**: requestAnimationFrame精确控制
5. **批量更新**: 减少DOM操作频率

### 扩展开发

添加新的波形类型：
```typescript
// 在mockDataGenerator.ts中扩展
case 'custom':
  return amplitude * customWaveformFunction(phase);
```

添加新的硬件配置：
```typescript
// 在CARD_CONFIGS中添加
'PXIe-NewCard': {
  channels: 8,
  sampleRate: 10_000_000,
  bufferSize: 50_000,
  // ...
}
```

## 测试和验证

### 性能测试
- 640 MB/s数据流压力测试
- 长时间稳定性测试 (72小时)
- 多浏览器兼容性测试
- 低端设备性能测试

### 功能测试
- 所有控制功能验证
- 数据准确性检查
- UI响应性测试
- 错误处理验证

## 部署

### 开发环境
```bash
npm start  # 启动开发服务器
```

### 生产构建
```bash
npm run build  # 构建生产版本
```

### Docker部署
```bash
# 构建镜像
docker build -t jy5500-web .

# 运行容器
docker run -p 3000:3000 jy5500-web
```

## 里程碑计划

- [x] **Week 1**: 规格冻结，proto定义
- [x] **Week 2-3**: 波形组件P0开发
- [ ] **Week 4**: 640 MB/s压力测试
- [ ] **Week 5**: UI状态机完善
- [ ] **Week 6-7**: gRPC-web集成
- [ ] **Week 8**: Mock模式扩展
- [ ] **Week 9-10**: FFT WASM集成
- [ ] **Week 11**: CI/CD流水线
- [ ] **Week 12**: 认证和CLI工具

## 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

- 项目维护者: [Your Name]
- 邮箱: [your.email@example.com]
- 项目链接: [https://github.com/yourorg/jy5500-web-instrument](https://github.com/yourorg/jy5500-web-instrument)

---

**JYTEK Modular Instrument Platform** - 简仪科技模块仪器Web端平台，让高性能数据采集触手可及 🚀
