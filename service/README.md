# JYTEK DAQ Service - 后端服务

## 📋 概述

JYTEK DAQ Service 是一个高性能的数据采集后端服务，基于 ASP.NET Core 9.0 构建，提供 gRPC 和 SignalR 双重通信协议支持，目标数据吞吐量 640 MB/s。

## 🚀 快速开始

### 前置要求
- .NET 9.0 SDK
- 支持的操作系统：Windows、macOS、Linux

### 启动服务
```bash
cd service/JYTek.DAQ.Service
dotnet build
dotnet run
```

服务将在 `http://localhost:5000` 启动。

## 📡 API 端点

### HTTP 端点

#### 健康检查
```
GET http://localhost:5000/health
```
返回服务健康状态和基本信息。

#### 性能指标
```
GET http://localhost:5000/metrics
```
返回详细的性能监控数据，包括：
- 全局数据吞吐量统计
- 客户端连接信息
- 系统资源使用情况
- 延迟分布分析

### gRPC 服务

#### DAQStream 服务
- **Subscribe**: 订阅高性能数据流
- **Control**: 发送控制命令（START/STOP/PAUSE/RESUME/RESET）

```protobuf
service DAQStream {
  rpc Subscribe(DataRequest) returns (stream DataChunk);
  rpc Control(ControlCmd) returns (Ack);
}
```

### SignalR Hub

#### DAQ Hub (`/daqhub`)
实时 WebSocket 通信，支持：
- 性能监控组管理
- 实时指标广播
- 控制命令发送
- 心跳检测

## 🏗️ 架构设计

### 核心组件

#### 1. DAQStreamService
- gRPC 流式数据传输
- 高性能批量处理
- 客户端会话管理
- 错误处理和重试机制

#### 2. DAQDataService
- 高性能数据生成器（模拟 JY5500 硬件）
- 多客户端并发支持
- 全局状态控制
- 实时数据流订阅

#### 3. PerformanceMonitorService
- 实时性能指标收集
- 数据吞吐量统计
- 延迟分布分析
- 系统资源监控

#### 4. DAQHub (SignalR)
- WebSocket 实时通信
- 性能监控组管理
- 后台定期广播
- 连接生命周期管理

### 数据流架构

```
客户端 ──► gRPC-Web ──► DAQStreamService ──► DAQDataService
   │                                            │
   └──► SignalR ──► DAQHub ──► PerformanceMonitorService
```

## 📊 性能特性

### 设计目标
- **数据吞吐量**: 640 MB/s
- **并发连接**: 支持多客户端
- **延迟**: < 10ms (p99)
- **可用性**: 99.9%

### 优化特性
- **批量数据处理**: 每批最多 10 个数据块
- **内存管理**: 预分配缓冲区，减少 GC 压力
- **异步处理**: 全异步 I/O 操作
- **性能监控**: 实时性能指标收集

## 🔧 配置选项

### gRPC 配置
- 最大接收消息大小: 64MB
- 最大发送消息大小: 64MB
- 启用详细错误信息
- gRPC-Web 支持

### SignalR 配置
- 最大接收消息大小: 64MB
- 启用详细错误信息
- 自动重连支持

### CORS 配置
- 允许来源: `http://localhost:3000`, `https://localhost:3000`
- 允许所有头部和方法
- 支持凭据传输

## 📝 日志系统

使用 Serilog 进行结构化日志记录：
- **控制台输出**: 开发调试
- **文件输出**: `logs/jytek-daq-{Date}.txt`
- **日志级别**: Information, Warning, Error

### 日志示例
```
[00:39:20 INF] DAQ Hub后台服务启动
[00:39:20 INF] Now listening on: http://localhost:5000
[00:48:25 INF] 客户端 abc123 开始订阅数据流: 8通道, 1000000Hz
```

## 🧪 测试和验证

### 健康检查测试
```bash
curl http://localhost:5000/health
```

### 性能指标测试
```bash
curl http://localhost:5000/metrics
```

### gRPC 服务测试
使用 gRPC 客户端工具或前端应用进行测试。

### SignalR 连接测试
使用 SignalR 客户端连接到 `/daqhub` 端点。

## 🔍 监控和调试

### 性能监控
- 实时数据吞吐量监控
- 客户端连接状态跟踪
- 系统资源使用情况
- 延迟分布统计

### 调试工具
- Serilog 结构化日志
- ASP.NET Core 内置诊断
- .NET 性能计数器
- 自定义性能指标

## 🚧 开发状态

### 已完成功能 ✅
- [x] gRPC 服务实现
- [x] SignalR Hub 实现
- [x] 高性能数据生成器
- [x] 性能监控服务
- [x] 健康检查和指标端点
- [x] 日志系统集成
- [x] CORS 配置

### 待开发功能 🔄
- [ ] JY5500.Core 硬件抽象层
- [ ] 真实硬件驱动集成
- [ ] 认证和授权
- [ ] 配置文件支持
- [ ] Docker 容器化
- [ ] 单元测试覆盖

## 📚 相关文档

- [项目总体状况](../PROJECT_STATUS.md)
- [前端应用文档](../web/README.md)
- [gRPC Protocol Buffer 定义](../web/src/proto/daq.proto)

## 🤝 贡献指南

1. Fork 项目仓库
2. 创建功能分支
3. 提交代码变更
4. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](../LICENSE) 文件。

---

**JYTEK 开发团队**  
*高性能数据采集解决方案*
