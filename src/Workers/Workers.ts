/* eslint-disable @typescript-eslint/no-explicit-any */
type Callback = (...args: any) => Promise<any>;

type Task<T extends Callback> = () => ReturnType<T>;

type TaskCallback<T extends Callback> = (taskResult: void | TaskReturnValue<T>) => void;

type TaskResult<T extends Callback> = {
  worker: Worker<T>;
  result: IteratorResult<TaskReturnValue<T>, void>;
};

type TaskReturnValue<T extends Callback> = void | Awaited<ReturnType<T>>;

type Worker<T extends Callback> = AsyncGenerator<TaskReturnValue<T>, void, ReturnType<T>>;

export class Workers<T extends Callback> {
  maxConcurrency: number;
  pool: Map<Worker<T>, Promise<TaskResult<T>>>;
  tasks: IterableIterator<Task<T>>;
  workers: Worker<T>[];

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
    this.pool = new Map();
    this.tasks = [].values();
    this.workers = new Array(maxConcurrency);
  }

  /**
   * Takes an array of functions (tasks) to perform.
   * Tasks are executed asynchronously and in parallel, though the number of parallel tasks
   * will not exceed the `maxConcurrency` setting.
   */
  async do(tasks: Task<T>[], callback?: TaskCallback<T>): Promise<TaskReturnValue<T>[]> {
    this.tasks = tasks.values();

    for (let i = 0; i < this.maxConcurrency; i++) {
      this.workers[i] = this.createWorker();
    }

    this.pool = new Map(this.workers.map(worker => [worker, this.assign(worker)]));

    const results = [];

    for await (const taskResult of this.watch()) {
      results.push(taskResult);
      callback?.(taskResult);
    }

    return results;
  }

  /**
   * Creates a "worker" which essentially picks the next unassigned task from the queue and yields its results.
   */
  private async *createWorker(): Worker<T> {
    for (const task of this.tasks) {
      yield await task();
    }
  }

  /**
   * Instructs a worker to pick up the next task in the queue. Returns a Promise of the task result.
   */
  private async assign(worker: Worker<T>): Promise<TaskResult<T>> {
    const task = worker.next();

    return { worker, result: await task };
  }

  /**
   * Begins doing work and yielding the results as each work completes until there is no work left.
   */
  private async *watch() {
    while (this.pool.size) {
      const pooledWork = this.pool.values();
      const completedWork = await Promise.race(pooledWork);

      const {
        worker,
        result: { value, done }
      } = completedWork;

      if (done) {
        this.pool.delete(worker);
      } else {
        this.pool.set(worker, this.assign(worker));
        yield value;
      }
    }
  }
}
