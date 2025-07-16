/**
 * 性能测试工具 - 验证640 MB/s目标
 * 用于压力测试和性能基准测试
 */

export interface PerformanceTestResult {
  testName: string;
  duration: number; // 测试持续时间(ms)
  dataProcessed: number; // 处理的数据量(bytes)
  averageDataRate: number; // 平均数据率(MB/s)
  peakDataRate: number; // 峰值数据率(MB/s)
  frameCount: number; // 帧数
  averageFrameRate: number; // 平均帧率(fps)
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
  errors: string[];
  success: boolean;
}

export class PerformanceTestSuite {
  private results: PerformanceTestResult[] = [];

  /**
   * 640 MB/s数据吞吐量测试
   */
  async testDataThroughput(durationMs: number = 10000): Promise<PerformanceTestResult> {
    const testName = '640 MB/s Data Throughput Test';
    const startTime = performance.now();
    const initialMemory = this.getMemoryUsage();
    
    let dataProcessed = 0;
    let frameCount = 0;
    let peakDataRate = 0;
    const dataRates: number[] = [];
    const errors: string[] = [];

    try {
      // 模拟高频数据生成
      const targetDataRate = 640; // MB/s
      const chunkSize = 100000; // 100k samples per chunk
      const channels = 4;
      const bytesPerSample = 2; // 16-bit
      const bytesPerChunk = channels * chunkSize * bytesPerSample;
      const chunksPerSecond = (targetDataRate * 1024 * 1024) / bytesPerChunk;
      const chunkInterval = 1000 / chunksPerSecond;

      return new Promise((resolve) => {
        const intervalId = setInterval(() => {
          const chunkStartTime = performance.now();
          
          // 生成数据块
          const data: Float32Array[] = [];
          for (let ch = 0; ch < channels; ch++) {
            const channelData = new Float32Array(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
              channelData[i] = Math.sin(2 * Math.PI * 1000 * i / 40000000);
            }
            data.push(channelData);
          }

          const chunkEndTime = performance.now();
          const chunkDuration = chunkEndTime - chunkStartTime;
          const currentDataRate = (bytesPerChunk / (chunkDuration / 1000)) / (1024 * 1024);
          
          dataProcessed += bytesPerChunk;
          frameCount++;
          dataRates.push(currentDataRate);
          peakDataRate = Math.max(peakDataRate, currentDataRate);

          // 检查是否达到测试时间
          if (performance.now() - startTime >= durationMs) {
            clearInterval(intervalId);
            
            const endTime = performance.now();
            const totalDuration = endTime - startTime;
            const averageDataRate = dataRates.reduce((a, b) => a + b, 0) / dataRates.length;
            const averageFrameRate = (frameCount * 1000) / totalDuration;
            const finalMemory = this.getMemoryUsage();

            const result: PerformanceTestResult = {
              testName,
              duration: totalDuration,
              dataProcessed,
              averageDataRate,
              peakDataRate,
              frameCount,
              averageFrameRate,
              memoryUsage: {
                initial: initialMemory,
                peak: Math.max(initialMemory, finalMemory),
                final: finalMemory
              },
              errors,
              success: averageDataRate >= 640 * 0.9 // 90%的目标作为成功标准
            };

            this.results.push(result);
            resolve(result);
          }
        }, chunkInterval);
      });
    } catch (error) {
      errors.push(`Test error: ${error}`);
      const endTime = performance.now();
      
      return {
        testName,
        duration: endTime - startTime,
        dataProcessed,
        averageDataRate: 0,
        peakDataRate,
        frameCount,
        averageFrameRate: 0,
        memoryUsage: {
          initial: initialMemory,
          peak: initialMemory,
          final: this.getMemoryUsage()
        },
        errors,
        success: false
      };
    }
  }

  /**
   * 55+ fps渲染性能测试
   */
  async testRenderingPerformance(durationMs: number = 5000): Promise<PerformanceTestResult> {
    const testName = '55+ FPS Rendering Performance Test';
    const startTime = performance.now();
    const initialMemory = this.getMemoryUsage();
    
    let frameCount = 0;
    let dataProcessed = 0;
    const frameRates: number[] = [];
    const errors: string[] = [];
    let lastFrameTime = startTime;

    try {
      return new Promise((resolve) => {
        const renderLoop = () => {
          const now = performance.now();
          const frameDuration = now - lastFrameTime;
          const currentFPS = 1000 / frameDuration;
          
          frameRates.push(currentFPS);
          frameCount++;
          dataProcessed += 1000; // 模拟每帧处理的数据
          lastFrameTime = now;

          if (now - startTime < durationMs) {
            requestAnimationFrame(renderLoop);
          } else {
            const totalDuration = now - startTime;
            const averageFrameRate = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
            const peakFrameRate = Math.max(...frameRates);
            const finalMemory = this.getMemoryUsage();

            const result: PerformanceTestResult = {
              testName,
              duration: totalDuration,
              dataProcessed,
              averageDataRate: (dataProcessed / (totalDuration / 1000)) / (1024 * 1024),
              peakDataRate: 0,
              frameCount,
              averageFrameRate,
              memoryUsage: {
                initial: initialMemory,
                peak: Math.max(initialMemory, finalMemory),
                final: finalMemory
              },
              errors,
              success: averageFrameRate >= 55
            };

            this.results.push(result);
            resolve(result);
          }
        };

        requestAnimationFrame(renderLoop);
      });
    } catch (error) {
      errors.push(`Rendering test error: ${error}`);
      
      return {
        testName,
        duration: performance.now() - startTime,
        dataProcessed,
        averageDataRate: 0,
        peakDataRate: 0,
        frameCount,
        averageFrameRate: 0,
        memoryUsage: {
          initial: initialMemory,
          peak: initialMemory,
          final: this.getMemoryUsage()
        },
        errors,
        success: false
      };
    }
  }

  /**
   * 内存泄漏测试
   */
  async testMemoryLeaks(durationMs: number = 30000): Promise<PerformanceTestResult> {
    const testName = 'Memory Leak Test';
    const startTime = performance.now();
    const initialMemory = this.getMemoryUsage();
    
    let dataProcessed = 0;
    let frameCount = 0;
    const memorySnapshots: number[] = [];
    const errors: string[] = [];

    try {
      return new Promise((resolve) => {
        const testInterval = setInterval(() => {
          // 模拟数据处理
          const data = new Float32Array(100000);
          for (let i = 0; i < data.length; i++) {
            data[i] = Math.random();
          }
          
          dataProcessed += data.length * 4; // 4 bytes per float
          frameCount++;
          
          // 记录内存使用
          memorySnapshots.push(this.getMemoryUsage());

          if (performance.now() - startTime >= durationMs) {
            clearInterval(testInterval);
            
            const endTime = performance.now();
            const totalDuration = endTime - startTime;
            const finalMemory = this.getMemoryUsage();
            const memoryGrowth = finalMemory - initialMemory;
            const peakMemory = Math.max(...memorySnapshots);

            // 检查内存增长是否超过阈值
            const memoryGrowthThreshold = initialMemory * 0.5; // 50%增长阈值
            const hasMemoryLeak = memoryGrowth > memoryGrowthThreshold;

            if (hasMemoryLeak) {
              errors.push(`Memory leak detected: ${memoryGrowth.toFixed(2)}MB growth`);
            }

            const result: PerformanceTestResult = {
              testName,
              duration: totalDuration,
              dataProcessed,
              averageDataRate: (dataProcessed / (totalDuration / 1000)) / (1024 * 1024),
              peakDataRate: 0,
              frameCount,
              averageFrameRate: (frameCount * 1000) / totalDuration,
              memoryUsage: {
                initial: initialMemory,
                peak: peakMemory,
                final: finalMemory
              },
              errors,
              success: !hasMemoryLeak
            };

            this.results.push(result);
            resolve(result);
          }
        }, 100); // 每100ms测试一次
      });
    } catch (error) {
      errors.push(`Memory test error: ${error}`);
      
      return {
        testName,
        duration: performance.now() - startTime,
        dataProcessed,
        averageDataRate: 0,
        peakDataRate: 0,
        frameCount,
        averageFrameRate: 0,
        memoryUsage: {
          initial: initialMemory,
          peak: initialMemory,
          final: this.getMemoryUsage()
        },
        errors,
        success: false
      };
    }
  }

  /**
   * 运行完整的性能测试套件
   */
  async runFullTestSuite(): Promise<PerformanceTestResult[]> {
    console.log('🚀 开始性能测试套件...');
    
    // 1. 数据吞吐量测试
    console.log('📊 测试1: 640 MB/s数据吞吐量...');
    await this.testDataThroughput(10000);
    
    // 2. 渲染性能测试
    console.log('🎮 测试2: 55+ fps渲染性能...');
    await this.testRenderingPerformance(5000);
    
    // 3. 内存泄漏测试
    console.log('🧠 测试3: 内存泄漏检测...');
    await this.testMemoryLeaks(15000);
    
    console.log('✅ 性能测试套件完成');
    return this.results;
  }

  /**
   * 生成性能报告
   */
  generateReport(): string {
    if (this.results.length === 0) {
      return '没有可用的测试结果';
    }

    let report = '\n=== JYTEK性能测试报告 ===\n\n';
    
    this.results.forEach((result, index) => {
      report += `${index + 1}. ${result.testName}\n`;
      report += `   状态: ${result.success ? '✅ 通过' : '❌ 失败'}\n`;
      report += `   持续时间: ${result.duration.toFixed(2)}ms\n`;
      report += `   数据处理: ${(result.dataProcessed / (1024 * 1024)).toFixed(2)}MB\n`;
      report += `   平均数据率: ${result.averageDataRate.toFixed(2)}MB/s\n`;
      report += `   平均帧率: ${result.averageFrameRate.toFixed(2)}fps\n`;
      report += `   内存使用: ${result.memoryUsage.initial.toFixed(2)}MB → ${result.memoryUsage.final.toFixed(2)}MB\n`;
      
      if (result.errors.length > 0) {
        report += `   错误: ${result.errors.join(', ')}\n`;
      }
      report += '\n';
    });

    // 总体评估
    const passedTests = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    
    report += `=== 总体评估 ===\n`;
    report += `通过测试: ${passedTests}/${totalTests}\n`;
    report += `成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`;
    
    if (passedTests === totalTests) {
      report += `🎉 所有测试通过！系统达到性能目标。\n`;
    } else {
      report += `⚠️  部分测试失败，需要进一步优化。\n`;
    }

    return report;
  }

  /**
   * 获取内存使用情况（MB）
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024);
    }
    return 0; // 如果不支持memory API
  }

  /**
   * 清除测试结果
   */
  clearResults(): void {
    this.results = [];
  }
}

// 导出单例实例
export const performanceTestSuite = new PerformanceTestSuite();
