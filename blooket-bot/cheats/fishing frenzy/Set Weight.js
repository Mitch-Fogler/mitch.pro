(async () => {
    const e = (() => {
        const findReactNode = () => {
            let current = document.querySelector("#app") || document.querySelector("#root") || document.body;
            const queue = [current];
            while (queue.length > 0) {
                const el = queue.shift();
                if (!el) continue;
                const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                if (reactKey) {
                    let fiber = el[reactKey];
                    const visited = new Set();
                    const fiberQueue = [fiber];
                    while (fiberQueue.length > 0) {
                        const node = fiberQueue.shift();
                        if (!node || visited.has(node)) continue;
                        visited.add(node);
                        
                        const props = node.memoizedProps || node.pendingProps;
                        if (props?.liveGameController) {
                            if (node.stateNode && !(node.stateNode instanceof HTMLElement)) {
                                return node.stateNode;
                            }
                            return {
                                props: props,
                                state: node.memoizedState || {},
                                setState: function(newState) {
                                    Object.assign(this.state, newState);
                                }
                            };
                        }
                        if (node.child) fiberQueue.push(node.child);
                        if (node.sibling) fiberQueue.push(node.sibling);
                        if (node.return) fiberQueue.push(node.return);
                    }
                }
                const children = Array.from(el.children);
                queue.push(...children);
            }
            return null;
        };
        return findReactNode();
    })();

    if (!e) {
        alert("Could not find React stateNode!");
        return;
    }

    const val = parseInt(prompt("How much weight would you like?")) || 0;

    e.setState({
        weight: val,
        weight2: val
    });

    await e.props.liveGameController.setVal({
        path: `c/${e.props.client.name}/w`,
        val: val
    });
})();