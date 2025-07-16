using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime;

namespace JYTek.DAQ.Service.Services;

/// <summary>
/// 性能监控服务 - 实时监控系统性能指标
/// 跟踪数据吞吐量、延迟、内存使用等关键指标
/// </summary>
public class PerformanceMonitorService
{
    private readonly ILogger<PerformanceMonitorService> _logger;
    private readonly ConcurrentDictionary<string, PerformanceMetrics> _clientMetrics = new();
    private readonly PerformanceMetrics _globalMetrics = new();
    private readonly Timer _metricsTimer;
    private readonly Process _currentProcess;

    public PerformanceMonitorService(ILogger<PerformanceMonitorService> logger)
    {
        _logger = logger;
        _currentProcess = Process.GetCurrentProcess();
        
        // 每秒更新一次性能指标
        _metricsTimer = new Timer(UpdateMetrics, null, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(1));
    }

    /// <summary>
    /// 记录数据发送
    /// </summary>
    public void RecordDataSent(int bytes, string? clientId = null)
    {
        var now = DateTime.UtcNow;
        
        // 更新全局指标
        Interlocked.Add(ref _globalMetrics.TotalBytesSent, bytes);
        Interlocked.Increment(ref _globalMetrics.TotalPacketsSent);
        _globalMetrics.LastUpdateTime = now;

        // 更新客户端指标
        if (!string.IsNullOrEmpty(clientId))
        {
            var clientMetrics = _clientMetrics.GetOrAdd(clientId, _ => new PerformanceMetrics());
            Interlocked.Add(ref clientMetrics.TotalBytesSent, bytes);
            Interlocked.Increment(ref clientMetrics.TotalPacketsSent);
            clientMetrics.LastUpdateTime = now;
        }
    }

    /// <summary>
    /// 记录延迟
    /// </summary>
    public void RecordLatency(TimeSpan latency, string? clientId = null)
    {
        var latencyMs = latency.TotalMilliseconds;
        
        // 更新全局延迟统计
        UpdateLatencyStats(_globalMetrics, latencyMs);

        // 更新客户端延迟统计
        if (!string.IsNullOrEmpty(clientId))
        {
            var clientMetrics = _clientMetrics.GetOrAdd(clientId, _ => new PerformanceMetrics());
            UpdateLatencyStats(clientMetrics, latencyMs);
        }
    }

    /// <summary>
    /// 获取性能指标
    /// </summary>
    public object GetMetrics()
    {
        var now = DateTime.UtcNow;
        var uptime = now - _globalMetrics.StartTime;

        return new
        {
            Timestamp = now,
            Uptime = uptime.ToString(@"dd\.hh\:mm\:ss"),
            Global = GetMetricsSnapshot(_globalMetrics, uptime),
            Clients = _clientMetrics.ToDictionary(
                kvp => kvp.Key,
                kvp => GetMetricsSnapshot(kvp.Value, uptime)
            ),
            System = GetSystemMetrics()
        };
    }

    /// <summary>
    /// 获取指定客户端的性能指标
    /// </summary>
    public object? GetClientMetrics(string clientId)
    {
        if (_clientMetrics.TryGetValue(clientId, out var metrics))
        {
            var uptime = DateTime.UtcNow - metrics.StartTime;
            return GetMetricsSnapshot(metrics, uptime);
        }
        return null;
    }

    /// <summary>
    /// 清除客户端指标
    /// </summary>
    public void ClearClientMetrics(string clientId)
    {
        _clientMetrics.TryRemove(clientId, out _);
        _logger.LogInformation("已清除客户端 {ClientId} 的性能指标", clientId);
    }

    /// <summary>
    /// 重置所有指标
    /// </summary>
    public void ResetMetrics()
    {
        _globalMetrics.Reset();
        _clientMetrics.Clear();
        _logger.LogInformation("已重置所有性能指标");
    }

    /// <summary>
    /// 更新延迟统计
    /// </summary>
    private static void UpdateLatencyStats(PerformanceMetrics metrics, double latencyMs)
    {
        lock (metrics.LatencyLock)
        {
            metrics.LatencyCount++;
            metrics.LatencySum += latencyMs;
            
            if (latencyMs < metrics.MinLatency || metrics.MinLatency == 0)
                metrics.MinLatency = latencyMs;
            
            if (latencyMs > metrics.MaxLatency)
                metrics.MaxLatency = latencyMs;

            // 更新延迟分布
            if (latencyMs <= 1) metrics.LatencyDistribution[0]++;
            else if (latencyMs <= 5) metrics.LatencyDistribution[1]++;
            else if (latencyMs <= 10) metrics.LatencyDistribution[2]++;
            else if (latencyMs <= 50) metrics.LatencyDistribution[3]++;
            else if (latencyMs <= 100) metrics.LatencyDistribution[4]++;
            else metrics.LatencyDistribution[5]++;
        }
    }

    /// <summary>
    /// 获取指标快照
    /// </summary>
    private static object GetMetricsSnapshot(PerformanceMetrics metrics, TimeSpan uptime)
    {
        var totalSeconds = uptime.TotalSeconds;
        var dataRateMBps = totalSeconds > 0 ? (metrics.TotalBytesSent / totalSeconds) / (1024 * 1024) : 0;
        var packetRate = totalSeconds > 0 ? metrics.TotalPacketsSent / totalSeconds : 0;

        double avgLatency = 0;
        double[] latencyPercentiles = new double[6];
        
        lock (metrics.LatencyLock)
        {
            avgLatency = metrics.LatencyCount > 0 ? metrics.LatencySum / metrics.LatencyCount : 0;
            Array.Copy(metrics.LatencyDistribution, latencyPercentiles, 6);
        }

        return new
        {
            StartTime = metrics.StartTime,
            LastUpdate = metrics.LastUpdateTime,
            DataRate = new
            {
                TotalBytes = metrics.TotalBytesSent,
                TotalMB = metrics.TotalBytesSent / (1024.0 * 1024.0),
                RateMBps = dataRateMBps,
                TargetMBps = 640.0,
                EfficiencyPercent = Math.Min(100, (dataRateMBps / 640.0) * 100)
            },
            Packets = new
            {
                Total = metrics.TotalPacketsSent,
                Rate = packetRate
            },
            Latency = new
            {
                Average = avgLatency,
                Min = metrics.MinLatency,
                Max = metrics.MaxLatency,
                Count = metrics.LatencyCount,
                Distribution = new
                {
                    Under1ms = latencyPercentiles[0],
                    Under5ms = latencyPercentiles[1],
                    Under10ms = latencyPercentiles[2],
                    Under50ms = latencyPercentiles[3],
                    Under100ms = latencyPercentiles[4],
                    Over100ms = latencyPercentiles[5]
                }
            }
        };
    }

    /// <summary>
    /// 获取系统性能指标
    /// </summary>
    private object GetSystemMetrics()
    {
        try
        {
            _currentProcess.Refresh();
            
            var totalMemory = GC.GetTotalMemory(false);
            var workingSet = _currentProcess.WorkingSet64;
            var cpuTime = _currentProcess.TotalProcessorTime;

            return new
            {
                Memory = new
                {
                    ManagedMB = totalMemory / (1024.0 * 1024.0),
                    WorkingSetMB = workingSet / (1024.0 * 1024.0),
                    Gen0Collections = GC.CollectionCount(0),
                    Gen1Collections = GC.CollectionCount(1),
                    Gen2Collections = GC.CollectionCount(2)
                },
                CPU = new
                {
                    TotalProcessorTime = cpuTime.ToString(@"hh\:mm\:ss\.fff"),
                    ThreadCount = _currentProcess.Threads.Count
                },
                GC = new
                {
                    IsServerGC = GCSettings.IsServerGC,
                    LatencyMode = GCSettings.LatencyMode.ToString()
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "获取系统性能指标时发生错误");
            return new { Error = "无法获取系统指标" };
        }
    }

    /// <summary>
    /// 定时更新性能指标
    /// </summary>
    private void UpdateMetrics(object? state)
    {
        try
        {
            var now = DateTime.UtcNow;
            
            // 检查全局性能
            var globalUptime = now - _globalMetrics.StartTime;
            if (globalUptime.TotalSeconds > 0)
            {
                var globalDataRate = (_globalMetrics.TotalBytesSent / globalUptime.TotalSeconds) / (1024 * 1024);
                
                // 如果数据率低于目标的50%，记录警告
                if (globalDataRate < 320 && _globalMetrics.TotalBytesSent > 0)
                {
                    _logger.LogWarning("全局数据率低于目标: {DataRate:F2} MB/s (目标: 640 MB/s)", globalDataRate);
                }
            }

            // 清理不活跃的客户端指标 (超过5分钟无更新)
            var inactiveClients = _clientMetrics
                .Where(kvp => now - kvp.Value.LastUpdateTime > TimeSpan.FromMinutes(5))
                .Select(kvp => kvp.Key)
                .ToList();

            foreach (var clientId in inactiveClients)
            {
                _clientMetrics.TryRemove(clientId, out _);
                _logger.LogDebug("清理不活跃客户端指标: {ClientId}", clientId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "更新性能指标时发生错误");
        }
    }

    public void Dispose()
    {
        _metricsTimer?.Dispose();
        _currentProcess?.Dispose();
    }
}

/// <summary>
/// 性能指标数据结构
/// </summary>
public class PerformanceMetrics
{
    public DateTime StartTime { get; } = DateTime.UtcNow;
    public DateTime LastUpdateTime { get; set; } = DateTime.UtcNow;
    
    public long TotalBytesSent;
    public long TotalPacketsSent;
    
    // 延迟统计
    public readonly object LatencyLock = new();
    public long LatencyCount;
    public double LatencySum;
    public double MinLatency;
    public double MaxLatency;
    public readonly long[] LatencyDistribution = new long[6]; // <1ms, <5ms, <10ms, <50ms, <100ms, >100ms

    public void Reset()
    {
        Interlocked.Exchange(ref TotalBytesSent, 0);
        Interlocked.Exchange(ref TotalPacketsSent, 0);
        
        lock (LatencyLock)
        {
            LatencyCount = 0;
            LatencySum = 0;
            MinLatency = 0;
            MaxLatency = 0;
            Array.Clear(LatencyDistribution);
        }
        
        LastUpdateTime = DateTime.UtcNow;
    }
}
