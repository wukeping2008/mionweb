using Microsoft.AspNetCore.SignalR;
using JYTek.DAQ.Service.Services;

namespace JYTek.DAQ.Service.Hubs;

/// <summary>
/// SignalR Hub for real-time DAQ communication
/// 提供WebSocket实时通信，作为gRPC的补充
/// </summary>
public class DAQHub : Hub
{
    private readonly ILogger<DAQHub> _logger;
    private readonly DAQDataService _dataService;
    private readonly PerformanceMonitorService _performanceMonitor;

    public DAQHub(
        ILogger<DAQHub> logger,
        DAQDataService dataService,
        PerformanceMonitorService performanceMonitor)
    {
        _logger = logger;
        _dataService = dataService;
        _performanceMonitor = performanceMonitor;
    }

    /// <summary>
    /// 客户端连接时调用
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        var connectionId = Context.ConnectionId;
        var userAgent = Context.GetHttpContext()?.Request.Headers["User-Agent"].ToString();
        
        _logger.LogInformation("SignalR客户端连接: {ConnectionId}, UserAgent: {UserAgent}", 
            connectionId, userAgent);

        // 发送欢迎消息和服务器状态
        await Clients.Caller.SendAsync("Welcome", new
        {
            ConnectionId = connectionId,
            ServerTime = DateTime.UtcNow,
            Message = "欢迎连接到JYTEK DAQ服务",
            Version = "1.0.0"
        });

        // 发送当前性能指标
        var metrics = _performanceMonitor.GetMetrics();
        await Clients.Caller.SendAsync("PerformanceUpdate", metrics);

        await base.OnConnectedAsync();
    }

    /// <summary>
    /// 客户端断开连接时调用
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var connectionId = Context.ConnectionId;
        
        if (exception != null)
        {
            _logger.LogWarning(exception, "SignalR客户端异常断开: {ConnectionId}", connectionId);
        }
        else
        {
            _logger.LogInformation("SignalR客户端正常断开: {ConnectionId}", connectionId);
        }

        // 清理客户端相关资源
        await _dataService.StopDataGeneration(connectionId);
        _performanceMonitor.ClearClientMetrics(connectionId);

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// 加入性能监控组
    /// </summary>
    public async Task JoinPerformanceGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "PerformanceMonitors");
        _logger.LogInformation("客户端 {ConnectionId} 加入性能监控组", Context.ConnectionId);
    }

    /// <summary>
    /// 离开性能监控组
    /// </summary>
    public async Task LeavePerformanceGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "PerformanceMonitors");
        _logger.LogInformation("客户端 {ConnectionId} 离开性能监控组", Context.ConnectionId);
    }

    /// <summary>
    /// 获取实时性能指标
    /// </summary>
    public async Task GetPerformanceMetrics()
    {
        var metrics = _performanceMonitor.GetMetrics();
        await Clients.Caller.SendAsync("PerformanceUpdate", metrics);
    }

    /// <summary>
    /// 获取指定客户端的性能指标
    /// </summary>
    public async Task GetClientMetrics(string clientId)
    {
        var metrics = _performanceMonitor.GetClientMetrics(clientId);
        await Clients.Caller.SendAsync("ClientMetricsUpdate", new { ClientId = clientId, Metrics = metrics });
    }

    /// <summary>
    /// 重置性能指标
    /// </summary>
    public async Task ResetMetrics()
    {
        _performanceMonitor.ResetMetrics();
        _logger.LogInformation("客户端 {ConnectionId} 请求重置性能指标", Context.ConnectionId);
        
        // 通知所有性能监控客户端
        await Clients.Group("PerformanceMonitors").SendAsync("MetricsReset", new
        {
            Timestamp = DateTime.UtcNow,
            RequestedBy = Context.ConnectionId
        });
    }

    /// <summary>
    /// 发送控制命令
    /// </summary>
    public async Task SendControlCommand(string command, object? parameters = null)
    {
        _logger.LogInformation("客户端 {ConnectionId} 发送控制命令: {Command}", 
            Context.ConnectionId, command);

        try
        {
            var success = command.ToLower() switch
            {
                "start" => await _dataService.StartGlobalDataGeneration(),
                "stop" => await _dataService.StopGlobalDataGeneration(),
                "pause" => await _dataService.PauseGlobalDataGeneration(),
                "resume" => await _dataService.ResumeGlobalDataGeneration(),
                "reset" => await _dataService.ResetGlobalDataGeneration(),
                _ => false
            };

            // 响应命令结果
            await Clients.Caller.SendAsync("CommandResult", new
            {
                Command = command,
                Success = success,
                Timestamp = DateTime.UtcNow,
                Parameters = parameters
            });

            // 如果命令成功，广播状态变化
            if (success)
            {
                await Clients.All.SendAsync("SystemStatusChanged", new
                {
                    Status = command,
                    Timestamp = DateTime.UtcNow,
                    ChangedBy = Context.ConnectionId
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "执行控制命令失败: {Command}", command);
            
            await Clients.Caller.SendAsync("CommandError", new
            {
                Command = command,
                Error = ex.Message,
                Timestamp = DateTime.UtcNow
            });
        }
    }

    /// <summary>
    /// 发送心跳
    /// </summary>
    public async Task Heartbeat()
    {
        await Clients.Caller.SendAsync("HeartbeatResponse", new
        {
            ServerTime = DateTime.UtcNow,
            ConnectionId = Context.ConnectionId
        });
    }

    /// <summary>
    /// 广播性能更新到所有监控客户端
    /// </summary>
    public async Task BroadcastPerformanceUpdate()
    {
        var metrics = _performanceMonitor.GetMetrics();
        await Clients.Group("PerformanceMonitors").SendAsync("PerformanceUpdate", metrics);
    }
}

/// <summary>
/// SignalR后台服务 - 定期广播性能指标
/// </summary>
public class DAQHubBackgroundService : BackgroundService
{
    private readonly IHubContext<DAQHub> _hubContext;
    private readonly PerformanceMonitorService _performanceMonitor;
    private readonly ILogger<DAQHubBackgroundService> _logger;

    public DAQHubBackgroundService(
        IHubContext<DAQHub> hubContext,
        PerformanceMonitorService performanceMonitor,
        ILogger<DAQHubBackgroundService> logger)
    {
        _hubContext = hubContext;
        _performanceMonitor = performanceMonitor;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("DAQ Hub后台服务启动");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // 每5秒广播一次性能指标
                var metrics = _performanceMonitor.GetMetrics();
                await _hubContext.Clients.Group("PerformanceMonitors")
                    .SendAsync("PerformanceUpdate", metrics, stoppingToken);

                await Task.Delay(5000, stoppingToken); // 5秒间隔
            }
            catch (OperationCanceledException)
            {
                // 正常取消，不记录错误
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DAQ Hub后台服务执行错误");
                await Task.Delay(1000, stoppingToken); // 错误后等待1秒再重试
            }
        }

        _logger.LogInformation("DAQ Hub后台服务停止");
    }
}
