(async () =>  {
    var e=document.createElement("iframe");
    document.body.append(e), window.alert=window.alert, e.remove();
    const n=(() =>  {
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
                                        e=window.location.pathname.startsWith("/play/lobby");
                                        if(!e&&window.location.pathname.startsWith("/blooks")||e) {
                                            let t, o=e?"keys":"entries";
                                            const c=Object[o];
                                            Object[o]=function(e) {
                                                return(e.Chick?(t=e, Object[o]=c):c).call(this, e)
                                                }
                                                , n.render(), e?n.setState( {
                                                    unlocks:Object.keys(t)
                                                    }
                                                    ):n.setState( {
                                                        blookData:Object.keys(t).reduce((e, t)=>(e[t]=n.state.blookData[t]||1, e),  {
                                                            }
                                                            ), allSets:Object.values(t).reduce((e, t)=>t.set&&e.includes(t.set)?e:e.concat(t.set), [])
                                                            }
                                                            )
                                                            }
                                                            else alert("This only works in lobbies or the dashboard blooks page.")
                                                        }
                                                        )();