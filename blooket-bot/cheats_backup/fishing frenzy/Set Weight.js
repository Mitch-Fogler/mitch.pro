(async () =>  {
    var e=document.createElement("iframe"), e=(document.body.append(e), window.prompt=window.prompt, e.remove(), parseInt(prompt("How much weight would you like?"))||0), t=(() =>  {
        const findReactNode = () =>  {
            let root = document.querySelector("body>div");
            const queue = [root];
            while (queue.length > 0)  {
                const el = queue.shift();
                if (!el) continue;
                const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                if (reactKey)  {
                    const fiber = el[reactKey];
                    let candidate = fiber?.child;
                    while (candidate)  {
                        if (candidate.stateNode && (candidate.stateNode.setState || candidate.stateNode.props?.liveGameController))  {
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
                            if (reactKey)  {
                                let fiber = current[reactKey];
                                while (fiber)  {
                                    if (fiber.stateNode && (fiber.stateNode.setState || fiber.stateNode.props?.liveGameController))  {
                                        return fiber.stateNode;
                                        }
                                        fiber = fiber.return;
                                        }
                                        }
                                        return null;
                                        }
                                        ;
                                        return findReactNode();
                                        }
                                        )();
                                        t.setState( {
                                            weight:e, weight2:e
                                            }
                                            ), t.props.liveGameController.setVal( {
                                                path:"c/"+t.props.client.name, val: {
                                                    b:t.props.client.blook, w:e, f:["Crab", "Jellyfish", "Frog", "Pufferfish", "Octopus", "Narwhal", "Megalodon", "Blobfish", "Baby Shark"][Math.floor(9*Math.random())]
                                                    }
                                                    }
                                                    )
                                                }
                                                )();