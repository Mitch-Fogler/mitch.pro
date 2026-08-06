(async () =>  {
    let n=(() =>  {
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
                                        n.props.liveGameController.getDatabaseVal("c", e=> {
                                            if(null!=e) {
                                                var t=[];
                                                for(const o in e)o!=n.props.client.name&&t.push( {
                                                    name:o, blook:e[o].b, toys:e[o].t||0
                                                    }
                                                    );
                                                    n.setState( {
                                                        choosingPlayer:!1, players:t, phaseTwo:!0, stage:"prize", choiceObj: {
                                                            type:"swap"
                                                            }
                                                            }
                                                            , ()=>setTimeout(()=>n.setState( {
                                                                choosingPlayer:!0
                                                                }
                                                                ), 300))
                                                                }
                                                                }
                                                                )
                                                            }
                                                            )();