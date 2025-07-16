using Grpc.Core;
using Daq;
using System.Collections.Concurrent;

namespace JYTek.DAQ.Service.Services;

/// <summary>
/// gRPC DAQ流服务实现
/// 提供高性能数据流传输，目标640 MB/s
/// </summary>
public class DAQStreamService : DAQStream.DAQStreamBase
{
    private readonly ILogger<DAQStreamService> _logger;
    private readonly DAQDataService _dataService;
    private readonly PerformanceMonitorService _performanceMonitor;

    public DAQStreamService(
        ILogger<DAQStreamService> logger,
        DAQDataService dataService,
        PerformanceMonitorService performanceMonitor)
    {
        _logger = logger;
        _dataService = dataService;
        _performanceMonitor = performanceMonitor;
    }

    /// <summary>
    /// 订阅数据流 - 实现高性能流式传输
    /// </summary>
    public override async Task Subscribe(
        DataRequest request,
        IServerStreamWriter<DataChunk> responseStream,
        ServerCallContext context)
    {
        var clientId = Guid.NewGuid().ToString();
        _logger.LogInformation("客户端 {ClientId} 开始订阅数据流: {Channels}通道, {SampleRate}Hz", 
            clientId, request.Channels, request.SampleRate);

        try
        {
            // 验证请求参数
            if (request.Channels == 0 || request.SampleRate == 0 || request.BufferSize == 0)
            {
                throw new RpcException(new Status(StatusCode.InvalidArgument, "无效的请求参数"));
            }

            // 计算目标数据率
            var bytesPerSample = 2; // 16-bit samples
            var targetDataRate = request.Channels * request.SampleRate * bytesPerSample;
            _logger.LogInformation("目标数据率: {DataRate:F2} MB/s", targetDataRate / (1024.0 * 1024.0));

            // 启动数据生成
            await _dataService.StartDataGeneration(request, clientId);

            // 订阅数据流
            var dataQueue = new ConcurrentQueue<DataChunk>();
            var subscription = _dataService.Subscribe(clientId, chunk => dataQueue.Enqueue(chunk));

            var sequenceNumber = 0u;
            var startTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1_000_000; // 转换为纳秒

            // 高性能数据流传输循环
            while (!context.CancellationToken.IsCancellationRequested)
            {
                var chunksSent = 0;
                var batchStartTime = DateTime.UtcNow;

                // 批量处理数据块以提高性能
                while (dataQueue.TryDequeue(out var chunk) && chunksSent < 10) // 每批最多10个块
                {
                    // 更新序列号和时间戳
                    chunk.Seq = sequenceNumber++;
                    chunk.TickNs = (ulong)(startTime + (DateTime.UtcNow - DateTime.UnixEpoch).TotalNanoseconds);

                    // 发送数据块
                    await responseStream.WriteAsync(chunk, context.CancellationToken);
                    chunksSent++;

                    // 更新性能指标
                    _performanceMonitor.RecordDataSent(chunk.Payload.Length);
                }

                // 如果没有数据，短暂等待
                if (chunksSent == 0)
                {
                    await Task.Delay(1, context.CancellationToken); // 1ms延迟
                }

                // 性能监控：记录批次处理时间
                var batchDuration = DateTime.UtcNow - batchStartTime;
                if (batchDuration.TotalMilliseconds > 10) // 如果批次处理超过10ms，记录警告
                {
                    _logger.LogWarning("批次处理时间过长: {Duration}ms, 块数: {Count}", 
                        batchDuration.TotalMilliseconds, chunksSent);
                }
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("客户端 {ClientId} 取消订阅", clientId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "客户端 {ClientId} 数据流传输错误", clientId);
            throw new RpcException(new Status(StatusCode.Internal, $"数据流传输错误: {ex.Message}"));
        }
        finally
        {
            // 清理资源
            await _dataService.StopDataGeneration(clientId);
            _logger.LogInformation("客户端 {ClientId} 数据流传输结束", clientId);
        }
    }

    /// <summary>
    /// 控制命令处理
    /// </summary>
    public override async Task<Ack> Control(ControlCmd request, ServerCallContext context)
    {
        _logger.LogInformation("收到控制命令: {Command}", request.Cmd);

        try
        {
            var success = request.Cmd switch
            {
                ControlCmd.Types.Command.Start => await _dataService.StartGlobalDataGeneration(),
                ControlCmd.Types.Command.Stop => await _dataService.StopGlobalDataGeneration(),
                ControlCmd.Types.Command.Pause => await _dataService.PauseGlobalDataGeneration(),
                ControlCmd.Types.Command.Resume => await _dataService.ResumeGlobalDataGeneration(),
                ControlCmd.Types.Command.Reset => await _dataService.ResetGlobalDataGeneration(),
                _ => false
            };

            var response = new Ack
            {
                Success = success,
                Message = success ? $"命令 {request.Cmd} 执行成功" : $"命令 {request.Cmd} 执行失败",
                Timestamp = (ulong)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            _logger.LogInformation("控制命令 {Command} 执行结果: {Success}", request.Cmd, success);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "控制命令 {Command} 执行异常", request.Cmd);
            return new Ack
            {
                Success = false,
                Message = $"命令执行异常: {ex.Message}",
                Timestamp = (ulong)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };
        }
    }
}
