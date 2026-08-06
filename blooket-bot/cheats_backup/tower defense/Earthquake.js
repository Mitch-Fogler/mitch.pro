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
                                        )(), r=(n.setState( {
                                            eventName:"Earthquake", event: {
                                                short:"e", color:"#805500", icon:"fas fa-mountain", desc:"All of your towers get mixed up", rate:.02
                                                }
                                                , buyTowerName:"", buyTower: {
                                                    }
                                                    }
                                                    , ()=>n.eventTimeout=setTimeout(()=>n.setState( {
                                                        event: {
                                                            }
                                                            , eventName:""
                                                            }
                                                            ), 6e3)), n.tiles.forEach(o=>o.forEach((e, t)=>3==e&&(o[t]=0))), []);
                                                            for(let t=0;
                                                            t<n.tiles.length;
                                                            t++)for(let e=0;
                                                            e<n.tiles[t].length;
                                                            e++)0==n.tiles[t][e]&&r.push( {
                                                                x:e, y:t
                                                                }
                                                                );
                                                                r.sort(()=>Math.random()-Math.random()), n.towers.forEach(e=> {
                                                                    var {
                                                                        x:t, y:o
                                                                        }
                                                                        =r.pop();
                                                                        e.move(t, o, n.tileSize), n.tiles[o][t]=3
                                                                        }
                                                                        )
                                                                    }
                                                                    )();