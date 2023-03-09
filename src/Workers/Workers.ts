// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Task<T = any> = () => T | Promise<T>;

export class Workers {
  private concurrency = 0;
  private readonly maxConcurrency: number;
  private readonly queue: Task[] = [];

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
  }

  private pushQueue<T>(task: Task<T>, resolve: (value: T) => void): void {
    this.queue.push(async () => {
      try {
        const result = await task();
        resolve(result);
      } finally {
        this.concurrency--;
        this.doWork();
      }
    });
  }

  private shiftQueue(): Task | undefined {
    return this.queue.shift();
  }

  private doWork() {
    while (this.concurrency < this.maxConcurrency && this.queue.length > 0) {
      const work = this.shiftQueue();

      if (typeof work !== 'undefined') {
        this.concurrency++;
        work();
      }
    }
  }

  /**
   * Appends a task to the Workers queue for processing.
   */
  async do<T>(task: Task<T>): Promise<T> {
    const promise = new Promise<T>(resolve => this.pushQueue(task, resolve));

    this.doWork();

    return await promise;
  }

  /**
   * Appends many tasks to the Workers queue for processing.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async doMany<T extends Task<any>[]>(tasks: T): Promise<{ [K in keyof T]: ReturnType<T[K]> }> {
    const batch = tasks.map(task => new Promise<T>(resolve => this.pushQueue(task, resolve)));

    this.doWork();

    return (await Promise.all(batch)) as { [K in keyof T]: ReturnType<T[K]> };
  }
}
