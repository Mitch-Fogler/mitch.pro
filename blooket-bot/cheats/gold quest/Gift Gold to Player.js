(async () => {
    const e = (() => {
        const findReactNode = () => {
            let root = document.querySelector("body>div");
            const queue = [root];
            while (queue.length > 0) {
                const el = queue.shift();
                if (!el) continue;
                const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                if (reactKey) {
                    const fiber = el[reactKey];
                    let candidate = fiber?.child;
                    while (candidate) {
                        if (candidate.stateNode && (candidate.stateNode.setState || candidate.stateNode.props?.liveGameController)) {
                            return candidate.stateNode;
                        }
                        candidate = candidate.sibling || candidate.child;
                    }
                    const stateNode = fiber?.child?.stateNode || fiber?.memoizedProps?.liveGameController?._owner?.stateNode || fiber?.return?.stateNode;
                    if (stateNode) return stateNode;
                }
                const children = Array.from(el.children);
                queue.push(...children);
            }
            let current = document.querySelector("#app") || document.querySelector("#root") || document.body;
            const reactKey = Object.keys(current).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
            if (reactKey) {
                let fiber = current[reactKey];
                while (fiber) {
                    if (fiber.stateNode && (fiber.stateNode.setState || fiber.stateNode.props?.liveGameController)) {
                        return fiber.stateNode;
                    }
                    fiber = fiber.return;
                }
            }
            return null;
        };
        return findReactNode();
    })();

    if (!e) {
        alert("Could not find React stateNode!");
        return;
    }

    const opponent = prompt("Who would you like to gift gold to? (Case sensitive)");
    if (!opponent) return;

    const amount = parseInt(prompt("How much gold would you like to gift?")) || 0;

    e.safe = true;
    // Format is opponent:swap:my_new_gold
    // The host interprets this to add gold to the opponent.
    await e.props.liveGameController.setVal({
        path: `c/${e.props.client.name}/tat`,
        val: `${opponent}:swap:${(e.state.gold || 0) + amount}`
    });

    alert(`Gifted ${amount} gold to ${opponent}!`);
})();
