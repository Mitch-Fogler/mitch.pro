(async () =>  {
    let a=(() =>  {
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
                                        "prize"==a.state.stage&&a.props.liveGameController.getDatabaseVal("c", t=> {
                                            if(null!=t) {
                                                t=Object.entries(t);
                                                let o=0, n=0, c=-1;
                                                for(let e=0;
                                                e<t.length;
                                                e++)t[e][0]!=a.props.client.name&&t[e][1]>o&&(o=t[e][1]);
                                                for(let t=0;
                                                t<a.state.choices.length;
                                                t++) {
                                                    var l=a.state.choices[t];
                                                    let e=a.state.gold;
                                                    "gold"==l.type?e=a.state.gold+l.val||a.state.gold:"multiply"==l.type||"divide"==l.type?e=Math.round(a.state.gold*l.val)||a.state.gold:"swap"==l.type?e=o||a.state.gold:"take"==l.type&&(e=a.state.gold+o*l.val||a.state.gold), (e||0)<=n||(n=e, c=t+1)
                                                    }
                                                    document.querySelector("div[class*='choice"+c+"']")?.click()
                                                    }
                                                    }
                                                    )
                                                }
                                                )();