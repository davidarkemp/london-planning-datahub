class Semaphore {
    maxConcurrency: number
    currentConcurrency: number
    queue: (() => void)[]
    
    constructor(maxConcurrency) {
        this.maxConcurrency = maxConcurrency
        this.currentConcurrency = 0
        this.queue = []
    }

    async acquire() {
        return new Promise<void>((resolve) => {
            if (this.currentConcurrency < this.maxConcurrency) {
                this.currentConcurrency++
                resolve()
            } else {
                this.queue.push(resolve)
            }
        })
    }

    release() {
        if (this.queue.length > 0) {
            const resolve = this.queue.shift()
            if(resolve)
                resolve();
        } else {
            this.currentConcurrency--
        }
    }
}

export function rateLimit<T extends any[], R>(asyncFunction: (...args: T) => R , rate: number) {
    const semaphore = new Semaphore(rate)

    return async function process(...args: T) {
        await semaphore.acquire()
        try {
            return await asyncFunction(...args)
        } finally {
            semaphore.release()
        }
    }
}
