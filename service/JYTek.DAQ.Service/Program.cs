using JYTek.DAQ.Service.Services;
using JYTek.DAQ.Service.Hubs;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// 配置Serilog日志
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/jytek-daq-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// 添加服务
builder.Services.AddGrpc(options =>
{
    options.EnableDetailedErrors = true;
    options.MaxReceiveMessageSize = 64 * 1024 * 1024; // 64MB
    options.MaxSendMessageSize = 64 * 1024 * 1024;    // 64MB
});

// gRPC-Web将在UseGrpcWeb中间件中配置

builder.Services.AddSignalR(options =>
{
    options.MaximumReceiveMessageSize = 64 * 1024 * 1024; // 64MB
    options.EnableDetailedErrors = true;
});

// 添加CORS支持
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowWebApp", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "https://localhost:3000", 
                          "http://localhost:3001", "https://localhost:3001")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 添加自定义服务
builder.Services.AddSingleton<DAQDataService>();
builder.Services.AddSingleton<PerformanceMonitorService>();

// 添加后台服务
builder.Services.AddHostedService<DAQHubBackgroundService>();

var app = builder.Build();

// 配置中间件管道
app.UseCors("AllowWebApp");

app.UseRouting();

// 启用gRPC-Web
app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });

// 映射gRPC服务
app.MapGrpcService<DAQStreamService>().EnableGrpcWeb();

// 映射SignalR Hub
app.MapHub<DAQHub>("/daqhub");

// 健康检查端点
app.MapGet("/health", () => new { 
    Status = "Healthy", 
    Timestamp = DateTime.UtcNow,
    Version = "1.0.0",
    Service = "JYTEK DAQ Service"
});

// 性能指标端点
app.MapGet("/metrics", (PerformanceMonitorService monitor) => monitor.GetMetrics());

app.Run();
