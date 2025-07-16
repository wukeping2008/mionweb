using Daq;
using Google.Protobuf;
using System.Collections.Concurrent;

namespace JYTek.DAQ.Service.Services;

/// <summary>
/// DAQ数据服务 - 高性能数据生成和管理
/// 模拟JY5500硬件数据采集，目标640 MB/s
/// </summary>
public class DAQDataService
{
    private readonly ILogger<DAQDataService> _logger;
    private readonly ConcurrentDictionary<string, ClientSession> _sessions = new();
    private readonly ConcurrentDictionary<string, Action<DataChunk>> _subscribers = new();
    private volatile bool _globalDataGeneration = false;
    private readonly object _globalLock = new();

    public DAQDataService(ILogger<DAQDataService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// 启动指定客户端的数据生成
    /// </summary>
    public async Task StartDataGeneration(DataRequest request, string clientId)
    {
        _logger.LogInformation("为客户端 {ClientId} 启动数据生成", clientId);

        var session = new ClientSession
        {
            ClientId = clientId,
            Request = request,
            CancellationTokenSource = new CancellationTokenSource(),
            IsActive = true
        };

        _sessions[clientId] = session;

        // 启动数据生成任务
        _ = Task.Run(() => GenerateDataForClient(session), session.CancellationTokenSource.Token);

        await Task.CompletedTask;
    }

    /// <summary>
    /// 停止指定客户端的数据生成
    /// </summary>
    public async Task StopDataGeneration(string clientId)
    {
        if (_sessions.TryRemove(clientId, out var session))
        {
            session.IsActive = false;
            session.CancellationTokenSource.Cancel();
            session.CancellationTokenSource.Dispose();
            _logger.LogInformation("客户端 {ClientId} 数据生成已停止", clientId);
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// 订阅数据流
    /// </summary>
    public IDisposable Subscribe(string clientId, Action<DataChunk> onData)
    {
        _subscribers[clientId] = onData;
        return new Subscription(() => _subscribers.TryRemove(clientId, out _));
    }

    /// <summary>
    /// 全局控制方法
    /// </summary>
    public async Task<bool> StartGlobalDataGeneration()
    {
        lock (_globalLock)
        {
            _globalDataGeneration = true;
        }
        _logger.LogInformation("全局数据生成已启动");
        return await Task.FromResult(true);
    }

    public async Task<bool> StopGlobalDataGeneration()
    {
        lock (_globalLock)
        {
            _globalDataGeneration = false;
        }
        
        // 停止所有客户端会话
        foreach (var session in _sessions.Values)
        {
            session.IsActive = false;
            session.CancellationTokenSource.Cancel();
        }
        
        _logger.LogInformation("全局数据生成已停止");
        return await Task.FromResult(true);
    }

    public async Task<bool> PauseGlobalDataGeneration()
    {
        lock (_globalLock)
        {
            _globalDataGeneration = false;
        }
        _logger.LogInformation("全局数据生成已暂停");
        return await Task.FromResult(true);
    }

    public async Task<bool> ResumeGlobalDataGeneration()
    {
        lock (_globalLock)
        {
            _globalDataGeneration = true;
        }
        _logger.LogInformation("全局数据生成已恢复");
        return await Task.FromResult(true);
    }

    public async Task<bool> ResetGlobalDataGeneration()
    {
        await StopGlobalDataGeneration();
        await Task.Delay(100); // 短暂延迟
        await StartGlobalDataGeneration();
        _logger.LogInformation("全局数据生成已重置");
        return true;
    }

    /// <summary>
    /// 为客户端生成高性能数据流
    /// </summary>
    private async Task GenerateDataForClient(ClientSession session)
    {
        var request = session.Request;
        var clientId = session.ClientId;
        var token = session.CancellationTokenSource.Token;

        _logger.LogInformation("开始为客户端 {ClientId} 生成数据: {Channels}通道, {SampleRate}Hz, {BufferSize}样本", 
            clientId, request.Channels, request.SampleRate, request.BufferSize);

        try
        {
            var sequenceNumber = 0u;
            var bytesPerSample = 2; // 16-bit samples
            var samplesPerChunk = (int)request.BufferSize;
            var bytesPerChunk = (int)(request.Channels * samplesPerChunk * bytesPerSample);
            
            // 计算目标间隔以达到指定采样率
            var samplesPerSecond = request.SampleRate * request.Channels;
            var chunksPerSecond = (double)samplesPerSecond / samplesPerChunk;
            var targetIntervalMs = 1000.0 / chunksPerSecond;

            _logger.LogInformation("客户端 {ClientId} 数据生成参数: 块大小={BytesPerChunk}字节, 目标间隔={Interval:F2}ms", 
                clientId, bytesPerChunk, targetIntervalMs);

            var lastGenerationTime = DateTime.UtcNow;

            while (session.IsActive && !token.IsCancellationRequested)
            {
                // 检查全局状态
                bool shouldGenerate;
                lock (_globalLock)
                {
                    shouldGenerate = _globalDataGeneration;
                }

                if (!shouldGenerate)
                {
                    await Task.Delay(10, token); // 暂停时短暂等待
                    continue;
                }

                var generationStartTime = DateTime.UtcNow;

                // 生成高性能模拟数据
                var payload = GenerateHighPerformanceData(request, sequenceNumber);
                
                var chunk = new DataChunk
                {
                    Payload = ByteString.CopyFrom(payload),
                    Seq = sequenceNumber++,
                    TickNs = (ulong)(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1_000_000),
                    Tags = {
                        ["clientId"] = clientId,
                        ["channels"] = request.Channels.ToString(),
                        ["sampleRate"] = request.SampleRate.ToString(),
                        ["bufferSize"] = request.BufferSize.ToString()
                    }
                };

                // 发送数据到订阅者
                if (_subscribers.TryGetValue(clientId, out var subscriber))
                {
                    subscriber(chunk);
                }

                var generationDuration = DateTime.UtcNow - generationStartTime;
                
                // 动态调整延迟以维持目标数据率
                var targetDelay = Math.Max(0, targetIntervalMs - generationDuration.TotalMilliseconds);
                
                if (targetDelay > 0)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(targetDelay), token);
                }

                // 性能监控
                if (sequenceNumber % 1000 == 0) // 每1000个块记录一次性能
                {
                    var actualInterval = (DateTime.UtcNow - lastGenerationTime).TotalMilliseconds / 1000;
                    var actualDataRate = (bytesPerChunk * 1000) / (actualInterval * 1024 * 1024);
                    
                    _logger.LogDebug("客户端 {ClientId} 性能: 实际数据率={DataRate:F2}MB/s, 生成时间={GenTime:F2}ms", 
                        clientId, actualDataRate, generationDuration.TotalMilliseconds);
                    
                    lastGenerationTime = DateTime.UtcNow;
                }
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("客户端 {ClientId} 数据生成被取消", clientId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "客户端 {ClientId} 数据生成异常", clientId);
        }
        finally
        {
            _logger.LogInformation("客户端 {ClientId} 数据生成结束", clientId);
        }
    }

    /// <summary>
    /// 生成高性能模拟数据
    /// 模拟JY5500硬件的多通道数据采集
    /// </summary>
    private byte[] GenerateHighPerformanceData(DataRequest request, uint sequenceNumber)
    {
        var channels = (int)request.Channels;
        var samplesPerChannel = (int)request.BufferSize;
        var sampleRate = request.SampleRate;
        
        // 预分配缓冲区
        var buffer = new byte[channels * samplesPerChannel * 2]; // 16-bit samples
        var bufferSpan = buffer.AsSpan();
        
        var baseFrequency = 1000.0; // 1kHz基频
        var amplitude = 32767.0 * 0.8; // 80%满量程
        
        var sampleIndex = 0;
        
        // 交错生成多通道数据 (interleaved format)
        for (var sample = 0; sample < samplesPerChannel; sample++)
        {
            var time = (sequenceNumber * samplesPerChannel + sample) / (double)sampleRate;
            
            for (var channel = 0; channel < channels; channel++)
            {
                // 为每个通道生成不同的波形
                var channelFreq = baseFrequency * (1.0 + channel * 0.1); // 每通道频率略有不同
                var phase = 2.0 * Math.PI * channelFreq * time;
                
                // 生成混合波形 (正弦波 + 谐波)
                var value = amplitude * (
                    0.6 * Math.Sin(phase) +
                    0.3 * Math.Sin(2 * phase) +
                    0.1 * Math.Sin(3 * phase)
                );
                
                // 添加少量噪声
                value += (Random.Shared.NextDouble() - 0.5) * amplitude * 0.02;
                
                // 转换为16-bit有符号整数
                var sample16 = (short)Math.Clamp(value, short.MinValue, short.MaxValue);
                
                // 写入缓冲区 (小端序)
                var bytes = BitConverter.GetBytes(sample16);
                bufferSpan[sampleIndex * 2] = bytes[0];
                bufferSpan[sampleIndex * 2 + 1] = bytes[1];
                
                sampleIndex++;
            }
        }
        
        return buffer;
    }

    /// <summary>
    /// 客户端会话信息
    /// </summary>
    private class ClientSession
    {
        public required string ClientId { get; init; }
        public required DataRequest Request { get; init; }
        public required CancellationTokenSource CancellationTokenSource { get; init; }
        public volatile bool IsActive;
    }

    /// <summary>
    /// 订阅取消器
    /// </summary>
    private class Subscription : IDisposable
    {
        private readonly Action _dispose;

        public Subscription(Action dispose)
        {
            _dispose = dispose;
        }

        public void Dispose()
        {
            _dispose();
        }
    }
}
