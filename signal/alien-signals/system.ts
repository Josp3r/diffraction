// 定义依赖接口，描述依赖的结构
export interface Dependency {
    // 依赖的订阅者链表头，可能为 undefined
    subs: Link | undefined;
    // 依赖的订阅者链表尾，可能为 undefined
    subsTail: Link | undefined;
}

// 定义订阅者接口，描述订阅者的结构
export interface Subscriber {
    // 订阅者的标志位，用于表示不同的状态
    flags: SubscriberFlags;
    // 订阅者的依赖链表头，可能为 undefined
    deps: Link | undefined;
    // 订阅者的依赖链表尾，可能为 undefined
    depsTail: Link | undefined;
}

// 定义链接接口，用于连接依赖和订阅者
export interface Link {
    // 关联的依赖对象，可能同时也是订阅者
    dep: Dependency | (Dependency & Subscriber);
    // 关联的订阅者对象，可能同时也是依赖
    sub: Subscriber | (Dependency & Subscriber);
    // 用于更新脏标志时链接上一个栈，也用于传播过程中链接上一个栈
    prevSub: Link | undefined;
    // 用于链接下一个订阅者
    nextSub: Link | undefined;
    // 用于在排队的效果中链接通知效果
    nextDep: Link | undefined;
}

// 定义订阅者标志位枚举，用于表示订阅者的不同状态
export const enum SubscriberFlags {
    // 表示计算订阅者
    Computed = 1 << 0,
    // 表示副作用订阅者
    Effect = 1 << 1,
    // 表示正在跟踪依赖
    Tracking = 1 << 2,
    // 表示已通知
    Notified = 1 << 3,
    // 表示已递归处理
    Recursed = 1 << 4,
    // 表示脏数据，需要重新计算
    Dirty = 1 << 5,
    // 表示待计算
    PendingComputed = 1 << 6,
    // 表示待处理副作用
    PendingEffect = 1 << 7,
    // 组合标志，包含脏数据、待计算和待处理副作用
    Propagated = Dirty | PendingComputed | PendingEffect,
}

// 创建响应式系统的函数，接受两个回调函数作为参数
export function createReactiveSystem({
    updateComputed,
    notifyEffect,
}: {
    /**
     * 更新计算订阅者的值，并返回值是否发生变化
     * 
     * 当计算订阅者被标记为脏数据时，调用此函数
     * 调用计算订阅者的 getter 函数并更新其值
     * 如果值发生变化，存储新值并返回 true
     * 
     * @param computed - 要更新的计算订阅者
     * @returns 如果计算订阅者的值发生变化则返回 true，否则返回 false
     */
    updateComputed(computed: Dependency & Subscriber): boolean;
    /**
     * 处理副作用通知，通过处理指定的副作用
     * 
     * 当副作用首次收到以下任何标志时：
     *   - 脏数据
     *   - 待计算
     *   - 待处理副作用
     * 此方法将处理这些标志，如果成功处理则返回 true
     * 如果未完全处理，未来这些标志的变化将触发额外的调用，直到方法最终返回 true
     */
    notifyEffect(effect: Subscriber): boolean;
}) {
    // 排队的副作用链表头，可能为 undefined
    let queuedEffects: Subscriber | undefined;
    // 排队的副作用链表尾，可能为 undefined
    let queuedEffectsTail: Subscriber | undefined;

    return {
        /**
         * 如果给定的依赖和订阅者尚未链接，则将它们链接起来
         * 
         * @param dep - 要链接的依赖
         * @param sub - 依赖于此依赖的订阅者
         * @returns 如果两者尚未链接，则返回新创建的链接对象；否则返回 undefined
         */
        link(dep: Dependency, sub: Subscriber): Link | undefined {
            // 获取订阅者的当前依赖链表尾
            const currentDep = sub.depsTail;
            // 如果当前依赖链表尾存在且其关联的依赖就是要链接的依赖，则不做处理
            if (currentDep!== undefined && currentDep.dep === dep) {
                return;
            }
            // 获取当前依赖链表尾的下一个依赖
            const nextDep = currentDep!== undefined
              ? currentDep.nextDep
                : sub.deps;
            // 如果下一个依赖存在且其关联的依赖就是要链接的依赖，则更新订阅者的依赖链表尾并返回
            if (nextDep!== undefined && nextDep.dep === dep) {
                sub.depsTail = nextDep;
                return;
            }
            // 获取依赖的最后一个订阅者
            const depLastSub = dep.subsTail;
            // 如果依赖的最后一个订阅者存在，且其关联的订阅者就是要链接的订阅者，并且链接有效，则不做处理
            if (
                depLastSub!== undefined
                && depLastSub.sub === sub
                && isValidLink(depLastSub, sub)
            ) {
                return;
            }
            // 调用 linkNewDep 函数创建新的链接
            return linkNewDep(dep, sub, nextDep, currentDep);
        },
        /**
         * 从提供的链接开始遍历并标记订阅者
         * 
         * 设置标志（如脏数据、待计算、待处理副作用）到每个订阅者
         * 以指示哪些订阅者需要重新计算或处理副作用
         * 此函数应在信号值发生变化后调用
         * 
         * @param link - 传播开始的起始链接
         */
        propagate(link: Link): void {
            // 初始目标标志为脏数据
            let targetFlag = SubscriberFlags.Dirty;
            // 当前处理的链接
            let subs = link;
            // 栈深度
            let stack = 0;

            top: do {
                // 获取当前链接关联的订阅者
                const sub = link.sub;
                // 获取订阅者的标志位
                const subFlags = sub.flags;

                // 根据订阅者的标志位进行不同的处理
                if (
                    (
                        // 如果订阅者未处于跟踪、递归或传播状态，并且更新标志成功
                       !(subFlags & (SubscriberFlags.Tracking | SubscriberFlags.Recursed | SubscriberFlags.Propagated))
                        && (sub.flags = subFlags | targetFlag | SubscriberFlags.Notified, true)
                    )
                    || (
                        // 如果订阅者已递归处理，但未处于跟踪状态，并且更新标志成功
                        (subFlags & SubscriberFlags.Recursed)
                        &&!(subFlags & SubscriberFlags.Tracking)
                        && (sub.flags = (subFlags & ~SubscriberFlags.Recursed) | targetFlag | SubscriberFlags.Notified, true)
                    )
                    || (
                        // 如果订阅者未处于传播状态，链接有效，并且更新标志成功，且订阅者有子订阅者
                       !(subFlags & SubscriberFlags.Propagated)
                        && isValidLink(link, sub)
                        && (
                            sub.flags = subFlags | SubscriberFlags.Recursed | targetFlag | SubscriberFlags.Notified,
                            (sub as Dependency).subs!== undefined
                        )
                    )
                ) {
                    // 获取订阅者的子订阅者
                    const subSubs = (sub as Dependency).subs;
                    if (subSubs!== undefined) {
                        if (subSubs.nextSub!== undefined) {
                            // 更新子订阅者的前一个链接
                            subSubs.prevSub = subs;
                            // 更新当前处理的链接
                            link = subs = subSubs;
                            // 更新目标标志为待计算
                            targetFlag = SubscriberFlags.PendingComputed;
                            // 栈深度加 1
                            ++stack;
                        } else {
                            // 更新当前处理的链接
                            link = subSubs;
                            // 根据订阅者是否为副作用更新目标标志
                            targetFlag = subFlags & SubscriberFlags.Effect
                              ? SubscriberFlags.PendingEffect
                                : SubscriberFlags.PendingComputed;
                        }
                        // 继续下一次循环
                        continue;
                    }
                    // 如果订阅者是副作用订阅者
                    if (subFlags & SubscriberFlags.Effect) {
                        if (queuedEffectsTail!== undefined) {
                            // 将订阅者添加到排队的副作用链表中
                            queuedEffectsTail.depsTail!.nextDep = sub.deps;
                        } else {
                            // 初始化排队的副作用链表头
                            queuedEffects = sub;
                        }
                        // 更新排队的副作用链表尾
                        queuedEffectsTail = sub;
                    }
                } else if (!(subFlags & (SubscriberFlags.Tracking | targetFlag))) {
                    // 如果订阅者未处于跟踪或目标标志状态，更新标志
                    sub.flags = subFlags | targetFlag | SubscriberFlags.Notified;
                    if ((subFlags & (SubscriberFlags.Effect | SubscriberFlags.Notified)) === SubscriberFlags.Effect) {
                        // 如果订阅者是副作用订阅者，将其添加到排队的副作用链表中
                        if (queuedEffectsTail!== undefined) {
                            queuedEffectsTail.depsTail!.nextDep = sub.deps;
                        } else {
                            queuedEffects = sub;
                        }
                        queuedEffectsTail = sub;
                    }
                } else if (
                    // 如果订阅者未处于目标标志状态，但处于传播状态，且链接有效，更新标志
                   !(subFlags & targetFlag)
                    && (subFlags & SubscriberFlags.Propagated)
                    && isValidLink(link, sub)
                ) {
                    sub.flags = subFlags | targetFlag;
                }

                // 获取下一个链接
                if ((link = subs.nextSub!)!== undefined) {
                    // 更新当前处理的链接
                    subs = link;
                    // 根据栈深度更新目标标志
                    targetFlag = stack
                      ? SubscriberFlags.PendingComputed
                        : SubscriberFlags.Dirty;
                    // 继续下一次循环
                    continue;
                }

                // 处理栈
                while (stack) {
                    --stack;
                    // 获取当前链接关联的依赖
                    const dep = subs.dep;
                    // 获取依赖的子订阅者
                    const depSubs = dep.subs!;
                    // 更新当前处理的链接
                    subs = depSubs.prevSub!;
                    // 清空依赖子订阅者的前一个链接
                    depSubs.prevSub = undefined;
                    // 获取下一个链接
                    if ((link = subs.nextSub!)!== undefined) {
                        // 更新当前处理的链接
                        subs = link;
                        // 根据栈深度更新目标标志
                        targetFlag = stack
                          ? SubscriberFlags.PendingComputed
                            : SubscriberFlags.Dirty;
                        // 跳转到顶层循环继续处理
                        continue top;
                    }
                }

                // 跳出循环
                break;
            } while (true);
        },
        /**
         * 准备给定的订阅者以跟踪新的依赖
         * 
         * 重置订阅者的内部指针（如 depsTail）
         * 并设置其标志以指示现在正在跟踪依赖链接
         * 
         * @param sub - 要开始跟踪的订阅者
         */
        startTracking(sub: Subscriber): void {
            // 清空订阅者的依赖链表尾
            sub.depsTail = undefined;
            // 更新订阅者的标志，设置为跟踪状态
            sub.flags = (sub.flags & ~(SubscriberFlags.Notified | SubscriberFlags.Recursed | SubscriberFlags.Propagated)) | SubscriberFlags.Tracking;
        },
        /**
         * 结束指定订阅者的依赖跟踪
         * 
         * 清除或取消链接任何跟踪的依赖信息
         * 然后更新订阅者的标志以指示跟踪完成
         * 
         * @param sub - 跟踪结束的订阅者
         */
        endTracking(sub: Subscriber): void {
            // 获取订阅者的依赖链表尾
            const depsTail = sub.depsTail;
            if (depsTail!== undefined) {
                // 获取依赖链表尾的下一个依赖
                const nextDep = depsTail.nextDep;
                if (nextDep!== undefined) {
                    // 清除跟踪信息
                    clearTracking(nextDep);
                    // 清空依赖链表尾的下一个依赖
                    depsTail.nextDep = undefined;
                }
            } else if (sub.deps!== undefined) {
                // 清除跟踪信息
                clearTracking(sub.deps);
                // 清空订阅者的依赖链表头
                sub.deps = undefined;
            }
            // 清除订阅者的跟踪标志
            sub.flags &= ~SubscriberFlags.Tracking;
        },
        /**
         * 根据订阅者的依赖更新其脏标志
         * 
         * 如果订阅者有待计算的依赖，设置脏标志并返回 true
         * 否则清除待计算标志并返回 false
         * 
         * @param sub - 要更新的订阅者
         * @param flags - 订阅者的当前标志集
         * @returns 如果订阅者被标记为脏数据则返回 true，否则返回 false
         */
        updateDirtyFlag(sub: Subscriber, flags: SubscriberFlags): boolean {
            // 检查是否有脏数据
            if (checkDirty(sub.deps!)) {
                // 设置订阅者的脏标志
                sub.flags = flags | SubscriberFlags.Dirty;
                return true;
            } else {
                // 清除订阅者的待计算标志
                sub.flags = flags & ~SubscriberFlags.PendingComputed;
                return false;
            }
        },
        /**
         * 在访问计算订阅者的值之前，必要时更新它
         * 
         * 如果订阅者被标记为脏数据或待计算，运行提供的 updateComputed 逻辑
         * 并在实际更新发生时为任何下游订阅者触发浅传播
         * 
         * @param computed - 要更新的计算订阅者
         * @param flags - 订阅者的当前标志集
         */
        processComputedUpdate(computed: Dependency & Subscriber, flags: SubscriberFlags): void {
            if (
                // 如果订阅者被标记为脏数据
                flags & SubscriberFlags.Dirty
                || (
                    // 检查是否有脏数据
                    checkDirty(computed.deps!)
                      ? true
                        : (computed.flags = flags & ~SubscriberFlags.PendingComputed, false)
                )
            ) {
                // 更新计算订阅者的值
                if (updateComputed(computed)) {
                    // 获取计算订阅者的子订阅者
                    const subs = computed.subs;
                    if (subs!== undefined) {
                        // 进行浅传播
                        shallowPropagate(subs);
                    }
                }
            }
        },
        /**
         * 确保为给定的订阅者处理所有待处理的内部副作用
         * 
         * 这应该在副作用决定不重新运行自身但可能仍有待处理副作用标志的依赖时调用
         * 如果订阅者被标记为待处理副作用，清除该标志并对任何标记为副作用和传播的相关依赖调用 notifyEffect
         * 处理待处理的副作用
         * 
         * @param sub - 可能有待处理副作用的订阅者
         * @param flags - 订阅者上要检查的当前标志
         */
        processPendingInnerEffects(sub: Subscriber, flags: SubscriberFlags): void {
            // 如果订阅者被标记为待处理副作用
            if (flags & SubscriberFlags.PendingEffect) {
                // 清除订阅者的待处理副作用标志
                sub.flags = flags & ~SubscriberFlags.PendingEffect;
                // 获取订阅者的依赖链表头
                let link = sub.deps!;
                do {
                    // 获取当前链接关联的依赖
                    const dep = link.dep;
                    if (
                        // 如果依赖有标志位
                        'flags' in dep
                        // 且依赖是副作用订阅者
                        && dep.flags & SubscriberFlags.Effect
                        // 且依赖处于传播状态
                        && dep.flags & SubscriberFlags.Propagated
                    ) {
                        // 调用通知副作用函数
                        notifyEffect(dep);
                    }
                    // 获取下一个链接
                    link = link.nextDep!;
                } while (link!== undefined);
            }
        },
        /**
         * 在批量操作完成后处理排队的副作用通知
         * 
         * 遍历所有排队的副作用，对每个副作用调用 notifyEffect
         * 如果副作用仍部分处理，更新其标志，未来的通知可能会触发，直到完全处理
         */
        processEffectNotifications(): void {
            // 当排队的副作用链表头存在时
            while (queuedEffects!== undefined) {
                // 获取当前排队的副作用
                const effect = queuedEffects;
                // 获取副作用的依赖链表尾
                const depsTail = effect.depsTail!;
                // 获取排队的下一个副作用
                const queuedNext = depsTail.nextDep;
                if (queuedNext!== undefined) {
                    // 清空副作用的依赖链表尾的下一个依赖
                    depsTail.nextDep = undefined;
                    // 更新排队的副作用链表头
                    queuedEffects = queuedNext.sub;
                } else {
                    // 清空排队的副作用链表头
                    queuedEffects = undefined;
                    // 清空排队的副作用链表尾
                    queuedEffectsTail = undefined;
                }
                // 调用通知副作用函数
                if (!notifyEffect(effect)) {
                    // 清除副作用的通知标志
                    effect.flags &= ~SubscriberFlags.Notified;
                }
            }
        },
    };

    /**
     * 在给定的依赖和订阅者之间创建并附加一个新的链接
     * 
     * 如果链接池中有可用的链接对象，则重用它
     * 新形成的链接将添加到依赖的链表和订阅者的链表中
     * 
     * @param dep - 要链接的依赖
     * @param sub - 要附加到该依赖的订阅者
     * @param nextDep - 订阅者链中的下一个链接
     * @param depsTail - 订阅者链中的当前尾链接
     * @returns 新创建的链接对象
     */
    function linkNewDep(dep: Dependency, sub: Subscriber, nextDep: Link | undefined, depsTail: Link | undefined): Link {
        // 创建新的链接对象
        const newLink: Link = {
            dep,
            sub,
            nextDep,
            prevSub: undefined,
            nextSub: undefined,
        };

        if (depsTail === undefined) {
            // 如果订阅者的依赖链表尾为空，将新链接设置为依赖链表头
            sub.deps = newLink;
        } else {
            // 否则，将新链接添加到依赖链表尾的后面
            depsTail.nextDep = newLink;
        }

        if (dep.subs === undefined) {
            // 如果依赖的订阅者链表头为空，将新链接设置为订阅者链表头
            dep.subs = newLink;
        } else {
            // 否则，将新链接添加到订阅者链表尾的后面
            const oldTail = dep.subsTail!;
            newLink.prevSub = oldTail;
            oldTail.nextSub = newLink;
        }

        // 更新订阅者的依赖链表尾
        sub.depsTail = newLink;
        // 更新依赖的订阅者链表尾
        dep.subsTail = newLink;

        return newLink;
    }

    /**
     * 递归检查并更新所有标记为待处理的计算订阅者
     * 
     * 使用栈机制遍历链接结构
     * 对于每个处于待处理状态的计算订阅者，调用 updateComputed 并在值发生变化时触发浅传播
     * 返回是否发生了任何更新
     * 
     * @param link - 表示一系列待处理计算的起始链接
     * @returns 如果计算订阅者被更新则返回 true，否则返回 false
     */
    function checkDirty(link: Link): boolean {
        // 栈深度
        let stack = 0;
        // 是否有脏数据
        let dirty: boolean;

        top: do {
            // 初始设置为没有脏数据
            dirty = false;
            // 获取当前链接关联的依赖
            const dep = link.dep;

            if ('flags' in dep) {
                // 获取依赖的标志位
                const depFlags = dep.flags;
                if ((depFlags & (SubscriberFlags.Computed | SubscriberFlags.Dirty)) === (SubscriberFlags.Computed | SubscriberFlags.Dirty)) {
                    // 如果依赖是计算订阅者且被标记为脏数据
                    if (updateComputed(dep)) {
                        // 更新计算订阅者的值
                        const subs = dep.subs!;
                        if (subs.nextSub!== undefined) {
                            // 进行浅传播
                            shallowPropagate(subs);
                        }
                        // 设置有脏数据
                        dirty = true;
                    }
                } else if ((depFlags & (SubscriberFlags.Computed | SubscriberFlags.PendingComputed)) === (SubscriberFlags.Computed | SubscriberFlags.PendingComputed)) {
                    // 如果依赖是计算订阅者且被标记为待计算
                    const depSubs = dep.subs!;
                    if (depSubs.nextSub!== undefined) {
                        // 更新依赖子订阅者的前一个链接
                        depSubs.prevSub = link;
                    }
                    // 更新当前处理的链接
                    link = dep.deps!;
                    // 栈深度加 1
                    ++stack;
                    // 继续下一次循环
                    continue;
                }
            }

            if (!dirty && link.nextDep!== undefined) {
                // 如果没有脏数据且有下一个依赖，更新当前处理的链接
                link = link.nextDep;
                // 继续下一次循环
                continue;
            }

            if (stack) {
                // 如果栈深度不为 0
                let sub = link.sub as Dependency & Subscriber;
                do {
                    --stack;
                    // 获取订阅者的子订阅者
                    const subSubs = sub.subs!;

                    if (dirty) {
                        // 如果有脏数据
                        if (updateComputed(sub)) {
                            // 更新计算订阅者的值
                            if ((link = subSubs.prevSub!)!== undefined) {
                                // 清空订阅者子订阅者的前一个链接
                                subSubs.prevSub = undefined;
                                // 进行浅传播
                                shallowPropagate(subSubs);
                                // 更新当前处理的订阅者
                                sub = link.sub as Dependency & Subscriber;
                            } else {
                                // 更新当前处理的订阅者
                                sub = subSubs.sub as Dependency & Subscriber;
                            }
                            // 继续下一次循环
                            continue;
                        }
                    } else {
                        // 清除订阅者的待计算标志
                        sub.flags &= ~SubscriberFlags.PendingComputed;
                    }

                    if ((link = subSubs.prevSub!)!== undefined) {
                        // 清空订阅者子订阅者的前一个链接
                        subSubs.prevSub = undefined;
                        if (link.nextDep!== undefined) {
                            // 更新当前处理的链接
                            link = link.nextDep;
                            // 跳转到顶层循环继续处理
                            continue top;
                        }
                        // 更新当前处理的订阅者
                        sub = link.sub as Dependency & Subscriber;
                    } else {
                        if ((link = subSubs.nextDep!)!== undefined) {
                            // 跳转到顶层循环继续处理
                            continue top;
                        }
                        // 更新当前处理的订阅者
                        sub = subSubs.sub as Dependency & Subscriber;
                    }

                    // 重置脏数据标志
                    dirty = false;
                } while (stack);
            }

            return dirty;
        } while (true);
    }

    /**
     * 快速将每个订阅者链中的待计算状态传播为脏数据
     * 
     * 如果订阅者也被标记为副作用，将其添加到排队的副作用列表中以供后续处理
     * 
     * @param link - 要处理的链表头
     */
    function shallowPropagate(link: Link): void {
        do {
            // 获取当前链接关联的订阅者
            const sub = link.sub;
            // 获取订阅者的标志位
            const subFlags = sub.flags;
            if ((subFlags & (SubscriberFlags.PendingComputed | SubscriberFlags.Dirty)) === SubscriberFlags.PendingComputed) {
                // 如果订阅者被标记为待计算但未被标记为脏数据
                sub.flags = subFlags | SubscriberFlags.Dirty | SubscriberFlags.Notified;
                if ((subFlags & (SubscriberFlags.Effect | SubscriberFlags.Notified)) === SubscriberFlags.Effect) {
                    // 如果订阅者是副作用订阅者
                    if (queuedEffectsTail!== undefined) {
                        // 将订阅者添加到排队的副作用链表中
                        queuedEffectsTail.depsTail!.nextDep = sub.deps;
                    } else {
                        // 初始化排队的副作用链表头
                        queuedEffects = sub;
                    }
                    // 更新排队的副作用链表尾
                    queuedEffectsTail = sub;
                }
            }
            // 获取下一个链接
            link = link.nextSub!;
        } while (link!== undefined);
    }

    /**
     * 验证给定的链接对于指定的订阅者是否有效
     * 
     * 遍历订阅者的链接列表（从 sub.deps 到 sub.depsTail）
     * 以确定提供的链接对象是否是该链的一部分
     * 
     * @param checkLink - 要验证的链接对象
     * @param sub - 要检查其链接列表的订阅者
     * @returns 如果链接在订阅者的列表中找到则返回 true，否则返回 false
     */
    function isValidLink(checkLink: Link, sub: Subscriber): boolean {
        // 获取订阅者的依赖链表尾
        const depsTail = sub.depsTail;
        if (depsTail!== undefined) {
            // 获取订阅者的依赖链表头
            let link = sub.deps!;
            do {
                if (link === checkLink) {
                    // 如果找到匹配的链接，返回 true
                    return true;
                }
                if (link === depsTail) {
                    // 如果到达依赖链表尾，跳出循环
                    break;
                }
                // 获取下一个链接
                link = link.nextDep!;
            } while (link!== undefined);
        }
        // 未找到匹配的链接，返回 false
        return false;
    }

    /**
     * 从给定的链接开始清除依赖 - 订阅关系
     * 
     * 从依赖和订阅者中分离链接，然后继续处理链中的下一个链接
     * 链接对象将返回到链接池以供重用
     * 
     * @param link - 要清除的链接链的头
     */
    function clearTracking(link: Link): void {
        do {
            // 获取当前链接关联的依赖
            const dep = link.dep;
            // 获取当前链接的下一个依赖
            const nextDep = link.nextDep;
            // 获取当前链接的下一个订阅者
            const nextSub = link.nextSub;
            // 获取当前链接的前一个订阅者
            const prevSub = link.prevSub;

            if (nextSub!== undefined) {
                // 更新下一个订阅者的前一个链接
                nextSub.prevSub = prevSub;
            } else {
                // 更新依赖的订阅者链表尾
                dep.subsTail = prevSub;
            }

            if (prevSub!== undefined) {
                // 更新前一个订阅者的下一个链接
                prevSub.nextSub = nextSub;
            } else {
                // 更新依赖的订阅者链表头
                dep.subs = nextSub;
            }

            if (dep.subs === undefined && 'deps' in dep) {
                // 如果依赖的订阅者链表头为空且依赖有依赖链表
                const depFlags = dep.flags;
                if (!(depFlags & SubscriberFlags.Dirty)) {
                    // 如果依赖未被标记为脏数据，设置脏数据标志
                    dep.flags = depFlags | SubscriberFlags.Dirty;
                }
                const depDeps = dep.deps;
                if (depDeps!== undefined) {
                    // 更新当前处理的链接
                    link = depDeps;
                    // 更新依赖的依赖链表尾的下一个依赖
                    dep.depsTail!.nextDep = nextDep;
                    // 清空依赖的依赖链表头
                    dep.deps = undefined;
                    // 清空依赖的依赖链表尾
                    dep.depsTail = undefined;
                    // 继续下一次循环
                    continue;
                }
            }
            // 更新当前处理的链接
            link = nextDep!;
        } while (link!== undefined);
    }
}