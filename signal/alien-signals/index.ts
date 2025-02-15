// 从 system.js 文件中导出所有内容
export * from './system.js';

// 从 system.js 文件中导入创建响应式系统所需的函数和类型
import { createReactiveSystem, Dependency, Subscriber, SubscriberFlags } from './system.js';

/**
 * 定义 EffectScope 接口，继承自 Subscriber 接口
 * 表示一个副作用作用域，isScope 属性用于标识这是一个作用域
 */
interface EffectScope extends Subscriber {
    isScope: true;
}

/**
 * 定义 Effect 接口，继承自 Subscriber 和 Dependency 接口
 * 表示一个副作用，包含一个执行副作用的函数 fn
 */
interface Effect extends Subscriber, Dependency {
    fn(): void;
}

/**
 * 定义 Computed 接口，继承自 Signal 和 Subscriber 接口
 * 表示一个计算值，包含一个 getter 函数用于计算值
 */
interface Computed<T = any> extends Signal<T | undefined>, Subscriber {
    getter: (cachedValue?: T) => T;
}

/**
 * 定义 Signal 接口，继承自 Dependency 接口
 * 表示一个信号，包含一个当前值 currentValue
 */
interface Signal<T = any> extends Dependency {
    currentValue: T;
}

/**
 * 定义 WriteableSignal 接口
 * 表示一个可写的信号，既可以作为函数调用获取值，也可以传入参数设置值
 */
interface WriteableSignal<T> {
    (): T;
    (value: T): void;
}

// 创建响应式系统，并解构出所需的方法
const {
    link, // 用于链接依赖和订阅者
    propagate, // 用于传播依赖的变化
    updateDirtyFlag, // 用于更新脏标志
    startTracking, // 开始跟踪依赖
    endTracking, // 结束跟踪依赖
    processEffectNotifications, // 处理排队的副作用通知
    processComputedUpdate, // 处理计算值的更新
    processPendingInnerEffects, // 处理待处理的内部副作用
} = createReactiveSystem({
    /**
     * 更新计算值的函数
     * @param computed - 要更新的计算值对象
     * @returns 如果计算值发生变化返回 true，否则返回 false
     */
    updateComputed(computed: Computed): boolean {
        // 保存当前的活动订阅者
        const prevSub = activeSub;
        // 将当前活动订阅者设置为要更新的计算值对象
        activeSub = computed;
        // 开始跟踪该计算值对象的依赖
        startTracking(computed);
        try {
            // 获取计算值的旧值
            const oldValue = computed.currentValue;
            // 调用 getter 函数计算新值
            const newValue = computed.getter(oldValue);
            // 如果新旧值不同，更新计算值并返回 true
            if (oldValue!== newValue) {
                computed.currentValue = newValue;
                return true;
            }
            // 否则返回 false
            return false;
        } finally {
            // 恢复之前的活动订阅者
            activeSub = prevSub;
            // 结束跟踪该计算值对象的依赖
            endTracking(computed);
        }
    },
    /**
     * 通知副作用的函数
     * @param e - 副作用对象或副作用作用域对象
     * @returns 如果成功处理副作用返回 true，否则返回 false
     */
    notifyEffect(e: Effect | EffectScope) {
        // 如果是副作用作用域对象
        if ('isScope' in e) {
            // 调用通知副作用作用域的函数
            return notifyEffectScope(e);
        } else {
            // 否则调用通知副作用的函数
            return notifyEffect(e);
        }
    },
});

// 用于暂停跟踪时保存活动订阅者的栈
const pauseStack: (Subscriber | undefined)[] = [];

// 批量操作的深度，用于控制何时处理副作用通知
let batchDepth = 0;
// 当前的活动订阅者
let activeSub: Subscriber | undefined;
// 当前的活动副作用作用域
let activeScope: EffectScope | undefined;

//#region Public functions
/**
 * 开始一个批量操作
 * 增加批量操作的深度
 */
export function startBatch() {
    ++batchDepth;
}

/**
 * 结束一个批量操作
 * 如果批量操作深度减为 0，处理排队的副作用通知
 */
export function endBatch() {
    if (!--batchDepth) {
        processEffectNotifications();
    }
}

/**
 * 暂停跟踪依赖
 * 将当前活动订阅者压入暂停栈，并将活动订阅者置为 undefined
 */
export function pauseTracking() {
    pauseStack.push(activeSub);
    activeSub = undefined;
}

/**
 * 恢复跟踪依赖
 * 从暂停栈中弹出之前保存的活动订阅者
 */
export function resumeTracking() {
    activeSub = pauseStack.pop();
}

/**
 * 创建一个可写的信号
 * @param oldValue - 信号的初始值，可选
 * @returns 一个可写的信号函数
 */
export function signal<T>(): WriteableSignal<T | undefined>;
export function signal<T>(oldValue: T): WriteableSignal<T>;
export function signal<T>(oldValue?: T): WriteableSignal<T | undefined> {
    // 绑定信号的 getter 和 setter 函数到一个对象上
    return signalGetterSetter.bind({
        currentValue: oldValue,
        subs: undefined,
        subsTail: undefined,
    }) as WriteableSignal<T | undefined>;
}

/**
 * 创建一个计算值
 * @param getter - 计算值的 getter 函数
 * @returns 一个获取计算值的函数
 */
export function computed<T>(getter: (cachedValue?: T) => T): () => T {
    // 绑定计算值的 getter 函数到一个对象上
    return computedGetter.bind({
        currentValue: undefined,
        subs: undefined,
        subsTail: undefined,
        deps: undefined,
        depsTail: undefined,
        flags: SubscriberFlags.Computed | SubscriberFlags.Dirty,
        getter: getter as (cachedValue?: unknown) => unknown,
    }) as () => T;
}

/**
 * 创建一个副作用
 * @param fn - 副作用的执行函数
 * @returns 一个停止副作用的函数
 */
export function effect<T>(fn: () => T): () => void {
    // 创建一个副作用对象
    const e: Effect = {
        fn,
        subs: undefined,
        subsTail: undefined,
        deps: undefined,
        depsTail: undefined,
        flags: SubscriberFlags.Effect,
    };
    // 如果有活动订阅者，将副作用与活动订阅者链接
    if (activeSub!== undefined) {
        link(e, activeSub);
    } else if (activeScope!== undefined) {
        // 否则如果有活动副作用作用域，将副作用与活动副作用作用域链接
        link(e, activeScope);
    }
    // 运行副作用
    runEffect(e);
    // 返回停止副作用的函数
    return effectStop.bind(e);
}

/**
 * 创建一个副作用作用域
 * @param fn - 副作用作用域内的执行函数
 * @returns 一个停止副作用作用域的函数
 */
export function effectScope<T>(fn: () => T): () => void {
    // 创建一个副作用作用域对象
    const e: EffectScope = {
        deps: undefined,
        depsTail: undefined,
        flags: SubscriberFlags.Effect,
        isScope: true,
    };
    // 运行副作用作用域
    runEffectScope(e, fn);
    // 返回停止副作用作用域的函数
    return effectStop.bind(e);
}
//#endregion

//#region Internal functions
/**
 * 运行一个副作用
 * @param e - 要运行的副作用对象
 */
function runEffect(e: Effect): void {
    // 保存当前的活动订阅者
    const prevSub = activeSub;
    // 将当前活动订阅者设置为要运行的副作用对象
    activeSub = e;
    // 开始跟踪该副作用对象的依赖
    startTracking(e);
    try {
        // 执行副作用的函数
        e.fn();
    } finally {
        // 恢复之前的活动订阅者
        activeSub = prevSub;
        // 结束跟踪该副作用对象的依赖
        endTracking(e);
    }
}

/**
 * 运行一个副作用作用域
 * @param e - 要运行的副作用作用域对象
 * @param fn - 副作用作用域内的执行函数
 */
function runEffectScope(e: EffectScope, fn: () => void): void {
    // 保存当前的活动副作用作用域
    const prevSub = activeScope;
    // 将当前活动副作用作用域设置为要运行的副作用作用域对象
    activeScope = e;
    // 开始跟踪该副作用作用域对象的依赖
    startTracking(e);
    try {
        // 执行副作用作用域内的函数
        fn();
    } finally {
        // 恢复之前的活动副作用作用域
        activeScope = prevSub;
        // 结束跟踪该副作用作用域对象的依赖
        endTracking(e);
    }
}

/**
 * 通知一个副作用
 * @param e - 要通知的副作用对象
 * @returns 总是返回 true
 */
function notifyEffect(e: Effect): boolean {
    // 获取副作用对象的标志位
    const flags = e.flags;
    // 如果副作用对象被标记为脏数据，或者有待计算的依赖且更新脏标志成功
    if (
        flags & SubscriberFlags.Dirty
        || (flags & SubscriberFlags.PendingComputed && updateDirtyFlag(e, flags))
    ) {
        // 运行副作用
        runEffect(e);
    } else {
        // 处理待处理的内部副作用
        processPendingInnerEffects(e, e.flags);
    }
    return true;
}

/**
 * 通知一个副作用作用域
 * @param e - 要通知的副作用作用域对象
 * @returns 如果有待处理的副作用返回 true，否则返回 false
 */
function notifyEffectScope(e: EffectScope): boolean {
    // 获取副作用作用域对象的标志位
    const flags = e.flags;
    // 如果副作用作用域对象有待处理的副作用
    if (flags & SubscriberFlags.PendingEffect) {
        // 处理待处理的内部副作用
        processPendingInnerEffects(e, e.flags);
        return true;
    }
    return false;
}
//#endregion

//#region Bound functions
/**
 * 计算值的 getter 函数
 * @this - 计算值对象
 * @returns 计算值
 */
function computedGetter<T>(this: Computed<T>): T {
    // 获取计算值对象的标志位
    const flags = this.flags;
    // 如果计算值对象被标记为脏数据或有待计算的依赖
    if (flags & (SubscriberFlags.Dirty | SubscriberFlags.PendingComputed)) {
        // 处理计算值的更新
        processComputedUpdate(this, flags);
    }
    // 如果有活动订阅者，将计算值对象与活动订阅者链接
    if (activeSub!== undefined) {
        link(this, activeSub);
    } else if (activeScope!== undefined) {
        // 否则如果有活动副作用作用域，将计算值对象与活动副作用作用域链接
        link(this, activeScope);
    }
    // 返回计算值
    return this.currentValue!;
}

/**
 * 信号的 getter 和 setter 函数
 * @this - 信号对象
 * @param value - 可选的参数，用于设置信号的值
 * @returns 如果没有传入参数，返回信号的值；如果传入参数，设置信号的值并可能触发依赖传播
 */
function signalGetterSetter<T>(this: Signal<T>,...value: [T]): T | void {
    // 如果传入了参数
    if (value.length) {
        // 如果新值与旧值不同
        if (this.currentValue!== (this.currentValue = value[0])) {
            // 获取信号的订阅者
            const subs = this.subs;
            if (subs!== undefined) {
                // 传播依赖的变化
                propagate(subs);
                // 如果批量操作深度为 0，处理排队的副作用通知
                if (!batchDepth) {
                    processEffectNotifications();
                }
            }
        }
    } else {
        // 如果没有传入参数
        if (activeSub!== undefined) {
            // 如果有活动订阅者，将信号对象与活动订阅者链接
            link(this, activeSub);
        }
        // 返回信号的值
        return this.currentValue;
    }
}

/**
 * 停止一个订阅者（副作用或副作用作用域）
 * @this - 订阅者对象
 */
function effectStop(this: Subscriber): void {
    // 开始跟踪该订阅者的依赖
    startTracking(this);
    // 结束跟踪该订阅者的依赖，清除依赖关系
    endTracking(this);
}
//#endregion