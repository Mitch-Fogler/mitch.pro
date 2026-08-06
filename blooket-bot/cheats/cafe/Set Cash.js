(async () =>  {
    var e = document.createElement("iframe");
    e.style.display = "none";
    document.body.append(e);
    window.prompt = window.prompt;
    e.remove();
    var val = parseInt(prompt("How much cash would you like?")) || 0;

    const findGameData = () => {
        let current = document.querySelector("#app") || document.querySelector("#root") || document.body;
        const queue = [current];
        while (queue.length > 0) {
            const el = queue.shift();
            if (!el) continue;
            const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
            if (reactKey) {
                let fiber = el[reactKey];
                while (fiber) {
                    const props = fiber.memoizedProps;
                    if (props && props.liveGameController && props.client) {
                        return {
                            controller: props.liveGameController,
                            client: props.client,
                            stateNode: fiber.stateNode
                        };
                    }
                    fiber = fiber.child || fiber.return;
                }
            }
            queue.push(...Array.from(el.children));
        }
        return null;
    };

    const data = findGameData();
    if (data) {
        const { controller, client, stateNode } = data;
        if (stateNode && typeof stateNode.setState === 'function') {
            try { stateNode.setState({ cafeCash: val }); } catch(err) {}
        }
        controller.setVal({
            path: `c/${client.name}/ca`,
            val: val
        });
    } else {
        alert("Could not find active game controller. Make sure you are in the game.");
    }
})();